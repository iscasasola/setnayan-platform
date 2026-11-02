## 2026-08-20 · fix(receipts): a receipt no longer declares a tax that was never charged

Setnayan is **not VAT-registered** (sole proprietorship, 8% flat; VAT only at the
₱3M tripwire), and the configured rate is **0**. Every receipt it was about to
issue said otherwise, in two different ways on the same document.

**(a) The customer receipt contradicted itself.** The receipt writer never passed
`vat_rate_pct`, so the column fell to its **DEFAULT of 12.00** — on a receipt whose
VAT amount was correctly ₱0.00. The printed document read **"VAT @ 12% · ₱0.00"**.

**(b) The vendor receipt declared a real tax we cannot collect.** The vendor branch
called `computeVatFromGross` with **no rate at all**, and that argument defaulted to
12 — so a ₱999 receipt stated roughly **₱107 of VAT**, on a document the vendor
hands to their own accountant.

🔑 **NOTHING WOULD HAVE COMPLAINED.** The table's CHECK constraint asserts only
`pre_vat + vat ≈ gross`; it never cross-checks the **rate** against the amount. The
row inserts cleanly and is wrong — **accepted, not rejected**. That is the quieter
cousin of this repo's phantom column / enum value / RPC argument family: there the
query is refused, here it succeeds and lies.

🔑 **AND HALF OF THIS WAS ALREADY FIXED ONCE.** `computeVatFromBase` was made
rate-required months ago, with a comment explaining exactly why. Its mirror
`computeVatFromGross` kept its 12% default, and the writer kept omitting the column.
**Fixing one function is not fixing the rule** — which is why the guard is written
against the WRITER and the RENDERER, not against one helper.

**Fixed:** one rate resolved once from settings and used by both branches **and
written onto the row**; `computeVatFromGross`'s rate made required, matching its
twin; and the printed receipt shows **no VAT line at all** when no VAT was charged —
`"VAT @ 0% · ₱0.00"` is not a harmless zero, it tells the reader a tax was assessed.

⚖ **Driven by the rate stored ON THE ROW, never by a constant.** The day the ₱3M
threshold is crossed the owner sets one number in settings, new receipts carry it,
and the VAT line reappears by itself — while old receipts keep printing what they
were actually issued at, which is what a receipt is for.

**Also, on the same surface — the payment screen now says whose account it is.** A
buyer told to pay "Setnayan" and then shown a personal name on the transfer screen
has been shown the exact shape of a scam. Nothing is wrong (a sole proprietorship's
accounts are legally in the proprietor's name) — nothing *said* so. The line renders
**only when the account name is not already the business name**, compared on words
rather than characters, so it disappears by itself the day a business account
replaces it.

Nobody had met any of this only because **no receipt has ever been generated** — 0
receipts and 0 payments in production. Proven from the code, the column default and
the constraint definition read out of prod, not from a document.

Tests — 5 in `lib/the-receipt-tells-the-truth.test.ts` plus 2 added to
`lib/receipts.test.ts`. Six mutations, each confirmed to have LANDED by occurrence
count: dropping the column from the insert (1→0) 🔴 · hardcoding 12 there (1→0) 🔴 ·
calling the back-out with no rate (1→0) 🔴 · printing the VAT line unconditionally
(2→0) 🔴 · restoring the helper's 12% default 🔴 · baseline 🟢.

🪤 **That fifth mutation passed on its first run, and it exposed the GUARD, not the
code.** Restoring `vatRatePct: number = DEFAULT_VAT_RATE_PCT` left everything green —
correctly, because the one money path passes a rate explicitly, so the default is
unreachable *from there*. But an unreachable default is precisely what this bug was
for months before a second call site found it. **The property being defended is a
property of the SIGNATURE, not of today's callers**, so it is now asserted as one.

Full suite 8925 passing, typecheck exit 0, lint clean.

SPEC IMPACT: None — this makes the receipt match the already-recorded tax posture
(non-VAT registered, configured rate 0). No pricing or tax decision changes.
