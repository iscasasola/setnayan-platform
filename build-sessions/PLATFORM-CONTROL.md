# PLATFORM CONTROL — the charter for everything the Redesign group does NOT own

> Owner, 2026-09-22: *"plan everything left for this session and we want minimal merges, combine
> different builds that will work together seamlessly"* · *"check if some of those builds are already
> built and designed better. remove the ones that is no longer needed"*
>
> Sibling to `REDESIGN-CONTROL.md`, which already holds the Redesign sidebar group under the same
> one-bundle-one-merge rule. **This file covers the remaining territory only.** The two must never
> plan into each other.

⚠ **This document is a claim; the tree is the evidence.** Re-measure with
`build-sessions/merge-control.sh` before acting on any line in it.

Measured 2026-09-22 03:10 UTC against `origin/main` `af3c77dc8`.

---

## 1 · The territory split — what is already owned

`REDESIGN-CONTROL.md` enrols **seven** sessions. Their surfaces are off-limits to this charter, and
the register sections that sit on those surfaces are **not** planned here:

| Redesign session | owns | register sections it covers |
|---|---|---|
| Login popup / profile setup | `app/signup/`, `app/login/`, profile settings | — (the "contested sign-up file") |
| Event Your Team | event team | part of 3f |
| Vendor dashboard | `app/vendor-dashboard/` | **3e** (15) · **3h** (10) · part of 3b |
| Papic controller | papic lib, wall, camera | **GROUP 4** (15) |
| Service card & quotation maker | service cards, quote maker | **3d** (16) |
| Event chatbox | chat frame + both registries | **3j** (2) |
| Event Overview | event overview | part of **GROUP 5** |

**≈ 85 register rows are already someone's.** Building them here would collide by construction.

🪤 **The collision is not hypothetical.** `apps/web/app/signup/actions.ts` — the file that charter
calls contested — turned **#5867 CONFLICTING** at 03:10 today. Resolved by merging `origin/main` in
the worktree and re-running the tests there, not by hand-editing.

---

## 2 · Rows to delete from the register — measured, not assumed

The register is dated 2026-09-21 and is **already stale in its own §H**: its top two recommendations
are both done. Confirmed by command, not by reading:

| row | claim | measurement | verdict |
|---|---|---|---|
| **ST-1** | "open the PR on `claude/no-client-value-in-server-tree`" | that branch is **PR #5473, MERGED**; the remote ref is gone | ❌ DELETE |
| **PAP-1** | "land commit `1ca4989f8c`, stranded since 08-31" | `git merge-base --is-ancestor 1ca4989f8c origin/main` → **LANDED** | ❌ DELETE |
| **DAY-33** | "couple pins the website to one phase" | `manual_phase` / `launch_mode` read since **PR #5641**, 13 files | ❌ DELETE |
| **SUP-76** (AD-1) | "a signed-in person can report a shop" | built in **#5867** (`20271240604358_a_couple_can_report_a_shop.sql`), in flight | ❌ DELETE (in flight) |
| **SUP-98** (PRICE-5) | "pricing documents stop calling settled things open" | **#5868 merged** today (`COUPLE_COMMISSION_PROMISE`, the two pricing pages point at each other) | ❌ DELETE |
| **SUP-113** (ANS-09 ⇄ PH-1 ⇄ PH-2) | "prod and repo agree on every table's shape" | **the same build as LAU-28 + LAU-29**, listed twice under two territories | ❌ COLLAPSE into LAU-28/29 |
| **DAY-13** (LS-LEGACY) | "the old Cast screens are retired" | `CastScreen` → **0 hits on main**; the named thing no longer exists | ❌ DELETE (verify the row did not mean something else) |
| **LAU-53 · LAU-54 · LAU-55** | three stale-PR / stale-branch rows | these are **land-or-close decisions**, not builds | ↪ move to the owner's desk |
| **I-13**, **PAP-21** | "parked branch holds finishing touches" | same shape — decide land-or-close first | ↪ decide, do not build |

**≈ 11 rows removed.**

### ⚠ The limit of this pass, stated plainly

**Only 9 of 19 register sections carry a `Re-measure` column at all** — roughly 139 of 217 buildable
rows have **no command to run**. And a file-count grep cannot separate "exists" from "correct":
probing `chapters` returned 172 files, `scheduled` 224, `live-studio-window` 29. Those numbers are
not evidence ([[a-count-of-a-symmetric-quantity-is-not-evidence]]).

🔑 **So a full re-measure of all 217 rows is itself a build-sized job, and this pass did not do it.**
What it did is delete every row it could kill with a decisive command. **Every bundle below therefore
opens with a RULE 0 gate** — re-measure each row before building it — rather than trusting this file.

