## 2026-06-29 · feat(vendors): Spotlight Awards — persist + curate + surface the monthly badge winners (Wave 5)

Ships the Wave 5 "Soon" vendor benefit end-to-end. The badge engine
(`lib/vendor-badges.ts`) already computed `top_pick` (top 5% by review-weighted
score `avg_rating × ln(reviews+1)`) and `most_booking` (top 10% by completed
bookings) LIVE per page load but never persisted them. Spotlight Awards turns
those organic monthly winners into a curated, persisted record vendors and
couples can see.

- **Migration `20270321399479_vendor_spotlight_awards.sql`** — new
  `public.vendor_spotlight_awards(award_id UUID PK, public_id S89W-…,
  vendor_profile_id FK→vendor_profiles ON DELETE CASCADE, award_type CHECK
  in('top_pick','most_booked','rising'), period_month DATE (month-start bucket),
  awarded_at, awarded_by CHECK in('auto','admin'), is_homepage_featured BOOLEAN
  DEFAULT FALSE, …)` with `UNIQUE(vendor_profile_id, award_type, period_month)`.
  RLS enabled at CREATE: **public read** (`USING TRUE` — aggregate recognition
  row, no PII) + **admin `FOR ALL` `public.is_admin()`** for every write. Indexes
  on period, partial-on-featured, and per-vendor. `updated_at` touch trigger.
  Idempotent + additive; verified via a `BEGIN…ROLLBACK` dry-run against prod
  (public_id format, month-truncation, defaults all confirmed, then rolled back).

- **`lib/spotlight-awards.ts`** — the cron-free recompute. `runSpotlightRecompute()`
  loads the GLOBAL verified-vendor pool (`vendor_profiles` ⨝ `vendor_review_stats`
  matview), runs `computeVendorBadges()`, and UPSERTs the auto winners on the
  UNIQUE key (idempotent). Admin-curated (`awarded_by='admin'`) and featured rows
  are PRESERVED across re-runs. NO poller: triggered by an admin "Run now" action
  or a once-per-period `after()` piggyback on admin traffic
  (`maybeRecomputeSpotlightAwards`, wired in `app/admin/layout.tsx`). Plus read
  helpers (`fetchSpotlightAwards`, `fetchVendorCurrentAwards`).
  `lib/vendor-badges.ts` extended with the `SPOTLIGHT_AWARD_BADGES` bridge const
  (kept in lockstep with the awards mapping via a module-load assertion).

- **Admin console `app/admin/spotlight-awards/`** — current-period winners list,
  "Run now" recompute, per-row feature toggle + remove, and add-by-hand (for the
  manual `rising` award). New sidebar + nav-registry entry (Trophy icon).

- **Homepage strip `app/_components/marketing/SpotlightAwardsStrip.tsx`** —
  "Spotlight Awards" vendor strip mounted on `/` (`app/page.tsx`). ⚠ **ADMIN-GATED:
  reads `is_homepage_featured` rows ONLY and renders NOTHING when none are
  featured.** It is INERT on the live homepage until an admin explicitly features
  awards — nothing is auto-injected. **Flagged for owner sign-off before featuring
  goes live** (product-led homepage change).

- **Vendor-dashboard banner** `vendor-dashboard/_components/spotlight-award-banner.tsx`
  — "You earned a Spotlight Award this month" celebratory banner, shown only to
  awarded vendors, mounted on `vendor-dashboard/page.tsx`.

SPEC IMPACT: None — new persistence + curation + surfacing layer over the
existing organic badge engine; no SKU, pricing, or payment-flow change. New
read-only public table; recognition is never self-granted. (Decision-log note to
follow: Spotlight Awards persists the monthly `top_pick`/`most_booked` badges as
a curated, admin-gated benefit.)
