/**
 * Who counts as a HOST of an event.
 *
 * 🔴 `event_members` IS NOT A HOST TABLE. It is the event's people table, and
 * `'guest'` is one of its `member_type` values — a person who scanned the event
 * QR or joined by link gets a row in it. `loadHostMembership` selected
 * `member_type` and then never compared it, returning `Boolean(memberRow)`, so
 * any row at all counted as a host. A guest could open a site the couple had
 * set to PRIVATE, and use `?phase=` to jump ahead to phases the couple had not
 * launched — their own save-the-date, before they sent it.
 *
 * The pair below is what the rest of the codebase already gates on: the
 * check-in desk (`20261118000000_guest_checkin_desk.sql`), the checklist RLS,
 * the couple-scope helpers. Naming it here rather than re-typing the literal at
 * each reader is the point — the bug was one reader quietly holding a different
 * definition of "host", and a second one is exactly how it comes back.
 *
 * Kept in its own module because `loaders.ts` is `server-only` and cannot be
 * imported by a unit test; this can.
 */
export const HOST_MEMBER_TYPES = ['couple', 'coordinator'] as const;

export type HostMemberType = (typeof HOST_MEMBER_TYPES)[number];

/** Is this `event_members.member_type` a host? Null-safe: an absent row is not. */
export function isHostMemberType(memberType: string | null | undefined): boolean {
  return HOST_MEMBER_TYPES.includes(memberType as HostMemberType);
}
