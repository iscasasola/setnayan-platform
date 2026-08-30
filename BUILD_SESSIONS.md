# BUILD SESSIONS — the completion program

> **Oversight register.** One Claude Code session (the *overseer*) holds this file and tracks every
> build session to MERGED. The owner spawns the build sessions; the overseer never builds.
>
> **Measured against `origin/main` @ `f8e58005f` (2026-08-29) on 2026-08-30**, after `git fetch`.
>
> 🔴 **READ § 0 BEFORE ANYTHING ELSE.** The first cut of this file was measured against a local
> checkout **2237 commits behind** `origin/main` while claiming to be measured against
> `origin/main`. Four of its findings were wrong and one was invented. It was caught by a peer
> session, not by me.

---

## ✅ 00 · RESOLVED HAZARD — PR #5013 (closed 2026-08-30, never merged)

**CLOSED WITHOUT MERGING at 20:31:11Z — 21 minutes after auto-merge was armed.** `mergedAt: null`,
`mergeCommit: null`, `autoMergeRequest: null`, and the branch tip `2ff4fa1cf` is **not** an ancestor
of `origin/main`. The remote branch was deleted with it.

✅ **C6 then landed correctly** via **PR #5016** (`claude/c6-areaserved-city-v2`), and the merged
version keeps the fail-open fallback intact — `City` when `location_city` is set, `Country` when it
is not. **C6 is DONE.**

⚠️ **One near-loss worth recording:** when #5013 closed, its remote branch was deleted and the local
branch went with it, leaving the correct fix as a **dangling commit referenced by nothing**. It was
rescued to a local branch, then verified redundant against the merged #5016 and dropped. Had #5016
not existed, that fix was one `git gc` from gone.

*Original finding, kept because the process lesson stands:*

| Fact | Value |
|---|---|
| PR | [#5013](https://github.com/iscasasola/setnayan-platform/pull/5013) "fix(seo): scope vendor JSON-LD areaServed to city, not country" |
| State | **OPEN · not a draft · auto-merge ARMED** (`enabledBy iscasasola`, 2026-08-29T20:10:38Z, method MERGE) |
| Held back by | `mergeStateStatus = DIRTY` — conflicts. **That is the only thing stopping it.** |
| Size | 99 files, +5870 / −455 |
| Base | **stale — 2237 commits behind `origin/main`**; merge-base `d3988ed66` (2026-08-06) |

### The diagnosis is narrower than the size suggests

- ✅ **The real C6 change is TWO FILES** — `app/v/[slug]/page.tsx` (+8/−1) and
  `changelog.d/geo-c6-areaserved-city.md`. **The code is correct** and fails open exactly as
  required: `City` when `location_city` is set, `Country` fallback when it is not.
- ✅ **The nine platform product pages and `layout.tsx` are UNTOUCHED.** The feared
  break-nine-correct-pages failure did not happen.
- 🔴 **The other 97 files are ONE commit — `8512e6f56`**, the divergent local-main commit, swept in
  because the branch was cut from the **stale shared checkout** instead of `origin/main`. Its
  content is already upstream under a different SHA, so merging would re-apply an old version of
  97 files that have since moved 2237 commits. That is why it is DIRTY.

### The remedy is proven, not inferred

Two claims were made about this PR on weak evidence — one by me, one by a peer — and both were
replaced with a test.

- ❌ *"`8512e6f56`'s content is already upstream under a different SHA."* I asserted that from **one
  filename**. `git cherry` marks both commits `+` (neither patch is upstream by patch-id), so that
  assertion was not supported by what I had checked.
- ✅ **The accounting, done properly:** all **97 files** touched by `8512e6f56` — 29 added, 68
  modified — are present on `origin/main`. **Zero absent.**
  ```
  comm -23 <(git show --name-status --format="" 8512e6f56 | grep -E '^[AM]' | cut -f2 | sort -u) \
           <(git ls-tree -r --name-only origin/main | sort -u)     # → empty
  ```
- ✅ **The test that actually decides it** — replay the real C6 commit onto current `origin/main` in
  a throwaway worktree:
  ```
  git worktree add --detach <tmp> origin/main && git cherry-pick 2ff4fa1cf
  git diff --stat origin/main HEAD
  #  apps/web/app/v/[slug]/page.tsx        |  8 +++++++-
  #  changelog.d/geo-c6-areaserved-city.md | 12 ++++++++++++
  ```
  **CLEAN cherry-pick, and the result differs from `origin/main` by exactly the two C6 files.**

🔑 **This test is better than the accounting, because it does not depend on the upstream question at
all.** Whatever is or is not upstream, `8512e6f56` is not C6's work and does not belong in an SEO
PR. If any of its edits genuinely never landed, that is a separate branch's problem — never
something to smuggle through this one.

### What to do — and the one thing nobody should do

⛔ **DO NOT RESOLVE THE CONFLICTS BY HAND.** That is the action that would clobber 2237 commits of
newer work in 97 files, and it is the exact way this becomes a disaster instead of a chore.

Recommended, owner's call (auto-merge was armed under the owner's account):

