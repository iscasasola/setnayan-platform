# Traps — every one of these has cost real time on this project

## Never read code from these two paths

- **`/Users/icecasasola`** is a checkout of this repo **~750 commits behind**
  `origin/main`. A subagent aimed at it returned a coherent, fully
  control-flow-traced, **completely wrong** finding — real line numbers, from a
  file whose code had since been deleted.
- The primary checkout is **1400+ commits behind**.

✅ **Always:** `git worktree add --detach /tmp/wt-read origin/main`, and hand
subagents *that*. A fresh worktree has **no `node_modules`**, so tsc/tests/lint
there "pass" while resolving nothing — symlink them from a worktree that has
them, or install first.

## Green-shaped nothing — the five costumes

A guard, a grep or a test that proves nothing looks exactly like one that passes.

1. **An empty pattern** matches everything or nothing, silently.
2. **A slid window** — a regex anchored on the first match faces the wrong element.
   *(This is exactly what broke #5586's guard: it anchored on source order, and a
   prop is written before a child.)*
3. **`# tests 0`** — a `tsx --test` path containing `[threadId]` or `[eventId]`
   **matches nothing, prints `# tests 0`, and exits 0.** Use the repo's
   `app/**/name.test.ts` glob form.
4. **CI naming a skipped step** as the failure.
5. **A scope that did not widen** when you thought it did.

🔑 **In 4 of 5, a printed NUMBER was the tell, never the verdict.** Print what you
searched and how many things you found. Give every guard a floor that fails the
mistake actually made.

🔑 **Probe your own runner with a deliberate failure first.** A zero from a
harness you have not proven is not evidence.

## grep on this machine is a ugrep shim

- It hides **gitignored paths** from recursive sweeps — a sweep of the spec corpus
  read **350 of 2,352 files**.
- `-I` silently skips any NUL-containing file (one ships on main).
- `git grep -E` **cannot match `\b`** — it returns a confident, silent zero. Use
  `-P` or a fixed string.

✅ Use `/usr/bin/grep` or `git grep` for any claim of absence. Run `type grep`
before theorising.

## Shell traps on this Mac

- **`timeout` is not installed** — exit 127 in 0s reads as a fast pass.
- **`PIPESTATUS` is bash-only** — empty in zsh, so the exit check is vacuous.
- **`status` is read-only in zsh** — assigning to it kills a watch loop on line 1,
  and a dead watcher looks exactly like a patient one.
- **zsh does not word-split an unquoted variable** — `for t in $LIST` iterates
  **once** and prints a clean pass.
- **Sample `$?` before any pipe or label** — after a pipeline it is the last
  element's.
- **A `:a` suffix on a variable is a zsh path modifier** — write `${BR}:path`, not
  `$BR:path`.
- **Piping a background command to `tail` leaves the output file EMPTY until
  exit** — it reads as a clean pass.

## Machine limits

- **This Mac has 16 GB. Three concurrent `tsc` runs SHUT THE LAPTOP DOWN.**
  Serialise heavy jobs.
- `apps/web` typecheck needs `--max-old-space-size=6144`; 134 is heap, **144 is a
  kill**.
- Run unit tests **from `apps/web`**, or every `@/…` import dies — including the
  repo's own guards.
- **`pnpm lint` does not run the repo guards** — ~27 blocking guards are separate
  CI steps, so a green local lint still fails "typecheck + lint".

## Worktrees

Each is ~1–2 GB. Left to pile up they fill the disk, and **at zero free bytes
every Bash call fails with `ENOSPC` — including the `rm` needed to recover.**
Prune AS YOU GO: `git worktree remove <path> --force` then `git worktree prune`.

⚠ A prune loop testing "HEAD is an ancestor of served" destroys **brand-new**
worktrees hardest. And a deleted cwd fails like a GitHub outage.

## Migrations

- ⛔ **NEVER apply a migration directly to production.** On 2026-09-02 a direct
  apply stranded **seven merged PRs for over three hours** — it stamps the prod
  ledger with a version that has no file on `main`, and `supabase db push` then
  refuses for *every subsequent merge*.
- The repair command **rewrites the production ledger**. A session must never run
  it, and must never hand-delete the row via SQL either. **Surface it and stop.**
- ⛔ **"A migration below prod's head merges green and creates nothing" is FALSE.**
  Both deploy workflows run `db push --include-all --yes`, which exists precisely
  to apply migrations dated before the remote head. This belief is written into
  **six applied migration headers** and is wrong in all six. **Applied migrations
  are never edited, so do not treat a migration comment as evidence.**
- ✅ What *is* true: the PGlite replay applies in **filename order**, so a low
  prefix depending on a higher merged one fails every `*.db.test.ts` while prod is
  fine. Allocate forward with `pnpm migration:new` for **that** reason.

## Reading production

- **`vercel env ls`** says set / not-set — **absence is decisive.**
- **`vercel env pull` hides sensitive values** — it writes `KEY=""` for a
  write-only var, so unreadable and empty look identical. `NEXT_PUBLIC_*` comes
  back in plaintext; server-side vars return `[encrypted]`.
- ⛔ **Do not grep the production bundle for a flag NAME** — Next inlines the
  *value* and drops the name.
- 🔑 **A flag's default in code is NOT its value in production.** This was
  reported to the owner as "switched off", from the code default, and he caught
  it. **Open the page; it takes thirty seconds.**

## CI

- **A CONFLICTING PR runs NO CI** and reports zero failing *and* zero running —
  **count the checks.**
- The GitHub runs API needs the **FULL sha**; an abbreviated one returns a clean
  `total_count: 0` that reads exactly like "CI never ran".
- **A PR here is a ~one-hour round trip** — ~45–55 min of CI, nearly all in the
  DB-replay step. **33 minutes in is normal, not stalled.**
- The unit suite has a **five-minute fuzz file**; silence after the attire-parity
  subtest is that fuzz running, not a hang.
- **Find PRs by branch, never by title.**
- `changelog-collect` is a **release** tool, not a guard — a sweep that runs it
  **deletes all ~3,462 changelog fragments.**

## Never weaken a guard to go green

If a guard is too noisy, raise its thresholds. **Never delete or relax it.** When
a guard fails against code you believe is correct, the usual answer is that the
guard's *window* faces the wrong thing — fix the window, keep the assertion.
