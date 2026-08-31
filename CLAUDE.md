# Setnayan Platform — Claude Code Project Context

> Loaded automatically by Claude Code at session start. Read first, before any code.

## ▶▶▶ NEWEST — 2026-08-20 · HANDOFF FOR A NEW ACCOUNT (read before `WHAT_IS_LEFT.md`, which is 13 days older)

Full handoff lives in the spec corpus as `WHATS_NEXT_HANDOFF_2026-08-20.md`
(remote: `github.com/iscasasola/Setnayan-specs`) — it supersedes the 2026-08-19 one, whose build
list is COMPLETE and one of whose owner recommendations was false. **The essentials are inlined here because
that corpus is "a second repo you may not have" — as the block below says of itself.**

🛑 **THE TRAP THAT COSTS A WHOLE SESSION: `/Users/icecasasola` IS A CHECKOUT OF THIS REPO AND IS
749 COMMITS BEHIND `origin/main`** (sits on the #4287 merge; holds ZERO commits main lacks, so
there is nothing in it to rescue). On 2026-08-19 a subagent fan-out was aimed at it and returned
a **coherent, fully control-flow-traced, completely wrong** finding — real line numbers, from a
file whose code had since been **deleted**; the only surviving match was a comment.
✅ **Never read code from `~`, and never give a subagent that path.** Use
`git worktree add --detach /tmp/wt-read origin/main` and hand subagents *that*. A fresh worktree
has no `node_modules`, so tsc/tests/lint there "pass" while resolving nothing — reuse a worktree
that has them, or install first.

**ONE DISEASE SHIPPED SEVEN FIXES (PRs #4579 · #4580 · #4581 · #4582 · #4583 · #4584 · #4585 —
all merged, all live, do NOT rebuild): a failure that renders identically to success or to
emptiness.** An upload that *stops* fires no event at all — no `error`, no `abort`, no `load` —
so the chip sat at 0% forever and "still working" looked exactly like "dead". A refused guest
read returned `[]` and the page then said *"No guests yet. Start by adding the couple's first
invite."* to a couple with 180 names, **byte-identical** to a genuinely new event. A monogram
sliced off a *status string* drew **"C"** for "Camera off".
🔑 **A LOG LINE NEVER CHANGED A PIXEL** — the guest error was already bound and already in
Sentry, and the couple was still told their wedding was empty. **The measurement must reach the
RENDER.**

⏭ **THE IMMEDIATE BUILD — 11 confirmed, MONEY FIRST.** Same disease, still live: the Budget tile
can read **"₱0 committed"** against a real target; a supplier workspace can read **"Paid ₱0"**
and bill the couple the full amount as still owing; `lib/roles.ts` tells a supplier **who already
has a shop** to *"Create your shop"*. Full list with file:line in the corpus handoff §2.
📐 **The pattern to copy is IN THIS REPO — read it first, do not invent a new shape:**
`apps/web/app/vendor-dashboard/reads-are-honest.test.ts` (supplier side, 2026-08-18) and
`apps/web/lib/guests.ts` + `apps/web/lib/guests-read-is-honest.test.ts` (couple side, today).
⚠ `actions.ts` files are OUT OF SCOPE — there an absence DENIES, and failing closed is correct.

