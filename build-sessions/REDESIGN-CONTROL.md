# REDESIGN CONTROL — the charter for the Redesign group

> Owner, 2026-09-22: *"your responsibility is to handle the redesign group"* · *"this redesign
> controller session is supposed to combine different builds to create a single merge cleanly. our
> goal is to minimize the multiple merges done."*
>
> Controller session: **REDESIGN CONTROLLER** · `local_764dda74-bc29-4889-9fde-2910dbb760ef`
> Scope: the **Redesign** sidebar group only. Other groups keep their own controller and
> `BUILD-SEQUENCE.md`. This file does not override `BUNDLE-COMMON.md`; it replaces the part of it
> that says each session opens its own PR.

⚠ **This document is a claim; the tree is the evidence.** Re-measure with
`build-sessions/merge-control.sh` before acting on any line in it.

---

## The one rule that changes

**A Redesign session does not open a PR and does not merge.** It builds, it proves, it **reports**.
The controller folds the finished builds into **one bundle branch → one PR → one merge**.

Why: a PR here is a ~45–55 minute CI round trip, and the owner is charged per merge. Seven sessions
each opening their own PR is seven merges, seven CI runs, and six chances to conflict on a
`main` that moved underneath them. One bundle is one merge.

```
session builds  →  reports BUILD READY  →  controller trial-merges  →  bundle branch  →  ONE PR  →  ONE merge
        (own worktree)      (to the controller)     (merge-control.sh)     (claude/rd-wave-N)
```

---

## What each session does

1. **Build in your own worktree, on your own branch, off `origin/main`.**
   `git worktree add ../wt-rd-<slug> -b claude/rd-<slug> origin/main`.
   Never branch from this repo's checked-out tree — it is thousands of commits behind.
2. **Commit your work.** One commit per build, named for the build. Never squash several builds
   into one commit: if one turns out wrong after merge, the owner needs a surgical `git revert`.
3. **Prove it the usual way** — a pure decision module, a test that EXECUTES it, and at least one
   sabotage you watched turn red. A guard you did not watch fail is a hypothesis.
4. **Do not push. Do not `gh pr create`. Do not arm auto-merge.**
5. **Run the collision check on yourself** and paste its verdict into your report:
   ```bash
   build-sessions/merge-control.sh --branch HEAD
   ```
6. **Report to the controller** in the exact form below, then stop and wait.

### The report line

```
REDESIGN ▸ <session title> · <READY|BLOCKED|NEEDS-OWNER> · branch <claude/rd-…> · <N> commits
FILES: <every non-changelog path you touched>
PROVED: <the property> — sabotage <what you broke> went red
COLLISION: <the merge-control verdict for your branch>
```

Send it with `mcp__ccd_session_mgmt__send_message` to
`local_764dda74-bc29-4889-9fde-2910dbb760ef`, or hand it to the owner to paste.

---

## What the controller does

1. Runs `build-sessions/merge-control.sh` — a real `git merge-tree` trial merge of every build in
   flight against `origin/main` and against each other. **Never a grep:** a grep cannot predict a
   merge conflict.
2. Folds every CLEAN build into the wave's bundle branch, hardest first.
3. A build that CONFLICTS is not nursed inside the bundle. It goes back to its session with the
   conflicting file list, and rides the next wave. **Never hold four finished builds hostage to one.**
4. Opens **one** PR for the wave and arms auto-merge on that one PR only.
5. After it merges, tells every session in the wave to re-base, and prunes the bundle worktree.

### Collision classes and the standing answer to each

| class | what the analyzer prints | the answer |
|---|---|---|
| **GENERATED** (`*baseline*`, `supabase/security/*`) | the file's own regenerate command | **Regenerate on the merged tree. Never hand-merge, never hand-edit.** The analyzer prints the file's own instruction line. |
| **MIGRATION** (`supabase/migrations/*`) | two migrations collide | Allocate forward with `pnpm migration:new`. Let the pipeline apply it — **never apply a migration directly to prod**, that orphans the ledger and freezes every later deploy. |
| **UGAT** (`lib/ugat/graph.ts`, `ugat-*.baseline.txt`) | two builds touch the map | Sequence them; the second re-runs the two required db-tests on the merged tree. |
| **fragment** (`changelog.d/…`) | two branches share one filename | Rename one. A unique fragment file can never conflict — that is the entire point of the directory. |
| **source** | a real code conflict | The later build merges `origin/main` in its own worktree after the earlier lands, and **redoes the edit there**. |
| **OVERLAP** (clean today) | same file, git merges it | Not a conflict — but the second to land re-runs its own tests on the merged tree before the controller folds it in. |

### Uncommitted work counts

A session's live edits are a build in flight before its first commit. The analyzer lists them
separately because `merge-tree` needs commits, so that verdict is **advisory**: it says "two
sessions are writing the same file", not "they will conflict". It is a reason to sequence.

---

## Capacity and the lines that do not bend

- **At most 3 Redesign sessions building at once.** This Mac has 16 GB; three concurrent `tsc` runs
  shut it down on 2026-09-13.
- **One heavy job at a time, machine-wide**, through
  `~/Documents/Claude/Projects/heavy-lock.sh`. Queueing behind a peer is correct.
- **Never run `next dev`.** Verify against production after the change serves.
- **Prod is READ-ONLY** — `select` only. Never run `supabase migration repair`.
- **Never read code from `/Users/icecasasola`** (a stale checkout, ~2,491 commits behind). Use
  `git show origin/main:<path>`.
- **Never weaken or delete a guard to go green.** Raise its threshold and say so.
- Cite a greppable symbol or the command that re-measures it — **never a line number**.
- **Prune your own worktree** when the wave's PR merges. Never prune another session's.

---

## The Redesign group — enrolment register

Filled in from each session's handshake reply. A blank cell means that session has not confirmed.

| session | model · effort | last PR | branch / worktree | enrolled | current slice |
|---|---|---|---|---|---|
| Login popup and profile setup flows | Fable 5.1 · high | — | `claude/rd-one-door` · `../wt-rd-one-door` | ✅ 02:30 | One door. Owner APPROVED 2026-09-22. **🟢 LAUNCHED on build 3 only** (account inside step 3); builds 1 and 2 held behind the contested sign-up file. |
| Event Your Team | Opus 5 · high | #5871 open · #5857 #5860 merged | `claude/self-added-suppliers-have-a-home` · `/private/tmp/wt-home` | ✅ 02:40 | ✅ **PROTOTYPE APPROVED** — owner 2026-09-22, verbatim *"that is good enough"*. Planning only; wave not open. |
| Vendor dashboard | Opus 5 · high | #5873 open · #5850 #5852 merged | `claude/a-free-fee-window-waives-the-charge` · `/private/tmp/wt-desk` | ✅ 02:40 | Free-fee window in flight (#5873). **HOLD** — offers the admin money-switch page; owner has not answered. |
| Papic controller | Opus 5 · high | #5866 **RED** · #5851 #5853 #5869 merged | `claude/snippet-in-the-code` · `../wt-papic-pack` | ✅ 02:50 | **🟢 AUTHORISED: push the 2-line test fix to #5866 only.** Papic redesign brief NOT launched. |
| Service card and quotation maker | Fable 5.1 · high | — | `claude/rd-quote-maker` · `../wt-rd-quote-maker` | ✅ 02:38 | Owner APPROVED (verified in DECISION_LOG). **🟢 LAUNCHED on slices A–D**; E held (frame), G held (migration). |
| Event chatbox between users and vendors | Opus 5 · high | — | | 🟢 **opened 2026-09-22 04:40** | Owns the chat frame + both registries. **It was never unresponsive** — the owner had stopped it and it was correctly awaiting a migrate-or-continue decision. Owner: "open the chatbox session" ⇒ no migration, it builds here. |
| Event Overview | Opus 5 · high | #5865 open · #5855 #5863 #5870 merged | `claude/overview-e-status-stays-in-view` · `../wt-ov` | ✅ 02:50 | **🟢 AUTHORISED: push STACKED on #5865 as a DRAFT, no auto-merge** — preview only, owner must look. |

### In flight when this charter was written (2026-09-22, `origin/main` 1915ce9f5)

These four were opened as individual PRs **before** the bundle rule existed. They are grandfathered:
let them merge as they are rather than unwinding them. The analyzer says all four land clean.

| PR | branch | owner session | verdict |
|---|---|---|---|
| #5865 | `claude/overview-c-cut-the-descriptions` | Event Overview | CLEAN |
| #5866 | `claude/one-word-snippet` | Papic controller | CLEAN |
| #5867 | `claude/b3-consent-states-bands-reports` | bundle B3 (not Redesign) | CLEAN |
| #5868 | `claude/one-commission-promise` | WHAT IS LEFT (not Redesign) | CLEAN |

**Two sessions already invented the bundle on their own, and it works.** Measured 2026-09-22:
#5869 merged into `claude/one-word-snippet` (not into `main`) and #5870 merged into
`claude/overview-c-cut-the-descriptions` (not into `main`). Branch protection guards only `main`, so
a stacked PR merges into its parent branch at once, and the parent carries both builds to `main` as
**one** merge. That is exactly the shape this charter asks for — Papic and Event Overview each cost
the owner one merge instead of two. Keep doing it; the bundle branch simply makes it deliberate and
extends it across sessions rather than within one.

🪤 **A stacked PR reads as MERGED while its work is still not on `main`.**
`gh pr view 5870 --json state` says MERGED and
`git merge-base --is-ancestor claude/overview-d-one-thing-is-row-one origin/main` says it is not
there. Both are true. Check the **base ref**, never the state alone.

---

## The analyzer

`build-sessions/merge-control.sh` — real trial merges, no grep. Run it with no arguments for the
full picture, `--branch HEAD` from a session's worktree, or `--order 5867,5865` to test a landing
order. Exit 0 = nothing conflicts, 1 = at least one does, 2 = tooling failure.

It writes `build-sessions/MERGE-CONTROL.md`. **That file is a snapshot — re-run the script rather
than trusting it.**

Two traps it was built around, both found by probing it with a deliberately conflicting pair rather
than by reading its output:

- **BSD `seq` on this Mac counts DOWN when first > last.** `seq 6 5` prints "6 5", so an empty inner
  loop silently became a self-comparison and the report grew a phantom row. The script uses its own
  `rng` helper; an empty range must be empty.
- **`merge-tree --name-only` prints prose after the file list.** Everything after line 1 is not a
  filename; "Auto-merging …" and "CONFLICT (content): …" were being reported as conflicting paths.
  The parser stops at the first blank line.

🔑 **A tool that has only ever printed "no conflicts" has not been shown to be able to print
anything else.** Probe it with a failing case before believing a green run.

### Live collision, 2026-09-22 02:18 UTC — relay to the owner

`claude/verify-honesty-revenue` (worktree `/private/tmp/wt-lcm`, **uncommitted**) is editing
`apps/web/app/signup/actions.ts`, which open PR **#5867** also edits. Neither is in the Redesign
group, so the controller does not sequence them — but whichever lands second must merge `origin/main`
and redo its edit there. Flagged rather than acted on.

---

## Enrolment replies — verified, not taken on trust

### 1 · Login popup and profile setup flows — ENROLLED, every claim checked

Verified against the tree, not the report: the prototype exists
(`~/Documents/Claude/Projects/Setnayan/prototypes/one_door_signin_signup_shop_2026-09-22.html`,
54 KB, written 2026-09-22); `.claude/launch.json` is at 7 insertions / 1 deletion, byte-for-byte
what the controller measured at its own start, so its "I put the temp server entry back" is true;
and all twelve files it named as its future footprint exist on `origin/main`.

**Standing order: hold.** It is WAITING-ON-OWNER on prototype approval plus three decisions. It has
no branch and no worktree, so it occupies no build slot. It does not build until the owner approves
and the controller releases it.

**One correction to its own collision reading.** It named #5867 as the single other writer of
`apps/web/app/signup/actions.ts`. Measured 2026-09-22 02:36 UTC there are **two**, and they conflict
with each other — see below. Its plan to "branch after #5867 merges or rebase onto it" is therefore
premature: it must branch from a `main` where **both** have settled.

Its reading of `apps/web/scripts/port-control-baseline.json` is right — that is a GENERATED file.
Regenerate it on the merged tree; never hand-merge it.

### 🔴 #5867 × #5872 — a real conflict, found in live traffic

Both write `apps/web/app/signup/actions.ts`, and `git merge-tree` says they conflict **in either
landing order**. Neither is in the Redesign group, so the controller flags rather than sequences
them.

The two changes are independent in meaning and only textually adjacent:

- **#5867** adds a terms gate — an import of `hasAgreedToTerms` and an early `redirect` when the
  agreement field is absent.
- **#5872** adds an email-verification gate — an import of `isEmailVerificationRequired` and two
  guarded `email_confirm: true` call sites.

**Both must survive the rebase.** Whichever merges first, the other merges `origin/main` in its own
worktree and re-applies its edit there. Do not resolve this by picking a side: dropping the terms
gate reopens a server action that a hand-built POST walks straight through, and dropping the email
gate re-hardcodes the confirm bypass on both doors.

🔑 **The analyzer earned itself here.** Both PRs are green, both have auto-merge armed, and nothing
on either PR page says they are incompatible — GitHub only discovers it when the second one flips to
CONFLICTING after the first lands.

### 2 · Service card and quotation maker — ENROLLED, HOLD

Verified: `build-sessions/quote-maker-prototype.html` exists (60 KB, 2026-09-22); all eleven existing
files it named are on `origin/main`; and both new modules it proposes
(`lib/quote-from-service-card.ts`, `lib/quote-stages.ts`) are genuinely free — no name collision.

**Held on the owner**, not on engineering: prototype approval plus three decisions (which card's gift
switch governs a combined-card quote · does the quote card replace the offered service card in the
thread · card discount applied-with-reason vs suggested).

⚠ **Predicted collision when it launches:** its footprint includes
`apps/web/app/_components/chat-message-stream.tsx` and the thread page, which is the same
neighbourhood as the *Event chatbox between users and vendors* session. Those two cannot build at
once. Whichever the owner approves first takes the neighbourhood.

