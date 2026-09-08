'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hostUserId } from './_lib/host-authority';
import {
  DESK_WRITE_TARGET,
  captureHeldBack,
  statusForDatabase,
  supplierHeldBack,
  wordsHeldBack,
  type DeskSource,
  type DeskStatus,
} from '@/lib/story-desk';

/**
 * THE DESK'S DECISIONS — accept · reject · undo · edit (08 step 1.2).
 *
 * ═══ THREE RULES THIS FILE EXISTS TO KEEP ═══════════════════════════════════
 *
 * 1. **ACCEPT IS THE ONLY WAY ANYTHING ENTERS.** Every source is born
 *    `'pending'` and the public readers require the accepted value. There is no
 *    path here that publishes something the host did not choose.
 *
 * 2. **REJECT IS SILENT AND UNDOABLE.** Nobody is told. Nothing is deleted,
 *    nothing is emailed, no notification is emitted, and the guest's own row is
 *    untouched apart from the host's own decision column — so `undo` is a
 *    complete restoration, at any time, forever. ⛔ Do not "improve" a rejection
 *    into a decline note that reaches the guest: `guest_columns.decline_note`
 *    exists and returns a letter TO ITS AUTHOR, which is the shipped
 *    guest-columns queue's behaviour and deliberately NOT the desk's.
 *
 * 3. **A HELD-BACK ITEM CANNOT BE ACCEPTED, BY ANY ROUTE.** This file re-derives
 *    that server-side from the database rather than trusting anything the
 *    browser sent — the card could be stale, and the request could be
 *    hand-made. It is still not the last line: the host holds a per-column
 *    UPDATE grant on `status`, so they can PATCH PostgREST directly and never
 *    execute this code at all. The database refuses that on its own (trigger
 *    `papic_mission_completions_refuse_held_back` and the two
 *    `*_approved_needs_screen` CHECKs). **This check exists so the host gets a
 *    sentence instead of a raw database error, NOT because it is the fence.**
 *
 * ═══ WHY WRITES USE THE CALLER'S OWN SESSION ════════════════════════════════
 * The read (`_lib/load-desk.ts`) uses the admin client because the four sources
 * disagree about who their RLS admits. The WRITES do not: they ride the
 * caller's session so RLS is an independent second fence on every decision,
 * matching `approveKwento` / `approveColumn`, the two shipped queues this desk
 * replaces the deciding for. A write authorised only by an app-side `if` is the
 * shape that made eight capture gates advisory.
 */

export type DeskActionResult = { ok: true } | { ok: false; error: string };

const NO_ACCESS = 'You don’t have access to this celebration.';
const HELD_BACK =
  'This one is already held back — you cannot accept it. Someone in it asked ' +
  'not to be shown, or it is still being screened.';

/**
 * Re-derive "may this be accepted?" from the database, for one row.
 * Reads with the admin client because it must see the row regardless of which
 * of the four RLS shapes the caller falls under — this is a SAFETY read whose
 * only possible outcome is refusing more.
 */
async function heldBackNow(
  eventId: string,
  source: DeskSource,
  id: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { table, key } = DESK_WRITE_TARGET[source];

  if (source === 'kwento' || source === 'letter') {
    const { data, error } = await admin
      .from(table)
      .select('moderation_state, user_deleted_at, author_publicly_hidden')
      .eq(key, id)
      .eq('event_id', eventId)
      .maybeSingle();
    if (error || !data) return true; // unresolved ⇒ withhold
    const r = data as Record<string, unknown>;
    if (r.author_publicly_hidden === true) return true;
    return (
      wordsHeldBack({
        moderationState: typeof r.moderation_state === 'string' ? r.moderation_state : 'unscreened',
        userDeletedAt: typeof r.user_deleted_at === 'string' ? r.user_deleted_at : null,
      }) !== null
    );
  }

  if (source === 'supplier') {
    const { data, error } = await admin
      .from(table)
      .select('moderation_state')
      .eq(key, id)
      .eq('event_id', eventId)
      .maybeSingle();
    if (error || !data) return true;
    const ms = (data as Record<string, unknown>).moderation_state;
    return supplierHeldBack({ moderationState: typeof ms === 'string' ? ms : 'unscreened' }) !== null;
  }

  // ── challenge: the safety facts live on ANOTHER table, plus the veto ──────
  const { data, error } = await admin
    .from(table)
    .select('capture_id, consent_to_share')
    .eq(key, id)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !data) return true;
  const row = data as Record<string, unknown>;
  if (row.consent_to_share !== true) return true;
  const captureId = typeof row.capture_id === 'string' ? row.capture_id : null;
  if (!captureId) return true;

  const { data: cap, error: cErr } = await admin
    .from('papic_guest_captures')
    .select('capture_id, hidden_at, consent_to_public, moderation_state')
    .eq('capture_id', captureId)
    .maybeSingle();
  if (cErr) return true;

  // The veto, for THIS capture only.
  let vetoed = true;
  try {
    const { data: tags, error: tErr } = await admin
      .from('photo_tags')
      .select('guest_id, guests!inner(photo_consent, deleted_at)')
      .eq('event_id', eventId)
      .eq('source_table', 'papic_guest_captures')
      .eq('source_id', captureId)
      .is('removed_at', null);
    if (tErr) vetoed = true;
    else
      vetoed = (tags ?? []).some((t) => {
        const g = (t as Record<string, unknown>).guests as Record<string, unknown> | null;
        return g ? g.photo_consent === false && g.deleted_at === null : false;
      });
  } catch {
    vetoed = true;
  }

  const c = cap as Record<string, unknown> | null;
  return (
    captureHeldBack({
      exists: Boolean(c),
      hiddenAt: c && typeof c.hidden_at === 'string' ? c.hidden_at : null,
      consentToPublic: c ? c.consent_to_public === true : false,
      moderationState: c && typeof c.moderation_state === 'string' ? c.moderation_state : 'unscreened',
      taggedGuestOptedOut: vetoed,
    }) !== null
  );
}

