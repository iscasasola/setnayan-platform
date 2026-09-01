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
| ~~C1~~ | `kinship-derive` imported by nothing but its test | ✅ **FALSE as of 2026-08-31 13:27Z** — shipped, PR #5046 |
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

### C5 merged — and shipped DARK. Do not flip its flag.

**PR [#5042](https://github.com/iscasasola/setnayan-platform/pull/5042), MERGED 2026-08-31**
(merge `86efe2917`, verified an ancestor of `origin/main`). Premise **HELD**:
`git grep avatar_config origin/main -- apps/web` returned **only docblocks** — the column shipped in
migration `20270918210897` with **zero readers and zero writers**.

🔑 **RULE 0 PAID AN EIGHTH TIME, and this was the largest one yet.** Nearly the entire avatar system
already existed, inert, behind the EXISTING `NEXT_PUBLIC_FIGURE_CHIBI`: the catalog + sanitizer
(`lib/chibi-config.ts`), the geometry (`lib/chibi-geometry.ts`), the renderer
(`kit/chibi-figure.tsx`), and the column. That module's own header names three future consumers —
the maker client, the server sanitizer, the venue reader — and the PR is exactly those three. No new
catalog, no new sanitizer, no new hash, **no second flag**.

⛔ **THE OWNER QUESTION — `NEXT_PUBLIC_FIGURE_CHIBI` MUST STAY OFF.** The feature is complete and
merged, and it is **not ready to switch on**.

📍 **Its production value is OFF — and that is a MEASURED value, not a code default.**
`build-sessions/P0-b-SWITCHES.md` line 268 carries it, measured 2026-08-30 against the Vercel
**Production** environment (not read off `lib/chibi-config.ts`'s `defaults OFF` docblock, which is
exactly the mistake `CLAUDE.md` records the owner catching). ⚠ P0-b rots on any dashboard flip —
re-measure before acting. The PR did not change it.

Two gaps are real and were deliberately NOT faked in code:

1. **No gait.** The chibi rig is **jointless below the neck** — `lib/chibi-geometry.ts` merges legs,
   shoes and outfit into single buffers — so `pose`/`phase` have nothing to drive. An avatar figure
   **glides where the blob runs.**
2. **No seated avatars.** Same cause: "seated" is **new geometry, not a pose** (rig spec § 11 / the
   declared PR-2, gated by `chibiJunctionAudit`). Seated guests still render as anonymous
   mannequins.

⚠️ **THE SESSION'S SCOPE MOVED MID-BUILD, on purpose.** The brief asked for seated guests to look
like themselves; the rig cannot draw that. The viewer's OWN figure never sits (it stands, runs and
dances beside the chair), so a standing chibi is correct there and that is what shipped. The RPC was
retargeted to carry **only the viewer's own config** rather than a per-seat payload nothing could
read — which would have recreated the very inert-column problem the PR exists to fix.

**LEFT UNDONE, and why:** seated avatars + the gait (both blocked on § 11 rig work); and **"on the
invitation"**, which the brief's PROVE IT asked for — `app/[slug]/invite` turned out to be the
**join flow**, not a personal invitation card, and no per-guest invitation surface renders a figure.
Nothing was invented to cover the gap. **Which surface was meant is an open owner question.**

🔧 **ONE TECHNIQUE WORTH STEALING — how to verify a `CREATE OR REPLACE` of a live function.** The
migration replaces `public_venue_scene`, a live SECURITY DEFINER RPC. The body was transcribed from
the **live catalog** (`pg_get_functiondef`), never from a migration file — then proved by replaying
every migration into PGlite **twice**, with and without the new one, and diffing **Postgres's own
rendering** of both:

```
applied WITHOUT mine: 1272   WITH mine: 1273
before def bytes=9981   ← byte-for-byte the length prod reported
diff → exactly the one added key, nothing else
```

🔑 **The baseline matching prod's byte count is what makes the diff trustworthy** — it proves the
repo's migrations converge on the live object, so "only my addition changed" is a claim about
production and not just about the repo.