```bash
gh pr ready --undo 5013        # convert to draft — disarms auto-merge, fully reversible
gh pr merge --disable-auto 5013
```

Then rebase the branch onto a freshly fetched `origin/main`, **dropping `8512e6f56`**, and #5013
becomes a clean 2-file PR that is already correct.

### Two process failures this exposes

1. **The C6 session built in the SHARED CHECKOUT**, not a worktree — violating working rule 1. That
   is also why `~/Documents/Claude/Projects/setnayan-platform` reads as stale to every session that
   looks at it: it is not on `main` at all, it is on `claude/c6-areaserved-city`.
2. **It branched without fetching**, violating working rule 3 — which is the same mistake this
   register made in § 0. Rule 0 in the contract exists for both.

⚠ **No live C6 session is running** (checked 2026-08-30). Nobody is at the wheel of that branch.

---

## 0 · THE MISTAKE THIS FILE ALMOST SHIPPED

`~/Documents/Claude/Projects/setnayan-platform` sits on local `main` at `8512e6f56`
(**2026-08-21**). Real `origin/main` is `f8e58005f` (**2026-08-29**) — **2237 commits ahead**.
The checkout is also **1 commit divergent**; that commit's content *is* upstream under a different
SHA (`guest-doorway-strip.tsx` is present on `origin/main`), so no work is lost.

**Everything the first cut "measured" came from an 8-day-old tree.** What that cost:

| First cut said | Truth on `origin/main` |
|---|---|
| "`areaServed` is at line 1533, not ~1719 — the doc rotted" | **The doc was right. It is line 1719.** My correction was the rot. |
| "`WHAT_IS_LEFT.md` is not in this repo — every session's first instruction points at nothing" | **It IS in the repo.** Finding retracted entirely — it was invented by the stale tree. |
| "C9's camera-claimer defect is the one real item left" | **Already fixed.** The pill renders `{s.holderName ?? 'Claimed'}`. |
| "C3 has never been built; stamp it with a trigger" | **Fully shipped** — two migrations, two triggers, two backfills. |

**Two rules follow, and they are the reason this section exists:**

1. 🔑 **`git fetch` and measure against `origin/main`, never a local checkout.** Use
   `git grep <pattern> origin/main -- <path>` so no checkout state can lie to you.
2. 🔑 **NEVER ANCHOR ON A LINE NUMBER.** Every row below carries a **greppable string** instead.
   A line number is a fact about one tree at one moment; this project's own rule says so, and this
   file broke it in its first hour.

---

---

## 0b · PREMISE PASS — every remaining session re-verified 2026-08-30

Measured against `origin/main` @ `861436f2c`, **after** the fetch. Run because two of ten sessions
had already shipped and the question "how do we know the rest haven't?" deserved an answer.

