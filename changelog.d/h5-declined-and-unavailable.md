## 2026-09-11 · feat(bench): a supplier who said no, or can't make the date, is not shown as a pick

Owner, 2026-09-11 (register question 10), verbatim: *"hide lock, say why. but
technically, they shouldn't even be shown as planned based on their schedule
availability."* Register session **H5**.

### 1 · "Hide lock, say why"

A supplier who **declined the couple's inquiry** no longer offers **Lock this**,
and the card says why: *"They declined your inquiry · So there's nothing to
lock. You can still message them."* A supplier whose slot **another booking
took** (`displaced`) says *"Another booking took their slot · The date you asked
about is gone. You can still message them."* After a declined
**lock request**, Lock stays — the owner kept it, because they may be asked
again.

Both reasons are read from `chat_threads.inquiry_status`, never inferred. The
decline form sends no reason, so the card never claims "not free on your date"
it cannot know. The supplier's optional won/lost reason (`lost_availability`)
is **their private record** and is deliberately not read.

### 2 · Not shown as planned when their calendar shows the day taken

This is **Explore Replan PR-G2, the "hard anchor grey-out"** — specced
2026-07-27, its gate resolved the same day ("PR-G2 — now UNBLOCKED"), never
built. The owner-locked spec already decided where such a card goes:
*"DIM + booking-DISABLED + SINK behind 'Not available' divider, never removed;
'Ask anyway' keeps the thread path."* Built to that:

- the signal is the shipped `dateFit` (the supplier's own calendar on the
  committed day, one batched read per bench, failing open to "free");
- Add to build and Lock stand down; the conversation stays one tap away;
- the rail reads **fits · "Doesn't fit your build" · "Not available on your
  date"**, the new tier behind a red divider in the design system's CTA red;
- a pick already **in the build** is sunk too and **keeps its Remove** — never
  silently taken out of the couple's plan;
- the couple's **own** booked supplier is never "not available" (a paid deposit
  blocks the date *by them*), and an outstanding lock request keeps its own
  "take it back" row.

**The Picks column agrees.** Its "In your build — ready to lock" rows each carry
"Lock to confirm". Those rows now come from the card's own resolver: a pick that
cannot be locked moves to *"In your build — can't lock right now"* with its
reason and Remove, and no Lock.

### One decision, three surfaces

`isUnavailableOnDate` is the one definition, read by the card's resolver, the
rail's sink and — via `blockedLockReason(resolveBenchCardActions(…))` — the
Picks column, so they cannot disagree about the same supplier.

### A bug this fixed on the way

The card drew its whole build slot only when `lockGroupId` was set — and the
resolver deliberately nulls `lockGroupId` on a schedule clash to hide Lock. So
the SOFT tier's note — **"Doesn't fit your build · Remove {candidate} from your
build and this vendor is bookable again."** — has
**never rendered**: a clashing card showed its dim and divider with no reason.
The resolver's tests never looked at the card's condition. The build slot now
has its own `buildGroupId`, the note draws, and its colour (`#8C6932`, ~5.0:1)
is now on the legibility guard's list — measured for the first time because it
is on screen for the first time.

### Guards

- `a-supplier-who-cannot-make-the-date-is-not-planned.test.ts` — both rulings;
  two invariants swept over all 18,816 combinations of the facts the resolver reads (`buildGroupId ⇔ build`; Lock
  never offered beside a reason not to); the sink, card and Picks column read
  one predicate; the card's build slot is keyed on its own id; a blocked pick
  never gets "Lock to confirm".
- `the-bench-is-legible.test.ts` — 4 new labels (10 → 14), all AA in both themes.
- `card-dates.test.ts` — "every VendorCard passes dates" now COUNTS the call
  sites instead of hard-coding 2 (the new sunk rail made 3).
- `bench-arrangement.test.ts` — the sink-after-arrangement claim now covers both
  sinks.
- **Sabotaged 7 ways**, each caught.

### Not built

The spec's other hard-tier half — **"Beyond reach"** after a venue is locked —
is not in today's ruling (which is about schedule availability). Left for a
decision.

SPEC IMPACT: `Explore_Replan_BUILD_SPEC_2026-07-27.md` — PR-G2's date half is
built; its reach half remains. Noted in the corpus with this PR's number.
