/**
 * lib/story-suppliers-views.ts — the story's suppliers as the page hands them to its client components (owner
 * 2026-11-13). Server-side and pure: every link is decided HERE, once — the shop attributed to this story, the Book
 * that opens the shop's own Inquire pop-up, and no link at all for a supplier with no Setnayan shop. Kept apart from
 * lib/story-suppliers.ts so the client bundle never carries the category map's module.
 */
import { VENDOR_CATEGORY_LABEL } from './vendors';
import { storyTapHref } from './a-tap-from-the-story';
import { inquireResumeHref } from './shop-inquire';
import {
  orderStorySuppliers,
  storySupplierBadge,
  storySupplierGroupName,
  storySupplierTap,
  supplierInitials,
  type StorySupplierCardView,
  type StorySupplierLike,
  type StorySupplierView,
} from './story-suppliers';

/** The service words a list shows: the shared label for a known category, else the couple's own words. */
export function supplierServiceWords(category: string | null | undefined): string | null {
  const c = (category ?? '').trim();
  if (!c) return null;
  // The ONE category map (lib/one-word-per-category.test.ts) — "Band / DJ", never "Band dj". A category the couple
  // typed themselves ("Photo & film") is theirs and stays as written.
  return (VENDOR_CATEGORY_LABEL as Record<string, string>)[c] ?? c;
}

export function toStorySupplierViews(
  list: readonly (StorySupplierLike & { category: string | null; logoUrl: string | null; card?: StorySupplierCardView | null })[],
  eventSlug: string | null,
): StorySupplierView[] {
  return orderStorySuppliers(list).map((s, i) => {
    const tap = storySupplierTap(s);
    const shopHref = tap === 'none' ? null : storyTapHref(s.slug, eventSlug);
    return {
      key: `${i}-${s.name}`,
      name: s.name,
      service: supplierServiceWords(s.category),
      tier: s.tier,
      badge: storySupplierBadge(s.tier),
      planName: s.tier === null ? null : storySupplierGroupName(s.tier),
      initials: supplierInitials(s.name),
      logoUrl: s.logoUrl,
      tap,
      shopHref,
      bookHref: shopHref ? inquireResumeHref(shopHref, []) : null,
      card: tap === 'card' ? (s.card ?? null) : null,
    };
  });
}
