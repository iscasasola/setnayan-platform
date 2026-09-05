## 2026-09-06 · feat(vendors): say what a lock costs BEFORE the couple commits

Owner ruling 2026-09-06, verbatim: *"of course adjustments on the saved build will change when a
vendor is locked, and announce that the following builds are no longer possible for you, and these
services are no longer possible once you lock this vendor."* Asked **which** locks should warn, the
owner chose **every lock that kills something** — not only the date-setting one. Silent when a lock
costs nothing.

`computeLockImpact` / `lockImpactCopy` landed on this branch correct and **deliberately unwired**.
This is the wiring. Nothing rendered them, so the two consequences stayed exactly as silent as they
had always been: `isPlanLoadable` went false and the Load button greyed out with no explanation, and
`buildDateWindow` slid bench cards behind *"Doesn't fit your build"* one screen away from the press
that caused it.

**`finalizeVendor` now answers "what does this cost?" with its gate result.** Two shapes:

* `date_will_lock` grows `impact: LockImpact | null` — a lock that sets the date **and** closes
  options states both in ONE dialog. A couple told "this sets your date", then told "and it closes
  these plans" on a second screen, is being asked to re-decide something they decided one screen ago.
* a new `lock_will_cost` fires for a lock that kills something without setting the date.

**The `isEmpty` rule is load-bearing, not a nicety.** `lock_will_cost` is only ever returned with a
non-empty impact, and the date gate passes `null` for an empty one. A confirm that always fires gets
clicked through unread — and then the one that mattered is clicked through too, which would make the
announcement worse than not shipping it.

**The services half re-derives nothing.** `sunkVendors` calls `resolveBuildDateWindow` +
`classifyAgainstBuildWindow` — the module the bench itself renders from — twice: as things stand,
and with this vendor folded in as locked. `computeLockImpact` diffs the two. So the modal cannot
disagree with the bench about who fits, and it inherits that core's three silences unchanged: no
verdicts for an anchored/open window, none for a vendor whose calendar we could not read, and none
at all when the build's own window is already empty (that conflict is the couple's, not a vendor's).
A vendor already sunk before the lock is not a casualty of it.

**Three cases that announce nothing, each for a reason:**

* **A handshake ASK.** A marketplace press writes `lock_request_state='pending'` and **not**
  `status='contracted'`, so no category is settled, no plan becomes un-loadable and the date window
  does not move. Announcing losses at request time is the same defect §6.1 keeps out of the date
  gate — acting on a supplier's answer before they have given one.
* **A read that failed.** Every read in `resolveLockImpact` aborts the whole computation rather than
  degrading to an empty list. This is deliberately *not* the "reads are honest" reflex: a refused
  `event_vendors` read would leave `lockedGroupIds` empty, which makes plans that **died three locks
  ago** look newly killed by this one. Under-warning is recoverable; naming a casualty that isn't
  one is not.
* **An off-platform vendor's effect on services.** It declares no calendar, so it constrains
  nothing — locking one can cost saved plans but never sinks a bench vendor. (44 of 45 production
  bookings are off-platform, so this is the majority path, not an edge case.)

**One modal, extended.** `LockDateConfirmModal` → `LockConfirmModal`: same portal, same
`useModalA11y`, same geometry and confirm/dismiss contract, now firing for non-date locks too. The
date-setting sentence is byte-identical to what shipped. The casualty lines come from
`lockImpactCopy`, not from JSX — the two bans (**never** that a day is *held* or *reserved*,
`build-date-window.ts` rule 3; **never** that a plan is *deleted*, because a lock un-loads a saved
plan and the row survives) are pinned by tests against that function, and re-writing the prose in
the component would move the words out from under the tests that guard them.

**Consent is a ref, not a threaded field.** `impactConfirmedRef` is set on confirm and read inside
`performLock`, so it survives every later gate — reservation terms, the downpayment picker, a slot
re-pick — each of which re-enters `performLock`. `confirmDateLock` is threaded one field at a time
through each gate's state, which is one forgotten field away from re-opening a modal the couple
already answered. A ref cannot be dropped by a gate that does not know about it. Dismissing never
sets it, so "Not yet" really means not yet.

**FLAG — a correctness gate, not a rollout habit** (called out because the brief asked for a
deliberate decision). The announcement rides `isExploreReplanEnabled() && isBudgetBuildEnabled()`.
With the replan flag **off**, `build-compare.tsx` loads every pick a snapshot holds (it only calls
`planPicksToApply` when `replan` is true), so a lock costs a saved plan **nothing**, and the soft
convergence tier never runs, so no vendor is ever sunk. Warning about either would describe a
product the couple is not using. **Verified against Vercel, not assumed:
`NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED="true"` in Production** (also Preview) — so this ships live, and
the flag remains an honest kill-switch rather than a dark corridor.

**Behaviour change worth naming:** `pending-lock-proposals.tsx` (the coordinator's "lock it now"
row) does not carry `confirm_lock_impact`, so a costly lock there now falls into its existing
unknown-gate branch and sends the couple to the vendor's card to finish. That is the intended
direction — the announcement belongs on the surface that can render it — and it is the same
treatment the date, reservation-terms and downpayment gates already get there.

**MUTATION-CHECKED, both directions. Baseline 0 red · 10/10 mutations caught · restored 0 red.**
`isEmpty` guard removed → 1 red · date modal stops carrying the lists → 1 · handshake-ask skip
removed → 1 · flag gate removed → 1 · target left on its own bench → 1 · target never folded into
the after-team → 2 · plans named by index instead of the couple's own title → 3 · confirmed re-call
drops the consent → 1 · modal writes its own prose → 2 · malformed snapshot trusted → 1.

Tests: `lib/lock-impact-inputs.test.ts` (21) + `lib/lock-impact-wiring.test.ts` (14), plus the 8
that already covered the core. Scoped `tsc` and ESLint clean on the six touched files. The wiring
file uses source assertions — `actions.ts` is `'use server'` and `accordion-lock.tsx` is an
1100-line client component, neither importable in `tsx --test`, the same shape
`bench-deep-link-anchor.test.ts` already uses.

SPEC IMPACT: `Explore_Replan_BUILD_SPEC_2026-07-27.md` §6 + §8 — the pre-lock confirm now announces
plan and service casualties on every lock that has them, not only on the date-setting lock.
`DECISION_LOG.md` row added in the corpus.
