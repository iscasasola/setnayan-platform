# Setnayan — Project Status

> Living checkpoint. **Refreshed 2026-08-19.**
> Anchor doc — if you're opening this repo cold in a new Claude session, start here, then read
> the newest handoff named at the top of `CLAUDE.md`.
> **Snapshot, not a log.** Full per-PR detail lives in `CHANGELOG.md` + git history — this file is the current-state picture only.
>
> ⚠ **This file sat 34 days stale and told cold sessions to start here.** While stale it stated
> that the vendor **token** economy was "live in prod" — tokens were **RETIRED 2026-08-07**, and
> the repo carries `apps/web/lib/token-economy-is-retired.test.ts` to keep them retired. A cold
> session could have built against a currency that no longer exists. **The date on a snapshot is
> part of its content: if you cannot refresh it, say what is unverified rather than leaving a
> confident sentence in place.**

**Owner deadline anchor:** December 2026 wedding

---

## Verified production state — 2026-08-19

Measured against the live database and the live site, not remembered.

**8 events · 39 guests** (largest roster 32) · **2 shops** · **0 orders, ever** · **14 Papic
photos** (13 stills + 1 clip, one event, none hidden).
⚠ This line said **"0 photos"** when first written *today*, in the section headed "measured, not
remembered". It was not measured. **Do not treat the gallery as empty** when reasoning about
retention, the compression sweep, face-matching or the photo wall.
Nothing has been bought and almost nothing has been exercised — **which is why defects here are
found by reading code rather than by anyone complaining.** Every one fixed on 2026-08-19 had been
live for weeks: the upload stall since 5 July, the call-room initials since 11 July.

🔑 **The highest-value action is not on this list: somebody using the product end to end on a
phone.** An hour of that surfaces more than a day of sweeping, and no session can do it.

## Where we are right now

V1 web surface is **functionally complete** and live at `setnayan.com`. The build is well past the pre-launch spine (19 iterations closed 2026-05-13, then the 2026-05-14 28-PR run) and the family-life-OS expansion (date-anchor lifecycle + faith-aware person graph, flag-gated to the DPO counsel gate). The **2026-07-15/16 mega-session** was a design-system + wayfinding + seat-plan push — the product now shares one visual language and one navigation model across all four doorways.

