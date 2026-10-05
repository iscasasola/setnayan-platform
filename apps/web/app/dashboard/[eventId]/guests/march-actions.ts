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

import {
  pinLineOrder,
  readMarchLines,
  revalidateMarch,
} from '@/lib/entourage-write';
import { joinVerdict, swapVerdict } from '@/lib/march-moves';
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
 * 🚶 2026-10-06: `moveEntourageSection` / `resetEntourageSections` were the ↑↓
 * section controls of the walking-order panel, retired with it when the
 * Wedding March became the drag maker (`launch/_components/details-march.tsx`).
 * An uncalled `'use server'` export is still a live HTTP endpoint, so they went
 * with their only caller. `events.entourage_section_order` still PRINTS
 * (`orderedGroupKeys`); it has no editor until the owner asks for one.
 */
