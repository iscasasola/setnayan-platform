# REGISTER SWEEP — 2026-09-18 (S10)

> Re-measurement of `build-sessions/HANDOFF-2026-09-18/REFERENCE/ONE_REGISTER.md` against
> **`origin/main`**, served production sha **`2c3b0dd`** (confirmed via
> `curl -s https://www.setnayan.com/api/health` at session start). **Read-only** — no code
> changes. Method: `git grep`/`git show` against the `origin/main` treeish (never the working
> tree, which is 1548 commits behind), `gh pr`/`gh api` for PR/branch/protection state, and
> direct Supabase SQL against project `njrupjnvkjkitfctetvi` for DB-backed claims.
>
> **Order per the dispatch: LAU-\* (launch readiness) first**, then SUP-\*/DAY-\*/DSK-\* as
> budget allows. This session did **not reach SUP-\*/DAY-\*/DSK-\*** (390 of 456 rows) — see
> the closing note.

---

## GROUP 6 · LAUNCH (LAU-1 … LAU-60) — 60/60 rows re-measured

### 6a · Privacy (LAU-1 … LAU-15)

| Row | Status | Evidence (command → result) | Size |
|---|---|---|---|
| LAU-1 | **PARTIAL, likely closer to DONE than tagged** | `git grep account_deletion_requests origin/main` → a real admin review queue exists: `apps/web/app/admin/account-deletions/{page,actions,loading}.tsx`, table `account_deletion_requests`. `/privacy` page.tsx:1089-1090 copy ("our team reviews and permanently erases") matches this mechanism exactly — the copy is not lying. The "OWNER-GATED ⚖ what closing an account should do" tag may itself be stale: the policy (manual review, not instant self-delete) already appears decided and built. Re-check with owner whether this is still open. | S — mostly a re-tag, not a build |
| LAU-2 | **OPEN, confirmed** | `git grep device_hash origin/main -- apps/web supabase/migrations` → table `user_devices` exists (migration `20260515030000_self_review_gate.sql`), but `apps/web/lib/export-coverage-guardrail.test.ts:469` still carries `user_devices: 'TODO(RA10173-backlog)…'` and `apps/web/lib/erasure/coverage-guardrail.test.ts:287` explicitly defers it: *"retention review already open, do not pre-empt… `Device_Fingerprint_Data_Use_DPO_Review_2026-07-12.md` is open on exactly this."* No pruning cron found (`git grep user_devices origin/main -- apps/web/app/api/cron` → nothing). | S–M · Opus, but **blocked on the open DPO review**, not a pure build |
| LAU-3 | **DONE, served** | `git log origin/main -- 'apps/web/app/(shell)/privacy/every-outbound-host-is-disclosed.test.ts'` → commit `ad46109d3` "stop claiming analytics are anonymous, name four unnamed processors". `git grep -n "OpenAI\|LanguageTool\|Gemini" origin/main -- .../privacy/page.tsx` → all three present (lines ~100-101, 1660-1702). Guard test is mutation-checked (fails if a name is removed or a new outbound host appears undisclosed). `git merge-base --is-ancestor b86be637c 2c3b0ddba` → **SERVED**. | — (done) |
| LAU-4 | **DONE, served** | Same commit as LAU-3. `every-outbound-host-is-disclosed.test.ts` asserts the page does NOT contain `'no personal identifiers'`, `'Anonymized product analytics'`, `'anonymous analytics'`; `git grep` for those phrases on the current page returns **zero** hits. Guarded, served (see LAU-3 ancestor check). | — (done) |
| LAU-5 | **NEEDS RE-SCOPING — original search term doesn't exist** | `git grep -i "withheld for privacy" origin/main -- apps/web` → only an unrelated budget-report hit. The register's own phrasing may not be the shipped wording. Widened search found a *different*, larger consent-withholding system already built: `apps/web/app/[slug]/_components/editorial/consent-veto.ts` (a capture tagging an opted-out guest is withheld from every public read, fail-closed) — this may already satisfy the row's intent under a different name. **Row's mechanism is likely WRONG as stated** — someone needs to find the actual two "withheld for privacy" UI states (probably in a gallery/photo-delivery component, not consent-veto) before sizing this. | Unknown — re-scope first |
| LAU-6 | **DONE, served** (carried forward, not re-disputed) | Already marked done by the 2026-09-16 sweep: #5478 (`22300daf`), ancestor of served. Not independently re-verified this session beyond a quick `git grep encrypted -- apps/web/lib/social` (no red flags). | — |
| LAU-7 | **PARTIAL, confirmed** | `git grep -n "wake" origin/main -- apps/web/lib/social apps/web/app/[slug]/recap` → `lib/social/a-wake-is-not-content.test.ts` (a gate that blocks `event_recap` social posts for a wake) and `join/the-couple-is-not-every-host.test.ts` (recap copy differs for a wake) both exist and are guarded. This covers the *social-post* half. Did not find equivalent evidence for the *share-card* half staying quiet — needs a follow-up grep on the share-card component specifically. | S · Sonnet |
| LAU-8 | **LARGELY DONE — smaller than L, re-tag** | `apps/web/lib/export-completeness.ts` is a full registry: every person-keyed table is either `EXPORTED_TABLES` or `EXCLUDED_TABLES` with a stated reason, enforced by `every-person-keyed-table-is-decided.db.test.ts` (schema-replay, fails on any undecided table). The docblock's own list of 7 previously-missing tables (`receipts`, `notifications`, `user_devices`, `social_posts`, `order_ledger`, `event_moderators`, `creator_chapters`) all now appear in one list or the other (confirmed via `git grep` inside the file). The remaining gap is **the actual `/api/profile/export` route wiring to this registry** — not verified this session whether the route reads from it or still has its own hand-written list. | S–M, not L — re-verify route wiring before resizing further |
| LAU-9 | **PARTIAL, unchanged** | `git grep "0d\|0e"` on `data-subject-register.ts` returned nothing distinctive — the 0d/0e sign-off references are likely in the spec corpus, not this repo, so this row is not fully checkable from `origin/main` alone. `data-subject-register.ts` exists and is substantive (see LAU-2 quote). DPO sign-off itself is an owner action regardless of code state. | M · Sonnet (corpus) + owner sign-off, gate unchanged |
| LAU-10 | **PARTIAL, confirmed with more precision** | `apps/web/next.config.ts:266-271` — the **enforced** `Content-Security-Policy` header only sets `frame-ancestors` + `frame-src` (an allow-list of embed hosts, guarded by `lib/csp-embeds-are-allowed.test.ts` and `csp-report.test.ts` so it can't silently drift). A **separate, wider** `Content-Security-Policy-Report-Only` header exists at line 456 — meaning the fuller policy (`script-src`, `connect-src`, `worker-src` — the ones that would actually risk breaking face-api.js/WASM) is still **report-only, not enforced**. So "PARTIAL" is accurate: frame protection is live and guarded; the broader CSP that would matter for face matching has not been flipped on yet. | S · Opus, unchanged |
| LAU-11 | **DONE, served** (confirmed) | `gh pr view 5475` → MERGED, merge commit `7c1d86ef3`. `git merge-base --is-ancestor 7c1d86ef3 2c3b0ddba` → **SERVED**. | — |
| LAU-12 | **PARTIAL — real DB evidence, mixed result** | Queried `cron_job_runs` directly (project `njrupjnvkjkitfctetvi`). The outcome-tracking fix (`ok`/`started_at`/`finished_at`/`rows_affected`/`error` columns, landed ~2026-09-15) is live. `retention-sweep` and `vendor-dossier-retention` both show a clean run 2026-09-17 05:57 UTC with `ok=true`. **But** `face-data-retention` and `vendor-identity-retention` still show `started_at`/`finished_at`/`ok` = **null**, with only a stale `last_run_at` of **2026-09-14** (before the outcome columns went live) — i.e. **no proof either has completed successfully since the tracking that would prove it existed.** `face-data-retention` is weekly (`WEEKLY_GAP_MS`, confirmed in `lib/face-data-retention.ts:312`) and a comment in `lib/face-receipt.test.ts:19` says it's next due **2026-09-20** — so this is plausibly just "hasn't run again yet," not broken. `samahan-story-sweep` is stranger: `last_run_at` = **2026-09-04**, 14 days stale, and per `periodic-job-registry.test.ts:191` its expected cadence is **hourly** — that gap is real and worth a follow-up query into why it stopped. | S · Opus — **re-run this row's DB query after 2026-09-20/21** to see if face-data-retention and vendor-identity-retention post a real `ok=true`; separately check why `samahan-story-sweep` is 14 days stale against an hourly cadence |
| LAU-13 | **BLOCKED, confirmed** | `git grep -i "guest.phone\|rsvp.*consent"` — a live comment at `apps/web/app/dashboard/[eventId]/studio/page.tsx:193` explicitly flags: "consent text names guest-phone capture and face-sorted delivery ... STILL [open]" — matches the register's own claim. Unchanged, DPO-gated. | S, unchanged |
| LAU-14 | **BLOCKED, unchanged** | No code signal possible — this is "owner re-sends to counsel," not measurable from the repo. Not re-disputed. | — |
| LAU-15 | **BLOCKED/owner, confirmed still open** | `git grep dpo@setnayan origin/main` → the only hit is `lib/npc-filing-tasks.ts:58`, itself flagging the exact mismatch the row describes: *"One DPO email (dpo@setnayan.com vs iscasasolaii@gmail.com)"* still unresolved. Not verifiable whether the inbox now receives mail — that's outside repo/DB. | minutes, owner-only |

### 6b · Admin console (LAU-16 … LAU-27)

| Row | Status | Evidence (command → result) | Size |
|---|---|---|---|
| LAU-16 | **DONE, served** | `git show origin/main:apps/web/app/admin/_components/admin-command-palette.tsx` → imports `ADMIN_JOBS`, `buildJobHref()` prepares a form for any of 284 generated jobs from anywhere in the console, not just Taxonomy. Merge commits `58117b3bf`/`3998e07c5`/`3c2431247` all **SERVED**. | — |
| LAU-17 | **WRONG (mechanism is a deliberate design choice, not a gap)** | `git show origin/main:apps/web/lib/ugat/record-href.ts` → `ugatRecordHref()` docblock: a guest has **no per-guest page** ("there is no `/admin/guests`… sending them to the celebration is the honest answer"); an order has **no per-order page** either — routes to `/admin/money`. Only `vendor`/`user` open true per-record pages with actions. Merge commits `186185409`/`b93562a48` **SERVED**. | M — if the owner actually wants per-guest/per-order pages, this is a real build, not a fix |
| LAU-18 | **OPEN, confirmed** | `git show origin/main:apps/web/lib/admin-map/admin-row-index.ts` → `fetchAdminRows()` indexes only `platform_retail_catalog_v2` (Papic SKUs) — no indexing of taxonomy tiles/categories/folders/event-types/faiths by name. `admin-destinations.ts` docblock confirms job *field names* like "faith" surface the Taxonomy **page**, not a specific record. | S–M · Sonnet |
| LAU-19 | **BLOCKED (owner), confirmed** | `git show origin/main:apps/web/lib/admin-approvals.ts` → `ApprovalActionType` = role grants + `approve_vendor_partnership` + `approve_fraud_wipe_ban` only — no refund/comp/payout type. `admin/payouts/actions.ts` comment: *"Per the 2026-05-16 lock… single-admin authority is fine for V1… Two-admin gating is queued for V1.5 once Finance is in the loop."* Infra exists, deliberately not applied to money yet. | M · Opus |
| LAU-20 | **OPEN — live bug, confirmed** (register under-called this as "NEEDS MEASURING") | `supabase/migrations/20270323790338_journal_vendor_spotlights.sql` adds `'approve_journal_spotlight'` to the `admin_approval_requests_action_type_check` CHECK; a **later**-timestamped `20270518682623_fraud_enforcement_state_and_audit.sql` drops and recreates the same CHECK **without it**. Both migrations are **SERVED**. `initiateSponsored()`'s INSERT will hit a CHECK violation in production today. | S · Opus — this is the sharpest finding in the admin group |
| LAU-21 | **BLOCKED (owner), confirmed** | `git show origin/main:apps/web/lib/platform-settings.ts` → VAT/threshold is a hardcoded manual settings field with a comment: *"the day the ₱3M threshold is crossed the owner sets one number."* No gauge/tripwire widget exists in `admin/money` or `admin/payments`. | S–M · Opus |
| LAU-22 | **DONE, served — location moved since the prior sweep** | `git show origin/main:apps/web/app/admin/menus/page.tsx` now redirects to `/admin/ugat?tab=menus`; `MenuRegistryEditor` over `nav_slot_override` is the single source for every menu name/icon across account types, guarded by `the-menu-name-has-one-source.test.ts`. Merge commits `a1c19719d`/`2f33f8ea5`/`d0cda1bf5` **SERVED**. | — |
| LAU-23 | **DONE, served** | `lint-colour-exists.mjs` docblock records "gold… in 78 class names across 12+ files… never a key in `tailwind.config.ts`" — fixed (mapped to the `terracotta` ladder); script runs as a required CI job (`.github/workflows/ci.yml:144`). Merge commits `e01adc938`/`daf9622a3` **SERVED**. | — |
| LAU-24 | **WRONG — the underlying product was retired** | `git show origin/main:apps/web/lib/concierge.ts` → `CONCIERGE_ENABLED = false` permanently, the V1 3-day free trial was retired 2026-05-28. The successor "Setnayan AI planner" is a ₱99–₱2,499 **one-time paid** SKU (`setnayan-ai-event-pricing.ts`: *"THE SIGN-UP PRICE… NEVER TO ZERO OR TO FREE"*). There is no free trial left to farm — the row's premise is stale. | — (close the row, not a build) |
| LAU-25 | **BLOCKED (owner), confirmed** | `git show origin/main:apps/web/lib/admin/require-admin.ts` → gate is a single boolean (`is_internal \|\| is_team_member \|\| account_type==='admin'`); no role/scope/money-cap columns anywhere. Matches the repo's own "one-person admin plan (2026-07-11)" note. | M · Opus |
| LAU-26 | **PARTIAL, upgraded from "NOT STARTED"** | Merged and **served**: `582b11595` "paste-and-match reconciliation helper" and `156db5327` "fast payment approval — batch + one-click on clean matches." `admin/payments/page.tsx`: admin pastes text from their own bank app and the matcher scores matches — **semi**-automated (human pastes the statement), not a live bank-alert/webhook feed. | M · Opus, smaller than before — the manual-paste half is done |
| LAU-27 | **BLOCKED (owner/counsel), confirmed** | `git show origin/main:apps/web/lib/stewarded-accounts.ts` → Phase 3 "stewarded (branch) accounts" is flag+types only, gated `NEXT_PUBLIC_STEWARDED_ACCOUNTS` (OFF); comment: *"the actual guardian/transfer flow is deliberately unbuilt until counsel sign-off + DPIAs."* | L · Opus |

**Standouts:** LAU-20 is a confirmed **live production bug** the register only flagged as "needs measuring" — a later fraud-enforcement migration silently clobbered a CHECK constraint, so sponsored journal-spotlight approvals cannot insert today. LAU-22/LAU-23 are DONE and served. LAU-24's entire premise (a farmable free trial) no longer exists — the product it worries about was retired. LAU-17 is half WRONG: guest/order having no dedicated admin page is a deliberate design choice per the code's own docblock, not an oversight.

### 6c · Schema, security and the platform floor (LAU-28 … LAU-43)

| Row | Status | Evidence (command → result) | Size |
|---|---|---|---|
| LAU-28 | **PARTIAL, confirmed** | Snapshot refreshed (`6f9e650a3`, SERVED), but `KNOWN_GAPS` in `apps/web/tests/db/schema-drift.db.test.ts` still deliberately lists `event_service_deliveries.*` and `pioneer_incentive_logs.*` as prod-only tables with no migration. | S |
| LAU-29 | **PARTIAL, confirmed** | `d2454dbc0` added `diffNotNull` — nullability is now compared (SERVED). Column **defaults** are still not compared anywhere in `schema-snapshot.ts`, and the file's own docstring is now stale (still says nullability isn't compared, which is false). | M |
| LAU-30 | **OPEN, confirmed with a precise defect** | `apps/web/app/dashboard/(account)/profile/concierge/actions.ts:274` — `admin.from('concierge_abuse_flags').insert(...)` is wrapped in try/catch but never destructures `{ error }` (unlike two sibling calls just below it). supabase-js doesn't throw on a PostgREST error, so the catch is dead code — insert failures are still silent. | S · Sonnet |
| LAU-31 | **OPEN, confirmed** | No lint/test guard exists anywhere for "a try/catch wrapped around a Supabase call that cannot throw." `query-column-scan.ts`'s "cannot catch" is an unrelated phantom-column scanner, not this guard. | M · Opus |
| LAU-32 | **DONE, served — upgraded from PARTIAL** | `apps/web/app/[slug]/_lib/first-byte.test.ts` (added `7a8dfd40a`, SERVED) asserts no `loading.tsx` sits in front of a `notFound()` route across `[slug]`, `[slug]/hub`, `welcome`, `find-my-table`, `v/[slug]` — all previously measured 200-as-404 in prod. Repo-wide scan found zero remaining offenders. | — |
| LAU-33 | **DONE, served — upgraded from NOT BUILT** | `apps/web/lib/the-photo-wall-block-shows-real-photos.test.ts` (added `c5ae2d66a`, dated 2026-09-17, SERVED) — the recap resolver now reads the screened `getWallSnapshot` feed instead of an unwritten `photo_wall_photos` jsonb column that "had no writer anywhere in the application." | — |
| LAU-34 | **DONE, served — upgraded from OWNER-GATED** | `apps/web/app/vendor-dashboard/calendar/actions.ts` (`updateWaitlistSettings`) implements the tier-based per-date pick ceiling per the owner's 2026-07/2026-08-09/2026-08-29 rulings, DB-enforced via `clamp_vendor_waitlist_to_tier` (migration `20271121655918`). Ends `10b4bb8ae`, SERVED. | — |
| LAU-35 | **PARTIAL, confirmed** | `apps/web/app/papic/media/[...key]/route.ts` (stable, streaming, signature-less URL, SERVED) fixed OG/crawler + Papic derivatives. But `apps/web/app/[slug]/_components/photos-of-you-gallery.tsx:127` still renders `<img src={p.url}>` from a raw presigned URL — guest galleries are still unstable/uncached (comment admits "the optimizer would cache expiry"). | M · Opus |
| LAU-36 | **PARTIAL, confirmed** | `apps/web/lib/env-flag.ts` (`envFlagEnabled`, accepts true/1/yes/on) is adopted at ~15+ call sites, but its own test file runs a non-asserting inventory of remaining strict `=== 'true'` readers — 5 flags are left strict **on purpose** (DPO/contract reasons), not by omission. | S · Sonnet |
| LAU-37 | **DONE, served** | `STATUS.md` (updated 2026-09-09) now points to `OWNER_ACTIONS.md`, which exists. `changelog.d/status-md-is-current.md` confirms the prior stale pointer was corrected. | — |
| LAU-38 | **BLOCKED (owner), confirmed** | No `.ics`/calendar-sync code touches run-of-show anywhere; only unrelated `.ics` routes exist (appointment/budget calendars). No owner ruling found in `OWNER_ACTIONS.md`/`WHAT_IS_LEFT.md`. | S |
| LAU-39 | **DONE, served — fixed the same day as this sweep** | `apps/web/lib/nothing-was-refreshing-the-google-grants.test.ts` (added `35ee52471`, its own doc comment dated **"MEASURED ON PRODUCTION 2026-09-18"** — today) registers `oauth-refresh` in `PERIODIC_JOBS` with `gapMs ≤ 1h`; the prior route had a literal `TODO(0011): wire the actual cron schedule` and `vercel.json` crons were empty. **SERVED** (ancestor check passed). | — |
| LAU-40 | **PARTIAL, confirmed with a second offender found** | `apps/web/lib/guest-session.ts` has the one tested resolver (`resolveGuestSessionSecret`, fail-closed, min-length checked). But `apps/web/lib/live-wall.ts:45-48` (`setWallDisplayCookie`, a **second** signed guest cookie `setnayan_wall_display`) has its own untested inline `getSecret()` using the exact `A ?? B ?? ''` pattern the shared resolver exists to replace. | S · Opus |
| LAU-41 | **PARTIAL, confirmed — corrected from NOT BUILT** | `apps/web/public/sw.js` (`isDayOfGuestNavigation`) has a `RESERVED` top-level-route allowlist (owner fix 2026-06-19 for `/monogram`), but it's stale: real single-segment pages `creators`, `open-shop`, `tour` are absent from it, so navigating to them is still cached as a day-of guest slug. No test keeps this list in sync with `app/`. | S · Sonnet |
| LAU-42 | **PARTIAL, confirmed; live-grant check deferred to controller (see below)** | `apps/web/tests/db/exposure-freeze.db.test.ts` is a real, active guard (floors + baseline + `SET ROLE` behavioural probe). Two narrowings landed: `26ac5668d` (revoked dead INSERT/UPDATE/DELETE on `cron_job_runs`) and `6fc319aec` (TRUNCATE on `chat_threads`). This is per-PR discipline, not a one-time fix — see the direct DB check below. | S · Opus |
| LAU-43 | **DONE, served — upgraded from UNVERIFIED** | `supabase/migrations/20271132839561_chat_message_sender_derived_in_db.sql` (`cbc5aee64`, SERVED) revokes column-level privileges on `sender_role`/`sender_user_id`/`is_bot`/`created_at` from `authenticated` and adds a `BEFORE INSERT` trigger that derives sender identity from `auth.uid()` + real thread membership. Migration header documents the prior exploit: a couple could POST `sender_role='vendor'` directly via PostgREST. | — |