| | Premise | Verdict |
|---|---|---|
| **C6** | areaServed hardcoded to country | ✅ **SHIPPED** — PR #5016, fail-open intact. Dropped. |
| **C10** | our notes are wrong | ⚠️ **MERGED BUT INCOMPLETE** — see below |
| **C1** | `kinship-derive` imported by nothing but its test | 🔴 HOLDS |
| **C2** | no vendor-side `venue_type` write | 🔴 HOLDS |
| **C4** | no dependent page route | 🔴 HOLDS |
| **C5** | no avatar maker | 🔴 HOLDS |
| **C7** | `HOME_TITLE` still wedding-only | 🔴 HOLDS |
| **C8** | nothing asks for notification permission | 🟡 HOLDS, **but re-scope** |

### C10 merged and did 1 of 11 items — and missed the file that matters most

PR **#5015** touched **`STATUS.md` and a changelog fragment. Nothing else.** `CLAUDE.md` line 51
still reads `0 packages · 0 ORDERS EVER` — **the auto-loaded file, the one every session reads
first**, and the exact "a correction that lands in one file has not landed" failure its own prompt
opens by warning about. **C10 needs a follow-up session covering items 1–11 with `CLAUDE.md` first.**

### C8 must be re-scoped before it runs

`Notification.requestPermission` now appears in six files — but the registrar is mounted only in
`app/vendor-dashboard/layout.tsx`. **Nothing asks anywhere on the guest QR-scan / seat-claim path**,
so C8's actual job is intact. What changed is that `push-notification-registrar.tsx` is now a
**working model to reuse rather than a thing to invent** — the session should adapt it, not
re-derive it, and must not re-plumb push that already works.

---

### ⚠ STANDING TRAP — a silent `git add` (found 2026-08-30)

`build-sessions/` was invisible to git for its whole first day: the root `/*` allowlist ignores every
new top-level path, so `git add build-sessions/` would have exited 0 and staged nothing. The prompts
would simply never have entered the repo, with no error at any point.

🔑 **It was found, then written down in exactly ONE prompt file — which is the same defect this
program keeps diagnosing.** It is now **rule 0b of the shared contract**, so every session inherits
it. Landing anything new at the root requires its `!/path` line in the same commit.

---

## 1 · THE RULES OF THIS PROGRAM

1. **Never more than TWO build sessions at once.** Ten parallel builds once shipped 44 defects.
2. **Count worktrees before starting.** Under contention `tsc` exits 134/143/144 while printing
   `errors=0` — a session under load reads its own typecheck as a pass.
3. **A session that finds its premise FALSE stops and reports.** It does not manufacture work.
   **Two of the ten sessions on the first list were already shipped.** Expect more.
4. **Done means MERGED with proof** — never "it typechecks", never "PR opened".
5. **The overseer verifies independently.** A session's own report is a claim, not evidence.
   So is this file.

---

## 2 · WHAT IS ACTUALLY LEFT — measured on `origin/main`

### Dropped: already shipped
- **~~C3 · photos remember who took them~~** — **DONE.** `20271170468759_who_took_this_photo.sql`
  creates `tg_stamp_capturer_person()` on `papic_photos`;
  `20271171474426_guest_capture_has_a_capturer.sql` creates `tg_stamp_guest_capturer_person()` on
  `papic_guest_captures`. Both re-backfill. Both carry the "a backfill is a point-in-time act"
  warning in their own headers, and the second refuses to apply if its trigger is absent.
- **~~C9 · four small promises~~** — nothing buildable left.
  · **Camera claimer name — DONE**, `{s.holderName ?? 'Claimed'}`.
  · **Host stranger-copy — DONE**; the five remaining hits for `scan your invitation QR` are all
    *comments and test docstrings describing the old defect*, not live copy.
  · **NPC residency — DONE** in the pack; the residual corpus strings move to C10.
  · **/privacy stays honest — a standing do-not-touch**, not a task.

