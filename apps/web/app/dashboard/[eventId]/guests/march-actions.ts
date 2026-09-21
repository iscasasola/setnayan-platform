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
 *      with step 4, and that is fine for the same reason
 *      `setEntourageLineOrder` gives: a half-written order is still a valid
 *      order.)
 *   4. ONE SQL call does the move itself, atomically — see migration
 *      `wedding_march_join_and_swap`.
 *
 * ⛔ Touches no chair. The seat plan is a different ordering on purpose.
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireHostMembership } from '@/lib/host-gate';
import {
  ENTOURAGE_COLUMNS,
  ENTOURAGE_GROUP_KEYS,
  entourageLines,
  orderedGroupKeys,
  type EntourageGuestRow,
  type EntourageRow,
} from '@/lib/entourage';
import { joinVerdict, nextSectionOrder, swapVerdict } from '@/lib/march-moves';

/** Back to the Wedding March, never the roster — see entourage-order-actions. */
function backToMarch(eventId: string, params: Record<string, string>): string {
  const q = new URLSearchParams({ gview: 'walk', ...params });
  return `/dashboard/${eventId}/guests?${q.toString()}`;
}

async function readGroup(eventId: string, groupKey: string) {
  if (!ENTOURAGE_GROUP_KEYS.includes(groupKey)) {
    redirect(backToMarch(eventId, { error: 'That part of the entourage does not exist.' }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('guests')
    .select(ENTOURAGE_COLUMNS)
    .eq('event_id', eventId)
    .is('deleted_at', null);
  if (error) {
    redirect(backToMarch(eventId, { error: 'The Wedding March could not be read just now, so nothing was changed.' }));
  }
  return { supabase, lines: entourageLines((data ?? []) as EntourageGuestRow[], groupKey) };
}

/** Step 3 — give every line the number it already appears at. */
async function pinOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  lines: readonly EntourageRow[],
): Promise<void> {
  const unplaced = lines.some((ln) => ln.every((h) => !h || typeof h.order !== 'number'));
  if (!unplaced) return;
  for (const [index, line] of lines.entries()) {
    for (const half of line) {
      if (!half?.id || half.order === index) continue;
      const { error } = await supabase
        .from('guests')
        .update({ entourage_order: index, updated_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .eq('guest_id', half.id);
      if (error) {
        redirect(backToMarch(eventId, { error: 'The Wedding March could not be saved just now, so nothing was changed.' }));
      }
    }
  }
}

function done(eventId: string, params: Record<string, string>): never {
  revalidatePath(`/dashboard/${eventId}/guests`);
  revalidatePath('/[slug]', 'layout');
  redirect(backToMarch(eventId, params));
}

/** Someone takes the empty place beside `anchorId`. */
export async function joinEntourageLine(
  eventId: string,
  groupKey: string,
  anchorId: string,
  joinerId: string,
): Promise<void> {
  const { supabase, lines } = await readGroup(eventId, groupKey);
  const verdict = joinVerdict(lines, groupKey, anchorId, joinerId);
  if (!verdict.ok) redirect(backToMarch(eventId, { error: verdict.reason }));

  await pinOrder(supabase, eventId, lines);
  const { error } = await supabase.rpc('join_entourage_line', {
    p_event_id: eventId,
    p_anchor: anchorId,
    p_joiner: joinerId,
  });
  if (error) redirect(backToMarch(eventId, { error: 'That pairing did not go through — nothing was changed.' }));
  done(eventId, { paired: '2' });
}

/** Two names trade places — partners and spots. */
export async function swapEntouragePlaces(
  eventId: string,
  groupKey: string,
  aId: string,
  bId: string,
): Promise<void> {
  const { supabase, lines } = await readGroup(eventId, groupKey);
  const verdict = swapVerdict(lines, groupKey, aId, bId);
  if (!verdict.ok) redirect(backToMarch(eventId, { error: verdict.reason }));

  await pinOrder(supabase, eventId, lines);
  const { error } = await supabase.rpc('swap_entourage_places', {
    p_event_id: eventId,
    p_a: aId,
    p_b: bId,
  });
  if (error) redirect(backToMarch(eventId, { error: 'That swap did not go through — nothing was changed.' }));
  done(eventId, { swapped: '2' });
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
): Promise<void> {
  await requireHostMembership(eventId);
  const { full, visible } = await readAllGroups(eventId);
  const next = nextSectionOrder(full, visible, groupKey, direction);
  if (!next) redirect(backToMarch(eventId, {}));
  await writeSectionOrder(eventId, next);
  done(eventId, { sections: '1' });
}

export async function resetEntourageSections(eventId: string): Promise<void> {
  await requireHostMembership(eventId);
  await writeSectionOrder(eventId, null);
  done(eventId, { sections: 'reset' });
}

async function readAllGroups(eventId: string): Promise<{ full: string[]; visible: Set<string> }> {
  const admin = createAdminClient();
  const [{ data: ev, error: evErr }, { data: rows, error: rowsErr }] = await Promise.all([
    admin.from('events').select('entourage_section_order').eq('event_id', eventId).maybeSingle(),
    admin.from('guests').select(ENTOURAGE_COLUMNS).eq('event_id', eventId).is('deleted_at', null),
  ]);
  if (evErr || rowsErr || !ev) {
    redirect(backToMarch(eventId, { error: 'The Wedding March could not be read just now, so nothing was changed.' }));
  }
  const saved = (ev as { entourage_section_order: string[] | null }).entourage_section_order;
  const all = (rows ?? []) as EntourageGuestRow[];
  const full = orderedGroupKeys(saved);
  return { full, visible: new Set(full.filter((k) => entourageLines(all, k).length > 0)) };
}

async function writeSectionOrder(eventId: string, order: string[] | null): Promise<void> {
  const admin = createAdminClient();
  // A zero-row UPDATE returns no error — count the rows, or "saved" is a guess.
  const { data, error } = await admin
    .from('events')
    .update({ entourage_section_order: order })
    .eq('event_id', eventId)
    .select('event_id');
  if (error || !data || data.length === 0) {
    redirect(backToMarch(eventId, { error: 'The new section order was not saved — nothing was changed.' }));
  }
}
