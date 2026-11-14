/**
 * ULTRA STORY PAGES — the pure half (no database, no `server-only`).
 *
 * ⚖ OWNER, 2026-11-14 (specs DECISION_LOG "SIMPLER SUPPLIER PLANS — APPROVED AS DRAWN, AND THE PLANS ARE NAMED PLUS ·
 * PRO · ULTRA", item 8; drawing artifact Eiwc64wF1VHLfZ52Sjbs8c § 5): on Ultra, a "Featured in these stories" card on
 * the shop's page opens the shop's OWN page for that event, on the shop's address — "Our story of this day →". Free,
 * Plus and Pro keep "Read their story", which goes to the couple's page.
 *
 * The page only exists for a celebration the host has PUBLISHED (the shop page's own showcase gate:
 * `loadVendorFeaturedStories` — consent, a public slug, past the 30-day wait). A private or unpublished event never
 * gets one. The server half is `lib/ultra-story-pages.server.ts`.
 */
import { isTierAtLeast } from '@/lib/vendor-tier-caps';

/** The Ultra card's link words (drawing § 5). */
export const OUR_STORY_LINK = 'Our story of this day';
/** Every other plan's link words — unchanged from the shipped card. */
export const READ_THEIR_STORY_LINK = 'Read their story';
/** The heading of the shop's own note on its story page. */
export const IN_OUR_WORDS = 'In our words';
/** The longest note a shop may write (held equal to the table's CHECK in the migration). */
export const STORY_NOTE_MAX = 600;

/** Does this plan give the shop a story page per booked event? Ultra (and anything above it) only. */
export function hasStoryPages(tier: string | null | undefined): boolean {
  return isTierAtLeast(tier, 'enterprise');
}

/** The shop's own page for one event — always on the shop's address. */
export function storyPageHref(shopSlug: string, eventSlug: string): string {
  return `/v/${encodeURIComponent(shopSlug)}/story/${encodeURIComponent(eventSlug)}`;
}

/**
 * Where a "Featured in these stories" card goes, and what it says. `tier` must be the shop's EFFECTIVE tier (a lapsed
 * Ultra reads as Free — `effectiveSeoTier`), or a shop whose plan ended would keep sending visitors to a page that
 * no longer opens.
 */
export function featuredStoryLink(input: {
  tier: string | null | undefined;
  shopSlug: string | null | undefined;
  eventSlug: string;
}): { href: string; label: string; own: boolean } {
  if (hasStoryPages(input.tier) && input.shopSlug) {
    return { href: storyPageHref(input.shopSlug, input.eventSlug), label: OUR_STORY_LINK, own: true };
  }
  return { href: `/${input.eventSlug}`, label: READ_THEIR_STORY_LINK, own: false };
}

/** A note as typed → as stored: trimmed, inner runs of blank lines collapsed, capped. Empty = "no note". */
export function cleanStoryNote(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, STORY_NOTE_MAX);
}
