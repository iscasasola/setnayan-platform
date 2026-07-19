## 2026-07-17 · feat(inquiry): wire shortlist + favorites inquiry-source stamping (completes the 9-source taxonomy)

Wires the last two unwired `inquiry_source` values (`shortlist`, `favorites`)
so every inquiry-creating surface now stamps its origin. No migration — the enum
CHECK values already exist (PR-C). Both paths REUSE the canonical
`startServiceInquiry` (no parallel inquiry path); it validates + stamps the
source through the DB-locked provenance path, and its
`UNIQUE(event_id, vendor_profile_id)` dedupe means a re-contact opens the
existing thread instead of erroring or duplicating.

- **`startServiceInquiry`** (`app/v/[slug]/inquiry-actions.ts`) gains an optional
  `eventId`, VALIDATED against the caller's own couple events (a non-owned id →
  `no_event`, never a cross-event write). Omitted → the primary-event default,
  unchanged for the public-profile composer.
- **Shortlist** (event-scoped): the couple's shortlist/build workspace vendor
  card (`plan-budget-accordion.tsx`) shows a "Contact vendor" button on a
  marketplace-connected pick with no thread yet. New thin resolver
  `contactShortlistVendor` (`_actions/contact-shortlist-vendor.ts`) turns the
  `event_vendors` shortlist row into (vendorProfileId, CURRENT eventId, active
  service) and delegates with `inquiry_source='shortlist'`.
- **Favorites** (account-scoped): the Library saved-vendor card
  (`saved-vendor-card.tsx`) gains a "Contact" link to `/v/[slug]?src=favorites`;
  `v/[slug]/page.tsx` now whitelists `src=favorites` → `inquiry_source='favorites'`
  on the composer. This deliberately reuses the profile composer's existing event
  resolution (single/primary event; onboarding redirect when none) rather than
  building a bespoke account-level event+service picker.
- `lib/inquiry-source.ts` doc updated: `shortlist`/`favorites` moved from UNWIRED
  to wired (PR-D); only `degree` remains gated.

SPEC IMPACT: Corpus — the inquiry-source taxonomy in the Creator Program build
plan lists `shortlist`/`favorites` as enum-only, no-trigger-surface. Logged in
`DECISION_LOG.md` that both are now wired (owner-approved 2026-07-17). No SKU,
schema, or pricing change.
