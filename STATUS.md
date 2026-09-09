# Setnayan — Project Status

> Living checkpoint. **Refreshed 2026-09-09.**
> Anchor doc — if you're opening this repo cold in a new Claude session, start here, then read
> the newest handoff named at the top of `CLAUDE.md`.
> **Snapshot, not a log.** Full per-PR detail lives in `CHANGELOG.md` + git history — this file is the current-state picture only.
>
> ⚠ **The previous refresh (2026-08-19) sat here for three weeks** while ~890 PRs merged to
> `main` underneath it. Nothing in it was individually false when re-checked, but the "What's
> next" section named a build list that had since shipped in full, and the dependabot count had
> drifted. **A snapshot's age is part of its content** — this one is dated for exactly that
> reason; re-measure before trusting any number below once it's no longer close to that date.

**Owner deadline anchor:** December 2026 wedding

---

## Verified production state — 2026-09-09

Measured against the live Supabase database (`setnayan-prod`), not remembered or carried forward
from the last refresh.

**7 active events · 47 guests · 13 accounts** (12 customer + 1 admin) · **2 vendor shops** (both
`verified` visibility) · **6 orders, ever** — 4 paid (₱2,499 · ₱2,899 · ₱147 · ₱49, all GCash
except the ₱49 BDO one) + 2 cancelled, unchanged since 2026-08-29 — · **0 vendor packages
authored** (the feature is shipped and on; nobody has built one yet — that's an empty table, not
a broken one) · **14 Papic photos** (one event) · **1 published Story** (of 7 `event_editorial`
rows) · **1 creator chapter** · **1 chat thread** (accepted).

🔑 **No vendor account is labelled `account_type = 'vendor'`** — both shops are owned by accounts
still labelled `customer`. This is not a bug: per `dashboard/layout.tsx`, vendor access is
derived from *owning a `vendor_profiles`/`vendor_team_members` row*, never from the label — the
two definitions disagreeing once took a real account down in an infinite redirect loop
(2026-08-10, fixed). Don't reason about "how many vendors" from the label column.

Production remains a thin dataset — **which is why defects here are found by reading code, not
by anyone complaining.** Treat every count above as a floor, not a ceiling: an empty or
near-empty table is the expected shape of this product today, not evidence a feature is broken.

🔑 **The highest-value action is still not on this list: somebody using the product end to end on
a phone.** That has not changed since 2026-08-19.

## Where we are right now

V1 web surface is **functionally complete** and live at `setnayan.com`. Since the last refresh
(2026-08-19), **~890 PRs merged to `main`** — roughly 137 of them touching
`supabase/migrations/`. The paragraphs below are a synthesis, not an enumeration; see
`CHANGELOG.md` + `changelog.d/` for the per-PR record.

**"A failure must never render as success" — the money-first sweep is COMPLETE.** The dominant
thread of this window was a defect class named explicitly in `CLAUDE.md`: a refused or silent
read rendering identically to an honest zero or an honest empty state (an upload that stalls
fires no error at all; a denied guest-list read returned `[]`, which read as "no guests yet" to a
couple with 180 names; a Budget tile could read "₱0 committed" against a real target). The
11-item, money-first build list this produced is marked **COMPLETE** (#4583 → #4594, re-verified
2026-08-31), and the pattern it left behind — bind every `data` destructure's error, gate a
stated absence on a measured flag plus a "couldn't load" line, never render a refused read as a
zero — is now enforced by reusable guard tests
(`apps/web/lib/guests-read-is-honest.test.ts`, `apps/web/lib/money-that-was-never-measured.test.ts`,
`apps/web/app/vendor-dashboard/reads-are-honest.test.ts`) and was still being reapplied to new
surfaces (chat/Deal-locking money paths) as recently as 2026-09-08/09.

