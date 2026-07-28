## 2026-07-28 · feat(card-record): a service card compiles its own history — flag-dark

Owner-locked 2026-07-28 (`DECISION_LOG.md` row 2819, "build it now, let's keep everything simple"): the service card grows a **Card Record** — a "Booked N× on Setnayan" bar, the event-type mix, an anonymized ledger of recent events served, and milestone medals at 10 / 25 / 50 / 100. Ships **dark** behind `NEXT_PUBLIC_CARD_RECORD_ENABLED`; OFF is byte-identical to today and neither mounting page calls the reader at all.

**What already shipped, and why it could not answer this.** `public.vendor_completed_events` is the right shape but the wrong grain — per *vendor profile*, no `service_id`, and hard-restricted to `delivered`/`complete`. `vendor_booking_monthly_series` / `vendor_source_attribution` already segment by `service_id` and already encode the "booked" status set, but both are ownership-gated to `current_vendor_profile_ids()` and the card is **public**. Hence one new reader rather than a relaxation of a surface that is correctly shut.

**One reader, two internal helpers, zero new tables.**

- `supabase/migrations/20271018283550_service_card_record_reader.sql`
  - `public.service_card_records(p_service_ids uuid[])` — SECURITY DEFINER, **batched** (one call per gallery page; array capped at 50 so a caller cannot amplify it into an unbounded scan), granted to `authenticated` + `service_role` and **not to anon**. Returns `booked_count`, `type_mix`, `ledger` and nothing else.
  - `public.booked_event_vendor_statuses()` — the four-status "booked" set, **given a name**. That list was hand-typed in four places (three RPCs + `BOOKED_EVENT_VENDOR_STATUSES` in `lib/vendor-funnel.ts`); this feature adds a *use*, not a fifth copy.
  - `public.vendor_booking_is_arms_length(...)` — named extraction of the anti-self-dealing exclusion set already inlined by `vendor_completed_events` **and** `vendor_trusted_review_stats`.
  - Both helpers are `REVOKE ALL ... FROM PUBLIC, anon, authenticated` with **no** grant — reachable only from inside the definer reader, so they add **zero** exposure surface.

**Privacy — the envelope is in SQL, not in the component.** The reader emits no name, no user or event id, no exact date, no venue, no price and no exact head-count. Three gates, all enforced in SQL so no caller can under-suppress by forgetting one:

- **(a) Minimum-N floor, K = 3.** Below three arm's-length events a card returns its **count alone** — `type_mix` and `ledger` come back empty. At N=1 those "aggregates" *are* one private event's record, rendered on the same page as a reviews section that names the couple, so `(type · month · size)` is attributable by simple adjacency. Reuses the shipped `public.min_n_ok()` gate rather than restating the comparison. The count itself is never suppressed — "booked 1×" identifies no event, and hiding it would break the medal ladder. **Pre-launch this is the normal path**, not an edge case: every card in prod is below the floor today.
- **(b) Completed-month ledger boundary.** A row appears only once its whole **month** is history (`event_date < date_trunc('month', today)`). A day boundary would publish a row at midnight Manila *on the event day*, so anyone polling daily would learn the exact `event_date` from the day the row first appeared — recovering precisely the granularity `'YYYY-MM'` exists to withhold.
- **(c) Past + banded + capped.** Future bookings count toward the total but never become a row. `events.estimated_pax` is banded **inside SQL** (`<50 / 50–99 / 100–199 / 200+ / unknown`); the thresholds exist only in the migration and TypeScript owns only the labels. Ledger capped at 6.

The TypeScript side deliberately holds **none** of these numbers — not K, not the band boundaries, not the month rule — so it cannot drift from the floor, and a count-only record is a first-class shape all the way to the component (no placeholder, no "only N events" tell; a suppressed card must look identical to a quiet one).

This is where the design bent away from the mock: the mock listed named couples, and named couples are not shippable under RA 10173.

**Two correctness traps caught in review, both asserted:**

