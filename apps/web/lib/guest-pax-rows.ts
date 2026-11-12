/**
 * 🍽 The Guest List's Show & sort pax rows, built on the server from `readNotCountedOnList` (owner 2026-11-12; the rule
 * and the client half are `lib/guest-pax-filter.ts`). PURE, and kept OUT of the List's bundle: it reads the rule test
 * (`isOutsideRule`) from `lib/supplier-count.ts`, which the client never needs for this.
 * 🔒 lib/the-list-shows-who-each-pax-service-counts.test.ts
 */
import type { NotCountedOnList } from '@/lib/guest-not-counted.server';
import { paxServiceNames, type PaxListService } from '@/lib/guest-pax-filter';
import type { GuestRole } from '@/lib/guests';
import { isOutsideRule } from '@/lib/supplier-count';

/**
 * 🍽 The List's Show & sort rows — one per PER-HEAD service (`read.services` is only ever per head), each with the guests
 * ticked out of it and the guests its own rule leaves out (`isOutsideRule`, the SQL's test). `groupIdsOf` = the guest's
 * custom-group ids. Null read → no rows.
 */
export function paxServicesForList(
  read: NotCountedOnList | null,
  guests: readonly { guest_id: string; role: GuestRole; extra_roles?: GuestRole[] | null }[],
  groupIdsOf: (guestId: string) => readonly string[],
): PaxListService[] {
  if (!read) return [];
  const names = paxServiceNames(read.services);
  return read.services.map((s) => ({
    id: s.id,
    name: names.get(s.id) ?? s.label,
    ticked: Object.keys(read.ticks).filter((gid) => read.ticks[gid]!.includes(s.id)),
    outside:
      s.rule.mode === 'all'
        ? []
        : guests
            .filter((g) => isOutsideRule(s.rule, [g.role, ...(g.extra_roles ?? [])], groupIdsOf(g.guest_id)))
            .map((g) => g.guest_id),
  }));
}