---

## 3 · The bundles — 9 merges for ~110 rows

One bundle = one disjoint file tree = **one branch → one PR → one merge**. Same rule as the Redesign
charter: sessions build and report, the controller folds and opens the single PR.

| # | bundle | rows | tree it owns | notes |
|---|---|---|---|---|
| **W1** | **Platform floor & security** | 6c (14) + LAU-42/43 ≈ 16 | `supabase/migrations/`, `supabase/security/`, repo guards | **holds migrations — nothing else may, concurrently** |
| **W2** | **Privacy, deletion & compliance** | 6a (12) + 3i (8) = 20 | `(shell)/privacy/`, `lib/erasure/`, deletion jobs, CSP | **after W1** — both touch erasure. Owner is DPO; verify against the **database** first |
| **W3** | **Admin console** | 6b (9) | `app/admin/` | a new admin page must join **four** registries |
| **W4** | **Public web — marketing, SEO, store** | 6d (7) | marketing pages, sitemap, `/features` | `/features` must say only what ships |
| **W5** | **Story** | GROUP 2 (18, less ST-1) = 17 | story desk, `/api/og/realstory-slug`, 3D kit | the OG routes are a **second visibility surface** |
| **W6** | **The Day & Live Studio** | GROUP 5 less Overview & DAY-33 ≈ 20 | `dashboard/[eventId]/`, live console, Live Studio | check each row against the Event Overview session first |
| **W7** | **Explore & the marketplace shelf** | 3g (12) | `(shell)/explore/`, ranking lib | **after** Redesign's quote-maker wave — the card render is shared |
| **W8** | **Invite themes** | GROUP 1 (13, less I-13) = 12 | `[slug]/invite/`, `lib/invite-themes.ts` | 🔒 **strictly serial inside**: Velvet → Galeriya → Abaca. One session, one PR |
| **W9** | **Desktop & encoder** | GROUP 7 (10) | `src-tauri/`, download page | fully disjoint, can run any time. CI only compiles `-p setnayan-encoder` |

`6e · Ops` (6) is not app code — dependabot alerts, stale PRs, docs debt. It rides with W1 or goes to
the owner's desk; it does not need a slot.

**9 merges instead of ~110.**

---

## 4 · Running order — 3 slots, never more

This Mac has 16 GB; three concurrent `tsc` runs shut it down. One heavy job at a time, machine-wide,
through `~/Documents/Claude/Projects/heavy-lock.sh`.

```
slot A   W1 platform floor  →  W2 privacy & deletion        (serial: both own erasure + migrations)
slot B   W5 story           →  W6 the day & live studio
slot C   W9 desktop         →  W3 admin  →  W4 public web
later    W8 invite themes   (long, serial inside; start when a slot frees)
last     W7 explore         (gated on Redesign's quote-maker wave landing)
```

---

## 5 · The rules that make a bundle merge cleanly

1. **Own worktree, branched off `origin/main`** — `git worktree add ../wt-<slug> -b pf/<slug> origin/main`. Never branch from the repo checkout; never read code from `/Users/icecasasola`.

   🪤 **Name it `pf/…`, NOT `claude/…`, whenever you want a preview to look at.** `apps/web/vercel.json`'s `ignoreCommand` opens with `case "$VERCEL_GIT_COMMIT_REF" in claude/*) exit 0;;` — exit 0 means *skip the build*, so **every `claude/*` branch silently gets no Vercel preview** and reports "Canceled by Ignored Build Step". Verified by reading the file, after the Redesign controller proved it by pushing a `rd/preview-probe` that built a real preview while an identical `claude/*` branch did not. (`rd/` is the Redesign group's prefix; `pf/` is this charter's.)
   ⚠ `R2_PUBLIC_URL` and `ENCRYPTION_KEY` are **Production-only**, so a preview renders without them. Everything else — Resend, the Supabase trio, the R2 keys — is in both scopes.
2. **One commit per build**, named for the build — so a bad one can be `git revert`ed surgically.
3. **Do not push, do not `gh pr create`, do not arm auto-merge.** Report READY to the **REDESIGN CONTROLLER** (`local_764dda74-bc29-4889-9fde-2910dbb760ef`), which owns conflict resolution for this territory too (owner, 2026-09-22: *"all conflicts on their builds will be passed on to you"*). Bring it conflicts — never improvise a merge.

   ⛔ **The shared chat frame belongs to one session per wave — tell the controller BEFORE you start if a build reaches it:** `chat-message-stream.tsx`, either thread page, `lib/vendor-thread-tools.ts`, `lib/chat-box-tools.ts`. The couple's chat panels are derived from the supplier's registry **by import**, so editing one silently changes the other in a route nobody is looking at. None of W1–W9 should reach it; if one does, that is a sign the bundle is drawn wrong.
