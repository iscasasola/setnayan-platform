/**
 * WHO WROTE IT — the one byline rule for articles and replies (owner 2026-11-17): a shop-linked account always
 * shows its shop, with the Supplier mark ("user account related to the supplier will always show their shop
 * name"); a Journal post reads "Setnayan Journal"; anyone else their chosen posting name. Never the account.
 * Pure, so the feed, the article page and the tests agree by construction.
 */
import { JOURNAL_BYLINE } from '@/lib/journal-move';

export type Byline =
  | { kind: 'journal'; name: string }
  | { kind: 'shop'; name: string }
  | { kind: 'person'; name: string };

/** The words a reader sees for an author who has not chosen a posting name yet. */
export const UNNAMED_MEMBER = 'Setnayan member';

/** One byline from the three facts that decide it. Pure, so the feed, the page and the tests agree. */
export function bylineFor(
  row: { is_journal: boolean; posted_as_vendor_id: string | null; user_id: string },
  names: { shops: Map<string, string>; people: Map<string, string | null> },
): Byline {
  if (row.posted_as_vendor_id) {
    const shop = names.shops.get(row.posted_as_vendor_id);
    if (shop) return { kind: 'shop', name: shop };
  }
  if (row.is_journal) return { kind: 'journal', name: JOURNAL_BYLINE };
  return { kind: 'person', name: names.people.get(row.user_id) || UNNAMED_MEMBER };
}

