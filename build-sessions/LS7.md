# LS7 — YouTube can cut the stream mid-ceremony, and nobody is told

**Model:** Sonnet 5 · **Effort:** high · **Wave:** after LS6 merges

Measured against `origin/main` @ `869bd6e17` on 2026-09-02. Re-fetch before you act.

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

TASK — LS7: the fourth pre-purchase fact — copyrighted music can end the broadcast WHILE IT IS
HAPPENING.

VERIFIED AGAINST YOUTUBE'S OWN DOCUMENTATION 2026-09-02
(`support.google.com/youtube/answer/3367684`). YouTube scans live streams in REAL TIME. On a
Content ID match:

  1. a placeholder image REPLACES the live stream and the host is warned to stop, then
  2. if the content keeps playing the stream is "temporarily interrupted or terminated".

⚠ AND IT CATCHES LEGITIMATELY LICENSED MUSIC. YouTube's own wording: unless the rights holder
has added that channel to their Content ID allowlist, "your live stream can be interrupted even
if you've licensed the third-party content". No couple will be on an allowlist.

🔑 WHY THIS IS DIFFERENT FROM THE THREE NOTICES ALREADY ON THE BUY SHEET. Payment lead time,
YouTube's 24-hour activation and the laptop all fail BEFORE the day — late, but survivable, and
a couple can still act. This one fails DURING THE CEREMONY, at the processional or the first
dance, and there is no recovering the moment. A Filipino wedding plays licensed music
continuously; this is not an edge case, it is the default path.

PART 1 — THE FOURTH NOTICE, before the money moves.
`app/dashboard/[eventId]/studio/live-studio-control/page.tsx` already passes
`notice: [LEAD_TIME_NOTICE, YOUTUBE_READY_NOTICE, ENCODER_BUY_NOTICE]` — an array, so this is a
fourth entry beside them, defined in `lib/live-studio-readiness.ts` next to the others.

It must say all four of these or it is not doing its job:
  · YouTube scans the stream live and can CUT IT MID-CEREMONY on a music match;
  · it applies even to music the couple has PAID to license;
  · what to do instead — live musicians, or royalty-free tracks, for anything streamed;
  · that a recorded video can be claimed or muted afterwards even when the stream survived.

⚠ WRITE IT AS A PRECAUTION, NOT A DISCLAIMER. The couple can act on this: choose the
processional music differently. Copy that reads as legal cover teaches nobody anything.

PART 2 — THE PUBLIC PAGE. `app/(shell)/panood/page.tsx` gained "What do I need on the day?" as
its FIRST FAQ today. Add a second, adjacent: what happens with music. Same rule — the answer
must name the failure (the stream stops) and the fix (what to play instead).

🚨 PART 3 — THE POOL CHANNEL RISK IS NOT THE COUPLE'S, IT IS EVERY OTHER COUPLE'S.
A strike on a SETNAYAN pool channel lands on a channel that ALSO HOLDS OTHER COUPLES'
ARCHIVES, and YouTube's stated consequence of three strikes is termination with "all your
videos will be taken down". One couple's processional can delete another couple's wedding film.

  · The hosted-channel add-on's own copy must say this plainly to the buyer.
  · `app/admin/live-studio-channels/page.tsx` must state it too — the admin choosing to put an
    event on a shared channel is the person who needs it most.
  · ⚠ SURFACE, DO NOT DECIDE: whether a pool channel should be one-couple-per-channel-forever
    (never reused) is an OWNER question this raises and must not answer. Put it in the handback.

GUARD — new file, own name, canonical `lib/strip-comments.ts`. Pin: the notice reaches the buy
sheet in the array; it names the mid-stream interruption AND the licensed-music trap (a notice
that only says "don't use copyrighted music" is the version everybody ignores); the public page
answers it; and the pool-channel shared-risk sentence exists on both the add-on copy and the
admin board. MUTATION-TEST each — dropping any one must turn exactly one test red.

⚠ `live-studio-lead-time.test.ts` pins the notice array BY NAME and will go red on a fourth
entry. That is by design. Update it to the new shape — matched through the shape, never
loosened to a substring.

RUN THE FULL SUITES. COMMIT BEFORE A LONG VERIFY.

SPEC IMPACT: likely a DECISION_LOG row on the pool-channel shared-strike risk. Surface it; the
one-couple-per-channel question is the owner's.