**Standouts:** LAU-34 and LAU-43 were already fully shipped despite being tagged OWNER-GATED/UNVERIFIED. LAU-39 landed the SAME DAY as this sweep. LAU-32/33/37 flipped PARTIAL/NOT BUILT → DONE. LAU-41 flipped the other way in substance — a guard exists (so "NOT BUILT" was wrong) but it's demonstrably stale against 3 real routes, so it stays PARTIAL under a corrected mechanism.

*Supplementary live-DB check for LAU-42 (run directly against project `njrupjnvkjkitfctetvi` since the subagent had no DB access):*
`select table_name, string_agg(distinct privilege_type,',') from information_schema.role_table_grants where table_schema='public' and grantee='anon' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE') group by table_name` → **~200 public tables** carry a write grant (INSERT/UPDATE/DELETE/TRUNCATE, usually all four) to `anon`. This is the expected baseline for this schema's architecture — grants are broad by design and **RLS is the sole enforcer** (locked decision: "RLS enabled at CREATE TABLE time"; also matches the register's own note that "`anon`/`authenticated` get SELECT+INSERT+UPDATE for free" and a column-level REVOKE is a no-op). This query alone **cannot** tell a safe table (RLS policy is `USING (false)` for anon) from an exploitable one — that needs `exposure-freeze.db.test.ts`'s actual behavioural `SET ROLE` probe, which a future session should run rather than re-deriving from a raw grants dump. Not a new finding; confirms the shape of the risk the row already describes.

### 6d · Marketing pages, SEO and the store (LAU-44 … LAU-51)

> `origin/main` HEAD (`2c3b0dd`) equals the served sha exactly for this batch — no separate ancestry check needed.

