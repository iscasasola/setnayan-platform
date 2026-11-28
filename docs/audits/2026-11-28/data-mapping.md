# Data + mapping audit (28 Nov 2026)

> **Read only.** No app code or migrations were changed. Auditor: cloud session, Opus.
> Base: `origin/main` @ `42d90d04`. Prod was not touched; the controller runs § 6 and adds row counts.
> The speed audit (per-page waterfalls, PR #8419) is not repeated here. The button audit (#8420) and the theme audit (#8417) are not repeated either.
>
> **Scope:** `apps/web` (tests, `app/dev/**` and `*.lab.*` excluded), `apps/mobile`, and the schema built by `supabase/migrations/*` (latest definition wins).
> The line numbers were checked against the file at the base commit. A builder still greps the named symbol before editing (Hard rule 2: the anchor is the symbol, not the line).

## 0 · Counts

| Area | Count |
|---|---|
| Tables created in migrations / still live | 595 / 543 |
| Live tables with no reader **and** no writer | 8 |
| Live tables dead in practice (writer never called, or read only by a one-off) | 5 |
| Exported copies of the booked status set (besides `lib/vendor-funnel.ts`) | 13 |
| Inline copies of the booked set in app code / in migrations | ~27 / 149 (only 6 migrations call `booked_event_vendor_statuses()`) |
| Second readers of guest headcount | 9 |
| Second readers of budget money | 5 (one is dormant) |
| "Average rating" columns shown for one shop | 3 |
| Local peso formatters outside `lib/php.ts` | ~38 (2 of them exported as `formatPeso`) |
| Hand-typed fallback prices that show when a catalog read fails | 7 files |
| RSVP value list typed again | 7 |
| `in('member_type', ['couple','coordinator'])` typed inline | 18 |
| Stored enum values the app does not know | 3 sets (`vendor_category` ×6, `chat_sender_role` `guest`, pricing basis `per_unit`) |
| `select('*')` call sites / returning full rows / fallback-only | 75 / 48 / 7 |
| Realtime `.channel(` sites / with `postgres_changes` | 20 / 6 files |
| Network polling loops (`setInterval`) | ~19 |
| Outside services | 14 (Maya, Apple IAP, Meta, Resend, R2, Nominatim/OSM, Anthropic, OpenAI, Recraft, Turnstile, web push, APNs, Google OAuth, Vercel API) |
| Integration findings | 30 |
| Prod test or demo data planted by migrations and never removed | 4 sets |

**Nothing found makes an insert fail.** Every stored set checked matches its latest DB definition:
`vendor_status`, `rsvp_status`, `guest_role` (40 values), `member_type`, `vendor_tier_state`, `order_status`, `payment_status`,
`chat_inquiry_status`, proposal, booking-fee, day-request, appointment, pricing basis and supplier `duty`.
The defects are values the app **drops or mislabels when it reads**, and lists that are copied many times and will drift.

**Clean, no action:**
- Plan limits all read `TIER_CAPS`.
- The Papic pool maths is in one place apart from one ignored error (row H9).
- Maya, Apple IAP, email (Resend) and the R2 client each sit in one module, held by tests.
- `/dev` labs are gated twice.
- `scripts/seed-demo-vendors.ts` and `seed-preference-match-demo.ts` refuse the prod project ref.
- `supabase/seed.sql` only checks the id generator.

---

## 1 · Critical (money, security, or a wrong number a person acts on)

| # | Where | Problem | Fix in one line | Group |
|---|---|---|---|---|
| C1 | `apps/web/lib/maya-checkout.ts:69` `mayaApiBase` | Any http(s) origin saved in settings is accepted. The Maya **secret key** (Basic auth) is then sent to that host, even over plain http. | Allow only Maya's own https hosts (sandbox + production). Refuse anything else. | G7 |
| C2 | `apps/web/lib/maya-checkout.ts:80` `mayaEnvironment` | Any host without "sandbox" in its name counts as production, which also chooses the webhook IP list. | Work out the environment from the same host allowlist. | G7 |
| C3 | `apps/web/lib/editorial-scan.ts:86,97,101` (writes at `:163`) | Moderation fails open. No key, a non-OK reply or a network error is stored as `scan_status:'clean'`, and the content unlocks. | Return "unscanned" and store `skipped`, never `clean`. | G7 |
| C4 | `apps/web/lib/iap/fulfil.server.ts:386` | App Store **sandbox** transactions grant real entitlements in production. They are only labelled as sandbox. | Grant sandbox only on non-production deployments or to internal users. | G7 |
| C5 | `apps/web/lib/iap/notifications.server.ts:47` | `n.bundleId && …` lets a notification with no `bundleId` through. | Require `bundleId === APP_BUNDLE_ID`. | G7 |
| C6 | `apps/web/lib/papic-limited.ts:142` `countLimitedGuests` | Papic Limited is **priced** from its own guest count, which has no `deleted_at` filter, so removed guests are charged for. A missing table returns 0 (`:150`). | Use `countGuestsByEvent` / `headcountForBasis` from `lib/guests.ts`. Return null on a failed read. | G2 |
| C7 | `apps/web/lib/vendor-addon-pricing.ts:118` | A failed `vendor_billing_catalog` read returns the hand-typed `VENDOR_AI_ADDON_FALLBACK_PHP`, which is then quoted to the supplier (`subscription/ai-addon-actions.ts:192,242`). | Return null and show `PRICE_UNREAD`. | G4 |
| C8 | `apps/web/lib/turnstile-verdict.ts:35` | If `TURNSTILE_SECRET_KEY` is unset, bot protection on login and password reset switches off silently. | In production, fail closed or alert when the secret is missing. | G7 |
| C9 | `apps/web/app/api/webhooks/persona/route.ts:50`, `…/veriff/route.ts:35` | Public webhook stubs with no signature check. | Delete both, or verify the HMAC before any future write. | G7 |

## 2 · High (shared number with two readers, stored value dropped, prod data, index scan on the hottest read)

| # | Where | Problem | Fix in one line | Group |
|---|---|---|---|---|
| H1 | `apps/web/lib/coordinator-trade.ts:66` | A **second export with the same name**, `BOOKED_EVENT_VENDOR_STATUSES` (`string[]`). It is imported by `guests/checkin/page.tsx:25` and `vendors/actions.ts:131`. | Re-export from `lib/vendor-funnel.ts`. | G1 |
| H2 | 12 more exported booked constants: `lib/vendors.ts:202` `BOOKED_VENDOR_STATUSES` (14 importers) · `lib/events.ts:733` · `lib/event-deletion-gate.ts:93` · `lib/admin/suppliers-to-review.ts:19` · `lib/couple-booked-and-settled.ts:24` · `lib/shortlist-taxonomy.ts:56` · `lib/chat-lock-booking.ts:24` · `lib/lock-impact-inputs.ts:52` · `lib/vendor-addon-first5-free.ts:59` · `lib/supplier-where.ts:35` · `lib/favorites.ts:20` · `lib/papic-supplier-way-in.ts:24` · `lib/vendor-manpower-reads.ts:23` · `lib/booked-by-payment.ts:37` | One fact, 13 homes (CLAUDE.md §4: "a second reader is a bug"). | Each becomes `= BOOKED_EVENT_VENDOR_STATUSES` from `lib/vendor-funnel.ts`. A guard test bans the literal tuple outside it. | G1 (`lib/vendors.ts` → G6) |
| H3 | ~27 inline booked lists that feed shown counts: `lib/vendor-overview-desk-reads.ts:219` · `lib/badge-earned.server.ts:134` · `lib/their-event.server.ts:79` · `app/api/v1/vendor/bookings/route.ts:14` · `vendors/[vendorId]/review/page.tsx:282` + `review/actions.ts:252` · `studio/playlist/page.tsx:95` · `lib/date-change.server.ts:484` · `lib/suppliers-build.ts:272` · `lib/answers-desk.ts:211` · `lib/booking-fee-mint.server.ts:205` · `lib/people-with-access.server.ts:20` · `lib/supplier-night-before-email.ts:55` · `lib/lock-request-state.ts:25` · `lib/vendor-activity.ts:353` · `lib/reusable-bookings.server.ts:141,354` · `vendors/page.tsx:2504` · `vendors/_components/build-locked.tsx:63` · `plan-budget-accordion.tsx:80` · `build-3state-actions.ts:57` · `_actions/reuse-actions.ts:106` · `_components/nikah-imam.ts:8` · `promote-coordinator-card.tsx:69` · `vendor-dashboard/clients/[eventId]/script-actions.ts:66` · `scripts/budget-parity.ts:74` | Same fact typed again inline. | `.in('status', [...BOOKED_EVENT_VENDOR_STATUSES])`. | G1 |
| H4 | `supabase/migrations/*` (149 files, e.g. `20271362770154` lines 62 and 349, `20271363111049` lines 43 and 65) | SQL functions type `IN ('contracted','deposit_paid','delivered','complete')` instead of calling `booked_event_vendor_statuses()`. | Each time a function is next redefined, use `= ANY(public.booked_event_vendor_statuses())`. No sweep migration. | G1 (rule only) |
| H5 | `apps/web/lib/budget.ts:713` `fetchBudgetSnapshot` + `:267` `buildBudgetLiveSummary` (own paid sums `:282`, `:912`) | The **second budget reader** is still live: `app/api/budget/[eventId]/ics/route.ts:26`, `lib/event-preload.ts:110`, the summary at `vendors/[vendorId]/workspace/page.tsx:901`, and, when the budget-truth flag is off, `budget/page.tsx:302`, `details/page.tsx:397` and `lib/budget-live-read.ts:61`. | Move them onto `resolveEventMoney` and retire `totals`. | G3 |
| H6 | `apps/web/app/vendor/fit/[ref]/page.tsx:170` | "Remaining budget" comes from `fetchBudgetSnapshot().totals.remaining`, which sums rows whatever their status. | `resolveEventMoney` → `knownMoneyTotals`. | G3 |
| H7 | `apps/web/lib/setnayan-ai-snapshot.ts:621` | The AI's "fully settled" check sums `event_vendor_payments.amount_php` by hand. Line 632 already holds the resolver's money. | Derive it from the `money` that is passed in. | G3 |
| H8 | `apps/web/app/[slug]/_components/editorial/data.ts:942,1199` | The public Event Hub runs its own three guest counts (total, attending, replied), and `count ?? 0` / catch → 0 hides errors, so a refused read shows "0 guests". | `fetchGuestsByEventMeasured` + `computeGuestStats`. Show "—" when the read is not measured. | G2 |
| H9 | `apps/web/lib/papic-guest-own-camera.ts:124` | The `spentRes` error is ignored, so `points_used` reads as 0 and the guest is shown credits they do not have. | Return null on `spentRes.error`, as `dedRes` already does. | G2 |
| H10 | `apps/web/app/admin/events/[eventId]/page.tsx:161` `liveGuests` | Admin counts skip the `REQUEST_ENTRY_SOURCE`, passed-away and represented-by rules, so support sees a different number from the host. | `countGuestsByEvent` / `computeGuestStats`. | G2 |
| H11 | `apps/web/lib/vendors.ts:6,71,128` | The `vendor_category` enum has 6 values the app does not know: `bridal_gown`, `groom_suit`, `bridal_shoes`, `groom_shoes`, `entourage_attire`, `parents_attire` (migration `20260621000000`). A row with one of them gets no label and fails `VENDOR_CATEGORIES` checks. | Add them to the union, the list and the labels, or migrate the rows and drop the values (owner call). | G6 |
| H12 | `apps/web/lib/supplier-landing-data.ts:167`, `app/(shell)/suppliers/_landing.tsx:112` `BASIS_UNIT`, type `lib/supplier-landing.ts:55` | `per_unit` cards (allowed by the CHECK in `20271352223098`) are folded into `fixed` and shown as "package price". | Add `per_unit` to `PricingBasis` and `BASIS_UNIT`. | G6 |
| H13 | `apps/web/lib/chat.ts:16` `ChatSenderRole` | The enum now also holds `guest` (`20271339978803`), but the app type has no `guest`. | Add `'guest'`, then follow the type errors. | G6 |
| H14 | `events.slug`: ~30 `.ilike('slug', …)` (e.g. `app/[slug]/_lib/loaders.ts:193` `theOneEventRead`, `lib/guest-session.ts:1032`, `app/[slug]/hub/page.tsx:70`, `app/[slug]/seat/page.tsx:112`, `app/api/live/[slug]/watch/route.ts:55`) + 8 `.eq('slug', …)` | The only index is `ON events (LOWER(slug))` (`20260513050000…invitation.sql:38`). Neither ILIKE nor `slug =` can use it, so **every guest Event Hub request scans `events`**. | The slug CHECK already forces lowercase: use `.eq('slug', s.toLowerCase())` and add a plain unique btree on `events(slug)`. | G8 |
| H15 | `vendor_profiles.business_slug`: 19 sites (e.g. `app/v/[slug]/page.tsx:566,577`, `lib/check-a-date.server.ts:114`, `lib/slug-forwarding.ts:100`) | Same shape: the only index is on `LOWER(business_slug)`. | Same fix: `.eq` on the lowercased value, plus a btree. | G8 |
| H16 | `supabase/migrations/20270405784887_seed_founder_vendor_demo_stats.sql:77-100` | Inserted 18 `FOUNDER-DEMO · …` events (`archived=false`, **no `is_sample`/`is_demo` flag**), plus threads, completed `event_vendors` and `vendor_activity_stats` on the founder's real shop, then refreshed `vendor_public_completed_events_stats` (`:290`). Nothing retires them, so fake numbers can reach public counts. | After the prod check in § 6, one cleanup migration deletes them and refreshes the matview. | G10 |
| H17 | `supabase/migrations/20260607000000_seed_vendor_reviews.sql` | ~50 `TEST-REVIEW · …` events. `20260705000000:131` deleted their suppliers but never the events. | Same cleanup migration. | G10 |
| H18 | `supabase/migrations/20260609000000_admin_vendor_with_all_services.sql` | Each admin got a "Setnayan Admin Test Vendor" with a service row for every canonical service. The later purge skips it (`is_demo=false`, `user_id` set). | Flag it `is_demo` or delete it, after the § 6 check. | G10 |
| H19 | `apps/web/scripts/seed-test-accounts.sql` (header), `seed-inquiry.sql`, `reset-test-accounts.sql`, `claim-demo-vendors.ts` | Operator scripts write test accounts (`*.test@…`) and threads. Their own header shows running them against **prod** via `--db-url`. Migration `20271017100000` notes a `testnayan1@test.com` "TEST Floor Co (seed)" shop already in prod. Unlike `seed-demo-vendors.ts`, they have no prod-ref refusal. | Add the same prod-ref refusal; delete the prod rows after § 6. | G10 |
| H20 | `apps/web/app/api/admin/demo/seed/route.ts:60` `prodGuard` | An admin can seed ~1,500 `is_demo` shops **into prod** whenever demo mode is on (owner-approved 3 Jun). This conflicts with the 28 Nov "no test data on prod" finish line. | **Owner call**: keep it (rows are flagged and hidden) or hard-block prod. | G10 |

## 3 · Medium (copied lists that will drift, labels that disagree, N+1, polling)

| # | Where | Problem | Fix in one line | Group |
|---|---|---|---|---|
| M1 | `apps/web/lib/pax.ts:34` `liveHeadcount`, `lib/after-summary.ts:107`, `studio/papic/magazine/route.ts:225`, `lib/auto-recap.ts:459`, `launch/_components/details-guided-progress.ts:111`, `lib/wedding-roadmap-signals.ts:136` (no `deleted_at`, `?? 0`) | Headcount is re-implemented or copied inline 6 more times. | Import `countGuestsByEvent`; add an attending-count export next to it in `lib/guests.ts`. | G2 |
| M2 | `apps/web/lib/guests.ts:994` vs `lib/pax.ts:13` | Two `HeadcountBasis` types. `vendor_portion_rules.headcount_basis` uses a different value set (`confirmed/expected/ceiling`, `production-sheet-model.ts:25`) under the same name. | One type in `lib/guests.ts`; rename the portion-rule field in the app type. | G2 |
| M3 | RSVP list typed 7 times: `app/[slug]/actions.ts:64`, `guests/new/actions.ts:50`, `guests/new/page.tsx:62`, `guests/inline-actions.ts:62`, `guests/[guestId]/actions.ts:69`, `lib/guest-fresh-reset.ts:29`, `lib/guest-import-file.ts:375`; type copied at `app/[slug]/_components/guest-hub-card.tsx:30`, `lib/seating-3d.ts:103` | Copied list and type. | Export `RSVP_STATUSES` from `lib/guests.ts` and import it. | G2 |
| M4 | Meal labels in 5 maps: `lib/guests.ts:426`, `lib/hub-tool-entries.ts:385`, `app/[slug]/_lib/thank-you-words.ts:42`, `vendor-dashboard/clients/[eventId]/production-sheet-model.ts:29`, `…/propose-change.tsx:34` | "Kids" in some, "Kids meal" in others. | Import `MEAL_LABELS`. | G2 |
| M5 | `apps/web/lib/checklist-budget.ts:100,148` `computeBudgetHealth` | Dormant second money reader with its own committed list (no callers). | Delete it. | G3 |
| M6 | `apps/web/app/tour/budget/page.tsx:57` | Per-category totals from `itemizedTotal` include every status. | `resolveEventMoney` buckets. | G3 |
| M7 | Rating: `avg_rating_overall` (`vendor/fit/[ref]/page.tsx:113`, `explore/_components/vendor-card.tsx:104`, `v/[slug]/page.tsx:1464`, `lib/vendor-counts.ts:183`, `tour/vendors/page.tsx:119`) vs `trusted_avg_rating` (`vendor-dashboard/shop/page.tsx:461`, `explore/compare/page.tsx:596`, `v/[slug]/page.tsx:1243`) vs `review_avg_bayesian` (`lib/business-doing.ts:68`) | **One shop can show three different star ratings.** No reader is named in §4. | Pick one (`ratingLine` in `lib/business-doing.ts`). Add a §4 row. | G5 |
| M8 | `apps/web/app/vendor-dashboard/website/page-data.ts:321` | `Number(avg ?? 0) \|\| 0` turns "no reviews" into "0★". | Shared reader; null shows "No reviews yet". | G5 |
| M9 | `apps/web/lib/add-on-stats.ts:134`, `lib/admin/app-performance-stats.ts:447` (capped at `ROW_CAP`), `app/api/v1/vendor/reviews/route.ts:55` (count error ignored) | Ratings averaged in JS over capped reads; an ignored error. | RPC-backed reader; check the error. | G5 |
| M10 | Supplier money collected: `lib/vendor-cashflow` (RPC), `lib/vendor-customers.ts` `summarizeMonthlyPayments`, `lib/vendor-overview.ts:1457`, `lib/vendor-earnings.ts:234` | Four paths for one number; no reader is named in §4. | One reader (the cashflow RPC). Add a §4 row. | G3 |
| M11 | `apps/web/lib/v2-catalog-pure.ts:152` and `lib/checklist-budget-format.ts:23` | Two exported `formatPeso` functions. The second prints ₱0 for a non-finite value. | `formatPhp` / `formatCentavosPhp`. | G4 (`checklist-budget-format` → G3) |
| M12 | ~36 local peso formatters (full list in Appendix A) | Money is formatted outside `lib/php.ts`. | `formatPhp` / `formatPhpRounded` / `formatCentavosPhp`; ratchet guard. | G4 |
| M13 | Hand-typed fallback prices: `lib/setnayan-ai-pricing.ts:27,30,66`, `lib/vendor-photo-challenge.ts:58,74`, `app/admin/vendors/actions.ts:738`, `lib/vendor-3d-booth-pricing.ts:56,87`, `lib/papic-cameras.ts:229-244,307,355,538`, `lib/papic-limited.ts:176`, `vendor-dashboard/clients/[eventId]/_components/booth-studio-card.tsx:115` ("From ₱…"), `admin/settings/payment-methods/page.tsx:502`; plus `lib/sku-catalog.ts:118-421`, a dead price mirror | A price is typed in code (brand claim 1, Hard rule 3). | Read the catalogs only; when unread, show `PRICE_UNREAD`. Strip prices from `sku-catalog`. | G4 (`papic-limited` → G2) |
| M14 | `apps/web/app/admin/pricing/plan-contents-actions.ts:187` `EVENT_PLAN_CODES` | Leaves out `EVENT_ULTRA`, which `pricing/_pricing-reads.ts:155` reads, so admins cannot edit Ultra's credits. Plan SKU strings are typed in ~20 files. | `Object.values(PLAN_PRICE_CODES)`. | G6 |
| M15 | Paid tier trio `['solo','pro','enterprise']` typed in 11 files (`supplier-front-data.ts:54`, `plan-table-data.ts:34`, `for-coordinators/_facts.ts:63`, `admin/pricing/_surfaces/free-windows-actions.ts:90`, `subscription/_components/plan-screen.tsx:116`, `lib/plan-gift.ts:20`, `lib/verification-plan-reward.ts:48`, `lib/vendor-credit-warning.server.ts:54`, `lib/setnayan-shop-gift.server.ts:166`, `lib/personal-invite-offer.ts:26`, `lib/specialized-tools-access.ts:128`). `VENDOR_TIER_SETTABLE` is the same as `VENDOR_TIERS` (`vendor-tier-caps.ts:42`). | Copied list. | Export `PAID_TIERS` from `lib/vendor-tier-caps.ts`. | G6 |
| M16 | `apps/web/lib/vendor-autoreply/auto-accept.ts:66` `PAID_TIERS` | Includes free `verified`, so it disagrees with every other "paid" set. | Rename it, or derive it from `vendor-tier-caps`. | G6 |
| M17 | `in('member_type', ['couple','coordinator'])` inline ×18 | Copied list. | Move `HOST_MEMBER_TYPES` (`app/[slug]/_lib/host-scope.ts:21`) into `lib/` and import it. | G6 |
| M18 | `apps/web/lib/orders.ts:5` vs `lib/order-promotion-rule.ts:37`; `app/admin/users/[userId]/page.tsx:130` private `ORDER_STATUS_LABEL` with no `lapsed` | Two order-status types; a lapsed order shows a raw key. | One type; import `ORDER_STATUS_LABEL`. | G6 |
| M19 | `apps/web/lib/demand-radar.ts:140` vs `lib/admin/intelligence-stats.ts:292` | Two `EVENT_TYPE_LABELS` maps and two `eventTypeLabel` functions. Both miss 5–9 `event_type_vocab` values. | Read labels from `event_type_vocab`. | G6 |
| M20 | `apps/web/app/dashboard/[eventId]/disputes/page.tsx:53`; `explore/_lib/marketplace-view.tsx:2762` `SHORTLIST_STATUSES` | Dispute list lacks `complete`, so a finished booking cannot be disputed; the shortlist set is its own copy. | `['shortlisted', ...BOOKED_EVENT_VENDOR_STATUSES]`. | G1 |
| M21 | `apps/web/lib/deposit-acknowledged-effects.server.ts:307` | Repeats `LIVE_CHARGE_STATUSES` (`booking-fee-mint.server.ts:207`). | Export and import it. | G1 |
| M22 | `apps/web/app/api/notify/route.ts:94` vs `lib/web-push.ts:31` | Two web-push senders, each setting VAPID details. `/api/notify` calls iOS "stubbed" (`:18`) though `lib/apns.ts` exists, so iOS chat pushes are dropped. | `/api/notify` → `lib/push-send.server.ts`. | G7 |
| M23 | `apps/web/lib/join-door-throttle.ts:107`, `venue-door-throttle.ts:110`, `anon-mint-throttle.ts:33`, `viewer-hash.ts:14`, `guest-session.ts:308` | The service-role key doubles as a hash salt (with typed fallbacks), so rotating the key resets every limit and hash. | One `HASH_SALT` read in one module. | G7 |
| M24 | `apps/web/lib/hub-view-route.ts:63,93,157`, `lib/live-wall.ts:135`, `lib/visits/record-visit.ts:88` | Service-role REST by raw fetch outside `lib/supabase/admin.ts`. `live-wall:138` and `record-visit:112` have no `res.ok` check and no timeout. | Add `serviceRoleRest()` in `lib/supabase/admin.ts` with timeout and logging. | G7 |
| M25 | AI: `new Anthropic()` in 6 files; model ids typed at `vendor-deep-search.ts:104`, `payment-receipt-read.server.ts:31`, `moodboard-gallery-screen.server.ts:103`, `category-proposal-draft.ts:57`, `theme-text-intent-model.ts:76`, `admin-map/ask-the-admin.ts:165`; `ANTHROPIC_API_KEY` checked in 8 places, not in `integration-config`; `verification-paper-read.server.ts:76` borrows the receipt model | No single AI module. | `lib/ai/client.ts` (`anthropicClient()`, `aiConfigured()`, `MODELS`). | G7 |
| M26 | R2: `lib/r2.ts:504` `r2SignedGet` vs `lib/uploads.ts:281` `presignDisplayUrl`; `R2_PUBLIC_URL` read in 9 files (`lib/storage.ts:295`, `lib/background-videos.ts:64`, `lib/desktop-release-server.ts:30`, `app/[slug]/venue/page.tsx:203`, `app/api/venue-scene/[slug]/route.ts:64`, `app/layout.tsx:623`, `next.config.ts:22`, `admin/integrations/page.tsx:483`); 8 scripts build their own `S3Client` | Two signed-GET paths; public URL built by hand. | `r2PublicUrl()` exported from `lib/r2.ts`; merge the signers; `scripts/_r2.ts`. | G7 |
| M27 | `apps/web/app/vendor-dashboard/shop/_components/editable-row.tsx:1119`; `lib/geo.ts:149,247,337` | A second browser-side Nominatim geocoder bypasses `lib/geo.ts`. A **personal email address is typed as the Nominatim contact and ships in the browser bundle.** | A server action wraps `geocodeNominatim`; one `NOMINATIM_CONTACT` role address. | G7 |
| M28 | `apps/web/lib/panood-youtube.ts:173,212`, `lib/papic-drive.ts:168,209`, `lib/seo/search-console.ts:35` | Three copies of the Google OAuth token exchange. | One `googleTokenExchange()` beside `lib/google-oauth-authorize.ts`. | G7 |
| M29 | `apps/web/app/dashboard/[eventId]/vendors/page.tsx:3451` | Inside a **GET render**, a loop runs one `event_vendors` UPDATE plus a notification per supplier. | One `.update().in(...)` (or a cron); send the notifications in parallel. | G1 (file owner) |
| M30 | N+1 reads: `lib/invitation-chapters.server.ts:165` (4 counts per chapter) · `admin/disputes/_components/booking-fee-disputes-section.tsx:97` (4 per dispute) · `admin/corrections/page.tsx:113` · `dashboard/[eventId]/alaala/page.tsx:168` · `lib/story-suppliers.server.ts:109` · `lib/religion-readiness.ts:82` · RPC-per-row `lib/supplier-scan.server.ts:110`, `lib/booking-fee-disclosure.server.ts:759`, `lib/setnayan-shop-gift.server.ts:174` | One query per row. | `.in()` batch or a grouped / array RPC. | G9 |
| M31 | N+1 writes: `guests/import/actions.ts:126`, `guests/inline-actions.ts:284`, `lib/connected-guest-link.server.ts:76` · `schedule/actions.ts:789` · `seating/actions.ts:2007` | One UPDATE per row (hundreds on a CSV re-upload). | Bulk upsert or one RPC. | G2 (guest files) · G9 (schedule, seating) |
| M32 | `apps/web/lib/part-editor-lock.ts:40` `WATCH_EVERY_MS = 2_000` | Every open part editor polls the lock RPC every 2 s. | 10–15 s, or the existing presence broadcast. | G9 |
| M33 | `apps/web/lib/live-screens.ts:67` `LIVE_SCREEN_POLL_MS` (5 s) → `app/live/screen/screen-stage.tsx:39` | Each paired TV runs a full RSC `router.refresh()` every 5 s, so every server read runs again. | Poll a small stamp (as event-pulse does); refresh only when it changes. | G9 |
| M34 | `apps/web/lib/event-pulse.server.ts:66,75-77` | Event-day pulse runs `select('*')` on four tables (one through the slug ILIKE) just to hash a stamp. | Select only the hashed columns; `.eq` slug. | G9 |
| M35 | `apps/web/app/admin/connection-logs/connection-logs-client.tsx:139` | `postgres_changes` on the whole `app_telemetry_logs` table (the busiest writer) with no filter. | Filter, or poll every 30 s. | G9 |
| M36 | `apps/web/app/vendor-dashboard/on-the-day/_components/live-reviews.tsx:39,73` · `studio/photo-delivery/_components/release-progress-poller.tsx:90` (2.5 s) · `on-the-day/_components/requests-inbox.tsx:83` | Polling with no hidden-tab pause; `select('*')`. | `pauseWhileHidden`, a longer interval, named columns. | G9 |
| M37 | Realtime publication: `notifications`, `thread_calls`, `wall_feed` | They are in `supabase_realtime`, but no client subscribes to their `postgres_changes`, so WAL is decoded for nothing. | One migration: `ALTER PUBLICATION supabase_realtime DROP TABLE …`. | G10 |
| M38 | `apps/web/app/vendor-dashboard/messages/[threadId]/_components/vendor-payment-live.tsx:207` | The realtime filter is `event_id` only, so every supplier thread on the event wakes for every payment write. | Add a `vendor_id` filter. | G9 |
| M39 | Orphan tables (no reader, no writer): `render_jobs`, `platform_availability`, `vendor_2307_filings`, `vendor_guest_deliveries`, `stewardship_transfers`, `person_stewardships`, `concierge_plan_templates`, `concierge_response_cache`, `wedding_destinations` | Dead tables (owner rule: no orphan tables). | Drop them after § 6 confirms 0 rows, or record a reason in `ugat-concept.baseline.txt`. | G10 |
| M40 | Dead in practice: `manual_payment_logs` (writer `verify_and_activate_manual_payment` has 0 callers), `vendor_ad_subscriptions` (0 writers; read by the `vendor_active_ads` view), `token_rewards_log`, `concierge_unanswered_questions`, `inspiration_part_categories` (trigger-written copy nobody reads) | Same. | Drop, or stop the copy trigger. | G10 |
| M41 | `apps/web/lib/integration-config.ts:199-222` (also Resend `:40`, Maya `:478`) | A Supabase `{error}` and a failed decrypt are swallowed; it falls back to env with no log. | Log before falling back. | G7 |
| M42 | `apps/web/app/admin/integrations/page.tsx:120`, `admin/email-delivery/page.tsx:45` | Read `RESEND_*` env directly, bypassing the DB-first resolver, so the status shown can be wrong. `RESEND_FROM_ADDRESS` and `RESEND_FROM_EMAIL` are two variables for one job. | `resolveResendConfig()`; one from-address variable. | G7 |
| M43 | `apps/web/lib/email.ts:111` | Falls back to `onboarding@resend.dev` in production, so mail is accepted but reaches only the account owner. | A missing from-address is `not_configured` in production. | G7 |

## 4 · Low (labels, words, stale comments, small index gaps)

| # | Where | Problem | Fix in one line | Group |
|---|---|---|---|---|
| L1 | `event_vendors.status=contracted`: "Contracted" (`lib/vendors.ts:244`) vs "Plan finalized" (`vendors/[vendorId]/workspace/page.tsx:301`) | Labels disagree. | One word in `VENDOR_STATUS_LABEL`. | G3 (workspace file) |
| L2 | RSVP `pending`: "Pending" (`lib/guests.ts:583`), "No reply" (`RSVP_ROW_WORDS`), "No reply yet" (`lib/ugat/data-pure.ts:189`); `declined`: "Declined" / "Not coming" / "Can’t come" | Labels disagree. | Everything reads `RSVP_ROW_WORDS`. | G2 |
| L3 | Team role `agent`: "Team member" (`lib/vendor-team.ts:32`) vs "Account Manager" (`team/_components/helpers-view.tsx:74`, `lib/vendor-duties.ts:42`); `owner`/`admin` "Admin" vs "Shop Manager" | Disagrees with CLAUDE.md §1 role names. | Show `VENDOR_DUTY_NAME`; retire `VENDOR_TEAM_ROLE_LABEL`. | G6 |
| L4 | `member_type=couple`: "Host" / "Couple" / "Bride & Groom" / "The couple" (`admin/users/[userId]/page.tsx:123`, `lib/day-requests.ts:303`, `lib/role-groups.ts:32`) | Four labels. | One shared map. | G6 |
| L5 | Tier `verified`: `TIER_LABEL` "Free · Verified" overridden to "Verified" in 5 places | Labels disagree. | `tierShortLabel()` in `vendor-tier-caps`. | G6 |
| L6 | Pricing basis `fixed`: "Fixed price" / "One price" / "package price" (`pricing-basis-editor.tsx:46`, `price-basis-rows.tsx:34`, `lib/self-added-price-basis.ts:166`, `_landing.tsx:113`) | Labels disagree. | One map next to `PRICING_BASIS_OPTIONS`. | G6 |
| L7 | `apps/web/lib/coordinator-broadcasts-server.ts:78`; type `lib/coordinator-broadcasts.ts:36` | `sender_role='supplier'` (CHECK `20271320900784`) is mapped to "Your coordinator". Latent today. | Add `supplier` to the type and labels. | G6 |
| L8 | Banned words: `vendor-dashboard/actions.ts:1035` "Supplier Plus"; `vendor-dashboard/team/actions.ts:540` "Supplier Ultra"; `lib/locks.ts:136` "Supplier Plus · Supplier Pro · Supplier Ultra"; `scripts/demo-shop/setnayan-productions.fixture.ts:32`; `admin/disputes/page.tsx:772` "downpayment" | Brand word rules. | `TIER_LABEL` / "first payment". | G6 |
| L9 | `apps/web/app/dashboard/[eventId]/vendors/actions.ts:2925` (+ `lib/supplier-word.ts:83`, `lib/payment-note-words.ts:11`) | The stored payment note says "Downpayment … vendor …". It is reworded on display, but the raw words sit in the DB. | Store a code; render the words. | G1 |
| L10 | `apps/web/app/_components/iap/apple-pro-screen.tsx:12` | `const PRO` holds the Plus product. | Rename it to `PLUS`. | G6 |
| L11 | `users.email` ILIKE ×13 (e.g. `lib/coordinator-grant.ts:235`, `app/join/[eventId]/actions.ts:286,514`, `admin/discount-codes/actions.ts:668`); `users.slug` (`lib/slug-availability.ts:154`) | No usable index; `_` and `%` are not escaped, so `_` matches any character in an email. | `.eq` on the lowercased value; escape as in `admin/team/team-ops.server.ts:178`. | G8 |
| L12 | `event_seat_assignments.guest_id` (29 filters) · `event_schedule_blocks` / `event_tables` ordered by `sort_order` | Guest-only lookups scan; ordering is not indexed (small sets). | Optional `(guest_id)` and `(event_id, sort_order)`. | G8 |
| L13 | `select('*')` that returns full rows: `lib/couple-media-allowance.server.ts:111`, `lib/vendor-autoreply/inbox-hook.ts:240`, `lib/contracts.ts:79,99,119`, `lib/vendor-payment-methods.server.ts:106,204` (a couple-facing read of the supplier's whole row), `lib/preparation.ts:667,964`, `lib/vendor-service-payment-schedules.ts:623` | Wide rows fetched for a few columns. | Name the columns. | G9 |
| L14 | `lib/vendor-instagram.ts:128,154,277`, `lib/editorial-scan.ts:89`, `lib/recraft.ts:119`, `lib/seo/search-console.ts:35,57`, `lib/turnstile-verify.ts:53` | Outside calls with no timeout. | `AbortSignal.timeout(10_000)`. | G7 |
| L15 | `sentry.server.config.ts:21`, `sentry.edge.config.ts:17` | Email and phone scrubbing runs only in the browser (`deferred-observability.tsx:225`). `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are two variables. | Shared `lib/observability-scrub.ts`. | G7 |
| L16 | `apps/web/app/api/webhooks/maya/route.ts:46` | Two DB reads and a decrypt run before the IP filter on an unauthenticated endpoint. | Check the union of the IP lists first. | G7 |
| L17 | `apps/web/lib/email.ts:157` `cancelScheduledEmail` | No callers; ignores Resend's `{error}`. | Delete it. | G7 |
| L18 | Stale comments: `app/admin/payments/maya.ts:11` ("exactly two" doors, there are 3); `lib/booking-fee-gate.ts:20` ("rail is PayMongo"); `lib/ugat/graph.ts:587` (`token_burn_bands` "still sits in prod", dropped by `20271033104200`) | Wrong comments. | Fix the words. | G7 (maya, booking-fee-gate) · G10 (graph.ts) |
| L19 | `lib/social/instagram.ts:32` vs `lib/social/facebook.ts:30` | Graph API base and version typed twice. | One constant. | G7 |
| L20 | 7 cron routes copy the secret check | Safe, but copied. | `lib/webhook-secret-auth.ts`. | G7 |

---

## 5 · Fix groups (no two builders share a file)

**File-owner rule.** When a file appears in two groups, the owner below takes every row on that file. The rows above already carry the owner.
`lib/vendors.ts` → G6 · `vendors/page.tsx`, `build-locked.tsx` (booked + peso fix), `vendors/actions.ts` → G1 · `lib/pax.ts`, `lib/papic-limited.ts`, the guest action files → G2 ·
`lib/budget.ts`, `lib/checklist-budget*.ts`, `workspace/page.tsx` → G3 · `v/[slug]/page.tsx` (ratings and slug) → G5 ·
`lib/booking-fee-mint.server.ts` → G1 · `lib/setnayan-shop-gift.server.ts` (tier list and N+1) → G6.

| Group | Rows | Files (main ones) | Needs a migration? | Order |
|---|---|---|---|---|
| **G1 Booked set: one constant** | H1–H4, M20, M21, M29, L9 | `lib/vendor-funnel.ts`, `lib/coordinator-trade.ts`, the 12 `lib/*` constants in H2 except `lib/vendors.ts`, the H3 inline files, `vendors/page.tsx`, `build-locked.tsx`, `disputes/page.tsx`, `marketplace-view.tsx` | No; adds a guard test that bans the literal tuple | Suppliers + payments first |
| **G2 Headcount + RSVP: one reader** | C6, H8–H10, M1–M4, M31 (guest files), L2 | `lib/guests.ts`, `lib/pax.ts`, `lib/papic-limited.ts`, `lib/papic-guest-own-camera.ts`, `editorial/data.ts`, `admin/events/[eventId]/page.tsx`, the guest action files, `lib/after-summary.ts`, `lib/auto-recap.ts`, `lib/wedding-roadmap-signals.ts` | No | Couples + guests |
| **G3 Money: retire the second budget reader** | H5–H7, M5, M6, M10, M11 (`checklist-budget-format`), L1 | `lib/budget.ts`, `lib/budget-live-read.ts`, `lib/event-preload.ts`, `vendor/fit/[ref]/page.tsx`, `tour/budget/page.tsx`, `lib/setnayan-ai-snapshot.ts`, `lib/checklist-budget*.ts`, the ICS route, `workspace/page.tsx`, the supplier cashflow readers | No | Payments first |
| **G4 Pesos + prices from the catalog** | C7, M11 (`v2-catalog-pure`), M12, M13 | `lib/vendor-addon-pricing.ts`, the pricing `lib/*` files in M13, `lib/sku-catalog.ts`, the Appendix A formatter files not owned elsewhere | No; adds a ratchet on local `toLocaleString` money | Suppliers + payments |
| **G5 One rating reader** | M7–M9 | `lib/business-doing.ts`, `lib/vendor-counts.ts`, explore card, compare, `v/[slug]/page.tsx`, shop page, website page-data, `lib/add-on-stats.ts`, app-performance stats, v1 reviews route | No | Suppliers |
| **G6 Enum maps + labels + words** | H11–H13, M14–M19, L3–L8, L10 | `lib/vendors.ts`, `lib/chat.ts`, `lib/supplier-landing*.ts`, `_landing.tsx`, `lib/orders.ts`, `lib/order-promotion-rule.ts`, `lib/vendor-tier-caps.ts`, the tier-list files, `host-scope.ts`, the label files, `lib/locks.ts`, `demand-radar.ts`, `intelligence-stats.ts` | Only if the owner drops the 6 attire enum values instead of labelling them | Suppliers |
| **G7 Integration hardening** | C1–C5, C8, C9, M22–M28, M41–M43, L14–L20 (not graph.ts) | `lib/maya-checkout.ts`, `lib/editorial-scan.ts`, `lib/iap/*`, `lib/turnstile-*`, the webhook stubs, `lib/supabase/admin.ts` + throttles, `app/api/notify`, a new `lib/ai/client.ts` + the 6 AI files, `lib/r2.ts` + `uploads.ts` + R2_PUBLIC_URL readers, `lib/geo.ts` + `editable-row.tsx`, Google OAuth files, `lib/integration-config.ts`, `lib/email.ts`, Sentry configs | No | **First (security)**. It can split in two: G7a = C rows + M23; G7b = the rest |
| **G8 Slug + email lookups use an index** | H14, H15, L11, L12 | A migration (btree on `events(slug)`, `vendor_profiles(business_slug)`, optional seat and order indexes), `app/[slug]/_lib/loaders.ts`, `lib/guest-session.ts`, the `app/[slug]/*` and `api/live/[slug]` call sites, `lib/check-a-date.server.ts`, `lib/slug-forwarding.ts`, the email ILIKE sites | **Yes** (`do-not-auto-merge`, after Ship) | Next after G7: the hottest read |
| **G9 Fewer reads: N+1, polling, `*`** | M30, M31 (schedule, seating), M32–M36, M38, L13 | The files named in those rows | No | Any order |
| **G10 Prod data cleanup + orphans** | H16–H20, M37, M39, M40, L18 (graph.ts) | One cleanup migration (after § 6 counts), the `scripts/seed-*.sql` prod-ref refusal, `lib/ugat/graph.ts`, `tests/db/ugat-concept.baseline.txt`; H20 waits for the owner | **Yes**, gated on the controller's § 6 results and an owner GO | After § 6 |

---

## 6 · Read-only SELECTs for the controller (written, **not run**)

All are `SELECT` only. Run them in the SQL editor against prod and paste the results under this section.

```sql
-- 6.1 Row counts per table (cheap, from stats; exact counts in 6.2 for the ones that matter)
SELECT relname AS table, n_live_tup AS approx_rows, n_dead_tup, last_autoanalyze
FROM pg_stat_user_tables WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- 6.2 Exact counts for the tables this audit names
SELECT 'events' t, count(*) FROM public.events
UNION ALL SELECT 'events is_sample', count(*) FROM public.events WHERE is_sample
UNION ALL SELECT 'vendor_profiles', count(*) FROM public.vendor_profiles
UNION ALL SELECT 'vendor_profiles is_demo', count(*) FROM public.vendor_profiles WHERE is_demo
UNION ALL SELECT 'vendor_services is_demo', count(*) FROM public.vendor_services WHERE is_demo
UNION ALL SELECT 'venue_directory is_demo', count(*) FROM public.venue_directory WHERE is_demo
UNION ALL SELECT 'guests', count(*) FROM public.guests
UNION ALL SELECT 'event_vendors', count(*) FROM public.event_vendors
UNION ALL SELECT 'app_telemetry_logs', count(*) FROM public.app_telemetry_logs;

-- 6.3 Orphan / dead tables (M39, M40): expect 0 rows each before a drop
SELECT 'render_jobs' t, count(*) FROM public.render_jobs
UNION ALL SELECT 'platform_availability', count(*) FROM public.platform_availability
UNION ALL SELECT 'vendor_2307_filings', count(*) FROM public.vendor_2307_filings
UNION ALL SELECT 'vendor_guest_deliveries', count(*) FROM public.vendor_guest_deliveries
UNION ALL SELECT 'stewardship_transfers', count(*) FROM public.stewardship_transfers
UNION ALL SELECT 'person_stewardships', count(*) FROM public.person_stewardships
UNION ALL SELECT 'concierge_plan_templates', count(*) FROM public.concierge_plan_templates
UNION ALL SELECT 'concierge_response_cache', count(*) FROM public.concierge_response_cache
UNION ALL SELECT 'concierge_unanswered_questions', count(*) FROM public.concierge_unanswered_questions
UNION ALL SELECT 'wedding_destinations', count(*) FROM public.wedding_destinations
UNION ALL SELECT 'manual_payment_logs', count(*) FROM public.manual_payment_logs
UNION ALL SELECT 'vendor_ad_subscriptions', count(*) FROM public.vendor_ad_subscriptions
UNION ALL SELECT 'token_rewards_log', count(*) FROM public.token_rewards_log
UNION ALL SELECT 'inspiration_part_categories', count(*) FROM public.inspiration_part_categories;
-- (If a table is already gone, that line errors; drop the line and re-run.)

-- 6.4 Planted demo/test events (H16, H17)
SELECT left(display_name, 14) AS prefix, count(*), bool_or(archived) AS any_archived, bool_or(is_sample) AS any_sample
FROM public.events
WHERE display_name LIKE 'FOUNDER-DEMO · %' OR display_name LIKE 'TEST-REVIEW · %'
GROUP BY 1;

SELECT count(*) AS demo_event_vendor_rows
FROM public.event_vendors ev JOIN public.events e ON e.id = ev.event_id
WHERE e.display_name LIKE 'FOUNDER-DEMO · %' OR e.display_name LIKE 'TEST-REVIEW · %';

-- 6.5 Test shops (H18, H19)
SELECT id, business_name, is_demo, verification_state, created_at
FROM public.vendor_profiles
WHERE business_name ILIKE '%test vendor%' OR business_name ILIKE 'TEST %' OR business_name ILIKE '%(seed)%';

-- 6.6 Rows owned by test accounts (＠test.com, ＠example.com, *.test@setnayan.com)
WITH t AS (
  SELECT id FROM auth.users
  WHERE email ILIKE '%@test.com' OR email ILIKE '%@example.com' OR email ILIKE '%.test@setnayan.com'
)
SELECT 'auth.users' t, count(*) FROM t
UNION ALL SELECT 'public.users', count(*) FROM public.users WHERE id IN (SELECT id FROM t)
UNION ALL SELECT 'vendor_profiles', count(*) FROM public.vendor_profiles WHERE user_id IN (SELECT id FROM t)
UNION ALL SELECT 'event_members', count(*) FROM public.event_members WHERE user_id IN (SELECT id FROM t)
UNION ALL SELECT 'events (member is a test account)', count(DISTINCT event_id) FROM public.event_members WHERE user_id IN (SELECT id FROM t);

-- 6.7 Orphan rows (children whose parent is gone; expect 0 where an FK exists)
SELECT 'guests→events' t, count(*) FROM public.guests g LEFT JOIN public.events e ON e.id = g.event_id WHERE e.id IS NULL
UNION ALL SELECT 'event_vendors→events', count(*) FROM public.event_vendors v LEFT JOIN public.events e ON e.id = v.event_id WHERE e.id IS NULL
UNION ALL SELECT 'event_members→events', count(*) FROM public.event_members m LEFT JOIN public.events e ON e.id = m.event_id WHERE e.id IS NULL
UNION ALL SELECT 'event_seat_assignments→guests', count(*) FROM public.event_seat_assignments s LEFT JOIN public.guests g ON g.id = s.guest_id WHERE g.id IS NULL
UNION ALL SELECT 'events with no member', count(*) FROM public.events e WHERE NOT EXISTS (SELECT 1 FROM public.event_members m WHERE m.event_id = e.id) AND NOT e.is_sample;

-- 6.8 Stored values the app does not know (H11, H12, H13)
SELECT category::text, count(*) FROM public.event_vendors   -- event_vendors.category is the vendor_category enum
WHERE category::text IN ('bridal_gown','groom_suit','bridal_shoes','groom_shoes','entourage_attire','parents_attire')
GROUP BY 1;
SELECT pricing_basis, count(*) FROM public.vendor_services GROUP BY 1;
SELECT sender_role::text, count(*) FROM public.chat_messages GROUP BY 1;

-- 6.9 Index use on the slug read (H14): seq scans on events vs index scans
SELECT relname, seq_scan, seq_tup_read, idx_scan FROM pg_stat_user_tables
WHERE relname IN ('events','vendor_profiles','users','guests','event_vendors');

-- 6.10 Realtime publication (M37)
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY 1;
```

Column names in 6.8 come from the migrations. If a line errors because a column or table moved, fix that line only.

---

## 7 · NOT COVERED

- **Prod row counts and real orphan rows.** This audit had no prod access; § 6 is for the controller.
- **Whether each SQL function that reads a "live" table is actually called.** The orphan count is a lower bound.
- **RLS policy correctness and the 8-pattern rule.** Not audited here.
- **Per-page read waterfalls and load times.** See the speed audit, PR #8419.
- **Buttons and dead controls** (#8420) and **theme tokens** (#8417).
- **The direct `total_cost_php` selects in 8 server files** (e.g. `lib/booking-fee-disclosure.server.ts:371`, `lib/thread-decision-sources.server.ts:78`): not checked for whether they use the admin client or should go through `event_vendor_money_read`.
- **Desktop (Tauri) and `apps/mobile`** beyond confirming that mobile makes no outside calls of its own.
- **Email templates' wording** against `docs/brand.md`. Only stored and labelled values were checked.
- **Unit labels** (pax, per hour) beyond the pricing-basis set.
- **The ~200 loops that await Supabase calls.** Only the clear N+1 cases are listed; crons, pagination and batches were skipped.
- **Corpus cross-check.** The specs corpus was not read in this cloud session, so labels were compared with code and `docs/brand.md` only.

---

## Appendix A · Local peso formatters (G4 unless the owner rule says otherwise)

Couple and guest screens:
- `dashboard/[eventId]/manpower/page.tsx:58`
- `studio/papic/_components/credit-stepper.tsx:22`
- `papic-buy-form.tsx:65`
- `studio/pakanta/_components/pakanta-music-form.tsx:48`
- `onboarding/wedding/_components/wedding-cards.tsx:61`
- `onboarding/_shared/services-step.tsx:154`
- `lib/onboarding/services-step-data.ts:139`
- `lib/upcoming-items.ts:422`
- `lib/your-team.ts:292,324`
- `lib/per-unit-price.ts:27`
- `lib/vendor-service-public.ts:306`
- `app/_components/home/HomeOverlays.tsx:400`
- `app/_components/chat-amendment-card.tsx:158`
- `lib/budget.ts:918,922` (owner G3)

Quotes, receipts and verification:
- `lib/quote-versions.ts:94`
- `lib/accepted-quote-terms.ts:97`
- `lib/vendor-verification.ts:1007`
- `lib/payment-receipt-slip.ts:64`
- `lib/booking-fee-disclosure.ts:200`
- `lib/supplier-billing.ts:188`

Supplier dashboard (`app/vendor-dashboard/`):
- `clients/[eventId]/page.tsx:455,466,475`
- `messages/[threadId]/page.tsx:1370`
- `messages/[threadId]/pay-confirm-actions.ts:141,212`
- `messages/[threadId]/_components/vendor-payment-live.tsx:58` (owner G9 with M38)
- `clients/[eventId]/_components/payment-asks-panel.tsx:43`
- `manpower/_components/gig-card.tsx:37`
- `bookings/_components/vendor-prep-add.tsx:54`
- `offers/_components/offer-editor.tsx:80`
- `offers/_components/offer-maker.tsx:254`
- `services/_components/payment-schedule-editor.tsx:363`
- `subscription/ai-addon-actions.ts:168`
- `subscription/booth-addon-actions.ts:197`
- `subscription/photo-challenge-actions.ts:299`
- `customers/_components/shop-wallet-sheet.tsx:66`
- `_components/branch-manager.tsx:52`
- `on-the-day/live/[eventId]/_components/portfolio-credits-card.tsx:20`

Admin:
- `admin/accounts/_surfaces/users-surface.tsx:997`
- `admin/vendor-partnerships/page.tsx:77`
- `admin/settings/payment-methods/page.tsx:502`
- `admin/discount-codes/_components/voucher-form.tsx:79,174`
- `admin/integrity-watch/page.tsx:184`
- `lib/admin/receipt-match-lines.ts:23`
- `admin/pricing/_components/{ai-bands-editor:35, papic-rest-editor:18, signup-discount-card:14, papic-ladder-editor:30}`
- `admin/app-performance/_surfaces/overview-surface.tsx:68`
- `admin/app-performance/_components/expenses.tsx:55`

## Appendix B · Outside services: one line each

| Service | Path(s) | Verdict |
|---|---|---|
| Maya | `lib/maya-api.ts` (the only fetch), `maya-checkout(.server).ts`, `app/admin/payments/maya.ts` `settleMaya` (3 callers: webhook, return, start) | One choke point. The webhook re-asks Maya before approving. C1, C2, L16 |
| Apple IAP | `api/iap/app-store-notifications` → `lib/iap/notifications.server.ts`, JWS verify in `lib/iap/apple-jws.ts` | Good verification. C4, C5 |
| Meta / IG | `lib/social/facebook.ts`, `lib/social/instagram.ts`, `lib/vendor-instagram.ts`; keys only in `integration-config` | No pixel and no Conversions API. L14, L19 |
| Email | `lib/email.ts` `sendEmail` → Resend (one sender) | M42, M43, L17 |
| R2 | `lib/r2.ts` (the only `S3Client` in the app) + `lib/uploads.ts` | M26 |
| Maps | `lib/geo.ts` (Nominatim) + a browser copy; OSM tiles | No paid key. M27 |
| AI | Anthropic ×6 files, OpenAI moderation (`editorial-scan`), Recraft | C3, M25 |
| Turnstile | `lib/turnstile-verify.ts` | C8 |
| Push | `lib/web-push.ts`, `/api/notify`, `lib/apns.ts` | M22 |
| Google OAuth | YouTube, Drive, Search Console | M28 |
| Supabase service role | `lib/supabase/admin.ts`, plus 8 direct readers | M23, M24 |
| Sentry | server, edge, browser configs | L15 |
| Persona / Veriff | webhook stubs | C9 |
| Vercel API | `lib/vercel-env.ts`, `lib/vercel-domains.ts` (each reads the token itself) | Low: share one reader |