### Premises re-confirmed on `origin/main` — build as scoped
| | Greppable anchor | State |
|---|---|---|
| **C1** | `lib/kinship-derive.ts` | imported by **`kinship-derive.test.ts` and nothing else** |
| **C2** | `venue_type` under `app/vendor-dashboard/` | **zero** vendor-side write paths |
| **C4** | any route under `app/**/dependent*` | **no page route exists** |
| **C5** | any avatar *maker* | none — `guest-avatar.tsx` / `vendor-avatar.tsx` are renderers |
| **C6** | `areaServed: { '@type': 'Country', name: 'Philippines' }` | present in `app/v/[slug]/page.tsx` |
| **C7** | `const HOME_TITLE = ` in `app/page.tsx` | `'Setnayan · Plan your Filipino wedding free — and never lose a photo'` — still wedding-only |
| **C8** | `push_subscriptions` | built, mounted, **zero rows** |
| **C10** | `0 ORDERS EVER` in `CLAUDE.md` | still asserted, still false |

### Re-scoped by the re-measurement
- **C6 is bigger than one line.** There are **16** `areaServed` sites on `origin/main`, not one.
  Nine product pages (`alaala` · `pa3d` · `pakanta` · `palogo` · `panood` · `papic` · `patiktok` ·
  `pawebsite` · `setnayan-ai`) plus `layout.tsx` declare `'Philippines'` **for the platform
  itself — those are CORRECT and must not be touched.** The defect is only where a *shop* is
  described: `app/v/[slug]/page.tsx` and `app/vendors/page.tsx`. C6 must make that distinction
  explicitly or it will break nine correct pages.
- **C7's title has changed** since the source doc quoted it. It is now
  `'…Plan your Filipino wedding free — and never lose a photo'`. Still wedding-only; the defect
  holds, the quoted string does not.
- **C8's counts moved again** — `emitNotification` is **223 occurrences across 69 files**
  (the source doc said 108/61; the stale tree said 186/55). **Three different numbers in three
  measurements is the argument for never writing the number down.** C8 must not restate it.
- **C10 loses one item and gains a better one.** The "missing `WHAT_IS_LEFT.md`" item is
  **retracted — false**. In its place: the corpus files `README.md` and
  `API_Integration_Checklist.md` still say `R2 (PH region)`, and the registers
  `WHAT_IS_LEFT_2026-08-05.md` / `WHAT_IS_ACTUALLY_LEFT_2026-08-12.md` still carry closed items as
  open. Plus a standing instruction: **stop writing line numbers and occurrence counts into
  documents at all** — three of this program's own corrections were caused by exactly that.

### Housekeeping — not a session
🛑 **Do not prune `wt-editable-prices`.** PR #4952 is MERGED and nothing is unpushed, but the
working tree holds two uncommitted files. One is a **regression**: `booking-fee-lock.server.ts`
swaps the derived `bookingFeeScheduleSummary(liveSchedule)` for a hard-coded `(5%)` — wrong for
every booking above ₱100,000, and the exact bug its own guard exists to catch. The paired test edit
(widen the guard to accept a variable, still reject an inline literal) is good work. **Owner
decision: salvage or discard.**

⚠ **The main checkout is 2237 commits behind and 1 divergent.** The divergent commit's content is
already upstream, so `git fetch && git reset --hard origin/main` is safe — but that is the owner's
call on the owner's checkout, not the overseer's.

---

## 3 · THE WAVES

**Eight build sessions in five waves.** Two at a time, never more. Ordering honours the conflict
pairs: ⛔ never C1 with C4 (both rewrite the People area) · ⛔ never C6 with C7 (both edit the
public search surface). *C3+C5 is no longer a constraint — C3 shipped, so C5's gate is satisfied.*

