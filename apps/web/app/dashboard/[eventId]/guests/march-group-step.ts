/**
 * march-group-step.ts — THE COUPLE'S OWN MARCH GROUPS, written at ✓ Apply.
 *
 * ⚖ Owner 2026-10-29 (DECISION_LOG "GUESTS ANSWERS … custom March groups YES"): *"yes. so if they have a custom way
 * of marching they can customize it."* In Guests › March a couple makes their own groups (＋ Group), names them,
 * drags walkers in, moves them by their header and deletes them — every one of those a drafted step
 * (`lib/march-drag.ts` `group-add` · `group-name` · `group-drop` · `regroup`), replayed here, in order, by the one
 * dispatch (`callMarchStep`, guests/march-step.ts) when the Event Hub draft is applied.
 *
 * 🔑 NOT A SERVER ACTION. No `'use server'`: plain functions the draft's Apply calls (+0 to the route budget,
 * `scripts/lint-server-action-budget.mjs`). Each asks the host gate itself, as every march action does.
 *
 *   · the group      → `march_groups` (the session client — its RLS is `march_walks`' own host terms);
 *   · its place      → `events.entourage_section_order`, through the ONE section-order writer (`writeSectionOrder`,
 *                      the admin client after `requireHostMembership` — the column has no session UPDATE grant);
 *   · who walks in it → `set_march_group` (the ONE writer of `march_walks.march_group`).
 * Every write is counted — a zero-row write is success-shaped, so "saved" is read, never assumed.
 * ⛔ Touches no guest row and no chair.
 */
import { createClient } from '@/lib/supabase/server';
import { refuseLimitedHelper, requireHostMembership } from '@/lib/host-gate';
import { MARCH_READ_FAILED, readAllGroups, revalidateMarch, writeSectionOrder } from '@/lib/entourage-write';
import { isOwnMarchGroup, OWN_GROUP_LABEL_MAX } from '@/lib/entourage';
import type { MarchResult } from '@/lib/march-result';

const NOT_SAVED = 'That group was not saved — nothing was changed.';
const GONE = 'That group is not in your march any more — nothing was changed.';

/** The heading as stored: trimmed, never empty, never past the column's bound. */
function cleanLabel(label: string): string | null {
  const text = label.trim();
  return text.length > 0 && text.length <= OWN_GROUP_LABEL_MAX ? text : null;
}

/** ＋ Group: the group, then its place in the section order — right after `after` (null = first). */
export async function addMarchGroup(eventId: string, key: string, label: string, after: string | null): Promise<MarchResult> {
  await refuseLimitedHelper(eventId, 'guest_list');
  await requireHostMembership(eventId);
  const text = cleanLabel(label);
  if (!isOwnMarchGroup(key) || !text) return { ok: false, reason: NOT_SAVED };
  const supabase = await createClient();
  // Applied twice (an Apply that stopped partway, then Apply again) is the same group, not a second one.
  const { data, error } = await supabase
    .from('march_groups')
    .upsert({ event_id: eventId, group_key: key, label: text }, { onConflict: 'event_id,group_key' })
    .select('group_key');
  if (error || !data || data.length === 0) return { ok: false, reason: NOT_SAVED };
  return placeGroup(eventId, key, after);
}

/** Put `key` right after `after` in the saved order (null = before every other section). */
async function placeGroup(eventId: string, key: string, after: string | null): Promise<MarchResult> {
  const read = await readAllGroups(eventId);
  if (!read.ok) return read;
  const rest = read.full.filter((k) => k !== key);
  const at = after === null ? -1 : rest.indexOf(after);
  const i = at === -1 ? (after === null ? 0 : rest.length) : at + 1;
  return writeSectionOrder(eventId, [...rest.slice(0, i), key, ...rest.slice(i)]);
}

/** Rename one of the couple's own groups. */
export async function nameMarchGroup(eventId: string, key: string, label: string): Promise<MarchResult> {
  await refuseLimitedHelper(eventId, 'guest_list');
  await requireHostMembership(eventId);
  const text = cleanLabel(label);
  if (!isOwnMarchGroup(key)) return { ok: false, reason: GONE };
  if (!text) return { ok: false, reason: 'A group needs a name.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('march_groups')
    .update({ label: text })
    .eq('event_id', eventId)
    .eq('group_key', key)
    .select('group_key');
  if (error) return { ok: false, reason: NOT_SAVED };
  if (!data || data.length === 0) return { ok: false, reason: GONE };
  await revalidateMarch(eventId);
  return { ok: true, written: data.length };
}

/**
 * Delete one of the couple's own groups. Its walkers (the maker sends them to "Not walking" first) — anyone still in it
 * walks again in their role's section (`ON DELETE SET NULL (march_group)`). Its key leaves the saved order too.
 */
export async function dropMarchGroup(eventId: string, key: string): Promise<MarchResult> {
  await refuseLimitedHelper(eventId, 'guest_list');
  await requireHostMembership(eventId);
  if (!isOwnMarchGroup(key)) return { ok: false, reason: GONE };
  const supabase = await createClient();
  // Zero rows deleted is still "gone" (Apply again after a stop) — the group not existing is the outcome asked for.
  const { error } = await supabase.from('march_groups').delete().eq('event_id', eventId).eq('group_key', key);
  if (error) return { ok: false, reason: NOT_SAVED };
  const read = await readAllGroups(eventId);
  if (!read.ok) return read;
  if (read.own.includes(key)) return { ok: false, reason: NOT_SAVED };
  // `full` is built from the groups that exist, so the key is no longer in it.
  return writeSectionOrder(eventId, read.full);
}

/** A walker into one of the couple's own groups (`section` = its key), or back to their role's section. */
export async function regroupWalker(eventId: string, section: string, guestId: string): Promise<MarchResult> {
  await refuseLimitedHelper(eventId, 'guest_list');
  const supabase = await createClient();
  const { data: g, error } = await supabase
    .from('guests')
    .select('role')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return { ok: false, reason: MARCH_READ_FAILED };
  const role = (g as { role: string | null } | null)?.role ?? null;
  if (!g) return { ok: false, reason: 'That person is not on the guest list any more — nothing was changed.' };
  if (role === 'groom' || role === 'bride') return { ok: false, reason: 'The couple always walk in their own sides.' };
  const { data: n, error: rpcError } = await supabase.rpc('set_march_group', {
    p_event_id: eventId,
    p_guest_id: guestId,
    p_group: isOwnMarchGroup(section) ? section : null,
  });
  if (rpcError || n !== 1) return { ok: false, reason: isOwnMarchGroup(section) ? GONE : 'That did not go through — nothing was changed.' };
  await revalidateMarch(eventId);
  return { ok: true, written: 1 };
}