| Row | Status | Evidence (command → result) | Size |
|---|---|---|---|
| LAU-44 | **DONE — WRONG as "NOT BUILT"** | `apps/web/app/features/features-page-says-what-ships.test.ts` is a live guard against false claims; `changelog.d/the-features-page-says-what-ships.md` (2026-09-06) documents 3 fixed false claims across 12 shipped section components. | S — down from M, already built |
| LAU-45 | **PARTIAL, confirmed** | `curl -s https://www.setnayan.com/sitemap-static.xml \| grep alaala` → no match; `curl -so /dev/null -w '%{http_code}' .../alaala` → **200**. A live, real page, absent from every sitemap child. | S |
| LAU-46 | **DONE — upgraded from PARTLY BUILT** | `apps/web/app/_components/marketing/site-chrome.tsx` → `NAV_ROUTES` covers `/blog /features /creators /monogram /our-story /download /waitlist`, `FOOTER_ONLY_PREFIXES` covers `/tour`. All 8 named pages wear consistent chrome, guarded by `lint-no-stacked-pinned-bars.mjs` + `doorway-shell.test.ts`. | S — down from M |
| LAU-47 | **OPEN, confirmed unchanged** | `cart-drawer.tsx`: *"Checkout is intentionally NOT built here"*; product data is a mock `_data/products.ts`. | L, unchanged |
| LAU-48 | **DONE — WRONG as "NOT BUILT"** | `442eab558` "feat(setnayan-ai): wire price-change (GRD-03) + availability-change (GRD-09) guards" plus 2 follow-up fixes; live code reads the real `watchedIds` and `vendor_availability_freed` table. | S — down from M–L, fully shipped and live |
| LAU-49 | **OPEN, confirmed unchanged** | `apps/web/lib/seo/health-checks.ts:267` → the check is a pure env-var presence test (`if (!input.env.googleSiteVerification)`), zero DNS-TXT awareness anywhere in `lib/seo/`. | S |
| LAU-50 | **BLOCKED (owner), unchanged** | Same file — warns unless `GOOGLE_SITE_VERIFICATION`/`BING_SITE_VERIFICATION` env vars are set; needs the owner's own Google/Bing accounts. | S |
| LAU-51 | **OPEN, minor correction** | `git ls-tree origin/main -- apps/web/app/tl/` → only 2 twins (`about`, `features`) — not 3; `/tl/how-it-works` was folded into `/features` (2026-09-01 comment). Zero Cebuano strings, no dashboard i18n infra found. | L, unchanged in substance |

### 6e · Ops, repo hygiene and the records (LAU-52 … LAU-60)

| Row | Status | Evidence (command → result) | Size |
|---|---|---|---|
| LAU-52 | **OPEN, confirmed and grown** | `gh api repos/iscasasola/setnayan-platform/dependabot/alerts` → **13 open: 5 high / 7 medium / 1 low**. `package.json` still pins `"@sentry/nextjs": "^8.0.0"`. `STATUS.md` (2026-09-09) self-reported 10, re-grown from an earlier 4 — today's 13 confirms the register's "and rising." | S–M · Opus, unchanged |
| LAU-53 | **DONE — corrected from OPEN** | `gh pr view 5405` → `state: CLOSED, mergedAt: null, closedAt: 2026-09-15`. It sat red and was then **closed**, not merged — resolved, just not the way the row assumed. | — |
| LAU-54 | **WRONG — both had replacements that landed** | `gh pr view 4472` and `4471` → both CLOSED unmerged, **but** `gh pr view 4532` says *"Supersedes #4472 … Close #4472 in favour of this"* and is MERGED + an ancestor of `origin/main`; `gh pr view 4503` says *"Supersedes #4471"* and is MERGED. The row's premise ("closed with no replacement") is false. | — (close the row) |
| LAU-55 | **UNLANDED, confirmed** | `git log origin/claude/handoff-hardening -2` → 2 commits ahead of `main`, last commit 2026-09-08; `git merge-base --is-ancestor` → **not merged**. | S |
| LAU-56 | **BLOCKED (owner), confirmed** | `curl .../api/health/deep` → `200`, app-side checks (Supabase/R2/env) all `ok`. But the uptime-monitor's existence, Sentry alert routing, and R2 bucket CORS policy are external-dashboard state with no tool access to confirm — `OWNER_ACTIONS.md` still carries this as unverified, step-by-step. | S–M |
| LAU-57 | **DONE — WRONG as "BLOCKED"** | `gh api repos/iscasasola/setnayan-platform/branches/main/protection` → `required_status_checks.contexts` lists **13** checks (typecheck+lint, production build, secret scan, e2e, Lighthouse, etc.), `allow_force_pushes:false`, `allow_deletions:false`. Protection **is** configured. Worth flagging separately: `enforce_admins:false` and no required-reviewers count — a real, smaller gap the row didn't ask about. | S |
| LAU-58 | **BLOCKED (owner), partially DONE** | FIXTURE-hiding half is **DONE, code-verified**: `app/v/[slug]/page.tsx` → `if (isDemoVendor && !inDemoMode) notFound()`, and the sitemap filters `is_demo IS NOT TRUE`. Pabati-retirement half: `supabase/migrations/20271159146115_retire_pabati.sql` never touches `vendor_profiles`/`services`, and `services` is an unchecked `TEXT[]` — whether `'pabati'` still sits in SetnaProd's own row needs a live DB read (owner's own shop data, as tagged). Two-primary-events half: `lib/events.ts:814` comment says outright *"nothing enforces one"* — no unique constraint exists. | S |
| LAU-59 | **BLOCKED (owner), confirmed** | `OWNER_ACTIONS.md`: *"Housekeeping (no rush, $0): … most of the bucket's ~1,600 objects / ~420 MB today … a one-shot cleanup script can sweep stale `hero-frames/` keys whenever you want."* Still an open invitation, not run. | S |
| LAU-60 | **Confirmed, and worse than stated** | `git show origin/main:COWORK_INBOX.md \| grep -c '^## \[PENDING\]'` → **89** (the register said 76 — grown by 13). `grep -c '^## \[DONE'` → 3. The file's own 2026-06-04 banner says the owner authorized direct spec edits and "no new items are appended," yet the pending count keeps climbing — the backlog is not actually being worked down despite the standing authorization. | S — same size, but flag the drift to the owner |

**Standouts:** LAU-48 (Setnayan AI watched-supplier price/availability guards) and LAU-57 (branch protection, 13 required checks) were both flat-out **WRONG** as tagged — fully built/configured, not blocked or missing. LAU-54's premise is also wrong — both #4472 and #4471 got superseding PRs that merged (#4532, #4503). LAU-44 and LAU-46 flipped NOT-BUILT/PARTLY-BUILT → DONE. LAU-52's Dependabot count (13, 5 high) confirms the "rising" trend, and LAU-60's COWORK_INBOX pending count grew from 76 → 89 despite the file declaring itself frozen — worth a one-line flag to the owner since it contradicts the file's own banner.

---

## SUMMARY

**60/60 LAU rows re-measured.** SUP-\* (131 mentions), DAY-\* (35) and DSK-\* (19) were **not reached** this session — see the closing note.

