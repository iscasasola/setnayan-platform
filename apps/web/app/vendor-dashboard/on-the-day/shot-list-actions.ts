'use server';

/**
 * Shot list server actions (DAY-10) — the writer that makes the shot list
 * reach the couple.
 *
 * Every write goes through the caller's own session client, so RLS on
 * `event_shot_list_items` (migration 20271234188149) is the boundary: a
 * supplier writes only their own list, only on an event they are booked on.
 * The booked check below is a friendlier early answer, not the authority.
 *
 * 🔑 NO SUCCESS-SHAPED NOTHING. An UPDATE/DELETE that matches zero rows is
 * reported as a failure (`.select()` + a row count), because the console shows
 * "saved — the couple can see this" on `ok: true`, and a refused write that
 * said ok would put a false sentence on a wedding-day screen.
 */

import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorRoomEvents } from '@/lib/vendor-room-access';
import {
  normalizeShotLabel,
  shotFromRow,
  type ServerRead,
  type Shot,
  type ShotRow,
} from '@/lib/shot-list';
import { eventFeeBlocksAction } from '@/lib/vendor-event-fee-access.server';

type Ctx =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      vendorProfileId: string;
    }
  | { ok: false; error: string };

const ROW_COLUMNS = 'item_id, vendor_profile_id, label, position, captured_at';

async function requireShotListVendor(eventId: string): Promise<Ctx> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No vendor profile.' };

  const bookings = await fetchVendorRoomEvents(supabase, profile.vendor_profile_id);
  if (!bookings.some((b) => b.eventId === eventId)) {
    return { ok: false, error: 'You are not booked on this event.' };
  }
  // The booking fee unlocks the event (owner, 2026-09-20). No-op while the
  // flag is off; a refused or missing fee read returns null (fail OPEN).
  const feeBlocked = await eventFeeBlocksAction(profile.vendor_profile_id, eventId);
  if (feeBlocked) return { ok: false, error: feeBlocked };
  return { ok: true, supabase, vendorProfileId: profile.vendor_profile_id };
}

export type ShotListWriteResult = { ok: true } | { ok: false; error: string };

/** This supplier's saved list for the event. `unreadable` ≠ empty. */
export async function loadShotList(eventId: string): Promise<ServerRead> {
  const ctx = await requireShotListVendor(eventId);
  if (!ctx.ok) return { state: 'unreadable' };

  const { data, error } = await ctx.supabase
    .from('event_shot_list_items')
    .select(ROW_COLUMNS)
    .eq('event_id', eventId)
    .eq('vendor_profile_id', ctx.vendorProfileId)
    .order('position', { ascending: true });

  if (error || !data) {
    logQueryError('loadShotList', error, { event_id: eventId }, 'graceful_degrade');
    return { state: 'unreadable' };
  }
  return { state: 'ok', rows: data as ShotRow[] };
}

/**
 * Save a whole list — the first save of a seed or a pre-sync device list, a
 * reset, and the "save again" after an offline stretch.
 *
 * Insert-then-delete, never delete-then-insert: if the second step fails the
 * worst case is a duplicated list the supplier can see and tidy, never a list
 * that vanished from the couple's screen.
 */
export async function replaceShotList(
  eventId: string,
  shots: ReadonlyArray<{ label: string; done: boolean }>,
): Promise<{ ok: true; shots: Shot[] } | { ok: false; error: string }> {
  const ctx = await requireShotListVendor(eventId);
  if (!ctx.ok) return ctx;

  const clean = shots
    .map((s) => ({ label: normalizeShotLabel(s.label), done: Boolean(s.done) }))
    .filter((s): s is { label: string; done: boolean } => s.label != null)
    .slice(0, 200);

  const { data: before, error: beforeError } = await ctx.supabase
    .from('event_shot_list_items')
    .select('item_id')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', ctx.vendorProfileId);
  if (beforeError) return { ok: false, error: beforeError.message };

  const now = new Date().toISOString();
  let inserted: ShotRow[] = [];
  if (clean.length > 0) {
    const { data, error } = await ctx.supabase
      .from('event_shot_list_items')
      .insert(
        clean.map((s, i) => ({
          event_id: eventId,
          vendor_profile_id: ctx.vendorProfileId,
          label: s.label,
          position: i,
          captured_at: s.done ? now : null,
        })),
      )
      .select(ROW_COLUMNS);
    if (error) return { ok: false, error: error.message };
    inserted = (data ?? []) as ShotRow[];
    if (inserted.length !== clean.length) {
      return { ok: false, error: 'Only part of the list saved. Try again.' };
    }
  }

  const oldIds = (before ?? []).map((r) => (r as { item_id: string }).item_id);
  if (oldIds.length > 0) {
    const { error } = await ctx.supabase
      .from('event_shot_list_items')
      .delete()
      .in('item_id', oldIds)
      .eq('vendor_profile_id', ctx.vendorProfileId);
    if (error) {
      logQueryError('replaceShotList.delete_old', error, { event_id: eventId });
      return { ok: false, error: 'Saved, but the old list could not be cleared. Reload to tidy it.' };
    }
  }

  return { ok: true, shots: inserted.map(shotFromRow) };
}

export async function addShot(
  eventId: string,
  rawLabel: string,
  position: number,
): Promise<{ ok: true; shot: Shot } | { ok: false; error: string }> {
  const label = normalizeShotLabel(rawLabel);
  if (!label) return { ok: false, error: 'Write the shot first.' };

  const ctx = await requireShotListVendor(eventId);
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.supabase
    .from('event_shot_list_items')
    .insert({
      event_id: eventId,
      vendor_profile_id: ctx.vendorProfileId,
      label,
      position: Number.isFinite(position) ? Math.max(0, Math.floor(position)) : 0,
    })
    .select(ROW_COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? 'Not saved.' };
  return { ok: true, shot: shotFromRow(data as ShotRow) };
}

export async function setShotCaptured(
  eventId: string,
  itemId: string,
  captured: boolean,
): Promise<ShotListWriteResult> {
  const ctx = await requireShotListVendor(eventId);
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.supabase
    .from('event_shot_list_items')
    .update({ captured_at: captured ? new Date().toISOString() : null })
    .eq('item_id', itemId)
    .eq('event_id', eventId)
    .eq('vendor_profile_id', ctx.vendorProfileId)
    .select('item_id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length !== 1) return { ok: false, error: 'That shot is no longer on the saved list.' };
  return { ok: true };
}

export async function removeShot(eventId: string, itemId: string): Promise<ShotListWriteResult> {
  const ctx = await requireShotListVendor(eventId);
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.supabase
    .from('event_shot_list_items')
    .delete()
    .eq('item_id', itemId)
    .eq('event_id', eventId)
    .eq('vendor_profile_id', ctx.vendorProfileId)
    .select('item_id');
  if (error) return { ok: false, error: error.message };
  if (!data || data.length !== 1) return { ok: false, error: 'That shot is no longer on the saved list.' };
  return { ok: true };
}
