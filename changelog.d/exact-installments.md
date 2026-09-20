## 2026-09-20 · fix(money): an installment keeps its centavos — including the three places it was rounded BEFORE being stored

Follow-up to #5744, which made the booking-fee path print exact centavos and
fixed an admin matcher that compared a ROUNDED amount. #5744 deliberately left
the installment sites alone because #5737/#5741/#5742 were rewriting those
files; those have merged or are merging. Re-measured on `origin/main`, and the
defect was larger than the display bug it was sent to fix.

**Rounded BEFORE STORING (outranks display) — all three fixed:**

- `lib/vendor-service-payment-schedules.ts` · `centavosToPhp` was
  `Math.round(centavos / 100)`. `computePlanInstances` uses it to freeze the
  couple's payment plan into `event_vendor_payment_plan.instances_json` at lock,
  so the stored plan held whole-peso figures for the life of the booking. Its
  identically-named sibling in `lib/payouts.ts` already did this correctly; the
  two are now pinned together by a test.
- Same helper, second caller: `rowToDraft` fills the supplier's schedule EDITOR
  and Save sends it back through `phpToCentavos`. Opening a schedule whose
  `amount_centavos` was `1340050` and pressing Save **without touching it** wrote
  back `1340100`. A read-only visit moved the money.
- `lib/proposal-payment-schedule.ts` · `sanitizeAndResolveSchedule` coerced
  `amountPhp` with the integer helper `int()` (which exists for seq and day
  counts). A ₱13,400.50 installment arrived correct on the wire and was
  persisted as ₱13,401. Now a centavo-preserving `php2()`; `int()` keeps the day
  counts it exists for.

**A percent installment:** the expression `Math.round(total * bps / 10000)`
existed inline at two persisting call sites (the plan snapshot and the
reservation-terms evidence snapshot the couple is gated on). Both now call one
exported `pctOfTotalPhp`, which rounds to the CENTAVO — 30% of ₱187,501 is
₱56,250.30, not ₱56,250.

**Display sites:** `app/_components/proposal-maker.tsx` (the "Add payment ·
splits the balance" control and the ₱/% toggle both materialised a centavos
figure into a fixed installment under a peso-round — splitting a ₱11,333.35
balance left a stray ₱0.35 auto row), `app/_components/chat-message-stream.tsx`
(the quote decision card), `app/vendor-dashboard/_components/overview-sections.tsx`
(the never-sent draft card), and `app/_components/payment-plan-stepper.tsx`,
which carried its own `maximumFractionDigits: 0` formatter and is the couple's
AND the supplier's installment list. The installment input gained `step="0.01"`
— `step` defaults to 1, so the field declared itself invalid for exactly the
amounts its own controls now produce.

**An absent total no longer renders ₱0:**
`app/vendor-dashboard/booking-fees/page.tsx` and
`app/papic/order/[token]/page.tsx` used `Number(… ?? 0)`, which beats
`formatPhp`'s own `—` branch to the value and turns "we could not read this"
into "this costs nothing". New pure `feeOrderTotalPhp` / `sumFeeOrderTotalsPhp`
return `null`; the hub's banner says it couldn't load the total rather than
silently under-stating the debt, and the Papic order withholds its Copy button
rather than offering `0.00` to paste into a bank app. Honest scope: on a row
that exists this was belt-and-braces (`orders.requested_total_php` is `NOT
NULL`), not a live defect — prod row counts were not measurable this session.

**Guard:** `apps/web/lib/the-installment-keeps-its-centavos.test.ts` — 24 tests,
each sabotage-proven RED. It EXECUTES the helpers and the resolvers rather than
grepping them, renders `PaymentPlanStepper` to HTML on both its mounts (a log
line never changed a pixel), counts the mounts per surface, and pins the two
`centavosToPhp` functions to each other.

**Left rounding deliberately, reported not fixed:** `lib/budget.ts` exports a
SECOND `formatPhp` with `maximumFractionDigits: 0` across 10 importers (bands
and allocation planners), and
`app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx` has a private
`formatPHP` with the same — that file is being rewritten by #5742. Per
`lib/pay-amount.ts`'s docblock precedent, an estimate or band may round; these
need measuring per call site, not a blind flip.

SPEC IMPACT: None. No locked decision, SKU or price changes — this makes stored
and displayed figures match the amounts already in the database.
