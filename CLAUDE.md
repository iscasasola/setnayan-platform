# Setnayan Platform — Claude Code Project Context

> Loaded automatically by Claude Code at session start. Read first, before any code.

## What this repo is

The Setnayan V1 implementation. **All product specs and decision logs live OUTSIDE this repo** at `~/Documents/Claude/Projects/Setnayan/`. Read that folder's `CLAUDE.md` for the canonical decision log before any iteration work.

## Documentation contract — four living docs in this repo

| File | Purpose |
|---|---|
| `STATUS.md` | Snapshot of where the project is — current sprint, last completed step, what's next. Updated after every milestone. |
| `CHANGELOG.md` | Append-only log of every code change, dated, with spec-impact callouts. Append after every meaningful change. |
| `COWORK_INBOX.md` | Active worklist of pending spec-corpus updates the owner must apply via Cowork. Items removed once actioned. |
| `CLAUDE.md` (this file) | Persistent instructions for future Claude Code sessions. |

### Rules for every session

**After ANY non-trivial code change you must:**

1. Append a `CHANGELOG.md` entry with: date, commit SHA, what changed, and a `SPEC IMPACT:` line (even if it says "None")
2. If `SPEC IMPACT` is **not** "None", apply the spec edit **directly** in the corpus at `~/Documents/Claude/Projects/Setnayan/` (per the 2026-06-04 direct-edit authorization — see "Cowork — the spec-update boundary" below), following the `COWORK.md` sequence. No longer append `[PENDING]` to `COWORK_INBOX.md`.
3. Update `STATUS.md` if the project state advanced (new step, new iteration, new known gap)
4. Commit all doc updates in the same commit as the code change

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
7. Append a `CHANGELOG.md` entry + update `STATUS.md` before committing

## PR workflow — review-then-merge (owner reviews the preview, then merges)

> **Owner directive 2026-06-14 — SUPERSEDES the 2026-05-15 "auto-merge is the default" lock.** STOP auto-merging. Every change waits on its Vercel **preview URL** for the owner to review on a real, logged-in deployment **before** it reaches production (`main` → setnayan.com). Goal: nothing ships to the live site unseen, and the number of merges is kept to a minimum.

After `gh pr create`, **do NOT run `gh pr merge --auto`.** Instead:

1. **Post the Vercel preview URL** in your response. Find it in the PR's Vercel bot comment (shape: `…-git-<branch>-icasa-offroad.vercel.app`). That preview is the *full* site — the owner can log in and exercise the change there.
   - ⚠ **Login on a preview:** use **email + password** (test accounts `couple|vendor|admin.test@setnayan.com` / `SetnayanTest!2026`). "Sign in with Google" / magic-link bounce to prod, because the auth redirect is hardwired to `NEXT_PUBLIC_APP_URL` (`app/login/actions.ts`, `app/auth/oauth-actions.ts`).
   - ⚠ **Previews share the ONE production Supabase DB + R2** — you see real data and data writes are real. Safe for visual/layout review; not a data sandbox. Migrations always hit the single prod DB regardless.
2. **Leave the PR open.** The owner merges it themselves once satisfied — or explicitly says "merge it," at which point run `gh pr merge <PR#> --merge` (plain `--merge`, NOT `--auto`).
3. **Batch to minimize merges.** Prefer folding related changes into a single PR over opening several small ones. Fewer, well-reviewed merges is the goal.
4. **Mechanics unchanged:** `--merge` (merge commit, never `--squash`/`--rebase` unless asked); required CI still gates the merge; `delete_branch_on_merge=true` auto-cleans the branch; the `build (windows-latest)` desktop job is not a required check.

**Only exception:** auto-merge a specific PR if the owner explicitly asks ("just merge this one"). Otherwise the default is hands-off until the owner has seen the preview.
