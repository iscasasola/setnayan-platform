## 2026-07-16 · feat(vendor): On-the-Day launcher — pick → configure → access → launch (PR-2..PR-5 + counsel schemas)

Builds the full 4-step vendor day-of launcher on top of PR-1's taxonomy-driven registry (#3290). Council verdict `Vendor_On_The_Day_App_Council_Verdict_2026-07-16.md` + the owner's §8 overrides.

**Step 1 — pick event** (`_components/event-picker.tsx`): booked events classified today / upcoming / past from `fetchVendorPoolBookings` vs PH today. Today = launchable now; upcoming = configurable ahead of time.

**Step 2 — configure modules** (`_components/module-configurator.tsx` + `saveDayOfModules` action + `vendor_dayof_configs` table): per-booking on/off toggles, optimistic + persisted. Sparse override — absent row = code defaults; the stored list is intersected server-side with the modules AVAILABLE to the vendor's family (an override can never enable a module the category doesn't offer). Counsel-gated modules render locked.

**Step 3 — access grants** (`_components/access-grants.tsx` + `setEventAccessGrant` action + `vendor_event_access_grants` table + the new 9th RLS helper `current_vendor_dayof_grant_event_ids()`): the owner's chosen per-event ACCOUNT model (over the council's device-pairing). Owner/admin always have access; teammates are granted per-event. Only surfaces when a delegable module is on AND there's a non-owner teammate (a solo operator never sees it). The launch route admits a granted account by resolving the granting vendor via the grant.

**Step 4 — launch** (`live/[eventId]/page.tsx` + `_components/floor-clock.tsx`): fullscreen booked-today-gated floor console — obsidian focal, `FloorClock` (Screen Wake Lock + honest countdown), reused realtime `RunOfShowHeader`, live RSVP headcount, enabled-module quick links, live reviews.

**Honest hours countdown** (`lib/vendor-dayof-countdown.ts`, 7 tests): counts to the couple's next `event_schedule_block` + hours left in their program, labelled as the couple's program; degrades to a T-band elapsed with no timeline; never a fabricated vendor service end.

**LIVE review feed** (`_components/live-reviews.tsx` + `20270809988056` publication ALTER): supabase realtime on base table `vendor_reviews` filtered to the vendor, ~15s reconcile backstop. Vendor-private, read-only, post-completion by construction — NO new access, RLS unchanged.

**Counsel-gated schemas (COMMITTED, NOT to be pushed until the DPO/NPC ruling; app surfaces flag-off):**
- `20270811377742_vendor_papic_capture_counsel_gated.sql` — vendor free Papic capture (10 photos/3 clips + Ltd/Unli token upsell). RA 10173 minimums baked in (consent_basis, nsfw_checked, geo NOT stored, 5s clip cap). Flag `VENDOR_PAPIC_CAPTURE_ENABLED`.
- `20270811993944_vendor_guest_deliveries_counsel_gated.sql` — per-guest vendor delivery tracker ("who hasn't received theirs"). Flag `VENDOR_GUEST_DELIVERY_ENABLED`.
- `lib/vendor-dayof-flags.ts` — the two flags (default OFF). Until flipped, both modules render "Needs setup" and no capture/delivery surface activates.

All migrations: RLS at CREATE time with canonical helpers (`current_vendor_booked_event_ids` ∩ `current_vendor_profile_ids`, `current_event_ids`, `current_vendor_ids('admin')`, `is_admin`), idempotent, re-run safe.

Gates: tsc 0 · next lint clean · 21/21 lib unit tests green (module registry 14 + countdown 7). Live browser verification (a booked-today vendor) not runnable in-session; the taxonomy/countdown/override logic is pure-function unit-covered.

SPEC IMPACT: `DECISION_LOG.md` (2026-07-16) + `Vendor_On_The_Day_App_Council_Verdict_2026-07-16.md` (§8 owner overrides). Standing counsel item: the DPO/NPC consent-chain ruling governs go-live of vendor Papic capture + per-guest delivery.