### 3 · Vendor dashboard — ENROLLED, HOLD · three things it surfaced

Register was stale by two: #5852 (vendor FAB deleted) merged today as well — corrected above.
#5873 is grandfathered and CLEAN; leaving it in flight rather than re-cutting it onto a conforming
branch, because a re-cut buys nothing and costs a round trip.

**Prod writes made today, before the read-only line reached that session** — owner-instructed, each
verified after, no migration, no repair: `platform_settings.fee_unlocks_event_enforced = true` (2
charges, 0 unsettled at flip time, so nobody was locked out) and
`vendor_payment_methods` label/primary for one shop. Reported, not hidden. No prod write since.

🔑 **On the owner's desk:** `fee_unlocks_event_enforced` and the new `booking_fee_free_from/_until`
are **SQL-only**. Two switches that can refuse or forgo money, with no off-button in the console.
The session offered to build that admin page; the owner has not answered.

### 4 · Event Your Team — ENROLLED, HOLD

#5871 in flight and CLEAN. It deleted the analyzer's snapshot from its own worktree after running it,
so its tree stayed clean for bundling — correct, and the snapshot regenerates on any run.

**Held**: the Your Team page redesign is a prototype and the reply does not say the owner approved it.
The kit rule is no code until approved.

⚠ **Unreconciled counts, for whoever is launched on Overview:** Your Team and Overview disagree —
23 vs 27 open categories, and "2 of 25 booked" vs 29. The 278-days-overdue half was already fixed in
#5860 (`todays-one-thing.ts` measured from `PLAN_GROUPS.monthsBefore`, an aim, instead of
`lockLeadDaysFor`, the floor). The rest is open.

Two non-blocking owner calls off #5871: `PLAN_GROUPS.logistics.catalogFolder` is still `'transport'`,
so that group's doorway opens a different folder from where its `misc` tile now lives; and
`security → escort` was deliberately left alone.

### Standing instruction added 2026-09-22 — delete the snapshot after you run the analyzer

`merge-control.sh` writes `build-sessions/MERGE-CONTROL.md` into **whatever worktree it runs in**,
which leaves a session's tree dirty just for asking a question. Delete it after your run, or pass
`--md` to a scratch path. It regenerates on any run and the charter says to re-run rather than trust
it. (Found by the *Event Your Team* session, which did it unprompted.)

---

## 🔑 ON THE OWNER'S DESK — 2026-09-22, from the enrolment round

Each of these blocks a session that is otherwise idle and ready.

1. **The two money switches have no off-button.** `platform_settings.fee_unlocks_event_enforced` and
   the new `booking_fee_free_from` / `booking_fee_free_until` are **SQL-only**. Both can refuse or
   forgo money. The *Vendor dashboard* session offered to build the admin page and is idle waiting.
   **Recommended: yes.** A new admin page joins four registries, each exactly +1, and the guards are
   tight enough to say so if one is missed.
2. **Service card / quotation maker — prototype approval** (`build-sessions/quote-maker-prototype.html`,
   60 KB) plus three decisions: which card's gift switch governs a combined-card quote (open Q1 from
   the 2026-09-20 log) · does the quote card replace the offered service card in the thread · is a
   card discount applied-with-reason or merely suggested.
3. **Your Team page — is the prototype approved?**
   (`~/Documents/Claude/Projects/Setnayan/prototypes/your_team_redesign_v2_2026-09-22.html`). The
   session reports nothing blocking, but no approval is on record and the kit rule is no code until
   approved. One word releases it.
4. **Two surfaces disagree about the same numbers.** Overview and Your Team say 23 vs 27 open
   categories and "2 of 25 booked" vs 29. Not a decision, a build — flagged here so it is not lost.
   Whoever is launched on Overview gets it, unless the owner prefers Your Team to own it.
5. **#5867 × #5872 both write `signup/actions.ts` and conflict in either order.** Neither is in this
   group. One must rebase; both changes must survive. It also blocks two of the three approved
   ONE DOOR builds.

### Sequencing decided 2026-09-22 (controller's call, not the owner's)

- **Login popup · ONE DOOR: build 3 only is running** (`claude/rd-one-door`, `../wt-rd-one-door`).
  Builds 1 and 2 both write `signup/page.tsx` / `actions.ts` and are held until #5867 **and** #5872
  are both on `main` — starting them today would make a third writer on a file with an unresolved
  two-way conflict. Build 3 is also the hardest of the three, so hardest-first still holds. Measured
  before deciding: `app/open-shop/actions.ts` touches auth once (`supabase.auth.getUser()`) and
  nothing under `app/open-shop/` imports `lib/oauth-signup.ts` or the sign-up action — so build 3 is
  clean of the contested file.
- **Service card × Event chatbox share a neighbourhood** —
  `apps/web/app/_components/chat-message-stream.tsx` and the vendor thread page. They cannot build at
  once. First owner approval takes it; the other waits a wave.
- **#5873 is NOT being re-cut** onto a conforming branch. It is clean and in flight; a re-cut buys a
  tidier name and costs a CI round trip and a second merge.

---

## 🔌 THE CHAT FRAME — ownership ruling, 2026-09-22

Three sessions converged on one small file set. Ruling below; it is the *Vendor dashboard* session's
own proposal, accepted because it is right and because it names one owner per mechanism.

**Measured against `origin/main`, every claim re-verified by the controller:**

- **Exactly three files render the shared frame** — `app/_components/chat-message-stream.tsx`,
  the couple thread page, the supplier thread page.
- **The two chat boxes are ONE mechanism.** `lib/chat-box-tools.ts` (couple) imports
  `VENDOR_THREAD_TOOLS` from `lib/vendor-thread-tools.ts` (supplier) and derives
  `COUPLE_THREAD_PANELS` from it; `affordanceReveal()` does `VENDOR_THREAD_TOOLS.find(...)`.
  **Editing the supplier registry changes the couple's chat box, in another route, owned by another
  session, and `merge-tree` calls it CLEAN.**
- `/vendor-dashboard/messages` is a **redirect**, not a page — only the thread is its own route.
- A closed tool is **invisible**, not a collapsed row (`[&:not([open])]:hidden`). The owner rejected
  the six-collapsed-strips version with *"This is so confusing."* Any redraw that puts tool rows back
  on screen re-proposes something already ruled out.

| owns | who |
|---|---|
| the frame + **both** registries (`chat-box.tsx`, `chat-message-stream.tsx`, both thread pages, `vendor-thread-tools.ts`, `chat-box-tools.ts`) | **Event chatbox** — and it rides **ALONE** in its wave |
| the supplier INBOX only (`/vendor-dashboard/customers?tab=messages` → `surface.tsx`, inside its own hub) | Vendor dashboard |
| its own team surface only | Event Your Team |
| `lib/quote-from-service-card.ts` (pure + test) — touches none of the contested set, can ride any wave | Quote maker, slice A |
| quote-maker slices B · C · E · F (they land in the frame set; F edits `vendor-thread-tools.ts`) | **HELD** until the frame work lands, then rebase and redo on the merged tree |

### Nobody can verify this wave by opening production

Measured by the controller directly, 2026-09-22: `select inquiry_status, count(*) from chat_threads
group by 1` returns **one row — `accepted`, 3 threads**. `pending` / `declined` / `displaced` /
`withdrawn` / `expired` are **zero**. The supplier's whole Accept/Decline composer has never rendered
for a real inquiry. **Fixtures or a db-test, or the proof is one state out of six.**

### 🛑 The couple's Messages nav row is a REVERSAL, not a gap

The *Event Your Team* session routed the owner's ask correctly and measured well, but read one
absence as an oversight. It is a decision.

`nav-registry-defaults.ts` says, in the tree: *"customer.sidebar.messages + customer.sidebar.contracts
REMOVED 2026-07-10: Overview's Messages/Contracts children were flattened (#3004) — the slots had zero
consumers. Messages stays reachable from the Conversations card + topbar bell."* And `customer-menu.ts`
carries the owner's own words for the same day: *"the menu doesn't need
checklist/schedule/messages/contracts."*

So adding that row **reverses a 2026-07-10 owner decision**. It may well be what he now wants — he
has asked for exactly that access — but it is load-bearing and goes to him, not into a build.
🔑 **An accurate absence plus an inferred cause is a false finding.** The row really is missing; it
was taken out on purpose.

The genuinely new behaviour in his ask is different and uncontested: the inbox lists **threads**, so
a supplier the couple shortlisted but never messaged has no row. He asked for "inquiries **and**
vendors". That part is a build, not a reversal.

---

## Corrections the controller got wrong, and the sessions caught

Kept because each was expensive in a predictable direction, and because a register that only records
the sessions' mistakes is not honest.

1. **"A new admin page joins four registries."** True rule, wrong page — the booking fee ALREADY has
   an admin form. `admin/pricing/_components/booking-fee-form.tsx` carries
   `name="booking_fee_rate_pct"`, `pricing-surface.tsx` selects all three fee columns, and
   `price-control-actions.ts` writes them. The money-switch job is four files inside
   `admin/pricing/**` plus one pure module — no route, no nav row, no registry, no
   `MODEL_CHOICE_CAP`, no migration. 🔑 **A standing rule is not a measurement**, and the controller
   quoted the rule at a session while committing the failure the rule exists to prevent.
2. **"Overview and Your Team disagree about one number."** Wrong shape. Verified: 12 plan groups
   carry `countsTowardLockable: false`; Overview's denominator excludes them and scopes by event
   type, while `stillNeedsDecision()` counts engaged-or-in-window minus locked minus covered. **Two
   different questions, both defensible.** The defect is that a couple reads both wearing the word
   "open". That is naming and copy. Forcing them to agree would have deleted a working measure.
   🔑 The coordinator case (278 vs 113) genuinely WAS one fact computed two ways — an aim read as a
   floor, fixed in #5860. The two shapes look identical from outside and their fixes are opposite.
3. **"Grandfathered PRs — let them merge as they are."** #5866 is RED (`typecheck + lint` fail, run
   35677821274) and the no-push rule was preventing its own fix. Two test assertions pinned
   `Snippet` case-sensitively through a `new RegExp` with no `i` flag — a phrasing ban, which fails
   in both directions. Narrow push authorised.

## Standing notes added from the enrolment round

