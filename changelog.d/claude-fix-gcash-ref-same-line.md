## 2026-11-17 · fix(payments): read the reference on GCash receipts that print the date on the same line

GCash receipts print `Ref No. 4012345678901 Nov 16, 2026 8:10 PM` on one line.
`scanPaymentProof` (`apps/web/lib/payment-proof-scan.ts`) required the reference to end
the line, so it read NO reference from every GCash-layout receipt, and nothing showed it.
The reference now also ends at a word of letters only, a time, a numeric date, or a
character no reference contains. The 6–32 char bound and the ≥5-digit rule are unchanged,
so prose is still refused. New tests use the real layouts (plain and grouped `0043 457 367694`,
and the InstaPay invoice). All four fail on the old code.

SPEC IMPACT: None
