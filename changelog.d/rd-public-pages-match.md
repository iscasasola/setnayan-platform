## 2026-10-23 · fix(public): the public pages match — share pictures, search words that fit, Logo & QR, one button shape, house words, no wasted device call

From the 2026-10-23 live check of the signed-out pages (`shots-2026-10-23/live-verify/LIVE-STATUS.md`).

1. **Share pictures.** /features, /tl/features, /pricing, /explore and /for-suppliers had no `og:image` — Next.js
   merges metadata shallowly, so a page that writes its own `openGraph` / `twitter` drops the layout's brand card.
   They (and 11 more public pages with the same gap: /about, /tl/about, /realstories, /suppliers, /explore/compare,
   /waitlist, /download, /tour ×3, /help articles) now name `BRAND_OG_IMAGES` from the new `lib/brand-og.ts`.
   Guard: `lib/every-share-card-has-a-picture.test.ts` (every `openGraph`/`twitter` object under `app/` names
   `images`; four known pages listed with why — the three legal pages owned by other PRs, and the event booth page).
2. **Front-door search words fit a phone.** "Search suppliers, stories and guides" was cut at 375 (the touch input
   is 16 px; it needed ~262 px of 255). It is now "Suppliers, stories, guides" (~182 px; fits 320's 200), still
   derived from `PUBLIC_SEARCH_NOUNS`. Guard: `lib/the-search-placeholder-fits-a-phone.test.ts`.
3. **The retired Animated Monogram is not sold.** /palogo now says the animation is Event Hub Pro's Logo & QR part;
   llms.txt names /palogo "Logo Maker"; the home page and site-wide structured data say Logo Maker / Event Hub Pro.
   No price typed — llms.txt prices stay `R('COUPLE_HUB_PART_LOGO_QR')` from the catalogue; /palogo keeps its
   no-price rule. Guards: `lib/llms-txt.test.ts` (reversed: Animated Monogram must be absent) and the house-words
   guard (new banned phrase).
4. **/open-shop's Continue and "Open my shop" are pills** like /signup's Create (Back is round). Guard:
   `app/open-shop/both-sign-up-doors-wear-one-button.test.ts` (resolves both radii from the CSS that paints them).
5. **House words.** `app/public-copy-says-the-house-words.test.ts` now bans "celebration" and "Animated Monogram"
   too, and reads the sign-up doors, /help, /download, /tour, the front page, the doorway components,
   `lib/studio-apps.ts` and `lib/feature-pages`. Fixed: /tour's 24 "vendor"s, /open-shop's "Your website" (→ "Your
   Setnayan page"), two "website/site" lines in the Studio descriptions, two blog "celebration"s (the liturgical
   one is allowed, with the reason). /refunds, /privacy, /cookies, /terms untouched.
6. **No device-id call for a signed-out visit.** `DeviceCapture` asked the server on every visit; the server records
   nothing without an account (DPO review 2026-07-12, safeguard 4). The client now checks for a Supabase session
   cookie first (`lib/device-capture-gate.ts`), re-checks on each navigation so a sign-in without a reload is still
   caught, and sets the once-per-session mark only when the call is made. Server gates unchanged. Guard:
   `app/_components/device-capture-waits-for-sign-in.test.ts`.

SPEC IMPACT: None — copy, metadata and a client-side skip; no ruling changed (the Animated Monogram retirement is
#6781's, the house words are the 2026-09-24 / 2026-10-04 rulings, the device capture follows the 2026-07-12 DPO
review as written).
