/**
 * vendor-card-layout.ts — THE SHOP SHARE CARD v2, AS RULES AND NUMBERS (pure: no I/O, no sharp, no satori).
 *
 * Owner, 21 Nov 2026: *"approve the share card too"* (re-confirmed 22 Nov, *"shop card approved"*); DECISION_LOG
 * 2026-11-21 "SHOP SHARE CARD v2 — APPROVED TO BUILD". Drawing (frozen): corpus
 * `prototypes/shop_share_card_2026-11-21/shop_share_card_v2_fable.html`. Earlier owner ruling on it: *"No. 1 off,
 * seals on"*.
 *
 * Every decision the card makes about WHAT it shows lives here, so `lib/social/vendor-card-layout.test.ts` runs each
 * one: the top line and seal by status, the proof line (each part only when it is really there — never "0 reviews"),
 * the badge row (seals first, at most four, then "+N"; Verified and Verified Partner never in the row — they sit on the
 * logo), and the pixel spots the sharp composites land on. `lib/social/vendor-card.tsx` only draws what this says.
 */
import { countNoun } from '@/lib/format-number';
import { formatStarRating } from '@/lib/reviews';
import type { PrintBadge } from '@/lib/print-badges-v84';

// ── The card, in its own units (the drawing's 1u = 1/1200 of the width) ──────────────────────────────────────────
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** The logo tile: 104 px white tile at x 548, y 44, corners 24 (drawing `.pc .logo`). The logo itself fills 76 %. */
export const LOGO_TILE = { left: 548, top: 44, size: 104, radius: 24, inner: 79 } as const;
/** The seal on the logo's corner (drawing `.pc .sl`): 48 px at x 624, y 118. */
export const SEAL_ON_LOGO = { left: 624, top: 118, size: 48 } as const;
/** No logo: the seal moves to the middle, larger (drawing `.pc .sl.solo`): 76 px at x 562, y 64. */
export const SEAL_SOLO = { left: 562, top: 64, size: 76 } as const;
/** The Setnayan mark, small, once (drawing `.pc .mk`): 32 px, bottom centre, 28 px up. */
export const MARK = { left: 584, top: OG_HEIGHT - 28 - 32, size: 32 } as const;
/** The words' column (drawing `.pc .txt`): 325 px in from each side, its last line 92 px off the bottom. */
export const TEXT_COLUMN = { left: 325, right: 325, bottom: 92 } as const;
/** The badge row (drawing build notes): the last thing above the mark, fixed at y 486 → 538; 52 px medals, 12 px gap. */
export const BADGE_ROW = { top: OG_HEIGHT - 92 - 52, medal: 52, gap: 12, max: 4 } as const;

// ── Who the card says the shop is ──────────────────────────────────────────────────────────────────────────────

/** not verified · Setnayan Verified · Setnayan Verified Partner (the Partner seal replaces Verified, for life). */
export type VendorCardStatus = 'shop' | 'verified' | 'partner';

/**
 * The status, from the shop page's own seal rule (`displayedSeals`, via the print badge list): a shop shows Verified OR
 * Verified Partner, never both. A demo shop never wears a seal (drawing, "Demo shop": *"No seal."*).
 */
export function vendorCardStatus(i: { isDemo: boolean; badges: readonly PrintBadge[] }): VendorCardStatus {
  if (i.isDemo) return 'shop';
  if (i.badges.some((b) => b.kind === 'seal' && b.key === 'verified_partner')) return 'partner';
  if (i.badges.some((b) => b.kind === 'verified')) return 'verified';
  return 'shop';
}

const TOP_LINE: Record<VendorCardStatus, string> = {
  shop: 'A Setnayan shop',
  verified: 'Setnayan Verified',
  partner: 'Setnayan Verified Partner',
};

/** The top line, as the drawing prints it (upper case, the demo label after a dot, as today). */
export function vendorCardTopLine(status: VendorCardStatus, demoLabel?: string | null): string {
  const line = demoLabel ? `${TOP_LINE[status]} · ${demoLabel}` : TOP_LINE[status];
  return line.toUpperCase();
}

// ── The proof line: ★ rating · reviews · events — each part only when it is really there ─────────────────────────