- **One booking is one event.** `lockPackage` cascades one `event_vendors` row per kept item alongside the anchor, so counting rows would have inflated a nine-line package to 10×. The reader counts `DISTINCT event_id` — the same grain the free-tier cap rule already uses.
- **Anti-padding is not optional.** "Booked N×" is exactly the number a vendor can inflate by booking themselves, so it honours the same exclusion set that gates the public completed-events and trusted-review numbers, and skips `archived_at` / `voided_by_fraud` rows.

**App layer.**

- `apps/web/lib/service-card-record.ts` — pure `compileCardRecord()` (mix maths, milestone ladder, ledger cap/ordering, labels) + a batched fetch wrapper. Reuses the shipped `formatEventTypeLabel`, which matters because `events.event_type` is now TEXT with an admin-authored vocab. `compileCardRecord` is **total**: its input is a JSONB blob crossing a network boundary and both callers run inside a page render on a public route, so it never throws for any input — a malformed element is skipped, a malformed payload compiles to the zero record, and a junk row costs its own row rather than the vendor's whole profile page.
- `apps/web/lib/card-record-flag.ts`, `apps/web/app/_components/card-record-section.tsx` (dumb view; type-only imports so mounting it inside the `'use client'` gallery pulls no data layer into the browser).
- Mounts: the couple card in `app/v/[slug]` (via `ServicesPricingSection` → `services-gallery.tsx`) and the vendor's own card in `vendor-dashboard/services/_components/services-manager.tsx` (record + medal case + next-milestone line, rendered outside `<details>` so it is visible without opening the editor). **A card with zero bookings shows nothing new** on either surface.
- Rating badge reuses `vendor_trusted_review_stats` — the only source the anti-fraud lock permits for a public rating number, and already fetched on `/v/[slug]`, so it costs no extra query. Reviews carry **no service dimension**, so the badge is labelled "shop rating" rather than implying this card earned the stars.

**Tests:** 32 pure (`lib/service-card-record.test.ts` — milestone edges 0/9/10/24/25/49/50/99/100/150, mix maths, banding labels, ledger cap + ordering, the count-only shape, and totality against junk payloads/elements/field types) · 3 flag · 25 DB (`tests/db/service-card-record.db.test.ts` — grant posture for the reader *and* both helpers, the batch cap, the retired per-card signature, status set, package-cascade de-duplication, archived/voided/self-dealt exclusion, pax banding at every boundary, past-only ledger, cap + ordering, both sides of the min-N floor, the completed-month boundary, and an assertion that no uuid or fixture name can appear anywhere in the payload).

**Both new privacy gates are neutralisation-probed**, not just asserted: reverting the ledger to a day boundary fails exactly the boundary test (25 → 24 pass), and weakening K from 3 to 1 fails exactly the two floor tests (25 → 23 pass). Neither guard can pass vacuously.

**Exposure baseline:** exactly **one** added line — `func public.service_card_records(p_service_ids uuid[]) secdef=yes exec=authenticated search_path=public` — plus the two header counters. Note `exec=authenticated`, with **no anon**. Both helpers add nothing, which is the point of revoking them.

**Deliberately NOT built** (each needs data that does not exist): most-picked options (per-option picks are not stored per booking — `event_vendors.package_item_id` is a single item id and customizations live as JSONB on `event_vendor_packages`), the guest-flywheel stat (no guest→couple attribution), reply-time and Papic-documented badges, and the Explore mount (slice-D session owns that surface).

**Follow-up filed, not smuggled in:** repoint the three shipped booking RPCs at `booked_event_vendor_statuses()`, and the view + matview at `vendor_booking_is_arms_length()`, so each rule is written down once. Both need shipped money-adjacent bodies replicated verbatim through `CREATE OR REPLACE` — a bigger blast radius than this feature warrants.

SPEC IMPACT: None beyond `DECISION_LOG.md` row 2819, which already records the build-go and the deferrals. No SKU, price, or public-pricing change.
