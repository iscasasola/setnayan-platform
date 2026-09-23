'use server';

/**
 * march-actions.ts — the Wedding March's two name moves.
 *
 * ⚖ Owner 2026-09-21: *"tapping should allow us to pair them as well with
 * someone. or the name can be dragged there to pair."* · *"dragging a name to
 * another will swap the names."*
 *
 * Both run the same four steps:
 *
 *   1. READ the group fresh — never trust what the client thinks it saw.
 *   2. ASK `lib/march-moves.ts`, the same rule the picker was built from. A
 *      stale or hand-crafted request is refused with the reason, in words.
 *   3. PIN THE ORDER if any line in the group is still unplaced. A move hands
 *      a line's number to a person; on a surname-sorted group there is no
 *      number yet, and without one the new pair would jump to wherever its
 *      new lead's surname sorts — the move would work and the line would
 *      still land somewhere nobody dropped it. Pinning writes the order the
 *      couple is LOOKING at, so it changes nothing on screen. (Not atomic
 *      with step 4, and that is fine: a half-written order is still a valid
 *      order. It is now ONE statement, so "half-written" needs a crash
 *      mid-statement rather than a dropped connection between row 7 and 8.)
 *   4. ONE SQL call does the move itself, atomically — see migration
 *      `wedding_march_join_and_swap`.
 *
 * ── ⚖ OWNER 2026-09-23 — THESE NO LONGER `redirect()` EITHER ───────────────
 * *"when i add the second person to pair with them, the screen becomes black
 * and stops loading."* · *"we want them to move and pair people easily and
 * fast."* Both of these ended every path — success AND refusal — in a
 * `redirect()` back to `?gview=walk&…`, so a pair cost a full page load and
 * the couple was thrown back to the top of a 29-line processional. They return
 * a `MarchResult` now and the island says it in place. See
 * `entourage-order-actions.ts` for the measurement.
 *
 * 🔑 THE RULE IS STILL ASKED, AND ITS ANSWER IS STILL OBEYED. A refusal that
 * used to travel as `?error=<sentence>` is now the returned `reason` — the
 * same sentence, reaching the same couple, without the navigation.
 *
 * ⛔ Touches no chair. The seat plan is a different ordering on purpose.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { requireHostMembership } from '@/lib/host-gate';
import {
  MARCH_READ_FAILED,
  pinLineOrder,
  readMarchLines,
  revalidateMarch,
} from '@/lib/entourage-write';
import {
  ENTOURAGE_COLUMNS,
  entourageLines,
  orderedGroupKeys,
  type EntourageGuestRow,
} from '@/lib/entourage';
import { joinVerdict, nextSectionOrder, swapVerdict } from '@/lib/march-moves';
import type { MarchResult } from '@/lib/march-result';

/** Someone takes the empty place beside `anchorId`. */
export async function joinEntourageLine(
  eventId: string,
  groupKey: string,
  anchorId: string,
  joinerId: string,
): Promise<MarchResult> {
  const read = await readMarchLines(eventId, groupKey);
  if (!read.ok) return read;
  const { supabase, lines } = read;

  const verdict = joinVerdict(lines, groupKey, anchorId, joinerId);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  const pinned = await pinLineOrder(supabase, eventId, lines);
  if (!pinned.ok) return pinned;

  const { error } = await supabase.rpc('join_entourage_line', {
    p_event_id: eventId,
    p_anchor: anchorId,
    p_joiner: joinerId,
  });
  if (error) return { ok: false, reason: 'That pairing did not go through — nothing was changed.' };

  await revalidateMarch(eventId);
  return { ok: true, written: 2 };
}

/** Two names trade places — partners and spots. */
export async function swapEntouragePlaces(
  eventId: string,
  groupKey: string,
  aId: string,
  bId: string,
): Promise<MarchResult> {
  const read = await readMarchLines(eventId, groupKey);
  if (!read.ok) return read;
  const { supabase, lines } = read;

  const verdict = swapVerdict(lines, groupKey, aId, bId);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  const pinned = await pinLineOrder(supabase, eventId, lines);
  if (!pinned.ok) return pinned;

  const { error } = await supabase.rpc('swap_entourage_places', {
    p_event_id: eventId,
    p_a: aId,
    p_b: bId,
  });
  if (error) return { ok: false, reason: 'That swap did not go through — nothing was changed.' };

  await revalidateMarch(eventId);
  return { ok: true, written: 2 };
}

/* ── SECTIONS ──────────────────────────────────────────────────────────────
 * ⚖ Owner 2026-09-21: *"we should be able to arrange the parents, immediate
 * family and other roles and modify its sequence."*
 *
 * The order is one per-event value, `events.entourage_section_order`, read by
 * the invitation through `orderedGroupKeys`. It is written with the admin
 * client after `requireHostMembership` — the column has no session UPDATE
 * grant on purpose (see its migration).
 */

export async function moveEntourageSection(
  eventId: string,
  groupKey: string,
  direction: 'up' | 'down',
): Promise<MarchResult> {
  await requireHostMembership(eventId);
  const read = await readAllGroups(eventId);
  if (!read.ok) return read;
  const next = nextSectionOrder(read.full, read.visible, groupKey, direction);
  // Nowhere to go is not an error — the first section has nothing above it.
  if (!next) return { ok: true, written: 0 };
  return writeSectionOrder(eventId, next);
}

export async function resetEntourageSections(eventId: string): Promise<MarchResult> {
  await requireHostMembership(eventId);
  return writeSectionOrder(eventId, null);
}

async function readAllGroups(
  eventId: string,
): Promise<{ ok: true; full: string[]; visible: Set<string> } | { ok: false; reason: string }> {
  const admin = createAdminClient();
  const [{ data: ev, error: evErr }, { data: rows, error: rowsErr }] = await Promise.all([
    admin.from('events').select('entourage_section_order').eq('event_id', eventId).maybeSingle(),
    admin.from('guests').select(ENTOURAGE_COLUMNS).eq('event_id', eventId).is('deleted_at', null),
  ]);
  if (evErr || rowsErr || !ev) return { ok: false, reason: MARCH_READ_FAILED };

  const saved = (ev as { entourage_section_order: string[] | null }).entourage_section_order;
  const all = (rows ?? []) as EntourageGuestRow[];
  const full = orderedGroupKeys(saved);
  return { ok: true, full, visible: new Set(full.filter((k) => entourageLines(all, k).length > 0)) };
}

async function writeSectionOrder(eventId: string, order: string[] | null): Promise<MarchResult> {
  const admin = createAdminClient();
  // A zero-row UPDATE returns no error — count the rows, or "saved" is a guess.
  const { data, error } = await admin
    .from('events')
    .update({ entourage_section_order: order })
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !data || data.length === 0) {
    return { ok: false, reason: 'The new section order was not saved — nothing was changed.' };
  }
  await revalidateMarch(eventId);
  return { ok: true, written: data.length };
}