- **A stacked PR reads MERGED while its work is not on `main`.** Confirmed twice independently
  (#5870, #5869). Check the base ref, never the state alone.
- **The Overview prototype never modelled `.sn-inspector-rail`.** It opens at the same 1280
  breakpoint and takes `clamp(340px,30vw,420px)+24px` while the master reflows, so a "sticky sidebar"
  drawn without it leaves ~310px of flow at 1280. **Any session drawing a sidebar hits this.**
- **A per-quote gift switch must flip the source of truth and delete the old read in ONE commit.**
  UI reading the quote while SQL still reads the card is two mechanisms disagreeing about one fact,
  and each passes its own tests.
- **`monthsBefore` is the aim; `lockLeadDaysFor` is the floor.** `upcoming-items.ts` reads the aim
  correctly because it is forward-looking and never says "overdue". Anything new that says "overdue"
  or "late" must read the floor.

---

## 🔀 THE CONTROLLER OWNS CONFLICT RESOLUTION (owner, 2026-09-22)

> *"you will get builds from what is left session"* · *"so all conflicts on their builds will be
> passed on to you"*

Scope widened. Conflicts from **any** session routed here — not only the Redesign group — are the
controller's to resolve. A session reports the conflict and stops; it does not improvise a merge.

**Intake:** branch name, the conflicting paths, and what property each side must keep. The controller
trial-merges, resolves, verifies both properties survive, and hands back the resolution.

### RESOLVED AND BANKED: #5867 × #5872 on `apps/web/app/signup/actions.ts`

Reproduced by a real merge in a throwaway worktree. **One hunk, two adjacent import lines.**

```
<<<<<<< HEAD
import { TERMS_FIELD, TERMS_VERSION, hasAgreedToTerms } from '@/lib/terms-agreement';
=======
import { isEmailVerificationRequired } from '@/lib/email-verification';
>>>>>>> origin/claude/verify-honesty-revenue
```

**Resolution: keep BOTH lines.** The changes are independent in meaning and only textually adjacent.
Verified on the resolved tree — 0 markers left, and both properties intact:

| property | survives at |
|---|---|
| the terms gate refuses a missing agreement | `hasAgreedToTerms` import · `if (!hasAgreedToTerms(formData.get(TERMS_FIELD)))` · the `terms_required` redirect |
| the email-confirm bypass is gated on **both** doors | `isEmailVerificationRequired` import · the conversion path · the second `updateUserById` door |

Resolved file banked in this session's scratchpad as `RESOLVED-signup-actions.ts`. Whichever PR lands
second merges `origin/main` in its own worktree and takes this resolution.

⚠ **Do not resolve by picking a side.** Dropping the terms gate reopens a server action a hand-built
POST walks straight through; dropping the email gate re-hardcodes the confirm bypass on both doors.

---

## 🛑 THE OWNER'S VIEWER DOES NOT RUN JAVASCRIPT (2026-09-22)

He opened two prototype drafts and said *"this is what i see only"*, then *"still nothing"* —
**completely blank**. Found by the Event Your Team session; confirmed here by opening the files.

Two failure modes, both fatal to a review:
- content written by JS ⇒ **he sees nothing**;
- content in the HTML, JS only switching state ⇒ he sees the default and **every state control is
  dead**, which is worse because it looks like it works.

**Measured across the five prototypes delivered today** (`grep -c '<script'`):

| file | scripts |
|---|---|
| `your_team_FINAL` | **0** ✅ the pattern to copy |
| `one_door_FINAL` · `overview_FINAL` · `papic_controller_FINAL` · `admin_money_switches_FINAL` | 1 each ⚠ rebuilt |

**Rule: radio inputs + CSS sibling selectors (`#s-x:checked ~ .panel-x`). `grep -c '<script'` must
print 0.** Anything computed at runtime is pre-rendered per state instead.

🔑 **`<noscript>` does not save you** — it fires only when scripting is *disabled*, never when a
sandbox *refuses to execute* it.

### Two controller errors, both retracted

1. **"Work inside `build-sessions/prototypes/` and it is fully drivable."** FALSE. A local file opens
   as a static snapshot with page tools refused, inside the project folder as well as outside. The
   controller asserted it without testing and a session measured it. 🔑 *The controller committed the
   exact failure it had corrected in three sessions the same hour.*
2. **The kit's 375px / 1440px screenshots are WITHDRAWN as a requirement.** With a session not open
   in a window, even a served localhost page screenshots blank at 0×0 (`visibilityState: 'hidden'`)
   while DOM reads still work. No session can produce them. **DOM verification plus the script count
   is the substitute, and "I have not seen it" is a correct report, not a shortfall.**

### A register number the controller relayed without measuring

"0 allotments means never used — **0 captures**" was FALSE and reached a session in a brief.
Measured directly: `papic_photos` = **26** · `papic_guest_spend_ceilings` = 0 · `paparazzi_seats` = 24.
The allotment figure was right; the capture figure was not.

### The fourth variant of one failure, in its most useful phrasing

Four times today a session (and twice the controller) produced *an accurate observation with an
inferred cause*: `ls vercel.json` at the repo root generalised to the tree · a grep for
`[eventId]/messages` missing a removal that took the route string with it · `ls` on one directory ·
and a grep for a rendered string that could not see it.

🔑 **A grep for a rendered string cannot see copy held in a constant. Measure the render path, not
the literal.** (`FOLDER_SUMMARY_TO_DECIDE` in `lib/explore-info-copy.ts` renders through
`folderSummaryOf`; `${pickCount} considering` is only the fallback.)

---

## ✅ FIRST PROTOTYPE APPROVED — 2026-09-22

Owner, verbatim, on `your_team_FINAL_2026-09-22.html`: **"that is good enough."**

**What that approves:** the Your Team drawing, and the **zero-JavaScript bar** as the standard for
every prototype in this group. It is the one file he could actually operate.

**What it does NOT approve, and must not be read as:** the five open questions in that file remain
unanswered, and his standing directive — *"we want everything ready first before we start building
autonomously"* — still holds. Approved ≠ launched.

🔑 **"Good enough" is also a instruction to stop polishing.** The remaining four prototypes are being
rebuilt for ONE reason — to switch state without JavaScript. Nothing else is to be added to them.
A prototype the owner can operate beats a better-drawn one he cannot.

---

## 🔑 ON THE OWNER'S DESK — 2026-09-22, second pass (each blocks a specific slice)

Trimmed hard. Every row below changes what gets BUILT, not how it reads. Recommendations attached;
none of them is being treated as his answer.

### From Event Your Team — prototype APPROVED, two questions block two slices

1. **What does the "1 new" badge on a supplier card COUNT?** Blocks Slice 1.
   Three mechanisms exist and they are **not the same fact** — and the codebase already says so.
   `lib/conversation-list.ts:369` carries `unreadThreadIds` feeding `unread`; its own docblock warns
   *"⚠ NOT THE SAME FACT AS `unanswered`. A supplier who has replied still has…"*; and `unanswered`
   is a separate typed field with its own filter key. The third candidate is unread **notifications**
   scoped by `notifications.event_id` (`payment_info_sent` · `order_paid` · `payment_matched`).
   · **Recommendation: unread thread messages.** The badge is wayfinding, the action beside it says
   "Read their reply", and opening the thread is a deliberate clearing act. Notifications are
   Overview's job.
   · **Cost of being wrong:** it reads a different table, every number counts the wrong thing, the
   action label lies, and clearing does not clear. **Not retrofittable as copy — it is the slice.**
2. **Is the money split, or one combined "paid"?** Blocks Slice 3. **Recommendation: split.** Cost:
   it governs a figure the couple reads as money; combined means `teamMoney` and `bufferTile` have a
   different shape — built differently, not worded differently.

Deliberately NOT on the desk, with reasons: Slice 0 first is sequencing the controller already
directed · the roster moving was instructed verbatim (*"just move them to their cards"*) and is the
cheapest reversal in the plan · the Messages nav row is not in that plan at all.

### Still open from earlier

- The admin money switches: announce a promotion or let suppliers find it on a quote · refuse or
  merely warn when enforcement would lock someone out (rec: warn **and name them**) · does a window
  need a reason field (rec: yes).
- Event Overview: the AI-gated dates block on a free event · the stale venue upsell framing · the
  counts naming (proposed "23 of 25 categories not booked" vs "27 need a decision" — neither says
  "open").
- The couple's Messages nav row — restoring it REVERSES the 2026-07-10 ruling.
- Env: **`R2_PUBLIC_URL` and `ENCRYPTION_KEY` are Production-only** and will break a preview.

### A record correction volunteered by the session that made it

`notifications.event_id` (#5857) was justified by a "From your suppliers" feed that the Your Team
redesign then removed. The session says plainly its page probably does not use the column it built.
**Not waste** — Overview's activity tile needs the scoping and event deletion can now cascade, and a
notice that did not know its wedding was a real defect. Recorded so the history does not imply
otherwise.

### Sequencing fixed by this

**Your Team Slice 4 lands AFTER Overview settles the count naming.** Removing "Decide next" while
Overview still says "categories still open" leaves the couple one number with nothing naming its set.
Your Team carries **no migrations and touches nothing under `supabase/`**, so it is free filler for
whichever wave has room — useful, because two other sessions have migrations that cannot share one.

---

## ✅ ALL FIVE PROTOTYPES ARE SCRIPT-FREE — verified 2026-09-22 03:35 UTC

| file | scripts | radios | inline handlers |
|---|---|---|---|
| `your_team_FINAL` | 0 | 10 | 0 |
| `one_door_FINAL` | 0 | 28 | 0 |
| `admin_money_switches_FINAL` | 0 | 9 | 0 |
| `papic_controller_FINAL` | 0 | 12 | 0 |
| `overview_FINAL` | 0 | 12 | 0 |

🪤 **A FILE READ HAS A TIMESTAMP, AND MINE WAS SIX MINUTES OLD.** The controller reported Papic and
Overview as "still 1 script" from a read taken *before* their rewrites landed. Both sessions
corrected it with `ls -l` mtimes. Neither reading was wrong; one was old.
**Report a file measurement with its mtime, or it cannot be checked.** Same family as the stale
`data:` tab and the stale deployed build — three variants in one day.

### Two methods for going script-free — pick by how the states differ

- **Bake the rendered DOM** (ONE DOOR): render each state through the existing code under a fake DOM
  in Node, emit one pre-rendered `<section>` each, switch with radios. Right when states are whole
  distinct screens. Keep the JS file + generator beside it so nothing is drawn twice.
- **Author the delta** (Papic): when states differ by one or two blocks, baking twelve near-identical
  full pages costs 175 KB and buries the difference the owner is being asked to approve. 32.8 KB
  authored beats 175 KB baked.
- **Generalise with a data attribute** (Overview): every varying fragment carries `data-s`, and one
  rule per state — `#st-new:checked ~ .stage [data-s]:not([data-s~="new"]){display:none}`.

### The drivability question, settled by a nonce

Event Your Team injected a unique marker into ONE copy on disk, loaded it, saw the marker render,
clicked a label and watched the state change, and screenshotted real pixels. So:
**a file under `build-sessions/prototypes/` loads as a `data:` snapshot and is fully drivable —
DOM reads, clicks, screenshots — WHEN the prototype needs no JavaScript.** The variable was never the
folder; a snapshot renders CSS and native form controls and refuses only script.
⇒ **The 375/1440 screenshot requirement is RESTORED for CSS-only prototypes.** The controller's
blanket withdrawal was too broad.

🪤 **And the cause of the controller's stale tab:** `preview_start` CREATES A NEW TAB rather than
reusing one, and a `navigate` aimed at a tab holding a local file is silently redirected to another
tab. **Read `tabs_context` and pass an explicit `tabId` on every call.**

### Three numbers corrected by the sessions that reported them

- **Papic captures:** 26, not 0 (controller relayed a register figure without measuring). Also
  0 allotments · 24 seats · 146 guests · 0 blurred · 631 challenges · 72 picks.
- **Overview's rail geometry:** the session withdrew 756/782 as *the app's* numbers — they were its
  prototype's chrome. What transfers is structural: panel 420px at the clamp ceiling, a 24px gap
  matching the rail's real margin, content never underneath. The derived squeeze is **280px**
  (644 − 336 − 28), labelled as derived from two measurements.
- **The badge roll-up** would have double-counted: one supplier can occupy several cards
  (Seda Vertis North covers catering, cake and accommodation), so a single unread message would read
  as 2+ in a folder total. `lib/shortlist-taxonomy.ts` already carries the rule —
  `// A linked copy is the same booking shown again — count suppliers, not cards.` Pixels unchanged;
  totals filter `includedWith == null`.

🔑 **FIVE TIMES TODAY THE CODEBASE HAD ALREADY WRITTEN DOWN THE RULE SOMEONE WAS ABOUT TO BREAK** —
`FOLDER_SUMMARY_TO_DECIDE` behind a constant · the 2026-07-10 nav ruling inside a removal comment ·
the `vendors.length === 0` qualifier · `unread` marked NOT THE SAME FACT as `unanswered` · and the
linked-copy filter. **Measure the render path, not the literal.**

---

## 🪤 THREE PROBES THAT LIE ABOUT WHAT IS ON SCREEN (2026-09-22)

Every verdict in this wave rests on readings like these, and all three were hit by more than one
session on the same day.

1. **`getComputedStyle(el).display` returns the element's OWN value even when an ancestor is
   `display:none`.** It reported 17 rationale blocks visible when the true answer was 0, and Unlock
   buttons visible inside a hidden parent. **Three independent sessions hit this one.**
   ✅ Use `el.offsetParent !== null`, or `getClientRects().length > 0`.
2. **`textContent` includes hidden elements.** "What does a person read first?" came back as an
   invisible flag. ✅ Walk text nodes and skip any whose parent has no `offsetParent`.
3. **DOM order is NOT visual order when CSS `order` is in play** — and every prototype in this wave
   orders with a body class. Reading the source gave Coverage first; the painted page gives Credits
   first. ✅ Sort by `getBoundingClientRect().top`.

## 🛑 THE CONTROLLER'S WORD-COUNT TEST WAS INVALID — withdrawn twice, and the second reason is the real one

Used against the Papic prototype: "134 words in the kit example against your 2,217".

- **First withdrawal:** it does not discriminate. The prototype the owner APPROVED is the wordiest of
  all six at 5,281.
- **Second, and fatal:** 134 was the kit example **with its `<script>` stripped** — and that file is
  JS-rendered, so stripping the script strips the page. Measured: script stripped **134**, script
  included **1,658**. The comparison was a rendered document against an empty shell.

🔑 **A round number from a file that obviously renders a full page was the tell, and the controller
did not notice it.** Third instance in one day of the shape it had corrected in three sessions: a
real difference, an invented measure of it.

✅ **The honest test is what a person sees:** visible-at-once, hidden state panels excluded — plus
the plain question "does the first screenful look like the page, or like a table of contents?"

## Baking vs authoring the delta — the answer was neither

Papic argued against baking (12 full pages = 175 KB, burying the difference) and for authoring
deltas (32.8 KB, but it read as a document). The resolution beat both: **bake the base ONCE, then
override only the differing sections per state.** 49.8 KB and a real page.

Two defects that only appeared once it was driven, both the day's signature failure:
- **11 show-rules pointed at ZERO override sections** — perfect CSS revealing nothing, so every
  state button would only ever hide things.
- **One state was a dead button**, because the baked base already had that setting on. A state that
  changes nothing is indistinguishable from a state that is broken.
✅ The guard: assert **every state changes the page**, and count overrides shown/hidden per state.

## Report discipline this wave earned

**Every file measurement carries its mtime.** Two crossings happened because a report and a rebuild
passed each other: the controller quoted phrases from an 11:26 file in a message that arrived after
the 12:02 replacement. Neither reading was wrong; one was old. Same family as the stale `data:` tab
and the stale deployed build.

---

## 📍 STATE AT 04:20 UTC 2026-09-22 — `origin/main` 727b9ccb4

### Prototypes: 6 of 7 delivered, all script-free and verified by the controller

`your_team` (**APPROVED** — "that is good enough") · `one_door` · `admin_money_switches` ·
`papic_controller` · `overview` · `quote_maker`. **Missing: the chat frame.**

### Builds

| what | state |
|---|---|
| Your Team **Slice 0** — cap the two uncapped lists | 🟢 **LAUNCHED** · `rd/team-cap-the-lists` |
| Quote maker **Slice G** — the gift switch governs the bill | built, regenerating the exposure baseline on the merged tree after #5867 landed |
| ONE DOOR **build 3** — account inside step 3 | built, committed, unpushed on `claude/rd-one-door` |
| Quote maker **Slice A** — a card seeds the quote | built, committed, unpushed on `claude/rd-quote-maker` |
| everything else | held |

### Merged today: 11 · Open: 3

#5875 (auto-merge **DISARMED** by the controller, awaiting the owner) · #5874 (draft, labelled
`do-not-auto-merge`, awaiting the owner's look) · #5873.

### 🛑 TWO THINGS ONLY THE OWNER CAN DO

1. **Open / resume the Event chatbox session.** It is `isRunning: false`, last active 03:15, and has
   never enrolled despite three messages. **It owns the shared chat frame, and two sessions are
   queued behind it** — quote-maker slices E and F, and the couple's inbox listing vendors rather
   than only threads. Measured: the frame is currently free, nothing in flight touches it.
2. **Decide #5875.** It is the Papic redesign P1→P3b, already built by a session outside this group
   between 10:36 and 11:25, 29 files, three migrations, a CI config change, and it edits the admin
   pricing file the money-switch build needs. Disarmed, not closed. One command lets it land.

### Why Slice 0 was launched while the gate is otherwise shut

The gate is "everything ready before building runs unattended". For this one slice it is genuinely
satisfied: approved drawing · both questions answered verbatim · no migrations · zero collisions
measured across every open PR and built branch · and it fixes a defect the owner found himself.
Everything else waits for the wave.

---

## 🛑 A CONTROLLER ERROR WORTH KEEPING: "unresponsive" was wrong

For three messages the register recorded the Event chatbox session as **not enrolled / not replying**,
and the controller reported that to the owner twice as the reason two sessions were blocked.

**It was never unresponsive.** Reading its transcript: the owner had told it to stop, and it was
holding for an explicit migrate-or-continue decision — it had even drafted the three options and
recommended standing down so the controller could re-point the chat-frame slice rather than wait.
It was behaving correctly and its silence toward the controller was the *correct* behaviour, because
a peer cannot override the owner's stop.

🔑 **A session that does not answer the controller is not necessarily idle, and "no reply" is not a
state — it is the absence of one.** The controller inferred a cause from an absence for the fifth
time today, and this time about a teammate rather than a file. **Read the session before reporting
it.** `list_events` would have answered it in one call, at any point in the preceding hour.

It also sent a correction the controller never received, because it was holding it: that a prototype
must be driven from inside `build-sessions/prototypes/`, which it had already discovered the hard way
by standing up a static server. Three sessions independently learned that; one of them had the answer
an hour before the others and no channel that was being read.

---

## 🛑 SOMEONE RAN A GENERATOR INSIDE THE STALE SHARED CHECKOUT (2026-09-22 ~04:45)

Flagged by the Event chatbox session as an unexplained dirty file it had not written. It was right to
flag and right not to touch it.

**What it was.** `supabase/security/prod-schema.snapshot.txt`, dirty in the shared checkout at
`~/Documents/Claude/Projects/setnayan-platform`, +1101/−259.

**Why it is dangerous.** Three versions, measured:

| version | lines | `[notnull]` section |
|---|---|---|
| `origin/main` | 9,554 | **1** |
| this checkout's HEAD (`claude/front-door-drops-hero-for-anchor`, **2,521 behind**) | 5,656 | 0 |
| the regenerated working copy | 6,498 | **0** |

The regenerated file carries **current prod data** (ledger 1478) produced by the **stale checkout's
generator**, which has no `notnull` support at all — `git show HEAD:apps/web/scripts/gen-schema-snapshot.ts`
mentions it 0 times; `origin/main`'s mentions it 5. So committing it anywhere would have **silently
deleted the entire `[notnull]` assertion block**, which `tests/db/schema-drift.db.test.ts` and
`lib/erasure/coverage.ts` both read.

🔑 **A generated security artefact that SHRANK.** Same failure class as the exposure baseline, and the
reason the quote-maker session's fact-counter arithmetic (6439→6440, 6441→6442) was worth praising:
a diff can show "no minus signs" while a whole section is gone.

**Root cause: a generator was run inside the shared checkout**, which is 2,521 commits behind. The
charter already says never read code from a stale tree; this adds the other half — **never RUN a
generator there either. Its output looks current because its data is.**

**Resolution.** The regenerated file is preserved in the controller's scratchpad as
`prod-schema.snapshot.REGENERATED.txt`; the working tree was restored to its own HEAD, which is the
clean state for that branch. Nothing was committed and nothing is lost. `main`'s snapshot is
untouched and still carries its `[notnull]` block.

⚠ **Open, and genuinely useful:** the regeneration shows prod is at ledger **1478** while `main`'s
committed snapshot is at **1351**. So `main`'s snapshot IS stale against production — but the refresh
must be run from a current tree, by a session that has one, not from here.

---

## 🏦 THE BUNDLE — four builds banked, one merge

All four verified by the controller against the tree, all unpushed, all clean against `origin/main`.

| build | branch | commit | footprint |
|---|---|---|---|
| Your Team **Slice 0** — the two strips stop pushing the bench off the page | `rd/team-cap-the-lists` | `dfdefb112` | 5 files, no migration |
| Quote maker **Slice G** — the gift switch governs the bill | `rd/quote-g-switch` | `ffbb17db4` | 11 files, **1 migration**, exposure baseline regenerated |
| ONE DOOR **build 3** — the account is created inside step 3 | `claude/rd-one-door` | `e3e593701` | 9 files, no migration |
| Quote maker **Slice A** — a card seeds the quote | `claude/rd-quote-maker` | `f92230106` | 6 files, no migration |

Land order: **A before G** (they overlap on `proposal-actions.ts`, clean today; the later one re-runs
its tests, and that should be the money-path slice, not the seeding one).

### Rules for landing them as ONE merge

1. Contributors get **NO auto-merge**. 2. The controller merges each into the wave branch **by hand,
after reading its checks green** — that hand step is the enforcement branch protection does not give
one level down. 3. Auto-merge is armed on **exactly one** PR: the wave branch → `main`.
Evidence for why: #5869 merged into its parent **while failing**, and #5870 merged **while pending**.

## Two rules earned by Slice 0

🔑 **CAPPING MUST BOUND GEOMETRY WITHOUT REMOVING ACCESS.** The obvious design — cap the list and put
"see all" behind a link — was wrong here because **every row is actionable** ("Lock now" is a
money-adjacent confirm), and the destination route does not exist. A native `<details>` folds in
place, needs no JavaScript, and keeps the couple able to answer. Generalises past this slice.

🔑 **"A phrasing ban that cannot tell code from a comment ABOUT code will eventually forbid explaining
itself."** The slice's own guard fired on the docblock that quoted the old `items.map(...)` behaviour
it was written to forbid. Fixed by routing through the repo's canonical `stripComments` rather than
writing a second one. **Sixth variant of today's family, and the first where the trap was inside a
guard someone wrote rather than in a reading.**

### 📌 REGISTER — a gap named, deliberately not fixed

**`waiting-for-quotes.tsx` and `pending-lock-proposals.tsx` cannot tell a refused read from an empty
one.** `vendors/page.tsx` hands both an empty array either way, so "we could not load this" and
"there is nothing here" render identically. **Not made worse by Slice 0** — the session proved that
and refused to widen a cap into a failure-state build, which was the right call: a quiet half-fix
there is worse than the gap, because the next reader assumes it is handled. Needs an upstream error
signal. Its own slice.

---

## 🛑 THE "UNCONTESTED" INBOX BUILD IS A REVERSAL — the controller put it on the board and was wrong

I carried this item for hours: *"the couple's inbox lists threads, so a supplier they shortlisted but
never messaged has no row — he asked for 'inquiries and vendors'"*, and told the chat session it was
uncontested. **It is not.** That session refused to guess and went to the source.

`DECISION_LOG.md`, 2026-09-09, verbatim: **"THE COUPLE HAS NO INBOX."** The owner's own question was
*"shouldn't they message a vendor from the build? or marketplace? adding here gives them what?"* The
ruling moved conversations onto **the bench — the couple's Vendors page** — and says the list route
*"survives only so notification and email links keep landing."*

And the bench already does the job: `CARD_CHECK_INQUIRY = 'Open conversation'` ships in
`lib/explore-info-copy.ts`, rendered by `shortlist-categories.tsx`, and the bench lists shortlisted
suppliers **whether or not they have been messaged** — which is exactly what "inquiries and vendors"
describes.

⇒ Building it as scoped would **grow back the page he asked to shrink** and create a second home for
one job. **On his desk as a question, not a build.**

🔑 **Two sessions and the controller all treated a finding as uncontested because it sounded like new
behaviour.** Nobody checked whether it had already been decided — which is RULE 0, and the rule I
have quoted at three sessions today.

### 🔒 BINDING, and not in anyone's brief

`prototypes/chat_interface_v2_2026-09-09.html` is marked in `DECISION_LOG.md` as
**BINDING — "port it, never redraw it"**. v3 and v4 followed the same night; v4's conversation frames
are byte-for-byte v3. Seven owner rulings landed in that sitting. **Any chat work ports that layout
and does not redraw it.**

---

## 🪤 A GUARD THAT ANSWERS THE SAME THING TO EVERY INPUT

The controller wrote that a rotted guard *"would pass a page with no gate at all — it is currently
protecting nothing."* **The session tested that claim instead of repeating it, and it is wrong in
direction.** Replaying the old rule against both states:

```
OLD guard on SABOTAGED page (gate deleted): FAIL
OLD guard on CORRECT page                 : FAIL
```

The regex needed the gate in order to match, so it could never have passed an ungated page. **It
failed identically either way — carrying zero information while looking like a legitimate red.**

🔑 **That is arguably worse than a silent pass, and the tell is the opposite one.** A permanently-GREEN
guard is invisible. A permanently-RED guard is loud, and the obvious response is to make the red go
away — whose two cheapest routes are **deleting the guard** or **deleting the rule**. A session under
time pressure does one of those and the property is gone, with a clean CI run to show for it.

**Add to the family:** we now have a guard that always passes (the sabotage that stayed green), a
guard that always fails (this), a guard that convicts its own docblock, a guard pinned to a literal
that protects a defect, and a guard whose window faces away from what it polices. **The question to
ask of any guard is not "is it green?" but "would it answer differently if the property broke?"**

### The two re-pointed guards, and why they cannot rot again

- **The picker gate** pairs every `<PapicWindowPicker` with the nearest preceding `{(!?)windowIsSet ?`
  — a backward look, because the gate wraps the mount — then asserts exactly 2 mounts, each gated,
  the gates different, exactly one negated. **No positional anchor at all**, so a third reorder
  cannot rot it. Its own comment already recorded one previous re-anchoring.
- **The leading block** parses `BLOCK_ORDER[phase]` out of the page — **the real mechanism**, since
  DOM order is not visual order here — and asserts the first block of each phase is one that tells
  the couple where they stand. Plus: no phase assigns the same `order-N` twice, and **the two phase
  maps are not identical**, which catches a bad merge collapsing them while the first assertion
  stayed green.

Every sabotage restored **from a backup, not `git checkout`** — correct, because `git checkout`
silently no-ops on an untracked file and silently destroys edits to a tracked one.

### 📌 For the owner's desk

**Before the event the facts strip no longer leads — the running credit balance does, by his own
instruction** ("the top one needs to be the credits purchase and running credits"). A rule was
**reversed, not broken**, and the guard now encodes the reversed version. Flagged so he reads it
rather than discovers it.

---

## ✅ CLOSED, NOT DEFERRED — the couple's inbox item comes OFF the register

**Nothing to build.** Verified by the controller against `origin/main`:

- `lib/bench-card-actions.ts:267` — `hasLiveInquiry(vendor) && vendor.threadId != null ? { kind: 'check', threadId } : { kind: 'inquire' }`. The resolver is **stateful on thread existence**; its own docblock says so.
- `bench-vendor-actions.tsx:264/274` renders both branches — `CARD_INQUIRE` = **"Inquire"** for a supplier with no thread, `CARD_CHECK_INQUIRY` = **"Open conversation"** linking to `/dashboard/<eventId>/messages/<threadId>` for one with a thread.

So **every shortlisted supplier already has a door**: start the conversation if there is none, open it
if there is. That is exactly the "shortlisted-but-unmessaged suppliers with a start-a-conversation
row" that was filed as the one genuinely new behaviour. It shipped with Explore Replan slice D.

It also shows the 2026-09-09 ruling working as written: **the route survives as the thread view, and
the bench is where conversations are reached from.**

**What is genuinely not built is the ruling itself** — a chat-styled list of every supplier, messaged
or not, with last message, timestamp and unread mark. That is what "THE COUPLE HAS NO INBOX" declined.
If "like a chat" meant the *presentation* rather than the *access*, it is a **reversal for the owner
to make**, the same shape as the Messages nav row. It does not go to him as a build.

⚠ **Where he was looking: the KIT, not a surface.** His message arrived attached to
`setnayan-chatbox-docs.zip` — *"there is a part **here**…"* — and names no route. He was reading
documentation. **Anyone who told the controller which surface he meant was inferring, including the
session that reported it and the controller who relayed it.**

🔑 **THE LESSON, and it is the day's cleanest statement of the whole family:**
**the code can tell you an absence is REAL; only the decision log can tell you whether it is a GAP or
a DECISION.** Six variants hit this today — copy behind a constant · a ruling inside a removal
comment · a `vendors.length === 0` qualifier · a linked-copy counting rule · a guard convicting its
own docblock · and this. **Every one was already written down somewhere nobody had looked.**

**What caught it:** the chat session refusing to build an "uncontested" item and opening the decision
log instead. Two other parties had already accepted the claim.

---

## ✅ Q4 ANSWERED BY THE OWNER — "the bench". CLOSED.

He answered in the chat session directly: **"inquiries and vendors" meant the bench**, which already
does it. The 2026-09-09 ruling stands **unreversed** — the couple has no inbox, and
`/dashboard/[eventId]/messages` remains a landing route for notification and email links.

**Nothing to build.** `dashboard/[eventId]/messages/page.tsx` is dropped from the chat session's
expected footprint; it was only ever there for this item.

🔑 **The item reached the controller from one session, was relayed as uncontested, and had been
decided by the owner in his own words thirteen days earlier.** What caught it was not a grep — it was
**reading `DECISION_LOG.md` before building.** The bench measurement only confirmed what the ruling
already said. Third time today the answer was already written down; this is the one where two parties
and the controller all agreed on the wrong thing first.

### 📌 The six thread states, measured directly in prod (controller, 2026-09-22)

`inquiry_status` is the enum `chat_inquiry_status`, NOT NULL, default `pending`. The vocabulary is
enforced by the **type**, so there is no CHECK constraint to read — a grep for one finds nothing and
that absence means nothing.

| state | rows in prod |
|---|---|
| pending · declined · displaced · withdrawn · **expired** | **0 each** |
| accepted | 3 |

So five of six have never existed. ⚠ **And `expired` appears to have no writer at all** — the chat
session searched and found none, and the enum carries it regardless, because an enum label costs
nothing to declare. **A state in the type is not a state the product can reach.** Its recommendation
— draw no screen for `expired` — is sound, and the register should say whether the label is aspirational
or dead rather than leaving a screen owed for it.

**Two soft questions remain inside that prototype and neither blocks a build:** the five
never-rendered closing messages (recommendation: fix `withdrew` and `booked-another`, where the app
currently **blames the supplier for something the couple did**), and whether anything writes
`expired`.

---

## 🔧 THE FRAME SET WAS A FILE LIST — it is now a ROUTE FOLDER

The chat session checked #5876 against its own routes rather than trusting "the frame is free" and
found one hit: `app/vendor-dashboard/messages/[threadId]/proposal-actions.ts`. **Not a collision** —
that is the quote maker's server actions, where slices A–D belong, and it is not in the enumerated
frame set. But it is inside the supplier thread's route folder.

**Measured: that folder holds 13 files. The frame set named 3.**

```
vendor-dashboard/messages/[threadId]/  → page.tsx · actions.ts · outcome-actions.ts ·
  pax-actions.ts · pay-confirm-actions.ts · proposal-actions.ts · loading.tsx ·
  an-open-tool-does-not-bury-the-conversation.test.ts · _components/{chat-info-rail,
  inquiry-outcome-capture, send-proposal-card, vendor-offer-service, vendor-payment-live}.tsx
dashboard/[eventId]/messages/          → page.tsx · actions.ts · loading.tsx ·
  [threadId]/{page.tsx, loading.tsx}
```

🔑 **THE `*-actions.ts` SIBLINGS OF A PAGE ARE PART OF THAT PAGE'S SURFACE, even when nothing in the
frame imports them.** A footprint is a list of what a session expects to touch; **an accurate list is
not a complete one.**

⇒ **Enumerate the route folder, do not recall the components.**
`git ls-tree -r --name-only origin/main <route dir>` beats memory, and it is one command.

The session that gave the most complete footprint of the seven is the one that found the gap — in its
own route directory. Sixth variant of the day's family.

## 🟢 W1 (platform) LANDS AS ITS OWN MERGE — deliberately not folded into the wave

Measured: `pf/platform-floor` is **CLEAN against `origin/main` AND against `rd/wave-1`, and the two
share ZERO files.**

**Folding it in would cost more than the merge it saves.** #5876 is already in CI; adding to it
restarts ~50 minutes, and it would couple two independent bundles so a platform failure holds four
Redesign builds hostage. **Two merges for nine builds is the right trade** — the rule is one merge per
*bundle*, not one merge per day.

✅ It also **properly fixed the snapshot** this register flagged: `[notnull]` intact, 9,550 lines, the
ledger gap closed 124 → 0 against current production, and the generator taught to run via
`supabase link --linked` so no production password is pasted.

🪤 **And it independently hit the stale-checkout generator trap, with the better description:** read
against the short file, the drift test reported *"3040 columns production does not mark NOT NULL"* —
**an absent section wearing the costume of enormous drift.** Its rule: **when a diff is implausibly
large, doubt the input before the subject**, and check which tree the generator ran in with
`git -C <dir> rev-list --count HEAD..origin/main`.

📌 **W1's headline for scheduling every later bundle: 8 of 14 register rows were ALREADY BUILT** — the
NOT BUILT / PARTIAL column ran ~55% false. One row was built four days before the register called it
missing; another six weeks before, and only its migration docblock stopped a session "fixing" it into
breaking the public shop page. **Budget the RULE 0 re-measure as the main work of each bundle, not a
preamble.**

---

## 🛑 A WITHDRAWAL IS NOT A STATUS — the controller's brief had the shape right and the mechanism wrong

I briefed the closing-copy fix as *"`declined`, `displaced`, `withdrawn` and `expired` all land in the
catch-all"*. Verified against `origin/main`, that is **not how a withdrawal is stored**:

- `app/dashboard/[eventId]/messages/actions.ts` → `withdrawInquiry` does
  **`.update({ archived_at: new Date().toISOString() })`** and **never touches `inquiry_status`**
  (the mechanism dates to 2026-07-24, migration `20270926679942`).
- So a withdrawn thread **keeps the status it had, usually `pending`** — it is **invisible to a status
  read**. The thread page could not have told withdrawn from declined *however the sentences were
  worded*.

🔑 **AND THERE IS A SECOND FALSE SENTENCE, IN A DIFFERENT BRANCH.** A withdrawn thread that was
`pending` may never reach the closing branch at all — it can still render *"Follow-up sent. Waiting
for {vendor} to accept."* **The app tells a couple who withdrew that they are still waiting.**
The new module resolves `archived_at` ahead of the status so both roads reach the right words, but
**the composer gate still keys off status alone.** Flagged, not fixed: that is a behaviour change,
not copy. **Register item.**

✅ **And the answer to "where should the rule live" was already in the tree:**
`messages/page.tsx` had `isRemoved = t.archived_at != null` driving a "Removed" badge. **The list was
right and the thread was wrong.** The module now carries it for both sides — and the **supplier side
had the same defect mirrored**, telling a supplier *"You declined this inquiry"* when the couple
booked elsewhere. The controller had not measured that side.

📌 `'withdrawn'` as a *status* is as dead as `'expired'`: the concept is live, the label is not.

### Two things that session refused to let pass silently

1. **One visual delta:** the decline sentence's bold *"Why:"* now renders plain, because the module
   owns the sentence as a string. **Accepted** — reinstating the bold would put the wording in two
   places again, and that trade is worse than the emphasis. Reversible if the owner wants it.
2. **The withdrawn and displaced sentences are the session's words, not the owner's.** The nouns come
   from his shipped list badges ("Removed", "You booked another", "Released · booked another"); the
   sentences do not. **He approved the fix, not the wording.** SPEC IMPACT named in the changelog and
   deliberately NOT written into `DECISION_LOG.md`. On his desk.

## 🪤 `heavy-lock.sh` WRAPPED AROUND A COMMAND IS A FALSE GREEN

`heavy-lock.sh sh -c 'tsc'` prints a usage line and **exits 2 with zero `error TS` lines** — which
reads exactly like a clean typecheck. It takes `acquire <label>` / `release <label>`, not a wrapped
command.

🔑 **The tell was the DURATION: the real run took over two minutes, the fake one under a second.**
**Time the job, not just the grep.** Add to the green-shaped-nothing family — this one had a printed
usage line nobody read because the grep for errors came back empty.

Also: a fresh worktree has no `node_modules`; symlinking the main checkout's (root **and**
`apps/web`) works, and `tsx` lives in the **root** `.bin`. Prove the `@/` alias resolved to YOUR
worktree — e.g. a module that does not exist in the shared tree passing its test.

---

## 📊 BACKLOG RE-MEASURED AGAINST `origin/main` 727b9ccb4 (2026-09-22)

Owner: *"re-measure the redesign backlog before planning the next bundles."* Done, after the platform
bundle found **8 of its 14 rows already built**. Every verdict below carries a proving symbol; two
spot-checked by the controller directly.

| # | item | verdict | proof |
|---|---|---|---|
| 2 | Your Team **Slice 2** — "a supplier is their card" | ✅ **ALREADY BUILT** | `BenchVendorActions` + `CardStanding` · `CardDateBlock` · `FitBadges` all render per card in `_components/shortlist-categories.tsx`, driven by `resolveBenchCardActions` |
| 12 | a purchase control for Setnayan AI | ✅ **ALREADY BUILT** | `SetnayanAiComebackOffer` mounts `InlineCheckoutDrawer` with `SKU_CODE = 'SETNAYAN_AI'`, imported and rendered in `dashboard/[eventId]/page.tsx` |
| 6 | the "You" profile card | ⚠ PARTIAL | card exists; the @handle on it is `readOnly` and availability is submit-time on a different form; the formal name is an always-open `<fieldset>`, not folded |
| 9 | service-card picker in the composer | ⚠ PARTIAL | `seedFromPackage` → `loadPackageLinesForQuote` exists, but it is a single `<select>` that **replaces** the lines — no multi-card accumulation |
| 10 | the supplier sees the couple's brief | ⚠ PARTIAL | `ChatInfoRail` carries `buildCustomerEventSummary` **beside** the composer; its CTA sends the supplier off-page for the full brief |
| 1 · 3 · 4 · 5 · 7 · 8 · 11 | badge counters · money split · remove the two task surfaces · small `/signup` card · consent per event · five-step flow · distinct count names | ❌ NOT BUILT | each with a **positive counter-proof**, not an absent grep |

**The counter-proofs are the valuable part**, because an absent grep proves nothing here:
`teamMoney` returns `{lockedPhp, inBuildPhp, budgetPhp, bufferPhp}` and its buffer does
`(c ?? 0)` — **a null price is silently ₱0, so it does not merely fail to refuse, it lies** ·
both Overview counts literally read the word *"open"* · consent is `users.public_summary_consent_at`
with **no `events.` sibling in the prod schema snapshot** · both bench task surfaces are still mounted.

### 🪤 THE SWEEP'S OWN FIRST FINDING WAS A REPO-SHAPE ERROR — in the controller's brief

Every path in my backlog was missing its `apps/web/` prefix. `git ls-tree origin/main -- "app/dashboard/…"`
returns **nothing** — *"which is exactly the shape of the false 'not built' your sibling register was
measuring."* 🔑 **A wrong path root manufactures a clean, confident, entirely false backlog.**

### PR #5875 (Papic) measured phase by phase

Covers **P1** (minus "Drive signs in on the tap" — no Drive/OAuth file in the diff at all),
**P2a**, **P2b**, **P3** (minus the 631-challenge picker — zero challenge/mission files in the diff),
and **P3b**. **P4, per-face blur, is entirely unbuilt** — the documented cut line.
⚠ And "P3 guest search in the allotment picker" was **never a deliverable**: `GuestAllotmentPicker`
is already on `main`.

### ⇒ WHAT THIS CHANGES FOR THE NEXT BUNDLES

- **Slice 2 was called "the biggest slice" and does not exist as work.** Removed.
- **Nobody needs to build a Setnayan AI checkout.** The upsell card should be pointed at the control
  that already ships, not given a new one. That is wiring, not a build.
- Three "builds" are really **completions** of something present — a narrower, cheaper shape.
- Papic's remaining work is **P4 plus two sub-items**, not four phases.

---

## 🔑 CI RUNS ON THE MERGE RESULT, NOT YOUR BRANCH TIP — and the tell is a NUMBER

Found by the Papic session on #5875. **GitHub runs pull-request CI on the merge of your branch with
`main`.** That branch was **18 commits behind**, so every local sweep it ran was validating a tree CI
would never build.

**The tell, and it costs one line to check:** local sweep **17,896** tests; CI on the *same SHA*
**17,904**. It had ADDED 4 tests, so the total should have gone **up**. The 12 "missing" tests live in
files that exist only on `main`.

🔑 **A LOCAL TEST COUNT THAT GOES DOWN AFTER YOU ADDED TESTS IS THE WHOLE SIGNAL.** It is the only
cheap way to notice you validated the wrong tree.

**What it nearly cost:** it had regenerated `admin-jobs.generated.ts` from the BRANCH tree, and `main`
had touched `studio/papic/page.tsx` — the exact file both re-anchored guards read. Had `main` added an
admin action in those 18 commits, the committed registry would have been wrong **the moment CI
merged**, and the guard would have gone red **after** the push, with auto-merge armed. It survived by
luck (321 jobs either way), not by method.

⇒ **REGENERATE GENERATORS FROM THE MERGED TREE**, same family as the baseline rule. And
**`git diff` showing main's changes do not touch your symbols is NOT a substitute for running the
merge** — main touched that page, and the merge was only known safe after doing it.

✅ **Checked against our own wave: `rd/wave-1` is 0 commits behind `origin/main`**, so #5876's CI is
building the same tree the branch holds. Its one generated file, the exposure baseline, was
regenerated on the merged tree by its author. **This time the rule was already satisfied; it will not
be next time.**

### 🪤 An asymmetric extraction manufactures a crisis out of nothing

Its first CI-vs-local comparison showed **155** discrepancies and sent it hunting test files that were
never missing. Cause: it anchored the local grep `^# Subtest:` and left the CI one unanchored, so one
list carried nested subtests and the other did not. Extracted identically the real diff is **5
local-only and 13 CI-only**.

🔑 **It failed in the ALARMING direction, which is the one that burns time.** Pair that with the same
session's earlier rule — *when a diff is implausibly large, doubt the input before the subject* — and
with: bare `grep` here is a ugrep shim that hides gitignored paths, so *"that test does not exist
locally"* was an unreliable read. `git grep -F` against `HEAD` and `origin/main` is what answered it.

---

## 🔑 EXTRACTING THE DECISION PROTECTS THE DECISION. IT DOES NOT PROTECT THE ARGUMENTS.

A refinement the chat session insisted on, and it is right that the shorter version would have been
the dangerous one to keep.

The charter held: *"a guard on the call cannot see the argument — extract one rule both sides
import."* **Extraction turned out not to be sufficient.** Both pages DID import the one module and
still hand-built `{ inquiryStatus, archivedAt }` at the call site. Measured, not argued: the session
edited a page to pass `{ inquiry_status: thread.inquiry_status }` — dropping the single column a
withdrawal is stored in — and **all eight mapping tests stayed green. The original bug, fully
restored, with no red light anywhere.**

**TypeScript cannot catch it either.** `ChatThreadRow.archived_at` is declared **optional** so a
pre-migration mapper can degrade to "not removed", and a literal that omits an optional property
type-checks. Making it required would make passing a real `thread` a type ERROR — worse.

**Two fixes, both applied:** the function now takes the **row**, so there is no literal to forget a
field from; and a second executable guard, `the-closing-copy-gets-the-whole-row.test.ts`, asserts
structurally that every `closingCopy(` call site passes the bare `thread`. Verified by the controller:
it loops **every** occurrence (`for (;;)` collecting `sites`, then `for (const [n, arg] of
sites.entries())`), not the first — the anchored-on-the-first-match trap.

🔑 **TWO TESTS, TWO DIFFERENT QUESTIONS: does the rule decide correctly, and does the caller hand it
the truth. The second is the one this repo keeps losing.**

### And a correct refusal of the controller's suggestion

I said *"a db-test fixture is the only honest proof"* for states with no production rows. **Wrong
here.** The module is pure and touches no database; its inputs arrive from a DTO the page already
fetched. A fixture would have exercised Postgres and said nothing about whether `page.tsx` passes
`archived_at`. **Unreachable states argue for a fixture-free executable guard with a watched
sabotage, not for a db-test.** The one db-shaped fact worth pinning is already covered: if
`withdrawInquiry` were changed to write the status instead, the module maps that label too.

📌 Register correction: that branch is **6 files**, not 5 — the controller measured before an amend
landed. **A stale file count is how the next fold's overlap check looks clean for the wrong reason.**

---

## 🛑 THE BASELINE GUARDS DO NOT CHECK FRESHNESS — and both were GREEN on stale files

The Papic session ran **every** file generator on its merged tree instead of reasoning about which
could be affected. **Two of three drifted, and neither was one it had touched or thought about.**

1. **`supabase/security/exposure-surface.baseline.txt`** — its migration adds
   `events.papic_guest_spend_floor_points`. The generator's own docblock: *"commit the result in the
   SAME pull request as the migration that caused it. That is the whole point: **the diff is the
   review**."* We were about to merge a security-surface change **with no diff for anyone to review.**
   The fact reads `anon=- authenticated=SU`, which is correct — **but nobody had been shown that.**
2. **`apps/web/scripts/port-control-baseline.json`** — 924 → 925 destinations, 4606 → 4610 blocks.

🔑 **AND BOTH CI CHECKS WERE PASSING THE WHOLE TIME.** `lint exposure baseline` and
`lint port keeps every control` are green on the stale files and green on the regenerated ones.
**They verify the file is canonical and that nothing was LOST. Neither notices it is OUT OF DATE.**
Controller-verified: `lint-exposure-baseline.mjs` contains no freshness or `generatedFromRef` check
at all.

⇒ **So "regenerate from the merged tree" must be a RULE, not a guard reference — there is no guard to
point at.** And the test is not *"did I touch a generator?"* It is **"run all of them and diff"**,
because the two that drifted were neither touched nor considered.

### 📌 `main`'s port baseline is ITSELF stale — verified by the controller

`origin/main:apps/web/scripts/port-control-baseline.json` declares
**`generatedFromRef: 23a6b30b8`** while `origin/main` is **727b9ccb4**. `revenue-summary.tsx` exists
on `main` and is not in it. So the staleness predates this wave and no guard has ever reported it.

**Sequencing that follows:** #5875 regenerates that file, so it must land **before** the wave
re-folds. If both regenerated it they would conflict on a generated file — the one class whose
resolution is always "regenerate", never "merge". The wave does **not** currently touch it, so there
is no conflict today; the wave will pick up the fresh baseline by rebasing after #5875.

**A generated file is not authored**, so regenerating across another session's omission is a service
rather than a trespass — but the omission gets attributed, not absorbed silently.

---

## 🪤 A GUARD SWEEP THAT SKIPS A GUARD PRINTS THE SAME THING AS ONE THAT PASSES IT

The chat session ran the repo-wide sweep at `089408e8e`. Its **first pass printed "failures: 0" while
four guards had been silently skipped on a path mismatch.**

**The fix is to count what RAN, not what failed** — it re-ran reporting `RAN=24`, found the two
stragglers, then **probed the harness with a real sabotage**: renamed `<ChatSendForm>` in the couple
thread page and got

```
❌ A ported route lost something it used to offer.
   /dashboard/[eventId]/messages/[threadId]  – no longer shows: <ChatSendForm>
```

exit 1, naming its exact route; restored → exit 0. **Only then did the greens mean anything.**

🔑 Same family as the `tsx --test` bracketed glob, the wrapped `heavy-lock.sh`, and `git grep -E \s`:
**every one printed a confident zero from a thing that never ran.**

### Why a naive sweep from the repo root skips guards — controller-verified

**31 `lint-*.mjs` guards exist: 29 in `apps/web/scripts/`, 2 in `scripts/`. CI invokes all 31.** But
the working directory differs per step — `.github/workflows/ci.yml` line 62 reads
`node scripts/lint-page-masthead.mjs` while that file actually lives at
`apps/web/scripts/lint-page-masthead.mjs`, because the step runs after a `cd apps/web`.
**A sweep from the repo root silently skips those.**

### `lint-port-no-lost-controls` inventories a route by what ITS OWN files render

So a frame refactored into shared components that **absorbs** a page's mounts reads as the route
having lost every one of them. `ChatBox` is a slot-renderer for exactly this reason. **Anyone
refactoring a frame will trip it — run it locally rather than discover it in the fold.**

### ⛔ NEVER RUN `changelog-collect.mjs` IN A SWEEP

It is a **release tool**, not a guard: it folds fragments into `CHANGELOG.md` **and deletes them**.
There are **3,867 fragments** in `changelog.d/` on `main` right now. CI mentions it only in a comment
explaining a different guard. It is not a check and must never be run as one.

### Deliberately not in a sweep

`test:db:ci` (the ~45-minute PGlite replay — skip only when the change touches no SQL, migration or
RLS) and `cargo test -p setnayan-encoder` (only when no Rust is touched).

### 📌 A refinement of the controller's db-test rule, from the session that declined it

> **A fixture proves the row; a watched sabotage proves the reasoning. Pick by what the code actually
> touches.**

Narrower than either of us had it. The controller's instinct — unreachable states argue for a fixture
— **is right in the general case**; it was wrong only because that module is pure and its inputs
arrive from a DTO the page already fetched.

---

## 🚨 THE HEAVY-LOCK IS ABOUT MACHINE LOAD, NOT JOB SIZE — the rule had a hole

Found by the chat session while its own `tsc` was being starved. **Controller-verified, not relayed:**

```
load averages: 84.52  85.96  70.54      ← on hw.ncpu = 10
memory free 33%  ·  pageouts 1,520,983
```

**Eight of the top twelve CPU consumers were `tsx` processes from one worktree's per-file test
fan-out**, each 17–23%, each a few seconds old.

🔑 **NOBODY BROKE THE RULE.** The charter says *"one heavy job at a time, machine-wide, through
`heavy-lock.sh`"*, and the 2026-09-13 shutdown note explains it as *"three sessions ran a full `tsc`
at once; each wants 4–6 GB"*. **That framing is about memory and long jobs.** A fan-out of thirty
100 MB processes never looks like "a heavy job" to the session running it — each is tiny and finishes
in seconds — and it produces a load figure far worse than the single `tsc` the lock was written to
serialise.

**The lock was HELD, correctly, and bought its holder nothing**: its `tsc` was not stuck, it was
**starved** — state `R`, 19.8% CPU after 11 minutes against a ~2-minute baseline. And **releasing it
would have made things worse**, by letting a second long job start alongside the fan-out.

### ✅ THE AMENDED RULE

> **The lock is about machine LOAD, not job size. A fan-out of many small processes counts.**
> Before a parallel test run — `--test` across many files, `-j`, a `for` loop spawning `tsx` — **take
> the lock too, or cap the concurrency.**
> **Check `uptime` first: if the 1-minute load already exceeds the core count (10), queue rather than
> start.** A job that starves every peer costs the group more than the minute it saves.

⚠ **And never `pkill` by pattern to clean it up.** A peer proved the same day that `pgrep -f` matches
its own polling shells — it read "5 concurrent tsc processes" when there was one compiler and four
greps. **A process count from `pgrep -f` is not a process count**; use `ps -o command` and read it.

📌 The danger is not theoretical: **uncommitted worktrees do not survive a shutdown.** The session
whose fan-out this was is carrying 23 files including a migration, uncommitted and unpushed.
**Commit before you stress the machine, not after.**

### 🪤 A 0-LINE `tsc` LOG CANNOT TELL A CLEAN RUN FROM A KILLED COMPILER

The chat session's typecheck ran 13 minutes through **load 84 with 1.5 M pageouts** and left
`tsc3.log` with **0 lines and 0 `error TS`**. That is exactly what success looks like — and exactly
what an OOM kill looks like. **The number that distinguishes them is the exit code, and it was lost:**
captured into `$RC`, then the `echo` meant to print it died on a bad `${{}}` substitution, so the
task-failure notice reported "exit code 1" **from the echo, not the compiler.**

🔑 **Both directions were misreadable.** The notice said failure when the compiler may have passed;
the empty log said success when the compiler may have been shot. **It reported INDETERMINATE rather
than picking the flattering reading** — and it is not folded on that basis.

✅ **The fix, and it is the rule:** capture the exit status **immediately after the command, before
any pipe, echo or label.** `$?` after a pipeline is the last element's; a label that dies takes the
number with it. Its re-run writes `EXITCODE`, `SECONDS` and `ERRORLINES` to a status file, sampled
first.

✅ **And it queued the re-run rather than starting it** — polling every 15s, starting only when the
1-minute load drops below 16, then taking the heavy-lock, with an hour's timeout. **Applying the
amendment to itself first**, when starting would have been the selfish reading of its own proposed
rule.

📌 Load trace through the incident: **80 → 84 → 139 → 132 → 122 → 94**; memory free 33% → 52%.
Peak fan-out 37 processes. No shutdown, nothing lost.

---

## 💰 ONE COLUMN DOING TWO JOBS — `floor_points` sizes a recommendation AND an entitlement

The Papic session bisected #5875's six DB-replay failures: **15/15 clean with its three migrations
parked; 10/15 with `20271239794268_papic_pool_sizing_knows_the_event_type.sql` restored alone.**

**Controller-verified mechanism:** `papic_event_pool_status` — the fence, not the adviser — computes
`v_base := LEAST(v_ceiling, GREATEST(v_floor, v_guests * v_per_guest))` and
`v_total := v_base + v_granted - v_alloc + v_released`, returning `GREATEST(0, v_total - v_used)`.
Production holds **one** config row: `default · 150 · floor 5000 · ceiling 30000`.

The branch seeds `wedding` at 5000 and **the other 16 event types at `floor_points = 0`**. So
`v_base` collapses toward zero, `v_total` goes negative, the clamp swallows it, and **releasing 96
credits moves the pot by 0** — her balance falls and the credits vanish. **The zero-sum break is a
symptom.**

🔑 **The disease: the `floor_points = 0` ruling was made so a 2-guest `date` is not RECOMMENDED
~₱3,360. The same column also sets what a paying event is GRANTED. The owner approved per-head
figures for a recommendation; shrinking the entitlement for 16 types was never put to him.**

### ✅ Ruling: build the option that changes no money

**Seed all 17 types at `floor_points = 5000` — the value production already holds** — and clamp the
recommendation separately.

- **Guesses no number.** Rule 9 forbids inventing a figure that sizes money. 5000 is the live value
  with its intent written down in `20270826385580` (*"small events never feel poorer than a ~33-pax"*).
  **Preserving a number is not choosing one.**
- **Changes no entitlement**, so the unapproved shrink never happens.
- **Delivers what he actually ruled** — the intent was about the recommendation.
- **Fixes the ledger**, because `v_base` stops collapsing.

⇒ **Separating the two jobs is a structural change, not a money change**, which is why it does not
need him. **On his desk as a question, not a blocker:** should 16 types eventually be granted less
than a wedding?

### ⚠ An unproven suspicion, deliberately not folded in

`v_granted` may count only shared grants (`seat_id IS NULL`) while `v_alloc` counts **all** seat
allocations including self-funded — in which case a guest buying her own credits reduces the couple's
shared pot, **and the old 5,000 floor has been concealing it in production.** The session raised it
and refused to assert it. **Its own replay, its own change** — a money-path correction riding inside
a redesign is how a revert becomes archaeology.

### 🔑 A CI job that fails early hides everything behind it

The DB replay step **had never run on #5875**: earlier runs died at Unit tests, so it was skipped.
Six real database failures sat invisible through two rounds of "fix the unit tests".
**Passing a step is how you discover the next one, not how you finish.**

---

## 🔑 FOR A VISUAL CHANGE, A GREEN SUITE IS NOT EVIDENCE

From the theme session, and it is the strongest argument anyone has made for the preview rule:

> An opaque `bg-cream` on `<main>` painted straight over the theme's fixed ground. **Attribute
> stamped, material resolved, every token correct, every test green** — and a couple who paid for
> Velvet got a white page. **It was found by looking at a screen.**

No guard in this repo could have caught it. ⇒ **A visual change is not done until someone has seen
it**, which is why `rd/` and `pf/` branch prefixes matter: `claude/*` gets no Vercel preview.

## 🛑 A FILE-LEVEL MATCH IS NOT A COLLISION — the controller's own error

I warned the theme session that `apps/web/app/globals.css` collided with #5874. **Raised from a
filename. It is not real:**

- #5874's selectors are `.sn-overview-cols` · `.sn-overview-flow` · `.sn-overview-status` ·
  `.sn-inspector-shell[data-open='true'] …`, all inside `@media (min-width: 1280px)` — **dashboard
  surfaces, zero `.sn-editorial` or `[slug]` selectors.**
- The theme's are `.sn-editorial .pahina-*` and `[data-invite-theme]` / `[data-hub-theme]` — guest tree.
- **Trial merge of the two branches: rc=0.** They do not touch the same lines.

**Disjoint selectors on disjoint surfaces cannot fight, layered or not.** The session's
unlayered-rule question was the right one — it is the only mechanism that could have made this real —
and it does not arise.

⇒ **Two changes to one stylesheet collide only if their selectors can reach the same element.**
The analyzer flags the file; a human has to read the selectors.

### Touching a shared CSS rule safely — the pattern to copy

Replace literals with `var(--token, <today's value>)` where **every fallback IS the current value**,
so an unthemed element computes byte-identically — and **verify the computed values in a browser**
rather than reasoning about them.

## 🛑 THE STALE CHECKOUT HAS NOW PRODUCED THREE FALSE THINGS IN ONE DAY

1. A **corrupted schema snapshot** — a generator run there dropped the whole `[notnull]` section.
2. A **false register row** — paths measured without the `apps/web/` prefix return nothing.
3. **A whole parallel build.** The theme session measured *"no theme system exists"* against
   `/Users/icecasasola` and built a rival vocabulary. **Five themes have shipped in
   `lib/invite-themes.ts` since 2026-09-10.** The owner caught it; the session discarded the build
   and rewrote it as an extension.

🔑 **The rule is not "do not read code from the stale checkout". It is: any answer measured there is
false, including an absence — and an absence is what sends someone off to build a second one.**

---

## ✅ A RED GRANDFATHERED PR MAY BE REPAIRED WITHOUT A NEW LAUNCH

The charter was ambiguous and a session asked rather than assumed. The rule:

> **Maintenance of an already-pushed PR, under an explicit controller instruction, is not a new
> build.** Merge `main`, regenerate generated files, fix a guard the merge broke — all allowed, and
> the push that follows is allowed. **What it may not do is ADD SCOPE.** If restoring green needs a
> code change beyond that, it is a build and it waits for a launch.

**A red PR sitting unattended is not caution, it is waste** — especially while the owner is away.

### #5873 — the worked example

Failed on **one** assertion of 3,014: *"THE FREEZE: the exposure surface has not widened against the
committed baseline."* Not a defect and not a conflict — the branch was **30 commits behind**, so its
committed baseline predated rows that landed on `main`.

Repaired by merging and regenerating. **Counters went UP by exactly the migration's own surface** —
`facts 6441 → 6444`, `col 4748 → 4750`, `func 243 → 244`, three rows added, none removed.

🔑 **And the session checked what the new rows EXPOSE, not just who added them.** Its new function is
`exec=anon,authenticated`, which looks like an opening. Controller-verified against production:
`has_table_privilege('anon','platform_settings','SELECT') = false`, RLS on, 1 policy — and the
function is `secdef=no`, so it runs as the caller and an anon gets **false, not the dates**.

> *"'The baseline only grew by my own rows' would have been true and still not enough."*

**A row being yours says who added it. It does not say what it exposes.**

### One check almost nobody makes

It re-ran its own db-test because the merge brought four migrations and **two of them sort ABOVE its
own**. The PGlite replay applies in **filename order**, so a later merge can move the ground under a
migration that was green yesterday. It had not — but that was measured, not assumed.

---

## 🛠 ANALYZER BUG FIXED — `merge-tree` exits 1 for a CONFLICT *and* for a ref it cannot resolve

Found by the controller falling into it. I reported a conflict between #5881 and the theme branch.
**There was none.** The theme session had re-cut `claude/event-hub-wears-a-theme` to
`rd/event-hub-wears-a-theme`, as instructed, so the old name no longer resolved:

```
git merge-tree --write-tree --name-only origin/main definitely-not-a-branch  → rc=1
git merge-tree --write-tree --name-only origin/main origin/main              → rc=0
```

**A missing ref and a real conflict are the same exit code.** The re-measured verdict against the
correct branch is **rc=0, clean.**

🔑 **Identical exit codes, opposite meanings — and the failure is in the ALARMING direction**, which
is the one that burns time and, worse here, would have mis-sequenced a wave around a conflict that
did not exist. Same family as the day's other false alarms: the asymmetric grep that manufactured
155 discrepancies, the `pgrep -f` that counted its own shells, the absent section wearing the costume
of enormous drift.

**Fixed:** `try_merge` verifies **both refs resolve to commits first**, so rc=1 can only mean
conflict. It returns `clean` · `conflict` · `unmergeable`, and both call sites — the pairwise matrix
and the landing simulation — go through it. An unresolvable ref now reports
*"a ref no longer resolves — NOT a conflict"* rather than a phantom.

### The picture after the fix — accurate for the first time

10 candidates · 7 overlaps · **2 real landing conflicts, both on GENERATED files**:
`#5873 → exposure-surface.baseline.txt` and `rd/event-hub-wears-a-theme → port-control-baseline.json`.
**Both are "whoever lands second regenerates on the merged tree", not blockers.**

⇒ **And note what this means for a branch rename:** re-cutting `claude/*` to `rd/*` for a preview is
correct, but it breaks every recorded reference to the old name. **Report a rename to the controller**
— the register, the plan and any queued analysis all carry the old one.

---

## 🔧 THE FAN-OUT IS THE DEFAULT TEST COMMAND — a build item, not a discipline problem

Controller-verified in `apps/web/package.json`:

```
test:unit : tsx --test "lib/**/*.test.ts" "app/**/*.test.ts"
```

**No `--test-concurrency` anywhere in any script.** The runner spawns per test file, which is what
put the machine at **load 139 on 10 cores** and starved a peer's `tsc` to 20 minutes against a
2-minute baseline.

🔑 **So the fan-out is not something a session chooses. It is what `pnpm test:unit` does.** Every
session running the documented command is doing what the one we noticed was doing. **A cap belongs in
the script, not in each session's discipline** — a rule that asks people to remember a flag nobody
told them about will be broken by the next session, and the one after.

📌 **BUILD ITEM, not a controller edit.** Capping a shared script changes CI for every job and would
slow the pipeline, so it needs a measured cap, a guard, and a PR — not a quiet edit with six pull
requests in flight. **Until it lands, the interim rule stands:** `uptime` before any heavy job, queue
above load 10, and pass `--test-concurrency=2` by hand for a local full sweep.

## The theme session's exposure argument — accepted, and it is the right refusal

I called an exposure-baseline regeneration "near-certain" for it. **It proved otherwise rather than
complying:** `git diff --stat origin/main -- supabase/` returns **zero files**, and
`gen-exposure-baseline.ts` renders the surface by replaying **migrations**. No migration, no SQL,
nothing under `supabase/` ⇒ **the surface is a pure function of inputs it did not touch and cannot
have moved.**

⚠ **And its distinction is the valuable half:** *"that is not the same as saying the committed
baseline is fresh."* If `main`'s baseline is stale from someone else's merged migration, that is a
real finding — but folding it into an unrelated PR **attaches a security-surface diff to a change
that did not cause it**, which is exactly what that file's docblock exists to prevent
(*"commit the result in the SAME pull request as the migration that caused it — the diff is the
review"*). It offered to run the replay and report **without committing**, so the drift can be routed
to whoever owns it. **Correct on both halves.**

📌 Open: is `main`'s exposure baseline (`# facts: 6441`) stale? Unanswered — the check replays every
migration and the machine has not been free.

---

## ✅ WAVE 2 SLICE B BANKED — `rd/overview-counts-are-named` @ **`c61af990e`** (was `fc71a7288`)

Two counts stop sharing the word "open"; the category count names its set — **"23 of 25 categories
not booked"** — which is what makes the rename safe rather than merely different. All wording in
`lib/two-counts-two-names.ts`, so a rename by the owner costs four template literals, not a refactor.
`needsDecisionLabel` is exported and unused here on purpose: **it is Your Team's name, placed so
slice 4 imports the wording instead of spelling a fourth variant.**

### 🔄 Landing order REVERSED by the controller: slice B first, #5874 second

The session proposed #5874 first. Sound when written; one fact changes it — **#5874 is a draft with
auto-merge deliberately unarmed, waiting on the owner to look at a layout nobody can verify without
eyes.** That would make a green, owner-independent build wait on an owner-dependent one.

**The merge work is identical either way** (#5874 restructures the region slice B edits), and #5874
is rebasing after his review regardless. **Safe because the guard asserts the CALL, not the
sentence** — proved by executing the merge in a throwaway worktree, resolving to #5874's side, and
getting `calls the module: false · hand-spelled remains: 2 · RED`. **A guard that follows the code
rather than the line number is what makes a landing order reversible.**

### 🔑 A safer-looking change can carry a new risk

> *"A bare 23 cannot be wrong about a set it never names. '23 of 25' can."*

Numerator (`countUnlockedCategories`) and denominator live in **different files**. Adding the
denominator created a cross-file agreement the bare number never had. Sabotaging the filter in the
*other* file produced **34 against 28**. `notBookedLabel` now drops the denominator when
`total < n`, so "27 of 25" can never reach a couple.

⚠ And the neighbouring `Math.max(0, total - remaining)` clamp was **the codebase already conceding
the mismatch is expressible** — an existing defensive line read as evidence rather than noise.

### Two self-caught faults worth copying

- **A vacuous cross-file test:** three event types against an empty scope map, `planGroupsForEventType`
  **fails open**, so all three printed byte-identical lines. **A test that cannot tell its cases apart
  is a test of nothing** — found by printing the output, not by trusting the pass.
- **Noun agreement moved onto the denominator:** `"1 of 25 CATEGORY not booked"`. Only an executed
  test finds that; the old wording could not have hinted at it.

📌 **Standing practice:** re-run a sabotage **after** the fix as well as before — a fix making its own
guard inert has happened in this repo.

### 📌 REGISTER — `digestSubWorthShowing` is INERT, deliberately left

Controller-verified on `origin/main`: **imported once, called zero times.** The panel renders
`{group.sub}` unconditionally. **23 assertions and a reasoned docblock guard a function nothing
runs**, and it predates every branch. Wiring it adds or removes grey lines across the whole digest —
a visible change nobody approved, and a green suite is not evidence for a visual change. Its own item.

### 📌 Re-banked at `c61af990e` — and the amend is docs-only, verified

The session amended to strip *"Landing order: #5874 first."* from its own changelog fragment, because
leaving it would **plant a stale instruction in the document the next session reads first** — the
exact rot this repo keeps paying for. Controller-verified: all five code files hash **identical** to
`fc71a7288`; the only differing path is the fragment. **Nothing needed re-reviewing.**

🔑 **A correct decision recorded in the wrong tense becomes a wrong instruction.** The fragment now
records the order that was chosen, the reasoning, and that the original reading was sound until the
draft-and-unarmed fact changed it.

### 🛑 A claim the controller's reversal rested on, which nobody had measured

I reversed the landing order partly on "merge-control lists only one collision". **That is not the
same claim as "this branch lands on `origin/main` cleanly by itself"** — the landing simulation
includes #5874, so a clean-alone verdict was being **inferred from a report about a different merge.**

Measured properly: `git merge-tree --write-tree origin/main rd/overview-counts-are-named` → **rc=0,
clean.** Going first is safe.

🔑 **A grep cannot predict a merge, and neither can a report about a different merge.**

### 🔑 The reusable half of why the reversal was safe

> A guard pinned to the rendered **wording** would have been satisfied by whichever copy of the digest
> tile survived, and would therefore have **forced a fixed landing order**. Asserting the **call** is
> what lets either land first — because whoever rebases gets told by a red test instead of by
> remembering a paragraph.

**Assert the call, not the sentence, and the order stops mattering.**

---

## 🧭 GUARDS PINNED TO A LOCATION THAT LEGITIMATELY MOVED — six reds, one cause

The theme session lifted "which theme is this event wearing" out of
`invite/_lib/load-invite-look.ts` into `_lib/hub-look.ts`. **No behaviour changed.** Six guards went
red because three NAME that file and two PIN its spelling.

🔑 **One of them fired in BOTH directions at once.** `s13-is-finished.test.ts` keys its wedding-word
pardons by LINE on two imports. The move made the old pardons **stale** and left the new file
**unpardoned** — the same edit tripping the guard twice, from opposite sides. **The best argument for
line-keying anyone has produced**, and it is why the re-key stayed line-keyed.

⚠ **And one had pinned a SENTENCE:** `if (theme === 'house') return { theme, skin: undefined };`,
which went red only because the local is now `look.theme`. **Re-anchored on the property in any
spelling, keeping the ORDER check** — the half that actually stops a House event reading the column.
A phrasing pin again, and again it convicted correct code.

## 🔑 ON THE OWNER'S DESK — an upsell UNDERSTATED, found by a guard needing both its assertions

`says-what-it-includes.test.ts` went red twice, and **it took both assertions to describe what
happened**: an unadvertised guest-facing gate on `COUPLE_WEBSITE_PRO` in a new place, and an
advertised gate whose implementation appeared to vanish. One move, two reds, and between them they
said it exactly.

**The finding:** the claim *"invite link"* is still true and all three claim surfaces still say it.
**What is now understated is the SCOPE** — a couple buying Event Hub PRO gets the theme on **every
page behind the door**, and no surface says so.

✅ **That is the SAFE direction** — the copy promises less than it delivers, which is the direction
that guard polices. **But it is a real upsell left on the table.**

📌 **Deliberately not fixed, and the reason is right:** the SKU's description lives in a **migration**
(controller-verified: `20271219583821_the_invite_link_wears_a_theme.sql` and
`20271220364681_the_pricing_page_names_the_invite_theme.sql`), and that branch carries **zero
migrations** by design. Widening the copy would claim a wave slot it had just proved it does not
need. **Owner's call, and someone else's migration.**

## 🪤 THREE MACHINE FINDINGS, one a correction to its own advice

1. **`--test-concurrency=2` is necessary and NOT sufficient** — that run still reached load 30.
2. **`kill` on the children does nothing.** The runner immediately spawns the next file with a fresh
   PID, and a PID changing under you reads as processes refusing to die. **Kill the PARENT**
   (`tsx/dist/cli.mjs --test`), then sweep orphans.
3. 🔑 **A long suite with no integrity check reports on a tree nobody can reproduce.** Its six reds
   were real but read off a tree it had edited *while the suite was measuring it*. The clean re-run
   hashes `HEAD` + `git status` **before and after** and prints `⚠ TREE CHANGED` if they differ.

---

## 🏗 THE STACKING RULE PROVED AT SCALE — seven bundles, one merge

The platform session merged **#5878 · #5879 · #5880 · #5882 · #5883 · #5884 · #5886** into
`pf/platform-floor`, all with `base=pf/platform-floor`, **none to `main`**. Trunk #5877 now carries
**33 commits, 54 files, +3170/−448, 0 failing** — and **collides with none of the five Redesign
branches** (all rc=0, controller-verified).

**Seven bundles, one merge.** That is the charter's whole thesis, measured.

### 🪤 AND THE COST OF IT, which nobody had hit before — a push can lose a race with its own PR

It pushed a typecheck fix to a stacked branch **while that PR was armed**. The PR merged **the commit
before the fix** and closed, so the parent took the change **without** its fix and #5877 went red.
**A stacked PR merges into its PARENT, where branch protection does not apply** — so it landed
carrying a known failure.

⇒ **Three rules, now standing:**
- **Never push a fix to an armed branch.** Open a new PR instead.
- **After any stacked merge, check `git log origin/<parent>..origin/<yours>`** — a non-empty result
  means the parent took less than you think it did.
- **Treat a stacked merge as unreviewed by CI.** Only the trunk's PR to `main` is protected.

### The three findings worth the owner's board

1. **Google REFRESH tokens were plaintext in every backup.** 0 of 5 access tokens exposed; **5 of 5
   refresh tokens** still matched `1//%`. The refresh sweep must open the refresh token to call
   Google, then wrote back the access token sealed and left the refresh token **as found** — so the
   secret that expires in an hour was protected and the one granting ongoing access to a couple's
   YouTube and Drive was not. One field, on an UPDATE already happening.
2. **A single admin could move money.** `admin_approval_requests` has enforced four eyes in the
   database since 2026-09-30 and its live vocabulary gated six **privilege** actions and nothing
   financial. 🔑 **The schema had already decided** — `comp_grants.approved_by` existed and was
   `null` on every row: a column built for a second admin and never given one.
   ⚠ **Refunds and payout-account changes are still single-admin.** Only comps are gated.
3. **A paid journal spotlight could be requested but never approved** — the queue called a dispatcher
   with no arm for the type, and it threw. Requesting worked, so only the last step failed, which is
   why it survived. Revenue-blocking.

### 🔑 The sentence that session kept proving

> **A value carrying more than one meaning will be read as the strongest one.**

`liveWall = null` meant "not owned" **and** "mirror off" **and** "the read failed". `mac.signed` was
read as "notarized" — `spctl` prints both facts in one breath, Gatekeeper only stops warning for the
second, and `/download` told couples to double-click a file macOS refuses.

**Same three moves each time: split the fact (absent ⇒ false), bind and raise at the source, and make
it reach the RENDER — then sabotage by deleting the render arm and watch a test go red.**

### Four of its own mistakes, recorded because the reasoning outlives them

- **A clock-based "this job hasn't run" alarm**, against two tests that exist to prevent exactly that
  — one named *"classifyJobRun cannot see a cadence, so it cannot compare one to the clock"*.
  **On a traffic-triggered job, idle is the normal state, not a symptom.**
- **Built a fix under a register row that was already done**, by guessing a symbol from the row's
  prose instead of running its `Re-measure`. 🔑 **A defect SHAPE repeats across a codebase, so a
  guessed symbol reliably finds a real instance of the WRONG thing.**
- **Half-fixed a CSP from the violation table.** Only one of two hosts had ever appeared, because the
  second fetch happens only when face matching runs. 🔑 **Report-only data is a LOWER BOUND on what
  breaks.** Its own guard caught it, by reading hosts out of the code rather than a typed list.

---

## 🌊 WAVE 2 IS FOLDED — four builds, one merge, all four clean (2026-09-22 08:3x UTC)

`rd/wave-2` cut off `origin/main` **`e43cbdb82`**, then four banked branches folded in, in
this order, **every one of them clean**:

| # | branch | commits | why it was safe here |
|---|---|---|---|
| 1 | `rd/closing-copy-says-who` @ `90acb5a50` | 1 | 6 files, owner approved the wording |
| 2 | `rd/chat-frame` @ `9d7e4a52c` | 1 | 5 files — the frame rides with nothing that touches the registries |
| 3 | `rd/overview-counts-are-named` @ `c61af990e` | 1 | 6 files; conflicts with **#5874**, which is draft and owner-blocked |
| 4 | `rd/event-hub-wears-a-theme` @ `39aff820b` | 6 | 35 files, 0 migrations, its own suite green |

**13 commits · 53 files · 0 migrations · one merge.**

### The only generated file that drifted — and the regeneration rule paying for itself

`apps/web/scripts/port-control-baseline.json`: the theme branch generated its copy from
`b02063e90`; on the merged tree the generator resolves to **`6edffa3de`**, **+2 destinations
and +6 blocks** (`/privacy`, `/terms`, `TurnstileField`, `OAuthButtonRow`,
`DesktopOAuthButtons`, `SignInHereLink`, `WaitingRow`, `ServiceCardQuoteSeed`). Those are
controls that landed on main *after* that branch was cut. The branch's copy was not wrong,
it was **earlier** — which is exactly the case a hand-merge gets subtly wrong and a
regeneration gets right every time.

The other three (`exposure`, `dup-rule`, `money-formatter`) already matched.

🔑 **AND THEIR SILENCE WAS PROBED, NOT TRUSTED.** A generator that exits 0 and writes nothing
is byte-identical, from the outside, to one that no-ops. A sabotage line was appended to
`supabase/security/exposure-surface.baseline.txt` and `pnpm exposure:baseline` re-run: the
line was removed and the sha restored. **Only then** was "no drift" evidence. Do this on any
generator whose run time surprises you — this one took **9 s** where an earlier session's
took **60 s**, and that gap is what prompted the probe.

## 🔑 A REFACTOR CAN TAKE A GUARD'S COVERAGE AWAY WITHOUT FAILING THAT GUARD

Found by the Event Hub session, and it is the **third shape** of the generator/coverage
lesson on this register.

`export const INVITE_LOOK_COLUMNS = HUB_LOOK_COLUMNS;` is an *identifier initialiser*. The
phantom-column scanner could not follow it, so three live `.select()` sites —
`invite/page.tsx`, `invite/reply/page.tsx`, `invite/enter/page.tsx` — silently **stopped
being checked**. The three doors were still correct. They were simply **no longer looked
at**, and nothing went red.

What caught it: the scanner keeps a **ratchet on what it could not resolve**, ceiling 1. The
alias pushed that to 4. **Without that counter the loss of coverage would have been
invisible**, because losing coverage produces fewer findings, and fewer findings is the same
shape as success.

✅ **The fix belongs in the resolver, not the call sites.** The alias is the *correct*
pattern — it is what `lint:dup-rule` exists to encourage. A scanner that cannot read the
correct pattern **punishes the correct fix and rewards the copy**. The resolver now follows
`const A_COLUMNS = B_COLUMNS;` (exported or file-local) to a fixed point, with a hop ceiling
so a textual cycle terminates. Unresolved is back to 1 (the pre-existing
`lib/vendor-services.ts` `FULL_SELECT`); the ceiling was **not** raised.

**The general rule: every scanner needs a floored counter of what it could not check.**
Without one, its silence and its blindness are the same output.

## 🛑 "FRESH" IS A PROPERTY OF ONE COMMIT, NOT OF A FILE

The register carried an open question — *"is `main`'s exposure baseline stale?"* The Event
Hub session replayed it and reported **1478/1478 applied, baseline unchanged at 6441 facts,
diff 0 lines.** That is real evidence and it closes the question **for the commit it
measured.**

It does not close it for `main`. Measured the same morning:

```
b958d65c0  6439   9acea66df  6438   efb0e033c  6441   8f2afe0ff  6440   ffbb17db4  6442
```

⚠ **Note it went DOWN** (6441 → 6440) and then up again. A baseline is regenerated by
whichever PR touches it, so its count is not monotonic and cannot be used as a version.

🔑 **Never write "the baseline is fresh" as a status.** Write *"the generator and the
committed file agreed at `<sha>`"* — which is what the replay actually proves — and
re-measure at the commit you are about to act on.

## 🪤 ONE RULE, NOT TWO SYMPTOMS — a harness that cannot tell "nothing failed" from "I did not look correctly" will state the confident version

Two halves of the same failure landed within an hour of each other, one on each side.

**The controller's half.** `build-sessions/why-red.sh` read the job URL with
`awk -F'\t' '$2=="fail"{print $NF}'`. `gh pr checks` ends every row with a **trailing tab**,
so `$NF` is the empty field *after* the last real column. The empty URL then tripped the
script's own `[ -z "$url" ]` guard, which printed **"no failing check"** for three PRs that
were all visibly red. ✅ Use the **positional** column (`$4`), never `$NF`, on tab-separated
output you did not generate.

**The guest-card session's half.** CI's run summary annotated `native encoder tests` as the
failure — a step that was **skipped**. The real failure was step 33. Everything after a
failure skips, and the **last skipped step takes the blame**. ✅ Read the step list and take
the **first** `conclusion == "failure"`; never the annotation. (Only `lint:dup-rule` and
`test:db:ci` are not `continue-on-error` here, so the summary is routinely wrong.)

🔑 **THE RULE:** *a tool that cannot distinguish "nothing failed" from "I did not look
correctly" will always emit the confident version.* One manufactured an absence, the other
misattributed a presence, and **both printed a sentence a reader would act on.**

**Four costumes counted on one day, from two sessions:**

| what was run | what it printed | what was true |
|---|---|---|
| `awk … $NF` on `gh pr checks` | "no failing check" | three PRs red |
| CI run summary | `native encoder tests` failed | that step was skipped |
| `tsx --test` on a path containing `[eventId]` | `# tests 0 … # fail 0` | the glob matched nothing |
| a background command piped to `tail` | empty output file | buffered until exit |

🔑 **In all four a printed COUNT would have caught it, and in none of them would a red/green
flag have.** Print what you searched and how many things you found, always, beside the
verdict — and floor it.

⚠ And a fifth, self-reported by the same session and worth as much as the others: its local
runner called `Lint page masthead` a FAIL because it invoked the guard **from the repo root**
where CI invokes it from `apps/web`. The guard was fine. **A guard's cwd is part of the
guard.** Run everything from `apps/web` or every `@/…` import — and every repo guard — dies.

## 🧭 SEQUENCING DECIDED — five builds, and the merges they cost

| what | where it lands | merges |
|---|---|---|
| closing-copy · chat-frame · overview-counts · Event Hub theme | **folded into `rd/wave-2`** | — |
| **#5885** one guest card (`ba9ec1f39`) | **base retargeted to `rd/wave-2`**, folded, port baseline regenerated on the trunk | — |
| `rd/wave-2` → `main` | the ONLY armed PR | **1** |
| **#5877** platform W1 (7 stacked bundles) | its own merge, by prior decision | **1** |
| **#5875** Papic | its own merge — owner: *"land 5875 then refold the wave"* | **1** |
| **#5873** free-fee window | armed already, another group's build | **1** |

**Five redesign builds for one merge; four merges total for twelve builds.**

⚠ **`claude/rd-quote-maker-held-bcd` (3 commits, 14 files) is CORRECTLY held and does NOT ride
wave 2.** Trial-merged: it conflicts on `apps/web/app/_components/proposal-maker.tsx`, and it
rewrites `apps/web/app/vendor-dashboard/messages/[threadId]/page.tsx` by +120/−24 — the chat
frame's own file. The frame must land first; then that branch merges `main` and redoes those
two files. This is the hold working, not a blockage.

⚠ **#5874 (Overview, draft) conflicts with the counts build inside wave 2**, on
`event-dashboard.tsx` — a real source conflict, not a generated file, and the two are not
stacked. #5874 waits on the owner anyway, so the counts went in and #5874 rebases after.


## 🪤 `git show "$REF:supabase/…"` IS SILENTLY MANGLED BY zsh — every session does this

The shell here is **zsh**, and zsh applies **history-style modifiers** to a bare parameter
expansion. `$V:h` is the *dirname* of `$V`, not `$V` followed by the literal `:h`.

`supabase/` starts with **`s`**, and `:s` is the **substitute** modifier, whose delimiter is
the next character — `u`. zsh eats a chunk of the path as a find/replace pattern that matches
nothing, then glues the leftover tail onto the ref:

```
B=origin/claude/papic-controller-redesign
"$B:supabase/migrations/…_a_minimum.sql"      →  origin/claude/papic-controller-redesignm.sql
"$MB:supabase/security/exposure-surface.txt"  →  727b9ccb…e1re-surface.baseline.txt
```

`${#S}` printed **44**, not 117. **The argument is destroyed before git is called, so quoting
the whole string does not help.** git's error then names a path nobody wrote — it reads like
a bad ref or a deleted file, not a shell bug, and this cost two wrong turns before `od -c`
settled it. It also throws a loud `bad substitution` for some paths and fails silently for
others, so the same mistake looks like two unrelated problems.

✅ **`git show "${REF}:path"`** with braces, or split the quotes: `git show "$REF":path`.
Modifier letters that trigger it after a bare `$var:` — **s h t r e g a A c l u q x f F w W P**.

🔑 Third member of the "this shell is not bash" family on this project, with
`PIPESTATUS` (bash-only, empty in zsh) and `status` (read-only in zsh, kills a watch loop on
line 1). **When an argument looks wrong, `od -c` it before theorising about the tool.**

## 🛑 THIS FILE WAS NOT UNDER VERSION CONTROL — fixed by putting it in wave 2

Measured 2026-09-22: `build-sessions/` **is** a tracked directory (198 files on `origin/main`),
but every artefact this controller produced was **untracked** —

```
REDESIGN-CONTROL.md  WAVE-PLAN.md  PROTOTYPE-SPEC.md
merge-control.sh     import-graph.py  why-red.sh
```

— 316 KB of charter, rulings, traps and the analyzer itself, living **only in the working
tree of a stale branch** (`claude/front-door-drops-hero-for-anchor`, hundreds of commits
behind main). `git show "origin/main:build-sessions/REDESIGN-CONTROL.md"` → *"exists on disk,
but not in `origin/main`"*.

⚠ **A `git checkout`, a worktree prune, or a branch switch in that checkout would have taken
the entire record with it**, and nothing would have reported a loss — the same shape as
everything else on this register. It is the second time on this project that a register has
turned out to be untracked.

✅ They are committed here, in the wave, so they cost **no extra merge**. The generated
reports (`MERGE-CONTROL*.md`) are deliberately **not** committed: they are outputs, they
change on every run, and storing an output is how a stale number becomes a fact. Regenerate
with `build-sessions/merge-control.sh`.