**Design system — Atelier-Glass rollout PR-0…9 COMPLETE.** The whole app moved to the owner-locked **Atelier-Glass** contract (Hanken Grotesk + Space Mono, gold supersedes wine, violet retired), built as a numbered rollout: foundation + kit primitives + motion library (PR-1, #3251) → event Overview recomposition with a "Big Day" focal + glass bento + motion (PR-2, #3256) → event core sections Guests/Schedule/Vendors/Budget/Checklist (PR-3a/3b, #3258/#3259) → event long-tail sweep (PR-4, #3260) → account spokes (PR-5, #3261) → vendor shell + home (PR-6, #3264) → vendor sections (PR-7, #3270) → admin Exception-Desk home (PR-8, #3267) → admin tabbed-studio + standalone-queue sweep (PR-9a/9b, #3268/#3269, **rollout COMPLETE**). The four-surface home launcher was brought up to the approved prototype (#3240/#3241). Guest sites stay out of scope (their editorial look is deliberate).

**Inspector program — desktop inspector column on 4 surfaces.** A shared inspector primitive (#3265) now lets a desktop user click a row and keep the list in view, wired into **Studio decisions + Overview decisions** (P1, #3265), **Guests** (click a guest, keep the roster, #3279), and **Merkado** (vendor quick-view + the AI toggle retired, #3280).

**Navigation — flat rails, wayfinding audit, real doorways.** All desktop sidebars flattened to solid single-level menus (no submenus, #3257); the vendor rail collapsed to the owner's **5-page IA**; the identity **plaque became the account menu** (wordmark → home, email pill retired). A **wayfinding audit** gave **5 orphaned-but-live surfaces real doorways** (#3252), and the Guests page's seat-plan / guest-QR / invite-link doorways were restored. The old universal `(account)` sidebar cluster was deleted for the chrome-less launcher paradigm.

**Seat-plan program — the biggest single build of the session.** A council-verdict rebuild of the seating editor around one geometry authority:
- **Placement oracle** — a pure geometry kernel + verified solver (#3277), then **every mutation path routed through it** (weld model + metric walkway control + honest Auto Arrange, #3278). Sweetheart-on-stage is a shared oracle rule (#3288).
- **Scroll-less editor frame** (#3275) with a **[2D · 3D · List]** switch, **panel tabs + blueprint 2D canvas + mobile drawer** (#3276).
- **Vendor presence** — lock-gated booth vendors + a Setnayan-promotion default across 2D/3D (#3281).
- **3D manipulation parity** — move/rotate through the shared oracle + Save & view (#3285); full **2D⇄3D authoring parity** (#3288).
- **Connective positioning** — combine-that-stays-combined welds (pairwise exemption + cross-family rect↔serpentine), serpentine end-to-end joins, connective snap positioning with **rigid-group linking deferred** (#3305/#3307).
- **2D/3D sync coordinate contract v2** — one coordinate contract, 2D/3D/List **provably synced** behind a **14-test parity proof suite** + render-crash guards and a **route-level error boundary** around the editor (#3330).

**Vendor economy — ⚠ THE TOKEN CURRENCY IS RETIRED (2026-08-07). ~~identity is what the token buys~~.** The paragraph that stood here described a **flat ₱200/token** catalog and a **1-token burn per lead** as "live in prod". **Both are gone**: the vendor token currency was retired entirely — no packs, no bundles, no grant surface, nothing that spends one, and prod never saw one bought or spent. `apps/web/lib/token-economy-is-retired.test.ts` exists to keep it that way. Anonymized-until-accept inquiries (#3266) still ship; answering is **free on every tier**. Off-platform settlement keeps **commission at 0%** — but there **is** a **booking fee** charged to the VENDOR (5% first ₱100k · 1% above · floor ₱50 · sourced clients only · first 5 free), currently **flag-dark**. Never call it commission.

**Spaces — Samahan community door live.** The minimal Samahan cut shipped end-to-end: schema (#3243) → routes + lib layer (#3245) → community-event creation context (#3246) → the **Spaces home tile goes live** (PR-4, #3250).

**Housekeeping — dependabot 14 → 4.** Security alerts triaged down: web js-yaml/esbuild (#3286) + 8 mobile transitive bumps tar/minimatch (#3297), leaving 4 open.

### What's next (2026-08-19)

⚠ **The four bullets that stood here were the 2026-07-16 seat-plan follow-ups.** They may still
be worth doing, but they were NOT verified against shipped code at this refresh — treat them as
unverified, not as a plan. They are preserved at the bottom of this section.

**The current stream: a failed read must not be rendered as a fact.** Nine confirmed instances
remain, each with file:line, in the corpus doc
`WHATS_NEXT_Silent_Failures_2026-08-19.md` §2. **None of the nine is money — the two money ones
are done** (#4587 · #4588).

**The pattern to copy — it already exists in this repo, do not invent a new one:**

| shape | file |
|---|---|
| the original (supplier side) | `apps/web/app/vendor-dashboard/reads-are-honest.test.ts` |
| a list + its counts | `apps/web/lib/guests.ts` · `apps/web/lib/guests-read-is-honest.test.ts` |
| money | `apps/web/lib/budget.ts` · `apps/web/lib/money-that-was-never-measured.test.ts` |
| a `try/catch` that can never fire | `apps/web/app/dashboard/[eventId]/_components/the-dashboard-counts-what-it-read.test.ts` |

Its three rules: bind the error on every `data` destructure; **gate any stated absence on a
measured flag AND show a "we couldn't load" line** (a log line never changed a pixel); never
render a refused read as a money figure or a headcount of zero. `actions.ts` files are out of
scope — there an absence DENIES, and failing closed is correct.

**Then stop hunting and switch to the launch checklist** — the owner rulings and sign-offs in the
corpus `WHAT_IS_LEFT_2026-08-17.md` §6, which no amount of engineering moves.

<details><summary>The unverified 2026-07-16 seat-plan follow-ups</summary>

- **Rigid-group linking rebuild** — connective snap positioning shipped, but the Keynote-style "linked tables move/rotate as one rigid unit" was deferred; rebuild it on top of the oracle/weld model.
- **Seat-plan polish list** — collision-avoidance for many simultaneous 3D walkers, free-board fit-framing for spread layouts, RSVP→seat auto-rules in the canonical engine.
- **Sentry 9 → 10 migration** — bump the SDK off v9.
- **R6 radius-token rename sweep** — route the last ad-hoc corner radii through the `--m-r-*` scale.

</details>

### Owner-side actions

Flag-gated features await owner env-flip / provisioning, not code. The canonical, always-current list is **`OWNER_ACTIONS.md`**; the standing items include any remaining counsel-gated flags. ⚠ **The PayMongo one-time gateway is NOT one of them: PR #3146 was CLOSED unmerged on 2026-07-30** (verified 2026-08-19). Do not report it to the owner as code-complete-and-waiting — there is no payment gateway sitting one flip away. Auto-merge is armed automatically on every non-draft PR (see the workflow note under Locked decisions).

---

## Locked architectural decisions (no further owner input needed)

### Time-limited services — **no cron**

For services with a paid time budget (Panood / Live Studio, Papic camera-seat session, future limited-duration SKUs), use database-state + on-access checks. Owner locked 2026-05-14: no Vercel Cron, no Supabase `pg_cron`, no Cloudflare Cron Triggers. The standing cron-free primitive is a durable single-row compare-and-swap (`cron_job_runs` + `claim_periodic_job` + `lib/periodic-jobs.ts`) fired from `after()` on live traffic.

**Pattern:**
- `service_sessions` row stores `scheduled_for`, `start_window_opens` (= `scheduled_for - 30 min`), `start_window_closes` (= `scheduled_for + 2 hours`), `duration_minutes`, `started_at`, `expires_at`, `status`
- Couple hits **Start** between `start_window_opens` and `start_window_closes` → server sets `started_at = now()`, `expires_at = now() + duration_minutes`, flips status to `active`
- Every read of the service surface validates `now() < expires_at` server-side; flips status to `expired` lazily on next access if exceeded
- Client tracks the countdown locally from `expires_at` for the visible timer; polls every 30 sec to revalidate
- When countdown hits 0 client-side, UI swaps to "session ended" state immediately
- **Resource teardown** (stopping the Live Studio broadcast, releasing Papic seats, etc.): hybrid client-driven + lazy admin sweep:
  - **Client-driven (primary)**: countdown hits 0 → client fires `/api/sessions/[id]/teardown` → server calls the external API to stop the resource
  - **Lazy sweep (backup)**: any couple/admin page load sweeps `WHERE expires_at < now() AND status = 'active'` and fires teardown — covers the case where the broadcaster's browser is offline

Applies to: 0011 Live Studio (Panood), 0012 Papic, future time-budgeted SKUs. **Does NOT** apply to bookings or events themselves (those use absolute date scheduling).

### Auto-merge is armed for you

`.github/workflows/auto-merge.yml` arms auto-merge on every non-draft PR so shipping never depends on someone remembering `gh pr merge --auto`. The merge is still gated by branch protection — it only fires once ALL required checks pass. **To HOLD a PR:** open it as a DRAFT. **⚠ Bot-arming caveat (observed 2026-07-15):** when the workflow arms with `github.token`, GitHub attributes the merge to `github-actions[bot]` and **suppresses main-branch workflows** (supabase-migrations, ci, e2e, deploy-prod all silently skip; Vercel's native git webhook still deploys). Until `AUTOMERGE_PAT` is set as a repo secret, re-arm important PRs with your own `gh` (a user PAT) so `enabledBy` is your account and main workflows fire.

---

## Stack quick-reference

- **Repo:** https://github.com/iscasasola/setnayan-platform (public, AGPL-3.0)
- **Hosting:** Vercel — auto-deploys from `main` (`deploy-prod.yml` + Vercel's native git webhook)
- **Domain:** `setnayan.com` (+ `setnayan.ph`), Vercel-managed SSL
- **DB:** Supabase (Singapore region) — migrations via `supabase db push`; `migration-drift-monitor.yml` + a "migration timestamp guard" required check keep prod and disk in sync
- **Storage:** Cloudflare R2 — **FIVE** buckets in **Asia-Pacific (APAC)**: `setnayan-media`, `-thread-files`, `-vendor-contracts`, `-samples`, **`-vendor-verification`** (this one holds vendor government IDs). `R2_BUCKETS` in `apps/web/lib/r2.ts` is canonical.
  ⚠ **NOT "PH-region".** R2 has no Philippines region, and saying so implies a data residency we do not have — the same wording reached the live `/privacy` page once. Nothing is hosted in the Philippines: the database is Supabase **Singapore**.
- **Email:** Resend — domain `setnayan.com` verified, `noreply@setnayan.com` from-address (email-only; no SMS in V1)
- **Observability:** Sentry (errors) + PostHog (product analytics) + Better Stack (uptime/status) — iteration 0035
- **Native:** Tauri 2 desktop wrapper (`.dmg` + `.msi` via `build-desktop.yml`) + Capacitor/PWA mobile shells (`build-android.yml`); true-native iOS/Android Papic is Phase 2
- **Required CI checks** (branch protection, non-strict): typecheck+lint · production build · secret scan · migration timestamp guard · playwright e2e (chromium) · bundle size · lighthouse · six lint guards (nav icon source, bottom-nav template, entitlement gates, guest legibility, nested forms)

---

## Quick-jump anchor docs

- **`HANDOFF.md`** — cold-start handoff with the verification flow, all live routes, locked decisions
- **`OWNER_ACTIONS.md`** — step-by-step phased launch checklist + the current owner-action list
- **`CHANGELOG.md`** — every meaningful commit with `SPEC IMPACT` callout (generated from `changelog.d/` fragments)
- **`changelog.d/`** — per-PR changelog fragments (the conflict-free per-PR unit; see `changelog.d/README.md`)
- **`COWORK_INBOX.md`** — historical `[PENDING]` worklist of spec-corpus updates
- **`README.md`** — public-facing overview
- **In the spec corpus at `~/Documents/Claude/Projects/Setnayan/`:**
  - `AS_BUILT_GROUND_TRUTH_2026-06-07.md` — the source-of-truth doc (live site → code → prod DB → this doc → specs)
  - `CLAUDE.md` — status anchors auto-load on every session
  - `App_Build_Status.md` — spec-vs-code audit
  - `V1_Gap_Analysis_Status.md` — Tier 1/2/3 spec landing audit
  - `Installed_Stack_Inventory.md` — 10-pass audit of installed deps, migrations, env vars
  - `API_Integration_Checklist.md` — external service prereqs

---

## Sprint 0 history (closed 2026-05-13)

Sprint 0 was the platform foundation — Next.js 15 + Tauri 2 + Supabase + Cloudflare R2 + GitHub. All Sprint 0 acceptance criteria passed:

- Vercel project connected, env vars set, deploys clean
- Supabase Singapore region, base schema migration `20260512000000`, 5 RLS helpers, on_auth_user_created trigger
- R2: 5 buckets in the **Asia-Pacific (APAC)** region — `setnayan-media`, `-thread-files`, `-vendor-contracts`, `-samples`, `-vendor-verification` (the last holds vendor government IDs). ⚠ NOT the Philippines; R2 has no PH region. Confirmed in the Cloudflare dashboard 2026-08-01. This line was wrong twice over — wrong region AND wrong count.
- Auth: email/password + magic-link; owner email auto-flagged `is_internal=TRUE`
- Tauri 2 scaffold, GitHub Actions matrix building `.dmg` + `.msi` artifacts
- PWA manifest + service worker scaffolded (later replaced with the full caching foundation)

Verification probes that passed: `/health` 200, `/`, `/login`, `/manifest.json`, all icons, RLS denies anon, `generate_public_id` produces valid S89X- IDs.

Then the 19-iteration pre-launch sprint (closed 2026-05-13) shipped the couple/vendor/admin core surfaces; 2026-05-14 landed a 28-PR run; and everything since — family-life-OS, the Atelier-Glass rollout, the seat-plan program — is captured in `CHANGELOG.md` + git history.
