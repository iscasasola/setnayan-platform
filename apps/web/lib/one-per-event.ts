/**
 * one-per-event.ts — WHICH SUPPLIERS A COUPLE MAY BOOK ONLY ONE OF PER EVENT, read from the one place it lives.
 *
 * Owner 2026-10-29 (Admin › Categories panels approved, "build them, with the One per event switch"; and
 * "remove LED Background. we can book multiple for that as well"). It used to be a hard-coded set here in the
 * app (`HARD_SINGLE_PICK_GROUPS`, lib/wedding-plan-groups.ts) AND a hard-coded CASE in the database; the two
 * had to be kept in step by hand. Now it is ONE switch, `service_categories.one_per_event`, edited on
 * Admin › Categories › a category › One per event, and read by BOTH:
 *
 *   · the database — `event_vendors.hard_single_group` is written from it by a trigger, and the lock indexes
 *     key on that column (migration 20271296971721_one_per_event_is_a_category_switch);
 *   · the app — this file: a plan group is one per event when one of its supplier kinds
 *     (`PLAN_GROUPS[].categories`, the coarse `vendor_category`) is what a switched-on category is FILED
 *     under (`service_categories.coarse_category`). The same join the database makes.
 *
 * 🔒 No list of groups lives in code — `one-per-event-has-one-source.test.ts`.
 *
 * Reads honest: `readOnePerEventGroups` says `{ ok: false }` when the read is refused. A caller that would ALLOW
 * on an empty answer must not treat a refusal as "none" — `finalizeVendor` refuses to lock instead; display-only
 * callers may fall back, because the database guard still refuses the second booking either way.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { PLAN_GROUPS, type PlanGroupId } from '@/lib/wedding-plan-groups';

/** One switched-on category, as read: what its shops (and so its bookings) are filed under. */
export type OnePerEventRow = { coarse_category: string | null; one_per_event: boolean | null };

export type OnePerEventRead = { ok: true; groups: ReadonlySet<PlanGroupId> } | { ok: false };

/** The plan groups that are one per event, from the switched-on categories' filings. Pure. */
export function onePerEventGroupsFrom(rows: readonly OnePerEventRow[]): ReadonlySet<PlanGroupId> {
  const kinds = new Set(rows.filter((r) => r.one_per_event && r.coarse_category).map((r) => r.coarse_category as string));
  return new Set(PLAN_GROUPS.filter((g) => g.categories.some((c) => kinds.has(c))).map((g) => g.id));
}

/** Read the switch. `{ ok: false }` when it could not be read — never a false "none". */
export async function readOnePerEventGroups(sb: SupabaseClient): Promise<OnePerEventRead> {
  const { data, error } = await sb
    .from('service_categories')
    .select('coarse_category, one_per_event')
    .eq('tier', 2)
    .eq('status', 'active')
    .eq('one_per_event', true);
  if (error || !data) {
    console.error('[supabase-error] lib/one-per-event.ts · from:service_categories.select', error);
    return { ok: false };
  }
  return { ok: true, groups: onePerEventGroupsFrom(data as OnePerEventRow[]) };
}

/** Is this plan group one per event? `groups` is the answer `readOnePerEventGroups` gave. */
export function isOnePerEventGroup(groupId: string | null | undefined, groups: ReadonlySet<string>): boolean {
  return Boolean(groupId && groups.has(groupId));
}