✅ **THE 11-ITEM BUILD LIST FROM THAT SWEEP IS COMPLETE** (#4583 → #4594). Nothing is open on it.
⏭ **What is left is small and listed in the handoff §5**, chiefly: the wedding-onboarding account
gate posts `public_summary_consent=yes` as a **hidden field**, silently opting a couple into public
publication, while `/signup` has the same field as an **unticked box** — because the owner already
ruled that on 2026-07-12. **One door missed an existing ruling; one line; do NOT re-ask him.** Also
`guests.invitation_sent_at` has **zero writers**, so the guest list's "N to send" can never
decrease.

🔎 **READY? Measured 2026-08-20: 9 accounts · 8 events · 2 shops (1 published) · 2 services ·
0 packages** · ~~**0 ORDERS EVER**~~ ⚠ **CORRECTED 2026-08-30 (C10/C10b): 6 orders as of
2026-08-29** — four paid and receipted (₱2,499 GCash · ₱2,899 GCash · ₱147 GCash · ₱49 BDO), two
cancelled; most recent completed 2026-08-29. Re-measure with `select count(*) from orders`, never
trust this line as current. Marketplace search WORKS (verified live) — it is **empty, not
broken**. **Packages WORK and are switched ON.**
🛑 **THAT LAST ONE WAS REPORTED TO THE OWNER AS "SWITCHED OFF", FROM THE CODE DEFAULT, AND HE
CAUGHT IT.** 🔑 **A FLAG'S DEFAULT IN CODE IS NOT ITS VALUE IN PRODUCTION — open the page; it takes
thirty seconds.** `NEXT_PUBLIC_*` also inlines into the prod bundle and is readable; server-side
vars (`RESEND_API_KEY`) are **not readable from a session at all** — say so rather than guess.

💳 **THE OWNER IS NOW TOLD WHEN SOMEBODY PAYS** (#4595). Order submission had notified admins
in-app since June; the moment a customer LOGGED A PAYMENT notified nobody, and the existing
notification was **not on the email allowlist** — a tray badge reaching nobody away from the
console. 🔑 **The notification and the allowlist are two halves of one mechanism; having one is
indistinguishable from having neither.** The daily digest is the net UNDERNEATH, not a substitute.
⚠ Both send **nothing, silently**, if `RESEND_API_KEY` is unset in Vercel.

🪤 **Traps that each cost real time today:** a guard's lookahead `(?!\s*\?)` **could not match
the line it was written to catch** (`g.photo_url ?? null` — the `??` slipped through), so it
shipped inert in the same commit as its fix · a mutation run **overwrote the guest list with the
Patiktok booth** because backups were keyed on `basename` and both files are `page.tsx` — **key
on the full path, and commit before you mutate** · a file-level match **cannot say which
component** still holds a flag (sabotage landed 2→1 and stayed green — anchor per component and
print the count) · the upload watchdog was verified with a **171 KB file**, the one size whose
tail is instant and which therefore *could not* exhibit the bug it shipped with · an **unsigned**
R2 probe "proved" a CORS fault that did not exist (a real presigned PUT returned 200) · a
**CONFLICTING PR runs NO CI** and reports zero failing *and* zero running — count the checks ·
`PIPESTATUS` is **bash-only** (empty in zsh, so the exit check is vacuous) · run unit tests from
`apps/web`, or every `@/…` import dies including the repo's own guards.

---

## 📋 START HERE — [`WHAT_IS_LEFT.md`](WHAT_IS_LEFT.md) (2026-08-07)

**The verified register of every remaining item, carried INTO THIS REPO because
`~/.claude/.../memory/` does not travel between accounts and the spec corpus is a
second repo you may not have.**

87 claims checked against shipped code and the live database — not against the
documents that made them — then attacked by a refute pass. **58 survived · 15
need the owner, not engineering.**

It also carries what would otherwise be lost on an account change: the owner
decisions already made (**do not re-ask them**), the prod test accounts and the
`is_internal` false-green trap, the environment traps that have each cost real
time, and an honest account of four times a session stated something untrue and
was corrected by a one-word question from the owner.

⚠ **A HANDOFF IS NOT EVIDENCE — including that one.** Verify before acting.

---

## 🛑 RULE 0 — FIND IT BEFORE YOU BUILD IT (owner-locked 2026-07-27)

**This project is ~2 years of design and code. Almost nothing you are asked for is new.**
The owner has paid, more than once, to have a page recreated that already existed. Assume what
you are about to build **already exists** and your job is to *locate it and extend it*.

**Before writing ANY code, prototype, migration, or design, run this and paste the results into
your reply:**

```bash
# 1. THE SHIPPED COMPONENT — what does the app already do?
grep -rln "<the feature noun>" apps/web/app apps/web/lib --include="*.tsx" --include="*.ts" | head
# 2. THE DESIGN — open the file whose NAME matches the task, not the ones near it
ls ~/Documents/Claude/Projects/Setnayan/Design_*/ ; ls ~/Documents/Claude/Projects/Setnayan/*.md
# 3. THE DECISION — is it already settled?
grep -n "<the feature noun>" ~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md | tail -20
```

Then state, in one line each, **what exists · what is missing · the delta you will build.**
If you cannot name the existing component and the existing design, **you have not searched enough
— do not start.**

### The rules that follow from it

1. **Extend, never re-draw.** Open the shipped component and reproduce its real copy and
   structure. Your output shows only the DELTA. Recreating a working screen is a defect, not a
   deliverable.
2. **Read the owner's phrasing as an instruction about an existing thing.** "their package will
   show completely… *then* at the bottom a line… *then* a checkbox" = **append one section.**
   Words like *then · at the bottom · also · as well* signal an addition, never a new screen.
3. **A flag/filter flip beats new schema.** Before adding a column, ask which existing column
   already encodes it (`is_default_included`, `is_required`, `pricing_basis`, `is_active`).
   Worked example: "catalogue picker" turned out to be `vendor_package_items` rows with
   `is_default_included = false`, which vendors already author and `lock-modal.tsx` deliberately
   hides.
4. **A dated `*_LOCKED_*.md` / `*_BUILD_SPEC_*.md` outranks any handoff.** Handoffs go stale;
   locked docs are the decision. Check both before asking the owner anything.
5. **If it already exists, say where — do not build a demo to prove the point.**
6. **Never ask the owner a question the corpus answers.** Grep first; cite what you checked.
7. **An anchor is a string, never a number.** Never write a line number or an occurrence count into
   a document as if it were a stable fact — both rot the moment the tree changes, and a "corrected"
   line number can itself be the error (a citation moved from `:1719` to `:1533` and the second
   number was the wrong one; an `emitNotification` call-site count was re-measured three times —
   108/61, then 186/55, then 223/69 — across one week). Cite a **greppable symbol** or the exact
   command that re-measures it (`grep -n <symbol> <path>`, `select count(*) from …`), never the
   number itself.
8. **RULE 0 APPLIES TO THE WORK IN FLIGHT, NOT ONLY TO `main`.** Grepping `origin/main` answers
   "does this ship"; it does not answer "is somebody building this right now". Before starting a
   feature, also run:

   ```bash
   gh pr list --state open --limit 40 --json number,title,headRefName   # who is mid-flight
   git worktree list                                                    # what this machine is building
   git log origin/main --oneline -15                                    # what landed in the last hours
   ```

   Measured 2026-08-31, one session, twice in a row: a comeback-offer feature was rebuilt from
   scratch while another session had **already opened a better version as a PR** (theirs had caught
   a hard-coded rate the rebuild reproduced); and a `guests.papic_excluded` migration was one step
   from being written when `papic_guest_spend_ceilings` — shipped the day before — already expressed
   exactly that, with `ceiling_points = 0` as the documented "may not spend". That column would have
   become a **second, competing source of truth for one fact.**

   🔑 **THE NEAR-MISS IS THE POINT: both were caught by looking, and neither would have been caught
   by a test.** Two mechanisms that disagree about the same fact each pass their own suite.

9. **"I flagged it" does not make a guessed number safe.** Owner, 2026-08-31, on a
   `DEFAULT_CAPTURE_MIX` shipped as an owner-tunable default: **"don't guess."** It was labelled a
   guess in the code, the changelog and the PR body, and shipping it was still wrong — it sized a
   **top-up recommendation**, i.e. it told couples how much money to spend, and nobody had measured
   it. The real answer was already in the tree: `papic_event_pool_config`, admin-editable, live
   since migration `20270826385580`. If a number governs money and you cannot cite where it came
   from, find its existing home or stop — do not annotate the invention and ship it.

## What this repo is

The Setnayan V1 implementation. **All product specs and decision logs live OUTSIDE this repo** at `~/Documents/Claude/Projects/Setnayan/`. Read that folder's `CLAUDE.md` for the canonical decision log before any iteration work.

## Documentation contract — four living docs in this repo

| File | Purpose |
|---|---|
| `changelog.d/` | Per-PR changelog **fragments** — one new file per change. The conflict-free per-PR unit; `CHANGELOG.md` is generated from these. See `changelog.d/README.md`. |
| `CHANGELOG.md` | The collected running log. **Generated** from `changelog.d/` via `scripts/changelog-collect.mjs` — do NOT edit it directly in a feature PR. |
| `STATUS.md` | Snapshot of where the project is — current sprint, last completed step, what's next. A refreshed snapshot, updated on its own, NOT appended once per PR. |
| `COWORK_INBOX.md` | Active worklist of pending spec-corpus updates the owner must apply via Cowork. Items removed once actioned. |
| `CLAUDE.md` (this file) | Persistent instructions for future Claude Code sessions. |

### Rules for every session

**After ANY non-trivial code change you must:**

1. Add a changelog **fragment** — a NEW file `changelog.d/<branch-slug>.md` containing a dated `## YYYY-MM-DD · type(scope): summary` block with a `SPEC IMPACT:` line (even if "None"). **Do NOT edit `CHANGELOG.md` or `STATUS.md` directly in a feature PR** — a unique fragment file can never conflict, so the PR goes `BEHIND` (auto-mergeable, since branch protection is non-strict) instead of `CONFLICTING`. (`node scripts/changelog-collect.mjs` folds fragments into `CHANGELOG.md` at release; see `changelog.d/README.md`.)
2. If `SPEC IMPACT` is **not** "None", apply the spec edit **directly** in the corpus at `~/Documents/Claude/Projects/Setnayan/` (per the 2026-06-04 direct-edit authorization — see "Cowork — the spec-update boundary" below), following the `COWORK.md` sequence. No longer append `[PENDING]` to `COWORK_INBOX.md`.
3. `STATUS.md` is a refreshed snapshot, not a per-PR log — update it in place only when the project's current state genuinely changes, in its own commit/PR, NOT appended in every feature PR (that was the other half of the merge-conflict treadmill).
4. **If your PR touches `supabase/migrations/`, the Ugat map must keep up.** Two required db-tests enforce it, so you will be told rather than expected to remember: `ugat-schema-claims.db.test.ts` fails if the map *states* anything untrue about the schema, and `ugat-concept-coverage.db.test.ts` fails if a new *subsystem* appears with no home. When the latter fires you have exactly two honest answers — add a node to `UGAT_TYPES` in `apps/web/lib/ugat/graph.ts` (with joints and their REQUIRED `claims`), or add one reasoned line to `apps/web/tests/db/ugat-concept.baseline.txt`. Never weaken or delete the check to go green; if it is too noisy, raise its thresholds. Why this rule exists: the Samahan subsystem shipped **invisible to the map for three weeks**, and 6 of 9 health findings went stale in 25 days — both silently.
4. Commit the fragment + any spec/corpus notes in the same commit as the code change.

## Cowork — the spec-update boundary

The specs at `~/Documents/Claude/Projects/Setnayan/` are the canonical product corpus. The repo and the spec folder must NEVER silently diverge.

**Owner authorization (2026-06-04 · standing):** Claude Code is **permanently authorized to edit the spec corpus directly**, superseding the prior "do NOT edit the corpus / flag for Cowork / append `[PENDING]` to `COWORK_INBOX.md`" rule. The project has moved past formal Cowork spec-design into rapid prototype/build iteration.

**How to apply a spec-impacting change:**

- Edit the affected corpus files directly, following the **`COWORK.md` decision-update sequence**: `DECISION_LOG.md` row → affected iteration `.md` → regenerate the `.docx` mirror via pandoc → update memory + `MEMORY.md`.
- Still log the impact in the corresponding `CHANGELOG.md` entry (file path + reason) so repo history stays complete.
- **Surface — don't silently change — load-bearing or uncertain decisions** (locked SKUs, schema renames, retired features, branding): flag them for owner sign-off in your response even as you apply the edit.
- The **code repos keep their worktree + PR workflow.** Direct corpus-edit authorization does NOT extend to repo code.

`COWORK_INBOX.md` is retained only as a historical worklist of pre-authorization pending items; new spec deltas land directly in the corpus, not as `[PENDING]` rows.

## ⛔ FALSE BELIEF ABOUT MIGRATION PREFIXES — kill it on sight

**"A migration whose 14-digit prefix sits below prod's applied head merges green and creates
NOTHING."** **THIS IS FALSE.** Both `.github/workflows/deploy-prod.yml` and
`.github/workflows/supabase-migrations.yml` run `supabase db push --include-all --yes` (confirm
with `grep -n "db push --include-all" .github/workflows/*.yml` — do not cite a line number, it has
already drifted once: `:184`/`:203` were the lines when this was first written and now read
`:201`/`:220`, proof of exactly the rot rule 7 above warns about), and `--include-all` exists
precisely to apply migrations dated before the remote head.

**Measured 13 ways (2026-08-04):** 12 migrations were historically added out of order and **all 12
are applied in prod**; and `20271102765509` applied while sitting **two prefixes below the head**.
It was also already tested and disproven once, on 2026-07-27 — and then re-invented a week later.

🦠 **It spreads, and this file is where the spreaders were looking.** It is written into **six**
applied migration headers — `20271102603681` · `20271102765509` · `20271102810371` ·
`20271103100614` · `20271104090000` · `20271106090000` — one of which was authored *after* the
correction merged. **Applied migrations are never edited, so those comments stay wrong. Do not
treat a migration comment as evidence.**

🔑 **Where it comes from:** a `count(*) WHERE version = <prefix>` on an **unmerged** PR returns `0`,
which reads as *"it will be skipped."* Zero is because the PR has not merged. Correct fact,
invented consequence.

✅ **What IS true:** the PGlite replay (`apps/web/tests/db/replay-migrations.ts`) applies in
**filename order**, so a low prefix that depends on a higher-prefixed, already-merged migration
fails every `*.db.test.ts` while prod is fine. Allocate forward with `pnpm migration:new` for
**that** reason and for the UNIQUE rule — never because "it won't apply."
`scripts/check-migration-timestamps.mjs` enforces UNIQUE + not-hand-typed-round; its own docblock
says **"NOT A RULE — ORDERING."**

## Locked decisions you must respect

Mirror of the most load-bearing locks from the spec's `CLAUDE.md` decision log. If any of these is at risk, **stop and surface the question** rather than silently changing direction.

- **Web-first V1, single Next.js codebase.** Distributed to web (Vercel) · desktop (Tauri macOS + Windows) · installable PWA (iPhone / Android / iPad). Native iOS/Android Papic + DSLR pairing are Phase 2.
- **Apply-then-pay payment flow.** Token wallet is RETIRED (2026-05-11). PHP-direct pricing.
  ⚠ **CHARM ENDINGS ARE NO LONGER THE RULE.** This line said "charm pricing (-1 endings)" for months,
  but the owner's 2026-08-27 price sheet (`DECISION_LOG.md`) rounded three SKUs OFF their -1 endings in
  one day — `LIVE_STUDIO` ₱2,999 → **₱3,000**, `PAPIC_ADDON_THANK_YOU` ₱2,499 → ₱2,500, and the custom
  catalogue's `reachNationwide` — owner, verbatim: *"make the whole number 500, 2500"*. Some SKUs still
  end in -1 and that is fine; there is no convention to enforce either way.
  🔑 **NEVER derive a price from this file or from a code comment — read
  `platform_retail_catalog_v2`, which is admin-managed and is the only price a customer is charged.**
- **Canonical entity IDs:** `S89<TYPE>-<10-char Crockford>` random body. Generator function: `public.generate_public_id(type_letter)`. Internal joins use hidden `bigserial`.
- **RLS canonical patterns.** 8 patterns + 4 helper functions (`is_admin`, `current_event_ids`, `current_vendor_ids`, `current_thread_ids`). No invented patterns. RLS enabled at `CREATE TABLE` time.
- **Brand:** SETNAYAN (full spelling, never STNYN). Domain `setnayan.com`. ⚠ **WE DO NOT OWN
  `setnayan.ph`** — owner, verbatim, 2026-08-11: *"we do not have setnayan.ph"*. This line
  claimed both for months and sent sessions looking for DNS that was never ours. It is
  unregistered, so anyone can take it; whether to buy it is an open owner call, not a fact.
  Brand strings centralized in `brand.config.ts`.
- **Five-file iteration folder pattern** in the spec corpus (`.md` + `.html` + `.docx` + `tests.md` + `fixtures.json`).
- **No manual video editor in V1.** All renders template-driven via Remotion + Lottie + LUTs.
- **No SMS in V1.** Email-only via Resend.
- **No public API endpoints in V1.** Iteration 0033 plumbs the gateway only.

See spec corpus `CLAUDE.md` for the full decision log.

## Build order

See `STATUS.md` "What comes after Sprint 0" for the canonical iteration sequence. Don't reorder without owner sign-off.

## Deployment surfaces (live now)

- **DNS + registrar: GoDaddy** (`ns09/ns10.domaincontrol.com`) — verified 2026-08-05.
  ⚠ **CLOUDFLARE IS STORAGE ONLY.** `setnayan.com` is NOT a Cloudflare zone and no traffic is
  proxied through Cloudflare — the Domains list on that account is **empty**. Anything sold as a
  "free Cloudflare feature" that works on proxied traffic (the CSAM Scanning Tool, WAF, Bot
  Management, cache rules) is **UNAVAILABLE** without migrating DNS off GoDaddy, which is a real
  infrastructure change and NOT worth doing for one feature.
  🔑 **Storing files with a vendor is not routing traffic through them.** Assuming otherwise from
  "media is on R2, R2 is Cloudflare" sent the owner into that dashboard twice looking for a page
  that could never exist for us (2026-08-04/05).
- **Web:** auto-deploys on push to `main` via Vercel · `https://setnayan-platform-web.vercel.app`
- **Desktop:** `.github/workflows/build-desktop.yml` produces `.dmg` + `.msi` on push to `main`
- **Database:** Supabase Singapore · migrations via `supabase db push --db-url "$SUPABASE_DB_URL"`
- **Object storage:** 4 Cloudflare R2 buckets in APAC

Owner sign-up email: `iscasasolaii@gmail.com` (hardcoded in the `on_auth_user_created` trigger for `is_internal=TRUE` per § 10a).

## Per-iteration workflow

For each `NNNN` iteration in the spec corpus:

1. Read all 5 files in the iteration folder before coding (`NNNN_*.md`, `.html`, `.docx`, `tests.md`, `fixtures.json`)
2. Honor every "**Locked**" claim — surface a question rather than silently changing it
3. Schema migrations land FIRST (before feature code), with RLS at `CREATE TABLE` time
4. Apply the matching RLS pattern from `02_Specifications/RLS_Policy_Pattern.md` § 5 mapping table
5. Translate the `.html` prototype into React components (don't reinterpret)
6. Pass every checkbox in `tests.md` before opening a PR
7. Add a `changelog.d/` fragment before committing (do NOT edit `CHANGELOG.md`/`STATUS.md` directly in a feature PR — see the doc contract above)

## PR workflow — auto-merge is the default

Immediately after `gh pr create` on this repo, enable auto-merge:

```bash
gh pr merge <PR#> --auto --merge
```

- Use `--merge` (merge commit) to match the existing history pattern. Don't switch to `--squash` or `--rebase` unless the owner explicitly asks.
- Auto-merge waits for required CI checks (typecheck + lint, secret scan, production build, Lighthouse, Vercel preview). If any required check fails, the merge is paused — investigate the failure rather than overriding.
- The `build (windows-latest)` job from `build-desktop.yml` is NOT a required check; auto-merge can (and will) fire while it's still in progress. That's expected.
- This is the standing default — never ask "should I auto-merge?" Owner locked 2026-05-15.

**Prune each worktree once its PR merges (owner-locked 2026-07-24).** After confirming a PR is MERGED (or pushed + auto-merge armed and no longer needed locally), remove its worktree immediately — `git worktree remove <path> --force` (fall back to `rm -rf <path>`), then `git worktree prune`. In a multi-PR session, prune AS YOU GO — never batch cleanup to the end. Each worktree is ~1–2 GB (`node_modules` + `.next`); left to pile up they fill the disk to 100%, and at zero free bytes the harness can't write a command's output file, so **every Bash call fails with `ENOSPC` — including the `rm` needed to recover** (this deadlocked a session on 2026-07-24). Also clear `.next` from any worktree you keep (`rm -rf <wt>/apps/web/.next`).