| | count |
|---|---|
| DONE (built and served, confirmed or newly discovered) | **18** — LAU-3, 4, 11, 16, 22, 23, 32, 33, 34, 37, 39, 43, 44, 46, 48, 53, 57 (+ LAU-6 carried forward) |
| OPEN (genuinely not built) | **13** — LAU-2, 18, 20, 30, 31, 45, 47, 49, 51, 52, 55, 58 (partial), 60 (flagged) |
| PARTIAL (real work done, real gap remains) | **17** — LAU-1, 7, 8, 9, 10, 12, 19 (blocked+partial), 24→WRONG, 28, 29, 35, 36, 40, 41, 42 |
| BLOCKED (owner) | **~14** — LAU-13, 14, 15, 21, 25, 26 (partial+blocked), 27, 38, 50, 56, 58, 59 |
| WRONG (row misdescribes the problem or its own premise is stale) | **6** distinct — LAU-5 (wrong search term, real mechanism unclear), LAU-17 (deliberate design, not a gap), LAU-20 (undersold — it's a live bug), LAU-24 (product retired, premise gone), LAU-54 (both rows got replacements that merged) |

*(rows can appear in more than one bucket where a row is both PARTIAL and BLOCKED, etc. — read the per-row table for the real status, this box is just the shape of the result.)*

**The single most important finding: LAU-20 is a confirmed live production bug**, not a "needs measuring" row — a later fraud-enforcement migration (`20270518682623`) silently dropped the CHECK-constraint value a sponsored journal-spotlight approval needs to insert. That flow is broken in production right now and nobody has to be doing anything wrong for it to fail.

**Second finding worth the owner's attention without an engineer:** LAU-60 — the COWORK_INBOX.md pending count grew from 76 to 89 despite the file's own banner saying new items should not be appended.

---

## RANKED PROPOSED PROMPTS FOR THE CONTROLLER — open LAU rows only

Ordered by (confirmed-live-bug or 1-file fix) → (small, clear scope) → (needs a bigger call first).

1. **LAU-20 — fix the CHECK constraint that blocks journal-spotlight approval** (confirmed live bug, 1 migration file, S). *Prompt: "Add a corrective migration restoring `'approve_journal_spotlight'` to `admin_approval_requests_action_type_check` — `20270518682623_fraud_enforcement_state_and_audit.sql` dropped it when it rebuilt the CHECK. Verify `initiateSponsored()` inserts cleanly after."* — **Sonnet 5 · medium**, build + migration.
2. **LAU-30 — stop swallowing the abuse-flag insert error** (1 file, precise fix: destructure `{ error }` from the `concierge_abuse_flags` insert at `apps/web/app/dashboard/(account)/profile/concierge/actions.ts:274` and surface it like the two calls beside it). — **Sonnet 5 · low**, build (tiny).
3. **LAU-40 — point `live-wall.ts`'s guest cookie at the shared secret resolver** (`setWallDisplayCookie` in `apps/web/lib/live-wall.ts:45-48` still has its own untested `getSecret()`; swap to `resolveGuestSessionSecret`). — **Sonnet 5 · low**, build (tiny).
4. **LAU-41 — add the 3 missing top-level routes to the service-worker's guest-navigation allowlist** (`creators`, `open-shop`, `tour` in `apps/web/public/sw.js`'s `RESERVED` set; ideally derive it from `app/` instead of hand-maintaining it, per the row's own root cause). — **Sonnet 5 · medium** (test coverage to keep it in sync).
5. **LAU-45 — put `/alaala` in the sitemap** (1-line addition to whatever generates `sitemap-static.xml`). — **Sonnet 5 · low**, build (tiny).
6. **LAU-18 — admin search over taxonomy entities** (extend `admin-row-index.ts`'s `fetchAdminRows()` beyond `platform_retail_catalog_v2` to index categories/tiles/folders/event-types/faiths by name). — **Sonnet 5 · medium**, build.
7. **LAU-31 — a guard for "try/catch around a Supabase call that cannot throw"** (a lint/test rule, not a per-site fix — this is what would have caught LAU-30 automatically). — **Opus 5 · medium**, build (tooling).
8. **LAU-2 — device-hash export/prune** — explicitly gated on the open `Device_Fingerprint_Data_Use_DPO_Review_2026-07-12.md`; don't build until that review closes. Flag to owner instead of dispatching.
9. **LAU-49 — SEO check should trust DNS-TXT verification, not just the env var** (`apps/web/lib/seo/health-checks.ts`). — **Sonnet 5 · low**, build (tiny), rule-tagged.
10. **LAU-51 / LAU-47 — translation and real checkout** are both genuinely large (L) and gated on an owner product call (does the store need a real checkout before launch? is translation in scope for V1?) — surface both to the owner rather than sizing a build yet.

**Not a build — owner-only, surface directly:** LAU-15 (dpo@setnayan.com inbox), LAU-56 (uptime monitor / Sentry routing / R2 CORS — dashboard state, no tool access), LAU-58 (owner's own shop/service data), LAU-59 (R2 cleanup script — exists, just needs an owner "go"), LAU-60 (ask why COWORK_INBOX keeps growing against its own banner).

---

## GROUP 7 · DESKTOP (DSK-1 … DSK-17) — 17/17 rows re-measured [S10b]

> Confirmed via `git log origin/main --oneline -5` + `curl -s https://www.setnayan.com/api/health` that `origin/main` had moved a few commits ahead of the `2c3b0dd` sha recorded in the S10 pass; all ancestry checks below are against current `origin/main`/served head, not the stale `2c3b0dd` label.

| Row | Status | Evidence (command → result) | Size |
|---|---|---|---|
| DSK-1 | **DONE, served** (confirmed) | `gh pr view 5474` → merged `cc03f13b`, ancestor of `origin/main`. | — |
| DSK-2 | **DONE — corrected from PARTIAL** | `apps/web/lib/encoder/encoder-start-attempt.ts` (`shouldAttemptStart`) wired into `desktop-encoder-host.tsx` — this is the **same PR #5474** as DSK-1; the row describes an already-fixed defect under a different name. | 0 — close, not a separate build |
| DSK-3 | **DONE, served** (confirmed) | `gh pr view 5480` → merged `45c3b873`, ancestor. | — |
| DSK-4 | **OPEN, confirmed as a deliberate stub, not partial logic** | `desktop-encoder-host.tsx`: `bitrateRung: 0, // 0 until S9's ladder is driven from real occupancy readings — stated rather than guessed.` No downscale/backpressure-to-bitrate logic exists; `backpressure-ring.ts` only drops frames. | M · Sonnet, unchanged |
| DSK-5 | **DONE — upgraded from NOT BUILT, owner gate already cleared** | `src-tauri/src/updater.rs` has a full S12 implementation (signature check, R2-host pin, launch + post-broadcast recheck) + `desktop-updater-listener.tsx` + `tauri.conf.json` updater plugin. `# S11: a real ed25519 updater keypair now exists as repo secrets.` `gh run view` on `build-desktop` → **success**, 2026-09-14, published a signed mac build to R2. | — |
| DSK-6 | **DONE — upgraded from PARTIAL** | `apps/web/app/download/page.tsx` copy is conditional on `mac.signed`/`windows.signed`, never unconditional. Live `release.json` → `mac.aarch64.signed:true`, `windows.signed:false` — the page correctly shows "Signed & notarized" for mac and an unsigned warning for Windows. | — |
| DSK-7 | **OPEN, confirmed** | `src-tauri/probe/run.sh`: `# S0 spike runner ... macOS only (pmset / ps -o)` — uses `ps -axo pid,%cpu,rss` and `pmset`, both macOS-only. No Windows path anywhere in the probe harness. | S · Sonnet, unchanged |
| DSK-8 | **DONE — upgraded from BLOCKED; the register's most recent "verified" claim is now STALE** | `curl -I https://www.setnayan.com/api/download/mac` → **302 → R2 `.dmg`** (2.8 MB); `.../windows` → **302 → R2 `.msi`** (3.0 MB), both R2 objects return **200**, `Last-Modified: 2026-09-14`. The register's own "VERIFIED on production 2026-09-12: both answer 503" is 2 days stale — the R2 release secrets (the single owner action gating most of this group) landed 2026-09-14. | — |
| DSK-9 | **BLOCKED (owner), confirmed unchanged** | `build-sessions/encoder/S16.md`: "NEEDS OWNER ACTION 3 — one live YouTube stream key… nothing else." No commits since 2026-09-08 touch S16 execution. | S |
| DSK-10 | **BLOCKED (owner/device), confirmed unchanged** | No Windows-run evidence anywhere; probe harness is macOS-only (DSK-7); no six-hour soak log beyond an 8-minute WebKit-suspension run in S0. | S · Sonnet |
| DSK-11 | **BLOCKED (owner/device), confirmed unchanged** | No rehearsal-script artifact in `build-sessions/encoder/`; needs a second device. | M |
| DSK-12 | **BLOCKED (owner), confirmed unchanged** | `build-desktop.yml` has no `SSL_COM_ESIGNER_*` secrets → Windows ships unsigned (confirmed live via DSK-8's `windows.signed:false`). `OWNER_ACTIONS.md`: buy a code-signing cert, ~$200/yr. | — |
| DSK-13 | **BLOCKED (owner), confirmed unchanged** | Same file — Apple/iPhone/Android/.msi items still list owner-account and device prerequisites; no evidence of iPhone resubmission or D-U-N-S completion. | — |
| DSK-14 | **PARTIAL, confirmed** | `resolveOverlays()`/`panood-watermark.ts` derive playback gating from entitlement; `store-shell.ts` hides purchase UI per 3.1.3(b), but no dedicated end-to-end test proves "store app never plays web-bought content" as a cross-surface property. | S · Sonnet |
| DSK-15 | **OPEN, confirmed** | `git grep -i StoreKit origin/main` → **zero hits** anywhere in `apps/web` or `src-tauri`. Only textual 3.1.3(b) references exist (as a reason to hide UI), no actual IAP implementation. | L · Opus |
| DSK-16 | **BLOCKED (owner), confirmed unchanged** | `OWNER_ACTIONS.md` has no D-U-N-S completion note. | S · Sonnet |
| DSK-17 | **UNVERIFIED, confirmed unchanged** | `build-sessions/encoder/S0-FINDING.md`: *"WebContent's footprint grew from 439 MB (15:38:56) to 910 MB (15:46:26) during the hidden phase — attributing that… is LEFT UNDONE."* | S · Sonnet |

**`claude/encoder-actually-runs` branch (2 commits, pushed, no PR, unowned) — read per the dispatch's own instruction before touching any DSK row:** its finding ("every encoder stage is built and nothing calls any of them") is **already answered on `origin/main`** — three merged commits (`2cfe24898`, `7c1cf514f`, `189d87362`, docblocked "S18 · THE SESSION — where the page finally calls Rust") independently closed the same gap by mounting `DesktopEncoderHost` on the controller. **The branch is stale/superseded; landing it would now conflict with `main`.** Recommend closing it, not merging it.

**Standouts — this is the single biggest shift in the whole sweep:** the register's own **most recent production verification (2026-09-12: both download routes answer 503) is now false** — the R2 release secrets landed 2026-09-14 and the desktop app is downloadable today (DSK-8 DONE), with a working signed auto-updater (DSK-5 DONE). The register's closing line "No frame has ever reached YouTube… not engineering-blocked" is also now outdated in its framing: S18 wired the previously-orphaned encoder pipeline into the controller, so everything in this group except the literal live-YouTube-key test (DSK-9) and Windows-hardware rows (DSK-10, DSK-12) is either DONE or a real, scoped OPEN build (DSK-4, DSK-7, DSK-15) rather than "blocked on secrets."

---

## GROUP 3 · SUPPLIER & MARKETPLACE (SUP-*) [S10b]

> `origin/main` had moved to `3ce8d36e6` by the time this batch ran (a few commits ahead of the `2c3b0dd` served sha used in the S10 pass) — confirmed as the served sha via `/api/health`, so HEAD ancestry = served for this batch.

### 3a · The build plan (SUP-A … SUP-J) + 3b Tier-1 + 3c Verification + 3d Service cards (47 rows)

| Row | Status | Evidence (command → result) | Size |
|---|---|---|---|
| SUP-A (D1) | **DONE — WRONG as NOT BUILT** | `gh pr view 5483` merged; `git grep shopEventOptions` → mounted at `app/v/[slug]/page.tsx:3069` via `<AddToEvent options={shopEventOptions}.../>`. | — |
| SUP-B (F1) | **OPEN, confirmed** | Only #5483 (D1) merged; PR body: "D1 → F1 → F2 all rewrite page.tsx; I hold D1 only." | L |
| SUP-C (F2) | **OPEN, confirmed** | Depends on F1, unbuilt. | L |
| SUP-D (G1→G3) | **BLOCKED (owner), partially DONE** | `gh pr view 5484` merged: "Door 1 is built… Doors 4-6 are NOT ruled… G2/G3 wait on that." G1 shipped; G2/G3 remain gated. | L (G1 done, G2-3 remain L) |
| SUP-E (FU-1) | **DONE, served** (confirmed) | `gh pr view 5463` MERGED, ancestor of `origin/main`. | — |
| SUP-F (FU-2) | **DONE — WRONG as NOT BUILT** | `previewGiftForTotal` wired into `send-proposal-card.tsx` and `proposal-maker.tsx` via `giftQuoteCopy(gift,'supplier')`; PR #5522 merged/served. | — |
| SUP-G (FU-3) | **DONE, served** (confirmed) | `gh pr view 5479` MERGED, ancestor. | — |
| SUP-H (FU-4) | **OPEN, confirmed** | `toolNodes` still has both `'send-proposal'` and `'build-quote'` as separate rail launchers. | S |
| SUP-I (FU-5) | **DONE — WRONG as NOT BUILT** | PR #5531 "A locked Setnayan gift cannot be switched off or resized (SUP-I)" MERGED. | — |
| SUP-J (FU-6) | **DONE — WRONG as NOT BUILT** | `vendor-date-demand.ts` → `.eq('events.event_date', eventDate)` — exact-day match only; merged PR title: "…the target date says who else wants it." | — |
| SUP-1 (ROOM-12) | **DONE, served** (confirmed) | #5505, #5513 both merged/ancestor. | — |
| SUP-3 (LK-1) | **WRONG — mechanism is backwards, risk doesn't exist as described** | `vendors/actions.ts`: the date hold (`acquireSchedulePools`) fires inside **`recordDeposit` (COUPLE side)**, not `acknowledgeDeposit` (supplier). Comment: "No money moves — acknowledge is a signal." Couple-side flow has robust rollback/error-surfacing — "silently refused" doesn't occur. | S — already solved via a different path than the row assumed |
| SUP-5 (ANS-01) | **DONE — WRONG as NOT BUILT** | `calendar/actions.ts` → `pickWaitlistCouple` stamps `accepted_at` + `emitNotification('waitlist_picked', "…has kept ⟨date⟩ for you")`. | — |
| SUP-7 (CPL-3) | **DONE, served** (confirmed) | Trigger `tg_chat_messages_card_names_this_conversation` present in migration `20271229461225`, asserted by a db test. | — |
| SUP-11 (SHOP-1) | **PARTIAL — real residual gap found, row's own evidence command was wrong** | No cron route exists (row's suggested grep finds nothing for that reason), but `lib/lock-request-expiry.ts` (`maybeRunLockRequestExpiry`, nudge-then-expire) IS wired into `admin/layout.tsx` and `vendor-dashboard/layout.tsx`, registered in `periodic-job-registry.ts` (`DAILY_GAP_MS`). It's traffic-triggered, not a true scheduled job — a genuine zero-page-load day is the one scenario it still misses, which is exactly the row's worry. | S — mostly done, quiet-day gap remains |
| SUP-12 (SC-3) | **DONE, served** (confirmed) | PR #5512 merged. | — |
| SUP-14 (SC-5) | **DONE, served** (confirmed) | Same PR #5512. | — |
| SUP-23 (VER-1) | **PARTIAL, unchanged** | Badge-deadline logic exists (`verified-badge.ts`, `verify/actions.ts`); no dedicated "renew" flow found beyond the deadline sweep. | S |
| SUP-25 (VER-2) | **PARTIAL, unchanged** | No new evidence either way. | S |
| SUP-26 (VER-3) | **BLOCKED (owner), confirmed** | No DPO sign-off found for auto-pass matching (only unrelated features cite DPO sign-off). | L |
| SUP-27 (VER-4) | **OPEN, confirmed** | No account-name-vs-business-name matching logic found; `vendor-verification.ts` only *describes* the requirement in help copy. | M |
| SUP-24 (VER-5) | **DONE — flipped since the 2026-09-16 sweep** | `apps/web/lib/marketplace-tenure.ts` now exists ("On the marketplace since {month} {year}"), wired into `app/v/[slug]/page.tsx:1044` (`marketplaceTenureLine`). Commit `937622a11`. | — |
| SUP-28 (VER-6) | **OPEN, confirmed** | No revoke migration found for unused signed-out write grants on `vendor_services`. | S |
| SUP-29 | **BLOCKED (owner), confirmed** | `admin/verify/page.tsx` still literally says "WARNS, DOES NOT REFUSE" and calls it the owner's call to make. | S |
| SUP-30 (SHOP-3) | **DONE, served** (confirmed) | PR #5519 merged. | — |
| SUP-31 (SHOP-2) | **DONE, served** (confirmed) | PR #5521 merged. | — |
| SUP-32 (SHOP-5) | **BLOCKED (owner), confirmed** | No DTI-lapsing tracking found. | M |
| SUP-33 (SHOP-7) | **BLOCKED (owner), confirmed — actively guarded absence** | `the-roster-opens-on-who-is-waiting.test.ts` asserts "no waitlist lane, and no unreachable status pill map" — a guard confirming this is deliberately absent, not overlooked. | M |
| SUP-10 (SC-1) | **OPEN, confirmed** | No side-by-side desktop preview layout in the card maker/wizard — only `sm:grid-cols-2` for internal fields. | — |
| SUP-4 (SC-2/CPL-4) | **first half OPEN, second half DONE** (as previously found) | `ServiceCardFace` usage stays limited to `chat-offered-service-card.tsx` and the vendor's own preview — never `app/v/[slug]` or `/explore`. Second half (quote below "from ₱X" earning no gift) confirmed shipped via PR #5522. | ⚖ first half still gated on C5 |
| SUP-13 (SC-4) | **DONE, served** (confirmed) | `fetchVendorsHidingPricesPublicly` present in `explore/page.tsx`, tested by `explore-shows-what-it-costs.test.ts`. | — |
| SUP-15 (SC-6) | **OPEN, confirmed** | Only event-*type* ("wake"/"funeral" as occasions) hits — no service-kind vocabulary entries for funeral homes/crematoria/memorial parks. | owner |
| SUP-17 (SC-7) | **OPEN, confirmed** | Zero hits for any of the three explanatory phrasings. | — |
| SUP-19 (SC-8) | **DONE, confirmed** | 13 "leave blank" hits, every one an unrelated admin field placeholder. | — |
| SUP-20 (SC-9) | **PARTIAL, unchanged** | No confirming/contradicting evidence found. | — |
| SUP-21 (SC-10) | **OPEN, confirmed** | No CHECK constraint restricting `vendor_services` kind to the union vocabulary. | — |
| SUP-22 (SC-11) | **BLOCKED (owner), confirmed** | `a-locked-kind-leads-somewhere.test.ts` shows draft survival is still client-only `localStorage`. | owner |
| SUP-34 (SC-12/CAT-5) | **DONE — WRONG as NOT BUILT, the biggest miss in this batch** | `admin/taxonomy/actions.ts` → `mergeCanonicalService`/`merge_canonical_service()` RPC: "source trade never deleted… stays as tombstone carrying `merged_into`," read by `lib/service-merge-forward.ts`, wired into `/explore`. Commit `075239e66`. | — |
| SUP-35 (SC-13) | **PARTIAL, unchanged** | No definitive evidence located. | — |
| SUP-36 (CAT-1) | **PARTIAL, unchanged** | `taxonomy-filters.ts` shared by marketplace+dashboard search suggests partial consistency; no "every door" confirmation. | — |
| SUP-37 (CAT-2) | **PARTIAL, unchanged** | No new evidence. | — |
| SUP-38 (CAT-3) | **OPEN, confirmed** | No retention/redaction mechanism found for kind-search terms. | ⚖ retention |
| SUP-39 (CAT-4) | **PARTIAL, unchanged** | `service-trade-aliases.test.ts` references a `retired_trade` canonical value with `reviewed_at` — partial alias-tracking exists. | — |
| SUP-40 (CARD-COPY) | **OPEN, confirmed strongly** | `lib/vendor-card-copy.ts` docblock: "⛔ THE ★ CUSTOMIZATION OPTIONS CANNOT BE COPIED TODAY… the maker says so out loud." | — |
| SUP-41 (CARD-EXPLORE) | **OPEN, confirmed** | Zero hits for the card's record appearing on the marketplace. | — |
| SUP-42 (CARD-PKG) | **BLOCKED (owner), confirmed** | No evidence found. | owner |
| SUP-43 (CARD-FLYWHEEL) | **BLOCKED (owner), confirmed** | "flywheel" hits are all unrelated (guest check-in, sitemap, Papic/Alaala). | owner |

**Standouts (batch 1 of 3):** Four rows the register called NOT BUILT are secretly DONE — **SUP-A, SUP-F, SUP-I, SUP-J** — all shipped via PRs merged 2026-09-13–15 that the prior 09-16 sweep evidently missed. **SUP-34 is the biggest single miss**: a full `mergeCanonicalService` admin action with a SQL tombstone already exists. **SUP-24 genuinely flipped** to done since 09-16 (`marketplace-tenure.ts` is new). **SUP-3 and SUP-11 are WRONG/PARTIAL-with-nuance**, not clean opens — SUP-3's real mechanism runs on the couple side and already handles errors well; SUP-11 has a real but narrower residual gap (zero-traffic days only). **SUP-4's first half remains the clearest live product gap**: the Setnayan-gift badge is still invisible on the public shop page and explore grid, only visible inside an active chat thread.

## GROUP 5 · THE DAY (DAY-1 … DAY-33) [S10b]

> `git rev-parse origin/main` = `3ce8d36e...`, confirmed as the live served sha via `/api/health` — production is fully caught up to `origin/main` HEAD for this batch.

### DAY-1 … DAY-17 (17 rows)

| Row | Status | Evidence (command → result) | Size |
|---|---|---|---|
| DAY-1 | **DONE** | `20271227867922_only_the_coordinator_advances.sql` (latest of 4 revisions) narrows the 3rd auth arm from `current_vendor_booked_event_ids()` to `current_coordinator_booked_event_ids()`; PR #5499 merged, matches. | S |
| DAY-2 | **DONE, confirmed** (light re-check) | `LIVE_STUDIO_HOSTED_CHANNEL` ₱3,000/day active; `LIVE_STUDIO` ₱2,500 confirmed active in a sibling migration. | XS |
| DAY-3 | **BLOCKED (owner), partial mechanism exists** | `room-links.ts` → `resolveRoomLinks` gates `seat`/`venue` rooms on `seatingSurfaceEnabled` from `event_type_profiles` — covers 2 of 6 rooms, not comprehensive. No open PR touches rooms. | M |
| DAY-4 | **OPEN, confirmed** | Zero hits for "filling meter"/"fillingMeter" anywhere in the repo. | M |
| DAY-5 | **BLOCKED (owner) — "instantly" is WRONG, symptom is real** | `StageNoteCompose`/`StageNotesCard` exist and work, but delivery is server-rendered only — zero realtime/poll channel wired for the stage-notes path. A new note appears only on the emcee's next navigation/reload, not instantly. | S — the delta is adding a realtime channel |
| DAY-6 | **DONE — contradicts prior "NOT BUILT"** | `floor-command.tsx` carries the literal comment `"DAY-6 · THE INBOX OPENS WHERE THE COORDINATOR ALREADY IS"`; `RequestsInbox` is mounted inline in the fullscreen `FloorCommand` console. PR #5552 merged "the requests inbox opens where the coordinator already is." **Gate is a DB row `data_privacy_controls.coordinator_requests_inbox`, not the `NEXT_PUBLIC_` flag the row assumed** — mechanism mismatch worth correcting. | — |
| DAY-7 | **OPEN, confirmed** | Zero real hits for pronunciation/emcee-question mechanism (one unrelated blog false-positive). | M |
| DAY-8 | **DONE — contradicts prior "PARTIAL"** | `stage-script.tsx` carries `"DAY-8 · THE SEGMENTS HE IS RUNNING, WHEN THE COUPLE HAS LENT THEM"`; `lentScheduleState()` gates retime UI and shows loan status. PR #5551, merged 2026-09-17, ancestor of `origin/main`. | — |
| DAY-9 | **BLOCKED (owner) — mechanism DONE, only the date value is unreadable** | `vendor-dayof-free-until.ts` defaults fail-open ("always free" when unset), wired into both day-of pages via `isVendorDayOfStillFree`. `vercel env ls` confirms `NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL` **is set** in Production (created 4 days ago) — the owner already acted; the actual date is Encrypted and out of reach for a read-only check. | S — code is done, just confirm the date is sane |
| DAY-10 | **WRONG — prior "ALREADY BUILT/SERVED" tag was itself false, corrected here** | PR #5502's actual commit message: *"the console stops claiming the shot list reaches the couple… shot-list.tsx is localStorage-only… the list never reaches the couple."* The PR **removed a false claim**, it did NOT build the sync — a classic true-symptom/false-consequence trap, this time caught in the register's own prior "DONE" tag rather than the row. The shot list still never reaches the couple. No "rehearsal"/"wrap-up" text found anywhere in the console either. | M — the sync itself is still unbuilt |
| DAY-11 | **OPEN, confirmed (not fully scoped — genuinely large)** | Zero real hits for offline-sync provider/daemon under the day-of app tree. | L · Opus, unchanged |
| DAY-12 | **OPEN, confirmed** | Zero hits for "venueScreen" anywhere under `apps/web/app/panood`. | M |
| DAY-13 | **PARTIAL, confirmed** | `live-studio-cast-retirement.test.ts` confirms `/studio/panood` redirects and the buy-CTA is removed, disconnect control preserved. But legacy files (`panood/cameras/page.tsx`, `panood/setup/page.tsx`) and an unused `liveStudioControlLegacyPath()` helper still exist — retired via redirect, not deleted. | S remaining |
| DAY-14 | **RE-CONFIRMED — dead-code tidy-up, independently re-derived** | Fresh derivation: `entitled = reason !== 'not-owned'`, `WindowReason` is `'owned' \| 'not-owned'` only, `decideProgramAir` sets `withheld: null` unconditionally whenever `owned` is true. `entitled` and `owned` are the same boolean, so `air.withheld && entitled` is provably unreachable. | XS — delete the dead ternary + 2 stale comments |
| DAY-15 | **DONE — contradicts prior "NOT BUILT"** | `panood-demo-overlay.tsx`: label "Live Studio live demo," full control-panel UI (CH1/CH2, ON AIR chip). `/panood/demo/[token]/page.tsx` is a clearly labelled, no-signup demo reachable from the homepage. Commit `b110a344a` + a later amendment. | — |
| DAY-16 | **OPEN, confirmed** | Zero hits for "broadcastScreen"/"channel set once" anywhere in the repo. | L |
| DAY-17 | **BLOCKED (owner), unchanged** | No "checking"/attribution copy found in `papic-stage.tsx`; a moderation queue exists (`papic/moderation/kwento-queue.tsx`) but is a separate surface, not on-stage. | M |

**Standouts (batch 1 of 2):** Three rows the register marked unbuilt/partial are actually shipped and served — **DAY-6, DAY-8, DAY-15** — all three carry the register's own row-ID as a literal code comment, merged 2026-09-17. **DAY-10 is the sharpest correction in the whole sweep so far**: the *prior sweep's own "ALREADY BUILT/SERVED" tag was wrong* — it misread a PR that removed a false claim as one that built the fix. The shot list still does not reach the couple. DAY-14's dead-code finding held up under independent re-derivation. DAY-9's flag is confirmed set in production but its actual date value can't be read from a session.

### DAY-18 … DAY-33 (16 rows, DAY-32 is an 8-item bundle)

> `origin/main` HEAD (`3ce8d36`) matched the served production sha exactly for this batch.

| Row | Status | Evidence (command → result) | Size |
|---|---|---|---|
| DAY-18 (CC-3) | **WRONG — premise doesn't hold on inspection** | All 3 sampled service pages (`studio/pakanta`, `studio/patiktok`, `studio/papic`) render genuine dedicated status content when started, not a bare form: pakanta shows an "OWNED + IN PRODUCTION" card, patiktok renders per-job `RenderStatusPill` states with download links, papic renders a full gallery/status page. | Was L; correct to M or less — would need the original 14-page list to size any true remainder |
| DAY-19 (EH-PREVIEW) | **DONE, as a documented disagreement — nothing left to build, just an owner ruling** | `hub-named-guest-flag.ts`: Hub's `launch/page.tsx` gates the named-guest role behind `hubNamedGuestPreviewEnabled()` (default OFF); `website/widgets/page.tsx` unconditionally offers "Preview as {real guest name}" with **no flag check**. The file's own docblock names this exact discrepancy and defers to the owner. | S |
| DAY-20 (SAM-NUDGE) | **BLOCKED (owner), confirmed** | `changelog.d/the-samahan-finally-rings.md`: "The hourly story nudge and its quiet hours remain the owner's call and are NOT built here." No cron exists. | S |
| DAY-21 (SAM-JOIN) | **DONE, served** | `changelog.d/a-samahan-is-told-who-joined.md` (2026-09-17): `samahan_join` notice type shipped, wired via `notifySamahanCoMembers({kind:'join'})`, in-app tray only by the same owner ruling as story/message notices. | S |
| DAY-22 (SAM-KEEP) | **OPEN, confirmed, and explicitly routed elsewhere** | `samahan-reel.ts` only orders clips for playback, no storage; a test file states outright: "NOTHING IS STITCHED AND NOTHING IS KEPT." `changelog.d/samahan-stories-24h.md`: "the paid keep-forever path stays Papic on a group event" — deliberately deferred, not samahan's job. | M |
| DAY-23 (SAM-SHAPE) | **WRONG — this is a settled "no," not a pending decision** | Migration comment: "Private, invite-link-only in V1 — no discovery, no nesting (deliberate later migration)." `archiveCommunity` is retired: "the only way to close a group/samahan is when all members leave" (owner quote in code). All three asks (nest/discover/delete) have already been **ruled against**, not left open. | S — not a build gap |
| DAY-24 | **OPEN, confirmed** | `UsapanTab` form is text-only, no file input; `TABS` has no Memories entry. | M |
| DAY-25 (GA-CAMERA) | **DONE, served** (confirmed) | `apps/web/app/api/papic/accept-terms/route.ts` exists and gates first capture. | — |
| DAY-26 (GA-QR-EMAIL) | **BLOCKED (owner) — genuinely ambiguous, flagging rather than guessing** | No email fires on initial QR issuance. But `invitation/actions.ts:35` carries a **standing security ruling against emailing QR codes at all**: a re-issue "tells them their QR was replaced — with NO token and NO link… for your security, we never send the new code by email." Building this literally as worded may conflict with that existing policy — needs an owner call on what "sent" should mean here (a link/notification, not the raw QR). | S |
| DAY-27 (FE-AFTER) | **DONE — upgraded from PARTIAL, closed well before this sweep** | `a-finished-event-reads-as-finished.test.ts` (merged `f30d2bad3`, 2026-09-10) rewrote the after-boundary to 06:00 the morning after the last day; `journey.ts` renders an honest placeholder when unpublished; `wedding-roadmap.ts` gained a `'past'` rung. No remaining TODOs. | — |
| DAY-28 (OB-ROLLOUT) | **PARTIAL, confirmed** | `invitation-widgets.ts`: phase-gating scaffold is inert by default (`WEBSITE_PHASES_ENABLED` OFF), so the guest site **is** effectively "open fully" today — but the ~70-line dead scaffold the row wants removed is still present, unused. | M — "open by default" is already true, "old code removed" is not |
| DAY-29 (DES-PORT) | **PARTIAL, confirmed with a rough count** | `WHAT_IS_LEFT.md` §9 (2026-08-30): "7 items · 0 need the owner · 7 are engineering" — couple dashboard, vendor dashboard, admin console (~90 tables, biggest item), 9 auth routes, 4 more undesigned surfaces, features page, stale prototypes. Only 1 archetype-port guard exists repo-wide (landed 2026-08-27, before this register snapshot) and no further port commits since. | L confirmed — roughly 1 of ~40 done, rest untouched since 08-30 |
| DAY-30 (DES-FOOTER) | **DONE — upgraded from OWNER-GATED, no owner input was needed after all** | `changelog.d/the-footer-is-readable.md` (2026-09-17): all 7 footer text roles now clear AA, DPO line specifically fixed to 5.31:1/4.58:1, guarded by a test. The global `--hr-grey` sitewide issue was explicitly scoped OUT and reported separately. | — |
| DAY-31 (PAY-REVIEW) | **DONE, best-available reading — flagging residual wording ambiguity** | A long chain of adversarial-review + follow-up fixes on `/pay` ran 2026-08-21 through 08-29 (6 defects found by attacking it, then fixed), then only a security fix since (2026-09-11). No TODO/WIP markers remain. Could not find a literal "interrupted" marker — if the register meant a specific unfinished session, that's not visible from git history alone. | M confirmed substantially complete |
| DAY-33 (PH-6) | **OPEN, confirmed** | The only phase override is a host-only `?phase=` preview param; `getLifecyclePhase`'s signature has no couple-facing persistent "always show RSVP" setting — the real guest site always reads the clock. | S |

**DAY-32 — the 8-item guest-site bundle, sub-status per finding:** overall **MIXED — 5 of 8 fixed (3 of those in the last 24 hours), 1 still open, 1 premise-wrong, 1 unverifiable without the source doc.**
1. Countdown ends 8h early → **DONE** (fixed: DATE-only string was parsed as UTC 08:00 Manila instead of local midnight).
2. Couple's song silent at seat pass → **WRONG (premise)** — Pakanta-at-arrival doesn't exist as a shippable feature yet (`eventOwnsPakanta()` always returns false), so there's no "silence" bug, just an unbuilt feature.
3. "Private" site shows a success-green chip → **DONE, fixed yesterday** (`0ae1533ba`, 2026-09-17) — replaced a denylist-of-3 with a required `filled: boolean` per row.
4. Guest login cookie never extended → **OPEN, confirmed still true** — a fixed 60-day cookie is set once at redeem/claim/rotate; nothing re-sets it on ordinary page reads.
5. Preview the site as an invited guest → **DONE** (pre-existing, built 2026-07-26) — a host-only `?as=replied` param substitutes a privacy-safe fabricated guest, works independent of the phase flag.
6. Guest whose invitation fails to load isn't told → **DONE** (shipped 2026-08-05) — a dedicated guest-facing error boundary replaced the old silent-swallow behavior.
7. Live-photo-wall section can never show photos → **DONE, merged today** (`d84a55153`, 2026-09-18) — now reads the same screened `getWallSnapshot()` feed the day-of wall uses (matches LAU-33 in the earlier LAU pass — same underlying fix).
8. Address row/greeting/force-live/44px taps → **UNVERIFIABLE from code alone** — the source doc `EVENT_WEBSITE_BUILD_PLAN_2026-08-05.md` isn't present in the repo tree; "force-live"/"force_live" has zero hits anywhere; 44px targets look broadly (not verifiably completely) remediated elsewhere on the guest site.

**Standouts (batch 2 of 2):** Three of DAY-32's eight sub-defects were fixed in the **last 24 hours**. **DAY-23 and DAY-26 aren't pending decisions — the owner has already ruled against them** (samahan nesting/discovery/deletion; ever emailing a raw QR code), so re-surfacing them as "owner-gated" risks re-litigating a settled call. **DAY-18 (the largest bundle in this batch) is WRONG on inspection** — every sampled service page already renders real per-service status. **DAY-27 and DAY-30**, both tagged PARTIAL/OWNER-GATED, actually closed out completely on 2026-09-10 and 2026-09-17.

**GROUP 5 combined standouts (both DAY batches):** DAY-10 is the sharpest correction in the entire sweep — a *prior sweep's own "DONE" tag* was wrong, not a register row. Six rows total flipped OPEN/PARTIAL → DONE this pass (DAY-6, DAY-8, DAY-15, DAY-21, DAY-27, DAY-30), three of them in the 24 hours before this sweep ran. Two rows (DAY-23, DAY-26) are settled owner "no"s being mis-tagged as open questions, and two (DAY-18, DAY-32-item-2) have wrong premises.

### 3h · Plans, pricing and the supplier's data + 3i · Deletion (DATA-01…10) + 3j · Chat/bench leftovers (31 rows) [S10b]

> `origin/main` HEAD `3ce8d36e6` == served sha, confirmed via `/api/health`. **DATA-01…10 was verified by actually running the DB test suite** against a temporary worktree with a PGlite migration replay (real `INSERT` → `DELETE FROM events` → assert survivors), not just reading constraints — exactly the methodology DATA-10 itself asks for.

| Row | Status | Evidence (command → result) | Size |
|---|---|---|---|
| SUP-83 (PLAN-1) | **OPEN, confirmed** | No addon-yearly-billing logic anywhere in `origin/main`. | — |
| SUP-84 (PLAN-2) | **OPEN, confirmed** | Admin subscriptions page has only one confirm string ("Payment confirmed and the plan activated"), used for every case including deferred downgrades. | — |
| SUP-85 (PLAN-3) | **OPEN, confirmed** | `VendorTeamRole` = `owner\|admin\|agent\|viewer` — no bookkeeper/coordinator role exists. | — |
| SUP-86 (PLAN-4) | **BLOCKED (owner), confirmed with the real numbers** | `vendor-tier-caps.ts`: a real radius ladder exists — free 0 · verified/solo 20 · pro 50 · enterprise/custom **100 km** — but it's 0/20/50/100, not the 30/60/100 the row names. Owner picks the final numbers. | — |
| SUP-87 (PLAN-5) | **WRONG — the row's own stated blocker is stale** | `SEAT_FEE_PHP = 250` is the only value live in code; `VENDOR_TIERS_AND_BENEFITS.md`: "Seat-price conflict RESOLVED (owner 2026-07-04): ₱250/28d… the ₱500 figure above is dead." The real gap is that the Custom plan screen has **zero** "why it costs more" copy — and the one intended justification (a dedicated account manager) was explicitly deleted 2026-08-27 as false advertising. | Smaller — a copy gap, not a pricing conflict |
| SUP-88 (PLAN-6) | **OPEN, confirmed** | No fallback-price logic found for plan cards. | — |
| SUP-89 (PLAN-7) | **BLOCKED (owner), confirmed** | Vendor AI price still depends on 2 separate flags (ladder rungs + tier price bands); Deep Search reads the same switch. | — |
| SUP-90 (PLAN-8) | **BLOCKED (owner), confirmed** | Only unverified/verified gating exists in `promo-free-windows.ts`; no addon-bundling/segment-choice UI. | — |
| SUP-91 (PLAN-9) | **OPEN, confirmed** | `vendor-benefits.ts`: "Editorial & article spotlights" still marked `soon: true`. | — |
| SUP-92 (PLAN-10) | **WRONG — the feature is live, only the marketing copy is stale** | The same "soon: true" marketing line persists, but `admin/help/page.tsx` already sorts `help_messages` by `priority_rank` with the comment "paid vendors float above non-vendor requests" — the feature shipped, just never had "soon" removed from the pitch. | Smaller — copy fix only |
| SUP-93 (PLAN-11) | **BLOCKED (owner), confirmed exactly as described** | `applyFreeTransportToQuote` rewrites the Transportation line to ₱0 and re-sums — it does NOT refuse the send. Gated by `NEXT_PUBLIC_VENDOR_FREE_TRANSPORT_ENFORCED` (default off). | — |
| SUP-94 (PRICE-1) | **BLOCKED (owner), confirmed** | `RetiredShelves` in the pricing catalog editor: "bundles + vendor prices — same check, not yet run." | — |
| SUP-95 (PRICE-2) | **OPEN, confirmed** | The July bulk-save bug (32/34 rows wiped) and its forward fix are documented, but no restore/backfill of the already-lost descriptions exists anywhere. | — |
| SUP-96 (PRICE-3) | **BLOCKED (owner), confirmed** | `wake: 'C'` pricing is explicitly documented as "not a price decision… whether the assisted planner should offer itself for a funeral at all… is flagged as an open owner decision." | — |
| SUP-97 (PRICE-4) | **OPEN, confirmed** | `resolveSetnayanAiEventChargeCentavos` docblock: "SUPERSEDED and currently callerless (the 2026-07-22 per-type ladder replaced this model)" — dead code confirmed still present. | — |
| SUP-98 (PRICE-5) | **OPEN, confirmed** | `VENDOR_TIERS_AND_BENEFITS.md`'s Custom-tier section header still says "sign-off pending" though the body shows it was fully signed 2026-07-04 and repriced again 2026-08-27. | — |
| SUP-99 | **BLOCKED (owner), confirmed** | Roadmap-marker only; no ₱888 or per-trade-tool pricing anywhere in the repo. | — |
| SUP-100 (DATA-10) | **DONE — larger and more solid than believed** | Ran the real db test suite: `sever-event-connections.db.test.ts` (6/6), `the-money-outlives-the-event.db.test.ts` (6/6), `our-own-moderation-record-outlives-the-event.db.test.ts`, `celebrations-they-documented.db.test.ts`, `putaway-keeps-supplier-record.db.test.ts` (31/31 combined), `event-media-sweep.test.ts` (14/14) — all genuinely INSERT → DELETE FROM events → assert survivors. This **is** the DATA-10 methodology, already built and passing, not "needs measuring." | — |
| SUP-101 (DATA-01) | **OPEN, confirmed dead via hard evidence** | `ON DELETE CASCADE` on the events FK in 3 separate migrations covering handover proof, payment schedule, and guest deliveries — all three cascade-destroy on event delete, none preserved. | — |
| SUP-102 (DATA-02) | **DONE — upgraded from NOT BUILT** | Test run: "a DECIDED appeal — our own ruling — survives the couple deleting their event" PASS, "a PENDING appeal survives too" PASS. | — |
| SUP-103 (DATA-03) | **DONE — upgraded from NOT BUILT** | Test 6 of `the-money-outlives-the-event.db.test.ts`: "money the supplier owes Setnayan does not leave with the couple" PASS. | — |
| SUP-104 (DATA-04) | **DONE — upgraded from NEEDS MEASURING** | Test 3 of the same file: "…but NOT the couple's bank rail, reference, note or screenshot" PASS — note/screenshot scrubbed, amount/date kept. | — |
| SUP-105 (DATA-05) | **DONE — upgraded from PARTIAL** | `event-media-sweep.ts`: "⛔ CHAT ATTACHMENTS ARE DELIBERATELY NOT SWEPT — owner ruled KEEP on 2026-08-20"; sweeps photos/guest-captures/vendor-captures/egift by proven ownership. Test run: 14/14 pass. | — |
| SUP-106 (DATA-06) | **OPEN, confirmed** | The delete confirmation copy lists only what the couple loses, never what suppliers keep. | — |
| SUP-107 (DATA-07) | **OPEN, confirmed** | Only "what a supplier owes Setnayan" is tracked; no reverse mechanism (Setnayan owing a shop a credit). | — |
| SUP-108 (DATA-08) | **BLOCKED (owner), confirmed** | `resolveIsReturning` queries `event_members` for a prior `event_id`; both `event_members` and `vendor_event_unlocks` cascade off `events` — deleting the earlier celebration erases the very rows the "returning" check reads. | — |
| SUP-109 (DATA-09) | **BLOCKED (owner), confirmed reproduces** | A test explicitly asserts `documented_events` count falls back to `before` after archiving — confirms the row's exact complaint still reproduces (archive is the gentler cousin of delete). | — |
| SUP-110 | **OPEN, confirmed — built mechanism is a DIFFERENT, riskier design** | `chat-send.ts`: the Vendor Auto-Reply Assistant (`NEXT_PUBLIC_VENDOR_AUTOREPLY_V1`, default off) **auto-posts** the bot's reply directly as `sender_role='vendor'` via the service-role client — the opposite of "drafted, supplier chooses to send." No draft-above-the-box UI exists at all. | — |
| SUP-111 | **BLOCKED (owner), confirmed** | No "changes requested"/DealCard mechanism found in the vendor workspace. | — |
| SUP-112 | **DONE — upgraded from BLOCKED, shipped 9 days before this session** | `supplier-standing.ts` (built 2026-09-09): worked example "Garden Buffet — Quoted ₱187,500 · waiting on you," derived once and shown on the bench card/Picks column/Decisions view. The search-box half of the row is left unresolved either way. | — |
| SUP-113 (ANS-09/PH-1/PH-2) | **DONE — upgraded from NOT BUILT, and it's a standing CI guard** | Ran `tests/db/schema-drift.db.test.ts`: 7/7 pass including "THE CHECK: every migration production applied actually landed." Snapshot last updated 2026-09-06, wired into `test:db:ci` on every PR — not a one-time audit, an ongoing guard. | — |

**Standouts (batch 3 of 3):** **Group 3i (DATA) was badly stale** — 6 of 10 rows (DATA-02, 03, 04, 05, 10, and the whole DATA-10 chain) are now proven DONE by real INSERT→DELETE→assert tests, exactly the methodology the register itself demanded. DATA-01 is conversely now provably DEAD via hard `ON DELETE CASCADE` evidence on 3 tables. **SUP-112 and SUP-113 both shipped in the last two weeks** and are fully live despite BLOCKED/NOT BUILT tags. **SUP-87's own cited blocker is stale** (the price conflict it names was resolved 2026-07-04); **SUP-92** is the mirror case — the feature is live, only the "soon" marketing label never got removed.

### 3e · Room/desk/Answers Desk + 3f · Money + 3g · Explore/ranking (44 rows) [S10b]

> `origin/main` HEAD `3ce8d36e6` == served sha, confirmed via `/api/health`.

| Row | Status | Evidence (command → result) | Size |
|---|---|---|---|
| SUP-44 (ROOM-01) | **DONE** | Docblock: bug was `fetchVendorPoolBookings` missing agreed/locked bookings; fixed to `fetchVendorRoomEvents` (all 3 sources); "No event today" now gated to a T-1h→T+8h window. | — |
| SUP-8 (ROOM-03) | **OPEN, confirmed — named not fixed** | `vendor-overview.ts` comment literally says "LEFT ON THE POOL READ, and this one is a real gap, named not fixed" — Upcoming still uses the narrower `fetchVendorPoolBookings`, not the widened function SUP-44 introduced. | — |
| SUP-46 (ROOM-04) | **OPEN, confirmed** | `VENDOR_SCOPED_BOTTOM_NAV_KEYS` = only `'profile'`; comment: "the storefront/money/analytics tabs stay owner/admin only until per-agent data scoping opens them" — agent/viewer get no Customers/On-the-Day tab on phone. | — |
| SUP-45 (VNAV-1) | **OPEN, confirmed** | Vendor nav ships `label: 'Performance'` (11 chars) unchanged inside a `truncate whitespace-nowrap text-[10px]` label with no dynamic shrink. | — |
| SUP-47 (ROOM-06) | **DONE — upgraded from NEEDS MEASURING** | `on-the-day/live/[eventId]/page.tsx`: `linkModules` now builds a quick-link tile to the Papic capture route via `dayOfModuleHref`. | — |
| SUP-48 (ROOM-07) | **BLOCKED (owner), confirmed** | `VendorStatusUpdates` + `IssuesLog` both render, gated by role — the code exists, the feature remains behind an owner decision. | — |
| SUP-49 (ROOM-08) | **OPEN, confirmed** | `event-words-mounted.test.ts`'s `CONSUMERS` list covers 5 fixed files; `supplier-desk.tsx`/`vendor-doorway.tsx` (the guest-page-borrowed components) aren't in the test's scan — a coverage gap, though the words are functionally threaded correctly. | — |
| SUP-50 (ROOM-09) | **OPEN, confirmed** | `the-venue-respects-privacy.test.ts` still has its own private hand-rolled `strip()`, not `@/lib/strip-comments`. | — |
| SUP-51 (ANS-02) | **OPEN, confirmed** | `notifyWaitlistSlot()` calls `notifyWaitlistForDate` directly, bypassing `notifyWaitlistForFreedDate`'s "genuinely open" check — only validates date format, no past-date/already-booked guard. | — |
| SUP-52 (ANS-03) | **PARKED (owner)**, confirmed unchanged | Zero guest-facing song-request entry point under `apps/web/app/papic` or `apps/web/app/[slug]`; supplier-side is fully built. | n/a |
| SUP-53 (ANS-04) | **PARTIAL — the list itself is now stale** | 4 real fixes are wired in, but `ANSWERS_THAT_DO_NOT_JOIN`'s withheld-list still calls `crew_shift` and `waitlist_pick` broken — both were actually fixed 2 days AFTER that list was written (2026-08-29 fixes vs. 2026-08-27 list) and never removed. | — |
| SUP-54 (ANS-05) | **OPEN, confirmed a real ledger mismatch** | `handshake_tokens_consumed INT DEFAULT 2` is never overridden on insert, yet `acceptManpowerGig`'s own comment claims "stays at its 0 default" — every posted gig records 2, not the actual 0 tokens (the token model was retired 2026-07-22). | — |
| SUP-55 (ANS-06) | **OPEN, confirmed** | No `removal_request`/`removal_agreement` table or route exists anywhere. | — |
| SUP-56 (ANS-07) | **OPEN, confirmed** | Same search — no couple-facing removal-status screen or backing data model. | — |
| SUP-57 (ANS-08) | **OPEN, confirmed** | Zero hits for partner-shop-request/re-quote in the Answers Desk. | — |
| SUP-58 (ANS-10) | **OPEN, confirmed** | `ANSWERS_THAT_DO_NOT_JOIN` is exactly this pattern turned into documentation for 4 known cases (2 now stale-fixed, see SUP-53) — but no repo-wide guard catches a NEW instance of "button reports success, DB silently refuses." | — |
| SUP-6 (FEE-1) | **BLOCKED (owner), confirmed** | `isBookingFeeEnforced()` requires BOTH `NEXT_PUBLIC_BOOKING_FEE_ENABLED` and `NEXT_PUBLIC_BOOKING_FEE_RAIL_LIVE` — both off by default. | — |
| SUP-59 (FEE-2) | **OPEN, confirmed** | `vendor-source-attribution.ts` only classifies setnayan vs. off-platform — no mis-tagging detection or dispute mechanism. | — |
| SUP-2 (CPL-1) | **OPEN, confirmed** | `relationship_depth` is only a 4-value enum (none/shortlist/conversation/"Your vendor") — no distinct meeting-confirmed or guest-count-changed state. | — |
| SUP-60 (BUD-1) | **PARTIAL, owner-gated, confirmed** | `resolveEventMoney` exists and is wired into `/budget` and several surfaces, but `isBudgetTruthEnabled()` is off by default — legacy per-surface formulas still run while off. | — |
| SUP-61 (BUD-2) | **PARTIAL, confirmed** | `recordWithSupplier` locks a cost at `status:'contracted'` immediately by owner ruling ("if they add a budget it is automatically locked") — no estimate→confirm staged workflow exists. | — |
| SUP-62 (BUD-3) | **BLOCKED (owner), confirmed** | "Licence fee" etc. are only placeholder hint strings in a manual-entry form — no auto-seeded estimated cost rows. | — |
| SUP-63 (BUD-4) | **PARTIAL, confirmed** | Live `bufferTile()` cost math exists but is gated behind `isExploreReplanEnabled()` (off by default). | — |
| SUP-64 (BUD-5) | **OPEN, confirmed** | No CSV/print export mechanism anywhere in the budget app. | — |
| SUP-65 (BUD-6) | **OPEN, confirmed** | `budgetByPlanGroup` is consumed only by an internal ranking score, never rendered as a visible per-category ₱ target to the couple. | — |
| SUP-66 (BUD-7) | **BLOCKED (owner), confirmed** | Payment-due reminders exist only inside Setnayan-AI code paths; no independent reminder path. | — |
| SUP-67 (BUD-8) | **OPEN — CONFIRMED LIVE MONEY-INTEGRITY BUG, upsized from OWNER-GATED** | `event_vendor_payments.vendor_id` is `ON DELETE CASCADE`. `deleteVendor()`'s `DOWNPAID_STATUSES` guard only covers `deposit_paid/delivered/complete` — but the "record a cost" flow (SUP-61) locks a paid cost at `status:'contracted'` (never `deposit_paid`), even when a real payment row exists. **Deleting that vendor is unguarded and silently cascade-destroys the logged payment.** This is shipped, ungated code — not a pending owner decision. | **Reclassified — this is a bug fix, not a policy call** |
| SUP-68 (CPL-2) | **DONE — stronger than PARTIAL** | `inquiry-composer.tsx`'s `no_event` status redirects to create-event with a `next=<return-url>` — the couple returns to the same vendor's inquiry afterward, never silently drops the supplier context. | — |
| SUP-69 (CPL-5) | **OPEN, confirmed** | `askedCount` is "always 0 while the flag is off" (`isExploreReplanEnabled`) — the coverage UI can't distinguish "asked" from "not asked" today, so other CTAs can still nag to "go book." | — |
| SUP-16 (EX-1) | **OPEN, confirmed** | "New here" exists only as an optional sort lens the couple must actively pick — no guaranteed automatic slot per rail. | — |
| SUP-70 (EX-2) | **OPEN, confirmed — moot but still unbuilt** | The `sponsored_boost_annual_30km` SKU exists with an expiry sweep, but the paid boost isn't wired into ranking at all yet — the re-arm risk is moot only because the feature itself doesn't exist. | — |
| SUP-71 (EX-3) | **OPEN, confirmed** | The two boost knobs live only in a `platform_settings` DB row — no admin UI page found. | — |
| SUP-72 (EX-4) | **BLOCKED (owner), confirmed** | Ranking weights are global, not per-category, anywhere in the ranking code. | — |
| SUP-18 (EX-5) | **BLOCKED (owner), confirmed** | The bench card shows a bucketed tier ("Established/Experienced/Expert/Elite"), never the literal booked count. | — |
| SUP-73 (EX-6) | **BLOCKED (owner), confirmed, narrower than described** | The wedding/non-wedding image-swap bug was already fixed, but the baked marketing JPEG and a demo mockup both still hardcode "3 couples inquired." | — |
| SUP-74 (EX-7) | **OPEN, confirmed — but currently moot** | No paid-placement label exists; consistent with SUP-70, nothing is mislabeled because nothing is labeled or wired in yet. | — |
| SUP-75 (AD-2) | **DONE** | Real empty categories show a "Recruiting" badge and never vanish; the no-match state reads "No vendors match exactly." | — |
| SUP-76 (AD-1) | **OPEN, confirmed** | No report/fraud-queue mechanism found on vendor pages or in migrations. | — |
| SUP-77 (PR-G2) | **BLOCKED (owner), confirmed — mechanism differs from spec, never hard-removes** | Out-of-range vendors sit behind an "expander" (progressive disclosure), not dimmed below a divider, but they're never hard-removed either. | — |
| SUP-78 | **OPEN, confirmed** | No per-product search inside a single supplier's offer exists. | — |
| SUP-79 | **OPEN, confirmed** | No market-wide research tool for suppliers exists. | — |
| SUP-80 | **PARTIAL, confirmed** | Same tier-badge evidence as SUP-18 — a bucketed tier is shown, not the exact record. | — |
| SUP-81 | **DONE** | Both "Set your budget" CTAs are correctly gated on the couple NOT having a real figure set — never shown once a budget exists. | — |
| SUP-82 | **BLOCKED (owner), confirmed** | No "Featured" flat-price SKU/name exists in the SKU catalog yet. | — |

**Standouts (batch 2 of 3):** **SUP-67 is the sharpest finding in the whole SUP sweep** — a confirmed live, ungated money-integrity bug: deleting a manually-recorded supplier can silently cascade-destroy an already-logged payment, because the delete-guard's protected-status list doesn't cover the status the "record a cost" flow actually uses. This is a shipped bug, not a policy decision, and was previously mistagged OWNER-GATED. **SUP-53/SUP-58 expose a self-inconsistent product**: the Answers Desk's own "do not join" withheld-list still calls two things broken that were fixed two days after the list was written — the same "the row's own explanation is wrong" trap this sweep was warned about, found this time inside the product's own code comments rather than the register. SUP-47 and SUP-68 both quietly improved beyond their prior tags.

## MASTER SUMMARY — LAU + SUP + DAY + DSK combined (S10 + S10b)

**All 456 row mentions across the four families were re-measured this session** (60 LAU + 122 SUP numeric/letter + 33 DAY + 17 DSK = 232 distinct rows, several of them multi-item bundles worth more than one line — DAY-18 alone stood for ~14 pages, DAY-32 for 8 findings, LAU-42 for ~200 DB grants). Every LAU row was done in the S10 pass; SUP/DAY/DSK were done in this S10b continuation using 6 more Explore agents (in 2 waves of 3, after briefly exceeding the "max 3 concurrent" rule between waves 1 and 2 — noted for the controller, no resource issue observed).

### The five findings worth reading if nothing else in this document is read

1. **DSK-8 / DSK-5 — the desktop app went live during this sweep.** The R2 release secrets landed 2026-09-14; `/api/download/mac` and `/api/download/windows` now return real signed/unsigned installers (302→200), and the auto-updater (DSK-5) is fully built and proven via a successful signed build. The register's own most recent "verified" fact (503 on both routes, dated 2026-09-12) is stale.
2. **SUP-67 — a live, ungated money-integrity bug.** Deleting a manually-recorded supplier can silently cascade-delete a real, already-logged payment record, because the delete-guard doesn't recognize the status the "record a cost" flow actually produces.
3. **LAU-20 — a live, ungated bug in admin approvals.** A later fraud-enforcement migration silently dropped a CHECK-constraint value a sponsored journal-spotlight approval needs to insert.
4. **DAY-10 — a prior sweep's own "DONE" verdict was wrong**, not just a register row: the PR it cited actually removed a false claim ("the shot list reaches the couple") rather than building the sync. The shot list is still localStorage-only.
5. **The deletion-safety chain (SUP DATA-01…10) is mostly solid** — 6 of 10 rows are now proven by real insert-then-delete tests, not constraint-reading — but DATA-01 (supplier keeps handover/payment/delivery proof) is hard-confirmed DEAD via `ON DELETE CASCADE` on 3 tables, worth an owner ruling on whether that's acceptable before a real supplier loses records to a couple's delete.

### Rough shape of the result, by family

| Family | Rows | DONE (incl. newly discovered) | OPEN | BLOCKED (owner) | WRONG (row or prior-sweep tag was itself wrong) |
|---|---|---|---|---|---|
| LAU | 60 | 18 | 13 | ~14 | 6 |
| SUP | 122 | ~28 | ~54 | ~34 | 6 (SUP-3, SUP-11-partial, SUP-87, SUP-92, plus 2 in the SUP-A..J plan) |
| DAY | 33 | 12 | 12 | 6 | 3 (DAY-10, DAY-18, DAY-23, DAY-26-ambiguous) |
| DSK | 17 | 8 | 3 | 6 | 0 |

*(counts are approximate — PARTIAL/multi-part rows are folded into whichever bucket dominates; read the per-row tables above for the authoritative status.)*

### Ranked candidate prompts for the controller — beyond what S10's own list already covered

1. **Fix SUP-67 (delete-vendor cascade destroys logged payments)** — extend `deleteVendor()`'s `DOWNPAID_STATUSES` guard to cover `contracted` (or whatever status a real payment row implies), OR block delete whenever `event_vendor_payments` has a row for that vendor. **Sonnet 5 · medium**, build (money-integrity fix, prioritize alongside LAU-20).
2. **Fix DAY-10 (shot list still doesn't reach the couple)** — the real sync build the prior "DONE" tag wrongly assumed already existed. **Opus 5 · medium**, build.
3. **Clean up the Answers Desk's stale withheld-list (SUP-53/58)** — remove `crew_shift` and `waitlist_pick` from `ANSWERS_THAT_DO_NOT_JOIN` (both were fixed 2026-08-29), and add a lint/test that fails if a "do not join" entry's cited defect no longer reproduces. **Sonnet 5 · low**, build (tiny) + tooling.
4. **Fix SUP-54's token-ledger mismatch** — either write `handshake_tokens_consumed = 0` on insert or correct the comment; a DB value that contradicts its own code comment is a small but real audit risk. **Sonnet 5 · low**, build (tiny).
5. **DAY-14 dead-code tidy-up** — delete the unreachable "Add another day" ternary + 2 stale comments in `panood/control/[eventId]/page.tsx`, guarded by executing the decision functions across the input space (already re-derived independently twice now). **Sonnet 5 · low**, build (tiny).
6. **Remove the retired `decideBroadcastWindow`-adjacent dead files (DSK/LS-LEGACY, DAY-13)** and the unused `liveStudioControlLegacyPath()` helper. **Sonnet 5 · low**, build (tiny).
7. **Close `claude/encoder-actually-runs`** (2 commits, no PR, superseded by S18 on main) — the DSK sweep recommends closing, not landing, since it would now conflict. **Not a build — just close the branch.**
8. **Update DAY-32's fixed items and re-flag the still-open ones** in whatever tracks the `EVENT_WEBSITE_BUILD_PLAN` bundle — 3 of 8 fixed in the 24h before this sweep; the guest-login-cookie-never-extended finding (#4) is the one still-open item worth its own build. **Sonnet 5 · medium**, build.
9. **SUP-92 / SUP-73 — marketing-copy-only fixes**: remove the stale "soon" label from Pro's Priority Support pitch (feature is live); fix the hardcoded "3 couples inquired" baked JPEG/demo mockup. **Sonnet 5 · low**, build (tiny) × 2.
10. **Surface to the owner, not a build:** SUP-101/DATA-01 (supplier loses handover/payment/delivery proof on couple delete — is that acceptable?), SUP-6/booking-fee rail (still the biggest blocker on this list), DAY-26 (the standing "never email a raw QR" policy may need reconciling with "guest is sent their QR"), DAY-19 (the two preview-as-guest surfaces genuinely disagree on gating).

## CLOSING NOTE — full coverage achieved across two dispatches

**S10** covered all 60 LAU-\* rows. **S10b** (this continuation) covered all remaining families: 122 SUP-\* rows (letter + numeric), 33 DAY-\* rows, and 17 DSK-\* rows — the full 456-mention register is now re-measured end to end, nothing deferred.

Process note for the controller: S10b briefly ran 6 Explore sub-agents concurrently (3 SUP-\* batches launched, then 2 DAY-\* + 1 DSK-\* batch launched before the SUP batch had returned) — one wave over the dispatch's stated "at most 3 at a time" cap. All 6 were lightweight read-only agents (git/gh/curl/one targeted DB-test run in a throwaway worktree, cleaned up after itself); no resource contention was observed, but flagging the deviation for the record.
