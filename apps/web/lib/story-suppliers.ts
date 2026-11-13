/**
 * lib/story-suppliers.ts — WHO MADE THE DAY, AS THE STORY LISTS THEM.
 *
 * Owner rulings, specs DECISION_LOG 2026-11-13 (drawn in `prototypes/approved_2026-11-13/story-suppliers-fable.html` v6):
 *   · every BOOKED supplier is tappable — Supplier Pro / Ultra raise a rich card first (cover · rating · best work ·
 *     Book), then their shop; Supplier Plus, Verified and Free open their shop directly. A supplier the couple added
 *     themselves (no Setnayan shop) is a plain name, never a link.
 *   · the list is ordered by the SUPPLIER's plan: Ultra → Pro → Plus → Verified → Free, then the couple's own; within
 *     one plan, the couple's own order.
 *   · many suppliers: the scene shows the top 8 + "See all N"; the full sheet groups by plan with counts (Free folded);
 *     a search field appears when there are more than 20; a moment's tags show at most 3, then "+N".
 *   · every Supplier Ultra on the event has its own scene (no cap).
 *
 * The plan NAMES come from `planWord` (the one place they are spelled) and the plan ORDER from `tierRank` — never a
 * second ladder here.
 *
 * PURE: no I/O, no React. 🔒 lib/story-suppliers.test.ts
 */
import { asVendorTier, tierRank, type VendorTier } from './vendor-tier-caps';
import { planWord } from './vendor-plan-change-words';
import { storyTapHref } from './a-tap-from-the-story';
import { inquireResumeHref } from './shop-inquire';

/** The scene shows this many, then "See all N". */
export const STORY_SUPPLIERS_TOP = 8;
/** The full sheet grows a search field above this many. */
export const STORY_SUPPLIERS_SEARCH_OVER = 20;
/** A moment's tags show at most this many, then "+N". */
export const STORY_SUPPLIER_TAGS_MAX = 3;

/** What one supplier needs to be placed in the list. `tier` null = added by the couple (no Setnayan shop). */
export type StorySupplierLike = {
  name: string;
  tier: VendorTier | null;
  slug: string | null;
};

/** What ordering and grouping need — the plan only (a view, a credit or a row all qualify). */
export type StorySupplierRanked = { name: string; tier: VendorTier | null };

/** A tap on a supplier: a full card first, the shop straight away, or nothing (a plain name). */
export type StorySupplierTap = 'card' | 'shop' | 'none';

export function storySupplierTap(s: StorySupplierLike): StorySupplierTap {
  if (s.tier === null || !s.slug) return 'none';
  return s.tier === 'pro' || s.tier === 'enterprise' ? 'card' : 'shop';
}

/** Booked on Setnayan = a linked shop. Self-added suppliers are named, never linked. */
export function isBookedOnSetnayan(s: StorySupplierLike): boolean {
  return s.tier !== null;
}

/** The short plan badge the list wears: Ultra · Pro · Plus · Verified · Free. Null for a self-added supplier. */
export function storySupplierBadge(tier: VendorTier | null): string | null {
  if (tier === null) return null;
  const word = planWord(tier);
  if (word === 'Free · Verified') return 'Verified';
  return word.replace(/^Supplier /, '');
}

/** The group heading in the full sheet: "Supplier Ultra" · "Supplier Pro" · "Supplier Plus" · "Verified" · "Free". */
export function storySupplierGroupName(tier: VendorTier): string {
  const word = planWord(tier);
  return word === 'Free · Verified' ? 'Verified' : word;
}

/**
 * The story's order: by the supplier's plan (Ultra first), self-added last; within one plan the couple's own order
 * (the order the list arrived in). Stable — never reorders two suppliers on one plan.
 */
export function orderStorySuppliers<T extends StorySupplierRanked>(list: readonly T[]): T[] {
  return list
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      const ra = a.s.tier === null ? -1 : tierRank(a.s.tier);
      const rb = b.s.tier === null ? -1 : tierRank(b.s.tier);
      return rb - ra || a.i - b.i;
    })
    .map(({ s }) => s);
}

/** The scene's lead: the top 8 by plan, and how many more the "See all N" opens. */
export function storySuppliersLead<T extends StorySupplierRanked>(list: readonly T[]): { shown: T[]; more: number; total: number } {
  const ordered = orderStorySuppliers(list);
  const shown = ordered.slice(0, STORY_SUPPLIERS_TOP);
  return { shown, more: ordered.length - shown.length, total: ordered.length };
}

