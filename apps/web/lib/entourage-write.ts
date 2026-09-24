/**
 * entourage-write.ts — the Wedding March's shared read and write.
 *
 * ⚠ NO `import 'server-only'`, DELIBERATELY. It would be true — this file
 * builds a Supabase server client and nothing else may — but it is not
 * importable from `tsx --test`, and `lib/a-pair-walks-as-one-line.test.ts`
 * reaches this module transitively (test → panel → actions → here) to execute
 * `printedGroupsForView`. `lib/capture-credit-pure.ts` records the same trade
 * in the other direction. The boundary is held by construction instead: the
 * only importers are the two `'use server'` action files, and this module's
 * exports take a Supabase client, which no client component can produce.
 *
 * ⛔ NOT A `'use server'` FILE, AND THAT IS THE POINT. Every exported function
 * in a `'use server'` module becomes a callable HTTP endpoint. These helpers
 * take a Supabase client and a list of lines — arguments no endpoint could
 * accept and nobody outside this server should be handing us. They live here
 * so `entourage-order-actions.ts` and `march-actions.ts` can share them while
 * the action surface stays exactly the moves a couple can make.
 *
 * ── ONE ROUND TRIP, NOT FIFTY (owner 2026-09-23: "feels laggy") ────────────
 * The order write used to be one `UPDATE` per person, awaited in a loop. The
 * group is rewritten whole on every move by design — so for this couple's
 * Principal Sponsors that was 50 sequential round trips from a Vercel lambda
 * to Supabase Singapore for one tap of Move ↑. Measured in production on
 * 2026-09-23: `POST …/guests 303` at 05:51:33, the page's GETs at 05:51:36-37.
 *
 * 🔑 THE ROW COUNT WAS NEVER THE PROBLEM — THE ROUND TRIPS WERE. What is
 * written is unchanged (the whole group, 0..n-1, both halves of a pair sharing
 * a number). Only the number of times we ask changed.
 *
 * ⛔ TOUCHES NO CHAIR. `entourage_order` is the line in the aisle;
 * `event_seat_assignments` + `seating_priority` are the chair.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  ENTOURAGE_COLUMNS,
  ENTOURAGE_GROUP_KEYS,
  entourageLines,
  type EntourageGuestRow,
  type EntourageRow,
} from '@/lib/entourage';
import type { MarchResult } from '@/lib/march-result';

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const MARCH_READ_FAILED =
  'The Wedding March could not be read just now, so nothing was changed.';
export const MARCH_WRITE_FAILED =
  'The Wedding March could not be saved just now, so nothing was changed.';
export const MARCH_STALE =
  'This list moved while you were arranging it — reload and try again.';

/** Tell the invitation and the dashboard that the processional moved. */
export async function revalidateMarch(eventId: string): Promise<void> {
  revalidatePath(`/dashboard/${eventId}/guests`);
  revalidatePath('/[slug]', 'layout');
}

/** Read one group's lines fresh — never trust what the client thinks it saw. */
export async function readMarchLines(
  eventId: string,
  groupKey: string,
): Promise<
  | { ok: true; supabase: SupabaseServerClient; lines: EntourageRow[] }
  | { ok: false; reason: string }
> {
  if (!ENTOURAGE_GROUP_KEYS.includes(groupKey)) {
    return { ok: false, reason: 'That part of the entourage does not exist.' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('guests')
    .select(ENTOURAGE_COLUMNS)
    .eq('event_id', eventId)
    .is('deleted_at', null);
  if (error) return { ok: false, reason: MARCH_READ_FAILED };
  return {
    ok: true,
    supabase,
    lines: entourageLines((data ?? []) as EntourageGuestRow[], groupKey),
  };
}

/**
 * Write a whole group's line order — 0..n-1, both halves of a pair sharing a
 * number — in ONE statement.
 *
 * 🔑 BOTH HALVES GET THE SAME NUMBER. That is what makes the column able to
 * order a pair without a schema change; it always could, nothing was ever
 * writing it that way.
 */
export async function writeLineOrder(
  supabase: SupabaseServerClient,
  eventId: string,
  lines: readonly EntourageRow[],
): Promise<MarchResult> {
  const ids: string[] = [];
  const orders: number[] = [];
  for (const [index, line] of lines.entries()) {
    for (const half of line) {
      if (!half?.id) continue;
      ids.push(half.id);
      orders.push(index);
    }
  }
  if (ids.length === 0) return { ok: true, written: 0 };

  const { data, error } = await supabase.rpc('set_entourage_order', {
    p_event_id: eventId,
    p_guest_ids: ids,
    p_orders: orders,
  });
  if (error) return { ok: false, reason: MARCH_WRITE_FAILED };
  // 🔑 A zero-row UPDATE is success-shaped — count the rows RLS let through,
  // or "saved" is a guess.
  const written = typeof data === 'number' ? data : 0;
  if (written === 0) return { ok: false, reason: MARCH_WRITE_FAILED };
  return { ok: true, written };
}

/**
 * Give every line the number it already appears at, when none of them has one.
 *
 * A join or a swap hands a line's number to a person; on a surname-sorted group
 * there is no number yet, and without one the new pair would jump to wherever
 * its new lead's surname sorts — the move would work and the line would still
 * land somewhere nobody dropped it. Pinning writes the order the couple is
 * LOOKING at, so it changes nothing on screen.
 */
export async function pinLineOrder(
  supabase: SupabaseServerClient,
  eventId: string,
  lines: readonly EntourageRow[],
): Promise<MarchResult> {
  const unplaced = lines.some((ln) => ln.every((h) => !h || typeof h.order !== 'number'));
  if (!unplaced) return { ok: true, written: 0 };
  return writeLineOrder(supabase, eventId, lines);
}
