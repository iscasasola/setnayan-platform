'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { doorVerdict } from '@/lib/request-key';

/**
 * How a guest was checked in — `guest_checkins.method`, CHECKed in the DB
 * (migration 20271234853164 added 'nfc_tap'). The desk sets it from the path
 * that found the guest.
 */
export type CheckinMethod = 'qr_scan' | 'nfc_tap' | 'manual_search';

export type CheckinActionResult =
  | { ok: true; checkedInAt: string }
  | { ok: false; error: string };

export type UndoActionResult = { ok: true } | { ok: false; error: string };

/**
 * Throw unless the caller is a couple OR coordinator member of this event —
 * the two roles that run the door on the day (mirrors the RLS policy on
 * guest_checkins, so this is the friendly-error layer, not the security layer).
 */
async function assertDoorCrew(eventId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error('unauthenticated');
  const supabase = await createClient();
  const { data } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .in('member_type', ['couple', 'coordinator'])
    .maybeSingle();
  if (!data) throw new Error('forbidden');
  return user;
}

/** Check a guest in. Idempotent — a second call reports the existing time. */
export async function checkInGuest(
  eventId: string,
  guestId: string,
  method: CheckinMethod,
): Promise<CheckinActionResult> {
  let user;
  try {
    user = await assertDoorCrew(eventId);
  } catch {
    return { ok: false, error: 'Only the couple or a coordinator can check guests in.' };
  }

  const supabase = await createClient();

  // Belongs-to-event guard (RLS + the composite FK also enforce this; this
  // exists to return a friendly message instead of a constraint error).
  const { data: guest } = await supabase
    .from('guests')
    .select('guest_id, entry_source, deleted_at, custom_tags')
    .eq('guest_id', guestId)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!guest) return { ok: false, error: 'That guest is not on this event’s list.' };
  // 🔓 A request the couple has not accepted admits nobody — asked here, live,
  // not only by the desk's screen (owner 2026-09-29, frame H2).
  if (doorVerdict(guest as never).kind !== 'valid') {
    return { ok: false, error: 'Not confirmed yet — the couple hasn’t accepted this request.' };
  }

  const { data: inserted, error } = await supabase
    .from('guest_checkins')
    .insert({
      event_id: eventId,
      guest_id: guestId,
      checked_in_by_user_id: user.id,
      method,
    })
    .select('checked_in_at')
    .single();

  if (error) {
    // 23505 = already checked in (unique guest_id) — treat as success and
    // surface the original time so a double-scan at the door is a no-op.
    if ((error as { code?: string }).code === '23505') {
      const { data: existing } = await supabase
        .from('guest_checkins')
        .select('checked_in_at')
        .eq('guest_id', guestId)
        .maybeSingle();
      if (existing) {
        return { ok: true, checkedInAt: existing.checked_in_at };
      }
    }
    return { ok: false, error: 'Couldn’t check that guest in — try again.' };
  }

  revalidatePath(`/dashboard/${eventId}/guests/checkin`);
  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true, checkedInAt: inserted.checked_in_at };
}

/** Undo a check-in (mis-scan at the door). */
export async function undoCheckIn(
  eventId: string,
  guestId: string,
): Promise<UndoActionResult> {
  try {
    await assertDoorCrew(eventId);
  } catch {
    return { ok: false, error: 'Only the couple or a coordinator can undo a check-in.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('guest_checkins')
    .delete()
    .eq('event_id', eventId)
    .eq('guest_id', guestId);

  if (error) return { ok: false, error: 'Couldn’t undo that check-in — try again.' };

  revalidatePath(`/dashboard/${eventId}/guests/checkin`);
  revalidatePath(`/dashboard/${eventId}/guests`);
  return { ok: true };
}

/**
 * 🎟 THE DOOR CHECKS LIVE (owner 2026-09-29, DECISION_LOG "A REQUESTER GETS THEIR
 * QR AT ONCE": *"The door scanner checks status LIVE — a pending or declined QR
 * is refused even as a screenshot"*; prototype guest_ticket_flow_2026-09-29.html
 * frames H1–H3). Every scanned code is asked HERE, at the moment of scanning,
 * against the row — never against the picture, and never against the list the
 * desk loaded an hour ago:
 *
 *   valid    — on the list now (an accepted request included, and a Linked one
 *              resolves to the guest it was joined to);
 *   pending  — "Not confirmed yet": the couple has not accepted this request;
 *   declined — "Not approved": this code admits nobody;
 *   unknown  — not a guest of this event.
 *
 * The decision is `doorVerdict` (lib/request-key.ts, pure and tested); this only
 * reads the row, with removed rows included so a declined key can be named.
 */
export type TicketCheck =
  | { verdict: 'valid'; guestId: string; name: string; checkedAt: string }
  | { verdict: 'pending' | 'declined'; name: string; checkedAt: string }
  | { verdict: 'unknown'; checkedAt: string };

export async function checkTicketLive(eventId: string, qrToken: string): Promise<TicketCheck> {
  const checkedAt = new Date().toISOString();
  try {
    await assertDoorCrew(eventId);
  } catch {
    return { verdict: 'unknown', checkedAt };
  }
  const token = String(qrToken ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(token)) return { verdict: 'unknown', checkedAt };
  const admin = createAdminClient();
  const { data: row } = await admin
    .from('guests')
    .select('guest_id, event_id, first_name, last_name, display_name, entry_source, deleted_at, custom_tags')
    .eq('qr_token', token)
    .maybeSingle();
  if (!row || row.event_id !== eventId) return { verdict: 'unknown', checkedAt };
  const nameOf = (r: { display_name?: string | null; first_name?: string | null; last_name?: string | null }) =>
    (r.display_name ?? '').trim() || `${r.first_name ?? ''} ${(r.last_name ?? '').replace(/^—$/, '')}`.trim() || 'Guest';
  const v = doorVerdict(row as never);
  if (v.kind === 'pending' || v.kind === 'declined') return { verdict: v.kind, name: nameOf(row), checkedAt };
  if (v.kind !== 'valid') return { verdict: 'unknown', checkedAt };
  if (v.guestId === row.guest_id) return { verdict: 'valid', guestId: v.guestId, name: nameOf(row), checkedAt };
  const { data: joined } = await admin
    .from('guests')
    .select('guest_id, first_name, last_name, display_name')
    .eq('guest_id', v.guestId)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .maybeSingle();
  return joined
    ? { verdict: 'valid', guestId: joined.guest_id as string, name: nameOf(joined), checkedAt }
    : { verdict: 'unknown', checkedAt };
}