export type StorySupplierGroup<T> = {
  /** A plan, or `couple` for the suppliers the hosts added themselves. */
  key: VendorTier | 'own';
  label: string;
  items: T[];
  /** Free is folded under "Show" when the sheet is grouped. */
  folded: boolean;
};

/**
 * The full sheet, grouped by plan with counts. Empty groups are left out. The couple's own come last as "Added by the
 * hosts". `folded` is set on Free only when there is more than one group to read first.
 */
export function groupStorySuppliers<T extends StorySupplierRanked>(list: readonly T[]): StorySupplierGroup<T>[] {
  const ordered = orderStorySuppliers(list);
  const tiers: VendorTier[] = ['enterprise', 'pro', 'solo', 'verified', 'free'];
  const groups: StorySupplierGroup<T>[] = [];
  for (const t of tiers) {
    const items = ordered.filter((s) => s.tier !== null && asVendorTier(s.tier) === t);
    if (items.length) groups.push({ key: t, label: storySupplierGroupName(t), items, folded: false });
  }
  const own = ordered.filter((s) => s.tier === null);
  if (own.length) groups.push({ key: 'own', label: 'Added by the hosts', items: own, folded: false });
  if (groups.length > 1) for (const g of groups) if (g.key === 'free') g.folded = true;
  return groups;
}

/** The sheet shows a search field only when it is long. */
export function storySuppliersSearchable(total: number): boolean {
  return total > STORY_SUPPLIERS_SEARCH_OVER;
}

/** Search by name or service, case- and accent-blind. An empty query keeps everything. */
export function searchStorySuppliers<T extends { name: string; category?: string | null }>(list: readonly T[], query: string): T[] {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const q = fold(query);
  if (!q) return [...list];
  return list.filter((s) => fold(s.name).includes(q) || fold((s.category ?? '').replace(/_/g, ' ')).includes(q));
}

/** A moment's tags: at most 3, by plan, then "+N". */
export function storySupplierTags<T extends StorySupplierRanked>(list: readonly T[]): { shown: T[]; more: number } {
  const ordered = orderStorySuppliers(list);
  return { shown: ordered.slice(0, STORY_SUPPLIER_TAGS_MAX), more: Math.max(0, ordered.length - STORY_SUPPLIER_TAGS_MAX) };
}

/** Every Supplier Ultra on the event, in the story's order — each one gets its own scene. */
export function ultraSuppliers<T extends StorySupplierRanked>(list: readonly T[]): T[] {
  return orderStorySuppliers(list).filter((s) => s.tier === 'enterprise');
}

/** The two letters a supplier's round mark carries when there is no logo ("Talulot Florals" → "TF"). */
export function supplierInitials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const letters = (words.length > 1 ? [words[0]!, words[1]!] : words.slice(0, 1)).map((w) => w[0]!.toUpperCase());
  return letters.join('') || '·';
}

/** The rich card's facts (every one READ — see lib/story-suppliers.server.ts). */
export type StorySupplierCardView = { coverUrl: string | null; bestWork: string[]; rating: number | null; reviews: number };

/**
 * One supplier as the client components draw it — plain, serialisable, every link already decided on the server so a
 * component cannot invent one.
 */
export type StorySupplierView = {
  key: string;
  name: string;
  /** The service, in words ("Photo & film" stays as the couple wrote it; `photo_film` reads "photo film"). */
  service: string | null;
  tier: VendorTier | null;
  badge: string | null;
  /** Supplier Ultra / Pro / Plus · Verified · Free — the card's line. */
  planName: string | null;
  initials: string;
  logoUrl: string | null;
  tap: StorySupplierTap;
  /** The shop, attributed to this story. Null for a self-added supplier. */
  shopHref: string | null;
  /** The shop's own Inquire pop-up (`?inquire=1`) — the card's Book. */
  bookHref: string | null;
  card: StorySupplierCardView | null;
};

/** The service words a list shows: the couple's category with underscores read as spaces. */
export function supplierServiceWords(category: string | null | undefined): string | null {
  const c = (category ?? '').replace(/_/g, ' ').trim();
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : null;
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
