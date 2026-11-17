/**
 * shop-address.ts — A SHOP LIVES AT `setnayan.com/{shopname}` (the address move, owner 2026-11-15; specs DECISION_LOG
 * d7910b5d, map `ADDRESS_MOVE_MAP_2026-11-15_fable.md`).
 *
 * The shop page already rendered at the bare `/{shop}` (`app/[slug]/page.tsx` falls through to `renderVendorBySlug`)
 * and already named it in its canonical tag — but 47 files still built `/v/{shop}` links. They all go through
 * `shopPath` now, and the old `/v/…` addresses answer with a redirect (`legacyShopRedirect`).
 *
 * The route FILES stay at `app/v/[slug]/…`: they are the internal render target the middleware rewrites the bare
 * addresses onto (`shopSubPageRewrite`, the cached copy), so no file moves and no open PR collides with this one.
 *
 * Pure — no Next, no database — so the middleware, the pages and the guards share one answer.
 */

/** The shop's sub-pages that a bare address reaches (`/{shop}/dates`). None of these is an event sub-page. */
export const SHOP_SUB_PAGES = ['dates', 'booth', 'review', 'guest-review', 'story'] as const;
export type ShopSubPage = (typeof SHOP_SUB_PAGES)[number];

/** A shop word as it can appear in a path (the slug rule the routes already use). */
const WORD = '[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?';

/** `/{shop}` (+ `rest`, which starts with `/`, `?` or `#`). The word is used as given — callers that encode, encode. */
export function shopPath(slug: string, rest = ''): string {
  return `/${slug}${rest}`;
}

/** The shop's invite door (was `/vendor-invite/{shop}`). The word decides: a shop's word is the shop invite. */
export function shopInvitePath(slug: string): string {
  return `/${slug}/invite`;
}

/**
 * `/v/{shop}` and its known sub-pages → the bare address (the caller keeps the query and the method rule).
 * Anything else under `/v/` is left alone (null): the internal cached copy (`/v/{shop}/cached`) and any sub-page a
 * later change adds before it is given its bare form here.
 */
export function legacyShopRedirect(pathname: string): string | null {
  // W1-B19: `/v/{shop}/story/{event}` (an Ultra story page) carries one more segment than the other sub-pages —
  // it forwards too, to `/{shop}/story/{event}`. Only `story` takes that segment; `/v/{shop}/dates/x` stays null.
  const m = new RegExp(`^/v/(${WORD})(?:/(${SHOP_SUB_PAGES.join('|')})(?:/(${WORD}))?)?/?$`, 'i').exec(pathname);
  if (!m) return null;
  if (m[3] && m[2]!.toLowerCase() !== 'story') return null;
  return shopPath(m[1]!, m[2] ? `/${m[2]}${m[3] ? `/${m[3]}` : ''}` : '');
}

/** `/vendor-invite/{shop}` → `/{shop}/invite` (308 — shop QR codes are printed; the caller keeps the query). */
export function legacyShopInviteRedirect(pathname: string): string | null {
  const m = new RegExp(`^/vendor-invite/(${WORD})/?$`, 'i').exec(pathname);
  return m ? shopInvitePath(m[1]!) : null;
}

/**
 * `/{shop}/dates` (and the other shop sub-pages) → the route file at `/v/{shop}/dates`, as an internal rewrite.
 * Safe without asking the database: no event has a sub-page by these names (`app/[slug]/` has none), and a word
 * that is not a shop simply 404s there, as `/v/{word}/dates` always did.
 */
export function shopSubPageRewrite(pathname: string, reserved: (word: string) => boolean): string | null {
  const m = new RegExp(`^/(${WORD})/(${SHOP_SUB_PAGES.join('|')})(/.*)?$`, 'i').exec(pathname);
  if (!m || reserved(m[1]!.toLowerCase())) return null;
  return `/v/${m[1]}/${m[2]}${m[3] ?? ''}`;
}
