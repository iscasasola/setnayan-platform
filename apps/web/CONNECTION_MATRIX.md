# Connection Matrix & Gap Audit

> **Audit target:** `apps/web` (Next.js 15 App Router · React · Supabase · Vercel)
> **Code audited:** `origin/main` @ commit `2241b8ee` (PR #1043) — a clean detached worktree, **not** the local `~/apps/web` checkout (which is ~489 commits behind). **All `file:line` references below are valid against `origin/main`.** Pull `origin/main` before navigating them.
> **Date:** 2026-06-07
> **Scope scanned:** 179 `page.tsx`, 72 API `route.ts`, 102 server-action files (`'use server'` ×110), 671 `.tsx` components, 181 `lib/*.ts`, 247 SQL migrations.

## Methodology & honest coverage

1. **Deterministic sweep** — grep battery for the anti-patterns the task names: empty/dead handlers (`onClick={()=>{}}`, `href="#"`), un-awaited mutations, empty `catch {}`, `.catch(()=>{})` swallows, mutations with ignored `error`, bare `.from()` statements.
2. **Reading pass** — 7 parallel sub-agents, one per surface, each *reading* the actual code (not grep alone) to confirm wiring, destinations, fallbacks, and dead-ends, with explicit false-positive guardrails (awaited multi-line chains, `Promise.all`-wrapped queries, and best-effort `admin_audit_log`/notification/telemetry/drive-copy inserts were **not** counted as defects).
3. **Schema-vs-code set diff** — every `CREATE TABLE/VIEW` in `supabase/migrations` vs every `.from('table')` literal in code, both directions, plus API-endpoint caller analysis.

**Headline:** this is a **mature, well-wired codebase.** The trivial failure modes the task hunts for are essentially absent — **zero** empty `onClick`/`onSubmit` handlers, **zero** dead `href="#"` anchors, only **2** empty `catch{}` (both benign), multi-line query chains are correctly awaited, and `Promise.all` query arrays are awaited collectively. Mutation error-handling is consistently present (payments/admin actions `throw` loudly). The real findings are a **handful of genuine broken/missing connections** and **one runtime-risk schema gap**, listed in §"Action List" and §"Gap Analysis".

---

> ### ⚙️ Post-audit verification & fixes (2026-06-07 · re-checked against `origin/main` @ `183deae5` / PR #1044)
>
> After the audit, the top findings were re-verified against current code + the **live production DB**, and the blockers were fixed in this same change:
>
> - **✅ Fixed — missing table `event_software_activations`.** Confirmed against prod: the table is genuinely absent (only `_v2` exists, with matching columns + the `UNIQUE(event_id,service_code)` index). Repointed the 3 manpower API `.from()` calls to `event_software_activations_v2`. **New, deeper discovery from DB inspection:** the DB function `verify_and_activate_manual_payment` (admin/Maya manual-payment activation) *also* inserted into the absent old table at 2 sites — a 4th bug of the same class, fixed by migration `20260903000000_…` (⚠️ needs `supabase db push`).
> - **✅ Fixed — onboarding "Add your own vendor" (BYO) false success.** Was a pure no-op showing "✓ connected … emailed". Now persists each entry as an `event_vendors` `considering` row (existing schema, no new table) and the toast copy is truthful (no fake "emailed"/"connected" claim; no new email integration).
> - **✅ Fixed — Supplies cart `/orders/new` dead-end.** The cart's "Checkout via Orders" `<Link>` pointed at the retired `/orders/new` (bounces to `/add-ons`, in-memory cart lost). Neutralized into a disabled "Checkout opens soon" affordance (iteration 0018 is a deferred mock; real checkout is intentionally out of scope).
> - **✅ Fixed — Site-editor Pro-upgrade `/orders/new` dead-end.** The unowned-state CTA was a live `<CardLink href="…/orders/new?service=…">` (same retired stub). Since `monogram_hero_upgrade` / `pro_widget_schedule` have no checkout page (Pro-tier purchase is a V1.1 deferral), it's now an honest **"Coming soon"** pill; the owned-state "Active" badge still reads a real order row. *(Both `/orders/new` CTAs — supplies + site-editor — were genuine dead-ends; the audit was correct.)*
>
> The vendor-monetization gaps (no in-app `tier_state` write, buy-token route, calendar-block CRUD) remain **open** (not in this fix's scope) — see Action List #4–6.

**Coverage caveat:** every server action, every API route, and every primary interactive flow across onboarding, auth, couple dashboard, vendor dashboard, admin console, papic/capture, and public/landing surfaces was read. The connection tables below are *representative of each surface's key features*, not a line-by-line enumeration of all 671 components (presentational/data-only files were not row-listed).

**Status legend:** **Operational** = wired end-to-end · **Broken** = handler runs but doesn't reach its destination (user-visible failure) · **Missing** = UI/flow implies a connection that doesn't exist · **Risk** = wired but with a silent-fail / missing-guard hazard.

---

## 1 · Onboarding · Auth · Join/Host

| Feature / UI Element | File Path:line | Destination (Supabase / State / API) | Fallback if Blank | Status | Detailed Issue / Gap Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Email/password sign-in | `app/login/actions.ts:53` | `supabase.auth.signInWithPassword` | `?error=missing` / `?error=` | Operational | Error surfaced via searchParams; "Stay signed in" downgrades cookies to session-only |
| Magic-link sign-in | `app/login/actions.ts:84` | `supabase.auth.signInWithOtp` | `?error=missing` / `?error=` | Operational | `shouldCreateUser:false`; `?sent=1` on success |
| Signup form | `app/signup/actions.ts:41` | `auth.signUp` + auto-confirm + `users.public_summary_consent_at` | `?error=missing/password_too_short/blacklisted` | Operational | 3 side-effects via `Promise.allSettled`; consent write polls for trigger row |
| OAuth Google/Facebook | `app/auth/oauth-actions.ts:46` | `auth.signInWithOAuth` → provider | "not configured" redirect if no URL | Operational | Shared across login/signup/onboarding step 11 |
| OAuth callback | `app/auth/callback/route.ts:5` | `auth.exchangeCodeForSession` | `safeNext()` open-redirect guard | Operational | — |
| Waitlist join | `app/waitlist/actions.ts:18` | `couple_waitlist_signups` upsert | `?error=missing_email/invalid_email/server` | Operational | Idempotent by email |
| Join-event role picker | `app/join/[eventId]/actions.ts:29` | `guests` insert/link + `event_members` insert | `?error=invalid_role/invalid_token` | Operational | Matches guest by email or creates placeholder |
| Host accept invite | `app/host/accept/[token]/actions.ts:25` | `event_moderators` update (accept, token→null) | terminal-state guards; `?error=accept_failed` | Operational | Single-use token |
| Host decline invite | `app/host/accept/[token]/actions.ts:108` | `event_moderators` update (removed_at) | always `?declined=1` | **Risk** | Update `error` not captured — if it fails, link stays live but user told "declined" (cosmetic) |
| Host-invite → signup link | `app/host/accept/[token]/page.tsx:168` | link `/signup?…&email=` | empty string | **Risk** | Passes `&email=` but signup reads `prefill_email` (`signup/page.tsx:74`) → invitee email **not** pre-filled, can mismatch |
| Onboarding final commit | `app/onboarding/wedding/_components/onboarding-shell.tsx:2040` → `…/actions.ts:288` | `events`+`event_members`+`event_moderators`+`guests`+`event_vendors`+`event_song_picks` | retry banner; unwind+retry on reject | Operational | Idempotent via `committedEventId`; router-wedge watchdog |
| Onboarding venue search | `onboarding-shell.tsx:1583` → `actions.ts:653` | `vendor_profiles` (recommendations) | `.catch(()=>setVenues([]))` | Operational | Never throws |
| Onboarding "Add your own vendor" (BYO) | `onboarding-shell.tsx:1703` (`sendByo`) + form `:2976` | **NONE — local state only** | `if(!name) return` | **Broken** | Shows "✓ {name} connected … emailed {email}" but **no server action / no fetch / not in commit payload**. Vendor never saved, no email sent. Misleading success. |
| Song-bank search | `…/song-bank-step.tsx:63` → `actions.ts:971` | `songs` search + iTunes preview | `[]` on empty/error | Operational | Debounced latest-wins |

---

## 2 · Couple Dashboard (core)

| Feature / UI Element | File Path:line | Destination (Supabase / State) | Fallback if Blank | Status | Detailed Issue / Gap Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Guest add (detailed) | `…/guests/new/actions.ts:146` | `guests` insert (+plus-one row) | `?error=missing_name`; rsvp default `pending` | Operational | Friendly 23505 dup handling |
| Guest edit / delete | `…/guests/[guestId]/actions.ts:145,216` | `guests` update / `deleted_at` soft-delete + seat release | RSVP/bride-groom gates redirect | Operational | Consent-off revokes `guest_face_enrollments` |
| Guest CSV import | `…/guests/import/actions.ts:62` | `guests` bulk insert | empty/no_rows/dup redirects | Operational | 200-row cap, dedupe by norm key |
| Bulk role/side/group | `…/guests/groups-actions.ts:195` | `guests` + `guest_group_memberships` | no_selection redirect | Operational | Forms bound via `.bind(null,eventId)` |
| Budget target | `…/budget/actions.ts:37` | `events.estimated_budget_centavos` | empty clears to NULL; >₱100M rejected | Operational | — |
| Budget line item / payment | `…/budget/actions.ts:127,171,207,284` | `event_vendor_line_items`, `event_vendor_payments` | `vc:`-vendor-controlled → null FK | Operational | All insert/delete errors thrown |
| Seating create/assign/move | `…/seating/actions.ts:14,73,105` | `event_tables`, `event_seat_assignments` | invalid-type throws; pos clamped 0–100 | Operational | Drag → dirty set → explicit "Save layout" |
| Schedule create/edit/reorder | `…/schedule/actions.ts:31,162,305` | `event_schedule_blocks` | end>start validation | Operational | Reorder loops per-row (bounded) |
| Settings (theme/locale/reminders/profile) | `app/dashboard/profile/actions.ts:39,67,201,227` | `users.*` columns | invalid enum throws; blank→null | Operational | Soft-delete + password change error-checked |
| Landing visibility / widgets / dress-code | `…/website/{privacy,widgets,dress-code}/actions.ts` | `events.*config`, `invitation_widgets` | host-membership gate | Operational | All check DB error; revalidate public `/[slug]` |
| **Landing hero photo upload/remove** | `…/website/hero-photo/actions.ts:90,119` | `events.landing_page_hero_image_url` | empty/non-`r2://` bounce | **Risk** | `update()` result discarded — **no `const{error}`**; silent failure (R2 bytes uploaded, column pointer lost). Every sibling editor checks it. |
| Slug / monogram / QR reissue | `…/invitation/actions.ts:16,41,106` | `events.slug/monogram_*`, `guests.qr_token`, `slug_change_log` | slug regex + taken-check | Operational | All error-checked |
| Event master QR regen | `…/event-qr/actions.ts:35` | `events.master_qr_token` | empty → `not_found_or_not_host` | Operational | RLS 0-row as host check |
| Host invite / revoke | `…/hosts/actions.ts:94,152` | `event_moderators` (admin) | invite error→redirect | **Risk** | `revokeHostInvite` (`:163`) ignores update error, always `?invite_revoked=1` (idempotent, low) |

---

## 3 · Vendors Marketplace · Add-ons · Site Editor

| Feature / UI Element | File Path:line | Destination (Supabase / State) | Fallback if Blank | Status | Detailed Issue / Gap Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Public vendor browse/filter | `app/vendors/page.tsx:1213`, `filter-drawer.tsx:206` | `vendor_market_stats` + `vendor_profiles` (GET form) | `?? []` + broadened-radius | Operational | Demo fetches degrade to `[]` |
| Save / favorite vendor | `…/vendors/_components/save-vendor-button.tsx:67` → `actions.ts:120` | `event_vendors` insert (idempotent) | `already_saved/no_primary_event` | Operational | Re-anchors reception venue |
| Add venue to plan | `…actions.ts:267` `addVenueDirectoryEntryToPlan` | `event_vendors` insert | `already_added` idempotent | Operational | Unique index |
| Lock / finalize vendor | `…/plan-budget-accordion.tsx:1768` → `actions.ts:359` | `event_vendors` update→contracted + cascade | hard_single_conflict / soft_hold_limit | Operational | Conflict gate + cross-category cascade |
| Unlock category + auto-inquiry | `…/_actions/unlock-category.ts:147` | `event_vendors` insert + `chat_threads` upsert + `sendChatMessage` | `no_vendor/already_active`; inquiry best-effort | Operational | Token-burn intentionally not wired (documented) |
| "% match" compatibility pill | `plan-budget-accordion.tsx:1600` → `lib/compat-score` | derived (distance/rating/reviews/verified) | `null` → pill hidden | Operational | Refinement+date-headroom at neutral baseline pending 0044 (documented) |
| Cancel booking (host) | `…actions.ts:1991` `cancelBookingAsHost` | `event_vendors` delete + Resend email | `downpaid_use_dispute_flow` gate | Operational | Email fire-and-forget |
| **Add-on order-and-pay** (papic/qr/blueprint/monogram/STD/patiktok/panood) | `…/inline-checkout-drawer.tsx:337` → `checkout/actions.ts:229` `submitOrderAction` | `orders`+`payments` insert (rollback on fail) + `order_ledger` + email | inline `ok:false` reason | Operational | Atomic-ish w/ rollback; pax-price re-resolved server-side; idempotency key |
| Add-on owned-state gating | `custom-qr-guest/page.tsx:74` (+siblings) | `orders` SELECT by service_key | graceful `?? []` + 42P01/42703 swallow | Operational | Pending order locks page (prevents double-charge) |
| Voucher apply | `checkout/actions.ts:96` `applyVoucherAction` | read-only validate (no write) | inline rejection reason | Operational | Re-checked at submit |
| Site-editor hub | `app/site-editor/[eventId]/page.tsx` | 4 reads (`event_members`/`events`/guests/`orders`) | `notFound()` / `?? []` | Operational | Navigational hub; editing on sub-pages |
| **Site-editor Pro-upgrade CTA** | `…/site-editor.tsx` ProCard | `orders` (when owned) / honest "Coming soon" pill (unowned) | "Coming soon" pill | ✅ Fixed (this PR) | Was a live `<CardLink href="…/orders/new?service=${sku}">` that bounced to `/add-ons` dropping the SKU. `monogram_hero_upgrade`/`pro_widget_schedule` have no checkout page (Pro-tier purchase is a V1.1 deferral) → now an honest "Coming soon" pill; owned-state "Active" badge unchanged. |
| **Supplies cart checkout** | `…/supplies-marketplace/_components/cart-drawer.tsx` | (none — deferred 0018 mock) | disabled "Checkout opens soon" | ✅ Fixed (this PR) | Was a live `<Link>` to the retired `/orders/new` (bounced to `/add-ons`, cart lost). Catalog is mock (`_data/products.ts`); 0018 is deferred, so checkout is intentionally **neutralized** (disabled + coming-soon copy), not built. |

---

## 4 · Vendor Dashboard

| Feature / UI Element | File Path:line | Destination (Supabase / State) | Fallback if Blank | Status | Detailed Issue / Gap Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Create / update / toggle / delete service | `…/services/actions.ts:84,162,194,218` | `vendor_services` INSERT/UPDATE/DELETE | validation throws→redirect | Operational | Owner-scoped by `vendor_profile_id` |
| Propose new category | `…/services/actions.ts:122` | `taxonomy_category_requests` INSERT | label 2–80 guard | Operational | Lands as admin request |
| Accept / decline inquiry | `lib/chat-actions.ts:281,310` | `chat_threads` inquiry_status + reveal trigger | status-guarded | Operational | Does **not** burn token / write `event_vendors` — by design (couple-write-only) |
| Thread reply | `lib/chat-actions.ts:66` | `chat_messages` INSERT + notify | empty body → silent return | Operational | Accept-gate enforced server-side |
| Token wallet read | `…/tokens/page.tsx:104` | `vendor_wallets`/`earned_token_vouchers`/`token_grants_log`/`token_redemptions_log` | `?? 0` / `?? []` | Operational | Lazy expiry RPC; null-safe |
| **Buy token pack** | `…/tokens/_components/buy-tokens-cta.tsx:31` | **none (static card)** | static "opens this week" copy | **Missing** | No `/vendor-dashboard/tokens/buy` route — purchase flow unbuilt; dead-end CTA |
| Redeem voucher code | `…/redeem-code/actions.ts:129` | `redeem_vendor_token_voucher` RPC | branded error map | Operational | SECURITY DEFINER mint |
| **Token burn (manpower handshake)** | `…/manpower/actions.ts:147` | `consume_vendor_assets` RPC (2 tokens) + `manpower_gigs` UPDATE | INSUFFICIENT_WALLET_BALANCES→friendly | **Risk** | Only handles RPC *raise*; ignores possible BOOLEAN-`false` return (file header claims both). If RPC returns false on shortfall, gig claimed with **0 tokens burned** |
| Payment options add/delete/primary | `…/payment-options/actions.ts:41,102,116` | `vendor_payment_methods` | QR decode → pending_review | Operational | Pro-gate on links; server-side QR anti-swap |
| Logo upload + profile save | `…/actions.ts:185` | `vendor_profiles` UPDATE | parseLogoValue→null; geocode best-effort | Operational | r2:// or http(s) only |
| Marketing start/cancel ad | `…/marketing/actions.ts:120,220` | `vendor_ad_subscriptions` + audit | verified-gate | Operational | Apply-then-pay reconcile |
| Branch create/renew/cancel | `…/branches/actions.ts:125,177,203` | `vendor_branches` + `orders` + `payments` | tier read try/catch→null | Operational | Enterprise-gated; rolls back branch on payment-insert fail |
| Team invite/update/remove | `…/team/actions.ts:49,113,172` | `vendor_team_members` / `vendor_service_agents` | owner-only gate | Operational | 23505 dup→friendly |
| Verify draft/upload/submit | `…/verify/actions.ts:62,112` | `vendor_verification_applications` + audit | one-draft idempotent | Operational | Docs to R2 → JSONB patch |
| **Subscription / tier upgrade (Pro/Enterprise)** | *(no file)* | `vendor_profiles.tier_state` | gates default to free | **Missing** | Nothing writes `tier_state`; `lib/vendors.ts:345` notes column "never shipped." Vendors can't self-upgrade → Branches/payment-link gates unreachable |
| **Calendar block add/remove** | *(no file)* | `vendor_calendar_blocks` | read-only in availability lib | **Missing** | No CRUD UI; table populated only by demo seed → anti-double-book guards inert for real vendors |

---

## 5 · Admin Console

| Feature / UI Element | File Path:line | Destination (Supabase / State) | Fallback if Blank | Status | Detailed Issue / Gap Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Payment Approve | `app/admin/payments/actions.ts:66` | `payments`→matched + `orders`/`receipts`/payout/`activateConcierge`/ledger/notify | — | Operational | `.eq('status','pending')` guard + re-read; promote fails loudly. Exemplary |
| Payment Reject / Request-Resubmit | `…/payments/actions.ts:468,586` | `payments`→rejected/resubmit + ledger + email | min-length notice | Operational | Pending-guard + already-resolved msg |
| Refund order | `…/payments/actions.ts:719` | `orders`→refunded + `order_refunds` (UNIQUE) + audit | reason ≥20, ₱100M ceiling | Operational | UNIQUE belt-and-suspenders idempotency |
| **Vendor verify approve** | `app/admin/verify/actions.ts:400,206` | `vendor_verification_applications`, `vendor_profiles`, `vendor_tier_history`, audit + pilot grant | reason on reject/demote | **Risk** | Approve path has **no `.eq('status','pending')` guard** — re-approve re-runs flow + re-fires grant hook (hook idempotent → LOW). Only action in file missing the guard its siblings have |
| Vendor visibility transition | `…/verify/actions.ts:75` | `vendor_profiles.public_visibility` + audit | no-op when same | Operational | — |
| Taxonomy CRUD + remap leaf | `…/taxonomy/actions.ts:78–485` | `service_categories`, `canonical_service_taxonomy/_schemas` + audit | label 2–80 | Operational | Orphan guards on delete; rollback on partial |
| **Promote category request** | `…/taxonomy/actions.ts:496` | `taxonomy_category_requests`→promoted + leaf + audit | — | **Risk** | Status flip lacks `.eq('status','pending')` (reads at `:509`, TOCTOU window); siblings have it. Dup caught downstream → LOW |
| Discount code CRUD | `…/discount-codes/actions.ts:315–655` | `discount_codes` + audit | type-specific validation | Operational | 23505 collision msg; expiry guard |
| Settings (identity/payment instruments/QR) | `…/settings/actions.ts:55–227` | `platform_settings` (id=1) + R2 | business_name→'Setnayan'; VAT 12 | Operational | QR cleanup after row update |
| Concierge-abuse clear/confirm/lift | `…/concierge-abuse/actions.ts:53–250` | `concierge_abuse_flags`, `users` (strikes) + notify | notes ≥10/20 | Operational | `pending_review` guard; strike ladder |
| **Review appeal reject/escalate** | `app/admin/reviews/actions.ts:128,217` | `vendor_review_appeals` + audit + email | reason required | **Risk** | UPDATE lacks `decided_at IS NULL` filter → re-decide re-fires email/audit. `overridePublishReview` correctly guards. LOW |
| Force-majeure ownership/resolve | `…/force-majeure/actions.ts:45,88` | `force_majeure_flags` + couple notify | notes for refund/credit | Operational | — |
| Help ticket status/reply | `…/help/actions.ts:33` | `help_messages` + reply email | adminNotes nullable | Operational | Diffs notes to fire reply only on change |
| **Comp grant issue/revoke** | `app/admin/users/actions.ts:457,532` | `comp_grants` + audit | rationale ≥10 | **Risk** | `approved_by` hardcoded NULL — **two-admin gate for >₱10K grants not enforced** (banner only). Documented V1.x |
| Admin vendor invite | `…/vendors/actions.ts:55` | `vendor_invites`, `vendor_profiles` (staged) | typed result union | Operational | — |
| Demo-vendor accept/decline/reply | `…/demo-vendors/inquiries/actions.ts:79–140` | `chat_threads`, `chat_messages` | reply requires accepted | Operational | Status preconditions on every transition |
| Disputes queue | `app/admin/disputes/page.tsx:123` | `vendor_disputes` (read-only) | empty-state card | Missing (by design) | V1 read-only; banner → Supabase Studio. Documented |

---

## 6 · Papic · Public Landing · API Routes

| Feature / UI Element | File Path:line | Destination (Supabase / State / API) | Fallback if Blank | Status | Detailed Issue / Gap Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Papic seat capture (shutter) | `…/papic/seat/[token]/_components/papic-seat-capture.tsx:122` | /api/upload presign → R2 PUT → `recordSeatCapture` → `papic_photos` | "didn't save" toast, button re-enables | Operational | Full chain awaited |
| recordSeatCapture | `app/papic/actions.ts:124` | `papic_photos` insert (claimer RLS) | `{ok:false,error}`, never throws | Operational | Token = auth; Drive copy via `after()` best-effort |
| Papic guest capture | `…/papic/guest/_components/papic-guest-capture.tsx:102` → `app/api/papic/guest-capture/route.ts:75` | R2 + `papic_record_guest_capture` RPC | 409→exhausted, error toast | Operational | Server quota authoritative; pre-check avoids orphan R2 |
| RSVP submit | `app/[slug]/actions.ts:56` | `guests` update + `guest_face_enrollments` + notify | error → silent return; `?saved=1` | Operational | Selfie/enroll/notify best-effort non-fatal |
| RSVP selfie capture | `…/_components/selfie-capture.tsx:132` → `app/api/guest-selfie/route.ts:79` | R2 presign | "Upload failed — retake" | Operational | Object key pinned to session event/guest |
| Plus-one onboarding | `app/[slug]/welcome/actions.ts:35` | `guests` update + `scan_events` insert | `?error=` redirects | Operational | Session-guarded |
| Invite redeem | `app/[slug]/redeem/route.ts:47` | session cookie + `scan_events` insert | `?invite_error=` | Operational | Token validated vs event |
| Seat claim | `app/papic/actions.ts:49` | `papic_claim_seat` RPC (SECURITY DEFINER) | `?state=error/taken/invalid` | Operational | Pre-migration 42883 → soft error |
| Help contact form | `app/help/actions.ts:33` | `help_messages` insert + admin notify | `?error=` on validation/insert | Operational | Topic filter only (no full-text box — matches V1) |
| Slug availability | `app/api/slugs/check/route.ts:16` | reads `events` by slug | typed status union | Operational | Debounced + edge rate limit |
| LED background save | `app/api/led-background/save/route.ts:38` | `led_background_configs` upsert | 401/400/403/500 JSON | Operational | (note: `led_background_renders` is orphaned — see Gap) |
| Profile data export | `app/api/profile/export/route.ts:25` | Promise.all reads | `?? null`/`?? []` each | Operational | RA 10173; documents V1 gaps |
| YouTube/Drive/TikTok OAuth | `app/api/oauth/youtube/callback/route.ts:40` | `oauth_grants` upsert | `?youtube_error=` | Operational | Single-use state row deleted |
| `/api/v1/reviews` POST | `app/api/v1/reviews/route.ts:53` | `vendor_reviews` insert | apiErrorResponse + SELF_REVIEW_BLOCKED | Operational | Foundation route (0033) — no internal client by design |
| **Persona/Veriff webhooks** | `app/api/webhooks/persona/route.ts:50` | **none (Sentry breadcrumb)** | `{ok:true,stubbed:true}` 200 | Missing (intentional) | No DB write / no signature check — documented owner-pending stub |
| **Patiktok process-job** | `app/api/internal/patiktok/process-job/route.ts:112` | `patiktok_jobs` claim; render = `completed-stub` | 401/500 JSON | **Risk (documented)** | Job claim works; actual clip render is `TODO(0017-phase2)` — would "complete" with no output if ever enqueued |

---

## Action List — every non-Operational connection, prioritized

| # | Severity | Feature | File:line | Fix shape |
| :-- | :-- | :--- | :--- | :--- |
| 1 | **HIGH (runtime crash)** · ✅ **Fixed (this PR)** | 3 manpower API queries → missing table `event_software_activations` | `app/api/v1/manpower/sync-device/route.ts`, `…/verify-telemetry/route.ts` | Repointed all 3 `.from()` calls to `event_software_activations_v2` (verified vs prod: old table absent, `_v2` has matching cols + the `UNIQUE(event_id,service_code)` index). |
| 1b | **HIGH (payment activation crash)** · ✅ **Fixed (this PR · migration)** | DB function `verify_and_activate_manual_payment` INSERTs into the absent old table (2 sites) — admin/Maya manual-payment activation transaction fails | `supabase` fn `verify_and_activate_manual_payment` | **Deeper find from DB inspection** (not in original audit). Migration `20260903000000_…` repoints both INSERTs to `_v2`. Verified vs live prod: migration body is **byte-faithful** to the deployed function (only the 2 table names differ); `items_ordered` is `text[]` and there is no `payment_status` CHECK, so the rename is sufficient; the function inserts under service-role (RLS), matching its only caller. ⚠️ **Requires `supabase db push` to take effect** (migration files don't auto-apply on main). |
| 2 | **HIGH (trust / data-loss-of-intent)** · ✅ **Fixed (this PR)** | Onboarding BYO "Add your own vendor" — false success, no persistence | `app/onboarding/wedding/{_components/onboarding-shell.tsx,actions.ts,types.ts}` | `sendByo` now accumulates entries into `OnboardingState.byoVendors` → commit persists them as `event_vendors` `considering` rows (existing schema); toast copy made truthful (no fake "emailed"/"connected"). No new email integration (out of scope). |
| 3 | **HIGH (checkout dead-end)** · ✅ **Fixed (this PR)** | Supplies cart "Checkout via Orders" → retired `/orders/new` (bounces to `/add-ons`, cart lost) | `…/supplies-marketplace/_components/cart-drawer.tsx` | Neutralized into a disabled "Checkout opens soon" affordance (0018 deferred mock — real checkout intentionally not built). |
| 3b | **HIGH (checkout dead-end)** · ✅ **Fixed (this PR)** | Site-editor Pro-upgrade CTA → retired `/orders/new?service=` (bounces to `/add-ons`, SKU dropped) | `app/site-editor/[eventId]/_components/site-editor.tsx` | `monogram_hero_upgrade`/`pro_widget_schedule` have no checkout page (V1.1 deferral) → live `<CardLink>` replaced with an honest "Coming soon" pill (owned-state "Active" badge unchanged). |
| 4 | **MED (vendor monetization blocked)** | No in-app Pro/Enterprise upgrade — nothing writes `vendor_profiles.tier_state` | `lib/vendors.ts:345` (gates: `branches/actions.ts:67`, `payment-options/actions.ts:79`) | Build the tier checkout/upgrade flow; until then Enterprise-only & Pro-only gates can never unlock |
| 5 | **MED (vendor dead-end)** | Buy-token CTA is static — no `/vendor-dashboard/tokens/buy` route | `app/vendor-dashboard/tokens/_components/buy-tokens-cta.tsx` | Build token-pack checkout; only founder grant / admin / voucher mint tokens today |
| 6 | **MED (matching inert)** | Vendor calendar has no block-entry UI — `vendor_calendar_blocks` write-less | *(no route)* | Add calendar block CRUD; double-book/date guards rely on data vendors can't enter |
| 7 | **MED (silent persistence fail)** | Hero-photo update discards `error` | `…/website/hero-photo/actions.ts:90,119` | Capture `const { error }` and redirect `?error=` like sibling editors |
| 8 | **MED (economy bypass risk)** | Manpower token-burn ignores RPC boolean-false return | `app/vendor-dashboard/manpower/actions.ts:147` | Inspect RPC `data`; reconcile against actual `consume_vendor_assets` SQL contract |
| 9 | LOW | Vendor verify approve missing `pending` idempotency guard | `app/admin/verify/actions.ts:400` | Add `.eq('status','pending')` precondition |
| 10 | LOW | Two-admin approval gate stubbed (`approved_by:null`) | `app/admin/users/actions.ts:469`, `pricing/actions.ts:28`, `payments/actions.ts:715` | Enforce four-eyes for >₱10K grants / >₱25K refunds / >₱500 pricing deltas (documented V1.x) |
| 11 | LOW | Appeal reject/escalate re-fires (no `decided_at` guard) | `app/admin/reviews/actions.ts:128,217` | Add `.is('decided_at', null)` |
| 12 | LOW | promoteCategoryRequest TOCTOU | `app/admin/taxonomy/actions.ts:496` | Add `.eq('status','pending')` to the write |
| 13 | LOW | Decline / revoke host-invite ignore update error | `app/host/accept/[token]/actions.ts:108`, `app/dashboard/[eventId]/hosts/actions.ts:163` | Capture + surface the error |
| 14 | LOW | Host-invite signup link uses `email` not `prefill_email` | `app/host/accept/[token]/page.tsx:168` | Rename query param so invitee email pre-fills |
| 15 | INFO | Persona/Veriff webhook stubs; patiktok render stub | `app/api/webhooks/{persona,veriff}/route.ts`, `app/api/internal/patiktok/process-job/route.ts:112` | Intentional placeholders — wire before those features ship |

---

## Gap Analysis — schema ↔ code ↔ endpoints

**Totals:** 151 defined tables · 136 referenced tables (distinct `.from()`) · 60 API routes (+6 views/matviews referenced by code).

### Referenced-but-undefined table (RUNTIME RISK) — ✅ resolved in this PR
- **`event_software_activations`** — **genuinely missing (verified against prod DB: only `event_software_activations_v2` exists; the old name has no table, view, or alias).** Was referenced in 3 manpower routes **and** in the `verify_and_activate_manual_payment` DB function (2 INSERTs) → both threw `relation "public.event_software_activations" does not exist` at runtime. **Fixed here:** app routes repointed to `_v2` (Action #1) + migration `20260903000000_…` repoints the function (Action #1b · needs `supabase db push`).
- The 6 other names that look "undefined" to a `CREATE TABLE` regex are **views/matviews and are fine**: `vendor_market_stats` (view), `vendor_review_stats`, `vendor_full_completed_events_stats`, `vendor_public_completed_events_stats`, `bottleneck_signals_current` (matviews), `vendor_active_ads` (view). No risk.

### Defined-but-unreferenced tables (orphaned schema — built, no UI wired) — 22 total
Mostly *schema ahead of UI* for deferred/retired iterations, not bugs:
- **Retired AI planner ("Today's Focus"/Concierge):** `concierge_plan_templates`, `concierge_response_cache`, `concierge_unanswered_questions`, `couple_briefs`.
- **Deferred Supplies marketplace (0018):** `supplier_vendor_skus`, `supplier_vendor_sku_pricing`, `supplies_orders`, `supplies_order_line_items`.
- **Vendor token-economy ahead of UI:** `vendor_bid_submissions`, `vendor_token_boosters`, `vendor_tool_bundles`.
- **Contract intelligence (0032):** `vendor_contract_signatures`.
- **Other unwired:** `event_delegates`, `event_software_activations_v2` (the *target* of Action #1, currently unused), `founder_time_log`, `households` ("UI lands later"), `led_background_renders` (live route writes `led_background_configs` instead), `platform_availability`, `user_devices`, `vendor_release_history`, `vendor_screen_name_sequences` (likely SQL-function-only), `vendor_verifications` (read via view/RPC).

### Possibly-orphaned API endpoint
- **`/api/v1/reviews`** (`app/api/v1/reviews/route.ts`) — no internal caller; the review UI uses a server action. Documented intentional external/SDK endpoint (0033 foundation), not dead.
- *(Webhooks, OAuth callbacks, health, sitemap, og-image, native-hit endpoints excluded — externally invoked.)*

### UI-without-data
- None cleanly spotted on the read pass. The notable inverse (data-without-UI) is the 22 orphaned tables above. The Supplies cart (Action #3) is the one UI that *looks* data-backed but is mock + dead-checkout.

---

## Top critical blockers — status after this PR

1. ✅ **FIXED — `event_software_activations` missing-table runtime crash.** The table was renamed to `_v2` (`20260628000000_v2_additive_phase_a.sql`) but 3 manpower API queries **and** the `verify_and_activate_manual_payment` DB function were never updated, so manpower device-sync / telemetry-verify and admin/Maya manual-payment activation all hit `relation does not exist`. **This PR repoints the app code + ships migration `20260903000000_…` for the function** (the migration needs `supabase db push` to land in prod).

2. ✅ **FIXED — Onboarding "Add your own vendor" no-op that *told the couple it worked*.** `sendByo` previously showed "✓ {name} connected … emailed {email}" but persisted nothing. **Now** each BYO entry is saved as an `event_vendors` `considering` row at commit and the toast copy is truthful (no fake email/connect claim). No new email integration was added (out of scope).

3. ✅ **FIXED — `/orders/new` checkout dead-ends (two of them).** Both the supplies-cart "Checkout via Orders" `<Link>` and the site-editor Pro-upgrade `<CardLink>` pointed at the retired `/orders/new`, which redirects to `/add-ons` and drops the SKU (cart/purchase intent lost). **Now** both are honest: supplies → disabled "Checkout opens soon"; site-editor → "Coming soon" pill (those Pro-tier SKUs have no checkout page — a V1.1 deferral). Real checkout for the deferred surfaces is intentionally not built.

> **Still open (NOT in this PR's scope — recommended next):** vendor monetization is unreachable in-app — no `tier_state` write path (Action #4) and no buy-token checkout route (Action #5); the vendor calendar has no block-entry UI so anti-double-book matching is inert for real vendors (Action #6); the hero-photo save swallows its DB `error` (Action #7); and the manpower token-burn ignores a possible RPC boolean-false (Action #8). The LOW-severity admin guard gaps (#9–#14) round out the backlog.