export type VendorCardProofInput = {
  /**
   * The shop page's own star gate, already answered: Verified (papers current), not a demo, the plan counts stars
   * (`tierCaps(...).reviewStarsCounted`). The count and average are then checked here, as the page does.
   */
  starsShown: boolean;
  /** `vendor_trusted_review_stats` as read; null = not read → no stars, no count. */
  trusted: { trusted_avg_rating: number | null; trusted_review_count: number | null } | null;
  /** `vendor_public_completed_events_stats.public_completed_count`; null = not read → left out, never 0. */
  completedEvents: number | null;
};

export type VendorCardProof = { rating: string | null; reviews: string | null; events: string | null };

export function vendorCardProof(i: VendorCardProofInput): VendorCardProof {
  const count = Number(i.trusted?.trusted_review_count ?? 0);
  const avg = Number(i.trusted?.trusted_avg_rating ?? 0);
  const stars = i.starsShown && i.trusted !== null && count > 0 && avg > 0;
  const events = i.completedEvents !== null && Number(i.completedEvents) > 0 ? Number(i.completedEvents) : null;
  return {
    rating: stars ? formatStarRating(avg) : null,
    reviews: stars ? countNoun(count, 'review', 'reviews') : null,
    events: events !== null ? countNoun(events, 'event', 'events') : null,
  };
}

/** The words after the star: "4.8 · 38 reviews · 120 events", or what is left of it. Null = no proof line at all. */
export function vendorCardProofWords(p: VendorCardProof): string | null {
  const parts = [p.rating, p.reviews, p.events].filter((s): s is string => Boolean(s));
  return parts.length > 0 ? parts.join(' · ') : null;
}

// ── The badge row ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The row: the print list (`printBadgesV84` — seals first, then the earned tiers; No. 1 already off), less Verified and
 * Verified Partner (they sit on the logo), at most four, then "+N" for the rest.
 */
export function vendorCardBadgeRow(badges: readonly PrintBadge[]): { shown: PrintBadge[]; more: number } {
  const row = badges.filter((b) => b.kind !== 'verified' && !(b.kind === 'seal' && b.key === 'verified_partner'));
  return { shown: row.slice(0, BADGE_ROW.max), more: Math.max(0, row.length - BADGE_ROW.max) };
}

/** "+N" is a pill of a fixed width (so satori and the composites agree on the row's width): 24 px type, 14 px sides. */
export function morePillWidth(more: number): number {
  return more > 0 ? 28 + 15 * `+${more}`.length : 0;
}

/** The x of each medal in a centred row of `medals` medals (+ the "+N" pill when `more` > 0). */
export function badgeRowLefts(medals: number, more: number): number[] {
  if (medals <= 0) return [];
  const pill = morePillWidth(more);
  const width = medals * BADGE_ROW.medal + (medals - 1) * BADGE_ROW.gap + (pill > 0 ? BADGE_ROW.gap + pill : 0);
  const left = Math.round(OG_WIDTH / 2 - width / 2);
  return Array.from({ length: medals }, (_, i) => left + i * (BADGE_ROW.medal + BADGE_ROW.gap));
}

// ── The name ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The name's size: the drawing's 66 px, which holds about two lines of the 550 px column. A longer name steps down so
 * it never climbs into the logo — and past that it is cut on a word with "…".
 */
export function nameSize(name: string): { fontSize: number; text: string } {
  const t = name.trim();
  if (t.length <= 30) return { fontSize: 66, text: t };
  if (t.length <= 44) return { fontSize: 54, text: t };
  return { fontSize: 46, text: clampWords(t, 56) };
}

/** Truncate to `max` chars on a word boundary, then ellipsize. */
export function clampWords(text: string, max: number): string {
  const t = (text ?? '').trim();
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

// ── The address ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A chat app keeps a picture by its ADDRESS, so the day the card changes what it draws, the address must move or every
 * new share shows the old card. `VENDOR_CARD_EDITION` moves every shop's address once (2026-11-22: the v2 card); the
 * logo ref moves one shop's when it swaps its logo. The route's own address (`/api/og/v/[slug]`) does not move.
 * ⚠ A post somebody ALREADY shared holds the old address; nothing on our side reaches it.
 * A short FNV-1a hash — a cache key, not a secret (the same shape as `lib/social/share-card-look.ts`).
 */
export const VENDOR_CARD_EDITION = 'shop-v2';

export function vendorCardLookToken(look: { logoRef: string | null | undefined }): string {
  const input = `${VENDOR_CARD_EDITION}|${look.logoRef ?? ''}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
