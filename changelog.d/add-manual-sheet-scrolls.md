## 2026-09-21 · fix(add-manual): the sheet could not be reached, and the payment plan could not be read

Three defects in the one-screen "Add manually" sheet (#5777), **found by driving
it on production the day it shipped** — not by any test. Every one of them
passed a green suite.

**1. The required field and the Save button were off-screen.** Measured in the
live browser: the sheet was **1,513px tall in a 768px window**. It sits in a
`fixed inset-0` overlay, which cannot scroll, and `sm:items-center` centred it —
so it overflowed 372px off **both** edges. The required Vendor name field sat at
**y = −174** and "Save & add" was below the fold. A couple on a laptop could not
fill in the one required name, or save. The old four-field sheet fit; the
consolidation to eight fields and a 200px map broke it.
The sheet now caps its own height (`max-h-[92dvh]`, `sm:max-h-[calc(100dvh-2rem)]`)
and scrolls, and the Cancel / Save & add footer is **sticky**, so the primary
action never scrolls away. `dvh` not `vh`, so the pinned footer does not slide
under a phone's address bar. Re-measured live with the fix applied: sheet 16 →
752 inside the window, name field at y = 214, Save & add pinned at 675–719 and
still pinned after scrolling to the last payment row.

**2. On a phone the payment plan was unusable.** One six-column row per
instalment put the payment's NAME in a **34px** input and its due-date rule in a
**31px** select at 375px, and clipped them even on desktop ("Downpaymer",
"after bo", "before t"). A couple could not read which due-date rule they had
picked — the whole point of a dated plan. Each instalment is now two lines: what
and how much, then when.

**3. …and the two-line fix would ALSO have shipped broken.** A replica measured
inside the live sheet came back at **18px**. The shared `CELL` class carried
`w-full`, and every control added a fixed width on top. Two width utilities on
one element resolve by the order Tailwind EMITS them in the stylesheet, not the
order they are written — and `w-full` won, so every control went to 100% and the
flex row shrank them all together. Removing it: name 169px, due-date rule 130px
against the 88px "before the event" needs.

**Also: the payment plan now prints money through the shared `formatPhp`.** Both
the plan's running total and its shortfall message hand-rolled
`Math.round(n).toLocaleString('en-PH')`, so a ₱1.50 shortfall read "₱2 is
unaccounted for" — a figure the couple could not find in anything they typed.
That is the PR #5744 bug (₱837.50 printed as ₱838) on a new surface. The
money-formatter scan passed it only because it inspects functions NAMED like
converters (`…ToPhp`); the rule is the intent, not the scan's reach. New test:
a ₱1.50 shortfall is named as ₱1.50.

**Guards.** `the-add-manual-sheet-is-animated.test.ts` gains a reachability
block — a height cap on phones and desktop, `overflow-y-auto`, and a sticky
footer — each sabotage-verified to go red. It is explicit that a source guard
cannot measure layout: it pins the declarations whose ABSENCE produced the bug.
Its existing mount assertion had pinned the literal class ORDER
(`sn-addman-sheet w-full max-w-md`) and broke on this edit for a reason unrelated
to animation; it now pins the element.

Sticky works here BECAUSE the sheet's entrance uses `backwards`: `both` would
leave an identity transform on the sheet, and a transformed ancestor breaks
sticky exactly as it breaks `position: fixed`.

SPEC IMPACT: None — layout and formatting fixes to an existing decision.

## 2026-09-21 · fix(add-manual): "before the event" was still clipped on a phone — the controls move to a header line

Re-measured on production AFTER #5805 deployed, this time in the select's REAL
font. On a 375px phone every form field renders at **16px**, not the `text-xs`
the class asks for — deliberately: `globals.css` floors mobile form fields at
16px because iOS Safari zooms the whole page into any field smaller than that on
tap. Shrinking the font would trade a clipped label for a page that lurches on
every tap, so it stays.

In that font "before the event" needs ~152px (118px of text + padding + arrow)
and the due-date select had 130: clipped by ~22px. The reorder/delete buttons
were spending 72px of that 317px row and the word "Due" another 19.

They now live on a small header line per payment — `PAYMENT 1 … ↑ ↓ 🗑` — which
numbers the instalments and keeps full 24px tap targets. Pre-flighted inside the
live page at 375px in the real font: due-date rule 198px of room for 118 needed,
payment name 153 for 103, days 32 for a three-digit "120" at 27.

🔑 **Two measurement artefacts were caught on the way and NOT "fixed":**
- The first 375px reading put the sheet at 179→926 on an 812px screen. The
  browser pane was HIDDEN (`document.visibilityState: "hidden"`), and browsers
  freeze CSS animations in hidden documents: the page's 400ms entrance
  (`.sn-page-enter`, `sn-rise-soft`) sat at `currentTime: 0`, holding its
  `translateY(8px)` — and a transformed ancestor re-anchors `position: fixed`.
  In any tab a person is looking at, it finishes in 400ms. Finishing it put the
  sheet exactly where predicted, 65→812, with Save fully on screen.
- The same frozen state read the due-date select as 98px; the valid state reads
  130 — which is what the pre-flight replica had said all along.

Verification: tsc clean · lint 0 errors · 32/32 guards · unit suite. The DB
suite is left to CI: this change is one client component whose only
`plan_*` references are form-field `name` attributes — no table, no column, no
`.from()` — so it cannot trip a data-layer guard.

## 2026-09-21 · fix(lock): locking a self-added supplier no longer erases the payment plan the couple typed

Found by tracing the owner's question — *"all information is mapped and
connected? To their budget? Payment? Vendor List?"* — through real data rather
than answering from the code that saves it.

Vendor list: connected (the owner's own self-added venues appear on the bench
and under "Locked in"). Budget: connected — `budget-truth.ts` reads every
`event_vendors` row on the event and never filters out off-platform suppliers,
so a price typed on the sheet flows straight in. (The owner's two locked venues
read "LOCKED ₱0" honestly: they were added through the old flow, which had no
price field, so `total_cost_php` is null.)

**Payment: connected, then ERASED at lock.** `finalizeVendor` snapshots a plan
into `event_vendor_payment_plan` at every lock, with an `upsert`. It was written
when only a marketplace supplier could have a plan — its own comment said
"off-platform / manual vendors have no vendor_services rows … we still create an
empty plan for them." Since 2026-09-20 a couple can author one. So a couple who
saved "30% now, 70% two weeks before" and then tapped Lock had it replaced by a
generic 50/50 "estimated — confirm with your vendor". Each half passed its own
tests; only the sequence was wrong. Both of the owner's locked venues carry a
plan row they never entered — the lock snapshot's.

Fix: `lockMayOverwritePlan` (pure, in `lib/self-added-payment-plan.ts`, 4 new
cases) — on-platform always refreshes; off-platform refreshes only an absent,
empty, or our-own-default-seeded plan, and leaves a couple-authored one alone.
An UNREADABLE existing plan on a self-added supplier is left alone rather than
overwritten blind: the couple's plan is the only copy, a generic estimate is
recoverable. `locking-keeps-the-couples-plan.test.ts` guards that the lock step
still ASKS the rule and still ACTS on the answer — sabotage-verified both ways
("keep the call, discard its result" and "fail open on a read error").

⚠ Known, not fixed here: a couple's `on_lock` dates are resolved against the day
they ADDED the supplier (there is no handshake date), and `instances_json` stores
resolved dates rather than the anchors — so locking later does not re-date "30%
on booking" to the lock day. Preserving the couple's plan is the correct fix for
the data-loss; re-anchoring it is a separate product question.
