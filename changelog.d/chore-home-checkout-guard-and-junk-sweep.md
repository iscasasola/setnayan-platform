## 2026-08-06 · chore(repo): guard the home-directory checkout and sweep tracked junk

The repository is checked out at `/Users/icecasasola` — the user's HOME directory.
Every personal file (`~/Documents`, `~/Pictures`, `~/Downloads`, `~/Library`,
`~/.ssh`, `~/.aws`, `~/.cargo`, `~/.bash_history`, `~/.claude.json`) therefore sits
inside the working tree. Nothing sensitive was ever committed — verified with
`git ls-files | grep -iE '^\.(ssh|aws|cargo|bash_history|claude\.json|npmrc|netrc)|id_rsa|\.pem$|credentials'`
returning empty — but nothing prevented it either, and `git status` reported **212
entries**, almost all home-directory noise. A single `git add -A` would have staged
shell history and credential-bearing config into a shared repo.

**Root gitignore is now an ALLOWLIST** (`/*` then `!` each real project path) rather
than a denylist. This fails CLOSED: a new personal file in the home directory is
invisible to git by default, where a denylist would have leaked the next thing
nobody thought of. Verified after the change that:

- personal paths are ignored (`git check-ignore` on 10 of them: all ignored);
- **no tracked file became newly ignored** by this change — the 3 source files that
  `git ls-files -i -c` reports are matched by a pre-existing, uncommitted
  `.git/info/exclude` (stale local stubs from PR #10), not by this rule, and ignore
  rules never suppress already-tracked files anyway;
- tracked file count is unchanged apart from the deletions below (8056 → 8053).

`git status` now reports **10 entries instead of 212**.

**Tracked junk removed:**

- `rmerr.tmp`, `brerr.tmp` — 0-byte error-log leftovers.
- `Setnayan/.claude/worktrees/accordion-live/.../plan-budget-accordion.tsx` — a
  692-line snapshot committed by accident from inside a temporary worktree in
  PR #2831. The real component at
  `apps/web/app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx`
  (113,701 bytes) is untouched and verified present.

**Not in this commit, deliberately** — pre-existing dirt that was already in the
working tree before this work started, left for its owner: modifications to
`CLAUDE.md` and `apps/mobile/android/*`, and two uncommitted migrations
(`20270302000000_events_papic_style.sql`,
`20270520872908_users_marketing_consent_at_column.sql`) that only became visible
once the 212-entry noise cleared. Those migrations need a decision — see STATUS.

**Also done outside git** (no repo effect): 47 orphaned worktree directories removed
per the 2026-07-24 owner-locked prune rule. Each was verified individually to be (a)
unregistered with git, (b) clean — `git status` *ran* and returned nothing, distinguishing
"clean" from "the check failed", 0 failures — and (c) holding commits already present
in the main repo's object store. Two directories with uncommitted work
(`setnayan-platform-recovered`, `setnayan-wt-oauth-branding`) were **preserved
untouched**. Reclaimed ~12 GB — far less than the ~90 GB `du` suggested, because
pnpm hardlinks `node_modules` from one shared store, so `du` counted the same
physical blocks once per directory.

SPEC IMPACT: None — no product behaviour, schema, pricing, or copy changed.