**Story & Story Maker — designed 2026-09-07, built out across the window.** Chapters are now
celebrations numbered by when they happened, with a three-way visibility control ("only me /
your people / everyone") added 2026-08-22 as a genuine privacy fix — "only me" did not exist
before that. A derived kinship/family-tree screen reached a UI for the first time on 2026-08-31
after sitting unconsumed since July. Full build docs live on a branch of the specs repo, not
`main`.

**Gifts / Papic-credits program — G3 through G6 landed.** G3 (Papic portfolio + buy-pack + private
album, PR #5267) merged; G5 added event-date-scoped promo windows; G6 gave admin a single
consolidated `/admin/gifts` page listing every live comp, plus two follow-on fixes so a departing
or erased admin can no longer take the money record of a comp they issued down with them.

**Encoder S-series (replanned E0–E9 → S0–S13) — actively landing, not finished.** Desktop-app
(`build-desktop.yml`) work: program-output compositing on an OffscreenCanvas worker, H.264 encode
with an audio-clock drift guard, reconnect-and-survive-a-dropped-connection, stream-key handling
in a zeroizing Rust sink. **End-to-end rehearsal has not started** — it needs a device separate
from the coding machine, and the owner has exactly one phone / one iPad / one MacBook to test
with, which is a real scheduling constraint, not an engineering one.

**Vendor economy — a booth-branding SKU, and the chat→budget path keeps getting re-hardened.** A
"brand your booth at ONE wedding" SKU (₱500/event vs. ₱3,000/4-week cycle, paid-tier-only)
shipped 2026-09-05. The Deal-lock → budget path had another silent-failure instance closed
2026-09-08/09: a locked-and-renegotiated Deal on an already-booked vendor could update the
conversation without updating `event_vendors.total_cost_php`, so the budget and payment screens
disagreed with nothing logged anywhere.

**Chat — the shipped "message this supplier" resolver is now used everywhere it should be
(2026-09-09, #5344 + #5358).** Five separate controls across the budget card, a locked package,
the vendor workspace, the shortlist, and the supplier's public profile / search card all used to
land the couple on the conversation **list** instead of the specific thread — one of them with
the thread id already resolved a few lines above. All five now resolve or open the thread through
one canonical path (`startServiceInquiry`, deduped on `chat_threads`
UNIQUE(event_id, vendor_profile_id)). A ~100-line recovery panel this obsoleted (callerless since
2026-09-08) was deleted alongside it.

**Seat-plan / 3D avatars — incremental polish only.** Small fixes landed (a published 3D plan
couldn't be un-published; a swipe-deleted guest didn't consistently release their seat; avatar
rigs got face/hand fixes). The **rigid-group linking rebuild**, multi-walker collision avoidance,
RSVP→seat auto-rules, the Sentry v9→v10 bump, and the R6 radius-token sweep are all still
unverified 2026-07-16 follow-ups — nothing found this refresh confirms any of them shipped; see
the collapsed list below.

### Corrections surfaced this window (worth knowing, not just the shipped work)

- "0 orders, ever" → corrected to 6 (4 paid), first caught 2026-08-30, **still 6 today** — no new
  order since 2026-08-29.
- Marketplace **Packages** were reported to the owner as "switched off" (quoting the code
  default) when production actually had them on. The owner caught it. **A flag's default in code
  is not its value in prod** — open the page.
- The **"charm pricing, -1 endings" rule is not a rule** — the owner rounded three SKUs to whole
  pesos 2026-08-27. Some SKUs still end in -1; there is no convention either way. Read
  `platform_retail_catalog_v2`, never a code comment, for a real price.
- The repo does **not** own `setnayan.ph` — unregistered, open to anyone, buying it is an open
  owner call.
- 🔎 **New this refresh:** `CLAUDE.md`'s locked-decisions table states "Brand strings centralized
  in `brand.config.ts`" — **that file does not exist in the repo.** Brand strings (`setnayan.com`,
  "SETNAYAN") are scattered across `lib/`. Not fixed here — flagging it so nobody goes looking
  for a file that isn't there.
- A 2026-09-02 migration applied **directly to prod, outside the pipeline**, stranded seven
  merged PRs for 3+ hours. `deploy-drift-monitor.yml` now catches this class going forward — see
  `CLAUDE.md`'s "NEVER APPLY A MIGRATION DIRECTLY" section before ever running one by hand.
- **Dependabot: 10 open alerts today** (3 high · 6 moderate · 1 low), re-measured via
  `gh api repos/iscasasola/setnayan-platform/dependabot/alerts`. The 2026-08-19 refresh said
  "14 → 4" — that 4 has grown back to 10 since; needs another triage pass.

<details><summary>The unverified 2026-07-16 seat-plan follow-ups (still unverified)</summary>

- **Rigid-group linking rebuild** — connective snap positioning shipped, but the Keynote-style "linked tables move/rotate as one rigid unit" was deferred; rebuild it on top of the oracle/weld model.
- **Seat-plan polish list** — collision-avoidance for many simultaneous 3D walkers, free-board fit-framing for spread layouts, RSVP→seat auto-rules in the canonical engine.
- **Sentry 9 → 10 migration** — bump the SDK off v9.
- **R6 radius-token rename sweep** — route the last ad-hoc corner radii through the `--m-r-*` scale.

</details>

### What's next (2026-09-09)

The money-first / "false success" sweep that occupied the 2026-08-19 refresh's "What's next" is
**done** — see above. The current register of what's left is `WHAT_IS_LEFT.md` at the repo root
(carried in because the spec-corpus repo and `~/.claude/.../memory/` don't travel with an account
change): **87 claims checked against shipped code and the live DB, 58 survived, 15 need the
owner, not engineering.** Read that file's own freshness date before trusting it as current —
same rule this file just stated about itself.

**Then the launch checklist** — the owner rulings and sign-offs in the corpus
`WHAT_IS_LEFT_2026-08-17.md` §6 remain the gate no amount of engineering moves on its own.

### Owner-side actions

Flag-gated features await owner env-flip / provisioning, not code. The canonical, always-current
list is **`OWNER_ACTIONS.md`**. ⚠ **PayMongo is still not one of them** — PR #3146 is
**CLOSED, unmerged** (re-confirmed via `gh pr view 3146` today); there is no payment gateway
sitting one flip away. Auto-merge is armed automatically on every non-draft PR (see the workflow
note under Locked decisions).

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
- **Domain:** `setnayan.com`. **We do not own `setnayan.ph`** — it is unregistered; buying it is an open owner call, not a fact to assume, Vercel-managed SSL.
- **DB:** Supabase (Singapore region, project `setnayan-prod`) — migrations via `supabase db push --include-all` (the pipeline only; never apply one directly, see `CLAUDE.md`); `deploy-drift-monitor.yml` + a "migration timestamp guard" required check keep prod and disk in sync. **1,376 migration files** on disk as of this refresh.
- **Storage:** Cloudflare R2 — **FIVE** buckets in **Asia-Pacific (APAC)**: `setnayan-media`, `-thread-files`, `-vendor-contracts`, `-samples`, **`-vendor-verification`** (this one holds vendor government IDs). `R2_BUCKETS` in `apps/web/lib/r2.ts` is canonical.
  ⚠ **NOT "PH-region".** R2 has no Philippines region, and saying so implies a data residency we do not have. Nothing is hosted in the Philippines: the database is Supabase **Singapore**. Cloudflare is storage only — `setnayan.com` is not a Cloudflare zone and no traffic is proxied through it.
- **Email:** Resend — domain `setnayan.com` verified, `noreply@setnayan.com` from-address (email-only; no SMS in V1)
- **Observability:** Sentry (errors) + PostHog (product analytics) + Better Stack (uptime/status) — iteration 0035
- **Native:** Tauri 2 desktop wrapper (`.dmg` + `.msi` via `build-desktop.yml`) + Capacitor/PWA mobile shells (`build-android.yml`); true-native iOS/Android Papic is Phase 2
- **Required CI checks** (branch protection, non-strict — confirmed via `gh api repos/.../branches/main/protection` today): typecheck+lint · production build · secret scan · migration timestamp guard · playwright e2e (chromium) · bundle size check · lighthouse · six lint guards (nav icon source, bottom-nav template, entitlement gates, guest legibility, nested forms, exposure baseline)

---

## Quick-jump anchor docs

- **`HANDOFF.md`** — cold-start handoff with the verification flow, all live routes, locked decisions
- **`WHAT_IS_LEFT.md`** — the current verified register of what remains, 58 engineering items + 15 owner-only items
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

Then the 19-iteration pre-launch sprint (closed 2026-05-13) shipped the couple/vendor/admin core surfaces; 2026-05-14 landed a 28-PR run; and everything since — family-life-OS, the Atelier-Glass rollout, the seat-plan program, the Story/Gifts/Encoder work of 2026-08/09 — is captured in `CHANGELOG.md` + git history.
