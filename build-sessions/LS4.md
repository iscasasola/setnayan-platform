# LS4 — a dead encoder is visible on the controller

**Model:** Sonnet 5 · **Effort:** high · **Wave:** now · **Runs in parallel with LS5**

Measured against `origin/main` @ `773c5f305` on 2026-09-02. Re-fetch before you act.

Start a new Claude Code session and paste EVERYTHING below the rule.

---
---

Read the repo's own CLAUDE.md and the corpus CLAUDE.md first, then follow RULE 0: assume what you
are about to build already exists, and locate it before writing anything. On this stream RULE 0 has
now paid SEVEN times — "invite an off-platform supplier", "a supplier can only tap six fixed
messages", "the camera screen says 3 cameras free to test with", the host stranger-copy defect, the
NPC residency rows, the camera-claimer name, and the ENTIRE captured-by-person build were all
reported as missing and ALL already ship.

0. MEASURE AGAINST origin/main, NEVER A LOCAL CHECKOUT. `git fetch` first, then read with
   `git grep <pattern> origin/main -- <path>`. The main checkout on this machine was 2237 commits
   behind while reporting itself as main, and it produced four false findings in one hour —
   including two sessions scoped to build things that already shipped.
   NEVER ANCHOR ON A LINE NUMBER. Grep for a string. Line numbers rot between fetches.

0b. A `git add` THAT STAGES NOTHING REPORTS SUCCESS. This repo's root is an ALLOWLIST: `.gitignore`
   line 18 is `/*`, so EVERY new top-level file or directory is ignored unless a `!/path` line below
   it says otherwise. `git add <new-top-level-path>` then exits 0 having staged nothing, `git status`
   shows nothing, and the work never enters the repo. `.gitignore`'s own header records this
   swallowing a README once already. If you create ANY new top-level path, add its `!/path` line in
   the SAME commit and verify with `git check-ignore -v <path>` before believing it is staged.
   Nested paths (under apps/, supabase/, changelog.d/ …) are unaffected.

0c. A CHECK THAT CANNOT FAIL IS NOT A CHECK. Twice in one day a verification command returned a
   confident FALSE answer because of its own shape, not the repo's state:
     · `for f in $list; do git cat-file -e "ref:$f"; done < <(...)` — a command inside the loop
       consumed the loop's stdin, so every probe failed and reported "97 files absent upstream".
       All 97 were present.
     · `git check-ignore -v X | head -2 || echo "not ignored"` — `||` binds to the PIPELINE, whose
       status is `head`'s zero, so the fallback branch can never run and BOTH outcomes print nothing.
     · `timeout 60 <cmd>` printed `DB_EXIT=127 elapsed=0s` — **`timeout` does not exist on macOS**,
       so the command never ran. 127-in-zero-seconds reads as a fast decisive result if only the exit
       code is printed. 🔑 **PRINT ELAPSED TIME BESIDE EXIT STATUS.** Duration is a cheap, general
       detector for "the command did not run", which no exit code alone can distinguish from "the
       command ran and failed".
   Before believing a verification, ask what output the FAILING case would produce and confirm the
   command can produce it. Prefer an explicit `if cmd; then … else … fi` over `&&`/`||` after a pipe,
   and prefer set arithmetic (`comm`, `sort -u`) over per-item loops that shell out. If a result is
   implausible — everything present, everything absent, silence from both branches — suspect the
   check before the repo.

WORKING RULES — every one has cost this project real work before:

1. Branch, then `git worktree add` IMMEDIATELY — beside the repo, NEVER in /tmp, and branch FROM
   origin/main. A finished, proved change was lost to a /tmp worktree on 2026-08-28.
2. `pnpm install` in the worktree BEFORE running anything. A run in an uninstalled worktree means
   nothing.
3. `git fetch` before branching. origin/main moved 2237 commits ahead of a checkout that still
   called itself main.
4. PUSH THE MOMENT IT TYPECHECKS. Do not batch a session's work into one commit at the end.
5. Typecheck with the exit code printed beside the error count:
   NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p tsconfig.json > /tmp/tsc.log 2>&1; \
     echo "TSC_EXIT=$?"; grep -c 'error TS' /tmp/tsc.log
   An EMPTY log is NOT a clean one — tsc exits 134/143/144 on abort and that reads as zero errors.
   Require TSC_EXIT=0 printed beside ERROR_LINES=0; either one alone is a lie. Never run two.
6. Require `# tests` to be NON-ZERO before believing any pass. Zero-tests-zero-failures is
   byte-identical to success and exits 0. A --test glob that matches nothing behaves identically.
7. Mutation-test every assertion you add and PRINT THE OCCURRENCE COUNT before → after. An
   unmeasured sabotage proves nothing. If a well-formed sabotage reports GREEN, suspect the
   sabotage before the guard.
8. Read the live object, never a migration comment or a docblock. A migration comment is not
   evidence; neither is a decision log; neither is this prompt.
9. Add a changelog fragment in changelog.d/ — never edit CHANGELOG.md or STATUS.md directly.
10. Auto-merge is the standing default: `gh pr merge <n> --auto --merge` right after creating it.

AUTONOMY RULES — how this session finishes rather than stalls:

11. DONE MEANS MERGED. After arming auto-merge, poll until the PR reads MERGED. If a required
    check fails, read the failure, fix it, push again. Do NOT hand back a red or open PR and call
    the session complete. If the same check fails twice for the same reason, STOP and escalate.
12. NEVER STALL ON A GATE. If a feature flag's production value is unknown, build behind the
    EXISTING flag, defaulted off, and record the open question in your handback. Do not stop and
    wait for an answer you were not promised.