4. **Prove it**: a pure decision module, a test that EXECUTES it, and a sabotage you **watched turn red**. A guard you did not watch fail is a hypothesis.
5. **Migrations** — allocate forward with `pnpm migration:new`. Only W1 holds them at a time. Never apply one directly to prod; never run `supabase migration repair`.
6. **Generated baselines** (`*baseline*`, `supabase/security/*`) — regenerate **on the merged tree**, never hand-merge. After any `git merge origin/main` on a migration branch, check the header against the body.
7. **`CREATE OR REPLACE FUNCTION`** — diff against the function's **latest** definition, never its first: `git grep -l '<fn>' origin/main -- supabase/migrations | sort | tail -1`. This cost #5867 a red CI run and silently reverted a privilege-escalation fix.
8. **Changelog fragment per build**, unique filename — a unique fragment can never conflict.
9. **RULE 0 gate first.** Before building any row, run its re-measure; and run the in-flight checks — `gh pr list --state open`, `git worktree list`, `git log origin/main --oneline -15`.

---

## 6 · Still on the owner's desk, blocking nothing here

- **One real signup** on setnayan.com with a throwaway address — the Supabase SMTP change is saved and `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION="true"` is live in Production, but **no mail has been sent since the change**, so the path gating every new account is unproven. If none arrives, set the flag back to `false`.
- The **41 OWNER-GATED** register rows — questions in `02_OWNER_DESK.md`, not engineering.
- **A1 · A2 · A3 plus opening a Capiz invite on a phone** — the register's highest-ratio item: it releases SUP-A…SUP-D and closes I-1/I-2.
- Land-or-close on `claude/encoder-actually-runs`, `claude/event-hub-pro-invite-finish`, PR #5405, #4471/#4472.

---

## 7 · W1 OUTCOME — measured 2026-09-22, branch `pf/platform-floor`

**14 rows in. 12 resolved, 1 deferred to W6, 1 flagged to the owner. 5 builds committed.**

🔑 **8 of the 14 were ALREADY BUILT.** The register's "NOT BUILT / PARTIAL" column ran at
roughly 55% false in this section. The gate cost more than the building, and that is the
finding, not an aside: for the remaining bundles, budget the re-measure as the main work.

| row | verdict | evidence |
|---|---|---|
| LAU-28 | ✅ BUILT (this branch) | snapshot refreshed 1351 → 1478, gap 0; full check passes against prod |
| LAU-29 | ✅ BUILT (this branch) | "HONEST LIMITS" corrected — nullability IS compared; defaults still a stated hole |
| LAU-30 | ✅ BUILT (this branch) | 11 units of debt paid, 366 → 359; slack bounded at 12 |
| LAU-31 | ⛔ already built | the ratchet was inherited 2026-09-18, four days before the register called it NOT BUILT |
| LAU-32 | ⛔ already built | 12 route shapes probed on prod, all real 404s; `/vendors/<x>` 308 → `/explore/<x>` 404 is a correct section redirect |
| LAU-33 | ⏭ DEFERRED TO W6 | measured and specified below — the fix lands in `app/[slug]`, which is W6's tree |
| LAU-35 | ⛔ already built | prod serves stable unsigned `pub-*.r2.dev` URLs via `/_next/image`; **0** `X-Amz-Signature` |
| LAU-36 | ✅ BUILT (this branch) | closed-set gate over 4,122 files; 4 drifted readers converted |
| LAU-37 | ⛔ already built | `STATUS.md:202` already points at `OWNER_ACTIONS.md` |
| LAU-39 | ◑ PARTIAL, not a live defect | sweep covers `youtube`+`drive` and both prod grants are unexpired; TikTok is an honest `provider_not_yet_implemented` stub and prod has **zero** tiktok grants |
| LAU-40 | ⛔ already built | one exported `resolveGuestSessionSecret`, 11 passing tests |
| LAU-41 | ⛔ already built | SW intercepts only day-of guest navigations; `app/sw-reserved-routes.test.ts` guards the list |
| LAU-42 | ⛔ already built | 2026-08-11; verified in prod via `pg_class.relacl` — the unredacted twin has no anon grant |
| LAU-43 | ⛔ already built | `chat_messages_derive_sender` attached BEFORE INSERT and enabled in prod |

### LAU-33 — specified here, build it in W6 with DAY-32

