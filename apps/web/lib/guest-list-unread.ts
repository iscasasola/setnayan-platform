/**
 * guest-list-unread.ts — what the guest list SAYS when its groups or its tables could not be read.
 *
 * The list itself has had its own words since 2026-08-20 ("We couldn't load your guest list. Nothing has been
 * lost…", `guests/page.tsx` `EmptyState`). The reads beside it did not: a refused groups read drew every guest with
 * no group, a refused seat read drew nobody at a table — silently, byte-identical to a couple who had made no groups
 * and seated no one. This is that same sentence, for those reads: what could not be loaded, and that nothing is lost.
 *
 * ONE line, in the list's own counts strip, with the list's own "Try again". No new design.
 * Pure — the page decides the two booleans from its measured reads, the screen draws the sentence.
 * 🛡 lib/guest-list-side-reads-are-honest.test.ts.
 */
export type GuestListSideReads = {
  /** The custom groups AND who is in them were both read. */
  groups: boolean;
  /** The tables, who sits where, AND the floor plan were all read. */
  seats: boolean;
};

export function guestListUnreadLine(read: GuestListSideReads): string | null {
  const what = !read.groups && !read.seats ? 'groups and tables' : !read.groups ? 'groups' : !read.seats ? 'tables' : null;
  return what ? `We couldn’t load your ${what} this time. Nothing has been lost.` : null;
}
