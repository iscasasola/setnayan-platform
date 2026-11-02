## 2026-09-24 · docs: the five branches that existed only on one Mac, named and described

A sweep before handing this account over found **five branches whose commits were on one machine's
disk and nowhere else** — four had never been pushed at all, and two carried uncommitted files on
top. Roughly 2,150 lines across 131 files, including one commit labelled *"kept only so nothing is
lost"*, which is precisely the intent that fails when the machine does.

All are pushed now. `build-sessions/RESCUED-BRANCHES-2026-09-24.md` says what is in each, which is
the half a branch name cannot carry: `s41-wip ahead 2` tells the next account nothing about 97 files
of money and booking edits.

Deliberately **not** five PRs. A PR asserts "this is ready" and none of these is; opening them would
put unreviewed work in the merge queue and bury the one that does look finished
(`rd/closing-copy-says-who` — both surfaces closed, with its own guard).

The file also carries the sweep itself, to run before ending any session on this machine. 🔑 The
dangerous row is `NO-REMOTE`: a branch git has never pushed anywhere. This machine runs ~40
worktrees at once, so a session that ends without pushing leaves no trace anyone can find.

SPEC IMPACT: None. Documentation only; no code and no behaviour.