`app/[slug]/_lib/loaders.ts` computes `liveWall` inside a `try`, and the failure path is:

```js
} catch { liveWall = null; }
```

`null` also means "the couple does not own LIVE_WALL" and "the mirror setting is off". So a
refused or timed-out read renders **byte-identically to a deliberate off-state**, and the
section simply vanishes with no signal to anyone. Same disease as the guest-list defect closed
on 2026-08-19 and the supplier side closed on 2026-08-18.

Follow the existing precedent rather than inventing a shape —
`lib/guests-read-is-honest.test.ts` and `app/vendor-dashboard/reads-are-honest.test.ts`.
🔑 Its rule 2 is the one that bites: **the measurement must reach the RENDER.** The error here
is not even bound, so there is not even a log line today.

### ⚖ For the owner — not a defect, a scaling question

Production serves every vendor photo from **`pub-37d64fe618584c2981a88610a55dd439.r2.dev`**,
Cloudflare's default R2 public dev hostname. It works and the addresses are stable, which is
why LAU-35 is closed. But Cloudflare documents `r2.dev` as **development-only and rate-limited**,
and recommends a custom domain for production traffic. Moving to one is an owner decision with
a DNS change at GoDaddy behind it — flagged, not actioned.

---

## 8 · W2 OUTCOME — `pf/privacy-deletion`, stacked on W1

**20 rows in. 4 built, 11 already built, 3 owner-held, 2 superseded.**

Same headline as W1, slightly worse: **11 of 20 were already done.** The privacy
and erasure machinery is the best-documented code in this repo — `coverage.ts`,
`coverage-guardrail.test.ts`, `erasure-completeness.db.test.ts` (41 assertions,
the real purge against the real replayed schema), `periodic-job-registry.ts`.
Nearly every row that looked open had been closed and the register had not caught up.

| row | verdict | evidence |
|---|---|---|
| LAU-3 | ⛔ already built | `/privacy` names OpenAI, Anthropic, Supabase, Cloudflare, Vercel, Resend |
| LAU-4 | ⛔ already built | "no personal identifiers" appears **0** times on the live page |
| LAU-5 | ↩ SUPERSEDED | `consent_withheld`/`faceblock_withheld` have ZERO writers — confirmed independently — but `papic-guest-blur-gate.ts` solved the real problem a third way. Retiring the CHECK values is cosmetic and carries re-list risk |
| LAU-6 | ✅ BUILT | prod: 0/5 access tokens plaintext, **5/5 refresh tokens still `1//…`** — the sweep opened the refresh token and wrote back everything except it |
| LAU-8 | ⛔ already built | `export-coverage-guardrail.test.ts` 16/16 |
| LAU-10 | ⚠ REAL, open | the full CSP is **report-only**; only `frame-ancestors`/`frame-src` are enforced |
| LAU-11 | ⛔ already built | `deletePhotoForever` deletes all **ten** derived files from a list shared with the celebration sweep, proves tenant scope, orders objects-before-row |
| LAU-12 | ⛔ already built | every retention job in prod: `ok=true` with a real `finished_at` |
| LAU-15 | ✅ BUILT | `dpo@setnayan.com` replaces a personal Gmail in 22 places across 10 published surfaces |
| DATA-03 | ⛔ already built | `an-ask-outlives-the-celebration` — the shop's bill survives, with its amount |
| DATA-04 | ⚖ OWNER | `deposit_proof_url` is never erased. Deleting it destroys the supplier's proof of payment, which DATA-01 requires. Recorded as a DPO question, not resolved |
| DATA-10 | ⛔ already built | `erasure-completeness.db.test.ts`, 41 assertions |

### The two builds worth re-reading

**`DPO_QUESTIONS` was cited twice and had never existed in any commit.** Two live
retention decisions were justified by a document nobody wrote. Under RA 10173
§16(e) a controller declining to erase must state the basis; the failure was
silent **because a comment cannot fail to compile.** The register exists now, and
a guard requires every citation in `lib/erasure/` to resolve.

**The long-lived secret was the one left in the clear.** The refresh sweep sealed
the token that expires in an hour, on every run, and left the one granting ongoing
access to a couple's YouTube and Drive as plaintext `1//…` in every backup. One
field on an UPDATE already happening.

### 🛑 The mistake, recorded because the reasoning matters more than the fix

I added a clock-based "this job has not run recently" alarm to `classifyJobRun`.
**Two tests exist specifically to prevent it**, with a measured example:
`samahan-story-sweep`, hourly gap, idle 10d21h — and correct, because nobody had
opened the page it rides on and its table held zero rows. One of those tests is
named *"classifyJobRun cannot see a cadence, so it cannot compare one to the
clock."* I reverted inside a minute.

