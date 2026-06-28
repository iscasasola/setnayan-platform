## 2026-06-28 · feat(seo): Twitter cards on 6 marketing pages, llms.txt vendor-tier + mobile freshness, vendor priceRange JSON-LD

SEO/GEO gap-closing pass — the foundation (5-sitemap index, AI-aware robots,
rich JSON-LD, `llms.txt`) was already shipped; this closes specific gaps and
fixes freshness drift surfaced by an audit.

**Web SEO — Twitter cards**

- Added `twitter: { card: 'summary_large_image', … }` to the 6 marketing pages
  that shipped OpenGraph but no Twitter card: `/features`, `/how-it-works`,
  `/help`, `/realstories`, `/blog`, `/privacy`. Mirrors the existing `/about`
  convention; reuses each page's OG image where one is set (og-card / blog hero).
  X/Twitter, iMessage, and several chat unfurlers read the `twitter:` tags first,
  so they previously fell back to the generic site card.
- Hreflang/canonical: no change needed — the EN/TL pairs (`/about`,
  `/features`, `/how-it-works`) already carry reciprocal `en-PH`/`tl-PH`/
  `x-default` alternates, and EN-only pages correctly omit hreflang.

**GEO — llms.txt freshness (verified against live DB + /for-vendors)**

- Added the **Solo** vendor tier (₱2,000 / 28-day prepaid block · 1 category ·
  solo operator · no agent seats · real business name shown from day 1 ·
  token-to-unlock model · no annual option) to the vendor-tier table and the
  "How much does Setnayan cost?" answer. It had been omitted entirely, so AI
  answer engines were telling vendors the cheapest paid tier was ₱6,000 (Pro)
  when it is ₱2,000 (Solo). Verified against `vendor_billing_catalog`
  (`solo_vendor_monthly` ₱2,000) and `lib/vendor-tier-caps.ts`
  (`solo.nameMode = 'true'`, `parentCategories: 1`, `agentAccounts: 0`).
- Corrected the "Does Setnayan have a mobile app?" answer — it claimed "native
  iOS and Android shells via Expo are on the V1.5 roadmap." The shipped native
  shell is Capacitor (not Expo), and the apps are in preparation for the App
  Store + Google Play ahead of the Dec 2026 launch, not a V1.5 item. New copy
  states what is true today (web-first PWA + macOS/Windows desktop app live now)
  without over-claiming a store release that hasn't happened.
- Refreshed the footer's last-updated changelog line to 2026-06-28.

**GEO — vendor structured data**

- Added `priceRange` to the `/v/[slug]` LocalBusiness/ProfessionalService
  JSON-LD, computed from the vendor's own published package prices
  (`₱min–₱max`, collapsing to a single figure for one-package vendors). Lets AI
  answer engines + Google place a vendor in a budget band without parsing every
  `makesOffer`. Derived from real data only — never invented.
- Deliberately did NOT add `aggregateRating` to Products or force it onto vendor
  schema: real review data is effectively absent (founder-only marketplace), and
  the vendor schema already emits `aggregateRating` *conditionally* (only when
  `reviewStats.total_count > 0`). Inventing ratings would be structured-data spam.
- `Organization.sameAs` left empty — no social-profile URLs exist yet to cite;
  owner-side action (create FB Page / LinkedIn) unblocks a one-line follow-up.

SPEC IMPACT: None. (Mirrors live DB + shipped code; no spec/decision change. The
`llms.txt` Solo-tier and mobile-app corrections bring the AI-facing site map in
line with the already-shipped Solo tier and Capacitor native shell.)
