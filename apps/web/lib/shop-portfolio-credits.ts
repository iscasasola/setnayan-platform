/**
 * THE PORTFOLIO PRICE — the free room in credits, then the shop wallet (owner 2026-10-23, option A). PURE: no
 * database, no `server-only`, so the uploader (a client component), the save door and the guards share one rule.
 *
 * ── THE RULE, IN THE OWNER'S WORDS (23 Oct) ──────────────────────────────────────────────────────────────────
 *   • every shop gets 50 portfolio credits free; after that 1 credit a photo, 8 a 10-second clip, from the SHOP
 *     wallet (the portfolio is the shop's — no event is involved);
 *   • the free 50 COUNT CREDITS ("yes they count credits") — a clip would use 8 of them;
 *   • paid once, kept while the shop exists: taking a photo off returns no credit, but frees a free slot if it was
 *     one of the free ones.
 *   A shop holding a personal invite's allowance (`portfolioPhotoCap`, 100) has that much free room instead.
 *
 * ── ONE FORMULA, TWO HOMES ───────────────────────────────────────────────────────────────────────────────────
 *   kept   = credits of the photos already on the page that stay on it
 *   after  = credits of the whole new list
 *   charge = max(0, after − max(free, kept))
 * The SAVE is charged by `public.shop_portfolio_commit` (migration `the_portfolio_saves_and_spends_in_one_step`),
 * which writes the list and the wallet row in ONE transaction under the wallet's per-shop lock. This file only
 * QUOTES the same number before the tap ("Save 3 · 3 credits · wallet 128 → 125"); the server's answer is the
 * truth. `shop-portfolio-credits.test.ts` holds the SQL and this file to the same base, weights and clip rule.
 *
 * ⚠ Clips are priced (8) but NOT accepted yet — `portfolio_r2_keys` is image-only across its readers (the page
 * gallery, venue photos, moodboard suggestions, the QR guard, the repost watch). Owner question, recorded in the
 * changelog: clips later. The uploader takes images only, so every ref here is 1 today.
 */
import { PAPIC_POINTS_PER_PHOTO, PAPIC_POINTS_PER_SNIPPET } from './papic-cameras-pure';
import { PORTFOLIO_FREE_BASE } from './vendor-tier-caps';

/** The free room every shop has, in credits — the every-plan base (owner 2026-10-23). The SQL holds the same 50. */
export const PORTFOLIO_FREE_CREDITS = PORTFOLIO_FREE_BASE;

/** A ref is a clip when it names a video file — the SQL's `shop_portfolio_ref_credits`, said once in TS. */
export const PORTFOLIO_CLIP_REF = /\.(mp4|mov|m4v|webm)$/i;

/** What one ref costs in credits: a photo 1, a 10-second clip 8 (the Papic camera's own weights). */
export function portfolioRefCredits(ref: string): number {
  return PORTFOLIO_CLIP_REF.test(ref) ? PAPIC_POINTS_PER_SNIPPET : PAPIC_POINTS_PER_PHOTO;
}

export type PortfolioQuote = {
  /** Credits the save will take from the wallet (0 = free). */
  charge: number;
  /** Credits of the whole new list. */
  after: number;
  /** Free credits the new list uses (≤ free). */
  freeUsed: number;
  /** Free credits still open after this list (0 once full). */
  freeLeft: number;
  /** Refs in the new list that are not on the page yet. */
  added: number;
};

/** The quote for saving `next` over `stored` with `free` credits of free room. Pure; mirrors the SQL exactly. */
export function portfolioQuote(stored: readonly string[], next: readonly string[], free: number): PortfolioQuote {
  const had = new Set(stored.filter(Boolean));
  const seen = new Set<string>();
  let kept = 0;
  let after = 0;
  let added = 0;
  for (const ref of next) {
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    const w = portfolioRefCredits(ref);
    after += w;
    if (had.has(ref)) kept += w;
    else added += 1;
  }
  const room = Math.max(0, Math.floor(free));
  const charge = Math.max(0, after - Math.max(room, kept));
  const freeUsed = Math.min(room, after);
  return { charge, after, freeUsed, freeLeft: Math.max(0, room - after), added };
}

/**
 * How many files the uploader may hold: everything on the page, the free room still open, and what the wallet can
 * pay for. An unread wallet pays for nothing (withholding, never granting) — the free room only.
 */
export function portfolioMaxFiles(storedCount: number, free: number, balance: number | null): number {
  const base = Math.max(Math.max(0, Math.floor(free)), storedCount);
  return base + (balance != null && balance > 0 ? Math.floor(balance) : 0);
}

const n = (x: number) => x.toLocaleString('en-PH');
const credits = (x: number) => `${n(x)} ${x === 1 ? 'credit' : 'credits'}`;

/** The counter's two halves (frames port-48 · port-50): "48 of 50 free" · "2 free left" / "Next photo · 1 credit". */
export function portfolioCounter(q: PortfolioQuote, free: number): { left: string; right: string; full: boolean } {
  const full = q.freeLeft === 0;
  return {
    left: full ? `${n(free)} of ${n(free)} free used` : `${n(q.freeUsed)} of ${n(free)} free`,
    right: full ? `Next photo · ${credits(PAPIC_POINTS_PER_PHOTO)}` : `${n(q.freeLeft)} free left`,
    full,
  };
}

/**
 * The Save button carries the charge before the tap (frame port-spend): "Save 3 · 3 credits · wallet 128 → 125".
 * Free saves stay "Save" / "Save 3". A charge the wallet cannot cover, or an unread wallet, is a disabled button
 * WITH its reason on it — never a tap that fails afterwards.
 */
export function portfolioSaveLabel(
  q: PortfolioQuote,
  balance: number | null,
): { label: string; blocked: false } | { label: string; blocked: true; reason: 'unread' | 'short' } {
  const head = q.added > 0 ? `Save ${n(q.added)}` : 'Save';
  if (q.charge === 0) return { label: head, blocked: false };
  if (balance == null) return { label: 'Wallet unreadable — only free photos save', blocked: true, reason: 'unread' };
  if (balance < q.charge) {
    return { label: `Needs ${credits(q.charge)} · wallet ${n(balance)}`, blocked: true, reason: 'short' };
  }
  return { label: `${head} · ${credits(q.charge)} · wallet ${n(balance)} → ${n(balance - q.charge)}`, blocked: false };
}

/** The toast after a paid save (frame port-saved): "Portfolio saved. 3 added · 3 credits · shop wallet 128 → 125." */
export function portfolioSavedText(added: number, charged: number, balanceAfter: number | null): string {
  if (charged <= 0 || balanceAfter == null) return 'Portfolio saved.';
  return `Portfolio saved. ${n(added)} added · ${credits(charged)} · shop wallet ${n(balanceAfter + charged)} → ${n(balanceAfter)}.`;
}

/** The refusal when the wallet came up short at the moment of saving (frame F3). Nothing was written. */
export function portfolioShortText(charge: number, balance: number): string {
  return `That didn’t go in. This save needs ${credits(charge)} and your shop wallet has ${n(balance)}. Nothing was charged.`;
}
