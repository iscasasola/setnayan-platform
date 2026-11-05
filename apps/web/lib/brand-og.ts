/**
 * The share picture every Setnayan page shows when it has none of its own — the 1200×630
 * `/brand/og-card.webp` brand card the root layout declares.
 *
 * 🔑 WHY A PAGE MUST NAME IT AGAIN. Next.js merges metadata SHALLOWLY: a page that declares its
 * own `openGraph` (or `twitter`) REPLACES the layout's whole object, `images` included. So
 * /features, /pricing, /explore and /for-suppliers — each with a title and description of its own —
 * shipped with no `og:image` at all, and a shared link previewed blank (live check 2026-10-23).
 * Spread these into the page's own `openGraph` / `twitter` and the card comes back.
 *
 * Held by `lib/every-share-card-has-a-picture.test.ts`.
 */
export const BRAND_OG_IMAGE_URL = '/brand/og-card.webp';

export const BRAND_OG_IMAGES = [
  {
    url: BRAND_OG_IMAGE_URL,
    width: 1200,
    height: 630,
    // ⚠ The alt describes the PIXELS, and og-card.webp still reads "Filipino wedding planning ·
    // verified vendors". It changes when the card is redrawn — not before, or it would lie.
    alt: "Setnayan · Set na 'yan. · Filipino wedding planning · verified suppliers · 0% commission",
    type: 'image/webp',
  },
];

export const BRAND_TWITTER_IMAGES = [BRAND_OG_IMAGE_URL];