13. WRITE STATE AS YOU GO. Create the changelog fragment on your FIRST commit, not your last. If
    you are running low on context, commit and push everything already proved, and write the next
    concrete step into the fragment so a fresh session resumes instead of restarting.
14. IF THE DEFECT IS NOT THERE, SAY SO AND STOP. Do not invent adjacent work to justify the
    session. Report what you measured, with the command and its output. That is a complete and
    successful session — two of this program's ten original sessions ended that way.
15. ONE SESSION = ONE BRANCH = ONE PR. If the work genuinely needs a second PR, say so in the
    handback before opening it.
16. HAND BACK IN THIS EXACT FORMAT so the overseer can verify without re-reading everything:

    SESSION: <C-id>
    PR: <#number> <MERGED|OPEN|BLOCKED>
    MEASURED-AGAINST: origin/main @ <sha>   (must be a fetched sha, not a local HEAD)
    TSC_EXIT=<n> ERROR_LINES=<n>
    TESTS: <# run> passed, <# run> total   (must be non-zero)
    MUTATION: <assertion> — before <n> occurrences, after <n>
    PREMISE: <HELD | FALSE — with the command that showed it>
    OWNER QUESTION: <none, or the one thing you could not resolve>
    LEFT UNDONE: <none, or exactly what and why>

---

TASK — LS4: `getYoutubeStreamStatus` exists, costs 1 quota unit, and has ZERO callers.

READ `Live_Studio_Encoder_Scope_2026-09-03.md` § 3.1 AND § 7 FIRST — this task is that
document's own recommended first slice, and § 7 already specifies the shape. Do not redesign it.

THE DEFECT. The couple's encoder (OBS today) dies mid-ceremony. YouTube knows within ~10
seconds. Setnayan could know for ONE quota unit. The controller says nothing, and the operator
finds out from a guest. Verify the premise yourself before building:

  grep -rn "getYoutubeStreamStatus" apps/web --include="*.ts" --include="*.tsx"
  # expect exactly one hit: its own definition in lib/panood-youtube.ts

🔑 WHY THIS ONE FIRST, AND WHY IT CANNOT BE WASTED WORK. It is PATH-INDEPENDENT: correct under
OBS today, correct under a native desktop encoder later, correct if the owner picks the relay.
The encoder decision (§ 9.1) is unmade and this does not depend on it.

🔑 AND IT IS THIS REPO'S SIGNATURE DEFECT ON ITS MOST EXPENSIVE SURFACE — a failure that renders
identically to success, on an unrepeatable day. CLAUDE.md: "A LOG LINE NEVER CHANGED A PIXEL."
The measurement must reach the RENDER.

BUILD — follow the repo's existing pure/server split, the one `live-studio-readiness.ts` and
`live-studio-readiness-server.ts` already demonstrate. Read those two before writing.

  1. `lib/live-studio-ingest-health.ts` — PURE. `decideIngestHealth({ streamStatus,
     healthStatus, live, lastOkAt })` returns a named state (`waiting_for_encoder` ·
     `receiving` · `degraded` · `no_data`) plus the operator-facing sentence. No imports that
     drag `server-only` into it — see the note at the top of `live-studio-roam-provision.ts`
     explaining why that breaks `tsx --test`. This module is the thing to mutation-test.
  2. A server-side read beside it that resolves the event's stream id and pool token, then
     calls `getYoutubeStreamStatus`.
  3. RENDER IT ON THE CONTROLLER, LOUDLY — a persistent state beside the tally, not a toast and
     not a console line. `no_data` while `live` is true is the loudest state that console has.

⚠ TWO TRAPS, BOTH FROM THIS REPO'S OWN HISTORY — the guard must pin both:
  · A STOPPED UPLOAD FIRES NO EVENT AT ALL. That is exactly how the Papic upload defect hid: no
    `error`, no `abort`, no `load`, so a chip sat at 0% forever and "still working" looked
    identical to "dead". ABSENCE OF A BAD STATUS IS NOT HEALTH. A stale poll must resolve to
    `no_data`, never to "still fine".
  · DO NOT FAIL CLOSED INTO SILENCE. If the health READ itself fails, say "cannot tell" — never
    "receiving", and never render nothing. This is a READ: an absence must be SHOWN, not denied.
    (`actions.ts` files are the opposite case — there an absence must DENY — and are out of scope.)

📊 QUOTA — CHECK BEFORE CHOOSING THE POLL INTERVAL, DO NOT GUESS. 1 unit per poll; at 15s that
is ~240 units/hour per live event. The scope doc's § 1 puts the ceiling at roughly 12–15
weddings/day. Compute what your interval costs against that ceiling and WRITE THE ARITHMETIC IN
A COMMENT. If it does not fit, widen the interval — do not ship a number nobody checked.

GUARD — new file, own name, so it cannot conflict with a concurrent PR. Use the canonical
`lib/strip-comments.ts` (a NEW file with its own stripper fails the required
`scripts/lint-one-comment-stripper.mjs`). Pin: a stale poll yields `no_data`; a failed read
yields "cannot tell" and never "receiving"; and the state actually REACHES the controller's
render (a constant nobody renders is not a warning — `live-studio-lead-time.test.ts` pins
exactly this shape for its own notice, copy it). MUTATION-TEST each: every assertion must turn
red when its property is broken. Restore by SHA-256 and re-run green.

RUN THE FULL SUITES — `pnpm test:unit`, `pnpm test:db:ci` (~25 min), `npx tsc --noEmit`. Two PRs
this week were pushed on targeted-only runs and both came back red from CI.
COMMIT BEFORE STARTING A LONG VERIFY — an earlier attempt at a Live Studio task was lost that way.

SPEC IMPACT: None — this reports a fact the product already had access to and never read.
