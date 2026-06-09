# Setnayan — Changelog

Append-only log of every meaningful code change. Newest at top. Each entry includes a `SPEC IMPACT` callout (even if "None") so spec-folder edits via Cowork are never missed.

---

## 2026-06-09 · feat(vendor-tier): #4 Phase C gates PR-a — chat FREE-block · editorial tag-gate · custom-slug PRO/ENT

**Context:** #4 (Phase C feature gates) of "do 1–5" on the tier matrix, split into 3 PRs by file-locality. **PR-a = the 3 clean, zero-migration, low-risk gates** verified "sound/ship-it" by the banked design pass (`Vendor_Tier_4_PhaseC_Gates_Spec_2026-06-09.json`).

**What landed:**
- **Chat FREE-block** (`lib/chat-actions.ts`) — FREE vendors can't message couples in-app (`tierCaps(tier).chat === 'none'`; verified/pro/enterprise pass). The DB RPC `unlock_vendor_event` (migration `20260911000000:66-67`) already raises `TIER_FREE_NO_INAPP` on the normal accept path, but **`adminAcceptInquiry` (admin/demo-vendors) sets `inquiry_status='accepted'` via the service-role client without that RPC** — so a claimed demo FREE vendor could otherwise reach the `chat_messages` insert. This pre-insert gate (scoped to `senderRole==='vendor'`, isolated `tier_state` soft-probe) closes that hole. Couples/guests untouched.
- **Editorial tag-gate** (`app/[slug]/_components/editorial/data.ts`) — the recap "Team behind the day" credit roll: `free` stays hidden (already shipped #1128); now **`verified` renders as a plain text credit** (logo + slug suppressed) and only **pro/enterprise get the showcase treatment** (logo + tier badge + profile link), matching the matrix Editorial row (free ✗ / verified ✗ / pro Tagged / ent Tagged). Verified vendors stay credited (the couple used them) — no UX regression to the recap; M1/M2/M3 headline stats still count ALL vendors.
- **Custom-slug PRO/ENT gate** (`vendor-dashboard/actions.ts` + `profile/page.tsx`) — a custom website slug is PRO/ENTERPRISE only (`caps.customWebsiteName`). The existing `tier_state` soft-probe in `saveVendorProfile` now also reads `business_slug` (one query) and **rejects a slug CHANGE for FREE/VERIFIED while never erroring on an unchanged save** (so a downgrade can't block ordinary profile edits). Advisory UI: the slug input is `disabled` + shows a "Pro feature" help line for FREE/VERIFIED. Server guard is the real gate.

**Verify:** `tsc --noEmit` ✓ · `next lint` ✓ (no new findings in touched files). No migration (all read `tier_state`, which exists in prod since `20260714000000`).

**SPEC IMPACT:** #4 PR-a of the tier matrix → corpus `DECISION_LOG.md`. Next PR-b: name-reveal Part A + review display/sort + radius + searchability (flag-dark). PR-c: Enterprise video chat.

## 2026-06-09 · a11y(services): Budget "Build" — proper tab roles on the takeover

**Context:** Review nice-to-have. The takeover's two tab strips (desktop + mobile) were plain `<button>`s with only `aria-current`, so screen readers didn't announce them as a tab set.

**What landed (`services-takeover.tsx`):** both strips now use `role="tablist"`; each tab `role="tab"` + `aria-selected` + `aria-controls="budget-build-panel"` + a stable `id`; the content region is `role="tabpanel"` with `id="budget-build-panel"`, `tabIndex={0}`, and an `aria-label` tracking the active tab. (Buttons are natively keyboard-operable; roving-tabindex arrow-keys remain a small optional enhancement.)

**Verify:** `tsc --noEmit` ✓ · `next build` ✓. Behavior unchanged.

**SPEC IMPACT:** None. Remaining review follow-ups (surfaced): URL/hash-backed tab state, and the owner decision on tightening `budget_builds` RLS to couple-only read/delete + pinning `created_by`. Logged in `DECISION_LOG.md`.

## 2026-06-09 · fix(website): editorial write-up restored + hero un-cropped + shared-photo gallery

**Context:** First real look at the populated editorial surfaced 3 issues. **(1) No write-up:** the entire composed article (kicker/deck/lede/pull-quote) collapsed to the bare catch fallback. Root cause: `love_story.met_year`/`proposal_year` arrive as JSON **numbers**, and `compose.ts`'s `clean()` did `(s ?? '').trim()` — `.trim()` on a number **throws**, and that one exception dropped `composeCopy()` into its minimal fallback (only "A celebration" + headline). Fixed `clean()` to coerce via `String()` (also tolerant of any future non-string storyline field). **(2) Hero cropped:** `HeroPhoto` used a fixed pixel height + `object-cover`, cropping the couple out of the 16:9 hero → switched to `aspect-[16/10]` so the full landscape frame shows. **(3) No shared photos:** added a **"From the Day"** photo gallery to the editorial — `data.ts` now reads `events.our_photos` → `galleryPhotos` (display URLs, same legacy/relative-URL tolerance), rendered as a lead frame + grid.

**Files:** `editorial/compose.ts` (`clean` coercion), `editorial/data.ts` (`galleryPhotos`), `editorial/editorial-content.tsx` (`HeroPhoto` ratio + `PhotoGallery`).

**Verify:** typecheck + build on CI. On `test-maria-and-jose` the editorial now renders the "Sweeping" kicker + composed lede (UP Diliman → Batanes → Tagaytay) + deck + pull-quote, the full hero photo, and the 5 shared photos. No migration; demo data unchanged.

**SPEC IMPACT:** correctness (composer robustness) + §2 editorial "Our Photos" gallery. → DECISION_LOG.
## 2026-06-09 · fix(services): Budget "Build" — adversarial-review fixes (basket clamp + desktop topbar)

**Context:** Post-launch adversarial multi-agent review of the live takeover surfaced **no must-fix blockers** (RLS cross-event isolation holds; no data loss/leak) but **two real should-fix bugs**, fixed here.

1. **Basket inversion under a tight budget** (`build-compare.tsx`): when budget < Σ medians (the common `surplusMode:'park'` case) the engine compresses `amountPhp` (Fits) below the unscaled `rangeLowPhp`, so the Lean column read *higher* than Fits and the over/under labels flipped. **Fix:** clamp per leaf — `lean = min(rangeLow, amount)`, `stretch = max(rangeHigh, amount)` — guaranteeing `lean ≤ fits ≤ stretch` (flows through to the saved-build snapshot too).
2. **Desktop lost the EventSwitcher + notifications** (`services-takeover.tsx`): the `.shell-topbar{display:none}` was global; on desktop the top bar is the only host of multi-event switching + the notifications bell (no sidebar fallback). **Fix:** scope the hide to `@media (max-width:1023px)` — desktop keeps its top bar (the desktop tab strip lives in the content area; the floating X was already `lg:hidden`).

**Verify:** `tsc --noEmit` ✓ · `next lint` ✓ · `next build` ✓. Flag stays default-ON.

**SPEC IMPACT:** None (behavior fixes). Remaining review **nice-to-haves** (surfaced, not yet done): tab a11y roles, URL-backed tab state, and an owner decision on tightening `budget_builds` RLS to couple-only read/delete + pinning `created_by` on the upsert. Logged in `DECISION_LOG.md`.

## 2026-06-09 · feat(vendor-tier): #3 Enterprise time-bound slots — per-service named time windows w/ per-slot allotment (✗/✗/✗/∞)

**Context:** Build #3 of "do 1–5" on the owner's 4-tier capability matrix (`Vendor_Tier_Capability_Matrix_2026-06-07.md`). #2 shipped a flat per-service daily booking capacity (e.g. 2 photobooths → 2 bookings/day). #3 layers **time-of-day on top, ENTERPRISE-ONLY** (owner 2026-06-07: *"venues like hotels can plot timeslot for their different rooms"*): an Enterprise vendor plots **named time windows on a service, each with its own allotted capacity**; couples picking that service choose a window at lock time; each window books independently. Pro stays a flat 3/day (no am/pm); FREE/VERIFIED unchanged. Design adversarially verified by a 3-workflow design pass (banked `Vendor_Tier_3_TimeSlots_Spec_2026-06-09.json`; 5 verifier fixes applied).

**What landed:**
- **Migration `20260928000000_vendor_service_time_slots.sql`** (applied to prod): new `vendor_service_time_slots` (service-scoped: `slot_label`, `window_start`/`window_end` time, `allotment` int, `is_active`) with CHECK constraints (label len, window ordering, :00/:30 granularity), RLS at CREATE (vendor-owner write · admin read · couple read), unique active label per service. `event_vendors.service_time_slot_id UUID NULL REFERENCES … ON DELETE SET NULL` binds a booking to its chosen window. Atomic **`acquire_service_time_slot(p_event_id,p_vendor_id,p_service_id,p_slot_id)` RPC** (SECURITY DEFINER): couple-only auth via `current_couple_event_ids()`, reads `events.event_date` gated on `event_date_precision='day'`, `FOR UPDATE`-locks the slot row, counts the full `CONFIRMED_VENDOR_STATUSES` set, and does the capacity-consuming `UPDATE event_vendors … status='contracted', service_time_slot_id=…` **inside the lock** (closes the TOCTOU). Returns a JSONB envelope (`ok`/`full`/`not_authorized`/`slot_not_found`/`no_date`).
- **`lib/vendor-tier-caps.ts`** — `canPlotTimeSlots(tier)` = `tierCaps(tier).slotsPerDay === Infinity` (Enterprise-only; matrix `slotsTimeBounded` true for Enterprise only).
- **`lib/vendor-time-slots.ts`** (new) — `VendorServiceTimeSlot` type + `fetchVendorTimeSlotsByService` / `fetchSlotsForCoupleBooking`.
- **Vendor services** (`app/vendor-dashboard/services/{actions,page}.ts/tsx`) — `assertCanPlotSlots` gate, `addServiceTimeSlot` (Enterprise-gated), `deleteServiceTimeSlot` (ungated soft-deactivate); a `SlotEditor` sub-editor (list/delete always when slots exist; **ADD Enterprise-only**); the #2 daily-capacity input is disabled when slots exist (slots become the capacity source).
- **`finalizeVendor`** (`app/dashboard/[eventId]/vendors/actions.ts`) — new `slot_required` + `slot_full` result variants; slot path activates when the service has ≥1 active slot **and** `event_date_precision='day'`, else falls back to #2 flat daily-capacity; calls `acquire_service_time_slot` (handles every envelope status); `slotPathLocked` suppresses the vendor-level soft-hold gate **and** the generic lock write so the RPC's atomic write isn't duplicated; **repointed #2's two `wedding_date` reads → `event_date`** (the generated `wedding_date` mirror has no backing DDL — latent no-op; now reads the canonical column).
- **Couple slot-picker** wired into all 3 lock surfaces (`accordion-lock.tsx`, `plan-card-lock.tsx`, `plan-card-compare.tsx`): each calls `listLockTimeSlots`, renders a `<select>` when ≥1 active slot exists, and passes the chosen `service_time_slot_id` into `finalizeVendor`.

**Verify:** `tsc --noEmit` ✓ · `next lint` ✓ (only pre-existing unrelated warnings). Migration applied to prod via statement-by-statement apply (cross-session migration-tracking is out of order); verified post-apply: table + `event_vendors.service_time_slot_id` column + RPC + 3 RLS policies + RLS-on all present; version recorded in `supabase_migrations.schema_migrations`.

**SPEC IMPACT:** #3 of the tier matrix → corpus `DECISION_LOG.md` + `Vendor_Tier_Capability_Matrix_2026-06-07.md` (Slot-per-day row: Enterprise time-bound now ENFORCED). Next: #4 Phase C feature gates · #5 Phase D self-serve subscription checkout.

## 2026-06-09 · feat(admin): onboarding refinements editor (follow-up to items 8/9)

**Context:** The DB-backed refinements landed editable-via-SQL-only; this adds the admin UI so the catalogue is editable without SQL or a deploy.

**What landed:**
- **New `/admin/refinements`** (Platform group, next to Taxonomy): a collapsible card per leaf — edit the leaf (label · description · main photo · retire) + its options (emoji · label · photo · retire · add/remove). `page.tsx` (server, force-dynamic) reads both tables incl. retired rows + resolves photo display URLs; `_components/refinements-editor.tsx` (client, per-unit `<form action={…}>`); `actions.ts` (`updateLeaf`/`updateOption`/`addOption`/`removeOption`).
- **R2-backed photo uploads** — `<FileUpload bucket="samples">` per photo (seeded `/public` photos stay verbatim until replaced; a hidden `*_current` keeps the value when no upload). `lib/onboarding-refinements.ts` `getOnboardingRefinements()` now resolves `r2://` refs → presigned display URLs (gathered in parallel; **no-op when there are no r2 photos**, so the seeded path is unchanged).
- Admin-gated by the `/admin` layout + `requireAdmin()` in every action + RLS `is_admin()` write. Edits `revalidatePath('/onboarding/wedding')` → live immediately.

**Verify:** `tsc` + `next lint` clean; an adversarial review workflow ran over auth/correctness/render-impact. (The admin page needs real admin auth + service-role key → CI-build-verified + owner-verifiable on deploy.)

**SPEC IMPACT:** Completes the V1.x DB-backed-refinements admin surface (item 9 "full"). → corpus `DECISION_LOG.md`.


## 2026-06-09 · feat(website): editorial reviews + "Powered by Setnayan" services strip (+ Maria & Jose scaled to 280pax / ₱5M)

**Context:** Owner asked the demo wedding to (1) reflect commentary/reviews, (2) show the couple availed ALL in-app services, and (3) be a 280-guest / ₱5,000,000 wedding (→ "Sweeping" luxurious archetype). Also confirmed the website maker reads the real `events.event_date` everywhere — **audit found no hardcoded dates / placeholders** (every wedding-date read flows from `event_date`: countdown, schedule, editorial dateline, and the lifecycle-phase computation).

**Code (editorial module):**
- **`data.ts`** — `EditorialData` gains `reviews: Review[]` (read from `event_editorial.draft_json.reviews` — author/role/quote/stars; the full §3 event-bound review system lands later) + `servicesAvailed: string[]` (distinct paid `orders.service_key` for the event → display labels via a `SERVICE_LABELS` map + `prettyServiceKey` fallback). Best-effort, never throws.
- **`editorial-content.tsx`** — "What They Said" now renders a `ReviewsWall` (pull-quote grid w/ stars) when reviews exist (else the empty state); new "Powered by Setnayan" section (`SetnayanExperience` chip row) lists the in-app services availed.

**Seed (prod, idempotent `DO` block · test event):** scaled `[TEST] Maria & Jose` to **280 guests** (234 attending; named entourage + 250 filler), distributed **₱5,000,000** across the 9 `event_vendors.total_cost_php`, froze `event_editorial.impact_metrics` (`per_guest_spend` 17857 → Grand×Luxurious = **Sweeping**; photos 1840; services_total 18; guests 280), seeded **6 reviews** (couple/sponsor/vendor/MOH/guest) into `draft_json.reviews`, and inserted **paid `orders` for all 18 in-app service codes** (Animated Monogram, Papic, Panood, Pakanta, SDE, Patiktok, …) so every SKU-gated element lights up (animated monogram hero draws itself; Papic-guest CTA; etc.).

**Verify:** typecheck + build on CI. Editorial now shows reviews + services strip + Sweeping framing; date-integrity audit clean. Demo data disposable.

**SPEC IMPACT:** editorial reviews surface (interim source) + add-ons-owned strip (§6.4) → DECISION_LOG.

## 2026-06-09 · feat(website): "Maria & Jose" full demo wedding + tier-aware editorial vendor showcase

**Context:** Owner asked to see all three website phases (RSVP / Event / Editorial) on a fully-populated, photo-rich wedding, with vendors at Free / Pro / Enterprise tiers to see how each renders on the editorial. Seeds the existing `[TEST] Maria & Jose` event (slug `test-maria-and-jose`, dated 2026-06-01 so it sits in the Editorial phase) + the code to make the demo render.

**Code (renders the demo; all flag-dark-safe):**
- **`app/[slug]/page.tsx`** — relaxed the `our_photos` resolution to accept ANY non-empty asset ref (was `r2://`-only). `displayUrlForStoredAsset` already presigns `r2://` and passes plain/relative URLs through, so seeded `/demo/...` URLs (and any legacy URL) now render in the gallery — matching how the hero photo already tolerates legacy URLs.
- **`_components/editorial/data.ts`** — the editorial "Team" is now **tier-aware** (`Wedding_Website_Lifecycle_Spec §3`): each `event_vendors` row resolves its `linked_vendor_profile_id` → `vendor_profiles` (`tier_state`, `logo_url`, `business_slug`). **Free vendors are excluded from the editorial entirely** (§3); Pro/Enterprise carry tier + logo + slug. M1/M2 still count ALL event_vendors (tier-independent). Editorial hero now **falls back to `events.landing_page_hero_image_url`** when there's no curated `event_editorial.hero_photo_id`.
- **`_components/editorial/editorial-content.tsx`** — `TeamBehindTheDay` renders Pro/Enterprise as **featured cards** (real logo + a tier badge + a link to `/vendors/[slug]`); other credits render plain. This is the visible Free-vs-Pro-vs-Enterprise difference on the editorial.
- **`public/demo/maria-jose/*.webp`** — 9 AI-generated (Recraft) photorealistic Filipino-wedding photos (hero + 5 gallery + 3 vendor) committed under `public/` so they serve at `/demo/maria-jose/*` (no R2 needed for the demo).

**Seed (prod, idempotent `DO` block — test event only):** rich `love_story` (how-we-met / spark / proposal / 6 milestones / anchors) + `special_message` + `what_to_bring` + `dress_code_config` + `photo_moments_config` + `our_photos` (5) + hero + venue + monogram; 6 public `event_schedule_blocks`; 30 `guests` (24 attending → ~80% RSVP); 9 `event_vendors` (6 #1-match) of which 3 link to new **Free/Pro/Enterprise** `vendor_profiles` (`is_demo=true`, `public_visibility='hidden'` so they stay out of marketplace browse); `event_editorial` snapshot freezing the few non-computable numbers (photos 1240, services_total 18, per_guest_spend 6200 → "Jewel-box" archetype).

**Verify:** typecheck + build on CI. Demo renders on `setnayan.com/test-maria-and-jose` once deployed — RSVP shows hero + countdown + venue + schedule + dress code + photo moments + special message + what-to-bring + Our Photos gallery; Editorial (date is past + `WEBSITE_PHASES_ENABLED` on) shows masthead + composed story + By-the-Numbers + timeline + tiered Team (Enterprise/Pro featured, Free hidden).

**SPEC IMPACT:** implements §3 tier-gated editorial vendor showcase (was a deferred D gap) + editorial hero fallback. → DECISION_LOG. Demo data is disposable.
## 2026-06-09 · feat(services): Budget "Build" — ACTIVATED on production (flag default → ON)

**Context:** Owner: "build it to the website please." After the 6 flag-dark PRs (#1119/#1121/#1125/#1127/#1129/#1132) shipped the full 5-tab Services takeover, this flips it **live** for all couples.

**Change (`lib/budget-build.ts`):** `isBudgetBuildEnabled()` now returns `process.env.BUDGET_BUILD_ENABLED !== 'false'` (was `=== 'true'`). So with no env set, the takeover is **ON in production**. `/dashboard/[eventId]/vendors` is now the full-screen FOCUS MODE takeover: **Summary · Shortlist · Build · Compare · Lock**.

**Kill-switch preserved:** set `BUDGET_BUILD_ENABLED=false` (Vercel env) to instantly fall back to the previous `PlanBudgetAccordion` + global bottom nav — no revert needed. Or revert this commit.

**Verify:** `tsc --noEmit` ✓ · `next build` ✓. The flag-on path is defensive — the new `budget_builds` + availability queries fail-soft, the planner is the same one proven on the Budget tab, and the global nav can't orphan (sub-routes keep it; the takeover provides its own nav + floating X). Post-deploy smoke: load a couple's `/vendors`.

**SPEC IMPACT:** Activates `Budget_Build_Services_Takeover_2026-06-08.md` in production. Pin constraint solver (Phase 3) remains deferred (engine prereqs — see the 2026-06-09 DECISION_LOG row). Logged in `DECISION_LOG.md`.

## 2026-06-09 · feat(admin): command-center Home — all pending queues grouped by lane (nav redesign PR 2)

**Context:** PR 2 of the owner-approved admin nav redesign (`Admin_Console_Nav_Redesign_2026-06-08` · conditional sign-off "for as long as everything is easier to manage"). The shipped Home surfaced only **4 of ~12** action queues. This makes Home the real command center — "what needs admin action right now" — and **satisfies the Money-lane sign-off condition**: the money queues are reunited into an always-visible "Money to reconcile" block (the dissolved Money group's queues), so finance gets a one-stop money view on the landing page.

**What landed (`app/admin/page.tsx`):**
- Action queues expanded **4 → 11**, grouped into 4 lanes mirroring the Work nav: **Trust & supply** (Verify · Taxonomy requests · Payment options) · **Money to reconcile** (Payments · Payouts · Token sales) · **Recourse** (Disputes · Force majeure · Review appeals · Setnayan AI abuse) · **Support** (Help). Each tile is a live `head:true` count linking to its queue with the matching default filter; tone-graded (amber when work pending); total-open summary in the section header.
- Each count query mirrors the exact filter its queue page uses (adversarially cross-checked by a verification workflow against all 11 queue pages + a holistic destructuring-order/regression review).
- **Bug fix (pre-existing, caught by the verification pass):** the *Vendors to verify* count now reads `vendor_verification_applications WHERE status='pending_review'` (the verify page's **default** Applications surface) instead of `vendor_profiles WHERE public_visibility='coming_soon'` (the secondary `?surface=visibility` tab). The old filter — inherited from the prior shipped Home **and** the PR-1 `/admin/work` feed — counted the wrong table, so Home/Work showed a number that didn't match the verify queue an admin lands on. Fixed in **both** `page.tsx` and `work/page.tsx`.
- A missing/renamed table degrades that one tile to "—" (never 500s the page).
- Preserved the 8 platform-stats grid + the 7 shortcut tiles.

**Not surfaced (yet):** two-admin approvals — the `admin_approval_requests` table is unbuilt (V1.x per § 9.1), so there is nothing to count; it lands with the dedicated `/admin/approvals` PR. Platform-alerts + recent-admin-activity feed deferred (no real data source wired — no fake data).

**Verify:** `tsc --noEmit` ✓ · `next lint --dir app/admin` ✓ (1 pre-existing `moodboard-library` warning, untouched) · verification workflow green.

**SPEC IMPACT:** PR 2 of `Admin_Console_Nav_Redesign_2026-06-08.md`. Logged in corpus `DECISION_LOG.md`.
## 2026-06-09 · feat(onboarding): DB-backed refinements + main-photo/4:3-carousel card + 232 generated photos (items 8/9/10)

**Context:** Punch-list items 8 + 9 + 10. (8) every refinement card gets a **main photo on top + a description + a 4:3-landscape option carousel**; (9) the refinements are **DB-backed, not hardcoded**, and only show for **chosen** services; (10) **fill the blank photos**. Owner chose the **full DB-backed taxonomy** option.

**What landed:**
- **De-hardcoded the catalogue** — the ~40-leaf `REFINEMENTS` const is lifted out of `onboarding-shell.tsx` into a data module `app/onboarding/wedding/_data/refinements.ts` (37 leaves · 206 options · per-leaf description + main photo + per-option 4:3 photo). The shell's queue uses `REFINEMENTS_BY_KEY` only to know *which* leaves are refinable (the fixed PICK_GROUPS taxonomy); per-leaf CONTENT renders from data.
- **DB-backed + admin-editable** — migration `20260927000000` adds `onboarding_refinements` + `onboarding_refinement_options` (public-read / admin-write RLS), **seeded from the module** (243 rows, applied to prod). New `lib/onboarding-refinements.ts` `getOnboardingRefinements()` reads **DB-first**, falling back to the module on any error/empty (behaviour-preserving). `page.tsx` fetches it and threads a `refinements` prop into the shell.
- **New card (item 8)** — `RefineStep` rewritten: a 4:3 **hero photo** + the leaf **description** in the viewzone, then a horizontal **4:3 option carousel** (`RefineCard`); each option photo a URL from the data, emoji glyph as the graceful fallback. New `.refine-hero` / `.refine-card` CSS (`aspect-ratio:4/3`). Only chosen services produce a card (already gated by `queueFor`; unchanged).
- **Photos (item 10)** — **232 on-brand 4:3 photos** (37 mains + 195 options) generated via Recraft (a 37-agent workflow, one per leaf, crafting Filipino-wedding editorial prompts), resized/recompressed with `sharp` to ~23 KB avg (5.3 MB total) and committed under `public/onboarding/refinements/`. The 3 projectable leaves (ceremony/catering/photo_video) reuse the existing `/prefs` option photos. **Cost: ~$9 (~₱530)** — the earlier ₱11.5k estimate was wrong (it used the bespoke-monogram multi-gen rate). Generator scripts kept under `scripts/` for reproducibility.

**Verify:** `tsc --noEmit` ✓. Prod tables seeded (37 leaves · 206 options). Browser-verified: the `refine_extras` "What kind of cake?" card renders the cake hero photo + description + a 4:3 carousel of the generated option photos. (Local dev uses the module fallback + the committed photos; prod uses the DB.)

**SPEC IMPACT:** Starts the V1.x **DB-backed expandable-taxonomy** work (owner-chosen) for the onboarding refinements. → corpus `DECISION_LOG.md`. **Follow-up:** an admin editor UI at `/admin/taxonomy` (the data is DB-editable via SQL today; photos are /public assets so photo-swap needs a deploy or an R2 wiring).


## 2026-06-09 · feat(mood-board): seed the Flowers chapter with Recraft floral photos (0010)

**Context:** Follow-up to the mood-board redesign (#1120). The new Flowers chapter shipped with a graceful empty state; this seeds it so couples can recolor real florals.

**Five Recraft-generated, Setnayan-owned photos** (one per subtype — bridal bouquet · bridesmaid bouquet · ceremony arrangement · reception centerpiece · boutonniere), generated as tight studio shots on clean neutral backdrops so each bloom color is distinct from the frame and recolors cleanly. Hosted **in-repo at `apps/web/public/moodboard-seed/florals/*.webp`** (43–113 KB each, optimized + auto-cropped) and served same-origin — no Supabase Storage upload (service-role key unavailable in the build env), and IP-clean vs hot-linked stock.

**Resolver (`page.tsx`):** a leading-`/` `storage_path` is now treated as an app-relative URL (alongside the existing absolute-URL + bucket-key cases), so the Recolor Studio loads the seed images same-origin and `getImageData` never taints the canvas.

**Migration `20260927000000` (apply after deploy):** widens the `source` CHECK to allow `recraft_generated`, then idempotently inserts the 5 `florals` assets + one slot-1 color range each over the dominant bloom color (hex sampled from the actual image, tolerance tuned per bloom — saturated reds/purples wider, pale blush tighter — for clean recolor with minimal background spill). Each tag verified by rendering the engine's own palette-snap recolor and visually confirming the blooms recolor while the background stays clean.

**SPEC IMPACT:** 0010 Mood Board — Flowers chapter is now populated. No spec text change; the DECISION_LOG mood-board row already flagged this seed as a follow-up.
## 2026-06-08 · fix(seating): smooth pan + tables visible in to-scale mode (0008)

**Context:** Two bugs the owner hit once a venue Width×Length was set (to-scale mode), root-caused via a 6-agent adversarial workflow + a faithful render-repro:
- **Dragging/panning the resized plan stuttered and STOPPED.** `onPointerLeave={onCanvasPointerUp}` tore down the active gesture the instant the cursor crossed the canvas edge — pointer capture doesn't suppress `pointerleave`, and for table/marker drags the capture is on the button (not the canvas), so the canvas's own `pointerleave` killed the drag. The taller/zoomed to-scale canvas made the edge reachable in a few px.
- **Tables "not showing on the room."** The scale math was sound (never NaN/0 — tables rendered), but the canvas took the room's *literal* aspect with `w-full`, so a portrait room ballooned to ~1000px tall and tables (laid out down the canvas) sat **below the visible fold**; nothing auto-framed the view, plus a first-paint `canvasW=0` flash rendered tables unscaled for one frame.

**Fixes (`seating-editor.tsx`):**
- Drag/pan: replaced `onPointerLeave` with `onPointerCancel` — gestures now end only on pointer-up/cancel (reliable via capture), so panning flows smoothly off the edges.
- Canvas height: when to-scale, cap the height (a 64vh budget drives the width via `min(100%, calc(64vh · w/l))`, centered) so a portrait room no longer balloons — **all tables fit in one overview**.
- First-paint race: measure `canvasW` in `useLayoutEffect` (isomorphic) and re-run on venue toggle → no unscaled flash, `pxPerMeter` ready before paint.
- Reset to a clean whole-room overview (zoom 1) on venue toggle; `fitView` (the Fit button) now uses the on-screen scaled table sizes so it frames correctly in to-scale mode; puck-mode `tableScale` divides by the puck container (consistent size).

**Verify:** `tsc` ✓ · `next lint` ✓ · `next build` ✓. Repro-rendered the fixed overview (20×30 m room, all 5 tables + stage + entrance visible in a capped canvas). SPEC IMPACT: none (bug fixes to the 0008 to-scale editor). → corpus DECISION_LOG.

## 2026-06-09 · feat(services): Budget "Build" — available dates for your team in the Lock tab (flag-dark)

**Context:** The "available dates" half of Phase 4's spec. The takeover's **Lock** tab now shows the wedding dates the couple's **confirmed team can all do** — the vendor-availability intersection — right where the locked vendors live. Reuses the exact event-home intersection (no new query type, no migration).

**What landed (`vendors/page.tsx`, flag-gated):** when the event date is at year/month precision with ≥1 confirmed vendor, the page resolves `getCommonAvailableDays()` (same helper event Home uses) and renders `VendorAvailabilityIntersection` beneath `BuildLocked` in the Lock slot — the day chips / "N days work" / "no common day → release a vendor" states, each tappable to finalize the date. Fails silent (no panel) on any read error or when precision is already a specific day.

**Reuse, not rebuild:** `lib/vendor-availability.ts` (`getCommonAvailableDays`, `rangeFromPrecision`, `formatDayKey`) + `_components/vendor-availability-intersection.tsx`, both shipped.

**Verify:** `tsc --noEmit` ✓ · `next lint` ✓ (no new warnings) · `next build` ✓. Behind `BUDGET_BUILD_ENABLED` (default OFF).

**SPEC IMPACT:** Completes the available-dates piece of `Budget_Build_Services_Takeover_2026-06-08.md` (over the confirmed team; per-saved-build dates remain a noted follow-on). Only the **Pin constraint solver** (Phase 3) remains. Logged in `DECISION_LOG.md`.

## 2026-06-09 · feat(services): Budget "Build" — save A/B/C builds in Compare (Phase 2b, flag-dark)

**Context:** Phase 2b of `Budget_Build_Services_Takeover_2026-06-08.md`. The Compare tab gains persistence — couples can **save a basket (Lean/Fits/Stretch) into a named slot (A/B/C)** and compare the builds they've banked over time (vary budget/services on Build between saves).

**Migration (`20260926000000_budget_builds.sql`, APPLIED to prod):** new `public.budget_builds` (event_id · label A/B/C · title · budget_php · basket · total_php · snapshot jsonb), UNIQUE(event_id,label) for upsert, **couple-own RLS** mirroring `budget_allocation_decisions`. Additive + idempotent; read/written ONLY behind `BUDGET_BUILD_ENABLED`, so prod is unchanged until the flag flips.

**What landed:**
- `vendors/build-actions.ts` — `saveBudgetBuild` (upsert on `event_id,label`) + `deleteBudgetBuild` server actions.
- `vendors/_components/build-compare.tsx` — now a client component: the 3 baskets (as before) + a **Save [basket] to slot [A/B/C]** control + a **"Your saved builds"** grid (total · basket · budget · over/under · delete), `router.refresh()` after writes.
- `vendors/page.tsx` — flag-gated fetch of `budget_builds` → passes `eventId` + `savedBuilds` into Compare.

**Verify:** `tsc --noEmit` ✓ · `next lint` ✓ (no new warnings) · `next build` ✓. Migration applied cleanly (no drift; remote was in sync through `20260925000000`).

**SPEC IMPACT:** Phase 2b of `Budget_Build_Services_Takeover_2026-06-08.md`. Remaining: available-dates-per-saved-build + the Pin constraint solver (Phase 3). Logged in `DECISION_LOG.md`.

## 2026-06-09 · feat(vendor-tiers): #2 — per-service daily booking capacity (✗/1/3/∞)

**Context:** Build #2 of the "do 1–5" tier queue. "Slot per day" = a vendor declares how many of a service they can serve per day (e.g. 2 photobooths → 2/day); tier caps the max declarable (**FREE 0 · VERIFIED 1 · PRO 3 · ENTERPRISE ∞**).

**What landed (migration `20260925000000`, applied to prod):** `vendor_services.daily_capacity INT` (nullable, `CHECK > 0`, graceful read fallback); `parseDailyCapacityOrThrow` (shared create+update) parses + rejects over the tier's `slotsPerDay`; tier-aware "Bookings per day" input on both forms; `finalizeVendor` blocks a lock once the service has `daily_capacity` confirmed bookings on the wedding's date (per-service same-date count; reuses the `soft_hold_limit_reached` modal; degrades open when unset). Enterprise time-bound slots (#3) layer time-of-day on top later.

**Verify:** `tsc` clean · `next lint` exit 0. Migration applied to prod.

**SPEC IMPACT:** Tier cap #2 enforced. Remaining: #3 enterprise time-bound slots · #4 Phase C · #5 Phase D. → corpus DECISION_LOG.

## 2026-06-09 · refactor(admin): ops-shaped nav re-bucket (PR 1 of N) — verb spine + drift fixes

**Context:** Owner-approved nav redesign (`Admin_Console_Nav_Redesign_2026-06-08.{md,html}` in the spec corpus · DECISION_LOG 2026-06-08, **conditional sign-off** — "for as long as everything is easier to manage"). The admin console was 6 noun-domain groups (Home/Queues/Directory/Money/Insights/Manage). This PR — the cheap, low-risk first slice — re-buckets the nav by **verb** (act / find / tune) and folds in the drift fixes. No new feature pages, no schema, no data changes.

**What landed:**
- `app/admin/_components/admin-sidebar.tsx` — `ADMIN_NAV_GROUPS` re-cut to a 3-item spine (**Home · Work · Directory**) + 3 collapsible tune-groups (**Insights · Money & Catalog · Platform**). **Group keys preserved** (`queues`→"Work", `money`→"Money & Catalog", `funnels`→"Insights", `content`→"Platform") so per-section localStorage open-state survives. The **Money group dissolves**: its queues (Payouts, Token sales) move into Work; its config stays as Money & Catalog. **Drift fixes:** `/admin/notifications` (was an orphan — no nav entry anywhere) gets a home under Platform; Wedding types + Wedding traditions move Directory → Platform (governance + content, not look-up).
- `app/admin/_components/admin-bottom-nav.tsx` — mobile strip re-cut from 5 tabs (Home/Queues/Directory/Money/More) to a **4-tab spine** (Home · Work · Directory · More); `activeMatch` arrays updated; **Token sales added to the Work match** (it lit no tab before — drift fix).
- `app/admin/work/page.tsx` — **new** mobile triage feed: the renamed + expanded successor to the queues feed (adds Payouts + Token sales counts). Reuses `QueuesTriageFeed` (now takes an optional `title` prop).
- `app/admin/queues/page.tsx` → redirect to `/admin/work`; `app/admin/money/page.tsx` → redirect to `/admin/more` (bookmark continuity).
- `app/admin/directory/page.tsx` — drop the two wedding-* cards; `app/admin/more/page.tsx` — now Insights + Money & Catalog + Platform (adds the money-config cards + wedding-* + notifications).

**Not in this PR (committed follow-ups, per the redesign):** the Work master-detail + **Money-lane filter** (the owner sign-off condition — ships *with* the Work view PR so finance keeps a one-stop money view), the full command-center Home, the net-new `/admin/approvals` two-admin queue UI, and the mobile-More 3-section accordion. Desktop sidebar + mobile feed are the high-value, zero-risk slice.

**Verify:** `tsc --noEmit` ✓ (only 2 pre-existing unrelated module errors from the local stale install — `@mediapipe/tasks-vision`, `sharp`; both present in CI's install) · `next lint --dir app/admin` ✓ (1 pre-existing warning in `moodboard-library`, untouched) · swept: no external importers of `ADMIN_NAV_GROUPS`, no code links to `/admin/queues|/admin/money`, no tests reference the admin nav.

**SPEC IMPACT:** Implements PR 1 of `Admin_Console_Nav_Redesign_2026-06-08.md`. The Money-lane filter remains a committed follow-up (sign-off condition). Logged in corpus `DECISION_LOG.md` (2026-06-08 admin-nav rows).
## 2026-06-09 · feat(onboarding): admin-uploaded background music (item 1)

**Context:** Punch-list item 1 — background music for the ~15-min wedding onboarding. Owner's design: an **admin uploader** (not a committed file) so the owner uploads an **owned / AI-generated** track (e.g. Suno); the onboarding streams it. Mirrors the per-event website background-music feature (site-chrome, Increment B).

**What landed:** migration `20260925000000` (`platform_settings.onboarding_bg_music_r2_key` + `_enabled`, applied to prod directly — orphan `20260924000000` mood-board ledger entry blocked `db push`); `fetchOnboardingBgMusicUrl()`; `/admin/settings` "Onboarding background music" uploader (`<FileUpload>` audio ≤40 MB + enable toggle + owned-track-only helper) + `updateOnboardingMusic`; `/api/upload` audio cap 20→40 MB (image cap unchanged); header mute/unmute **pill** (`onboarding-music.tsx`) that streams (`preload="none"`+`loop`), starts on first gesture, low volume, mute remembered in `localStorage`; **unset/disabled → silent**.

**Verify:** `tsc` ✓; prod columns confirmed; pill layout screenshot-verified. End-to-end on deploy once a track is uploaded.

**SPEC IMPACT:** New admin onboarding-music uploader; honors "Setnayan-owned AI-generated catalogue only" via the owned-track helper. → corpus `DECISION_LOG.md` (item-10 Recraft cost also corrected there: ≈₱530, not ₱11.5k).


## 2026-06-09 · feat(services): Budget "Build" — Compare tab (3 baskets, Phase 4 core, flag-dark)

**Context:** Phase 4 (core) of `Budget_Build_Services_Takeover_2026-06-08.md`. The last stub tab becomes real — **all 5 takeover tabs now have content** (Summary · Shortlist · Build · Compare · Lock).

**What landed:**
- `vendors/_components/build-compare.tsx` — the **Compare** tab: the three budget baskets side-by-side — **Lean** (Σ range-low) · **Fits** (Σ median, the suggested plan) · **Stretch** (Σ range-high) — with a per-category breakdown table and each basket's over/under vs the couple's budget. Derived from a **single `computeBudgetAllocation` run** (each leaf already carries `amountPhp` + `rangeLowPhp/HighPhp`), so no extra query and no persistence.
- `vendors/page.tsx` — passes `compareSlot` (reusing the `allocInputs` already resolved for the Build tab).

**Verify:** `tsc --noEmit` ✓ · `next lint` ✓ (no new warnings) · `next build` ✓. Behind `BUDGET_BUILD_ENABLED` (default OFF) → zero production change.

**SPEC IMPACT:** Phase 4 (core) of `Budget_Build_Services_Takeover_2026-06-08.md`. Follow-ons: saving named A/B/C combinations + "available wedding dates per build" (vendor-availability intersection over a build's specific vendors) + the Pin constraint solver (Phase 3) + save-A/B/C migration (Phase 2b). Logged in `DECISION_LOG.md`.

## 2026-06-09 · feat(services): Budget "Build" — Summary + Lock tabs (Phase 5 core, flag-dark)

**Context:** Phase 5 (core) of `Budget_Build_Services_Takeover_2026-06-08.md`. Two of the three remaining stub tabs become real, read-only views derived from the same `PlanBudgetModel` the accordion already builds — no new queries, no migration.

**What landed:**
- `vendors/_components/build-summary.tsx` — the **Summary** cover tab (now the landing tab): a budget meter (chosen vs target, with `budgetStatus` tone), a Locked/Shortlisted/Hours-saved recap, the "what to lock next" list (`dueList`), and the Setnayan AI on/off status with a Manage pointer.
- `vendors/_components/build-locked.tsx` — the **Lock** tab: the consolidated list of finalized picks (filtered on the locked `raw_status` set — contracted/deposit_paid/delivered/complete) across all folders, with the chosen total + an empty state.
- `vendors/page.tsx` — passes `summarySlot` + `lockSlot` into the takeover and lands on **Summary**.

The takeover now has 4 of 5 tabs real (Summary · Shortlist · Build · Lock); **Compare** (Phase 4) + the **Pin** solver / baskets / save-A·B·C (Phases 3 + 2b) remain.

**Verify:** `tsc --noEmit` ✓ · `next lint` ✓ (no new warnings) · `next build` ✓. Behind `BUDGET_BUILD_ENABLED` (default OFF) → zero production change.

**SPEC IMPACT:** Phase 5 (core) of `Budget_Build_Services_Takeover_2026-06-08.md`. Logged in `DECISION_LOG.md`.

## 2026-06-09 · feat(mood-board): couple-facing Recolor Studio + 4-chapter redesign (0010)

**Context:** Owner: "fully redesign the mood board… change the colors of specific parts of a photo like a color range selector. then just alter the hue, contrast, brightness or pick from the palette given… Flower? Attires? Reception? Church?" Coverage = Church · Reception · Attire · Flowers; tool depth = full recolor (both picked via in-session questions). Shipped as **one PR** (the planned 3-PR split was collapsed to dodge a fast-moving `main`; the Recraft Flowers seed + corpus sync follow separately).

**Engine (`apps/web/lib/color-recolor.ts`, new):** color math lifted out of the admin-only Color Range Manipulator into a shared, DOM-free engine. `recolorPixel` has two modes — `palette` (snap to a target, unchanged HSL substitution) and `adjust` (hue shift / saturation / brightness / contrast). Plus `recolorRGBA` (per-pixel best-slot match), `buildMatchMask`, snapshot serialize/parse. Pure + headless-tested (15/15 assertions).

**Recolor Studio (`recolor-studio.tsx`, new):** couples open a curated photo, pick a part (pre-tagged color range or eyedrop), then snap it to a palette color OR adjust H/S/B/C by hand. Live browser Canvas recolor (₱0 marginal cost). Read-only mode re-renders pinned saves.

**4 chapters (`moodboard-chapters.tsx`, new + `page.tsx`):** replaces the 2-pillar "Visual preview" with **Church · Reception · Attire · Flowers**; pinned looks up top; silhouette attire guide kept below. Admin tagger refactored onto the shared engine (preview unchanged). Removed dead `visual-preview.tsx`.

**Persistence + schema:** `event_moodboard_saves.palette_snapshot` now stores a self-describing `{ slot: { def, edit } }` (legacy `{ slot: "#hex" }` still parses). Migration `20260924000000` (applied to prod) widens `moodboard_library_assets.asset_type` + `event_moodboard_saves.pillar` to allow `'florals'`. Additive + idempotent.

**SPEC IMPACT:** 0010 Mood Board — couples can now recolor library photos (was admin-only / view-only) and a Flowers chapter is added. Decision to ratify in `DECISION_LOG.md`: **couple recolor of library photos = FREE / AI Composite Scene generator = stays paid** (per the spec's Professional Mood Board tier). Corpus 0010 AS-BUILT + DECISION_LOG row + Recraft Flowers seed follow.
## 2026-06-09 · feat(services): Budget "Build" — Build tab hosts the allocation planner (Phase 2a, flag-dark)

**Context:** Phase 2 of `Budget_Build_Services_Takeover_2026-06-08.md`. The takeover's **Build** tab (a stub in Phase 1) now renders the real median-anchored allocation planner — the auto-fit plan, per-service ₱ targets + shopping ranges, the Cushion / shortfall readouts, and the peso-pin tilt (Splurge / Standard / Save). Reuses the engine + UI already shipped on the Budget tab — no fork.

**What landed (`vendors/page.tsx`):** when `BUDGET_BUILD_ENABLED` is on, the page resolves `resolveAllocationInputs(supabase, eventId)` and passes a `<BudgetAllocationPlanner>` into the takeover's `buildSlot`. The alloc query is **gated inside the flag check** so it never runs in production while the flag is off. Shortlist still houses today's `PlanBudgetAccordion`; Compare / Summary / Lock remain Phase 3–5 stubs.

**Reuse, not rebuild:** `lib/budget-allocation.ts`, `lib/budget-allocation-data.ts` (`resolveAllocationInputs`), and `budget/_components/budget-allocation-planner.tsx` are all rendered as-is.

**Verify:** `tsc --noEmit` ✓ · `next lint` ✓ (no new warnings) · `next build` ✓. Flag OFF by default → zero production change.

**SPEC IMPACT:** Phase 2a of `Budget_Build_Services_Takeover_2026-06-08.md`. Follow-on Phase 2b: whole-plan baskets (Lean/Fits/Stretch) + save A/B/C (saved-builds migration). Logged in `DECISION_LOG.md`.

## 2026-06-08 · feat(seating): A4 seating PDF — mood-board / blueprint, monogram + QR (0008)

**Context:** Owner-specced export. Completes the seating arc (chair-level → names → mobile list → zoom/pan → markers → venue to-scale → **PDF**). The 0008 spec's "Print pack" — scoped to the owner's brief: A4, two print modes, branded header, floor-plan page + arrangement pages. No migration; reuses existing `pdf-lib` + `qrcode` + `events.slug`.

**What landed:**
- **`lib/seating-pdf.ts`** — `buildSeatingPdf()` draws an **A4** PDF with `pdf-lib`:
  - **Header** (every page): couple **monogram** (text initials in `monogram_color`), **names** (`display_name`), **date**, **Setnayan logo** (fetched `brand/setnayan-mark-512.png`, optional), and a **website QR** (`{appUrl}/{slug}` via `QRCode.toBuffer`, "Scan to visit our website").
  - **Page 1 = floor plan** — drawn **to scale** when a venue size is set (room rectangle at the room's aspect + metric labels; tables at true footprint via `TABLE_FOOTPRINT_M`), else fit-to-page. Round→circle, banquet/head→rectangle; stage + entrance markers; table number, label, fill.
  - **Pages 2+ = seating arrangements** — per-table header (fill · type) + numbered guest list with roles, two-column, auto-paginated.
  - **Two modes:** **mood-board** (floor + tables coloured from the couple's `event_moodboard_saves.palette_snapshot`) or **blueprint** (clean blue line-art). Page footer with couple name + page number.
- **`/dashboard/[eventId]/seating/export` route** (Node runtime) — auth + RLS-scoped fetch of event/tables/assignments/guests/floor-plan/palette, builds the PDF, returns it as a download (`?mode=moodboard|blueprint`).
- **Editor:** an **Export PDF ▾** toolbar menu (Mood-board colours / Blueprint).

**Verify:** `tsc` ✓ · `next lint` ✓ · `next build` ✓ (export route compiles). **Both modes + the floor-plan and arrangement pages were rendered from the actual generated PDF and visually inspected** (16×22 m to-scale room, palette-coloured tables, monogram+date+QR header, per-table guest lists).

**SPEC IMPACT:** builds the 0008 spec's print/PDF export (single-website-QR variant per owner; per-table-sign / per-guest place-card sheets remain deferred). Completes the seating floor-plan arc. → corpus DECISION_LOG.

## 2026-06-08 · feat(services): Budget "Build" — Services 5-tab takeover shell (Phase 1, flag-dark)

**Context:** Owner design session (→ `Budget_Build_Services_Takeover_2026-06-08.md`): the couple's Services tab becomes a full-screen FOCUS MODE takeover (Summary · Shortlist · Build · Compare · Lock) that turns budget + pax + date + location into a complete, affordable, bookable plan. This PR lands **Phase 1 — the takeover shell only** — behind a flag, so production is unchanged.

**Flag:** `BUDGET_BUILD_ENABLED` (env, default OFF — same posture as `WEBSITE_PHASES_ENABLED` / the Setnayan AI paywall). While OFF, `/vendors` renders exactly as today.

**What landed:**
- `lib/budget-build.ts` — `isBudgetBuildEnabled()` + the `BUDGET_BUILD_TABS` constant.
- `vendors/_components/services-takeover.tsx` — the focus-mode shell: hides the global top bar (`.shell-topbar{display:none}`), a fixed floating X (mobile) → event Home, a desktop tab strip + a mobile fixed 5-tab section bottom nav. Phase 1: Shortlist renders today's `PlanBudgetAccordion`; the other tabs are stubs Phases 2–5 fill.
- `customer-bottom-nav.tsx` — when `budgetBuild`, suppress the global bottom nav on the exact `/vendors` route (mirrors the Guests treatment); sub-routes keep it.
- `layout.tsx` — passes `budgetBuild={isBudgetBuildEnabled()}` to `CustomerBottomNav`.
- `vendors/page.tsx` — when the flag is on, wraps the existing Services content in `ServicesTakeover` (Shortlist slot); otherwise renders exactly as before.

**Verify:** `tsc --noEmit` ✓ · `next lint` ✓ (no new warnings) · `next build` ✓. Flag OFF by default → zero production change.

**SPEC IMPACT:** Implements Phase 1 of `Budget_Build_Services_Takeover_2026-06-08.md` (corpus); logged in `DECISION_LOG.md` (2026-06-08 🧮 row). Transitional vs `Vendors_Plan_Budget_Tab_Spec_2026-05-31.md` (full migration across Phases 2–5).

## 2026-06-08 · fix(website): lifecycle phase — past weddings now resolve to Editorial, not RSVP

**Context:** With `WEBSITE_PHASES_ENABLED` on, a wedding **a week in the past** still rendered the **RSVP invitation** instead of the Editorial recap (verified on the `test-maria-and-jose` event dated June 1). Root cause in `getLifecyclePhase` (Increment C): it delegated to `getDayOfPhase`, whose `post` window is only **T+8h..T+24h** — beyond 24h after the wedding it returns `inactive`. But `inactive` is the catch-all for **both** ">3 days before" **and** ">24h after", and the engine mapped `inactive → rsvp`. So any wedding more than a day old fell back to the invitation.

**Fix:** `getLifecyclePhase` now disambiguates the `inactive` case by comparing the event date to now — **past → 'editorial'**, future → 'rsvp' (`pre`→rsvp, `live`→event, `post`→editorial unchanged). The near-event windows are still handled by `getDayOfPhase`, so the new date compare only fires for the far-from-event cases where it's unambiguous. No migration; still entirely behind the (default-off) flag.

**Verify:** typecheck + build on CI. `test-maria-and-jose` (event_date 2026-06-01) now computes `editorial`; a future-dated event stays `rsvp`. **Requires the flag ON + a redeploy to see live** — this bug would have shown RSVP even with the flag on, so it's a prerequisite for the Editorial phase to ever appear.

**SPEC IMPACT:** correctness fix to the §1 phase model (Increment C). → DECISION_LOG.
## 2026-06-08 · feat(seating): venue dimensions + to-scale tables (0008)

**Context:** Owner: "set the length and width dimension of the venue… keep the tables in their right size." Tables previously rendered at a fixed on-screen size unrelated to real metres. Now the couple can enter the room's W×L and the floor plan renders **to scale** so it's obvious what fits. (Next, PR D: the A4 seating PDF — mood-board/blueprint modes, monogram + names + date + Setnayan logo + QR, floor plan page + arrangement pages.)

**Schema (`20260923000000_iteration_0008_venue_dimensions.sql`, applied to prod):** `event_floor_plan` gains nullable `venue_width_m` + `venue_length_m` (NULL = no room size → free-form canvas). Additive + idempotent.

**What landed:**
- **Room-size control** — a "Room size" toolbar button opens a panel (Show-to-scale toggle + Width/Length in metres). Persists via the existing `saveFloorPlan` (extended).
- **To-scale rendering** — when set, the canvas takes the room's aspect ratio, draws the **walls + metric labels**, and each table renders at its **true footprint** (`TABLE_FOOTPRINT_M` per type — round 8/10/12 ≈ 2.5/2.8/3.1 m incl. chairs, banquet/head by length, etc.) via a per-table `scale()` derived from a ResizeObserver-measured `pxPerMeter`. Composes with the zoom/pan + LOD already shipped (zoom in to seat; Fit to see the whole room). No venue size → unchanged appearance (scale = 1).
- `lib/seating.ts`: `FloorPlanRow` + `fetchFloorPlan` extended; `TABLE_FOOTPRINT_M` map.

**Verify:** `tsc` ✓ · `next lint` ✓ · `next build` ✓ (route 18.2 kB); columns confirmed on prod; to-scale room (16×22 m, 10 tables) verified via a headless render.

**SPEC IMPACT:** builds the 0008 spec's `venue_known` / `venue_width_m` / `venue_length_m` to-scale mode (free placement; hard wall-collision deferred). → corpus DECISION_LOG.

## 2026-06-08 · fix(onboarding): flow reorder + monogram gate + love-story split + pax/budget defaults + Top-100 songs

**Context:** Owner walked the live wedding onboarding (`/onboarding/wedding`) end-to-end (~15 min) and filed an 11-item punch list. This PR lands the structural + clarity items (Phases A–C of the plan); the heavier DB-backed-refinements, photo-generation, and background-music items follow in later PRs.

**What landed (`app/onboarding/wedding/*`):**
- **Date before the love story (item 4)** — `FLOW_IDS` now orders `name → date → love stage → region → pax → budget`. `loveSkip` ("Add it later") advances to `region` (the screen after the love stage). So the love-story timeline can anchor to the real wedding year.
- **Love story = one story per page (items 2 + 4.1)** — the old `love_met` (Spark **and** Almost on one page) is split into **`love_spark`** ("How you two met") + **`love_almost`** ("The almost"), each with a clear `<h1>` + sub. `love_proposal` gains a "The proposal" title; all love eyebrows renumbered "Your love story · N of 4 · …". Every `ScreenId` map + the `goToId('love_met')` "Change a line" link updated.
- **Timeline year follows the wedding date; shows both until finalized (item 4.2)** — new `weddingYearLabel` (distinct years across `dateCandidates`/window) threaded through `WeaveContext` → the timeline's "We do" row + the reveal dateline render **"2026 / 2027"** while candidate dates straddle a year boundary, collapsing once narrowed. (`weave-story.ts`.)
- **Monogram finalize gate (item 3)** — new `monogramFinalized` state; the name screen's Continue is blocked until the couple taps **"Use this monogram"** (→ "✓ Monogram set" + "Change design"). "Generate another design" + editing a first name clear it; the 30s auto-restyle freezes once locked.
- **Guests start at 200 (item 6)** — `EMPTY_ONBOARDING_STATE.pax = 200`.
- **Budget starts halfway (item 7)** — entering the budget screen unset seeds the slider to the **midpoint** of the pax-derived `[floor, ceiling]`.
- **Songs: Top-100 recommended + pinned search (item 5)** — `song-bank-step.tsx` default view restored to the curated **Top-100** (`fetchSongBankCuratedAction`), every row playable, picks pinned in; `SongPreviewList` gains `alwaysShowAll`. Search bar stays pinned. **⚠ Reverses the 2026-06-05 "search-only / songlist must not show" lock** (owner re-reversed 2026-06-08).

**Verify:** `tsc --noEmit` ✓. Browser-verified (dev server, seeded drafts): date at step-after-name ✓ · love_spark/love_almost distinct titled pages ✓ · "We do" row = "2026 / 2027" for two-year candidates ✓ · Continue disabled on name until "Use this monogram" → enables ✓ · pax = 200 ✓ · budget opens at ₱1,950,000 (midpoint of 300k–3.6M) ✓ · songs recommended-list path + pinned search bar on-screen ✓ (Top-100 data + playback confirm on the Vercel preview).

**SPEC IMPACT:** Reverses the **2026-06-05 search-only song lock** (item 5). Onboarding flow reorder + love-story-page split + monogram finalize gate + pax/budget defaults. → corpus `DECISION_LOG.md` (logged).

## 2026-06-08 · feat(website): Increments C + D — lifecycle phase engine + Editorial recap page (FLAG-DARK)

**Context:** The two interdependent centerpiece pieces of the wedding-website lifecycle (`Wedding_Website_Lifecycle_Spec_2026-06-07.md` §1–2, §6.3–6.8), built **in parallel** (two isolated-worktree agents) and integrated here. **C** = the date engine that auto-switches the site through RSVP → Event → Editorial phases and gates widgets per phase. **D** = the post-wedding "newspaper front page" content that the Editorial phase renders. **Entirely behind `WEBSITE_PHASES_ENABLED` (env, default OFF)** — live sites are byte-for-byte unchanged until the flag flips, which also lets the owner preview on a real event before going live. **No migration** (uses existing columns/tables from the `20260912000000` foundation).

**C — Date engine (`lib/invitation-widgets.ts` + `app/[slug]/page.tsx`):**
- `LifecyclePhase = 'rsvp'|'event'|'editorial'`; `getLifecyclePhase(eventDate)` reuses the shipped `getDayOfPhase` (`pre`/`inactive`→rsvp · `live`→event · `post`→editorial); `WIDGET_PHASES` = the exact §2 element×phase matrix (compile-time-exhaustive `Record<WidgetType, …>`); `widgetInPhase()` (fail-open); `isWebsitePhasesEnabled()` flag.
- In the renderer: compute `phasesEnabled` + `lifecyclePhase`, thread into `PublicLanding` + `InvitationSite`. When ON, gate the always-on fixed widgets + the hideable-widget lists by `widgetInPhase`; in the editorial phase, suppress the RSVP hero (the editorial masthead becomes the hero) and render the editorial. **Every new behavior is `!phasesEnabled || …` guarded** → flag-off path identical to today.

**D — Editorial module (`app/[slug]/_components/editorial/{editorial-content,data,compose}.ts(x)`):**
- `EditorialContent({ eventId })` — async server component, **never throws** (best-effort data layer, every section degrades). Reads `events` (names/date/venue/monogram/`love_story` JSONB/`special_message`/`together_since`/`story_tone`), `event_editorial` (frozen `impact_metrics`/`draft_json`/`hero_photo_id` preferred when present), `guests` (counts), `event_vendors` (count + `selection_match_rank=1` first-pick rate), `papic_photos` (delivered count + hero via `displayUrlForStoredAsset`).
- Newspaper layout: masthead (monogram nameplate) · headline/dateline · deterministic **template-composed** lede (NO LLM in v1; prefers `draft_json` if a later LLM pass fills it) · By-the-Numbers (M1 services-with-Setnayan · M2 #1-match rate · M3 time-saved estimate w/ a tunable, commented formula) · milestones timeline · "From the couple" pull-quote · graceful reviews/cross-phase placeholders. **Identity archetype** (§6.8: Hand-picked / Jewel-box / Big-hearted / Sweeping) from guest-count × spend sets the ANGLE, always-flattering; thresholds are tunable constants.

**Integration:** C renders `<EditorialContent eventId={…} />` in the editorial phase of both render paths; C's hero is suppressed there to avoid a double monogram.

**Verify:** typecheck + production build on CI (neither agent nor I can build locally — no node_modules in the worktrees). Both agents' data assumptions independently re-verified against prod (admin-client path, `papic_photos.r2_object_key/hidden_at`, `event_vendors.selection_match_rank`). Flag OFF by default → zero live change.

**Known v1 gaps (deferred, flagged):** M1 "X of Y" denominator (live catalog leaf-count) — renders bare count until `impact_metrics.services_total` is frozen; archetype spend-axis neutral until budget/`per_guest_spend` is wired; reviews = empty state (review system §3 not built); LLM auto-composition (v1 is deterministic template); photo-essay grid (only hero photo resolved); the editorial currently renders within the `max-w-3xl` invitation shell (full-bleed newspaper width is a flag-flip-time refinement); cross-phase links are styled stubs. The post-event interview + T+3 launch gating (§6.5) is a further migration/increment.

**⚠ Also fixes a 3rd duplicate-timestamp on main (flagged for owner):** two parallel PRs each merged a migration named `20260922000000` (`iteration_0008_event_floor_plan` + `vendor_services_multi_per_leaf`), so the CI migration-timestamp guard (whole-dir scan) was failing on `main` again — blocking every migration-bearing PR. Renamed the vendor one → `20260922000001` (both are fully idempotent — `CREATE TABLE/INDEX IF NOT EXISTS`, `DROP CONSTRAINT/POLICY IF EXISTS`, `ADD COLUMN IF NOT EXISTS` — so re-applying the renamed one via `db push` is a no-op; `event_floor_plan` keeps `20260922000000`, which is the version recorded in prod). **This is the THIRD such collision today (after `20260916000000` + the `20260917000000` near-miss); the recurring root cause is parallel sessions branching off the same main and picking the same next timestamp — a process fix (timestamp coordination / a wider-granularity scheme) is warranted.**

**SPEC IMPACT:** §1–2 phase model + §6.3–6.8 editorial — engine + recap page shipped flag-dark. → DECISION_LOG.

## 2026-06-08 · feat(seating): floor-plan markers — draggable Stage + Entrance door (0008)

**Context:** Owner: "we also want to set the entrance door." Completes the floor-plan work (after the growable canvas, #1110). The stage was a fixed banner and auto-seat anchored at a hard-coded top-centre point; now both the **stage** and a single **entrance door** are placeable + persisted.

**Schema (`20260922000000_iteration_0008_event_floor_plan.sql`, applied to prod):** new singleton `event_floor_plan(event_id PK, stage_x/y, entrance_enabled, entrance_x/y, updated_at)` — coords are canvas percent, like `event_tables`. Pattern B RLS (couple read+write). Applied directly to prod (idempotent `CREATE TABLE IF NOT EXISTS`) because the migration history is out-of-order; the file still ships for fresh DBs.

**What landed:**
- **Draggable Stage** — replaces the fixed banner; drag it anywhere on the (zoom/pan-aware) canvas. **Auto-seat now anchors its role-tier rings on the placed stage** (`computeAutoSeat` takes a `stage` arg; `autoSeatGuests` reads `fetchFloorPlan`).
- **Entrance door** — owner-locked **one** entrance: an "Add entrance" toolbar button drops a draggable `🚪 Entrance` marker (default bottom-centre) with an × to remove it.
- Both fold into the existing **Save layout** flow (`saveFloorPlan` upsert; the marker drags mark the layout dirty alongside table moves). Drag handling generalised to `kind: table | stage | entrance`.
- `lib/seating.ts`: `FloorPlanRow` + `DEFAULT_FLOOR_PLAN` + graceful-degrading `fetchFloorPlan`.

**Verify:** `tsc` ✓ · `next lint` ✓ · `next build` ✓ (route 17.3 kB); table + RLS confirmed on prod; stage + entrance markers verified via a headless render.

**SPEC IMPACT:** builds the 0008 spec's `event_floor_plan` (stage + door) — single-entrance variant per owner ("just 1"), not the spec's multi-door JSONB. Completes the seating floor-plan upgrade arc (chair-level → names → mobile list → zoom/pan → markers). → corpus DECISION_LOG.

## 2026-06-08 · feat(vendor-tiers): #1 — multiple service listings per leaf category (cap 2/2/5/∞)

**Context:** Owner clarified the "Creating Package" matrix row = **number of service listings a vendor may place per leaf category** (FREE 2 · VERIFIED 2 · PRO 5 · ENTERPRISE ∞) — e.g. 5 photo-booth variants. Today `vendor_services` was hard-capped at 1 per category by a DB UNIQUE. Build #1 of the owner's "do 1–5" queue.

**What landed (migration `20260922000000`, applied to prod):**
- **Migration:** dropped `vendor_services` `UNIQUE(vendor_profile_id, category)`, added a per-listing **`title`** column (so multiple listings in one leaf are distinguishable — rows were category-labelled only), and a replacement non-unique index on `(vendor_profile_id, category)`. Verified no runtime `ON CONFLICT` depended on the UNIQUE.
- **Helper:** `packagesPerLeaf` → **`servicesPerLeaf`** in `lib/vendor-tier-caps.ts` (clearer; same 2/2/5/∞ values).
- **`createVendorService`:** parses `title`; enforces the per-leaf count cap (single tier+existing-rows fetch now shared with the Phase-B parent-category cap).
- **Services page UI:** the category picker no longer blocks a used category — it stays clickable with an "N added" count (the action enforces the cap); the create form gains a "Service name (optional)" input; rows render `title` (with the category as a subtitle); the `?add=` form opens for used categories too.
- **`lib/budget.ts` fix:** the `(profile:category)→service` map kept only the last row per category (silent collapse with multiple listings) → now keeps the **cheapest** priced one (deterministic "from" price, matching the marketplace min-price reducer). `fetchVendorServices` returns `title` (graceful fallback when the column lags a deploy).

**Verify:** `tsc` clean · `next lint` exit 0. Migration applied (+ a parallel session's pending `20260920_last_minute_mechanic` flushed alongside via `--include-all`).

**SPEC IMPACT:** Tier cap #1 (services per leaf) enforced. Queue remaining: #2 daily capacity · #3 enterprise time-bound slots · #4 Phase C feature gates · #5 Phase D checkout. → corpus DECISION_LOG.

## 2026-06-08 · feat(seating): growable floor plan — zoom + pan + level-of-detail (0008)

**Context:** Follow-up to the mobile list (PR #1108). For big guest counts the *spatial* floor plan must also scale — a fixed canvas can't show 50 tables. Adds pan/zoom with level-of-detail so the plan grows to fit. PR 2 of 2 for "scale to 50+"; **PR 3 next = floor-plan markers (draggable Stage + Entrance door)**, which needs a small `event_floor_plan` migration.

**What landed (`_components/seating-editor.tsx`):**
- **Zoom + pan canvas** — scroll/trackpad **wheel zoom** (toward cursor, non-passive listener), **pinch-zoom** + **drag-to-pan** (pointer-tracked: 1 pointer pans, 2 pinch), and a **+/- / Fit** control cluster (Fit frames every table). The world transform is written straight to the DOM via refs, so panning a 50-table plan doesn't re-render every table per frame.
- **Level-of-detail** — below ~0.72 zoom each table collapses to a compact **puck** (number + `seated/cap`, group-colour halo, green when full); zoom in and the chairs + names reappear. `detail` is the only React state in the hot path (flips at the threshold), keeping it smooth.
- Table-drag math is now zoom/pan-aware (screen px → world %); `touch-action:none` so gestures don't scroll the page.

**Verify:** `tsc` ✓ · `next lint` ✓ · `next build` ✓ (route 16.7 kB). Zoomed-out puck LOD verified via a 28-table headless render; live pinch/pan to confirm on the Vercel preview / device.

**SPEC IMPACT:** builds the 0008 spec's auto-growing canvas. Next → PR 3: draggable Stage + Entrance door (`event_floor_plan`); auto-seat will anchor rings to the placed stage. → corpus DECISION_LOG.

## 2026-06-08 · feat(seating): mobile table-card list + Floor-plan/List toggle (0008)

**Context:** The chair-level spatial canvas can't hold many tables on a phone — each chair-level table is ~220px across, so only ~2-3 fit on a ~340px-wide canvas. A 50-table wedding was unusable on mobile. The 0008 spec already anticipated this ("the spatial drag-drop editor is intentionally desktop-only; mobile is for review + quick edits via a card list"); we'd shipped the canvas everywhere. This is PR 1 of 2 for "scale to 50+ tables" (PR 2 = canvas zoom/pan + level-of-detail).

**What landed (`_components/seating-editor.tsx`):**
- **Table-card list view** — a vertical, scrollable list of table cards (group-colour dot · name · type · `seated/cap` chip · delete), each with a row of seated-guest avatars and, when a guest is picked, a **Seat here** button (seats them in the table's next free chair). Tap a card to expand → per-guest **Unseat** + open-seat count. Tap a seated avatar to pick them up and move. Scrolls to any number of tables — 50 just keep scrolling.
- **Floor plan / List toggle** in the toolbar; **small screens default to List** (`matchMedia(max-width:1023px)` on mount), desktop defaults to Floor plan. Both views available on both platforms; reuses the same pick-then-place + group-colour model as the canvas. Save-layout button is plan-only. Sidebar height trimmed on mobile so both the people panel and the list are reachable.

**Verify:** `tsc` ✓ · `next lint` ✓ · `next build` ✓ (route `/dashboard/[eventId]/seating` 15.4 kB). Mobile list verified via a 375px headless render of the seeded demo wedding.

**SPEC IMPACT:** Builds the 0008 spec's intended **mobile review/edit surface** (card list). Still deferred → PR 2: canvas pinch/scroll **zoom + pan** with level-of-detail (compact pucks when zoomed out, chairs when zoomed in) so the *spatial* view also scales to 50+ on both platforms. → corpus DECISION_LOG.

## 2026-06-08 · feat(website): Increment B — Music & Video hero chrome (LIVE)

**Context:** Site-chrome layer of the wedding-website lifecycle (`Wedding_Website_Lifecycle_Spec_2026-06-07.md` §6.2), after the A.1/A.3/A.4 content blocks. Two presentation features on the **foundation columns already shipped** (`20260912000000`): a looping **background song** + a **video hero** behind the monogram. **No migration** — purely additive code on existing columns.

**What landed:**
- **`/api/upload` (shared route) — scoped widening:** added audio (`audio/mpeg|mp4|aac|ogg|wav|webm`) + video (`video/mp4|webm|quicktime`) to `ALLOWED_MIME_TYPES`, and a **per-MIME-prefix size override** (`TYPE_MAX_BYTES`: video 60 MB · audio 20 MB) that takes precedence over the per-bucket cap — so the **image cap stays 10 MB** while chrome uploads fit. Additive; existing image/PDF flows byte-identical. (This is the shared-route change flagged earlier; owner approved via "do everything in sequence.")
- **`app/[slug]/_components/background-music.tsx` (NEW client component):** a looping `<audio preload="none">` + a **fixed, always-visible "Play/Pause music" control**. Per §6.2 it **never autoplays** (browser policy + UX) — the guest taps to start, taps to pause; pauses on unmount. *(Gapless-via-Web-Audio is a noted deferral; `loop` ships the feature accessibly today.)*
- **`app/[slug]/page.tsx`:** SELECT + `EventRow` gain `landing_page_hero_video_r2_key` / `site_bg_music_enabled` / `site_bg_music_r2_key`; resolve `heroVideoUrl` + `bgMusicUrl` (music only when enabled AND a track is set) in the async body and thread parallel to `heroPhotoUrl` into both render paths. New `HeroBackgroundMedia` helper renders a muted/looped/inline `<video>` (photo as poster) when a video exists, else the still `<img>` — both hero blocks now gate on `hasHeroMedia`. `<BackgroundMusic>` mounts in both paths when a track is live.
- **New editor** `/dashboard/[eventId]/website/site-chrome/{page.tsx,actions.ts}` — two single-file `<FileUpload>`s (song ≤20 MB, video ≤60 MB) + an "enable music" checkbox; `updateSiteChrome` writes the 4 columns, coerces music **off when no track**, sets `source='upload'`. Host-membership gated (mirrors hero-photo). Linked from `site-editor.tsx` via a new "Music & video hero" card.

**Verify:** typecheck + production build on CI. `jsx-a11y/media-has-caption` suppressed on the decorative `<video>` + opt-in `<audio>`. No migration → nothing to apply post-merge. Music is off-by-default (`site_bg_music_enabled` defaults FALSE) + tap-to-play + always-mutable → UX-safe.

**SPEC IMPACT:** §6.2 presentation features (looping bg music + scrub-video hero) shipped. → DECISION_LOG.
## 2026-06-08 · feat(setnayan-ai): dependency-awareness engine (build PR-5)

**Context:** PR-5 of the Setnayan AI build. Implements §4B of `What_Is_Setnayan_AI_2026-06-08.md` (edge set LOCKED 2026-06-08) — the planning-cascade sequencer that tells a couple "finalize X first, then your Y matches better." No migration (reuses existing signals). Always SOFT — a nudge, never a hard block.

**What landed:**
- **`lib/dependency-graph.ts`** (NEW · pure) — the locked §4B.2 edge set as DATA: `DEPENDS_ON` (one-way prerequisites per plan-group, with `H`/`s` prominence), `MUTUAL_PAIRS` (ceremony↔reception, attire↔mood_board — recorded, never nudged since either order is valid), and `resolveDependency(groupId, satisfiedNodes, finalized)` → `blocked` (loudest unmet prereq) / `ready` / null. 14 logic checks via `tsx` (all green).
- **`vendors-plan-budget.ts`** — `buildPlanBudgetModel` builds a **satisfied-node set** (finalized vendor categories from the model itself + `wedding_date` + `mood_board`; the guest/seating decision nodes FAIL OPEN — added as satisfied — since this surface doesn't load them, so they never mis-nudge) and attaches `AccordionChild.dependency`, surfaced only when **Setnayan AI is on** AND the category is in its action window (`start_now`/`due_soon`/`overdue`) — quiet while too early or done, so it never blankets every category.
- **`plan-budget-accordion.tsx`** — a `DependencyNudge` row under each category header: "⏳ Lock your **reception venue** first — your Catering matches better once it's set" (H) / "↪ Tip: lock your **mood board** first…" (s) / "✓ Ready — … Time to book your Catering." Soft styling, opportunity tone.
- **`vendors/page.tsx`** — selects `events.mood_board_updated_at`, passes `moodBoardSet`.

**Dormant-safe:** AI-off (Manual) → no dependency nudges (existing free-floor behavior unchanged). Nudges only appear once a couple is actively in a category's window with Setnayan AI on.

**Deferred (follow-up):** real detection for the fail-open decision nodes (sponsors_confirmed / invitations_sent / rsvp_headcount / seating_chart — they live on the guest-list/seating surfaces) + dependency-aware *reminders* in `upcoming-items.ts` (this PR surfaces the nudge on the plan surface; the reminder stream is a separate slice).

**Verify:** `tsc` clean · `next lint` clean · `next build` ✓ (`/dashboard/[eventId]/vendors` builds) · 14/14 resolver checks.

**SPEC IMPACT:** Implements §4B. DECISION_LOG row + build-state flip (§4B 📋→🟡).

## 2026-06-08 · chore(migrations): dedup timestamp collision (20260917000000)

A concurrent PR (`setnayan_ai_entitlement`) landed the same migration timestamp
`20260917000000` as my `rsvp_consolidation_event_website_price`, failing the CI
"migration timestamp guard" (duplicate check). Renamed mine →
`20260921000000_rsvp_consolidation_event_website_price.sql` (above the max; the
setnayan_ai file keeps 20260917 since it owns the schema_migrations record).
Effects were already applied + the new version recorded. No DB change.

**SPEC IMPACT:** None.


## 2026-06-08 · fix(pricing): customer catalog reader now honors `is_active` (retirements had NO live effect)

**Context:** Found by verifying the live site (owner asked "on www.setnayan.com?"). The retired SKUs (Indoor Blueprint, High Res Archive, Call-Time Escalator, Pakulay, RSVP) were STILL showing on `/pricing` despite being `is_active=false` in the DB. Root cause: **`fetchV2CustomerCatalog` (`lib/v2-catalog.ts`) never filtered `is_active`** — it only excluded `TODAYS_FOCUS` by name. So the entire `is_active` retirement mechanism was inert for the customer catalog; admin "retire" did nothing on the live surfaces.

**What landed (`lib/v2-catalog.ts`):**
- Added **`.eq('is_active', true)`** to `fetchV2CustomerCatalog`. Now the 6 inactive customer SKUs (CALL_TIME_ESCALATOR · HIGH_RES_ARCHIVE · INDOOR_BLUEPRINT · PAKULAY · RSVP_WEBSITE · TODAYS_FOCUS) drop from `/pricing`, `/for-vendors`, the admin discount picker, AND the onboarding bundle worth; the 19 active SKUs remain. The `.neq('TODAYS_FOCUS')` is kept as belt-and-suspenders.

**Verified:** the filter hides exactly the 6 inactive rows + keeps the 19 active (DB-counted). `tsc` clean · `next build` ✓. `/pricing` is `force-dynamic`, so the retired SKUs disappear as soon as this deploys. `admin/pricing` (the editor) intentionally still reads ALL rows so admins can re-activate. Pax-resolver + single-SKU `formatV2Sku` are by-code lookups (not display lists) — unaffected.

**SPEC IMPACT:** None (bug fix). Makes the documented "retire via is_active=false" mechanism actually work. DECISION_LOG row added.
## 2026-06-08 · feat(setnayan-ai): last-minute editors (build PR-4) — admin START + vendor END/surcharge

**Context:** PR-4 of the Setnayan AI build — the two config surfaces that turn PR-3's dormant last-minute engine ON. No migration (PR-3's `20260920000000` columns/kind already exist + are applied to prod). Implements the §4 editors from `What_Is_Setnayan_AI_2026-06-08.md`.

**What landed:**
- **Admin START editor** (`/admin/taxonomy`) — a new "Last-minute window start" section listing every bookable category with its current START (months before the wedding) + Save/Clear. New actions `setLastMinuteStart` (upsert a `planning_deadlines` row, `kind='last_minute_start'`, `scope='category'`, `ref_key`=plan-group id, onConflict `kind,ref_key,scope`) + `clearLastMinuteStart` (delete → dormant), both admin-gated + audit-logged. `last_minute_start` rows are filtered out of the "Recommended deadlines" list (they have their own section). Blank/no row = the category stays off.
- **Vendor END + surcharge editor** (`/vendor-dashboard/services`) — a "Last-minute bookings" block (new `LastMinuteFields` component) in both the Add + Edit service forms: "Accept until (months before)" (blank → night-before) + "Late surcharge (%)" (0–100). Wired into `createVendorService` + `updateVendorService` (new `parseSurchargePctOrNull` validator) and `fetchVendorServices`/`VendorServiceRow` (+`last_minute_end_months`/`last_minute_surcharge_pct`, with the same graceful column-missing fallback as `branch_id`).

**Now live end-to-end:** with PR-3's engine + this PR's editors + the applied migration, an admin sets a category START, a vendor sets their cutoff/surcharge, and a couple inside that window sees the gold "Last-minute" badge (Setnayan AI on) — or an empty category in the free search. Until an admin sets a START, everything stays dormant (unchanged).

**Verify:** `tsc` clean · `next lint` clean (no new warnings in touched files) · `next build` ✓ (`/admin/taxonomy` + `/vendor-dashboard/services` both `ƒ`).

**SPEC IMPACT:** Completes §4 of `What_Is_Setnayan_AI_2026-06-08.md` (editors); build-state flips 🟡→✅ for the last-minute row. DECISION_LOG row added.

## 2026-06-08 · chore(pricing): RSVP consolidation + Event Website ₱1,999 (owner-decided)

**Context:** Owner resolved the two catalog flags from the bundle-composition PR. (1) "RSVP Pro replaces RSVP" → retire `RSVP_WEBSITE`. (2) `EVENT_WEBSITE` → ₱1,999.

**What landed (catalog-only · migration `20260917000000`, applied to prod + recorded):**
- **Retired `RSVP_WEBSITE`** ("RSVP" ₱2,499) — `is_active=false` (row preserved for the activations FK; 0 orders). `RSVP_PRO_WEBSITE` ("RSVP Pro" ₱4,499) stays active (the keeper).
- **`EVENT_WEBSITE`** ("Event Website") `retail_price_php` ₱1,500 → **₱1,999**.
- No code change — the onboarding bundle + `/pricing` read the live catalog, so the Essentials worth auto-updates to ₱21,993 (save ₱8,994).

**⚠ FLAG for owner (naming collision):** the catalog now has TWO near-identically-named RSVP SKUs — `PRO_RSVP` "Pro RSVP" ₱1,999 (the one in the Essentials bundle) and `RSVP_PRO_WEBSITE` "RSVP Pro" ₱4,499 (the keeper). If these are the same product, one should be retired (and the bundle re-pointed); if intentionally different (RSVP feature vs premium RSVP+website), the near-identical names may confuse couples. Left both active pending your word.

**Verify:** migration applied + verified against the live catalog (RSVP_WEBSITE inactive, EVENT_WEBSITE ₱1,999, Essentials worth ₱21,993).

**SPEC IMPACT:** Catalog SKU change (RSVP consolidation + Event Website price). DECISION_LOG row added.

## 2026-06-08 · feat(onboarding): bundle composition — owner-specified Essentials + canonical-18 Complete + "what's included" list

**Context:** Owner confirmed the bundle compositions. Critically, Essentials includes SKUs that are NOT standalone onboarding à-la-carte cards (Setnayan AI · Pro RSVP · Event Website), so `BUNDLE_MEMBERS` is re-keyed from onboarding INAPP keys to catalog **service_codes**, and the bundle "worth" is now summed from the **full live customer catalog** (not the 13-card onboarding subset).

**What landed (`onboarding-pricing.ts` + `onboarding-shell.tsx` + `onboarding.css`):**
- **`BUNDLE_MEMBERS` → service_codes.** Essentials (owner's 7): `SETNAYAN_AI · ANIMATED_MONOGRAM · CUSTOM_QR_GUEST · PRO_RSVP · PAPIC_GUEST · EVENT_WEBSITE · PRO_WEBSITE`(Editorial Website). Complete: the canonical **18** paid SKUs (FIXED list — not "all active", so worth is controlled + drift-proof).
- **`buildOnboardingPricing`**: worth + member titles resolved from the full `byCode` catalog map (so non-card SKUs contribute). `OnboardingBundleVM` gains `items: string[]` (member display titles).
- **Bundle card** now renders a **"what's included" `✓` list** (member titles) in a 2-col grid under the savings line.
- Live numbers (from the catalog): **Essentials** worth ₱21,494 → ₱12,999 (save ₱8,495, 7 items); **Complete** worth ₱48,483 → ₱27,999 (save ₱20,484, 18 items). All 18 + 7 codes verified present/active — no silently-dropped members.

**#2 — bundles bought only during onboarding:** verified the bundle checkout (`/dashboard/[eventId]/add-ons/bundle`) is linked ONLY from the onboarding shell — not `/pricing`, not the dashboard add-ons/services list — so it's onboarding-only by construction (no extra gate needed; the page is just the apply-then-pay landing).

**⚠ FLAG for owner:** the live catalog now also has `RSVP_WEBSITE` + `RSVP_PRO_WEBSITE` (added out-of-band, not in my canonical 18) — deliberately EXCLUDED from Complete pending your confirm (duplicates of Pro RSVP / Event Website?). Also FYI `EVENT_WEBSITE` is now ₱1,500 in the catalog (was ₱1,999) — the bundle reads live, so it auto-reflects.

**Verify:** `tsc --noEmit` clean · `next build` ✓ · all member codes resolve against the live catalog.

**SPEC IMPACT:** Bundle compositions owner-ratified. DECISION_LOG row added.

## 2026-06-08 · feat(onboarding): bundle card — Essentials/Complete offer wired into onboarding (onboarding-only)

**Context:** Owner-approved 2026-06-08 (AskUserQuestion) — bundles are onboarding-only, so the Essentials/Complete offer is now shown IN the onboarding flow (the `pricing.bundles` view-model was built in the live-wire PR but unconsumed). Reverses the 2026-06-05 à-la-carte-only decision (owner-authorized). Built via an ultracode workflow; the workflow's `checkout-routes-safely` lens **caught a real bug** in the primary CTA, which I fixed before shipping (see below).

**What landed:**
- **New `bundle` screen** (`onboarding-shell.tsx`, FLOW_IDS `…plan → bundle → services → summary`): two cards from the live `pricing.bundles` — title · struck `worth` · `price` · "Save ₱X" · Complete carries a ★ best-value badge. NO hardcoded prices (all from the admin catalog). An "I'll pick à la carte instead" escape + the chrome Continue both leave `selectedBundle` null → the unchanged à-la-carte path.
- **`state.selectedBundle: 'essentials' | 'complete' | null`** (additive in `types.ts` + `EMPTY_ONBOARDING_STATE`; auto-backfills via the `{...EMPTY, ...saved}` hydrate). Transient UI (not persisted server-side) — the order captures the bundle at checkout.
- **New `/dashboard/[eventId]/add-ons/bundle?code=<package_code>`** checkout page: resolves the package price + title **server-side** from `platform_package_catalog` (URL carries only `?code` — tamper-proof) and mounts the existing `InlineCheckoutDrawer` keyed `service_key=GUIDED_PACK`/`MEDIA_PACK`. `submitOrderAction` keeps the client price for flat SKUs + `orders.service_key` is free-form TEXT (no FK) → a real bundle order lands with **no new server action + no schema change**.
- **Purchase routing** (`handleFinish`): a bundle pick routes Purchase Now to the bundle checkout; à-la-carte routing is **byte-identical** when `selectedBundle` is null.

**🐞 Fix (workflow-caught):** the card's own "Get {bundle}" CTA did `patch({selectedBundle:k}); handleFinish(true)` — `patch` is async setState, so `handleFinish` read the *stale* `selectedBundle` (null) in the same tick and dropped the bundle. Fixed by threading an explicit `bundleOverride` param into `handleFinish` (the card passes its key `k`; the Summary Purchase Now still reads fresh `state` since its `useCallback` deps include `state`).

**Data safety:** `submitOrderAction` UNCHANGED (zero risk to live per-service orders). `state.picks`/`prefs`/`interestedServices`/`buildCommitPayload` untouched. À-la-carte flow fully intact.

**⚠ FLAG for owner:** (1) confirm the **Essentials composition** (currently custom_qr · animated_monogram · advanced_website · papic_seats → drives the "worth/save"). (2) A bundle order is a single `orders` row keyed by package_code — member-service provisioning is manual/downstream (admin reconciliation), no auto-decomposition.

**Verify:** `tsc --noEmit` clean · `next build` ✓ (`/onboarding/wedding` + `/dashboard/[eventId]/add-ons/bundle` both `ƒ`) · all 3 purchase paths traced (card CTA fixed · summary · à-la-carte) · covert clean.

**SPEC IMPACT:** Bundles are now onboarding-only + live in the flow (per the 2026-06-08 decision). DECISION_LOG row added.
## 2026-06-08 · feat(website): Increment A.4 — Our Photos couple gallery (LIVE)

**Context:** Fourth content block on the wedding-website lifecycle foundation (`Wedding_Website_Lifecycle_Spec_2026-06-07.md` §6.5), after A.1 Special Message + A.3 What to Bring. A **couple-curated** photo gallery (engagement / pre-wedding shots) the couple uploads themselves, rendered on the public invitation. Distinct from the existing `your_photos` widget (the GUEST's tagged photos, post-event). Sequenced ahead of the Music/Video-hero increment because that one needs a change to the shared `/api/upload` MIME whitelist (no audio/video today) + media-bucket size cap — Our Photos reuses the **already-whitelisted image** upload path with zero shared-route risk.

**What landed:**
- **Migration `20260919000000`** — `events.our_photos JSONB NOT NULL DEFAULT '[]'` (array of `r2://` refs, in display order) + a `jsonb_typeof = 'array'` CHECK; the `our_photos` widget_type (CHECK recreated cumulatively across all **15** types; `populate_default_invitation_widgets()` seed row 15; backfill). Idempotent + additive.
- **`lib/invitation-widgets.ts`** — `our_photos` in `WIDGET_TYPES` + `WIDGET_CATALOG` (editor_subroute `our-photos`, hideable) → joins the show/hide/reorder editor; the widgets editor auto-renders its "Edit" link from `editor_subroute`.
- **`app/[slug]/page.tsx`** — `EventRow.our_photos`; SELECT; resolve refs → presigned 24h URLs (`ourPhotoUrls`) in the async body (the one async seam) and thread it parallel to `heroPhotoUrl` into both render paths (4 call sites) + both switch functions (`PublicHideableWidget` + `HideableWidgetRender`) + the `publicSafeWidgets` allow-list (couple-curated, no PII → safe for anonymous); new `OurPhotosWidget` (responsive 2/3-col grid, lazy raw `<img>` for the presigned URLs; empty → section hides).
- **New editor** `/dashboard/[eventId]/website/our-photos/{page.tsx,actions.ts}` — multi-image `<FileUpload>` (images, 10 MB each, up to 24, seeded with existing gallery so the host can add/remove); `updateOurPhotos` keeps well-formed `r2://` refs, de-dupes, caps at 24, writes the JSONB array (host-membership gate mirrors the hero-photo editor).

**⚠ Also fixes pre-existing main breakage (flagged for owner):** two parallel PRs each merged a migration named `20260916000000` (`retire_four_customer_skus` + `vendor_token_purchase`). The CI **migration timestamp guard checks the whole directory for duplicate prefixes**, so it was failing on `main` — **blocking every migration-bearing PR**, not just this one (the guard only runs per-PR, so `main` silently accumulated the dup). Fix: renamed the **idempotent** one (`retire_four_customer_skus`, a single guarded `UPDATE … WHERE is_active = true`) to `20260916000001`; left `vendor_token_purchase` at `20260916000000` (it's the one recorded in prod `schema_migrations` + referenced by the `20260918000001` webhook migration, so its identity must stay stable). Prod verified: `schema_migrations` has `20260916000000` once; `db push` will re-apply the renamed UPDATE as a harmless no-op (and apply the still-pending `20260918000001`/`20260918000100`, both idempotent — `CREATE OR REPLACE` / `ADD VALUE IF NOT EXISTS`).

**Verify:** typecheck + production build + **migration timestamp guard** on CI (no local node_modules in worktree). No generated Supabase types / no `Database` generic on the client → the new column is safe at compile time (same reason A.1/A.3 passed). Both switch functions stay exhaustive over the 15-type union. `20260919000000` strictly newest.

**SPEC IMPACT:** §6.5 element matrix — Our Photos now shipped. → DECISION_LOG. (The migration-rename is a CI-hygiene fix, no spec impact.)
## 2026-06-08 · feat(setnayan-ai): last-minute mechanic (build PR-3) — dormant-by-default engine + search gating

**Context:** PR-3 of the Setnayan AI build (after PR-1 governing gate #1089, PR-2 paid entitlement #1093). Implements §4 of `What_Is_Setnayan_AI_2026-06-08.md` (owner-locked 2026-06-08 · §9.3): the configurable last-minute range that supersedes the flat "< 14 days" rule.

**The model:** last-minute = the range `[platform leaf START → vendor service END]`, by R = months remaining. Three zones — **Normal** (`R > START`, everyone) · **Last-minute** (`END ≤ R ≤ START`, AI couples only, optional 0–100% surcharge) · **Expired** (`R < END`, no one). Two AI-gated edges: a last-minute vendor is searchable only with Setnayan AI on, and (owner edge #2) when AI is OFF and a whole category is already last-minute, the standard search shows **nothing** for that category.

**What landed:**
- **`lib/last-minute.ts`** (NEW · pure, like compat-score) — `monthsToWedding`, `lastMinuteZone`, `isLastMinuteSearchable`, `categoryEmptyForGenericSearch`, `lastMinuteSurchargedPricePhp`. Misconfig-guarded (END>START never fabricates a phantom window). Verified against the doc's worked example (stylist START=4 / END=3) + 21 logic checks via `tsx` (all green; no unit-runner in repo).
- **`category-search.ts`** (the candidate-discovery overlay backend) — reads platform START from `planning_deadlines` (new `kind='last_minute_start'`, category default + leaf override), reads vendor END/surcharge from `vendor_services`, computes each vendor's zone off its **most-available** in-scope service, then: drops Expired for everyone · drops Last-minute when AI off · returns **empty** for a fully-last-minute category in generic search · annotates survivors with `lastMinuteAvailable` + `lastMinuteSurchargePct`.
- **`category-search-overlay.tsx`** — a gold "Last-minute" badge (+surcharge %) in the existing `.badges` row, opportunity tone per §4.4.
- **Migration `20260920000000_last_minute_mechanic.sql`** — extends `planning_deadlines.kind` CHECK with `last_minute_start` (no seed → dormant) + adds `vendor_services.last_minute_end_months` / `last_minute_surcharge_pct` (CHECKed, nullable). Additive + idempotent.

**Dormant by default (the safety posture, matching PR-1/PR-2):** no START row is seeded — every zone resolves to `normal`, so there is **zero behavior change** in production. The per-leaf START months are a load-bearing platform-design value the owner sets; they are NOT invented here. The search action only touches the new `vendor_services` columns when a START is configured (`lastMinuteConfigured` guard), so the code is safe even **before** the migration is applied (dormant categories never query the new columns).

**⚠ Deferred to a follow-up (PR-4), flagged not built:** (1) the **admin editor** to set per-category/leaf START (attaches to `/admin/taxonomy` beside the deadline control); (2) the **vendor editor** for END + surcharge on `vendor_services`. Until those ship, the mechanic stays dormant. Also scoped to the category-search discovery overlay this PR — the wizard grid + accordion picks reuse the same engine when wired.

**⚠ Migration application PENDING (not forced):** prod's `schema_migrations` is mid-drift from parallel in-flight branches (`20260919000000` already taken on prod but not on `main`; a duplicate-prefix `20260916000000` recorded remotely as `…0001`). `supabase db push` is blocked both ways and the only unblock is repairing **other sessions'** ledger rows — declined. The migration is additive/idempotent + the frontend is dormant-resilient, so prod is unaffected; apply this migration once the ledger realigns (or alongside the PR-4 editor), before any START is configured.

**Verify:** `tsc --noEmit` clean · `next lint` clean (no new warnings) · `next build` ✓ (`/dashboard/[eventId]/vendors` builds) · 21/21 engine logic checks pass.

**SPEC IMPACT:** Implements §4 + §9.3 of `What_Is_Setnayan_AI_2026-06-08.md`. Build-state table flipped 📋→🟡 for the last-minute row; DECISION_LOG row added.

## 2026-06-08 · chore(pricing): retire 4 customer SKUs + bundles are onboarding-only (owner-decided)

**Context:** Owner resolved the two open pricing questions from the 2026-06-08 canonical reprice: (1) Papic Guests STAYS pax-priced ₱2,999 (the canonical-doc ₱1,999-flat is superseded — no change needed); (2) retire HIGH_RES_ARCHIVE, CALL_TIME_ESCALATOR, INDOOR_BLUEPRINT, PAKULAY; (3) the Essentials/Complete bundles are **onboarding-only — never sold outside**.

**What landed:**
- **Migration `20260916000000_retire_four_customer_skus.sql`** (applied to prod + recorded): `is_active=false` for the 4 SKUs in `platform_retail_catalog_v2` (rows preserved for the `event_software_activations_v2` FK; verified 0 orders). Papic Guests untouched.
- **`onboarding-shell.tsx`**: removed `indoor_blueprint` from `INAPP_KEYS`, `PICK_TO_INAPP` (reception/coordinator/catering), and `REC_PRIORITY` — a retired SKU drops out of `fetchV2CustomerCatalog` (is_active filter) so it would otherwise render at ₱0.
- **`onboarding-pricing.ts`**: removed `indoor_blueprint` from `INAPP_TO_SERVICE_CODE` + `OUT_ANCHORS`; **`BUNDLE_MEMBERS` re-scoped** to the onboarding service set (owner "bundles onboarding-only") — `complete` = all 13 offered onboarding services, `essentials` = the curated value core (custom_qr · animated_monogram · advanced_website · papic_seats).
- **`/pricing/page.tsx`**: removed the Bundles section + the bundle JSON-LD `Product` entries + the `fetchV2BundleCatalog` fetch/import — bundles no longer appear on the public pricing page (onboarding-only).

**⚠ FOLLOW-UP (surfaced, not built):** bundles are now removed from `/pricing` but the onboarding bundle CARD is not yet wired (the production onboarding switched to à-la-carte 2026-06-05; `pricing.bundles` view-model is built but unconsumed). Re-introducing the Essentials/Complete card to the onboarding plan screen reverses that 2026-06-05 decision → flagged for owner go-ahead before building.

**Verify:** `tsc --noEmit` clean · `next build` ✓ (`/onboarding/wedding` + `/pricing` both `ƒ`).

**SPEC IMPACT:** Resolves the 2 open "confirm" items from the 2026-06-08 reprice. `Pricing_Canonical_2026-06-08.md` §57 retirements confirmed (minus the still-active ones); Papic Guests pax-pricing stands. DECISION_LOG row added.
## 2026-06-08 · fix(ci): resolve duplicate migration timestamp 20260918000000

**Context:** Two PRs merged the same day each created a `20260918000000_*` migration — `…_invitation_widgets_what_to_bring.sql` (#1095 What-to-Bring) and `…_vendor_token_purchase_webhook.sql` (#1097 token webhook). Each passed its own `migration timestamp guard` because the collision only existed once *both* were on `main`; the guard would then fail on **every** subsequent PR (it rejects duplicate 14-digit prefixes, since `supabase db push` uses the prefix as the `schema_migrations` PK).

**What landed:** renamed `20260918000000_vendor_token_purchase_webhook.sql` → `20260918000001_vendor_token_purchase_webhook.sql` (content identical; the What-to-Bring file keeps `000000`). Guard now passes (verified locally with ci.yml's exact check). No prod impact — the functions were already applied via direct SQL and are idempotent; this is a repo-filename fix to unblock CI.

**SPEC IMPACT:** None.

## 2026-06-08 · feat(vendor): token purchase — payment webhook, notifications, history

**Context:** Follow-ups to the vendor token-purchase flow (#1088/#1091). Owner asked for: the "automated later" webhook half, purchase notifications, and a vendor-facing purchase history.

**What landed:**
- **Payment webhook (`app/api/webhooks/token-purchase/route.ts`)** — HMAC-SHA256-verified (`TOKEN_PURCHASE_WEBHOOK_SECRET`, `x-setnayan-signature`, timing-safe) endpoint that auto-confirms a purchase when a provider reports a paid `TKN-` reference. Extracts the reference from known Maya/PayMongo fields + a recursive payload scan; ignores non-success statuses; acks unknown references (no retry-storm); credits via the new service-role RPC; defers the vendor notification with `after()` for a fast 200. **No secret set → 503 (inert/fail-closed).**
- **Migration `20260918000001`** — refactors the credit logic into a shared internal `_apply_token_purchase_credit(id, reviewed_by)` (idempotent), rewrites `approve_vendor_token_purchase` to delegate to it, and adds `confirm_vendor_token_purchase_by_reference(ref)` for the webhook. **Security:** the webhook RPC + internal helper are `service_role`-only — explicitly REVOKEd from `anon`+`authenticated` (Supabase's default privileges grant those, so `REVOKE FROM PUBLIC` alone left a hole where a vendor could self-credit by reference without paying). Verified the grant state post-apply.
- **Migration `20260918000100`** + `lib/notifications.ts` — two new `notification_type` values: `vendor_token_purchase_pending` (admin) + `vendor_tokens_credited` (vendor), with labels + tones.
- **Notifications (`lib/token-purchase-notify.ts`)** — fail-soft helpers used by both the actions and the webhook: `notifyAdminsTokenPurchasePending` (fan-out to internal/team/admin users on a new order, deep-links `/admin/token-purchases`) + `notifyVendorTokensCredited` (on a fresh credit only, deep-links `/vendor-dashboard/tokens`). `emitNotification` already does in-app + email, so this is one call per channel. Wired into `startTokenPurchase` (admins) and `approveTokenPurchase` (vendor, gated on `{paid:true}` so a re-confirm doesn't re-ping).
- **Purchase history (`_components/purchase-history.tsx`)** — vendor tokens page now shows resolved (paid/rejected) orders; pending still lives in the PendingPurchases panel.

**Verify:** `tsc --noEmit` clean · `next lint` clean · transactional smoke test (rolled back) — webhook confirm-by-reference credits +50 purchased_tokens, idempotent, unknown ref raises NOT_FOUND, admin path still works via the shared core; grant audit confirms `confirm_*`/`_apply_*` are service_role-only. Migrations applied to prod.

**Owner action (for live automation):** set `TOKEN_PURCHASE_WEBHOOK_SECRET` in Vercel, register the provider webhook at `/api/webhooks/token-purchase`, and configure it to sign the raw body + echo our `TKN-` reference. Until then the manual admin-confirm flow is the live path (webhook returns 503).

**SPEC IMPACT:** Extends the 2026-06-08 vendor token-purchase flow (0034 + 0022). DECISION_LOG row appended. No price changes.

## 2026-06-08 · feat(website): Increment A.3 — What to Bring content block (LIVE)

**Context:** Third content block on the wedding-website lifecycle foundation (`Wedding_Website_Lifecycle_Spec_2026-06-07.md` §6.5), after Special Message (A.1). A couple-curated gift / registry / no-gift note rendered on the live invitation site. Built fully **independent of the parallel onboarding session** — its own column, its own editor; onboarding never touches it.

**What landed:**
- **Migration `20260918000000_invitation_widgets_what_to_bring.sql`** — adds `events.what_to_bring` (TEXT) + the `what_to_bring` widget_type (CHECK recreated cumulatively with all 14 types incl. `special_message`; `populate_default_invitation_widgets()` seed adds row 14; backfill for existing events). Idempotent + additive.
- **`lib/invitation-widgets.ts`** — `what_to_bring` added to `WIDGET_TYPES` + a `WIDGET_CATALOG` entry (editor_subroute `what-to-bring`, hideable) so it appears in the show/hide/reorder editor.
- **`app/[slug]/page.tsx`** — `EventRow.what_to_bring`, added to the SELECT, both render switches (`HideableWidgetRender` + `PublicHideableWidget`), the `publicSafeWidgets` allow-list, and a new `WhatToBringWidget` (centered cream card, "What to bring" eyebrow; blank → renders nothing so the section hides).
- **New editor** `/dashboard/[eventId]/website/what-to-bring/{page.tsx,actions.ts}` — single 600-char textarea writing `events.what_to_bring` via `updateWhatToBring`; mirrors the Special Message editor (auth + RLS gate; empty saves NULL → section hides).

**Verify:** typecheck + production build on CI (no local node_modules in worktree). Migration timestamp bumped `20260917000000`→`20260918000000` on merge to clear a collision with `20260917000000_setnayan_ai_entitlement.sql` (parallel PR-2); strictly newest (monotonic guard passes). `our_love_story` deliberately NOT included — it remains parked off-main, so the CHECK/seed stay at 14 types.

**SPEC IMPACT:** §6.5 (per-phase element matrix) — What to Bring now shipped. → DECISION_LOG.

## 2026-06-08 · feat(seating): chair-level visual editor + role-tier auto-seat (0008)

**Context:** Owner shared a polished seating-editor reference ("Nunta Pe Mese") and asked to bring our seat plan up to it. The look they wanted — per-seat chairs with guest names, a grouped/colour-coded sidebar, and a one-click auto-fill — is exactly what iteration **0008**'s locked spec already describes ("Chair-level interaction" + "Auto-fill — role-tier rings"); the 2026-05-13 MVP had shipped only plain table shapes + a dropdown assigner and deferred both. This PR catches the code up to its own spec. No migration — `event_seat_assignments.seat_number` and `guest_groups`/`guest_group_memberships` already existed.

**What landed:**
- **Chair-level canvas** (`_components/seating-editor.tsx`, replaces `floor-plan.tsx`) — each table renders its chairs around the hub (round/sweetheart/serpentine → circle; long-banquet/family-head → two long edges). Each seat is drawn as an **actual chair** (Lucide `Armchair`): empty chairs are open seats you tap to fill; an occupied chair is tinted in the guest's group/side colour with their photo/initials sitting on it, and the guest's **full name** fans out around the chair (radial on round tables; stacked above/below + chair-column-wrapped on banquet rows so adjacent names don't collide). Pure geometry lives in `lib/seating.ts` (`tableGeometry`).
- **Seat / move / unseat by tap** — pick a guest in the sidebar, tap a chair (or the table hub for next-free seat); tap a seated chair to pick them up and move; Unseat from the action banner. Touch-friendly select-then-place (no fragile drag-to-assign). Table reposition stays a hub drag (4px threshold disambiguates click vs drag) → Save layout.
- **Grouped, colour-coded sidebar** — Tables (fill state + delete + click-to-highlight), Individual Members, and custom Member Groups (deterministic accent colour via `groupColorFor`, member count, expand, eye-toggle to mute the colour on canvas). "Only show unseated" filter + people search. Inline Add-table.
- **Auto-seat** (`autoSeatGuests` action + pure `computeAutoSeat`) — fills every unseated *attending* guest into the nearest tables to the stage, tier by tier (T1 family/sponsors/officiant → T4 friends/work), keeping plus-ones adjacent; idempotent (never moves a seated guest, skips sweetheart tables, never seats the couple). Confirm dialog before running.
- Brand-native (Alabaster/Obsidian/Champagne/Mulberry), not the reference's teal/peach. Photo URLs resolved server-side via `displayUrlForStoredAsset`.

**Verify:** `tsc` ✓ · `next lint` ✓ (warnings only) · `next build` ✓ (route `/dashboard/[eventId]/seating` ~14.5 kB). PR #1070 CI green (ci/typecheck+lint+production build · playwright e2e · lighthouse · desktop build). Layout visually verified via a headless render of the seeded `couple.test` demo wedding (4 tables / 15 guests / 3 colour groups) before each push.

**SPEC IMPACT:** Builds the previously-deferred "Chair-level interaction" + "Auto-fill — role-tier rings" sections of `0008_seating_chart_editor.md` (and flips that file's AS-BUILT note). Still deferred (the "full rebuild" the owner did not pick this pass): Add-Group modal w/ colour picker, two-tab Arrangements/Members layout, canvas zoom, dedicated mobile table-card view, publish-QR + print pack, per-seat serpentine wedge geometry. → corpus DECISION_LOG + 0008 AS-BUILT header.

## 2026-06-08 · feat(setnayan-ai): per-event paid entitlement, behind a default-off flag (PR-2)

**Context:** Owner 2026-06-08 — make Setnayan AI a **paid per-event** SKU (₱3,999, `SETNAYAN_AI`, already live in `platform_retail_catalog_v2`), but **"build it, flip behind a flag"** so nothing changes for live couples until deliberately enabled. Builds on PR-1's governing gate (`isSetnayanAiActive`).

**What landed (all inert until the flag flips):**
- **Migration `20260917000000`** — additive `events.setnayan_ai_active boolean NOT NULL DEFAULT false`. The entitlement is a single flat boolean (no trial / no wedding-anchored expiry — distinct from the retired Concierge machinery).
- **`lib/setnayan-ai.ts`** — `isSetnayanAiPaywallEnabled()` reads `SETNAYAN_AI_PAYWALL_ENABLED` (default off). Gate: paywall OFF → free Assisted↔Manual toggle (PR-1 behavior, unchanged); paywall ON → `notManuallyOff && setnayan_ai_active`. The source swap is this one file — no call site touched.
- **Activation hook** (`admin/payments/actions.ts`) — a confirmed `SETNAYAN_AI` order stamps `events.setnayan_ai_active = true` (idempotent, non-fatal, no expiry). ⚠ The `order.service_key` match (`'SETNAYAN_AI'`) must be verified against the actual checkout key before flipping the flag — flagged in-code.
- **3 event selects** now fetch `setnayan_ai_active` (page.tsx · category-search.ts · vendors/page.tsx) so the flip "just works".

**Deferred to the flip-time increment:** surfacing the SKU on /pricing + onboarding, the toggle-on-unpaid → buy-routing, `V2_SKU_CODES` sync, and the homepage "from ₱3,999" copy.

**Verify:** flag is off by default → zero behavior change; gate logic unit-checkable; migration additive + applied to prod ahead of merge (selects depend on the column). CI typecheck + build.

**SPEC IMPACT:** Implements the per-event paid gate from `What_Is_Setnayan_AI_2026-06-08.md` §2/§9. → DECISION_LOG. PR-2 of the build (next: last-minute · dependencies).

## 2026-06-08 · fix(dashboard): "Switch to manual" toggle silently did nothing on some events

**Context:** Owner reported clicking "Prefer to plan it yourself? Switch to manual →" on the Services tab did nothing (no error, no change). The `setPlanningMode` server action is correctly wired (`'use server'`, valid form), but it wrote via the **user-scoped** Supabase client.

**Root cause:** the `couple_can_update_event` RLS policy keys on `event_members.member_type = 'couple'`. For **seeded / host / multi-host** events that row can be absent, so the user-client `UPDATE … SET planning_mode` matches **0 rows and returns no error** (PostgREST RLS no-op) — the page revalidates unchanged, i.e. "the switch did nothing." (Onboarding- and create-event-made events DO get the couple row, so real couples were unaffected — but the gate is fragile.)

**Fix:** `setPlanningMode` now (1) **gates on a user-scoped read** of the event (read RLS = the caller is a member), then (2) applies the update via the **admin client**, landing the flip for every legitimate member regardless of the membership-row nuance. Security preserved by the read-gate (a non-member's read returns nothing → throws before any write). `revalidatePath('layout')` unchanged.

**Verify:** typecheck/build on CI; the toggle now flips Guided ⇄ Manual on seeded/host events too.

**SPEC IMPACT:** None (correctness fix to the existing Setnayan AI on/off toggle).

## 2026-06-08 · feat(onboarding): Dream Team PR-4 (FINAL) — two-pass uniform refine engine · chapter fully live

**Context:** Last of 4 PRs porting the "Your Dream Team" chapter (`Onboarding_DreamTeam_Port_Spec_2026-06-08.md` §3.3/§5). Adds the per-leaf "what kind?" refinement engine — the explicit owner ask: ONE uniform template for every refinement. Built via an ultracode workflow; the workflow's auto-verify phase was killed by a transient API rate-limit, so the 3 adversarial lenses were **re-run manually** (all pass — see Verify).

**What landed (`onboarding-shell.tsx` + `onboarding.css`):**
- **`FLOW_IDS`**: `refine_basic` after `team_basics`, `refine_extras` after `team_extras`. **`TEAM_AI_ONLY`** adds both (buildSequence filter unchanged → AI=No still skips the whole chapter).
- **`REFINEMENTS` map** (ported from the prototype, ~39 leaves): only a leaf WITH an entry gets a refine screen. The 3 **projectable** leaves reuse existing production consts so option keys match `prefs.*`: `ceremony` (faith-adaptive via `ceremonyOptsFor(faith)`), `catering` (`CUISINE_OPTS` + a synthetic `cuisine_halal`), `photo_video` (`PV_LOOKS`). The other ~35 carry verbatim string options (JSONB-only, lossless).
- **Two-pass engine**: derived `refineBasicQueue`/`refineExtrasQueue` = `picks ∩ keys(REFINEMENTS)` (basics in `BASIC_CATS` order, extras in flat taxonomy order); an empty pass is skipped. `refineIdx` + the `go()` re-entry loop walks within a pass (forward/back) and skip-empties on entry. The chrome CTA reads "Next service" mid-queue / "Continue" last.
- **`RefineStep`** — ONE component renders BOTH passes + every leaf identically (uniform template: "Service N of M · {leaf}" + progress dots + "What kind of {leaf}?" + a `.pgrid.car` photo-card carousel, multi-select).
- **`patchRefine(leaf, opt)`** toggles `state.refinements[leaf]` AND applies `projectRefinementsToPrefs` LIVE. **`projectRefinementsToPrefs(refinements, faith)`** maps `ceremony`→`prefs.ceremony` (last valid pick), `catering`→`prefs.cuisine` (+`dietary:['halal']` on `cuisine_halal`), `photo_video`→`prefs.pvLook`. Applied live + idempotently in `buildCommitPayload` (`stylePreferences: {...prefs, ...projected}`), with raw `refinements` threaded to `style_preferences.refinements` JSONB.

**Data safety:** `state.picks` is READ-only in refine (never mutated). The projector keeps `prefs.ceremony`/`cuisine`/`pvLook` consistent so the recap + commit reflect the refine picks. No migration (PR-1 already added the field).

**⚠ FLAG for owner:** (1) `cuisine_halal` is a synthetic refinement key routing to `dietary` (keeps `CUISINE_OPTS` pristine) — Cowork should ratify it as canonical. (2) The ceremony recap shows the last pick (single) while refinements stores multi. (3) The refine CTA stays in the chrome bar (label computed) rather than in-component.

**Verify (manual, workflow auto-verify rate-limited):** `tsc --noEmit` clean · `next build` ✓ (`/onboarding/wedding` `ƒ`, 55.8 kB) · uniform-template confirmed (1 component / 2 passes) · projector keys match `ceremonyOptsFor`/`CUISINE_OPTS`/`PV_LOOKS` + the recap · `state.picks` never written by refine · covert grep clean (love screens untouched; refine copy service-shaped).

**SPEC IMPACT:** The adaptive Dream Team chapter is now FULLY LIVE (aigate→team_basics→refine_basic→team_extras→refine_extras→songs→mood). `events.style_preferences.refinements` now carries the full per-leaf detail. DECISION_LOG row added.
## 2026-06-08 · fix(vendor): show admin-uploaded BDO/GCash QR codes in token purchase

**Context:** The token-purchase pending panel (shipped earlier today) showed only the BDO/GCash account name + number — but the admin has already uploaded **QR code images** for both channels (`platform_settings.bdo_qr_url` / `gcash_qr_url`, public Supabase-storage URLs). Scanning a QR is the easiest pay path (UX north star), so the panel should surface them.

**What landed (`pending-purchases.tsx`):** `PayBox` now renders the QR image (when present) above the account number, using the same plain-`<img>` pattern as the customer `ManualCheckoutModal` (QR assets live on a separate CDN, outside `next/image`'s whitelist; explicit width/height to avoid layout shift). The data path was already wired — `fetchPlatformSettings` SELECTs both `*_qr_url` columns and `page.tsx` passes the full `settings` object — this just displays them. Falls back to "account details coming" only when neither a number nor a QR is configured.

**SPEC IMPACT:** None — display-only fix connecting the existing admin Payment-methods QR uploads to the vendor token-purchase surface.

## 2026-06-08 · feat(vendor): self-serve token-pack purchase (apply-then-pay)

**Context:** Owner 2026-06-08 — "make purchasing available too" + "Both — manual now, automated later." The vendor token wallet (`/vendor-dashboard/tokens`) showed token packs as read-only educational copy ("purchase opens this week") with no way to actually buy. Vendors could only receive tokens via an admin grant or the founder bonus. This ships the real purchase path.

**What landed:**
- **Migration `20260916000000_vendor_token_purchase.sql`** (applied to prod) — new `vendor_token_purchases` table (RLS: vendor reads own, admin reads all; all writes via SECURITY DEFINER fns) + 3 functions: `create_vendor_token_purchase(sku)` (vendor-initiated; reads price + token count from `vendor_billing_catalog` — never a client-supplied amount — generates a `TKN-xxxxxxxx` reference, inserts `pending_payment`), `approve_vendor_token_purchase(id)` (admin/webhook confirms → credits `vendor_wallets.purchased_tokens`, the **never-expire** bucket, via UPSERT; idempotent on the status guard + row lock), `reject_vendor_token_purchase(id, reason)`. New `is_console_admin()` helper gates approve/reject on the console's `account_type='admin' OR is_internal OR is_team_member` (broader than the strict `is_admin()` so internal/team reviewers aren't locked out).
- **Vendor UI** — `tokens/actions.ts` (`startTokenPurchase` server action) + `buy-tokens-cta.tsx` rewritten **DB-priced** (packs from `vendor_billing_catalog` via `fetchV2VendorCatalog`, no hardcoded ₱180–250/token ladder — admin `/admin/pricing` is source of truth; live DB = ₱100/token) with per-pack Buy forms + `pending-purchases.tsx` (reference code + BDO/GCash receiving accounts from `platform_settings` + "Setnayan does not hold these funds" disclosure). `page.tsx` fans in pending purchases + packs + settings and shows an `ordered`/`error` banner.
- **Admin reconcile** — `/admin/token-purchases` (pending queue with Confirm/Reject + recently-resolved list) + `actions.ts` calling the RPCs through the admin's own user-scoped client (so `auth.uid()` resolves for the gate + audit). New sidebar entry under Money (after Token bands).

**Why purchased (not earned):** the burn path `consume_vendor_assets_per_voucher()` spends earned vouchers FIFO **then** drains `purchased_tokens`, so both are spendable — but a paid pack must NOT silently expire (matches the wallet UI's "Purchased tokens never expire"). Earned/founder/referral tokens stay in their 45-day voucher bucket; bought tokens are permanent.

**Automated-later seam:** `approve_vendor_token_purchase` is exactly the entry point a future Maya/PayMongo webhook calls to auto-credit on payment — no rebuild, just a webhook handler that resolves the order by reference code and calls approve.

**Verify:** transactional smoke test (rolled back, prod untouched) confirmed — create reads correct DB price (25 tok/₱2,500), non-admin vendor **blocked** from approve (`FORBIDDEN: admin only`), admin approve credits `purchased_tokens` +25 with `earned_tokens` unchanged, approve idempotent (no double-credit). Migration applied + re-applied cleanly (idempotent). Frontend typecheck via CI required checks (passed).

**SPEC IMPACT:** Vendor token economy now has a customer-initiated purchase flow (0034 payments/cart + 0022 vendor dashboard). DECISION_LOG row appended at corpus root. No price changes (packs unchanged at ₱100/token); the purchased-vs-earned expiry semantics are clarified, not changed.

## 2026-06-08 · feat(setnayan-ai): governing gate — one chokepoint, AI-off → generic site-wide (PR-1)

**Context:** Owner 2026-06-08 — "Setnayan AI must govern across the whole website," sequenced "govern now (free), monetize next." Today the AI on/off gate is scattered: every surface independently checks `events.planning_mode === 'manual'`, and two surfaces *leak* (run AI-only logic regardless of the gate).

**What landed:** new **`lib/setnayan-ai.ts` → `isSetnayanAiActive(event)`** — the single governing gate. Routed the 3 scattered inline checks through it (`page.tsx` deadlines, `category-search.ts` search, `vendors/page.tsx` plan-budget). **Closed 2 leaks so AI-off is genuinely generic:** (1) `category-search.ts` — the reception-proximity tail sort now gates on `aiActive` (AI off → review/rating order, the same fallback as no-coords); (2) `vendors/page.tsx` — the "👀 eyeing your date" nudge is suppressed (empty map) when AI is off. No behavior change for the default Assisted case; Manual-mode (AI-off) couples now get a true region-scoped generic search (no proximity ranking, no % pill, no eyeing, no deadlines). Free floor (region filter + anti-double-book) unaffected.

**Why centralize:** the locked design makes the gate a **paid per-event entitlement**; PR-2 swaps the body of `isSetnayanAiActive` to read that entitlement **without touching any call site**. This PR makes that a one-file change.

**Verify:** no remaining inline `planning_mode === 'manual'` checks; no unused vars; diff is 4 files / +58−13. Build via CI required checks.

**SPEC IMPACT:** Implements the §2 free-floor↔AI boundary + AI-off→generic from `What_Is_Setnayan_AI_2026-06-08.md` (corpus). → DECISION_LOG. PR-1 of the Setnayan AI build (next: paid entitlement · last-minute · dependencies).

## 2026-06-08 · feat(onboarding): Dream Team PR-3 — two-screen picker, retire StyleSubStepper

**Context:** Third of 4 PRs porting the "Your Dream Team" chapter (`Onboarding_DreamTeam_Port_Spec_2026-06-08.md` §2/§3.1/§5). Replaces the single flat `picker` + the `prefs` sub-stepper with a two-screen picker + standalone style screens. Built via an ultracode workflow (understand→design→implement→3-lens adversarial verify · allPassed). Net shell-line reduction (StyleSubStepper retired).

**What landed (`onboarding-shell.tsx` + `onboarding.css`):**
- **`team_basics`** — pax-style screen: maximized hero of the focused basic + a 4-card carousel of `BASIC_CATS = ['ceremony','catering','coordinator','photo_video']` (production PICK_GROUPS keys). Cards toggle via the EXISTING `pickChip` → `state.picks`.
- **`team_extras`** — expandable parent→tiles browser of the full taxonomy MINUS the 4 basics and `reception` (empty parents hidden). Tiles toggle via `pickChip`.
- **`songs`** + **`mood`** — the music (`SongBankStep` → `prefs.music`) + palette/feel (`FEELS` → `prefs.feel`) dimensions lifted OUT of the retired StyleSubStepper into standalone screens (still AI-gated).
- **`FLOW_IDS`**: `picker`→`team_basics`+`team_extras`, `prefs`→`songs`+`mood`. **`TEAM_AI_ONLY = {team_basics, team_extras, songs, mood}`** (buildSequence logic unchanged). **Retired** StyleSubStepper, the `prefs` render, `prefIdx`/`prefQueue`/`prefsLabel`, the `go()` prefs special-case (remaining refs are comments only).

**Bridge (§3.1 Option A — verified):** basics vs extras is a RENDER-TIME partition of ONE flat `state.picks` — NO `basicPicks`/`enhancePicks`. `pickChip` stays the single mutator, so `interested_categories` (commit), `getOnboardingVendorCounts`, `recommendedInappFor` are byte-unchanged. `actions.ts` + `types.ts` untouched. `prefs.music`/`prefs.feel` still captured; `prefs.ceremony`/`cuisine`/`pvLook` intentionally uncaptured until PR-4 (find reads only `prefs.reception` — safe).

**⚠ FLAG for owner:** (1) `songs`+`mood` screens RETAINED (the prototype dropped both; kept so the Song Bank + palette capture survives). (2) `songs` is currently Skippable (sort-not-gate) — say if you want a ≥10-song floor.

**Verify:** `tsc --noEmit` clean · `next build` ✓ (`/onboarding/wedding` `ƒ`, bundle 52.2 kB) · no dangling StyleSubStepper/prefs refs · covert grep clean · all 3 adversarial lenses passed.

**SPEC IMPACT:** None (matches the locked porting spec). DECISION_LOG row at PR-4 when the chapter goes fully live.
## 2026-06-08 · chore(branding): rename "Today's Focus" → "Setnayan AI" across the app UI

**Context:** Owner 2026-06-08 locked the planner SKU's canonical consumer name as **Setnayan AI** (shorthand SAI), retiring the interim "Today's Focus" display name everywhere. The spec corpus was already fully scrubbed (new `What_Is_Setnayan_AI_2026-06-08.md` + DECISION_LOG rows); this brings the app UI into alignment.

**What landed:** display-name-only rename of **"Today's Focus" → "Setnayan AI"** (all apostrophe forms incl. the `&rsquo;` HTML entity; caps preserved in headers) across **66 files** in `apps/web` — the homepage hero (`_components/marketing/_sections.tsx`), the retired-SKU concierge banner + settings copy, admin labels (brain / abuse / addons / queues / sidebar), the i18n nav label (`lib/i18n/dashboard.{en,tl}.json`), the help article, aria-labels + metadata titles, and history comments. Coherence fixes where the swap would have implied the *current* brand was retired: "retired Today's Focus wizard" → "retired planner wizard" (×3) + de-duplicated "AI Today's Focus" → "Setnayan AI".

**Name only — prices + code identifiers untouched.** The ₱1,499 planner prose stays; the `todays_focus`/`TODAYS_FOCUS` SKU key, `events.todays_focus_*` columns, `users.show_todays_focus_wizard`, and the `/today` route are LEFT AS-IS (they mirror the live DB / catalog / routes — renaming them is a separate migration PR, owner to greenlight).

**Verify:** display-name residual = 0 across `apps/web` (all forms); both i18n JSON re-validated; the diff is pure string/comment swaps (169 lines, no structural changes). Build via CI required checks.

**SPEC IMPACT:** Corpus already aligned 2026-06-08 (the full Today's-Focus → Setnayan AI scrub + `What_Is_Setnayan_AI_2026-06-08.md` + DECISION_LOG). This PR closes the app↔corpus naming gap. Code-identifier rename intentionally deferred to a migration.

## 2026-06-08 · feat(onboarding): Dream Team PR-2 — chapter chrome + AI-gate fork

**Context:** Second of 4 PRs porting the "Your Dream Team" chapter (`Onboarding_DreamTeam_Port_Spec_2026-06-08.md` §2/§4/§5). PR-2 adds the chapter CHROME + the AI-gate fork; the picks split + refine engine are PR-3/PR-4. Built via an ultracode workflow (understand→design→implement→3-lens adversarial verify · allPassed).

**What landed (`onboarding-shell.tsx` + `_styles/onboarding.css`):**
- **`FLOW_IDS`** — inserted the chapter after `budget`: `team_intro → reception_setting → find → team_payoff → aigate → picker → prefs → account → …`. `find` MOVES out of its old post-`account` slot into the chapter (after `reception_setting`); `picker`+`prefs` move to after `aigate` and become AI-gated; `account` now follows the AI screens.
- **`buildSequence`** — gains an `ai` param + `TEAM_AI_ONLY = {picker, prefs}` (interim): `!(ai !== true && TEAM_AI_ONLY.has(id))` → picker/prefs show ONLY when the couple taps "Yes" on `aigate`; AI=No (or undecided) skips them straight to `account`. Composes with the existing civil/authed/loveSkipped filters. All 6 call sites updated (legacy drafts → `saved.ai ?? null`; `seq` useMemo dep array gains `state.ai`).
- **4 new screens** — `team_intro` (education: reception is home base), `reception_setting` (photo-cards multi-select → `state.prefs.reception` via the EXISTING `RECEPTION_SETTINGS` keys + `PCard`; promotes the dimension out of `StyleSubStepper`), `team_payoff` (factual stats from `venues.length` + `state.shortlist.length`, no login), `aigate` (the AI offer with two in-screen CTAs → `aiAnswer(true/false)`; chrome Continue hidden via `AIGATE_NOCTA`). 3 net-new CSS rules (`.aibenefits/.aibene/.stayfree`) under `.onbw`.
- **`PREF_ORDER`/`prefQueueFrom`** — dropped `reception` (now owned by `reception_setting`) so `StyleSubStepper` no longer double-asks it (its reception branch is now harmless dead code, retired in PR-3).

**Data safety:** `state.picks`/`state.prefs`/`state.shortlist`/`buildCommitPayload`/the commit are UNCHANGED. `reception_setting` writes the SAME `prefs.reception` array. `find` is reused verbatim (string-addressed `activeId==='find'` effect is move-safe; the match effect's `seq.indexOf` stays valid). AI=No keeps `state.picks` empty-but-valid — find + commit don't crash.

**⚠ FLAG for owner:** `account` now follows the AI screens (prototype order — captures email later). If you want it BEFORE the AI screens, it's a one-line `FLOW_IDS` reorder.

**Verify:** `tsc --noEmit` clean · `next build` ✓ (`/onboarding/wedding` still `ƒ`) · covert grep clean (no pricing/song/editorial in the new copy; love screens untouched) · all 3 adversarial lenses passed.

**SPEC IMPACT:** None (matches the locked porting spec). DECISION_LOG row at PR-4 when the chapter goes fully live.
## 2026-06-08 · fix(for-vendors,how-it-works): de-hardcode vendor prices → read the catalog DB

**Context:** Owner 2026-06-08 "make sure these prices are based on the admin page and not hardcoded." The homepage PricingSection + /pricing already read the DB; /for-vendors + /how-it-works still hard-coded the vendor tier prices (and /how-it-works was STALE at ₱2,499 → should be ₱6,000).

**What landed:** new **`getVendorPrices()`** in `lib/v2-catalog.ts` (`cache()`-wrapped, reads `vendor_billing_catalog`, formatted strings, resilience fallbacks only). `/for-vendors` (hero · comparison table + annuals + standalone Enterprise callout · stack-close) + `/how-it-works` (the stale Pro price) made async to read it; both pages → `force-dynamic`.

**Verify:** typecheck/build on the PR. Prices flow from /admin/pricing.

**SPEC IMPACT:** None (presentation; vendor prices DB-sourced). REMAINING hard-coded (follow-up): /for-vendors SEO metadata + JSON-LD Offers (`generateMetadata`), the money-FAQ prose, the module-level Add-Branch ₱999 / Boosted ₱1,200 rows, and the homepage planner "₱1,499" prose (TODAYS_FOCUS excluded from the fetcher).

## 2026-06-08 · feat(onboarding): Dream Team PR-1 — additive scaffolding (ai + refinements state · ZERO behavior change)

**Context:** First of 4 sequential PRs porting the prototype's "Your Dream Team" chapter (`Onboarding_DreamTeam_Port_Spec_2026-06-08.md`). PR-1 lands the two new bridge fields + the commit thread with EMPTY data, so the type/commit contract is proven byte-equivalent before any UI consumes it (later PRs never touch the contract again).

**What landed (additive only · no migration):**
- **`types.ts`** — `OnboardingState` gains `ai: boolean | null` (AI-gate answer; `null`=not-yet-asked, drives `buildSequence` in PR-2) and `refinements: Record<string, string[]>` (per-leaf "what kind?" picks; folded into `style_preferences.refinements` JSONB for display + future vendor-match). `EMPTY_ONBOARDING_STATE` defaults: `ai: null`, `refinements: {}`.
- **`actions.ts`** — `OnboardingCommitPayload` gains optional `refinements`; the `style_preferences` insert adds `refinements: payload.refinements ?? {}` (additive JSONB key, no migration; `interested_categories` still reads `payload.picks`).
- **`onboarding-shell.tsx`** — `buildCommitPayload` threads `refinements: s.refinements`.
- **Draft resume** — automatic: the hydration `{ ...EMPTY_ONBOARDING_STATE, ...saved }` backfills `ai`/`refinements` for pre-port drafts (absent keys keep the EMPTY defaults).

**Behavior:** With `refinements` always `{}` and `ai` always `null` (no UI sets them yet), the commit is identical to today except a new `style_preferences.refinements: {}` key — read by nothing. `find` + recap + vendor-matching untouched.

**Verify:** `tsc --noEmit` clean · `next build` ✓. No other `OnboardingState` literal needed updating.

**SPEC IMPACT:** None (additive scaffolding; the `style_preferences.refinements` JSONB key is new but additive — documented in `Onboarding_DreamTeam_Port_Spec_2026-06-08.md` §3.6). DECISION_LOG row at PR-4 when the chapter goes fully live.

## 2026-06-08 · feat(onboarding,pricing): de-hardcode onboarding prices → read the live admin catalog (owner directive)

**Context:** Owner directive 2026-06-08 — "our pricing must not be hardcoded but taken from the admin pricing page." The onboarding services screens (15 "Boost & enhance" / 16 "Services you're interested in") showed SELLING prices from a hardcoded `SVC` constant in `onboarding-shell.tsx`. They now read the SAME live, admin-managed catalog `/pricing` reads. Closes the explicit follow-up logged in the 2026-06-08 canonical-reprice entry below ("onboarding still reads the SVC demo constant … proper server-side wiring is deferred").

**What landed:**
- **New module `apps/web/app/onboarding/wedding/_components/onboarding-pricing.ts`** (pure, server-importable, no `'use client'`/`'server-only'`): `buildOnboardingPricing(customer, bundles, pax?)` turns the two live-catalog fetch results into one plain-JSON view-model (`OnboardingPricing = { svc, bundles, promo }`). Holds the verified 14-key `INAPP_TO_SERVICE_CODE` map (single source of truth), the illustrative `OUT_ANCHORS` (market "if hired elsewhere" anchors — NOT Setnayan prices), and the author-curated `BUNDLE_MEMBERS`.
- **`page.tsx`**: added `export const dynamic = 'force-dynamic'` (mirrors `/pricing`); extended the existing `Promise.all` to also `fetchV2CustomerCatalog()` + `fetchV2BundleCatalog()`; built `pricing` and passed it as a new `pricing` prop to `<OnboardingShell>`.
- **`onboarding-shell.tsx`**: added the `pricing: OnboardingPricing` prop; **DELETED the hardcoded `SVC` table** (both `set` and `out`); every consumer site (savings math ~2289, screen-15 detail card + carousel chip, screen-16 per-row + totals) now reads `pricing.svc[k]` with a crash-safe `₱0` default. Price strings render `pricing.svc[k].label` so the pax SKU (PAPIC_GUEST) shows "from ₱2,999" honestly; flat SKUs show "₱X". `BUNDLE_ITEMS`/`BUNDLE_BENEFIT`/`BUNDLE_ASSET`/`INAPP_VS`/`INAPP_KEYS`/`INAPP_TO_ADDON_SLUG`/`ONBOARDING_PROMO` untouched (display metadata + business rule).

**Untouched (money path byte-identical):** `INAPP_TO_ADDON_SLUG` checkout routing (`/dashboard/{id}/add-ons/{slug}`), `submitOrderAction`, and `resolvePaxPricedOrderCentavos` — the authoritative order charge is still recomputed server-side from `events.estimated_pax` + the catalog at order submit, ignoring any client price. The onboarding wiring is DISPLAY-ONLY.

**⚠ SURFACED FOR OWNER SIGN-OFF:**
- **`BUNDLE_MEMBERS`** (which à-la-carte services each bundle contains) is author-curated — there is NO DB source for bundle membership (no `platform_package_items` table). It drives the displayed bundle "worth/save ₱X". The **bundle UI is DEFERRED** — the `pricing.bundles` view-model is built + typed but currently **UNCONSUMED** by the shell (the flow monetizes à-la-carte only). No invented membership is shown to users until the owner ratifies the list and a bundle card is wired.
- **`out` market anchors** kept as a clearly-labeled illustrative constant (`OUT_ANCHORS`) — permitted by the directive ("those may remain as a clearly-labeled illustrative constant"). No `compare_at`/market column exists in the catalog.

**Verification:** `tsc --noEmit` clean · `next build` succeeds · `/onboarding/wedding` renders dynamic (ƒ) · 0 `SVC[` code references remain · covert rule preserved (no pricing in the love-stage module).

**SPEC IMPACT:** Onboarding now reads live prices from `platform_retail_catalog_v2` + `platform_package_catalog` (no hardcoded selling prices). DECISION_LOG row to add (2026-06-08 onboarding live-wire); the bundle-membership question stays open for the owner.
## 2026-06-08 · feat(pricing): wedding-website phase SKUs in the catalog (RSVP · Event · Editorial)

**Context:** Owner 2026-06-08 — the wedding website is ONE site with 3 date-driven phases (RSVP before · Event during · Editorial after). Added the paid phase SKUs to the admin catalog so they render on the now-DB-driven /pricing + homepage.

**DB (`platform_retail_catalog_v2`, applied to prod via the catalog tables):**
- `RSVP_WEBSITE` "RSVP" ₱2,499 · `RSVP_PRO_WEBSITE` "RSVP Pro" ₱4,499 (= RSVP + ₱2,000) · `EVENT_WEBSITE` "Event Website" ₱1,500.
- (`PRO_WEBSITE` already renamed "Pro Website" → "Editorial Website" ₱7,999 = the post-event phase; Animated Monogram repriced ₱2,499→₱1,999 same day.)

**Code:** added the 3 new service_codes to the `BUILD_STATUS` map as `'partial'` (matching the Editorial/`PRO_WEBSITE` phase — baseline live, upgrades not built) so they show "In build", not the default "Coming soon".

**Verify:** typecheck/build on the PR. /pricing reads the DB, so the rows already render.

**SPEC IMPACT:** New website-phase SKUs in the catalog (RSVP / RSVP Pro / Event / Editorial) → corpus Pricing.md + the wedding-website-lifecycle spec reconcile. Purchase/checkout wiring for the new SKUs is NOT in scope (catalog display only).

## 2026-06-08 · feat(pricing): canonical customer reprice — apply to the live V2 catalog (owner-authorized)

**Context:** Owner authorized ("apply now", 2026-06-08) the canonical customer pricing from `Pricing_Canonical_2026-06-08.md` across the app. The live source is the **V2 customer catalog** (`platform_retail_catalog_v2` + `platform_package_catalog`, read by `lib/v2-catalog.ts` → /pricing, /for-vendors, dashboard checkout) — NOT the retired V1 `service_catalog`. The two bundles were already at canonical (Essentials ₱12,999 / Complete ₱27,999); the retail catalog needed reconciliation.

**What landed:**
- **Migration `20260915000000_pricing_canonical_2026_06_08.sql`** (idempotent, FK-safe — `event_software_activations_v2.service_code` references the catalog, so retirements flip `is_active` only, never DELETE; verified 0 orders reference retired codes). **Applied to prod + recorded in `schema_migrations`.**
  - Repriced 7: Custom QR ₱1,499→999 · Guest Stories ₱1,999→1,499 · Camera Bridge ₱1,999→1,499 · Patiktok ₱2,499→1,499 · Thank You ₱5,499→3,499 · Same Day Edit ₱3,499→**4,999** · Panood ₱3,499→2,499.
  - Added 3: **Setnayan AI ₱3,999** · **Pro RSVP ₱1,999** · **Event Website ₱1,999**.
  - Retired **Today's Focus** (`is_active=false`, superseded by Setnayan AI; 0 orders).
  - Asserted both bundles at canonical (no-op).
- **`onboarding-shell.tsx`** `SVC` demo constant `set` values aligned to canonical for the clean 1:1 maps (SDE 4999, Guest Stories 1499, Animated Monogram 1999, Thank You 3499, Custom QR 999, Panood 2499, advanced_website→7999).

**⚠ SURFACED FOR OWNER SIGN-OFF (deliberately NOT changed):**
- **Papic Guests** — canonical lists ₱1,999 flat, but `PAPIC_GUEST` is the owner-locked **pax-priced** SKU (₱2,999 floor, 2026-06-01 pax lock). Left pax-priced; needs reconciliation in the canonical doc.
- **4 retirements the canonical doc itself flags "confirm"** — left ACTIVE pending sign-off: `HIGH_RES_ARCHIVE`, `CALL_TIME_ESCALATOR`, `INDOOR_BLUEPRINT`, `PAKULAY`.

**Follow-up:** onboarding still reads the `SVC` demo constant, not v2-catalog live; proper server-side wiring is deferred to the Dream Team picker PR (which reworks the end-of-flow services screens).

**SPEC IMPACT:** Pricing corpus — `Pricing_Canonical_2026-06-08.md` is the source applied. DECISION_LOG row added (2026-06-08 canonical reprice applied + 2 open conflicts). Owner to reconcile `Pricing.md §0` + the Papic-Guests-pax / 4-retirement questions.
## 2026-06-08 · fix(home,pricing): de-hardcode homepage PricingSection → read admin catalog DB + reprice bundles/tokens

**Context:** Owner 2026-06-08 — "all values must not be hardcoded · verify from the DB created by admin · find the amount on admin." Root cause of the recurring price drift: the homepage + /for-vendors hard-code their own copies while /pricing reads the DB. This wires the homepage to the DB.

**1 · DB (admin catalog) brought to the owner's locked numbers** (applied to prod via the catalog tables — same effect as /admin/pricing edits):
- `platform_package_catalog`: GUIDED_PACK → "Setnayan Essentials" ₱12,999 · MEDIA_PACK → "Setnayan Complete" ₱27,999 (was Guided Planner Suite ₱11,999 / Comprehensive Media Pack ₱16,999).
- `vendor_billing_catalog` token packs → ₱100/token flat: 4=₱400 · 10=₱1,000 · 25=₱2,500 · 50=₱5,000 · 100=₱10,000 (was ₱1,000/₱2,400/₱5,500/₱10,000/₱18,000 ≈ ₱180–250/token).

**2 · `PricingSection` de-hardcoded** (`_components/marketing/_sections.tsx`): now `async`, reads `fetchV2BundleCatalog` (Bundles card) + `fetchV2CustomerCatalog` (Productions à-la-carte: PANOOD_SYSTEM, SDE, ANIMATED_MONOGRAM). Labels stay; every price is from the DB. Homepage `page.tsx` flipped **force-static → force-dynamic** so admin edits show with no redeploy and the CI build skips the createAdminClient throw (the /pricing pattern).

**Verify:** typecheck/build/Lighthouse/e2e on the PR. `/pricing` already reflects the new DB values.

**SPEC IMPACT:** Bundles Guided/Media → Essentials/Complete (₱12,999/₱27,999) + token ₱100/token now in the DB (= admin source of truth) → corpus Pricing.md §0 reconcile. NOTE: the customer à-la-carte SKUs in the DB are still the OLDER prices (Animated Monogram ₱2,499, Custom QR ₱1,499, Panood ₱3,499/day…), NOT the "Premium stance" à-la-carte (₱1,999/₱999/₱2,499-day) — owner to update in /admin/pricing if intended. Follow-up: de-hardcode /for-vendors (its tier prices already match the DB, just hard-coded).

## 2026-06-08 · feat(onboarding): dashboard bloom — the "Set na 'yan" reveal on the recap screen

**Context:** Next chunk of the adaptive-onboarding port (`Onboarding_Production_Port_Plan_2026-06-08.md` §3). The reveal-before-the-offer: the `congrats` recap becomes the bloom — the couple sees their wedding website already exists.

**What landed (`onboarding-shell.tsx`, `_styles/onboarding.css` — only the `congrats` `<section>` + its CSS):**
- A `.dash-site` reveal card: monogram masthead (reused `MonoLockup`) + couple names + headline "Set na 'yan. ✨ This is the {Surname}–{Surname} wedding — and it already exists."; the existing `WeddingCountdown`; an **"Our Love Story"** block woven by the existing `weaveStory(storyTone, loveStory, ctx)` (shown only when the love stage was told; omitted gracefully otherwise); the existing recap list re-housed under the card; and a display-only share footer (Show {partner} · your page · N guests).
- **COVERT:** the love block is "Our Love Story" only — never editorial/song/Pakanta. Reused `weaveStory`/`MonoLockup`/`WeddingCountdown` (no reimplementation). Nav/commit/redirect untouched.
- **Verified:** `tsc --noEmit` PASS · `next build` PASS · covert grep clean. The congrats `.viewzone` scrolls internally (love-reveal pattern); chrome Continue stays pinned.

**SPEC IMPACT:** None — content/visual enhancement of one existing screen.
## 2026-06-08 · fix(home,0015): homepage Pricing section is customer-only (drop vendor card + ₱1,499 badge)

**Context:** Owner 2026-06-08 — the homepage `PricingSection` had a 3rd "Vendors" card with stale + off-message vendor specs (₱1,999/28d Pro, ₱5,499 Enterprise, "₱1,499 lifetime verification badge"). The homepage is customer-dedicated; vendor pricing belongs on /for-vendors, and verification is now free (₱0, no badge fee).

**What landed (homepage `_components/marketing/_sections.tsx`, presentation only):** PricingSection 3rd card **Vendors → Bundles** (Essentials ₱12,999 · Complete ₱27,999 → /pricing) · intro copy drops "vendor subscriptions" · ClosingCTA drops "₱1,499 verification badge for vendors" → "No commission on vendor bookings, ever." · Footer Vendors column drops the stale-priced links → "Why Setnayan for vendors · Register your business · Price tiers · Vendor handbook" (no prices).

**Verify:** markup/copy only, no type/DB change. Vercel preview on the PR.

**SPEC IMPACT:** None on SKU data (verification-badge fee retired → Verified ₱0 per the 2026-06-08 vendor-pricing DECISION_LOG row). Follow-up: a separate customer-planner "₱1,499" line in `_sections.tsx` may be stale vs the locked Setnayan AI ₱3,999 — left pending owner confirm.

## 2026-06-08 · feat(onboarding): The Mirror — live wedding-website preview ribbon

**Context:** Next chunk of the adaptive-onboarding port (`Onboarding_Production_Port_Plan_2026-06-08.md` §4). A persistent preview that makes the flow read as "watch your wedding website build itself."

**What landed (`onboarding-shell.tsx`, `_styles/onboarding.css`):**
- A pinned `.mirror` ribbon inside `.top` (under the progress bar), ~56–60px, from the `name` screen onward (hidden during the welcome-moments conversation, on the love reveal, and on the recap/plan/summary full-preview screens).
- A derived `useMemo` read-model (no new authoritative state): live monogram initials + couple names + accreting `.mir-chip` pills — the love-story tone voice ("Our Love Story"), kind, location, guests, countdown, reception — each popping in once as its source fills, with a payoff caption that flashes over the chip row then reverts. Chips overflow horizontally; the ribbon never grows the no-scroll frame.
- **COVERT:** chips surface only wedding-website-shaped facts; never a song/editorial/Pakanta chip (only the allowed tone-voice "Our Love Story").
- **Verified:** `tsc --noEmit` PASS · `next build` PASS · covert grep clean · `prefers-reduced-motion` disables the animations.

**SPEC IMPACT:** None — additive read-model over existing onboarding state.

## 2026-06-08 · feat(onboarding): adaptive id-array nav core + told-back love stage

**Context:** First production landing of the adaptive-onboarding port (plan `Onboarding_Production_Port_Plan_2026-06-08.md`, specs corpus). The nav core swap + the told-back love stage, in one PR (merged cleanly with the concurrent #1071 pure-moment intro).

**What landed (`onboarding-shell.tsx`, `types.ts`, `actions.ts`, new `_components/weave-story.ts`, `_styles/onboarding.css`, migration `20260914000000_love_story_covert_renames.sql`):**
- **Nav core:** `step === N` → string-id `FLOW_IDS` + `buildSequence(kind, authed, loveSkipped)`; forks (Civil→skip faith · authed→skip account · loveSkipped→skip the 5 love screens) are array membership. `state.step` stays a number (drafts unchanged) = index into the sequence; `activeId` derived per render; `go()`/`goToId()` by sequence index. #1071's `finishMoments` is now `goToId('name')` (id-addressed, civil-safe).
- **Love stage (6 screens after `name`):** Hook · Spark+Almost · The Yes · Little Things · Voice · Reveal — sentence-stems + causal follow-ups + obstacle beat + two-voice braid + a told-back "published page" reveal via `weave-story.ts`. New `OnboardingState` love fields written to `events` at commit (best-effort). Migration renames `editorial_tone → story_tone` / `editorial_language → story_language` + documents the `love_story` v2 JSONB (applied to prod). **COVERT:** love copy names only "your wedding website" — never editorial/song/Pakanta (grep-gated).
- **Verified:** `tsc --noEmit` PASS · `next build` PASS · `playwright e2e` PASS · covert grep clean.

**SPEC IMPACT:** None on prices/SKUs. Mirror + Stage-4 pricing + dashboard bloom follow in later PRs.

## 2026-06-08 · fix(for-vendors,0015): correct stale vendor pricing + token model on the marketing page

**Context:** Owner 2026-06-08 — the live `/for-vendors` page showed the WRONG vendor pricing (₱2,499/₱5,499 + a ₱1,499 verification fee + a "Free" tier), contradicting the actual backend. The DB (`vendor_billing_catalog`, migration `20260911000000_vendor_tier_reprice_verified_free`) + `/pricing` already reflect the real model — this PR fixes the stale hard-coded marketing page to match. No DB / backend change.

**The real model (already in the DB, now on the page):** **Verified ₱0** (free to get; no unverified-Free tier marketed) · **Pro ₱6,000/28d** (₱60,000/yr · save ₱18,000) · **Enterprise ₱10,000/28d** (₱100,000/yr · save ₱30,000) · **Token = ₱100 flat**, Pro/Enterprise burn **1–3 tokens (₱100–₱300), region-banded** (`token_burn_bands`) to unlock a couple (covers all their services), 100 free on verification. Matches `unlock_vendor_event`.

**What landed (presentation only, 5 files):** `vendor-hero` · `for-vendors-deep-dive` 4-tier table + annuals + Enterprise callout · `stack-close-vendor` · `page-tail` money FAQ · `page.tsx` SEO metadata + 5 schema.org Offers.

**Verify:** markup/SEO copy only, no type/DB change. Vercel preview + Lighthouse on the PR.

**SPEC IMPACT:** Corrects the corpus stale vendor price (CLAUDE.md SKU table + Pricing.md §0.C) → ₱6,000/₱10,000 + Verified-₱0 + ₱100-token (DECISION_LOG row appended 2026-06-08). Follow-up: customer-dedicated nav + footer vendor menu.

## 2026-06-08 · feat(0016): pure-moment conversational onboarding intro (prototype→prod port)

**Context:** Audit (this session) found the owner-2026-06-05 "pure-moment" conversational welcome — Setnayan "speaks" line-by-line, role/kind/faith asked inline, no Continue button — was built into the production-mirror prototype `Onboarding_Wedding_Flow_2026-06-01.html` but never ported to the live React onboarding (`apps/web/app/onboarding/wedding`), which still opened on a static hero + three separate Continue screens. Owner approved a full faithful port.

**What landed:**
- **New `app/onboarding/wedding/_components/welcome-moments.tsx`** — self-contained moment player. `speak` lines auto-advance (dwell scales with length; tap to skip) beside the gold Setnayan mark; `ask` beats collect role → kind → faith inline; civil skips the faith beat; the `when` gating mirrors the prototype `MOMENTS` script verbatim. Offers the LIVE active faith set (not the prototype's stale five) so coverage never narrows before the hand-off.
- **`_components/onboarding-shell.tsx`** — step-0 welcome plays the conversation on first arrival then hands off to the Name screen (step 4); progress bar + bottom Continue are hidden during the conversation; the plain hero shows on back-nav re-entry so the screen never traps. Standalone role/kind/faith screens (steps 1-3) are retained as back/edit targets (matches the prototype).
- **`_styles/onboarding.css`** — `.onbw`-scoped moment styles (`ob-momentIn`, `fm-react` serif line + `say-mark`, stacked `m-opt` cards) + `prefers-reduced-motion` fallback.

**Not ported (flagged for owner):** the prototype's over-budget venue copy ("A touch over budget — still yours to consider" / "In your range") depends on per-venue pricing that the live `OnboardingVenueResult` / `searchOnboardingReceptionVenues` does not return; surfacing it would mean inventing prices (guardrail), so it needs a real data-wiring task + an owner call on showing venue prices in onboarding. Deferred.

**Verify:** `pnpm typecheck` clean; `pnpm lint` clean (no new warnings — pre-existing warnings only); browser verification on the PR's Vercel preview deploy (`/onboarding/wedding`).

**SPEC IMPACT:** None — brings live code in line with the already-locked owner-2026-06-05 prototype decision (no new product decision). The over-budget venue-pricing gap is flagged for owner, not silently changed.

---

## 2026-06-08 · feat(website): Special Message content block (live invitation site)

**Context:** Increment A.1 of the wedding-website lifecycle (`Wedding_Website_Lifecycle_Spec_2026-06-07`). First content block built on the shipped schema foundation — a couple's note to guests, rendered live on the invitation site.

**What landed:**
- Migration `20260913000000_invitation_widgets_special_message.sql` — adds the `special_message` widget_type (CHECK + seed trigger + backfill); reads `events.special_message` (shipped 20260912000000).
- `lib/invitation-widgets.ts` — `special_message` in WIDGET_TYPES + catalog (editor_subroute `special-message`), so it appears in the widget show/hide/reorder editor automatically.
- `app/[slug]/page.tsx` — `SpecialMessageWidget` rendered on both the authed-guest and anonymous-public paths; **blank message → section hides** (no demo state).
- New editor `app/dashboard/[eventId]/website/special-message/` (page + server action) — single textarea (≤600 chars) writing `events.special_message`, RLS-gated.

**Verify:** CI typecheck + lint; migration additive + idempotent; applied to prod via `supabase db push`.

**SPEC IMPACT:** §6.5 content block shipped → DECISION_LOG. Remaining blocks (Our Love Story · What to Bring · Our Photos) follow the same pattern.

## 2026-06-08 · fix(marketing,0015): mobile hero overflow — responsive headline sizes

**Context:** Owner 2026-06-08, reviewing setnayan.com on a phone: "having those large texts ate up the whole screen and we already lost the sale." The homepage `Hero` (`app/_components/marketing/_sections.tsx`) hard-coded the "Set na 'yan." `<h1>` to a fixed `fontSize: 152` and the "Plan your wedding the easy way" headline to a fixed `76`, inside `px-14` (56px) side padding — none responsive. On a 375px phone the headline can't fit, pushing the primary CTA far below the fold.

**What landed (Hero only — presentation):**
- `<h1>` "Set na 'yan." → `fontSize: clamp(3.1rem, 13vw, 152px)` (≈50px on a 375px phone · still 152px on desktop).
- Headline "Plan your wedding the easy way" → `clamp(1.9rem, 6vw, 76px)`.
- Hero padding responsive: `px-5 pt-10 pb-12 sm:px-8 sm:pt-14 lg:px-14 lg:pt-20` (was fixed `px-14 pt-20`).
- The secondary "Wedding today. Every celebration tomorrow." pill → `hidden sm:inline-flex`, lede/CTA top-margins tightened on mobile, so the "Start planning · free" CTA sits above the fold on a phone.
- Desktop hero is visually unchanged (the clamps cap at the original 152/76px).

**Verify:** CSS/markup only, no type changes. Vercel preview + Lighthouse on the PR.

**SPEC IMPACT:** None (presentation-only; no copy / SKU / pricing change). Tracked follow-up: the other 11 marketing sections share the same fixed `px-14` + `120px` vertical paddings → a broader mobile-padding pass, plus the new `/apps` + `/about` pages, the Premium-stance pricing ladder (a `v2-catalog` data change), and real photography.

## 2026-06-07 · feat(website): wedding-website lifecycle foundation (schema)

**Context:** Owner design session locked the couple's event website as ONE site with three date-driven phases (RSVP before · Event during · Editorial after) — spec `Wedding_Website_Lifecycle_Spec_2026-06-07.md` + corpus DECISION_LOG. This PR ships the safe, additive schema foundation; nothing consumes it yet (frontend ships ahead).

**What landed (`20260910000000_wedding_website_lifecycle_foundation.sql`, applied to prod):**
- **`events.*`** — looping bg music (`site_bg_music_source`/`_r2_key`/`_enabled`), scrub-video hero (`landing_page_hero_video_r2_key`), auto-editorial storyline inputs (`love_story` JSONB, `special_message`, `together_since`, `editorial_tone`, `editorial_language`).
- **`event_vendors.selection_match_rank`** — was this vendor the #1 leaf-match at selection (powers the Editorial "By the Numbers" first-pick stat; forward-only).
- **`event_editorial`** — per-event recap snapshot (`draft_json` + frozen `impact_metrics` + hero/essay refs); RLS: couple + accepted moderators read/write, admin read.

**Deferred (decision / atomic renderer ship):** `invitation_widgets` per-phase (renderer-coupled) + event-level review/feedback table (reconcile vs existing `vendor_reviews`).

**Verify:** purely additive (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`), idempotent, RLS at table create; CI green; migration applied to prod via `supabase db push`.

**SPEC IMPACT:** Wedding-website lifecycle model → `Wedding_Website_Lifecycle_Spec_2026-06-07.md` + DECISION_LOG 2026-06-07 (landed). 0002 / 0021 / 0031 fold-in pending.

## 2026-06-07 · feat(vendor-tiers): Phase B — count caps (agents · portfolio · parent categories)

**Context:** Phase B of the tier matrix (owner: build all phases in sequence). Enforce the numeric caps from `Vendor_Tier_Capability_Matrix_2026-06-07.md`, all reading the `lib/vendor-tier-caps.ts` helper. No migration (app-layer). A pre-build audit found 2 of the 5 caps are blocked — see "Deferred" below.

**What landed:**
- **Agent accounts** (FREE 0 · VERIFIED 1 · PRO 3 · ENTERPRISE ∞) — `inviteVendorTeamMember` (`team/actions.ts`) soft-probes `tier_state`, counts existing non-owner seats, blocks past the cap (FREE = 0 blocks all invites).
- **Portfolio photos** (30 · 50 · 100 · ∞) — `saveVendorProfile` (`vendor-dashboard/actions.ts`) caps `parsePortfolioRefs` by tier (was a hardcoded 10, *below* even FREE's 30); the profile page's portfolio `<FileUpload maxFiles>` + help text are now tier-driven (∞ → 999 UI sentinel) so paid vendors can actually upload up to their cap.
- **Parent categories** (1 · 3 · 3 · ∞) — `createVendorService` (`services/actions.ts`) blocks a service that would introduce a NEW parent (of the 10) beyond the tier allowance, via `tilesForVendorCategory()` → `TILE_PARENT` (NOT `TAXONOMY_MAP`); adding within already-covered parents is free.

**Deferred (blocked — need owner input, flagged):** packages-per-leaf (`vendor_services` already `UNIQUE` 1/leaf; `vendor_packages` has no vendor-side create path → definition decision needed) · slots-per-day (no per-day slot ledger; `slotsTimeBounded` needs schema → design + migration).

**Verify:** `tsc` clean · `next lint` exit 0. No migration.

**SPEC IMPACT:** Phase B caps 2/3/4 enforced; caps 1/5 flagged as blocked. → corpus DECISION_LOG.

## 2026-06-07 · fix(marketplace,0026): demo-vendor leak in dashboard search + retire Form 2307 (EWT) + customer /more desktop redirect

Three follow-ups from the dashboard/connection audits:

**Demo-vendor leak (prod-pollution fix).** The in-dashboard couple "add a vendor" search (`searchCategoryVendors` → `fetchWizardVendorRecommendations`) had **no `is_demo` filter**, so all ~4,900 seeded demo vendors were visible to **every real couple** — even though the public `/vendors` browse + `/v/[slug]` microsite correctly hide them. Extracted the local `fetchDemoVendorIds` helper from `app/vendors/page.tsx` into shared `lib/demo-vendors.ts`, and wired the dashboard caller to exclude demo vendors (`excludeVendorIds`) **unless the viewer is in demo mode** (admin + demo cookie) — mirroring the public browse exactly. Public browse behavior unchanged.

**Retire Form 2307 / EWT generation (0026).** With **0% commission + off-platform vendor money**, Setnayan never withholds tax on a vendor's sale, so the BIR Form 2307 (Certificate of Creditable Tax Withheld) generation is dead. Deleted the orphaned `api/admin/bir/2307/regenerate` route, the `api/admin/cron/generate-2307` cron, and the entire self-contained `lib/bir/` tree (generator/2307-pdf/filings/storage/atc-mapper — the only importers were the two deleted routes). **The BIR Official Receipt auto-stamping on Setnayan's own in-app SKU sales is a different, live, marketed feature and was deliberately left intact** (receipts pages, `issueReceiptForOrder`, TIN, marketing copy all untouched). Net −1,971 lines.

**Customer `/more` desktop blank page.** `app/dashboard/[eventId]/more` rendered an `lg:hidden` mobile landing → blank on desktop direct-URL (same issue the vendor `/more` was just fixed for). Added a `DesktopRedirect` (matchMedia ≥1024px → `router.replace` to the event-scoped dashboard root).

**Verify:** `pnpm typecheck` ✅ · `pnpm lint` ✅.

**SPEC IMPACT:** marketplace (demo vendors now hidden from real couples in dashboard search, consistent with the public surfaces) + 0026 (Form 2307/EWT retired — corpus AS-BUILT headers already note BIR 2307 retirement; in-app-sale BIR Official Receipts retained). No SKU/pricing change.

## 2026-06-07 · chore(vendor-tiers): FREE may buy tokens (for client import)

**Context:** Owner clarification on the tier rules: (1) "FREE won't get in-app customers, but FREE-VERIFIED will" — already enforced (`unlock_vendor_event` blocks FREE via `TIER_FREE_NO_INAPP`; FREE-VERIFIED gets its 10/week free), **no change**. (2) "Let FREE buy tokens to import their clients" — overrides the reissued sheet's "Cost per additional Lifetime Token: Not Allowed (FREE)".

**What landed:** `canBuyTokens()` (`lib/vendor-tier-caps.ts`) now returns true for **all** tiers including FREE. A FREE vendor's only token sink is the Import Customers gate (1 token/import); buying never unlocks in-app for FREE (tier-blocked regardless of balance). The buy-token checkout + the import-customer token-charge are still **Phase D** (neither built) — this is the capability flag + the rule.

**Verify:** `tsc` clean · `next lint` clean. No migration.

**SPEC IMPACT:** Matrix doc buy-token row updated (FREE may buy, for client import). → corpus DECISION_LOG.

## 2026-06-07 · feat(vendor-tiers): reissued sheet — reprice + verified-free gate + subscription token bundle

**Context:** Owner reissued the tier sheet ("how much they pay and the benefits"). Capabilities unchanged; pricing + token mechanics changed. Owner confirmed the two open points: **verified is FREE** (revert Phase A's verified-burn) and **grant the subscription token bundle on admin tier-set now** (interim until Phase D self-serve checkout).

**What landed (migration `20260911000000`, applied to prod):**
- **Reprice** (round numbers — break the brand charm/-1 lock, owner-set explicitly; supersede Phase A's ₱3,999/₱9,999): Pro **₱6,000/28d · ₱60,000/yr**, Enterprise **₱10,000/28d · ₱100,000/yr** (`vendor_billing_catalog`).
- **Verified-free burn gate** — `unlock_vendor_event` re-created: **FREE → RAISE** (blocked) · **FREE-VERIFIED → ≤10 NEW unlocks/rolling-week, FREE (0 tokens, no burn)** · **PRO/ENTERPRISE → unlimited, burn 1-3 region-banded tokens**. Re-accept stays free + un-gated. This reverts the verified-burn shipped hours earlier in Phase A (PR #1061), per the reissued sheet's In-App-Gate ✗ for verified.
- **Subscription token bundle on admin tier-set** — `setVendorTier` now grants the monthly bundle (Pro **+30**, Enterprise **+100**, 28-day TTL) via `grant_admin_direct_tokens`, idempotent per `(vendor, tier)`. Interim activation; the per-renewal grant + annual amounts (300 / 1,000) come with Phase D.
- **Helper** (`lib/vendor-tier-caps.ts`) — `TIER_PRICE_PHP` updated; `verified.inAppGated=false`; new `TIER_SUBSCRIPTION_BUNDLE_TOKENS`, `TOKEN_BUY_PRICE_PHP` (₱100), `canBuyTokens()` (FREE = ✗ "Not Allowed", per the new "Cost per additional Lifetime Token" row).

**Verify:** `tsc` clean · `next lint` exit 0 · migration applied + "remote database is up to date."

**SPEC IMPACT:** Tier matrix doc updated (new prices + token-bundle + buy-token rows). Verified is now token-free for in-app answers (reverts the same-day Phase A choice). Buy-token flow (₱100/token, FREE-not-allowed) + per-renewal bundle = Phase D. → corpus DECISION_LOG.

## 2026-06-07 · fix(0022,0023): vendor+admin dashboard mobile/desktop parity batch + BIR nav retirement

**Context:** A mobile/desktop UI audit of the vendor (24 routes) and admin (51 routes) dashboards found both structurally healthy, with a small set of parity gaps — chiefly two admin surfaces reachable only on desktop. This batch fixes all of them (no new features).

**Admin:**
- **`/admin/payment-options` → reachable on mobile** — added to the `/admin/queues` triage feed (live count = `vendor_payment_methods` with `moderation_status IN (pending_review,held)`) + the Queues bottom-nav `activeMatch`. It's a vendor-payment fraud screen that was desktop-only.
- **`/admin/connection-logs` → reachable on mobile** — added a card to the `/admin/more` Insights grid + the More `activeMatch`.
- **BIR retired from nav (owner-authorized 2026-06-07):** removed `/admin/bir` from the Money `activeMatch`, dropped "BIR" from the `/admin/money` subtitle, and **deleted the dead `app/admin/bir/2307/` tombstone tree** (page + loading + 2 unused components). The 2307 generation API + cron routes are kept (page refs cleaned) — full 0026 retirement is a separate step.
- **Responsive tables:** `discount-codes` list now hides low-priority columns below `lg`/`md` + responsive `min-w` (was a forced 900px scroll on phones); `budget-planner` aggregate table `overflow-hidden` → `overflow-x-auto` + `min-w`.
- Root Overview copy "Content" → "Manage"; stale nav docstrings refreshed to the real 6 groups; Directory mobile `activeMatch` gains `wedding-types`/`wedding-traditions`; token-bands parity in the Money tab.

**Vendor:**
- **`moodboard-library` 404 fix** — the page hard-gated on `account_type==='vendor'`; realigned to the layout's `fetchOwnVendorProfile`/vendor-profile gate so a dual-role owner no longer 404s.
- Mobile More-tab `activeMatch` gains `repertoire`/`branches`/`payment-options`; `repertoire`/`branches` descriptions added to `/more`; new `DesktopRedirect` so `/vendor-dashboard/more` no longer renders a blank page on desktop direct-URL; stale docstrings refreshed to the real 4 groups.

**Verify:** `pnpm typecheck` ✅ · `pnpm lint` ✅ (only pre-existing warnings in untouched files). Net −138 lines (BIR tombstone removal).

**SPEC IMPACT:** 0022 (vendor dashboard) + 0023 (admin console) — nav/grouping/mobile-parity corrections; BIR (0026) nav refs + tombstone retired (corpus AS-BUILT headers already note BIR retirement; full 0026 feature retirement is a separate decision). No SKU/pricing/customer-facing change.

## 2026-06-07 · feat(vendor-tiers): Phase A — capability foundation + pricing + tier-gated burn

**Context:** Owner provided the canonical 4-tier capability matrix (FREE / FREE-VERIFIED / PRO / ENTERPRISE — corpus `Vendor_Tier_Capability_Matrix_2026-06-07.md`). Audit found it ~13/19 rows unenforced and `tier_state` inert (no way to reach Pro/Enterprise). Owner chose: build everything (phased), matrix prices win, and **all paid tiers (verified+pro+ent) burn tokens — only FREE is blocked**. This is **Phase A of 5** (foundation + the token-gate correctness fix). Phases B–D (count caps · feature gates · self-serve checkout) follow.

**What landed:**
- **`apps/web/lib/vendor-tier-caps.ts`** — the canonical matrix in code (`TIER_CAPS` for all 4 tiers + `TIER_PRICE_PHP`, `TIER_LABEL`, `tierCaps()`, `isTrueNameTier()`, `canAcceptInAppInquiries()`). Single source every later phase reads from.
- **Migration `20260910000000` (applied to prod):**
  - **Price alignment** (owner: matrix wins) — `vendor_billing_catalog` Pro ₱1,999→**₱3,999**/mo (₱19,999→**₱39,999**/yr), Enterprise ₱5,499→**₱9,999**/mo (₱54,999→**₱99,999**/yr); Pro caps corrected to the matrix (`max_categories` 1→3, `max_sub_seats` 5→3). /pricing reads the catalog.
  - **Tier-gated `unlock_vendor_event`** (CREATE OR REPLACE, supersedes the tier-blind 20260908000000): **FREE → RAISE** (can't accept in-app inquiries); **VERIFIED → ≤10 NEW unlocks/rolling-week AND burns** 1-3 tokens each (owner override of the matrix "gate ✗" cell — verified pays too); **PRO/ENTERPRISE → unlimited + burns**. Re-accepting an already-unlocked (vendor,event) stays free + un-gated (idempotent; weekly limit counts only new unlocks). Still ownership-checked + rolls back on any RAISE.
- **`acceptInquiry`** now surfaces tier-appropriate messages for the new RAISE codes (`TIER_FREE_NO_INAPP` → "get verified"; `VERIFIED_WEEKLY_LIMIT` → "10/week reached, upgrade to Pro").
- **Admin tier control** — `setVendorTier` action + a "Subscription tier" selector on `/admin/vendors/[id]/tokens` (co-located with token grants). Until self-serve checkout (Phase D) this is the only way to reach Pro/Enterprise; audit-logged.

**Deferred to later phases:** name-reveal/searchability reading `tier_state` (Phase C — needs `tier_state` threaded through marketplace/microsite reads); count caps (B); feature gates chat/video/editorial/review-comments/website/radius/scheduling (C); self-serve subscription checkout (D).

**Verify:** `tsc` clean · `next lint` exit 0 · `lint:retired` 0 · migration-timestamp guard. Migration applied + "remote database is up to date."

**SPEC IMPACT:** Vendor tier matrix is now canonical (`project_setnayan_vendor_tier_ladder` superseded). Prices ₱3,999/₱9,999 supersede catalog + prior memory. Burn is now tier-gated (revises the PR #1057 tier-blind burn + the "tokens universal all tiers" lock — FREE blocked). → corpus DECISION_LOG + Pricing §0.C / 0022 follow-up.

## 2026-06-07 · feat(ghosting): login-driven inquiry-ghosting nudges — no cron

**Context:** Owner directive (2026-06-07): instead of a background ghosting-escalation cron, check at LOGIN using the actor's login time as the clock — "this will never run in background and will only run upon login," because a background sweep won't scale to 250k vendors / 1M active accounts. PR 2 of 2 (PR 1 = token burn-on-answer).

**What landed (migration `20260909000000_login_ghosting_check.sql`, applied to prod):**
- **`users.last_ghost_check_at`** column + the previously-dead **`users.last_login_at`** is now actually written. `stampLastLogin` (`lib/login-activity.ts`) fires at the two real login-completion points — `signInWithPassword` (`app/login/actions.ts`) and `/auth/callback` (magic link / OAuth).
- **Two notification types** — `inquiry_awaiting_reply` (vendor) + `inquiry_no_response` (couple) — added to the enum + `lib/notifications.ts` union/label/tone.
- **`runLoginGhostingCheck(userId, role)`** (`lib/ghosting.ts`) — runs from the customer + vendor dashboard layouts via Next `after()` (post-response, zero render cost). Gated to fire **once per login** by comparing `last_login_at` to `last_ghost_check_at`, using the login moment as "now". Detects `chat_threads.inquiry_status='pending'` older than 48h (the indexed, accept-gate "unanswered" signal): couple side → "a vendor hasn't replied, explore alternatives"; vendor side → "you have inquiries awaiting your reply." Then stamps `last_ghost_check_at`. Service-role + fail-soft throughout; no background job, no cron.

**Why this shape:** the spec's `vendor_unresponsive_48h` was never implemented (it implied a cron). This delivers the same escalation on the login event instead — O(1) per login, indexed queries scoped to the actor's events/profiles, and `after()` keeps it off the render path.

**Verify:** `tsc` clean · `next lint` exit 0 · `lint:retired` 0 · migration-timestamp guard. Migration applied + "remote database is up to date."

**SPEC IMPACT:** Implements ghosting escalation as login-driven (supersedes the cron-based `vendor_unresponsive_48h` notion in 0028; consistent with `project_setnayan_cron_free`). → corpus DECISION_LOG + the cross-actor follow-ups doc (item 5 now built).

## 2026-06-07 · feat(token-economy): connect burn-on-answer + anti-merge enforcement

**Context:** Owner: "we need to connect the tokens properly." The vendor token economy was economically inert — vendors answered inquiries for free (`unlock-category.ts` literally said the burn "is NOT wired yet"). This wires the owner-locked (2026-06-05) burn-on-answer, plus the owner's strict free-token rules. PR 1 of 2 (PR 2 = login-driven ghosting).

**What landed (migration `20260908000000_vendor_token_burn_on_answer.sql`, applied to prod):**
- **`vendor_event_unlocks`** — the per-`(vendor_profile_id, event_id)` idempotency record (UNIQUE), the "one unlock covers ALL the vendor's services for that event" contract. RLS: vendor reads own, admin reads all, writes only via the RPC.
- **`token_burn_bands`** — admin-editable region → band/token map (wages drift). Seeded the proposed map: band 3 = ₱300 (NCR/CALABARZON/Central Luzon), band 2 = ₱200 (mid-wage regions), band 1 = ₱100 (lowest-wage regions), plus `__default__` (band 1 floor for unknown/blank region). ₱100/token, so 1/2/3 tokens. **⚠ Owner to ratify the exact band→region map** (admin-editable at `/admin/token-bands`).
- **`unlock_vendor_event(vendor, event)` RPC** (SECURITY DEFINER) — atomic + idempotent: resolves the wedding's region (`events.region`) → band → tokens, `INSERT … ON CONFLICT DO NOTHING` (the gate), and only on a fresh insert burns via the existing `consume_vendor_assets_per_voucher` (FIFO + audit). Insufficient balance RAISES `INSUFFICIENT_WALLET_BALANCES` → the whole tx rolls back (no phantom unlock). **Ownership-checked** (`vendor_profiles.user_id = auth.uid()`) so a SECURITY DEFINER function granted to `authenticated` can't burn another vendor's tokens.
- **Anti-merge enforcement** — `forbid_vendor_id_reassignment()` BEFORE-UPDATE triggers on `vendor_wallets` / `earned_token_vouchers` / `token_grants_log` / `token_redemptions_log` make `vendor_id` **immutable**: a vendor's tokens/wallet/ledger can never be reassigned to another vendor. This makes the owner's "their data can never be merged to another vendor" rule impossible to violate even if a merge feature is ever built (none exists today).
- **Burn wired into `acceptInquiry`** (`lib/chat-actions.ts`) — accepting an inquiry IS the answer (a vendor can't reply before accepting). Burns once before flipping `pending→accepted`; insufficient balance blocks the accept with a friendly top-up prompt; a re-accept never double-charges.
- **Admin `/admin/token-bands`** page + `updateBand` action + sidebar entry (Money group) — the locked admin-editable surface.

**Free tokens for new vendors (strict) — already shipped, confirmed:** the 100-free-on-verification grant (DB trigger on `verification_state→'verified'`, idempotent once-per-lifetime via `token_grants_log` + `token_rewards_log`) already satisfies "verified-only." This PR adds the "never merged" half (the immutability triggers). **⚠ Owner decision flagged:** two "approve" surfaces exist — Part A `approveVendor` sets only `public_visibility='verified'` (does NOT grant); Part B `approveApplication` flips `verification_state` (DOES grant). Confirm which is the canonical verification gate so granted vendors are a consistent set.

**Verify:** `tsc` clean · `next lint` exit 0 (no hits in changed files) · `lint:retired` 0 · migration-timestamp guard (unique prefix). Migration applied + "remote database is up to date."

**SPEC IMPACT:** Vendor token economy (`project_setnayan_vendor_token_model`) — burn-on-answer now wired (was inert), banded map seeded (pending ratify), anti-merge enforced. → corpus DECISION_LOG + `Token_Economy_Flow_Map_2026-06-01.html` / Pricing §0.C follow-up.

## 2026-06-07 · fix(loading): app-wide loader sweep — close the last gap (admin/notifications)

**Context:** Owner asked for a completeness sweep after several one-off loader misses. Ran a 3-agent audit across **customer**, **vendor**, and **admin** doorways + a cross-cutting hand-rolled-loader hunt over all of `apps/web`.

**Result — coverage is strong:** 164 of 167 `loading.tsx` use the shared skeleton system; **every customer and vendor data-fetching route already has a matched loader** (the vendor side the owner hadn't checked is clean — 28/28). Found exactly **one real gap**: `app/admin/notifications/page.tsx` is async (fetches the admin's notifications) but had **no `loading.tsx`** → blank during fetch.

**Fix:** added `app/admin/notifications/loading.tsx` (`export { ListPageSkeleton }`, matching the one-line convention of the other 63 admin loaders).

**Noted, not changed (no gap):**
- `dashboard/[eventId]/vendors/loading.tsx` + `…/vendors/[eventVendorId]/workspace/loading.tsx` — bespoke CSS spinners but **owner-designed (2026-06-05) and already narrated via `<LoadingStatus>`**; working as intended. Optional future consolidation onto the shared loader — left as-is pending owner sign-off.
- `admin/offline/_components/offline-diagnostic-loader.tsx` — a `next/dynamic` text fallback, justified by the `ssr:false` Server-Component boundary; low-visibility, acceptable.

**SPEC IMPACT:** None — loading-UX completeness; no schema/SKU/scope change.

## 2026-06-07 · fix(loading): notifications — branded, layout-matched loading shell

**Context:** Customer report (owner 2026-06-07) — opening **Notifications** showed "no load." The route *did* have a `loading.tsx`, but it was a bare `ListPageSkeleton` re-export: generic pulsing blocks, no "what we're doing" cue, that don't match the notifications screen — on a quick fetch it flashed imperceptibly and never read as a deliberate loading state.

**Fix (`app/dashboard/notifications/loading.tsx`):** replaced the bare re-export with a purpose-built shell that mirrors the real page (back link + header + 5 notification-row skeletons) and adds the branded `<LoadingNarration>` strip ("Loading your notifications… / Checking for new messages and updates…"). The page fetches auth + the notifications list, so this is a genuine Suspense fallback. `tsc` + `next lint` clean.

**Note on "More":** the customer **More** tab (`/dashboard/[eventId]/more`) was also flagged, but it's a *static menu* — it does no data fetch (just renders a grid of links from a pure config), so it renders instantly and there is genuinely nothing to load. Forcing a loader there would be an artificial delay, so it's intentionally left as-is.

**SPEC IMPACT:** None — loading-UX polish; no schema/SKU/scope change.


## 2026-06-07 · fix(loader): onboarding-completion overlay now uses `<SDLoader>`

**Context:** Owner spotted (live mobile screenshot) that the post-onboarding **"Creating your personalized dashboard"** overlay still showed the *old* loader — a thin ring spinner + static mark + cycling sub-text. It was a bespoke loader (`onboarding-shell.tsx`, owner 2026-06-02) that the targeted `<SDLoader>` rollout hadn't touched. This is a textbook "personalized work" moment, so it now uses the brand loader.

**What changed (`app/onboarding/wedding/`):**
- `_components/onboarding-shell.tsx` — the `finishing` overlay's `.fin-loader` (ring spinner) + static SVG mark + `.fin-sub` are replaced by `<SDLoader steps={ANALYZING_STAGES} hint="Personalizing" />`. The premium serif title ("Creating your personalized dashboard", owner 2026-06-02) is **kept** above it. Removed the now-redundant `finStage` state + its cycling `useEffect` (the loader narrates internally); dropped the trailing "…" from `ANALYZING_STAGES` (the loader has its own thinking dots). `ANALYZING_HOLD_MS` + the preload/navigation timing are untouched.
- `_styles/onboarding.css` — removed the dead `.fin-mark` / `.fin-spinner` / `.fin-sub` rules + the `finspin` keyframe; added `.fin-inner .sd-loader{background:transparent;min-height:0;margin-top:-28px}` so the loader blends with the overlay's paper and tucks neatly under the title; reduced-motion rule simplified.

**Verify:** `tsc --noEmit` + `next lint` clean · harness screenshot (mobile 375×812) confirms the new composition — serif title + animated mark (orbit + gathering particle) + "Analyzing your preferences" narration + "PERSONALIZING" hint, well-balanced. CI is the hard gate.

**SPEC IMPACT:** None — swaps one loader's visual for the shared brand loader; the overlay's blocking/preload behavior + copy are unchanged.

## 2026-06-07 · feat(0022/0023/0028): cross-actor signal wiring — close the silent one-way breaks

**Context:** Dedicated cross-actor interaction audit (customer action → vendor signal → admin control) over shipped `origin/main`. Finding: the **only** two-way customer↔vendor channel is the inquiry chat; every other couple action mutates `event_vendors` (couple-only RLS) and never reaches the vendor — so a couple could finalize/book, review, or cancel a marketplace vendor and the vendor was never told. Plus two admin governance gaps: `/admin/disputes` was read-only and admins had no in-app notification reader despite receiving notification rows. Owner authorized the "everything safe" tier; the locked-economics items (token burn-on-answer, two-admin gate, anti-fraud surface, chat moderation, ghosting escalation) were scoped-only, not built.

**What landed:**
- **Migration `20260907000000_notification_types_cross_actor_signals.sql`** — adds `booking_confirmed`, `review_received`, `booking_cancelled`, `dispute_filed` to `public.notification_type` (ADD VALUE IF NOT EXISTS). **Applied to remote DB this session** via `supabase db push` (also flushed the pending `20260903…` fix). `lib/notifications.ts` union + both exhaustive label/tone Records extended.
- **booking_confirmed → vendor** (`vendors/actions.ts` `finalizeVendor`) — the #1 break. After a successful lock, the marketplace vendor gets a dual-channel notification (in-app + email) deep-linking the chat thread. Manual/off-platform vendors keep the existing claim-link invite (sibling `else if`). Best-effort/fail-soft.
- **review_received → vendor** (`vendors/[vendorId]/review/actions.ts` `submitCoupleReview`) — vendor is notified the moment a couple posts a review. Makes the vendor Reviews-page "we notify you via email" claim TRUE (copy also tightened to name both channels).
- **booking_cancelled → vendor** (`vendors/actions.ts` `cancelBookingAsHost`) — the prior **email-only** direct `sendEmail` (it predated the enum value) is consolidated onto canonical `emitNotification`, so the cancellation now also lands in the vendor's in-app tray.
- **dispute_filed → named vendor** (`disputes/actions.ts` `fileForceMajeureFlag`) — when a couple scopes a force-majeure flag to a specific marketplace vendor, that vendor is notified (in addition to the existing all-admin fan-out).
- **`/admin/disputes` now resolvable** — new `admin/disputes/actions.ts` `resolveDispute` (mirrors the force-majeure `resolveFlag` shape: requireAdmin · status→resolved_for_couple/vendor/withdrawn · required notes for adjudicated lanes · stamps `resolved_at` · notifies the opener). Inline zero-JS `<details>` resolve form per open row; the "Read-only V1 · edit in Supabase Studio" banner is gone. No migration (statuses already existed).
- **Admin in-app notification reader** — new `/admin/notifications` page (mirrors the vendor reader) + the live `<UnreadBellBadge>` mounted in the admin top bar. Admins already received `notifications` rows (force-majeure fan-out, help intake) but had no bell/page — the in-app half was a dead-letter.

**Verify:** `tsc --noEmit` clean · `next lint` clean (only pre-existing warnings, none in changed files) · `lint:retired` (0) · `lint:email-links` (all relatedUrls resolve, incl. the new `/vendor-dashboard/{bookings,reviews,messages/*}` + `/admin/notifications`). Migration applied + confirmed "remote database is up to date." Worktree had a fresh install → required CI (typecheck + lint + build) is the hard gate.

**SPEC IMPACT:** **0028** (+4 notification types) · **0022** (vendor now receives booking_confirmed/review_received/booking_cancelled/dispute_filed) · **0023** §3.6 (disputes queue gains resolve actions) + new admin notifications surface. → corpus DECISION_LOG row + iteration notes. Scoped-not-built (need owner sign-off): token burn-on-answer, two-admin approval gate, anti-fraud fake-event surface, chat moderation, vendor-unresponsive/ghosting escalation.

## 2026-06-07 · feat(loader): app cold-start ("initialization") splash — web + native

**Context:** Owner 2026-06-07 — "initialization loading" (Both: web first-open + native cold-start). Closes the last loading surface: the **boot moment** before the app shell is ready. The animated brand mark (the `<SDLoader>` scene — orbit + glow + breathe, CSS-driven, no JS particles) on Warm Alabaster, shown over the first app-route / native-shell paint of a session, then faded.

**Why one implementation covers both:** the native Capacitor shell loads the hosted web app, so a web boot splash baked into the SSR HTML automatically becomes the native cold-start splash once the WebView paints. The existing static native OS splash (`#FBFBFA` + mark, `capacitor.config.ts`) bridges launch → WebView paint, `NativeBridge` hides it, then this animated splash takes the handoff (both are brand-on-`#FBFBFA`, so it's seamless) — **no native rebuild required.**

**What landed (apps/web only):**
- `app/layout.tsx` — inline **gate script** (mirrors the existing `themeBootstrapScript` pattern): before first paint, sets `data-sn-boot` on `<html>` only when the path is an app route (`/dashboard`·`/vendor-dashboard`·`/admin`) **or** the native shell, and only once per session (`sessionStorage`). Server-rendered `#sn-init-splash` markup so it paints in the first frame.
- `app/_components/app-init-splash.tsx` — client remover: after hydration holds briefly (450ms web · 750ms native, for the native-splash handoff beat) then fades the splash and removes it from the paint tree.
- `app/globals.css` — `#sn-init-splash` styles (hidden by default; full-screen overlay when `data-sn-boot`; `.sn-boot-done` fade) + a **CSS-only failsafe** (`sn-boot-failsafe`, ~4s) so it can never stick even with JS disabled. Reduced-motion freezes it to a static mark that still fades.

**Deliberately gated OFF** public/marketing/legal pages → **SSR content + Lighthouse/LCP/SEO on the public site are untouched** (no splash where instant content matters; verified the homepage path isn't matched).

**Verify:** `tsc --noEmit` + `next lint` clean · harness screenshots (mobile + desktop) confirm the full-screen brand splash covers app content and the `.sn-boot-done` fade reveals it. No hydration risk — the gate only sets an external `<html>` attribute (same proven pattern as the theme bootstrap); the splash markup is static server/client. CI is the hard gate.

**SPEC IMPACT:** None — UI infra (cold-start brand moment); no schema/SKU/pricing/scope change. Note for future tuning: app-route allowlist + hold timings live in `layout.tsx` (`bootSplashScript`) / `app-init-splash.tsx`.

## 2026-06-07 · fix(loading): fill first-load gaps — skeleton `loading.tsx` on 8 in-app data routes

**Context:** Follow-up to the `<SDLoader>` work — closing the *other* half of loading UX: screens that flashed an empty area on first load because they had no placeholder. Audited every route: 158 already have a `loading.tsx`; the gaps were a handful of in-app admin/vendor **data** surfaces. The principle applied (owner-confirmed framing): **match the placeholder to the surface** — content/list/table/form screens get a layout-mirroring **skeleton** (the established pattern behind the other 158, zero layout shift); the brand `<SDLoader>` stays reserved for personalized/blocking/creative moments; static marketing/legal + print + redirect routes get **nothing** (they're painted HTML / non-visual — a loader would *add* a flash).

**What landed (8 additive `loading.tsx`, one-line re-exports matching the `admin/telemetry` convention; no edits to existing pages):**
- `admin/budget-planner` → `GridPageSkeleton` · `admin/growth` → `GridPageSkeleton`
- `admin/payment-options` → `ListPageSkeleton` · `admin/wedding-traditions` → `ListPageSkeleton` · `admin/wedding-types` → `ListPageSkeleton`
- `admin/connection-logs` → `TablePageSkeleton`
- `vendor-dashboard/branches` → `ListPageSkeleton` · `vendor-dashboard/payment-options` → `FormPageSkeleton`

**Deliberately skipped (not gaps):** static marketing/legal (`features`/`pricing`/`how-it-works`/`for-vendors`/`privacy`/`terms`/`weddings`/`download`/`waitlist`/homepage), print pages (`…/custom-qr-guest/print`, `…/invitation/print`), `api/v1`, and `dashboard/[eventId]/for-you` (a redirect stub). The 4 `Suspense fallback={null}` boundaries (pilot banner, PostHog, two guests search-param guards) are intentional invisible widgets, left as-is.

**Verify:** `tsc --noEmit` clean (only the pre-existing `@mediapipe/tasks-vision` + `sharp` env errors in untouched files) · `next lint` clean. No `node_modules` in worktree → required CI is the hard gate.

**SPEC IMPACT:** None — UI consistency; skeleton coverage parity with the existing 158 route loaders. No schema/SKU/pricing/scope change.

## 2026-06-07 · feat(loader): shared brand "thinking / analyzing" loader (`<SDLoader>`) — Organic loaders handoff

**Context:** Owner-supplied `Organic loaders` handoff (2026-06-07) — a Setnayan-branded indeterminate "we're analyzing your custom stuff" loading screen (gold particles gather into the mark · twin orbit · narrated step copy · `Ready ✓` ring on completion) to standardize loading moments. The handoff shipped a dependency-free `<sd-loader>` Web Component + reference HTML.

**Decisions (owner-chosen this session):** (1) **Native React port**, not the raw Web Component — so gold binds to the locked palette token `--m-orange` (#C5A059, *not* the handoff's #c69a4b), reuses the app's `.loading-status-line` fade, and inherits the global `prefers-reduced-motion` freeze. (2) **Targeted rollout**, NOT a literal "replace ALL loading states" — the 158 layout-mirroring route skeletons + their `LoadingNarration` (owner 2026-06-03/06-05) are KEPT (replacing them would regress route-loading UX). The brand loader is used for full-screen blocking + heavy "personalized work" moments only.

**What landed:**
- **`apps/web/components/sd-loader/`** — `SDLoader` (the visual; light default, `dark` for couple landing surfaces, JS particle spawner that opts out under reduced-motion), `LoaderOverlayProvider` + `useLoader()` (app-wide blocking overlay with `show/complete/hide`; "Ready ✓" holds ~850ms then auto-fades), `LOADER_STEPS` (single editable per-context narration map), barrel `index.ts`.
- **`apps/web/app/globals.css`** — `.sd-*` classes in `@layer components` + `sd-*` keyframes at top level (verbatim handoff geometry/timing; gold via `--sd-gold` → `--m-orange`); `.sd-overlay` host.
- **Wiring (3 consumers):** global overlay mounted in `app/providers.tsx`; **login boot overlay** — `login/_components/login-loading-bridge.tsx` drives the overlay from the password form's `useFormStatus().pending` ("Signing you in…") with **zero change to auth server actions/redirects**; **order-and-pay completion** — `inline-checkout-drawer.tsx` shows the loader while submitting and flips to the `Ready ✓` "Order sent" state before revealing the confirmation card; **monogram route loader** — new `dashboard/[eventId]/monogram/loading.tsx` (purely additive — that route had no `loading.tsx`).
- **Logo:** points at the existing transparent `public/brand/setnayan-mark.svg` (not the handoff PNG).

**Where to edit copy:** per-screen `steps` live in `components/sd-loader/loader-steps.ts` (signin / checkout / siteEditor / monogram / matching / default).

**Verify:** `tsc --noEmit` clean for all changed files (only pre-existing env errors: `@mediapipe/tasks-vision`, `sharp` — untouched files, missing native deps in the local install; CI installs them) · `next lint` clean · visual fidelity confirmed via a self-contained harness screenshot (loading + completion states, brand gold, ring/check draw, narration). No `node_modules` in worktree → **required CI (typecheck + lint + build) on the PR is the hard gate.**

**SPEC IMPACT:** **None** — UI infrastructure consistent with the existing loading-UX directives (skeletons 2026-06-03, narration 2026-06-05); no schema/SKU/pricing/scope change. The handoff's literal "ALL loading states" was deliberately scoped to targeted high-value moments (owner choice this session); skeletons remain the route-loading pattern. No corpus edit required.

## 2026-06-07 · feat(0023/0035): Connection Logs — wire `insertFaultLog()` into server-action save failures (batch 2)

**Context:** Second instrumentation batch for the Connection Logs tracker. Batch 1 (PR #1047) + #1046 covered **client-side** error paths. This batch covers the bigger category: **server-action save failures** — the app is server-action-heavy, so most real DB writes (and their failures) happen in `actions.ts` files, which were entirely uninstrumented. Server-side uses **`insertFaultLog()`** (not `trackFailure()`, which is browser-only).

**Discovery:** 8 parallel agents (one per high-value `actions.ts`) returned exact, reviewed edit specs. **21 sites across 8 files**, all tapping EXISTING supabase-write error branches (`if (error)` / `throw` after `.insert/.update/.delete/.rpc`). Purely additive (`await insertFaultLog({...})` before the existing return/throw — control flow unchanged); payloads are **ids/flags only** (no PII — emails/names/tokens excluded; #1046's `insertFaultLog` redaction is the second layer).

**Coverage (by flow):**
- **Money** — `checkout/actions.ts` (order INSERT · payment INSERT · voucher redemption); `orders/actions.ts` (createOrder · logPayment · self-comp order); `admin/payments/actions.ts` (approve→matched · promote→paid · confirm total).
- **Booking** — `vendors/actions.ts` (finalize/lock · cancel · add marketplace vendor).
- **Event/core** — `[eventId]/actions.ts` (save date · save ceremony type · mark step complete).
- **Guest-facing** — `[slug]/actions.ts` (submit RSVP — previously a silent failure); `guests/quick-add-actions.ts` (quick-add guest · set primary role · add role).
- **Profile** — `profile/actions.ts` (save personal info · change password).

**Verify:** static review + payload-var scope check (every var confirmed present in its file); anchors applied via exact-match Edit (two non-unique anchors disambiguated by surrounding context). No `node_modules` in worktree → **required CI (typecheck + lint + build) on the PR is the hard gate; merging on green.** 178 insertions, 6 deletions (the 6 = single-line `if(x) throw` → block conversions).

**SPEC IMPACT:** None — wires the existing tracker; no schema/SKU/spec change.

## 2026-06-07 · fix(connections): repair 4 dead/false connections found by the connection audit + ship CONNECTION_MATRIX.md

**Context:** A repo-wide connection/data/fallback audit (deterministic grep sweep + 7 parallel reading agents + schema-vs-code diff, verified against the **live prod DB**) produced `apps/web/CONNECTION_MATRIX.md`. The codebase is mature (zero empty handlers, awaited chains, loud error handling); the audit surfaced a small set of genuine broken connections, now fixed here. All findings were independently re-verified and adversarially reviewed before fixing.

**What changed (all blocker-class):**
- **Missing-table runtime crash (HIGH).** The table `event_software_activations` was renamed to `event_software_activations_v2` (migration `20260628000000`) but 3 manpower API queries still referenced the old name → `relation does not exist` at runtime. Repointed `app/api/v1/manpower/sync-device/route.ts` + `verify-telemetry/route.ts` to `_v2`. Verified against prod: old table absent, `_v2` has matching columns + the `UNIQUE(event_id,service_code)` index; the `execute_manpower_telemetry_reward` RPC already targets `_v2`.
- **Same bug in a DB function (HIGH).** The `verify_and_activate_manual_payment` function (admin/Maya manual-payment activation) also INSERTed into the absent old table at 2 sites → activation transaction failed. New migration `supabase/migrations/20260903000000_fix_verify_activate_manual_payment_v2_table.sql` repoints both INSERTs to `_v2`. The migration body is **byte-faithful** to the live function (dumped via `pg_get_functiondef`; only the 2 table names differ); live `items_ordered` is `text[]` and there is no `payment_status` CHECK, so the rename is sufficient. **⚠ Requires `supabase db push` to take effect.**
- **Onboarding "Add your own vendor" false success (HIGH).** `sendByo` showed "✓ connected … emailed {email}" but made no server call and was never in the commit payload — nothing persisted, no email sent. Now each BYO entry accumulates into `OnboardingState.byoVendors` and is persisted at commit as an `event_vendors` `considering` row (category `misc`, source `host_manual`; reuses existing columns `vendor_name`/`contact_email`/`notes` — no new table), via a best-effort try/catch that can never reject the commit. Toast copy is now truthful (no fake email/connect claim; no new email integration was added).
- **Two `/orders/new` checkout dead-ends (HIGH).** The retired `/orders/new` redirects to `/add-ons` dropping the SKU. The supplies-cart "Checkout via Orders" `<Link>` (deferred 0018 mock) is neutralized to a disabled "Checkout opens soon" affordance; the site-editor Pro-upgrade `<CardLink>` (SKUs `monogram_hero_upgrade`/`pro_widget_schedule`, which have no checkout page — V1.1 deferral) becomes an honest "Coming soon" pill. Both preserve owned-state.

**Files:** `apps/web/app/api/v1/manpower/{sync-device,verify-telemetry}/route.ts` · `apps/web/app/onboarding/wedding/{types.ts,actions.ts,_components/onboarding-shell.tsx}` · `apps/web/app/dashboard/[eventId]/add-ons/supplies-marketplace/{page.tsx,_components/cart-drawer.tsx}` · `apps/web/app/site-editor/[eventId]/_components/site-editor.tsx` · new `supabase/migrations/20260903000000_…sql` · new `apps/web/CONNECTION_MATRIX.md`.

**Verify:** `pnpm typecheck` (tsc --noEmit) ✅ · `pnpm lint` (next lint) ✅ — both clean. Repo-wide grep confirms zero remaining functional `.from('event_software_activations')` (non-_v2). Migration body diffed byte-for-byte against the live prod function. Adversarial 3-reviewer pass: all approve; the only medium concern (migration needs `db push`) is captured here. **Still OPEN (not in this PR):** vendor monetization is unreachable in-app (no `tier_state` write path, no buy-token checkout route, no calendar-block CRUD) + a few LOW admin guard gaps — all catalogued in `CONNECTION_MATRIX.md` Action List #4–#14.

**SPEC IMPACT:** **None for pricing/SKUs/customer-facing scope** (these are bug fixes to match intended behavior). One minor note: the BYO "Add your own vendor" flow now persists as a freeform `event_vendors` row — the *minimal honest* implementation. The fuller "`vendor_invites` auto-connect + email" the old code comment referenced (CLAUDE.md 2026-05-19) remains a deferred enhancement, not built here. No new table/column; `_v2` table + `verify_and_activate_manual_payment` already exist in prod. No Cowork action required.

## 2026-06-07 · feat(0052): native store-prep — plugins + BACK fix + branded icons + signing/deep-link scaffolds

**Context:** Owner: "prep for both app stores." A multi-agent audit of the merged remote-URL shell (PR #1044) surfaced 42 findings (21 adversarially verified). Headline: the remote-URL approach is **validated** (email/magic-link auth works first-party in the WebView; OAuth-in-WebView is real but **latent** — gated behind the off `NEXT_PUBLIC_OAUTH_*_ENABLED` flags), but the **Android hardware BACK button exits the app** from any screen (verified vs Capacitor 8.4 `BridgeActivity` source) — a guaranteed Play rejection + regression vs the PWA. This PR lands the zero-owner-dependency hardening + the store-submission code scaffolds.

**`apps/mobile` (Android, build-verified):**
- **+4 plugins** `@capacitor/app` · `splash-screen` · `status-bar` · `keyboard` (now 7 native plugins). `cap sync` + `gradlew assembleDebug` → **BUILD SUCCESSFUL**.
- **Branded launcher icon + splash** generated via `@capacitor/assets` from the real PWA app icon (`apps/web/public/brand/setnayan-app-icon-512.png` → `assets/logo.png`; brand bg `#FBFBFA`/`#1E2229`) — 74 assets replace the stock Capacitor robot.
- **Deep-link intent-filters** in `AndroidManifest.xml`: App Links (`autoVerify` https, scoped to `/dashboard`) + `setnayan://` custom scheme.
- **Release signing** (`app/build.gradle`): `signingConfigs.release` reads a gitignored `keystore.properties`; absent → release stays unsigned and debug builds still work. Keystore lines uncommented in `android/.gitignore`.
- `capacitor.config.ts`: splash `launchShowDuration` 600→2000 + `launchAutoHide` (offline backstop); `Keyboard.resize: 'native'`.
- README rewritten: real build sequence (`npm ci && cap sync && gradlew` — bare gradle fails on a fresh clone), signing, icon-regen, deep-links.

**`apps/web` (web-side bridge — typecheck + lint green, ZERO new deps):**
- **`NativeBridge`** (`app/_components/native-bridge.tsx`, mounted in `layout.tsx`): fixes the BACK-exits bug (history-back, exit only at root), hides the splash after first paint, stops content drawing under the notch (`StatusBar.setOverlaysWebView`), and handles `appUrlOpen` deep links. Reads the runtime `window.Capacitor` global — **no `@capacitor/*` deps added to apps/web**, zero bundle weight for web/PWA users, every path a no-op off-native.
- **Client-type detection** (`client-type-detector.tsx` + `lib/supabase/cookies.ts`): new `'capacitor'` type, detected first via `window.Capacitor.isNativePlatform()` and added to `isNativeLike` → native users get the 10-year cookie + aggressive refresh window instead of misclassifying as `web`.
- **Deep-link association files** scaffolded: `public/.well-known/assetlinks.json` (placeholder release SHA-256) + `apple-app-site-association` (placeholder Team ID); `middleware.ts` matcher excludes `/.well-known`; `next.config.ts` serves the AASA file as `application/json`.

**Verify:** apps/mobile `gradlew assembleDebug` BUILD SUCCESSFUL (branded icons + deep-links + signing scaffold packaged); apps/web `tsc --noEmit` exit 0 + `next lint` clean. Android build env reused from `~/.setnayan-toolchain` (JDK 21 + SDK 36). **NOT runtime-tested** (no AVD) — BACK/splash/status-bar/deep-link paths are compile-verified only.

**SPEC IMPACT:** 0052 — store-prep scaffolding. **Deferred (device/owner-gated, NOT in this PR):** Papic native camera capture wiring (needs a device); OAuth-via-system-browser (before enabling social login); iOS project (needs Xcode + CocoaPods); release keystore + Apple enrollment + real `.well-known` hashes (owner). → corpus `DECISION_LOG.md` (2026-06-07) + `0052_native_apps_delivery` rewrite.

## 2026-06-07 · feat(0023/0035): Connection Logs — wire `trackFailure()` into 5 more buttons (additive to #1046)

**Context:** Independent follow-up to the Connection Logs tracker, run in parallel with PR #1046. After rebasing on #1046 (which wired 19 sites across 13 files + added `insertFaultLog` PII redaction), I confirmed **none of these 5 sites overlap #1046's set** — they cover distinct high-value flows #1046 didn't touch. The onboarding-commit site I'd also picked was already done by #1046, so I dropped mine and kept theirs (no duplicate).

**5 sites (all client-side, all tapping EXISTING error branches — purely additive, no logic change, ids-only payloads):**
- `app/_components/chat-send-form.tsx` — **Send chat message** (`BUTTON_FAIL`, existing `catch`). #1046 did the *stream/receive* side (`chat-message-stream.tsx`); this is the *send* form.
- `app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx` — **Submit payment order** (`SUPABASE_SAVE_ERROR`, on `!result.ok` from `submitOrderAction`). Money path — not covered by #1046.
- `app/dashboard/[eventId]/add-ons/led/_components/led-background-maker.tsx` — **Save LED background config** (`SUPABASE_SAVE_ERROR`, on `!res.ok`).
- `app/dashboard/[eventId]/add-ons/mood-board/_components/visual-preview.tsx` — **Save moodboard pick** (`SUPABASE_SAVE_ERROR`, existing `catch`).
- `app/dashboard/[eventId]/guests/_components/mobile-guest-carousel.tsx` — **Add guest** (`SUPABASE_SAVE_ERROR`, on `!result.ok` from `quickAddGuest`).

Payloads are ids/flags only; #1046's `insertFaultLog` redaction is the second-layer guarantee. Discovery via parallel agents; remaining client call sites are incremental.

**Verify:** static review + in-scope check on every payload var; rebased clean on #1046 (onboarding conflict → took theirs). No `node_modules` in worktree → required CI on the PR is the gate (merging on green).

**SPEC IMPACT:** None — wires the existing tracker; no schema/SKU/spec change.

## 2026-06-07 · fix(0035): wire Connection Logs into 19 call sites + Sentry capture gaps + payload PII redaction

**Context:** Owner task file ("Fix Sentry … + deploy an independent Supabase emergency log"). Investigation found (a) Sentry was **not** broken as the brief assumed — the config is sound and deliberately LCP-optimized — but had two real capture gaps; and (b) the "independent tracking table" the task asked for **already shipped today** as the Connection Logs feature (`app_telemetry_logs`), whose follow-up — *"call sites not yet instrumented"* — was outstanding. Per owner decision (2026-06-07), this reuses the canonical substrate instead of building a duplicate `client_interaction_errors` table (which would have re-introduced the rejected anon-`.insert()`), and completes the wiring.

**What changed:**
- **Sentry — `app/global-error.tsx`:** the root-layout crash boundary said *"We've logged the issue"* but **never called `Sentry.captureException`** (Sentry doesn't auto-capture React error-boundary catches). Added a dynamic-import `captureException(error, { tags: { boundary: 'global-error' } })` in its effect — no-ops safely when the DSN is unset.
- **Sentry — `app/_components/deferred-observability.tsx`:** `replaysOnErrorSampleRate: 1.0` was set but `Sentry.replayIntegration()` was never registered, so error-replays never recorded. Registered it (inside the existing deferred chunk → no LCP cost).
- **Connection Logs — PII redaction (NEW):** `apps/web/lib/telemetry/redact.ts` (`redactPayload()`), now run inside `insertFaultLog()` — the single write chokepoint for `app_telemetry_logs`, so **every** fault row is PII-scrubbed before storage (denylist of email/name/phone/token/secret/address/auth-shaped keys + string/depth/array/size caps). The ingest route previously stored `payload_snapshot` verbatim (size-capped only). Closes the RA 10173 "no PII in logs" gap for this surface.
- **Call-site instrumentation — 19 sites across 13 files (18 client `trackFailure` + 1 server `insertFaultLog`):** `trackFailure({...})` (client) / `insertFaultLog({...})` (the one server component) dropped into real failure-fallbacks: unread badges (bell + messages), chat stream refetch, file-upload (watermark fallback + presign), event-date editors (inline + vendor-availability), plan-card-compare (lock + orphan-risk sibling cleanup), wizard cards (set-date, vendor grid search/lock/custom-save, paperwork, schedule-seed), attire-guide save/reset, and onboarding (commit-plan rejection + router-push hard-nav fallback). Benign catches (localStorage private-mode, date-parse, prefetch, NEXT_REDIRECT guards) and the already-Sentry-logged server loader were deliberately left out to keep the firehose high-signal.

**Verify:** fresh worktree off current `origin/main` (`183deae5`) · `pnpm typecheck` ✅ · `pnpm lint` ✅ (only pre-existing warnings) · `pnpm build` ✅. No migration in this PR (`app_telemetry_logs` already applied to prod). Owner action: set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in Vercel Production to actually turn on capture (OWNER_ACTIONS #19e) — see `TRACKING_STATUS.md`.

**SPEC IMPACT:** 0035 (observability) — global-error now reports to Sentry; error-replay integration registered; Connection Logs `payload_snapshot` is now PII-redacted server-side; the firehose is now instrumented across the core couple/wizard/onboarding surfaces. No new table, no new SKU, no pricing/customer-facing change. → corpus `DECISION_LOG.md` (2026-06-07).

## 2026-06-07 · feat(0052): native mobile shell — Capacitor **remote-URL** wrapper (Android built + verified)

**Context:** Owner is bootstrapping the iOS/Android native apps via Capacitor (iteration 0052). The followed recipe used `output: 'export'` + `webDir: 'out'` (static export). **That is incompatible with this app** — `apps/web` is a server-rendered Next.js app (`output: 'standalone'`) with **111 Server Actions · 60 API routes · middleware-based Supabase auth · 417 dynamic routes**; a static export drops all of it (no auth, no Supabase, no payments) and the build fails. So `apps/web` + `next.config.ts` are **untouched**.

**What changed — new self-contained `apps/mobile/` package (Capacitor 8.4 · remote-URL pattern):**
- `capacitor.config.ts` — `appId com.setnayan.app` · `webDir www` · `server.url` loads the **hosted app** (`https://www.setnayan.com`, env-overridable via `CAP_SERVER_URL` for local dev; `cleartext` auto-on for `http://`). Native WebView loads the live site; Camera/Network/BLE bridge to the web JS. Single Next.js codebase stays intact — matches the locked *"true-native Papic + Capacitor shell for the rest."*
- `www/index.html` — branded **offline fallback** (Clean Editorial palette); Retry → `server.url`.
- **Android project generated, hardened, and BUILT** (`android/`): manifest permissions added (`CAMERA` + `camera` feature optional · `ACCESS_NETWORK_STATE` · `BLUETOOTH_SCAN neverForLocation`/`BLUETOOTH_CONNECT` + legacy `BLUETOOTH`/`ADMIN`/`FINE_LOCATION` ≤API30); `MainActivity` subclasses Capacitor's `BridgeWebViewClient` to load the offline page on main-frame `onReceivedError` (bridge intact).
- `package.json` (`@setnayan/mobile`) · `.gitignore` (Pods/.gradle/build/local.properties excluded) · `README.md` (corrected steps + prereqs + bridge/offline follow-ups).
- **pnpm boundary:** `apps/mobile` is **excluded from the pnpm workspace** (`!apps/mobile` in `pnpm-workspace.yaml`) — it's an npm-managed Capacitor project (flat `node_modules`), so the root `pnpm install --frozen-lockfile` (Vercel) ignores it and `pnpm-lock.yaml` stays byte-identical to main.

**Verify:** `npm install` (97 pkgs) ✅ · `cap add android` (3 plugins: BLE/Camera/Network) ✅ · `cap sync` ✅ · **`./gradlew :app:assembleDebug` → BUILD SUCCESSFUL (1m21s, 133 tasks)** ✅. APK (`app-debug.apk`, 7.8 MB) `aapt2 dump badging` confirms `com.setnayan.app` · compileSdk 36 · all perms · `assets/public/index.html` bundled · `server.url https://www.setnayan.com` baked. `pnpm install --frozen-lockfile --lockfile-only` exits 0, no drift. Toolchain (JDK 21 + Android SDK 36) installed **user-local** under `~/.setnayan-toolchain/` (no sudo, no shell-profile edits, removable). **iOS NOT generated** — only Xcode CLT is installed (no Xcode.app); `cap add ios` + builds need the owner to install Xcode (App Store) + CocoaPods. Offline fallback is compile-verified, **not yet runtime-tested** (no AVD). No migration. No `apps/web` change.

**SPEC IMPACT:** **0052 (native apps).** (a) The native delivery is a **Capacitor remote-URL shell**, NOT a static export — record that `output: 'export'` is rejected for the server-driven app and the shell loads the hosted URL with native plugin bridges. (b) Native is **V1.5/Phase 2**; locked V1 mobile remains the installable PWA (already shipped). (c) The web-side bridge (`@capacitor/core` `isNativePlatform()` feature-detect, Papic capture first) is a **separate future `apps/web` change** — not in this PR. → corpus `DECISION_LOG.md` (2026-06-07) + iteration `0052_native_apps_delivery` via Cowork.

## 2026-06-07 · feat(0023/0035): Connection Logs — real-time admin fault tracker with auto-clear lifecycle

**Context:** New internal observability surface (owner task file, 2 am). A self-contained dashboard + DB tracker for **front-end faults** — broken buttons, failed Supabase saves, blank fallbacks — with a resolve lifecycle that keeps the Active view a true picture of what's still broken. Deliberately scoped as a **standalone** surface (owner-confirmed): it complements, not replaces, **Sentry** (engineer-facing errors, 0035) and the existing **`telemetry_events`/`/admin/telemetry`** (backend service checkpoints, V2 Phase E).

**Two conventions in the original brief were adapted to locked Setnayan patterns (both owner-confirmed):**
- Path `src/utils/trackError.ts` → `apps/web/lib/telemetry/track-error.ts` (App Router · kebab-case · no `src/`).
- "direct browser `.insert()` from unauthenticated pages" → **server-route + service-role**. `trackFailure()` POSTs to `/api/telemetry/client-fault`, which inserts with the service key. No anon-writable table (spam/DoS/jsonb-injection avoided); same behavior — faults captured from public pages. Mirrors the existing `lib/telemetry/insert.ts` posture.

**What landed:**
- **Migration** `supabase/migrations/20260902000000_app_telemetry_logs.sql` — `public.app_telemetry_logs` (id · created_at · event_type{BUTTON_FAIL|SUPABASE_SAVE_ERROR|BLANK_FALLBACK|OTHER} · element_name · file_path · error_message · payload_snapshot jsonb · status{active|resolved|ignored} · resolved_at). RLS at CREATE time — SELECT+UPDATE limited to the **layout admin set** (`account_type='admin' OR is_internal OR is_team_member`) so Realtime delivers to every operator; **no INSERT/DELETE policy** (service-role only). Added to `supabase_realtime` publication. Three indexes incl. partial-on-active for the filter + auto-clear sweeps.
- **Tracking utility** `apps/web/lib/telemetry/track-error.ts` — client-safe `trackFailure({eventType, elementName, filePath, error, payload})`; never throws/blocks UX; `keepalive` POST survives unmount; dev console `🛑 [TELEMETRY CAPTURED]:`. Server helpers in `apps/web/lib/telemetry/fault-log.ts` (`insertFaultLog` / `resolveFaultsByFilePath` / `coerceEventType`, `server-only`).
- **Dashboard** `/admin/connection-logs` (`page.tsx` privileged read + `connection-logs-client.tsx` island) — Active / Resolved tabs (Active empty-state when clean) · filter pills (All · Broken Buttons · Supabase Errors · Blank Fallbacks) · **Supabase Realtime** stream (INSERT+UPDATE) · inspection modal (file path · raw error · recursive JSON tree of payload_snapshot) · per-row Resolve/Ignore · **Archive all active** (filter-scoped). `actions.ts` re-verifies admin on every mutation.
- **Ingest** `app/api/telemetry/client-fault/route.ts` (public · same-origin guard · 16KB payload cap · field caps · event_type coercion). **Auto-clear** `app/api/telemetry/auto-resolve/route.ts` — `{file_path}` → sweeps active rows to resolved; gated by `x-internal-worker-secret` **or** an admin session.
- **Nav** — "Connection logs" added to the admin sidebar Insights group next to Telemetry.
- **Docs** — `ADMIN_LOGS_GUIDE.md` at repo root (locations · how to wrap buttons/`catch` blocks · how the route is secured).

**Verify:** static review + type-tightening pass (no `node_modules` in the fresh worktree → local `tsc`/`lint`/dev-server N/A; **required CI typecheck+lint+production build+Vercel preview = proof**). Realtime idiom copied from `app/_components/chat-message-stream.tsx`; admin-read RLS matches `app/admin/layout.tsx`; insert/secret posture matches `lib/telemetry/insert.ts`. **Migration must be applied** via `supabase db push --db-url "$SUPABASE_DB_URL"`.

**SPEC IMPACT:** 0023 (new admin surface "Connection logs") + 0035 (observability gains a front-end fault tracker alongside Sentry). New table `app_telemetry_logs`. → corpus `DECISION_LOG.md` (2026-06-07). Not a new SKU / no pricing / no customer-facing scope change.

## 2026-06-06 · feat(0016): onboarding "Purchase Now" jumps to the in-app checkout card

**Context:** Owner — tapping **Purchase Now** on the picks summary (step 16) should land on a payment card, not the generic Services tab. The owner first named the **VendorDirectPay** card; a prod query ruled it out — all **225 `is_setnayan_service` vendors have ZERO payment methods**, so that card would render empty ("coordinate in chat"). The platform BDO/GCash config the **in-app checkout card** (`InlineCheckoutDrawer`) uses works today, so the owner chose that.

**What changed (`app/onboarding/wedding/_components/onboarding-shell.tsx`):**
- New `INAPP_TO_ADDON_SLUG` map — the **5 picked services with a built checkout page** (`papic_seats→papic` · `animated_monogram→animated-monogram` · `panood→panood` · `custom_qr→custom-qr-guest` · `indoor_blueprint→indoor-blueprint`).
- `goToDashboard` (the Purchase-Now path) now routes to `/dashboard/[eventId]/add-ons/[slug]` — the `InlineCheckoutDrawer` payment card (BDO/GCash QR + reference + 0034 order/reconciliation) — for the **first** picked service that has one. The couple pays there; the rest stay payable on the Services tab. Falls back to the Services tab when no pick is mappable; continue-free still lands on Home. Prefetches the checkout route.

**Verify:** static review; TS-safe (`paySlug` narrows to string in the route branch · `find(Boolean)`); all 5 slugs map to existing add-on checkout dirs. Local Next preview N/A (app onboarding needs auth + 16 steps) — typecheck+lint+build+**Vercel preview = proof**. No migration.

**SPEC IMPACT:** 0016 — Purchase Now lands on the in-app BDO/GCash checkout card for the picks (was the Services tab). Prototype + Blueprint §3.2 row 16 → corpus `DECISION_LOG.md` (2026-06-06). **Follow-up:** the 9 in-app services WITHOUT a built checkout page (advanced_website · sde · pakanta · live_background · pabati · guest_stories · thank_you · live_photowall) fall back to the Services tab; building their checkout pages would let Purchase Now land directly for those too.

## 2026-06-05 · refactor(0016): onboarding Your Plan inquiry stepper (no toggle · match-gated) + Boost/Picks fit-to-screen

**Context:** Owner punch-list on the onboarding end screens. **Reach my best matches (14):** "no toggle — input the number right away (min 1, max 5); if there's no AI match support, the card won't show." **Boost & enhance (15):** "snap [the carousel] to the bottom and stretch the big photo." **Your picks (16 · last page):** "make the last page fit so all products are framed and scrollable in between," and "drop 'You save ₱… vs hiring elsewhere' — just show the grand total saved."

**What changed (`app/onboarding/wedding`):**
- **Reach my best matches (14)** — removed the on/off toggle; the **1–5 "inquiries per category" stepper shows directly**. The card is **gated on real AI matches**: a one-shot fetch (reusing `getOnboardingVendorCounts`, which returns `null` precisely when no best-fit vendors are found) on the congrats→plan stretch (step ≥ 13) sets `matchAvail`; the card renders only when `matchAvail === true`, and `sendTopInquiries` is driven from it (true iff matches exist → the commit fan-out runs; `null`/error → hidden + no fan-out). No manual opt-in toggle anymore.
- **Boost & enhance (15)** — fill layout: the big poster (`svc-poster`) **stretches to fill** the screen and the **carousel + label snap to the bottom** (mirrors the budget/role/kind photo-fill flex pattern — `svc-detail` becomes the flex-fill column).
- **Your picks (16 · last page)** — **fits the viewport**: the grand-total hero pins on top, the **picks list is framed and scrolls in between** (new `svc-rows-scroll`), and the totals + Purchase/continue buttons pin to the bottom. **Removed** the "You save ₱… vs hiring elsewhere" line (and the now-unused `saveTotal`) — the grand-total hero already states what's saved.

**Verify:** static review + grep (no orphans — `saveTotal`/`svc-tot-s` gone; `getOnboardingVendorCounts`/`matchAvail`/`svc-rows-scroll` all used; `setState`/`patch` in scope). Local Next preview N/A (fresh worktree, no node_modules; the app onboarding needs auth + 16 steps) — **typecheck+lint+production build+Vercel preview = proof; the 15/16 fit + poster stretch want a Vercel-preview eyeball.** No migration.

**SPEC IMPACT:** 0016 — Your Plan inquiry control is a match-gated 1–5 stepper (no toggle; auto-on iff real matches exist — **note RA 10173:** disclosed on-screen, but no manual opt-out now beyond "no matches found"); Boost (15) + Picks (16) are fit-to-screen; the "vs hiring elsewhere" line is dropped. Re-uses `getOnboardingVendorCounts` (the fn the prior congrats-declutter PR #1041 orphaned — now a gate, not a stat). Prototype `Onboarding_Wedding_Flow_2026-06-01.html` + Blueprint §3.2 rows 14/15/16 drift — logged in corpus `DECISION_LOG.md` (2026-06-05).

## 2026-06-05 · feat(0016): onboarding canonical-fields close-out — role · area picks · services-to-look-for · basic moodboard persisted + every-leaf recommendations

**Context:** Owner locked the onboarding data contract (the 19 canonical outputs + #20 "recommended services for all the chosen leaf categories") and confirmed: persist the 4 fields the commit was dropping, and recommend an in-app add-on for **every** chosen leaf. Closes build-plan (`Onboarding_Canonical_Fields_Build_Plan_2026-06-05.md`) **G1–G4**. **Zero migration** (event_moderators exists; the rest ride in the `style_preferences` JSONB).

**What changed:**
- **G1 · role → `event_moderators`** (`actions.ts`): the signing user is now recorded as the event's first host with the bride/groom/helper role they picked on screen 2 (was dropped — only `event_members.member_type='couple'`). bride/groom → `role_subtype` directly; helper → `family_helper`; null → `partner1`. `accepted_at=now` (self-created host); `permissions_json` from the 0048 `PERMISSION_TEMPLATES` (mirrors `hosts/actions.ts`). Best-effort; no trigger double-write (verified — the 0048 migration's only moderator write is a one-time backfill); `UNIQUE(event_id,user_id)` guards re-runs.
- **G2 · area picks** → `style_preferences.search_areas` (the up-to-2 screen-6 picks; venue lat/lng was already seeded from the primary pick's centroid).
- **G3 · services to look for** → `style_preferences.interested_categories` (the taxonomy picks persisted as a set — previously they only fired the opt-in inquiry).
- **G4 · basic moodboard** → `style_preferences.basic_moodboard` = the deterministic `FEELS[feel]` palette (null for 'others'/none) — the iteration-0010 baseline.
- **#20 · every-leaf recommendations** (`onboarding-shell.tsx`): `PICK_TO_INAPP` expanded from ~14 to **all ~53 leaf categories** → ≥1 matched in-app add-on each, and `recommendedInappFor` **uncapped** (dedup bounds the union to the ≤14 in-app services). `role`/`places`/`basicMoodboard` threaded into `buildCommitPayload`.

**Verify:** wiring + brace checks; TS-safe (reuses the `event_moderators` lib + `PERMISSION_TEMPLATES`; permissions_json shape matches the ongoing host-invite writer). No migration. Vercel preview = visual proof.

**SPEC IMPACT:** 0016 — onboarding now persists all 19 canonical outputs + recommends an add-on per chosen leaf (#20). Build-plan G1–G4 closed. Corpus §3.0a + `DECISION_LOG.md` (2026-06-05).

## 2026-06-05 · refactor(0016): declutter onboarding congrats (13) — remove savings stat-strip · inquiry opt-in · personalization note

**Context:** Owner — strip the "You did the hard part" congrats screen (13) of three blocks layered over the data recap: the **savings stat-strip** (₱ saved · hours saved · "N that fit your wedding · from M"), the **"Keep Setnayan AI helping finish your wedding"** inquiry opt-in card, and the **"✦ Change or switch off … Personalize my matches"** note. The full data recap + live countdown stay. Partly reverses the 2026-06-05 "also surface the inquiry opt-in on congrats" add.

**What changed (`app/onboarding/wedding/_components/onboarding-shell.tsx`):**
- Removed the `.statstrip` (3 `CountUp` stats) from step 13. `savings.money`/`savings.hours` still render on **Your Plan (14)** (`FreeValueSlider`) and the **services grand total (16)** — savings isn't hidden, just off the congrats moment.
- Removed the step-13 inquiry **opt-in card** (toggle + 1–5 stepper). The identical control still lives on **Your Plan (14)** binding the same `sendTopInquiries`/`inquiriesPerCategory`; commit-time fan-out unchanged → no lost functionality, no double-send risk.
- Removed the "Personalize my matches" note (the same phrase on the Style step (10) is untouched).
- Deleted the now-dead vendor-fit machinery whose only consumer was the removed tile: `vendorCounts`/`vendorCountsTried` state + the step-13 `getOnboardingVendorCounts` fetch effect + its import; trimmed the stale savings-compute comment. (`getOnboardingVendorCounts` stays exported in `actions.ts`, now unused — left for a separate cleanup.)

**Verify:** static diff + grep clean (no residual `vendorCounts`/`getOnboardingVendorCounts`/`statstrip`); deletion-only with no orphaned refs (`savings`/`CountUp` still used). Local Next preview N/A (home checkout 467 behind; fresh worktree has no node_modules) — **typecheck+lint+production build+Vercel preview on the PR = proof.** No migration.

**SPEC IMPACT:** 0016 — congrats (13) no longer shows the savings stat-strip / inquiry opt-in / personalization note (recap + countdown stay). Prototype `Onboarding_Wedding_Flow_2026-06-01.html` (statstrip + note) + Blueprint §3.1a row 13 drift further — logged in corpus `DECISION_LOG.md` (2026-06-05), matching this area's drift-log pattern.

## 2026-06-05 · feat(0001): desktop guest list reverts to a row/table layout (mobile stays the photo grid)

**Context:** Owner: *"guest on desktop mode will be row/table style not grid style."*

**What changed:**
- `dashboard/[eventId]/guests/_components/guest-list-multiselect.tsx` — on **desktop (sm+)** the guest list is now a **row/table** again (re-introduced `DesktopRow` + a small round `RowAvatar` that shows the guest's photo, falling back to side-tinted initials), not the photo-card grid. The **importance order carries over** (Bride #1, Groom #2, then role — it's a sort, independent of layout); when grouped (the importance sort) the table breaks into **tier sections with a header row** (couple / wedding party / … / guests), else a flat table. The thead checkbox is select-all (so the separate desktop select-all header the grid needed is removed). **Mobile (<sm) is unchanged — still the tiered photo grid** (couple 2-up · special roles 2-up · guests 3-up). Both surfaces build from the same `sections` + the same `guestSelection` store, so the SelectionBar / mobile-carousel lockstep / select-all / swipe-to-delete are untouched. Dropped the now-dead desktop grid `cols` from `SECTION_CONFIG`/`buildSections` (`mobileCols` stays).

**Verify:** `tsc --noEmit` clean · `next lint` clean on the changed file · production build green. **No migration / schema change** — pure layout. The photo still shows on desktop (thumbnail per row) and on mobile (card hero); the photo grid is now mobile-only.

**Note:** mobile grid densities left as shipped (couple 2 · roles 2 · guests 3) — the grid is now mobile-only, so the literal "wedding party 3 / guests 4" can be bumped on mobile if wanted (one-liner).

**SPEC IMPACT:** 0001 — desktop guest list = row/table (photo thumbnail per row, importance-ordered, tier section headers); mobile = the tiered photo grid. Logged in corpus `DECISION_LOG.md` (2026-06-05) + the 0001 amendment.

## 2026-06-05 · feat(0016): onboarding congrats full recap + live countdown · services summary 20% promo + grand total + pick-matched recommendations

**Context:** Owner punch-list on the two end screens. **Congrats (13):** "this must be the summary of the data we gathered" — list everything (couple + helper as +1, type + religion, dates, budget, target locations, taxonomy picks, reception/ceremony/catering/photo-video types, song list, mood board, shortlisted venues) + "show the timer based on the nearest date they picked." **Services summary (16):** add the recommended services for the couple's picks next to the add-ons they added, a **20% onboarding promo** (up from the retired bundle's 10%), a TOTAL of money + time saved "in X minutes" (the onboarding duration), and reword the free link.

**What changed (`app/onboarding/wedding`):**
- **Congrats (13) full recap** — the 6-row card → a complete summary: Couple (+ "you're helping plan" when the account role is helper), Type (kind + religion), Date, Where (the up-to-2 area names via `cityByKey`/`resolvePick`), Guests, Budget, Services (taxonomy picks), Reception, Ceremony, Catering, Photo & Video, Mood board, Song list, Shortlisted — each row shown only when it has data; long rows stack + wrap. Scrolls within the pinned brand-bar + Continue (summary-screen exception).
- **Congrats (13) live countdown** — new `WeddingCountdown` ticking days + HH:MM:SS to PH-midnight of the nearest picked date (earliest candidate / window start); hidden when no date.
- **Onboarding duration** — `state.startedAt` stamped once on hydrate (reset on resume after >30-min idle so it reflects the active sitting); the summary shows "you did all this in X minutes."
- **Services summary (16)** — pick-matched recommended add-ons (`PICK_TO_INAPP`, capped 5) pre-added to `interestedServices` once on reaching Boost & enhance (`servicesSeeded` latch), tagged **Recommended**, each removable; a **20% onboarding-promo** line (struck total → discounted due, `ONBOARDING_PROMO`); a grand-total hero (money saved incl. promo + hours + the X-minutes); free link → **"Will purchase later, continue for FREE."**

**Verify:** static review + wiring/brace checks; TS-safe (state extended, no contract break — `commitOnboardingWedding` still persists the same `interestedServices`). Local Next preview N/A (home checkout 467 behind; the proto server serves the corpus HTML prototypes). **Vercel preview = visual proof.** No migration.

**SPEC IMPACT:** 0016 — congrats is now a full data summary + live countdown; the services summary adds pick-matched recommendations + a 20% onboarding promo + a money/time/minutes grand total. Prototype `Onboarding_Wedding_Flow_2026-06-01.html` + Blueprint §3.1a rows 13/16 + §3.2 drift further from the build — logged in corpus `DECISION_LOG.md` (2026-06-05).

## 2026-06-05 · feat(0016): onboarding Style steps — reception/ceremony hero-on-top + persistent carousel end-line + service-style 2×3 grid

**Context:** Owner punch-list on the wedding-onboarding picker (screen 9) + Style sub-stepper (screen 10): (1) *"each row should have a vertical line after the last card to show that's the end — even if the card never filled the screen"*; (2) Reception + Ceremony *"must be laid out like the Kind screen — 1 main photo on top and cards on a carousel at the bottom, with the end marker as well"*; (3) catering Service-style *"consistent button height and length · row 1 Plated|Buffet|Family-style · row 2 Halal|Alcohol-free|Stations."*

**What changed (`app/onboarding/wedding`):**
- **Persistent end-line on photo-card rails** (`onboarding.css`): the shared `<Rail>` already renders a `.railend`, but `.railwrap.flat` hid it whenever the row fit. Now re-shown for `.pickrail` / `.car` / `.strip` (picker · reception · ceremony · cuisine/look/feel) even when flat (chip rails stay clean). `.railend` switched `height:84px;align-self:center` → `align-self:stretch;min-height:44px` so the line matches each row's card height.
- **Reception + Ceremony → hero-on-top + strip carousel** (`onboarding-shell.tsx`): both dims added to `hasHero`; the viewzone hero is the SELECTED option's photo with a `.styhcap` caption (updates on tap — mirrors the Kind screen), and the choices switched from the big-card `pgrid car` to the smaller `pgrid strip` (same shape as Catering/Photo). New `.styhcap` CSS.
- **Service-style 2×3 grid** (`onboarding-shell.tsx` + `.svcgrid` CSS): the two chip carousels (4 service styles · 2 dietary) → one `repeat(3,1fr)` grid of equal height/width buttons — row 1 Plated·Buffet·Family-style, row 2 🕌 Halal·Alcohol-free·Stations.

**Verify:** static diff review (no `pgrid car` refs remain) + TS-safe (no type/state-contract changes; `interestedServices` & commit untouched). Local Next preview N/A here (home checkout is 467 commits behind; the running "proto" server serves the corpus HTML prototypes, not the app) — **Vercel preview on the PR is the visual proof.** No migration.

**SPEC IMPACT:** 0016 onboarding Style steps — Reception/Ceremony are now hero-on-top + strip carousel (was big-card `.car` carousel); Service-style is a 2×3 equal-button grid (was two chip carousels); photo-card rows carry a persistent end-line. Prototype `Onboarding_Wedding_Flow_2026-06-01.html` + Blueprint §3.1a (row 11) drift further from the build — logged in corpus `DECISION_LOG.md` (2026-06-05).

## 2026-06-05 · feat(0001): guest grid tiers by importance — couple share a row, wedding party 3-up, guests 4-up

**Context:** Owner (building on the importance-order default): *"bride and groom will share same row / wedding party will be 3 per row / Guests will be 4 per row."*

**What changed:**
- `lib/role-groups.ts` — `importanceGroupOf(roles)` returns the role-group of a guest's **most important** role (primary or extra), so the importance sort and the new tier sections agree for multi-role guests.
- `dashboard/[eventId]/guests/_components/guest-list-multiselect.tsx` — when the list is **grouped** (the importance sort = the default), the photo grid breaks into **role-tier sections**, each with its own density: **Bride & Groom share a 2-up row**, every special-role tier (VIP family → Wedding Party → sponsors → bearers/flower girl → officiants) runs **3-up**, and plain **Guests run 4-up** (desktop; mobile scales one step down — 2-up roles, 3-up guests — for readable cards). Subtle `TierHeader` labels (reusing `ROLE_GROUP_LABELS`) head each section; empty tiers are skipped. Any **non-importance sort renders one uniform grid** (tiering only makes sense when ordered by tier). Both desktop + mobile blocks now map over the same `sections`, and **every card still uses the same `guestSelection` store**, so the SelectionBar, the mobile-carousel lockstep, select-all, and swipe-to-delete are untouched. `page.tsx` passes `grouped={sort === 'importance'}`.

**Inference flagged for owner:** the owner named 3 densities (couple 2 · wedding party 3 · guests 4); I mapped **all** special-role tiers (VIP family, sponsors, bearers, officiants — not just literal "wedding party") to the 3-up band, and scaled mobile down for readability. Easy to retune per tier if desired.

**Verify:** `tsc --noEmit` clean · `next lint` clean on the changed files · production build green. **No migration / schema change** — pure layout.

**SPEC IMPACT:** 0001 — the importance-ordered guest grid is now tiered by role group with per-tier densities (couple 2 · special roles 3 · guests 4). Logged in corpus `DECISION_LOG.md` (2026-06-05).

## 2026-06-05 · feat(0001): guest list defaults to importance order — Bride #1, Groom #2, then by role

**Context:** Owner: *"guest is always arranged based on their importance in the wedding. Bride will always be #1 then groom. then everyone else follows depending on their role."*

**What changed:**
- `lib/role-groups.ts` — new canonical `ROLE_IMPORTANCE` order (Bride → Groom → VIP family → wedding party → principal → secondary sponsors → bearers/flower girl → officiants → plain guest) + `roleImportanceRank()`. Mirrors the existing `RoleGroup` order + `BULK_ROLE_SECTIONS` so the sort, the View sidebar, and the bulk role picker all agree on one hierarchy.
- `dashboard/[eventId]/guests/page.tsx` — **Importance is the new DEFAULT sort** (no `?sort` → importance; was last-name). New `coupleRank` pins **Bride #1 / Groom #2 first under EVERY sort** (the couple is the event foundation — owner "always"). `guestImportanceRank` ranks a guest by their **most important role** (primary *or* extra), so a Bridesmaid who's also a Principal Sponsor ranks by the higher of the two; ties break by last/first name. The old alphabetical-by-enum "Role" sort was **retired** (A–Z by enum string is meaningless for a wedding) — replaced by this curated importance sort. The photo grid + mobile carousel render whatever order the page hands them, so both pick this up for free.

**Verify:** `tsc --noEmit` clean · `next lint` clean (pre-existing warnings only) · production build green. **No migration / schema change** — pure client+server sort logic.

**SPEC IMPACT:** 0001 — the default guest arrangement is now wedding-importance (Bride #1, Groom #2, then by role group), and bride/groom are pinned first under every sort. Logged in corpus `DECISION_LOG.md` (2026-06-05).

## 2026-06-05 · feat(0001/0012): guest list → photo grid; guest-supplied photos (Gmail avatar + RSVP selfie) feeding Papic face-rec

**Context:** Owner: *"guest list will be grid style now. since we want them to have photos."* Source clarified: *"when they login via gmail. or they take a selfie. so RSVP must have selfie. the selfie will be used for face recognition on papic also. so it needs to be up to standard for face recognition."* Grid **replaces** the list; selfie is **prominent but skippable** (RA 10173 — biometric consent must be freely given, so it can't hard-block an RSVP). One combined change (owner chose ship-once).

**What changed:**
- **Schema (2 migrations · applied to prod Singapore + recorded):** `20260831000000_iteration_0001_guest_photos` adds `guests.photo_url / photo_source / photo_updated_at / photo_set_by_user_id` (+ CHECK on source). `20260901000000_iteration_0012_guest_face_enrollments` creates the per-event `guest_face_enrollments` table — full-res `asset_url`, `consent_at NOT NULL` (biometric consent structurally mandatory), `face_vector`/`vector_model` NULL until Papic, `revoked_at`, partial unique index `(event_id,guest_id) WHERE revoked_at IS NULL`, RLS Pattern B + guest-reads-own. Display photo is split from the face-rec asset so a Gmail avatar (display-only) never enrolls.
- **Couple grid** (`guests/_components/guest-list-multiselect.tsx` + `guests/page.tsx`): desktop table + mobile stacked list → a responsive **photo-card grid** (2/3/4-col desktop · 2-col mobile). New `GuestCard` (portrait `aspect-[4/5]` `object-cover` photo with side-tinted **initials fallback**, side ring + corner SidePill, role/RSVP/group chips, **stretched-link** to detail so the selection checkbox + group-remove form never nest in the anchor) + `GuestPhoto`. **Selection store / SelectionBar / mobile-carousel lockstep / bulk role·side·group·delete / swipe-to-delete all preserved.** `page.tsx` resolves `photoDisplayUrls` server-side via `displayUrlForStoredAsset` (the `<FileUpload initialDisplayUrls>` contract — presigns r2:// refs, passes Google URLs through). `lib/guests.ts` `GuestRow` + `GUEST_FIELDS` gain the 3 photo fields.
- **Gmail avatar** (`join/[eventId]/actions.ts`): captures `user_metadata.avatar_url`/`picture` as `photo_source='oauth_google'` on guest create + email-match — match path guarded `WHERE photo_url IS NULL OR photo_source='oauth_google'` so it never clobbers a selfie. Priority ladder selfie > couple_upload > oauth_google > initials, enforced in each writer's WHERE.
- **RSVP selfie** (`[slug]/page.tsx` + `actions.ts` + new `_components/selfie-capture.tsx`, `lib/face-gate.ts`, `api/guest-selfie/route.ts`): front-camera mirror capture → **guest-SESSION-authorized presign** (`/api/guest-selfie`, because RSVP guests are cookie-authed not Supabase-authed, so `/api/upload` would 401 them) → R2 (un-watermarked event photo, full-res = the face-rec asset). Advisory **MediaPipe Tasks Vision FaceDetector** quality gate (exactly 1 face · ≥10% frame · roughly frontal via eye keypoints · brightness band); `@mediapipe/tasks-vision` is **dynamically imported** so its WASM+model stay off the shared bundle; **degrades gracefully** (warns + allows; never blocks RSVP). Selfie step reveals on "I'll be there" via pure CSS `:has()`. A separate **biometric-consent checkbox** (RA 10173) gates the capture UI only. `submitRsvp` persists `photo_source='selfie'` + upserts the enrollment (best-effort — a selfie/enrollment failure never rolls back the RSVP).
- **Revocation (RA 10173):** guest-facing `withdrawFaceConsent` ("Remove my photo & face data" under the RSVP) revokes the live enrollment + clears the selfie photo; couple-side — unchecking the existing `photo_consent` toggle on the guest detail page now also revokes the enrollment + clears the selfie (a Gmail avatar, being non-biometric, is left intact).

**Verify:** `tsc --noEmit` clean · `next lint` clean (only pre-existing warnings; both new `<img>` tags carry eslint-disable) · production build exit 0 · `bundle-size-check` **199.1KB gz / 200KB budget** (MediaPipe confirmed OFF the shared chunk). Both migrations dry-run-confirmed + applied to prod + Local==Remote in `supabase migration list`. Live authed render isn't runnable in-worktree (Supabase keys are Vercel-only) — the PR's **Vercel preview is the first clickable surface**; CSP is `frame-ancestors`-only so the MediaPipe CDN fetch + same-origin `camera=(self)` both work.

**SPEC IMPACT:** Net-new biometric capture (guest selfie + per-event face enrollment) — a V1 expansion the owner directed, aligned with the spec's existing `FaceEnrollment` vision + 0025 face-data revocation. Corpus to update directly: **0001** (guest list = photo grid; Gmail/selfie sources), **0002** (RSVP selfie step + biometric consent), **0012** (Papic face source = `guest_face_enrollments` RSVP selfie; matching/embeddings still a future build — schema ready via `asset_url`/`face_vector`/`vector_model`), **0025** (face-data revocation control), **DECISION_LOG** (2026-06-05 row). Self-host follow-up: mirror the MediaPipe WASM+model to R2/`/public` to drop the runtime CDN.

## 2026-06-05 · feat(0021): live HH:MM:SS countdown + roadmap shows 3-at-a-time with overdue flag

**Context:** Owner on the couple Home: *"for the countdown we have big day then under it is the hours, minutes, seconds. will [be] timed from the date 12 mn not the schedule of the church wedding."* and *"things to complete will only show 3 at a time. will repopulate new tasks when done. also no[te] if this task is already due."* Two Home refinements, building on the same-day roadmap auto/manual work (#1032).

**What changed:**
- `app/dashboard/[eventId]/_components/live-countdown.tsx` — under the big day count, a **per-second HH:MM:SS** ticking down the time left in the current PH day (= exactly when the day count drops). Confirmed the countdown already anchors on **PH-midnight (12MN)** of the event date via `targetMs` (`…T00:00:00+08:00`) — never a ceremony/church time — so "timed from 12MN" needed no change, only the ticker. Single `nowMs` state, ticks 1s; SSR seeds from `serverNowMs` (no hydration mismatch); ticker is `aria-hidden` so SRs aren't spammed.
- `lib/wedding-roadmap.ts` — `ItemDef` gains `idealByMonths` (band lower edge); `RoadmapItem` gains `overdue` (months-to-earliest < ideal). `resolveRoadmap` takes an optional `limit` and orders **overdue-first** then planning order. `RoadmapSignals` / `countRoadmapDone` unchanged.
- `app/dashboard/[eventId]/_components/wedding-roadmap-async.tsx` — renders `resolveRoadmap(…, 3)` (**3 at a time**; refills on each revalidate as items complete) + an amber **Overdue** badge (owner picked "badge + always surface"). The "X/11 done" count still spans the full flow.

**Verify:** `tsc --noEmit` clean · `next lint` clean on all 3 files · **17/17 roadmap logic assertions** (cap=3, refill on done, overdue flag + overdue-first ordering, civil-couple fallback survives the cap, null-signals degrade) · **countdown math** checked against known inputs — Jun-5→Dec-8 yields **186 days** (matches the owner's screenshot) + `08:00:00` at 16:00 PH, `1 day · 06:00:00` the eve, `Today` at 00:00. Live browser render not runnable in-worktree (public Supabase keys are Vercel-only) — the PR's Vercel preview is the first clickable surface.

**SPEC IMPACT:** Iteration 0021 Home — countdown gains a live H:M:S (midnight-anchored, already true); roadmap is capped to 3 + overdue-flagged. Logged in corpus `DECISION_LOG.md` (2026-06-05); STATUS line-26 updated.

## 2026-06-05 · feat(0021): Wedding Roadmap auto-checks the 8 confirmable "things to complete"

**Context:** Owner on the couple Home **"Things to complete"** list: *"some needs manual done and some needs automatic. we have automatic like date, finalize venue, etc."* The roadmap shipped earlier today (PR #1021) as 100% manual tap-Done — explicitly NOT automated to avoid the retired Today's-Focus inference. This refines that: items the app can confirm from a hard structural fact auto-check; the soft ones stay manual.

**What changed:**
- `lib/wedding-roadmap.ts`: new `RoadmapSignals` type + `countRoadmapDone()`. `resolveRoadmap()` takes optional signals and treats an item as done when **auto-satisfied OR manually checked**. 8 of 11 items are "confirmable" (`lock_date` · `reception_venue` · `ceremony_venue` · `budget` · `guest_list` · `core_vendors` · `seating` · `setnayan_capture`); `reception_look` · `save_the_dates` · `invitations` have no reliable signal and stay manual-only.
- `app/dashboard/[eventId]/_components/wedding-roadmap-async.tsx`: derives signals from 4 lightweight parallel reads (`event_vendors` status/category · guest count · `event_tables` count · paid/fulfilled capture `orders`) + the events row (`event_date` · `estimated_budget_centavos`). Reuses `CONFIRMED_VENDOR_STATUSES` + `PLAN_GROUPS` venue categories so the signal can't drift from plan-card bucketing. Header count now reflects the hybrid done total.
- `app/dashboard/[eventId]/actions.ts`: `toggleRoadmapItem` doc updated — it is now the manual *fallback* leg of a hybrid model.
- **Never-stuck guardrails:** an auto item the app can't confirm (e.g. a civil / same-venue couple → no separate ceremony-venue signal) KEEPS its manual Done button; a failed signal fetch degrades to pure manual (nothing hidden). Deterministic structural facts only — not Today's-Focus inference.

**Verify:** `tsc --noEmit` clean · `next lint` clean on all 3 files · 18/18 pure-logic assertions pass (tsx harness: uncommitted-date keeps `lock_date` open · all-8-signals event leaves only the 3 manual items · civil couple keeps `ceremony_venue` · null-signals → all-manual fallback · honest auto+manual count). Live browser render not runnable in-worktree (public Supabase keys are Vercel-only); data-layer queries validated against schema + mirror existing `getConfirmedVendorCount` / add-on-stats patterns. **No migration** — all signals read existing columns/tables.

**SPEC IMPACT:** Iteration 0021 — the Wedding Roadmap is now **hybrid auto/manual**, superseding "explicitly NOT automated." Logged in corpus `DECISION_LOG.md` (2026-06-05) and reconciled directly in the corpus per the owner's 2026-06-04 direct-edit authorization (no Cowork PENDING needed).

## 2026-06-05 · feat(onboarding): heart (save) button on the in-app services carousel

**Context:** On the "Your Plan" upsell, owner wanted each in-app-service poster to carry a heart/save button alongside what-it-does · benefits · outside price · Setnayan price. The "Boost & enhance" carousel (screen 15) already showed all of those — poster, benefit, **struck-through outside price (`SVC.out`) + Setnayan price (`SVC.set`)**, and "save ₱X vs hiring [X]". The only missing affordance was the heart.

**What changed** (`app/onboarding/wedding/`):
- `_components/onboarding-shell.tsx` — the detail poster gains a **heart-toggle overlay** (top-right); the CTA reworded `+ Add`/`✓ Added` → **`♡ Save`/`♥ Saved`**; the carousel chip's `✓` → `♥`. All three bind the **same** `interestedServices` state (one save mechanic, which already drives the screen-16 summary + Purchase Now).
- `_styles/onboarding.css` — `.svc-heart` (poster overlay; mulberry when on) + `.svc-poster{position:relative}`.

**Verify:** `tsc --noEmit` clean; `next lint` clean for the files. No new state, no migration.

**SPEC IMPACT:** None — adds a heart affordance to an existing, already-spec'd services carousel; the "saved" signal feeds the existing interested-services capture. Logged in corpus `DECISION_LOG.md`. (NB: owner's screenshot showed the old screen-14 *Classic Bundle* — a deploy lag; the à-la-carte carousel is the current upsell on `main`.)

## 2026-06-05 · fix(onboarding): scroll-snap the "Boost & enhance" service carousel

**Context:** Owner on the Your-Plan **"Make it unforgettable"** screen (step 15): *"snap carousel at the bottom part."* The bottom film-strip of in-app-service cards (Papic · Advanced Website · Animated Monogram · Panood …) scrolled freely with no snap.

**What changed** (`onboarding.css`): the `.svc-car` track gains `scroll-snap-type:x proximity` + `-webkit-overflow-scrolling:touch`, and each `.svc-chip` card gains `scroll-snap-align:start` — so a swipe settles cleanly on a card edge. Matches the snap pattern the sibling `.pgrid.strip` (cuisine/look strips) already uses. CSS-only · no markup/JS · no dimension change.

**Verify:** Snap is a scroll behavior (not visible in a static screenshot, and step 15 needs auth to reach locally); applied the exact `proximity` + `scroll-snap-align:start` pairing already proven on `.pgrid.strip`. Build via CI.

**SPEC IMPACT:** None — interaction polish on the existing Your-Plan v2 screen.

## 2026-06-05 · feat(onboarding): surface the "reach my best matches" inquiry opt-in on the congrats screen

**Context:** On the congrats screen ("You did the hard part"), owner wanted "Keep using Setnayan AI to help finish your wedding" + the "how many inquiries (1–5)" question right there. That control already existed one screen later (Your Plan, step 14): a `sendTopInquiries` toggle + a 1–5 `inquiriesPerCategory` stepper (default 3) that auto-inquires the best-fit vendors per category at the terminal commit. Owner picked **"also surface it on congrats"** (over reframe-in-place / leave-as-is).

**What changed** (`app/onboarding/wedding/_components/onboarding-shell.tsx`):
- Congrats screen (step 13) gains a second instance of the inquiry opt-in — **"Keep Setnayan AI helping finish your wedding"** toggle + the 1–5 **"inquiries per category"** stepper — reusing the existing `.optcard` / `.opt-*` markup and binding the **same** `state.sendTopInquiries` / `state.inquiriesPerCategory`. No new state, no new CSS.
- Safe by construction: the inquiry fan-out commits **once** at the terminal step (16), so editing the shared state on screen 13 *or* 14 never double-sends. Stays **opt-in** (`sendTopInquiries` default `false`).

**Verify:** `tsc --noEmit` clean; `next lint` clean for the file (only pre-existing warnings elsewhere). No migration.

**SPEC IMPACT:** None — presentation of an already-spec'd control. Owner choice logged in corpus `DECISION_LOG.md` (2026-06-05) for traceability. ("Setnayan AI help" here = the free matching+inquiry engine; the paid Today's Focus/Concierge assistant stays retired.)

## 2026-06-05 · feat(onboarding): every Style-step selector is a swipeable carousel

**Context:** Owner on the Style sub-stepper: *"make these carousel style. we will not have buttons anymore … the whole onboarding should familiarize the users that we do carousel for our app,"* clarified as *"like the one on service style — they are buttons but we will make them all carousels."* So: keep **Continue**, but every selectable **grid** (Reception, Ceremony) and **chip row** (Service style, dietary, photo-need, coverage) becomes a horizontal swipeable carousel — Catering & Photo/Video cuisine/look strips were already carousels. One consistent swipe idiom across onboarding.

**What changed** (`app/onboarding/wedding/`):
- **Reception + Ceremony grids → big-card carousels** (`onboarding-shell.tsx`) — the 2-col `.pgrid` becomes `<Rail className="pgrid car">`. New `.pgrid.car` rules (`onboarding.css`): one tall snap-centred venue card at 80% width + a peek of the next, **filling the viewzone** (these steps have no hero) exactly like the grid-fill it replaces. Multi-select (reception) / single-select (ceremony) preserved.
- **Chip rows → chip rails** — Service style, dietary (catering) and "What do you need? / What's included?" (photo/video) wrap in `<Rail className="chips" wrapClassName="chiprail">`. `.rail` is already nowrap-scroll, so chips now scroll horizontally instead of wrapping (shorter vertically · helps Golden-Rule-1 no-scroll). Reuses the same `<Rail>` fade + chevron "more →" affordance as the cuisine/look strips; when a row already fits, `.railwrap.flat` hides the affordance (e.g. the 2-chip dietary row).
- `Rail` gained an optional `wrapClassName` (applied to `.railwrap`) so chip rails recentre the chevron for the short row height. Both vestigial `data-single`/`data-diet-row` markers dropped (selection is React-controlled, not attribute-driven).
- Follows the **faith step**, whose chips were already converted to a horizontal scroll strip (2026-06-04) — this generalises that to the Style steps.

**Verify:** Rendered the real `onboarding.css` against the exact React DOM in a static harness (the onboarding route needs Supabase auth to reach locally). At 402px: Reception shows one immersive swipe card + peek + chevron, **no vertical scroll**; Catering shows hero + cuisine strip + Service-style chip rail (Plated selected · "Stations" behind the › chevron) + flat dietary row, all fitting one viewport. `tsc`/`lint`/`build` via CI + Vercel preview (the change is a `<div>`→`<Rail>` swap + CSS — no new types).

**SPEC IMPACT:** The corpus prototype `Onboarding_Wedding_Flow_2026-06-01.html` renders Reception/Ceremony as plain grids and Service-style as wrapping chips — now superseded by carousels everywhere. A `DECISION_LOG.md` row is landing directly in the corpus; the prototype itself is a separate reconciliation (already flagged stale).

## 2026-06-05 · feat(onboarding): venue search expands by serviceability rings (region rings, not hard-drop)

**Context:** Owner design session on the find-first-vendor step (12), which showed every venue under one "★ Matches your preference" group. Owner's model: surface *everything serviceable* by expanding outward in concentric rings, and hard-cut only the impossible. Region was a **hard filter** (out-of-area venues dropped) — owner locked it to **ring** instead: in-area first, then "Farther afield" behind Expand. Capacity-can't-fit, booked-date, and wrong-ceremony are *already* hard-removed by the leaf-match engine (which matches the owner's remove rule), so this PR only changes region + the presentation.

**What changed** (`app/onboarding/wedding/`):
- **`actions.ts` — `searchOnboardingReceptionVenues` now rings region.** Pass 1 (region-scoped) → `tier:'native'` (rings 1–2). When a region is scoped, Pass 2 re-runs WITHOUT region and subtracts the natives → `tier:'travel'` (ring 3 · ≤6): out-of-area venues that still pass every OTHER leaf dim (capacity/ceremony/venue_type/date) are no longer dropped. `OnboardingVenueResult` gains `tier:'native'|'travel'`.
- **`onboarding-shell.tsx` — ring-split render.** "★ Matches your preference" (natives) → **Expand search — see N farther venues** → "Farther afield — outside your area" (travels, `Outside your area` flag). A 🚫 remove-note explains the real hard cuts; a mulberry note bridges to the reception-anchor model (every later vendor ringed by who can REACH the venue, far ones flagged "travel fee may apply"). Sub copy → "…then everyone who can host you."
- **`_styles/onboarding.css`** — `.softflag` (amber demote chip) + `.removednote` (dashed remove note).

**Verify:** `tsc --noEmit` clean; `next lint` clean for the changed files (only pre-existing warnings elsewhere). Founder-only marketplace today → travels usually empty (no Expand shown) until vendor density grows; native list + notes render as before. No migration.

**SPEC IMPACT:** Region flips from hard-filter to **ringed** in the leaf-match contract. Logged in corpus `DECISION_LOG.md` (2026-06-05) + prototype `Onboarding_Wedding_Flow_2026-06-01.html` step 13 rebuilt to match. Pending corpus mirrors: leaf-match region-ringed note · 0007 Transportation cross-ref · 0022 vendor radius/travel control. **Deferred (need data, not fakeable per "real numbers only"):** budget demote-flag (no price in venue search), style ring-1/2 sub-split (engine doesn't return `compatible_venue_settings`).

## 2026-06-05 · fix(onboarding): un-stretch the Church ceremony photo (Style step)

**Context:** Owner spotted the **Church** card on the wedding-onboarding *"Where will you hold your ceremony?"* Style step looking **stretched** — the couple rendered unnaturally tall/narrow. Root cause is the asset, not the layout: the five `ceremony_*.webp` cards were generated **1820×1024 → resized into 520×520** (a non-uniform squish, per the 2026-06-01 corpus decision-log row), baking a ~1.78× vertical stretch into the source pixels. `.pcard .pimg.haspic` already uses `background-size:cover`, so the CSS faithfully renders the baked-in distortion. Only `ceremony_church` reads as broken (its composition exposes it); garden/beach/civil/same_reception read natural and are left untouched.

**What changed** (`apps/web/public/`):
- **`onboarding/prefs/ceremony_church.webp`** (+ proto mirror `proto/assets/prefs/ceremony_church.webp`) regenerated by **reversing the squish** — horizontal stretch ×(1820/1024) back to 924×520, then center-crop (cover) to a true 520×520 square. Same owner-approved Filipino-couple-at-a-candlelit-Catholic-altar photo, now with natural proportions; 43.0 KB (was 43.6 KB), in the sibling size range. No code, no CSS, no migration.

**Verify:** Both files re-open at 520×520; visual check confirms natural human proportions (candles/figures no longer elongated). The card renders via `background-size:cover`, so a correctly-proportioned square cannot stretch in the landscape card slot.

**SPEC IMPACT:** The corpus copy `assets/prefs/ceremony_church.webp` is the same distorted file and the 2026-06-01 `DECISION_LOG.md` row documents the squish pipeline (`Pillow 520²`). Corpus copy refreshed + a DECISION_LOG row added directly (authorized corpus edit) recording the fix and that future pref-photo regenerations must **cover-crop to square, never squish**.

## 2026-06-05 · fix(onboarding): faith step shows a "no religion chosen" hero (wed_none) instead of a blank

**Context:** The ceremony-tradition (faith) step rendered a *blank* hero until a faith was picked — the no-selection default was `firstF ? FAITH_PHOTO[firstF] : { img: '', cap: 'Pick your tradition' }`, and the empty `img` made `HeroImg` show nothing. Owner reported it as "still none."

**What changed** (`app/onboarding/wedding/`):
- New asset `public/onboarding/wed_none.webp` (760×950, matches the faith-hero frame) — a couple silhouetted indoors looking out a wall of windows, each pane framing one of the 8 ceremony venues at sunset (Catholic · Muslim · INC · Chinese · Born Again · Christian · Cultural · Jewish).
- `onboarding-shell.tsx`: the no-selection faith default `{ img: '', cap: 'Pick your tradition' }` -> `{ img: 'wed_none', cap: 'Pick your tradition' }`. Per-faith `FAITH_PHOTO` heroes are unchanged; `HeroImg` already keys on `src`.

**Verify:** Single type-safe field change + a static asset; tsc/lint/build via CI + Vercel preview.

**SPEC IMPACT:** None new — aligns the app with the corpus prototype `Onboarding_Wedding_Flow_2026-06-01.html` + `assets/wed_none.webp` (already in the spec `DECISION_LOG.md`).

---

## 2026-06-05 · fix(onboarding): require faith/date/pax/budget (remove Skip) + picker cards fill with the photo

**Context:** Owner feedback on the live flow: (1) remove **Skip** from *Your Ceremony Tradition · When's the Big Day · How many guests · Your Working Budget* — these drive matching and shouldn't be bypassable; (2) on **"What would you love?"** the picker photo-cards should have the photo fill the whole card; (3) a reported count bug — *"select adds one on the parent category, but deselect won't go back to 0."*

**What changed** (`app/onboarding/wedding/`):
- **Skip removed from 4 screens** (`onboarding-shell.tsx`) — `CAN_SKIP` indices 3 (faith) · 5 (date) · 7 (pax) · 8 (budget) flipped to `false`. Only "Set the mood" (prefs) + find-vendors stay skippable (they sort, never gate). `canContinue` already requires an answer for each of the four (faith ≥1 / a date / pax / budget band), so removing Skip makes them required with **no dead-end** — Continue lights up once answered.
- **Picker cards = full-bleed photo** (`onboarding.css`) — `.svccard` given a fixed 140px height; `.svcph` → `position:absolute;inset:0` (photo fills the card instead of a 90px top strip); `.svclb` → absolute bottom label over a dark gradient scrim with white text (matches the `paxphoto`/`budgetcap` photo-card pattern); check badge gets `z-index:2`. Verified on the dev server (mobile 375): photo fills 116×138 inside the 1px border, label legible.
- **Count "deselect → 0" bug: investigated, code is correct — no change.** Reproduced on the running app: select → badge `1`, picks `["reception"]`; deselect → badge `0` (hidden), picks `[]`. The badge is a pure render-time derivation (`group.filter(c => picks.includes(c.cat)).length`) and `pickChip` toggles with a functional `setState` (race-proof), so the count always equals the selected-card count. Could not reproduce a stuck count. Likely a stale cache, or deselecting one of *several* selected in a category (count drops by 1, not to 0). Asked the owner to confirm specifics.

**Verify:** `tsc --noEmit` green. Dev-server QA on step 9 (picker) + the 4 gated screens. No migration.

**SPEC IMPACT:** Skip-ability of faith/date/pax/budget + the picker card visual. The corpus prototype `Onboarding_Wedding_Flow_2026-06-01.html` is the design source; a `DECISION_LOG.md` row is landing directly in the corpus. The prototype's picker is already an older layout (flagged stale alongside the monogram divergence) — reconciliation is a separate task.

## 2026-06-05 · feat(onboarding): Your Plan v2 — à-la-carte in-app services (bundle retired) + 1–5 inquiry stepper

**Context:** Owner punch-list on the shipped Your Plan: drop the one-shot bundle, replace it with a browsable in-app-services flow (carousel + per-service detail + savings → interested summary → Purchase Now), and turn the inquiry opt-in into a 1–5 "inquiries per category" stepper. Mockup-verified at 375px (3 phones) before porting. PR #1021.

**What changed** (`app/onboarding/wedding/` + the shared `unlock-category` action):
- **Bundle removed** — `MatchedBundle` + all bundle-only constants deleted; `BUNDLE_ITEMS/BUNDLE_BENEFIT/SVC/BUNDLE_ASSET` kept + reused by the new screens.
- **Two new screens** (flow 15→17; terminal commit moves 14→16): **15 Boost & enhance** (focused service detail — benefit + Setnayan price + *"you save ₱X vs hiring [role]"* — over a swipeable carousel; multi-select → `interestedServices`) and **16 Services you're interested in** (summary + totals + **Purchase Now** + a quiet **continue-free** link).
- **Purchase Now** commits the event, persists the picks to `events.style_preferences.interested_services`, and routes to the dashboard **Services** tab to pay per service (existing 0034 apply-then-pay — *no new cart, no mid-onboarding charge*). Continue-free drops the picks + lands on Home.
- **Inquiry opt-in → "Reach my best matches"** + a **1–5 per-category stepper** (default 3). The commit fan-out inquires the **top-N best-fit per picked category** via `unlockCategoryWithInquiry({ count })` — extended with an optional `count` (default 1, so the dashboard unlock-more caller is unchanged); idempotent via `chat_threads UNIQUE`.
- **Step machine**: `PHASE_SCREENS`/`SCREEN_SEQUENCE`/`NEXT_LABEL`/`CAN_SKIP` extended; screen 16 hides the global CTA + carries its own buttons (like the account gate).

**Verify:** `tsc --noEmit` + `next lint` + `next build` green. **No migration**. Owner-checked on the Vercel preview before merge.

**SPEC IMPACT:** Your Plan back-half — the à-la-carte in-app-services flow replaces the bundle (Blueprint §3.2) + prototype #screen-plan + DECISION_LOG. Flagged follow-up: screen-15 cards use the in-shell `SVC` demo prices (same flag the bundle carried) — production should read live price + build-status from the v2 customer catalog.

## 2026-06-05 · feat(vendor-payments): server-side QR decode (anti-swap) — fast-follow

**Context:** Fast-follow to the vendor payment-options feature (PR #969). The QR method's "where it sends money" was vendor-declared (typed); now Setnayan **decodes the uploaded QR server-side** so the stored `decoded_destination` is what the image ACTUALLY encodes — the anti-swap guarantee from the locked rule. (The other deferred fast-follow — wiring the per-vendor workspace page as a 2nd couple settlement mount point — was already landed in main, so this PR is just the decode.)

**What changed:**
- `lib/vendor-payment-methods.server.ts` — new `decodeQrFromR2(r2Ref)`: fetch the QR image from R2 → `sharp` rasterises to RGBA → `jsQR` reads the payload. Best-effort, never throws.
- `app/vendor-dashboard/payment-options/actions.ts` — the QR save branch stores the server-decoded value; an unreadable image keeps the vendor's typed note as a fallback AND routes the method to `pending_review` (admin verifies).
- `_components/add-payment-method.tsx` — the destination field is now an optional fallback ("we read your QR automatically").
- Added `sharp@^0.34.5` (already the version Next uses for image optimization) as a direct dep + `serverExternalPackages: ['sharp']` so the native module is traced into the `output: 'standalone'` build.

**Verification:** `tsc` 0 · `next lint` 0 · proven end-to-end (generated a QR, decoded it through the exact `sharp → jsQR` pipeline, round-tripped `gcash:09171234567`). Full CI green (production build + e2e + lighthouse).

**SPEC IMPACT:** Updates the 0034 "Vendor Payment Options" section — QR destination is now **server-decoded**, not vendor-declared (supersedes that V1 note). Landed direct in corpus + DECISION_LOG.

## 2026-06-05 · feat(0021): Wedding Roadmap — free "things to complete" on Home (manual, no automation)

**Context:** Owner — *"roadmap or things to complete we keep, but the automation of today's focus is what we do not need anymore."* After removing the paid Today's Focus, the couple keeps a simple, free roadmap of the wedding decisions — **minus the automation** (no AI, no data-detection of "done"). Manual check-off only.

**What changed:**
- **Migration `20260830000000`** — `events.roadmap_completed TEXT[]` (the item keys the couple has marked done). **Applied to prod**; additive · default `'{}'`.
- **`lib/wedding-roadmap.ts`** — the ordered task list (11 items across the 12+ / 9–12 / 6–9 / 4–6 / 2–4 month bands) + `monthsUntil(earliest)` (plain date math) + `resolveRoadmap(months, completed)` → the open items. **No data-facts / no auto-detection** — only date math + the completed array.
- **`_components/wedding-roadmap-async.tsx`** — self-fetching Home block that reads ONLY the event's date + `roadmap_completed`: a "**Things to complete**" list, timed by months-to-earliest-date, each item with a manual **Done** button (server-action `<form>`, no client JS, no links). "X/N done" + an on-track empty state.
- **`toggleRoadmapItem`** action — adds/removes the item key in `roadmap_completed` (manual check-off; validates against the key set).
- **Home** — replaces the single "Up next" hero (`TodaysOneThing`) with the roadmap; **hidden in Manual mode** like the rest of the assist. Removed the now-unused `pickTodaysOneThing` / `todaysTask` / `weddingDateMissing` (kept `countUnlockedCategories` for the countdown bar).

**Verify:** `tsc --noEmit` + `next lint` green. Migration applied to prod.

**SPEC IMPACT:** New 0021 free "Things to complete" roadmap — manual check-off, **no automation** (replaces the retired Today's Focus automation). Recorded in corpus `DECISION_LOG`.

## 2026-06-05 · feat(home): couple Home countdown — centered days-to-go hero (prototype → app)

**Context:** Owner, after approving the centered, dominating day-count in the couple-app-flow prototype (`Setnayan_Couple_App_Flow_Prototype_2026-06-04.html`) — *"push build and merge your concept. i will check on the app itself."* The shipped Home countdown rendered a small, left-aligned days · hrs · min · sec ticker; the approved prototype leads with a single big centered "N days to go" as the Home cockpit's emotional anchor.

**What changed** (`app/dashboard/[eventId]/_components/`):
- **`live-countdown.tsx` rebuilt as a days-only hero** — replaced the 4-segment (days/hrs/min/sec) per-second ticker with one dominant centered day count (`text-8xl` → `sm:text-9xl`, mulberry serif) over a `days to go` mono caption. The count is a PH-calendar-day difference (Asia/Manila fixed +08:00) so it never reads "0 days" the night before; the client re-checks once a minute (the count only flips at PH midnight) instead of once a second. The `Today` (event day) / `Just married` (past) milestone states are preserved.
- **`event-countdown-header.tsx` centered** — the card is now `text-center` and the date + venue line moved beneath the big number, matching the prototype stack: eyebrow → names → count → date·venue → vendors-locked bar. Date label bumped to `font-medium text-ink/80`.

**Verify:** `tsc --noEmit` clean + `next lint` green (only pre-existing, unrelated warnings); production build runs in CI. No migration (pure presentation + a client-side day-diff tweak). Runtime QA on the app (couple Home — needs an event with a date).

**SPEC IMPACT:** None — aligns the shipped app to the already-approved couple-app-flow prototype (2026-06-04). Iteration 0021 (couple dashboard) describes the countdown header generically; no schema/pricing/scope change.

## 2026-06-05 · fix(onboarding): monogram screen — reveal only when both initials in · drop "X / N" counter · trim to 3 designs

**Context:** Owner, testing the live "The two of you" name screen (step 5) — *"Shows a monogram with no values. we only want to show a monogram live if we already have both letters. Remove the number 2/5 on the Generate another design. Remove design #2 and #4, we will make more later — keep 1, 3, 5."* The MonoLockup rendered a `· & ·` placeholder before any names were typed, the "Generate another design" control carried a `2 / 5` index counter, and the design library shipped 5 lockups.

**What changed** (`app/onboarding/wedding/`):
- **Gate the live monogram on both initials** (`onboarding-shell.tsx`) — new `monoReady` (both bride + groom first-name initials present). `<MonoLockup>` renders only when `monoReady`; until then a quiet `.mono-empty` hint ("Your monogram appears here") holds the figure's space (new scoped CSS, sized to the lockup so there's no layout jump on reveal). No more `· & ·` mark with no values.
- **Removed the `mono-count` "X / N" counter** beside the "Generate another design" button (markup + the now-dead `.mono-count` CSS rule). The button itself is unchanged.
- **Trimmed `MONO_DESIGNS` 5 → 3** — kept #1 `bar`, #3 `duo`, #5 `infinity`; dropped #2 `script` + #4 `framed` ("more to come"). `MonoLockup` still implements all five styles (the `script`/`framed` branches are retained for the future set); only the cycled list shrank. Existing index guards (`?? MONO_DESIGNS[0]`, `% length`) already handle any persisted out-of-range `monogramDesign`.

**Verify:** `tsc --noEmit` + `next lint` green (only pre-existing, unrelated warnings). No migration. Visual QA on the PR's Vercel preview (onboarding step 5 — anonymous-reachable, before the account gate).

**SPEC IMPACT:** The app's onboarding monogram (5-lockup "Generate another design", added 2026-06-04) is **app-only** — the corpus prototype `Onboarding_Wedding_Flow_2026-06-01.html` `#screen-name` still has the older tap-to-cycle / 6-combo mark, so it was already diverged. A `DECISION_LOG.md` row is landing directly in the corpus (authorized direct edit); the prototype's monogram section is flagged stale (a full reconciliation to the app's lockup approach is a separate task). Relates to the open 2026-06-04 monogram items (Trace animation · 0037 · the unapplied `event_monogram_style` migration).

## 2026-06-05 · feat(onboarding): Your Plan — powerful Freebies value block (relabels + pill fix)

**Context:** Owner on the shipped Your Plan — *"we want this to be more modern than just frames. create a powerful way to present the Freebies."* Plus: the free **Monogram**/**Website** should read "Basic" (vs the paid Animated Monogram / Pro Website), and the opt-in toggle rendered as a circle, not a pill. Mockup-verified at 375px before porting.

**What changed** (`app/onboarding/wedding/`):
- **`FreeValueSlider` rebuilt into a value showcase** — a gold "everything you get · free" block leading with a big serif **₱-total + hours hero** (counts up on entry) over a meter, then cards that **strike the "elsewhere" price → a mulberry *Free*** (gold left-spine + ghost index), closing on a mulberry **seal** tally. Replaces the plain bordered rail + the separate `.plansave`/`.planfree` blocks (the slider is now self-contained).
- **Relabels** in `FREE_TOOL_DRIVERS`: "Your wedding website" → **"Basic website"**, "Your monogram" → **"Basic monogram"**.
- **Toggle is a real pill now** — `.opt-sw` widened (48×28, 22px knob, distinct off-track) so it no longer reads as a circle.

**Verify:** `tsc --noEmit` + `next lint` + `next build` green. No migration (pure presentation; same `computeOnboardingSavings` data).

**SPEC IMPACT:** Your Plan Freebies presentation (Blueprint §3.2 + prototype #screen-plan) — corpus mirror to follow. The à-la-carte in-app-services flow (remove bundle + screens 15–16 + 1–5 inquiry stepper) is the next PR (PR-b).

## 2026-06-05 · feat(onboarding): Your Plan reframed free-first — value slider + two opt-ins

**Context:** Owner — *"fix the your plan part of the onboarding. show what you get for free… in a slider… how much time they save and what free services they get with their price if bought outside. then ask if they want to continue using our AI service to guide them, and if they want us to send inquiries to the top 3 services we found."* Screen 14 led with the paid bundle and listed freebies as one paragraph; it now leads with the free value, quantified, then asks.

**What changed** (`app/onboarding/wedding/`):
- **Free-value slider** — new `FreeValueSlider` (+ `.fvslider`/`.optcard` CSS) replaces the `.freeli` paragraph. One swipe-card per free tool with its **time saved** + **market-equivalent "what you'd pay elsewhere"** (apparatus rule: instead of hiring people / DIY toil), closing on a grand-total tally card.
- **`computeOnboardingSavings()` brought to the locked §H/§I model** (`Time_and_Money_Saved_Model_2026-06-01`, owner-locked 2026-06-03). It was still on the superseded §D values (₱32,992 · 745h · 350h website); now ~₱63.5K · ~290h typical and returns a per-driver `breakdown` the slider renders (single source — no invented numbers). The Your Plan + Congrats headline auto-updates.
- **Two opt-in cards** after the slider — **"Keep guiding me"** (free deadline-timeline guidance · default ON · NOT the retired paid Today's Focus · persisted to `events.style_preferences.guidance_opt_in`) and **"Reach my top 3 matches"** (default OFF · explicit consent · RA 10173). Both live in `OnboardingState` → `commitOnboardingWedding` payload.
- **Inquiry fan-out gated + capped.** The commit previously fanned out an inquiry to **every** picked category unconditionally; it now fires **only** when "reach my top 3" is ON, capped to the **top-3 picked categories'** best-fit vendor (≤3 inquiries; `chat_threads UNIQUE(event,vendor)` dedupes). Kept synchronous (capped set is small + faster than the old all-groups fan-out; `unlockCategoryWithInquiry` reads the cookie session via `auth.getUser()`, which `after()` would lose).
- **Paid `MatchedBundle` demoted** below the two asks (label → "Want more — matched to your wedding").

**Verify:** `tsc --noEmit` + `next lint` + `next build` all green. No migration (guidance flag rides the existing `style_preferences` JSONB; opt-ins in client state). Visual QA on the Vercel preview (Screen 14).

**SPEC IMPACT:** Your Plan structure → `Onboarding_Blueprint_2026-05-30.md` §3.2 + the prototype `Onboarding_Wedding_Flow_2026-06-01.html` #screen-plan + `DECISION_LOG`. Landing directly in the corpus (decision-log → .md → .docx). Also resolves the open "onboarding still sells Today's Focus ₱1,499" contradiction — the AI-guidance ask is FREE.

## 2026-06-05 · feat(onboarding): picker → category photo-carousels + shared carousel affordances (more →/end-line) + start empty

**Context:** Owner — wanted the step-9 "What would you love?" picker to **start empty**, to feel less cluttered ("keep it one scroll but make it not feel too long"), and then to apply the same carousel cues to **all** onboarding carousels. The picker was a 53-text-chip wall under a sticky preview panel (broke the no-scroll / photo-forward onboarding golden rules); the only other carousel (style-prefs cuisine + photo/video strips) had no scroll affordances.

**What changed** (`onboarding-shell.tsx` + `onboarding.css`):
- **New reusable `<Rail>`** — wraps any horizontal carousel and self-describes via classes toggled on scroll: a floating **`›` "more"** chevron + right-edge fade when there's more to the right, a **left-edge fade** once you've scrolled, and a **vertical end-line** at the end. Rows that already fit get `.flat` and show none of it. Uses a scroll listener + `ResizeObserver` + a post-image settle re-measure.
- **Picker redesign** — the preview panel + chip rows are replaced by **one row per taxonomy parent**, each a `<Rail>` of per-service **`<PickCard>`** photo-cards (the existing 53 `public/onboarding/picker/*.webp`). Tap = gold ring + check; category header shows a live count badge; the sub-line shows `N selected`. Service descriptions (`PICK_INFO`) move to each card's `title`/`aria-label` (hover/AT, no visual clutter).
- **Start empty** — removed the budget-matched auto-seed (`budgetStarterPicks` + its only-here `PRIORITY_TIERS`/`BAND_LEVEL`/`ALL_CATS`). Nothing is pre-selected; `canContinue` already required `picks.length > 0`, so Continue stays disabled until the couple taps one.
- **Applied `<Rail>` to the other carousels** — the two style-prefs strips (`.pgrid.strip`: cuisine + photo/video looks) now get the same affordances.

**Verification:** TSX syntax parse clean · no orphaned identifiers (removed `pickerPreview`, `budgetStarterPicks`, `PRIORITY_TIERS`, `BAND_LEVEL`, `ALL_CATS`) · design validated in an HTML proto with the real photos before porting (carousel cues confirmed: more-chevron, edge fades, end-line). Full `tsc`/lint/build/e2e in PR CI + Vercel preview for visual review. Isolated worktree off origin/main.

**SPEC IMPACT:** Onboarding picker — the corpus onboarding proto (`Onboarding_Wedding_Flow_2026-06-01.html`) + any 0016/picker spec text still show the old chip picker with a budget-seeded starter set. They should be updated to the **category photo-carousel, start-empty** design + the shared carousel affordances. (Flagged for Cowork / corpus follow-up.)

---

## 2026-06-05 · feat(onboarding): "Set the mood" feel picker → swipeable carousel

**Context:** Owner — *"set the mood must be carousel as well."* The wedding onboarding's Style steps were inconsistent: Cuisine and Photo & Video already used the swipeable photo-card film-strip, but the palette / **"Set the mood"** step still picked the feel with flat text chips.

**What changed** (`apps/web/app/onboarding/wedding/_components/onboarding-shell.tsx`):
- Palette body: the feel `PrefChip` row → a **`.pgrid.strip` carousel of `PCard`s** (one photo card per feel, single-select), reusing the exact pattern the Cuisine / Photo & Video steps already ship. Each card shows the feel's budget-tiered photo (`feel_<feel>_<tier>`); the photo-less "Others" falls back to a glyph (new `FEELEMOJI` map).
- Copy: palette sub **"Pick a feel" → "Swipe a feel."**
- Viewzone feel-hero + color swatches unchanged.

**Verification:** `tsc --noEmit` clean. Built in an isolated worktree off `origin/main`. ⚠ Not visually verified — the app dev server needs `NEXT_PUBLIC_SUPABASE_*` to boot; the change reuses the proven `.pgrid.strip` CSS (the vertical-fit rules already special-case `.strip`), so it renders like its sibling steps. Confirm on the Vercel preview.

**SPEC IMPACT:** None (schema / SKU / workflow unchanged). The design prototype `Onboarding_Wedding_Flow_2026-06-01.html` already specifies a carousel for this step — the richer photo-forward `.pgrid.car` variant that fills the screen with no hero; the app ships the lighter **film-strip** per owner's 2026-06-05 pick. Corpus is already ahead — no Cowork action (a `DECISION_LOG.md` trace row can be added directly).

## 2026-06-05 · chore(pricing/marketing): remove Today's Focus completely (customer-facing)

**Context:** Owner — *"remove the today's focus completely. we do not want this anymore."* The retired AI-planner SKU (already disabled in-app via `CONCIERGE_ENABLED=false`) still lingered on the public marketing surfaces. This scrubs it from everything a customer/vendor sees.

**What changed:**
- **`/pricing` listing removed** — `lib/v2-catalog.ts` `fetchV2CustomerCatalog` now excludes the `TODAYS_FOCUS` row (`.neq('service_code', …)`) so it drops from /pricing, the /for-vendors productions catalog, AND the admin discount-code picker (its 3 consumers) — **no DB write** (the row stays in the table, just unsurfaced). Removed its dead `BUILD_STATUS` entry.
- **Customer copy** — stripped TF mentions from the home metadata, `/signup` benefit bullets (→ "Budget + seating tools · free"), `/features` keywords, the marketing FAQ (`_fixtures`), and the à-la-carte list + footer link (`_sections`).
- **`/privacy`** — removed the "AI-assisted Today's Focus" data-processing section (it described a removed feature).
- **`/for-vendors`** — the vendor perk keeps the FEATURE but drops the brand: "Today's Focus matching/matchmaking" → "Couple matching/matchmaking" / "priority couple matching" (page + deep-dive + productions-catalog).
- **Cockpit hero** — the free "what's next" hero label "Today's focus" → **"Up next"** (the feature is unchanged; only the dead brand name goes).

**Left as-is (already invisible / follow-up):** the gated-dead concierge machinery (`lib/concierge.ts` `CONCIERGE_ENABLED=false` · `/today` redirect · `/dashboard/profile/concierge` gated tab · admin `concierge_complete` hook), the admin-internal "Today's Focus brain"/"abuse" tooling, and dev comments. Corpus sweep (Pricing.md, 0016, Site_vs_Spec_Reconciliation, etc.) tracked separately.

**Verify:** `tsc --noEmit` + `next lint` green. No migration (reader-level filter, no DB write).

**SPEC IMPACT:** Today's Focus removed completely (iteration 0016 effectively retired). Recorded in corpus `DECISION_LOG`; full spec sweep pending.

## 2026-06-05 · feat(budget): data-driven shopping range — real vendor prices replace the seeded band

**Context:** Owner — *"just have a range when actual data comes in."* The planner's per-service ₱ range was always reading the admin-seeded benchmark band, even once real vendor prices existed. Now the range comes from the **real price distribution** as soon as a service has enough listings.

**What changed** (`lib/budget-allocation-data.ts`):
- `fetchLeafMedians` now also returns the real **min · p25 · p75** of solo vendor prices per leaf (linear-interpolation percentiles).
- The resolver uses the **real min/p25/p75** for a leaf's range + floor once it clears `minSampleN` real prices; below that, the admin-seeded benchmark band carries it. So the range is benchmark-seeded on day one and **becomes data-driven automatically as listings accumulate** — no admin action.
- Leaves with **neither** a benchmark **nor** any real price are now **hidden** (no ₱0 ghost rows); they surface the moment real data arrives.

**Verification:** `tsc --noEmit` clean (full project) · `next lint` clean on the file. Code-only; no migration.

**SPEC IMPACT:** None on schema. Guide-only (no search effect). The 12 unpriced leaves now stay hidden until real vendor data exists, instead of being seeded by hand.

## 2026-06-05 · fix(onboarding): slider under the number box on the guest-count + budget steps

**Context:** Owner — on the wedding onboarding's "How many guests?" and "Your working budget?" screens, the range slider must sit *under* the number box, not above it. (Reverses the 2026-06-02 swap that had put the slider on top.)

**What changed (`apps/web/app/onboarding/wedding`):**
- `_components/onboarding-shell.tsx` — reordered both `.tapzone` stacks from `slider → ends → numbox` to **`numbox → slider → ends`** (pax screen + budget screen). Pure JSX reorder; all handlers/state (`patch`, `onBudgetAmount`, the slider gradient fill, the two-way slider↔box sync) are unchanged. Rewrote the budget block's stale `2026-06-02` "slider-on-top" comment to describe the new order.
- `_styles/onboarding.css` — `.paxslider` gains `margin-top:14px` so the slider clears the number box above it (matches the box's existing 14px rhythm). No divider added — the React design uses the bordered `.numbox`, not the prototype's dashed `.paxexactwrap`.

**Verify:** `tsc --noEmit` → 0 errors · `next lint` (onboarding/wedding) → no warnings/errors. Built in an isolated worktree off `origin/main`. Layout (numbox→slider→ends) verified in the corpus prototype render; confirm spacing on the Vercel preview's pax/budget steps.

**SPEC IMPACT:** Matches the design prototype `Onboarding_Wedding_Flow_2026-06-01.html` + `DECISION_LOG.md` — both already updated in the corpus this session with the same reorder. No schema · no SKU · no workflow change. Corpus edits land directly (inbox wound down 2026-06-04).

---

## 2026-06-05 · fix(onboarding/0016): Song Bank search returned no songs (PostgREST `or()` wildcard)

**Context:** Owner — "the search is not showing songs." The Song Bank search (#999) built a raw PostgREST `.or()` filter with `%` wildcards (`title.ilike.%q%,artist.ilike.%q%`). In an `.or()` string PostgREST's ilike wildcard is **`*`, not `%`** — a bare `%` matches literally / is URL-mangled, so every search returned **0 rows** (and `searchSongBankAction` swallows errors → `[]`). RLS + the applied 390-seed were fine.

**Fix** (`apps/web/lib/songs.ts` · `searchSongBank`): `.or(`title.ilike.*${safe}*,artist.ilike.*${safe}*`)`; also strip a literal `*` from the query.

**Verification:** `tsc` + `next lint lib` clean.

**SPEC IMPACT:** None — bug fix to #999.

## 2026-06-05 · chore(budget): seed PH-sourced benchmark prices for the Budget Planner

**Context:** Owner — *"apply this to our website."* Seeds the per-leaf benchmark prices the Budget Planner (#1000) shows couples as their starting allocation. Sourced from storia.ph (PH 2026 per-category ₱ ranges) + eventnest.ph (PH % shape), mid-range ~150-pax Metro Manila; owner-confirmed (**NOT invented**). The admin can override any line in `/admin/budget-planner`.

**What changed:** Migration `20260829000000_seed_budget_benchmarks.sql` (**applied to prod**) — UPDATEs `budget_leaf_benchmarks` for **14 leaves** (reception_venue ₱100k · catering ₱450k · photography ₱90k · florals_decor ₱70k · coordinator ₱50k · live_band ₱45k · music_entertainment / attire / rings ₱40k · host_mc ₱25k · hair_makeup / officiant ₱15k · lights_sound ₱14k · invitations ₱12k) with floor / p25 / p75 bands. The other 12 leaves stay NULL (sources don't price them; owner to seed). Data-only; no schema change; exact-PK UPDATEs against the `20260826` seed rows.

**SPEC IMPACT:** None on schema. The couple planner now shows real PH guidance instead of "not enough data." ⚠ Pax-driven leaves (catering / venue / florals) assume ~150 pax until pax-axis normalization lands. Benchmarks are GUIDE-ONLY — they do not affect vendor search/matching.

## 2026-06-05 · feat(monogram): standalone couple Monogram Maker (`/dashboard/[eventId]/monogram`)

**Context:** Couples had no returnable home to craft their wedding monogram — it was set once in onboarding + an inline wizard card. This adds the dedicated Monogram Maker "place" (`Monogram_Maker_Plan_2026-06-05.md`).

**What changed:**
- New route `app/dashboard/[eventId]/monogram/{page,monogram-maker,actions}.tsx` — initials + one of the **5 curated lockups** (bar · script · duo · framed · infinity) with a **live `AnimatedMonogramHero` draw-on preview**. `saveMonogram()` persists the SAME columns onboarding writes (`monogram_text/color/style/font_key/frame_key`) so the design round-trips everywhere (chrome switcher · QR center · landing hero). **No migration** — those columns already exist on `events`.
- `customer-nav-config.ts`: a **Monogram** entry in the "Share" group (mobile: under More; 5-item bottom-nav cap unchanged).
- "How it animates" section: the shipped draw-on + an ownership-aware upsell to the paid `ANIMATED_MONOGRAM` SKU (₱2,499) and a teaser of the wider animation library.

**Scope note:** the maker consolidates EXISTING monogram config (V1 scope). The 23-style animation **picker** + its `monogram_animation_key` column remain a **tracked expansion** (`Monogram_Maker_Plan_2026-06-05.md`) — staged here as teaser/upsell only, NOT built.

**Verify:** `tsc --noEmit` → 0 errors · `eslint` → exit 0 (4 touched files). Built in an isolated worktree off `origin/main`.

**SPEC IMPACT:** New couple surface `/dashboard/[eventId]/monogram`. Covered by `Monogram_Maker_Plan_2026-06-05.md` (added + logged in `DECISION_LOG.md` 2026-06-05). Reconcile into the 0037 / monogram spec when Cowork folds the plan in (`0037` is the separate unbuilt bespoke path). Corpus edits land directly (inbox wound down 2026-06-04).

---

## 2026-06-05 · feat(ux): narrate the Guests + Website loading screens

**Context:** Owner follow-up to the narrated Services loader — *"make a loading for website and guests also."* Both routes already had page-shaped skeletons (from the app-wide skeleton pass) but loaded **silently**; the owner wants them to *tell what they're doing* like Services now does.

**What changed (all in `apps/web`):**
- `components/loading-status.tsx`: new **`LoadingNarration`** — a small drop-in strip (gold spinner + the existing cycling `LoadingStatus`) so any route's `loading.tsx` can narrate over its skeleton. Reduced-motion-safe (the global a11y block freezes the spinner + fade; the JS timer still advances the informative text).
- `…/guests/loading.tsx`: keeps its bespoke guest-list skeleton, adds a `LoadingNarration` strip — *"Loading your guest list…" → "Counting RSVPs…" → "Organizing tables & sides…" → "Almost ready…"*.
- `…/site-editor/[eventId]/loading.tsx` (the surface the **"Website"** nav doorway actually opens — `/dashboard/[eventId]/website` is a retired redirect to it): was a bare `export { BoardPageSkeleton as default }`; now renders the board/canvas skeleton **plus** a `LoadingNarration` strip — *"Opening your website editor…" → "Loading your design…" → "Bringing in your photos…" → "Almost ready…"*.

**Verify:** `tsc --noEmit` + `next lint` (all three files) green. No migration.

**SPEC IMPACT:** None (loading-screen UX polish; no schema, pricing, or workflow change). Same family as the 2026-06-05 Services narrated-loading row in corpus DECISION_LOG.

---

## 2026-06-05 · feat(0021): Manual mode — Services accordion deep-gate (PR2 of 2)

**Context:** Completes Manual planning mode (PR1 #1002 shipped the `events.planning_mode` flag + the Guided⇄Manual toggle + Home gating). PR2 makes "off" consistent on the **Services tab** — the personalization still showing inside the plan+budget accordion now turns off too.

**What changed:**
- **`lib/vendors-plan-budget.ts`** — `buildPlanBudgetModel` gains a `personalizationEnabled` arg (default true), threaded onto `PlanBudgetModel` + each `AccordionChild`. When false (Manual), the "what to lock next" / "Do this next" nudges (`dueList`/`upNext`) are emptied — **the per-child timeline math + budget are untouched.**
- **`plan-budget-accordion.tsx`** — in Manual mode: the per-candidate **"% match" pills** are hidden (`VendorCardAtom` + `CompareSheet` skip `computeCompatScore`), the per-category **`DeadlineChip`** is hidden, and the **`NextAction` "Do this next"** hero is hidden.
- **`category-search` action + overlay** — the category-browse overlay's **"% match"** pill is gated too: the action returns `compatScore: null` in Manual; the overlay hides the pill. **Result ORDER unchanged** (the locked tier ladder).
- **`vendors/page.tsx`** — passes `personalizationEnabled: !planningManual` into the model.

**Result:** Manual mode is now fully consistent — strip collapsed (PR1), Home tasks+deadlines off (PR1), accordion match pills + deadline chips + lock-next nudges off (PR2). The vendor **directory still works** (search · browse · compatibility filters · neutral order).

**Verify:** `tsc --noEmit` + `next lint` green. **No migration** (reuses PR1's `events.planning_mode`).

**SPEC IMPACT:** Completes the 0021 Manual mode (decision already in corpus `DECISION_LOG`). 0021 spec edit pending.

## 2026-06-05 · fix(ci): resolve duplicate migration timestamp 20260826000000 (rename the unapplied songs twin)

**Context:** Two migrations on `main` shared the 14-digit prefix `20260826000000` — `20260826000000_budget_planner_config_benchmarks.sql` (PR #1000) and `20260826000000_songs_itunes_cache_and_390_seed.sql` (song-bank PR). This reddened the **"migration timestamp guard"** CI job (`.github/workflows/ci.yml`) on `main` and therefore on *every* open PR. The guard exists because `supabase db push` keys `supabase_migrations.schema_migrations` on the prefix, so a duplicate crashes the push after one migration's DDL has already run (half-applied prod).

**Which is applied (verified):** `supabase migration list --db-url "$SUPABASE_DB_URL"` shows the `20260826000000` prefix twice — one row with a REMOTE entry (applied), one with a blank REMOTE (pending). The applied one is **budget_planner** (DECISION_LOG: "applied to prod via monogram-isolation"; the planning_mode PR #1002 bumped itself to `20260827` "off a pre-existing `20260826` collision … the songs-twin drift on main is unrelated"; and the budget-planner UI is live in prod). The **songs** migration is the never-applied twin (its DDL was skipped because the prefix was already in `schema_migrations`).

**What changed:** pure `git mv` of `20260826000000_songs_itunes_cache_and_390_seed.sql` → **`20260828000000_songs_itunes_cache_and_390_seed.sql`** (filename only; `git` confirms `R100`, zero content lines changed). budget_planner is left untouched at `20260826000000` so it still matches the remote `schema_migrations` PK. Renaming the songs twin (not budget_planner) is safe twice over: it's the *unapplied* one, AND it's fully idempotent (`ADD COLUMN IF NOT EXISTS` · `CREATE INDEX IF NOT EXISTS` · `INSERT … ON CONFLICT DO NOTHING`), so re-applying it under the new version can't error.

**Verify:** `ls supabase/migrations | grep -oE '^[0-9]{14}' | sort | uniq -d` → empty (guard passes). No code/typecheck surface (migration rename only).

**⚠ Follow-up for the owner:** the songs migration is now a fresh **pending** version — prod is still **missing** `songs.apple_track_id` / `preview_url` / `artwork_url` + the 390-song seed (they were never applied). Apply it on the next push: `supabase db push --db-url "$SUPABASE_DB_URL"` (additive + idempotent + nullable → safe). Separately still pending: the `20260817` monogram migration (merged-but-unapplied) — out of scope here.

**SPEC IMPACT:** None (migration filename rename; no schema, pricing, or workflow change). Finding recorded in corpus DECISION_LOG.

---

## 2026-06-05 · feat(0001): CSV guest import — exact-duplicate skip (within-file + against existing)

**Context:** Follow-up to the guest-name hygiene PR (#1004) — closes the largest remaining gap from that review: CSV import had **no** duplicate detection, so re-importing a file doubled everyone and a file listing the same person twice inserted both.

**What changed** (`apps/web/app/dashboard/[eventId]/guests/`):
- **`import/actions.ts`** — before insert, builds a set of normalized `first|last` keys already on the event (graceful-degrade to empty on query error) and skips any row whose key is **already on the list** OR **seen earlier in the same file**. Exact-normalized match only (shared `norm` from `lib/guest-dedupe`); fuzzy nickname/typo matches are deliberately NOT auto-skipped — a bulk import shouldn't silently drop a distinct guest on a guess (that judgment stays with the interactive add forms). `skipped` now means invalid-rows only; duplicates are counted + reported separately. An all-duplicates file is a friendly no-op ("Imported 0 · skipped N duplicates"), not a validation error.
- **`page.tsx`** — import success banner now reads `duplicates` and shows e.g. *"Imported 12 guests · skipped 3 duplicates · skipped 1 invalid row."*

**Verify:** `tsc --noEmit` ✅ · `next lint` ✅ (clean on the guests dir) · `next build` ✅.

**SPEC IMPACT:** 0001 guest list — CSV import now exact-dedupes (within-file + against existing). Completes the name-quality pass (normalize all paths · dedupe on quick-add + detailed form + CSV). Lands in corpus `DECISION_LOG.md` + `0001_creating_guest_list/`.

## 2026-06-05 · feat(0001): Guest-name hygiene — normalize all 3 write paths + dedupe on the detailed form

**Context:** Owner asked what name-quality issues we can prevent at guest-list creation. We already had a nickname/typo duplicate detector, but only on the quick-add sheet, and names were only `.trim()`-ed on save. This lands the two lowest-risk wins: shared name normalization on every write path, and the existing duplicate detector extended to the detailed Add-guest form.

**What changed** (`apps/web/`):
- **`lib/guest-name.ts` (new)** — `normalizeGuestName()`: NFC-normalize, drop zero-width/BOM/soft-hyphen/bidi chars, fold all C0/C1 controls + Unicode whitespace (NBSP, ideographic space, …) to single ASCII spaces + trim, clamp to 80. **Casing left untouched** (PH names like "de la Cruz" / "Ng" break under naive Title-Case — that's a separate reversible suggestion, not a silent rewrite). Built from explicit numeric code points (no regex `\u` escapes) so the source stays ASCII-clean. Wired into **all 3 server write paths**: `new/actions.ts` (createGuest + plus-one names), `quick-add-actions.ts` (quickAddGuest), `import/actions.ts` (CSV rows + plus-one). Fixes the root cause of dedupe/search/sort misses from pasted spreadsheet/PDF junk.
- **`lib/guest-dedupe.ts` (new)** — extracted the nickname-map + Levenshtein + `findDuplicates`/`TAG` matcher out of `quick-add-sheet.tsx` into a shared, generic (`NameLike`) module; the sheet re-points to it — **zero behavior change** (verified). Dropped a dead `josê` nickmap key (unreachable — lookups normalize to `a-z`).
- **Detailed Add-guest form now warns on duplicates** — new client island `_components/guest-name-fields.tsx` renders the first/last inputs (same `name=` attrs → server action unchanged) and runs the shared matcher live, showing a NON-BLOCKING amber warning per match (role·side + "Already added" / "Same person?" / "Typo?" badge + a new-tab "View" link). `new/page.tsx` fetches the existing-guest pool, mapped down to a slim shape so **no guest PII serializes into client props**.

**Verify:** `tsc --noEmit` ✅ · `next lint` ✅ (only pre-existing warnings) · `next build` ✅. Unit tests via `tsx`: normalize **15/15**, dedupe **8/8**.

**SPEC IMPACT:** 0001 guest list — (1) name entry now normalizes on all 3 write paths; (2) duplicate detection, previously quick-add-only, now also runs on the detailed Add-guest form. Neither was documented in the 0001 spec (the dedupe tracker was code-only). Lands directly in corpus `DECISION_LOG.md` + `0001_creating_guest_list/`. **Not built (flagged):** CSV import still has no dedupe (within-file + against-existing) — the largest remaining name-quality gap.

## 2026-06-05 · fix(0021/0022): Services tab — remove coverflow tilt · tap-to-open loading · Vendors route loader

**Context:** Owner UX report on the couple **Services** tab (`/dashboard/[eventId]/vendors` — the Plan + Budget accordion): (1) the service/vendor cards **tilt and "shake"** as the coverflow scroll engine rotates them past rail-center — *"remove that … we can do the enlarge but no need for the tilt"*; (2) *"when we tap, the card enlarges to show that we are digging deeper to that service. make sure to have a loading screen"*; (3) *"from home … to the services, there is a couple of seconds that it is blank … should have a loading state … prevent the user to do any other actions until the load state is done."*

**What changed (all in `apps/web`):**
- `…/vendors/_components/plan-budget-accordion.tsx`:
  - **`curveRail`** now writes `scale()` only — the per-frame `perspective + rotateY` coverflow tilt is removed (its sign-flip near rail-center was the "shaking"); the centered-card enlarge (scale + opacity) is kept. Dropped the now-inert `.rail{perspective}`.
  - **Tap-to-open transition:** a tapped `VendorCardAtom` / `InAppServiceCard` gets an `.opening` enlarge (scale-up on the inner `.v`, never `.card`, so it doesn't fight the scroll-zoom), and a full-screen loading overlay (`ServiceOpenOverlay`, lifted to the root component like `CompareSheet` so its `position:fixed` escapes the curve-transformed `.child-block` ancestors) covers the page; `router.push` fires after the brief enlarge. The `<Link>` is kept (prefetch + ⌘/middle-click new-tab preserved) — only a plain left-click is intercepted. `onOpen` threaded root → FolderSection → ChildRail/DigitalServicesRail → both card atoms.
- **Narrated loading screens** (`components/loading-status.tsx`, new): a small client `LoadingStatus` cycles a list of status lines on a timer (advances every ~1.4s, holds on the last; entrance fade via `.loading-status-line` in `globals.css`; reduced-motion-safe — the global block freezes the fade, the JS timer still advances the informative text) so each loading screen **tells what it's doing** (owner 2026-06-05). Wired into all three surfaces below + the card-tap overlay (`ServiceOpenOverlay` gains a cycling sub-line under the vendor/service name).
- `…/vendors/loading.tsx` (**rewritten**): replaces the generic `ListPageSkeleton` with a Vendors-shaped loader that mirrors the real chrome — hides `.shell-topbar` (no header swap), paints the black budget bar (shimmer figs via the shared `<Sk>`), then a spinner + `LoadingStatus` (*"Setting up your planner…" → "Downloading your information…" → "Activating your personalized refinements…" → "Almost ready…"*) filling the content area — so the home → Services hop is a continuous, **narrated** loading state instead of a blank/mismatched flash, with nothing half-rendered tappable until the page streams in.
- `…/vendors/[eventVendorId]/workspace/loading.tsx` (**new**): a centered gold spinner + `LoadingStatus` (*"Opening the workspace…" → "Loading messages & payments…" → "Bringing in your documents…" → "Almost there…"*) that continues the drill-in loading screen after navigation (the route previously inherited the event-home skeleton — the wrong shape).

**Verify:** `tsc --noEmit` + `next lint` (all three files) green. `prefers-reduced-motion` paths preserved (no enlarge/overlay/spinner motion). Live surface = the PR's Vercel preview (the Services tab is auth-gated and there's no local `.env`).

**SPEC IMPACT:** The prototype `Plan_Budget_Accordion_2026-05-31.html` / `Vendors_Plan_Budget_Tab_Spec_2026-05-31.md` describe the rail as a coverflow with a `rotateY` tilt — the tilt is **retired** (scale-only) and a **tap-to-enlarge + loading-screen** transition is **added** per owner 2026-06-05. Recorded in corpus `DECISION_LOG.md` (direct-edit authorized 2026-06-04); deeper `0021`/`0022` `.md`/`.docx` sync of the §4 interaction detail can follow.

---

## 2026-06-05 · feat(0021): Manual planning mode — foundation + toggle (PR1 of 2)

**Context:** Owner — *"can we place a toggle for the personalization to switch off … including the deadlines for each leaf category and other automated tasks."* A self-driven **Manual mode** that turns off Setnayan's automated layer (vendor-match personalization · per-service + statutory deadlines · "Today's Focus" auto-tasks) while the app + a compatibility-scoped vendor directory + messaging stay fully usable. Default **Guided** = today's behavior. Owner explicitly accepted that Manual also hides the LEGAL/statutory dates with no warning — knowingly reversing the locked "statutory dates show to every couple" safety default (recorded in corpus DECISION_LOG).

**What changed (PR1 — foundation + the clean surfaces):**
- **Migration `20260827000000`** — `events.planning_mode TEXT NOT NULL DEFAULT 'guided' CHECK (… 'guided'|'manual')`. Additive · default = no behavior change for existing rows. (Renamed from a `20260826` collision — main already had two migrations at that timestamp.)
- **`setPlanningMode` server action** (`…/[eventId]/actions.ts`) — flips the flag (auth + `event_id` update + layout revalidate; mirrors `updateEventDate`).
- **`match-criteria-strip.tsx`** — the switch's home: **Guided** shows the criteria chips + a subtle "switch to manual"; **Manual** collapses to a slim "you're planning this yourself" bar with a one-tap "Switch to Guided". Server-action `<form>` — no client JS.
- **Home (`…/[eventId]/page.tsx`)** — in Manual mode, **Today's Focus** + **Upcoming schedules** (the deadline layer) are hidden; the countdown + activity feed stay.
- **Services (`…/vendors/page.tsx`)** — reads `planning_mode`, passes `manual` to the strip.

**Verify:** `tsc --noEmit` + `next lint` green. Migration applied to prod via `supabase db push`.

**Next (PR2):** the in-accordion deep-gate — hide the "% match" pills + neutralize the taste sort in `plan-budget-accordion.tsx` (`VendorCardAtom` + `CompareSheet`) + `category-search`, plus any per-service deadline chips, so Manual mode is fully consistent on the Services tab.

**SPEC IMPACT:** New 0021 "planning mode" (Guided default ⇄ Manual). Reverses the locked "statutory deadlines show to all couples" safety default (owner-accepted, no warning). Lands in corpus `DECISION_LOG` + `0021`.

## 2026-06-05 · feat(onboarding/0016): Song Bank — search-only music step over OUR catalogue + DB-cache

**Context:** Owner — replace the static 100-song picker with the full Song Bank, then two refinements: *"our songlist must not show. we only want the search bar"* (search-only, no browse) and *"it will search for our list"* (search hits OUR curated bank, never iTunes). Builds on the iTunes preview (PR #990). (Most of the build came from a worktree agent; finished + made search-only here.)

**What changed** (`apps/web/`):
- **Search-only music step** — new `_components/song-bank-step.tsx`: NO browseable catalogue list. The couple **searches our curated `songs` bank** (`searchSongBankAction` → `lib/songs.searchSongBank`, a DB query — **iTunes is never the search**); matches appear with album-cover previews (reusing `SongPreviewList`), tap to preview + pick. The default (no-query) view shows ONLY the couple's own picks. Search pinned at the bottom.
- **DB-cache (§5.4)** — `lib/songs.ts` + `actions.ts`: the bank reads the new cache columns; `cacheSongItunesAction` UPSERTs a freshly live-resolved preview/artwork so the next user reads it from the DB. `SongPreviewList` seeds covers from the cached row (instant), else live-resolves + persists.
- **Migration** `20260826000000_songs_itunes_cache_and_390_seed.sql` (APPLIED to prod) — additive: nullable `apple_track_id`/`preview_url`/`artwork_url` on `songs` + a guarded seed growing the curated list 100 → **390**; `ON CONFLICT (normalized_key) DO NOTHING`.
- `onboarding-shell.tsx` music dim renders `<SongBankStep>`; `onboarding.css` adds `.songbank` styles.

**Verification:** `tsc --noEmit` exit 0 · `next lint app/onboarding lib` clean · migration applied (`supabase migration list` shows 20260826000000 remote).

**SPEC IMPACT:** 0016 — the music step is now the **search-only Song Bank** over our curated catalogue (Song Bank §5–6) with iTunes preview/cache wired.

## 2026-06-05 · feat(budget): Budget Planner UI — couple planner + admin tuning/seeding/insights

**Context:** Owner — *"we want couple and admin pages for this."* The full loop on top of the 2026-06-05 allocation engine + capture table (PR #996): the couple-facing planner that turns the pure engine into a real screen, and the admin surface that fuels + governs it. Design: corpus `Budget_Planner_Allocation_Engine_2026-06-05.md`.

**What changed** (`apps/web/`, `supabase/`):
- **Migration `20260826000000_budget_planner_config_benchmarks.sql`** (**APPLIED to prod** via monogram-isolation) — `budget_allocation_config` (singleton engine knobs) + `budget_leaf_benchmarks` (the 26 PLAN_GROUPS, seeded with labels + **NULL prices** for the admin to fill — never invented). RLS: admin-all + authenticated-read (non-PII config).
- **`lib/budget-allocation-data.ts`** (new) — server resolver `resolveAllocationInputs` (event budget/pax + admin benchmarks + config + thin market medians from solo `vendor_services` → engine-ready `LeafInput`s) + `fetchAllocationAggregates` (service-role, **k-anonymity min-N gated, de-identified** — admins never see raw rows).
- **Couple planner** `app/dashboard/[eventId]/budget/_components/budget-allocation-planner.tsx` (new) + wired into the budget page. Runs the **pure engine client-side** (instant tilt, no round-trips): per-service suggested ₱ + range + share + confidence chip, cushion / over-budget / shortfall, peso-pin tilt sheet (Splurge / Standard / Save dial + free ₱ + reset-to-suggested), Save → snapshot. Guide-never-rule throughout. `budget/allocation-actions.ts` (new) writes the snapshot (couple-own RLS).
- **Admin** `app/admin/budget-planner/page.tsx` + `actions.ts` (new) — benchmark seeding table, engine-knob form, de-identified insights (min-N gated, empty until data). Nav entry in the Money group (sidebar + mobile landing + bottom-nav).

**Verification:** `tsc --noEmit` clean (full project) · `next lint` clean on all new files. Engine logic 20/20 harness (PR #996). Migration applied to prod via monogram-isolation — the owner's pending `20260817` monogram migration left untouched; `20260824` decisions table already on prod.

**SPEC IMPACT:** Builds the 0007 planner surface + the 0023 admin controls specced 2026-06-05. Corpus 0007/0023 + `DECISION_LOG.md` updated this session (Cowork direct-edit).

## 2026-06-05 · feat(0022): branch-scoped service grouping (Branches V1.x complete)

**Context:** The second half of the Branches V1.x "yes" — assign each service to a branch so a multi-location Enterprise vendor can organize its catalog per site. (Auto-lapse + Renew + ₱999 shipped in #995.)

**What changed:**
- Migration `20260825000000_vendor_services_branch_id.sql` (**applied to prod**): nullable `vendor_services.branch_id` → `vendor_branches` **ON DELETE SET NULL** (deleting a branch un-assigns its services, never orphans) + a partial index. NULL = "main / unassigned" = every existing service → additive, **zero change** for the ~all vendors without branches. RLS unchanged (branch_id is organizational, not a security boundary — `vendor_services` already gates owner/admin + agent-by-assignment).
- `lib/vendor-services.ts`: `branch_id` on the row type + a **resilient select** (falls back to the base columns if the column isn't in the DB yet → renders identically pre-migration).
- `services/actions.ts`: create + update persist `branch_id` via `resolveBranchId` (coerces a foreign/blank value to null — a service can only be pinned to the vendor's OWN branch).
- `services/page.tsx`: a "Branch" `<select>` on the add + edit forms, **gated to Enterprise vendors that have ≥1 branch** — every other vendor sees the form byte-for-byte unchanged; each service card shows its branch. Agents inherit branch scoping transitively (scoped to specific services via `vendor_service_agents`, and those services now carry a branch).

**Verify:** `tsc` + `next lint` + `next build` green. Rolled-back impersonation: column added ✓ · owner sets branch_id on a service ✓ · ON DELETE SET NULL un-assigns ✓. Applied to prod via monogram-isolation. (Incidental: the first push also applied another team's already-merged-but-pending `20260824000000_budget_allocation_decisions`; a timestamp collision with it forced renaming mine `20260824`→`20260825`.)

**SPEC IMPACT:** 0022 — branch-scoped service grouping now BUILT; completes the Branches V1.x flag. Logged in DECISION_LOG.

---

## 2026-06-05 · feat(0022): Branches V1.x — ₱999 charm price + auto-lapse + Renew

**Context:** Owner follow-ups to the just-shipped Branches feature (#986): (4) the price is **₱999 (charm)**, not ₱1,000 — aligning the code to Pricing.md §0.C (which already read ₱999); (3) build the deferred V1.x lifecycle — auto-lapse after the 28-day window + a one-tap Renew.

**What changed** (code-only · no migration):
- **₱999** — `BRANCH_FEE_PHP` 1000 → 999 (centavos follow). Every display (`peso(BRANCH_FEE_PHP)`) + the order/payment amounts update from the constant. (Pricing.md §0.C reconciled to ₱999 + Enterprise gate directly in the corpus per owner authorization.)
- **Auto-lapse (derived, no cron)** — a branch's live status is now derived from its **latest activation order**: paid + within the 28-day window (`orders.expires_at`, stamped by the admin approval hook) → **Active**; paid + past the window → **Expired**; unpaid → **Pending payment**; plus Cancelled. So lapse happens automatically at read time — no sweep, no cron ([[project_setnayan_cron_free]]). `fetchVendorBranches` now reads each branch's latest order (status + expires_at + ref) and `deriveBranchStatus(branch, order, nowMs)` computes the state.
- **Renew** — a new `renewBranch` action + an amber "Renew · ₱999" button on Expired branches creates a fresh ₱999 apply-then-pay order for the SAME branch (extracted shared `startBranchPayment` helper, reused by create + renew). On admin approval the existing activation hook reactivates it with a new 28-day window. (Auto-charge is N/A in apply-then-pay — no card on file; renewal is one tap.)
- New `expired` status (rose pill) + a "Renewal started" banner.

**Verify:** `tsc` + `next lint` + `next build` green. Renew's DB path reuses the create path's order+payment inserts (RLS-proven in #986); the new logic is the pure `deriveBranchStatus` derivation (typecheck-covered). No migration.

**SPEC IMPACT:** 0022 — Branches price = **₱999** (charm, supersedes the ₱1,000 in #986's entry) + auto-lapse/Renew lifecycle now BUILT (was flagged V1.x). Pricing.md §0.C reconciled (₱999 · Enterprise). Logged in DECISION_LOG.

## 2026-06-05 · feat(budget): median-anchored allocation engine + behavioral capture table (foundation)

**Context:** Owner design session (2026-06-05) — a top-down budget *allocation* layer to sit atop the existing *tracking* ledger (`lib/budget.ts`): recommend a ₱ target + shopping range per service *before* the couple picks anyone, derived from the median of solo vendor prices, proportioned across the chosen services and scaled to budget — a **guide, never a rule**. Full design: corpus `Budget_Planner_Allocation_Engine_2026-06-05.md`. This PR ships the pure engine + the Layer-1 capture table only (no UI yet).

**What changed** (`apps/web/`, `supabase/`):
- **`apps/web/lib/budget-allocation.ts`** (new) — pure `computeBudgetAllocation()` (mirrors `lib/compat-score.ts`): median→proportion→₱ spine; **fixed-then-proportion** (known Setnayan SKUs carve off the top); **cushion / slack-first** absorption (surplus parks as a visible cushion; a pin drains cushion → then proportional drain of unpinned leaves — emergent from the slack-vs-tight branch, no ordering loop); **soft-floor** warn-don't-block + feasibility shortfall; **p25–p75 band**; thin-data → admin-benchmark fallback + per-leaf confidence. `surplusMode` config toggles `'park'` (default, the endorsed cushion model) vs `'distribute'` (naive 1-leaf = 100%). Weights/knobs = one admin-tunable constant; **no prices invented** (all caller-supplied or a proportion of the couple's own budget).
- **`supabase/migrations/20260824000000_budget_allocation_decisions.sql`** (new) — Layer-1 behavioral capture (operational/identified): per-leaf default-vs-final + pin-order + auto-reduced + segment tags. **RLS at CREATE · couple-own-only · admins INTENTIONALLY get no blanket read** (privacy-by-design — gated service-role export only); RA 10173 erasable (event cascade + couple delete); snapshots immutable (no UPDATE policy). De-identified Layer-2 + cron-free rollup = follow-on.

**Verification:** `tsc --noEmit` clean (full project) · `next lint` clean on the engine · throwaway runtime harness **20/20** (the owner's worked example reproduces exactly: cushion 150k → pin 450 leaves others untouched → pin 550 drains 270/108/27/45; fixed carve-out; soft-floor-warn-not-clamp; over-budget; input-sensitivity). The engine is unimported (additive) so the production build is unaffected; CI covers `next build`.

**⚠ Migration NOT applied to prod.** `supabase db push` is unsafe here — it would co-apply the owner's pending `20260817_event_monogram_style` (theirs to deploy), and the version originally collided with a remote-only `20260823` (the vendor_self_comp_caps RLS migration; renamed mine → `20260824` to fix). Nothing consumes the table yet, so it ships ahead of application; apply deliberately (monogram-isolation) when the planner UI lands.

**SPEC IMPACT:** NEW capability — design landed in corpus `Budget_Planner_Allocation_Engine_2026-06-05.md` + `DECISION_LOG.md` (2026-06-05). Folds into 0007 (planner) / 0025 (privacy) / 0023 (admin) — applied directly to the corpus this session (Cowork direct-edit authorization).

## 2026-06-05 · fix(0022): vendor_self_comp_caps RLS — vendor reads its own comp cap

**Context:** Owner follow-up to the "RLS-enabled-but-no-policy" flag. Investigation: of the 4 flagged objects, **3 are VIEWS** (`vendor_active_ads`, `vendor_active_tools`, `vendor_market_stats`) — views can't carry RLS, so their no-policy state is correct-by-design, not a gap. Only **`vendor_self_comp_caps`** is a real table with RLS enabled + zero policies, so only `service_role` could read it. The vendor self-comp quota reader (`lib/self-purchase.ts:fetchSelfCompQuota`) runs under the vendor's authed client, so an admin-raised cap was invisible (the read returned nothing → the code fell back to the default cap of 12). No data was wrong, but a raised cap never took effect.

**What changed** (`supabase/migrations/20260823000000_vendor_self_comp_caps_rls.sql`, applied to prod):
- `vendor_self_comp_caps_owner_read` — owner + team-admin of the vendor read their OWN cap (`current_vendor_profile_ids()`).
- `vendor_self_comp_caps_admin_manage` — platform admin sets / raises caps (`is_admin()`).
- RLS-only · idempotent (DROP IF EXISTS → CREATE) · no code change (the reader already passes the vendor's client + `vendor_profile_id`).

**Verify:** rolled-back impersonation — 2 policies created · owner reads own cap (25) ✓ · stranger blocked (0) ✓. Applied to prod via monogram-isolation (`20260817` left untouched).

**SPEC IMPACT:** None — RLS hardening of an existing table; the 3 views are not a gap. Logged in DECISION_LOG.

---

## 2026-06-05 · feat(onboarding): name-screen monogram auto-restyles every 30s

**Context:** Owner — *"animation loop will happen every 30 seconds"* (onboarding fix list). The name-screen monogram (`MonoLockup`) only changed style when the couple tapped **"Generate another design"** (`cycleDesign`). It now also cycles through the 5 lockups on its own so couples see the styles without tapping.

**What changed** (`apps/web/`):
- **`app/onboarding/wedding/_components/onboarding-shell.tsx`** — a new `useEffect` (sibling to the existing 4.5s `monoReplay` self-draw loop) advances `monogramDesign` to the next of the 5 `MONO_DESIGNS` every **30 s** and bumps the pop; the design change re-keys `MonoLockup`, so the Trace self-draw replays for the new lockup and the "n / 5" counter updates. **Gated to step 4 + `prefers-reduced-motion`** (reduced-motion → one static design, no auto-restyle); the interval + pop timeout are cleared on unmount.
- **`app/_components/event-monogram.tsx`** — corrected a stale comment that claimed the switcher renders "no frame": the `framed` lockup DOES draw its gold frame at chrome size (comment only · behavior unchanged — the switcher already shows the couple's created monogram).

**Verification:** `tsc --noEmit` clean · `next lint` clean (no new warnings in the touched files) · the underlying restyle path (`regen`/`cycleDesign`) verified live in the corpus prototype (wreath→oval→crest cycling · no console errors); the 30 s loop reuses that proven path.

**SPEC IMPACT:** 0016 / `Onboarding_Blueprint` — the name-screen monogram now **auto-restyles every 30 s** (was tap-only "Generate another design"). Logged in corpus `DECISION_LOG.md`; blueprint lines 68/95 ("tap the monogram to restyle") should gain "+ auto-cycles every 30 s" — left for the owner's Cowork pass (the blueprint `.md`/`.docx` currently carry owner WIP).

## 2026-06-05 · chore(onboarding): new role-screen photo (bride · groom · maid of honor)

**Context:** Owner — *"change the photo here. we want a photo of a bride (left), groom (center) and the maid of honor (right) chatting and laughing."* The "Who are you in this wedding?" role screen (step 1) hero (`ASSET('role')`).

**What changed:** Replaced `apps/web/public/onboarding/role.webp` with a new image matching the brief — bride on the left (white lace gown + bouquet), groom centre (cream barong tagalog), maid of honor on the right, all chatting and laughing at a warm heritage venue. Generated via Recraft (`realistic_image` · `natural_light`), downscaled to 1280×720 lossy WebP (68 KB) to keep the original's 16:9 footprint and a lean payload. Caption ("You and your people.") and all code unchanged.

**SPEC IMPACT:** None — asset swap only.

---

## 2026-06-05 · fix(onboarding): no prefilled defaults (date / religion / guests / budget) + deliberate venue loading

**Context:** Owner — *"onboarding should have no starting value to any of the pages. no initial date, no initial guests, no initial budget, no initial religion. all inputs should not have a value."* Plus: *"add a loading … as it populates the vendors for the reception venue."* `EMPTY_ONBOARDING_STATE` was already empty (`dateCandidates: []`, `faith: []`, `pax: null`, `budgetBand/Amount: null`) — but each screen seeded a cosmetic default at render time, so the couple saw answers they never gave. The per-step `canContinue` gate already required real values (date ≥1, `pax !== null`, `budgetBand !== null`, etc.), so the seeds were display-only and even produced an inconsistent "looks filled but Continue is disabled" state.

**What changed** (`apps/web/app/onboarding/wedding/_components/onboarding-shell.tsx` only):
- **Date:** `DateCalendar`'s `multi` no longer seeds `[new Date(seed)]` — it opens with no date selected (calendar still shows a month to navigate). `setMode` no longer re-seeds a date when toggling back to *Specific*; the *Flexible window* still seeds a starter range since that responds to an explicit mode choice.
- **Religion:** choosing a religious *kind* no longer pre-selects `['catholic']` (`selectKind` → `faith: []`); the faith preview photo shows a neutral placeholder ("Pick your tradition") until a chip is tapped, instead of defaulting to the Catholic photo.
- **Guests:** the count box was already empty when `pax` is null; now the slider rests at min with no fill and the preview photo/caption show a neutral "Drag or type your headcount" state until a number is entered.
- **Budget:** new `budgetSet = state.budgetBand != null` gate — until the couple sets a budget, the amount box is empty (placeholder "Your budget", no pre-fill on focus), the slider rests at min with no fill, and the feel photo shows a neutral "Set your number to preview the feel it buys" state instead of defaulting to *classic*.
- **Venue loading:** the reception-venue search already showed a `venuesLoading` skeleton ("Finding the best venues for you…"); it now holds for a minimum ~700ms so the search always reads as a deliberate moment as vendors populate, never a flash.

**Not changed (flagged for owner):** the step-9 "What would you love?" picker still auto-fills a budget-matched starter set (`budgetStarterPicks`). That's a curated suggestion, not a typed value, so I left it — say the word and I'll clear it too so the picker starts empty.

**Verification:** TSX syntax parse clean (0 errors) · no orphaned vars (`seed`/`clampMax`/`budgetView`/etc. still referenced) · empty states are exactly what `canContinue` already assumed (Continue stays disabled until each value is set) · full `tsc`/lint/build/e2e in PR CI + Vercel preview for visual review. Isolated worktree off origin/main (incl. #989).

**SPEC IMPACT:** None — removes cosmetic default-seeding so the UI matches the already-empty `EMPTY_ONBOARDING_STATE` + existing validation; no schema, SKU, copy-of-record, or flow change.

---

## 2026-06-05 · feat(onboarding/0016): iTunes song preview in the music step — album cover = play button

**Context:** Owner — *"how about the preview itunes?"* The onboarding music step listed songs as plain title/artist text. The Song Bank spec (`Onboarding_Style_and_Song_Bank_2026-06-04` §5, LOCKED) wants each song's **album cover to BE the play surface** — tap to hear the 30-sec iTunes preview. This implements that for the music step's existing 100-song picker.

**What changed** (`apps/web/`):
- **New `lib/itunes-preview.ts`** — keyless client-side **JSONP** lookup of the Apple/iTunes Search API (no CORS header → JSONP via `&callback=`). One call returns the 30-sec `previewUrl` + album `artworkUrl` (upscaled 100→300); per-song cache + in-flight dedup; throttle → retryable, miss → `none`. Client-side per §5.4 so the ~20/min/IP limit spreads across users' IPs.
- **New `app/onboarding/wedding/_components/song-preview-list.tsx`** — the **album cover IS the play button** (▶/⏸, gold placeholder until loaded); one shared `<audio>` (one preview at a time); covers hydrate **lazily** as rows scroll in (IntersectionObserver on the `.body` scroll container, capped at 4); throttle keeps the placeholder + retries; row click still toggles the pick.
- **`onboarding-shell.tsx`** — music dim renders `<SongPreviewList>`; **`onboarding.css`** — `.scover` styles.

**Verification:** `tsc` + `next lint app/onboarding lib` clean · CSP (`frame-ancestors 'self'` only) doesn't block script/audio/img · **mechanic verified live in Chromium** (6 real album covers loaded via JSONP; iTunes preview audio played — `paused:false`, `currentTime` advancing).

**Follow-ups:** full Song Bank — searchable 390-song catalogue (results-on-top / bottom-pinned search) + DB-cache of `apple_track_id`/`preview_url`/`artwork` (§5.4).

**SPEC IMPACT:** 0016 — the music step gains the locked album-cover-play-button + 30-sec iTunes preview (Song Bank §5).
---

## 2026-06-05 · fix(onboarding): wedding-date "What your dates share" nugget moved above the calendar

**Context:** Owner — *"fix the location of what your dates share. we want the nuggets to be on top and not under the calendar."* On the wedding-date onboarding screen (step 6 · "When's the big day?"), the `DateCalendar` component rendered its why-these-dates nugget (`.whydate`) as the **last** child of the `.tapzone`, i.e. *below* the calendar. Because `.tapzone` is `margin-top:auto` (pinned to the bottom of the screen body), the whole block sat at the bottom and the nugget landed under the calendar, while a large empty gap opened under the title. The 2026-06-01 corpus + app proto HTMLs already place `#whydate` in the `.viewzone` (above the calendar) — only the React port had drifted out of sync.

**What changed** (`apps/web/app/onboarding/wedding/_components/onboarding-shell.tsx` only):
- `DateCalendar` now owns its full screen body, matching the sibling `LocationStep` pattern: it returns a `.viewzone` (eyebrow + "When's the big day?" title + the `{why && …}` nugget) followed by the `.tapzone` (readout + mode toggle + calendar). The nugget therefore renders directly under the title, above the calendar; the calendar/toggle/readout stay pinned at the thumb zone.
- Screen 6's `<section>` now renders `<DateCalendar/>` directly, dropping the duplicate inline `.viewzone` (eyebrow + h1) and `.tapzone` wrapper that previously surrounded it. No logic, props, copy, or styling changed — pure JSX restructure.

**Verification:** TSX syntax parse clean (0 syntax errors) · new DOM order confirmed (`whydate` in `.viewzone` precedes `calgrid`) · `.whydate` is styled standalone (no `.tapzone`/`.cal` selector coupling, safe to move) · layout cross-checked against the corpus proto (`Onboarding_Wedding_Flow_2026-06-01.html`), which uses the identical viewzone/tapzone structure + CSS and renders the nugget at top (measured `whydate` top 209px vs calendar 561px). Full `tsc`/lint deferred to PR CI (no node_modules in the isolated worktree); the change has no type surface. Isolated worktree off origin/main.

**SPEC IMPACT:** None — aligns the React port to the existing 2026-06-01 onboarding proto (which already shows the nugget in the viewzone); no schema, SKU, copy, or product-surface change.

---

## 2026-06-05 · fix(0022): vendor home "confirmed bookings" tile was structurally always 0

**Context:** The vendor dashboard home (`app/vendor-dashboard/page.tsx`) computed its "Confirmed bookings" stat tile by counting `event_vendors` rows (`marketplace_vendor_id` = self, `status IN contracted/deposit_paid/delivered/complete`) **through the RLS-bound user client**. But `public.event_vendors` has only couple-scoped RLS (`event_vendors_couple_read` / `_write`, `20260513100000_iteration_0006_vendors.sql`) — no vendor-read policy — so under a vendor's session that query always returned **0**, regardless of real bookings. The tile was dead on arrival.

**What changed (`app/vendor-dashboard/page.tsx` only):**
- Removed the `event_vendors` count query (and its `confirmedBookingsRes` from the `Promise.all`).
- Derive `confirmedBookingsCount` from the already-fetched `threadsAll` (no extra round-trip): `threadsAll.filter(t => t.inquiry_status === 'accepted').length`. `fetchVendorThreads` reads `chat_threads`, which **does** have vendor-read RLS (`current_vendor_profile_ids()`), and `inquiry_status` is already selected.
- This matches the canonical "booking = accepted thread" definition in `bookings/actions.ts` (`isBookingForEvent`). Refreshed the two stale doc comments that described the old event_vendors source.

**Verification:** `tsc --noEmit` clean (exit 0) · ESLint clean (exit 0, 0 findings) · CI production build + typecheck+lint green · data-path checked against the seeded vendor `vendor.test@setnayan.com` (0 accepted threads in the shortlist-only baseline → tile correctly shows 0; will now reflect real accepted bookings).

**SPEC IMPACT:** None — display-only metric correctness fix; no schema, SKU, or product-surface change.

---

## 2026-06-05 · feat(onboarding/0037): monogram Trace animation now loops on the name screen

**Context:** Owner — *"can we make the animation of monogram loop."* The free monogram **Trace** self-draw (PR #971) played once on arrival/remount; the owner wants it to keep replaying while the name screen is shown.

**What changed** (`apps/web/app/onboarding/wedding/_components/onboarding-shell.tsx`):
- A `step === 4`-gated interval bumps a `monoReplay` tick every ~4.5s and weaves it into the `MonoLockup` key (`design:replay`), remounting the lockup so the tuned one-shot Trace replays — a clean **draw → hold (~2.6s) → redraw** loop that preserves the existing staggered choreography (letters → ∞/divider → filigree sweep → names). Cleared on leaving the screen; **skipped under `prefers-reduced-motion`** (those users keep the static filled mark). No CSS/keyframe changes.

**Verification:** `tsc --noEmit` exit 0 · `next lint app/onboarding` clean. Isolated worktree off origin/main.

**SPEC IMPACT:** 0037 Animated Monogram — the free Trace animation now **loops** on the onboarding name screen (draw → hold → redraw), reduced-motion-gated. Minor refinement of the PR #971 Trace feature; reflected directly in the corpus per the direct-edit authorization.

## 2026-06-05 · feat(0022): vendor Branches — Enterprise sub-location accounts (apply-then-pay)

**Context:** Owner — *"vendors can have multiple accounts depending on their plans."* The last item of the multi-user vendor workspace. Owner picked: **build now · ₱1,000 / 28 days · Enterprise-only** (resolving the live-site price/gate contradiction). The `vendor_branches` table existed with correct RLS but had zero app code.

**What changed** (no migration):
- New **`/vendor-dashboard/branches`** surface (owner/admin only · Enterprise-gated). Lists branches with status (active / pending payment / cancelled), an add-branch form (name · city · service radius · BDO or GCash), per-branch cancel, and BDO/GCash pay instructions while anything is pending. Non-Enterprise vendors see an upsell card.
- New **`lib/vendor-branches.ts`** — fee constants (₱1,000 / 28-day), the `vendor_additional_branch__{branch_id}` service-key convention (mirrors `setnayan_service__{category}`), `fetchVendorBranches` (joins each branch to its activation order's reference code), status derivation.
- New **`branches/actions.ts`** — `createBranch` (server-guards **tier=enterprise + owner/admin role**; inserts the branch inactive + an apply-then-pay `orders` row (`event_id` NULL · ₱1,000 · reference code) + a pending `payments` row, rolling back on failure) and `cancelBranch`. Reuses iteration 0034 wholesale — no new payment store, no new SKU catalog row (price passed explicitly).
- **`approvePayment`** gains an activation hook (mirrors the Today's-Focus hook): approving a `vendor_additional_branch__*` order flips that branch `branch_subscription_active = true`, stamps the order's 28-day `expires_at`, and writes a ledger row. Non-fatal + idempotent.
- **Nav**: "Branches" added to the vendor Business group — owner/admin only (absent from `VENDOR_SCOPED_NAV_ITEM_KEYS`, so `filterVendorNavGroups` hides it from agents/viewers; the mobile `/more` landing inherits it).

**Verify:** `tsc` + `next lint` + `next build` green (`/vendor-dashboard/branches` ƒ dynamic). **DB-verified via rolled-back impersonation** (set the test vendor Enterprise + seeded an agent): owner inserts branch + order + payment ✓ · owner sees branch ✓ · admin activation flip → active ✓ · **agent insert blocked** ✓ · agent sees 0 branches ✓. No migration — `vendor_branches` RLS is already owner+admin via `current_vendor_profile_ids()`.

**V1 limitation (flagged):** auto-renewal / auto-lapse after 28 days is manual for V1 (the suffixed service_key is deliberately excluded from the generic subscription sweep) — V1.x. Branch-scoped service/agent grouping also deferred to V1.x.

**SPEC IMPACT:** 0022 — Branches now BUILT (Enterprise · ₱1,000/28d · apply-then-pay; price + gate owner-locked 2026-06-05). Landing direct in corpus (DECISION_LOG + 0022 .md).

---

## 2026-06-05 · chore(scripts): virtual test-account seed toolkit (customer/vendor/admin scenarios)

**Context:** Owner wants reusable, log-in-able accounts (one per role doorway) to play cross-user scenarios on the live site. No `SUPABASE_SERVICE_ROLE_KEY` is available locally, so these run over `SUPABASE_DB_URL` via `supabase db query` — they create the Supabase auth users directly in SQL (the `auth.admin` REST path isn't reachable without the service key).

**What changed (new dev-only scripts under `apps/web/scripts/`, no app/runtime code):**
- **`seed-test-accounts.sql`** — single idempotent `DO` block. Creates 3 accounts (`couple/vendor/admin.test@setnayan.com`, shared password) with confirmed `auth.users` + `auth.identities` rows (token varchars `''` to avoid GoTrue's NULL-scan login bug; `identities.email` is GENERATED so it's omitted). Triggers fill `public.users` + `vendor_profiles`. Admin gets `is_team_member=true`. Seeds a wedding event, a hidden vendor listing (`is_demo=true` + `public_visibility=coming_soon` ⇒ excluded from public marketplace + verified-vendor stats), and **phase 1 = the couple's private shortlist** (`event_vendors` `considering`, linked via `marketplace_vendor_id`, mirroring `saveVendorToPicks`). Intentionally NO inquiry thread — so a shortlist's invisibility to the vendor is observable.
- **`seed-inquiry.sql`** — phase 2: the couple sends the inquiry (`chat_threads` pending + opening `chat_messages`), the first vendor-visible signal (chat_threads has vendor-read RLS; `event_vendors` does not).
- **`reset-test-accounts.sql`** — teardown (cascade-deletes the 3 tagged accounts + all their data).

**Verification:** ran against prod DB — all 3 accounts login-ready (`encrypted_password` round-trips via `extensions.crypt`, `email_confirmed_at` set, 1 identity each, `role=authenticated`); shortlist-only baseline confirmed (event_vendors `considering` + 0 chat_threads). Does not trip `check-no-demo-in-prod` (pre-deadline, +1 demo vendor « 2000 threshold).

**SPEC IMPACT:** None. Dev/test tooling only — no schema, no SKU, no product surface, no spec-corpus change.

---

## 2026-06-05 · feat(0022): vendor admins see everything — owner+admin RLS on the vendor's owner-only tables

**Context:** Owner — *"the main account holders of the vendor page can see everything"* (agents see only their assigned services + customers). Phase 2b (#972) made the CORE surfaces role-aware (profile / services / chat). This fast-follow closes the tail: a set of the vendor's OWN tables still gated vendor access on a direct owner-only check — or on the PLATFORM `is_admin()` / `account_type='admin'` (Setnayan staff, **not** the vendor's own team-admin) — so a vendor-team ADMIN couldn't see the business's packages, contracts, calendar, payouts, ad subscriptions, tax filings, or token vouchers.

**What changed** (`supabase/migrations/20260822000000_vendor_admin_table_access.sql`, **applied to prod**):
- One ADDITIVE owner+admin RLS policy (`<table>_team_admin`) on **12** owner-only vendor tables, keyed on `current_vendor_profile_ids()` (= direct owner UNION owner/admin team members). **FOR ALL** where the owner had read/write (`vendor_packages` · `vendor_contracts` · `vendor_calendar_blocks` · `vendor_service_attributes` · `vendor_payment_methods`); **FOR SELECT** where the owner had read-only (`vendor_payouts` · `vendor_ad_subscriptions` · `vendor_2307_filings` · `manpower_gigs` · `supplier_vendor_skus` · `vendor_disputes` · `earned_token_vouchers` [vendor_id-keyed]).
- Existing owner policies LEFT UNTOUCHED — Postgres OR's permissive policies, so this only GRANTS (never revokes). The owner is inside `current_vendor_profile_ids()` → provably un-regressed; agents / viewers / strangers match no clause → stay locked out. The vendor's OWN data, shared with the vendor's OWN chosen admin (no cross-tenant exposure).

**Verify:** rolled-back impersonation txn (applied the migration + seeded a team admin/agent): **12/12 policies valid · owner unregressed (sees) · admin GAINED parity (sees) · agent stays scoped out (0) · stranger locked out (0)**. Applied to prod via **monogram-isolation** — the unapplied out-of-order `20260817` monogram migration left exactly as-is (owner's to deploy; drift unchanged). RLS-only, **no app code** (#972 already routes admins to their vendor via membership-aware `fetchOwnVendorProfile`).

**Out of scope (flagged for owner):** `vendor_active_ads` · `vendor_active_tools` · `vendor_market_stats` · `vendor_self_comp_caps` have RLS enabled but ZERO policies (service-role-only; even the owner can't read them via the authed client) — a separate pre-existing condition, not a team-admin gap.

**SPEC IMPACT:** 0022 — vendor-team admins reach owner parity across the vendor's owner-only tables (completes "main account holders see everything"). Landing direct in corpus (DECISION_LOG + 0022 .md).

---

## 2026-06-05 · assets(onboarding): unify all 8 religious ceremony-tradition hero photos to one inspirational angle

**Context:** Owner gave a reference shot (wide-angle cathedral, couple centered and intimate at the altar, the venue's grandeur filling the frame, bright + awe-inspiring but the couple still reads as real people) and asked for "the angles for all religious ceremony tradition … relatable but inspirational on how a beautiful wedding is." Goal: one cohesive art direction across the whole faith picker, each tradition in its own authentic grand venue. This supersedes the 2026-06-05 dark-smoke Catholic + gold-ballroom Chinese so the set is consistent.

**What changed:** Regenerated all 8 religious-faith onboarding hero assets (`apps/web/public/onboarding/wed_*.webp`, bytes only — the faith picker in `onboarding-shell.tsx` already references these filenames):
- `wed_catholic` — ornate baroque cathedral, dome frescoes, couple at the marble altar
- `wed_christian` — outdoor garden ceremony under a floral arch (matches its "garden Christian" caption)
- `wed_inc` — cream-and-white gothic-line chapel with ornate grillework
- `wed_muslim` — elegant hall with Islamic arches + geometric tilework (nikah)
- `wed_chinese` — grand red-and-gold traditional ceremonial hall (replaces the ballroom trio; regenerated once to remove an AI-text artifact)
- `wed_bornagain` — bright modern worship hall
- `wed_cultural` — historic Filipino Spanish-colonial stone church, barong + Filipiniana, wedding cord
- `wed_jewish` — flower-draped chuppah in a luminous grand hall

All wide-angle, symmetrical, couple-centered with the bride's train as a recurring hero element. Generated via Recraft (recraftv3, `realistic_image`), optimized with PIL to the existing 760×950 / 4:5 onboarding-asset spec (58–148KB). Civil + Mixed (non-religious "kind" photos) left unchanged.

**Verification:** Visual review of every generated image (Chinese regenerated to drop garbled signage text) · all 8 are 760×950 · `git status` shows exactly the 8 asset files. No code touched, so no typecheck/lint surface.

**SPEC IMPACT:** Corpus design masters `~/Documents/Claude/Projects/Setnayan/assets/faith/wed_*.webp` refreshed directly for all 8 (Cowork direct-edit authorization). No Cowork pending item required.

## 2026-06-05 · feat(admin/queues): mobile triage action feed (0023)

**Context:** Owner — *"study the admin dashboard for mobile."* The admin remap (#963) deferred the highest-value mobile change to its own PR: replacing the flat 7-card Queues menu with a prioritized action feed. This delivers it.

**What changed** (`apps/web/app/admin/queues/`):
- `/admin/queues` is now a **live triage action feed** instead of a static `MobileLandingGrid` menu. The page (server component) fetches the open-count for all 7 queues in one `Promise.all` — payments (`pending`), verify (`coming_soon`), disputes (`open`), force-majeure (`open`/`under_review`), reviews (appeals `decided_at IS NULL`), help (`new`/`in_progress`), Today's-Focus abuse (`pending_review`) — using the exact filters each queue page uses, so the number on the row matches what the admin sees on arrival.
- New presentational **`_components/queues-triage-feed.tsx`**: a single prioritized list, **busiest queue first**, each row a 64px tap target (icon · label · 1-line context · live count) routing straight into the queue. Open queues show a champagne-gold count pill; clear queues show a check; a momentarily-unavailable count degrades to a chevron (the row still routes — no 500). Header tally: "N items need your attention" / "You're all caught up."
- Stays **`lg:hidden`** exactly like the menu it replaces — desktop admins use the sidebar tree, untouched. Every row maps 1:1 to a sidebar entry (orphan-prevention preserved).

**Verify:** `tsc --noEmit` + `next lint` + `next build` green. No migration; reuses the count pattern already on `/admin` (Home).

**SPEC IMPACT:** 0023 §5 — the admin mobile Queues surface is now a triage action feed (supersedes the card-menu landing). Landing direct in corpus (DECISION_LOG + 0023 .md).

---

## 2026-06-05 · chore(dashboard): remove dead PersonalizedMenu component + unused menu builders (0021)

**Context:** PR #978 moved the couple's personalization onto the Services tab (the "Matching you on" strip), leaving the old `PersonalizedMenu` card rendered nowhere — home dropped it in the cockpit refactor and `/for-you` is now a redirect. It survived only because it still exported the `TasteChip` type. This removes the dead code.

**What changed:**
- Moved `export type TasteChip = { label: string }` into `lib/personalized-menu.ts` (its natural home — `buildTasteChips` returns `TasteChip[]`); removed the lib's cross-import from the component; repointed `match-criteria-strip.tsx` to import it from `@/lib/personalized-menu`.
- **Deleted** `app/dashboard/[eventId]/_components/personalized-menu.tsx` (the unrendered `PersonalizedMenu` card · ~190 lines).
- **Deleted** the now-unused lib exports + private helpers — `buildServiceFeatures`, `buildWeddingDetailRows`, `ServiceFeature`, `WeddingDetailRow`, `SERVICE_FEATURE_LABELS`, `SERVICE_FEATURE_ORDER`, `cleanFeatureValue`, `featureValueString`, `budgetValueBare`, `stylePrefValue` — and dropped the orphaned `style_preferences` field from `EventTasteSource`. Verified **zero importers** before each deletion. **Kept** everything `buildTasteChips`/`formatWeddingDateLabel` + the `/details` page still use (`EventTasteSource`, `CEREMONY_LABEL`/`VENUE_LABEL`/`REGION_LABEL`, `titleCase`, `formatBudget`, `fmtISODate`).
- Net **−379 / +11** lines.

**Verify:** `tsc --noEmit` + `next lint` green (only pre-existing warnings). **No behavior change** — nothing rendered this code.

**SPEC IMPACT:** None — internal dead-code removal; closes the follow-up flagged in the 2026-06-05 "personalization → Services strip" row.

## 2026-06-05 · feat(payments): direct-pay Sheet — couple trigger + admin preview (0034 · 0023)

**Context:** Owner — *"create a customer direct pay sheet to connect to vendors and can also be used by us [the admin]."* PR #969 shipped the off-platform `VendorDirectPay` as an always-expanded inline rail inside the budget/workspace payment cards. This promotes it into a focused **"Pay {vendor} directly" button → house Sheet** (bottom sheet on mobile · right drawer on desktop), wires it onto the per-service workspace embed (which was rendering empty), and reuses the same sheet on the admin moderation surface so a moderator previews a destination exactly as couples see it.

**What changed:**
- **`apps/web/app/dashboard/[eventId]/_components/vendor-direct-pay.tsx`** — rail → Sheet. `VendorDirectPay` (props unchanged, so its two existing mount points need no edit) now renders a compact trigger + a one-line always-on reassurance ("You pay the vendor directly — Setnayan never holds this money") and opens the shared `Sheet` (`@/app/_components/sheet`) containing the **exact owner-locked RA 11967 disclosure** + the bank/QR/link method cards (all internals preserved 1:1). New export `DirectPayPreviewButton` (read-only "Preview as couple" trigger) reuses the same sheet. QR/link confirm modals bumped to `z-[60]` so they paint above the sheet.
- **`…/vendors/[vendorId]/workspace/page.tsx`** — now resolves `fetchPublishedMethodsForCouple` (admin client + couple-RLS ownership proof, best-effort → `[]`) and passes `directPayMethods` to the embedded `VendorItemizationCard`. Previously the embed defaulted to `[]`, so the per-service workspace never surfaced the vendor's pay destinations — completeness fix matching the budget page.
- **`app/admin/payment-options/page.tsx`** — each moderation card maps its `CardRow` → `CoupleFacingMethod` and renders `DirectPayPreviewButton` in the action row. Read-only; no money flow (admins moderate, they don't pay vendors).

No new table, no migration, no new SKU, no wallet UI. Stays inside the locked 0034 order-and-pay posture (couple↔vendor money is off-platform; Setnayan never holds or reverses it). The always-on disclosure renders on every surface that shows a method.

**Verify:** `tsc --noEmit` exit 0 · `next lint` clean · `next build` green (client `DirectPayPreviewButton` imports cleanly into the admin server page).

**SPEC IMPACT:** Minor. (1) Couple-side direct-pay presentation refinement (rail → Sheet) on the already-spec'd 0007/0034/0025 surfaces. (2) New admin "Preview as couple" affordance on the 0023 `/admin/payment-options` moderation surface. Corpus delta lands directly in `DECISION_LOG.md` per the 2026-06-04 direct-edit authorization (COWORK_INBOX is wound down — no new `[PENDING]` rows).

## 2026-06-05 · feat(vendors/workspace): inline order-and-pay for first-party Setnayan services

**Context:** Owner directive — *"can we apply this vendor direct-pay to our services as well, and admin will accept the payments?"* (interim until the automated payment system goes live **2027-01-01**). This unblocks the inline per-service order status that the 2026-06-04 PR #973 entry flagged as blocked. Key finding: the whole apply-then-pay spine **already ships** — couples pay Setnayan's own BDO/GCash receiving accounts (`platform_settings`), the `InlineCheckoutDrawer` already does pay + screenshot + reference in one surface on the 7 add-on SKU pages, and **`/admin/payments`** already lets an admin accept (`approvePayment` → payment `matched` + optional order `paid`) / reject / request-resubmit. The only gap was that a Setnayan-service **pick** (an `event_vendors` row with `is_setnayan_service`) had no inline way to pay — it just linked to an Orders list with no create-entry (the old `/orders/new` was retired for the drawer). So this is a **reuse**, not new payment infra. No schema change, no new payment store, no bridge column.

**What changed** (`apps/web/app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx`, the per-service workspace):
- For `is_setnayan_service` picks, the static "Managed by Setnayan → go to Orders" card is replaced by an **inline pay panel**:
  - Mounts the existing **`InlineCheckoutDrawer`** pre-filled with this service's price + name + Setnayan's `platform_settings` BDO/GCash accounts. Submit lands a real `orders` + `payments` row (status `submitted`/`pending`) via the shipped `submitOrderAction` — which a Setnayan admin then accepts at `/admin/payments`. Identical machinery to the add-on SKUs.
  - **Live status strip** — surfaces this service's latest non-terminal order (status pill + reference code + amount + "Track / upload proof" deep-link), so a couple who already paid sees status instead of being prompted to re-pay.
  - **Correct first-party disclosure** — copy states *"You're paying Setnayan, not a third-party vendor … our team confirms each transfer by hand."* This is deliberately the **opposite** of the vendor non-custody disclosure (which is for third-party-vendor money Setnayan never holds); a first-party Setnayan service IS paid to Setnayan, so the non-custody banner would be wrong here.
- **Order keying** — orders are keyed by a stable `setnayan_service__{category}` `service_key` (won't collide with any pax-priced SKU, so `submitOrderAction` trusts the pick's price; no voucher matches, which is correct — these are plan-priced, not promo SKUs). The same key drives the status-strip lookup. Price precedence mirrors the hero (package locked centavos → snapshot itemized pesos×100 → host `total_cost_php` pesos×100); unpriced picks fall back to the "we'll email instructions" message.
- Added imports + a Setnayan-only conditional fetch (`fetchPlatformSettings` + `fetchOrdersForEvent`, both fail-soft). External-vendor picks are byte-for-byte unchanged (still the Costing form).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (zero warnings in the changed file) · `next build` exit 0 (full route manifest, 119/119 static pages). Drawer props are all serializable — same shape the 7 add-on pages already pass.

**SPEC IMPACT:** First-party **Setnayan services** are now genuinely **add-and-pay inline** via the canonical apply-then-pay flow (0034) with admin acceptance at `/admin/payments` — completing the "in-app services = vendor listings · add-and-pay via 0034" model. This is the **interim** mechanism until the automated payment system (2027-01-01). Landed directly in the corpus `DECISION_LOG.md` (2026-06-05 row) per the direct-edit authorization; iteration `.md` edits (`0006`/`0021`/`0034`) to follow: (a) the reuse of `InlineCheckoutDrawer` + `/admin/payments` for first-party service picks, (b) the deliberate first-party disclosure (NOT the vendor non-custody banner), (c) the `setnayan_service__{category}` keying convention and its one-per-category status-correlation limitation.

## 2026-06-05 · feat(matcher): Layer-B "matches your preference" float on the vendor matcher (0044 / Vendor_Match_Personalization)

**Context:** The couple-side `event_vendor_preferences` (migration `20260721000000`) and vendor-side `vendor_service_attributes` (iteration 0044) tables were shipped as **foundation only** — storage with no read wired, because the live marketplace is founder-only so `vendor_service_attributes` carries no facet tags yet. This PR lands the **match-read** those migrations were built to enable: the Layer-B "matches your preference" sort from `Vendor_Match_Personalization_2026-06-01.md` §8/§9. It mirrors the existing **song-overlap re-rank** exactly, generalized from music to every category.

**What changed** (`apps/web/`):
- **New `lib/preference-match.ts`** — `fetchPreferenceMatches(admin, eventId, vendorIds, canonicalServices)`: reads the couple's prefs (reuses `getEventPreferences`) + the candidate vendors' `vendor_service_attributes`, computes **per-dimension array overlap**, and returns a `Map<vendorId, {matched, matchedDimensions, totalDimensions}>` holding **only matched vendors**. Every degenerate path — tables not migrated (`42P01`/`42703`) · couple expressed nothing · no vendor carries tags · empty inputs — collapses to an **empty map** → matcher order unchanged, zero regression. Never throws.
- **`lib/wizard-recommendations.ts`** — wired into `fetchWizardVendorRecommendations`: when `matchEventId` is set, over-fetch (re-rank headroom), float matched vendors up by `matchedDimensions` (stable sort), and attach optional `preference_matched` / `preference_matched_dimensions` fields. Placed right after the song-overlap block — identical pattern (over-fetch → compute overlap → stable re-sort → optional fields → trim).
- **`app/dashboard/[eventId]/_components/wizard-cards/vendor-pick-grid-card.tsx`** — an emerald **Sparkles "Matches your preference"** pill renders when `rec.preference_matched`, beside the existing music cue.
- **New `scripts/seed-preference-match-demo.ts`** — companion to `seed-demo-vendors.ts`: reads the demo vendors' real facet payloads, frequency-ranks values per dimension, and writes ONE overlapping `event_vendor_preferences` row so the badge is reproducible end-to-end on a test/staging DB. Reuses the prod-ref safety gate (`isNonProdUrl`) — refuses to run against prod.

**Verification:** `tsc --noEmit` exit 0 · `next lint` exit 0 (only pre-existing warnings, none in touched files) · production build green (re-run green after merging origin/main) · a throwaway mock-client runtime harness exercised `fetchPreferenceMatches` across **7 cases / 14 assertions** (positive single- + multi-dimension overlap, service-scoping, and all four graceful-degrade paths) — all pass; deleted before commit (no test runner in-repo). **No migration** (both tables already exist). Isolated worktree off origin/main.

**SPEC IMPACT:** Activates the Layer-B match-read described in `Vendor_Match_Personalization_2026-06-01.md` §8/§9 (couple `event_vendor_preferences` ⋈ vendor `vendor_service_attributes`). **Inert in production** until vendors carry facet tags (founder-only marketplace · `vendor_service_attributes` empty today) — then lights up automatically, same posture as the foundation migrations' own comments. Logged direct to corpus `DECISION_LOG.md` (owner authorized direct corpus edits 2026-06-04, superseding COWORK_INBOX). Deeper sync — marking the §8/§9 read as **SHIPPED** in the `Vendor_Match_Personalization` `.md`/`.docx` — is a flagged fast-follow, proportionate to defer while the feature is inert.

## 2026-06-04 · feat(dashboard/services): "Matching you on" criteria strip + retire /for-you (0021)

**Context:** Owner — *"where is the personalization page? will we just place it on services instead?"* After the cockpit refactor removed the home recap and orphaned the standalone `/for-you` page, the couple's match criteria (date · region · ceremony · venue · guests · style · budget — what Setnayan filters + sorts services by) had no live home. This lands the planned **PR2**: surface the criteria as a compact strip **where the couple browses services**, with the full editable record staying at `/details`.

**What changed:**
- **New `_components/match-criteria-strip.tsx`** (server, presentational) — a compact "**Matching you on**" band: Sparkles eyebrow + the criteria as chips + a "**Refine**" pill → the editable Personalization page (`/details`). Reuses `buildTasteChips` (lib/personalized-menu) so the chips are exactly what the search runs on; mirrors the retired PersonalizedMenu card's chip styling; honest empty state when no criteria are captured.
- **`vendors/page.tsx`** (Services tab) — renders the strip **above** the Plan+Budget accordion (wrapped in `space-y-4`). Extended the existing `events` SELECT (+`event_date_precision`, `secondary_ceremony_type`, `region`, `estimated_pax`, `mood_feel_key`, `date_mode`/`date_candidates`/`date_window_start`/`date_window_end`) and reuses the same budget fetch — no new query. Committed date wins, else the onboarding candidate/window capture (handled inside `buildTasteChips`).
- **`for-you/page.tsx`** — **retired**: now a permanent redirect to the Services (Vendors) tab; deleted `for-you/loading.tsx`. Its home-preview entry point was already gone (cockpit refactor), so it was orphaned.
- **`customer-bottom-nav.tsx`** — dropped the `/for-you` activeMatch entry + refreshed the stale Home/More doc comments (Home is the cockpit; criteria live on the Services strip; `/details` is the editable page).
- **Comments** — `personalized-menu.tsx` + `lib/personalized-menu.ts` headers note the PersonalizedMenu card is now unrendered (kept only for the `TasteChip` type) — dead-code removal flagged as a follow-up.

**Verify:** `tsc --noEmit` + `next lint` green (only pre-existing warnings, none in changed files). No migration; no schema change.

**SPEC IMPACT:** Completes the 0021 couple-home cockpit move — personalization is no longer a standalone `/for-you` page; the at-a-glance criteria surface as a "Matching you on" strip on the Vendors/Services tab, with `/details` as the full editable record. Lands directly in the corpus (`DECISION_LOG.md` + `0021_couple_dashboard_fully_purchased`) per the direct-edit authorization. (Follow-up: remove the now-dead PersonalizedMenu component + `buildServiceFeatures`/`buildWeddingDetailRows`.)

## 2026-06-05 · assets(onboarding): refresh Catholic + Chinese ceremony-tradition hero photos

**Context:** The wedding-onboarding "what kind of wedding → ceremony tradition" step (`apps/web/app/onboarding/wedding/_components/onboarding-shell.tsx`) shows a hero photo per faith. The Catholic photo was a flat empty-aisle shot and the Chinese photo was a generic tea-ceremony stand-in. Owner asked for (1) a dramatic Catholic cathedral kiss — stained glass, smoke, single cinematic spotlight on the couple, dark-but-peaceful nave, crowd in the pews; and (2) an opulent "expensively rich" Chinese wedding — bride (left) · groom (center) · bridesmaid (right) talking in a gold ballroom.

**What changed:** Replaced two static onboarding hero assets (bytes only — no code/markup change; the picker already references these filenames):
- `apps/web/public/onboarding/wed_catholic.webp` — new cathedral kiss (760×950, ~48KB).
- `apps/web/public/onboarding/wed_chinese.webp` — new opulent ballroom trio (760×950, ~94KB).

Both generated via Recraft (recraftv3, `realistic_image`) and optimized with PIL to the existing 760×950 / 4:5 onboarding-asset spec.

**Verification:** Visual review of both processed WebPs · dimensions + byte sizes match the existing onboarding hero set (760×950, 44–108KB range) · `git status` shows exactly the two asset files changed. No code touched, so no typecheck/lint surface.

**SPEC IMPACT:** Corpus design masters under `~/Documents/Claude/Projects/Setnayan/assets/faith/` are the spec-side originals. `wed_catholic.webp` master was refreshed in the prior session; `wed_chinese.webp` master refreshed directly this session (Cowork direct-edit authorization). No Cowork pending item required.

## 2026-06-04 · feat(dashboard/home): live days·hrs·min·sec countdown (0021)

**Context:** Owner — *"days, hours, minutes, seconds."* The cockpit countdown showed a static "N days to go"; make it a live ticking timer.

**What changed** (`apps/web/app/dashboard/[eventId]/_components/`):
- New **`live-countdown.tsx`** (client) — ticks every second, rendering **days · hrs · min · sec** with `tabular-nums` + fixed-width segments (no per-second jitter). At/after the date → "Today" (within 24h) then "Just married".
- `event-countdown-header.tsx` (server) restructured: resolves the target date (committed `event_date` → earliest `date_candidates` → `date_window_start`), computes the target as **PH-midnight (`+08:00`) of that date**, and passes `targetMs` + the server clock to `<LiveCountdown>` so the first paint matches between server and client (no hydration mismatch — both seed from `serverNowMs`). The date line shows the exact target date; a small caption ("Earliest of N possible dates" / "Earliest in your date window" / "Tentative — not locked yet") appears while the date isn't committed.

**Verify:** `tsc --noEmit` + `next lint` green. No migration, no new query (`now` already passed; date fields already in the events SELECT).

**SPEC IMPACT:** Refines the 0021 cockpit countdown (now a live d/h/m/s timer counting to PH-midnight of the earliest chosen date). Folds into the existing "couple Home cockpit" COWORK_INBOX item / 0021.

## 2026-06-04 · refactor(vendors): rename route segment [eventVendorId] → [vendorId]

**Context:** The dynamic route segment was named `[eventVendorId]`, but it carries `event_vendors.vendor_id` (the row PK) — the misleading name tripped up the service-scoped work. Renamed to `[vendorId]`. Cosmetic only; the URL path (`/dashboard/{eventId}/vendors/{id}/{workspace|review}`) is unchanged.

**What changed:** `git mv` of `apps/web/app/dashboard/[eventId]/vendors/[eventVendorId]` → `[vendorId]` (moves `workspace/` + `review/`), and renamed the route-param identifier `eventVendorId` → `vendorId` in `workspace/page.tsx` + `review/page.tsx` (param type · destructure · `.eq('vendor_id', …)` · the local review prop) + path comments. Preserved: the `ensureAutoShareInvite({ eventVendorId })` lib-arg key and `review/actions.ts`'s `event_vendor_id` form-field locals (unrelated to the route param). No links changed — external callers build the URL by value, not param name.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean. Production-build CI validates the Next.js param-key↔folder match.

**SPEC IMPACT:** None (internal route-param rename; URL unchanged).

## 2026-06-04 · refactor(vendors/workspace): cleanups + Setnayan-service payment-mode framing

**Context:** Follow-ups to the service-scoped workspace reframe (PR #965). Owner asked to land the remaining items we discussed. The first-party Setnayan-service nuance: those picks still showed the external-vendor chrome (hand-entered Costing, cancel/dispute), which is wrong — Setnayan services are **apply-then-pay** (pay → upload payment screenshot → verified within 24 hrs), so they should point at the Orders flow instead.

**What changed:**
- **`apps/web/lib/budget.ts`** — added `fetchVendorBudgetSummary(supabase, eventId, vendorId)`: a single-vendor budget fetch (own row + line items + payments + only this vendor's pricing lookup). `fetchBudgetSnapshot` is **byte-for-byte unchanged** so the budget page carries zero risk.
- **`…/workspace/page.tsx`**:
  - **Overfetch fix** — calls `fetchVendorBudgetSummary` instead of pulling the whole event's `fetchBudgetSnapshot` and `.find()`-ing one vendor.
  - **Write-on-render fix** — removed the render-time `ensureAutoShareInvite` self-heal (a write during a GET / prefetch). When a locked manual vendor has no live invite, the claim section now renders an explicit **"Create a shareable invite link"** action.
  - **Setnayan-service framing** — for `is_setnayan_service` picks, the host Costing form + cancel/dispute are hidden and replaced by a **"Managed by Setnayan"** card explaining apply → pay → upload-screenshot → 24-hr-verify, linking to `/dashboard/[eventId]/orders`.
  - **URL hardening** — contract `file_url` + vendor `logo_url` pass a `safeHttpUrl()` http(s)-only guard before rendering as `<a href>` / `<img src>` (defense-in-depth vs a stored `javascript:` / `data:` URL).
- **`…/workspace/actions.ts`** — removed the two dead exports (`advanceWorkspaceStatus` / `advanceWorkspaceStatusForm`, zero callers); added `createAutoShareInviteAction` (the explicit action behind the write-on-render fix).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean. Auth-gated RSC route — relying on the production-build CI.

**SPEC IMPACT:** First-party **Setnayan services** in the per-service workspace now hide the host Costing/cancel/dispute chrome and surface an apply-then-pay "Managed by Setnayan → Orders" card. The remaining **inline per-service order status** panel is **blocked** — no FK from an `event_vendors` pick to a `service_orders` row, and adding a Setnayan service doesn't create one; needs a schema link (owner decision pending). Spec delta to land directly in the corpus (`DECISION_LOG.md` + `0006`/`0021`/`0034`) per the new direct-edit authorization. Cleanups are internal — no spec impact.

## 2026-06-04 · feat(0022): Vendor agents — role-aware RLS scoping (Phase 2b)

**Context:** The payoff of the multi-user vendor workspace. The whole vendor data layer was OWNER-ONLY at the RLS level, so non-owner admins/agents could read nothing. Phase 2b makes it role-aware: **owner/admin see everything; agents see only their assigned services + the customers tied to them** (a couple's `event_vendors.service_id` → the booked `vendor_services`). Couple-side access is untouched.

**What changed:**
- **Migration `20260821000000_vendor_role_aware_rls.sql` (applied to prod, verified):** redefines `current_vendor_profile_ids()` owner-only → **owner+admin** (propagates admin access to chat/follows/branches/boosters via every policy already using it); adds `agent_assigned_service_ids()` + `agent_customer_event_ids()`; makes `vendor_services` (owner/admin full · agent assigned) + `chat_threads`/`chat_messages` (add the agent's vendor+customer-events clause) role-aware; adds `vendor_profiles` member-read. Owner access guaranteed via the owner-direct path inside `current_vendor_profile_ids()`.
- **`lib/vendor-profile.ts`** — `fetchOwnVendorProfile` is now membership-aware: a non-owner member (admin/agent) resolves their vendor via `vendor_team_members` so the dashboard loads for them.
- **`lib/vendor-role.ts`** — agent nav expands to Services · Bookings · Messages (scoped); bottom-nav adds Bookings · Messages.
- **`team/page.tsx` + `team/actions.ts`** — `/team` kept **owner-only** (it uses the RLS-bypassing admin client for emails), so the new member-aware resolution can't expose team management to non-owners.

**Verification (DB-layer, rolled-back transaction · seeded agent + admin):** owner still sees all 191 services (no regression); a non-member sees 0; an **agent sees exactly the 1 assigned service, 0 money-table rows, 0 manage-all**; an **admin sees the vendor**. ✅ Plus `tsc`/`lint`/`build` green.

**Migration-hygiene note:** prod had drift — `20260820000000_vendor_payment_methods` (an unmerged worktree) was applied to prod but not in git, and `20260817000000_event_monogram_style` is in git but **not applied** (Animated Monogram may be half-deployed). I reconciled non-destructively (no `migration repair`) to apply only this migration; the monogram + vendor-payments items remain for their owners to land.

**SPEC IMPACT:** 0022 — vendor data layer is now role-aware (owner/admin all · agent scoped). Remaining (fast-follow): admin access to the other owner-direct tables (earnings/tokens/contracts/packages/ads) — a safe owner→owner+admin loosening. → `COWORK_INBOX.md` [PENDING].

## 2026-06-04 · feat(vendor-payments): off-platform vendor payment options ("How clients pay you")

**Context:** Owner — vendors should publish their OWN payment destinations so couples pay them **directly, off-platform** (a payment link, an uploaded QR, or bank/e-wallet details), shown on the couple's settlement screen the moment they book. Fills the empty `direct` rail of the locked "vendor↔customer money is always off-platform · RA 11967 non-party-publisher" posture — Setnayan takes 0% and never holds the money. Two owner-locked sub-rules: **payment LINKS are Pro & Enterprise only** (most-abused surface; QR + bank stay open to all tiers), and a **standing platform-wide vigilance disclosure** (anywhere a vendor payment is shown, state Setnayan doesn't control/hold it + caution the customer to verify).

**What changed:**
- **Migration `20260820000000_vendor_payment_methods.sql`** (applied to prod) — new `vendor_payment_methods` table (method_type bank/qr/link · provider/account fields · qr_r2_key + decoded_destination · link_url/link_domain · is_primary · is_shown · moderation_status), **RLS at create time** (Pattern A owner: a vendor CRUDs rows under their own `vendor_profiles` row), a per-type payload CHECK, a partial-unique **one-primary-per-vendor** index, and a moderation-queue index. Plus an additive nullable `event_vendor_payments.proof_r2_key` (couple's receipt screenshot).
- **`lib/vendor-payment-methods.ts`** (client-safe) — types, the domain **allowlist** + shortener block (`classifyPaymentLink`), the **Pro/Enterprise link gate** (`isVendorProActive` = active paid `vendor_pro_weekly`/`all_tools_unlock_annual` order; no Enterprise SKU yet), `fetchOwnPaymentMethods`. **`lib/vendor-payment-methods.server.ts`** (`server-only`) — `fetchPublishedMethodsForCouple`: the couple authorizes via their RLS client, then the owner-locked table is read via the admin client (couples never query it directly); links filtered out unless the vendor is pro.
- **Vendor surface** `/vendor-dashboard/payment-options` — "How clients pay you" editor (add/delete/primary/show-hide; type picker; QR upload to R2; live link classification; link composer gated to Pro/Enterprise with an upsell) + Money-group nav entry.
- **Couple surface** — a `VendorDirectPay` rail on the per-vendor budget card: the always-on vigilance disclosure, copyable bank details, a QR modal (with decoded destination), a "you're leaving Setnayan" interstitial before any link; + an optional receipt upload wired additively into the budget `logPayment`. Methods fetched server-side per booked vendor.
- **Admin surface** `/admin/payment-options` — moderation queue (decoded destination + allowlist check per entry; approve/hold/remove; audit-logged) + Queues-group nav entry.

**Verification:** `tsc --noEmit` exit 0 · `next lint` exit 0 (no new warnings) · client/server boundary verified (both `'use client'` components import zero server-only code) · migration applied to prod + confirmed in remote history. Isolated worktree off origin/main. Auth-gated RSC routes — full production build + Lighthouse run in CI.

**SPEC IMPACT:** New feature (V1-scope expansion, owner-approved "full send" 2026-06-04). Landed **directly in the corpus** (owner authorized direct corpus edits 2026-06-04, superseding COWORK_INBOX): `vendor_payment_methods` schema + the two locked sub-rules → **0034** · vendor surface → **0022** · Payment Options tab → **0025** · couple settlement rail → **0007** · admin moderation → **0023**; `DECISION_LOG.md` rows added. Fast-follow (deferred): wire the per-vendor **workspace** page as a second settlement mount point; real server-side QR image decode (V1 stores the vendor-declared destination, admin-verified). **Migration-history note:** this migration was applied to prod while prod was briefly ahead of `origin/main` by `20260816000000` (vendor_service_agents, applied before its PR merged) — that transiently blocked `supabase db push`; `20260816000000` has since merged to main and the merge into this branch picks it up, so it is resolved.

## 2026-06-04 · feat(onboarding): free monogram animation — Trace (letters draw themselves)

**Context:** After previewing a 12-motion gallery the owner chose **animation as a FREE feature**, then refined to a single, cohesive effect: **Trace** — *"use the trace on the onboarding,"* with the lettered designs drawing as *"letters draw themselves."* So every onboarding monogram now self-draws: each letter's outline strokes on like a pen and then fills, the ∞ and the bar's divider draw as lines, and **the filigree ring traces itself on** — a clockwise conic-mask pen-sweep, since its 237 filled gold paths can't be stroked like the letters (owner: *"create a trace effect on the monogram itself"*). (This supersedes the briefly-built auto-matched-per-design approach in this same PR.) The other gallery motions stay reserved for the paid Animated Monogram (₱2,499) so that SKU keeps a differentiator.

**What changed (no schema, no per-render cost = ₱0):**
- `mono-lockup.tsx` — **rewritten** to render each glyph as an SVG `<text>` (so the outline can be stroke-drawn) across all five lockups (bar · duo · script · framed · infinity), emitting `.mt-*` markup; final filled look is identical to plain text.
- `onboarding.css` — new `.mt-*` trace stylesheet: per-glyph outline draw (`stroke-dasharray`) → fill, the ∞ + divider line draw, names settle last, with responsive `clamp()` sizing. The **filigree ring** is moved to a `.mt-frame::before` and drawn via an animated conic `mask` (`mt-trace`, driven by a registered `@property --mt-sweep` `<angle>`) so it sweeps on clockwise behind the caps — a graceful full-ring fallback where `@property` is unsupported. The older `.lk-*` lockup + per-design effect CSS is now inert (MonoLockup no longer emits `.lk-*`) — kept for a clean diff, prune later.
- `onboarding-shell.tsx` — `<MonoLockup key={monogramDesign}>` so "Generate another design" remounts and replays the draw (first arrival is covered by the screen's `display:none→flex` restart). Also **removed the name screen's under-claiming subtitle** (*"…it goes on your invitation, website & monogram"*) per owner — the mark propagates further (live background, website, livestream + videos), and dropping the line tightens the screen toward the no-scroll onboarding rule.
- **Accessibility:** all motion gated on `@media (prefers-reduced-motion: no-preference)`; reduced-motion users get the clean filled monogram (the base look) with no animation.

**Verification:** `tsc --noEmit` exit 0 · `next lint app/onboarding` clean · faithful headless-chromium render of all 5 lockups against the REAL `onboarding.css` confirmed the draw arc (outlines stroke on → fill → names settle) and the final static fidelity; a frame-by-frame capture of the **framed** design confirmed the filigree sweeps on clockwise (180 → 450 → 750 → 1150 ms) with caps drawing in sync, and a `reducedMotion: 'reduce'` capture confirmed the full ring + caps + names render statically (the accessible base look).

**Scope:** onboarding monogram screen only (where the design picker lives). Propagating the animated lockup to landing/QR/invitation surfaces rides with the earlier staged propagation follow-up.

**SPEC IMPACT:** 0037 Animated Monogram — monogram animation is now a FREE feature (the **Trace** self-draw, all designs); the paid ₱2,499 SKU is repositioned to sell bespoke artwork + premium effects + cross-surface propagation. Logged to COWORK_INBOX.

## 2026-06-04 · fix(dashboard/home): countdown targets the earliest chosen date until settled (0021)

**Context:** Owner — *"countdown is the earliest wedding date chosen until it is down to 1 wedding date."* The cockpit countdown (PR #968) only used the committed `event_date`, so couples still in candidate/window mode (onboarding events with `date_candidates[]` or a flexible `date_window`, before a single date is committed) saw "add your date" instead of a live countdown.

**What changed** (`apps/web/app/dashboard/[eventId]/`):
- `_components/event-countdown-header.tsx` resolves the countdown target as **`event_date` → earliest `date_candidates` → `date_window_start`**. ISO `yyyy-mm-dd` candidates sort chronologically, so `[0]` is the earliest. While tentative (no committed date), the number reads "days to earliest" and the right label shows the date state via the existing `formatWeddingDateLabel` ("3 possible dates" / a window range / the single candidate). A past tentative date nudges "Update your date →"; truly no date keeps "Add your date →". Committed date is unchanged ("days to go" + the exact date).
- `page.tsx` passes `date_mode` / `date_candidates` / `date_window_start` / `date_window_end` (already in the events SELECT) to the header. No new query.

**Verify:** `tsc --noEmit` + `next lint` green. No migration.

**SPEC IMPACT:** Refines the 0021 cockpit countdown semantics (earliest-chosen-date until the couple settles on one). Capture under the existing "couple Home cockpit" COWORK_INBOX item / 0021 + DECISION_LOG — no new worklist item.

## 2026-06-04 · feat(dashboard/home): couple Home cockpit — countdown + Today's Focus + Needs you (0021 / 0016)

**Context:** Owner — *"fix the first page customers see (the customer dashboard home). Not too much text; updates, guides, and a quick what-to-do-next."* After a side-by-side prototype review, the lean 2026-06-02 home (the "Your wedding details" recap + Upcoming + Activity) is reshaped into a **cockpit** that answers "what now?" in five beats. The text-heavy match-criteria recap leaves Home; it returns at the top of **Services** as an editable "Matching you on" strip (follow-up PR); the full editable record stays at `/details`.

**What changed** (`apps/web/app/dashboard/[eventId]/`):
- **New `_components/event-countdown-header.tsx`** — the emotional anchor: couple names + big days-to-go + date/venue + a thin "X of N vendors locked" bar. Pure server component; derived from the events row + the lock count already computed on the page (no new queries). No-date → a quiet "add your date" link.
- **Re-wired `TodaysOneThing`** (the single-focus "Today's Focus" hero) back onto Home as the "Do it" beat — `pickTodaysOneThing(eventVendors, event_date, now)` + `countUnlockedCategories`. This is the original lightweight **vendor-derived** hero, **not** the retired Today's-Focus wizard or the (off) paid Concierge. Dormant on disk since the 2026-06-02 lean pass; re-wiring needed no new data (same `eventVendors` array PlanningGroups used).
- **Reframed Upcoming → "Needs you"** — `UpcomingSchedules` gains optional `headingLabel`/`emptyLabel` props (defaults unchanged); the home wrapper passes "Needs you" + an "all caught up" empty state. Same five-source data.
- **Removed the `PersonalizedMenu` recap** from Home + its now-orphaned compute (`personalizedDate/Taste/Features/DetailRows`, `eventCeremonyType`, `eventVenueSetting`, `eventBudgetCentavos`) and the `buildTasteChips/Features/WeddingDetailRows` + `PersonalizedMenu` imports. Added a calm "Browse your matched services" doorway (replaces the CTA that lived inside the recap).
- Home render order: day-of trio (wedding-day only) → **Countdown → Today's Focus → Needs you → Recent activity → marketplace doorway**.

**Verify:** `tsc --noEmit` + `next lint` green (only pre-existing warnings, none in touched files). Worktree off origin/main. No migration (reads existing columns). Visual pass deferred to the PR's Vercel preview (dashboard is auth-gated).

**SPEC IMPACT:** Reverses part of the 2026-06-02 "lean Home = 3 blocks" shape (0021) and re-surfaces a "Today's Focus" next-action hero (0016 framing — the lightweight hero, not the retired wizard/Concierge). The match-criteria recap is slated to move to the top of Services (PR2, not in this change). → COWORK_INBOX + DECISION_LOG.

## 2026-06-04 · feat(onboarding): design-4 filigree frame + persist monogram_style

**Context:** Follow-up to PR #960 (5 live-typography monogram lockups). Owner: design 4 (framed) should use a **generated ornate gold filigree circle** showing **both initials**, and we should **propagate** the chosen lockup past onboarding — which needs the chosen *style* persisted (it was being thrown away at commit, leaving downstream surfaces with only frame+font).

**What changed:**
- **Design 4 frame** — generated a transparent vector filigree ring (Recraft `vector_illustration` → `apps/web/public/onboarding/mono/filigree.svg`, 237 gold-gradient paths, hollow center, no background); design 4 now points at `filigree` (was the reused floral `wreath`) and renders both initials. New `.onbw .lk-framed .lk-frame[data-frame="filigree"]` rule.
- **Persist style** — new nullable column `events.monogram_style` (CHECK ∈ bar·script·duo·framed·infinity), `supabase/migrations/20260817000000_event_monogram_style.sql`; onboarding commit (`onboarding-shell.tsx`) + `actions.ts` now write it. **Applied to prod directly** (idempotent `ADD COLUMN IF NOT EXISTS`) because `supabase db push` is blocked by an unrelated history divergence (see SPEC IMPACT).
- **Sync `lib/monogram.ts`** — replaced the stale 10-preset `MONO_DESIGNS` with the 5-style model; `resolveMonogramDesign` accepts + returns `style` (style-authoritative, falls back to frame+font for pre-2026-06-04 events); `VALID_FRAMES` made exhaustive (legacy frames + filigree) so already-onboarded couples keep their framed icon; new `monogramFrameAssetUrl()` serves `.svg` for filigree, `.webp` for legacy.
- **Thread through** `lib/events.ts` select + `EventMonogram` (chrome switcher / profile icon). Chrome stays letters-forward at small size; the returned `style` is the foundation for the bigger-surface rollout.

**Verification:** `tsc --noEmit` exit 0 (pre- and post-merge) · `next lint` clean on changed dirs (only a pre-existing `<img>` warning in `profile-menu.tsx`) · `monogram_style` column + `events_monogram_style_check` constraint verified live in prod.

**Staged (NOT in this PR), with reasons:** full lockup on the **QR center** (needs style-aware SVG compositing in `monogramOverlaySvg`) and a **big in-app preview** (needs the `.onbw`-scoped lockup CSS extracted to a shared sheet — author-flagged refactor). The **paid Animated Monogram hero (0037 · ₱2,499)** is deliberately untouched.

**SPEC IMPACT:** 0037 — design 4 is now a generated filigree frame (both initials); `events.monogram_style` is the new persistence for the chosen lockup. Also flags a **migration-history divergence** — remote has `20260820000000` applied with no repo file, blocking `supabase db push` team-wide. Logged to COWORK_INBOX.

## 2026-06-04 · feat(0022): Vendor agents — per-service assignment (Phase 2a)

**Context:** Phase 2 of the vendor multi-user workspace (after the Phase-1 role-aware shell, #962). The owner wants agents to "see only the services + customers they manage." Investigation confirmed the customer↔service link exists (`event_vendors.service_id` → the booked `vendor_services` row), so per-service scoping is feasible. This is **Phase 2a — the assignment foundation**: owners/admins assign agents to specific services. Phase 2b consumes it (scopes the agent's dashboard reads + nav to assigned services + their customers, via RLS).

**What changed:**
- **Migration `20260816000000_vendor_service_agents.sql`** (new table, RLS, **applied to prod**) — `vendor_service_agents(vendor_service_id, vendor_team_member_id)`. RLS: any vendor member reads the map; **owner/admin manage** (via `current_vendor_ids('admin')`). On-delete-cascade from both parents.
- **`lib/vendor-team.ts`** — `fetchAssignableServices()` + `fetchAgentServiceAssignments()` (member→service-ids map, scoped to the vendor's own services).
- **`app/vendor-dashboard/team/actions.ts`** — `setVendorAgentServices()` (replace-on-save; clamps selection to the vendor's own services; RLS enforces owner/admin).
- **`app/vendor-dashboard/team/page.tsx`** — under each **agent** member, a checkbox row of the vendor's services (pre-checked from current assignments) → Save.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean · `next build` exit 0 · migration dry-run showed only this file pending, then applied to prod. Isolated worktree off `origin/main`.

**SPEC IMPACT:** 0022 — new `vendor_service_agents` table + per-service agent assignment UI (the spec'd-but-unbuilt scoping foundation). Phase 2b (agent-scoped reads + RLS on services/threads + admins-see-all resolution + nav expansion) is next. → `COWORK_INBOX.md` [PENDING].

## 2026-06-04 · refactor(vendors/workspace): service-scoped per-vendor workspace page

**Context:** Owner — clicking a finalized **service card** in the plan landed the couple on a page framed entirely around the *vendor* (big vendor header, hand-entered Costing, claim-link, cancel/dispute), with the thing they actually clicked — the **service/package** — buried as a small "What's included" list halfway down. Chosen approach: reframe the page to be **service-scoped** — lead with the booked service/package, demote the vendor to a "by {vendor}" attribution line. The URL's `[eventVendorId]` is the `event_vendors.vendor_id` PK, which binds to at most one locked package, so this needed no route/URL/schema change.

**What changed** (all in `apps/web/app/dashboard/[eventId]/vendors/[eventVendorId]/workspace/page.tsx`):
- **Service hero** replaces the vendor-identity header: package name (fallback: category label) as the H1, package blurb under it, **price** from the locked package (`event_vendor_packages.total_locked_centavos` → `vendor_packages.total_price_centavos`, rendered via `formatCentavosPhp` — centavos, NOT the peso `formatPHP`), and a small **"by {vendor}"** attribution line with the logo. Reads `vendor_profiles.is_setnayan_service` → renders **"Provided by Setnayan"** for first-party services.
- **"What's included"** (the package's `vendor_package_items`) promoted to directly under the hero.
- Added a best-effort fetch of the package header (`event_vendor_packages` status/total + `vendor_packages` name/description/price) — only for `status='locked'` bookings; any null falls back to category-label title + notes, never a 500.
- **Order & payment status** stepper collapsed from 5 stages to the **3 truthful ones** (Plan finalized → Downpayment paid → Delivered) — `workspace_status` is never written in V1 (its only writer ships unwired), so the 2 middle stages could never light up. Driven off `inferStage(vendor_status)`. Payments (the `VendorItemizationCard` embed) sits under the stepper.
- Vendor-coordination surfaces (Conversation/Documents/Schedules), the Costing form, and the claim-link block **demoted** below the service surfaces.
- **Removed the dead "Package details" placeholder section** (Task #27 stub) — it duplicated the new hero and double-rendered `ev.notes`. Notes now render **once** in a dedicated "Your notes" block.
- **Dropped the double-fetch**: the standalone `event_vendor_line_items` + `event_vendor_payments` queries (header sums) are gone; header money now comes from the `fetchBudgetSnapshot` summary already loaded for the embed. −2 queries.
- **Timezone**: `formatMeetingDate`/`formatPaymentDate` now pin `Asia/Manila` (matches the 6 other files that do).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (no warnings; confirms no dangling imports after the section removal) · render matrix reasoned over the 3 pick shapes (marketplace-package / manual-no-package / Setnayan-service) · deep-link anchors `#conversation`/`#documents`/`#payments` preserved. Isolated worktree off `origin/main`. Auth-gated RSC route — not browser-previewable without a seeded session.

**SPEC IMPACT:** The per-vendor workspace surface is reframed from vendor-scoped to **service-scoped** (service/package as the hero; vendor demoted to attribution; 3-state truthful status stepper; first-party Setnayan services show "Provided by Setnayan"). This surface came from the 2026-05-22 owner directive and is **not currently in the spec corpus**. → record in `DECISION_LOG.md` + the relevant iteration (0006 vendors mgmt / 0021 couple dashboard). Logged in `COWORK_INBOX.md`. Fast-follows (deferred, not in this PR): strip Costing/dispute chrome from first-party Setnayan services + real 0034 order-and-pay panel; `fetchBudgetSnapshot` per-vendor overfetch; `ensureAutoShareInvite` write-on-render; dead `workspace/actions.ts` exports.

## 2026-06-04 · feat(0000): event-type "feel photo" picker (replaces the bars) + per-event step study

**Context:** Owner reversed the same-day minimal "bar" picker — *"we do not want the lines. we want photos without the carousel indicators. just photos of how the event would feel like"* + *"clickable on the center when the photo is fully visible. it needs to snap."* Also asked for a study of which wedding-onboarding steps each event type drops.

**What changed** (`apps/web/app/dashboard/create-event/_components/`):
- **New `event-type-photo-picker.tsx`** — a horizontal, scroll-snapping deck of full-bleed event "feel" photos (`/public/event-types/{key}.webp` via `next/image`). NO dots/arrows/bars; neighbours peek dimmed + scaled so the centered photo is the focus; each carries the event name + a one-line tagline + a "Begin →" affordance that appears only on the centered card. Snap-mandatory + snap-stop; tapping the centered photo fires `onSelect` (→ onboarding / inline-form), tapping a side photo snaps it to center. Centers Wedding on mount.
- **`event-type-picker.tsx`** — renders `EventTypePhotoPicker` instead of the bar picker (same `onSelect` / `onboardingHref` routing).
- **Deleted `event-type-bar-picker.tsx`** (the bars — superseded).

**Per-event step study (separate deliverable, sourced/PH-aware):** 8 of 15 wedding steps are universal (Welcome/Region/Guests/Budget/Account/Find-vendor/Congrats/Plan — copy-swap only); **Kind + Faith/ceremony + ceremony-venue + wedding-documents DROP for all event types except christening** (keeps a light parish/rite + ninong/ninang); per-event work concentrates in Role + Identity + service-picker + style via 2–3 swap-in questions. Recommends one parameterized shell. Folds into the per-event build plan.

**Verification:** `tsc --noEmit` exit 0 · `next lint` (create-event dir) clean · interaction (snap + center-click + peeking neighbours) approved via the standalone prototype (real authed render on the Vercel preview).

**SPEC IMPACT:** 0000 — the create-event picker is a feel-photo deck (no carousel indicators; tap centered to begin), superseding the bar picker ([#961]). Per-event onboarding step recommendation captured. → `COWORK_INBOX.md`.

## 2026-06-04 · feat(0023): Admin dashboard remap — 6 groups + mobile table + orphan fixes

**Context:** Owner directive — make the admin console seamless + simple, especially on mobile. Companion to the vendor remap (PR #962). Desktop had 8 sidebar groups; mobile had 4 data tables that overflowed the viewport (the real "manage on mobile" defects from the earlier study).

**What changed** (no migration):
- **`admin-sidebar.tsx`** — desktop groups **8 → 6**: Home · Queues · Directory · Money · **Insights** (Growth · Funnels · Operations & Hiring · Telemetry · Offline daemon — absorbs the old Operations group) · **Manage** (Taxonomy · Website · Ads · Today's Focus brain · Moodboard library · Songs · Settings · Demo mode — merges the old Content + Settings, collapsed by default). Group keys reused (`funnels`→Insights, `content`→Manage) so persisted open-state survives; all item keys unchanged.
- **Mobile table fixes (4)** — the surfaces flagged in the dashboard study that overflowed the viewport now scroll: `operations-hiring` (wrapped in `overflow-x-auto`), `demo-vendors` · `demo-vendors/inquiries` · `offline-diagnostic` (their `overflow-hidden` wrapper → `overflow-x-auto`, so wide tables scroll instead of clipping).
- **Mobile orphan fix** — `/admin/songs` was missing from the mobile More tab + landing (added after the nav was last touched); now reachable (added to `admin-bottom-nav.tsx` activeMatch + a card on `/admin/more`). More activeMatch comments re-grouped to match the new Insights/Manage structure.

**Deferred (next, flagged):** the unified mobile **Queues triage feed** (one prioritized action list across Payments/Verify/Disputes/Reviews/Help/Abuse with quick-approve + detail sheets) — a bigger feature, its own PR.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean · `next build` exit 0. Isolated worktree off `origin/main`.

**SPEC IMPACT:** 0023 — admin nav remap (8→6 groups) + mobile table/orphan fixes. → `COWORK_INBOX.md` [PENDING].

## 2026-06-04 · feat(0000): minimal event-type "bar picker" + tap straight into onboarding (P1 of per-event onboarding)

**Context:** Owner directive 2026-06-04 — the create-event event picker should be "nothing but the choice of events": a minimal row of bars (one per event type) between ‹ › chevrons; tap a bar to pick → jump STRAIGHT into that event's onboarding. Prototype approved this session. Phase 1 of a larger approved build — each event type gets its own fully-tailored onboarding mimicking the wedding flow's concept (shared engine + per-event route/palette/content/commit), exemplar-first with Debut. Plan: `.claude/plans/curious-swimming-journal.md`.

**What changed** (`apps/web/app/dashboard/create-event/`):
- **New `_components/event-type-bar-picker.tsx`** — replaces the hero-photo carousel on the full-page create-event surface. A row of bars; the focused bar is gold (`terracotta` = Champagne Gold) + taller with an equalizer falloff; ‹ › chevrons / arrow keys / swipe browse; tap a bar to pick. Roving tabindex for keyboard; the focused type's emoji + name + caption render below the strip so the unlabeled bars stay legible. The shared `event-type-carousel.tsx` is **untouched** (still used by the in-chrome add-event sheet `event-switcher.tsx`).
- **`_components/event-types.ts`** — each row gains `onboardingHref`; Wedding → `/onboarding/wedding`, the rest `null` (filled in as each tailored onboarding lands).
- **`_components/event-type-picker.tsx`** — renders the bar picker; tapping a type with an `onboardingHref` routes straight there (Wedding → onboarding, dropping the old intermediate "Continue →" card); types still on `null` fall back to the inline name form (`createWeddingEvent`). Removed the already-dead per-surface `WeddingTypePicker` / `wedding_type_launch_status` path + the "pick a type to name it" placeholder.
- **`page.tsx`** — dropped the dead `launchStatus` fetch + imports; trimmed the subtitle to "Tap a type to begin."; `invalid_type` copy de-references "carousel".

**Verification:** `tsc --noEmit` exit 0 · `next lint` (create-event dir) clean · CI green (typecheck+lint, production build, lighthouse, playwright, bundle size, secret scan, Vercel) · interaction + look approved via the standalone prototype. Isolated worktree off `origin/main`.

**SPEC IMPACT:** 0000 — the create-event event-type picker is now a minimal bar carousel; tap routes straight into onboarding (replaces the hero-photo carousel + name-form-first flow on the full-page surface). Per-event onboarding roll-out begins (Debut next). → `COWORK_INBOX.md`.

## 2026-06-04 · feat(0022): Vendor dashboard remap (4 groups) + role-aware nav shell (Phase 1)

**Context:** Owner directive — make the vendor (and admin) dashboards seamless + simple, and turn the vendor account into a true multi-user workspace where main holders (owner/admin) see everything and agents see only their services + customers. Backbone already existed (`vendor_team_members` + role enum owner>admin>agent>viewer + `current_vendor_ids(min_role)`), but the dashboard never used roles (and `fetchOwnVendorProfile` is owner-only, so non-owner members couldn't load it). This is **Phase 1: the IA remap + role-aware nav shell**; per-service DATA scoping + route guards + admins-see-all data resolution are Phase 2 (owner-sequenced "remaps first, agents next").

**What changed** (no migration):
- **`lib/vendor-role.ts`** (new) — `resolveVendorRole()` (highest membership role, legacy owner fallback), `canManageVendor()` (owner/admin), and the Phase-1 nav policy (`filterVendorNavGroups`, scoped item/tab key sets). Single source of truth so Phase 2 expands agent surfaces in one place.
- **`vendor-sidebar.tsx`** — desktop groups **6 → 4**: Home · **Work** (Bookings · Messages · Services · Contracts · Repertoire · Attributes) · **Grow** (Marketing · Verify · Reviews · Moodboard library) · **Business** (Earnings · Tokens · Manpower · Redeem code · Team). Group KEYS reused (`pipeline`/`marketing`/`money`) so persisted open-state survives; all item keys unchanged. Now `role`-aware (agent/viewer → Overview only).
- **`vendor-bottom-nav.tsx`** — `role`-aware tabs (owner/admin full; agent/viewer → Home + More).
- **`vendor-dashboard/layout.tsx`** — resolves the member role (parallel) and feeds sidebar + bottom-nav.
- **`vendor-dashboard/more/page.tsx`** — role-filtered overflow groups.
- **`vendor-dashboard/page.tsx`** — agent/viewer get a clear "you're on the team" landing instead of the owner "set up your profile" state.

**Safety:** agents currently resolve to NULL vendor data via the owner-only `fetchOwnVendorProfile`, so no data is exposed by this change — the nav shell is purely structural. Phase 2 adds `vendor_service_agents` + RLS so agents see only assigned services/customers (and admins see all).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean · `next build` exit 0. Isolated worktree off `origin/main`.

**SPEC IMPACT:** 0022 — vendor nav remap (4 groups) + role-aware shell. → `COWORK_INBOX.md` [PENDING].

## 2026-06-04 · feat(0021/vendors): "Where your day stands" — make the cover DIRECTIVE + teach the loop

**Context:** Owner — as a customer landing on the Vendors tab's "Where your day stands" overview, then swiping up into the category rails, it wasn't clear *what to do*. The Find→Shortlist→Lock loop was explained ONLY on the EMPTY cover; the moment the couple had a single pick, all guidance vanished and they were dropped into bare rails. Chosen approach: **both** an action-first cover AND in-rail coaching.

**What changed** (all in `apps/web/app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx`, scoped `.pbacc` CSS — no schema, no new SKU, no pricing):
- **Action-first cover.** The populated overview now leads with a tappable **"Do this next"** banner (`NextAction`) that promotes the single most-urgent category (`dueList[0]` ?? `upNext`) into a jump to its rail. Verb adapts (never-locked → "Start with", overdue → "Lock your", else "Choose your"); sub-line derives from `optionCount` + the timeline status. Calm "You're on pace" state when nothing's pressing.
- **Persistent loop legend.** A compact **Find → Shortlist → Lock** legend (`LoopLegend`) now stays in view on the populated cover (was empty-state-only).
- **Deduped deadline list.** Old "What to lock next" box → **"Also coming up"** (`AlsoComingUp`), listing `dueList[1..]` (the banner owns `dueList[0]`); calm/empty cases handled by the banner.
- **First-run coachmark.** A dismissible coachmark (`.pba-coach`) at the top of the category list teaches Tap / Compare / Lock — shown ONLY while `recap.shortlisted > 0 && recap.finalized === 0` (the "I have cards, now what?" moment), self-retires after the first lock, dismissal persisted in `localStorage['pba_coach_v1']`.
- **Point-of-action Lock helper.** A one-time `.lockhint` under the first lockable card explains what "Lock this pick" commits to (sets pick · updates budget · notifies vendor · changeable). Same gate/dismissal as the coachmark, threaded via a single `lockHintKey` string (root → FolderSection → ChildRail → VendorCardAtom).
- **CTA copy.** "Swipe to start viewing the services" → "Swipe up to view your services" (both cover states).
- Dark-mode rules added for every new element.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (no new warnings) · light + dark visual render confirmed against the component's real scoped CSS. Isolated worktree off `origin/main`.

**SPEC IMPACT:** The "Where your day stands" overview (surface §2) gains an action-first banner + persistent loop legend; "What to lock next" → "Also coming up" (now the `dueList` remainder); new first-run coachmark + point-of-action Lock helper teach the loop in the rails; CTA copy updated. → `Vendors_Plan_Budget_Tab_Spec_2026-05-31.md` §2. Logged in `COWORK_INBOX.md`.

## 2026-06-04 · assets(onboarding): premium 2D monogram frames (11, transparent gold)

**Context:** Owner — *"update the Monogram Frames … We want 2D Premium wedding frame designs."*

**What changed:** Regenerated all 11 monogram frames (`public/onboarding/mono/{wreath,crest,square,oval,laurel,botanical,ribbon,flourish,art_deco,baroque,deco_diamond}.webp`) via Recraft as **premium 2D gold frames** — delicate gold linework, **transparent background**, **empty center** for the couple's monogram letters. Generated with `digital_illustration` + `transparent_background` (real alpha); prompts strip "wedding/couple" words so Recraft doesn't fill the center with figures. 512×512 transparent WebP. Same keys → asset swap only.

**Verification:** Asset swap (same filenames/`data-frame` keys) — no code change. QC'd on a contact sheet.

**SPEC IMPACT:** None (monogram frame asset refresh).

## 2026-06-04 · assets(onboarding): real Filipino faith ceremony photos (8 traditions)

**Context:** Owner — the ceremony/tradition photos should show **actual Filipino couples mid-ceremony with guests**, ethnicity-tuned per religion.

**What changed:** Regenerated all 8 faith hero photos (`public/onboarding/wed_{catholic,christian,inc,muslim,cultural,chinese,jewish,bornagain}.webp`) via Recraft — authentic Filipino couples performing their tradition's ceremony with guests:
- **Catholic** (church altar + priest) · **Christian** (garden floral arch) · **Born Again** (modern evangelical stage + worship band) · **INC** (clean modern worship hall, **no cross/crucifix or icons** — the INC distinctive) · **Muslim** (Maranao traditional attire + canopy) · **Cultural** (Igorot/Cordillera) · **Chinese** (red/gold tea ceremony, subtle East-Asian features) · **Jewish** (chuppah + kippah/tallit).
- Ethnicity-tuned per the owner's note. Downscaled to 760×950 WebP (~545 KB total).

**Verification:** Asset swap only — same filenames/keys, no code change.

**SPEC IMPACT:** None (asset refresh; FAITH_PHOTO keys unchanged).

## 2026-06-04 · feat(0023/0022): vendor "request a category" governance (taxonomy Phase 4)

**Context:** The last gap in the DB-backed-taxonomy initiative — letting a vendor REQUEST a category they can't find and an admin resolve it. Closes 0023 §3.2c (the "there's always a place for what you do" promise — no "Other" bucket).

**Migration `20260811000000`** (applied to prod) — new `taxonomy_category_requests` table: a vendor-proposal inbox, deliberately decoupled from the live tree (`service_categories` / `canonical_service_taxonomy`) so un-reviewed input never pollutes the catalog. RLS: a vendor inserts/reads only their OWN requests (resolved through `vendor_profiles.user_id`, the 0044 pattern); admins resolve all. Indexes for the pending queue + the demand signal.

**Vendor side** (`vendor-dashboard/services`) — new `proposeCategory` action + a "Don't see your service?" form on the services editor; the vendor sees their own requests with a live status badge (Pending review / Added ✓ / Use "X" / Kept for your listing / Not added).

**Admin side** (`/admin/taxonomy`) — the four §3.2c outcomes as audit-logged, admin-gated server actions: **promote** (mints a real canonical leaf under a chosen tile — the same two-table write as `createCanonicalLeaf` — and marks the request promoted, first-vendor credit in the audit trail), **map** (points the request at an existing canonical → the count mapped to the same target is the **demand signal**), **keep-private**, **reject** (with reason). Pending requests render as dashed ghost cards with all four controls inline; a demand-signal banner flags canonicals with ≥2 mapped requests as promotion candidates.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (no new warnings) · production build exit 0. Migration dry-run confirmed only-pending, then applied + confirmed on remote (`supabase migration list`). Isolated worktree off `origin/main`.

**SPEC IMPACT:** Vendors can now request a category (0022 services editor); admins resolve via the four outcomes with a demand signal (0023 §3.2c). The expandable-taxonomy governance loop is now closed end-to-end. → `COWORK_INBOX.md`.

## 2026-06-04 · style(onboarding): welcome → 1 photo · pax + budget self-describing number inputs

**Context:** Owner — welcome showed "2 angles" (depth parallax); want 1 clean photo. And restructure the pax + budget inputs.

**What changed:**
- **Welcome → 1 photo.** Swapped `WelcomeParallax` → `HeroImg` (removed the depth parallax). Clean single photo + Ken-Burns.
- **Pax input.** Removed the "N guests" readout + "Exact count" label; the box shows the number **+ "guests"/"guest"**.
- **Budget input.** Removed "Your budget" + the separate ₱; the box shows **₱ + number**; **"No limit"** moved beside the box.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean.

**SPEC IMPACT:** None.

## 2026-06-04 · style(onboarding): drifting cloud layer over the welcome hero sky

**Context:** Owner — *"add the moving clouds effect."* No video generator is wired into this session (Recraft is stills-only), so a true "the photo's own clouds drift" clip can't be produced here. This adds the achievable version — a drifting cloud **layer** over the sky.

**What changed:** CSS + one asset (extends the `data-welcome` welcome screen):
- `public/onboarding/clouds-overlay.webp` (51 KB) — a Recraft cloud texture (white clouds on black), Pillow-processed to **fade its left/right edges to black** so it tiles seamlessly under a screen blend.
- `.welcomehero::after` — texture `repeat-x`, **`mix-blend-mode:screen`** (only the light clouds show over the photo), masked to the upper sky (fades out before the couple), `opacity:.3`, drifting via `@keyframes clouddrift` (100 s). Auto-static under `prefers-reduced-motion`.
- It's an **added** high-cloud layer — the photo's own clouds stay still; the true effect needs a video loop (Higgsfield/Runway/Kling), offered as a follow-up.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean. **Held for owner review on the Vercel preview** (subjective hero look) before merge.

**SPEC IMPACT:** Extends the welcome-screen item already in `COWORK_INBOX.md` (welcome now full-bleed + animated + a drifting cloud layer). None new.

## 2026-06-04 · fix(onboarding): location picks grow-in-place split + equal-size faith chips

**Context:** Owner — the split animation *"just moved in from the right screen"* (the new chip slid in from off-screen), and *"make these [faith] buttons consistent in height and length."*

**What changed:**
- **Grow-in-place split.** The location-pick split no longer slides the new chip in from off-screen. `.locpicks` is now `overflow:hidden`, and a newly-added chip is collapsed to width 0 for one frame (`loc-enter`, via a double-rAF in `LocationStep`) so it **grows out from the gap** while the existing chip shrinks 100%→50% — total width stays ~100% throughout, no off-screen slide.
- **Equal-size faith chips.** `#screen-faith .chip` → fixed `106px` width + `46px` min-height, centered — Catholic / Muslim / INC / Chinese / Born Again / … are now uniform.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean.

**SPEC IMPACT:** None (animation fix + chip sizing).

## 2026-06-04 · style(onboarding): find-vendor skeleton loader (shimmering placeholder cards)

**Context:** Owner — the find-vendor step fetches reception venues from the marketplace, and the blank wait read as "nothing happening." Show a clear loading state as the venues populate.

**What changed:** Replaced the sparse one-line "Finding reception venues…" with a **skeleton loader** — a "★ Finding the best venues for you…" header + **3 shimmering placeholder cards** that mimic the real venue cards (image + name + meta lines). When the fetch resolves, the real cards swap in with minimal layout jump. Shimmer auto-disabled under `prefers-reduced-motion`.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean.

**SPEC IMPACT:** None (loading-state polish on the find-vendor step).

## 2026-06-04 · style(onboarding): location picks split/combine animation (iOS-style)

**Context:** Owner — *"create an iOS animation, the splitting into 2 and/or combining"* (location pick chips).

**What changed:** Added `data-count={value.length}` to `.locpicks`; the chip **width transitions** between full-row (1 pick) and half-row (2 picks) with a smooth ease — adding a 2nd area **splits** the row (the existing chip shrinks to 50% as the new one pops in via `chippop`), removing one **combines** back (the remaining chip expands to full width). CSS-only, no new dependency.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean.

**SPEC IMPACT:** None (cosmetic polish on the location step).

## 2026-06-04 · fix(onboarding): location-pick chip × button — crisp centered SVG icon

**Context:** Owner — *"fix the close button of Tagaytay."* The `×` glyph rendered slightly high/cramped.

**What changed:** Replaced the `{'×'}` glyph in `.locchip-x` with a centered **SVG ×** + a **24px** tap target.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean.

**SPEC IMPACT:** None (cosmetic).

## 2026-06-04 · feat(0006): event_vendors.category_key — taxonomy-keyed storage (PR-1 expand · fully-taxonomy-driven onboarding)

**Context:** Owner ratified **fully taxonomy-driven onboarding** (2026-06-04) — the picker, the couple's stored selection, and auto-inquiries all derive from the live taxonomy, so a new tile auto-appears with no deploy. This **reverses the locked "couple-side `vendor_category` does NOT auto-expand" decision**. Spec: `Onboarding_Taxonomy_Driven_Spec_2026-06-04.md`. This is **PR-1 of 4 (expand-only · no behavior change)**.

**What changed:** migration `20260815000000_event_vendors_category_key_taxonomy.sql`:
- Adds nullable `event_vendors.category_key TEXT`, **FK → `service_categories(id)` `ON DELETE RESTRICT`** (the RESTRICT doubles as the "a running event can't lose a chosen category when an admin deletes its tile" guard) + a btree index.
- **Backfills** `category_key` from the legacy `vendor_category` enum via the authoritative bridge (`lib/vendor-category-taxonomy.ts`): 24 clean 1:1, 2 coarse-alias → primary tile, 4 couple-only exempt → NULL. An `EXISTS (… tier 2)` guard makes every written value FK-valid; `IS NULL` makes it idempotent.
- The legacy `category` enum column is **UNTOUCHED** (still NOT NULL, still source of truth). No RLS change (ADD COLUMN inherits the 0006 policies).

**Drift found + handled:** the PG `vendor_category` enum has **36** values but the TS `VendorCategory` type / bridge cover only **30** — the 6 attire alters (`bridal_gown`/`groom_suit`/`bridal_shoes`/`groom_shoes`/`entourage_attire`/`parents_attire`) drifted out. The backfill covers all 36. The TS-type catch-up is a PR-2/3 cleanup.

**Verification:** expand-only + idempotent (`IF NOT EXISTS` / `DO $$…duplicate_object` / `IS NULL` / `EXISTS tier-2`). No app code changed in PR-1. Not yet applied to prod (apply via `supabase db push --db-url "$SUPABASE_DB_URL"`).

**SPEC IMPACT:** Reverses the couple-side-curation lock + adds `category_key` to 0006. → `COWORK_INBOX.md` (decision-log reversal row + 0006/0000/0021/0007 fold-in).

## 2026-06-04 · style(onboarding): Near-me Top-30 results render as photo cards (location step)

**Context:** Owner — on the "Where will it be?" step, when the couple taps **"Near me"** and a result is one of the **Top-30 wedding destinations**, the card should use the **same background photo** the Top-30 carousel uses, instead of a plain text row.

**What changed** (`_components/location-step.tsx` + `_styles/onboarding.css`):
- New `nearActive` flag (true only on the Near-me results list — `!query && mode==='near' && userPos`). In that list, a row whose city is in `TOP30` now renders as a **`.locphoto` photo card** (city `/onboarding/cities/{key}.webp` background + the carousel's scrim / region / city / nugget + check + selected-gold states), reusing the existing `loccard-*` classes for 1:1 visual parity. Non-Top-30 Near-me results and all search results stay as plain `.locrow` rows.
- New `.locphoto` CSS (full-width photo row, ~112px) + `.locphoto-km` distance pill.

**Verification:** `tsc --noEmit` exit 0 · `next lint` ✔ no warnings or errors. Isolated worktree off `origin/main`.

**SPEC IMPACT:** Minor — the prototype/blueprint show Near-me results as plain rows; Top-30 ones are now photo cards. → `COWORK_INBOX.md`.

## 2026-06-04 · style(onboarding): welcome copy + brand bump/tagline + stronger CTA

**Context:** Owner — new header + subhead for the welcome, plus (from the recommendations table = "photo 2") the brand bump + tagline and a stronger CTA.

**What changed (welcome screen):**
- **Header:** *"Start with the view. We'll handle the details."*
- **Subhead:** *"Tell us your date. Get a free wedding plan + matched vendors in minutes."*
- **Brand:** the SETNAYAN mark + wordmark bumped **~20%** (welcome only) + a tagline **"Wedding planning, simplified"** under the wordmark.
- **CTA:** *"Let's go"* → **"Build my free plan"** (`NEXT_LABEL[0]`; swap to "Match me with vendors" is one word).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean.

**SPEC IMPACT:** Welcome copy + brand + CTA updated. → `COWORK_INBOX.md`.

## 2026-06-04 · revert(theme): light-lock the app — disable OS dark-mode auto-follow + remove the Light/Dark/Auto switch

**Context:** Owner — *"the app used to adjust automatic to light and dark theme. disable this and just always keep it light theme."* Reverts the 2026-05-22 brand-pivot Light/Dark/Auto trio (which made the app follow the device `prefers-color-scheme`). Setnayan now renders in the light Clean-Editorial palette on every dashboard / marketing surface, ignoring the OS setting and any previously-stored preference.

**What changed:**
- **`app/_components/theme-provider.tsx`** — hard-locked to light. The `useTheme()` API is kept (≈7 consumers call it) but `mode`/`resolvedTheme` are always `'light'`, `setMode` is a no-op, and the `.dark` class is never applied (stripped on mount + by the bootstrap script). The FOUC bootstrap script is reduced to "strip `.dark`" so a stale cached shell can't paint dark.
- **`app/layout.tsx`** — `viewport.themeColor` pinned to a single `#FFFFFF` (dropped the `prefers-color-scheme: dark → #18191A` variant) so a dark-mode device no longer tints the browser chrome dark against the light page.
- **`app/dashboard/profile/page.tsx`** — removed the **Appearance** theme picker; the section is re-headlined **"Feedback"** and keeps the existing Haptics toggle. Dropped the now-unused theme imports + the `theme_preference` read.
- **`app/dashboard/profile/_components/theme-mode-picker.tsx`** — deleted (orphaned).
- **`app/site-editor/[eventId]/_components/site-editor.tsx`** — removed the in-editor **Theme** card (it flipped the same global theme) + its now-unused imports; refreshed the doc comment.
- **`app/globals.css`** — header comment updated; the `html.dark` token overrides are LEFT dormant (now unreachable).

**Dormant (not removed, for a trivial revert):** the `users.theme_preference` column + its `updateThemePreference` server action (now unread) + the `html.dark` CSS blocks. Because `darkMode: 'class'` (tailwind.config.ts) and globals.css has **no** `@media (prefers-color-scheme: dark)` rule, never adding `.dark` makes the app light by construction — every `dark:` variant simply goes inert.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (only pre-existing warnings, none in touched files) · production build green. No tests reference the theme system.

**SPEC IMPACT:** Reverses the 2026-05-22 Light/Dark/Auto brand-pivot lock — affects **0021** (theme system / Appearance), **0025** (Profile Settings → Appearance tab), and the corpus **DECISION_LOG**. → `COWORK_INBOX.md`.

## 2026-06-04 · revert(onboarding): undo the immersive full-bleed on role/kind/faith — back to the card layout

**Context:** Owner — *"undo the full screens"* → chose *"back to the old cards."* Reverts the immersive redesign of the three choice screens; the welcome is left as-is.

**What changed:**
- Removed the `data-immersive` hook + the full-bleed CSS block (photo-as-background, overlaid title/chips, scrims).
- **Role + Kind:** the title-only chip carousels reverted to the **title + description + radio-circle cards** (3-in-a-row); the sub-text is static again (no description-on-pick).
- **Faith:** back to the 1-row chip carousel (non-full-bleed).
- **Untouched:** the welcome (full-bleed hero + depth parallax + new copy) and the location step.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean.

**SPEC IMPACT:** Reverts the immersive role/kind/faith treatment. → `COWORK_INBOX.md`.

## 2026-06-04 · feat(0023): Growth surface — demo-mode data, CSV export, event breakdowns

**Context:** Follow-ups to the just-shipped `/admin/growth` surface (PR #938): the owner asked to (b) seed demo data so the curves show shape pre-pilot, and (c) add a CSV export + extra breakdowns (per-region / per-event-type). (a) — a live admin screenshot — is handled out-of-band against the deployed site.

**What changed** (additive, no migration):
- **`lib/admin/growth-stats.ts`** — new `buildDemoGrowthStats(range)`: deterministic synthetic population + 5 rising series + ~42% conversion + breakdowns, `demo:true`, NO DB reads (stable screenshots). New `fetchBreakdowns()` (one bounded `events` read → events-by-type via enum-label map + events-by-region via uppercased `region` slug, null→Unspecified, sorted desc, `sampled` flag). `GrowthStats` gains `demo` + `breakdowns`.
- **`app/admin/growth/page.tsx`** — reads the admin demo-mode cookie/flag (page is already admin-gated by the layout); in demo mode renders the synthetic stats with an **"Illustrative demo data"** badge. New **Breakdowns** section (Events by type + Events by region bar lists). New **Export CSV** button.
- **`app/admin/growth/export/route.ts`** (new) — admin-gated GET (re-checks admin since route handlers bypass the layout guard; 404 for non-admins). Honors `range` + the demo flag (export matches what's on screen). Returns a tidy/long-format `text/csv` attachment (section,series,period,value) covering population + per-entity growth curves + conversion + breakdowns.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean · `next build` exit 0 (`/admin/growth` + `/admin/growth/export` both ƒ dynamic). Isolated worktree off `origin/main`.

**SPEC IMPACT:** Extends the 0023 Growth surface (still the same 29th surface). → `COWORK_INBOX.md` [PENDING]: note the demo-mode preview, CSV export, and event type/region breakdowns in the 0023 Growth subsection.

## 2026-06-04 · fix(onboarding): welcome photo cover-fit (no distortion) + location picks share the row

**Context:** Owner — *"the first slide's photo is distorted; just fill the space to not distort it; all background feel should not be distorted, just fill the space"* + *"keep the location choices consistent in length and height — the two buttons equally share a row, but if one only, they fill the row."*

**What changed:**
- **Welcome parallax distortion fixed.** The WebGL shader mapped the photo's full UV to the canvas, **stretching** the landscape photo into the tall phone. Added an aspect-correct `cover` uniform (crops to the canvas aspect, computed from photo + canvas dimensions each frame) so the photo **fills without distorting** — depth parallax retained. (Other screens already use `object-fit:cover`.)
- **Location picks share the row.** The selected-area chips (`.locpicks`) are now equal-size: `flex:1` each + `flex-wrap:nowrap` → **1 pick fills the row · 2 split 50/50**, equal height; the label ellipsis-truncates (wrapped in `.locchip-label`).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean.

**SPEC IMPACT:** Refines the welcome (cover/no-distort) + location-step (pick chips) items already in `COWORK_INBOX.md`.

## 2026-06-04 · feat(onboarding): immersive role/kind/faith screens — full-bleed photo + chip carousel

**Context:** Owner, on the role + kind + tradition screens — *"make photos here full screen too · create make it a carousel · just leave the main button name, remove the circles, equal length and height buttons · sub text will show on top as they pick."* Unifies role/kind/faith into one immersive pattern (matching the welcome's full-bleed).

**What changed** (CSS + render, scoped to a new `data-immersive` hook on `.phone` for steps 1–3):
- **Full-bleed photo** — the hero fills the whole phone; top/bottom bars float transparent; title (top) + choices (bottom) overlay it with scrims + white text (brand stays visible).
- **Choices = equal-size, title-only chip carousel** — role (Bride/Groom/Someone helping) + kind (Religious/Civil/Mixed) converted from radio cards to chips (no descriptions, **no radio circles**); horizontal scroll-snap; equal width + height per screen.
- **Picked option's description → sub-text** — selecting a role/kind surfaces its description in the header sub (e.g. "Walking down the aisle."), replacing the static sub.
- **Faith** chips also equal-size + full-bleed (the tradition screen from the prior request).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean.

**SPEC IMPACT:** role/kind/faith are now immersive full-bleed with chip carousels + dynamic sub-text. → `COWORK_INBOX.md`.

## 2026-06-04 · feat(security): global security headers (pre-public-pilot hardening § B1)

**Context:** Owner pre-public-pilot hardening pass (corpus `Pre_Public_Pilot_Hardening_2026-06-04.md`). A same-day security audit found the data layer strong (RLS on all 134 tables; public API auth-gated + contact-masked) but the HTTP edge bare — `apps/web/next.config.ts` set **zero** security headers. This ships the safe, non-breaking subset. Rate limiting (§ B2) is owner-side Cloudflare-edge config (no app code), per the owner's choice.

**What changed:** A global `headers()` entry (`source: '/(.*)'`) adds 6 headers to every response:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains` (HTTPS-only; `preload` omitted to stay reversible)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN` **+** `Content-Security-Policy: frame-ancestors 'self'` — block external clickjacking while preserving the dashboard's same-origin landing-page preview iframe
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self), browsing-topics=()`

**Deliberately NOT shipped:** a full resource/script CSP (`default-src`/`script-src`). It would have to enumerate every external origin we load (Supabase · Sentry · PostHog · R2 · Maya · YouTube · Google Fonts) and would break the inline Babel-standalone keynote decks under `public/keynote/*`. Tracked as a tested follow-up in the hardening doc.

**Verification:** Static config change (no new imports/logic). All required CI checks green on PR #939 (typecheck + lint · production build · lighthouse · playwright e2e · Vercel preview).

**SPEC IMPACT:** None — the hardening posture is already captured in the corpus (`Pre_Public_Pilot_Hardening_2026-06-04.md` + DECISION_LOG 2026-06-04). The pre-existing public-`/api/v1/vendors` vs "no public API in V1" drift is logged there for Cowork; it is not introduced by this change.

## 2026-06-04 · feat(onboarding): welcome hero depth-parallax + new copy

**Context:** Owner — *"i want the exact photo but we want it to animate the background making it have depth"* + new welcome copy. (Cloud-overlay PR #936 set aside per the owner's "no"; left unmerged.)

**What changed:**
- **Copy:** headline → *"Wedding planning, without the chaos."*; sub → *"Answer a few questions. We'll find your vendors and build your plan — free to start."*
- **`welcome-parallax.tsx`** (new) — WebGL depth-parallax on the **exact** welcome photo: a fragment shader displaces UVs by a depth map × a slow auto-orbiting camera (near shifts more than far → dimensional motion from one still). **Bulletproof fallback** — a plain `<img>` renders first and only hides once the canvas truly draws; WebGL/shader failure or reduced-motion → the static Ken-Burns hero stays. Never broken.
- **`public/onboarding/welcome-depth.png`** (4 KB) — approximate depth map. Drop a true depth map (Depth-Anything/Immersity) at the same path for crisp object-parallax — no code change.
- Wired into the welcome hero (replaces `HeroImg`) + CSS for the canvas/img layers.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean. Photo same-origin → no WebGL CORS.

**SPEC IMPACT:** New welcome copy + depth-parallax hero. → `COWORK_INBOX.md`.

## 2026-06-04 · feat(0023): Admin Growth & Population surface (/admin/growth)

**Context:** Owner — make statistics of the progress of the app: both *actual population* (current totals) and *growth over time* for vendors · services · events · customers · guests, plus *guest → account-holder conversion*. No existing admin surface showed multi-entity population + growth curves, and conversion was computed nowhere (the Overview shows point-in-time counts only; Funnels is step-conversion; Operations & Hiring is vendor-signup + hiring-forecast). Owner picked a dedicated `/admin/growth` page and the **"any linked account"** conversion definition.

**What changed** (additive — new surface + nav entries, no migration):
- **`lib/admin/growth-stats.ts`** (new) — `fetchGrowthStats(range)`: population head-counts; per-entity weekly **cumulative + net-new** series (12 fixed buckets; baseline + per-boundary `count:'exact', head:true` — exact, indexed-only, no 1000-row truncation); **guest→account conversion** via `event_members.guest_id` + `member_type='guest'` (cumulative by `joined_at`, all-time rate = converted ÷ non-removed guests, median days-to-convert from a bounded embedded read). Per-section error isolation. No migration — all five entity tables already carry `created_at`.
- **`app/admin/growth/page.tsx`** (new) — server component: range picker (GET form · 3/6/12 months · mirrors /admin/funnels), Population-now tiles, per-entity growth cards with hand-rolled **SVG cumulative sparkline + net-new bars** (no chart lib in the repo), conversion section. v2.1 `--m-*` chrome; responsive.
- **`app/admin/_components/admin-sidebar.tsx`** — Funnels group relabeled **"Insights"** (group key stays `funnels` so persisted open-state survives); adds **Growth** item (LineChart).
- **`app/admin/_components/admin-bottom-nav.tsx`** — `/admin/growth` added to the mobile **More** tab's activeMatch.
- **`app/admin/more/page.tsx`** — **Growth** card added to the mobile More landing (orphan-prevention · 1:1 with the sidebar).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean · `next build` exit 0 (`/admin/growth` registered as ƒ dynamic, beside `/admin/funnels`). Built in an isolated worktree off `origin/main`.

**SPEC IMPACT:** Iteration 0023 gains a **29th admin surface ("Growth")** and the **Funnels group → "Insights"** (Funnels + Growth). → `COWORK_INBOX.md` [PENDING]: update 0023 §1 group list + surface count, add a Growth subsection, lock the conversion definition (any linked account), and mark `/admin/growth` SHIPPED in `App_Build_Status.md`.

## 2026-06-04 · style(onboarding): welcome screen full-bleed hero + button-over-photo + Ken-Burns drift

**Context:** Owner — *"fill the whole screen with the photo … button stays but the white background is removed to stretch the photo further … make the background animate like the clouds slowly moving or camera slowly moving. do we need Higgsfield?"* Verdict: **no Higgsfield needed** — the "camera slowly moving" feel is a free CSS Ken-Burns; a real moving-clouds video (Higgsfield / Runway / Kling, R2-hosted muted loop) is an optional later upgrade. This ships the full-bleed + CSS drift.

**What changed:** CSS-only + one hook — a new `data-welcome` attribute on `.phone` (set when `step === 0`) scopes everything to the welcome step:
- Top + bottom bars become **transparent overlays** (no white bands) so the hero fills the whole phone; the **Setnayan brand stays visible** (Golden Rule 2) via a subtle top scrim + white wordmark; the progress bar is hidden on welcome.
- Body padding cleared + hero margin/radius zeroed → **edge-to-edge photo**; the **"Let's go" button floats** over a soft bottom scrim; overlay text padded to clear it.
- **Ken-Burns**: slow 26s scale+pan (`@keyframes kenburns`) on the hero `<img>`, auto-disabled under `prefers-reduced-motion` (global rule).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean.

**SPEC IMPACT:** The prototype/blueprint show the welcome hero as a bordered card; it's now full-bleed + animated. → `COWORK_INBOX.md`.

## 2026-06-04 · feat(0016): Top-30 reception-anchored location step ported into onboarding (screen 6)

**Context:** Owner: the onboarding region step "still shows the NCR/Calabarzon cards, not the new one we created." The search-box + **Top-30-wedding-spots** redesign was fully spec'd (Onboarding_Blueprint §3.0 · reworked 2026-06-04), prototyped (`Onboarding_Wedding_Flow_2026-06-01.html`), and had its **30 city photos + full PSGC dataset** generated — but was **never ported into the app**. Live onboarding still ran the single-select region picker. This ports the locked design.

**What changed** (replaces the region picker at `#screen-region`):
- **`_data/wedding-cities.ts`** — 72 curated cities `{k,n,r,rk,lat,lon,top?,nug?}` + `TOP30` rank order + helpers (`cityByKey`, `REGION_CENTROID`, `normPlace`, `kmBetween` haversine, `resolvePick`).
- **`_data/ph-places.ts`** — full PSGC set (1,665 places · all 17 regions), **lazy-loaded** on first search (own chunk — no initial-bundle bloat).
- **`public/onboarding/cities/*.webp`** — 30 city photos (the carousel).
- **`_components/location-step.tsx`** — idle → Top-30 carousel (photo + per-city nugget, ranked); type → curated-first then full-PSGC search (≤30 rows); "Near me" → GPS nearest-first (haversine); pick **up to 2** areas → removable chips.
- **`onboarding-shell.tsx`** — swapped the render for `<LocationStep>`; added `state.places` (≤2 keys); derives `region` (`cagayan-valley→cagayan` kept in the existing vocab) from the primary pick so existing region-scoped fetches + recap still work; gate now `places.length ≥ 1`; commit stamps `events.venue_latitude/longitude`. Retired REGNUG / REGION_TOP / REGION_MORE / regionExpanded.
- **`types.ts` / `actions.ts`** — `places: string[]` on state; `venueLatitude/Longitude` on the commit payload + events insert. **No migration** (`events.venue_latitude/longitude` already exist).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean. Isolated worktree off `origin/main`.

**Deferred (minor):** the prototype's carousel slide-down-on-type animation (we swap carousel↔results; the results-rise animation is kept); long-tail PSGC places use region-centroid coords (the 30 curated cities keep precise coords).

**SPEC IMPACT:** Lands the long-pending **app** port of Onboarding_Blueprint §3.0 location step. → `COWORK_INBOX.md` (App_Build_Status: mark screen-6 location step SHIPPED).

## 2026-06-04 · style(onboarding): role + kind choices in one row · tradition chips as a 1-row carousel

**Context:** Owner, walking the wedding onboarding screen-by-screen — *"place the 3 choices in 1 row"* (role: Bride / Groom / Someone helping), *"place the 3 in 1 row also"* (kind: Religious / Civil / Mixed), and *"carousel this also in 1 row"* (the 8 ceremony-tradition chips, until now a 4×2 grid).

**What changed:** CSS-only, in `apps/web/app/onboarding/wedding/_styles/onboarding.css` — scoped to `#screen-role` / `#screen-kind` / `#screen-faith`, appended at EOF to win the cascade; **no JSX/TSX touched**:
- **Role + Kind** (`#screen-{role,kind} .stack`) flip from `flex-direction:column` to a **row of 3** equal-width / equal-height `.opt` cards (title, check, desc shrink slightly for the narrower column; selection styling + tap behaviour preserved).
- **Tradition** (`#screen-faith .chips`) flips from the 2026-06-04 fixed **4-col × 2-row grid** to a **single horizontal scroll-snap carousel** (nowrap + overflow-x; chips size to their label).
- Both are **shorter vertically** than before, so the hero photo keeps its room — Golden Rule 1 (one viewport) holds.

**Verification:** CSS-only (no TS change); equal/higher specificity + source order over the prior rules. CI production build validates the bundle; Vercel preview on the PR for visual confirm.

**SPEC IMPACT:** The onboarding prototype + blueprint still show these steps in their old layouts (role/kind stacked · faith 4×2 grid — the latter an explicit 2026-06-04 spec note now superseded). → `COWORK_INBOX.md` (Onboarding_Blueprint §3.0 role/kind/tradition + `Onboarding_Wedding_Flow_2026-06-01.html`).

## 2026-06-04 · fix(0023): mobile Directory landing missing Wedding types + Wedding traditions

**Context:** Owner reported the **Wedding traditions** surface was unreachable on mobile. The `/admin/wedding-types` (#895) + `/admin/wedding-traditions` (#898) entries were added to the desktop sidebar's `ADMIN_NAV_GROUPS`, but the **mobile** Directory landing (`/admin/directory`) builds its tiles from a **separate hardcoded `DIRECTORY_ITEMS` array** (the "mobile landings consume the same nav groups" note was aspirational) — so both new surfaces were missing on mobile.

**What changed:** Added the **Wedding types** (Church) + **Wedding traditions** (BookOpen) tiles to `DIRECTORY_ITEMS` in `app/admin/directory/page.tsx`, matching the sidebar order + icons. Both surfaces are now reachable on mobile (Directory tab) and desktop (sidebar).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean.

**SPEC IMPACT:** None (both surfaces already specced in 0023; this restores mobile reachability).

## 2026-06-04 · feat(0023/0044/0006): add-new-leaf editor + couple-side taxonomy validation + /vendors read-through

**Context:** Owner — "set the taxonomy to be capable of growing and reformatting… our app will rely on that for vendors, services, onboarding." Most of the DB-backed-taxonomy stack already shipped (Phase 2a read-through · Phase 3 editor rename/remap/add/delete/reorder). This closes three remaining gaps in that initiative. (Re-baseline: the foundation + read-through + editor were already on `main` — this builds on them, it does not rebuild them.)

**Slice 2 — mint a new bookable leaf from `/admin/taxonomy` (no deploy).** New `createCanonicalLeaf` action writes BOTH tables a leaf needs: a `canonical_service_schemas` stub (→ appears in the vendor onboarding "add a service" picker via `listCanonicalServices`, taggable, refinement-ready) + a `canonical_service_taxonomy` mapping under a chosen tile (→ `/vendors` buckets it live via `getCanonicalBuckets`). Optional starter refinement seeds the first `multi_select` attribute (e.g. `table_linen_rental` under Stylist/Decorator + a Customization refinement: plain · custom_monogram · custom_logo). Service-role + audit-logged; rolls back the schema stub if the mapping insert fails. New "Add a new service" form on the editor page — this is the editor's first **leaf-minting** capability (prior actions only remapped existing canonicals).

**Slice 3 — couple-side `vendor_category` → canonical anchoring (`lib/vendor-category-taxonomy.ts`).** Anchors the legacy 30-value `event_vendors.category` vocabulary to the canonical tile taxonomy. A/B/C bucket study: **24 clean-1:1** · **2 coarse aliases** (band_dj → live_band+dj · transportation → bridal_car+guest_shuttle) · **4 exempt couple-only** (officiant auto-resolves from venue · church_fees is a budget line · security has no tile · misc). Drift is compile-time-enforced (exhaustive `Record<VendorCategory>` + `WeddingTile`-typed targets — a renamed/removed tile or a new unclassified category fails `tsc`) + a runtime `validateVendorCategoryMapping()` surfaced as a couple-side anchoring diagnostic on the admin taxonomy page.

**Slice 1 — `/vendors` child-component read-through.** `folder-vendors-section.tsx` + `category-tile.tsx` (now async) read folder labels from `getTaxonomy()` instead of the constant, so a parent renamed in the editor reflects in the section header + the "Also under …" cross-listing hint (Phase 2b·2 had deferred these as a "no-op" assuming folder labels were editor-immutable — but `renameTaxonomyNode` has no tier guard, so parents ARE renamable). Dashboard planning-grid consumers stay on the constant by design (they read editor-immutable folder SLUGS for deep-links · the immutable-key invariant).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (no new warnings) · production build exit 0. Foundation migration `20260803001000` already applied to prod (verified via `supabase migration list`) — **no migration in this PR**. Isolated worktree off `origin/main`.

**SPEC IMPACT:** The taxonomy editor can now **mint a new bookable canonical leaf** (schema stub + tile mapping + optional refinement) at runtime — extends 0023 §3.15 beyond rename/remap/add-tile/delete/reorder. Couple-side `vendor_category` is now **anchored to the canonical taxonomy** (new A/B/C mapping). → `COWORK_INBOX.md` (0023 + 0006).

## 2026-06-04 · feat(0043,0023): per-religion traditions accuracy pass + "Reset to latest" admin action

**Context:** Owner-approved accuracy pass on the per-religion "What to expect" content (`lib/wedding-traditions.ts`), grounded in standard PH wedding practice — especially the flagged INC / Muslim / Cultural / Chinese — keeping the honest "confirm with your {officiant}" framing.

**What changed:**
- **`lib/wedding-traditions.ts`** — enriched all 8 religions: Catholic (Pre-Cana + canonical interview; certs "for marriage purposes"; veil/cord/arrhae), Civil (LGU pre-marriage counseling; 120-day license), Christian (registered solemnizing officer), **INC** (members in good standing / non-member baptism into the Church; Kapilya; alcohol-free + wholesome program), **Muslim** (Nikah/akad; mahr/wali/two witnesses; Walima; gender separation + modesty; halal; PD 1083 Shari'a registration), **Cultural** (datu/elder; sub-type captures the specific tradition; bride-price + family exchanges), **Chinese** (tea ceremony in seniority order; **auspicious date**; guo da li; red qipao; lauriat). Content remains starter guidance pending clergy confirmation.
- **`/admin/wedding-traditions`** — new **"Reset all to latest starter content"** action (`resetTraditionsToDefaults`) + button: replaces every religion's items with the current code defaults (this accuracy pass), with a clear "discards manual edits" warning. Distinct from "Load starter content" (fills empty religions only). Lets the owner pull the improved content into the live `wedding_tradition_items` table in one click.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean. The `20260807000000` table is already applied in prod; the live content refreshes when an admin clicks Reset.

**SPEC IMPACT:** Minor — iteration **0023** Wedding-traditions surface gains a "Reset all to latest starter content" action. Content stays owner/clergy-validatable in the editor.

## 2026-06-04 · fix(0000): add-event switcher copy → all-live (drop "more event types unlock over time")

**Context:** Owner-approved follow-up. The event-switcher "+ Add event" sheet subtitle still read *"Weddings and debuts are live now. Swipe through to see what's on the way — more event types unlock over time"* — roadmap-flavored + contradictory now that all 9 event types are live ("keep everything live"). The create-event page header was already fixed (#888); this was the last stale string.

**What changed:** `event-switcher.tsx` addtype subtitle → *"Swipe through and tap the one you're planning."* (accurate for all-live; no coming-soon / unlock implication).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean.

**SPEC IMPACT:** Minor — resolves the "noted follow-up" copy tweak flagged in spec `0000` §2.5 (add-event sheet line). The spec note is updated to match.

## 2026-06-04 · feat(0016): Schedule dimension — vendor availability filter (leaf-match · the last dimension)

**Context:** The one deferred leaf-match dimension. A reception venue booked on every one of the couple's possible dates shouldn't show. The availability infrastructure already existed (`lib/vendor-availability.ts` · `vendor_calendar_blocks` · batched `getBatchVendorAvailableDays`, all cron-free read-time + failing-open), and the public `/vendors` marketplace already used it — but the leaf-match matcher + onboarding didn't. This wires it in.

**Wiring (Hybrid · failing-open):**
- **`lib/wizard-recommendations.ts`** — new optional `availableDateKeys` arg (YYYY-MM-DD). When set, after the base fetch it reads the candidate pool's calendars (one batched `getBatchVendorAvailableDays` over the candidates' span) and keeps a vendor only if it's FREE on ≥1 candidate date — dropping vendors whose `vendor_calendar_blocks` cover all of them. A vendor with **no blocks is fully available** (the V1 calendar default), so **Setnayan always-on services + any vendor who hasn't marked a calendar pass through** — no `is_setnayan_service` special-case needed. New `dateSpanFromKeys` helper. Over-fetch triggers on schedule too.
- **`app/onboarding/wedding/actions.ts`** — `searchOnboardingReceptionVenues` takes `dateCandidates`, passes them as `availableDateKeys`.
- **`onboarding-shell.tsx`** — passes `state.dateCandidates` **only in `dateMode==='specific'`** (a flexible window-mode couple isn't date-constrained, so it's left unscoped).

**Scope choices (deliberate):** schedule filters the **browse list** (the step-12 venue search), **not** the congrats **count** — the count stays on the durable structural dims (region/event-type/religion/venue/pax/venue_type) rather than a transient per-date availability that fluctuates as vendors book. Dashboard `category-search` adopting `availableDateKeys` is a clean follow-up (the `/vendors` marketplace already has its own availability gate). **No migration** (table exists). Activates on **real vendor calendar data** — demo vendors have no blocks (all fail-open to available), so demo won't narrow until vendors mark dates.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (3 files) · no migration · failing-open preserved (no-calendar / read-error → admit). Isolated worktree off `origin/main`.

**SPEC IMPACT:** Onboarding venue search now scopes by **Schedule** (vendor calendar availability) — completing the Hybrid leaf-match's six dimensions (Location · Event-Type · Religion · Venue-type+setting · Pax · Schedule). Reuses the existing `vendor_calendar_blocks` model — no new schema. Note on `COWORK_INBOX.md` → `0044`: the leaf-match contract is now fully wired; remaining 0044 work is the refinement-schema formalization + venue-vocabulary reconciliation (unchanged).

## 2026-06-04 · feat(0044/0016): fine venue_type refinement + dashboard parity (leaf-match · "apply everything" 3-4/4)

**Context:** Completes the Hybrid leaf-match. Two parts in one PR.

**Part A — fine `venue_type` refinement (onboarding).** The reception screen captures a precise pick (hotel ballroom · events place · restaurant · garden · beach · heritage · resort), but it collapses to the coarse 7-value `events.venue_setting` enum at commit (hotel / events place / restaurant all → `banquet_hall`), so the couple couldn't distinguish a hotel ballroom from an events place. New **`vendor_profiles.venue_type`** (migration `20260810000000`, applied to prod · nullable TEXT, no CHECK — the canonical fine vocabulary is still being ratified via Cowork) lets a venue declare its precise type.
- **`lib/wizard-recommendations.ts`** — new optional `venueType` arg, resolved + filtered in the SAME candidate-pool lookup as `capacity_max` (one query does both). Hybrid NULL-safe.
- **`app/onboarding/wedding/actions.ts`** — `RECEPTION_TO_VENUE_TYPE` map (fine); `searchOnboardingReceptionVenues` + `getOnboardingVendorCounts` derive + pass `venueType` (count selects `venue_type` + a `venueTypeFit` predicate).
- **`scripts/seed-demo-vendors.ts`** — `venueTypeFor(setting, index)`: `banquet_hall` fans out into hotel_ballroom / events_place / restaurant; deterministic (no RNG-stream perturbation).

**Part B — dashboard marketplace parity (event-type + pax).** The dashboard search passed only ceremony + venue_setting (location was already handled via reception coords + the grid's client-side region picker). Added **event-type + pax** server-side:
- **`vendors/_actions/category-search.ts`** + **`wizard-actions.ts` `searchVendorRecommendations`** — fetch the event's `event_type` + `estimated_pax`, pass `eventType` + `pax`. Region intentionally NOT server-forced (would fight the grid's region picker); venue_type stays onboarding-only (the dashboard stores just the coarse `venue_setting`).

**Effect:** a couple wanting a *hotel ballroom* stops seeing events places (after a demo re-Create populates `venue_type`; existing NULL rows admitted = no regression). Dashboard searches now exclude non-wedding + over-capacity vendors. All new engine args are optional → the other call sites are untouched.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (5 files) · migration applied via `supabase db push` (dry-run-confirmed only-pending) + confirmed on remote. Isolated worktree off `origin/main`.

**SPEC IMPACT:** New `vendor_profiles.venue_type` + `venue_type` filtering in onboarding; `event_type` + `pax` now scope the dashboard marketplace. **Capacity + venue_type both landed as first-class `vendor_profiles` columns** (pragmatic, like `venue_directory.capacity_*`/`venue_type`) rather than 0044 `attribute_payload`. Owner action on `COWORK_INBOX.md` → `0044`: ratify the fine `venue_type` vocabulary (`hotel_ballroom · events_place · restaurant · garden · beach · heritage · resort` — kept in lock-step across the migration comment, `RECEPTION_TO_VENUE_TYPE`, and the seed) and fold it into the venue refinement schema + the `venue_setting`↔`venue_directory.venue_type`↔`vendor_profiles.venue_type` reconciliation. **Schedule** (vendor calendar availability) remains the one deferred dimension.

## 2026-06-04 · feat(0023): /admin/taxonomy editor — reorder tiles (Phase 3c)

**Context:** Completes the editor's structural toolset. The catalog reads tile order from the snapshot (2b·2), so reordering shows on the live `/vendors` browse with no deploy.

**What changed:**
- **`actions.ts`** — `moveTaxonomyNode` (service-role, audit-logged): swaps a tile's `sort_order` with its adjacent sibling (same parent + tier), up or down; no-ops at the edge.
- **`page.tsx`** — ▲▼ reorder buttons per tile in the editor tree.

**Editor now covers:** rename · re-map · add · delete · **reorder** — the full set of structural ops over the live taxonomy, all audit-logged.

**Verification:** `tsc --noEmit` 0 errors · `next lint` clean.

**SPEC IMPACT:** None — implements (more of) the locked 0023 §3.15 editor.

**Taxonomy-editor track — remaining (honest):** **2b·3** (client nav read-through) is a **no-op** — those 5 components only read editor-immutable folder slugs / short-labels / order. The genuinely-remaining spec items are **larger / blocked**: the §3.15 **two-admin gate** + **drag-to-move** UX + **grandchildren / leaf↔branch** machinery (modest marginal value over the existing admin-gate + audit-log + orphan-guards), and **§3.2c vendor-request review (Phase 4)**, **upstream-blocked** on the 0022 vendor "add a category" flow (separate iteration — needs scope sign-off).

---

## 2026-06-04 · feat(0044/0016): Pax dimension — venue capacity filter (leaf-match · "apply everything" 2/4)

**Context:** Next leaf-match dimension after region + event-type (#915) and the demo diversification (#921). A reception venue that can't seat the couple's guest count shouldn't show — and the congrats count should reflect it.

**Migration (`20260809000000_vendor_profiles_capacity.sql`, applied to prod):** adds `capacity_min` / `capacity_max` (nullable INT) to `vendor_profiles` + a partial index on `capacity_max`. **Deliberately NOT added to the `vendor_market_stats` view** — the matcher reads capacity via a small candidate-pool lookup instead, so the live marketplace read-path view is left byte-identical (zero view-replacement risk).

**Wiring (all Hybrid · NULL `capacity_max` = no constraint → admitted):**
- **`lib/wizard-recommendations.ts`** — new optional `pax` arg. When set, after the base fetch it resolves `capacity_max` for the candidate pool (one `vendor_profiles` lookup) and drops venues with `capacity_max < pax`. Over-fetch now also triggers on pax. Degrades gracefully if the column is ever absent (lookup errors → admit all).
- **`app/onboarding/wedding/actions.ts`** — `searchOnboardingReceptionVenues` passes `pax`; `getOnboardingVendorCounts` gains a `paxFit` predicate and now sources its pool from `vendor_profiles` (same rows as the view + `capacity_max`), so pax narrows `matched` below `total` too.
- **`onboarding-shell.tsx`** — passes `state.pax` into both calls.
- **`scripts/seed-demo-vendors.ts`** — `venueCapacityFor(setting, index)` gives each demo reception venue a setting-correlated seated capacity (hotel ballrooms seat most, beach/heritage least), spread by index so a guest count actually narrows the set. Deterministic (no RNG-stream perturbation). Non-venue vendors stay NULL.

**Effect:** a 225-pax couple's venue list + count drop venues that can't fit (after a demo re-Create populates capacity; existing demo rows are NULL = admitted, so no regression meanwhile). The other 5 engine call sites are untouched (`pax` optional).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (4 files) · migration applied via `supabase db push` (dry-run confirmed it was the only pending one; no backlog) and confirmed on remote. Built from an isolated worktree off `origin/main`.

**SPEC IMPACT:** New `vendor_profiles.capacity_min/max` columns; onboarding venue search + count now filter by **Pax**. Capacity landed as a first-class column (pragmatic, like `venue_directory.capacity_*`) rather than 0044 `attribute_payload` — note this on the `COWORK_INBOX.md` → `0044` venue-schema item (the venue refinement schema can reference these columns instead of re-modeling capacity). Remaining: dashboard parity (3/4), fine venue_type refinement (4/4); Schedule deferred.

## 2026-06-04 · fix(0044/demo): diversify demo venue settings + plug BGC region hole (leaf-match follow-up)

**Context:** Follow-up to the leaf-match wiring (#915). Two data-layer gaps surfaced once region/venue filtering went live:
1. **Every demo venue shared `compatible_venue_settings: ['banquet_hall','garden','heritage']`** — so the couple's reception-style pick (garden / beach / banquet_hall …) matched *every* venue: the filter was wired but couldn't bite. Worse, that same uniform array sat on **non-venue** vendors too, which **wrongly excluded every photographer/caterer/etc. from beach + destination weddings** (those settings weren't in the array, and the marketplace filter is `compatible_venue_settings.is.null OR …cs.{setting}`).
2. **`BGC`** is a demo city but was missing from `regionForCity`'s map, so BGC vendors resolved to "unknown region" and leaked into every region's results (a hole in #915's effective-region fallback).

**Fix:**
- **`scripts/seed-demo-vendors.ts`** — new `venueSettingFor(city, index)` (deterministic on city+index, so it does NOT perturb the RNG stream). Reception venues (`coarse === 'venue'`) now get **one** city-correlated setting (Boracay→beach, Tagaytay→garden/destination, NCR→banquet_hall/heritage, …); **every non-venue vendor gets `NULL`** = "works at any venue". So the venue filter actually narrows, and service vendors stop being excluded from beach/destination weddings.
- **`lib/regions.ts`** — added `bgc` / `bonifacio global city` / `fort bonifacio` → `NCR`.

**Effect:** after a demo re-Create (`/admin/demo-vendors`), a garden couple sees only garden venues; a beach couple keeps all their photographers/caterers. The BGC fix is live immediately (runtime).

**Verification:** `tsc --noEmit` exit 0 (the seed is in tsconfig `include`) · `next lint` clean · no migration · seed change takes effect on re-Create. Built from an isolated worktree off `origin/main`.

**SPEC IMPACT:** None — demo-data realism + region-map completeness. The venue-setting model itself is unchanged; the deeper venue **refinement** schema (hotel-vs-events-place granularity, capacity) remains the `COWORK_INBOX.md` → `0044` item.

## 2026-06-04 · docs(cowork): flag spec↔code divergence on the event-type picker (all-live)

**Context:** A Cowork pass applied the #882 carousel note to spec `0000` as "Wedding + Debut live · 11 types · nine coming-soon" — but production is **all 9 event types live** (#884 "unlock all events" + owner's "keep everything live"). The spec now contradicts the code; the "keep everything live" decision was never logged to the corpus.

**What changed (docs only, no code):** Added a prominent top `[PENDING]` item to `COWORK_INBOX.md` that consolidates + corrects the event-type-picker + per-religion cluster — instructs the next Cowork pass to (1) correct `0000` to **all-live** (live roster = the 9 in `event-types.ts`, incl. Gender Reveal, excl. Anniversary/Graduation/Reunion; no coming-soon tier, no notify), (2) log the decision in `DECISION_LOG.md`, and (3) land the per-religion items (Chinese active, the `/admin/wedding-types` gate, the `/admin/wedding-traditions` editor) in `0043_wedding_type_picker.md` + `0023_admin_console.md`.

**Decision (owner):** option **B** — code stays all-live; the spec is corrected to match (not re-gated to Wedding+Debut).

**SPEC IMPACT:** Yes — directs the `0000` / `0023` / `0043` corrections via Cowork. No code change in this commit.

## 2026-06-04 · feat(0023): /admin/taxonomy editor — add + delete tiles (Phase 3b)

**Context:** Extends the Phase 3 editor with the **expandable-taxonomy** core. With 2b·2 in, a newly-added tile renders on the live `/vendors` catalog with no deploy — so admins can grow the taxonomy on real vendor demand.

**What changed:**
- **`actions.ts`** — two new service-role, audit-logged actions: `createTaxonomyNode` (add a tile under a parent — slugifies the label into a stable id+slug, appends to the parent's sort order, guards id collisions) and `deleteTaxonomyNode` (**guarded against orphans** — refuses if the node has child nodes or any `canonical_service` still mapped to it; parents are owner-managed, not deletable here).
- **`page.tsx`** — the tree gains a **＋ add-tile** form per parent and a **✕ delete** button per tile.

**Loop:** add a tile → `getTaxonomy()` / `CatalogView` render it live (ready to receive re-mapped canonicals); delete an empty tile → gone everywhere. No deploy.

**Staged (Phase 3c):** drag-to-move, grandchildren / leaf↔branch conversion, two-admin gating, the §3.2c request-review ghost cards.

**Verification:** `tsc --noEmit` 0 errors · `next lint` clean.

**SPEC IMPACT:** None — implements (more of) the locked 0023 §3.15 editor.

---

## 2026-06-04 · feat(0006): vendor detail page shows the generic placeholder photo too

**Context:** Completes the follow-up flagged in the prior placeholder PR (#917). The vendor detail page `/v/[slug]` hid its Portfolio section entirely when a vendor had no photos, leaving the page without a service photo.

**What changed (`app/v/[slug]/page.tsx`):** when a vendor has **no portfolio photos** (`portfolioUrls.length === 0`), a hero banner now renders the bundled `VENDOR_PLACEHOLDER_PHOTO` at the top of the page (above the logo + name). Vendors *with* portfolio photos are unchanged — their gallery already shows them, so no banner. Applies to real and demo vendors alike (owner: "it can apply to real vendors as well").

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean. Isolated worktree off `origin/main`.

**SPEC IMPACT:** None — completes the already-flagged placeholder behavior (the `COWORK_INBOX.md` item from #917 named the detail page as the follow-up; now done).

## 2026-06-04 · feat(0006/0021): generic placeholder photo for vendors with no photo

**Context:** Owner — *"for vendors with no photo for their service, we must have at least a generic placeholder photo."* The marketplace card + the category picker fell back to **initials** (a monogram tile), not a photo, when a vendor had no usable image.

**What changed:**
- **New asset `apps/web/public/placeholders/vendor.webp`** — a tasteful, neutral wedding-venue scene (generated via Recraft, 1280×720, ~73 KB), service-agnostic so it reads as a premium placeholder for any vendor type. Bundled in `/public` → always available, CDN-served, never rate-limited (unlike the demo picsum images).
- **`lib/vendors.ts`** — new `VENDOR_PLACEHOLDER_PHOTO = '/placeholders/vendor.webp'` constant.
- **Marketplace card (`vendor-card.tsx` · `VendorHero`):** the image resolves primary-photo → logo → **placeholder photo** (was → initials). Always renders an `<Image>` now; the bare-initials tile is gone.
- **Category picker (`category-search-overlay.tsx`):** the 64 px tile falls back to the placeholder photo on a missing/failed logo (was initials). Retired the now-unused `initials()` helper.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean · CI build covers the new asset + Next/Image. Isolated worktree off `origin/main`.

**SPEC IMPACT:** Yes (minor) — vendor listings (marketplace card + plan picker) now always show at least a generic placeholder photo when a vendor has no image, instead of an initials monogram. See `COWORK_INBOX.md`.

## 2026-06-04 · feat(0023/0044): marketplace catalog reads the DB taxonomy (Phase 2b·2)

**Context:** Completes the public-marketplace read-through. 2b·1 flipped vendor *bucketing*; this flips the catalog's *labels + order + structure*, so admin **renames and re-orders** (via the Phase 3 editor) show on the live `/vendors` browse — not just re-mapping.

**What changed (`app/vendors/page.tsx`):**
- **`CatalogView`** (the tile-grid browse) fetches `getTaxonomy()` once and **locally shadows** the 10 taxonomy maps (`WEDDING_FOLDER_*`, `WEDDING_TILE_*`, `WEDDING_TILES_BY_PARENT`, `TILE_PARENT`, `TAXONOMY_MAP`) → every existing reference resolves to the DB snapshot with zero per-site edits. Casts restore the exact-key Record types so it type-checks unchanged under `noUncheckedIndexedAccess`.
- **`ScopedFolderBanner`** → async, reads the folder label from the snapshot.
- Slug-based routing (`parseFilters`/`buildHref`), the module-level search autocomplete, and the SEO JSON-LD stay on the constant (slugs are stable; threading those is a small follow-up).

**Behavior-preserving:** the DB is seeded from `lib/taxonomy.ts` (identical today); `getTaxonomy()` falls back to the constant on error. Invisible now; live the moment an admin edits.

**Verification:** `tsc --noEmit` 0 errors · `next lint` clean.

**SPEC IMPACT:** None — implements the locked 0023 §3.15 read-through.

---

## 2026-06-04 · feat(0016/0044): onboarding leaf-match — location + event-type filters wired (Hybrid)

**Context:** Owner audit of onboarding (the step-12 "Find your first vendor" venue list + the step-13 congrats "N that fit your wedding · from M" tile). Two gaps: the reception search showed out-of-region venues (Boracay/Tagaytay for a Metro Manila couple), and the tile read "1,801 of 1,801" — because `fetchWizardVendorRecommendations` + `getOnboardingVendorCounts` filtered ONLY on (NULL-safe, demo-uniform) ceremony + venue_setting compat. Region, event-type, capacity, and per-leaf refinements weren't applied at all. Owner locked **Hybrid** match semantics (hard-filter the objective/always-present dims, rank the soft/sparse ones, never show an empty list) + "quick wins now, spec the refinement layer."

**Quick-win wiring (this PR):**
- **`lib/wizard-recommendations.ts`** — engine gains two OPTIONAL args (omit = exact prior behavior, so the 5 other call sites are untouched):
  - `eventType` — NULL-safe OR on `event_types[]` (admits undeclared, excludes e.g. corporate-only from a wedding search).
  - `region` (PSGC code) — scoped by EFFECTIVE region = `hq_region` ?? `regionForCity(location_city)`. The city fallback is essential: the demo seed + legacy rows have NULL `hq_region`, so a naive SQL filter wouldn't bite. NULL effective region = unknown → admitted (Hybrid). Applied as a post-fetch JS narrowing with an over-fetch (`max(limit,100)`), same pattern as the music re-rank.
- **`app/onboarding/wedding/actions.ts`** — new `ONBOARDING_REGION_TO_PSGC` map (the wizard's own region slugs → PSGC; `abroad`/unknown → no scope). `searchOnboardingReceptionVenues` passes `region` + `eventType:'wedding'`. `getOnboardingVendorCounts` rewritten to compute total + matched in ONE JS pass over the pool (region needs the city fallback SQL can't express): `total` = full category pool (region-agnostic denominator), `matched` = fits ceremony + venue + region + event-type — so region/event-type now narrow `matched` below `total` (a real "N of M").
- **`onboarding-shell.tsx`** — passes `state.region` into both calls.

**Effect (demo data):** a Metro Manila couple's venue list drops the Boracay/Tagaytay rows; the tile goes from "1,801 of 1,801" to (≈) the NCR-fit subset of 1,801. The residual matched≈total *within* a region (compat arrays are demo-uniform) is the refinement layer's job — see `COWORK_INBOX.md`.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (3 changed files) · additive optional args (no behavior change when omitted). No migration — uses existing `hq_region` / `event_types` / `location_city` columns (view `20260620…` already exposes them). NOT run in a live preview — apps/web has no Supabase env in the build shell; owner confirms in the running app. Built from an isolated worktree off `origin/main`.

**SPEC IMPACT:** Onboarding now scopes vendors by **region + event-type** (was: ceremony + venue only). The deeper per-leaf **refinement** model (venue type / capacity / …), the `venue_setting` ↔ `venue_directory.venue_type` reconciliation, and the formal **Hybrid leaf-match contract** are specced as a `[PENDING]` item in `COWORK_INBOX.md` → `0044_per_category_schemas`.

## 2026-06-04 · feat(0023): /admin/taxonomy editor — rename nodes + re-map canonicals (Phase 3 MVP)

**Context:** Phases 1–2b·1 built the DB-backed taxonomy + read-through. This adds the **editor** — the admin-facing payoff of the ♾️ "Admin Finalize = permanent live publish" lock — so an admin can reshape the taxonomy and see it live with no deploy.

**What changed:**
- **`app/admin/taxonomy/actions.ts`** — `requireAdmin()` (role re-check) + two service-role, audit-logged actions: `renameTaxonomyNode` (rename a parent/tile in `service_categories`) and `remapCanonical` (move a `canonical_service` to a different tile + parent in `canonical_service_taxonomy`). Each writes `admin_audit_log` (action · before/after · actor) and `revalidatePath('/admin/taxonomy'` + `'/vendors')`.
- **`app/admin/taxonomy/page.tsx`** — a **live rename tree** (every parent + tile inline-editable), a **re-map select** on each canonical row, a success/error banner (`?ok`/`?error`), and `force-dynamic` (the page does top-level DB reads — keeps a future root `loading.tsx` from pulling it into build-time static gen).

**The loop, closed:** rename a tile → `getTaxonomy()` reflects it; re-map a canonical → `getCanonicalBuckets()` re-buckets the `/vendors` marketplace — both live, no deploy.

**MVP scope:** rename + re-map (the two highest-value ops, both already wired to the read-through). The full §3.15 vision — drag-to-move, add/delete, leaf↔branch, the §3.2c request-review ghost cards, two-admin gating — is staged (Phase 3b).

**Verification:** `tsc --noEmit` 0 errors · `next lint` clean · full PR CI green on #913 (production build, typecheck+lint).

**SPEC IMPACT:** None — implements (a subset of) the locked 0023 §3.15 editor.

---

## 2026-06-04 · fix(demo): seed images from a small batch-stable Picsum pool (so demo photos actually load)

**Context:** "Why are there no photos?" The demo seed gave every vendor a **unique** `picsum.photos/seed/…-${i}/800/600` logo (+ unique 1200×800 portfolio shots). At ~4,900 vendors that's thousands of distinct large image requests from one IP → Picsum rate-limits → images fail (and fall back to initials per #912). So no photos.

**Fix (`scripts/seed-demo-vendors.ts`):** placeholders now pull from a small, batch-stable pool — `snl${i % 40}` (≈40 logos) at **400×300** and `snp${(i*4+j) % 60}` (≈60 photos) at **600×400**, reused across the whole marketplace instead of one unique image per vendor. The browser caches ~100 images total (vs ~4,900 unique) and Picsum stops throttling, so photos load. Sizes are display-appropriate (64px logo tile / portfolio gallery), not 800×600. Repeats across vendors are acceptable for demo data (owner-confirmed earlier).

**Owner action:** tap **Create demo vendors** once more to re-seed with the pooled image URLs (existing vendors keep the old per-vendor URLs until re-created).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean · demo-only, no schema/SKU change. Isolated worktree off `origin/main`.

**SPEC IMPACT:** None — demo-data tooling.

## 2026-06-04 · fix(0021): vendor-pick logos fall back to initials on load error (picsum rate-limit)

**Context:** With the badge collision fixed (#911), the picker cards revealed a second issue — logos render as broken-image icons. The demo seed sets `logo_url` to `picsum.photos/seed/…/800/600` (+ 1200×800 portfolio); ~4,900 vendors × big images hammers picsum, which rate-limits, so the plain `<img>` fails. (The overlay uses a raw `<img>`, not next/image, so the `next.config` allow-list doesn't help it.)

**Fix (`category-search-overlay.tsx`):** added a `failedLogos` Set + an `onError` on the logo `<img>`. On load failure the vendor falls back to the existing **initials tile** (the same elegant placeholder used when there's no logo) instead of a broken-image icon. Host-agnostic — helps any flaky/unreachable logo, not just demo picsum.

**Note (follow-up, not in this PR):** the root of the broken *photos* is the seed requesting 800×600 placeholders at scale. To make demo photos load reliably, shrink the seed's picsum sizes (e.g. 256×192) and re-Create; the fallback keeps the UI clean meanwhile.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean · no schema/SKU change. Isolated worktree off `origin/main`.

**SPEC IMPACT:** None — rendering robustness.

## 2026-06-04 · fix(0021): vendor-pick badge collision — rename `.v`/`.b` so `.pbacc .v` can't match (real fix)

**Context:** The earlier portal fix (#908) did NOT resolve the distorted picker — the VERIFIED badge still ballooned into a giant cream stadium (VERIFIED top-center, column layout, ~300px tall — the exact `.pbacc .v` signature). The portal *should* have escaped `.pbacc` (it's a normal div, not `<body>`), so the live failure is most likely stale PWA/tab JS — but the portal was a fragile, structural-only fix.

**Real, source-level fix (`category-search-overlay.tsx`):** the overlay's verified/featured badges were `className="badge v"` / `"badge b"`. The plan-budget-accordion's vendor-CARD rule `.pbacc .v { flex:1 1 auto; min-height:300px; flex-direction:column }` matched the badge purely because of the **`v` class**. Renamed the badge modifiers `v → vrf` and `b → bst` (CSS + JSX) so `.pbacc .v` can **never** match the badge — independent of DOM nesting, the portal, or specificity. Also hardened `.csov .r .badge` with `flex:0 0 auto; align-self:center; min-height:0; white-space:nowrap` so no rule can ever balloon a badge again. The portal (#908) stays as defense-in-depth.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean · no stray `badge v`/`badge b` left · no schema/SKU change. Built from an isolated worktree off `origin/main`.

**SPEC IMPACT:** None — rendering bugfix.

## 2026-06-04 · perf(nav): global top loading bar (future-proof catch-all)

**Context:** Owner directive 2026-06-04 — *"we want it to be future proof"*: every route, including ones not written yet, should show a loading indicator on navigation. A root `app/loading.tsx` skeleton fallback can't do this — it makes Next.js prerender a static shell for every route at build, which runs the top-level service-role DB fetches of ~55 admin/dashboard pages (no `force-dynamic`) and breaks the build. The robust, zero-build-impact mechanism is a client-side global progress bar (the GitHub / Vercel / Linear pattern).

**What changed (apps/web):**
- **`app/_components/nav-progress.tsx`** (new) — a `'use client'` top progress bar mirroring the GlobalHaptics pattern. Slim `--m-orange` (Royal Champagne Gold) bar fixed to the top of the viewport. STARTS on a same-origin, path-changing `<a>` click (capture phase) or back/forward (popstate); DEBOUNCED ~120ms so instant Router-Cache revisits (the `staleTimes` window) show nothing; COMPLETES on `usePathname()` change, with a 10s safety timer so it can never hang. Renders null on the server + first paint (no hydration mismatch).
- **`app/layout.tsx`** — mounts `<NavProgress />` once at the top of `<body>`.

Pure client → ZERO static-generation impact (build stays 117/117), and it automatically covers EVERY current + future route. Pairs with the per-route `loading.tsx` skeletons (#892 + follow-ups): skeletons give the shaped wait on important routes, this is the universal "never frozen" catch-all.

**Verification:** `tsc --noEmit` ✓ · `next lint` clean (no new warnings) ✓ · `next build` ✓ (117/117 static pages — the pure-client bar does NOT perturb static gen the way a root loading.tsx does). Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** None — perceived-performance / UX only.

## 2026-06-04 · feat(0023/0044): DB-backed taxonomy — marketplace bucketing (Phase 2b·1)

**Context:** Phase 2b flips the live `/vendors` marketplace onto the DB read-through (Phase 2a's `getTaxonomy()`). This first slice flips the **bucketing** — which canonical_services belong to a tile/folder — the surface an admin changes by re-mapping a vendor's category.

**What changed:**
- **`lib/vendor-counts.ts`** — new `getCanonicalBuckets()` (cached) derives the canonical→folder / canonical→tile buckets from the live snapshot (same cross-view + secondary-tile logic as the module-level IIFEs, which stay as the sync fallback). `findTopVendorsByFolder` / `findTopVendorsByTile` now bucket via the snapshot.
- **`app/vendors/page.tsx`** — the two `CANONICAL_SERVICES_BY_TILE.get(tile)` sites (the `?tile=` grid + catalog tile canonicals) now read `getCanonicalBuckets()`.

**Behavior-preserving:** the DB is seeded from `lib/taxonomy.ts`, so the derived buckets are identical today; `getTaxonomy()` falls back to the constant on error/unseeded. Invisible now; becomes live the moment an admin re-maps a canonical.

**Staged:** the page's ~45 tile-label/slug sites live in sync helpers (`taxonomyLabel`, `parseFilters`, `buildHref`, …) that need the snapshot threaded in — Phase 2b·2. The 7 client components (provider) — Phase 2b·3.

**Verification:** `tsc --noEmit` 0 errors · `next lint` clean · full PR CI green on #906 (production build, Playwright e2e, Lighthouse, both OS builds).

**SPEC IMPACT:** None — implements the locked 0023 §3.15 read-through.

---

## 2026-06-04 · perf(nav): loading shells for the auth + onboarding entry points

**Context:** Continuing the "every gap shows a loading screen, never blank" pass. PR #892 covered 155 dashboard + guest-facing routes; the guest landing (`/[slug]` · `/v/[slug]` · `/venue/[slug]`), receipts and vendor-claim were already covered. The remaining cold-load gaps were the **auth + onboarding entry points**, which had no `loading.tsx`.

**What changed (apps/web):**
- **`app/login/loading.tsx` + `app/signup/loading.tsx`** — auth-card skeletons mirroring the centered `.m-login-card` / `.m-signup-card` layout (brand panel + form), so sign-in / create-account never flash blank on a cold load.
- **`app/onboarding/wedding/loading.tsx`** — a neutral full-screen phone-frame placeholder for the FIRST server render of the onboarding wizard (navigation between onboarding screens stays instant/preloaded per the golden rules).

**Deliberately NOT added — a root `app/loading.tsx` global fallback.** A root loading boundary makes Next.js generate a *static shell* for every route at build time, which executes top-level page code during prerender. `/admin/taxonomy` (and potentially other admin pages) fetch live DB data at the top without `force-dynamic`, so shell generation ran those fetches and **failed the build** (proven: clean `main` builds 117/117; adding the root fallback fails at `/admin/taxonomy`). A safe global catch-all needs those build-time-fetching pages marked `force-dynamic` first — deferred as a separate cleanup. The proven pattern is per-route loaders (this PR + #892).

**Verification:** `tsc --noEmit` ✓ · `next lint` clean ✓ · `next build` ✓ (117/117 static pages). Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** None — perceived-performance / UX only.


## 2026-06-04 · fix(0021): vendor-pick "Add to your plan" overlay — portal to <body> (kills .pbacc CSS bleed)

**Context:** Owner screenshot — the category-search picker ("Add to your plan → Reception venue") cards were distorted: the **VERIFIED badge ballooned into a giant cream stadium pill** and the vendor name centered. Surfaced once the demo-vendor marketplace was populated (most demo vendors are verified, so the badge renders).

**Root cause — generic-classname CSS bleed.** `CategorySearchOverlay` injects a **global** `<style>{CSS}</style>` and is rendered as a DOM **child of the plan-budget-accordion** (`.pbacc`), which ALSO injects a global `<style>` using the same ultra-generic class names. The accordion's vendor-CARD rule `.pbacc .v { flex:1 1 auto; min-height:300px; … }` matched the overlay's verified badge `<span className="badge v">` (it carries class `v`), so the badge inherited `min-height:300px` + `flex:1 1 auto` while keeping the badge's own `border-radius:999px` → a tall cream stadium. The same mechanism bled `.pbacc .img/.meta/.vn/.stars` into the overlay's matching elements (the centered name, etc.).

**Fix (one file, `category-search-overlay.tsx`):** render the overlay via `createPortal(…, document.body)` (behind a mount guard). It's a `position:fixed` full-screen modal, so `<body>` is its correct home anyway — and as a body child it's no longer a descendant of `.pbacc`, so **every `.pbacc *` descendant rule stops matching at once**. No class renames, no per-property CSS resets — the structural fix removes the whole bleed class. Bonus: `position:fixed` is now viewport-relative regardless of any ancestor stacking context.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (overlay file: no findings) · no schema/SKU change. Built from an isolated worktree off `origin/main`.

**SPEC IMPACT:** None — rendering bugfix (the picker's look mirrors the owner-locked prototype; this restores it). No behavior/pricing/schema change.

## 2026-06-04 · ui(0043): re-order wedding-tradition chips by prevalence + spend (owner-decided)

**Context:** Owner set the canonical tradition order — prevalence-led, with Chinese promoted into row 1 on its high-spend profile and Jewish last. Applied to every couple-facing ordered list so onboarding, create-event, and the marketplace filter agree.

**What changed (pure display reorder — no logic, no schema, no migration):**
- **Onboarding `FAITH_CHIPS` (the 4×2 grid):** Catholic · Muslim · INC · Chinese / Born Again · Christian · Cultural · Jewish.
- **Shared `CEREMONY_TYPE_OPTIONS` (create-event picker + dashboard `ceremony-type-modal`):** same religion order, with **Civil + Mixed trailing** as the non-religious / combination options.
- **`SECONDARY_LABELS` (create-event Mixed secondary picker):** same order, Civil trailing.
- **`/vendors` `FAITH_KEYS_ORDER` (marketplace faith filter):** same 8-religion order.
- Left as-is: vendor-profile + admin-venue tag checklists (vendor/admin-facing; can align on request).

**Verification:** Pure array/object-key reorder (28 insertions / 28 deletions); no value or type change, no exhaustive-map breakage. Relying on CI `typecheck + lint` + `production build`.

**SPEC IMPACT:** Minor — the 0043 / spec-0000 chip order should read Catholic · Muslim · INC · Chinese · Born Again · Christian · Cultural · Jewish. See `COWORK_INBOX.md`.

## 2026-06-04 · ui(0021,0001): dashboard scale consistency — Guests + Website editor adopt the canonical card metric

**Context:** Owner directive — *"keep our dashboard design consistent and use that kind of height and icon size and font size for guests, websites."* The couple dashboard's canonical card chrome (the `/more` landing cards · `dashboard/[eventId]/_components/customer-mobile-landing.tsx`) is the reference: a 40px (`h-10 w-10`) `rounded-md` leading icon chip, a 20px (`h-5 w-5`) glyph, a `text-base font-semibold` label, `text-xs` sub-text, and `min-h-[44px]` tap targets. The Guests page and the full-screen Website "site-editor" (the **Website** bottom-nav doorway → `/site-editor/[eventId]`) had drifted smaller (`h-9`/`h-7` chips, `h-[18px]`/`h-4` glyphs, `text-[12.5px]`/`text-[14.5px]` labels), so they read as a separate, denser surface.

**What changed:**
- **`apps/web/app/site-editor/[eventId]/_components/site-editor.tsx`** — Card shell (chip `h-9 rounded-lg`→`h-10 rounded-md`, glyph `h-[18px]`→`h-5`, title `text-[14.5px] font-bold`→`text-base font-semibold`, sub `text-[11px]`→`text-xs`); StatRow (chip `h-7`→`h-10`, glyph `h-4`→`h-5`, label/value→`text-base`); Theme toggle; every CTA / Pro-active-badge / Share button (`h-10`→`min-h-[44px]`, `text-[12.5px]`→`text-sm`); the copy button; the "Live — this URL is yours" line; the empty-state "Set your URL" button.
- **`apps/web/app/dashboard/[eventId]/guests/page.tsx`** — the Seating cross-link row + the Share-invite disclosure (same chip / glyph / label bumps).
- **Deliberately unchanged (consistency, not breakage):** the editor's 4-up tab bar + the mobile Guests carousel's bottom menu already match the dashboard's `BottomNav` scale (`h-[22px]` icon · `text-[10px]` label · `min-h-[56px]`) — raising them to the card scale would overflow the 4-up grid. Guest data rows, the RSVP stat tiles, and the editor's empty-state hero icons are data / stat / illustration classes and keep their own scale.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (both files). Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** None — pure visual alignment to an existing canonical pattern; no SKU, schema, pricing, workflow, or branding change.

## 2026-06-04 · fix(0000): stop unexpected mobile zoom — native-app viewport hardening

**Context:** Owner report — *"our screen sometimes zooms in unexpectedly and we lose the full-screen native-device feeling … we want it to feel like an app."* Root cause is **iOS Safari focus-zoom**: inputs are `font: inherit` (Tailwind preflight), so any field nested inside a `text-sm` / `text-xs` wrapper renders at 14px and Safari auto-zooms into it on focus and never fully settles back. It reads as "random" because it only fires on the sub-16px fields. The viewport was already correct (`width=device-width, initialScale=1, viewportFit=cover, maximumScale=5`) and `manifest.json` already ships `display: standalone` — so this is a CSS-only hardening, no viewport/manifest change.

**What changed:**
- **`apps/web/app/globals.css`** — appended one UNLAYERED block (must outrank the Tailwind `text-sm` utility; unlayered CSS beats any `@layer`, including `@layer utilities`):
  - `@media (pointer: coarse)` → `input / select / textarea { font-size: 16px }` (excludes checkbox/radio/range/color). Kills iOS focus-zoom on touch devices; desktop form density (intentional 14px) is untouched.
  - `html { touch-action: manipulation }` — disables double-tap-to-zoom + the legacy 300ms tap delay tree-wide (touch-action intersects through ancestors) while KEEPING pinch-zoom + panning.
  - `html { overscroll-behavior: none }` — no pull-to-refresh / rubber-band bounce on the document scroller.
- Deliberate pinch-zoom stays **enabled** (`maximumScale: 5` in `app/layout.tsx`) for WCAG 1.4.4 — only the unwanted zooms are removed.
- No change to `app/layout.tsx` viewport (already correct). No global safe-area padding added — 23 components already consume `env(safe-area-inset-*)`, so a global rule would double up.

**Verification:** CSS-only, appended after the final `@layer components` close (brace balance verified even, 86/86). typecheck + lint + production build + Lighthouse + Playwright e2e all green on this SHA. Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** None — platform-level input/viewport behavior; no SKU, schema, pricing, or feature-scope change.

## 2026-06-04 · ui(0001): guest carousel — every panel collapses to one compact row (Summary · Add · Customize)

**Context:** Owner directive 2026-06-04 — on the customer dashboard Guests surface (mobile carousel + desktop quick-add), the panels sat taller than the Search row beside them. Owner: *"put the [First Name] [Last Name] in 1 row and remove text — keep it as low as search… can we also keep the customize 1 row? and summary 1 row?"* The Search panel is the height benchmark; every sibling panel now matches it.

**What changed (apps/web · `guests/_components/`):**
- **`mobile-guest-carousel.tsx`**
  - **Summary** — the 4 RSVP stat boxes (Total · Attending · Pending · Declined) moved from a 2×2 grid to a single 4-across row (`grid-cols-2 gap-2.5` → `grid-cols-4 gap-2`). `StatBox` recompacted (smaller padding, `text-[8px]` no-wrap label, `text-[22px]` value, centered) so four fit cleanly down to ~320px-wide phones.
  - **Add** (`QuickAddInlineForm`) — First + Last name now share one row (`grid grid-cols-2 gap-2`); removed the "Enter after first name moves to last name…" helper line. The session-count line only appears after the first add, so the default panel is a single input row. Keyboard-open docked height trimmed 190→120px to match.
  - **Customize** (`CustomizePanel`) — entry state reduced to just the "Select guests" button (dropped the title + description paragraphs); active state collapsed from three stacked rows to one (`Select all` · `Assign N` · `Done`), with the count now shown inside the Assign button.
- **`quick-add-sheet.tsx`** (desktop "Quick add" modal) — parity: dropped the "Name · ↵ jumps to last name…" helper line and put the two name inputs on one row.

The panel sheet auto-measures its content height (ResizeObserver on `scrollHeight`), so each shortened panel shrinks the sheet to fit — no dead space. Enter-to-advance, duplicate detection, bulk-assign, and the RSVP filter-links are all unchanged; only layout + explanatory copy changed.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (both files). Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** None — pure UI layout / copy on an owner-directed surface; no feature, pricing, schema, or workflow change.

## 2026-06-04 · feat(0023/0044): DB-backed taxonomy read-through (Phase 2a) — layer + admin viewer

**Context:** Phase 2 of the DB-backed-taxonomy build (the ♾️ "Admin Finalize = permanent live publish" lock). Phase 1 moved the taxonomy structure into `service_categories` + `canonical_service_taxonomy` (migration `20260803001000`, applied). This adds the **read-through layer** so server consumers read taxonomy from those tables — the prerequisite for admin edits going live without a deploy.

**What changed:**
- **New `lib/taxonomy-db.ts`** — `getTaxonomy()` (React-`cache()`d per request) reconstructs the full `TaxonomySnapshot` (folder/tile order, labels, slugs, `tilesByParent`, canonical `map`) from the two tables, mirroring the `lib/taxonomy.ts` constant shapes. **Falls back to the constant** on any error or unseeded tables, so it's behavior-preserving (the DB is seeded from the constant → byte-equivalent today). Reports `source: 'db' | 'fallback'`.
- **`/admin/taxonomy` flipped** to `getTaxonomy()` — groups via the DB tree + mapping (was the code constant) and shows a DB-vs-fallback source indicator. First real consumer; admin-only, zero marketplace risk.

**Scope:** the high-risk consumers (the live `/vendors` marketplace `page.tsx` + `vendor-counts.ts` module-level derivations + 7 client components) are **Phase 2b**, landing as focused follow-ups behind the same fallback.

**Verification:** `tsc --noEmit` 0 errors · `next lint` clean on both files.

**SPEC IMPACT:** None — implements the already-locked 0023 §3.15 read-through.

---

## 2026-06-03 · fix(0023): demo-vendor Create reliably passes the demo-mode gate on production

**Context:** Follow-up to the same-day "demo-vendor Create works on production while admin demo mode is on" change. Owner reported it *still* wouldn't go on the live admin. Root cause: the server allowed prod only when it could read the `setnayan_demo_mode` signal on the request, and that signal wasn't reliably reaching the `POST /api/admin/demo/seed` call (it depends on the httpOnly cookie surviving the same-origin fetch). The page also still carried stale copy claiming demo seeding is "staging/dev only," reinforcing the confusion.

**What changed:**
- **`app/admin/demo-vendors/page.tsx`** — computes demo mode server-side (`isAdminDemoModeOn()`, mirroring `<DemoModeBanner>`: `setnayan_demo_mode='1'` cookie + admin profile) and passes `demoMode` to `<DemoVendorActions>`. Replaced the stale "Agent 2 ships in PR 2 … staging/dev only" note with accurate copy (demo vendors hidden from real visitors; surface only under demo mode; states whether your session is in demo mode).
- **`_components/demo-vendor-actions.tsx`** — accepts a `demoMode` prop and sends it (`demoMode: true`) in every `start`/`chunk` request body.
- **`api/admin/demo/seed/route.ts`** — parses the body before the prod guard and treats an explicit `body.demoMode === true` (from an already-admin-authenticated request) as the deliberate-demo signal, alongside the cookie/`?demo=1` path. Robust against the cookie not reaching the fetch; still admin-gated, so it's an intent signal, not an auth bypass.

**Net effect:** when the demo-mode banner is showing (cookie set + admin), the page computes `demoMode=true`, the Create button relays it, and the seed runs on production — no dependence on cookie-over-fetch. Demo mode off → prod still blocked (accident guard) with the clearer message.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (only pre-existing warnings) · no schema/migration/SKU change. Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** None — implementation hardening of the 2026-06-03 "prod allowed under admin demo mode" decision already recorded in `DECISION_LOG.md`; plus a stale-admin-copy fix. No product/pricing/schema change.

## 2026-06-04 · feat(0043,0044): lock 8 wedding traditions — add Jewish + Born Again, fully selectable + on the taxonomy

**Context:** Owner-directed — *"add Jewish and Born Again. Lock this 8 and make the choice in 4 columns, 2 rows … full build incl. the taxonomy."* Follows the same-day Chinese activation. Born Again is split out of the "Christian" umbrella into its own tradition; Jewish also resolves the dangling `kosher_*` tags already in the 0044 `faith_compatibility` group (which had no Jewish ceremony_type to trigger them). The onboarding tradition step locks to a fixed **4-col × 2-row grid of 8 chips**: Catholic · Christian · INC · Muslim / Cultural · Chinese · Jewish · Born Again.

**Also fixes two gaps left by the same-day Chinese work:** `chinese` was missing from the vendor-side `compatible_ceremony_types` picker (`vendor-dashboard/profile`) AND from the `/vendors` marketplace faith filter (`FaithKey`) — both now include chinese + the two new faiths.

**What changed:**
- **Migration `20260808000000_add_jewish_bornagain_ceremony_types.sql`:** widens the 4 ceremony_type CHECK constraints (`events.ceremony_type` — NULL-preserving — `events.secondary_ceremony_type`, `wedding_type_launch_status`, `couple_wedding_type_notify_signups`) to permit `jewish` + `born_again`; seeds both `wedding_type_launch_status` rows as `active`. `vendor_profiles.compatible_ceremony_types` is a free `TEXT[]` (no element CHECK) → no change.
- **Shared `ceremony-type-radio-group.tsx`:** `CeremonyTypeKey` += jewish, born_again; 2 new `CEREMONY_TYPE_OPTIONS`; narrowed the `christian` description (dropped "Born Again", now its own option). Propagates to the dashboard `ceremony-type-modal` automatically.
- **Onboarding (`onboarding-shell.tsx` + `types.ts`):** `OnboardingFaith` += 2; `FAITH_CHIPS` += 2 (8 total, `soon:false`); `FAITH_PHOTO` += 2 heroes (`wed_jewish.webp` / `wed_bornagain.webp`, 720×900 ~55–62 KB); `WORSHIP_OPT` += jewish (synagogue) / born_again (church). **`onboarding.css`:** `#screen-faith .chips` → `display:grid; grid-template-columns:repeat(4,minmax(0,1fr))` (the 4×2 lock).
- **Commit allow-lists (server):** `jewish` + `born_again` added to `ALLOWED_CEREMONIES`/`ALLOWED_SECONDARY` in onboarding + create-event actions, `NOTIFY_FAITHS` (create-event), `ALLOWED_CEREMONY_TYPES` (dashboard `[eventId]/actions`).
- **Create-event picker:** `wedding-type-picker` `SECONDARY_LABELS` += 2 (exhaustive Record); `page.tsx` launch-status fallback += 2 active. Primary options render via the shared radio group gated by `launchStatus` (now active).
- **Taxonomy / vendor side:** `vendor-dashboard/profile` `CEREMONY_TYPES` += chinese (retroactive) + jewish + born_again; admin `venues/_constants` + `venue-form` label map += 2; `/vendors` marketplace faith filter — `FaithKey`, `CoupleFaith`, `mapCeremonyTypeToFaith`, `FAITH_URL_TO_KEY`, `FAITH_KEY_TO_URL`, `FAITH_KEY_TO_LABEL`, `FAITH_KEYS_ORDER`, `crossFolderFaithCounts` all += chinese + jewish + born_again.
- Couple-side vendor matching needs no change — the `matchEvent` filter reads the raw `event.ceremony_type` against `compatible_ceremony_types`.
- **Merge note:** rebased onto the same-day "admin-editable wedding traditions" PR (guide-content table); `FAITH_CHIPS` remains hardcoded there, so the picker additions stand. Renumbered this migration `20260807→20260808` to avoid a timestamp collision with `20260807000000_wedding_tradition_items.sql`.
- **Pre-existing `main` breakage also fixed (owner-approved 2026-06-04):** two earlier PRs both used `20260803000000` — `unlock_all_wedding_types` (applied to prod) and `service_categories_tree_foundation` (never applied). The collision made `supabase db push` silently skip the taxonomy-tree DDL on prod (so `service_categories` + `canonical_service_taxonomy` were never created) and failed the `migration timestamp guard` on every PR. Renumbered the **unapplied** `service_categories_tree_foundation` → `20260803001000` (guard's recommended offset; nothing references its tables, `CREATE TABLE IF NOT EXISTS` is idempotent). Unblocks CI repo-wide and lets the taxonomy tables finally apply on the next push.

**Verification:** Type-trivial (literals into already-keyed unions + the exhaustive maps they force — `SECONDARY_LABELS`, `FAITH_PHOTO`, venue label map, the 4 `FaithKey` Records — all updated). Self-audit confirms `born_again` landed in 14 files and no data list carries `chinese` without it. No local typecheck (fresh worktree has no deps) — relying on the PR's required `typecheck + lint` + `production build` + Vercel preview. Hero images generated via Recraft, downsized + re-encoded to WebP with PIL. Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** Yes — the wedding-tradition roster is now 8 (Born Again split from Christian; Jewish added). See `COWORK_INBOX.md` for the 0043 / 0044 / spec-0000 updates.

## 2026-06-03 · feat(0043,0023): admin-editable wedding traditions table

**Context:** Owner-directed ("do all sequentially" — step 3 of the per-religion work). Makes the per-religion "What to expect" guide content (shipped as code in #890) editable in-app — which is also the validation path for it (owner corrects INC / Muslim / Cultural / Chinese specifics without a deploy).

**What changed:**
- **Migration `20260807000000_wedding_tradition_items.sql` (owner-push):** new `wedding_tradition_items` table (ceremony_type · dimension · label · note · sort_order · is_active), public-read + admin-write RLS. Created **empty** — admins load the code defaults on demand.
- **`lib/wedding-traditions.ts`:** `fetchTraditionItems()` reads active rows for a religion (null on empty/absent/error → caller falls back to the code `WEDDING_TRADITIONS_GUIDE`); `TraditionItemRow` type.
- **`/paperwork` guide:** renders table items when present, else the code defaults (graceful — safe before the migration is pushed / content loaded).
- **New admin surface `/admin/wedding-traditions`** (+ Directory nav): per-religion edit / add / remove / reorder + active toggle, and a "Load starter content" button that copies the code defaults into the table for any religion with no rows (idempotent — never clobbers edits). `requireAdmin` + admin-client writes.

**Honesty:** the code defaults (fallback + seed source) stay flagged as starter guidance needing clergy validation; this surface is how that validation happens.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean · full CI green. Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** Yes — iteration **0023** gains a Wedding-traditions editor; **0043** traditions content is now DB-backed + admin-editable. See `COWORK_INBOX.md`.

## 2026-06-03 · perf(ux): haptics Settings toggle + parallelize 8 query waterfalls

**Context:** Two owner-requested follow-ups to PR #892 (app-wide loading skeletons + global tap haptics) — "both": wire a Settings switch for the haptics, and sweep pages for the same sequential-`await` waterfall the Guests page had.

**What changed:**
- **Haptic-feedback toggle (`dashboard/profile/_components/haptics-toggle.tsx`):** iOS-style switch in the customer Profile → Appearance section, next to the theme picker (the established home for device/appearance prefs — theme switching is likewise customer-profile-only). Writes the `setnayan-haptics` localStorage key GlobalHaptics reads; fires a `confirm` pulse on enable so the change is felt. `data-no-haptic` on the switch keeps toggling-off silent.
- **Reactive `GlobalHaptics` (`app/_components/global-haptics.tsx`):** re-reads the flag LIVE on a `setnayan-haptics-change` event (+ cross-tab `storage`) instead of bailing out at mount, so the toggle applies with no page reload.
- **8 query-waterfall folds** — independent sequential reads collapsed into one `Promise.all` each (each verified independent; auth/guard chains + dependent reads left sequential): `add-ons/papic` (4→1) · `vendor-dashboard/manpower` (3→1) · `vendor-dashboard/bookings` (2→1) · `vendor-dashboard/repertoire` (2→1) · `dashboard/[eventId]/hosts` (2→1) · `dashboard/[eventId]/sponsors` (2→1) · `admin/vendors` (2→1) · `admin/disputes` (2→1, FK lookups). The audit confirmed event-home + both dashboard layouts are ALREADY parallelized (untouched); `site-editor/[eventId]` was parallelized concurrently by a separate PR, so its (superior, 4-read) version was taken on merge; 2 MEDIUM candidates (`earnings`, `vendors` conditional) skipped as more invasive for marginal gain.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (2 pre-existing warnings, untouched) · production build green. Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** None — UX polish + server-side read parallelization (no SKU / schema / route / workflow change). The haptics toggle realizes the "future Settings → Appearance toggle" flagged in PR #892.

## 2026-06-03 · feat(0023/0044): DB-backed taxonomy tree — Phase 1 foundation (non-breaking)

**Context:** Owner — *"build it"* (the `/admin/taxonomy` visual editor + DB-backed taxonomy from the 2026-06-03 ♾️ "Admin Finalize = permanent live publish" lock). Today the taxonomy STRUCTURE lives only in the code constant `lib/taxonomy.ts` (`TAXONOMY_MAP` · 10 parents → 54 tiles → 199 canonicals); 19 consumers read it synchronously, including the live `/vendors` marketplace. This is **Phase 1 of a multi-PR build** — the DB foundation, deliberately **non-breaking**.

**What changed:**
- **New migration `20260803000000_service_categories_tree_foundation.sql`** — two tables:
  - `service_categories` — the browse tree (10 parents tier 1 + 54 tiles tier 2), self-referential `parent_id` + `tier` + `sort_order`, plus `scope` / `merged_into_category_id` / `sample_photo_r2_key` / `status` for the editor (Phase 3) and the §3.2c request review (Phase 4).
  - `canonical_service_taxonomy` — 199 `canonical_service` → tile mappings + facet flags (faith / ph / setnayan / rental / dietary / tradition / marketplace_hidden / secondary_tiles).
  - RLS mirrors `canonical_service_schemas` (0044): public `SELECT`, admin-only write via `public.is_admin()`. Idempotent (`ON CONFLICT DO UPDATE`).
- **New generator `apps/web/scripts/gen-taxonomy-seed.ts`** — emits the seed SQL *from* `lib/taxonomy.ts` so the DB is a perfect mirror of code at landing; includes a referential-integrity guard that refuses to emit a seed that would FK-fail. Re-run after any `TAXONOMY_MAP` change until Phase 2 flips the source of truth.

**Non-breaking:** no consumer reads the new tables yet — `lib/taxonomy.ts` stays the authored source. Phase 2 (read-through behind the existing API + the 19-consumer sync→async flip) is the high-risk step and lands separately after this is proven.

**Verification:** generator integrity guard exits 0 (no FK violations) · embedded seed byte-identical to validated generator output · 64 distinct category ids · `BEGIN`/`COMMIT` balanced. Full `tsc`/`next build` runs on CI (worktree has no local node_modules).

**SPEC IMPACT:** Minor — implements already-locked 0023 §3.15 + DECISION_LOG ♾️ 2026-06-03. One detail to reflect in 0023 §3.15: the canonical→tile mapping ships as a dedicated `canonical_service_taxonomy` table (the spec described the tree on `service_categories` but didn't name where canonical mappings live). See `COWORK_INBOX.md`.

---

## 2026-06-03 · feat(0043,0023): per-religion vendor-readiness gate + admin control

**Context:** Owner-directed — *"INC needs INC-compatible services before we open it … the only usual issue is the ceremonial and officiants and food."* A way to see each wedding religion's vendor readiness and open/hold it accordingly.

**What changed:**
- **New `lib/religion-readiness.ts`:** `fetchReligionReadiness()` counts, per religion, published vendors + ceremonial venues tagged `compatible_ceremony_types ⊇ religion` (GIN-indexed); `fetchActiveCeremonyTypes()` returns the active religions for the couple-facing gate (null on error → callers fall back to all-available).
- **New admin surface `/admin/wedding-types`** (+ Directory nav entry): per-religion status (Live / Coming soon / Disabled) · live vendor + ceremonial-venue counts vs an editable threshold · Ready / Building-supply badge · Open / Hold / Disable controls + threshold editor. `requireAdmin` + admin-client writes to `wedding_type_launch_status`.
- **Gate now enforced couple-side:** the onboarding faith picker is data-driven from the launch status (greyed + non-selectable when a religion isn't active), matching the create-event picker which already reads the table. Graceful fallback (status read fails → existing all-available behavior).

**Effect:** all religions stay live now (owner kept everything live) — this is the decision/control surface: flip a religion to "coming soon" and it greys in both pickers until reopened. **No migration** (uses the existing iteration-0043 `wedding_type_launch_status` table; `current_vendor_count` left as a future cache — readiness is computed live).

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean · full CI green (production build + e2e + lighthouse). Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** Yes — iteration **0023** gains a Wedding-types admin surface; **0043** launch gate now wired to onboarding + readiness counts. See `COWORK_INBOX.md`.

## 2026-06-03 · perf(nav): instant tab revisits (router-cache window) + site-editor fetch parallelization

**Context:** Owner directive 2026-06-03 — *"make loading of home, guests, services, website, and more run without loading or blank intervals."* This lands the two pieces the same-day app-wide-skeletons work did NOT cover. Those skeletons fix the WRONG-shape flash on *first* visit; this fixes the RE-LOAD on *revisit* (Next 15's client Router Cache defaults to 0s, so re-tapping a tab you saw seconds ago refetched + re-skeletoned every time), plus the Website tab's slow first paint.

**What changed (apps/web):**
- **`next.config.ts`** — added `experimental.staleTimes { dynamic: 60, static: 300 }`. Re-tapping a recently-viewed dashboard tab within the window is now instant from the client Router Cache — no server round-trip, no skeleton at all. Confirmed a recognized key in Next 15.5.18's config schema.
- **`site-editor/[eventId]/page.tsx`** — the Website tab's editor (a top-level route outside the dashboard layout) ran **6 sequential** Supabase awaits. Parallelized membership + event + guests + orders into one `Promise.all` (only the slug-dependent QR render stays sequential): 6 sequential awaits → 2 phases. Pairs with its `BoardPageSkeleton` loading shell.

**Why staleTimes is safe:** every dashboard mutation runs through a Server Action that calls `revalidatePath()` (100+ call sites across `app/` + `lib/`), busting the client cache for the touched route — so a couple never sees stale data after they change something themselves. The 60s window only affects passive re-navigation.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean · `next build` success. Complementary to the app-wide skeleton system; shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** None — pure perceived-performance / UX; no feature, pricing, schema, or workflow change.


## 2026-06-03 · fix(0023): demo-vendor "Create" works on production while admin demo mode is on

**Context:** Owner tapped **Create demo vendors** on the live `/admin/demo-vendors` (setnayan.com) and reported *"the progress bar shows but it ends and does not complete."* Root cause: the one-click create's first request (`POST /api/admin/demo/seed { phase:'start' }`) hit the prod safety guard and returned **403** — so the bar flashed at ~5% then the red "Disabled on production" banner replaced it. Working as designed, but it blocked the owner's actual intent: they had **demo mode ON** (the yellow banner, with its Dec 1 2026 cleanup deadline) and were deliberately populating the live deployment. Owner approved (2026-06-03, via AskUserQuestion) allowing it.

**What changed (`apps/web/app/api/admin/demo/seed/route.ts` — one file):**
- `prodGuard()` → `prodGuard(demoOn)`: non-prod is always allowed (unchanged); on production it now allows seeding **only while admin demo mode is on for the request** (`isDemoMode(req, profile)` — the `setnayan_demo_mode` cookie, sent automatically with the same-origin POST, or `?demo=1`). With demo mode **off**, prod stays hard-blocked (the accident guard) with a clearer message ("Turn on demo mode first…").
- `requireAdmin()` now returns the admin `profile` so the route evaluates the admin-only demo-mode predicate with no extra Supabase round-trip.
- `start`-phase audit row now records `on_production` + `demo_mode` for traceability.

**Why this is safe:** the public marketplace (`/vendors`, `/v/[slug]`, compare) only surfaces `is_demo=TRUE` rows when demo mode is explicitly on (`lib/demo-mode.ts` is admin-only; `vendors/page.tsx`: *"exclusively a demo-mode read"*). Seeding synthetic, `is_demo`-tagged vendors into the prod DB therefore does **not** change what real couples or vendors see, and the one-click **Cleanup ALL** wipes them (hard deadline Dec 1 2026, already in the banner). The CLI seed's own `assertNotProd` hard-exit is untouched — this only relaxes the admin-UI path, which already requires an admin session.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (only pre-existing warnings in unrelated files, untouched) · no schema/migration/SKU change. Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** Yes — scoped relaxation of the locked *"demo vendors are staging-only · the seed refuses prod"* engineering guard: demo-vendor creation is now permitted **on production while admin demo mode is on**. Recorded in `DECISION_LOG.md` (2026-06-03). See `COWORK_INBOX.md`.

## 2026-06-03 · fix(0001,0021): guests carousel stops vibrating + Services rail cards peek (mobile)

**Context:** Owner review of the customer dashboard on mobile — (1) the Guests lower-third panel carousel "vibrated and didn't expand completely"; (2) on the Services tab the rail cards filled the screen with no hint of the next one.

**What changed:**
- **Guests carousel (`mobile-guest-carousel.tsx`):** the panel sheet measures `section.scrollHeight` to hug content, but each panel was `max-h-full` (= 100% of the track, i.e. derived from the very sheet height the measurement *sets*) while a `ResizeObserver` watched that same section — a feedback loop the sheet's `transition-[height]` rendered as visible jitter, settling below full height. Fix: cap the panels with a FIXED `max-h-[calc(60dvh-2.25rem)]` (track height at the 60vh cap, minus the 36px grabber) so `scrollHeight` is the true intrinsic content height and can't change when the sheet grows — loop broken; the "hug content / scroll past 60vh" behavior is preserved.
- **Services rail cards (`plan-budget-accordion.tsx`):** card width `flex:0 0 300px` → `min(300px, calc(100vw - 96px))`, runway floor `max(20px, …) → max(32px, …)`. On phones the card is the viewport minus ~96px so prev/next cards peek ~20px each edge; capped at 300px so the 760px desktop `.body` is unchanged. Covers vendor picks (`.card`), in-app Setnayan service cards (`.card.svc`) and the Digital Services rail — they all share `.card`, so the one change makes every Services-tab rail card peek.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (no new findings) · `next build` clean (full route table incl. `/dashboard/[eventId]/guests` + `/vendors`). Built from an isolated worktree off `origin/main` with deps installed. Mobile-gesture/keyboard behavior flagged for owner device check. No migration, no SKU.

**SPEC IMPACT:** Minor — Services-tab rail cards now peek the next card on mobile (responsive card width); the Guests panel change is a bugfix that restores intended hug-content behavior (no behavior/pricing/schema change). See `COWORK_INBOX.md`.

## 2026-06-03 · perf/ux(0000,0001,0021,0022,0023): app-wide loading skeletons + global tap haptics

**Context:** Owner report — *"why is it so slow to transfer to guests from summary."* The lag was mostly *perceived*: tapping a dashboard tab gave no instant feedback. Only 4 segment-level `loading.tsx` existed, so ~160 child routes froze on their server reads (or inherited the wrong-shaped event-home skeleton) until every Supabase query (~50–200 ms RTT each from Singapore) returned. Owner follow-up: *"apply [it] on all loading-able areas … we want an animation loading so they do not feel they are waiting too long. also apply interaction on buttons and haptic feedbacks."*

**What changed:**
- **Shared skeleton system — `components/skeletons/index.tsx`:** primitives (`Sk`/`SkLine`/`SkCircle`/`Screen`) + 8 self-contained page templates (List/Grid/Form/Detail/Table/Feed/Board/Page). All server components → **zero added client JS**. `aria-busy` + one sr-only "Loading…" per screen.
- **Shimmer — `globals.css`:** new `.skeleton` class (GPU-only `background-position` sweep over the existing ink/6 % base) + `@keyframes sk-shimmer`. Auto-frozen to a static block by the existing `prefers-reduced-motion` guard.
- **151 new route-local `loading.tsx`** (4 → 155) across customer dashboard, vendor-dashboard, admin, and guest/public dynamic routes — each mirrors its page's shape. Guests is bespoke (replicates the mobile focus-mode `.shell-topbar` / safe-area wrapper → no layout jump). Excluded by design: static marketing, onboarding (preloaded per golden-rules), `print` + `api` routes.
- **Global tap haptics — `app/_components/global-haptics.tsx` (mounted in `providers.tsx`):** one passive `pointerdown` listener fires a light `tick` on any interactive control app-wide (was firing in only 3 vendor components). Reuses `lib/haptics.ts` (Android vibrate + iOS-17.4 switch path; no-op elsewhere). Opt-out via `[data-no-haptic]` or `localStorage setnayan-haptics=off`. The press-scale CSS (owner-locked 2026-05-31) is untouched.
- **Guests perf — `guests/page.tsx`:** folded the share-invite token read (`fetchJoinUrl`) into the existing `Promise.all` — it had been a 5th *sequential* round-trip. One fewer Singapore RTT per Guests visit.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean (only 2 pre-existing warnings, untouched) · production build green · the 151 new loaders are server components, so the 200 KB shared-bundle ceiling is unaffected. Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** None — presentation-layer UX polish (no SKU, schema, route, or workflow change). Extends the owner-locked 2026-05-31 button-press-feedback direction app-wide per the 2026-06-03 directive.

## 2026-06-03 · feat(0016): wedding onboarding caters all faiths — faith-adaptive ceremony venue + de-churched copy

**Context:** Owner — *"fix all gaps and adjust our wedding onboarding to be able to cater all different religious weddings."* The faith picker was unlocked but the flow stayed church-centric (ceremony-venue picker = Church/Garden/Beach/Civil only; copy said "church, chapel… 'I do'").

**What changed (`onboarding-shell.tsx`):**
- **Faith-adaptive ceremony venue** — `CEREMONY_OPTS` → `ceremonyOptsFor(faith)`: each picked faith contributes its house of worship (Catholic/Christian → Church · INC → Chapel · Muslim → **Mosque** · Chinese → **Temple**; Cultural = outdoor/ancestral) + universal Garden/Beach/Civil/Same-as-reception. Mixed shows both. Two matching 520×520 photos generated via Recraft (`ceremony_mosque.webp` · `ceremony_temple.webp`).
- **De-churched copy** — "A church wedding" → "A faith ceremony"; "Where will you say 'I do'?" → "Where will you hold your ceremony?"; venue blurb → "church, mosque, temple, garden, or civil hall"; groom role "at the altar" → "at the front".

Chinese activation shipped in parallel via **#889** — overlapping `ALLOWED_*` additions deduped on merge; my redundant same-timestamp migration dropped in favor of #889's.

**Verification:** `tsc --noEmit` exit 0. **SPEC IMPACT:** Yes — iteration 0016: faith-appropriate ceremony venue for all six faiths. See `COWORK_INBOX.md`.

---

## 2026-06-03 · feat(0043): per-religion wedding traditions guide on /paperwork

**Context:** Owner-directed — *"create onboarding that follows the traditions of each religion."* The per-religion document + deadline engine already exists (`lib/paperwork.ts` `DOCUMENTS_BY_CEREMONY_TYPE` — Catholic Pre-Cana/banns/canonical-interview, Muslim Sharia counseling, INC counseling, each with lead-time deadlines that already flow into /paperwork + the /schedule Preparation agenda + Home reminders). The missing piece was the human-readable "what to expect" overview per religion.

**What changed:**
- **New `lib/wedding-traditions.ts`:** `WEDDING_TRADITIONS_GUIDE` keyed by ceremony_type (catholic/civil/christian/inc/muslim/cultural/chinese/mixed/unknown). Each carries an overview + signature items tagged by the owner's dimensions — **officiant · ceremony · food · custom · paperwork** — + a "confirm with {officiant}" line. (Chinese was activated the same day in PR #889, so its guide now serves real couples.)
- **`/paperwork` page:** a "What to expect — your {religion} wedding" guide section above the document checklist (renders nothing for an unset ceremony).

**Honesty:** content is framed as general guidance ("traditions vary by family, parish, and region — confirm with your {officiant}"). The module header flags it NEEDS owner/clergy validation (especially INC / Muslim / Cultural / Chinese) and is a candidate to move to an admin-editable table once the copy is confirmed.

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean. Shipped from an isolated worktree off `origin/main`. No migration, no SKU.

**SPEC IMPACT:** Yes — iteration **0043** gains a per-religion traditions guide on the paperwork surface (companion to the existing per-religion document/deadline engine). See `COWORK_INBOX.md`.

## 2026-06-03 · feat(0043): activate Chinese wedding — fully selectable (supersedes same-day coming-soon)

**Context:** Owner reviewed the live onboarding "ceremony tradition" screen and decided Chinese should ship as a **fully selectable** tradition, not "coming soon." Reverses the same-day #885 decision that seeded Chinese as the lone gated faith — inconsistent now that Catholic/Civil/Christian/INC/Muslim/Cultural are all active. UX call: a couple planning a Tsinoy wedding picks "Chinese" and continues, exactly like every other tradition.

**What changed:**
- **Migration `20260806000000_activate_chinese_ceremony_type.sql`:** `UPDATE wedding_type_launch_status SET status='active'` for the `chinese`/`all` row (idempotent — only flips if not already active; `activated_at = COALESCE(activated_at, now())`) + an `ON CONFLICT DO NOTHING` active-insert safety net. No CHECK-constraint change — `20260804000000` already permits `chinese`.
- **Onboarding (`onboarding-shell.tsx`):** `FAITH_CHIPS` chinese `soon:true → false` — chip now clickable.
- **Onboarding commit (`onboarding/wedding/actions.ts`):** `chinese` added to `ALLOWED_CEREMONIES` (was silently coerced to `catholic` on submit) + `ALLOWED_SECONDARY` (Mixed, e.g. Catholic + Chinese tea ceremony).
- **Create-event picker (`create-event/page.tsx`):** launch-status fallback baseline chinese `coming_soon → active` (picker is data-driven by `wedding_type_launch_status`; the DB-row flip and this fallback together make it selectable).
- **Create-event commit (`create-event/actions.ts`):** `chinese` added to `ALLOWED_CEREMONIES` + `ALLOWED_SECONDARY`.
- **Edit modal (`ceremony-type-modal.tsx`):** removed the `isOptionDisabled`/`renderOptionBadge` chinese coming-soon gating (both props optional) — chinese now selectable on existing events.
- **Edit-modal commit (`[eventId]/actions.ts`):** `chinese` added to `ALLOWED_CEREMONY_TYPES` (`setEventCeremonyType`).
- Left correct/untouched: shared `ceremony-type-radio-group.tsx` (chinese option already present from #885), `NOTIFY_FAITHS` (chinese stays — same as every other active faith), admin venue form, `wed_chinese.webp` hero.

**Verification:** Type-trivial change (string literals into unions already widened with `chinese` by #885, one boolean flip, removed optional props, one SQL file). No local typecheck — the fresh worktree has no installed deps; relying on the PR's required `typecheck + lint` + `production build` checks and the Vercel preview deploy (which renders the real onboarding flow). Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** Yes — supersedes the same-day "Chinese = coming soon" note. Chinese is now an **active** wedding ceremony type everywhere it's offered. See `COWORK_INBOX.md` (updates the prior coming-soon PENDING item).

## 2026-06-03 · chore(0000,0041): event_type enum guarantee + create-event copy (all-live)

**Context:** Follow-up to the owner's "keep everything live" decision + the spec-0000 reconciliation. Two small gaps: (1) belt-and-suspenders the `event_type` enum so a Debut insert can never fail + add 3 roadmap types as seedable; (2) the create-event page still carried "only weddings live / tap to be notified" copy.

**What changed:**
- **Migration `20260805000000_event_type_enum_guarantee.sql` (owner-push):** `ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS` for `debut` + `gender_reveal` (already in prod per #884 — harmless re-add) and NEW seedable `anniversary` / `graduation` / `reunion`. The 3 new ones are NOT in the UI roster — surfacing them later is a picker-config change, no migration. Mirrors the applied 20260621000000 attire-enum migration (BEGIN/COMMIT + per-value IF NOT EXISTS).
- **`create-event/page.tsx`:** killed the stale strings — header subtext ("Weddings are live today … tap one to be notified") → "Swipe through and pick the kind of event you're planning"; the `invalid_type` error's notify / "one event type at a time" language → a neutral "That event type isn't available yet — pick one from the carousel."

**Verification:** `tsc --noEmit` exit 0 · `next lint` clean. Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** Yes — spec 0000's event-type-picker section still describes "only Wedding+Debut live, nine coming-soon, 11 types, tap-to-be-notified" — superseded by "keep everything live" (all 9 live, no notify). See `COWORK_INBOX.md`.

## 2026-06-03 · feat(0043): add Chinese wedding as a coming-soon ceremony type

**Context:** Owner-directed — *"on weddings, also add chinese wedding."* The same-day "unlock all religions" change made Catholic/Civil/Christian/INC/Muslim/Cultural all active. Chinese (Tsinoy — tea ceremony + Chinese customs, often paired with a church/civil rite) joins the lineup as **coming soon**: surfaced everywhere but gated until vendor density can cater it (owner: "show them and prepare these … when the vendors are enough to cater their service"). It's the lone coming_soon faith now.

**What changed:**
- **Migration `20260804000000_add_chinese_ceremony_type.sql` (owner-push):** widens the four enum-style CHECK constraints (`events.ceremony_type` — NULL allowance preserved — `events.secondary_ceremony_type`, `wedding_type_launch_status`, `couple_wedding_type_notify_signups`) to PERMIT `chinese`, and seeds the launch-status row `coming_soon`. Inline-CHECK drops use catalog lookup (robust to auto-name truncation / IN→ANY normalisation). Widening-only → activation later needs no further migration.
- **Shared `ceremony-type-radio-group.tsx`:** `chinese` added to `CeremonyTypeKey` + `CEREMONY_TYPE_OPTIONS`.
- **create-event picker:** appears greyed "Coming soon" with the existing notify-me capture (`NOTIFY_FAITHS` += chinese; launch-status fallback array += chinese coming_soon; `SECONDARY_LABELS` += chinese so it also greys as a Mixed secondary). NOT in `ALLOWED_CEREMONIES` → not submittable.
- **Onboarding:** `OnboardingFaith` += chinese; `FAITH_PHOTO` += chinese (new hero `public/onboarding/wed_chinese.webp`); `FAITH_CHIPS` += chinese `soon:true` (greyed, non-clickable).
- **Edit modal (`ceremony-type-modal.tsx`):** chinese disabled + "Coming soon" badge (the modal renders all options ungated; `setEventCeremonyType` also rejects it server-side).
- **Admin venue form (`_constants.ts` + `venue-form.tsx`):** `chinese` added to `CEREMONY_TYPES` (+ its label map) so admins can tag Chinese-compatible venues/vendors now — building the supply that justifies activating it later.

**Activation (when vendors are enough):** flip the chinese `wedding_type_launch_status` row to `active` (admin console) + add `chinese` to both `ALLOWED_CEREMONIES` lists + onboarding chip `soon:false` + drop the modal disable. No migration needed.

**Verification:** `tsc --noEmit` exit 0 (caught + fixed a missing `venue-form` label-map entry) · `next lint` clean on all 9 touched files. Hero image eyeballed. Shipped from an isolated worktree off `origin/main`.

**SPEC IMPACT:** Yes — iteration **0043** (wedding-type picker) gains a Chinese ceremony type (coming-soon). See `COWORK_INBOX.md`.

## 2026-06-03 · feat(0021,0010,0004): make all in-app service tiles clickable (unlock-all-to-check)

**Commit:** see merge commit on this PR.

**Context:** Owner directive — *"for now we want to unlock all to check."* After religions + events, the only user-facing "coming soon" gates left in the in-app services catalog were 3 non-clickable tiles. Two map to REAL, already-built routes that simply weren't surfaced. (The bigger remaining locks — 8 not-built pricing SKUs, Concierge kill-switch, OAuth credentials, offline daemon — hide unbuilt/partial features and were intentionally left alone; flipping them surfaces stubs/broken flows, not checkable features.)

**What changed (catalog-only — `lib/add-ons-catalog.ts`):**
- **Monogram Creator** — repointed `monogram-creator` (dead route) → `animated-monogram` (the real iteration-0004 monogram studio) + `coming_soon → web_v1`.
- **Mood Board** — added a catalog entry (`web_v1`) surfacing the real `/add-ons/mood-board` route (0010), which was built but absent from the services grid.
- **Landing Page** + **Music Creator** — `coming_soon → web_v1` so they're clickable; they land on their polite `[addon]` info pages (no 404).

Propagates to both the `/add-ons` launcher grid and the Services-tab in-category rails (both import the catalog). Both real routes verified to render for any couple — ownership only changes content (no purchase gate / notFound for non-owners).

**Verification:** `tsc --noEmit` exit 0.

**SPEC IMPACT:** Minor — iterations 0004 (monogram) / 0010 (mood board) / 0021 (services tab): Monogram Creator + Mood Board are now reachable from the in-app services grid; Landing Page + Music Creator are clickable-to-placeholder. No SKU/pricing change. See `COWORK_INBOX.md`.

---

## 2026-06-03 · feat(admin): one-click "Create demo vendors" (chunked seed) on /admin/demo-vendors

**Commit:** see merge commit on this PR.

**Context:** Creating demo vendors was CLI-only — the "Regenerate" button just cleaned up + printed the terminal command (a full seed exceeds one serverless request's envelope). Owner wanted a real one-click Create. Solution: the browser clicks once, then loops category-by-category against a small per-chunk API until done, with a progress bar — no single long request.

**What ships (no migration):**
1. **Seed core refactor (`scripts/seed-demo-vendors.ts`) — importable, not moved.** `export async function seedCategory()` (seeds one canonical_service's profiles/services/refinements, returns its review+block rows for the caller to bulk-insert); exported `fetchCanonicalServices`/`fetchResolvedSchemas`/`fetchReviewEventPool`/`cleanupBatch`/`findLatestDemoBatch` + `isNonProdUrl`; **guarded CLI entrypoint** so importing never auto-runs. CLI `seed()` calls `seedCategory` + keeps its end-of-run bulk insert — **behavior preserved** (per-category RNG keyed on `(batchId, service)` ⇒ chunked == CLI output).
2. **Chunked seed API (`app/api/admin/demo/seed/route.ts`, nodejs).** `phase:'start'` (requireAdmin + **non-prod 403** + cleanup + return `{batchId, services, total}`); `phase:'chunk'` (seed `services[offset..offset+limit)` + insert that chunk's reviews/blocks + return progress). Mirrors the regenerate route's auth/audit.
3. **One-click button (`demo-vendor-actions.tsx`).** "Create demo vendors" + vendors/category control → POSTs `start`, then loops `chunk` (3 categories/request) with a progress bar. Confirm-gated; surfaces the prod 403; `router.refresh()` on completion.

**SPEC IMPACT:** Minor — `/admin/demo-vendors` (admin console, 0023) gains one-click demo seeding (was CLI-only). `[PENDING]` in `COWORK_INBOX.md`.

**Verification:** `tsc --noEmit` + `next lint` green. Refactor-safety smoke tests: exports resolve (`seedCategory` etc.; `isNonProdUrl` staging→true / prod-ref→false), importing the module does **not** auto-run the seed, the CLI entrypoint still fires when run directly. CI gates the production build (route bundles `@/scripts/seed-demo-vendors`; fallback = lift the core to `lib/`). **Owner, on staging:** `/admin/demo-vendors` → Create demo vendors → progress bar → `/vendors?demo=1`; prod-pointed deploy returns 403.

## 2026-06-03 · fix(0016): onboarding completion overlay can no longer strand the couple ("Creating your personalized dashboard" hang)

**Commit:** see merge commit on this PR.

**Context:** Owner report (real iPhone, production) — the final onboarding screen sat forever on "Creating your personalized dashboard / Building your personalized dashboard…" and never reached the dashboard. Root cause was a set of unguarded async paths around the completion overlay: any one of them left the blocking overlay up with no error and no way to retry (the retry guard `committingRef` also stayed locked).

**What changed:**
- **`app/onboarding/wedding/_components/onboarding-shell.tsx`** — (1) `handleFinish` now wraps `await commitOnboardingWedding(...)` in try/catch. Previously a *rejected* server action (a 500, a serverless function timeout, or a dropped RSC transport on a wobbly mobile connection) rejected the awaited promise unhandled, so `committingRef` stayed `true` and the overlay stayed up forever — the exact reported symptom. On reject we now unwind (`finishing`/`committing`/ref reset) and surface the existing retry error. (2) `goToDashboard` gains a navigation watchdog: if the client router wedges or `router.push` silently no-ops, a hard `window.location.assign` fires `ANALYZING_HOLD_MS + 4000ms` after the tap (guarded on still being on `/onboarding`, so it's a no-op on the happy path once navigation succeeds).
- **`lib/analytics.ts`** — `captureEvent`'s fire-and-forget `fetch` is now bounded by a 2s `AbortController`. It is `await`ed inside the onboarding commit's request path, so an unbounded hang could drag the serverless function to its timeout → the commit rejected → (pre-fix) the couple was stranded. This honors the module's own stated contract ("never let analytics block the response").
- **`app/onboarding/wedding/actions.ts`** — the shortlist/anchor seed block is now wrapped try/catch. `recomputeReceptionAnchor` runs after the event row is created but wasn't error-checked; a throw there rejected the whole commit *after* the event existed, so a client retry created a DUPLICATE event. The surrounding code already declared this block "best-effort"; this enforces it.

**Verification:** `pnpm -F web typecheck` clean · `next lint` on the 3 files clean. The failure-mode paths (reject / timeout / wedged router) are not exercisable in a happy-path preview; happy-path behavior is unchanged (the watchdog no-ops once navigation succeeds; the try/catch wraps the same statements).

**SPEC IMPACT:** None. Pure resilience/error-handling fix — no SKU, schema, workflow, copy, or branding change (the user-facing error string already existed).

**Follow-up (not in this PR):** the commit is still non-idempotent on the *other* failure branches (e.g. `event_members` insert fails → returns `ok:false` → a retry creates a second event). A durable fix needs a client-supplied idempotency key + server dedup — flagged for the owner; out of scope for this hang fix.

---

## 2026-06-03 · feat(0000,0041): unlock all event types (all 9 now creatable)

**Commit:** see merge commit on this PR.

**Context:** Owner directive — *"unlock all events."* The create-event picker shipped only **Wedding + Debut** as selectable; the other seven (Gender Reveal · Birthday · Celebration · Travel · Corporate · Tournament · Christening) rendered as "Coming soon" placeholders. The code's own comments flagged the unlock as a "one-line flip" — done here.

**What changed:**
- **`app/dashboard/create-event/_components/event-types.ts`** — `EVENT_TYPES[].enabled` flipped `false → true` for all seven coming-soon types. This single roster drives BOTH the full-page create-event picker AND the in-chrome add-event sheet.
- **`app/dashboard/create-event/actions.ts`** — `ALLOWED_TYPES` widened from `['wedding','debut']` to all nine (server validation; a non-allowed type was redirected with an error).

**No DB change:** the `public.event_type` enum already carries all nine values (verified by direct prod query: wedding · debut · gender_reveal · birthday · celebration · travel · corporate · tournament · christening). The create-event `isWedding` branch already writes NULL wedding-only fields (ceremony_type/venue_setting/etc.) for non-wedding events, and they redirect to the standard `/dashboard/{event_id}` — the path `debut` already exercises live.

**Verification:** `tsc --noEmit` exit 0.

**SPEC IMPACT:** Yes — iteration **0000** (event-type roster "V1: wedding + debut") + **0041** (multi-event roster "grows one event_type at a time") now describe all nine event types as live. The deliberate one-at-a-time rollout gate is removed. **Downstream caveat:** non-wedding events get the wedding-tailored dashboard/planning surfaces until per-type flows land (V1.2+) — the same rough edge `debut` has today. See `COWORK_INBOX.md`.

---

## 2026-06-03 · feat(0043,0016): unlock all wedding faiths (Christian / INC / Muslim / Cultural now active)

**Commit:** see merge commit on this PR.

**Context:** Owner directive — *"unlock all religions first."* Iteration 0043 shipped only **catholic + civil** as active faiths; **christian / inc / muslim / cultural** rendered as "Coming Soon" (gated behind per-region vendor density). Religions were gated in **five** places — the onboarding faith chips, two `ALLOWED_CEREMONIES` server constants (onboarding + create-event), the create-event launch-status fallback, and the canonical `wedding_type_launch_status` table. All five are now opened.

**What changed:**
- **`app/onboarding/wedding/_components/onboarding-shell.tsx`** — `FAITH_CHIPS` flips Christian/INC/Muslim/Cultural `soon: true → false` (selectable, no "soon" badge).
- **`app/onboarding/wedding/actions.ts`** — widened `ALLOWED_CEREMONIES` (non-Catholic primaries were silently **coerced to `catholic`** on commit) + new `DEFAULT_SUB_TYPE` so the insert defaults `ceremony_sub_type` for Muslim→`general_muslim` / Cultural→`other`. **Avoids a constraint trap:** the DB CHECK `events_sub_type_required_when_muslim_or_cultural` requires a non-null sub-type, and onboarding has no tradition picker — without the default every Muslim/Cultural commit would fail with a Postgres error.
- **`app/dashboard/create-event/actions.ts`** — widened `ALLOWED_CEREMONIES`. The picker is data-driven by `wedding_type_launch_status` and already collects + validates the Muslim/Cultural tradition sub-type, so this completes that path.
- **`app/dashboard/create-event/page.tsx`** — launch-status fallback flipped all-active.
- **`supabase/migrations/20260803000000_unlock_all_wedding_types.sql`** — idempotent UPDATE flipping every `wedding_type_launch_status` row to `active` (stamps `activated_at` only where still NULL).

**Verification:** `tsc --noEmit` exit 0 (full project, 0 errors) + full CI green (production build · Playwright e2e · Lighthouse · desktop builds). Prod `wedding_type_launch_status` verified all-`active` by direct query (migration auto-applied on file-write).

**Owner action:** none for the migration — already applied to prod (verified).

**SPEC IMPACT:** Yes — iteration **0043** (`wedding_type_launch_status` "V1.1: catholic + civil active") + the **0016** onboarding faith step + the CLAUDE.md decision log now describe all six ceremony types as active. The per-region vendor-density activation gate is overridden globally (owner's choice). See `COWORK_INBOX.md`.

---

## 2026-06-03 · feat(0021,0006): nest in-app Setnayan services INSIDE the Vendors-tab category rails

**Context:** In-app services rendered as a standalone launcher grid (`InAppServicesSection`) BELOW the Plan+Budget accordion — i.e. not inside the categories (owner, twice: "in app services are still not inside the categories"). `Digital_Services_Cross_Surface_Map_2026-06-03.md` §2-3 locks them INTO their canonical category with a ✦ Setnayan badge, floated to the top. This is the **presentation-nest** step (owner-picked over the full vendor-model convergence).

**What changed:**
- **`lib/add-ons-catalog.ts`** — new `category: InAppServiceCategory` (`PlanGroupId | 'digital_services' | 'tool'`) on every entry, the single placement source. Save-the-Date / Papic / Panood → `photography` · Patiktok → `photobooth` · LED (Pailaw) → `led_background` · Animated Monogram → `digital_services` · the rest (Orders / Playlist / QR / Photo Delivery / Paprint / Indoor Blueprint / Landing Page / Music Creator) → `tool`.
- **`plan-budget-accordion.tsx`** — module maps (`SVC_BY_GROUP` / `DIGITAL_SVCS` / `TOOL_SVCS`); a full-bleed poster `InAppServiceCard` **prepended (float-to-top)** into each matching category rail as a supplementary ✦ Setnayan card (live/web_v1 link to setup; coming_soon static, never linked — its `/add-ons` route may not exist); a synthetic **Design › Digital Services** rail; a compact **"Tools & extras"** strip in the end-spacer above the recap. Supplementary + non-saturating — never a pick, no Lock/Remove, budget rollup + Compare untouched. A category with a Setnayan service but no picks now shows its rail (not the slim empty row).
- **`vendors/page.tsx`** — dropped the standalone `<InAppServicesSection>`; **deleted** `in-app-services-section.tsx`.

**Verification:** `tsc --noEmit` clean (whole app) · `next lint` clean (changed files; only pre-existing warnings elsewhere) · a runtime `tsx` partition check confirmed the grouping + that nested links resolve to real routes. The authed couple-dashboard surface isn't renderable locally (no env / seed / running server) — visual check belongs on the PR's Vercel preview.

**SPEC IMPACT:** Iteration **0021** couple-dashboard Services tab + the Digital Services cross-surface map §2. Presentation step only; the full **vendor-model convergence** (§3 — source the list from the first-party Setnayan vendor account + choice-driven pre-add on category selection) and **fleshing out Digital Services** (add Pakanta / Pro Website / Live Venue Photo Wall to the catalog with valid setup routes — only the coming-soon Animated Monogram is present today) remain follow-ups. See `COWORK_INBOX.md`.

## 2026-06-03 · feat(0000): event-type picker → swipeable hero-photo carousel (shared)

**Context:** Owner ask (mobile screenshot of the event-switcher add-event sheet): *"change how events look like. we want a carousel but like hero photos. let them scroll all the possible events."* The picker rendered emoji tiles (💍 Wedding, 👑 Debut, …) one-at-a-time behind prev/next arrows.

**What changed:**
- **New `app/dashboard/create-event/_components/event-type-carousel.tsx`** — a shared client component: a horizontal scroll-snap **filmstrip** of full-bleed hero-photo cards, one per `EVENT_TYPES` entry. Native swipe/scroll *is* the "scroll all the possible events" interaction; arrows + dots below track the centred card (rAF-throttled nearest-centre). Live types show a gold "Available" badge; coming-soon types render **grayscale** + inert with a "Coming soon" badge; the full-page picker adds a gold selected ring + "Selected" badge.
- **`app/dashboard/[eventId]/_components/event-switcher.tsx`** (the screenshot's sheet) + **`app/dashboard/create-event/_components/event-type-picker.tsx`** (full page) now both render the shared carousel — the old per-surface emoji-tile carousels (`Tile` / `ArrowButton` / manual index state) are deleted. Switcher cards route on tap (Wedding → `/onboarding/wedding` · Debut → `/dashboard/create-event`); full-page cards select-then-reveal the name form as before.
- Switcher subtitle copy corrected: the prior *"tap an upcoming tile to be notified"* promised a notify flow that was never built (the disabled tile was inert) → now *"Weddings and debuts are live now. Swipe through to see what's on the way — more event types unlock over time."*
- **9 new hero photos** at `public/event-types/{key}.webp` (Recraft, Filipino-context, warm-editorial grade, 4:5; recompressed 15.5 MB → 541 KB, in line with the onboarding webp set).

**Verification:** `tsc --noEmit` exit 0 + `next lint` clean on all touched files; no dangling refs; no dependent tests. All 9 photos eyeballed (premium + cohesive). Live in-browser preview NOT run — the surfaces are auth+DB-gated and this env lacks `NEXT_PUBLIC_SUPABASE_*` (middleware builds the Supabase client per request), so the dev server 500s. Shipped from an isolated worktree off `origin/main` to keep unrelated in-progress changes out of the diff. No migration, no SKU.

**SPEC IMPACT:** Yes — iteration **0000** describes the event-type picker as emoji tiles; it's now a hero-photo carousel, with the switcher copy change. See `COWORK_INBOX.md`.

## 2026-06-03 · fix(0000,0021,0022,0023): event-logo monogram in vendor/admin switcher + customer non-event avatar

**Commit:** see merge commit on this PR.

**Context:** Owner reported that the event switcher on the **vendor + admin** doorways rendered the *basic* serif-italic monogram instead of the couple's customized onboarding monogram, and that the **customer non-event** upper-right avatar showed the account initial rather than the event logo. `EventMonogram` only renders the couple's real design when it receives `monogram_frame_key` + `monogram_font_key`; the customer event-scoped chrome forwarded them, but three chrome paths dropped them.

**What changed:**
- **`app/_components/dashboard-event-switcher.tsx`** — the shared vendor/admin switcher wrapper now types + forwards `monogram_frame_key`/`monogram_font_key` to the `EventSwitcher` anchor (was silently omitted → legacy basic badge).
- **`app/admin/layout.tsx` + `app/vendor-dashboard/layout.tsx`** — the `switcherEvents` map now carries both keys, so the anchor **and** the dropdown rows render the customized monogram.
- **`app/dashboard/_components/outer-dashboard-header.tsx`** — the customer *non-event* chrome (`/dashboard` root, `/profile`, `/notifications`, `/create-event`, `/api-keys`) now passes the **primary event's** monogram to `ProfileMenu`, so the upper-right avatar is the event logo (falls back to the account initial only when there's no event / no designed monogram). The event-scoped customer chrome already did this; this closes the gap.

**Scope note:** Vendor/admin upper-right keeps its display-name + Sign-out cluster (owner choice 2026-06-03 — no avatar added there). Data was already fetched — `fetchUserEvents` selects both columns; the fix only threads them through. No schema / query change.

**Verification:** `tsc --noEmit` clean · `next lint` clean (the 4 files). Logged-in browser check not run (dashboards are auth-gated; the running preview is the spec-corpus prototype server, not the app) — the fix feeds the same data into the same `EventMonogram` / `ProfileMenu` paths already proven on the customer event-scoped chrome.

**SPEC IMPACT:** None — brings code in line with the already-locked 2026-06-03 decisions ("the switcher renders the couple's customized onboarding monogram" + "the avatar IS the event's logo"). No Cowork action.

---

## 2026-06-03 · feat(admin+home): planning_deadlines goes live — reminders read it + admin editor (PR 2+3 of 3)

**Context:** Completes the admin deadline table (after PR 1's schema). The Home reminders now read the admin-set deadlines, and admins edit them in `/admin/taxonomy`. Owner: "do both."

**Wiring (`lib/upcoming-items.ts`):** `fetchRecommendedDeadlineItems` reads `planning_deadlines` (service category rows) and uses each category's admin-set offset (month/week/day) for the reminder; **falls back to `PLAN_GROUPS.monthsBefore`** per-category (incl. if the table isn't applied → empty map → code, no crash).

**Admin editor (`/admin/taxonomy`):** a "Recommended deadlines" section — lists the rows (services + documents) with inline `offset_value`/`offset_unit` edit via `updatePlanningDeadline` (new `actions.ts`, RLS-gated) + a category-level coverage/"missing deadline" flag. Per-leaf overrides are a noted follow-up (the leaf→category map is in code `TAXONOMY_MAP`, not the DB).

**Verification:** `tsc --noEmit` green. Admin route auth-gated + needs the table — CI build is the gate; degrades gracefully pre-migration.

**SPEC IMPACT:** Yes — 0023 admin gains the deadline editor; the Home reminders' deadline source becomes the admin table. Inbox note added.

## 2026-06-03 · chore(0000,0021): remove Marketplace (Store) + Switch View (role-switch) icons from the customer top nav

**Commit:** see merge commit on this PR.

**Context:** Owner directive (mobile screenshot, both icons circled): *"remove these 2 on top nav."* The customer top bar carried a 🏪 **Marketplace** link (`/vendors`) and the 👤﹀ **Switch View** `RoleSwitchPill` (the always-visible role-switch). Owner scope choice: remove from BOTH the event-scoped top bar AND the non-event customer top bar; **keep** the desktop left-sidebar instances.

**What changed:**
- **`app/dashboard/[eventId]/layout.tsx`** — dropped the Marketplace `<Link>` + the mobile (`lg:hidden`) `RoleSwitchPill` from the event-scoped `topBar`; removed the now-unused `Link` + `Store` imports. The top bar is now: event-switcher monogram · Messages · Bell · Profile-monogram. The desktop sidebar-footer `RoleSwitchPill` (`sidebarFooterPill`) is untouched.
- **`app/dashboard/_components/outer-dashboard-header.tsx`** — dropped the same two from the mobile `<header>` strip (non-event routes: Profile / Notifications / Create-event). The desktop left-sidebar bottom strip keeps both per the owner's scope choice; all three imports (`Store`, `Link`, `RoleSwitchPill`) remain in use there.

**Nothing orphaned:** Marketplace `/vendors` stays reachable via the home marketplace-tease-strip CTA, the "Browse your matched services" button, every plan-card folder link, and the desktop sidebar. Role-switching stays in the EventSwitcher dropdown's "Switch view" rows (Shop / Admin consoles) + the desktop sidebar.

**Verification:** `next lint` clean on both files · `tsc --noEmit` exit 0 (full project, 0 errors). Shipped from an isolated worktree off `origin/main` to keep unrelated in-progress changes out of the diff.

**SPEC IMPACT:** Yes — the iteration **0000** "single-strip top-nav (locked 2026-05-14)" + the **0021** couple-dashboard chrome described a top nav that included the Marketplace link and the always-visible Switch View pill. Both are now removed from the top bar (retained in the desktop sidebar). See `COWORK_INBOX.md`.

---

## 2026-06-03 · feat(0023,0006): admin song dedup/merge tool — master-catalogue hygiene (compatibility PR 6)

**Commit:** see merge commit on this PR.

**Context:** PR 6 (final) of the vendor-compatibility build. Vendors type their repertoire freely, so the master `songs` catalogue accumulates near-duplicates ("Perfect" vs "Perfect - Ed Sheeran"). This admin surface merges them so the overlap score stays clean, + removes junk.

**What changed:**
- **`lib/songs.ts`** — `fetchSongsAdmin` (searchable master list) + `mergeSongs(admin, dupId, canonicalId)`: re-points every `vendor_songs` + `event_song_picks` from the dup to the canonical (idempotent upsert), then deletes the dup row. Sequential service-role writes (the `songs` DELETE policy is admin-only) — no extra migration, re-runnable.
- **`app/admin/songs/{page,actions}.ts(x)`** — `/admin/songs`: search the catalogue + a merge form (Duplicate ID → Canonical ID) + per-row delete. Actions gated by the `/admin/pricing` `requireAdmin` pattern (the `/admin` layout already 404s non-admins; the actions re-check).
- **`admin-sidebar.tsx`** — a "Songs" nav item (Music icon) by Taxonomy.

**Verification:** `pnpm -F web typecheck` clean · `pnpm -F web lint` clean (my files) · `pnpm -F web build` ✓ (the `/admin/songs` route built).

**SPEC IMPACT:** Iteration **0023** (admin console) gains the Songs catalogue surface; **0006** (compatibility). No new SKU. See `COWORK_INBOX.md`.

**The compatibility build (PRs 1–6) is now complete** — schema + seed · vendor repertoire · couple picks · the score + cue · admin dedup. Owner action remains: push migration `20260731000000`.

---

## 2026-06-03 · feat(schema): planning_deadlines table + seed — admin-managed deadline foundation (PR 1/3)

**Context:** Step 1 of making the recommended-deadline reminders **admin-editable** instead of hardcoded (owner: "ship this both"). Creates the single deadline-config table + seeds it from the live values. No consumer yet — admin UI (PR 2) + read-path (PR 3) follow; migrations land first.

**Migration `20260802000000_planning_deadlines.sql`:** `planning_deadlines` — `kind` (service/milestone/document) · `ref_key` (plan-group id for category defaults · canonical_service leaf for overrides · or milestone/document key) · `scope` (category/leaf) · `offset_value`+`offset_unit` (month/week/day) · `applies_to` (e.g. pre-cana=catholic) · `is_active` · `UNIQUE(kind, ref_key, scope)`. RLS: admin `FOR ALL` via `public.is_admin()` + authenticated `SELECT`. **Seed:** 26 service category defaults from `PLAN_GROUPS.monthsBefore` + 3 statutory documents from `PAPERWORK_DEADLINES` (PSA 180d · license 120d · Pre-Cana 60d/catholic).

**Granularity = inheritance-with-override** (owner-approved): leaves inherit their category default; admins override specific leaves; the future "missing deadline" flag fires only when a leaf *and* its parent have none. The couple's *lock-by* deadline — distinct from the vendor's delivery plan (Service Schedule).

**Verification:** SQL reviewed against repo patterns (`public.is_admin()` · `gen_random_uuid()` · policy form all have precedent). SQL-only. **⚠️ Owner must `supabase db push`.**

**SPEC IMPACT:** Yes — new admin capability (0023) + the planning/deadline model becomes admin-owned config (was code). Inbox note added.

## 2026-06-03 · feat(0006,0016): music compatibility score — vendors ranked by song overlap + per-card cue (compatibility PR 4)

**Commit:** see merge commit on this PR.

**Context:** PR 4 of the vendor-compatibility build — the payoff. Music vendors are ranked by how much of the couple's chosen songs (`event_song_picks`, PR 3) they actually perform (`vendor_songs`, PR 2), and each card shows the match. Promote-but-never-limit: matches float up, nobody is excluded.

**What changed:**
- **`lib/songs.ts`** — `fetchEventSongPickIds` (the couple's pick set) + `fetchVendorSongOverlaps` (one batched count of each candidate's overlap with the picks).
- **`lib/wizard-recommendations.ts`** — `fetchWizardVendorRecommendations` gains an optional `matchEventId` arg + optional return fields (`song_overlap_count` / `song_pick_total` / `match_label` 'best' [≥90%] / 'next_best'). For a music-category query with a matched event + picks: over-fetch a 100-candidate pool, compute overlap, **stable-sort by overlap DESC** (preserves the ad_rank → review ladder within ties), trim to limit. Non-music / no-event queries take the EXACT prior path (zero extra reads). All 24 callers safe (optional fields, no strict mapping).
- **Wiring** — the two music wizard cards (`music-entertainment-card`, `after-party-music-card`) pass `matchEventId: eventId` on the initial fetch; `searchVendorRecommendations` forwards it so in-card search re-ranks too.
- **Cue** — `vendor-pick-grid-card.tsx` renders a per-card "♪ Best match · plays N of your M songs" pill, shown ONLY when the vendor performs ≥1 of the couple's songs (degrades to nothing — no "plays 0").

**Verification:** `pnpm -F web typecheck` clean · `pnpm -F web lint` clean (only the pre-existing `aria-disabled` warning in this file) · `pnpm -F web build` ✓.

**SPEC IMPACT:** Iteration **0006/0016** (the compatibility model). The "≥90% = Best matches / <90% = Next best options" intent is realized via the float-to-top re-rank + the "Best match" label; explicit grouped section-headers + extending the cue to the /vendors marketplace + Category-Search overlay are noted refinements (those don't go through the recommender). No new SKU. See `COWORK_INBOX.md`.

**Owner action:** still push migration `20260731000000` for any of this to light up (empty `vendor_songs`/`event_song_picks` → no overlap → graceful no-op, current ranking unchanged).

**Next:** PR 6 — admin dedup/merge tool for the master song catalogue.

---

## 2026-06-03 · feat(settings): "Planning reminders" on/off toggle (couple opt-out)

**Context:** The free recommended-deadline reminders ship **on by default**; this is the quiet opt-out the owner asked for — no up-front fork, just a Settings switch.

**What ships:**
- **Migration** `20260801000000_users_reminders_enabled.sql` — `users.reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE` (per-user, matching the existing scalar-pref pattern: planner_mode / theme / locale). No RLS change. **Owner must `supabase db push` this before the toggle works end-to-end.**
- **Settings UI** (`dashboard/profile/page.tsx`, the existing `#settings` section) — an On/Off "Planning reminders" toggle mirroring the Planner-mode pattern, wired to `updateRemindersEnabled` (`profile/actions.ts`).
- **Gate** (`lib/upcoming-items.ts`) — `FetchUpcomingItemsInput.remindersEnabled`; when false the `recommended_deadline` source is skipped (payments / meetings / statutory deadlines still show). Both Home async wrappers read `users.reminders_enabled` and pass it; a missing column (pre-migration) degrades to reminders-on, no crash.

**Verification:** `tsc --noEmit` green (exit 0). Dashboard is auth-gated — CI build is the gate.

**SPEC IMPACT:** Minor — iteration 0025 Settings gains the "Planning reminders" toggle + `users.reminders_enabled`. Inbox note added.

## 2026-06-03 · feat(home): free recommended-deadline vendor reminders — the Today's Focus replacement

**Context:** The retired Today's Focus wizard's job — telling couples the *recommended deadline* to book each vendor — is now delivered free, no fork and no paywall, inside the existing Home "Upcoming" stream. Owner direction: full vendor set, on by default.

**The data already existed.** Rather than inventing claims, this reuses the owner-authored `monthsBefore` already on every `PLAN_GROUPS` entry ([wedding-plan-groups.ts](apps/web/lib/wedding-plan-groups.ts)) — documented as the recommended **lock-by** deadline ("aim to have this locked N months before the wedding"): ceremony venue/coordinator 12mo · officiant/catering/photography 9 · attire 8 · HMUA/florals 6 · host 5 · cake/cocktail/invites 4 · LED/photobooth/rings 3 · accommodation/logistics 2. Same dates the plan-grid advertises, so the reminder and the grid never disagree.

**What ships:**
- **New `recommended_deadline` source in `lib/upcoming-items.ts`** (`fetchRecommendedDeadlineItems`): for each plan-group category the couple hasn't **locked** a vendor in (resolved via `statusOfVendor` + `canonicalServiceToPlanGroupId` against `event_vendors`), emits a reminder dated `wedding_date − monthsBefore`. Forward-looking only, sorted soonest-first, **capped at 5** so it never floods. Entry-point cards (`countsTowardLockable === false`) are skipped. Skips events with no wedding date.
- **Renderer** (`upcoming-schedules.tsx`): a `CalendarClock` icon + gentle violet styling — calm, not urgent.
- **Graceful-degrade fallbacks** in the two async wrappers gain the new `sourceCounts` key.

**Behavior:** a couple sees *"Book your Photography & Video — recommended deadline, most couples have this booked about 9 months before the wedding."* As they lock each vendor, its reminder drops and the next deadline surfaces. No new screen.

**Admin table is next:** these code `monthsBefore` values are the **seed** for the admin-managed per-leaf deadline table (V1.x · inheritance-with-override · "missing deadline" flag). Once that lands, this source reads from the table with the code values as fallback — no visible change for couples.

**Verification:** `tsc --noEmit` green (exit 0). Dashboard is auth-gated, so no local preview — CI build is the gate.

**SPEC IMPACT:** Implements the free recommended-deadline guidance from the Today's-Focus-retired decision queued in `COWORK_INBOX.md`. Inbox note added for the 0016 spec. Follow-ups (separate): the admin per-leaf deadline table, and the Settings "Planning reminders: on/off" opt-out toggle — default-on ships here.

## 2026-06-03 · feat(0016,0006): couple onboarding music picks → event_song_picks (compatibility PR 3)

**Commit:** see merge commit on this PR.

**Context:** PR 3 of the vendor-compatibility build. The couple's onboarding music picks (the top-100 picker → `events.music_playlist_seed`, display-only) now ALSO write to `event_song_picks` — the couple side of the music compatibility overlap (vendor `vendor_songs` ∩ couple `event_song_picks`). Pairs with PR 2 (vendor "Your repertoire").

**What changed:**
- **`lib/songs.ts`** — `syncEventSongPicks(client, eventId, picks)`: parses each `"Title|Artist"` pick, resolves to (or creates) a master song via `findOrCreateSongId`, and upserts `event_song_picks` (idempotent, `source='onboarding'`).
- **`app/onboarding/wedding/actions.ts`** — `commitOnboardingWedding` calls it (service-role `admin` client, RLS-bypass) right after the event + couple membership are created, **wrapped in try/catch** so it can NEVER fail the commit (e.g. before migration `20260731000000` is pushed → tables absent → swallowed + logged).

**Verification:** `pnpm -F web typecheck` clean · `pnpm -F web lint` clean (my files) · `pnpm -F web build` ✓ (`/onboarding/wedding`). Foundation/data only — no UI change. The picks are mostly the seeded MUSIC100, so they resolve to existing master rows (no inserts).

**SPEC IMPACT:** Iteration **0016** (onboarding) + **0006** (compatibility). `music_playlist_seed` stays for display; `event_song_picks` is the match-read source. No new SKU. See `COWORK_INBOX.md`.

**Next:** the compatibility **score** in `fetchWizardVendorRecommendations` (music vendors ranked by song overlap) + the 90% "Best / Next best" split + cards.

---

## 2026-06-03 · feat(0022,0006): vendor "Your repertoire" — music acts build their song set list (compatibility PR 2)

**Commit:** see merge commit on this PR.

**Context:** PR 2 of the vendor-compatibility build (PR 1 = the master-songlist foundation `20260731000000`). Music vendors (band / choir / orchestra / singer / DJ) now have a "Your repertoire" surface to build the set list they perform — the vendor side of the music compatibility overlap (`|couple picks ∩ vendor repertoire| / |couple picks|`).

**What changed:**
- **`lib/songs.ts`** — `MUSIC_CANONICALS` (the `program`-folder song acts: live_band / choir / orchestra / wedding_singer / dj) + `isMusicVendor()`; `fetchVendorSongs` · `searchSongs` (title ilike, curated-first) · `fetchCuratedSongs` (the seeded MUSIC100) · `findOrCreateSongId` (**select-then-insert**, NOT upsert-on-conflict — the `songs` UPDATE policy is admin-only, so a DO-UPDATE fallthrough would be RLS-denied; dedup via the generated `normalized_key`).
- **`app/vendor-dashboard/repertoire/{page,actions}.ts(x)`** — search the master library + add (an existing `song_id`, or a typed new song that joins the catalogue) + the current set list with remove. Server-action forms preserve the search query across the redirect. Gated to music vendors (a clear "this is for music acts" explainer for everyone else, not a silent 404). Reuses the `services/` editor pattern (`ensureProfile`, `SubmitButton`, RLS-scoped writes via `current_vendor_ids()`).
- **`vendor-sidebar.tsx`** — a "Repertoire" nav item (Music icon) in the Pipeline group; the mobile `/more` page picks it up automatically.

**Verification:** `pnpm -F web typecheck` clean · `pnpm -F web lint` clean (my files) · `pnpm -F web build` ✓ (the `/vendor-dashboard/repertoire` route built; the dynamic-server / sitemap-env notices in the log are pre-existing, unrelated).

**SPEC IMPACT:** Iteration **0022** (vendor dashboard) gains the "Your repertoire" surface; **0006/0044** (the compatibility build). No new SKU. Nav-level hiding for non-music vendors is a noted follow-up (the vendor layout doesn't currently pass `services` to the sidebar). See `COWORK_INBOX.md`.

**Next (compatibility build):** onboarding picker → `event_song_picks` (couple side) → the compatibility score in `fetchWizardVendorRecommendations` → the 90% "Best / Next best" split + cards.

---

## 2026-06-03 · feat(0000): chrome monogram = the full framed onboarding monogram + exact fonts + event logo

**Commit:** see merge commit on this PR.

**Context:** Follow-up to PR #863 (monogram → switcher icon), closing the 3 parked items per owner directives 2026-06-03: **(1)** *"we want what the monogram looks like on the onboarding"* → render the actual gold FRAME, not letters-forward; **(2)** *"yes exact font"* → load the real display faces; **(3)** *"that will be the logo of the event"* → the upper-right profile avatar becomes the event's monogram/logo.

**What changed:**
- **Framed render (`event-monogram.tsx` + `lib/monogram.ts`):** when an event carries an onboarding design, `EventMonogram` now renders the **actual gold frame webp** (`/onboarding/mono/{frame}.webp`) + initials in the chosen font + ink — the onboarding medallion, scaled to chrome size — instead of the letters-forward circle. `resolveMonogramDesign` returns a validated `frameKey`; new `lg` (44px) size for the avatar. Letters-forward stays the fallback for a design with no frame; legacy initials circle for non-onboarding events.
- **Exact fonts (`app/layout.tsx`):** Cinzel · Playfair Display · Great Vibes loaded via `next/font/google` (vars `--font-cinzel` / `--font-playfair` / `--font-script`); `MONO_FONT_STACK` now points at them, so every design renders in its true face (Cormorant was already loaded).
- **Avatar = event logo (`profile-menu.tsx` + event layout):** `ProfileMenu` accepts an optional `monogram`; when present the upper-right avatar IS the event's framed monogram (its logo), not the email initial. The event layout passes the event's monogram; non-event chrome (admin / vendor / `/dashboard` root) keeps the initial — backward compatible.

**Verification:** `pnpm -F web typecheck` clean · `pnpm -F web lint` clean (only the pre-existing `<img>` warning in this file, unrelated) · `pnpm -F web build` succeeds (validates the 3 new fonts + the render). Couldn't screenshot live (auth-gated chrome) — **flagged for owner eyeball**, esp. legibility of the ornate frame at the 28/36px switcher sizes (the 44px avatar reads best).

**SPEC IMPACT:** Iteration **0000** (event switcher) + **0021** §2.0c (profile avatar) + corpus `DECISION_LOG`. **Supersedes the prior "letters-forward" framing** — the chrome monogram is now the FULL framed onboarding monogram in the exact font, and the upper-right avatar is the event logo. See `COWORK_INBOX.md`.

**Next:** owner eyeball; if the ornate frame is too small at the 28/36px switcher sizes, bump the chrome monogram sizes (quick follow-up).

---

## 2026-06-03 · refactor(onboarding): drop ₱1,499 "Today's Focus" from the Your-Plan bundles (it's free now)

**Context:** Follow-through on the Today's Focus retirement ([PR #866]) — owner confirmed the planning guidance (deadline + "start-looking" reminders) is **free**, not a paid tier. But onboarding's "Your Plan" Essential Bundle still listed **"Today's Focus · planning" at ₱1,499**, selling a surface that no longer exists.

**What changed (`apps/web/app/onboarding/wedding/_components/onboarding-shell.tsx`, one file):** removed the `today_focus` key from all five bundle maps — `BUNDLE_ITEMS` (label), `BUNDLE_BENEFIT` (copy), `BUNDLE_GROUPS` (category), the `essential` tier's `add: [...]` array, and `SVC` (pricing). The savings counter recomputes itself (it sums `SVC[k]` over `bundleItemsFor()` with a `?? {out:0,set:0}` fallback, so dropping the item just removes it from the total).

**Net effect:** the Essential Bundle returns to the owner's original 2026-06-01 spec — **Advanced Website + Papic for guests + Same-Day Edit (3 items)** — and the "You save" figure drops by Today's Focus's old `{out: 20000, set: 1499}` contribution. The cumulative higher tiers (Simple/Classic/Grand/Grand Fiesta) inherit the change since they build on Essential.

**Verification:** `tsc --noEmit` green (exit 0); zero remaining `today_focus` refs in onboarding. Visual check via the PR's Vercel preview (onboarding is public, not auth-gated).

**SPEC IMPACT:** None on the bundle *spec* — this realigns the code to the owner's 2026-06-01 "Essential = 3 items" definition (the code had drifted by prepending Today's Focus). Closes the "owner decision needed" flagged on the Today's-Focus-retired inbox item.

## 2026-06-03 · feat(0006/0044): master song list + vendor repertoire + couple song picks — compatibility foundation (PR 1)

**Commit:** see merge commit on this PR.

**Context:** First PR of the vendor-compatibility build (design lock: corpus `Vendor_Compatibility_and_Master_Songlist_2026-06-03.md`, owner-locked 2026-06-03). Owner's model: bands/singers/orchestras place the songs they perform → compiled into one shared **master song list**; couples pick from the same list; music-vendor **compatibility = song overlap** (`|picks ∩ repertoire| / |picks|`) — matches float up, nobody is hidden, `<90%` is labeled "next best options." Today there is no compatibility score (ranking = `ad_rank → review_count → avg_rating_overall`), the music schema stores only song COUNTS (never titles), and `event_vendor_preferences` / `music_playlist_seed` are captured but read by zero matchers. This lands the missing data substrate.

**What changed — new migration `20260731000000_master_song_list_foundation.sql` (additive · owner-push):**
- **`songs`** — master catalogue, one deduped record per `(title, artist)` (generated `normalized_key` UNIQUE → `ON CONFLICT` no-op collapses duplicates). **Seeded with the curated `MUSIC100`** (the 100 songs the onboarding picker already uses, `is_curated_pick=TRUE`) so couple picks + vendor repertoires share identity. Public read · authenticated insert · admin-only edit/delete · a `songs_nonadmin_guard` trigger (created AFTER the seed) stops non-admins minting curated/seed songs (no picker pollution).
- **`vendor_songs`** — each music vendor ↔ master songs they perform. Public read · vendor-owned write (`vendor_profile_id IN current_vendor_ids()`).
- **`event_song_picks`** — the couple ↔ master songs they want. Host-scoped (`event_id IN current_event_ids()`, same idiom as `event_vendor_preferences`). Supersedes the display-only `events.music_playlist_seed` for matching.
- RLS at `CREATE TABLE` time (canonical helpers `is_admin` / `current_vendor_ids` / `current_event_ids`); reverse-lookup indexes on `song_id`.

**Verification:** migration self-check — 100 seed songs · 3 tables · 3 RLS-enabled · balanced dollar-quote · doubled COMMENT apostrophes · all 3 canonical helpers referenced. No app code, no behavior change (foundation only). *(Migration runs on owner `supabase db push` — not exercised by typecheck/lint/build.)*

**SPEC IMPACT:** Design already authored in the corpus — `Vendor_Compatibility_and_Master_Songlist_2026-06-03.md` + the `DECISION_LOG.md` row (both 2026-06-03). No pending spec CONTENT; the corpus doc just needs committing in the owner's next Cowork batch (written, co-mingled with other uncommitted corpus work). See `COWORK_INBOX.md`.

**Owner action:** push migration `20260731000000` (`supabase db push`).

**Next PRs (per the design):** vendor "Your repertoire" capture (0022) → onboarding picker → master (0016) → compatibility score in `fetchWizardVendorRecommendations` → 90% split + card rendering → admin dedup/merge (0023).

---

## 2026-06-03 · refactor(todays-focus): retire the Today's Focus wizard surface (keep the deadline logic)

**Context:** Owner confirmed the 9-card/65-card Today's Focus planning wizard is no longer the model — couples are guided by (1) **onboarding** (upfront scoping of what they want) + (2) the **per-service deadline timeline** (counted back from the wedding date). The paid SKU behind it (the "Concierge" rebrand) was already switched off (`CONCIERGE_ENABLED=false`), so the only couple-facing remnant was the `/today` wizard reachable via two nav links. Owner directive: retire the surface, **keep the Filipino-wedding deadline logic.**

**Safety check first (the owner's explicit constraint):** the Filipino-wedding statutory deadlines (Pre-Cana −60d · marriage-license-validity −120d · PSA/CENOMAR −180d) live in `lib/upcoming-items.ts` `PAPERWORK_DEADLINES`, pure-computed from `event_date` + `ceremony_type` and surfaced on event-home via `fetchUpcomingItems()` — **fully independent of the wizard.** This change does not touch that lib, so the deadlines are preserved.

**What changed (5 files · −122 net lines):**
- **`today/page.tsx`** — the `<WizardHero>` render (150 lines) becomes a 34-line **redirect to event-home**, so existing links / bookmarks / V1 "Today's Focus active" emails don't 404. Wizard components (`wizard-hero.tsx`, `wizard-cards/`, `lib/wizard.ts`) + the dormant Concierge machinery are left on disk as a quick-revert path.
- **`customer-nav-config.ts`** — removed the `'today'` nav group (Today's Focus + Home); **Home is preserved**, promoted to the top of the `Plan` group. Dropped the now-unused `Focus` icon import. Drives both the desktop sidebar and the `/more` grid, so Today's Focus disappears from both.
- **`customer-bottom-nav.tsx`** — removed `/today` from the More-tab `activeMatch` (dead after the redirect) + updated the header doc.
- **`more/page.tsx`** — removed the now-dead `todays-focus` description + corrected the comment that had said the card was "intentionally KEPT."
- **`customer-sidebar.tsx`** — updated the 7-group → 6-group IA doc comment.

**NOT in this change (deliberately deferred · needs owner sign-off):**
- The dormant infra teardown — `events.concierge_*` columns, the `/admin/concierge-abuse` queue, the `TODAYS_FOCUS` catalog SKU, the wizard task sequences. All invisible to couples; a later schema-cleanup pass.
- **Onboarding still SELLS "Today's Focus" (₱1,499) in the Essential Bundle** (`onboarding-shell.tsx`) — pulling a product from a curated bundle is an owner pricing decision. Flagged in `COWORK_INBOX.md`.

**Verification:** `tsc --noEmit` green (exit 0). Dashboard is auth-gated (Supabase session + real event), so no local preview render — CI build is the gate. Pure nav-config / route-redirect / comment change.

**SPEC IMPACT:** Yes — iteration 0016 (Today's Focus / Concierge). The couple-facing wizard surface is retired (route redirects, nav entry removed); the deadline logic that fed it is preserved in `lib/upcoming-items.ts`. Decision-log row + the onboarding-bundle question are queued in `COWORK_INBOX.md`.

## 2026-06-03 · feat(admin): demo-vendor inquiry responder + unique demo contact emails

**Commit:** see merge commit on this PR.

**Context:** Owner wants to test the customer↔vendor inquiry round-trip without managing thousands of vendor logins — "demo vendor = one account for all." Demo vendors are unclaimed (`user_id=NULL`) so no one receives their inquiries, AND they all shared one `contact_email`, which made the couple's `startThreadByVendorEmail` `.maybeSingle()` lookup ambiguous → couples couldn't even start a thread with a specific demo vendor. The app is 1:1 vendor↔user, so the answer is an admin-operated responder, not a mega-account.

**What ships (no migration):**
1. **Unique demo contact emails (`scripts/seed-demo-vendors.ts`).** `contact_email` → `${slug}@demo.setnayan.local` (slug is unique) so a couple's "Message" flow resolves to exactly one demo vendor. Re-seed to apply.
2. **Admin responder (`/admin/demo-vendors/inquiries` + `/[threadId]`).** Lists every inquiry thread whose vendor is `is_demo=TRUE` (couple/event label only — no PII) and lets an admin **Accept / Decline / reply as the vendor**. Server actions use the service-role client (chat tables have no admin RLS policy) and are double-gated: admin-only (`isAdminProfile`) + the thread's vendor must be `is_demo=TRUE` (never touches a real vendor's thread). Accept fires the existing name-reveal trigger; reply inserts a `sender_role='vendor'` message (`sender_user_id=NULL`). Messages render server-side (realtime would be RLS-blocked for an admin); each action refreshes the route. Linked from the Demo Vendors page; sidebar `matchPrefix` keeps it lit.

**SPEC IMPACT:** Minor — adds a demo-only responder sub-surface under the existing `/admin/demo-vendors` tooling (admin console, iteration 0023) that exercises the 0019 inquiry flow. Logged in `COWORK_INBOX.md`. (Claimed demo vendors still use the real vendor dashboard; this is for unclaimed ones.)

**Verification:** `tsc --noEmit` + `next lint` green. **Owner round-trip on staging** (after re-seed): as a couple (with an event) → Follow + Message a demo vendor → as admin → `/admin/demo-vendors/inquiries` → Accept → reply → couple sees the reply + revealed vendor name. (Service-role DB writes can't be harnessed offline.)

## 2026-06-03 · feat(0000): onboarding free monogram → event-switcher icon

**Commit:** see merge commit on this PR.

**Context:** Owner directive 2026-06-03 — *"on customer onboarding, we have a free monogram logo for the customer. this monogram will be used as their icon for the switcher"* + *"our onboarding needs to be live on our app now."* The wedding onboarding (`app/onboarding/wedding`, a live 2570-line flow) already lets the couple design a free monogram and persists it (`events.monogram_frame_key` + `events.monogram_font_key`), but the event-switcher chrome rendered only a plain initials + color circle — `EventMonogram` read `monogram_text`/`monogram_color` and **ignored** the design. So a couple picked a gold-framed monogram in onboarding but never saw it in the app. This wires the designed monogram through to the switcher icon.

**What changed:**
- `lib/monogram.ts` — new `resolveMonogramDesign({monogram_frame_key, monogram_font_key})` → `{color, fontFamily, fontStyle, letterSpacing} | null`. Mirrors the 10 onboarding `MONO_DESIGNS` presets (frame · font · ink) + font-family stacks + ink hexes (mulberry `#5C2542` · gold-deep `#A88340` · ink `#1E2229`); recovers ink from the (frame, font) preset. Returns null for events with no design → legacy fallback.
- `app/_components/event-monogram.tsx` — `EventMonogram` renders **letters-forward** when a design is present: initials in the couple's chosen font + ink (no frame — the ornate webp is illegible at ~28px). Backward compatible: no design keys → unchanged serif-italic + color badge.
- Threaded `monogram_frame_key` + `monogram_font_key` (optional) through the switcher data path: `lib/events.ts` (`EventRow` + `fetchUserEvents` SELECT), `app/dashboard/[eventId]/layout.tsx` (events SELECT + current* props + switcherEvents map), `app/dashboard/layout.tsx` (primaryEvent + switcherEvents → OuterDashboardHeader), `outer-dashboard-header.tsx` (PrimaryEventData + pass-through), `event-switcher.tsx` (SwitcherEvent + props + both EventMonogram usages). All new fields optional → admin chrome + older / non-onboarding events compile + render unchanged.

**Verification:** `pnpm -F web typecheck` clean · `pnpm -F web lint` clean (only pre-existing warnings in unrelated files) · `pnpm -F web build` succeeds (full route manifest). Rendered across all 10 designs in a throwaway dev route (removed before commit); the in-context switcher sits behind auth — flagged for owner eyeball on deploy.

**Open product fork:** at icon size the switcher shows initials in the couple's font + ink, NOT the gold FRAME (invisible at 28px). If the owner wants the literal framed mini-monogram (reads better in the larger dropdown rows), that's a fast follow. **Font fidelity (follow-up):** Cormorant is loaded app-wide; Playfair / Cinzel / Great Vibes are not yet loaded on the dashboard, so those designs fall back to elegant serif / system cursive — loading the exact faces into the chrome is a small follow-up.

**SPEC IMPACT:** Iteration **0000** (event switcher) + Onboarding Blueprint + corpus `DECISION_LOG.md`. The 2026-06-03 corpus row + 0000 § Monogram note name the persisted column `events.monogram_svg`; the ACTUAL schema/code is `events.monogram_frame_key` + `events.monogram_font_key` (migration `20260719000000_onboarding_v2_event_columns.sql`) — there is no `monogram_svg`. Spec must be corrected to the real column names, note the switcher renders letters-forward (font+ink) with the frame deferred at icon size, and reflect that this is **shipped** (not a "V1.x build task" / "prototype HTML"). Logged in `COWORK_INBOX.md`.

---

## 2026-06-03 · feat(marketplace): demo-vendor testing tools — calendar blocks, claim helper, 20–50 default

**Commit:** see merge commit on this PR.

**Context:** Follow-up so the owner can exercise two real flows with demo data — the **mutual-schedule narrowing** (`lib/vendor-availability.ts`, already shipped) and the **customer↔vendor inquiry round-trip** (iteration 0019). Both were untestable with demo vendors: the seed created no calendar blocks (vendors read as always-free → the schedule intersection never narrows), and demo vendors are unclaimed (`user_id=NULL` → no vendor receives an inquiry).

**What ships (seed/scripts only — no migration):**

1. **Calendar blocks (`scripts/seed-demo-vendors.ts`).** Each demo vendor gets 2–8 full-day `vendor_calendar_blocks` (busy dates) over the next ~12 months — sparse so the availability intersection narrows as a couple locks more vendors without collapsing to "no days work." UTC-midnight timestamps satisfy the 30-min/zero-second CHECKs; blocks cascade-delete with their vendor on cleanup. Bulk-inserted in 1000-row chunks.
2. **Claim helper (`scripts/claim-demo-vendors.ts`, new).** Claims ONE demo vendor to a vendor user (`--to-email=` / `--to=`, optional `--category`/`--slug`): sets `user_id` + `is_demo=false` + `demo_batch_id=null` + a unique `contact_email` (all demo vendors share one, which would make the couple's `startThreadByVendorEmail` lookup ambiguous). Refuses if the user already owns a profile (vendor→user is 1:1 via `fetchOwnVendorProfile`'s `.maybeSingle()`). That vendor can then receive + reply to inquiries.
3. **Default 20–50 per service.** `parseArgs` defaults bumped 5–10 → 20–50 vendors/category (the owner's testing target). `--min/--max/--limit` still override; expect ~4,000–9,600 vendors + proportional reviews/blocks per run (a few minutes).

**SPEC IMPACT:** None — demo/simulation tooling (reuses existing `vendor_calendar_blocks` + `vendor_profiles`; no schema/SKU/workflow change).

**Verification:** `tsc` + `next lint` green. Offline harness: calendar blocks satisfy minute∈{0,30}/second=0 across UTC/PH/IST timezones, 2–8 per vendor, valid ordering. **Owner-actionable:** re-seed staging (now defaulting to 20–50/category), then (Q5) lock 2–3 demo vendors and watch the mutual schedule narrow; (Q4) `claim-demo-vendors.ts --to-email=<vendor test account>` then run the inquiry round-trip.

## 2026-06-03 · fix(guests): mobile panel hugs its content (minimum height) → maximum guest list

**Context:** Owner — the per-panel fixed heights barely differed (200/196/196), so the sheet looked uniform and ate a third of the screen. "Keep the height at minimum so we can have maximum visual for the guest list," and keep the focused text input docked to the bottom near the keyboard.

**What changed (`apps/web/app/dashboard/[eventId]/guests/_components/mobile-guest-carousel.tsx`):**
- **Measured content height** — replaced the fixed `PANEL_OPEN_H` array with a runtime measurement: the open sheet is now `grabber + the active panel's scrollHeight`, capped at 60% of the screen (taller content scrolls inside the panel). Each panel hugs its own content, so Search (one compose bar) is far shorter than Summary (2×2 count grid), and the guest list above gets the most room. A `ResizeObserver` re-measures on panel switch + content changes.
- **Hug, don't stretch** — the track is `items-start` (keyboard closed) and every panel `max-h-full overflow-y-auto`, so `scrollHeight` reports true content height in all cases; Summary's grid dropped `h-full content-center`; the Add form dropped its `h-full`/`justify-center` so it hugs.
- **Keyboard docking preserved** — when an input is focused, the sheet still docks above the keyboard (`bottom: kbInset`) with the inputs rendered last + `justify-end`, so the lowest text field sits flush against the keyboard. (Add form keeps `h-full justify-end` only while `kbOpen`.)

**Verification:** Reviewed for type-soundness + RO-loop safety (height set is idempotent; `scrollHeight` is invariant to the sheet height with `items-start`+`max-h-full`). CI typecheck + production build green before merge; per-panel feel confirmed by owner on the Vercel prod deploy (auth-gated page, no local Supabase env).

**SPEC IMPACT:** None — interaction sizing polish; no SKU, schema, copy, or workflow change.

---

## 2026-06-03 · refactor(customer-more): de-dupe the mobile /more grid + brand-voice copy polish

**Context:** "Less stressful" pass on the customer dashboard. The mobile `/more` overflow page (the 5th bottom-nav tab's landing) rendered EVERY entry from `buildCustomerNavGroups` — including the four surfaces that are already permanent bottom tabs (Home · Guests · Services · Website). So a host saw those four (plus Home a second time under the "Today" group) repeated as cards on `/more`, contradicting the page's own subtitle ("the rest live here") and padding the grid with ~5 redundant cards.

**What changed (`apps/web/app/dashboard/[eventId]/more/page.tsx` — one file):**

- **De-dupe.** A `BOTTOM_NAV_KEYS` set (`home · guests · vendors · website`) filters the bottom-nav tabs out of the `/more` grid; groups the filter leaves empty are dropped (the "Today" group now keeps only Today's Focus). The shared `buildCustomerNavGroups` builder is untouched, so the **desktop sidebar still shows every surface** — the de-dupe is mobile-only.
- **Today's Focus intentionally KEPT.** The bottom bar has no Today tab and event-home stopped linking to `/today` when `WizardHero` was lifted out of event-home (2026-05-24), so the `/more` card is the **only** mobile entry point to the Today's Focus wizard. Removing it would orphan `/today` on mobile — forbidden by the orphan-prevention lock. (To fully remove it from `/more`, a Home→`/today` entry point must be added first.)
- **Copy polish.** Added the missing `find-date` card description; removed the dead `orders`/`receipts` description keys (those items were already pulled from the nav 2026-05-30); de-jargoned three cards per the no-dev-text rule — `profile` ("OAuth providers" → "sign-in methods"), `add-ons` ("Setnayan apparatus … software services we publish" → "Extra Setnayan services … Papic, Panood, Save-the-Date"), `disputes` ("force-majeure" → "raise an issue with a vendor"). Tightened the subtitle to match the new, truthful scope.

**Verification:** `tsc --noEmit` green (exit 0). The dashboard is auth-gated (needs a Supabase session + a real event), so it can't render in a local preview; the PR's required CI build is the gate before merge. This is a pure server-component data-filter + copy change — `CustomerMobileLanding`'s props/contract are unchanged.

**SPEC IMPACT:** Minor — nav-presentation refinement on the 0021 couple dashboard's mobile `/more` surface. No SKU, schema, route, or workflow change (every route stays reachable). A one-line decision-log row should be recorded — see `COWORK_INBOX.md`.

## 2026-06-03 · feat(marketplace): demo vendors get reviews/ratings, district addresses & real names

**Commit:** see merge commit on this PR.

**Context:** Follow-up to the demo-vendor enrichment. Owner wants demo vendors realistic enough to test the real flows — **find → compare → "pick the best service for the customer."** Gaps that remained: demo vendors had **0 reviews / 0 stars** (so any "best"/compare ranking couldn't differentiate them), addresses were city-level only, and names carried a `Demo ·` prefix.

**What ships (`scripts/seed-demo-vendors.ts`, seed-only — no migration):**

1. **Synthetic reviews + ratings.** Each demo vendor gets a hidden baseline quality + 0–10 reviews (~15% get none) with five 1-5 sub-axis ratings drawn around the baseline, a Filipino-voice `body` (~60%), and an occasional `vendor_reply` (~20%). Reviews set `couple_user_id = NULL` (the self-review trigger `20260515030000` short-circuits on NULL) and reuse the archived `TEST-REVIEW · %` event pool from migration `20260607000000` for the NOT-NULL `event_id` FK (skipped with a logged warning if that pool is absent). Accumulated across categories + bulk-inserted in 1000-row chunks so the `vendor_review_stats` matview (refreshed per INSERT statement) refreshes only a few times. Ratings surface via that view; reviews cascade-delete with the batch's vendors.
2. **District-level addresses.** New per-city district pool (Makati→Poblacion/Salcedo/…, Cebu→Lahug/Banilad/…); `hq_address` becomes `"{District}, {City}, Philippines"` (real lat-lng unchanged).
3. **Real-looking names.** Dropped the `Demo ·` business-name prefix. `is_demo=TRUE` (the flag, not the name) still drives `/admin/demo-vendors`, marketplace exclusion, and `?demo=1`; slugs still start `demo-`.

**SPEC IMPACT:** None — synthetic demo/simulation data only (no schema, SKU, or workflow change; reuses the existing `vendor_reviews` table + `TEST-REVIEW · %` event pool).

**Verification:** `tsc --noEmit` + `next lint` green. Offline harness (400 vendors): clean invariants (ratings 1-5, `couple_user_id` null, `event_id` from pool, reply/reply_at consistent), 15% zero-review vendors, per-vendor mean ⭐ spread 3.0–5.0 (clear differentiation), positive skew. **Owner-actionable:** run the seed on **staging** then check `/vendors?demo=1&sort=highest_rated` + the compare view's Rating row + a demo `/v/[slug]` (no prefix, district address). The "best match" recommender (the 4th owner ask) is a separate follow-up that builds on these ratings.

## 2026-06-03 · feat(guests): draggable panel sheet — snap-to-close + per-panel content height

**Context:** Owner — "I want the collapse to animate and also draggable with snap to close. Opening it will only open up the needed height of the carousel, depends on the input included." The sheet collapsed/expanded via a tap on the grabber to a fixed height (`--gcar-h` 280px). Two upgrades requested: a real drag gesture, and an open height that fits each panel rather than a fixed third of the screen.

**What changed (`apps/web/app/dashboard/[eventId]/guests/_components/mobile-guest-carousel.tsx`):**
- **Per-panel open height** — the sheet now opens to a height sized to the active panel (`PANEL_OPEN_H = [200, 108, 196, 196]` for Summary · Search · Add · Customize, incl. the 36px grabber), instead of a single `--gcar-h`. Search (one compose-bar row) opens short; Summary (2×2 count grid) opens taller. Switching panels animates the height. Each panel is `overflow-y-auto` so content never clips if a height is slightly tight.
- **Draggable grabber with snap** — pointer-drag on the grabber tracks the finger live (transition disabled mid-drag), and on release snaps to whichever end (open or collapsed/grabber-only) the drag finished nearer; a tap still toggles. `touch-none` on the grabber stops the page scrolling mid-drag; `setPointerCapture` keeps the drag tracking past the handle.
- **List reflows in sync** — the in-flow spacer mirrors the sheet's resting height, so the guest list bottom-padding tracks the panel (builds on #857).
- **Keyboard path preserved** — the `kbOpen` docked heights (190/84) + the iOS tap-delivery fix (spacer not collapsed when the keyboard is up) are untouched. Horizontal swipe between panels is unchanged.

**Verification:** Reviewed for type-soundness (`React.PointerEvent` handlers mirror the file's existing `React.KeyboardEvent` usage; all heights are deterministic constants — no runtime measurement). CI (typecheck + production build) is the gate before merge; on-device feel (drag threshold, per-panel heights) to be confirmed by owner on the Vercel prod deploy, since the dashboard is auth-gated and can't render without Supabase env locally.

**SPEC IMPACT:** None — interaction polish on an existing surface; no SKU, schema, copy, or workflow change.

---

## 2026-06-03 · feat(marketplace): demo vendors get real per-category details, richer packages & images

**Commit:** see merge commit on this PR.

**Context:** Owner — the admin **Demo Vendors** tool (`/admin/demo-vendors`) seeds ~1,500 synthetic vendors to dogfood the marketplace. They flagged that demo vendors should *"provide the details and customization for each of the categories as well."* The seed (`scripts/seed-demo-vendors.ts`) was writing **one identical 5-field blob** for all 192 canonical_services and **hard-coding** `completeness_score:75` + `meets_visibility_minimum:true` — bypassing the iteration-0044 per-category schema entirely. The blob even filled a key named `geographic_service_areas` (a shared-*group* name) instead of the real `service_regions` minimum field, so honestly scored every demo row was 0% complete / below the visibility minimum.

**What ships:**

1. **Schema-driven attribute generator (`scripts/seed-demo-vendors.ts`).** New `fetchResolvedSchemas()` loads every `canonical_service_schemas` row + its inherited `shared_attribute_groups` and merges them exactly like `lib/vendor-service-attributes.ts#fetchSchemaWithSharedGroups`. `generateAttributePayload()` emits realistic, schema-valid values per field type (enum→one option · multi_select→a subset · int→field-name-aware bands with `*_centavos` aligned to the vendor's package price · text→category snippet · `*_urls`→real YouTube/Vimeo that pass the showcase validator · `required_if` honored). `completeness_score` + `meets_visibility_minimum` are now computed **honestly** (mirroring `compute_attribute_completeness` + the write-side visibility gate); minimum/required fields are always filled (so vendors stay visible — now *earned*) while ~18% of optional fields are left unset for realistic ~80-100 variance.
2. **Broader package coverage (`priceProfileFor()`).** Seven new category buckets (beauty/wellness · experiential booths & stations · live-craft keepsakes · bridal accessories · ceremony prep/paperwork · rentals & site infra · food carts/dessert stations) so niche services get category-appropriate package tiers + inclusions instead of the generic "Standard/Premium" catch-all. (Third-party vendor prices, not Setnayan SKUs.)
3. **Demo images.** The seed sets `logo_url` + `portfolio_r2_keys[]` to deterministic picsum URLs. `app/vendors/_components/vendor-card.tsx`'s `isOptimizableImageUrl()` now allows `picsum.photos` / `fastly.picsum.photos` (already whitelisted in `next.config.ts` + used by the moodboard seed) so demo logos render as the card banner instead of falling back to initials. (`finalized-chip-strip.tsx` already accepted any https host — no change.)
4. **Public vendor profile render (`app/v/[slug]/page.tsx`).** Added a **Details** section (per-category attributes as label→value facts + true-boolean capability chips; pricing-signal keys omitted as redundant with Packages) and a **Portfolio** gallery (resolves `portfolio_r2_keys` via `displayUrlForStoredAsset`). Reuses `fetchVendorServiceAttributes` + `fetchSchemaWithSharedGroups`; both fetches are best-effort (degrade to empty). Benefits real vendors too — `attribute_payload` previously had no public render at all (filter/compare only).

**SPEC IMPACT:** Minor. The public vendor profile (`/v/[slug]`) now renders a per-category **Details** section + a **Portfolio** gallery — iteration **0044** (per-category schemas) + **0022** (vendor dashboard/profile) specs should note these surfaces. Demo-data generation + the picsum card-guard allowance are dev/staging tooling (non-spec). `[PENDING]` logged in `COWORK_INBOX.md`.

**Verification:** `tsc --noEmit` + `next lint` green in-worktree. An offline generator harness (catering schema + the 5 shared groups, 8 vendors) confirmed: every visibility-minimum field filled incl. `service_regions`, avg completeness ~82, `required_if` enforced (paid_tasting⇒tasting_fee, willing_to_travel⇒dest_fee). **Owner-actionable:** the full seed run is on **staging** (script refuses prod via the project-ref guard; needs a non-prod `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) — then visual-check `/admin/demo-vendors`, `/vendors?demo=1` (logos on cards), and a demo `/v/[slug]` (Details + gallery). CI gates types/lint/production build.

---

## 2026-06-03 · polish(guests): collapse/expand animates the guest list in sync with the panel sheet

**Context:** Owner — "we want the collapse to have animation and expansion." The panel sheet already animated its own height (`transition-[height] duration-200 ease-out`, #854), but the **in-flow spacer** that reserves room for the sheet had no transition — so on collapse/expand the sheet slid smoothly while the guest list area *snapped* instantly. The gesture read as half-animated.

**What changed (`apps/web/app/dashboard/[eventId]/guests/_components/mobile-guest-carousel.tsx`):** Added the same `transition-[height] duration-200 ease-out` to the spacer `<div>` so its height animates in lockstep with the sheet. Now both the sheet and the list reflow ease over the same 200ms — collapse and expand are one cohesive motion. The keyboard-open path is untouched (the spacer still holds full height when `kbOpen`, preserving the iOS tap-delivery fix from earlier today).

**Verification:** Confirmed the sheet's existing height transition fires both directions (concrete 280px ↔ 2.25rem, not `auto`, so it animates); the spacer's only height change is collapse↔expand, so the added transition animates exactly that and nothing else. Visual confirmation via the Vercel prod deploy (auth-gated page; no local Supabase env).

**SPEC IMPACT:** None — animation polish; no SKU, schema, copy, or workflow change.

---

## 2026-06-03 · fix(guests): remove the redundant mobile "+" add FAB (leftover behind the panel sheet)

**Commit:** see merge commit on this PR.

**Context:** Owner screenshot — a mulberry "+" floating action button was still rendering on the mobile Guests page, peeking out from behind the collapsed panel sheet near the **Customize** nav item. It's a leftover: the FAB (`fixed bottom-20 right-4 z-30 … bg-mulberry … sm:hidden`) was the old mobile trigger for `QuickAddSheet`, but mobile adding is now handled by the carousel's **Add** panel (`QuickAddInlineForm`). At `z-30` it sat *behind* the `z-40` sheet, so only a sliver showed.

**What changed (`apps/web/app/dashboard/[eventId]/guests/_components/quick-add-sheet.tsx`):** Removed the mobile FAB `<button>` (and its now-unused `Plus` import). `QuickAddSheet` itself is unchanged and still opens on **desktop** via `OpenQuickAddButton` → `OPEN_EVENT` (the header is `lg:flex`, desktop-only), so desktop add is untouched; mobile add continues through the carousel Add panel. Replaced the removed markup with a comment documenting why there is no mobile FAB.

**Verification:** Confirmed the FAB was the only `setOpen(true)` on mobile and that the desktop event-listener trigger remains; grep confirms no other `Plus` reference and no second bottom-anchored FAB in the guests dir. Visual confirmation via the Vercel prod deploy (auth-gated page; no local Supabase env).

**SPEC IMPACT:** None — dead-UI removal; no SKU, schema, copy, or workflow change.

---

## 2026-06-03 · fix(guests): clearer collapse grabber — chevron + animated height

**Commit:** see merge commit on this PR.

**Context:** Follow-up to the collapsible Guests panel (PR #850). The collapse mechanism works (verified in an isolated repro — tap → sheet shrinks to the handle, guest list stretches), but the grabber was a single faint `bg-ink/15` pill with an instant (un-animated) height change, so the affordance was easy to miss and the collapse hard to notice ("does not collapse"). Make it unmistakable.

**What ships (`mobile-guest-carousel.tsx`):** (1) the grabber gains a **chevron** (`ChevronDown`, rotates 180° when collapsed) beside a more-visible `bg-ink/25` pill, in `text-ink/40` with an `active:` press state — clearly a tap-to-collapse control; (2) the sheet **animates** its height (`transition-[height] duration-200 ease-out`) so collapse/expand visibly slides — gated on `!kbOpen` so the iOS keyboard-pin (PR #841) stays instant with no typing jank.

**SPEC IMPACT:** None (affordance + animation polish on the PR #850 collapse).

**Verification:** Type-safe by inspection (chevron import + a rotate class + a conditional transition class). Flagged for owner preview check. CI gates types/lint/build.

## 2026-06-03 · refactor(onboarding): unique `.onbw` CSS scope for the wedding onboarding flow (was global `.pba`) — kills the collision at the source

**Commit:** see merge commit on this PR.

**Context:** Follow-up hardening to the `fix(services)` entry below. The wedding onboarding flow ships a **global** stylesheet (`apps/web/app/onboarding/wedding/_styles/onboarding.css`, imported in `onboarding-shell.tsx`) that scoped every rule under the generic class `.pba` — including `.pba{display:flex;justify-content:center}` plus a `.pba *{margin:0;padding:0}` reset on its root. A plain `.css` import in the App Router is global and persists app-wide, so that `.pba` could leak onto any other surface using the same class. It already did once (the Services Plan+Budget accordion, fixed by renaming that surface to `.pbacc`). This change removes the root cause so it can't recur.

**What changed:**

- **`onboarding.css`** — renamed the scope `.pba` → `.onbw` (onboarding-wedding) across all 525 selectors (whole-token swap; verified there are no `.pba`-prefixed substring classes like `.pblock`, so nothing else was touched). Expanded the file header to document the `.onbw` scope, the collision history, and the re-scope instruction ("prepend `.onbw` to every rule") for future ports.
- **`onboarding-shell.tsx`** — the single root `className="pba"` → `"onbw"`; updated its two header-comment references.
- The locked prototype `Onboarding_Wedding_Flow_2026-06-01.html` is **unchanged** — it never used `.pba` (it scopes under `.phone`/`body`); the `.pba` prefix was only added during the manual re-scope/port step, so just the code + its porter-facing comments needed updating. No Cowork edit required.

**Verification:** `tsc --noEmit` clean; `next lint` clean for the onboarding files. Real-browser render check (the actual renamed CSS inlined against a representative `.onbw > .phone > .top/.body/.bottom` structure): the `.onbw` scope correctly styles the phone frame (430px), gold progress bar, the screen heading + chips, and the mulberry Continue CTA — rendering is identical to before (same rules, new scope name). App-wide grep confirms `.pba` is dead as a live class (remaining mentions are explanatory comments only); `.onbw` (onboarding) and `.pbacc` (accordion) are now distinct, collision-proof scopes.

**SPEC IMPACT:** None — pure CSS-scoping refactor; no SKU, schema, copy, or workflow change. Resolves the latent architecture risk flagged in the `fix(services)` entry below.

---

## 2026-06-03 · fix(services): Plan+Budget budget-bar rendered as a left side-nav — `.pba` CSS scope collided with onboarding's global stylesheet

**Commit:** see merge commit on this PR.

**Context:** Owner reported the couple **Services** tab's dark "budget bar" rendering as a vertical **side-nav on the left** instead of a top row (mobile screenshot, setnayan.com). Root cause is a global-CSS class-name collision. The Plan+Budget accordion (`plan-budget-accordion.tsx`) scopes its injected `<style>` under `.pba`. The wedding onboarding flow's **global** stylesheet (`apps/web/app/onboarding/wedding/_styles/onboarding.css`, imported in `onboarding-shell.tsx`) *also* scoped under `.pba` and set `.pba{display:flex;justify-content:center}` plus a `.pba *{margin:0;padding:0}` reset on its root. A plain `.css` import in the App Router is global and persists app-wide once loaded, so that leaked `display:flex` turned the accordion's sticky top budget bar into a stretched flex-**column** on the left (the cover content became the right column). The accordion's own `.pba` rule set `position:relative` but never `display`, so it could not override the leak.

**What changed (`plan-budget-accordion.tsx`):** Renamed the accordion's CSS scope `.pba` → `.pbacc` (Plan-Budget-ACCordion) — every selector in the injected `PBA_CSS` string (226 scope tokens) plus the root element's `className`. `.pba` and `.pbacc` are distinct class tokens, so onboarding's `.pba{display:flex}` / `.pba *{…}` no longer match the accordion root or its descendants, and the surface reverts to its intended block layout with the budget bar pinned on top. Added a prominent header comment documenting why it must NOT be renamed back. (The onboarding side is hardened separately in the `refactor(onboarding)` entry above — both surfaces now own unique scopes.)

**Verification:** Reproduced the exact bug and confirmed the fix in a real browser — an isolated repro of onboarding's global `.pba` leak against the accordion's real top-bar markup: root `.pba` → black bar becomes a left column (matches the report); root `.pbacc` → black bar correctly on top. `tsc --noEmit` clean; `next lint` clean for the changed file.

**SPEC IMPACT:** None — pure CSS-scoping bugfix; no SKU, schema, copy, or workflow change.

---

## 2026-06-03 · tweak(guests): fixed 280px height for the mobile panel sheet (was a screen-proportion clamp)

**Commit:** see merge commit on this PR.

**Context:** Owner — set the lower carousel (the 4-panel sheet on the mobile Guests page) to a concrete height instead of a fraction of the screen. The previous value `clamp(208px, 33vh, 288px)` only approximated "a third": it capped at 288px on tall phones (less than a third) and floored at 208px on short ones (more than a third), so the sheet height drifted by device.

**What changed (`apps/web/app/dashboard/[eventId]/guests/page.tsx`):** `--gcar-h` (the sheet's *expanded* height — the collapse feature from the entry below still toggles between this and the 2.25rem grabber) is now a fixed `280px`. Sized to the tallest panel (**Find**: search + Side/RSVP toggles + Role/Group + Sort), which the design requires to fit without vertical scroll; 280px sits right at the old clamp's upper bound, so it's a proven-good size. The sheet's own 36px grabber leaves ~244px of panel area — enough for the Find panel in the common (no custom tags) case; the rarer with-tags variant falls back to the panel's existing internal scroll.

**Verification:** Type-trivial string-literal swap inside an existing `style` object (no logic/type surface). Visual confirmation deferred to the Vercel PR preview (local dev can't render the auth-gated dashboard without Supabase env).

**SPEC IMPACT:** None — sizing tweak only; no SKU, schema, copy, or workflow change. Aligns with the existing "lower-third carousel" owner directive captured in the component header.

---

## 2026-06-03 · feat(guests): collapsible mobile panel — tap the grabber to stretch the guest list

**Commit:** see merge commit on this PR.

**Context:** Owner — the mobile Guests panel sheet (the 4-panel carousel docked at the bottom) eats ~⅓ of the screen even when you just want to read the list. Add a **collapse** so the sheet drops back to its grabber handle and the **guest list above stretches**.

**What ships (`mobile-guest-carousel.tsx` · mobile-only):** a `collapsed` state + a **tappable grabber handle** at the top of the sheet. Collapsed → the fixed sheet shrinks to the 36px (`2.25rem`) handle and the in-flow spacer shrinks to match (`calc(2.25rem + 4rem + safe-area)`), so the guest list reclaims the freed height; tap again to expand back to `--gcar-h`. The sheet became `flex flex-col` (grabber `shrink-0` + the swipe track now `flex-1 min-h-0`). **Keyboard state still wins** — the grabber is hidden and collapse is ignored while typing (the `kbOpen` branch is checked first in both the sheet + spacer style, and the handle is gated on `!kbOpen`), so the iOS-keyboard pin (PR #841) is untouched. Desktop unaffected (the sheet is `lg:hidden`).

**SPEC IMPACT:** None (additive mobile UX on an existing surface; the 0001/0021 specs don't pin the panel height).

**Verification:** Type-safe by inspection (one `useState<boolean>`; the style branches return valid `CSSProperties`; `aria-expanded` boolean). The collapse interaction is flagged for **owner check on the Vercel preview**. Local typecheck not runnable in this worktree → CI gates types/lint/build.

## 2026-06-03 · fix(services): center-snap runway so the first & last category cards can reach center

**Commit:** see merge commit on this PR.

**Context:** Owner report — on the couple's **Services** list (the Plan+Budget accordion category rails), the **first and last cards could never snap to center**. With `scroll-snap-align: center` and a flat `padding: 0 20px` on the rail, the first card stuck at the left edge and the last at the right — neither had the scroll runway to reach the center snap point.

**What ships (`plan-budget-accordion.tsx` · 1 CSS rule):** `.pba .rail` inline padding `0 20px` → **`0 max(20px, calc(50% - 150px))`** (150px = half a 300px `.card`). That gives each rail half-a-rail-minus-half-a-card of leading/trailing runway, so the first and last cards now have room to scroll to `scroll-snap-align: center`. `max(20px, …)` preserves the old 20px minimum on narrow rails where the calc goes ≤ 0. No JS / markup / snap-type change — `scroll-snap-type: x mandatory` + the per-card `center` align are untouched.

**SPEC IMPACT:** None (CSS-only snap-runway fix on an existing surface).

**Verification:** CSS-only; `calc()` / `max()` are valid padding values. The visual snap is flagged for owner check on the Vercel preview (first/last card now reach center). Local typecheck not runnable in this worktree (no `node_modules`) → CI gates types/lint/build.

## 2026-06-03 · feat(schedule): typed Preparation items — vendors/couples place meeting & payment schedules

**Commit:** see merge commit on this PR.

**Context:** Owner follow-up to PR #845 (hybrid Preparation items). #845 let couples + booked vendors place **generic** dated tasks on the couple's `/dashboard/[eventId]/schedule` **Preparation** agenda (backed by `event_preparation_items`, with working RLS: couple full CRUD via `current_couple_event_ids()`; booked vendors INSERT/manage their own via `current_vendor_ids()` gated to accepted `chat_threads`). The owner asked that those hand-added items be able to be **typed** — specifically **meeting schedules** and **payment schedules**, not only generic tasks — so they read on the agenda with the same Meeting / Payment vocabulary as the autofilled `vendor_meetings` / vendor-payment rows.

**What ships:**

- **Typed items end-to-end.** A couple or a booked vendor can now place a **Task** (as before), a **Meeting**, or a **Payment** on the Preparation schedule. Meeting items render with the SAME Meeting tag/icon (indigo `Users`) as the autofilled `vendor_meetings`; Payment items render with the SAME Payment tag/icon (amber `Wallet`) **plus the ₱ amount**, formatted exactly like the autofilled vendor-payment rows; Task items keep the prior manual style (mulberry `ListPlus`, "Added by you" / "From {vendor}" chip).
- **`lib/preparation.ts`** — `fetchManualItems` + `fetchVendorPreparationItemsByEvent` now `SELECT *` (so the new columns can't error a pre-migration query) and read `kind = row.kind ?? 'task'` + `amount = row.amount_php ?? null`. New `PreparationItemKind` type + `kind`/`amountPhp` on the existing `PreparationItem` shape; the `isManual`/`canDelete`/`itemId`/`sourceLabel` logic from #845 is preserved verbatim. **GRACEFUL DEGRADE preserved twice over:** if the new columns are absent (pre-migration) every row coalesces to `kind='task'`/`amount=null`; if the whole table is absent (pre-#845) the source still catches `42P01` and returns `[]` (autofill-only).
- **Agenda rendering (`preparation-agenda.tsx`)** — a presentational `displaySourceFor()` maps a manual row's `kind` to the autofill visual (meeting→Meeting, payment→Payment, task→manual) and `chipLabelFor()` labels typed rows "Meeting"/"Payment" (their "added by you / a vendor" context moves to the subtitle); the amount renders through the existing `amountPhp` slot. The row stays `source:'manual'` so the delete control still shows on manual/vendor rows only. Autofill rows are visually unchanged.
- **Couple add UI (`prep-item-controls.tsx`)** + **Vendor add UI (`vendor-prep-add.tsx`)** — both modals gain a shared **Task / Meeting / Payment** segmented picker (new `prep-kind-picker.tsx`, imported across the dashboard↔vendor boundary so there's one source of truth) and a conditional **Amount (₱)** field shown only for Payment. Field copy adapts per type (e.g. "Meeting title" / "What is this payment for?" + "Due date"). The vendor's "already added" list now shows a Meeting/Payment glyph + the amount inline.
- **Server actions** — `addPreparationItem` (couple) + `vendorAddPreparationItem` (vendor) gain `kind` + optional `amountPhp`; they stamp `kind` and `amount_php` (payment only), validate amount **> 0** for payments, and keep the existing label/date validation, `source_tag` stamping (`couple_manual` / `vendor_prep`), own-`vendor_profile_id` stamping, RLS-reliant authz + accepted-thread gate, and `revalidatePath`.

**NEW migration — `supabase/migrations/20260730000000_event_preparation_item_kinds.sql` (owner-push; graceful-degrade until applied):** additive `ALTER TABLE public.event_preparation_items ADD COLUMN IF NOT EXISTS kind VARCHAR(16) NOT NULL DEFAULT 'task' CHECK (kind IN ('task','meeting','payment'))` + `amount_php NUMERIC(12,2) CHECK (amount_php IS NULL OR amount_php >= 0)`. **No RLS change** — #845's existing row-level policies already cover the new columns. Confirmed `20260729000000_event_preparation_items.sql` was the latest migration before this, so `20260730000000` is correctly the newest. **Do NOT auto-push** — owner pushes.

**Schema reason (why this is on `event_preparation_items`, not the budget / meetings tables):** the existing `event_vendor_line_items` (budget payments) and `vendor_meetings` tables both key to `event_vendors` (the couple's TEXT-named vendor record) via `vendor_id`, **not** to the platform `vendor_profile_id`. A platform vendor cannot be RLS-scoped to those rows, so a vendor can't safely write to them. `event_preparation_items` already carries the correct `vendor_profile_id` RLS from #845, so typed items live there.

**Known limitation (possible follow-up):** a vendor- or couple-placed **payment** here shows on the **Preparation schedule** only — it does **NOT** post to the couple's **Budget ledger** (`event_vendor_line_items` / `event_vendor_payments`, iteration 0007). It's a planning reminder, not an accounting entry. Wiring prep-payments into the budget ledger (or vice-versa) is a deliberate non-goal of this PR and a candidate fast-follow.

**Files:**
- `supabase/migrations/20260730000000_event_preparation_item_kinds.sql` (new — additive ALTER)
- `apps/web/lib/preparation.ts` (`kind`/`amountPhp` on `PreparationItem` + `VendorAddedPrepItem`; `SELECT *` + coalesced reads)
- `apps/web/app/dashboard/[eventId]/schedule/_components/preparation-agenda.tsx` (`displaySourceFor`/`chipLabelFor` typed rendering)
- `apps/web/app/dashboard/[eventId]/schedule/_components/prep-kind-picker.tsx` (new — shared Task/Meeting/Payment segmented control)
- `apps/web/app/dashboard/[eventId]/schedule/_components/prep-item-controls.tsx` (couple modal: picker + amount field)
- `apps/web/app/dashboard/[eventId]/schedule/prep-actions.ts` (couple action: `kind` + `amountPhp`)
- `apps/web/app/vendor-dashboard/bookings/_components/vendor-prep-add.tsx` (vendor modal: picker + amount field + typed "added" list)
- `apps/web/app/vendor-dashboard/bookings/actions.ts` (vendor action: `kind` + `amountPhp`)
- `apps/web/app/vendor-dashboard/bookings/page.tsx` (map `kind`/`amountPhp` through to the vendor control)

**Verification:** `pnpm -F web typecheck` → 0 errors. `pnpm exec next lint --file <all 8 changed files>` → clean. `pnpm -F web build` → compiled successfully. (Pre-existing build warnings in untouched files — `<img>`, exhaustive-deps, sitemap/vendor-dashboard env-var notes — are unrelated to these changes.)

**SPEC IMPACT:** Yes — 0021 (Schedule surface: Preparation items can now be typed Meeting/Payment), 0022 (vendor can place typed meeting/payment items from Bookings), and a 0007 note (prep-payments are NOT budget-ledger entries). Logged in `COWORK_INBOX.md`.

---

## 2026-06-03 · fix(onboarding): congrats vendor stat → real marketplace counts

**Commit:** see merge commit on this PR.

**Context:** The `/onboarding/wedding` congrats screen (step 13, "You did the hard part") rendered a third stat tile reading **"N best-fit vendors from 2,400+"** where `N` was fabricated as `max(picked_categories × 5, 12)` and "2,400+" was a hardcoded string — neither was a real count. Owner 2026-06-03, re-raised from a live screenshot showing "30 … from 2,400+": *"30 vendors and total 2400+ vendors is not actual results. want true results only."* This ships the **never-merged** fix originally written on `claude/onb-real-vendor-counts` (commit `4af4f6c` — it had no PR and went 66 commits stale, which is why the live site still showed the fake numbers); cherry-picked clean onto current `main` and re-verified.

**What ships:**

- **NEW server action `getOnboardingVendorCounts` (`app/onboarding/wedding/actions.ts`)** — criteria-based (NO `eventId`; congrats renders before the event row is committed, mirroring `searchOnboardingReceptionVenues`). Two exact head-counts off `vendor_market_stats`: `total` = published vendors (`public_visibility ∈ {verified, coming_soon}` + non-empty `business_name`) across the canonical services of the couple's picked categories; `matched` = that same pool narrowed by NULL-safe ceremony/venue compatibility (admit-never-exclude). This is the **identical published-pool definition** the `/vendors` marketplace + Services tab use (`lib/vendor-counts.ts`), so the tile agrees with what the couple actually sees in the marketplace.
- **Tile now renders real counts** — `{matched}` + "that fit your wedding · from {total}" (thousands-formatted). **AUTO-HIDES** when a count can't be computed (query error, or `total ≤ 0`, or `matched ≤ 0` so it never shows a discouraging "0 fit you") — never fabricates (RA 10173 honesty).
- **Removed the fabricated source** — dropped `VENDORS_PER_CATEGORY` + the `vendors` field from `computeOnboardingSavings`. The **money + hours** tiles are UNCHANGED (approved Time & Money Saved model; owner objected only to the vendor tile). Fetched once on step-13 entry via a guarded `useEffect`.

**Files:**
- `apps/web/app/onboarding/wedding/actions.ts` (new `getOnboardingVendorCounts` + canonical-service resolver)
- `apps/web/app/onboarding/wedding/_components/onboarding-shell.tsx` (fetch on step-13, real-count tile w/ auto-hide, drop fabricated field)

**Verification:** `pnpm -F web typecheck` → 0 errors. `pnpm -F web lint` → no new warnings (remaining are pre-existing, in untouched files). Dependency + column audit on current `main`: `PLAN_GROUPS`, `canonicalServicesForTile/Folder`, `ALLOWED_CEREMONIES/SECONDARY`, `RECEPTION_TO_VENUE_SETTING`, `PICK_TO_GROUP`, `createAdminClient` all present; `vendor_market_stats` published-pool columns match `lib/vendor-counts.ts`. No migration.

**SPEC IMPACT: Yes.** The fabricated copy lives in the spec corpus (`Onboarding_Wedding_Flow_2026-06-01.html` tile + `Time_and_Money_Saved_Model_2026-06-01.md` "2,400-vendor pool" / "filtered N vendors" notes). Cowork worklist entry appended.

---

## 2026-06-03 · fix(photo-delivery): make "Release to Drive" actually copy — cron-free via after()

**Commit:** to be filled after commit.

**Context:** Follow-up to the Drive-copy phases. The 0009 Photo Delivery "Release to Drive" button enqueued photos but relied on `/api/cron/photo-delivery-tick` to copy them — and **that cron has no scheduler wired** (no `vercel.json` crons, no scheduled Actions), so in prod the release never actually delivered. Same dormant-cron problem the Phase 2 rework fixed for capture auto-sync.

**What ships:**

- **`releasePhotoDelivery`** (`add-ons/photo-delivery/actions.ts`) — after `enqueueRelease`, drains the release in the **background with `after()`** (loops `processBatchForEvent` up to 40 batches, then returns; any remainder drains on the next release or a capture's own auto-sync). The action returns immediately; best-effort, never blocks the UI.
- **`oauth-refresh` cron** — left as-is, documented as **redundant**: the Drive token consumers (`getEventDriveAccessToken`, `ensureFreshAccessToken`) already refresh the access token **on-demand**, which is the cron-free equivalent. Not relied upon.

**Net:** the whole Drive surface is now genuinely cron-free — capture auto-sync (Phase 2) and manual release (this PR) both copy via `after()`; the 2 dormant cron endpoints are unused.

**Pilot-safe:** one server action gains a bounded background drain; no schema, no new owner action, no cron.

**SPEC IMPACT:** Minor — closes the gap that 0009 Photo Delivery never actually copied in prod. COWORK note for the 0009 cron→`after()` wording.

---

## 2026-06-03 · feat(schedule): hybrid Preparation — couple + vendor manual items

**Commit:** see merge commit on this PR.

**Context:** Completes the Preparation hybrid the owner asked for after the 2026-06-03 chrome-redesign delta #3 (PR #840). #840 shipped the couple's `/schedule` **Preparation** mode as a READ-ONLY auto-aggregation (`lib/preparation.ts` merges vendor payment due dates, paperwork deadlines, vendor meetings, statutory milestones) and explicitly DEFERRED manual entry to a fast-follow needing a new table (logged in `COWORK_INBOX.md` [PENDING] 2026-06-03). This PR ships that deferred manual-entry layer **and** adds a vendor-add path: (a) the couple can add their own dated prep items + delete items (incl. dismissing vendor-added ones); (b) booked vendors can push items onto the couple's prep schedule from their Bookings view. The autofill is untouched; the new rows merge into the same date-sorted, month-grouped agenda.

**What ships:**

- **NEW source in `lib/preparation.ts`** — `fetchManualItems(eventId)` reads `event_preparation_items` and maps each row to the EXISTING `PreparationItem` shape (`date`=`due_date`, `label`→`title`, per-row chip `sourceLabel`: "Added by you" for `couple_manual` / "From {vendor business name}" for `vendor_prep` — `vendor_profiles.business_name` joined; carries `itemId` + `isManual` so the agenda renders a delete control). Merged into `fetchPreparationAgenda`'s `Promise.all` + `sourceCounts`. New `'manual'` member on `PreparationSource` (icon `ListPlus`, mulberry accent). **GRACEFUL DEGRADE:** the new source catches `42P01` (and any error) → returns `[]`, so the agenda still renders autofill-only before the migration is pushed.
- **Couple add/delete UI** — a "+ Add to schedule" control on the Preparation agenda (+ in the empty state) opens the canonical Setnayan modal (bottom-sheet on mobile via `items-end → sm:items-center`, ESC + backdrop dismiss) with fields label / date / optional notes → `addPreparationItem`. Deletable rows (the `event_preparation_items` rows only — NOT autofill rows) get an inline `Trash2` → `deletePreparationItem`.
- **Vendor add/delete UI** — on `/vendor-dashboard/bookings`, each **accepted** booking gets an "Add to prep schedule" control + a list of the items that vendor has added (with per-item delete). `vendorAddPreparationItem` stamps `source_tag='vendor_prep'` + the vendor's own `vendor_profile_id`; gated to accepted threads in the action (RLS also enforces). `vendorDeletePreparationItem` removes the vendor's own rows.
- **Server actions** — input validation (label 1–200, valid `YYYY-MM-DD`; past dates allowed so they surface as "overdue"), correct field stamping, RLS-reliant authz, `revalidatePath`, graceful error surfacing to the form.
- **Token fix (incidental):** swapped three latent `bg-paper` classes (undefined token, silently no-op'd in #840) → `bg-cream` in the agenda month-header + meeting/milestone row + empty-state buttons. Purely additive cosmetics.

**NEW migration — `supabase/migrations/20260729000000_event_preparation_items.sql` (owner-push; graceful-degrade until applied):** additive `event_preparation_items` table (`item_id` PK, `event_id`→`events`, nullable `vendor_profile_id`→`vendor_profiles` (NULL = couple-added), `due_date`, `label` CHECK 1–200, `notes`, `source_tag` default `couple_manual`, `created_by`→`users`, timestamps), 2 indexes, RLS-at-create. **RLS model:** couple = full CRUD on their own event's items via `current_couple_event_ids()` (incl. deleting vendor-added rows); vendor = SELECT items they authored OR for events with an `accepted` `chat_threads` row; INSERT only for accepted-thread events stamping their own `vendor_profile_id`; UPDATE/DELETE only their own rows (all via `current_vendor_ids()`). **Schema verified against migrations** — all column/helper names in the supplied SQL matched the live schema (`events(event_id)`, `vendor_profiles(vendor_profile_id)`, `users(user_id)`, `current_couple_event_ids()` + `current_vendor_ids()` both GRANTed to authenticated, `chat_threads.vendor_profile_id` + `inquiry_status='accepted'`); **no column-name fixes needed.** Wrapped in `BEGIN/COMMIT` + idempotent guards to match repo migration convention. **Do NOT auto-push** — owner pushes.

**Files:**
- `supabase/migrations/20260729000000_event_preparation_items.sql` (new)
- `apps/web/lib/preparation.ts` (new `manual` source + `fetchManualItems` + `fetchVendorPreparationItemsByEvent` + type extensions)
- `apps/web/app/dashboard/[eventId]/schedule/prep-actions.ts` (new — couple add/delete actions)
- `apps/web/app/dashboard/[eventId]/schedule/_components/prep-item-controls.tsx` (new — couple add modal + delete button)
- `apps/web/app/dashboard/[eventId]/schedule/_components/preparation-agenda.tsx` (wire controls + `manual` styling + per-row delete + chip override)
- `apps/web/app/vendor-dashboard/bookings/actions.ts` (new — vendor add/delete actions)
- `apps/web/app/vendor-dashboard/bookings/_components/vendor-prep-add.tsx` (new — vendor add modal + per-item delete)
- `apps/web/app/vendor-dashboard/bookings/page.tsx` (fetch vendor items + render control on accepted bookings)

**Verification:** `pnpm -F web typecheck` → 0 errors. `pnpm exec next lint --file <changed>` → no warnings or errors. `pnpm -F web build` → ✓ Compiled successfully, 113/113 pages generated (remaining warnings are all pre-existing, in untouched files: `<img>`, exhaustive-deps, a11y on other pages; the sitemap/`vendor-dashboard` "dynamic server usage / missing SUPABASE env" lines are expected env-less static-gen noise).

**SPEC IMPACT: Yes.** New `event_preparation_items` table + hybrid Preparation behavior touches: **0021** (couple dashboard / Schedule surface — Preparation is now hybrid, not read-only); **0007** (budget) + **0016** (Concierge) schedule cross-refs; **0006** (vendors) + **0022** (vendor dashboard — booked vendors can add prep items). Cowork worklist entry appended; supersedes the deferral in the #840 [PENDING].

---

## 2026-06-03 · feat(drive-copy): Phase 2 — Papic auto-sync feeder (cron-free, via after())

**Commit:** to be filled after commit.

**Context:** Phase 2 of the storage build plan. **Finding:** 5 of the 6 source services (Patiktok, Pabati, Pakanta, Monogram, QR) have no R2-artifact pipeline yet (stubs / client-side), so there is nothing to feed for them — one-line `pushToDriveCopy(...)` calls land with each future pipeline. **Papic** is the one real producer and is wired now.

**Cron-free** — the repo's 2 existing cron endpoints have no scheduler (no `vercel.json` crons, no scheduled Actions), so a polling cron would've been dead on arrival. The drain runs in the background of the capture request via Next 15 `after()`.

**What ships:**

- **Papic auto-sync feeders** — `papic/actions.ts` (paparazzo capture) + `api/papic/guest-capture` (guest disposable camera): `enqueueDriveCopy('papic', …)` then `after(() => runDriveCopyBatch({ eventId }))`. The response returns immediately; the R2→Drive copy runs in the background. No-op until Drive is connected; best-effort (never fails a capture).
- **Folder unify** — `drive-copy.ts` routes `papic` artifacts to the couple's existing `events.photo_delivery_folder_id` (same folder as the manual "Release to Drive" worker).
- **Dedup** — `enqueueRelease` skips photos already auto-synced (matched on `r2_object_key`); it also backfills anything a dropped background task missed.
- **Latent fix** — `readR2Object` strips a leading `r2://<bucket>/` prefix (also fixes the existing release worker for prefixed papic keys).

**Pilot-safe:** best-effort + enqueue-first (the row persists even if the background copy is dropped); manual release still works + dedups. No migration. No cron. No new owner action.

**SPEC IMPACT:** Yes (minor). Papic auto-syncs to Drive (the pax-pricing "photos land in your Drive" behavior), cron-free. The other 5 feeders attach as their pipelines land.

---

## 2026-06-03 · feat(messages): unread badge on the Messages icon

**Commit:** see merge commit on this PR.

**Context:** Follow-up to chrome-redesign **delta #2** (PR #837), which shipped the `MessageSquare` link in the couple top bar **icon-only** — its own comment flagged "No unread badge: chat_messages has no per-message read tracking column in V1 … Badge can be added in a follow-up once a read-receipts migration lands." This PR is that follow-up: it adds the per-user/per-thread read marker chat never had, computes an unread-thread count from it, and lights the Messages icon the same way the bell is lit.

**What ships:**

- **Unread badge on the Messages icon** in the event-scoped couple top bar (`app/dashboard/[eventId]/layout.tsx`). New client component `app/_components/unread-messages-badge.tsx` mirrors `unread-bell-badge.tsx` exactly — same pill styling (terracotta dot, `9+` cap, `font-mono text-[9px]`), `aria-label "Messages · N unread messages"`, server-rendered initial count + Supabase Realtime resync on `chat_messages` INSERT (the table is already in the `supabase_realtime` publication per `20260514140000`, and Realtime honors RLS so a client only gets events for threads it can SELECT).
- **Read-state that didn't exist before.** `countUnreadMessages(supabase, userId?)` in `lib/chat.ts` calls the new `count_unread_message_threads()` RPC; a thread is unread when it has a message from *someone else* (`sender_user_id IS DISTINCT FROM auth.uid()`) newer than the viewer's `last_read_at` (or they've never read it).
- **Mark-read on open.** Server action `markThreadRead(threadId)` in `lib/chat-actions.ts` upserts `chat_thread_reads (thread_id, user_id=auth.uid(), last_read_at=now())` on `onConflict (thread_id,user_id)`. Called on render in the couple thread page **and** the vendor thread page (parity).
- **Graceful-degrade is the whole safety story.** Both `countUnreadMessages` and `markThreadRead` log + no-op/return-0 on ANY error — most importantly when the table/function isn't in the schema yet (`isMissingRelationError`). The deploy is therefore safe **before** the migration is applied: the badge simply reads 0 and opening a thread never fails. Mirrors `countUnread`'s graceful-to-0 in `lib/notifications.ts`.

**NEW migration — `supabase/migrations/20260728000000_chat_thread_reads.sql` (OWNER-PUSH):**

- Additive only. `CREATE TABLE IF NOT EXISTS public.chat_thread_reads (thread_id, user_id, last_read_at, PK(thread_id,user_id))` with FKs to `chat_threads(thread_id)` + `users(user_id)` ON DELETE CASCADE; index on `user_id`; **RLS enabled at create**; `chat_thread_reads_self_all` policy = a user manages only `user_id = auth.uid()` rows. Plus `count_unread_message_threads()` (SECURITY DEFINER · STABLE · `GRANT EXECUTE … authenticated`).
- **One correction vs the drafted SQL:** the draft scoped vendor-side threads with `current_vendor_ids()`, but that helper is a **NULL-returning stub** in `20260512000000_setnayan_base.sql` (vendor_team_members lands in 0022, stub never repointed). The helper the 0019 chat RLS actually uses for vendor-thread scoping is **`current_vendor_profile_ids()`** (`vendor_profiles WHERE user_id = auth.uid()`), matching `chat_threads.vendor_profile_id → vendor_profiles(vendor_profile_id)`. Swapped to that so the vendor-side count actually works. All other column names (`users.user_id`, `chat_threads.{thread_id,event_id,vendor_profile_id}`, `chat_messages.{thread_id,sender_user_id,created_at}`, `current_couple_event_ids()`) matched the live schema verbatim.
- **Do NOT `supabase db push`** — owner applies migrations. Until then the badge shows 0.

**Files:**

- `supabase/migrations/20260728000000_chat_thread_reads.sql` (new)
- `apps/web/lib/chat.ts` — `countUnreadMessages()` + error-detect import
- `apps/web/lib/chat-actions.ts` — `markThreadRead()` + error-detect import
- `apps/web/app/_components/unread-messages-badge.tsx` (new)
- `apps/web/app/dashboard/[eventId]/layout.tsx` — fetch `initialUnread`, swap icon-only link → `<UnreadMessagesBadge>` (dropped now-unused `MessageSquare` import)
- `apps/web/app/dashboard/[eventId]/messages/[threadId]/page.tsx` — `markThreadRead` on render
- `apps/web/app/vendor-dashboard/messages/[threadId]/page.tsx` — `markThreadRead` on render

**Verification:** `pnpm -F web typecheck` → 0 errors. `pnpm exec next lint --file <6 changed app/lib files>` → no warnings/errors. `pnpm -F web build` → ✓ Compiled successfully · 113/113 static pages (the only build warnings are pre-existing + in untouched routes: sitemap `Missing SUPABASE env vars` locally, `/vendor-dashboard` dynamic-server `cookies`/`searchParams` notices).

**SPEC IMPACT: Yes** — iteration **0019** (Communications: chat gains a per-user/per-thread read marker `chat_thread_reads` + `count_unread_message_threads()` RPC; previously "Read receipts … deferred") and **0021** (couple dashboard chrome: the Messages icon now carries an unread badge alongside the bell). `[PENDING]` logged in `COWORK_INBOX.md`.

---

## 2026-06-03 · feat(schedule): Preparation ⇄ Event Day toggle

**Commit:** see merge commit on this PR.

**Context:** Delta #3 of the 2026-06-03 customer-dashboard chrome redesign (corpus `DECISION_LOG.md` "Customer dashboard chrome RE-LOCKED"). The redesign asked for the couple's `/schedule` page to carry a **Preparation ⇄ Event Day** toggle: "Event Day" = the existing editable day-of timeline, "Preparation" = a NEW read-only agenda of dated planning items leading up to the wedding that auto-fills from payments + concierge milestones. This is a **net-new V1 surface** — the prototype intent, shipped with only the data real tables support. No new table, no migration: Preparation is pure read-only aggregation of EXISTING dated data.

**What ships:**

- **URL-driven segmented toggle** at the top of `/schedule` — `Preparation | Event Day` via `?view=preparation` / `?view=event-day` (bookmarkable, SSR-resolved, works without JS — each segment is a real prefetched `<Link>`). With no param the page defaults to **Preparation when there are prep items**, else opens straight on **Event Day** so empty-prep couples aren't met with a blank agenda. The Preparation segment carries a live count badge.
- **Event Day mode = the existing blocks UI, untouched.** The add-block form, per-block cards (inline time editor + visibility toggle + delete), and empty state were lifted verbatim into an `EventDayView` helper — behavior is byte-for-byte identical to before.
- **Preparation mode = a date-sorted, read-only agenda grouped by month.** Each row: date · label · a source chip (Payment / Paperwork / Meeting / Milestone) · optional amount, with overdue rows flagged in rose so a couple sees what slipped. A small legend explains that the agenda auto-fills (couples don't add rows by hand here). Honest empty state with deep-links to Budget + Paperwork (date-aware copy when no wedding date is set yet). Clean Editorial tokens (cream/ink/terracotta/mulberry + amber/blue/indigo source accents) consistent with Home's "Upcoming" surface.

**Data sources — exactly what was wired vs deferred** (`lib/preparation.ts` `fetchPreparationAgenda`, each source graceful-degrades independently):

- ✅ **Payment** — `event_vendor_line_items.due_date` (host-entered vendor payment milestones). Amount + vendor name + label; fully-paid lines dropped (sums `event_vendor_payments` per line, mirroring `renderBudgetIcs`). Deep-links to `/budget`.
- ✅ **Paperwork** — `event_paperwork` rows with the "complete by" date derived via `lib/paperwork.ts` `completeByDate(document_type, event_date)`; `received` docs dropped. Deep-links to `/paperwork`.
- ✅ **Meeting** — `vendor_meetings.starts_at` (consultations, tastings, fittings, site visits). Deep-links to the vendor's page.
- ✅ **Milestone** (the "concierge"-flavored derived dates) — computed statutory windows from `events.event_date` + `ceremony_type`: PSA/CENOMAR −180d, marriage-license window −120d, Pre-Cana cutoff −60d (Catholic only). Same thresholds as `lib/upcoming-items.ts`. Deep-links to `/paperwork`.
- ❌ **DEFERRED — manual / user-added prep items.** Would require a NEW table (couple-authored agenda rows). Out of scope for this additive, no-migration PR. Documented as a fast-follow in `COWORK_INBOX.md`.
- ❌ **ABSENT — orders due dates.** The `orders` table has **no due-date column** (only `created_at` / `paid_at` / `reviewed_at` / `expires_at`). `expires_at` is a *subscription-renewal* date, already surfaced on Home + Orders; it is **not** a wedding-preparation milestone, so it is intentionally omitted from Preparation.
- ❌ **ABSENT — Concierge / Today's Focus per-step milestones.** The 0016 wizard (`/today`) is an ordered card list with **no per-step due/target date column**. The only concierge-adjacent dated data is the statutory windows, wired above as the Milestone source.

**Home untouched.** The lean-home 3-block rule (PersonalizedMenu · UpcomingSchedules · ActivityFeed, owner-locked 2026-06-02) is fully respected — `apps/web/app/dashboard/[eventId]/page.tsx` was **not modified**. The `/schedule` toggle is the entire deliverable; the existing `UpcomingSchedules` block already aggregates the same kinds of dated items for Home via `lib/upcoming-items.ts` and needed no change.

**Files:**

- `apps/web/lib/preparation.ts` — NEW. The aggregator + types (`PreparationItem` / `PreparationGroup` / `PreparationAgenda`, `fetchPreparationAgenda`). Source map + deferred-sources rationale documented in the file header.
- `apps/web/app/dashboard/[eventId]/schedule/_components/schedule-mode-toggle.tsx` — NEW. Client segmented control (URL-driven, count badge).
- `apps/web/app/dashboard/[eventId]/schedule/_components/preparation-agenda.tsx` — NEW. Read-only presentational agenda view + legend + empty state.
- `apps/web/app/dashboard/[eventId]/schedule/page.tsx` — wired the toggle + view resolution + event-row fetch (`event_date` + `ceremony_type` for the agenda math); extracted the existing blocks UI into `EventDayView` (behavior unchanged).

**Verification:** `pnpm -F web typecheck` clean (0 errors); `next lint` clean ("No ESLint warnings or errors") on all four changed files.

**SPEC IMPACT:** **Yes.** Iteration **0021** (couple dashboard — Schedule surface gains the Preparation⇄Event Day mode) plus the cross-refs to the schedule spec / iteration **0007** (budget payment due dates feed Preparation) and iteration **0016** (Concierge has no per-step dated milestone — only statutory windows feed Preparation; manual prep entry deferred). Logged as `[PENDING] 2026-06-03` in `COWORK_INBOX.md`.

---

## 2026-06-03 · feat(services): surface in-app add-ons inside the Services tab

**Commit:** see merge commit.

**Context:** Delta #4 of the 2026-06-03 customer-dashboard chrome redesign (corpus `DECISION_LOG.md` "Customer dashboard chrome RE-LOCKED"). Vendors + in-app services should live in one tab so couples never need to jump to a separate Add-ons route to discover features.

**What ships:**
- **`apps/web/lib/add-ons-catalog.ts`** — new shared catalog module extracted from add-ons/page.tsx. Exports `ADD_ONS`, `AddOnEntry`, `AddOnStatus`, and the `addOnHref()` helper. Single source of truth consumed by both the full poster grid and the new compact section.
- **`apps/web/app/dashboard/[eventId]/add-ons/page.tsx`** — refactored to import `ADD_ONS` + `addOnHref` from the shared catalog. Behaviour is byte-for-byte identical; no duplicated list.
- **`apps/web/app/dashboard/[eventId]/vendors/_components/in-app-services-section.tsx`** — new server component: "In-app services & add-ons" section with a compact landscape mini-card grid (horizontal-scroll on mobile, 4-col on desktop). Cards reuse the per-service animated poster backgrounds (base + motion layers + lower-third gradient mask) from the shared catalog. Filters to live + web_v1 add-ons only; coming-soon items discoverable on the full `/add-ons` page. "See all" + "View all add-ons" links keep the canonical route reachable.
- **`apps/web/app/dashboard/[eventId]/vendors/page.tsx`** — wraps the return in a fragment; renders `<InAppServicesSection eventId={eventId} />` below `<PlanBudgetAccordion>`.

**Verification:** `pnpm -F web typecheck` — 0 errors. `next lint` on all 4 changed files — 0 warnings/errors.

**SPEC IMPACT:** Yes.
- **Iteration 0006** (`0006_vendors_management/`) — the Vendors tab (renamed Services in the chrome redesign) now also surfaces in-app services. Spec should note the dual-entry-point pattern.
- **Add-ons hub** (`0021_couple_dashboard_fully_purchased/`) — record that the compact add-ons grid now lives inside the Services tab as a second entry point (canonical `/add-ons` route unchanged).

---

## 2026-06-03 · feat(drive-copy): Phase 0 — consolidate the two Drive OAuth flows into one per-event connect

**Commit:** to be filled after commit.

**Context:** Phase 0 of the storage build plan (`Storage_and_Drive_Copy_Architecture_2026-06-03.md` § 8), following the Phase 1 keystone. An event could previously hold **two** Google Drive connections — `oauth_grants(provider='drive')` (Papic connect) and `provider='drive_photo_delivery'` (Photo Delivery connect) — each its own consent, redirect URI, and folder. The Phase-1 drive-copy layer reads `provider='drive'`, so a couple who connected only via Photo Delivery was invisible to it. This unifies them into **one** per-event "Connect Drive".

**What ships:**

- **`/api/oauth/photo-delivery/start`** — now uses the canonical Drive OAuth config (`getDriveOAuthConfig`), so the Photo Delivery connect goes through the **same Google consent + redirect URI** as Papic (→ `/api/oauth/drive/callback`). It still writes an `oauth_state` row with `provider='drive_photo_delivery'` purely as a **return-page marker**.
- **`/api/oauth/drive/callback`** — now serves **both** connects: accepts `oauth_state.provider ∈ {drive, drive_photo_delivery}`, always upserts the grant as `provider='drive'`, **mirrors `events.photo_delivery_*`** connected-state, and redirects back to the right panel.
- **`photo-delivery-release.ts`** + **`/api/photo-delivery/disconnect`** + **photo-delivery `actions.ts`** — read/revoke the unified `provider='drive'` grant.
- **`/api/oauth/drive/disconnect`** — the shared Drive disconnect now also clears `events.photo_delivery_*`.
- **`/api/oauth/photo-delivery/callback`** — marked **DEPRECATED** (unreachable post-consolidation).
- **Migration `20260727000000_drive_oauth_consolidation.sql`** — safety-net data backfill: renames pre-existing `'drive_photo_delivery'` grants → `'drive'` (conflict-safe). **No schema change; code does not depend on it.**

**Net result:** one consent, one registered redirect URI, one `provider='drive'` grant per event — powering Papic capture, Photo Delivery, and the drive-copy layer.

**Pilot-safe:** no real Drive grants exist yet (#19g pending). Disconnect now means "disconnect Drive entirely" from either panel.

**Verification:** full GitHub Actions suite green (typecheck+lint, production build, macOS/Windows build, e2e, lighthouse, bundle, secret scan).

**SPEC IMPACT:** Yes. The owner now registers only **one** Drive redirect URI (`GOOGLE_DRIVE_OAUTH_REDIRECT_URI`); `PHOTO_DELIVERY_OAUTH_REDIRECT_URI` is retired. COWORK_INBOX item appended.

---

## 2026-06-03 · feat(chrome): Messages icon in the dashboard top bar

**Commit:** see merge commit on this PR.

**Context:** Delta #2 of the 2026-06-03 customer-dashboard chrome redesign (corpus `DECISION_LOG.md` "Customer dashboard chrome RE-LOCKED"). Adds a Facebook-pattern Messages icon to the couple dashboard top bar right cluster, adjacent to the notifications bell.

**What ships:**

- `MessageSquare` (lucide-react) icon link added to the right cluster of the event-scoped top bar in `apps/web/app/dashboard/[eventId]/layout.tsx`, placed between the `RoleSwitchPill` (mobile-only) and `UnreadBellBadge`.
- Links to `/dashboard/${eventId}/messages` (the couple's vendor thread list, iteration 0019).
- `aria-label="Messages"` for accessibility.
- Styled exactly like `UnreadBellBadge`: `h-9 w-9 rounded-full border border-ink/15 bg-cream text-ink/70 hover:border-terracotta/40 hover:text-terracotta` — Clean Editorial tokens throughout.
- **No unread badge:** `chat_messages` has no per-message `read_at` / `is_read` column in V1. There is no clean count source without a DB migration. Badge can be added once a read-receipts migration lands in a follow-up PR.
- Renders on both mobile and desktop (the top bar is shared across all breakpoints).

**Files changed:**

- `apps/web/app/dashboard/[eventId]/layout.tsx` — added `MessageSquare` to the lucide import; inserted the Messages `<Link>` element.

**Verification:** `pnpm -F web typecheck` → 0 errors. `next lint --file app/dashboard/[eventId]/layout.tsx` → No ESLint warnings or errors.

**SPEC IMPACT:** Yes — **iteration 0021** (couple dashboard chrome) and **iteration 0019** (communications / messages). The top bar now carries a Messages shortcut. Spec corpus should record this icon's presence in the couple dashboard chrome description. See `COWORK_INBOX.md [PENDING] 2026-06-03 — Messages icon` for the worklist entry.

---

## 2026-06-03 · feat(0001): keep the couple detail simple — remove the editorial live-view iframe

**Commit:** to be filled after commit.

**Context:** Owner clarification 2026-06-03 — "editorial" is just the same `/[slug]` page, which only becomes the editorial/recap view **after** the wedding (the existing day-of lifecycle's post/recap phase — nothing new to build). The couple's guest-detail should just show **their information, like any other guest. Keep it simple.**

**What changed (`guests/[guestId]/page.tsx`):** Removed the `CoupleEditorialPreview` live-view iframe shipped in the prior PR — the `events.slug` fetch, the render block, the component, and the now-unused `ArrowUpRight` import. The couple's detail is back to the standard info form. The couple-foundation rules are **retained** (auto-Attending, can't-delete, role + RSVP locked, renamable) — those are correctness behavior, separate from the editorial page. The unrelated `e.touches[0]` typecheck guard stays (already on `main`).

**Verification:** `tsc --noEmit` clean; `next lint` clean.

**SPEC IMPACT:** Iteration **0001** — reverts the editorial-live-view spec note. "Editorial" = the `/[slug]` page's post-wedding recap state (day-of lifecycle, 0031), activating at end of wedding; couple detail = plain info. The prior `COWORK_INBOX.md` live-view entry is rewritten accordingly.

---

## 2026-06-03 · feat(home): compact "Your wedding details" card from onboarding data

**Commit:** see merge commit on this PR.

**Context:** Delta #1 of the 2026-06-03 customer-dashboard chrome redesign (corpus `DECISION_LOG.md` "Customer dashboard chrome RE-LOCKED"). An audit found most of the redesign is already live (5-tab nav, Website tab, `/details` settings, Messages, top-bar Switch/bell), so this ports only the genuine new bits — starting with surfacing the couple's onboarding wedding details as one glanceable card on event Home.

**What ships:**

- **Compact "Your wedding details" card** on event Home — a keyed label→value list MERGING the events-row basics (Location · Venue · Guests · Budget · Style) with the two most service-defining onboarding style picks (Cuisine · Photo & video), plus a **"See all wedding settings →"** link to `/details`. Date + ceremony are omitted (the persistent top chrome already carries them).
- **Reshapes the existing `PersonalizedMenu` `preview` variant** — the live Home already rendered this onboarding data as chips; it now renders the kv card. `/for-you` (the `full` variant) is byte-for-byte unchanged (chips + the full "what matters" dl). Gated on `variant === 'preview' && detailRows.length > 0`, so behavior is unchanged when rows aren't passed.
- **New `buildWeddingDetailRows()` in `lib/personalized-menu.ts`** — reuses the existing `REGION_LABEL`/`VENUE_LABEL` maps + `style_preferences` cleaning; only present fields render, so the card never shows blanks.

**Files:** `lib/personalized-menu.ts` · `app/dashboard/[eventId]/_components/personalized-menu.tsx` · `app/dashboard/[eventId]/page.tsx`.

**Verification:** `pnpm -F web typecheck` ✓ · `pnpm -F web lint` (3 files) ✓ No ESLint warnings or errors. (Rebased onto current `main`, which already carries PR #830's `e.touches[0]` guard — the earlier `tsc` red on the stale base is gone.)

**SPEC IMPACT:** Yes — iteration 0021 (couple dashboard Home) gains the "Your wedding details" card. The model is already locked in corpus `DECISION_LOG.md` ("Customer dashboard chrome RE-LOCKED", 2026-06-03); logged as a `[PENDING]` COWORK_INBOX item to update 0021's Home-surface section.

---

## 2026-06-03 · feat(taxonomy): add Design › Digital Services tile + re-group the 3 Setnayan digital canonicals

**Commit:** see merge commit on this PR.

**Context:** Owner directive (2026-06-03) — surface a new **Digital Services** child tile under the DESIGN parent in the marketplace taxonomy, the home for Setnayan's digital/AI productions (Pakanta · Animated Monogram · Pro Website · Live Venue Photo Wall · Live Background/Pailaw). Code-only re-grouping (mirrors the 2026-05-31 shrink — no migration, every canonical preserved).

**What ships (`apps/web/lib/taxonomy.ts` only):**

- **New tile `digital_services`** added to the `WeddingTile` union, `WEDDING_TILE_ORDER` (after `led_wall`), `TILE_PARENT` (`→ 'design'`), `WEDDING_TILE_LABEL` (`'Digital Services'`) and `WEDDING_TILE_SLUG` (`'digital-services'`). DESIGN now has 8 tiles.
- **Re-pointed 3 existing Setnayan canonicals** to it: `setnayan_custom_monogram` (was `stylist_decorator`), `setnayan_pailaw` (was `led_wall`), `setnayan_pakanta` (was `program / wedding_singer` → now `design / digital_services`). Pakanta leaves the Program music shelf. `LED Wall` reverts to 3rd-party walls only; `Stylist / Decorator` loses the monogram option.
- **No new canonicals, no DB migration.** `setnayan_patiktok` already sits under `photo_booth` (no change). The V2 retail catalog (`platform_retail_catalog_v2`) is flat (no category column) and already carries these SKUs at owner-locked prices — nothing to seed.

**SPEC IMPACT:** Already reflected in the spec corpus this session (no Cowork action pending) — `Digital_Services_Cross_Surface_Map_2026-06-03.md` (new authoritative map) + `Vendor_Taxonomy_Shrink_2026-05-30.md` + `Service_Specifications_2026-06-02.md` + the `0006/0022/0023/0015/0021` + `Onboarding_Blueprint` surface specs + the `DECISION_LOG.md` 2026-06-03 rows. Open item flagged to owner: a Pailaw/Live-Background V2 SKU is absent from `platform_retail_catalog_v2` (needs an owner-confirmed price — not invented here); the dashboard/website/onboarding HTML prototypes update separately.

**Verification:** Additive tile + 3 re-points; all exhaustive `Record<WeddingTile,…>` maps (`TILE_PARENT` · `WEDDING_TILE_LABEL` · `WEDDING_TILE_SLUG`) updated so `tsc` stays exhaustive; a repo-wide grep found no other exhaustive `WeddingTile` map or tile-icon map. Local typecheck not runnable in this worktree (no `node_modules`) → CI clean-install runs typecheck/lint/build/Lighthouse/Vercel-preview.

---

## 2026-06-03 · feat(site-editor): flip the Website doorway to the editor + retire the journey scroll (Phase 2)

**Commit:** see merge commit on this PR.

**Context:** Phase 2 of the 2026-06-01 flip sequence (Phase 1 = card-parity, shipped PR #821). Owner directive: "make the editor the page and remove everything else." The full-screen Reels editor (`/site-editor/[eventId]`) is now the canonical wedding-website surface; the journey scroll (`/dashboard/[eventId]/website`, PR #704) is retired.

**What ships:**

- **Nav doorway → editor.** `customer-nav-config.ts` (desktop sidebar) + `customer-bottom-nav.tsx` (mobile slot 4) "Website" now point to `/site-editor/${eventId}` (was `${base}/website`). Tapping Website opens the full-screen editor directly, on mobile and desktop.
- **Journey route retired → redirect.** `/dashboard/[eventId]/website/page.tsx` is now a thin server redirect to `/site-editor/[eventId]` (not a 404), so bookmarks, deep-links, the animated-monogram back-links, and the onboarding prefetch all land on the editor. The former journey render (Steps 1–5 + Free-vs-Pro) is gone.
- **Editor wiring updated for the flip.** ✕ now closes to the event dashboard home (`/dashboard/[eventId]`) instead of the (now-redirecting) journey page — no loop. The Settings "Manage URL / Set your URL" cards + the no-slug preview CTA now deep-link to the **invitation editor** (`/dashboard/[eventId]/invitation`), which hosts the canonical shared `SlugField` + `updateEventSlug` action — so slug/URL management is fully preserved.
- **Incidental build-unblock (NOT part of the flip):** `main` was red on `tsc` from PR #827's swipe-delete (`e.touches[0].clientX/Y` unguarded under `noUncheckedIndexedAccess`, in `guest-list-multiselect.tsx`). Added a behavior-preserving null-guard so this PR — and `main` — typecheck green again. Flagged separately because it's unrelated to the flip but was blocking CI for every in-flight PR.

**Dead code (safe to delete in a follow-up cleanup):** `website/_components/{journey,pro-upgrade-panel,pro-website-panel,copy-button}.tsx` + `website/actions.ts` (`updateEventSlugFromWebsite`) — nothing imports them now.

**Verification:** `pnpm -F web typecheck` ✓ · `pnpm -F web lint` ✓ (no new warnings on edited files) · `pnpm -F web build` ✓.

**SPEC IMPACT:** Yes. The couple's "Website" doorway now opens the Reels editor; the journey scroll is retired (redirects). Iteration 0021 (couple dashboard Website tab) + the 2026-06-01 "Reels-style editor" decision-log row need the Phase-2 flip recorded. Logged as a `[PENDING]` COWORK_INBOX item.

---


## 2026-06-03 · feat(0001): couple detail shows a LIVE VIEW of their editorial (wedding) page + touches[0] typecheck fix

**Commit:** to be filled after commit.

**Context:** Owner directive 2026-06-03 (completes the deferred couple "album / custom data" item) — clicking the bride or groom shows **their future editorial page as a live view**. Their "editorial page" is their public wedding page at `/[slug]`.

**What shipped:**

1. **Editorial live view (`guests/[guestId]/page.tsx`).** Couple-only: fetch `events.slug`, then render a phone-framed, **same-origin** `<iframe src="/{slug}">` ("Editorial page" · live) above the edit form, with **Open** (new tab) + **Edit** (→ `/dashboard/[eventId]/website`) links. `loading="lazy"` keeps it off first paint. When no slug is set yet, a "Their wedding page isn't set up yet → Set up their page" fallback. Same-origin framing is safe — `next.config.ts` `headers()` sets no `X-Frame-Options` / CSP `frame-ancestors` (only touches `/sw.js` + `/manifest.json`).
2. **Pre-existing typecheck fix (`_components/guest-list-multiselect.tsx`).** `main` was red on `tsc`: the mobile swipe-to-delete card read `e.touches[0].clientX` (possibly-undefined under `noUncheckedIndexedAccess`). Guarded with `const t = e.touches[0]; if (t) …` — also hardens a real runtime crash. (Slipped onto `main` because merges aren't gated on the typecheck check.)

**Verification:** `tsc --noEmit` clean (it was *failing* on `main` before the touch guard); `next lint` clean for changed files. Visual confirmation via the PR's Vercel preview.

**SPEC IMPACT:** Iteration **0001** — the couple's guest-detail now embeds a live view of their `/[slug]` page (touches 0002/0015/0021). Completes the "album / custom data" follow-up flagged in the 2026-06-03 couple-foundation entry. Logged in `COWORK_INBOX.md` `[PENDING] 2026-06-03 (couple editorial live view)`.

## 2026-06-03 · feat(drive-copy): keystone — universal Google-Drive copy layer (R2 = system of record)

**Commit:** to be filled after commit.

**Context:** Owner storage lock 2026-06-03 (corpus `Storage_and_Drive_Copy_Architecture_2026-06-03.md` + `DECISION_LOG.md`): Cloudflare R2 is the **system of record**; Google Drive is the couple's **permanent copy** of six artifacts — Papic · Patiktok · Pabati · Pakanta · Monogram · QR codes. Panood is carved out (YouTube only). This PR is **Phase 1 (the keystone)** of the design-doc § 8 build plan: the shared copy module + its schema. Feeders (6), the cron tick, the R2 3-month compress job, and Drive quota handling are later PRs.

**What ships:**

- **Migration `20260726000000_drive_copy_layer_foundation.sql`** — generalized, additive copy-tracking schema (does NOT touch the live 0009 `photo_delivery_*` tables):
  - `drive_copy_folders` — per-event Drive folder id cache (root + one subfolder per artifact type); `UNIQUE(event_id, kind)`.
  - `drive_copy_artifacts` — per-file copy state across all six types; canonical dedupe `UNIQUE(event_id, r2_object_key)`; `copied_high_res` flag for the 3-month-window logic; pending-worker partial index. RLS enabled, **no policies** (service-role only — same convention as `photo_delivery_artifacts`).
- **`apps/web/lib/drive-upload.ts`** (new) — shared low-level byte primitives extracted **verbatim** from `photo-delivery-release.ts`: `readR2Object` + `uploadFileToDrive` (now mimeType-aware) + `createDriveFolder`. One R2→Drive path, not two.
- **`apps/web/lib/photo-delivery-release.ts`** — refactored to import the two primitives from `drive-upload.ts` (deleted its private copies). **Behavior-identical** — the live pilot Photo Delivery flow is unchanged.
- **`apps/web/lib/drive-copy.ts`** (new) — the keystone: `pushToDriveCopy()` (feeder entry point) + `enqueueDriveCopy` + `runDriveCopyBatch` (copy worker) + `ensureArtifactFolder` (root + per-type subfolder via the cache) + `getEventDriveAccessToken` (reads `oauth_grants(provider='drive')`, refresh-on-expiry). Always safe to call: with no Drive grant it enqueues and copies later.

**Seam (documented):** the layer reads the `provider='drive'` grant (Papic's original Drive connection); the live 0009 flow still uses its own `provider='drive_photo_delivery'` grant + folder. Collapsing both into one per-event "Connect Drive" is **Phase 0** (a later PR). Until then the layer is inert for events that only connected via Photo Delivery — feeders enqueue, the copy runs once a `drive` grant exists.

**Pilot-safe:** purely additive schema + a new module with no callers yet + a behavior-identical refactor of one shared file. Nothing changes for pilot couples.

**Verification:** `pnpm -F web typecheck`/`lint`/`build` not runnable in the `/tmp` worktree (no `node_modules` on the shared box) → relying on the full GitHub Actions CI gates (typecheck + lint + production build + e2e + bundle + secret scan). The admin Supabase client is untyped, so the new table/column references carry no generated-type risk; `events.event_date`/`display_name` selects mirror the existing `oauth/photo-delivery/callback` route verbatim.

**SPEC IMPACT:** Yes. Implements the 2026-06-03 storage lock. The corpus design doc (`Storage_and_Drive_Copy_Architecture_2026-06-03.md` § 7) + `DECISION_LOG.md` 2026-06-03 row already capture the architecture; the iteration-spec edits (0009 rescope · 0011 Panood carve-out · 0012 · 0017 · 0036 · 0037/0004 · 0002 · `CLAUDE.md` storage line · pax docs) are owed via Cowork. Logged as a `[PENDING]` COWORK_INBOX item.

---

## 2026-06-03 · feat(site-editor): migrate journey-page surfaces into the Reels editor carousels

**Commit:** to be filled after commit.

**Context:** The full-screen Reels editor (`/site-editor/[eventId]`, PR #719, 2026-06-01) shipped with 4 tabs but only a subset of the surfaces on the journey page it's meant to replace (`/dashboard/[eventId]/website`, PR #704). Per the 2026-06-01 decision-log flip sequence (① foundation → ② preview-follows-tab → ③ deepen per-tab tooling → ④ flip the Website tab to the editor), the editor must reach card-parity before the entry-flip. This session's owner directive: map every vital journey-page surface into the editor's Settings / Event carousels as cards. **Phase 1 = the cards (this PR). The entry-flip + journey-page retirement is Phase 2 (a later PR).**

**What ships:**

- **`apps/web/app/site-editor/[eventId]/page.tsx`** — adds the Pro-upgrade `ownedOrders` fetch (scoped to `monogram_hero_upgrade` + `pro_widget_schedule`, the two inline-buy widget upgrades), graceful-degrading to empty if the `orders` table is missing on a pre-bootstrap DB; passes `ownedOrders` to `SiteEditor`. Mirrors the journey page's fetch so the two surfaces agree on owned-state.
- **`apps/web/app/site-editor/[eventId]/_components/site-editor.tsx`:**
  - **Settings carousel** + **Keep your photos — Google Drive** (nav → `/add-ons/photo-delivery`) + **Custom QR per guest** (nav → `/add-ons/custom-qr-guest`).
  - **Event carousel** + **Monogram Hero** (Pro ₱1,999, inline buy) after Hero photo; + on-the-day cluster: **Preview day-of mode** (external `?preview=day_of`, conditional on slug), **Live stream — Panood** (nav), **Live Schedule** (Pro ₱999, inline buy), **Candid capture — Papic** (nav; the journey's two Papic rows merged), **Patiktok booth** (nav), **Live photo wall** (coming soon).
  - New **`ProCard`** component — catalog price via `findSku`/`formatCentavosPhp`, owned-state via `ownedOrders`, Upgrade CTA → `/dashboard/[eventId]/orders/new?service=<sku>`. Lifts the journey page's `ProUpgradePanel` pattern into the carousel `Card` shell.

**Architecture decision (load-bearing):** Only the **two Pro widget upgrades are inline-buy** (matching the existing `ProUpgradePanel`). Every other service — Panood / Papic / Patiktok / Custom-QR / Drive — is a **navigation card into its `/add-ons/<key>` page, which owns its own pricing + buy state**, per the locked website wiring rule (journey.tsx docstring · V2.1 Amendment #3). The earlier "full inline tools for all 5 services" intent was reconciled to this rule to avoid duplicating the canonical buy/config flows (incl. the V2 pax-based pricing). Whether to inline the Panood/Papic/Patiktok configurators too is deferred as an explicit owner decision.

**Pilot-safe:** the journey page (PR #704) is **untouched** and remains the working Website surface; this PR is additive to the already-shipped (but not-yet-primary) editor route. Nothing breaks for pilot couples.

**Verification:** `pnpm -F web typecheck` ✓ · `pnpm -F web lint` ✓ (no new warnings on the two edited files) · `pnpm -F web build` ✓ · full GitHub Actions CI suite ✓ (build macOS + Windows, production build, Lighthouse, Playwright e2e, bundle size, secret scan, typecheck + lint).

**SPEC IMPACT:** Yes. The canonical Website-editor surface now carries the full card set, including the **₱1,999 Monogram Hero** + **₱999 Live Schedule** inline upgrades and the Panood / Papic / Patiktok / Drive / Custom-QR navigation cards. The 2026-06-01 "Reels-style editor" decision-log row + iteration 0021 (couple dashboard Website tab) need a follow-up note that the editor reached card-parity with the journey page (Phase 1 of the flip). Logged as a `[PENDING]` COWORK_INBOX item.

---

## 2026-06-03 · feat(0001): bride & groom are the event's foundation — auto-Attending, undeletable, role-locked

**Commit:** to be filled after commit.

**Context:** Owner directive 2026-06-03 — the bride & groom are the foundation of the event: RSVP is automatically **Attending** (never Pending), they **can't be deleted**, they **can be renamed**, and "Bride/Groom" is hidden from the assignable **role** pickers. Clicking them opens their full detail (a richer album / custom-data surface is a separate follow-up pending owner spec).

**What shipped (`apps/web/.../guests/` + migration):**

1. **Auto-Attending.** New migration `20260725000000_guests_couple_attending.sql` — a `BEFORE INSERT OR UPDATE` trigger forces `rsvp_status='attending'` whenever `role IN ('bride','groom')`, plus a backfill for existing couples. The app also coerces on read (`coupleAttending` in `lib/guests.ts`, applied in `fetchGuestsByEvent` + `fetchGuestById`) so the UI is correct the instant this ships, before the migration is pushed. `updateGuest` forces it write-side too.
2. **Undeletable.** `softDeleteGuest` (single) + `bulkSoftDeleteGuests` (bulk) block bride/groom with a "foundation of the event" message, checked before the RSVP gate. The detail page hides the "Remove guest" button for the couple.
3. **Renamable.** Name fields stay editable on the couple's detail form.
4. **Hidden from Roles.** Bride/Groom removed from `BULK_ROLE_SECTIONS` (desktop SelectionBar + mobile Assign sheet), the new-guest role picker, and the detail-page role select. On the couple's own detail the role is read-only ("Foundation · locked") with a hidden input so the form still posts it; RSVP shows a locked "Attending · always".

**Verification:** `tsc --noEmit` clean; `next lint` clean for all changed files.

**Owner action:** push the migration (`supabase db push`) so the DB-stored value + every write path (CSV import, public RSVP) match the UI — see `OWNER_ACTIONS.md` 2026-06-03 item. The feature works in the UI without it (read-coercion); stored rsvp_status stays Pending until pushed.

**SPEC IMPACT:** Iteration **0001** — bride/groom RSVP/role/delete semantics. Logged in `COWORK_INBOX.md` `[PENDING] 2026-06-03 (couple foundation)`.

## 2026-06-03 · feat(0001): mobile Guests carousel — select-and-assign Customize, folded filters, side/role/group sort, cleaner sheet

**Commit:** to be filled after commit.

**Context:** Owner reviewed the mobile Guests page (the lower-third 4-panel carousel: Summary · Search & sort · Add · Customize) and gave five directives.

**What shipped (`apps/web/app/dashboard/[eventId]/guests/`):**

1. **Doubled line + separation (carousel container).** The carousel had a `border-t` on its container AND a `border-b` under the tab row ~40px apart — read as two overlapping lines. Replaced with a single raised-sheet treatment: `rounded-t-2xl` + soft upward shadow + one hairline `ring-1 ring-ink/10`, and dropped the tab-row bottom border. One clean "window above / panel below" separation.
2. **Removed the mobile header.** The `<header>` ("Guest list / N guests") was visible on all sizes; now `hidden lg:flex` (desktop only). On mobile the Summary panel already carries the count.
3. **Sort axes.** `SORT_OPTIONS` gains **Side · Role · Group** alongside the existing Last/First/RSVP/Newest (`role` already existed). New `sortCompare` cases: Side ranks bride→groom→both; Group sorts by each guest's first (alphabetical) custom-group label via `buildGroupSortKey`, ungrouped last. (Search already matched name/side/role/group/RSVP server-side — placeholder sharpened to "Name, side, role, group…".)
4. **Filters folded into Search & sort.** The View / Groups / Tags filter chips (displaced from Customize) now live under the Search & sort panel as a "Filter" section.
5. **Customize = select-and-assign.** New shared selection store (`guest-selection-store.ts`, `useSyncExternalStore`) bridges the list's checkboxes and the carousel. Tap **Select** → checkboxes appear on the mobile cards (gated on `selectMode`); the panel shows a **select-all checkbox + live count + Assign**. **Assign** opens a bottom sheet with **Side / Role / Group**, where Group has a create-new-group text box. Each choice dispatches the existing `bulkApplyRoleAndGroup` / `createGuestGroup` server action for the selection, then optimistically clears + closes. Desktop's floating `SelectionBar` is now `hidden lg:block` (mobile/tablet use the carousel); `BULK_ROLE_SECTIONS` exported for reuse so the sheet's role picker matches desktop exactly.

**Verification:** `tsc --noEmit` clean; `next lint` clean for all four files (no new warnings). Visual/interactive confirmation via the PR's Vercel preview (the authed Guests page needs a real session + seeded event, not reproducible in a bare local dev server).

**SPEC IMPACT:** Iteration **0001** (guest list) mobile UX changes — Customize is now select-and-assign (was filters), filters fold into Search & sort, and sort gains Side/Role/Group. Spec corpus `0001_creating_guest_list/0001_creating_guest_list.md` should reflect the new mobile carousel behavior. See `COWORK_INBOX.md` `[PENDING] 2026-06-03`.

## 2026-05-22 · docs(0001): flag guest_role bride/groom enum prod-push gap (Task #49)

**Commit:** to be filled after commit.

**Context:** Owner reported live 2026-05-22 (two screenshots) that guest-edit form throws `invalid input value for enum guest_role: "bride"` for Claire Buanhog (`S89G-6A8RCA9CJQ`) and `...groom` for Ice Casasola (`S89G-H83AGFJMK5`) when saving the "Role in wedding" select. Both forms correctly offer Bride / Groom; the production Postgres enum rejects.

**Diagnosis:** Migration `supabase/migrations/20260530020000_guest_role_add_bride_groom.sql` (commit `2e6f64f`, 2026-05-21) adds `'bride'` + `'groom'` to the `public.guest_role` enum and lives on `main`. The 2026-05-20 CLAUDE.md decision-log row 451 ("Prod migration parity verified") confirmed every migration through `20260522010000` was applied to prod — but 31 migrations have landed locally since that verification (including `20260530020000` ten days later). The owner has been pushing migrations regularly during this window; one (or more) appears to have been missed. `20260530020000` is the only one that affects the production-visible guest-list enum, so it surfaced first via this user-facing crash.

**Form schema vs DB enum audit (this row):**

- **Local main DB enum** (`supabase/migrations/20260513010000_iteration_0001_guests.sql` + `20260530020000_guest_role_add_bride_groom.sql`): 20 values including `'bride'` + `'groom'`.
- **Production DB enum** (inferred from the error message): the original 18 values from `20260513010000` — missing `'bride'` + `'groom'`.
- **Form select** (`apps/web/app/dashboard/[eventId]/guests/[guestId]/page.tsx` ROLE_OPTIONS + `new/page.tsx` ROLE_OPTIONS + `apps/web/lib/guests.ts` `GuestRole` type + `ROLE_LABELS` + `SINGLETON_GUEST_ROLES`): all 20 values including `'bride'` + `'groom'`.

**Fix path A chosen** (no code change · push existing migration to prod). The migration file follows the same `ALTER TYPE ... ADD VALUE IF NOT EXISTS` pattern as `20260514012000_notification_type_additions.sql` (the model cited in the migration's own header comment) — idempotent + safe to re-run on prod.

**What ships (this PR):**

- **`CHANGELOG.md`** — this entry.
- **`OWNER_ACTIONS.md`** — new "Owner action #11" appended to the 2026-05-22 sprint punch list with the `supabase db push --linked` instruction + verbatim SQL for the owner to paste into Supabase Studio if the CLI approach errors.
- **`STATUS.md`** — adds a "before next session" warning matching the existing pattern from 2026-05-14 (`6 unpushed migrations` warning that already lives at line 23).
- **`COWORK_INBOX.md`** — no entry (this is a deploy-side fix, not a spec-corpus update; the spec corpus already correctly documents Bride + Groom as singleton hard-single guest roles in iteration 0001).
- **NO app code changes** — the form, the lib types, the singleton enforcement migration `20260531010000_guests_unique_bride_groom_per_event.sql` are all correct on `main`.
- **NO new migration** — the existing `20260530020000_guest_role_add_bride_groom.sql` is the canonical fix; it just hasn't been applied to prod yet.

**Verification path** (post owner-action):

1. After `supabase db push --linked` succeeds, refresh the Claire Buanhog edit page and save with Bride role selected.
2. Refresh the Ice Casasola edit page and save with Groom role selected.
3. Both should succeed and the chair in the seating chart should show the correct role tier.

**Acceptance criteria:** PR ships these 3 doc updates; owner runs `supabase db push --linked`; Claire's + Ice's edits succeed.

**SPEC IMPACT:** None. The spec corpus iteration 0001 (`0001_creating_guest_list/0001_creating_guest_list.md`) already lists Bride + Groom as the two hard-single guest roles enforced via partial unique indexes. The bride/groom enum addition itself was a corpus-aligned migration when it landed 2026-05-21. This entry is purely a prod-deploy gap, not a spec-vs-code drift.

---

## 2026-05-22 · feat(0021): tiered wedding-date precision + vendor calendar intersection (Task #39 + Task #38 bundled)

**Commit:** to be filled after commit.

**Context:** Owner-confirmed V1 pilot-blocking feature (2026-05-22). Hosts shouldn't be forced to pick a specific Friday months before they know what's possible. The new model has 3 precision modes (year / month / day) — couples start at year ("Sometime in 2027"), narrow to a month once season is decided ("August 2027"), and commit to a specific day once their confirmed-vendor calendars intersect on a workable date. Bundled fix for Task #38: PR #301's `ceremony_type_locked_at = NOW()` auto-stamp on new events was a bug — broke the religion CTA for new events because the chip read locked-at and skipped CTA-state. Auto-stamp removed; chip now correctly fires the "Set wedding type" CTA on new events.

**What ships:**

- **`supabase/migrations/20260603100000_iteration_0021_event_date_precision.sql`** — new column `events.event_date_precision TEXT NOT NULL DEFAULT 'year'` with CHECK constraint `IN ('year', 'month', 'day')`. Backfill: existing rows with `event_date IS NOT NULL` → `'day'` (preserves their current full-date semantics); rows with `event_date IS NULL` → `'year'` (matches the lowest-commitment default). Idempotent `IF NOT EXISTS` pattern. No RLS changes — column piggybacks on existing event-scope policies.
- **`apps/web/lib/events.ts`** — new `EventDatePrecision` type · `formatEventDateWithPrecision(iso, precision, locale)` returns "Sometime in 2027" / "August 2027" / "Friday, August 15, 2027" depending on precision · `formatEventCountdown(iso, precision, now)` returns precision-aware countdown ("210 days to go" for day, "in 5 months" for month, "this year" / "in N months" / null for year depending on distance) · `PRECISION_ORDER` const for the refine-only ratchet comparison.
- **`apps/web/lib/vendor-availability.ts` (NEW)** — `rangeFromPrecision(iso, precision)` derives the [start, end] window from the placeholder date (year='2027-01-01' → Jan 1 - Dec 31 2027; month='2027-08-01' → Aug 1 - Aug 31 2027) · `getCommonAvailableDays(supabase, eventId, rangeStart, rangeEnd)` runs the intersection query: resolves confirmed `event_vendors.marketplace_vendor_id` for the event, pulls `vendor_calendar_blocks` overlapping the range, returns days inside [rangeStart, rangeEnd] where NO confirmed vendor has a block. RLS-respecting (uses the caller's user-scoped Supabase client). Errors return an empty result so the dashboard never crashes on a calendar-query failure.
- **`apps/web/app/dashboard/[eventId]/_components/event-date-input.tsx`** — rewritten to surface a 3-mode segmented picker (Year · Month + Year · Specific Day) above the per-mode input. Year mode = year dropdown (current year + 5 years); Month + Year mode = month + year dropdowns side-by-side; Specific Day mode = standard HTML date input. Submit packs `event_date` (placeholder for year/month) + `precision` into the form. Refine-only ratchet UI: when `confirmedVendorCount > 0`, the picker hides modes wider than the saved precision (e.g., host on day-precision with confirmed vendors sees only `[Specific Day]`; host on month-precision sees `[Month + Year] [Specific Day]`).
- **`apps/web/app/dashboard/[eventId]/_components/vendor-availability-intersection.tsx` (NEW)** — client component rendered below the date row on event home when `precision IN ('year', 'month')` AND `confirmedVendorCount > 0`. Three render modes by available-day count: (a) 0 days → "No day works" + Vendors-panel link, (b) 1–15 days → inline day chip list, click any to finalize, (c) 16+ days → "{N} days work" + Browse calendar CTA → modal grouped by month with day chips. Click any chip → confirmation modal → `updateEventDate` server action with `precision='day'` to collapse out of year/month into the specific day. Refine-only ratchet allows this transition (narrowing).
- **`apps/web/app/dashboard/[eventId]/actions.ts`** — `updateEventDate` extended to accept `precision` form field, persist `event_date_precision` alongside `event_date`, and run the refine-only ratchet: with `confirmed_vendor_count > 0`, widening precision (e.g., day → month) throws `"Can't widen precision — you have N confirmed vendor(s). Narrow your date instead (year → month → day), don't broaden it."` Same-day-changes at same precision still surface the existing Task #37 lock message.
- **`apps/web/app/dashboard/[eventId]/page.tsx`** — selects `event_date_precision` from the events row · threads `eventDatePrecision` into `EventDateInput` (as `initialPrecision`) and `WelcomeHeader` (replacing the prior `daysOut: number` prop) · WelcomeHeader rewritten to call `formatEventDateWithPrecision` + `formatEventCountdown` instead of `formatEventDate` · day-of-mode windowing (`isInDayOfWindow`) keeps reading `event_date` directly (placeholder date works correctly because no host at year/month precision is hitting the T-1h..T+8h window — they haven't booked vendors yet) · new pre-render block computes the vendor availability intersection (only fires for year/month + confirmed vendors) and renders `<VendorAvailabilityIntersection>` below the date row.
- **`apps/web/app/dashboard/create-event/actions.ts`** — **Task #38 bundled fix.** Removed the auto-stamp lines `ceremony_type_locked_at: isWedding ? new Date().toISOString() : null` and `ceremony_type_locked_by: isWedding ? user.id : null` from the events insert. New events now land with NULL `ceremony_type_locked_at` so the chip renders the "Set wedding type" CTA correctly (matching Claire & Ice's pre-launch behavior). `event_date_precision` is NOT set explicitly so the column default `'year'` applies.

**SPEC IMPACT:** Moderate — Task #39 introduces a new architectural primitive (event date as a tiered model rather than a specific-day-required field). This supersedes iteration 0021 § 10 narrative-driven multi-party date-change negotiation flow for the most common case (couple narrows date via vendor-availability intersection rather than negotiating a date change). Affects spec corpus iteration 0021 (date model + § 2.0a Date row UX) and tangentially iteration 0006 (vendor calendar blocks remain the same; new consumer for intersection queries). Spec-corpus CLAUDE.md decision log row pending — flagged in COWORK_INBOX.md.

---

## 2026-05-20 · feat(0005): wire LED Background Maker draft persistence (PR 2 of 5)

**Commit:** to be filled after commit.

**Context:** PR 2 of 5 for iteration 0005 LED Background Maker. The shipped scaffold (template gallery + loop selector + Photo Pool toggle) was UI-only — the "Render & queue for USB delivery" button generated a mock job id and nothing persisted. This PR wires the save flow against the PR #150 schema and updates the post-save copy so couples aren't promised emails the render pipeline can't deliver yet.

**What ships:**

- `apps/web/app/api/led-background/save/route.ts` — `POST /api/led-background/save`. Couple-authenticated; validates template_slug against the in-repo enum + loop_duration_s against the 5/10/30/90-min table; upserts a `led_background_configs` row keyed by `(event_id, is_default=TRUE)` via the partial unique index from PR #150. Returns `{ config_id, created }`. config_json holds `{ template_id, loop_duration_s, photo_pool_enabled }` — the rest of the spec's customization fields (palette, effect_intensity, animation_speed, overlay, aspect_ratio, show_couple_names, show_date) default at render time from the template's defaults until PR 2b adds editor controls.
- `apps/web/app/dashboard/[eventId]/add-ons/led/page.tsx` — server-side admin fetch loads the couple's default config (if any) and threads it through to the client component as `initialConfig`. Service-role admin client used because `led_background_configs` ships RLS-on with no policies yet.
- `apps/web/app/dashboard/[eventId]/add-ons/led/_components/led-background-maker.tsx`:
  - Accepts new `initialConfig` prop; restores `selectedSlug`, `loopSeconds`, `photoPoolEnabled` state from it on first render so reopening the page shows the last saved draft.
  - `handleRender` now POSTs to `/api/led-background/save`, surfaces a save error inline under the CTA when the request fails, and only flips to the success card on `res.ok`.
  - Removed the `generateMockJobId` helper; the success card now shows the real `config_id` (UUID) under "Draft ID".
  - Success-card copy rewritten to be honest: "Draft saved" instead of "Render queued"; the render-pipeline ETA / venue-USB language is now phrased as a future commitment ("when the render pipeline goes live…") rather than a near-term promise.
  - Reset CTA copy: "Render another loop" → "Edit draft". Dropped the "Track render status in Orders" link since the render flow doesn't exist yet.

**SPEC IMPACT:** Minor. The 0005 spec's § "Functional scope · Must work end-to-end" lists template gallery, live preview, render submission, render pipeline, download, Drive push, email notification, re-render. This PR delivers the persistence layer underlying the editor surface; render pipeline + Drive push + email notification + download all wait on PR 3. No locked decisions touched. The honest post-save copy is a temporary measure until the render pipeline ships; once PR 3 lands the success-card copy reverts to "Render queued" with real ETAs.

---

## 2026-05-20 · feat(0009): status + disconnect routes + finalization notifications (PR 5 of 5)

**Commit:** to be filled after commit.

**Context:** Final PR of the 0009 Photo Delivery V1 build. Closes the loop the worker (PR #154) opened: panel can now poll for live progress, couples can disconnect Drive cleanly, and finalized jobs fan out couple-side in-app + email notifications via the existing 0028 helper.

**What ships:**

- `supabase/migrations/20260520040000_iteration_0009_notification_types.sql` — adds two `notification_type` enum values (`photo_delivery_complete`, `photo_delivery_failed`). Bare migration (no transaction wrapper) since `ALTER TYPE ADD VALUE` rejects explicit BEGIN; `IF NOT EXISTS` keeps it idempotent. Matches the prior `force_majeure_filed` pattern from PR #76.
- `apps/web/lib/notifications.ts` — extends `NotificationType` enum + adds matching `NOTIFICATION_TYPE_LABEL` ("Photos delivered" / "Photo delivery failed") + `NOTIFICATION_TYPE_TONE` rows (emerald for complete, rose for failed).
- `apps/web/lib/photo-delivery-release.ts` — `finalizeJob` now calls a new `fanOutFinalizationNotice` that emits the relevant notification to every couple member of the event. Idempotency guard: `photo_delivery_jobs.notification_sent_at` is stamped first, so repeated empty-batch ticks after a job has already finalized don't re-fire.
- `apps/web/app/api/photo-delivery/status/route.ts` — `GET ?event_id=...`. Couple-authenticated. Returns `{ event: { photo_delivery_* fields }, job: { latest photo_delivery_jobs row } }`. Panel polls this ~2s during an active release.
- `apps/web/app/api/photo-delivery/disconnect/route.ts` — `POST { event_id }`. Couple-authenticated. Revokes the Drive refresh token at Google (best-effort), marks `oauth_grants.revoked_at`, and wipes the `events.photo_delivery_*` panel fields back to idle. Idempotent — safe to re-call.

**Out of scope (deliberately deferred):**

- Panel UI re-wiring (the `photo-delivery-panel.tsx` client component is still scaffold-level: 516 lines of local-state mock data). A follow-up PR replaces the mock state with real fetches against `/status`, calls `/release` on the Connect-CTA click path, and surfaces a Disconnect button against `/disconnect`. Not a blocker for V1 since the OAuth flow + worker are end-to-end functional; only the visual surface lags.
- Redeliver is implemented by simply re-POSTing to `/api/photo-delivery/release` — `enqueueRelease`'s artifact UPSERT skips already-delivered photos by virtue of the unique-on-source-photo-id constraint + `drive_file_id IS NULL` worker filter. No new route needed.

**SPEC IMPACT:** None on locked policy. The notification copy is owner-tunable; if the owner prefers different language for "Photos delivered" / "Photo delivery hit a snag", that's a small follow-up — the strings live in `apps/web/lib/photo-delivery-release.ts` (`fanOutFinalizationNotice`) for the email/notification body and in `apps/web/lib/notifications.ts` for the bell-label. The 0028 email infrastructure send-path is unchanged; this PR just emits two new notification types through it.

---

## 2026-05-20 · feat(0009): photo-delivery release producer + sweep tick (PR 4 of 5)

**Commit:** to be filled after commit.

**Context:** PR 4 of 5 for iteration 0009 Photo Delivery. The 0009 brief assumed a Cloudflare Workers + Queues background pipeline; that infra doesn't exist in this repo. This PR ships a Vercel-native equivalent that fits the existing on-access-sweep cron strategy. Follows PR 1 (schema), PR 2 (encryption.ts helper — currently unused; planned harmonization deferred), PR 3 (Drive OAuth routes).

**What ships:**

- `supabase/migrations/20260520030000_iteration_0009_photo_delivery_artifacts.sql` — new `photo_delivery_artifacts` join table (job_id, event_id, source_table='papic_photos' for now, source_photo_id, r2_object_key, drive_file_id, attempt_count, last_error_*). Unique (event_id, source_table, source_photo_id) keeps re-releases idempotent. Partial index on (event_id, attempt_count, created_at) WHERE drive_file_id IS NULL covers the worker's hot path. RLS on, no policies — server role only.
- `apps/web/lib/photo-delivery-release.ts` — `enqueueRelease` (validates event state, lists deliverable `papic_photos` rows, creates job + upserts artifacts, flips events status) and `processBatchForEvent` (token refresh via `papic-drive.ts`, R2 download via `@aws-sdk/client-s3` GetObject, Drive multipart upload to `events.photo_delivery_folder_id`, per-file retry with attempt_count cap = 5, progress rollup, terminal job finalization).
- `apps/web/app/api/photo-delivery/release/route.ts` — POST producer. Couple-auth required; validates membership via event_members; delegates to `enqueueRelease`.
- `apps/web/app/api/cron/photo-delivery-tick/route.ts` — POST sweep. `x-cron-secret` guard (reuses `OAUTH_REFRESH_CRON_SECRET`); picks up to 5 events with `photo_delivery_status ∈ {'releasing','uploading'}` per tick, processes 6 artifacts per event.

**Architecture deviations from spec (all flagged in COWORK_INBOX.md):**

1. No Cloudflare Workers — Vercel routes + cron tick instead.
2. Source of truth is `papic_photos`, not a unified `photos` table (which doesn't exist).
3. Per-photo delivery state lives in new `photo_delivery_artifacts` join table, not on the source photos table.
4. Drive route names are `/api/oauth/photo-delivery/*`, not `/api/oauth/google/*` from the spec.
5. Refresh token stays plaintext in `oauth_grants` (Papic's shipped pattern); PR 1 `events.photo_delivery_oauth_token_encrypted` column + PR 2 `encryption.ts` helper currently unused, pending a future harmonization PR that may migrate `oauth_grants.refresh_token` to encrypted via pgcrypto.

**Owner actions (gating live operation):**

1. Set `OAUTH_REFRESH_CRON_SECRET` in Vercel env vars if not already set (also unlocks the existing OAuth-refresh cron).
2. Configure an external scheduler to POST `/api/cron/photo-delivery-tick` with `x-cron-secret` header every 1-2 minutes. Cloudflare Cron Triggers or Vercel Cron are both fine; cadence is a tradeoff between Drive API quota burn and delivery latency.
3. `PHOTO_DELIVERY_OAUTH_REDIRECT_URI` + Google Cloud redirect URI registration (still pending from PR 3).
4. `ENCRYPTION_KEY` in Vercel (still pending from PR 2; unused today but kept ready for the harmonization).

**SPEC IMPACT:** SUBSTANTIAL — see `COWORK_INBOX.md` entry "2026-05-20 — Iteration 0009 architecture deviations" for the full owner-walked update list against `0009_photo_delivery.md`.

---

## 2026-05-20 · feat(0009): OAuth start + callback routes for Photo Delivery Drive (PR 3 of 5)

**Commit:** PR #153 (`ce0aa86`).

**Context:** Backfill — process-gap catch-up for the 4 PRs shipped earlier this session without CHANGELOG entries.

**What ships:** New routes `/api/oauth/photo-delivery/start` + `/callback`. New provider value `'drive_photo_delivery'` on `oauth_state` + `oauth_grants`. New helper lib `photo-delivery-drive.ts`. `.env.example` adds `PHOTO_DELIVERY_OAUTH_REDIRECT_URI`. See PR #153 body for the full file list.

**SPEC IMPACT:** Rolled into the 2026-05-20 PR 4 SPEC IMPACT row above (consolidated).

---

## 2026-05-20 · feat(0009): AES-256-GCM token encryption helper (PR 2 of 5)

**Commit:** PR #152 (`fcd1389`).

**What ships:** `apps/web/lib/encryption.ts` (lazy-loaded AES-256-GCM via `ENCRYPTION_KEY`, server-only). `.env.example` adds `ENCRYPTION_KEY`.

**SPEC IMPACT:** None on current behaviour — helper sits unused after the PR 3 architectural call to use `oauth_grants` plaintext. Will be reused when `oauth_grants.refresh_token` migrates to encrypted-at-rest.

---

## 2026-05-20 · feat(0009): photo-delivery schema foundation (PR 1 of 5)

**Commit:** PR #147 (`f75a462`).

**What ships:** 12 `photo_delivery_*` columns on `events` + new `photo_delivery_jobs` table.

**SPEC IMPACT:** `events.photo_delivery_oauth_token_encrypted` is currently dead per the PR 3 architectural call (using `oauth_grants` plaintext instead). Will be re-evaluated in the future harmonization PR.

---

## 2026-05-20 · feat(0005): LED background schema foundation — configs + renders (PR 1 of 5)

**Commit:** PR #150 (`3b105bc`).

**What ships:** `led_background_configs` (10-template enum, one-default-per-event) + `led_background_renders` (1080p/4k/8k/custom resolution guard, master loop length 300/600/1800/5400 s).

**SPEC IMPACT:** SKU seed deferred — the spec's 2026-05-08 pricing table at `0005_led_background_maker.md` shows 8K ₱99 cheaper than 1080p ₱249 which reads like a transposed typo; owner reconciliation needed before live SKUs ship. See `COWORK_INBOX.md` 2026-05-20 entry "0005 LED pricing table sanity check".

---

## 2026-05-19 · feat(0015): wire 8 PH coverage-map city photo tiles

**Commit:** to be filled after commit.

**Context:** Continues the placeholder sequence (PRs #130 hero/portraits, #132 add-ons/covers). The coverage-map section was an SVG silhouette + 6 city chips reading as abstract dots-on-a-map. Adding a small photo-tile grid below the SVG turns the section into a "real places, real coverage" visual without overwhelming the map itself. Two new cities added (Tagaytay + Bohol) since Tagaytay is a key PH wedding destination and Bohol's Chocolate Hills are an iconic regional marker.

**What ships:**

- `apps/web/public/coverage/{manila,tagaytay,baguio,iloilo,cebu,bohol,cagayan-de-oro,davao}.avif` — 8 city vignettes from Higgsfield `soul_location` (1:1 at 2048×2048, AVIF q=65, total 1.0 MB).
- `apps/web/app/page-sections/_CoverageMap.tsx`:
  - `PIN_PLACEHOLDERS` gains `image: string` field on each entry + 2 new pins (Tagaytay, Bohol). Reordered geographically (north-to-south).
  - Chip strip replaced with a 2-col mobile / 4-col desktop photo-tile grid (each tile = `aspect-square` AVIF + city label below). Subtle `hover:scale-[1.04]` for the photos. Photo tiles are decorative — `alt=""`, hover-scale obeys `prefers-reduced-motion: reduce` (transition disabled by the global Phase 1 reduce-motion block).
- `apps/web/public/coverage/README.md` (new) — file mapping, source notes, replacement contract, privacy invariant per 0015 § Section 10 (city-level only — never barangay, never identifiable couples).

**SPEC IMPACT:** None on schema/SKU/policy. Two new cities surfaced on the marketing-site coverage map (Tagaytay, Bohol); the privacy invariant (city-level only) is preserved. Iteration `0015_main_website.md` § Section 10 already calls for a `city-pins` overlay — the new tiles below the map don't change that contract.

---

## 2026-05-19 · feat(0015): wire 11 add-ons tile photos + 2 dashboard cover placeholders

**Commit:** to be filled after commit.

**Context:** PR #130 landed the hero + portrait placeholder set. This continues the placeholder sequence the owner requested ("create placeholders for all items on our website"). Section 7 of the homepage (`_InAppServices.tsx`) was 11 icon-only cards reading as a generic feature list — adding a per-card hero image transforms the section into a product showcase. Couple-dashboard cover photos land as ready inventory pending the 0021 cover-slot wiring.

**What ships:**

- `apps/web/public/add-ons/{papic,panood,pamahiya,pakulay,pailaw,pareto,custom-monogram,pro-invitation-widgets,ai-video,photo-delivery,supplies-marketplace}.avif` — 11 AI-generated 16:9 tile banners (Higgsfield `z_image`, AVIF q=65, total 1.10 MB).
- `apps/web/public/dashboard/{cover-couple-venue,cover-reception-table}.avif` — 2 wide-frame cover placeholders for the eventual couple-dashboard event-header cover slot. Not yet wired; sample wiring snippet in `public/dashboard/README.md`.
- `apps/web/app/page-sections/_InAppServices.tsx` — Added `image: string` field to the `SERVICES` type + array (11 paths). Refactored each card to render a 16:9 `<Image>` banner at the top (rounded-xl `overflow-hidden`, `aspect-[16/9]`, `object-cover`). First 3 cards lazy-load eagerly; remaining 8 use default lazy behavior so below-fold cards don't compete for bandwidth on first paint.
- `apps/web/public/add-ons/README.md` (new) — mapping table, source notes, replacement contract.
- `apps/web/public/dashboard/README.md` (new) — wiring instructions for when 0021 adopts the slot.

**SPEC IMPACT:** None. Placeholder imagery only. Real photography lands via the same `image: '/add-ons/<slug>.avif'` pointers once Setnayan books real events.

---

## 2026-05-19 · feat(0015): commit Higgsfield AI placeholder hero + 11 portrait/variant placeholders

**Commit:** to be filled after commit.

**Context:** Phase 5 of the recent responsive/UX audit landed the `<HeroBackdrop>` infrastructure with an env-var-driven photo slot (PR #128), and Phase 4 added the aurora motion behind it (PR #129). Both shipped with no real asset — the homepage rendered the aurora + cream gradient. This PR commits the AI-generated placeholder set requested by the owner.

**What ships:**

- `apps/web/public/hero/hero-couple.avif` — Take 1 of the "forehead-touch / golden hour / left-third composition" prompt set. Generated via Higgsfield `z_image` (16:9, 2048×1152), AVIF q=65, ~62 KB on the wire.
- `apps/web/public/hero/variants/` — 5 alternate compositions (forehead-touch take 2, walking 1+2, ring-detail 1+2). Available for instant swap via `NEXT_PUBLIC_HERO_IMAGE_URL`.
- `apps/web/public/portraits/` — 6 cinematic solo-character portraits (3 grooms, 3 brides) for use as vendor-card / testimonial-avatar placeholders until the verified vendor cohort onboards (Dec 2026 launch). Generated via Higgsfield `soul_cast`.
- `apps/web/app/_components/hero-backdrop.tsx` — `src` default changed from `process.env.NEXT_PUBLIC_HERO_IMAGE_URL` (which could be undefined → gradient fallback) to `process.env.NEXT_PUBLIC_HERO_IMAGE_URL ?? '/hero/hero-couple.avif'`. Env var still wins when set; the committed file is now the deterministic default.
- `apps/web/public/hero/README.md` rewritten — documents what's live, what variants are on deck, swap procedure, and the brief for the eventual real photoshoot.
- `apps/web/public/portraits/README.md` (new) — usage pattern for vendor-card fallbacks (hash `public_id` → portrait), with a hard rule against captioning these AI faces with real names/businesses/testimonials.

**Conversion pipeline:** PNG 2048×1152 source from Higgsfield CDN → AVIF q=65 effort=6 via `sharp@0.34.4`. Total committed weight: 1.34 MB across 12 files (avg ~110 KB).

**SPEC IMPACT:** None. Placeholders only — no schema, no SKU, no copy, no feature surface changes. The eventual real photoshoot (an owner-action item flagged in the responsive/UX audit) will replace `hero-couple.avif` with a real Filipino wedding moment; that swap is also documented in `public/hero/README.md`. The portrait set is explicitly marked as **not for use with real names** — when verified vendors land they'll provide real photos via the upload pipeline (iteration 0006 + 0023).

---

## 2026-05-16 · feat(0012): Google Drive OAuth + Papic storage-choice setup (V1 scope expansion)

**Commit:** to be filled after commit.

**Context:** Sibling PR to the YouTube/Panood slice from earlier today (PR #95, SHA `565e79c`). Iteration 0012 Papic is V1.5+ deferred in the spec corpus, but per the 2026-05-16 decision-log row "OAuth wiring for V1.5+ scaffold setup pages shipped early" the owner expanded V1 scope so couples can connect their BYO Google Drive at setup time. This PR is the Papic/Drive slice of that decision. The shared `oauth_grants` foundation already shipped in PR #95 (`20260516260000_oauth_grants_per_couple.sql`); this PR adds the per-event `papic_storage_target` column + the Drive OAuth round-trip + a rewritten Papic setup page that surfaces the storage choice as a radio.

**What this rewrites:** the Papic setup page at `apps/web/app/dashboard/[eventId]/add-ons/papic/page.tsx` previously framed Papic as purely a V1.5+ surface with mock data. This rewrite preserves all the existing sections (seat status, DSLR bridge, gestures, gallery preview, settings) and adds a new **Section 1: "Where your photos go"** containing two radio cards:
- **Setnayan storage** (recommended default) — fast and reliable, Setnayan keeps a secure copy.
- **Use my Google Drive only** — narrower scope, no Setnayan copy, but quota + reliability tradeoffs on the couple.

**Spec deviation from earlier T+30d transfer model (LOCKED 2026-05-16):** the prior 0012 spec contemplated Setnayan keeping photos for 30 days then bulk-pushing to Drive. The new model is **real-time DURING the event for BOTH options** — R2 is the primary by default; couples who opt out get Drive throttling + their own quota constraints as a deliberate tradeoff. No bulk-transfer pipeline ships in V1. Spec corpus catch-up queued in COWORK_INBOX.md.

**Why it's safe to ship today:** every Drive surface is wrapped in a graceful-fallback check — if `GOOGLE_DRIVE_OAUTH_CLIENT_ID` is unset (the expected state until Google Cloud verified-app review completes, 1-4wk) the Drive radio renders disabled with an italic "coming soon — admin setup pending" caption and the start route returns 503 with a structured error. The Setnayan-R2 default option remains fully functional. Couples don't see broken buttons; the V1 launch isn't blocked on the owner-side OAuth timeline.

**New migration `supabase/migrations/20260516280000_events_papic_storage_target.sql`:**
- `ALTER TABLE events ADD COLUMN papic_storage_target TEXT NOT NULL DEFAULT 'setnayan_r2' CHECK (papic_storage_target IN ('setnayan_r2', 'google_drive_only'))`. TEXT + CHECK rather than ENUM to match the `oauth_grants.provider` pattern already in PR #95 — easier to extend later without enum-in-transaction friction.
- `COMMENT ON COLUMN` documents the V1 contract: `'google_drive_only'` requires an active `oauth_grants` row with `provider='drive'` for the same event_id; the disconnect route flips the column back to `'setnayan_r2'` to keep the capture pipeline from being left in a broken state.

**New helper module `apps/web/lib/papic-drive.ts`** (mirrors `lib/panood-youtube.ts`):
- `getDriveOAuthConfig()` — env-driven config status with `ready: false, missing[]` branch for graceful fallback.
- `buildDriveAuthorizeUrl()` — Google OAuth consent URL with `access_type=offline` + `prompt=consent` + scope `drive.file` (narrowest possible — only files Setnayan creates in the couple's Drive, NOT full Drive access).
- `exchangeDriveCodeForToken()`, `refreshDriveAccessToken()`, `revokeDriveToken()` — Google token endpoint wrappers.
- `fetchDriveUserInfo()` — userinfo endpoint call for `external_account_display` (best-effort).
- `bootstrapPapicDriveFolders()` — creates `Setnayan/[Event display_name]/{00_Cover, 01_Pre-event, 02_Ceremony, 03_Reception, 04_Auto-Recap}` via parallel Drive API folder creates; returns the root folder id to store in `oauth_grants.metadata.drive_folder_id` so the V1.5+ capture pipeline knows where to write.
- `generateDriveStateToken()` — 24-byte hex CSRF nonce, same scheme as YouTube/Patiktok so the shared `oauth_state` table sees uniform-looking values.
- `PAPIC_DRIVE_SUBFOLDERS` exported as a constant so the connected-panel UI can render the structure preview even when metadata is empty for any reason.

**New OAuth routes (all guard env-missing → 503 / coming-soon caption):**
- `apps/web/app/api/oauth/drive/start/route.ts` — couple-membership check, inserts oauth_state row with `provider='drive'`, 302 to Google.
- `apps/web/app/api/oauth/drive/callback/route.ts` — validates state, exchanges code, fetches userinfo, bootstraps the Drive folder tree (failure here redirects with `?drive_error=folder_bootstrap_failed:...` so we never persist a grant without a folder id), upserts oauth_grants (onConflict: `event_id,provider` so a re-consent replaces in place and recreates the folder structure). Redirects to `/dashboard/[eventId]/add-ons/papic?drive_connected=1` or `?drive_error=<reason>`.
- `apps/web/app/api/oauth/drive/disconnect/route.ts` — POSTs Google's revoke endpoint best-effort, flips `revoked_at` locally, AND resets `events.papic_storage_target` back to `'setnayan_r2'` (paired updates run via `Promise.all`) so the capture pipeline can't be left pointing at a disconnected grant.

**New server actions `apps/web/app/dashboard/[eventId]/add-ons/papic/actions.ts`:**
- `setPapicStorageR2(formData)` — always safe; flips `events.papic_storage_target` to `'setnayan_r2'`.
- `setPapicStorageDrive(formData)` — defensive re-check that an active oauth_grants row exists for (event_id, 'drive') before flipping the column. If no grant, redirects with `?storage_error=connect_drive_first`. The UI also gates the button on connection state but the server checks again so a stale form submission can't leave the capture pipeline pointed at a phantom grant.

**Token-refresh worker extension `apps/web/app/api/cron/oauth-refresh/route.ts`:**
- Replaced the `provider !== 'youtube'` early-skip block with a per-provider dispatch (`youtube` → `refreshYoutubeAccessToken`, `drive` → `refreshDriveAccessToken`). Both providers call the same Google OAuth token endpoint but use SEPARATE env-driven client credentials so they can be rotated independently. The TikTok grants still live in `patiktok_oauth_grants` and skip with `provider_not_yet_implemented`.

**Papic setup page rewrite:** preserves all 5 existing scaffold sections (now renumbered 2-6 — seat status, DSLR bridge, gestures, gallery preview, settings) and inserts a new **Section 1: "Where your photos go"** above them. The new section renders:
- Two radio cards (Setnayan R2 with "Recommended" pill / Drive with quota-warning caption).
- Each radio is its own form submitting to the server action; clicking switches the storage target server-side and revalidates the path.
- Below the Drive radio: either the "coming soon" caption (env-missing), the Connect Drive CTA (env-ready, no grant), or the connected panel with disconnect form + bootstrapped folder structure preview (env-ready, grant present).
- Status banners surface `?drive_connected=1` / `?drive_disconnected=1` / `?drive_error=<reason>` / `?storage_set=r2|drive` / `?storage_error=<reason>` from the query string.

**Env vars added to `.env.example`:**
- `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, `GOOGLE_DRIVE_OAUTH_REDIRECT_URI` with owner-action notes explaining the dual-purpose Google Cloud client (YouTube + Drive can share the same OAuth 2.0 client; the redirect URI distinguishes them).
- No new cron secret — the Drive refresh sweep reuses `OAUTH_REFRESH_CRON_SECRET` from PR #95.

**Tests:** no test runner exists in `apps/web` today. The integration cases called out in the brief (radio default = R2; Drive radio disabled when env unset + "coming soon" visible; `/start` 503-when-unset → 302-when-set; `/callback` state-mismatch rejection; bootstrap creates 5 sub-folders; `setPapicStorageDrive` rejects when no active grant) are noted as `TODO(0012): integration tests` at the bottom of the Papic page so the next iteration that lands a test runner picks them up automatically.

**Files:**
- `supabase/migrations/20260516280000_events_papic_storage_target.sql` — NEW.
- `apps/web/lib/papic-drive.ts` — NEW.
- `apps/web/app/api/oauth/drive/{start,callback,disconnect}/route.ts` — NEW.
- `apps/web/app/dashboard/[eventId]/add-ons/papic/actions.ts` — NEW.
- `apps/web/app/dashboard/[eventId]/add-ons/papic/page.tsx` — REWRITE (Section 1 added; sections 2-6 preserved with renumbering).
- `apps/web/app/api/cron/oauth-refresh/route.ts` — EDIT (drive branch wired; existing youtube branch unchanged).
- `.env.example` — appended Iteration 0012 Drive OAuth section.

**SPEC IMPACT:** **YES** — four pending Cowork updates queued in `COWORK_INBOX.md`:
1. `~/Documents/Claude/Projects/Setnayan/0012_papic/0012_papic.md` — add storage-choice flow section + the new `events.papic_storage_target` schema + flag the deviation from the T+30d transfer model.
2. `~/Documents/Claude/Projects/Setnayan/App_Build_Status.md` — flip iteration 0012 row from "🟡 V1.5+" to "⚠️ Partial — Drive OAuth + storage-choice setup shipped V1; capture pipeline still V1.5+".
3. `~/Documents/Claude/Projects/Setnayan/CLAUDE.md` — append a decision-log row dated 2026-05-16 capturing the Papic V1 scope expansion + the spec deviation + the dual-purpose Google Cloud client.
4. `~/Documents/Claude/Projects/Setnayan/API_Integration_Checklist.md` — add § 5.6 (or extend § 5.3) for the Drive OAuth scope; flag the dual-purpose YouTube+Drive OAuth client.

---

## 2026-05-16 · feat(0011): YouTube OAuth wiring + Panood setup rewrite (V1 scope expansion)

**Commit:** to be filled after commit.

**Context:** Iteration 0011 Panood is V1.5+ deferred in the spec corpus, but per the 2026-05-16 4th decision-log row the owner authorized OAuth wiring on the V1.5+ scaffold setup pages so couples can connect their BYO accounts at setup time. This PR is the YouTube slice of that decision; sibling Agent B (Papic / Drive, iteration 0012) and Agent C (Patiktok / TikTok, iteration 0017 — already shipped via PR #92) close the rest. The PR also introduces the shared `oauth_grants` foundation that all three providers will eventually share (TikTok still uses the older `patiktok_oauth_grants` for V1; consolidation is a follow-up).

**What this rewrites:** the Panood setup page at `apps/web/app/dashboard/[eventId]/add-ons/panood/page.tsx` reflected the composite-era model (Cloudflare Stream Live + Setnayan-owned master YouTube channel). Per the 2026-05-16 BYO-YouTube pricing pivot Panood now broadcasts on each couple's own channel. This rewrite adds a Step 1 "Connect your YouTube channel" panel and reframes the existing sections around BYO ownership while preserving the existing SKU display + visual language.

**Why it's safe to ship today:** every Connect surface is wrapped in a graceful-fallback check — if `YOUTUBE_OAUTH_CLIENT_ID` is unset (the expected state until Google Cloud verified-app review completes, 1-4wk window) the page renders a disabled "coming soon — admin setup pending" placeholder and the start route returns 503 with a structured error. Couples don't see broken buttons; the V1 launch isn't blocked on the owner-side OAuth timeline.

**New migration `supabase/migrations/20260516260000_oauth_grants_per_couple.sql`** (NOT the originally-assigned 230000 slot — that slot was already taken by the iteration 0017 Patiktok migration that landed earlier today; bumped to 260000 to keep the lexical chain consistent on this date):
- `public.oauth_grants(grant_id, event_id → events, provider IN ('youtube','drive','tiktok'), scopes TEXT[], refresh_token, access_token, access_token_expires_at, external_account_id, external_account_display, granted_at, revoked_at, last_refreshed_at, metadata JSONB)` with `UNIQUE(event_id, provider)` and three indexes (event+provider, active partial, expiry).
- RLS: `event_member_reads_oauth_grants` for couples (uses `public.current_event_ids()`), `admin_manages_oauth_grants` for admin. Writes go through service-role routes only — no couple-write policy.
- `public.oauth_state(state_token PK, event_id, provider, initiated_by, created_at)` CSRF nonce table with admin-only read RLS.
- `TODO(security):` annotated in the migration body — refresh_token + access_token are TEXT for V1 (Supabase Postgres at-rest encryption only); a pgcrypto column-level encryption wrapper is a follow-up once a project-wide helper lands.

**New helper module `apps/web/lib/panood-youtube.ts`:**
- `getYoutubeOAuthConfig()` — env-driven config status with `ready: false, missing[]` branch for graceful fallback.
- `buildYoutubeAuthorizeUrl()` — Google OAuth consent URL with `access_type=offline` + `prompt=consent` + scopes `youtube` + `youtube.upload`.
- `exchangeYoutubeCodeForToken()`, `refreshYoutubeAccessToken()`, `revokeYoutubeToken()` — Google token endpoint wrappers.
- `fetchYoutubeChannel()` — channels API call for the display label (best-effort, failure doesn't block grant persistence).
- `generateYoutubeStateToken()` — 24-byte hex CSRF nonce.

**New OAuth routes (all guard env-missing → 503 / coming-soon redirect):**
- `apps/web/app/api/oauth/youtube/start/route.ts` — couple-membership check, inserts oauth_state row, 302 to Google.
- `apps/web/app/api/oauth/youtube/callback/route.ts` — validates state, exchanges code, fetches channel info, upserts oauth_grants (onConflict: event_id,provider so a re-consent replaces in place), redirects to `/dashboard/[eventId]/add-ons/panood?youtube_connected=1` or `?youtube_error=<reason>`.
- `apps/web/app/api/oauth/youtube/disconnect/route.ts` — POSTs Google's revoke endpoint best-effort, flips `revoked_at` locally.

**New cron worker stub `apps/web/app/api/cron/oauth-refresh/route.ts`:**
- Auth via `x-cron-secret` header (constant-time compare against `OAUTH_REFRESH_CRON_SECRET` env).
- Walks `oauth_grants` rows with `access_token_expires_at < now() + 24h AND revoked_at IS NULL`, refreshes each YouTube grant, updates the row in place.
- `TODO(0011):` scheduling itself is owner-side (Cloudflare Cron Trigger or Supabase pg_cron). Recommended cadence: hourly during PHT 06:00-23:00.
- `TODO(0012, Agent B):` Drive branch left as `provider != 'youtube' → skipped`; will be filled when Agent B lands.

**Panood setup page rewrite:** five sections — Step 1 connect (NEW), Step 2 SKU summary (preserved from scaffold), Step 3 broadcaster + cameras (preserved), Step 4 add-on packs (preserved), Step 5 viewer info (rewording: "Setnayan's master channel" → "your own channel"). Status banners surface `?youtube_connected=1` / `?youtube_disconnected=1` / `?youtube_error=<reason>` from the query string. Replaced the `Youtube` lucide icon (not in the pinned lucide-react@1.14.0) with `Tv` to match the existing icon vocabulary.

**Env vars added to `.env.example`:**
- `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`, `YOUTUBE_OAUTH_REDIRECT_URI` (Google Cloud project + verified-app review owner action).
- `OAUTH_REFRESH_CRON_SECRET` (shared with the future Drive refresh sweep).

**Tests:** no test runner exists in `apps/web` today (`package.json` exposes lint + typecheck only). The integration cases called out in the brief (`/start` 503-when-unset → 302-when-set; `/callback` state-mismatch rejection; setup page coming-soon vs Connect render) are noted as `TODO(0011): integration tests` at the bottom of the Panood page so the next iteration that lands a test runner picks them up automatically.

**Files:**
- `supabase/migrations/20260516260000_oauth_grants_per_couple.sql` — NEW.
- `apps/web/lib/panood-youtube.ts` — NEW.
- `apps/web/app/api/oauth/youtube/{start,callback,disconnect}/route.ts` — NEW.
- `apps/web/app/api/cron/oauth-refresh/route.ts` — NEW.
- `apps/web/app/dashboard/[eventId]/add-ons/panood/page.tsx` — REWRITE (Step 1 added, Step 5 reworded; rest preserved).
- `.env.example` — appended Iteration 0011 section.

**SPEC IMPACT:** **YES** — three pending Cowork updates queued in `COWORK_INBOX.md`:
1. `~/Documents/Claude/Projects/Setnayan/App_Build_Status.md` — flip iteration 0011 row from "🟡 V1.5+" to "⚠️ Partial — OAuth setup flow shipped V1; broadcaster surface still V1.5+".
2. `~/Documents/Claude/Projects/Setnayan/CLAUDE.md` — append a decision-log row dated 2026-05-16 capturing the V1 scope expansion + the graceful-fallback pattern + the verified-app-review dependency.
3. `~/Documents/Claude/Projects/Setnayan/API_Integration_Checklist.md` § 5.3 — flip the YouTube Data API per-couple OAuth row from "V1.5+ activation" to "V1 wiring shipped; owner-side Google Cloud setup is the remaining blocker".

---

## 2026-05-16 · feat(0022): Boosted Ads ladder + Sponsored Boost Quarterly/Annual tier

**Commit:** to be filled after commit.

**Context:** Iteration 0022 § 5b (locked 2026-05-16 — eighth row of the 2026-05-16 decision log). Replaces the retired single ₱1,499/wk Sponsored Boost SKU with a two-tier marketing ladder: (1) **Boosted Ads** weekly by radius (5km ₱5,000 / 10km ₱8,000 / 20km ₱15,000) and (2) **Sponsored Boost** long-commit, 30km, verified-only (Quarterly ₱250,000 / Annual ₱800,000). The five new SKUs were already seeded in `service_catalog` by the existing `20260516000000_v1_sku_lock_service_catalog.sql` migration (lines 333–390) and the old `sponsored_boost_weekly` row was flipped to `is_active=FALSE` (lines 478–492). This PR ships the missing **per-vendor subscription ledger** + **vendor marketing surface** + **admin queue** + **DIY-browse badge / sort impact** that turn the seeded prices into a shippable feature.

**What shipped:**
- `supabase/migrations/20260516220000_vendor_ad_subscriptions.sql` — new table tracking per-vendor purchases. Columns: `vendor_profile_id`, `sku_code` (FK to `service_catalog`), `radius_km` (5/10/20/30 check), `gross_centavos`, `payment_method_key`, `order_id`, `started_at`, `expires_at`, `auto_renew`, `cancelled_at`, `cancel_reason`, `refund_centavos`, `cancelled_by_user_id`, `notes`. Three indexes: `vendor_idx`, `sku_idx`, partial active-only `active_idx`, and partial expiring-only `expiring_idx`. **RLS:** vendor self-read of own rows (matches `vendor_tool_bundles` pattern) + admin read-all; service-role writes only (no policied INSERT/UPDATE/DELETE for users). Also creates the `vendor_active_ads` view which collapses overlapping rows to the single most-permissive active subscription per vendor (Sponsored > Boosted; larger radius > smaller; latest expiry wins). Idempotent.
- `apps/web/lib/vendor-ads.ts` — typed TS mirror of the 5 SKUs with the per-tier metadata the UI needs (radius, term days, use-case copy, verified-only flag, auto-renew default). Helpers: `findAdOption()`, `fetchVendorAdSubscriptions()`, `fetchAllAdSubscriptionsForAdmin()`, `isActiveAdSubscription()`, `daysRemaining()`, `fetchActiveAdLookups()` (the marketplace bulk lookup), `adPriceDisplay()`, `effectiveMonthlyPesos()` (for the Sponsored Boost amortization copy). Graceful degradation: every fetch swallows `42P01` "relation does not exist" so the app keeps rendering on pre-migration environments.
- `apps/web/app/vendor-dashboard/marketing/page.tsx` — new vendor-facing route. Sections: (i) flash banner (started / cancelled / error), (ii) verified gate callout (V1 reads `vendor_profiles.public_visibility = 'verified'`; degrades gracefully if a parallel agent's `vendors.verification_state` enum ships, see Verification handoff below), (iii) "Currently running" card per active tier with cancel form + auto-renew indicator + days-remaining, (iv) Boosted Ads picker (3 cards, terracotta accent), (v) Sponsored Boost picker (2 cards, gold/amber accent, "≈ ₱X/mo effective" sticker), (vi) static stacked-cost worked example matching the spec, (vii) 20-row history list with cancel-reason annotations.
- `apps/web/app/vendor-dashboard/marketing/actions.ts` — two server actions: `startAdSubscription(formData)` validates the SKU + verified gate, enforces V1 "one active per tier" guard (a Boosted + a Sponsored row can coexist; a second Boosted or a second Sponsored while one is live is rejected), inserts the subscription row, audit-logs the start (`vendor_ad_subscription_start`), and revalidates `/vendor-dashboard/marketing` + `/admin/ads` + `/vendors`. `cancelAdSubscription(formData)` is the vendor self-serve cancel — confirms authority via `vendor_profile_id`, idempotent on already-cancelled rows, audit-logs `vendor_ad_subscription_cancel`.
- `apps/web/app/vendor-dashboard/layout.tsx` — adds the new **Marketing** subnav tab (Megaphone icon) between Earnings and Notifications. Match `prefix` so deep links / future sub-routes stay highlighted.
- `apps/web/app/admin/ads/page.tsx` + `actions.ts` — new admin queue. Status tabs (Active / Cancelled / Expired / All), per-row card showing vendor (with `/v/{slug}` link), SKU + radius + term + gross, days-remaining or expiry date, auto-renew + refunded amount when present, cancel form with required reason + optional `refund_centavos` (capped at the gross). Admin cancel writes `vendor_ad_subscription_admin_cancel` to `admin_audit_log` with before/after JSON and the actor's user_id. Refund payment movement runs through the existing `/admin/payments` rail; this surface is the queue marker.
- `apps/web/app/admin/layout.tsx` — adds the **Ads** tab to the admin top-nav between Receipts and Reviews.
- `apps/web/app/vendors/page.tsx` — public marketplace now: (1) calls `fetchActiveAdLookups()` on the visible rows in a single round-trip, (2) sorts boosted/sponsored vendors to the top of the page within each existing sort key (Sponsored > Boosted > unboosted), (3) renders a gold **Featured Sponsor** pill on Sponsored cards and a terracotta **Boosted** pill on Boosted cards (cards also get a subtle border accent matching the badge), and (4) preserves the verified-only toggle + coming-soon dimming behavior from PR #56.

**Pricing centralization:**
- All amounts stored in PHP centavos (1 peso = 100 centavos) matching `service_catalog`. Display via `formatCentavosPhp()` from `lib/sku-catalog.ts`. No new pricing constants outside the typed `AD_TIER_OPTIONS` mirror in `lib/vendor-ads.ts` — the migration's snapshot is the source of truth. `detectAdPriceDrift()` helper exists for future test coverage.
- Sponsored Boost Quarterly: ₱250,000 = 25,000,000 centavos. Annual: ₱800,000 = 80,000,000 centavos. Boosted Ads: ₱5,000 / ₱8,000 / ₱15,000 (500,000 / 800,000 / 1,500,000 centavos). Verified-only flag set TRUE on all 5 rows per the locked spec.

**Verification handoff (graceful degradation):**
- Spec calls out that a parallel agent is wiring `vendors.verification_state` enum; until that column lands, the marketing surface reads `vendor_profiles.public_visibility === 'verified'` as the V1 proxy (semantically equivalent per 0022 § 2.1c). The actions code checks for a `verification_state` field on the raw vendor row first; if present (post-other-agent landing — see the verification-flow PR landing in the same batch) it uses that; otherwise it falls back to `public_visibility`. No conflict either way.

**Out of scope (intentional V1 boundaries):**
- Real payment flow. V1 keeps the apply-then-pay rail: vendor opts in → subscription row goes live → Setnayan admin reconciles the corresponding order via `/admin/payments` → admin cancels (via `/admin/ads`) if payment fails within 7 days. The vendor sees this in the "Started" flash banner copy on the marketing surface.
- Per-pin gating. Spec § 5b allows a multi-pin vendor to see the boost available per-zone (locked in some pins, available in others). V1 is single-radius; multi-pin will land alongside iteration 0006's Extended Pins extended work.
- Density gate (≥20 vendors in same service category within 20km). The view hides the boost below threshold per spec — V1 doesn't implement the daily cron that computes `vendors_in_20km_per_category`; the gate ships when iteration 0023 admin console adds the relevant settings surface.
- Featured Vendor / Category Sponsor / Showcase Spotlight future boost types are deferred to V1.5.

**Test plan:**
- [x] `pnpm --filter @setnayan/web typecheck` — passes
- [x] `pnpm --filter @setnayan/web lint` — clean
- [x] `pnpm --filter @setnayan/web build` — clean (new routes `/vendor-dashboard/marketing` + `/admin/ads` listed in the build output)
- [ ] Owner: `supabase db push` to apply `20260516220000_vendor_ad_subscriptions.sql` (joins the existing pile of pending migrations)
- [ ] After deploy, eyeball `/vendor-dashboard/marketing` for a verified vendor shows the two pickers, the started-flash, the one-active-per-tier gate, and the stacked-cost example
- [ ] After deploy, `/vendors` marketplace shows the **Featured Sponsor** gold pill on Sponsored vendors and **Boosted** terracotta pill on Boosted vendors; boosted vendors appear at the top of every sort key
- [ ] After deploy, `/admin/ads` shows the active queue, cancel form persists, and `admin_audit_log` carries a `vendor_ad_subscription_admin_cancel` row

**SPEC IMPACT:** None — implements 0022 § 5b verbatim, including the retire of `sponsored_boost_weekly`, the 5-row ladder, the verified-only gate on Sponsored, and the stacked-cost example. The migration's table + view names match the spec's `sponsored_boosts(...)` block ergonomically while extending it to cover both the weekly Boosted ladder and the long-commit Sponsored tier in one table (a deliberate V1 simplification — the spec's table-per-tier hint was for documentation, not a schema requirement).

---

## 2026-05-16 · feat(0026): BIR Form 2307 quarterly auto-fill — per-vendor PDF + pg_cron + admin queue

**Commit:** to be filled after commit.

**Context:** Iteration 0026 § 5.4 ("Form 2307 quarterly generation") + the V1 SKU lock decision row from 2026-05-16 — "BIR 2307 generation, vendor_payouts table" was the last engineering item left open against the V1 launch-blocker list for iteration 0034 Payments. This PR closes that gap end-to-end: one PDF per (vendor, year, quarter), generated automatically on the 1st of every Jan/Apr/Jul/Oct at 02:00 PHT via Supabase pg_cron, with an admin-side manual trigger + per-row regenerate button for backfills and corrections.

**What shipped:**
- `supabase/migrations/20260516100000_iteration_0026_bir_2307_filings.sql` — adds `vendor_2307_filings` (one row per vendor per quarter, with monthly breakdown + totals JSONB + audit log + PDF storage ref), BIR identity columns on `vendor_profiles` (`tin_number`, `tin_type`, `registered_business_name`, `registered_address`, `registered_zip`, `bir_service_category`) and the matching Setnayan-side payor columns on `platform_settings` (`bir_payor_name`/`_address`/`_zip` + `bir_authorized_rep_name`/`_tin`/`_title`). Migration enables `pg_cron` + `pg_net` extensions (guarded — silently skipped on environments where the extensions aren't available) and schedules the `quarterly_2307_generation` cron job to POST to `/api/admin/cron/generate-2307` on the 1st of Jan/Apr/Jul/Oct at 02:00 PHT (18:00 UTC). RLS allows self-read by the owning vendor + full read by admin; no vendor writes.
- `apps/web/lib/bir/atc-mapper.ts` — pure `mapVendorToATC(vendor)` that returns `{ atc_code, rate_bps, description }`. Wires the V1 ruleset: WC158 (2%) for any corporation, WI151 (5%) for professional individuals, WI080 (5%) for talent individuals, WI158 (2%) for default service-supplier individuals under the Top Withholding Agent rule. Includes a `centavosToPesoString` helper used by every PDF surface.
- `apps/web/lib/bir/filings.ts` — server-side data access. `buildQuarterFilings(admin, period)` walks `vendor_payouts.bir_withholding_centavos` (post-#68 Setnayan Pay reprice column) for the quarter, groups by vendor + month-index within quarter, runs the ATC mapper, returns the aggregated filing inputs. Also exposes `quarterThatJustEnded(now)`, `quarterToPeriod(year, q)`, `deadlineForQuarter(year, q)` (Apr 30 / Jul 31 / Oct 31 / Jan 31), `fetchFilingByVendorAndPeriod`, `listFilingsForVendor`, `listAllFilings`.
- `apps/web/lib/bir/2307-pdf.ts` — `generate2307PDF({filing, period, payor})` using pdf-lib. Two strategies: (A) load `apps/web/public/bir-forms/2307-2018-ENCS.pdf` and fill AcroForm fields by name (`Payee_TIN` / `Field2` / `Payor_TIN` / `Field6` / `ATC_1` / `M1_1` / etc. — multiple naming variants per slot so a BIR template refresh doesn't drop fields silently) then flatten; (B) when no AcroForm fields exist on the template, overlay text at calibrated coordinates; (C) fallback when the template file is absent — draws a from-scratch single-page Letter portrait layout with all BIR-required sections (period header, Part I Payee, Part II Payor, Part III monthly breakdown table with ATC rows, grand totals row, signature block). All three paths emit `Uint8Array` PDF bytes for upload.
- `apps/web/lib/bir/storage.ts` — `upload2307Pdf({pdfBytes, vendor_profile_id, tax_year, tax_quarter})` writes to R2 bucket `setnayan-bir-2307` (env `R2_BUCKET_BIR_2307`), with auto-fallback to Supabase Storage bucket `bir-2307` when R2 envs are unset. Object key: `vendors/{vendor_profile_id}/{year}_Q{quarter}.pdf` — matches the spec § 5.4 layout (minus the bucket-name prefix, which is the bucket itself).
- `apps/web/lib/bir/generator.ts` — orchestration. `generateQuarter({admin, year, quarter, triggered_by_admin_id})` aggregates filings → renders PDFs → uploads → upserts the `vendor_2307_filings` row (idempotent — regenerating UPDATEs in place, bumps `regenerated_count`, appends to `audit_log`). Per-vendor failures are recorded as `status='error'` rows but don't abort the batch. Also exports `regenerateVendor(...)` for the admin manual button.
- `apps/web/app/api/admin/cron/generate-2307/route.ts` — `POST` handler with two auth paths: (1) `X-Cron-Secret` header matched against `process.env.CRON_SECRET` (used by Supabase pg_cron via `net.http_post`), (2) admin session cookie via `createClient()` + `users.account_type/is_internal/is_team_member` check (used by the manual trigger button on `/admin/bir/2307`). Accepts `?year=&quarter=` for backfills; defaults to the quarter that just ended. Returns a JSON summary `{vendor_count, generated, skipped_no_ewt, errors, filings}`. `GET` returns metadata so an operator can sanity-check the wiring without firing a real run.
- `apps/web/app/api/admin/bir/2307/regenerate/route.ts` — `POST` handler for single-row regeneration. Validates admin session, then calls `regenerateVendor(...)` and returns the upserted row.
- `apps/web/app/vendor-dashboard/tax-documents/page.tsx` + `actions.ts` — vendor surface showing per-quarter filings with download link + "Mark as filed" toggle for the vendor's own record-keeping. Top card shows the vendor's BIR identity (TIN / registered name / address / ZIP / TIN type / BIR service category) with red-tone callouts for unset fields and an inline reminder that TIN edits require re-verification (per spec § 7.3). Banners: amber "ready to download" for new filings, red "past the filing deadline" for ones still un-actioned past the BIR deadline.
- `apps/web/app/admin/bir/2307/page.tsx` + `_components/manual-trigger.tsx` + `_components/regenerate-button.tsx` — admin queue. Period filter dropdown, summary stats (filings count, gross paid, EWT, generated/downloaded/filed/error counts), per-row table with View + Regenerate. Manual trigger card at the top lets admin pick `{year, quarter}` and POST to the cron endpoint.
- `apps/web/app/admin/layout.tsx` — wired new "BIR 2307" tab into the admin sub-nav (between Receipts and Reviews).
- `apps/web/app/vendor-dashboard/layout.tsx` — wired new "Tax docs" tab into the vendor sub-nav (after Earnings, before Notifications).
- `.env.example` — added `R2_BUCKET_BIR_2307=setnayan-bir-2307` + `CRON_SECRET=` with comments documenting the owner-side setup (Supabase Dashboard ALTER DATABASE for `app.cron_secret` + `app.app_url`).
- `apps/web/public/bir-forms/.gitkeep` — placeholder that documents the BIR template owner-action.
- `apps/web/package.json` — adds `pdf-lib ^1.17.1`.

**Cron strategy:** Supabase pg_cron + pg_net. Avoids an external scheduler (Vercel Cron / GitHub Actions / Cloudflare Workers) — pg_cron ships with Supabase Postgres, runs free, and authenticates via a database-side `app.cron_secret` GUC so the secret never leaves Postgres. The cron's `net.http_post` calls `/api/admin/cron/generate-2307` with `X-Cron-Secret` and a JSON body so the same endpoint also handles admin manual triggers.

**Verify:**
- `pnpm --filter @setnayan/web typecheck` ✅
- `pnpm --filter @setnayan/web lint` ✅
- `pnpm --filter @setnayan/web build` ✅ (new routes present: `/admin/bir/2307`, `/api/admin/bir/2307/regenerate`, `/api/admin/cron/generate-2307`, `/vendor-dashboard/tax-documents`)

**Owner action required:**
1. **Download the official BIR Form 2307 (January 2018 ENCS) PDF** from https://www.bir.gov.ph/index.php/bir-forms/certificates.html and check it into the repo at `apps/web/public/bir-forms/2307-2018-ENCS.pdf`. Until this file lands, the generator falls back to a from-scratch layout that contains every BIR-required field but isn't a pixel-perfect facsimile.
2. **Provision the R2 bucket** `setnayan-bir-2307` in the Cloudflare R2 dashboard (PH region; lifecycle: retain 10 years per BIR audit window; no public access — URLs are emitted server-side and shared only with the owning vendor + admin).
3. **Enable Postgres extensions** in Supabase Dashboard → Database → Extensions: `pg_cron` and `pg_net` (both ship pre-installed; just flip the toggle).
4. **Set cron + URL GUCs** in Supabase SQL Editor (one-time):
   ```sql
   ALTER DATABASE postgres SET app.cron_secret = '<openssl rand -hex 32>';
   ALTER DATABASE postgres SET app.app_url    = 'https://www.setnayan.com';
   ```
5. **Paste `CRON_SECRET`** (the same value from step 4) into Vercel env (Production + Preview).
6. **Fill `platform_settings.bir_payor_*` + `bir_authorized_rep_*`** via the admin settings surface once the legal-name + BIR Permit + authorized-signatory are confirmed (these populate Part II of every 2307 PDF).
7. **Backfill vendor BIR identity** (`vendor_profiles.tin_number`, `tin_type`, `registered_business_name`, `registered_address`, `registered_zip`, `bir_service_category`) — currently nullable; without them the mapper defaults to individual + service_supplier → WI158 at 2%.
8. **Spec corpus** (do NOT edit in this worktree): note in `0026_bir_tax_compliance.md` § 5.4 that the actual repo implementation reads `vendor_payouts.bir_withholding_centavos` (post-#68) rather than the spec's `service_orders.bir_withholding_centavos` placeholder. Mention also that `vendor_profiles` carries the BIR identity columns rather than the `vendors` table named in the spec.

**Out of scope (deferred to V1.5+):**
- Email notification when a 2307 is generated (0028 hooks pending — vendor surface already shows it).
- Multi-ATC per vendor — V1 mapper emits a single ATC code per vendor, even if the vendor delivered services across multiple BIR categories in a quarter. Once a future migration adds `vendor_services.bir_atc_override` we can group by service.
- 2307 PDF e-signature via 0027 — V1 prints `payor.authorized_rep_name` on the signature line; physical signing is admin-side, offline.
- Form 1601-EQ remittance return CSV export — covered by iteration 0026 § 6.2 as a follow-on under the `/admin/finance/tax-reports` surface.

**SPEC IMPACT:** Iteration 0026 § 5.2 + § 5.4 schema names diverge slightly from the live code (live: `vendor_profiles` + `vendor_payouts`; spec: `vendors` + dedicated `form_2307_issuances`). Engineering followed the live schema to avoid renaming tables that #68 just landed. Spec corpus update — call out the column-location reality in 0026 — is owner-side per `feedback_setnayan_edit_first_and_safety` (no spec-folder edits from this worktree).

---

## 2026-05-16 · feat(0006,0034): Vendor Payout model — verified T+1 + coming_soon 20/60/20

**Commit:** to be filled after commit.

**Context:** Spec lock 2026-05-16 in `0006_vendors_management.md` § "Vendor Payout model" and `0034_payments_and_cart.md` § 6.7 — verified vendors receive an immediate full payout T+1 (less gateway + BIR 0.5% withholding; Setnayan absorbs the ₱15-25 disbursement fee); coming_soon (and demoted) vendors release in three milestone stages (20% on booking confirmation, 60% T+7 from event start, 20% T+7 from event end) with T-14 + T+7 dispute windows; vendors auto-demote on 3+ disputes in any rolling 30-day window. The build-status grid row "Vendor Payout model (NEW 2026-05-16)" flips from 🟡 pending → 🟢 V1 web ready post-merge.

**What shipped:**
- `supabase/migrations/20260516210000_vendor_payout_model.sql` — adds the canonical `payout_stage` ENUM (`immediate_full`, `stage_1_confirm`, `stage_2_event_start`, `stage_3_event_end`); ALTERs `vendor_payouts` to add audit-trail columns (`payout_stage`, `gross_centavos`, `gateway_fee_centavos`, `vendor_net_centavos`, `scheduled_at`, `paid_at`, `dispute_window_ends_at`, `payment_method`, `audit_log JSONB`); ALTERs `orders` (this repo's `service_orders`) with `setnayan_fee_bps` / `gateway_fee_centavos` / `bir_withholding_centavos` / `vendor_net_centavos` / `disbursement_fee_centavos` / `payment_method_key` / `vendor_profile_id`; new `vendor_disputes` table + `count_vendor_disputes_30d()` SQL helper for the cron. Idempotent (CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DO blocks for the ENUM). RLS preserved.
- `apps/web/lib/payouts.ts` — payout dispatcher. `computePayoutBreakdown` does integer-centavo gross→net math (Setnayan fee + gateway + BIR 0.5% deducted; disbursement fee tracked-not-deducted). `planPayoutStages` returns 1 row (verified) or 3 rows (coming_soon 20/60/20) with correct `scheduled_at` + `dispute_window_ends_at`. `dispatchVendorPayouts` writes the rows idempotently keyed on `(order_id, payout_stage)`. `markPayoutPaid` + `holdPayout` append audit-log entries on every transition.
- `apps/web/app/api/admin/cron/dispute-counter/route.ts` — POST-only daily cron. Authenticates via `Authorization: Bearer $CRON_SECRET`; rolls 30 days of `vendor_disputes` rows; flips any verified vendor with 3+ disputes to `public_visibility = coming_soon` + bumps `demotion_count` + writes `admin_audit_log` row with `action='vendor_demoted_by_dispute_threshold'`. Falls back gracefully when the parallel `verification_state` column / `last_demoted_at` / `demotion_count` columns are absent at apply time (since both migrations land in the same `supabase db push`).
- `apps/web/app/admin/payouts/page.tsx` + `actions.ts` — new admin queue at `/admin/payouts` with filter tabs (Pending / Paid / On hold / All) + stage tabs (Immediate / Stage 1 / 2 / 3) + vendor-ID search + scheduled-date range. Each row exposes "Mark paid" (records payment method + reference + appends audit-log entry) and "Place on hold" (records reason). KPI row shows pending + paid + on-hold totals scoped to the filter selection.
- `apps/web/app/admin/layout.tsx` — added "Payouts" tab to the admin top nav (between Payments + Receipts).
- `apps/web/app/admin/page.tsx` — added a Vendor payouts tile to the overview grid.
- `apps/web/app/vendor-dashboard/earnings/page.tsx` — vendor-side surface now reads `vendor_payouts` for the signed-in vendor and renders the confirmed-but-not-paid / in-stage / paid split, including BIR + gateway per-stage breakdown and an explanatory blurb that swaps between the verified-T+1 and coming_soon-20/60/20 narratives based on the vendor's `public_visibility`. RLS on `vendor_payouts` already gates this read to the vendor's own rows.
- `apps/web/app/admin/payments/actions.ts` — `approvePayment` now invokes `schedulePayoutsForOrder` after promoting an order to `paid`. Computes the breakdown, writes it back onto the order row (so receipts can read it), and calls `dispatchVendorPayouts` (verified → 1 stage T+1; coming_soon → 3 stages 20/60/20). No-op when the order isn't a vendor booking (`vendor_profile_id` NULL). Failures are caught + logged but never block payment approval.
- `apps/web/lib/vendor-profile.ts` — `fetchOwnVendorProfile` now selects `public_visibility` so vendor surfaces can render the payout-model copy that matches their state.

**Coordination with PR #80 (vendor verification flow, merged just before):** The verification PR introduced the `verification_state` ENUM + `last_demoted_at` / `demotion_count` columns this PR's cron writes. `lib/payouts.ts::resolveVendorVerificationState` prefers `verification_state` when present and falls back to `public_visibility` so this code is order-independent at the migration level. The dispute counter cron also catches missing-column errors and retries the UPDATE with the safe column subset.

**Dispute counter cron infra (owner action):**
- No `vercel.json` exists in the repo, so the cron is implemented as a POST-only API route protected by `CRON_SECRET`. Until Vercel Cron Pro is enabled in V1.5 (per spec Maya Business gateway timeline), the owner triggers it from an external scheduler (cron-job.org, GitHub Actions, etc.) hitting `POST /api/admin/cron/dispute-counter` with `Authorization: Bearer $CRON_SECRET` once a day. When `vercel.json` lands, add `"crons": [{ "path": "/api/admin/cron/dispute-counter", "schedule": "0 4 * * *" }]` (04:00 UTC = noon Manila).

**SPEC IMPACT:** None — implements an existing 2026-05-16 spec lock without modifying the spec corpus. The build-status grid row will be flipped by the owner from 🟡 to 🟢 (V1 web ready) post-deploy.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ · `pnpm --filter @setnayan/web lint` ✅ · `pnpm --filter @setnayan/web build` ✅. Migration is additive-only; existing `vendor_payouts` rows (none today) keep their legacy `stage`/`trigger_type`/`payout_method` columns and gain a populated `payout_stage` via the migration's `UPDATE`.

**Out of scope:**
- Real Maya Business gateway integration (V1.5+ per § 6.6).
- BIR Form 2307 PDF generation (V1.5; columns reserved).
- Two-admin gate on payout release (V1.5 per § 9.1).
- Per-method config wiring through to per-order `payment_method_key` (column added; cart-side wiring is a follow-on).

---

## 2026-05-16 · feat(0006,0023): vendor verification flow + admin queue + SKU aliases

**Commit:** to be filled after commit.

**Context:** Spec corpus 2026-05-16 locked the full Vendor Verification flow: FREE initial / ₱1,500 annual renewal / ₱2,500 post-demotion re-verification, 12-document checklist, all-or-nothing approval, 3–5 BD SLA, `setnayan-vendor-verification` R2 bucket (90-day rolling raw + 7-year audit per BIR § 235). PR #56 shipped the admin queue shell + the marketplace `public_visibility` state machine; this PR completes the workflow side: a new `verification_state` ENUM on `vendor_profiles`, an `application` intake table, a `tier_history` audit table, the vendor-facing 12-doc upload page, and the admin Approve / Reject / Demote / In-review action set.

**Schema (`supabase/migrations/20260516040000_iteration_0006_vendor_verification_flow.sql`):**
- New ENUM `vendor_verification_state('unverified','pending_review','verified','demoted','rejected')`.
- New column `vendor_profiles.verification_state` default `'unverified'` (idempotent ADD COLUMN IF NOT EXISTS); + `last_verified_at`, `next_renewal_due_at`, `demotion_count`, `last_demoted_at`. Backfill: rows already at `public_visibility='verified'` from PR #56 lift to `verification_state='verified'` so live listings retain their perk-unlock signal on deploy.
- New table `vendor_verification_applications` — application/intake rows. Tracks `application_type` (`initial` / `annual_renewal` / `post_demotion`), `fee_php_centavos`, `status` (`draft` / `pending_review` / `in_review` / `approved` / `rejected` / `withdrawn`), `doc_uploads` JSONB (12-doc checklist + R2 keys), `docs_complete`, `submitted_at`, `sla_due_at`, `admin_user_id`, `decision`, `decision_reason`, `decided_at`, `notes`. RLS: vendor sees + writes their own draft rows; admin (service-role) has full access.
- New table `vendor_tier_history` — state-transition audit (`from_state` / `to_state` / `application_id` / `admin_user_id` / `reason` / `metadata`). RLS: vendor sees their own timeline; admins see everything.
- Two SKU alias rows in `service_catalog` (`verification_annual_renewal` ₱1,500 + `verification_reverification` ₱2,500) coexist with the canonical `vendor_verification_*` codes from the 2026-05-16 SKU lock so call sites that follow either naming convention resolve.
- All inserts use `ON CONFLICT (sku_code) DO UPDATE`; all DDL is `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS`; no drops.

**Environment + R2:**
- `.env.example` gains `R2_BUCKET_VENDOR_VERIFICATION=setnayan-vendor-verification` (90d rolling raw + 7yr audit retention per BIR § 235; owner provisions the bucket separately).
- `apps/web/lib/r2.ts` exports `vendorVerification: 'setnayan-vendor-verification'`.
- `apps/web/app/api/upload/route.ts` whitelists `vendor-verification` / `vendorVerification` as a bucket alias with a 15 MB per-file cap.
- `apps/web/app/_components/file-upload.tsx` adds `'vendor-verification'` to the `FileUploadBucket` union.

**Vendor surface (`apps/web/app/vendor-dashboard/verify/`):**
- New tab `Verify` in the vendor-dashboard subnav (`layout.tsx`).
- `page.tsx` — single-page workflow:
  - Status card (current `verification_state` + latest application reference).
  - "Start application" picker for `initial` / `annual_renewal` / `post_demotion` (recommended type pre-selected from `recommendedApplicationType` heuristic).
  - Progress bar (`completeCount`/12) + per-slot card grid for the 12 checklist items. Each card carries the spec hint (e.g. "auto-validated via DTI lookup once integration ships") and per-slot input UI:
    - Upload slots → `FileUpload` with R2 `vendor-verification` bucket + per-vendor path prefix.
    - `social_media` → URL input.
    - `google_meet` / `phone_email_otp` / `amlc_screening` → admin-run notice ("Setnayan flips this after submission").
    - Portfolio-samples + client-references accept multi-file uploads (up to 10).
  - Submit gate: requires ≥ 8 of 12 items to submit (the 4 admin-run slots — Persona ID, Google Meet, OTP, AMLC — are flipped post-submit).
  - Pending / Approved / Rejected status cards render once a decision lands.
- `actions.ts` — server actions `ensureDraftApplication`, `updateDocUpload`, `submitApplication`, `withdrawApplication`. Submit stamps `submitted_at` + `sla_due_at` (5 business days), bumps `verification_state` → `pending_review`, and writes an `admin_audit_log` row.
- `apps/web/lib/vendor-verification.ts` — shared types + helpers (`DOC_SLOTS`, `VERIFICATION_STATES`, `APPLICATION_FEE_CENTAVOS`, `countCompleteSlots`, `addBusinessDays`, `computeSlaTone`, `formatSlaCountdown`, `fetchLatestApplication`, `fetchTierHistory`, `recommendedApplicationType`).

**Admin surface (`apps/web/app/admin/verify/`):**
- `page.tsx` — refactored into two surfaces switched by `?surface=`:
  - `applications` (default) — Vendor Verification queue with tabs `pending` / `in_review` / `approved` / `rejected` / `demoted` / `all`. Each row shows the vendor, application type + fee, SLA badge (on_track / warning amber after 3 BD / overdue red after 5 BD / closed), tier badge, status badge, decision reason, and a 12-doc checklist `<details>` expander. Action row: `Mark in review` / `Approve → Verified` / `Reject…` (textarea reason required, min 5 chars) / `Demote…` (for approved rows, textarea reason required).
  - `visibility` — the marketplace `public_visibility` queue from PR #56, preserved 1:1.
- `actions.ts` — adds server actions `approveApplication`, `rejectApplication`, `demoteVendor`, `setApplicationInReview`. Each writes the application row's `decision` + `admin_user_id` + `decided_at`, transitions `vendor_profiles.verification_state` (and side-effects: `last_verified_at` / `next_renewal_due_at` on approve · `last_demoted_at` + `demotion_count++` on demote), inserts a `vendor_tier_history` row, and writes an `admin_audit_log` row.

**Webhook stubs (owner-action pending):**
- `apps/web/app/api/webhooks/persona/route.ts` — accepts POST + GET, logs the payload to console + Sentry breadcrumb, returns 200. No signature verification yet (Persona dashboard signup is owner-action pending per App_Build_Status.md). TODO comment block in the file documents the wire-up steps.
- `apps/web/app/api/webhooks/veriff/route.ts` — same pattern; parallel stub for the Veriff provider.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ · `lint` ✅ (zero warnings) · `build` ✅ (`/vendor-dashboard/verify` + `/admin/verify` + `/api/webhooks/persona` + `/api/webhooks/veriff` all listed in the route table).

**Owner action required:**
- `supabase db push --db-url "$SUPABASE_DB_URL"` to apply the migration.
- Provision Cloudflare R2 bucket `setnayan-vendor-verification` (90-day rolling lifecycle on `raw/` prefix · 7-year retention on `audit/` prefix per BIR § 235).
- Sign up for Persona / Veriff / Onfido + AMLC; populate `PERSONA_API_KEY` / `PERSONA_TEMPLATE_ID` / `AMLC_API_KEY` in Vercel; then wire signature verification + the post-submit handler into the webhook stubs.

**SPEC IMPACT:** None — implements 0006 § "Vendor Verification flow (locked 2026-05-16)" + 0023 § 3.2a as written. Two minor spec-side notes to surface to Cowork separately: (1) the spec's `verification_state` ENUM lists `('coming_soon','verified','demoted','revoked')` while the engineering task brief locked `('unverified','pending_review','verified','demoted','rejected')`; this PR follows the task brief because the workflow needs distinct `unverified` (no app started) vs `pending_review` (app submitted) vs `rejected` (admin said no, vendor must re-apply) states the spec wording elides. (2) The spec's `vendor_verification_applications` schema is satisfied 1:1; the spec ENUM mismatch is the only deviation.

---

## 2026-05-16 · feat(infra): graceful Supabase Storage fallback when R2 env vars are unset

**Commit:** to be filled after commit.

**Context:** The R2 migration shipped in PR #18 — all production uploads write to one of the four Cloudflare R2 buckets (`setnayan-media`, `setnayan-thread-files`, `setnayan-vendor-contracts`, `setnayan-samples`). Today's change closes a dev/staging gap: if a deployment is missing `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`, the server-side upload helper (`lib/storage.ts → uploadPublicAsset`) used to throw at the first `getR2Client()` call, which propagated as a 500 to the user. The fallback now writes to Supabase Storage `platform-assets` (the pre-PR-#18 path) and logs a one-shot warning so the operator sees the gap without users seeing an error. Reads of legacy Supabase Storage URLs already pass through `parseStoredAsset → legacy_url` unchanged — that side of the round-trip didn't need to change.

**What shipped:**
- `apps/web/lib/r2.ts` — added `isR2Configured()` predicate, converted `getR2Client()` to return `S3Client | null` instead of throwing, added `requireR2Client()` for code paths that have no fallback, added named helpers `r2Upload` / `r2SignedGet` / `r2PublicUrl` per the R2 migration spec's public surface. Top-of-file docblock now spells out the graceful-degradation contract (which call sites fall back, which surface a 503).
- `apps/web/lib/storage.ts` — `uploadPublicAsset` now checks `isR2Configured()` and routes to the new `uploadViaSupabaseFallback` helper when R2 env vars are unset. Fallback writes to `platform-assets` with the same `${timestamp}-${random}.${ext}` key scheme the legacy V0 code used (so URLs are recognisable to anyone debugging old + new in the same trace). `deletePublicAsset` learned to route by URL shape — R2 URLs go to `DeleteObjectCommand`, Supabase Storage URLs go to `storage.remove()`, and anything else is a no-op. The R2 branch tolerates a missing client (logs a warning and skips, so a delete during a fallback window doesn't crash).
- `apps/web/app/api/upload/route.ts` — presigned-PUT route returns a clean 503 + log when R2 isn't configured (no Supabase equivalent of "browser PUTs the bytes directly", so we can't gracefully degrade this surface — we surface a clear operator-facing error instead).
- `apps/web/lib/uploads.ts` — switched `presignDisplayUrl` / `presignUploadUrl` to use the new `requireR2Client` helper. These two functions sign URLs and have no fallback path.

**Why not a wider migration:** All four call-site categories named in the migration spec (vendor logos, payment screenshots, thread attachments, vendor contracts) were already on R2 as of PR #18 — `git grep` for `supabase.storage` and `.upload(` returned zero matches. This entry is purely about hardening the fallback so dev/staging environments without R2 credentials don't 500.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ (zero errors) · `pnpm --filter @setnayan/web lint` ✅ (no ESLint warnings or errors) · `pnpm --filter @setnayan/web build` ✅ (production build succeeds). No new dependencies — `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` were already in the lockfile from PR #18.

**Owner action items:**
- **None for production** — `R2_ACCESS_KEY_ID` / `R2_ACCOUNT_ID` / `R2_SECRET_ACCESS_KEY` are already set in Vercel and uploads continue to write to R2.
- For local dev / preview deployments without R2 credentials: uploads will silently fall through to Supabase Storage `platform-assets` and you'll see a `[r2] R2 env vars unset` warning in the function logs. Set the three env vars in `.env.local` to exercise the R2 path.

**SPEC IMPACT:** None — codifies the "fall back when env unset" requirement from the R2 migration spec. No spec edits required.

---

## 2026-05-16 · feat(0005): LED Background Maker — scaffold-level launch

**Commit:** to be filled after commit.

**Context:** Iteration 0005 spec (`0005_led_background_maker.md` + `0005_ffmpeg_lottie_reference.md`) defines a couple-facing 8K LED loop generator with USB delivery for venue playback — the "Pailaw" surface in live-site framing. Per the 2026-05-16 decision-log row (12th entry that day), the six V1.5+ deferred add-ons were unlocked for scaffold-level Web V1 launches today; this is the LED entry of that unlock. V1 SKUs/pricing remain locked, so this scaffold carries no new prices and no wallet UI. Master loop durations (5 / 10 / 30 / 90-min Custom tier) follow the 2026-05-08 spec decision row.

**What shipped:**
- `apps/web/lib/led-background.ts` — V1 catalogue of all 10 spec-locked templates (Filigree Bloom, Capiz Shimmer, Sampaguita Drift, Gold Particles, Ethereal Mist, Bokeh Lights, Watercolor Wash, Slow Pulse, Constellation, Velvet Sweep) plus the loop-duration option list with file-size + repeat-count copy.
- `apps/web/app/dashboard/[eventId]/add-ons/led/page.tsx` — RSC entry that loads the event, renders the Pailaw eyebrow + "8K loop · USB delivery" trio strip (Sparkles / Tv / Usb cards), and mounts the maker.
- `apps/web/app/dashboard/[eventId]/add-ons/led/_components/led-background-maker.tsx` — client component for the interactive flow: 10-template gallery (gradient placeholder thumbnails sourced from each template's palette + motif overlay), sticky right-rail customization panel with loop-duration radio group (90-min option visibly disabled with a Lock icon + "Custom tier" hint), Photo Pool blend toggle with explainer copy about rotating photos per loop iteration, output-spec readback, and the Render & queue CTA. Render submission shows a success card with a mock job ID (`LED-2026-XXXXXX`), template + loop + Photo Pool summary, render-time estimate, USB-delivery handoff copy ("We'll email you when your USB master is ready"), and a back-to-Orders link.
- `apps/web/app/dashboard/[eventId]/add-ons/page.tsx` — flipped the `led` entry's `status` from `'coming_soon'` to `'web_v1'` so the card on the add-ons grid is clickable and pills as "Web V1". Touched nothing else in the file.

**What's stubbed (`// TODO(0005):` comments in place):**
- FFmpeg + Lottie 8K render pipeline — `puppeteer-lottie` / `@lottiefiles/lottie-renderer-cli` → PNG sequence → FFmpeg filtergraph composite with particle/light-leak overlays → H.264 MP4 at 8K with 4K + 1080p downsamples.
- Cloudflare Queues render-worker — currently the `Render` button just sets local state to a mock job; production needs the `/api/led-background/render` endpoint, queue insertion, and a polling status surface.
- Photo Pool blend logic — selects N photos per loop iteration from the event's photo pool, composites at 30% opacity behind the monogram.
- USB master fulfillment — physical delivery via iteration 0018 Supplies Marketplace, per the spec's "auto-delivery to LED tech" + pre-event checklist sections.
- Real looping `thumb.mp4` template previews — gallery cards currently render solid gradient placeholders with motif-overlay copy.

**Out of scope (deferred):**
- Real 8K rendering — needs the FFmpeg + Lottie worker container.
- Live preview canvas with concurrent animation layers — spec § "Live preview" needs to wait for the production pipeline + browser preview shim.
- Hosted Live Playback URL add-on (₱99 SKU) — V1 surface is offline-USB-first per spec § "Offline safety".
- Drive push integration — depends on iteration 0009 photo-delivery shipping first.
- Pricing display — V1 SKUs/pricing remain locked; checkout is order-and-pay via Setnayan team handoff for now (mirrors Save-the-Date pattern).
- DB migration — scaffold is pure mock client state, so no `led_render_jobs` table was added in this PR. A migration named `20260516400000_iteration_0005_led.sql` (with RLS via `current_event_ids()`) ships when the render worker lands.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ (zero errors) · `pnpm --filter @setnayan/web lint` ✅ (no ESLint warnings or errors).

**SPEC IMPACT:** None — this implements the scaffold layer for iteration 0005 per the locked spec; no spec edits required.

---

## 2026-05-16 · feat(marketing): surface 0009 Photo Delivery + 0018 Supplies Marketplace on www.setnayan.com

**Commit:** to be filled after commit.

**Context:** Per the 12th 2026-05-16 decision-log row (V1.5+ unlock), six previously-deferred iterations are landing as scaffold-level routes under `/dashboard/[eventId]/add-ons/`. The public marketing surface (homepage `_InAppServices` + `/features` `_DayOfApparatus`) already advertised four of them (Panood, Papic, Pamahiya = 0017 Patiktok in marketing copy, Pailaw) but the two new V1.5+ surfaces — **0009 Photo Delivery** and **0018 Supplies Marketplace** — had no marketing presence at all. Owner asked for these to be visible on www.setnayan.com so couples discovering the site can see the full feature surface, not just the V1 cluster.

**What shipped:**
- `apps/web/app/page-sections/_InAppServices.tsx` — added two cards to the homepage in-app-services grid: **Photo Delivery** (CloudUpload icon, "Full-res handoff after the day" tagline, 30-day compression-grace explainer) and **Supplies Marketplace** (ShoppingBag icon, "Wedding-day supplies, one bill" tagline, vetted-PH-vendors framing). Both tagged `quote` consistent with the rest of the apparatus catalog (no PHP figures on marketing pages per iteration 0015's pricing-hide rule).
- `apps/web/app/features/_sections/_DayOfApparatus.tsx` — mirrored the two new cards in the `/features` deep-dive section, sized + framed to match the existing seven service entries (Panood / Papic / Pamahiya / Pakulay / Pailaw / Pareto / Custom Monogram Pack).

**Cross-cutting:**
- Both files already used `lucide-react` icons; this entry only adds `CloudUpload` + `ShoppingBag` to the imports.
- No new components, no new sections, no new SEO metadata changes — the additions slot into the existing grids and inherit the page-level metadata + JSON-LD blocks.
- Mobile-first layout unchanged; existing Tailwind `sm:` / `lg:` grid breakpoints absorb the two extra cards.
- Pricing-hide rule respected: tag is `quote` on both cards, no PHP figures shown on the public marketing surface.

**Out of scope (per task constraints):**
- Did NOT touch `brand.config.ts`.
- Did NOT introduce new pricing UI, wallet UI, or commission-routing framing (apparatus rule + locked SKU surface untouched).
- Did NOT touch `apps/web/app/dashboard/...` — the dashboard scaffolds for these features ship via the per-iteration PRs from the 2026-05-16 V1.5+ unlock cluster.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ · `lint` ✅. Both files compile clean with the two added icon imports.

**SPEC IMPACT:** None — this is a marketing-side reflection of the existing locked iteration scopes (0009, 0018). No spec edits required.

---

## 2026-05-16 · feat(0009): Photo Delivery — scaffold-level launch

**Commit:** to be filled after commit.

**Context:** Iteration 0009 ([spec](../Setnayan/0009_photo_delivery/0009_photo_delivery.md)) was deliberately deferred to V1.5+ until 2026-05-16, when the owner unlocked all six pending iterations (decision log row 12 on 2026-05-16 in `/Users/icecasasola/Documents/Claude/Projects/Setnayan/CLAUDE.md`). This entry replaces the `IterationPlaceholder` shim at the `photo-delivery` add-ons key with a real, responsive surface and flips the grid status from `coming_soon` → `web_v1`. The 30-day post-download compression rule (per the 2026-05-09 decision log entry) is the canonical UI moment for that policy and is surfaced visibly here.

**What shipped:**
- `apps/web/app/dashboard/[eventId]/add-ons/photo-delivery/page.tsx` — server component shell. Auth-gates the route, reads the event display name + date for the folder-name preview, renders the iteration eyebrow + headline + a top-level 30-day compression-rule callout, then mounts the interactive panel.
- `apps/web/app/dashboard/[eventId]/add-ons/photo-delivery/_components/photo-delivery-panel.tsx` — client component encoding the 3-state lifecycle:
  - **Not connected** — hero card with "Connect Google Drive" CTA (stubbed: shows a 2-second "Drive connection in progress…" spinner, then transitions to connected). Permission-disclosure copy explaining `drive.file` scope. 3-step explainer grid (Connect → Vendors deliver → Download or share).
  - **Connected** — green connection card showing the folder name (`Setnayan · {display_name} · {YYYY-MM-DD}`) + masked account email + Disconnect button. Below it: a 4-item vendor-deliveries list (Lead photographer · 1,247 photos, Second shooter · 612 photos, Drone team · 198 photos + 14 clips, Cinema team · 312 clips) with per-folder size + received date metadata and a "Download all" CTA.
  - **Downloaded** (per-folder) — folder card swaps the CTA for a `Downloaded {relative}` confirmation + a "Re-download originals" secondary action, AND shows a `Originals compress in 28 days` countdown badge (recomputed from `Date.now() - downloadedAtMs` so it stays accurate). When any folder is downloaded, a bottom-of-page amber explainer card surfaces the "you've downloaded — compression in 30 days" copy with re-delivery guidance.
- `apps/web/app/dashboard/[eventId]/add-ons/page.tsx` — flipped the `photo-delivery` ADD_ONS entry from `status: 'coming_soon'` to `status: 'web_v1'`. No other field touched. The `[addon]/page.tsx` placeholder router still has the `photo-delivery` entry in `ADD_ON_META`; it's now unreachable from the grid (the grid links straight to `/add-ons/photo-delivery`) but kept as dead code per the work order.

**What's stubbed (live work for V1.5+ proper):**
- Real Google Drive OAuth (PKCE + `drive.file` scope) — the Connect button is a 2-second `setTimeout` today. Marked `// TODO(0009):` at the call site.
- Real Drive API list/download — the 4-folder mock list is a hard-coded constant in the panel. The shape mirrors the spec's vendor-deliveries section so the swap-in is a fetch-shaped substitution.
- 30-day compression cron worker — UI surfaces the countdown but no server-side timer is scheduled. Marked `// TODO(0009):` on the download handler.
- R2 storage tier transitions (full-res originals → web-quality JPEG after 30 days) — purely a backend concern; the UI explainer prepares couples for it but no transition runs today.
- DB migration intentionally NOT added — local React state is enough to demonstrate the flow at scaffold level. The `photo_delivery_connections` shape is described in the 2026-05-09 result doc and can land alongside the real OAuth wiring without UI churn.

**Out of scope:**
- Real Google OAuth credentials, Google Cloud Project setup, Drive API verification (~6-week Google review for `drive.file` scope per the spec's notes section).
- Server actions / database / background workers — this is intentionally a presentational scaffold so the real iteration can drop in the Drive client without touching the layout.
- Other cloud providers (Dropbox / OneDrive / iCloud) — spec keeps these deferred indefinitely.
- Mobile-specific affordances like a sticky-bottom Connect CTA — the responsive Tailwind grid handles the breakpoints, but a dedicated mobile shell is V1.5+ proper.

**30-day rule visibility (work order requirement):**
- Top-of-page `<aside role="note">` amber callout describes the rule before any download happens — visible the moment the page loads, both desktop and mobile.
- Per-folder countdown badge (`Originals compress in {N} {day|days}`) appears the instant a folder is marked downloaded.
- Post-download explainer card surfaces the rule again with re-delivery guidance once at least one folder has been downloaded.
- All three rule surfaces use the same amber tone (`bg-amber-50` / `text-amber-950` / `bg-amber-200/80`) so the visual association reads as "policy notice".

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ (zero errors) · `pnpm --filter @setnayan/web lint` ✅ (no ESLint warnings or errors). No new dependencies added — Lucide icons (`CloudUpload`, `Camera`, `Plane`, `Video`, `HardDrive`, `Download`, `CheckCircle2`, `ShieldAlert`, `ShieldCheck`, `Loader2`) reused from existing imports.

**SPEC IMPACT:** None — this implements iteration 0009 § Frontend per the locked spec at scaffold level. Stubs map directly to the spec's "must work end-to-end" list (OAuth, Drive API, background job, manifest, notifications) and are inventoried above for the V1.5+ proper follow-up.

---

## 2026-05-15 · feat(0015): /for-vendors landing page (vendor-side acquisition)

**Commit:** to be filled after commit.

**Context:** Iteration 0015 § Routes lists `/for-vendors` as a "vendor-side deep dive (verification, payouts, marketing benefits)" page; per CLAUDE.md decision log 2026-05-15 the page should be at LEAST as polished as the homepage and follow the Airbnb host-page convention (lead with merchant outcomes, Shopify pattern). The pre-existing `/for-vendors` page was the SEO-foundation v1 — covered the basics but lacked vendor-side ops storytelling, comparison framing, transparent pricing, and a sticky mobile CTA.

**Page rewrite (in place):**
- `apps/web/app/for-vendors/page.tsx` — composes the new sections, owns SEO metadata + JSON-LD (BreadcrumbList, Organization, WebPage, plus two `Offer` blocks: free listing and Pro ₱499/wk subscription), renders the shared `SiteHeader` (already context-aware for `as=vendor` per PR #52), and mounts the sticky mobile CTA outside the `<main>` so it floats above the page.

**New section components under `apps/web/app/for-vendors/_sections/`:**
- `hero.tsx` — outcome-led hero ("Run your wedding business in one app"), dual CTA (`List your business · free` → `/signup?as=vendor`, `Talk to a human →` → `/help#contact`), trust strip ("Free to list · No monthly fee until Pro · BIR receipts handled"), and a Mariposa-Bloom dashboard mock card mirroring the homepage's couple-side mock pattern.
- `comparison.tsx` — six-row "5 apps vs Setnayan one app" outcome table (mobile: card stack; desktop: 3-column table with semantic `<th scope="col">` / `<th scope="row">`). Pulls the Shopify outcome-led pattern; mirrors the homepage chaos-panel beat for the vendor side.
- `operating-system.tsx` — six tool cards mapping iteration 0022 § 1's six surfaces (Calendar, Pipeline, Chat, Proposals, Payments, Reviews).
- `pricing.tsx` — exception to the homepage hide-prices rule (per CLAUDE.md 2026-05-15: vendors decide on cost; couples don't yet). Two-tier comparison (Free vs Pro ₱499/week), feature-by-feature checks, primary CTA on Pro.
- `what-you-keep.tsx` — payouts split, BIR receipts, EWT/2307, branding-on-contracts. Sourced from iteration 0022 § 5c (vendor-controlled final price + payment routing).
- `sponsored-boost.tsx` — 10km → 30km visibility extension (iteration 0022 § 5b), certified-vendor gate, density gate, ₱1,499/wk pricing visible.
- `verification.tsx` — 4-step Setnayan Team review process, 3-business-day SLA, DTI/SEC/Mayor's Permit + portfolio-review fallback for solo creatives, `coming_soon` → `verified` state-machine handoff (iteration 0022 § 2.1c).
- `testimonials.tsx` — empty placeholder slots at V1; populate post-launch with real vendor quotes (matches the iteration 0015 § Open Questions stance for couple testimonials, applied to vendor side).
- `closing-cta.tsx` — final dual CTA repeating the hero buttons, framed inside a burgundy-bordered conversion card.
- `sticky-mobile-cta.tsx` — fixed bottom-of-viewport CTA on `sm:` and below. 48px tap target, respects `env(safe-area-inset-bottom)`, hidden at `sm:` breakpoint and above. Page bottom padding (`pb-24 sm:pb-0`) prevents the sticky bar from masking the footer.

**Cross-cutting standards honored:**
- Mobile-first single-column → multi-column grid at `sm:` / `md:` / `lg:`.
- Sticky thumb-zone CTA on mobile per Heyflow / Apple HIG / WCAG 2.2 SC 2.5.8.
- WCAG 2.2 AA: visible focus rings inherited from `.button-primary` / `.button-secondary` (already styled with `focus-visible:ring-2`); `aria-hidden` on decorative icons; `role="region"` + `aria-label` on the sticky CTA bar.
- Burgundy accent throughout (terracotta token name preserved per PR #52 — semantic value is burgundy `#7A1F2B`).
- Taglish-tolerant voice: "Set na 'yan para sa business mo." in the closing CTA eyebrow; "Hi po!" in the demo inquiry; "chineck mo na po" in the comparison table.
- Header `Create account` button already routes to `/signup?as=vendor` on `/for-vendors` paths via `SiteHeader`'s `isVendorContext()` helper — confirmed in `apps/web/app/_components/site-header.tsx`. No header change needed.

**Out of scope (per task constraints):**
- Did NOT touch `apps/web/app/page.tsx` or any homepage section component.
- Did NOT touch `apps/web/app/_components/site-header.tsx`.
- Did NOT add new dependencies — all icons reused from existing `lucide-react`.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ · `lint` ✅ (no warnings or errors) · `build` ✅ (`/for-vendors` listed as ○ static prerendered, 1.52 kB / 165 kB). Prerendered HTML inspected: all section copy present, both Offer schemas in JSON-LD, sticky CTA markup rendered, `/signup?as=vendor` and `/help#contact` CTAs wired.

**SPEC IMPACT:** None — this implements iteration 0015 § Routes (`/for-vendors`) per the locked spec; no spec edits required.

---

## 2026-05-15 · docs: PR auto-merge is the standing default

**Commit:** to be filled after commit.

**Context:** Owner asked 2026-05-15 to "always merge once ready to merge" — no manual click between PR creation and production ship. Repo-level `allow_auto_merge` was flipped on the same day; this commit makes the workflow rule visible to every future Claude Code session by writing it into `CLAUDE.md` directly.

**What changed:**
- `CLAUDE.md` — new "PR workflow — auto-merge is the default" section. Documents `gh pr merge <PR#> --auto --merge` as the immediate follow-up to `gh pr create`, locks the merge method to `--merge` (matching existing history), and clarifies that `build (windows-latest)` is non-blocking so auto-merge can fire while it's still running.

**Verify:** Doc-only change. No code touched.

**SPEC IMPACT:** None. This is a workflow rule for the implementation repo, not a product or spec decision.

---

## 2026-05-15 · feat(0000,0015): replace placeholder S badge with new Setnayan logo SVG

**Commit:** `5c479ea` (merged via [#61](https://github.com/iscasasola/setnayan-platform/pull/61) as `ebdf686`).

**Context:** Owner-provided brand mark (the spark-and-tail glyph) finally replaces the placeholder "S in a terracotta circle" that had been shipping since iteration 0000. PWA + Tauri icons now survive a circular mask without clipping.

**What changed:**
- `apps/web/app/_components/logo.tsx` — new server `<Logo />` component. Inlines the dark path data, renders via `currentColor`, exposes `height`/`withWordmark`/`title` props. Two files in `apps/web/app/v/[slug]/page.tsx` and `apps/web/app/vendors/page.tsx` import it as `BrandLogo` to avoid colliding with their local vendor-logo helper.
- `apps/web/public/brand/setnayan-logo.svg` + `setnayan-mark.svg` — raw provided artwork + a `currentColor` extract for inline use.
- `apps/web/public/icon-192.svg`, `apps/web/public/icon-512.svg`, `src-tauri/icons/icon.svg` — regenerated on a `1664x1664` square canvas with the tall 808x1298 mark centered + padded. Mark uses ~77% of the inscribed circle's radius so Android adaptive icons and iOS rounded-corner masks don't crop the emblem or the tail.
- `src-tauri/shell/index.html` — redirect splash now renders the inline SVG mark instead of the placeholder `S` div.
- Marketing chrome + footers: `apps/web/app/_components/site-header.tsx`, `page.tsx` footer, `for-vendors/page.tsx` (footer), `vendors/page.tsx`, `download/page.tsx`, `help/page.tsx` (header + footer), `privacy/page.tsx`, `terms/page.tsx`. Login + signup pages now show the mark above the existing terracotta kicker.
- Dashboards: `dashboard/layout.tsx`, `vendor-dashboard/layout.tsx` ("Setnayan · Vendor"), `admin/layout.tsx` ("Setnayan · Admin").
- Public pages: `[slug]/page.tsx` invitation header, `v/[slug]/page.tsx` vendor profile header.

**Verify:** `pnpm typecheck` ✅ (both `@setnayan/shared` and `@setnayan/web`). Vercel preview + production CI checks green on [#61](https://github.com/iscasasola/setnayan-platform/pull/61).

**SPEC IMPACT:** None — asset-level rebrand, no product/scope change. Tauri raster icons (`.png`/`.ico`/`.icns`) regenerate automatically from the new SVG via `pnpm tauri:icons` (part of `tauri:build`); no manual export step needed.

---

## 2026-05-14 · feat(0025+0028): EN/TL locale toggle + 2 more email templates

**Commit:** to be filled after commit.

**Context:** Phase 2 polish work — wire a Tagalog dashboard chrome for the FilipinoFirst feel locked in `02_Specifications/Brand_Voice.md`, and bring the email-wired event count from 7 (post-PR-20) to 9 with the two transactional templates that have been outstanding since iteration 0028 first landed.

**Locale (0025):**
- New `apps/web/lib/i18n/dashboard.en.json` and `apps/web/lib/i18n/dashboard.tl.json` — ~31 dashboard-chrome strings each (nav labels, common CTAs, status pills, time-of-day greetings, common buttons).
- `apps/web/lib/i18n/index.ts` — `getLocale()` server helper reads `users.locale` (existing Postgres enum `locale_code`, values 'en'/'tl'/'ceb'). `t(key, locale?)` and `makeT(locale)` translate a known key. Anything other than 'tl' falls back to English.
- `apps/web/app/dashboard/profile/page.tsx` — new "Display language" section just above Theme. EN / TL radio. Persists to `users.locale` via the new `updateLocalePreference` server action.
- `apps/web/app/dashboard/profile/actions.ts` — `updateLocalePreference(formData)` validates against `('en','tl')` and writes the `users.locale` column.
- `apps/web/app/dashboard/[eventId]/layout.tsx` — fetches locale alongside event + unread count; passes nav labels into `<BottomNav>`; replaces hard-coded `aria-label="Profile"` and notification labels.
- `apps/web/app/dashboard/[eventId]/_components/bottom-nav.tsx` — accepts an optional `labels` prop with translated tab strings; falls back to English when omitted.
- `apps/web/app/dashboard/[eventId]/page.tsx` — section headings (Plan, Next up, Recent activity, Guided planner) plus time-of-day greeting now go through `tr(key)`; tile labels reference `TranslationKey`s.

**Emails (0028):**
- `apps/web/lib/notifications.ts` — added `help_ticket_replied` and `vendor_inquiry_received` to `NotificationType` plus matching entries in `NOTIFICATION_TYPE_LABEL` and `NOTIFICATION_TYPE_TONE`.
- `supabase/migrations/20260514010000_notification_type_additions.sql` — new migration that adds three `ALTER TYPE … ADD VALUE IF NOT EXISTS` statements: the two new types AND `rsvp_received`, which the codebase had been emitting since the iteration 0028 RSVP feature but was missing from the DB enum (the emits had been failing silently inside `emitNotification`'s try/catch).
- `apps/web/app/admin/help/actions.ts` — `setHelpMessageStatus` now fetches prior `admin_notes` before the update; when the admin posts a substantive new reply (content changed, non-empty), fires `help_ticket_replied` to the signed-in submitter (anonymous submitters have no `user_id` and are unreachable). Title `"Setnayan replied to your help ticket"`, body = first 200 chars of the reply, `relatedUrl` `/help`.
- `apps/web/lib/chat-actions.ts` — `sendChatMessage` now counts existing messages on the thread *before* inserting the new one. When `senderRole === 'couple'` AND the existing count is zero, fires `vendor_inquiry_received` (title `"New booking inquiry from <event name>"`, body = first 200 chars, `relatedUrl` `/vendor-dashboard/messages/<threadId>`). All subsequent messages still fire the regular `chat_message` notification.

**Verify:** `pnpm --filter @setnayan/web typecheck` ✅ · `lint` ✅ · `build` ✅ (43 routes, no errors).

**SPEC IMPACT:** Two specs touched.
- `02_Specifications/Brand_Voice.md` (or equivalent) — V1 dashboard now ships Tagalog chrome; please record the EN/TL toggle and the locked translation set in the spec via Cowork.
- `02_Specifications/0028_email_notifications.md` — event-wired list goes from 7 to 9 (add `help_ticket_replied` and `vendor_inquiry_received`). Please update via Cowork.

---

## 2026-05-14 · feat(0036): event-day pre-load — couple + vendor day-of resilience

**Commit:** to be filled after commit.

**Context:** day-of venue WiFi is unreliable. Owner asked for a proactive pre-load that downloads the full event bundle into the client cache so the dashboard works offline when it matters most. This iteration adds the pre-load infrastructure on the couple and vendor sides; the underlying TanStack-Query persistence layer ships separately as PR #10 (caching foundation).

**What landed:**
- [apps/web/lib/event-preload.ts](apps/web/lib/event-preload.ts) — new `server-only` module. `prefetchEventBundle(eventId)` fetches guests + tables/assignments + schedule + vendors + budget + mood-board palette + last-50 messages per couple/vendor thread, packaged under canonical TanStack-Query keys. RLS gates the read.
- [apps/web/app/_components/event-day-prep-actions.ts](apps/web/app/_components/event-day-prep-actions.ts) — `'use server'` action `prepareForEventDay` (couple side) + `prepareVendorEventDay` (vendor side). Returns a discriminated union so the client surfaces retry-able errors instead of throwing.
- [apps/web/app/_components/event-day-prep-cta.tsx](apps/web/app/_components/event-day-prep-cta.tsx) — couple-side banner CTA. Visible T-3 days to T+1 day. On click: hydrates the Query cache section-by-section + posts `{ type: 'PRELOAD_ASSETS', urls }` to the SW for asset warm-up. Phases: idle → loading → done (`"Ready for event day — works offline"`) or error with retry.
- [apps/web/app/_components/auto-preload-on-event-day.tsx](apps/web/app/_components/auto-preload-on-event-day.tsx) — silent client component on the dashboard. Auto-fires the action when the event is T-24h to T+12h, deduped to once per 60 minutes via `localStorage`.
- [apps/web/app/_components/vendor-event-day-prep-cta.tsx](apps/web/app/_components/vendor-event-day-prep-cta.tsx) — vendor-side analogue. Scoped per chat thread (one card per upcoming couple).
- [apps/web/app/dashboard/[eventId]/page.tsx](apps/web/app/dashboard/[eventId]/page.tsx) — renders both new components above the welcome strip. Minimal edit.
- [apps/web/app/vendor-dashboard/page.tsx](apps/web/app/vendor-dashboard/page.tsx) — renders a `<VendorEventDayPrepCta>` per upcoming event (filtered to the T-3/T+1 window server-side).
- [apps/web/public/sw.js](apps/web/public/sw.js) — added a `message` listener that handles `PRELOAD_ASSETS` by `fetch + cache.put`-ing each URL. Stub-level today; the iteration 0010 (Workbox + route-scoped expiration) handler will continue to honor the same message shape.

**Dependency:** PR #10 (`claude/caching-foundation`) is being worked on in parallel and adds the runtime side — `@tanstack/react-query`, `getQueryClient()`, the providers wrapper, persisted IndexedDB cache. This PR uses local gitignored stubs (`apps/web/lib/query-client.ts`, `apps/web/app/providers.tsx`, `apps/web/lib/use-tracked-mutation.ts`, excluded via `.git/info/exclude`) so typecheck + lint pass before merge. Stubs vanish once #10 lands.

**SPEC IMPACT:** New iteration **0036_event_day_preload**. The owner needs to add this to the spec corpus via Cowork — see `COWORK_INBOX.md` for the entry.

---

## 2026-05-14 · repo public + free-tier security hardening pass

**Commit:** to be filled after commit.

**Context:** flipped the GitHub repo from private to public (CI Actions were getting metered against a low spending limit; public repos get unlimited free minutes). Before/during the flip, ran a credential audit on the committed files.

**Incident found and resolved:** [HANDOFF.md:233](HANDOFF.md:233) had the real Supabase pooler URL including the database password (`postgresql://postgres.<ref>:<password>@…`). The line was added back when the repo was private and treated as an internal handoff doc. The password was rotated in the Supabase dashboard immediately upon detection; the file is now scrubbed to a redacted template that points at Vercel env vars / `.env.local` for the actual value. No code uses `SUPABASE_DB_URL` at runtime (only `supabase db push` migrations from CLI), so the rotation did not require a redeploy.

**What landed in this commit:**
- [LICENSE](LICENSE) — added GNU AGPL-3.0 (verbatim from gnu.org). Anyone may read and fork; any derivative offered as a hosted service must also be open-sourced. Maximizes commercial-fork friction while keeping the code legitimately open.
- [.github/workflows/ci.yml](.github/workflows/ci.yml) — added a `gitleaks` job using `gitleaks/gitleaks-action@v2`. Future commits introducing credentials will fail CI before merge. Free for public repos.
- [HANDOFF.md](HANDOFF.md) — DB connection string + password scrubbed; replaced with redacted template.
- [STATUS.md](STATUS.md) — Supabase project URL + dashboard direct link replaced with "see Vercel env vars" / generic dashboard root. Project ref is not strictly secret (it's transmitted in every client request), but trimming it from docs slows down automated scraping.

**GitHub-side settings flipped via `gh api` (no code change, recorded here for the audit trail):**
- Dependabot vulnerability alerts → enabled
- Dependabot automated security updates → enabled
- Secret scanning → enabled
- Secret-scanning push protection → enabled (rejects future commits containing recognized credential patterns)
- Wiki → disabled
- Projects → disabled
- Discussions → already disabled

**Owner follow-ups (UI-only flips, not REST-accessible):**
- Settings → Actions → General → set "Require approval for first-time contributors" to **All outside collaborators**. Prevents drive-by fork PRs from auto-triggering paid workflows.
- Optional: enable required PR review on `main` branch — deferred since solo dev; revisit if/when a second contributor joins.

**SPEC IMPACT:** None on locked product decisions. The license choice (AGPL-3.0) is a new project-level fact worth noting in the spec corpus' `CLAUDE.md` decision log — please update `~/Documents/Claude/Projects/Setnayan/CLAUDE.md` via Cowork to reflect: *"Repo is public and AGPL-3.0 licensed as of 2026-05-14; downstream forks that host the code as a SaaS must also be AGPL-3.0."*

---

## 2026-05-14 · feat(routing): short URLs for the couple dashboard

**Commit:** to be filled after commit.

**What landed:** `apps/web/middleware.ts` now redirects `/<event-uuid>/<anything>` &rarr; `/dashboard/<event-uuid>/<anything>`. So `setnayan.com/57159614-47aa-…/guests/quick` works the same as the full `setnayan.com/dashboard/57159614-…/guests/quick`. Couples can bookmark or share short URLs and skip the `/dashboard/` prefix when typing by hand.

**Why it's safe:**
- UUIDs are 36 chars (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). Slugs are validated at 3&ndash;32 chars `[a-z0-9-]+`. The two patterns cannot collide &mdash; a UUID can never be mistaken for a slug, and vice versa.
- The redirect fires before the `[slug]` catch-all gets a chance to 404. Slugs continue to resolve via `/<slug>` as before.
- The destination `/dashboard/[eventId]/...` already enforces auth in its layout. If a non-authenticated user types a UUID URL by accident, they're bounced to `/login` exactly the same way they would be on the full URL.

**SPEC IMPACT:** None &mdash; URL aliasing only; no schema, RLS, or product-decision change.

---

## 2026-05-14 · COWORK_INBOX.md handoff channel + caching strategy queued

**Commit:** to be filled after commit.

**What landed:**
- New `COWORK_INBOX.md` at the repo root — active worklist of pending spec-corpus updates the owner must apply via Cowork. Distinct from `CHANGELOG.md` (full history): the inbox is a `[PENDING]` / `[DONE]` worklist that shrinks as items are actioned, so the owner doesn't have to scan changelog history to find what still needs Cowork's attention.
- `CLAUDE.md` documentation contract expanded from three files to four (adds `COWORK_INBOX.md`). New step inserted into "Rules for every session": after any code change with non-`None` spec impact, append a `[PENDING]` entry to the inbox alongside the changelog entry. The Cowork-boundary section also references the inbox as the standard handoff channel.
- Seeded the inbox with the first real entry: **Caching & Offline Strategy** — a new cross-cutting infra section (100 MB per-install budget, TanStack Query + IndexedDB + service-worker `CacheExpiration`). Inbox entry offers the owner two placement options (section in platform-foundation spec, or new mini-iteration `0036_caching_strategy/`).

**Operational note:** No code in `apps/` or `packages/` touched. This is repo-doc housekeeping only — the caching implementation itself is parked until the spec is locked via Cowork and the owner explicitly green-lights the implementation plan.

**SPEC IMPACT:** Indirect. The inbox itself is a repo-internal mechanism — no spec change needed. But the seeded *content* (caching strategy) does have spec impact: the owner must apply it via Cowork to either the platform-foundation spec or a new `0036_caching_strategy/` iteration folder at `~/Documents/Claude/Projects/Setnayan/`. The pending entry in `COWORK_INBOX.md` carries the full draft content.

---

## 2026-05-14 · admin merchant-QR uploads: auto-detect + square crop

**Commit:** [2b8f0cc](https://github.com/iscasasola/setnayan-platform/commit/2b8f0cc) (PR #2)

**What landed:**
- New client component [apps/web/app/admin/settings/_components/qr-upload-form.tsx](apps/web/app/admin/settings/_components/qr-upload-form.tsx). When an admin picks a QR file on Platform Settings, the component decodes it via `createImageBitmap`, runs `jsQR` to locate the QR's four corners, computes a square bounding box (plus a ~12% quiet-zone margin), renders a 512×512 PNG crop on a white-background canvas, then submits that blob to the existing `uploadMerchantQr` server action via a manual FormData (so we don't depend on the `DataTransfer` file-swap trick, which has known iOS Safari quirks).
- Three resolved states surface inline:
  - **Detected** — green confirmation + cropped preview.
  - **Fallback** — couldn't find a QR in the source, center-square crop is used; amber warning asks the admin to review the preview before clicking Upload.
  - **Raw passthrough** — `createImageBitmap` couldn't decode the source (e.g. HEIC on Chrome/Firefox); the original file is queued for upload unchanged so behavior matches what shipped before.
- New `jsqr@^1.4.0` dep in [apps/web/package.json](apps/web/package.json) (~50 KB, pure JS, bundled types). No native deps.
- [apps/web/app/admin/settings/page.tsx](apps/web/app/admin/settings/page.tsx) helper copy now explains the auto-crop behavior and the 512×512 output, and replaces the prior inline `<form>` with `<QrUploadForm>`.

**SPEC IMPACT:** None on any locked decision. The merchant-QR upload contract (Iteration 0034 payments) is unchanged at the schema / server-action / storage layer — `platform_settings.{bdo_qr_url,gcash_qr_url}` still points at whatever Supabase Storage URL `uploadPublicAsset` returns. This is a pre-upload UX enhancement: admins can drop a phone screenshot or photo of their merchant QR and the system normalizes it to a clean square instead of forcing them to hand-crop in another app.

---

## 2026-05-14 · feat(guests): quick-add list — Enter-driven bulk entry

**Commit:** to be filled after commit.

**Why:** Adding guests one at a time through `/guests/new` (or CSV import) is too heavy for the most common case &mdash; the couple sitting at their laptop, brain-dumping every name they want at the wedding. The owner asked for an Excel-feel: type first name &rarr; Enter &rarr; last name &rarr; Enter &rarr; the row is committed and a fresh row appears, focused.

**What landed:**

- `apps/web/app/dashboard/[eventId]/guests/quick/page.tsx` &mdash; new public route at `/dashboard/<eventId>/guests/quick`. Server-component wrapper that handles auth + error-banner state, embeds the client component.
- `apps/web/app/dashboard/[eventId]/guests/quick/_components/quick-add-list.tsx` &mdash; the heart of the feature. Client component:
  - Auto-focus First Name on mount.
  - `Enter` on First Name moves focus to Last Name. Empty + Enter when there are already finalized rows triggers the bulk upload.
  - `Enter` on Last Name finalizes the row, clears both inputs, refocuses First Name.
  - Last name is optional (some guests go by one name).
  - Each finalized row shows with a green check + click-to-edit (combined first/last in a single editor) + remove X.
  - The submit auto-finalizes whatever's in the live row at click time so a half-typed name isn't silently dropped.
  - `useFormStatus()` driven Upload button shows the spinner + "Uploading&hellip;" during the server action.
- `apps/web/app/dashboard/[eventId]/guests/quick/actions.ts` &mdash; `bulkAddGuests(eventId, formData)` parses a JSON array, validates (max 500 per upload), and bulk-inserts via a single Supabase `insert(rows)`. Defaults each row to `side: both`, `group_category: other`, `role: guest`, `rsvp_status: pending`, `invited_to_blocks: [ceremony, reception]`. Redirects to `/guests?added=N` so the couple sees a confirmation toast.
- `apps/web/app/dashboard/[eventId]/guests/page.tsx`:
  - New header CTA "Quick add list" alongside Import CSV / + Add guest.
  - `pickFlash()` now reads the `?added=N` count and renders "Added 12 guests." instead of the generic "Guest added."

**Tradeoffs (called out for owner / spec reconciliation):**
- Quick-add intentionally **drops every name into "Other (uncategorized)"** with default side/role. The couple is expected to refine each row from the full guest list later. This is the right tradeoff for the brain-dump phase &mdash; forcing role/side at entry-time kills momentum.
- Plus-ones are NOT supported in quick-add. If a couple wants a +1, they use `/guests/new` (which has the full plus-one model).
- Single-word names work (last name is optional). Multi-word last names work. Mid-word Enter cleanly moves to the next field.

**SPEC IMPACT:** 0001 Guest List:
- Add a new sub-feature "quick-add list" to the iteration doc. It supplements the existing add-one-at-a-time flow and the CSV import &mdash; it does NOT replace either.
- Note the defaults: side `both`, group `other`, role `guest`. The spec's role hierarchy and sponsor tiers are unaffected (couples refine post-entry).
- Please update `~/Documents/Claude/Projects/Setnayan/04_Iterations/0001_guest_list.md` via Cowork.

---

## 2026-05-14 · fix(invitation): monogram QR thumbnails clipped in fixed-size boxes

**Commit:** [3d37ae7](https://github.com/iscasasola/setnayan-platform/commit/3d37ae7) (PR #1)

**What landed:**
- `apps/web/app/dashboard/[eventId]/invitation/page.tsx` — added `[&_svg]:h-full [&_svg]:w-full` to the three QR-thumbnail wrappers (the monogram preview card, the desktop guest-table cell, and the mobile guest-card row). The `qrcode` library bakes `width="256"` into its SVG output, so when the SVG was embedded in `h-32 w-32` / `h-16 w-16` / `h-20 w-20` containers with `overflow-hidden`, only the top-left corner of the 256-px QR was visible. The arbitrary-variant rule forces the inner `<svg>` to fill its constrained parent, matching the pattern the print sheet already uses (`.print-qr svg { width:100%; height:100% }`).
- Public landing page (`apps/web/app/[slug]/page.tsx`) unaffected — it wraps the QR in an `inline-block` with no fixed dimensions, so the SVG renders at its natural 256 px.

**SPEC IMPACT:** None — purely visual bug fix, no schema, RLS, or product-decision change.

---

## 2026-05-14 · transaction-receipt rename + /download 404 fix + remaining form-button sweep

**Commit:** to be filled after commit.

**Three things landed:**

**1. Receipts are not BIR Official Receipts — clarified app-wide.**
The system was labeling the auto-generated receipt as "Official Receipt" and citing "BIR Revenue Regulations". That overclaims: these are app **transaction receipts** for the customer's records. The actual BIR Official Receipt (where applicable) is issued separately, offline. Renames + disclaimers landed in:

- `apps/web/lib/receipts.ts` — `formatOrNumber` → `formatReceiptNumber`. The numbering prefix changed from `SR-YYYY-XXXXXX` to `TXN-YYYY-XXXXXX`. The DB column `or_serial` is unchanged (it's an internal serial; a rename would have required a migration).
- `apps/web/app/receipts/[receiptId]/page.tsx` — page title metadata "Official Receipt" → "Transaction Receipt"; the header badge says "Transaction Receipt"; the "BIR-Registered" label is removed (TIN stays, optional); footer rewritten: *"This is a system-generated transaction receipt for your records. It is NOT a BIR Official Receipt. The corresponding BIR Official Receipt is issued by Setnayan separately."*
- `apps/web/app/admin/receipts/page.tsx` — page heading "Transaction receipts"; explainer says *"not BIR Official Receipts — cross-reference with your BIR-side OR records before filing"*; table column "OR number" → "Transaction No."
- `apps/web/app/admin/settings/page.tsx` — wording on the business-identity section + TIN help text updated.
- `apps/web/app/admin/payments/actions.ts` — code comment + `maybeIssueReceipt` comment.
- `apps/web/app/dashboard/[eventId]/orders/[orderId]/page.tsx` — "BIR-compliant OR" banner rewritten to "Transaction receipt issued — Not a BIR Official Receipt".
- `apps/web/app/terms/page.tsx` — legal text rewritten to remove BIR-compliant Official Receipt claim and explain that quoted amounts are pre-VAT base.

**2. /download was 404'ing for anonymous visitors.**
The download flow was redirecting to a GitHub Release asset URL. The repo is **private**, so anonymous downloads got 404 from GitHub. Fixed by:
- Copied the DMG into `apps/web/public/downloads/Setnayan_0.0.1_aarch64.dmg`. Vercel serves `/downloads/...` publicly with no auth.
- `apps/web/lib/desktop-release.ts` updated: `mac.aarch64.url` now points at `/downloads/Setnayan_0.0.1_aarch64.dmg` (relative).
- `apps/web/app/api/download/mac/route.ts` re-implemented as a runtime route (the previous `force-static` directive couldn't reconcile relative URLs at static-export time). Now it resolves the target URL from `request.url` and 302-redirects.
- Removed the now-broken "Release notes →" link from `/download` (the GitHub release page is also private).

**3. Form-button audit — final sweep + login-pending visibility.**
Spawned a parallel agent to do a multi-pass audit. It identified + fixed:

- Couple notifications page: "Mark all read" + "Mark read" now use `SubmitButton`.
- `/help` page contact form: "Send message" now uses `SubmitButton`.
- Vendor notifications + vendor home: equivalent buttons swept.
- `apps/web/app/globals.css`: `.button-secondary` got `disabled:cursor-not-allowed disabled:opacity-60` (matching `.button-primary` which already had it).

**SubmitButton itself was hardened** so the pending state is unmistakable, especially for fast actions like sign-in where the redirect lands ~200ms after click:
- Added `data-pending` attribute (useful for hooks + Cypress later).
- Added `cursor-wait` while pending so the cursor changes immediately on click.
- Bumped Loader2 stroke from 1.75 → 2.25 for a heavier-looking spinner.
- Empty `pendingLabel` (e.g. icon-only Send buttons) now still announces "Working…" to screen readers via `sr-only`.

**Background agent caveat:** the audit agent stalled at ~Pass 9 due to a stream watchdog timeout. Its committed-but-not-reported changes are good; the things it diagnosed but didn't yet fix were rolled into this commit (SubmitButton enhancements + the cursor-wait + sr-only fallback).

**SPEC IMPACT:** 0026 BIR receipts:
- The spec described the auto-issue as an "Official Receipt" — that wording is incorrect for V1. Please update `~/Documents/Claude/Projects/Setnayan/04_Iterations/0026_bir_tax_compliance.md` via Cowork:
  - Rename "Official Receipt" → "App transaction receipt" throughout the iteration doc.
  - Add a callout: V1 does NOT issue BIR-compliant ORs; the platform records a transaction reference for the customer, while the actual BIR OR is issued by Setnayan via its accountant / POS receipt book.
  - The OR numbering prefix changed from `SR-YYYY-NNNNNN` to `TXN-YYYY-NNNNNN`; legacy receipts (if any) keep their SR- numbers since they were already issued.
  - The math (pre-VAT base + 12% VAT added on top = gross) stays correct.

---

## 2026-05-14 · VAT direction fix + sweep of every mutating form for double-submit prevention

**Commits:** to be filled after commit.

**Two issues from the live testing pass:**

1. **VAT math was inverted.** Receipts treated the quoted order total as **VAT-inclusive gross** (back-calculating pre-VAT = total / 1.12). The actual contract is the PH B2B convention: the quoted price is the **pre-VAT base**, and VAT is **added on top**. So a ₱10,000 quote should bill the customer ₱11,200, and the OR shows pre-VAT ₱10,000 + VAT ₱1,200 + gross ₱11,200.

2. **Many submit buttons could double-fire.** During Flow A testing, a double-click on the payment-log button created two duplicate payments at +2s apart. The fix from earlier (a single `<SubmitButton>` reusable component that hooks `useFormStatus`) was applied only to the payment-log surface. Today we swept every mutating form across the app.

**What landed:**

- **VAT math (`apps/web/lib/receipts.ts`):** renamed `computeVatBreakdown(grossPhp)` → `computeVatFromBase(basePhp)`. New math: `vat = base * rate / 100; gross = base + vat`. Order's `*_total_php` columns now semantically mean **pre-VAT base** (not gross). Existing receipts in the DB are unchanged — only new receipts use the new math.
- **`apps/web/lib/orders.ts:computeOrderTotals`:** exposes `base`, `vat`, `vatRatePct`, `gross`. `headlineTotal` is now the gross (what the couple actually pays). `remaining` runs on gross.
- **Couple order detail (`/dashboard/[eventId]/orders/[orderId]`):** stat row now reads **Pre-VAT base → + VAT (12%) → Total to pay → Remaining**. Explanatory line: *"Confirmed base = ₱X. PH BIR-compliant VAT (12%) is added on top — what you actually pay is ₱X·1.12."*
- **Couple orders list (`/dashboard/[eventId]/orders`):** each card now shows the **gross** with an "incl. VAT" subscript, so couples never wonder why the line in payment-instructions is higher.
- **New-order form (`/dashboard/[eventId]/orders/new`):** field re-labeled "Your proposed budget (PHP, pre-VAT)" with explainer text.
- **Admin quote prompt (`/admin/payments` → "Orders needing a quote"):** shows the requested pre-VAT base + computed gross side-by-side: *"Requested (pre-VAT): ₱10,000 · buyer pays ₱11,200 incl. 12% VAT"*. Input now reads "Confirmed pre-VAT total (PHP)" with the same buyer-pays hint below.
- **Receipt auto-issue (`/admin/payments/actions.ts:maybeIssueReceipt`):** uses `computeVatFromBase(base)`. Pre-VAT and gross now diverge correctly; the BIR-compliant OR shows the proper breakdown.

**Form double-submit sweep — every mutating action now uses `SubmitButton`:**

| Surface | Action |
|---|---|
| `/signup`, `/login` (password + magic link) | Sign up / Sign in / Send magic link |
| `/join/[eventId]` | RSVP / Join event |
| `/[slug]` (public guest), `/[slug]/welcome` | Save RSVP / Confirm plus-one |
| `/dashboard/create-event` | Create event |
| `/dashboard/[eventId]/guests/{new,[guestId],import}` | Create / Update / Delete / Import guests |
| `/dashboard/[eventId]/messages` (couple + vendor) | Start thread / Send chat message |
| `/dashboard/[eventId]/orders/{new,[orderId]}` | Submit / Cancel order |
| `/dashboard/[eventId]/invitation` | Save monogram / Re-issue token |
| `/dashboard/[eventId]/schedule` | Add / Toggle / Delete block |
| `/dashboard/[eventId]/vendors` | Add / Update status / Delete vendor |
| `/dashboard/[eventId]/budget` | Add line item / Delete line item / Log payment / Delete payment |
| `/dashboard/[eventId]/seating` | Add table / Delete table / Assign / Unassign guest |
| `/dashboard/[eventId]/services/save-the-date` | Request template |
| `/dashboard/profile` | Save personal info / Change password / Delete account |
| `/dashboard/api-keys` | Create key / Revoke key |
| `/admin/users` | Restore / Toggle team pool / Confirm email / Reset password |
| `/admin/help` | Update status |

Each button now disables itself + shows a "Saving…" / "Logging…" / contextual pending label between click and redirect. The `useFormStatus()` hook unblocks once the server action resolves.

**Skipped intentionally** (low-risk / idempotent): Apply/filter buttons on search pages, sign-out buttons (idempotent), planner step toggles, theme/mode switchers, slug-availability checker, restart-tour, the few action toggles in profile that are pure boolean flips.

**SPEC IMPACT:** Receipts (Iteration 0026 BIR compliance):
- The spec's VAT chapter described the math without nailing direction. Today's flip is the production-correct PH B2B reading: "The quoted price is exclusive of VAT; VAT is added on top." Please update `~/Documents/Claude/Projects/Setnayan/04_Iterations/0026_bir_tax_compliance.md` via Cowork to reflect:
  - Order/quote totals are stored pre-VAT
  - The amount the customer pays is `pre_vat * (1 + vat_rate/100)`
  - The receipt always shows three lines: pre-VAT base, VAT amount, gross total
  - Receipts issued under the old math (before today) are not retroactively adjusted

---

## 2026-05-14 · public macOS download page + GitHub Release v0.0.1

**Commit:** to be filled after commit.

**What landed:**
- Published the locally built desktop bundle as **GitHub Release v0.0.1**: https://github.com/iscasasola/setnayan-platform/releases/tag/v0.0.1 (asset `Setnayan_0.0.1_aarch64.dmg`, 1.4 MB, Apple Silicon).
- New `apps/web/lib/desktop-release.ts` — single source of truth for the currently shipped desktop release (version, tag, file URL, size, publish date). Future version bumps only touch this file.
- New `apps/web/app/api/download/mac/route.ts` — 302 redirect to the GitHub Release asset. Lets the website link `/api/download/mac` indirect through this route so the underlying URL can rotate without touching every page.
- New `apps/web/app/download/page.tsx` — public install page at `setnayan.com/download`. Hero with "Download for Mac" CTA + file metadata card, 4-step install guide, Gatekeeper-warning explainer card, system-requirements card. All Apple-Silicon-only messaging; Intel Mac users get routed back to the web app.
- Homepage updated: small "On a Mac? Download Setnayan for macOS" inline link below the hero CTAs, plus a footer link.

**Operational note:** the in-app/desktop **auto-updater** is **not** wired yet. Users who download v0.0.1 will need to revisit `/download` and reinstall to get future releases. The auto-update plumbing (Tauri updater plugin + signing keypair + manifest endpoint) is a separate task — best done after Apple Developer enrollment so the signed updates flow cleanly past Gatekeeper.

**SPEC IMPACT:** None on locked decisions. The download page itself is new public surface but doesn't change any V1 contract — it just exposes the desktop wrapper Iteration 0023 already shipped (now distributable via the website instead of buried in a GitHub Actions artifact).

---

## 2026-05-14 · desktop local-build fixes (tauri scripts + Cargo.lock)

**Commit:** to be filled after commit.

**What landed:**
- `package.json` tauri scripts were passing `--manifest-path src-tauri/Cargo.toml` to `cargo tauri build` / `cargo tauri dev`. Tauri CLI doesn't accept that flag (it's a `cargo` flag, not a `cargo tauri` flag) — Tauri auto-discovers `src-tauri/`. Scripts now run plain `cargo tauri build` / `cargo tauri dev`. CI was unaffected because `.github/workflows/build-desktop.yml` invokes `tauri build` directly, not via the npm script.
- Added a `tauri:icons` script (`cargo tauri icon src-tauri/icons/icon.svg`) and chained it into `tauri:build`. Generated icons are gitignored on purpose (CI regenerates from `icon.svg`); the chain ensures the local build doesn't fail with *"failed to open icon … 32x32.png: No such file or directory"* on a fresh clone.
- Committed `src-tauri/Cargo.lock` for the first time. App crates (vs library crates) should pin transitive deps via the lockfile so every machine compiles identical bytecode.

**Verified locally:**
- `pnpm tauri:build` produced `src-tauri/target/release/bundle/dmg/Setnayan_0.0.1_aarch64.dmg` (1.4 MB) and `bundle/macos/Setnayan.app` (2.9 MB) on Apple Silicon. Ad-hoc codesigned, opens cleanly, native window loads `https://setnayan.com`.

**SPEC IMPACT:** None — packaging fix only.

---

## 2026-05-14 · desktop shell points at setnayan.com

**Commit:** to be filled after commit.

**What landed:**
- `src-tauri/shell/index.html` now redirects to `https://setnayan.com` instead of the old `setnayan-platform-web.vercel.app`. Three call sites updated (the `<meta http-equiv="refresh">`, the `<noscript>` anchor, and the JS `window.location.replace`). No other Tauri config changes — bundle identifier (`com.setnayan.desktop`), product name, and window chrome stay the same.

**Operational note (not a code issue):** the last 4 desktop builds on GitHub Actions failed with *"recent account payments have failed or your spending limit needs to be increased"*. The fix is on the GitHub billing side — see `OWNER_ACTIONS.md` (or settings at https://github.com/settings/billing/spending_limit). Once billing is unblocked, the next push will produce a `.dmg` + `.msi` pointing at the real domain.

**SPEC IMPACT:** None — Tauri shell URL change only; the spec corpus doesn't pin the redirect target.

---

## 2026-05-14 · admin payments PGRST201 fix — page was silently returning empty (backfilled)

**Commit:** [954def3](https://github.com/iscasasola/setnayan-platform/commit/954def3)

**What broke:** `/admin/payments` showed *"Nothing to reconcile"* even when the DB had 2 pending payments. Supabase quietly returned an empty array. Root cause: PostgREST error `PGRST201` — the `payments` table has two FKs to `users` (`user_id` for the buyer + `reviewed_by_user_id` for the admin reviewer), and the embedded join `user:users(email, public_id)` was ambiguous. PostgREST returned a 300-class error and the data fell through to `[]`.

**Fix:** Disambiguate the embed with the explicit FK constraint name on every Supabase select that joins through these two FKs:

- `user:users!payments_user_id_fkey(email, public_id)` on the payments query
- `user:users!orders_user_id_fkey(email, public_id)` on the orders-needing-quote query

Verified via `curl` with the service-role key — both pending payments + their joined buyer rows came back as expected.

**SPEC IMPACT:** None — implementation defect only; the spec's data model is correct.

---

## 2026-05-14 · pending-state SubmitButton + payment screenshot file upload (backfilled)

**Commit:** [07e301c](https://github.com/iscasasola/setnayan-platform/commit/07e301c)

**Two UX issues from the live Flow A test:**

1. *"When I press the Log Payment button I don't know if it is loading. Seems like I can double-click on it."* → Two duplicate `payments` rows inserted at +2 seconds apart.
2. *"Screenshot URL is not a link — it should be an upload photo."*

**What landed:**

- New reusable client component `apps/web/app/_components/submit-button.tsx`. Hooks `useFormStatus()` from `react-dom` to:
  - Disable the button while the server action is pending (`disabled + aria-busy`).
  - Swap content for a `Loader2` spinner + customizable `pendingLabel` ("Logging…", "Approving…", "Saving…", etc.).
- Wired into the payment-log, approve, reject, confirm-quote, settings-save, QR-upload, QR-remove, and create-order surfaces immediately.
- Payment screenshot input flipped from `<input type="url">` to `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif">`. Form now uses `encType="multipart/form-data"`. Server action `logPayment` parses the file from FormData and uploads via the existing `uploadPublicAsset()` helper to the `platform-assets` bucket under `payment-screenshots/<order_id>/`. Returns the public URL into `payments.screenshot_url`.
- Raised Supabase bucket size cap + added HEIC MIME (iPhone Live-Photo default).
- Raised Next.js `experimental.serverActions.bodySizeLimit` to `'6mb'` so iPhone screenshots survive the multipart hop.

**SPEC IMPACT:** None on locked decisions. UX hardening only.

---

## 2026-05-14 · manual password reset workflows — Phase 2 (Resend) bypass (backfilled)

**Commit:** [b556a6c](https://github.com/iscasasola/setnayan-platform/commit/b556a6c)

**Why:** The owner chose to skip Resend email setup pre-launch (cost/quota concerns). Without a transactional email provider, the Supabase magic-link / password-reset emails don't go out. To unblock users, two manual workflows were added.

**What landed:**

- **Admin-initiated:** new server action `resetUserPassword(formData)` in `apps/web/app/admin/users/actions.ts`. Calls `supabase.auth.admin.updateUserById(targetUserId, { password: tempPassword })` with a freshly-generated 12-char alphabet (Crockford-style; no 0/O/1/I/l). Redirects to `/admin/users?temp_password=<...>&for_email=<...>` so the admin sees the password once in an amber banner.
- **User self-service:** new section on `/dashboard/profile` ("Change password") with two `<input type="password">` fields. Server action `changePassword` validates the match, calls `supabase.auth.updateUser({ password })`. Session stays alive; new password takes effect on next sign-in.
- `OWNER_ACTIONS.md` updated: Phase 2 (Resend) marked DEFERRED. Phase 2A documents the admin reset path. Phase 2B is the "wire Resend later" note.

**SPEC IMPACT:** None on platform contract — both flows use existing Supabase Auth primitives. The deferred Resend integration only blocks the *self-service* email-based reset; admin-initiated reset is fully functional.

---

## 2026-05-14 · admin mobile polish

**Commit:** to be filled after commit.

**What landed:**
- `/admin/users`: hid the Account ID column below `lg` (`hidden lg:table-cell`) and the Created column below `md`; updated the empty-state `colSpan` from 6 → 4 to match the visible-on-mobile column count.
- `/admin/events`: hid Venue + Slug below `md` and the internal Event ID below `lg`; updated the empty-state `colSpan` from 6 → 3.
- `/admin/receipts`: hid the Issued date below `md` and the Pre-VAT + VAT columns below `lg`. (Stat tiles already use `grid-cols-2 sm:grid-cols-4` and the OR-number / Customer / Gross columns stay visible on mobile.)
- `apps/web/app/admin/layout.tsx`: kept the tab nav scrollable horizontally and added `shrink-0` to each `AdminTab` plus `whitespace-nowrap` on the nav so tabs don't squish/wrap on narrow viewports. Native scrollbar is hidden on WebKit/FF/MS for a cleaner look.

No DB changes. No behavior changes beyond responsive styling. All other admin surfaces (`/admin`, `/admin/payments`, `/admin/vendors`, `/admin/help`, `/admin/settings`) already used card-grid layouts and already responded to viewport width.

**SPEC IMPACT:** None — this is pure responsive styling; no schema, no contract, no copy changes. The admin console is still V1 MVP (Iteration 0023 surface).

---

## 2026-05-13 · PRE-LAUNCH SPRINT COMPLETE — 19 iterations + 2 polish rounds

**Summary commit reference:** see git log on `main` for the per-iteration commits. New consolidated handoff at `HANDOFF.md`.

This session shipped, in order:

| Iteration | Surface | Migration |
|---|---|---|
| 0021 | Couple dashboard rework: 4 themes, Lucide icons, new Home, Guided Planner | `20260513070000_iteration_0021_planner.sql` |
| 0015 | Public marketing landing at `/` (hero + features + roadmap + footer) | — |
| 0010 | Mood Board with venue/couple/role palette families | `20260513080000_iteration_0010_mood_board.sql` |
| 0008 | Seating chart (tables + assignments + drag-place floor plan) | `20260513090000_iteration_0008_seating.sql` |
| 0006 | Vendors couple-side tracker (28-category enum + 6-stage status) | `20260513100000_iteration_0006_vendors.sql` |
| 0007 | Budget & expenses (line items + payments + `.ics` export) | `20260513110000_iteration_0007_budget.sql` |
| 0022 | Vendor sign-up + profile editor (Pattern A RLS) | `20260513120000_iteration_0022_vendor_dashboard.sql` |
| 0019 | Couple↔vendor 1:1 chat with identity masking | `20260513130000_iteration_0019_communications.sql` |
| 0023 | Admin console (Overview · Users · Events · Vendors) | — |
| 0025 | Profile settings (editable info + RA 10173 export + soft-delete) | `20260513140000_iteration_0025_profile_settings.sql` |
| 0034 | Orders + payments + manual reconciliation queue | `20260513150000_iteration_0034_payments.sql` |
| 0028 | In-app notifications with cross-action emits | `20260513160000_iteration_0028_notifications.sql` |
| 0029 | Help Center FAQ + contact form + admin inbox | `20260513170000_iteration_0029_help_center.sql` |
| 0030 | Guided welcome tour (couple + vendor slide carousels) | `20260513180000_iteration_0030_guided_tour.sql` |
| 0031 | Day-of-guest event schedule + live "happening now" widget | `20260513190000_iteration_0031_schedule.sql` |
| 0033 | Public API foundation (api_keys + bearer auth + stubs) | `20260513200000_iteration_0033_api_gateway.sql` |
| 0024 | Save the Date 12-template gallery → orders flow | — |
| 0026 | BIR-compliant auto-issued Official Receipts | `20260513210000_iteration_0026_bir_tax_compliance.sql` + `20260513220000_iteration_0026_drop_or_number.sql` |

Plus 2 polish rounds: empty states, mobile compaction, navigation tightening, header bell, vendor subnav hoist, admin "restore deleted account".

**SPEC IMPACT (consolidated):**

Most of the SPEC IMPACT callouts in earlier per-iteration changelog entries still stand — please walk the spec corpus at `~/Documents/Claude/Projects/Setnayan/04_Iterations/` via Cowork and reconcile each affected file:

- `0006_vendors_management.md` — lock the 28-entry `vendor_category` enum, record the 6-stage flow + flag the payment-milestones / crew-meals deferrals
- `0007_budget_expenses.md` — V1 ships add+delete only (no edit), per-vendor line items are couple-defined (not the spec's "3-line template"), `.ics` is one-shot download (not subscribable feed yet)
- `0008_seating_chart_editor.md` — V1 = list + drag-place; ring auto-fill + publish-QR still deferred
- `0010_mood_board.md` — Reception 3-6, Bride/Groom palettes added, role palettes conditional on guest presence, 20-theme library deferred, Setnayan Guide rule engine deferred
- `0015_main_website.md` — EN-only V1, no Event Palette preview yet, copy is starter draft
- `0019_communications.md` — V1 = 1:1 page-refresh chat with identity masking. Realtime, group, video (Daily.co), file viewers, coordinator-join all deferred. **Identity masking rule locked**: vendors see event.display_name + event_date only — never couple email or personal name
- `0021_couple_dashboard_fully_purchased.md` — record the 4 theme palette RGB triplets (Setnayan Default `#FAF7F2`/`#1A1A1A`/`#C97B4B`, Victorian `#F5EBD9`/`#2E1A1A`/`#8B1E3F`, Classy `#F4F4F2`/`#0F0F0F`/`#A38560`, iOS `#F2F2F7`/`#000000`/`#007AFF`); 9 planner step keys (set_date, pick_venue, build_guests, customize_invite, set_slug, send_invites, book_vendors, finalize_seating, after_event)
- `0022_vendor_dashboard.md` — V1 ships 1 of 6 surfaces (profile editor only). Logo upload, public vendor page at `/v/[slug]`, bookings linkage to couple-side event_vendors, chat identity masking (waits on 0019 ✅ now shipped), settings/payouts all deferred
- `0023_admin_console.md` — V1 ships 3 of 7 surfaces (Users, Events, Vendors). Two-admin approval queue, audit log, system health, settings, reports all deferred. Document the `notFound()` (not `redirect`) pattern for non-leakage of admin URL existence
- `0024_save_the_date.md` — V1 ships gallery + order request flow (manual production via 0034); Remotion render pipeline + LUT grading + customer clip uploads to R2 all deferred. 12 templates shipped, 30 in spec
- `0025_profile_settings.md` — V1 ships Personal info edit + RA 10173 export + soft-delete. Hard delete + face-data revocation (waits on 0012 Papic) + payment methods (waits on 0034) deferred
- `0026_bir_tax_compliance.md` — VAT-inclusive math (12% default), `or_serial` BIGINT from atomic sequence (display string `SR-YYYY-NNNNNN` composed at read-time), one OR per order. Hard-coded `TIN: 000-000-000-000` placeholder in receipt header **must** be replaced before any real receipts go out — see `HANDOFF.md` § Owner action items
- `0028_email_notifications.md` — V1 = in-app only; email delivery via Resend deferred. Schema is ready; a notification-to-email worker is a small follow-on once Resend SMTP is wired
- `0029_help_center.md` — 22 FAQ articles hardcoded in `apps/web/lib/help.ts`; CMS, AI search, multi-language all deferred. Anyone (anon + authenticated) can INSERT a `help_messages` row
- `0030_guided_tour.md` — V1 = 4–6 slide carousel per role (couple + vendor); element-highlighting tour deferred. Restart via Profile
- `0031_day_of_guest.md` — schedule blocks + live widget shipped; message wall + photo wall + live broadcast banner all defer to R2 wiring
- `0033_public_api_foundation.md` — gateway + key management + 2 stub endpoints (`/api/v1/health` public, `/api/v1/me` auth-gated). Scopes, rate limiting, OAuth, webhooks all deferred. **Public contract** — additions to `/me` response shape need SPEC IMPACT review since they become a stability contract
- `0034_payments_and_cart.md` — V1 ships single-order request flow (no cart) + 4-tier fuzzy SQL matcher replaced with simple substring-reference check; BDO/GCash QR images deferred (instructions only)

**Outstanding (genuinely blocked on owner action):**
- `0032_contract_intelligence.md` — LLM API key + R2 upload not yet provisioned
- `0035_observability.md` — Sentry, PostHog, Better Stack accounts not yet provisioned

See `HANDOFF.md` for the full owner action checklist and verification path.

---

## 2026-05-13 · 0023 admin console MVP — overview + users + events + vendors

**Commits:** to be filled in once committed.

**What landed:**
- No schema changes — admin uses the existing `users.is_internal` / `users.is_team_member` flags (set in Sprint 0) plus the service-role client to read across all tables regardless of RLS.
- New `/admin` route tree:
  - **Layout** (`apps/web/app/admin/layout.tsx`) — auth-gates the entire subtree. Allows users where `is_internal=TRUE OR is_team_member=TRUE OR account_type='admin'`. Non-admins get `notFound()` (404) rather than a redirect, so the admin URL doesn't leak its existence. Header shows a badge (🟣 Internal · 🟢 Team Pool · Admin) per the user's flag.
  - **Overview** (`/admin`) — 8-tile stats strip (all users · couples · vendor users · events · vendor profiles · chat threads · 🟣 internal · 🟢 team pool) from service-role `count: 'exact', head: true` queries. Below: 4 navigation cards (Users · Events · Vendors · disabled Approval queue placeholder).
  - **Users** (`/admin/users`) — server-rendered table, latest 200 rows. Search by email/display_name/public_id (single `or(…ilike…)` query). 5-way filter (all / customer / vendor / internal / team pool). Each non-internal row gets an "Add to pool" / "Remove from pool" button that flips `is_team_member` via `requireAdmin()`-guarded server action. Internal accounts (e.g., the owner) show a locked label — they shouldn't be flipped by admins.
  - **Events** (`/admin/events`) — 200-row table sorted by event_date ascending, with a live guest count per event (single secondary query that batches by `IN`), search across display_name/slug/public_id, optional "include archived" toggle.
  - **Vendors** (`/admin/vendors`) — vendor profile cards in a 3-col grid: avatar (logo URL or initials), published-vs-draft pill, tagline, contact_email, location, first three services, public_id. Search across name/slug/email/public_id + 3-way filter (all / published / draft).
- New `requireAdmin()` helper in `apps/web/app/admin/users/actions.ts` — checks the calling user's flags via the regular Supabase client (under RLS) before doing service-role writes.
- Profile page (`/dashboard/profile`) gains an "Admin console ↗" button that only renders for `is_internal || is_team_member || account_type='admin'`. The button is the canonical entry point to `/admin`.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0023_admin_console.md` — record V1 MVP scope (3 of 7 surfaces) and flag deferred sub-scopes:
  - **Approval queue:** spec calls for a **two-admin approval workflow** for sensitive actions (refunds, account deletes, etc.). V1 doesn't define the underlying state machine — needs spec on which actions require two-admin approval and the queue UX (request → approve → execute).
  - **Audit log:** an `audit_log` table that records who did what when. Needed before any "approval queue" can resolve disputes. Schema-design + trigger plumbing is a follow-on.
  - **System health:** Supabase / R2 / Vercel metrics dashboard. Waits on iteration 0035 (observability) which wires Sentry / PostHog / Better Stack.
  - **Settings:** platform-wide configuration (Setnayan brand strings, default theme, feature flags). Currently those live in `brand.config.ts` and env vars; admin-editable settings would need a `settings` table.
  - **Reports:** GMV / vendor activity / payment reconciliation. Waits on iteration 0034 (Payments & Cart) for the underlying data.
- The `requireAdmin()` pattern is intentionally **not** an RLS helper. The admin console reads via the service_role client and bypasses RLS; authorization is enforced at the route layer. Document this in `02_Specifications/RLS_Policy_Pattern.md` — service-role usage outside scripted/server-side flows should be the exception, not the rule. The admin console is a deliberate exception.
- **Non-leakage choice (record explicitly):** the admin route uses `notFound()` for unauthorized users, not `redirect('/dashboard')`. This keeps the existence of `/admin` invisible to the public. Future admin-only routes should follow the same pattern.

**Deferred:**
- Two-admin approval queue (needs state-machine spec)
- Audit log (`audit_log` table + triggers on sensitive tables)
- System health / observability surface (waits on 0035)
- Settings / feature flags surface
- Reports / GMV / vendor performance dashboards
- Bulk operations (mass-archive, mass-delete, etc.) — V1 admin is read-mostly + per-row flag flip
- Impersonation ("view as user X") — a future debug aid

---

## 2026-05-13 · 0019 communications MVP — couple↔vendor 1:1 chat + identity masking

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513130000_iteration_0019_communications.sql`:
  - **New helper** `public.current_vendor_profile_ids()` — `SECURITY DEFINER STABLE` SETOF UUID of the calling user's vendor_profile_ids. Mirrors `current_couple_event_ids()` for vendor-side RLS.
  - **chat_sender_role** enum: `couple` · `vendor` · `coordinator` (third value reserved for the future "coordinator-join" feature).
  - **chat_threads** — `thread_id` PK, `public_id` (`S89H-…`), event FK + vendor_profile FK with **UNIQUE(event_id, vendor_profile_id)** so re-tapping "Start thread" resumes the same conversation. `created_by_user_id` FK to users (SET NULL on delete). Dual-side RLS: either party can read + write.
  - **chat_messages** — `message_id` PK, thread + event + vendor_profile + sender FKs, `sender_role`, body (1–4000 chars), `created_at`. RLS allows SELECT for either party but only INSERT (no UPDATE/DELETE policy ⇒ messages are append-only).
  - **Trigger** `on_chat_message_inserted` bumps `chat_threads.updated_at` to the new message's `created_at` — keeps thread lists ordered by recency without explicit writes from the app.
- New `apps/web/lib/chat.ts` — types + `fetchCoupleThreads` (joins `vendor_profiles` for business_name/logo) + `fetchVendorThreads` (joins `events` for the masked display_name+date) + `fetchThreadById` + `fetchMessages` + `formatChatTimestamp` (same-day vs older).
- New shared server action `apps/web/lib/chat-actions.ts:sendChatMessage` — looks up whether the current user is the couple or the vendor on the thread, tags the message with that role, and inserts. One action serves both `/dashboard/[eventId]/messages/[threadId]` and `/vendor-dashboard/messages/[threadId]`.
- Couple-side surfaces:
  - `/dashboard/[eventId]/messages` — thread list (avatar from vendor logo OR initials fallback) + start-by-vendor-email form. The form upserts on `(event_id, vendor_profile_id)` and redirects to the thread.
  - `/dashboard/[eventId]/messages/[threadId]` — header with vendor name + tagline, message stream (right-aligned terracotta bubbles for the couple's own messages, left-aligned ink bubbles for the vendor's), composer with Send button.
- Vendor-side surfaces (identity masking):
  - `/vendor-dashboard/messages` — thread list showing **only the event's display_name + event_date** — never the couple's email or personal name. Empty state nudges the vendor to fill in their contact_email so couples can find them.
  - `/vendor-dashboard/messages/[threadId]` — mirrored thread detail; sender label shows "You" for vendor messages, the masked event name for couple messages.
  - Small Profile / Messages subnav on both vendor pages.
- New `MessageSquare` tile on the couple Home grid (4×2 layout: Guests · Invitation · Vendors · Budget · **Messages** · Seating · Mood Board · Services).

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0019_communications.md` — record V1 MVP scope and flag deferred sub-scopes:
  - **Realtime delivery (Supabase Realtime):** V1 = page refresh on send. The schema is Realtime-ready (chat_messages has a simple insert pattern); a follow-on client component subscribing via `supabase.channel(...)` ships when needed.
  - **Group chat / multi-vendor threads:** V1 is strict 1:1. A follow-on would add a `chat_thread_members` join table.
  - **Video meetings (Daily.co):** spec calls for video. Daily.co integration requires API keys + a room-creation server route + an embed UI. Deferred — needs owner sign-off on Daily.co account.
  - **File attachments + viewers:** spec calls for PDF / image viewers in-thread. Waits on R2 upload UI (also a 0022 follow-on).
  - **Coordinator-join:** spec calls for a coordinator (3rd party) joining a thread. Schema reserves `'coordinator'` in `chat_sender_role` enum; no UI plumbing yet.
- **Identity masking rule (record explicitly):** vendors **MUST NOT** see couples' emails or personal names. They see the event's `display_name` + `event_date` only. The couples deliberately controlled what they put in `events.display_name` — for some couples that's "Maria & Juan", for others it's "Event #12". This is the user choice that V1 respects. Future surfaces (e.g., the BookingsSurface in 0022) should follow the same rule.
- The `current_vendor_profile_ids()` helper joins `current_couple_event_ids()` as a load-bearing canonical helper. Both should be documented in `02_Specifications/RLS_Policy_Pattern.md` § 4.

**Deferred:**
- Supabase Realtime subscription (currently page-refresh after send)
- Group / multi-party threads
- Video meetings (Daily.co)
- File attachments + in-thread viewers
- Coordinator-join
- Read receipts, typing indicators, push notifications
- Search across threads
- Linking from `event_vendors` (couple's tracked vendor row) to a `chat_threads` (still requires email-based lookup)

---

## 2026-05-13 · 0022 vendor dashboard MVP — sign-up + profile editor

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513120000_iteration_0022_vendor_dashboard.sql`:
  - `vendor_profiles` table — one row per vendor user. `vendor_profile_id` PK, `public_id` (`S89B-…` — B for business), `user_id` FK to public.users UNIQUE, business_name + business_slug (case-insensitive UNIQUE partial index), tagline, logo_url, services TEXT[], location_city, website, contact_email/phone, is_published, timestamps. Pattern A RLS (owner-only).
  - **Updated** `handle_new_auth_user()` trigger function: reads `NEW.raw_user_meta_data->>'account_type'`; if set to 'customer' or 'vendor', uses that enum value. Default stays 'customer'. The trigger itself isn't recreated — CREATE OR REPLACE FUNCTION updates the body in place.
  - **New** `handle_new_vendor_user()` trigger on `public.users` AFTER INSERT — when account_type='vendor' lands, auto-create a starter `vendor_profiles` row so the dashboard never opens to a missing record.
- Signup form (`apps/web/app/signup/page.tsx`) gains a Couple / Vendor radio choice at the top of the form (defaults to Couple).
- Signup action (`apps/web/app/signup/actions.ts`) now passes `data: { account_type }` to `supabase.auth.signUp()` so the trigger picks it up from `raw_user_meta_data`.
- Couple dashboard (`/dashboard`) layout reads `account_type` along with theme; if vendor, redirects to `/vendor-dashboard`.
- New `/vendor-dashboard` route tree:
  - Layout (`apps/web/app/vendor-dashboard/layout.tsx`) — auth-gated, redirects non-vendors out, mirrors the dashboard chrome (brand mark, name, sign-out). Theme honors the same `users.theme_preference` setting.
  - Page (`apps/web/app/vendor-dashboard/page.tsx`) — profile editor: completion progress bar with missing-field hint, mandatory-logo warning when no logo URL, all fields (business name + slug + tagline + logo URL + services CSV + city + website + contact email/phone), published checkbox, save button.
  - Action (`apps/web/app/vendor-dashboard/actions.ts`) — `saveVendorProfile`. Validates slug format, splits services on commas (≤ 12 items, each ≤ 48 chars), writes to vendor_profiles.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0022_vendor_dashboard.md` — record V1 MVP scope and flag deferred sub-scopes:
  - **Six surfaces:** spec calls for 6 vendor-side surfaces. V1 ships **1** (profile editor). Follow-ons:
    - Portfolio gallery (needs R2 upload UI)
    - Public vendor profile at `/v/[slug]` (needs marketplace surface)
    - Bookings — events where couples have added you to their `event_vendors` (needs link between `event_vendors.vendor_name` and `vendor_profiles.user_id` — currently no FK, vendor name is free-form on couple side)
    - Communications (waits on iteration 0019)
    - Settings · payouts (waits on 0034 payments)
  - **Mandatory logo:** spec calls for required logo. V1 only warns + flags in the completion bar; doesn't block save. When the public vendor surface ships, `is_published=true` should require a `logo_url`.
  - **Chat identity masking:** spec calls for vendors seeing couples as anonymous identities. Belongs in iteration 0019 (communications); no plumbing yet.
  - **Couple ↔ vendor linkage:** spec implies vendors can see events they're working. Currently `event_vendors` (couple-side, iteration 0006) stores `vendor_name TEXT` with no FK to `vendor_profiles`. A follow-on should add `event_vendors.vendor_profile_id UUID NULL` so couples can "tag" a tracked vendor as an existing Setnayan vendor.
- The `account_type` enum stays `('customer', 'vendor', 'admin')`. "customer" remains the codename for couples (Sprint 0 choice).

**Deferred:**
- Logo + portfolio file upload (R2)
- Public vendor profile page (/v/[slug])
- Bookings surface
- Chat with couples (waits on 0019)
- Settings / payouts
- Vendor marketplace / search
- Couple-side "claim this vendor" flow

---

## 2026-05-13 · 0007 budget MVP — line items + payment log + .ics export

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513110000_iteration_0007_budget.sql`:
  - `event_vendor_line_items` — `line_item_id` PK, event/vendor FKs, `label` (1–64 chars), `amount_php` NUMERIC(12,2) ≥ 0, `due_date` DATE nullable, `sort_order`, timestamp.
  - `event_vendor_payments` — `payment_id` PK, event/vendor FKs, optional `line_item_id` FK (SET NULL on delete so a deleted line item doesn't nuke its payment history), `amount_php` > 0, `paid_at` DATE default `CURRENT_DATE`, optional `method`/`reference`/`notes` TEXT.
  - Pattern B RLS on both tables via the canonical `current_couple_event_ids()` helper.
- New `apps/web/lib/budget.ts` — types, `fetchBudgetSnapshot` (joins vendors + line items + payments per event), per-vendor + global totals (budget, paid, remaining, "due in 30 days"), and `renderBudgetIcs` that emits RFC 5545 `VCALENDAR` with CRLF line endings, proper TEXT escaping (`\\` / `\\;` / `\\,` / `\\n`), `DTSTART;VALUE=DATE:` for all-day events, and skips line items that are already fully paid.
- New server actions in `apps/web/app/dashboard/[eventId]/budget/actions.ts`: `addLineItem`, `deleteLineItem`, `logPayment`, `deletePayment`. All validate money / date / label format on the server before the DB write.
- New `/dashboard/[eventId]/budget` page replaces the placeholder. Top: stats strip (4 tiles) and the "Export upcoming dates (.ics)" button. Body: one card per vendor with a per-vendor stats row (budget · paid · remaining), a Line items column with inline add form, a Payments column with inline log form (defaults to today, can attribute to a specific line item or be generic).
- New `GET /api/budget/[eventId]/ics` route handler — authenticated via Supabase cookie; returns `Content-Type: text/calendar` with `attachment` disposition (`setnayan-<event-slug>-budget.ics`). Calendar clients (Google Calendar, Apple Calendar) ingest this directly.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0007_budget_expenses.md` — record V1 MVP scope:
  - **Line items:** spec mentioned "3 line items per vendor (Package · Crew Meal · Transportation)" as the suggested default. V1 lets couples create *any number* of line items per vendor with *any label*; the schema doesn't bake in the 3-line template. The spec doc should be updated to reflect this flexibility, or — if the owner prefers — V1 should be amended to constrain to 3 items.
  - **Calendar feed vs download:** spec calls for ".ics calendar export". V1 ships a **one-shot authenticated download** rather than a subscribable feed. A subscribable feed requires a per-event public token + a public route that bypasses the auth cookie; that's a follow-on (would land alongside the public-API gateway in 0033).
  - **Setnayan platform costs auto-populate:** the spec called for in-app purchases from 0034 (Payments & Cart) to flow into the budget automatically as a "Setnayan" vendor. V1 leaves this manual — couples can create a "Setnayan platform" vendor and log Setnayan transactions there. Auto-population lands when 0034 ships.
- The `current_couple_event_ids()` helper is now load-bearing for **SEVEN** surfaces (event_members, event_journey_steps, event_tables, event_seat_assignments, event_vendors, event_vendor_line_items, event_vendor_payments). Definitively canonical.

**Deferred:**
- Editing line items / payments (V1 supports add + delete only)
- Receipt / proof-of-payment file upload (would land alongside R2 wiring for vendor contracts)
- Multi-currency
- Subscribable .ics URL with per-event token
- Auto-import from iteration 0034 payments
- Charts / visualizations / month-over-month spending

---

## 2026-05-13 · 0006 vendors MVP — couple-side tracker (28 categories, 6-stage readiness)

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513100000_iteration_0006_vendors.sql`:
  - `public.vendor_category` enum — **28 canonical PH wedding service categories** straight from the spec (venue, catering, photographer, videographer, florist, cake_maker, host_emcee, band_dj, string_quartet, choir, officiant, planner_coordinator, makeup_artist, hair_stylist, gown_designer, suit_designer, rings, invitations_stationery, transportation, lights_and_sound, led_screens, photobooth, mobile_bar, church_fees, reception_decor, security, gifts_and_giveaways, misc).
  - `public.vendor_status` enum — 6-stage readiness flow: `considering` → `shortlisted` → `contracted` → `deposit_paid` → `delivered` → `complete`.
  - `event_vendors` table — `vendor_id` PK, `public_id` (`S89V-…`), event FK, category, vendor_name, contact_email/phone, status, total_cost_php (NUMERIC 12,2), deposit_paid_php, notes, timestamps. CHECK constraints enforce non-negative money + deposit ≤ total.
  - Pattern B RLS: couples on the event read + write.
- New `apps/web/lib/vendors.ts` — types, label/tone maps, `fetchEventVendors`, `computeVendorStats`, `formatPhp` PHP formatter (no decimals for clean display).
- New server actions: `createVendor`, `updateVendorStatus`, `deleteVendor`.
- New `/dashboard/[eventId]/vendors` page replaces placeholder:
  - **Stats strip** — 4 tiles: Vendors / Total cost / Deposits paid / Remaining. Remaining tile goes terracotta when > 0.
  - **Add a vendor** (collapsed `<details>` block) — full form: name, category, email, phone, total cost, deposit paid, notes.
  - **Status filter chips** — All + 6 status chips with live counts, query-string driven (`?status=contracted`).
  - **Vendor cards** (2-col on lg+) — name + category, status pill, contact links (mailto/tel with Lucide icons), money breakdown (Total / Deposit / Remaining color-tinted), notes block, status updater dropdown + delete.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0006_vendors_management.md` — record V1 MVP scope (couple-side tracker only) and flag deferred sub-scopes:
  - **Payment milestones (3-line spec):** the spec calls for 3 itemized payments per vendor (e.g., deposit, balance, tip). V1 collapses this to `total_cost_php` + `deposit_paid_php`. A follow-on migration would add an `event_vendor_payments` table.
  - **Crew meals:** spec calls for tracking how many staff meals each vendor needs (caterer needs to plate them). Add a `crew_meals` integer column in a follow-on.
  - **Vendor-side profiles:** the vendor's own dashboard (logo, portfolio, chat identity masking) is iteration 0022.
  - **Public vendor catalog/marketplace:** searchable vendor list with reviews — out of V1 scope.
- The 28-entry `vendor_category` list should be **locked** in the spec — once couples have data tied to these enum values, renaming any is a breaking migration. Confirm with owner via Cowork that these match the canonical PH wedding-vendor taxonomy.

**Deferred:**
- Payment milestones (3 line items per vendor)
- Crew meals tracking
- Meeting/contact log per vendor
- Contract upload (R2)
- Communications thread (waits on 0019)

---

## 2026-05-13 · 0008 seating chart MVP — tables + assignments (list-based, not drag-place)

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513090000_iteration_0008_seating.sql`:
  - `public.table_type` enum with **13 catalog entries** straight from the spec: `round_8`, `round_10`, `round_12`, `rectangle_6`, `rectangle_8`, `rectangle_10`, `long_12`, `long_16`, `sweetheart_2`, `head_table`, `crescent_8`, `crescent_10`, `custom`.
  - `event_tables` — `table_id` PK, `public_id` (`S89T-…` via generator), `event_id` FK, `table_label`, `table_type`, `capacity` CHECK 1..32, `x_pos`/`y_pos` reserved nullable for the future drag editor, `sort_order`, timestamps. Pattern B RLS: couples on the event read + write.
  - `event_seat_assignments` — `(event_id, guest_id) UNIQUE` so a guest can only be at one table; cascades from both events and guests. Pattern B RLS.
- New helpers in `apps/web/lib/seating.ts` — `TABLE_TYPE_CATALOG` (single source of truth for labels + default capacities), `fetchTables`, `fetchAssignments`, `computeSeatingStats`.
- New server actions in `apps/web/app/dashboard/[eventId]/seating/actions.ts`: `createTable`, `deleteTable`, `assignGuest` (upsert with `onConflict: 'event_id,guest_id'`), `unassignGuest`.
- New page at `/dashboard/[eventId]/seating` replaces the placeholder. Layout:
  - **Stats strip** — 4 tiles (tables / total capacity / assigned / unassigned). Unassigned tile goes terracotta when > 0.
  - **Add table form** — label + 13-option type picker + capacity (1–32), one Add button.
  - **Table cards** (2-col grid on sm+) — each card has label, type, fill counter (`5 / 10`, green at full, rose if overfilled), delete button, assigned-guests list with per-row remove button, and an inline guest picker that only shows when there's capacity left and unassigned guests exist.
  - **Unassigned guests** — chip list (first 60, then +N more) at the bottom.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0008_seating_chart_editor.md` — record V1 MVP scope (list-based editor) and flag three deferred sub-scopes:
  - **Free-placed editor:** drag-place tables on a stage canvas. Schema reserves `x_pos`/`y_pos` columns so this becomes a UI-only follow-on.
  - **Role-tier ring auto-fill:** algorithm that suggests assignments based on role hierarchy (head table = wedding party + parents; ring 1 = principal sponsors; ring 2 = family; etc.). Needs algorithm spec.
  - **QR-on-publish print pack:** publish flow that snapshots assignments and generates a per-table QR + a printable seat chart for the venue. Needs publish-state model (current seating is always "live").
- Pattern B helper `current_couple_event_ids()` is now load-bearing for FIVE surfaces (event_members write, event_journey_steps, role_palette indirectly via events, event_tables, event_seat_assignments). Should be promoted from "fix" to "canonical" in `02_Specifications/RLS_Policy_Pattern.md` § 4 helper list.

**Deferred:**
- Drag-place stage canvas
- Auto-fill ring algorithm
- Publish snapshot + per-table QR + printable seat chart
- Seat-level assignments (current model assigns to table, not seat number — `seat_number` column is reserved nullable)
- Bulk assign (e.g., "seat the whole maid_of_honor cohort at Table 2")

---

## 2026-05-13 · 0010 mood board MVP — per-role palette only

**Commits:** to be filled in once committed.

**What landed:**
- New migration `20260513080000_iteration_0010_mood_board.sql` adds `events.role_palette` (JSONB, default `'{}'`) and `events.mood_board_updated_at` (timestamptz). The JSONB shape is `{ <role_group>: "#RRGGBB" }` with six allowed keys: `wedding_party`, `principal_sponsors`, `secondary_sponsors`, `bearers_flower_girl`, `officiants`, `other_roles`. App-side validation in `apps/web/lib/mood-board.ts` (`sanitizeRolePalette`) drops unknown keys and bad hex.
- New page at `/dashboard/[eventId]/services/mood-board` (takes precedence over the catch-all `[service]` placeholder for this slug only). Renders six labeled rows, each with a native `<input type="color">` and a swatch preview. Save submits to `saveRolePalette` server action which sanitizes, writes `role_palette` + `mood_board_updated_at`, and revalidates the event layout.
- The Guest List role chips now consume `event.role_palette`: when a palette entry exists for the role's group, the chip renders a 2-px ring-bordered colored dot before the role label. Falls back to the existing Tailwind-tinted chip backgrounds when no palette is set. Both desktop table and mobile card list pass the palette down.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0010_mood_board.md` — record MVP scope (per-role hex palette only) and flag three deferred sub-scopes that need spec input before they can ship:
  - **20-theme curated library:** named themes (e.g., "Cebu Sunrise", "Manila Old World", "Mountain Lodge") and their per-role palettes — needs design + content from owner.
  - **Setnayan Guide rule engine:** cohesion / contrast / temperature / saturation / cultural-defaults scoring algorithm — needs algorithm spec (formulas, thresholds, what gets flagged at what score).
  - **Venue palette extraction:** auto-derive a palette from venue photos via color quantization — needs upload pipeline + heuristics spec.
- The chip dot is a "visual signal" choice, not a "replace the chip tint" choice — kept the existing Tailwind tints so the page doesn't depend on dynamic class generation. Record this trade-off in the spec so a later revision can intentionally swap to dynamic-class chip tints if desired.

**Deferred:**
- Save palettes as named "moods" the couple can swap between (no separate `event_moods` table yet)
- Live preview of palette applied to a sample invitation
- Export palette as a downloadable swatch sheet for vendors

---

## 2026-05-13 · 0015 main website MVP — public landing rebuilt

**Commits:** to be filled in once committed.

**What landed:**
- `/` was a 45-line placeholder; it now renders a full single-page marketing landing:
  - **Top nav** with brand mark, Sign in (text), and Create account (primary button).
  - **Hero** with the `Set na 'yan.` tagline, a longer-form subhead, dual CTAs (Start planning / I already have an account), and a device mock on the right that previews the actual couple-home design (greeting, stage strip, NEXT UP card, mini nav grid). The device mock uses the same Tailwind tokens as the real Home page, so when 0021 themes change the home, the mock changes with it (couples checking the landing while logged in see brand defaults because the redirect catches them first).
  - **Shipping section** — six feature cards covering what's actually live (Guest List, QR invitations, RSVP, 4-theme system, Guided Planner, 6-stage strip + countdown). Lucide-icon lockups.
  - **Roadmap section** — six cards for Vendors / Seating / Budget / Papic / Panood / Photo Delivery, each with a "when" badge (Coming next / 2026 H2). Dashed borders to signal "not shipped yet" without making them look broken.
  - **Closing CTA** — short-form repeat ask with both Sign in and Create account links.
  - **Footer** — brand mark, "Made in the Philippines", quick links.
- Signed-in users still get redirected to `/dashboard` before the marketing layout renders.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0015_main_website.md` — record the V1-shipped MVP scope: English-only single-page landing. Two sub-scopes remain deferred and should stay flagged in the spec:
  - **i18n (EN / TL / CEB):** locale switcher and translated copy not yet implemented. When this lands, the page will need a top-nav locale picker and translation files; the visual structure should stay intact.
  - **Event Palette interactive preview:** the spec's "Event Palette" section (interactive palette previewer for the 4 themes) is replaced with a static device mock in this MVP. The interactive version is a follow-on.
- The shipped feature copy in `apps/web/app/page.tsx` (Hero / Shipping / Roadmap / Closing) is a **starter draft** — owner should refine via Cowork for the luxurious-Filipino-modern voice. Until then, the page is honest about what's live vs. what's coming and gives visitors a clear sign-up path.

**Deferred:**
- Locale infrastructure (EN/TL/CEB) — moved into a follow-on
- Event Palette interactive theme preview — moved into a follow-on
- Pricing page (no charm-pricing matrix locked yet for non-token model)
- Marketing pages beyond `/` (about, features detail, blog) — not in scope yet

---

## 2026-05-13 · 0021 transversal slice — themes, Lucide icons, new Home, Guided Planner

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — 4-theme system:** New CSS-variable theme blocks for Setnayan Default · Victorian · Classy · iOS in `apps/web/app/globals.css`. Tailwind `cream`, `ink`, and `terracotta` (incl. -600/-700) now resolve to `rgb(var(...) / <alpha-value>)`, so every `bg-cream/95`, `text-ink/40`, `border-terracotta` utility re-skins instantly. The dashboard layout reads `users.theme_preference` once per request and wraps its tree in `<div data-theme=…>`. Public invitation site at `/[slug]` stays on Setnayan Default (the theme picker is for the couple's admin chrome, not their guests' invitation).
- **Phase B — Lucide swap:** `lucide-react` added. BottomNav (Users / Briefcase / CalendarDays / Sparkles), Services launcher (Receipt / Palette / Camera / Tv / CloudUpload / Sparkles in tinted lockups), invitation slug status badges (Check / X / AlertTriangle / Loader2), and the guests-page Share/Clear chips now render Lucide strokes instead of emoji.
- **Phase C — New Home:** `/dashboard/[eventId]` was a redirect to `/guests`; it now renders a real home: warm welcome with time-of-day greeting + days-to-go, 6-stage strip (Dreaming → Booking → Inviting → Finalizing → Wedding Day → After) derived from event_date + guest count, NEXT UP card with branching logic (add first guests / set slug / send invites / lock seating / review), 8-tile nav grid (Guest List · Invitation · Vendors · Budget · Schedule · Seating · Services · Profile) with a guest-count counter on the Guest List tile, and a 6-row activity feed of recent guest additions.
- **Phase D — Guided Planner:** New migration `20260513070000_iteration_0021_planner.sql` adds `users.planner_mode` enum (`guided` | `diy`, default `guided`) and `event_journey_steps` table with Pattern B RLS (couple read + write via `current_couple_event_ids()`). New `apps/web/lib/planner.ts` defines 9 steps, derives 5 from existing event/guest state (date set, venue, guests, monogram/palette, slug), keeps 4 manual (send invites, book vendors, finalize seating, thank-yous), and exposes `resolveStepStatuses` + `plannerProgress`. New server action `toggleJourneyStep` upserts/deletes manual completions. New Checklist component on Home shows progress bar + 9 rows with hint text and links. Profile page gains a guided/DIY toggle that hides the checklist for couples who want to roam free.

**SPEC IMPACT:**
- `~/Documents/Claude/Projects/Setnayan/04_Iterations/0021_couple_dashboard_fully_purchased.md` — record the four-theme palette values (RGB triplets) and the 9-step planner key list since they will be referenced by iterations 0006 (Vendors), 0007 (Budget), 0008 (Seating), and 0025 (Profile Settings full surface). Specifically:
  - Theme palettes: Setnayan Default (`#FAF7F2 / #1A1A1A / #C97B4B`), Victorian (`#F5EBD9 / #2E1A1A / #8B1E3F`), Classy (`#F4F4F2 / #0F0F0F / #A38560`), iOS (`#F2F2F7 / #000000 / #007AFF`).
  - Planner step keys: `set_date`, `pick_venue`, `build_guests`, `customize_invite`, `set_slug` (all auto-derived), `send_invites`, `book_vendors`, `finalize_seating`, `after_event` (all manual).
  - Pattern B helper `current_couple_event_ids()` is now load-bearing for two surfaces; document in `02_Specifications/RLS_Policy_Pattern.md` § 5 mapping table as an established helper.

**Deferred (still gated on later iterations):**
- QR Hub, Gallery sub-page, Vendors / Budget / Schedule / Seating real surfaces — placeholder pages remain.
- Activity feed currently only shows guest additions; scan-event + RSVP-response items are a follow-on (data model exists, UI not yet wired).

---

## 2026-05-13 · 0002 deferral close-out — TBA onboarding, 6 widgets, limited +1 lock, real-time slug check

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — +1 TBA onboarding flow:**
  - New `/[slug]/welcome` route that captures a TBA +1's first + last name. Spec § +1 onboarding flow (lines 121–161).
  - Redeem handler detects TBA placeholders (`plus_one_of_guest_id IS NOT NULL && first_name='TBA' && plus_one_name_confirmed_at IS NULL`) and routes to `/welcome` instead of the personal invitation site.
  - Confirmation submit updates `guests.first_name`, `guests.last_name`, `guests.plus_one_name_confirmed_at = NOW()`, then records a scan_events row with `context.entry='plus_one_onboarded'` so the couple's admin can see the onboarding moment distinctly, then redirects to the standard personal invitation site.
  - "This isn't me" link clears the cookie via the existing sign-out flow.
  - `/[slug]` page also gates: if a guest re-arrives with an unconfirmed TBA cookie (clicked away mid-onboarding), they're re-routed to `/welcome`.
- **Phase B — 6 additional widgets** added to the personal invitation site:
  - **Countdown** (client component, ticks every second, auto-hides past the event date) — 4 boxes for D / H / M / S
  - **Venue** card with Google Maps deep-link "Get directions"
  - **Dress Code** with 5-swatch palette + Do/Don't grid using locked copy
  - **Photo Moments** 3-card grid (Bridal Walk · The Kiss · First Entrance) with locked spec copy
  - **Your Photos** placeholder + profile-photo card + "Add more via Shutter" (deferred to Phase 2)
  - **Public vs Registered tier comparison** with Sign-up free CTA
- **Phase C — Limited +1 full lock variant:**
  - When `plus_one_mode='limited'`, the tier comparison widget renders BOTH cards visually disabled (dashed borders, 55% opacity) and replaces the "Sign up free →" CTA with a "Learn more about Setnayan" link to the marketing site.
  - "Your photos" widget hides the "Add more via Shutter" card and replaces it with a "Your photos will be visible in your inviter's gallery" notice.
- **Phase D — Real-time slug availability check:**
  - New `/api/slugs/check` route handler returns `{ status: 'available' | 'taken' | 'current' | 'invalid_format' | 'reserved' }` with 3 suggested alternatives on `taken`.
  - New `SlugField` client component on the invitation admin uses 300ms debounce + `useTransition` for the save action. Visual states: `⋯` checking, `✓` available, `✗` taken, `⚠` invalid format. Suggestion chips populate inline; clicking one fills the field.
  - Save button is disabled until the current value is `available` AND differs from `initialSlug`.

**Build verification:** 6 new routes (`/[slug]/welcome`, `/api/slugs/check`, plus the previously-shipped 4) all compile and serve correctly.

**SPEC IMPACT:** None new this pass. The 2 spec impacts flagged in the previous 0002 entry remain pending Cowork update.

**Still deferred (genuinely blocked or out of V1 scope):**
- Branded QR with monogram-in-center compositing + 25-frame library (complex SVG work; not blocking)
- Per-role palette QR colors (waits on iteration 0010 palette finalization)
- 3-day photo retention enforcement for public guests (no photos yet)
- Post-download conversion screen (no photo download yet)
- Native-app scanning stubs (Phase 2/3 explicitly)
- Apple/Google Wallet pass generation (V1.5)
- Schedule widget (waits on iteration 0004 invitation widgets)

---

## 2026-05-13 · Iteration 0002 — QR Invitation System (MVP slice)

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — schema migration `20260513050000_iteration_0002_invitation.sql`:**
  - `events.slug` + format CHECK + case-insensitive UNIQUE index; `events.palette_finalized_at`
  - `guests.profile_photo_url` + `profile_photo_set_at` + `profile_photo_segment`
  - `guests.plus_one_name_confirmed_at`, `guests.scan_tracking_opt_out`, `guests.download_completed_at`
  - `scan_events` table with `scan_source` enum; IP anonymized to first 3 octets per RA 10173
  - `slug_change_log` for 90-day SEO redirects
  - RLS: couples read their event's scan_events; guests read their own; service-role writes
- **Phase B — slug auto-generation** in `apps/web/lib/slugs.ts`. Wired into `createWeddingEvent` so every new event gets a unique slug on creation. Reserved-slug pool (admin, api, dashboard, login, etc.) blocked from claim.
- **Phase C — public guest invitation route at `/[slug]?invite=[token]`:**
  - Token validated via admin client (visitor isn't authed). On valid: signs HS256 JWT cookie (60-day expiry covers the 30-day post-event window), records a `scan_events` row, redirects to clean `/[slug]` URL.
  - Personal invitation site MVP: Hero with monogram placeholder · Greeting · QR card · RSVP form · Event details · sign-out
  - Limited +1 sees inline disclosure block (full Limited variant deferred)
  - Invalid token / wrong-event session → public landing with friendly message
- **Phase D — RSVP submission via `submitRsvp` server action** writes through admin client (visitor isn't authed). Sets `rsvp_responded_at` when status is attending or declined. Revalidates `/dashboard/[eventId]/guests` so couple sees changes immediately.
- **Phase E — Couple admin at `/dashboard/[eventId]/invitation`** (replaces 0000's placeholder):
  - Public-landing URL display + slug editor
  - Server-rendered QR thumbnails (qrcode npm, error correction level H, quiet zone 4)
  - Per-guest "Re-issue" button rotates `qr_token` (16 random bytes hex); old printed QRs become invalid immediately
  - Slug changes write to `slug_change_log` for the 90-day SEO redirect window
- **Phase F — Print sheet at `/dashboard/[eventId]/invitation/print`** with A4 `@page` rules + 3-column QR grid; direct-browser-print works.

**New libs:** `lib/slugs.ts`, `lib/qr.ts`, `lib/guest-session.ts` (JWT cookie helpers).
**New env var:** `GUEST_SESSION_SECRET` (32-byte hex). Falls back to `SUPABASE_SERVICE_ROLE_KEY` if unset.
**Backfill:** existing demo event `S89E-17VNTRAQD8` got slug `maria-and-juan` so the public route works against the seeded data.

**Deferred (logged for future polish):**
- Branded QR with monogram-in-center compositing + 25-frame library + simplified variants for QR-center
- Per-role palette QR colors (depends on iteration 0010)
- +1 TBA onboarding screen (column exists; UI deferred)
- Limited +1 invitation site full variant (currently inline banner only)
- 9 of 14 widgets: Countdown, Venue, Schedule, Dress Code, Photo Moments, Your Photos, Public vs Registered tier, Wallet save, Registered RSVP extras
- Real-time slug availability check with 300ms debounce + `/api/slugs/check` endpoint
- 3-day photo retention enforcement for public guests
- Post-download conversion screen
- Native-app scanning stubs (Phase 2/3)
- Apple/Google Wallet passes

**SPEC IMPACT — please update via Cowork:**
1. `0002_qr_invitation_system.md` line 888 (Notes for Claude Code) says "error correction level M"; locked structural rules at line 537 say level H. Implementation uses H. Fix the notes inconsistency.
2. `0002_qr_invitation_system.md` line 263 declares route `setnayan.com/dashboard/qr-codes` (couple admin); the actual implementation follows 0000's event-scoped pattern at `/dashboard/[event-id]/invitation`. Update the route declaration.

---

## 2026-05-13 · Iteration 0001 polish — detail/edit, plus-one UI, custom tags, invited-to blocks, CSV import

**Commits:** to be filled in once committed.

**What landed:**
- **`/dashboard/[eventId]/guests/[guestId]`** detail + edit page surfacing all 27 columns:
  - Identity, Categorization (side / group / role), RSVP & events (RSVP / meal / invited-to / dietary), Contact, Tags & notes, photo consent
  - **Soft delete** via `softDeleteGuest` server action — sets `deleted_at`, RLS-gated SELECT already filters it out
  - List rows + mobile cards now link to the detail page
- **Plus-one toggle** in the add-guest flow:
  - `<details>` progressive disclosure (no client JS — pure server-rendered)
  - Sub-block exposes first/last name (or blank for TBA) + Full/Limited mode radio
  - Server action creates the primary `guests` row, then a SECOND `guests` row with `plus_one_of_guest_id`, `plus_one_mode`, own auto-generated `qr_token` (per spec § Plus-one management)
  - TBA path: blank names persist a row with placeholder `first_name='TBA'` + `last_name='+1'` + display_name `"+ TBA · brought by {primary}"`
- **Custom tags** as comma-separated input on both add + edit forms — max 50 tags, persisted into `guests.custom_tags TEXT[]`
- **Invited-to schedule-block chips** on both add + edit — 5 blocks (ceremony · reception · cocktails · after_party · rehearsal_dinner). Ceremony + reception checked by default. Uses CSS `has-[:checked]` to style without client JS
- **`/dashboard/[eventId]/guests/import`** CSV import:
  - Paste-into-textarea flow (200-row cap)
  - Inline `parseCsv` helper in `lib/csv.ts` (quoted fields, escaped quotes, CRLF/LF/CR, empty cells)
  - Per-row validation against canonical enums; failed rows surface line-numbered errors; valid rows batch-insert in one statement
  - Returns to `/guests?imported=N&skipped=M`
  - Template + accepted-columns inline on the import page

**Deferred (not in this pass):**
- Households UI (the CSV importer stashes the household column into `guests.notes` as a placeholder until households UI ships)
- Address JSONB editor
- File-upload variant of CSV import (paste-only for now)
- Mobile-specific full-screen sheet variants of add/edit (responsive forms work cross-platform)
- Bulk-edit spreadsheet mode
- Resend-invitation action on detail page (depends on iteration 0028 email templates)
- Custom-tag chip input with autocomplete from existing tags (comma-separated input works for now)

**SPEC IMPACT:** None. All choices align with spec § Functional scope.

---

## 2026-05-13 · Hotfix — RLS infinite-recursion in event_members policies

**Commit:** `19242e4` · migration `20260513040000_fix_rls_infinite_recursion.sql`

**Symptom:**
Anyone signed in hitting `/dashboard` (or any page that queried event-scoped tables) got `Application error: a server-side exception has occurred`. Vercel runtime logs showed `Error: Failed to fetch events: infinite recursion detected in policy for relation "event_members"`.

**Root cause:**
Pattern B policies on `event_members`, `events`, `event_join_tokens`, `guests`, and `households` used inline subqueries like `event_id IN (SELECT event_id FROM event_members WHERE user_id = auth.uid() AND member_type = 'couple')`. When the outer query runs against `event_members`, the SELECT policy on `event_members` fires; the policy's USING clause issues that subquery; the subquery against `event_members` re-triggers the SELECT policy on `event_members`; Postgres aborts with the recursion error. This affected every page that read couple-scoped data through the user's JWT.

**Fix:**
Added two new SECURITY DEFINER helpers that bypass RLS for the lookup:
- `public.current_couple_event_ids()` — event_ids where the caller is `member_type='couple'`
- `public.current_user_guest_ids()` — guest_ids attached to caller's event_members rows

Rewrote 10 policies (4 on event_members, 2 on events, 1 on event_join_tokens, 2 on guests, 1 on households) to use the helpers instead of inline subqueries on event_members.

**Why this matters going forward:**
Every future Pattern B policy that needs "events where I'm a couple" must use `current_couple_event_ids()`. Inline `SELECT event_id FROM event_members WHERE ...` subqueries will recurse the same way.

**SPEC IMPACT — please update via Cowork:**
`02_Specifications/RLS_Policy_Pattern.md` currently documents 4 helpers (`is_admin`, `current_event_ids`, `current_vendor_ids`, `current_thread_ids`). Add the two new ones to that doc — `current_couple_event_ids` and `current_user_guest_ids` — so future iterations know to use them.

---

## 2026-05-13 · Iteration 0001-B — Seed sample guests + Join flow + next-redirect

**Commits:** to be filled in once committed.

**What changed:**
- **Migration `20260513020000_enable_pgcrypto.sql`** — enables pgcrypto in `extensions` schema (was needed for `gen_random_bytes` used by `event_join_tokens.token` and `guests.qr_token` defaults; Sprint 0 missed this).
- **Migration `20260513030000_fix_pgcrypto_qualification.sql`** — schema-qualifies all `gen_random_bytes()` calls (Supabase places pgcrypto in `extensions` schema; SECURITY DEFINER functions don't see it on the default search_path).
- **Seed** — inserted 15 canonical guests from the iteration 0001 fixtures into the owner's first event (Maria & Juan demo wedding). Done via one-off `/tmp/setnayan-seed/seed.mjs` using @supabase/supabase-js with service_role.
- **Join flow** (closes the iteration 0000 deferred work):
  - `/join/[eventId]?token=...` validates the event_join_tokens row via admin client, then asks unauthed visitors to sign in / create account, and shows the 18-role picker to authed visitors who aren't yet event members
  - `joinEventAction` server action: re-validates token, finds-or-creates a `guests` row by email match, inserts the `event_members` row via the user's own JWT (Pattern B's self-insert clause), then redirects to success page
  - `/join/[eventId]/success` confirmation page reachable by any event member, shows event name + role + dashboard CTA
- **`lib/supabase/admin.ts`** — service-role server client for operations that need to read or write data the current user can't see through RLS (e.g., validating an event-join token before the scanner has become an event_member). Strictly server-only.
- **`/login` and `/signup` actions honor `?next=/path`** so the join flow can round-trip through auth without losing the destination. Magic-link `emailRedirectTo` carries the `next` forward through `/auth/callback`. `safeNext()` validates relative-only paths to prevent open-redirect.

**SPEC IMPACT:** None. All choices align with the spec.

---

## 2026-05-13 · Iteration 0001 — Guest List (Phases A–C, MVP slice)

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — schema migration `20260513010000_iteration_0001_guests.sql`:**
  - Enum `public.guest_role` with all 18 Filipino-wedding roles per spec § Role taxonomy
  - 5 supporting enums: `guest_side`, `guest_group_category`, `meal_preference`, `rsvp_status`, `plus_one_mode`
  - `public.households` table (no public_id surface — internal entity)
  - `public.guests` table with all 27 columns from the spec including `plus_one_*` columns, `photo_consent` (default TRUE per RA 10173), `invited_to_blocks` (default ceremony+reception), `custom_tags`, `qr_token` (auto-generated), `deleted_at` (soft delete)
  - `public_id` on guests follows `S89G-XXXXXXXXXX` canonical format
  - RLS Pattern B on both tables — event-scoped read, couple-write, admin override
  - Bonus policy: a registered guest can read their own row (for iteration 0002's invitation site rendering)
  - Retroactive FK: `event_members.guest_id → guests(guest_id) ON DELETE SET NULL`
- **Phase B — `/dashboard/[eventId]/guests` list view** (replaces the iteration 0000 placeholder):
  - Stats strip with 5 cards: Invited / Attending (emerald) / Pending (amber) / Declined (rose) / Plus-Ones (terracotta) — each card is a clickable filter
  - URL-based filter: `?rsvp=attending|pending|declined|maybe`
  - URL-based search: `?q=...` — fuzzy match on name + display name + email + custom tags
  - Desktop table (≥640px): avatar + name + plus-one hint + role + side pill + RSVP pill + contact
  - Mobile card list (<640px): avatar + name + role + RSVP pill
  - Empty states for both "no guests yet" and "no matches for filters"
  - Side-coded avatars (rose / sky / amber for bride / groom / both)
- **Phase C — `/dashboard/[eventId]/guests/new` add-guest form:**
  - 7-field MVP version: first/last name · side · group · role (all 18 options) · email · mobile · meal · RSVP · photo consent (default true) · notes
  - Server action `createGuest` with full validation against every enum value
  - On success → `revalidatePath` the list + redirect back to `/guests?added=1`
  - Plus-one model, address JSONB, custom tags, invited_to blocks UI — deferred to a follow-up
- `apps/web/lib/guests.ts` helper module — fetch/stats/labels/initials utilities + type unions for all enums

**Deferred from iteration 0001 (out of session scope):**
- Detail drawer (click row → side drawer with edit/delete)
- Plus-one toggle + TBA / Full / Limited modes UI (schema is ready, UI deferred)
- CSV import (200-row max)
- Households UI (create + assign)
- Custom-tag chips input with autocomplete
- Invited-to schedule-block toggles per guest
- Address JSONB editor
- Mobile-specific full-screen add-guest sheet (currently uses the same form)
- Bulk-edit spreadsheet mode

**SPEC IMPACT — please update via Cowork in `~/Documents/Claude/Projects/Setnayan/0001_creating_guest_list/`:**

1. **`0001_creating_guest_list.md` line 48** — declares route `setnayan.com/dashboard/guests`. Iteration 0000's locked URL pattern is `setnayan.com/dashboard/[event-id]/guests`. Update the route line to match.
2. **No retired-system references found** in the 0001 spec — good.

---

## 2026-05-13 · Iteration 0000 — App Shell & Navigation (Phases A–D)

**Commits:** to be filled in once committed.

**What landed:**
- **Phase A — schema delta migration `20260513000000_iteration_0000_shell_schema.sql`:**
  - `users.phone`, `users.profile_photo_url`, `users.last_login_at`
  - `events.venue_name`, `events.venue_address`
  - `event_members.role` (free text for the 18-role taxonomy from 0001), `event_members.joined_via` enum (`qr_scan` / `invited` / `created_event` / `admin_added`)
  - `event_members.guest_id` + `event_members.vendor_id` nullable forward-compat columns (FKs added by iterations 0001 + 0022 respectively)
  - `public.generate_event_join_token()` + `public.handle_new_event()` trigger — auto-mints a 32-hex token when a new event is inserted
- **Phase B — `/dashboard` event picker:**
  - Auto-jump rule: 0 events → empty welcome state; 1 active event → server redirect; 2+ active events → picker with primary-first sort
  - `apps/web/lib/events.ts` — `fetchUserEvents()` helper + `EventRow` types + date formatting
  - `apps/web/app/dashboard/layout.tsx` — top-level chrome (brand + avatar + sign-out) outside event scope
  - Archived events collapsed under a `<details>` disclosure
- **Phase C — `/dashboard/create-event`:**
  - 6-tile event-type picker per spec § 2.5 — Weddings selectable, the other five visibly disabled with "Coming soon" badge
  - Wedding-only server action `createWeddingEvent` enforces `event_type='wedding'` (V1 lock)
  - Inserts: `events` row → trigger mints `event_join_tokens` row → also inserts `event_members` row with `member_type='couple'` and `joined_via='created_event'`
- **Phase D — inside-event shell `/dashboard/[eventId]/...`:**
  - Authorization check in layout: 404s if signed-in user isn't a `couple` member of the event
  - Sticky top chrome with event pill + back-to-events link + avatar
  - `BottomNav` client component with 4 tabs (Guest List · Vendors · Schedule · In-App Services) — fixed-bottom on mobile, inline on desktop, ≥44pt touch targets
  - Tab→URL mapping handles sub-pages (e.g., `/invitation` + `/seating` still highlight Guest List tab)
  - Placeholder pages for every tab (each names its owning iteration)
  - **Services launcher grid** with 6 cards — **NO wallet card** (per the Cowork update needed below). Cards: Orders (0034) · Mood Board (0010) · Papic (0012) · Panood (0011) · Photo Delivery (0009) · LED Background (0005)
  - `/dashboard/[eventId]/services/[service]` placeholder routes for each of the six
- **`/dashboard/profile`** — minimal V1 surface showing public_id, account_type, is_internal/team flags, locale, theme preference + sign-out. Full surface deferred to iteration 0025.
- **`/` landing page** — signed-in users redirect to `/dashboard`; unauthed see the existing sign-in / create-account CTAs

**Build / lint / typecheck:** all green. 14 routes compile (server-rendered, all dynamic since they read auth cookies). RLS audit query verified clean on the live database.

**Deferred from iteration 0000 (out of session scope):**
- Join flow at `/join/[event-id]?token=...` — needs the 18-role taxonomy from iteration 0001
- Unified Schedule view aggregating across `vendor_meetings`, `VendorLineItem.deadline_date`, and `invitation_widgets` — needs iterations 0006 + 0007 to ship first
- Vendor-side and admin-side role-router destinations — V1 focuses on customer surfaces (per spec § "Vendor accounts are a placeholder in V1")
- Inside-tab sub-pill row for Guest List (guests/invitation/seating) and Vendors (vendors/budget) — will land when 0001/0002/0008/0006/0007 ship real content

**SPEC IMPACT — please update via Cowork in `~/Documents/Claude/Projects/Setnayan/`:**

1. **`0000_app_shell_and_navigation/0000_app_shell_and_navigation.md`** — the token wallet is referenced at multiple points but was RETIRED 2026-05-11. Affected lines:
   - L21: "Wallet" listed as one of the In-App Services launcher tiles
   - L140: "Token wallet pill on the right (\"🪙 75,000\")" in the chrome
   - L197 / L213 / L220 / L387: "Wallet" / "Top up" / "0003 wallet panel"
   - Replace all with the apply-then-pay model from iteration 0034. The chrome no longer carries a wallet pill; the "Orders" entry in the Services launcher replaces the Wallet card.
2. **`0000_app_shell_and_navigation/fixtures.json`** vs **`.md`** — fixtures.json uses `users.primary_event_id` (FK on user) but the .md SQL declares `events.is_primary` (boolean on event). Sprint 0's base migration already shipped `events.is_primary`. Either reconcile fixtures to match (`is_primary` on the event row) or update the spec SQL to match fixtures (move it to users).

---

## 2026-05-12 · Sprint 0 — platform foundation

**Commits:** `394ded8` → `d93e900` (initial scaffold + 4 CI fixes + STATUS.md update).

**What landed:**
- Fresh greenfield Setnayan monorepo (full wipe of prior Tayo scaffold, rebuild from scratch).
- Next.js 15 App Router web app with `output: 'standalone'`, Tailwind locked breakpoints (sm 640 / md 768 / lg 1024 / xl 1280), ≥44 pt touch targets, brand palette (cream / ink / terracotta).
- Auth: email/password + magic-link via Supabase SSR — no OAuth popups (works in Tauri/webviews).
- `/health` route, login + signup pages responsive across the 4 canonical viewports.
- Supabase Postgres canonical schema migration `20260512000000_setnayan_base.sql`:
  - `public.generate_public_id(type_letter)` function (Crockford base 32, no I/L/O/U).
  - 5 enums (`account_type`, `event_type`, `member_type`, `locale_code`, `theme_preference`).
  - 4 base tables (`users`, `events`, `event_members`, `event_join_tokens`) with `S89X-` `public_id` defaults.
  - 4 RLS helpers (`is_admin`, `current_event_ids`, `current_vendor_ids`, `current_thread_ids`) — `SECURITY DEFINER STABLE`.
  - RLS Pattern A (per-user) on `users`; Pattern B (event-scoped) on the other three.
  - `on_auth_user_created` trigger — auto-provisions `public.users` and flags `iscasasolaii@gmail.com` as `is_internal=TRUE` per § 10a.
- `apps/web/scripts/rls-audit.sql` — the merge-floor verification query per RLS spec § 9.
- PWA: `manifest.json`, service worker (`sw.js`), maskable SVG icons (192 + 512).
- Tauri 2 desktop scaffold (`src-tauri/`): `Cargo.toml`, `tauri.conf.json`, `build.rs`, `src/main.rs` + `lib.rs`, master `icons/icon.svg`. Embedded `shell/index.html` redirects to live Vercel URL — Sprint 0 minimum viable.
- GitHub Actions: `ci.yml` (typecheck + lint on every push/PR), `build-desktop.yml` (macOS + Windows matrix on push to main), `lighthouse.yml` (Lighthouse CI on PRs).
- `packages/shared` — `PUBLIC_ID_PATTERN`, `isValidPublicId`, role/event/member type unions.
- Live services wired:
  - GitHub: `iscasasola/setnayan-platform` (private)
  - Supabase: project `njrupjnvkjkitfctetvi` in Singapore
  - Cloudflare R2: 4 buckets in APAC (`setnayan-media`, `setnayan-thread-files`, `setnayan-vendor-contracts`, `setnayan-samples`)
  - Vercel: `https://setnayan-platform-web.vercel.app`, auto-deploy on push to main
- CI fix commits resolved: pnpm version conflict (`pnpm/action-setup` no longer pins explicit version), phantom worktree gitlinks pruned from index, Tauri `frontendDist` pointed at embedded shell, desktop artifact upload glob corrected to include target subdirectory.

**Acceptance criteria:** all 7 provisioning steps + Phase 1A/1B/1C/1D green. Owner signed up (`S89U-KEMMF2ADCK`, `is_internal=TRUE`), PWA installed on one phone, both desktop artifacts (1.3 MB `.dmg` + 1.3 MB `.msi`) downloadable from Actions tab.

**SPEC IMPACT:** None. The scaffold mirrors the spec corpus 1:1. The Tauri prod URL strategy remains a known gap (documented in `STATUS.md`); if/when we pick a sidecar Node strategy vs static export, that's a spec impact and the owner must update `0013_platform_stack_and_sync` via Cowork.
