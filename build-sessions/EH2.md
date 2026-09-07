# EH2 — View as — the couple can check what each person sees

**Model:** Opus 5 · **Effort:** high · **Wave:** now — EH1 is merged · **Owner-ruled 2026-09-02**

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

TASK — EH2: five roles, one switch, and the host check every one of them goes through

OWNER ASK, 2026-09-02, verbatim: *"make sure it also has view as (they pick what each
role sees)."*

THE GAP: everyone opens the same address and what it shows depends on who they are — and the
couple has no way to CHECK that. They can only trust it. The Hub resolves **six ways in**
(stranger · QR-session guest · seat-holder · invited account · host member · booked supplier) and
shows none of that to the person who owns the event.

🚨 THIS IS THE HIGHEST-RISK SESSION IN THE STREAM. READ THIS BEFORE ANY CODE.
`loadHostMembership` once selected `member_type` **and then never compared it**, returning
`Boolean(memberRow)` — so ANY row counted as a host, and **a guest could open a PRIVATE site and
use `?phase=` to jump to phases the couple had not launched, including their own unsent
save-the-date.** That is why `app/[slug]/_lib/host-scope.ts` exists and why
`HOST_MEMBER_TYPES = ['couple','coordinator']` is named in ONE place instead of retyped.
**This session ships that same override to FIVE roles instead of one.**

  1. **Where it goes:** the switcher mounts on the stage's lower edge, inside `HubStage`
     (`launch/_components/hub-stage.tsx`), under the facts. It is a property of the stage, not a
     setting — it never moves into a sheet. Prototype §3, and the desktop frame in §2 shows it
     full-width with the caption "the stage above becomes their page".
     **Colour it from `OB`** — the obsidian token object EH1 already exports from that file.
  2. **Where the logic goes:** `lib/event-hub-control.ts`, beside the resolvers EH1 built. Reuse
     `HubEventRead`. Add ONE pure resolver for the role read. ⛔ Do NOT add a third phase opinion —
     `resolveHubStage` and `resolveHubPhase` already exist and are tested.
  3. **What each role sees** is design §3.2. The two splits that are REAL in code and must actually
     differ:
       · **Coordinator** = host, MINUS site editing (the editor gates `couple`-only), PLUS the two
         floor powers — writes announcements, and is the only role that may advance the running
         order.
       · **Specific guest** = guest, PLUS four things that are theirs BY NAME: their seat, the walk
         to it, photos of them, and their bound QR (a +1 confirms its own name).
     A vendor sees the supplier desk and never a guest surface; a supplier is refused pabuya. A
     stranger's read must be byte-identical to a refused shop's page.
  4. 🔒 **THE NAMED-GUEST READ IS A PRIVACY SURFACE.** "As Ana Reyes" renders one real guest's
     personal view to the host. Almost certainly fine — the host issued her QR — but it is the
     owner's call as DPO and it is NOT yours. **Build the four generic roles unconditionally; put
     the NAMED role behind the existing env-flag mechanism, defaulted OFF**, and record the open
     question in your handback. Do not stall waiting for an answer (autonomy rule 12).
  5. A refused read renders `NOT_SHARED`, never an empty state.

PROOF REQUIRED:
  · A `guest`-typed `event_members` row is REFUSED on every preview path. Show the test, then
    mutation-test it by relaxing the check to `Boolean(memberRow)` — it must go RED. Print the
    occurrence count before and after.
  · Six observations, one per role plus the stranger.
  · State plainly in the handback whether the named-guest flag is on or off in production.
