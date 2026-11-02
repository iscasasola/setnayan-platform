## 2026-09-24 · fix(handoff): the bundle takes `build-sessions/` from origin/main, not from whatever checkout ran it

`make-handoff-zip.sh` copied `$REPO/build-sessions/` and nothing else. Run from a checkout sitting
**2,839 commits behind `origin/main`**, it produced a bundle missing **68 files and 6 MB** — the
entire `assets/mb25` and `assets/mb28` artwork sets, four `AREA-CHECKLIST` documents,
`PROVE-THE-FLOW.md`.

**Nothing failed.** The script ran, printed its counts, and handed over an incomplete handoff. It
was caught only because a human noticed the zip was *smaller* than the previous one.

🔑 **A bundle silently reflects whichever checkout built it.** Every session on this machine works
in its own worktree on its own branch, so the odds that the folder you are standing in is current
are poor — and **being behind looks exactly like being complete.** This is the handoff's version of
the trap already written into `CLAUDE.md` about reading code from a stale path; the same checkout
question, one layer up.

Now: extract `build-sessions/` from `origin/main` (it has been tracked since earlier today), then
overlay the working tree with `cp -Rn` so a session's unpushed local note still travels while
`origin/main` wins any file present in both. Union, never either alone. The run prints both counts
and says how far behind the checkout is, so an incomplete bundle can no longer be quiet.

Regression-tested from the 2,839-behind checkout that caused it: **371 files, 8.6 MB**, identical to
a build from a current tree, with the note printed.

⚠ One trap inside the fix, found by running it: `git archive origin/main build-sessions | tar -x
--strip-components=1` reported *"0 files"* and scattered the contents into the bundle ROOT — the
archive's paths already begin with `build-sessions/`, so stripping one component removed exactly the
directory it needed. The count line is what caught it.

## Same file, second defect — the snapshot's branch list

The bundle's `snapshot/BOARD.md` listed *"branches with unlanded commits, touched in the last 3
days"*. A sweep for work existing only on this machine found five such branches, and **the 3-day
window would have hidden two of them**: `s41-wip` (2 commits, 97 files) at 5 days, and
`claude/the-gift-is-a-switch` at 14 days — the latter carrying a commit literally labelled *"kept
only so nothing is lost"*.

🔑 **The stalest branch is the one most likely to be forgotten, so it is exactly the one a handoff
must name.** A recency filter on a list of unfinished work hides its most endangered rows.

⚠ **And removing the window was equally useless** — it printed 221 branches, 200 of them months
dead, which nobody reads either. Both extremes were tried in one sitting, and neither is a list
somebody acts on.

So the snapshot now prints **everything touched in the last 21 days in full** (21 rows, all five
preserved branches among them), then the cold remainder as a **count** plus the command that
re-measures it. The section says why the window is 21 rather than leaving the next person to
rediscover both failures.

SPEC IMPACT: None. Tooling only.
