## 2026-07-05 · feat(marketing): rebuild /vendors — grow-free narrative + full tier matrix

Rebuilt the public `/vendors` page to the owner-approved prototype
(`vendors_page_v2_final.html`): a free-forward "Built to grow your business —
free" narrative → the full ~90-row tier matrix → a Custom "for those who need
more" callout → CTA.

- **New sections** (`apps/web/app/vendors/_components/vendor-grow-hero.tsx` +
  `vendor-grow-sections.tsx`): photographic hero (real repo asset
  `public/for-vendors/vendor-late-night.avif`, dark scrim), thesis strip
  (0% · ₱0 · pay-only-when-it-works), free business hub, Setnayan AI dark
  signature (3 nudge steps + phone mock + "your move" flywheel callout),
  fair-pay, free website that ranks (SEO/GEO), analytics + inquiries, trust
  earned-not-bought, no-fakes, reach that compounds, the tools, get-paid-your-way,
  closing CTA. All Clean Editorial `--m-*` tokens; radii route through `--m-r-*`
  (radius guard passes at 0 findings).
- **Tier matrix now 5 columns** (`vendor-tier-matrix.tsx`): added a **Custom**
  column (= Enterprise value on every feature row via the Enterprise-clone
  `TIER_CAPS.custom`, "Custom" on the composed numeric axes) plus a Custom-only
  group (additional branches · nationwide reach · dedicated account manager ·
  custom domain) and a Custom callout band. Still fully data-driven from
  `VENDOR_TIER_SECTIONS` + `TIER_CAPS` — no hand-hardcoded rows.
- **Prices stay catalog-driven**: every tier price flows from `getVendorPrices`
  (live `vendor_billing_catalog`); the narrative renders no number. Custom's
  "from ₱X" floor is parsed once from the shared `VENDOR_CUSTOM_TIER` constant
  (composed per plan, not a DB SKU) — never a fresh literal.
- **Data addition** (`app/_components/home/vendor-benefits.ts`): new Pro-tier
  benefit "Logo on the couple's 3D seat plan" (carries to Pro/Enterprise/Custom
  in the matrix + guide). Data-only; no pricing/entitlement/schema change.
- **Removed** the now-orphaned prior-narrative vendor components (vendor-hero,
  vendor-vision, stack-close-vendor, for-vendors-deep-dive, vendor-benefit-guide,
  editorial-band, vendor-door-scenario, page-tail, vendor-tier-ladder) — none
  imported anywhere else.

Front-end only — no checkout/entitlement/DB/migration touched. Responsive:
matrix scrolls horizontally inside its own container on mobile with a sticky
first column; page body never scrolls sideways.

SPEC IMPACT: None. Marketing-surface copy/layout rebuild + one data-catalog
benefit label; the vendor tier ladder, prices, caps, and entitlements are
unchanged (prices remain read from the live catalog). No corpus edit required.

## 2026-07-05 · chore(marketing): /vendors hero copy + image refresh

Refreshed the `/vendors` hero (`vendor-grow-hero.tsx`) — copy + image swap only.

- **Image** swapped from `vendor-late-night.avif` to a new warm candid asset
  `public/for-vendors/vendor-planning.webp` (a wedding-business owner planning
  her bookings at her desk); `objectPosition` `center 45%`, alt updated.
- **Headline** → "Everything your business needs. Set na 'yan."
- **Subheader** → "Profile, clients, calendar, bookings, and your own website.
  All set up free, kept free. Pay only for the extra reach you choose."
- **Removed the eyebrow kicker** (the "Setnayan for Vendors" m-mono label +
  gold line) per the project no-eyebrow-kickers rule; h1 top margin adjusted.
- **Primary CTA** copy → "List your business for free" (em dash removed);
  `href="/open-shop"` unchanged. Secondary CTA, scrim, and all `--m-*` tokens
  untouched.

SPEC IMPACT: None. Single marketing component — copy + image only; no
schema/price/entitlement change.
