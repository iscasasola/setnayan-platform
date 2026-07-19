## 2026-07-01 · feat(realstories): publish the Maria & Jose sample as a Real Story + style-twin demo

Owner ruling ("seed it"): light up `/realstories` with ≥1 DB-backed story and
make Style-Twin Discovery produce a tappable vendor chip — using the curated
**Maria & Jose** sample, WITHOUT inventing fake consent or back-dating the
future-dated (2026-12-12) sample. Both decisions resolved by the owner:

- **Decision A = HONEST-SAMPLE path.** The showcase loader now admits
  `events.is_sample` weddings past the RA 10173 consent + grace gates (G4/G5) —
  precisely because a sample represents no real person — while the card keeps
  its honest **"Sample"** badge, so nothing claims a real couple consented. Real
  editorials still require G4 (grace) + G5 (consent). No fake consent flag is
  set; the sample stays future-dated, so its planning/day-of demo is untouched.
- **Decision B = bump the 5 chosen DEMO vendors to `tier_state='pro'`** (Habi
  Photo Co. / Alon Films / Bulaklak & Co. / Hain Catering / Araw Planners — the
  same "team behind the day" the content seed already marks as chosen). The
  style-twin chip + editorial credit gate is Pro/Enterprise-only by design;
  these are `is_demo` rows only, so no real vendor billing or tier counts move.

Lights up BOTH surfaces (identical gate trio) with one seed: the `/realstories`
style-twin chips AND the `/[slug]` editorial "Team Behind the Day" credit.

Changes:

- `apps/web/lib/showcase-db.ts` — `loadPublishedShowcases` gains a second
  eligibility branch that pulls `is_sample` weddings (public slug, non-private)
  independent of the consent-user + grace-window gates, merges them after the
  consented set (real-first), de-dupes by `event_id`, and carries a new
  `isSample` field on `ShowcaseEntry`. The consent step no longer short-circuits
  the whole loader (so the sample surfaces even with zero consented couples).
  Graceful-degrade on the featuring columns is preserved on both branches. The
  admin curation loader (`loadShowcaseCandidatesForAdmin`) is intentionally NOT
  widened — admin featuring stays real-only.
- `apps/web/app/realstories/page.tsx` — carries the loader's `isSample` through
  to the card (was hardcoded `false`); the header copy shows the "published with
  their consent" framing only once a real (non-sample) story is present, so a
  sample-only page keeps the honest samples framing.
- `supabase/migrations/20270331300000_realstory_sample_maria_jose_seed.sql` —
  data-only (DML, no schema): forces the sample's `landing_page_visibility` to
  `public` (G3), backfills `event_vendors.linked_vendor_profile_id` from the
  already-written `marketplace_vendor_id` (V1), and bumps the 5 chosen demo
  vendors to `tier_state='pro'` (V2). Idempotent, keyed to the fixed demo batch.
- `scripts/seed-sample-event-maria-jose.sql` — root-cause patch so a re-run can
  never reintroduce the gaps: the event INSERT now sets `landing_page_visibility
  = 'public'` explicitly, and every `event_vendors` insert now writes
  `linked_vendor_profile_id` alongside `marketplace_vendor_id`.

SPEC IMPACT: None — seed-data + minimal loader wiring to surface the existing
sample event; no schema change, no SKU/pricing/threshold change, no flow change.
The Pro tier bump touches `is_demo` rows only (no real vendor billing). The
loader's RA 10173 consent honesty gate is preserved for real couples.
