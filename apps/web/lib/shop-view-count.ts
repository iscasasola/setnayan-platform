/**
 * shop-view-count.ts — 👁 WHO COUNTS as "a couple who opened your page" (walker W1-B14 → B15, 16 Nov 2026).
 *
 * The walker's finding: Shop › Analytics' "N couples opened your page" counted the shop's OWN account, its team,
 * signed-out bots and curl, and the same phone opening the page again and again. Three rules fix it, each at the one
 * place it can be decided:
 *
 *   1 · BOTS are never recorded (`isBot`, the site-visit counter's own detector — `lib/visits/visit-capture.ts`). A
 *       curl keeps no cookie, so every one of its opens minted a fresh visitor and read as a new couple.
 *   2 · THE SHOP'S OWN PEOPLE are never recorded — the owner account or any `vendor_team_members` seat. (The portfolio
 *       photo counter has refused them since it shipped; the page count did not.)
 *   3 · ONE DEVICE IS ONE COUPLE in a window: the readers count DISTINCT `viewer_hash` (the column's own comment:
 *       "Used for unique-viewer counts only"), never rows. A signed-out visitor with no `sn_vw` cookie yet is keyed on
 *       its IP + user-agent (hashed, as the site-visit counter keys its visitors) instead of a random id that changed
 *       on every open. A legacy row with no hash cannot be told apart from another, so it still counts once each.
 *
 * Pure and dependency-light (no `next/*`), so the recorder, the readers and the guard ask the same functions.
 * 🔒 `lib/shop-view-count.test.ts`.
 */
import { isBot } from '@/lib/visits/visit-capture';
import { hashViewer } from '@/lib/viewer-hash';

// The readers live beside the funnel they feed (one import direction: this file → the funnel).

/** What the request said about who is looking — read by the caller (an action or a render, BEFORE `after()`). */
export type ShopViewContext = {
  /** The signed-in user, or null. */
  userId: string | null;
  /** The `sn_vw` cookie the browser already carries, or null. */
  anonCookie: string | null;
  userAgent: string | null;
  ip: string | null;
};

/** A bot, a crawler, a link previewer, curl — never a couple. */
export function shopViewIsBot(userAgent: string | null | undefined): boolean {
  return isBot(userAgent);
}

/**
 * The raw (never stored) visitor id — hashed by `shopViewerHash`. Signed in → the user; a browser with its cookie →
 * the cookie; otherwise the DEVICE (IP + user-agent), so the same phone opening the page twice is one visitor, not two.
 */
export function shopViewerRawId(ctx: ShopViewContext): string {
  if (ctx.userId) return `u:${ctx.userId}`;
  if (ctx.anonCookie) return `a:${ctx.anonCookie}`;
  return `d:${ctx.ip ?? ''}|${(ctx.userAgent ?? '').trim()}`;
}

export function shopViewerHash(ctx: ShopViewContext): string {
  return hashViewer(shopViewerRawId(ctx));
}

/** The service-role surface the recorder needs: two seat checks and one insert. */
export type ShopViewAdmin = {
  from: (table: string) => any;
};

/** Is this signed-in user the shop's owner or on its team? A refused read answers "yes" — an absence must not COUNT. */
export async function viewerIsShopPeople(admin: ShopViewAdmin, vendorProfileId: string, userId: string): Promise<boolean> {
  const [own, seat] = await Promise.all([
    admin.from('vendor_profiles').select('vendor_profile_id', { count: 'exact', head: true }).eq('vendor_profile_id', vendorProfileId).eq('user_id', userId),
    admin.from('vendor_team_members').select('vendor_team_member_id', { count: 'exact', head: true }).eq('vendor_profile_id', vendorProfileId).eq('user_id', userId),
  ]);
  if (own.error || seat.error || own.count == null || seat.count == null) return true;
  return own.count > 0 || seat.count > 0;
}

export type ShopViewRow = {
  vendorProfileId: string;
  source?: string | null;
  utm?: string | null;
  eventId?: string | null;
};

/**
 * Record ONE open of a shop page — or nothing, for a bot or the shop's own people. Best-effort: every failure is
 * swallowed (a dropped view never reaches the visitor). Returns whether a row was written (for the guard).
 */
export async function recordShopViewWith(admin: ShopViewAdmin, input: ShopViewRow, ctx: ShopViewContext): Promise<boolean> {
  try {
    if (!input.vendorProfileId) return false;
    if (shopViewIsBot(ctx.userAgent)) return false;
    if (ctx.userId && (await viewerIsShopPeople(admin, input.vendorProfileId, ctx.userId))) return false;
    const { error } = await admin.from('vendor_profile_views').insert({
      vendor_profile_id: input.vendorProfileId,
      event_id: input.eventId ?? null,
      source: input.source ?? null,
      utm: input.utm ?? null,
      viewer_hash: shopViewerHash(ctx),
    });
    return !error;
  } catch {
    return false;
  }
}

/** The client IP the platform stamped (the same order `lib/join-door-throttle.ts` trusts). */
export function readViewIp(h: { get: (name: string) => string | null }): string | null {
  for (const name of ['x-vercel-forwarded-for', 'x-real-ip', 'x-forwarded-for']) {
    const first = h.get(name)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return null;
}
