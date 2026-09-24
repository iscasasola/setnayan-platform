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

SPEC IMPACT: None. Tooling only.