### C8 must be re-scoped before it runs

`Notification.requestPermission` now appears in six files — but the registrar is mounted only in
`app/vendor-dashboard/layout.tsx`. **Nothing asks anywhere on the guest QR-scan / seat-claim path**,
so C8's actual job is intact. What changed is that `push-notification-registrar.tsx` is now a
**working model to reuse rather than a thing to invent** — the session should adapt it, not
re-derive it, and must not re-plumb push that already works.

---

## 0c · OVERSEER PASS — 2026-08-31 · what tracking caught that building would not

Not a build session. One pass over the programme's own state, run because C1 was about to be
spawned and the register had not been re-derived since it was written. **Three defects, none of
them in the product, all of them in the machinery that decides what the product's next session
does.** Landed as PR #5043.

### 1 · The board was five sessions stale — and a board cannot be checked by reading it

C7 (#5029) · C2 (#5031) · C8 (#5036) · C11 (#5032) · C5 (#5042) had **all merged** while §5 still
listed them as `ready` / `after C6` / `needs VAPID check`. C10 was still marked "needs follow-up"
after C10b (#5021) had done the follow-up.

🔑 **A tracking board agrees with itself no matter how wrong it is.** Five stale rows read exactly
like five accurate ones — there is no internal inconsistency to notice, no test that goes red, no
reader who can spot it from the document alone. It is the same class as the register's own § 0
failure (measuring against a stale checkout) and as C10's (a correction landing in one file), and
it is the third time this programme has produced it.
✅ **Fix:** every merged row now carries **the code anchor the overseer ran**, not the session's
report — so the next reader re-runs the check instead of trusting the row. Re-derive from
`gh pr list --state merged`, never from the board's own last state.

### 2 · 🛑 THE PROMPT FILE YOU PASTE IS A FILE, AND FILES GO STALE

**The single most expensive near-miss of this pass.** The programme's own spawn instruction is
`cat build-sessions/C1.md | pbcopy`. Run against the shared checkout — which was **20 commits
behind `origin/main`** — that pastes a version of C1 whose GATES block reads:

    peopleConnectionsEnabled() defaults OFF and is COUNSEL-GATED … apply autonomy rule 12:
    build behind the EXISTING flag, defaulted off

**That text is the exact inversion of the truth**, and #5025 had already merged to delete it.
`NEXT_PUBLIC_PEOPLE_CONNECTIONS` is `1` in production. A C1 session pasted from the stale file
would have built ship-dark onto a surface real users can already reach, and every check it ran
would have passed.

🔑 **A prompt is not privileged. It rots at the same rate as the code it describes, and it is read
exactly once — at the moment nobody is yet checking anything.** The stale copy also still carried
`Wave 4 · after P0-b` in its header while the corrected GATES block inside the same file said the
gate had cleared: **one file, disagreeing with itself, in the two places a reader looks first.**

✅ **RULE: spawn from `origin/main`, never the working tree.**

    git fetch -q origin && git show origin/main:build-sessions/<C>.md | pbcopy

### 3 · The shared-checkout collision recurred — inside this very pass

While PR #5043 was in CI, commit `d9cf2dea8` ("record C5's outcome — merged, and shipped DARK")
appeared **on the overseer's own branch, authored by a different session** that was working in the
shared checkout. It was local-only and unpushed.

This is working rule 1, and it is the same failure that put C6's two-file fix inside a 99-file PR
(§ 00). **A session that builds in the shared checkout writes into whichever branch that checkout
happens to be on** — it does not choose the branch, and it is not told which one it got.
✅ Pushed rather than left dangling — § 00 records this programme nearly losing a correct fix
exactly that way — and its load-bearing claim verified before pushing:
`P0-b-SWITCHES.md:268` says `NEXT_PUBLIC_FIGURE_CHIBI` is **OFF** in production, and
`guest-venue-3d.tsx:471` says it *"must NOT be flipped on"*. Both hold.
⛔ **The owner question it carries is real and now lives on the board:** the chibi rig is jointless
below the neck, so an avatar figure **glides** where the blob walks, and **seated guests cannot be
drawn at all** — seated is new geometry, not a pose. C5 shipped dark for that reason.

### What this pass did NOT do

⚠️ It did not verify the *quality* of the nine merged sessions — only that each one's premise is
now false, which is the weakest possible check and exactly the check this register keeps warning
about. **A merged PR whose anchor now exists is evidence the thing was built, not evidence it
works.** P3 — one real celebration, end to end — remains the only test that answers that, and it
is still not scheduled.

---

### ⚠ STANDING TRAP — a silent `git add` (found 2026-08-30)

`build-sessions/` was invisible to git for its whole first day: the root `/*` allowlist ignores every
new top-level path, so `git add build-sessions/` would have exited 0 and staged nothing. The prompts
would simply never have entered the repo, with no error at any point.

🔑 **It was found, then written down in exactly ONE prompt file — which is the same defect this
program keeps diagnosing.** It is now **rule 0b of the shared contract**, so every session inherits
it. Landing anything new at the root requires its `!/path` line in the same commit.

---

### 🔧 Finding the session that owns a worktree

Learned on 2026-08-30, when a live money defect sat in an unidentifiable `/tmp` worktree while it
was being actively written, and routing it took a peer who knew the tool.

- **`ListAgents`** gives *messageable names*; **`list_sessions`** gives *sidebar titles*.
  **They do not match**, so neither alone identifies who owns a branch.
- 🔑 **`mcp__ccd_session_mgmt__search_session_transcripts` bridges them** — full-text across other
  sessions' transcripts *including tool output*. Searching a filename found the owner in a second.
- ⚠ **`list_sessions` PR numbers can be WRONG.** It labelled a session with a CLOSED PR that
  belonged to something else entirely. **Use it to FIND a session, never to conclude what state its
  work is in.** Read the PR.
- ⚠ **Undrafting a PR ARMS auto-merge; it does not complete it.** "Undrafted, checks green, polling
  to MERGED" is not merged. Two sessions reported a merge from that state in one day. Check
  `mergedAt`.

### ⚠ TWO OPEN PRs ON ONE FILE RESOLVE IN CI ORDER, NOT AN ORDER ANYBODY CHOSE

On 2026-08-30 this register was edited by two PRs from divergent bases. Both were non-draft and both
armed, so the race was decided by whichever CI finished first — and the one carrying the SUPERSEDED
content won. The corrections were then stranded behind an eleven-file conflict.

🔑 **The fix was a three-line PR off current `main`, not a resolution.** A small PR cannot conflict;
an eleven-file hand-resolution can only lose. When you are behind on a shared file, **re-apply the
substance forward onto `main` rather than merging your branch backward** — and check what the other
PR legitimately landed before restoring anything wholesale, because a wholesale restore reverts it.

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
| ~~C1~~ | `lib/kinship-derive.ts` | ✅ **now imported by `app/dashboard/(account)/people/page.tsx`** — the defect is gone |
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
✅ **`wt-editable-prices` — CLOSED. No action, and the owner decision is retired.** This entry used
to carry a 🛑 DO-NOT-PRUNE and an open "salvage or discard" question. Both are overtaken by events.
Verified against `origin/main` on 2026-08-30:

- **The worktree is gone from disk** and from `git worktree list`. The branch
  `claude/admin-editable-prices-2026-08-28` still exists locally; only the uncommitted working tree
  went with the directory.
- **The 5% regression never landed — losing that half is the CORRECT outcome.**
  `booking-fee-lock.server.ts` on main still interpolates the derived
  `bookingFeeScheduleSummary(liveSchedule)` into the order description. The only `(5%)` in the file
  is a comment warning that reading it as a fixed rate is "only true at or below ₱100,000".
- **The good half was NOT lost.** An equivalent — slightly STRONGER — widened guard is already on
  main in `booking-fee-schedule-summary.test.ts`: it accepts no argument or one identifier/dotted
  path, and separately rejects inline objects **and numeric literals**, which the lost draft did not.
  **Nothing to re-create.**

🔑 **Why this correction mattered more than the tidy-up:** a 🛑 on a directory that no longer exists
reads as a live constraint, and it held an owner decision that could no longer be made. The next
session to open this register would have waited on it, or burned ten minutes discovering the subject
was gone. **Stale instructions are not clutter — they are false constraints.**

⚠ **The main checkout is ON `main` AND TRACKING — which is NOT the same as current.** It was 2237
commits behind and parked on a feature branch; that specific staleness, the one that produced this
register's first four false findings, is resolved. But "current" is not a property a document can
hold: measured **29 behind `origin/main`** at the moment this paragraph was committed, and it went
stale again the same day — a session read `CLAUDE.md` from it and reported the `0 ORDERS EVER` line
as live a full day after C10b (PR #5021) had already corrected it upstream.

🔑 **Never assert a checkout's freshness in a file the checkout carries.** Measure it:

```bash
git fetch origin && git rev-list --left-right --count origin/main...HEAD   # left = behind
```

---

## 3 · THE WAVES

**Two at a time, never more.** Ordering honours the conflict pairs: ⛔ never C1 with C4 (both
rewrite the People area) · ⛔ never C6 with C7 (both edit the public search surface).

⚠ **Only the C1/C4 pair still binds anything.** Every other row below has merged, so the waves are
now a record of what happened, not a plan. C11 was added mid-programme and never had a wave.

🔑 **The one live constraint is the LAST one**, which is exactly when a rule stops being obeyed
because everything before it went fine. C4 does not start until C1 reads MERGED.

| Wave | Sessions | Model · Effort | State — 2026-08-31 |
|---|---|---|---|
| **1** | ~~C10~~ our own notes stop being wrong | Sonnet 5 · high | ✅ merged #5015, finished by ~~C10b~~ #5021 |
| | ~~C6~~ a Cebu shop stops looking like a Manila shop | Sonnet 5 · medium | ✅ merged #5016 |
| **2** | ~~C7~~ the public copy stops being wedding-only | Opus 5 · medium | ✅ merged #5029 |
| | ~~C2~~ a venue says what kind of venue it is | Sonnet 5 · medium | ✅ merged #5031 |
| **3** | ~~C5~~ people in the 3D room look like themselves | Opus 5 · high | ✅ merged #5042 — **dark; flag stays off** |
| | ~~C8~~ notifications finally have a subscriber | Sonnet 5 · medium | ✅ merged #5036 |
| **—** | ~~C11~~ Setnayan AI on every event, comeback derives its rate | Opus 5 · high | ✅ merged #5032 |
| **4** | ~~C1~~ your family tree, drawn | Opus 5 · high | ✅ merged #5046 |
| **5** | **C4** a business has a record, a page and a timeline | Opus 5 · high | 🟢 **UNBLOCKED — the last session in the programme** |

**Why C10 is `high` and not `medium`:** it spans the repo, the corpus and two auto-loaded
`CLAUDE.md` files, and its failure mode — a correction that lands in one file and not the rest —
is the thing it exists to prevent. This file proved that failure mode twice in one day.

### P0-a · measured 2026-08-31 — the channel IS connected, and nobody knew

A parallel session was waiting to be **told** whether clicking through the OAuth "Advanced" warning
worked. **The database already knew.**

    select count(*) from live_studio_roam_channel_pool;   -- 1   ← connected
    select count(*) from live_studio_roam_streams;        -- 0   ← never streamed

🔑 **The row is the proof, and the row was already there.** A question addressed to the owner sat
open while the answer was one query away — the same shape as this programme's other findings, with
the roles reversed: not a document claiming something untrue, but a *person* being asked for
something already recorded. **Ask the database before you ask the owner** is Rule 0's sixth clause
("never ask the owner a question the corpus answers"), and a live table is corpus.

⏭ **What is actually left on P0-a is step 5: run one real five-minute stream.**
`live_studio_roam_streams` **has never held a row**, so no part of the streaming path has run end to
end in production. Connecting is not streaming.

⛔ **OPEN OWNER DECISION — money, not engineering.** `LIVE_STUDIO` is **`is_active = true` at
₱3,000** in `platform_retail_catalog_v2`, measured today. The project is in Google's *External +
Testing* consent mode, where refresh tokens expire after **7 days** — so the product is on sale
with an auth grant that dies weekly, and no cron can save it (Google invalidates the token itself).
Whether to deactivate it while the durable fix lands is the owner's call and nobody else's; it is
recorded here so it stops living only in one session's scrollback.

### The owner track — runs in parallel
| | What | Cost | Blocks |
|---|---|---|---|
| ~~**P0-b**~~ | ~~Write down which switches are ON in production~~ | — | ✅ **DONE 2026-08-30** → [`build-sessions/P0-b-SWITCHES.md`](build-sessions/P0-b-SWITCHES.md) |
| **P0-a** | Re-authorise YouTube, stream 5 real minutes | half a day | selling Live Studio |
| **P3** | Run one real celebration end to end | a real event | nothing — it *is* the point |
| **P4** | Four decisions only you can make | a sitting | public copy wording |

**P0-b is done — all 101 boolean switches are recorded in
[`build-sessions/P0-b-SWITCHES.md`](build-sessions/P0-b-SWITCHES.md)**, measured against the Vercel
Production environment and `origin/main @ 0d0b265ba` on 2026-08-30, not against any document.

🔴 **The headline, because it contradicts four code comments and both session prompts:
`NEXT_PUBLIC_DEPENDENT_PEOPLE` and `NEXT_PUBLIC_PEOPLE_CONNECTIONS` are BOTH ON in production.**
The counsel-gated dependants surface (a child's birthdate / sex / religion) and the whole
suggest→confirm connections flow are LIVE — `dependents` and `person_connections` each held 0 rows
the same hour, which is nobody having used them, not a closed gate. Anything C1 or C4 ships behind
those flags **reaches real users on merge.** 🔑 Whether the G1 DPO/counsel review was cleared before
they were flipped is an OWNER question the register flags and does not answer.

Also recorded there: `NEXT_PUBLIC_LIFE_STORY` exists in the dashboard **set to an empty string**, so
it reads as OFF while looking set · **eleven `!== 'false'` kill switches are ON precisely because
nobody set them** (including the full-res photo DELETION job) · 47 values are Vercel-`sensitive` and
**cannot be read back by anyone**, so the register records presence only (this is C8's VAPID answer:
all three keys exist) · ten variables are set in production and read by **nothing**.

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

0a. SPAWN FROM origin/main. The prompt that created you was `cat`-ed from a file, and that file
   rots like any other. On 2026-08-31 the shared checkout was 20 commits behind and its copy of a
   session prompt still carried a GATE THAT HAD BEEN DELETED — the inverse of the truth, in the
   block a session acts on first. Paste with
   `git fetch -q origin && git show origin/main:build-sessions/<C>.md | pbcopy`.
   If your prompt's header and its body disagree, the body was corrected and the header was not —
   but STOP and re-read from origin/main rather than guessing which half is stale.

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
```

---

## 5 · TRACKING BOARD

**Refreshed 2026-08-31 against `origin/main` @ `86efe2917`.** Every ✅ below was verified by the
overseer against a code anchor, not against the session's own report — the anchor is in the last
column so the next reader can re-run it instead of trusting this row.

| Session | Model · Effort | PR | State | Overseer's anchor |
|---|---|---|---|---|
| ~~C10~~ | Sonnet 5 · high | **5015** | ⚠️ **MERGED, 1 of 11** — superseded by C10b | — |
| ~~C10b~~ | Sonnet 5 · high | **5021** | ✅ **MERGED** — finished the correction C10 left | `CLAUDE.md` line 51 now strikes `0 ORDERS EVER` and states 6 |
| ~~C6~~ | Sonnet 5 · medium | **5016** | ✅ **MERGED** — fail-open intact | `areaServed` `City`-when-set in `app/v/[slug]/page.tsx` |
| ~~C7~~ | Opus 5 · medium | **5029** | ✅ **MERGED** 2026-08-30 | `HOME_TITLE` = `'…Plan any Filipino event free…'` — no longer wedding-only |
| ~~C2~~ | Sonnet 5 · medium | **5031** | ✅ **MERGED** 2026-08-30 | `app/vendor-dashboard/shop/venue-type-actions.ts` exists |
| ~~C5~~ | Opus 5 · high | **5042** | ✅ **MERGED** 2026-08-31 — ⛔ **SHIPPED DARK, do not flip `NEXT_PUBLIC_FIGURE_CHIBI`** (no gait, no seated avatars — § 0b) | `app/[slug]/avatar/_components/avatar-maker.tsx` exists |
| ~~C8~~ | Sonnet 5 · medium | **5036** | ✅ **MERGED** 2026-08-30 | `Notification.requestPermission()` in `app/[slug]/seat/_components/guest-push-prompt.tsx` — on the guest path, which was the whole point |
| ~~C11~~ | Opus 5 · high | **5032** | ✅ **MERGED** 2026-08-30 | `comebackPricePhp` in `lib/setnayan-ai-comeback-offer.ts`; NULL fails closed, tested |
| ~~C1~~ | Opus 5 · high | **5046** | ✅ **MERGED** 2026-08-31 13:27Z | `people/page.tsx` renders `connection-tree-section.tsx`; `basis` switch splits blood from courtesy; `.eq('status','confirmed')` at the query; `kinship-derive.ts` **untouched** (no hop cap added to the module, as scoped). 16 tests, 16 pass. |
| **C4** | Opus 5 · high | — | 🟢 **THE LAST ONE — gate open** | premise re-verified 2026-08-31: no route under `app/**/dependent*`; only `people/_components/dependents-section.tsx` and `dependent-actions.ts`, which are a section, not a page. Flag `NEXT_PUBLIC_DEPENDENT_PEOPLE` = `1`, ON in prod |
| ~~C3~~ | — | — | **SHIPPED — dropped** | ✅ 2026-08-30 |
| ~~C9~~ | — | — | **SHIPPED — dropped** | ✅ 2026-08-30 |
| ~~P0-b~~ | owner | **5025** | ✅ **DONE** — `build-sessions/P0-b-SWITCHES.md` | 101 switches measured against Vercel Production |
| **P0-a** | owner | — | 🔵 **IN FLIGHT — step 5 of 5 outstanding** | `live_studio_roam_channel_pool` = **1 row** (connected) · `live_studio_roam_streams` = **0** (never streamed) |
| P3 | owner | — | after C4 | — |
| P4 | owner | — | not started | — |

### Where the program actually stands, 2026-08-31

**ALL TEN BUILD SESSIONS ARE MERGED.** C1 shipped as #5046 at 13:27Z on 2026-08-31 — while the
overseer session was being told to build it. **C4 is the only session left in the programme**, and
its gate is now open.

🔑 **C1 ended the way two of this programme's ten sessions ended: premise FALSE, nothing built.**
That is autonomy rule 14 working, not a wasted session — but note *how* it was caught. The register
was refreshed at 11:25Z and said C1 was unbuilt; C1 merged at 13:27Z; the check that caught it was
`git fetch` at the top of RULE 0, **two hours after a board that was correct when written**. A
tracking document is accurate only at the instant of measurement, and this programme now has three
separate incidents of that exact shape.

⚠️ **This board was five sessions stale when it was refreshed.** C7, C2, C8, C11 and C5 had all
merged while it still listed them as `ready` or `after C6`. 🔑 **A tracking board is the one
document that cannot be checked by reading it** — it agrees with itself no matter how wrong it is.
Re-derive it from `gh pr list --state merged`, never from its own last row.
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
