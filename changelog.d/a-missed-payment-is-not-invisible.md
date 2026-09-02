## 2026-09-02 · fix(budget): a payment you have missed stops being invisible

Overdue was flagged NOWHERE. `paymentDueTrigger` filtered `d >= 0 && d <= 7`,
and that `d >= 0` dropped every payment the couple had ALREADY MISSED — no
GRD-01 intervention, so no tray notification and no email, on the ONE guard
the spec puts on the email allowlist. The money resolver had no notion of a due
date passing at all. A missed payment did not render as a warning; it rendered
as nothing, byte-identical to an event with no payments due.

- `lib/setnayan-ai-triggers.ts` — the window opens backwards. `paymentDueState`
  is now the ONE definition of the bands (`overdue` · `due_soon` · `upcoming` ·
  `later`), read off `TRIGGER_THRESHOLDS.paymentDueWindowDays` (7, unchanged)
  and a new `paymentHorizonDays` (30 — the horizon `lib/budget.ts` has always
  used, given a name, NOT a third window). An overdue GRD-01 fires under its own
  copy variant, its own dedupe key (so the "due in 3 days" note already inside
  the 7-day cooldown cannot swallow the first alert that money is late), and a
  BOUNDED priority above the heads-up band.
- Day math is now calendar days on the Manila calendar, not elapsed hours
  between instants. The old form returned −1 for a milestone due TODAY from
  00:00 UTC onward; harmless only while every negative was discarded, and a
  lie the moment overdue can fire.
- `lib/budget-truth.ts` — `MoneyLine.dueState` / `.daysUntilDue` per line, and a
  disjoint `MoneyDue` roll-up on `EventMoney` and on every `MoneyBucket`. It
  imports `paymentDueState` from the trigger engine, so the figure the page
  counts and the figure the email names come from one function. A paid-late
  milestone is `settled`, an estimate is `none` — neither is ever called
  overdue. `MoneyInputs.now` injects the clock; the core stays deterministic.
- `lib/setnayan-ai-templates.ts` / `-guard-plan.ts` — GRD-01 gains an `overdue`
  copy variant and an "Payment overdue —" tray title. Without them the email
  would have read "is due 2026-01-04, -4 days away" under a "due soon" subject.

Boundary days -1 · 0 · +1 · +7 · +8 · +30 · +31 are asserted explicitly in both
suites, and six sabotage runs confirm the assertions bite.

SPEC IMPACT: None. GRD-01's meaning is unchanged (a vendor payment milestone
needs attention); this closes the half of its window that was never implemented.
The corpus template library's GRD-01 entry gains a second copy variant — copy
only, no decision changed.
