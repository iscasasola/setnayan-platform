## 2026-08-05 · feat(admin): a page showing which vendors owe a booking fee

Owner, 2026-08-05: *"vendor must send their booking fee payment before we
activate it. admin will verify it manually if paid via QR until we have a
payment gate."*

The **verifying** already had a home — a vendor's fee arrives as an ordinary
pending payment and is approved on the payments page. What had no home was the
other half of that sentence: **seeing who owes.** A charge sits `pending` from
the moment the vendor confirms the deposit, and nothing anywhere listed those.

`/admin/booking-fees` — total owed, and per row: the vendor, the fee against the
booking it came from, how long it has been waiting, and whether they have
actually sent anything. Rows where proof has arrived get a link straight to the
payment.

🔑 **THIS PAGE DECIDES NOTHING — no buttons, on purpose.** Money is confirmed
where the PROOF is (the payment row with its reference and screenshot). A second
place to approve from would be a second way to get it wrong.

🪤 A failed read says so rather than reporting an empty list — "nobody owes
anything" is a positive claim about money and a reader cannot tell it apart from
the truth.

⚠ Upstream is flag-dark (`NEXT_PUBLIC_BOOKING_FEE_ENABLED`), so until the owner
flips it this page is legitimately empty — **which the empty state says out
loud**, because a switched-off feature and a broken query look identical.

Whether a vendor has "sent proof" uses the same definition as the work list:
non-EMPTY, not merely non-null. The join to their payment goes through the
charge-keyed service key, so it is exact rather than a guess.

SPEC IMPACT: None — DECISION_LOG 2026-08-05 already records the flow and the gap.
