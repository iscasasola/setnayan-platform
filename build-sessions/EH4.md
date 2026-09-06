# EH4 — one unlock, offered where it is missed

**Model:** Sonnet 5 · **Effort:** high · **Wave:** now — parallel with EH2 and EH3 · **Owner-ruled 2026-09-02**

Measured against `origin/main` @ `1838a68c6` (EH1 MERGED, PR #5102) and the live database on 2026-09-02. Re-fetch and re-measure before you act.

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
  · `~/Documents/Claude/Projects/Setnayan/prototypes/event_hub_controller_2026-09-02.html`

✅ **EH1 IS MERGED (PR #5102) AND ITS WORK IS IN `origin/main` — VERIFIED, NOT ASSUMED.** Read it
before you write anything; it is the substrate for this session and it already solved several
things the design document only described.

**What EH1 shipped — these are your anchors, cite them by name, never by line number:**

  `apps/web/lib/event-hub-control.ts` — the PURE resolver module, in the
  `lib/live-studio-control.ts` shape (page + server actions + tests share one source of truth):
      type  HubEventRead · HubGuestRead · HubStanding · HubFact · HubNextStep
      fn    resolveHubStage(read, nowMs?)    -> LifecyclePhase       (the PUBLIC-WEBSITE stage)
      fn    resolveHubPhase(read, nowMs?)    -> MenuLifecyclePhase   (plan · dayof · after)
      fn    resolveHubStanding(read, nowMs?) -> HubStanding
      fn    hubOffersAllowed(phase)          -> boolean
      fn    resolveHubFacts(...) · resolveHubNextStep(...)
      const NOT_SHARED = 'Not shared with you'

  `apps/web/app/dashboard/[eventId]/launch/_components/hub-stage.tsx`
      export const OB   — the obsidian token object (page · card · text · soft · gold · cta · hairline)
      export function HubStage({ slug, standing, facts, channelName, channelBlurb,
                                 channelIndex, channelCount, editHref, ... })

  `apps/web/app/dashboard/[eventId]/launch/page.tsx` — restructured into the slot order, with
  the slots marked in comments: **S1+S2** (HubStage) · **S3** next step · **S4** the four stages ·
  **S4b** the three services · **S5** set-once doors · **S7** the boundary.
  ⚠ **S6 (the money card) was NOT built.** If you think you need it, say so; do not assume.

🚨 THE TWO-RESOLVER TRAP IS NOW SOLVED IN CODE — DO NOT ADD A THIRD OPINION. `resolveHubStage`
(website stage) and `resolveHubPhase` (has-it-happened) are separate, named and tested. Call them.
Never re-derive a phase from `getLifecyclePhase`/`getMenuLifecyclePhase` inside this stream — two
mechanisms that can disagree about one fact is the defect this repo has paid for most often.

🔑 `NOT_SHARED` IS THE HONEST-READ SENTINEL. A refused read and a genuinely empty event are
byte-identical otherwise, and a couple with 180 guests was once told *"No guests yet."* Reuse the
constant; do not invent a second empty-state string.

🎨 USE `OB` FOR ANYTHING ON THE STAGE. The obsidian ground is `#17160F`; light-ground tokens fail
there (`--pos #4F6B4A` measures 2.7:1). `OB.gold`/`OB.cta` are the measured dark-safe pair.
The Tailwind slot named `terracotta` is the GOLD; the CTA is `mulberry`.

⛔ NEVER TYPE A PRICE. Read `platform_retail_catalog_v2`. Measured 2026-09-02:
`COUPLE_WEBSITE_PRO` is titled "Event Hub Pro", ₱3,500, active; `LIVE_WALL` and `EDITORIAL_PRO`
have **no row at all** — both are in `FREE_FOR_ALL_SKUS`.

📐 `app/[slug]/_lib/measures.ts` defines **FOUR** sanctioned widths (STAGE · PLATE · READING 65ch ·
PHONE). Motion one-shot, ≤260ms, off under `prefers-reduced-motion`.

---

TASK — EH4: the seven Pro items are one purchase, sold on the channel the couple is standing on

OWNER ASK, 2026-09-02: *"the cinematic reveal, added features like background music,
upload photo/video, and other pro features should be managed on the controller as well."*

⭐ RULE 0 ANSWER FIRST: **they are already one named set, and the owner named four of the seven
from memory.** `WEBSITE_PRO_ITEMS` in
`app/dashboard/[eventId]/website/editor/_components/pro-panels.tsx` — *"the seven Pro items, named
the way the couple sees them"*: **Cinematic Reveal · Save-the-Date video · Photo gallery ·
Background music · Editorial editing · Background color · Button color.**

🔑 **ALL SEVEN ARE ONE UNLOCK.** `COUPLE_WEBSITE_PRO`, titled **"Event Hub Pro"** in the live
catalog, **₱3,500**, active. That file's own docblock: *"the seven Pro items are ONE unlock … no
per-feature buy button."* **So the controller does NOT grow seven upgrade slots. It grows ONE,
offered seven times** — on whichever channel the couple is standing on when they hit the wall.

🛑 **DO NOT REBUILD THE OFFER GATE — EH1 ALREADY SHIPPED IT, AND IT IS CORRECT.**
`hubOffersAllowed(phase)` exists in `lib/event-hub-control.ts`, is already imported by
`launch/page.tsx` as `offersAllowed`, and is already tested. **Call it. Do not write a second one,
and do not widen it.**

Its body is `return phase === 'plan'`, and that one line is deliberately doing **three** jobs — its
own docblock names them:
  · **on the day** — an offer never outranks the day (design § 5.1 rule 3);
  · **after the day** — the row closes rather than sells, which is the OWNER RULING of
    **2026-08-21** (*"stop selling the day itself once the day is over"*), shipped three weeks
    before this stream and guarded by `lib/stop-selling-the-day-after-the-day.test.ts`;
  · **when the phase is UNMEASURED** (`null`) — we do not know whether it is their wedding day, and
    an unread state must never become a sale.

⚠ **The design document was the thing that was wrong here, not the code.** § 5.1 rule 3 read "never
on the day" alone until 2026-09-02; it now states all three cases. If you find a fourth surface
that sells, gate it on this same predicate rather than reasoning about phases yourself.

  1. Each of the four channels carries the unlock for the Pro items that belong to it (design
     §5.3): Cinematic Reveal + Save-the-Date video on Save-the-Date · Photo gallery on RSVP and
     Editorial · the three global ones wherever they are. One price, one CTA, seven chips with the
     one they are standing on lit. Prototype §4.
  2. 🔑 **SHOW IT WORKING — DO NOT DIM AND LOCK.** The Live Studio Wave 3 correction, owner-locked
     2026-07-25, applies verbatim: *"Seeing the cameras actually working IS the conversion
     mechanism; hiding or dimming them recreates the exact defect Wave 3 exists to fix — asking
     ₱3,000 for an experience the couple has never felt, for a day that cannot be redone."*
     No greyscale tile. No lock badge over the content.
  3. ⛔ **DO NOT SELL ON "EDITORIAL EDITING".** `EDITORIAL_PRO` joined `FREE_FOR_ALL_SKUS` on
     2026-08-23 — every couple already passes — and `couple-website-pro.ts` states the constraint
     itself: *"Event Hub PRO may NOT be SOLD on this inclusion while it is free."* Show the item;
     never make it a reason to buy.
  4. ⚠ **GRANDFATHERING IS DECIDED SERVER-SIDE** (`lockedIf` in the editor's `page.tsx`). A couple
     with existing content keeps editing. The controller READS that decision; it never re-derives it.
  5. **S6 — the money card — was not built by EH1.** If this session needs one, build it in the slot
     order (after S5, before S7) and say so; do not smuggle it in elsewhere.

🪤 **THE PRECEDENT THAT MAKES THIS SESSION DANGEROUS.** Papic's card could never light up for a
year because it was gated on `eventPapicSeatsActive()` — a retired SKU with zero orders ever — so
the one page that exists to say *"start this now, it's your wedding day"* was permanently stuck on
the upsell branch for EVERY couple, including couples whose event already held a free camera.
**Every gate you add needs a test that constructs an OWNING event and asserts the card is on the
LAUNCH branch, not the upsell branch.**

PROOF REQUIRED:
  · For an event that OWNS Event Hub Pro: no offer renders on any channel. Test it.
  · For an event that does not: the offer renders, un-dimmed, with the content visible behind it.
  · On the event day, after it, AND with an unmeasured phase: the offer block renders NOTHING.
    Three observations. Mutation-test by forcing `hubOffersAllowed` true and showing the test
    goes RED.
  · Assert no hard-coded peso figure exists in the new code — grep for `₱` and for `3500`.
