# The enrolment prompt — paste this into EACH Redesign session

One paste per session. It is a handshake: it enrols the session under the controller and asks it to
report back what it is actually holding. **Nothing else changes until it replies.**

Send it to all seven Redesign sessions:

- Login popup and profile setup flows
- Event Your Team
- Vendor dashboard
- Papic controller
- Service card and quotation maker
- Event chatbox between users and vendors
- Event Overview

---

## ✂ PASTE FROM HERE

**You are now part of the Redesign group, under the REDESIGN CONTROLLER session**
(`local_764dda74-bc29-4889-9fde-2910dbb760ef`). Read
`build-sessions/REDESIGN-CONTROL.md` in `~/Documents/Claude/Projects/setnayan-platform` before you
reply. This message changes how you ship; it does not change what you are building.

**The rule, in one line: for this session, you will not build unless instructed by the REDESIGN
CONTROLLER session. When you are ready to build, you always have to report to the REDESIGN
CONTROLLER, and only the REDESIGN CONTROLLER can launch a build.**

The reason is money and time, not ceremony. A PR here is a ~45–55 minute CI round trip and the owner
is charged per merge. Seven sessions each opening their own PR is seven merges. The controller
combines finished builds into **one bundle branch, one PR, one merge**, after trial-merging them
against each other so the bundle lands clean.

**So, concretely, from now on:**

1. Build in your **own worktree on your own branch off `origin/main`** —
   `git worktree add ../wt-rd-<slug> -b claude/rd-<slug> origin/main`. Never branch from the repo's
   checked-out tree; it is ~2,491 commits behind.
2. Commit your work, **one commit per build**, named for the build. Never squash several builds into
   one commit.
3. Prove it the usual way: a pure decision module, a test that EXECUTES it, and at least one
   sabotage you **watched turn red**. A guard you did not watch fail is a hypothesis.
4. **Do NOT `git push`. Do NOT `gh pr create`. Do NOT arm auto-merge.** This supersedes the standing
   "auto-merge is the default" rule for you, for as long as you are in this group.
5. Run the collision check on yourself and keep its verdict:
   ```bash
   build-sessions/merge-control.sh --branch HEAD
   ```
6. Report to the controller, then **stop and wait**.

**Anything already pushed or already an open PR is grandfathered — leave it alone, let it merge.**
Do not unwind it. This rule applies to work you start from now on.

**If you are mid-build right now:** finish the commit you are on, then report. Do not start the next
one.

### Reply with exactly this, now

```
REDESIGN ▸ <your session title> · ENROLLED
READ: build-sessions/REDESIGN-CONTROL.md — <yes/no>
SLICE: <the one-line description of what you are building or were about to build>
STATE: <IDLE | BUILDING | READY-TO-PUSH | WAITING-ON-OWNER> — <one line>
BRANCH: <your branch name, or "none yet">
WORKTREE: <absolute path, or "none yet">
COMMITS: <how many commits ahead of origin/main, or 0>
UNCOMMITTED: <how many files, or 0>
FILES: <every non-changelog path you have touched or expect to touch — this is what the
        controller uses to predict collisions, so be complete rather than tidy>
PUSHED: <yes/no> · PR: <number, or none>
BLOCKED-BY: <an owner decision, another session, or nothing>
COMPLY: <yes — or say plainly what you cannot comply with and why>
```

Send it with `mcp__ccd_session_mgmt__send_message` to
`local_764dda74-bc29-4889-9fde-2910dbb760ef`. If that tool is unavailable to you, print the block
and tell the owner to paste it to the controller.

**Measure every line before you write it.** `git status --porcelain`,
`git rev-list --count origin/main..HEAD`, `git diff --name-only origin/main...HEAD`. Do not report
from memory of what you did — this register is what the controller sequences the merges from, and a
wrong FILES line is how two sessions collide. If you have nothing yet, say so; **IDLE with an empty
branch is a good answer**, an invented one is not.

## ✂ TO HERE
