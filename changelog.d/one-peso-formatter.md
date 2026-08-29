## 2026-08-29 · refactor(pay): one amount, one place — and it is the QR's own digits

Follow-up to [#4995](https://github.com/iscasasola/setnayan-platform/pull/4995).
That fix repaired the destroyed peso sign on `/pay/[reference]`; this closes the
reason only *half* the page was affected.

**What it was.** The payment page shows the amount in **four** places across
**two** files — the headline under *You're paying for*, the caption above the QR,
the "type this yourself" line for the bank rail, and the sticky bar. Each file
carried its own private `peso()`. When one file was re-saved in the wrong
encoding, its peso sign was destroyed and the other's was not, so the same
amount on the same screen disagreed with itself. A rule written twice is a rule
that can disagree with itself.

Both now call `payAmount` from the new `apps/web/lib/pay-amount.ts`. All five
call sites converted; neither file keeps a local formatter.

**The format is pinned to the QR, and the digits are now the QR's own.**
`mintOrderQr` writes EMV tag 54 as `amountPhp.toFixed(2)`. The page's promise is
*"the amount is already in it"*, so `payAmount` starts from that exact expression
and only adds thousands separators — agreement is structural, not coincidental.

🚨 **That mattered more than expected.** `Intl.NumberFormat` rounds the decimal
value while `toFixed` rounds the binary double, so they part company on a
half-centavo: **`2.675` is `2.68` to Intl and `2.67` to toFixed**; `1.005` is
`1.01` and `1.00`. The old helpers used Intl, so the printed figure could have
sat one centavo away from the code beside it, on a screen headed *pay this exact
amount*. ⚠ **Unreachable today and not presented as a live defect** —
`orders.amount_php` is `NUMERIC(12,2)` and both branches of `orderGrossOwed`
round to 2dp. This closes the question rather than fixing a symptom.

**Nothing a person reads changes.** All 33 catalogue prices, ladder rungs and
realistic shapes render byte-identically before and after — verified by
comparing the old expression against the new one, not by inspection.

**New guard: `apps/web/app/pay/the-figure-and-the-qr-agree.test.ts`.** It mints a
real QR from the production GCash fixture, parses tag 54 back out, and asserts
the digits on screen equal the digits in the code — a computed comparison, not a
source grep.

Six mutations, occurrence count printed before → after, **all red**: drop the
decimals · format with Intl instead of the QR's expression · destroy the peso
sign as the encoding bug did · the page grows its own formatter back · the panel
loses one of its four call sites · the shared import is removed.

🪤 **Two of those were GREEN on the first cut and were caught only by measuring.**
The Intl mutation survived because no test input had *more* than two decimals, so
capping at 2 vs 3 made no observable difference. The lost-call-site mutation
survived because `assert.match(src, /payAmount\(/)` is a **file-level** check and
three of four call sites remained — the documented file-level-count trap. Fixed
with a three-decimal input and a per-file floor on the call count.

⛔ **A "the raw number is not printed" assertion was written, fired twice on
untouched code, and was deleted** rather than tuned: no regex separates a
rendered figure from `value={amountPhp}` on the hidden input or from
`amountPhp={amountPhp}` as a prop. The floor is measured to catch what it was
reaching for.

⚠ **`app/pay/waiting-is-the-whole-page.test.ts` was updated, not weakened** — it
asserted the amount still renders on the waiting screen by matching
`peso(payable.amountPhp)`. Same intent, same rendered figure, new name.

### Reported, deliberately NOT changed

There are **eleven** `peso()` helpers across the app, in **six distinct
implementations**. Measured, not estimated: for `₱49.50` those six produce
**three different strings** — `₱50` (price bands, price position, credit
warning, Papic tier copy, llms.txt) · `₱49.50` (payment asks) · `₱49.5` (reuse
bookings). Collapsing them would silently change what those screens
display — a price band rounding to the peso and a payment ask showing `—` for an
absent figure are both deliberate. `pay-amount.ts` is scoped to the payment page,
where the QR decides the format, and its docblock says so. **Whether the rest
should be unified is a product call, not a refactor.**

SPEC IMPACT: None.