🔑 **On a traffic-claimed job, idle is the normal state, not a symptom.** The
right shape is data-based — *is anything past its promised deletion date?* — and
production says zero face rows and zero events older than three months, so it is
**not buildable yet**. It becomes buildable when the first event passes three
months, and it must key off pending rows, never off the clock.

### Owner-held out of W2

- **`dpo@setnayan.com` must exist before this merges** (iCloud+ Custom Email Domain).
- **DATA-04** — does a couple's erasure remove the supplier's proof that a deposit was paid? Both interests are lawful.
- **NPC task `t0-3` remainder** — one DSR SLA (the live page says 15 business days, the packs say 7) and one device-fingerprint live/off state.
- ⚖ DMARC `rua` reports go to `dmarc_rua@onsecureserver.net`, GoDaddy's default, not to the owner.

---

## 9 · W3 OUTCOME — `pf/admin-console`, stacked on W2

**9 rows. 2 built · 3 already built · 1 owner-held · 3 not built (2 substantial).**

| row | verdict | evidence |
|---|---|---|
| LAU-19 | ✅ BUILT | the four-eyes vocabulary gated **six privilege actions and no money**; `comp_grants.approved_by` existed and was null on every row |
| LAU-20 | ✅ BUILT | a paid journal spotlight could be requested, was listed, and **threw on approve** |
| LAU-18 | ⛔ already built | `admin-records-in-search` 10/10 · `admin-rows-in-search` 13/13 |
| LAU-22 | ⛔ already built | `setSlotLabel` renames any slot; blank reverts to the code default |
| LAU-23 | ⛔ already built | `lint-colour-exists.mjs`: *"every colour utility resolves (50 palette keys known)"* |
| LAU-24 | ⚖ OWNER (DPO) | see below — the control exists and **cannot fire** |
| LAU-16 · LAU-17 | ◻ not built | an "ask" escape hatch and command palette exist; form-fill coverage per page is unmeasured |
| LAU-26 | ◻ not built | no bank-alert matcher exists; needs bank access, so owner-gated in practice |

### ⚖ LAU-24 — the trial check that cannot fire

`detectConciergeAbuseSignals` matches on **phone only** ("V1 catches phone
matches only"). Measured in production: **17 users, 0 with a phone**, and the
column is nullable. So the branch never executes and the assisted-planner free
trial is farmable with a new email.

**Not built deliberately.** Every additional signal — device hash, IP, payment
instrument — is personal data the privacy notice must declare, and the
device-fingerprint live/off state is already an open item inside NPC filing task
`t0-3`. Widening an anti-abuse signal set is a DPO decision, not a bugfix.

### What LAU-19 turned out to be

Not a missing feature — a **misaimed** one. The mechanism was complete and
enforced in the database (`admin_approval_four_eyes`), and pointed entirely at
privilege: internal accounts, team pool, admin promotion, fraud bans, spotlights.
A single admin could still extend a paid entitlement and write
`retail_value_centavos`.

🔑 **The schema had already decided.** `comp_grants.approved_by` was built for a
second admin and handed `null` on every grant. The column was the specification.

⚠ **And the CHECK was re-listed from PRODUCTION, not from the migration history.**
`approve_vendor_subscription` appears in a migration in this repo and is **not**
in the live constraint — re-listing from history would have added a value
production never had. A re-listed CHECK is only as good as where the list came from.

⚠ Refunds and payout-account changes — the other two LAU-19 names — are **still
single-admin**. Only comps are gated.

---

## 10 · W4 OUTCOME — `pf/public-web`, stacked on W3

**7 rows. 1 built · 3 already built · 3 substantial feature builds, not bundle work.**

| row | verdict | evidence |
|---|---|---|
| LAU-45 | ✅ BUILT | `/open-shop` was advertised in the sitemap and **307s a crawler to /login** |
| LAU-44 | ⛔ already built (the claims half) | `features-page-says-what-ships.test.ts` 2/2 · `one-explainer-page.test.ts` 13/13. The *editorial redesign* half is design work |
| LAU-49 | ⛔ already built | `googleDnsTxtVerified()` resolves the real TXT record and suppresses the nag; wired at `seo-cron-jobs.ts:95` |
| LAU-45 (second half) | ⛔ already built | `/alaala` IS indexed; the index is healthy at 192 URLs |
| LAU-46 · LAU-47 · LAU-48 · LAU-51 | ◻ substantial | shell migration for ~8 public pages · a real Paprint checkout · Setnayan-AI watch alerts · Tagalog/Cebuano UI. Each is a feature, not a bundle row |

### What LAU-45 turned out to be

The sitemap entry carried its own note: *"was orphaned (indexable but in no
sitemap); added 2026-07-10."*

