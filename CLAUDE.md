# Setnayan Platform — Claude Code Project Context

> Loaded automatically by Claude Code at session start. Read first, before any code.

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

## Locked decisions you must respect

Mirror of the most load-bearing locks from the spec's `CLAUDE.md` decision log. If any of these is at risk, **stop and surface the question** rather than silently changing direction.

- **Web-first V1, single Next.js codebase.** Distributed to web (Vercel) · desktop (Tauri macOS + Windows) · installable PWA (iPhone / Android / iPad). Native iOS/Android Papic + DSLR pairing are Phase 2.
- **Apply-then-pay payment flow.** Token wallet is RETIRED (2026-05-11). PHP-direct charm pricing (-1 endings).
- **Canonical entity IDs:** `S89<TYPE>-<10-char Crockford>` random body. Generator function: `public.generate_public_id(type_letter)`. Internal joins use hidden `bigserial`.
- **RLS canonical patterns.** 8 patterns + 4 helper functions (`is_admin`, `current_event_ids`, `current_vendor_ids`, `current_thread_ids`). No invented patterns. RLS enabled at `CREATE TABLE` time.
- **Brand:** SETNAYAN (full spelling, never STNYN). Domain `setnayan.com` + `setnayan.ph`. Brand strings centralized in `brand.config.ts`.
- **Five-file iteration folder pattern** in the spec corpus (`.md` + `.html` + `.docx` + `tests.md` + `fixtures.json`).
- **No manual video editor in V1.** All renders template-driven via Remotion + Lottie + LUTs.
- **No SMS in V1.** Email-only via Resend.
- **No public API endpoints in V1.** Iteration 0033 plumbs the gateway only.

See spec corpus `CLAUDE.md` for the full decision log.

## Build order

See `STATUS.md` "What comes after Sprint 0" for the canonical iteration sequence. Don't reorder without owner sign-off.

## Deployment surfaces (live now)

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
