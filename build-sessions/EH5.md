# EH5 — channel four opens a workroom, not a sheet

**Model:** Sonnet 5 · **Effort:** medium · **Wave:** NOW — unblocked, with a scope fence · **Owner-ruled 2026-09-02**

Measured against `origin/main` @ `6dc88a047` on 2026-09-03. Re-fetch and re-measure before you act.

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

TASK — EH5: the story is the fourth channel, and it opens a workroom

✅ **THIS SESSION WAS BLOCKED AND IS NOT ANY MORE — but it has a HARD SCOPE FENCE. Read this first.**

An earlier version of this prompt said to stop unless PR **#5012** had merged. That was too broad:
it assumed you must EDIT the editorial files, when your work is controller-side and only READS
them. Re-measured 2026-09-03 — #5012 touches exactly six paths:

    apps/web/app/dashboard/[eventId]/website/editorial/page.tsx          <-- DO NOT EDIT
    apps/web/app/dashboard/[eventId]/website/editorial/actions.ts        <-- DO NOT EDIT
    apps/web/app/dashboard/[eventId]/website/editorial/_components/editorial-editor.tsx  <-- DO NOT EDIT
    apps/web/app/dashboard/[eventId]/website/privacy/page.tsx            <-- DO NOT EDIT
    apps/web/lib/stories-opt-in-is-reachable.test.ts
    changelog.d/stories-opt-in-is-reachable.md

⛔ **THE FENCE: do not edit those four source files.** #5012 is `OPEN` and `CLEAN` but **auto-merge
is NOT ARMED**, so nothing will merge it until a human does — it may sit for hours. Editing them
means the conflict EH2 already cost this stream a rebase for.

✅ **WHAT YOU MAY READ FREELY — verified untouched by #5012:**
    apps/web/app/[slug]/_components/editorial/data.ts   (chapters, custom columns, the composer row)
    apps/web/lib/guest-columns-gate.ts                  (whether guest columns are on)
    apps/web/lib/couple-website-pro.ts                  (isEditorialProActive)

🛑 **IF YOU DISCOVER YOU MUST EDIT ONE OF THE FOUR** — for example if making channel 4 render full
screen genuinely requires a layout change inside `editorial/page.tsx` — **STOP, do not edit it, and
hand back saying exactly which file and why.** That is a complete and successful session (autonomy
rule 14). Do not work around the fence by copying the file, and do not "temporarily" edit it.

── THE RULING, ALREADY MADE — DO NOT RE-LITIGATE IT ──────────────────
Owner, 2026-09-02: *"Or should we separate the story as a separate entity."* **ANSWERED: no.**
Design § 2.4 carries the evidence: it is the same URL; "Editorial editing" is one of the seven Pro
items; the standalone `EDITORIAL_PRO` SKU has **no catalog row at all** and never landed; and since
2026-08-23 it is free for everyone, so splitting it out would give a FREE capability its own control
surface while the PAID unlock stayed on the other three channels.

WHAT IS GENUINELY DIFFERENT ABOUT THE STORY — and it is **depth, not identity**:
  · **Three authors.** The host writes, **guests write columns**, a **Setnayan admin reviews**
    (`/admin/editorial-review/[editorialId]`). The only stage with an approval queue.
  · **It outlives the event** — it feeds the account library, the public profile, the recap posts.
  · **Consent and veto** (`app/[slug]/_components/editorial/consent-veto.ts`) is a per-person,
    ongoing rights surface, not a stage setting.

── THE STREAM HAS MOVED A LOT SINCE THIS TASK WAS WRITTEN ────────────
**Six PRs merged before you. Reuse their anchors; re-deriving any of them is the defect.**

  `apps/web/lib/event-hub-control.ts` (EH1 + EH2)
      resolveHubStage · resolveHubPhase · resolveHubStanding · resolveHubFacts ·
      resolveHubNextStep · hubOffersAllowed · NOT_SHARED · **hubPreviewRoles** (EH2's View-as roles)
  `apps/web/app/dashboard/[eventId]/launch/_components/hub-stage.tsx`
      **HubStage** + **OB** (the obsidian token object — colour from it, never a light-ground token)
  `apps/web/lib/event-hub-pro.ts` + `apps/web/lib/website-pro-items.ts` (EH4)
  `apps/web/lib/hub-named-guest-flag.ts` (EH2 — the named-guest preview, **OFF in production**)

🔑 **EH6 CHANGED THE GROUND UNDER YOU (PR #5116).** `/dashboard/[eventId]/website` is now a
**redirect stub** to the controller — it is no longer a hub page. **But every child keeps its own
route, verified 15/15 in `origin/main`, and that includes `/website/editorial`, which is the page
this session opens.** Do not "fix" the redirect, and do not move the editorial editor.

  1. Channels 1–3 open a **sheet**. **Channel 4 opens FULL SCREEN** into the existing editorial
     editor at `/website/editorial`. Same page, same route — the controller simply does not shrink a
     workroom into a settings row. Prototype § 1, third frame.
  2. The controller's after-state facts become the workroom's: **chapters written · guest columns
     waiting on you · photos in · draft or published.** Build them as `HubFact[]` through
     `resolveHubFacts` — **not a second fact mechanism.**
  3. The next-step card names the real one: *"N guests wrote you a column."* Nothing a guest writes
     appears until the host says so — say that on screen, where the host decides.
  4. ⛔ Build NO new editorial engine, NO new route, NO new table. This session is routing, framing
     and four honest counts.

⛔ **AND DO NOT SELL ON IT.** `EDITORIAL_PRO` is in `FREE_FOR_ALL_SKUS`, and `couple-website-pro.ts`
states the constraint itself: *"Event Hub PRO may NOT be SOLD on this inclusion while it is free."*
`hubOffersAllowed` already suppresses offers outside `plan` anyway — call it, never re-derive it.

PROOF REQUIRED:
  · Channel 4 opens the existing editor; the other three open sheets. Show both.
  · The "N columns waiting" count is real, and renders **`NOT_SHARED`** when the read is refused —
    never "0 waiting". A refused read and a genuinely empty queue are byte-identical otherwise.
  · `/website/editorial` still resolves after your change, and `/website` still redirects.
  · State in the handback the merge state of **#5012** at the moment you branched, and confirm
    **you edited none of its four source files** — list the files you did touch.

🪤 **THREE TRAPS THIS STREAM HAS ALREADY PAID FOR — do not be the fourth:**
  · Any guard that reads SOURCE must import `stripComments` from `apps/web/lib/strip-comments.ts`.
    EH3 was red-lit for hand-rolling one; EH6 then hit the live version — *"a star-slash in prose
    swallowed 80% of the file."*
  · Run unit tests from `apps/web`, require a **non-zero test count**, and require **TSC_EXIT=0
    printed beside ERROR_LINES=0**. An empty tsc log is not a clean one.
  · A resolver test cannot prove a pixel. Assert at the **RENDER**.
