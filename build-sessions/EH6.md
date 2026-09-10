# EH6 — one door called Event Hub, not two

**Model:** Sonnet 5 · **Effort:** high · **Wave:** after EH3 merges · **Owner-ruled 2026-09-02**

Measured against `origin/main` @ `e27a17b29` and the live catalog on 2026-09-02. Re-fetch and re-measure before you act.

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

---

TASK — EH6: the product card and the menu slot are the same door

OWNER RULING, 2026-09-02, verbatim: *"do not use 2. i look at the roles of each. if it is the same
then adjust. Like in papic. when they enter an event, the menu of papic description page becomes
the control center of papic. i think that should be the same for events hub."*

⭐ **THE ROLES WERE MEASURED AND THEY ARE THE SAME.** This is not a near-miss you need to re-judge:

  · `app/dashboard/[eventId]/website/page.tsx` declares `export const metadata = { title: 'Event
    Hub' }`, and its docblock calls itself *"the calm landing that introduces the couple's public
    site and hands them off to the editor with a single primary action."*
  · The catalog entry `landing-page` in `lib/add-ons-catalog.ts` is `label: 'Event Hub'`,
    `cta: 'Open your Event Hub'`, blurb **"One link for your whole event — the run-up page, the day
    itself, and the story after."** That sentence IS the controller's four channels.
  · EH1's controller does the same job with a living miniature instead of prose, and carries the
    three day-of services too.

**Same name, same promise, same role, two doors. Close it to one.**

── THE SHAPE TO COPY IS PAPIC, AND IT ALREADY SHIPS ──────────────────
`papic` is `opensDirect: true` onto `/dashboard/[eventId]/studio/papic` — **ONE page** that is the
shop window before the couple owns it and the control centre after. Open it and read how it
branches before you write anything. Do not invent a second mechanism.

  1. **`addOnHref('landing-page')` resolves to the CONTROLLER**, not `/website`. The special case
     lives in the same `if (key === '...')` ladder that already redirects `music-creator` and
     `live-studio-roam`; follow that idiom exactly.
  2. **The `/website` hub PAGE redirects to the controller.** The repo already contains this exact
     move: `app/dashboard/[eventId]/website/launch/page.tsx` is a redirect stub to
     `website/editor`, retired 2026-07-25. Copy its shape, including its docblock's honesty about
     why the route is kept.
  3. ⛔ **EVERYTHING UNDER `/website/*` KEEPS ITS ROUTE.** editor · editorial · our-story ·
     privacy · hero-photo · colors · dress-code · what-to-bring · widgets · site-chrome ·
     living-hero · photo-moments · our-photos · special-message · stories. They are the
     controller's **S5 doors**. Breaking one is a defect, not a simplification.
  4. **Only ONE surface may declare `metadata.title = 'Event Hub'` when you are done.** Grep for it
     and prove it.

── ⚠ THE CHIP TRAP — THIS IS THE PART THAT WILL GO WRONG ─────────────
The 2026-08-14 council verdict (`Event_Studio_Replot_Council_Verdict_2026-07-17.md` § 2 defect 1,
owner sign-off #2) collapsed FIVE hub doorways for one product into one free card with **exactly
two deep-link chips — Event page · Editorial** — on the reasoning, verbatim in the catalog comment:
*"the hub is the map, and the two chips are the shortcuts."*

**If the card now opens a controller whose own channel strip already carries Event page and
Editorial, a chip that lands where the card lands is "a distinction a couple can see is fake" —
the exact defect that verdict existed to remove.** Decide deliberately and say which you chose:
either the chips deep-link INTO a channel the card's landing does not already select, or they go.
⛔ Do not leave two controls that do the same thing and call it a shortcut.

── ⚠ SERIALIZE ──────────────────────────────────────────────────────
`lib/add-ons-catalog.ts` is a high-traffic shared file (WHATS_NEXT_INDEX § 6). **First command:
`gh pr view 5108 --json state` — EH3 must be MERGED before you start**, because EH3 owns the nav
label and this session owns the card that collides with it. If EH3 is open, STOP and hand back
saying so (autonomy rule 14).

PROOF REQUIRED:
  · `git grep -n "title: 'Event Hub'"` returns exactly ONE surface. Print it.
  · Every `/website/*` child route still resolves — enumerate them and show each one.
  · The card and the nav slot land on the SAME page. One observation, both paths.
  · A test that fails if a second surface ever re-claims the name. Mutation-test it by adding a
    second `metadata.title = 'Event Hub'` and showing it goes RED, occurrence count before → after.
  · State which you chose for the chips, and why.
