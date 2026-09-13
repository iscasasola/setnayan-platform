# EH1 — the day-of services page becomes the Event Hub controller

**Model:** Opus 5 · **Effort:** high · **Wave:** now · **Owner-ruled 2026-09-02**

Measured against `origin/main` @ `a289d384c` and the live database on 2026-09-02. Re-fetch and re-measure before you act.

Start a new Claude Code session and paste EVERYTHING below the rule.

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

EVENT HUB STREAM — READ THESE TWO FIRST, THEY ARE THE DESIGN:

  · `~/Documents/Claude/Projects/Setnayan/EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md`
    — the menu ruling (§1), the controller's five jobs (§2), the five-role matrix (§3), the craft
    numbers (§4), the upgrade rules (§5), the twelve inputs (§6).
  · `~/Documents/Claude/Projects/Setnayan/prototypes/event_hub_controller_2026-09-02.html`
    — the drawn surface: three phone states, the 1080 desktop, View-as, the port contract.

⭐ THE RULE-0 FINDING THAT DEFINES THIS WHOLE STREAM — do not rediscover it, and do not build
around it: **`app/dashboard/[eventId]/launch/page.tsx` ALREADY holds both halves.** It renders the
three day-of services (Live Studio · Live Wall · Papic, each with an owned/upsell branch) AND the
four public stages via `PUBLIC_SITE_PAGES` (Save-the-Date · RSVP · Day-of · **Editorial**), with
"Active now" on the live one. It is labelled **"Services"** and it is reachable **only in the
day-of phase**. This stream is a PROMOTION, a RENAME and a STAGE — not a new page. If you find
yourself creating a route, stop and re-read this paragraph.

🚨 THE TRAP THAT WILL BITE EVERY SESSION IN THIS STREAM — two lifecycle resolvers, one import
apart, meaning different things. `launch/page.tsx` already carries the warning in its own header:
  · `getLifecyclePhase` (`lib/invitation-widgets`) → the PUBLIC-WEBSITE phase
    `save_the_date → rsvp → event → editorial`. It reaches `editorial` **by a second path**, so it
    is **NOT** a has-it-happened test.
  · `getMenuLifecyclePhase` (`lib/day-of-mode`) → `plan · dayof · after`. That one **is**.
Getting them backwards yields a page that is confidently wrong and that no type checker can see.

⛔ NEVER TYPE A PRICE. Read `platform_retail_catalog_v2`. Charm endings are not a rule. Measured
2026-09-02: `COUPLE_WEBSITE_PRO` is titled **"Event Hub Pro"**, ₱3,500, active; `LIVE_WALL` and
`EDITORIAL_PRO` have **no row at all** because both are in `FREE_FOR_ALL_SKUS`.

📐 THE CRAFT NUMBERS ARE IN THE REPO, NOT IN YOUR TASTE: `app/[slug]/_lib/measures.ts` defines
**FOUR** sanctioned widths (STAGE `max-w-5xl` · PLATE `max-w-3xl` · READING `max-w-prose` 65ch ·
PHONE `max-w-md`). Motion is one-shot, ≤260ms, off under `prefers-reduced-motion`. On the obsidian
stage `#17160F`: ready-green `#46A46C` (5.3:1) and accent `#E5794E` (5.7:1) — **never `--pos
#4F6B4A`, which is 2.7:1 there.** The Tailwind slot named `terracotta` is the GOLD; the CTA is
`mulberry`.

---

TASK — EH1: the controller exists, and it exists in all three phases

THE DEFECT: the one page that gathers the couple's whole public address renders for a
few hours. `launch/page.tsx` is reachable only from the day-of roster
(`lib/customer-menu.ts`, `ctx.phase === 'dayof'`, the `services` tab). For the MONTHS before the
day — when the save-the-date and the invitation ARE the product — and the months after, when the
story is, the page exists and nothing links to it.

⭐ NOTHING HERE IS A NEW PAGE. You are restructuring one file that already reads everything it
needs, and un-gating the door to it.

── PART 1 · THE STAGE ────────────────────────────────────────────────
  1. Give the page the control-centre order, S1–S7 (design §3.3):
     **stage · four facts · one next step · the parts · set-once · money · offers last.**
     The stage is a **living miniature of `/[slug]` in its current public phase**, with
     **"Open as a guest"** beside **"Edit the page"**. Prototype §1, first frame.
  2. The four facts ride on the stage's lower edge: **the stage it is in · replies in of invited ·
     who hasn't replied · days to go.** They are the first TEXT on the page even though the stage
     is the first PAINT.
  3. ⚠ EMPTY IS A PROMISE, NOT AN APOLOGY. An event with nothing set yet shows the page it will
     become plus a countdown — never a sentence apologising for being empty, and never a
     stranger's wedding as a sample.

── PART 2 · IT RENDERS IN ALL THREE PHASES ───────────────────────────
  4. The page already computes `activePhase` (`getLifecyclePhase`) and `eventHasHappened`
     (`getMenuLifecyclePhase`). Keep BOTH and keep them straight — see the trap above. The stage
     follows the first; the copy and the next-step follow the second.
  5. The existing three service cards and the four `PUBLIC_SITE_PAGES` cards become **S4 · the
     parts** — the four stages of the one link first, the three day-of services second. Their
     owned/upsell branches are UNCHANGED; reuse `resolveAddOnState`, `eventOwnsSku('LIVE_WALL')`,
     `eventPapicActive()` exactly as they are read today.
  6. ⛔ NO OFFERS ON THE EVENT DAY. On the day the upsell branch collapses to nothing. An offer
     never outranks the day.
  7. ⛔ NO CONFIRMATION DIALOG on any day-of verb. Friction at a ceremony is worse than the thing
     it prevents.

── PART 3 · THE READS MUST BE HONEST ─────────────────────────────────
  8. Every fact on the stage needs an **unread ≠ empty** state. A refused read returning `[]` and
     a genuinely empty event are byte-identical, and a couple with 180 guests was once told
     *"No guests yet."* Copy the shipped pattern: `lib/guests.ts` + `guests-read-is-honest.test.ts`.
     **A log line never changed a pixel — the measurement must reach the RENDER.**

⛔ OUT OF SCOPE, DELIBERATELY: the menu label (EH3), View-as (EH2), the per-channel upgrade offer
(EH4), the editorial workroom (EH5). Do not touch `lib/customer-menu.ts` in this session — EH3
owns it, and two sessions editing one SSOT is the merge treadmill this repo already paid for.

PROOF REQUIRED:
  · The page renders for an event 107 days out, an event today, and an event last month — three
    observations, each showing the correct stage and the correct copy.
  · Mutation-test the phase split: swap `getLifecyclePhase` for `getMenuLifecyclePhase` in the
    stage selector and show a test goes RED. If it stays green, your test does not face the trap.
  · Show the honest-read guard fails when a read is made to return `[]` on an event with guests.