🔑 **That note was the mistake.** "Indexable" was half-measured — whoever checked
confirmed the route EXISTED and never fetched it signed out. `open-shop/page.tsx`
does `if (!user) redirect('/login…')` and **every crawler is signed out**. So for
two and a half months the supplier funnel was advertised to Google as a login page.

**A page you can see while logged in tells you nothing about what a crawler gets.**

Nothing was lost by removing it: `/vendors` is the public face of that funnel, is
indexed, and links onward. A sitemap lists what a stranger can READ, not every
door an authenticated person can walk through.

---

## 11 · W5 OUTCOME — `pf/story`, stacked on W4

**17 rows. 1 built (not a register row) · 3 already built · 13 need the BuildFinale corpus sweep.**

| row | verdict | evidence |
|---|---|---|
| ST-9 | ⛔ works | `/api/og/realstory-slug/songdesk-story-proof` → **200 · image/jpeg · 53 KB** on a published, public story |
| ST-10 | ⛔ resolved | its re-measure (`git grep "TO REVIEW" -- apps/web/scripts`) returns nothing; the guard exemption is gone |
| ST-11 | ⛔ already built | `lib/the-moment-x-is-a-fingers-width.test.ts` covers `story/_components/make-it-yours.module.css` |
| ST-12 … ST-18 | ◻ unmeasured | their re-measure is *"BF corpus_sweep.md Story area"* — a document not in this repo |
| ST-2 · ST-3 · ST-5 · ST-7 · ST-8 | ◻ owner-data | their re-measure names specific prod rows / evidence files |

### 🛑 A mistake worth more than the build

I read ST-11's prose, **guessed a symbol**, found 28×28 controls in the *website
photo-moments* editor, fixed them, guarded them, sabotaged the guard, and
committed — and only then ran the row's own re-measure, `git grep -n "moment-row"`,
which shows **ST-11 was already fixed** in a different file.

🔑 **The defect SHAPE repeats across a codebase, so a guessed symbol reliably
finds a real instance of the wrong thing.** Both were genuinely undersized. The
fix stands on its own merit and the commit was amended to say so — but it closes
no register row, and had it stayed mislabelled it would have marked ST-11 done.

**Every remaining bundle: run the row's `Re-measure` FIRST.** Only 9 of 19
sections carry that column; extract them mechanically rather than reading prose.

⚠ And a dead re-measure returns nothing, which reads exactly like "already
fixed". ST-11's anchor (`moment-row`) is a class that no longer exists — knowable
only because whoever fixed it wrote that into the guard's docblock.

### What the existing guard records, for anyone touching touch targets here