/**
 * Accept, reject, or put an item back on the desk undecided.
 *
 * ⚠ ONE ACTION FOR ALL THREE ON PURPOSE. They are the same write to the same
 * column, and three near-identical actions is how one of them ends up with a
 * different authority check — the defect shape this repo has logged three times
 * ("a rule written three times had two copies laxer").
 */
export async function decideDeskItem(
  eventId: string,
  source: DeskSource,
  id: string,
  decision: DeskStatus,
): Promise<DeskActionResult> {
  if (!id?.trim()) return { ok: false, error: 'missing_input' };
  const userId = await hostUserId(eventId);
  if (!userId) return { ok: false, error: NO_ACCESS };

  if (decision === 'accepted' && (await heldBackNow(eventId, source, id))) {
    return { ok: false, error: HELD_BACK };
  }

  const { table, key, reviewedAtColumn } = DESK_WRITE_TARGET[source];
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: statusForDatabase(decision) };
  // Only where the host actually holds the grant — the two new columns are
  // granted on `status` ALONE, and naming a column PostgREST cannot write makes
  // it refuse the WHOLE update, which would arrive as an absence, not an error.
  if (reviewedAtColumn) {
    patch[reviewedAtColumn] = decision === 'pending' ? null : now;
    patch.updated_at = now;
  }

  const supabase = await createClient();
  const { error } = await supabase.from(table).update(patch).eq(key, id).eq('event_id', eventId);
  if (error) {
    // The database's own refusals carry a stable prefix; turn them into the
    // host's sentence rather than showing a raw constraint name.
    if (error.message.includes('desk:held_back') || error.message.includes('desk:no_capture')) {
      return { ok: false, error: HELD_BACK };
    }
    if (error.message.includes('approved_needs_screen')) return { ok: false, error: HELD_BACK };
    return { ok: false, error: error.message.slice(0, 120) };
  }

  revalidateDesk(eventId);
  return { ok: true };
}

/**
 * Edit an item's words in place.
 *
 * ⛔ ONLY THE TWO TEXT SOURCES ARE EDITABLE, and this refuses the others rather
 * than silently doing nothing. A challenge answer is a photograph or a clip —
 * there are no words of ours to change — and a supplier's caption belongs to
 * the supplier.
 *
 * ⚖ EDITING A GUEST'S WORDS IS A BIGGER THING. The desk says so on the card
 * (*"Trim for length freely; if you change what she meant, we ask her before it
 * publishes"*). The ASKING is not built here — it belongs with publish (S8) —
 * and this is deliberately not presented as if it were: nothing in this file
 * claims the guest was consulted.
 */
export async function editDeskItem(
  eventId: string,
  source: DeskSource,
  id: string,
  body: string,
): Promise<DeskActionResult> {
  if (!id?.trim()) return { ok: false, error: 'missing_input' };
  if (source !== 'kwento' && source !== 'letter') {
    return { ok: false, error: 'Those words are not yours to change.' };
  }
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'Leave something written, or turn it down instead.' };
  // Both tables cap the body at 280 in a CHECK; refuse here with a sentence
  // rather than letting the database refuse with a constraint name.
  if (trimmed.length > 280) {
    return { ok: false, error: 'That is longer than 280 characters — trim it a little.' };
  }

  const userId = await hostUserId(eventId);
  if (!userId) return { ok: false, error: NO_ACCESS };

  const { table, key } = DESK_WRITE_TARGET[source];
  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ body_text: trimmed, edited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq(key, id)
    .eq('event_id', eventId);
  if (error) return { ok: false, error: error.message.slice(0, 120) };

  revalidateDesk(eventId);
  return { ok: true };
}

/**
 * The desk is one of several surfaces reading these rows. The two shipped
 * queues keep rendering the same items, so a decision made here must not leave
 * them showing a stale one.
 */
function revalidateDesk(eventId: string): void {
  revalidatePath(`/dashboard/${eventId}/story`);
  revalidatePath(`/dashboard/${eventId}/studio/papic/moderation`);
  revalidatePath(`/dashboard/${eventId}/studio/guest-columns`);
}
