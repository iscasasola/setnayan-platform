'use server';

/**
 * entourage-order-actions.ts — the couple sets who walks first.
 *
 * ⚖ Owner 2026-09-20, having been shown the invitation's printing order: he
 * wants to arrange the people inside each role himself. Until this, there was
 * no order at all — neither entourage query carried an `ORDER BY`, so within a
 * role the names came back however Postgres felt and could reshuffle between
 * page loads. A surname sort now supplies the default; this writes the
 * couple's override on top of it (`guests.entourage_order`).
 *
 * ── WHY IT WRITES THE WHOLE GROUP, NOT THE TWO ROWS THAT MOVED ─────────────
 * A swap only touches two people IF everyone in that group already carries a
 * dense order — and on the first move nobody does, they are all NULL. Writing
 * the full 0..n-1 sequence every time means there is no "have we normalised
 * yet" state to get wrong, and the second move behaves exactly like the
 * hundredth. That costs one statement (`lib/entourage-write.ts`), not one per
 * person.
 *
 * 🔑 THE ORDER IT ACTS ON IS THE ORDER THE INVITATION PRINTS — `entourageLines`
 * from the same module the public page builds from. Sorting here independently
 * (or trusting the dashboard's own `sort` param) would make "move her up" swap
 * her with whoever the DASHBOARD showed above her, changing the invitation
 * somewhere the couple was not looking.
 *
 * ── ⚖ OWNER 2026-09-23 — THESE NO LONGER `redirect()` ──────────────────────
 * *"when i move someone, the whole screen refreshes. feels laggy."* · *"when it
 * reloads, it goes back up and does not stay on where we are editing… we want
 * them to move and pair people easily and fast."*
 *
 * Every one of these used to end in `redirect('…?gview=walk&reordered=N')`.
 * From a plain `<form action>` that is a 303 — a FULL BROWSER NAVIGATION for
 * one tap of Move ↑, and a navigation starts at the top of the document.
 * Measured in production on 2026-09-23, this couple's own moves:
 * `POST …/guests 303` at 05:51:33, the page's two GETs landing 05:51:36-37.
 * That round trip IS the "whole screen refreshes" and the "goes back up".
 *
 * 🔑 A RETURNED REFUSAL IS STILL A REFUSAL. Nothing got more permissive: every
 * guard that used to `redirect` with a reason now RETURNS that same reason and
 * the island says it in place. What changed is that the couple keeps their
 * scroll position while being told.
 */

import {
  MARCH_READ_FAILED,
  MARCH_STALE,
  readMarchLines,
  revalidateMarch,
  writeLineOrder,
} from '@/lib/entourage-write';
import { createClient } from '@/lib/supabase/server';
import { ENTOURAGE_GROUP_KEYS, entourageGroupOfRole, type EntourageRow } from '@/lib/entourage';
import type { MarchResult } from '@/lib/march-result';

/**
 * Set a whole group's line order at once, from an explicit sequence.
 *
 * ⚖ 2026-09-23 — THE ONLY ORDER ACTION NOW. There used to be a second,
 * `moveInEntourageOrder(eventId, guestId, groupKey, 'up' | 'down')`, behind the
 * ↑/↓ forms. A single-step request means something only against the list the
 * SERVER happens to read, and the owner's ask is to move people fast, i.e. to
 * tap ↑ again before the last tap has landed — several single-step moves in
 * flight resolve against different reads and settle somewhere nobody chose,
 * while the screen goes on showing the order he tapped for. The arrows post the
 * whole sequence now, exactly like the drag, and the island keeps one write in
 * flight. An uncalled `'use server'` export is still a live HTTP endpoint, so
 * it was removed rather than left behind.
 *
 * 🔑 IT TAKES LEAD IDS, NOT POSITIONS. A position is only meaningful against
 * the order the client happened to be looking at; if the roster moved under
 * them (another tab, another planner) applying positions would silently
 * reorder the wrong lines. Naming the lines means a stale client can be
 * detected instead of obeyed.
 *
 * ⛔ Touches no chair, exactly like the button path.
 */
export async function setEntourageLineOrder(
  eventId: string,
  groupKey: string,
  leadGuestIds: readonly string[],
): Promise<MarchResult> {
  const read = await readMarchLines(eventId, groupKey);
  if (!read.ok) return read;
  const { supabase, lines } = read;

  const byLead = new Map<string, EntourageRow>();
  for (const line of lines) {
    const lead = line[0]?.id ?? line[1]?.id;
    if (lead) byLead.set(lead, line);
  }

  /*
    The client's sequence must name EVERY line in this group, exactly once. A
    short or unrecognised list means the page it was built from is not the page
    that exists now — refuse rather than apply a partial order, which would
    leave the processional in a state nobody chose.
  */
  const unique = [...new Set(leadGuestIds)];
  const resolved = unique.map((id) => byLead.get(id)).filter(Boolean) as EntourageRow[];
  if (unique.length !== leadGuestIds.length || resolved.length !== byLead.size) {
    return { ok: false, reason: MARCH_STALE };
  }

  const result = await writeLineOrder(supabase, eventId, resolved);
  if (result.ok) await revalidateMarch(eventId);
  return result;
}

/**
 * Hand one printed GROUP's order back to the alphabetical default.
 *
 * Without this, a couple who drags once can never get back to "no opinion" —
 * every name in that group keeps a number forever, and the default they were
 * happy with becomes unreachable.
 */
export async function clearEntourageOrder(
  eventId: string,
  groupKey: string,
): Promise<MarchResult> {
  if (!ENTOURAGE_GROUP_KEYS.includes(groupKey)) {
    return { ok: false, reason: 'That part of the entourage does not exist.' };
  }
  const supabase = await createClient();
  const { data: all, error: readErr } = await supabase
    .from('guests')
    .select('guest_id, role')
    .eq('event_id', eventId)
    .is('deleted_at', null);
  if (readErr) return { ok: false, reason: MARCH_READ_FAILED };

  // Every role in this printed group — derived, so a group that gains a role
  // does not quietly keep half its order.
  const ids = ((all ?? []) as Array<{ guest_id: string; role: string | null }>)
    .filter((g) => g.role && entourageGroupOfRole(g.role) === groupKey)
    .map((g) => g.guest_id);
  if (ids.length === 0) return { ok: true, written: 0 };

  const { data, error } = await supabase.rpc('clear_entourage_order', {
    p_event_id: eventId,
    p_guest_ids: ids,
  });
  if (error) return { ok: false, reason: 'That reset did not go through — nothing was changed.' };

  await revalidateMarch(eventId);
  return { ok: true, written: typeof data === 'number' ? data : 0 };
}