Two standard fixes are recorded as **failures** on that control: an invisible
halo (*"spread over a neighbour, it took off the wrong photo"*) and a bare global
44px min-height (*"on this 26px circle that drew a tall oval that reached over the
words"*). Both are safe on a `rounded-md` square with `min-h-11` AND `min-w-11`
set together; neither is safe on a `rounded-full` circle, or where insets can
overlap a sibling.

---

## 12 · W6 OUTCOME — `pf/the-day`, stacked on W5

**~25 rows in scope. 1 built · 4 already built · the rest are bundles or owner-data.**

| row | verdict | evidence |
|---|---|---|
| LAU-33 | ✅ BUILT | `catch { liveWall = null }` made a refused read byte-identical to "not owned" and "mirror off"; the error was not even bound |
| DAY-1 | ⛔ already built | `advance_schedule_block` has FOUR authz arms (host/couple ∪ delegate coordinator with `schedule:edit` ∪ the booked coordinator ∪ admin) and a documented warning never to widen the third to all vendors |
| DAY-9 | ⛔ configured | `NEXT_PUBLIC_VENDOR_DAYOF_FREE_UNTIL` **is set** in Production (8 days ago) |
| DAY-14 | ⛔ already built | every "add another day" hit in `app/`+`lib/` is a COMMENT describing the removal |
| DAY-33 | ⛔ already built | deleted from the register in §2 |
| DAY-18 · DAY-29 · DAY-32 | ◻ bundles | ~14, ~40 and 8 units respectively, explicitly "never split" |
| DAY-3 · DAY-4 | ↪ Group 1 | their re-measure says *"check Group 1"* |
| the rest | ◻ no command | their `Re-measure` cell is `—` |

### LAU-33 — the failure that impersonated a setting

`null` was carrying three meanings: "not owned", "mirror off", and "the read
failed". So an RLS denial or a statement timeout rendered **byte-identically to a
deliberate off-state** — the section was simply absent — and because the error
was never bound, there was no log line either. A wall could break at a wedding
and leave no trace anywhere.

Fixed in three parts, because **a log line never changed a pixel**: the loader
binds and raises, the value is returned, and `site-body.tsx` has a render arm at
the same anchor id so the event-day bar's "Photos" button still lands somewhere
that explains itself. The decision lives in a pure module so it is EXECUTED, not
regex-asserted.

⚠ It does not make the wall appear. It stops the failure impersonating a setting.

### 🪤 A memory note corrected while measuring DAY-14

A stored note said `lib/live-studio-window.ts` was **deleted**. It is 182 lines
on main and now implements LS6 itself. **The MODEL was retired; the FILE was
rewritten in place.** Those are different facts and only one survives an `ls` —
a session trusting the old wording would find the file present and conclude the
per-day model was back.

---

## 13 · 🪤 A PUSH CAN LOSE A RACE WITH ITS OWN PR

**Measured 2026-09-22.** `pf/the-day` had PR #5884 open and armed. I pushed a
follow-up typecheck fix to the same branch. **#5884 merged the commit before it
and closed** — so `pf/platform-floor` took the change WITHOUT its fix, and the
trunk (#5877) went red on exactly the errors already fixed on disk.

🔑 **A stacked PR merges into its parent, where branch protection does not
apply.** #5884 merged while carrying a failing check (`f=1`), because protection
guards `main` only. The chain's speed is the whole point of stacking — and it is
also why a late push can miss the boat.

**Rules that follow:**

1. **Do not push a fix to a branch whose PR is already armed.** Check first:
   `gh pr view <n> --json state,autoMergeRequest`. If it is armed and green, open
   a NEW PR for the fix instead of pushing.
2. **After any stacked merge, re-check the PARENT, not your branch.**
   `git log origin/pf/platform-floor..origin/<yours> --oneline` — anything listed
   did not make it and needs its own PR.
3. **A red check on a stacked PR does not block it.** Only the trunk's PR to
   `main` is protected. Treat a stacked merge as unreviewed by CI.

---

# §14 · SESSION OUTCOME — 2026-09-22

**Seven stacked PRs merged into `pf/platform-floor`; one trunk PR (#5877, 33 commits) carries
them all to `main` as ONE merge.** #5878 · #5879 · #5880 · #5882 · #5883 · #5884 · #5886.

## The builds, in order of what they would have cost

| what | where it was |
|---|---|
| **Google refresh tokens were plaintext in every backup** | 0 of 5 access tokens exposed; **5 of 5 refresh tokens** still `1//…`. The sweep OPENED them to call Google and wrote back everything except them — sealing the secret that dies in an hour and leaving the one that grants ongoing access to a couple's YouTube and Drive |
| **A single admin could move money** | the four-eyes vocabulary gated six PRIVILEGE actions and no money. `comp_grants.approved_by` already existed and was `null` on every row — the schema had decided; nobody wired it |
| **A paid spotlight could be requested but never approved** | the single-admin path refused it and said "use the sponsored queue"; that queue listed it and threw. Revenue-blocking |
| **The DPO contact was the owner's personal Gmail** | 22 places across 10 published surfaces, including the JSON-LD search engines read |
| **`DPO_QUESTIONS` was cited twice and had never existed** | two live retention decisions justified by a document nobody wrote. Silent, *because a comment cannot fail to compile* |
| **The download page promised Apple notarization** | `stapler` + `spctl` on the real `.dmg`: signed ✓, notarized ✗. It told couples to double-click a file Gatekeeper refuses |
| **The sitemap advertised a page every crawler is redirected away from** | `/open-shop` 307s to `/login`; the supplier funnel was advertised to nobody for 2½ months |
| **The live photo wall vanished identically to a setting** | `catch { liveWall = null }`, error unbound. A wall could break at a wedding and leave no trace |
| **The CSP could not be enforced without breaking face matching** | and the violation table named only ONE of the two hosts `face-gate.ts` loads |
| **A flag guard that could never fail** | `assert.ok(Array.isArray(strict))`. Four readers had drifted in behind it |
| **The prod schema snapshot was 124 migrations stale** | the guard replayed the snapshot's own ledger against its own columns — self-consistent and blind |
| **A stale baseline entry is permission** | 8 entries / 11 units of unread-error debt, 4 of them from the PR that fixed them |

## The one sentence this session keeps proving

**A value that carries more than one meaning will be read as the strongest one.**
`liveWall = null` meant three things. `mac.signed` was read as "notarized". `signed` and
`notarized` are different facts and `spctl` prints both in the same breath. Every fix was the
same three moves: split the fact (absent ⇒ false), bind and raise at the source, **and make it
reach the render** — then sabotage by deleting the render arm and watch a test go red.

## Four mistakes, kept because the reasoning outlives them

1. **A clock-based "job hasn't run" alarm** — two tests exist to prevent it, with a measured example
   of a job idle 10 days and correct. Reverted in under a minute. *On a traffic-claimed job, idle is
   the normal state, not a symptom.*
2. **Built a touch-target fix under ST-11's name** when ST-11 was already done — I guessed a symbol
   instead of running the row's own re-measure. The fix was real; the label was not. Amended.
3. **Half-fixed the CSP** from the violation table, which names only what visitors happened to hit.
   *Report-only data is a lower bound on what breaks.* My own guard caught it.
4. **Pushed a fix to a branch whose PR was already armed** — it merged without the fix and turned
   the trunk red. See §13.

## Owner-held, nothing blocking

`support@setnayan.com` does not exist but is published in unsubscribe copy (the iCloud domain is at
3 of 3 addresses) · DATA-04, whether a couple's erasure removes the supplier's proof of payment ·
NPC `t0-3`'s remainder: the live page promises a 15-business-day DSR response, the packs say 7 ·
notarizing the Mac build needs Apple credentials · DMARC `rua` reports go to GoDaddy's default
address · refunds and payout-account changes are still single-admin · whether to enforce the CSP.

## 14 · W8 IS NOT MINE — the REDESIGN CONTROLLER owns it

Owner, 2026-09-22, two instructions in sequence:

> "we are sending w8 to the wedding website event hub session"
> "they can both integrate to each other properly"
> "let redesign controller handle that w8 wedding website event hub session"

So the final arrangement is: **W8 lives in the Event Hub session
(`local_1ed3308b-0ca5-44aa-a1d1-0806774569ff`), and the REDESIGN CONTROLLER
(`local_764dda74-bc29-4889-9fde-2910dbb760ef`) runs that session.** This controller
dispatched the brief, handed over, and is out of the loop. Both sessions were told.

**Why it went there rather than to a fresh session.** The three Pro invite themes are
`tier: 'pro'` in `lib/invite-themes.ts` — the thing that makes them available *is* Event
Hub Pro. They were never two features. Q3 ("the theme appears wherever Pro lists what it
includes") and I-2 ("a couple without Pro still shows guests the House door") are the same
seam read from two sides. Splitting them across two sessions would have produced two
sources of truth for one entitlement, and 🔑 **two mechanisms that disagree about the same
fact each pass their own suite.**

### ⚠ The register was wrong about this whole group

Measured on `origin/main`, 2026-09-22:

| row | register said | measured |
|---|---|---|
| I-3 · Velvet | MID-BUILD | ✅ SHIPPED — `velvet.tsx` 104 / `.module.css` 224 |
| I-4 · Galeriya | NOT STARTED | ✅ SHIPPED — 85 / 209 |
| I-5 · Abaca | NOT STARTED | ✅ SHIPPED — 99 / 351 |
| I-6 · Q1 typefaces | NOT STARTED | ✅ DONE — all three `import localFont` |

```bash
ls apps/web/app/\[slug\]/invite/_components/themes/
grep -n "INVITE_THEME_IDS" apps/web/lib/invite-themes.ts
```

**Four rows in one group rotted in a single day**, all in the same direction: the register
under-reports. W8 is a *looking* session — the owner-look rows and the Q-series — not three
design builds. `build-sessions/CTRL-W8-invite-themes.md` carries the detail.

🔑 **"I looked and it is correct" is a complete result.** A fifth false "not built" costs
the next person a day, and this group has already produced four.

## 15 · SESSION CLOSE — where the stack stands

- **W1–W7 built and merged.** W7 (#5891) merged 2026-09-22.
- **Trunk #5877** carries the whole stack to `main` as ONE merge — MERGEABLE, **0 failing**.
- **W8** handed to the REDESIGN CONTROLLER (§14).
- **W9 (Desktop)** is the only bundle this controller could not start, and not for want of
  time: it needs a **Windows machine**, the **R2 release secrets**, and an **Apple
  code-signing certificate**. None is an engineering decision. ⚠ Note `lib/desktop-release.ts`
  now carries `notarized` as its own field defaulting to `false` — it is never inferred from
  `signed`, because signed ≠ notarized and the page was reading one as the other.