| Wave | Sessions | Model · Effort | Gate |
|---|---|---|---|
| **1** | **C10** our own notes stop being wrong | Sonnet 5 · high | none — start now |
| | **C6** a Cebu shop stops looking like a Manila shop | Sonnet 5 · medium | none |
| **2** | **C7** the public copy stops being wedding-only | Opus 5 · medium | **after C6 merges** |
| | **C2** a venue says what kind of venue it is | Sonnet 5 · medium | none |
| **3** | **C5** people in the 3D room look like themselves | Opus 5 · high | **unblocked** (C3 shipped) |
| | **C8** notifications finally have a subscriber | Sonnet 5 · medium | **owner confirms VAPID keys** |
| **4** | **C1** your family tree, drawn | Opus 5 · high | **after P0-b** |
| **5** | **C4** a business has a record, a page and a timeline | Opus 5 · high | **after P0-b · after C1** |

**Why C10 is `high` and not `medium`:** it spans the repo, the corpus and two auto-loaded
`CLAUDE.md` files, and its failure mode — a correction that lands in one file and not the rest —
is the thing it exists to prevent. This file proved that failure mode twice in one day.

### The owner track — runs in parallel
| | What | Cost | Blocks |
|---|---|---|---|
| **P0-b** | Write down which switches are ON in production | 1 hour | **C1 and C4 — the critical path** |
| **P0-a** | Re-authorise YouTube, stream 5 real minutes | half a day | selling Live Studio |
| **P3** | Run one real celebration end to end | a real event | nothing — it *is* the point |
| **P4** | Four decisions only you can make | a sitting | public copy wording |

P0-b minimum to write down: `NEXT_PUBLIC_DEPENDENT_PEOPLE` · `NEXT_PUBLIC_PEOPLE_CONNECTIONS` ·
`NEXT_PUBLIC_LIFE_STORY` · `NEXT_PUBLIC_PANOOD_STREAMING_ENABLED` ·
`NEXT_PUBLIC_SMART_SORT_ENABLED` · `NEXT_PUBLIC_BOOKING_FEE_ENABLED` ·
`SUPPLIER_NIGHT_BEFORE_EMAIL_ENABLED`.

---

## 4 · THE COMPLETION CONTRACT — paste at the top of EVERY session

The project's ten working rules, plus six autonomy rules that keep a session running to done.

```
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
```

---

## 5 · TRACKING BOARD

| Session | Model · Effort | Branch | PR | State | Verified by overseer |
|---|---|---|---|---|---|
| C10 | Sonnet 5 · high | `claude/c10-docs-stop-being-wrong` | **5015** | ⚠️ **MERGED, INCOMPLETE** — 1 of 11 items; CLAUDE.md untouched | ⚠️ needs follow-up |
| ~~C6~~ | — | `…-v2` | **5016** | ✅ **MERGED** — fail-open intact | ✅ verified 2026-08-30 |
| C7 | Opus 5 · medium | — | — | after C6 | — |
| C2 | Sonnet 5 · medium | — | — | ready | — |
| C5 | Opus 5 · high | — | — | ready | — |
| C8 | Sonnet 5 · medium | — | — | needs VAPID check · **re-scope, reuse vendor registrar** | premise holds |
| C1 | Opus 5 · high | — | — | **blocked on P0-b** | — |
| C4 | Opus 5 · high | — | — | **blocked on P0-b, C1** | — |
| ~~C3~~ | — | — | — | **SHIPPED — dropped** | ✅ 2026-08-30 |
| ~~C9~~ | — | — | — | **SHIPPED — dropped** | ✅ 2026-08-30 |
| P0-b | owner | — | — | **blocks C1, C4** | — |
| P0-a | owner | — | — | not started | — |
| P3 | owner | — | — | after wave 4 | — |
| P4 | owner | — | — | not started | — |

---

## 6 · HOW WE KNOW THE PROGRAM IS FINISHED

1. A stranger completes the whole journey — plan, book a real supplier, pay, run the day, get the
   photos, read the story — without hitting anything that does not work.
2. Nothing on the public site claims something that is not built.
3. Every switch's production value is written down where a session will find it.
4. Our own notes agree with the code.

⚠ **This file rots at the same rate as every register before it, and that sentence applies to
itself — it was wrong four times within an hour of being written. Re-verify against a FETCHED
`origin/main` before acting on any line.**
