## 2026-08-20 · fix(papic): the buy banner stops promising an email that does not exist

Every Papic buy path in the studio told the buyer *"Payment instructions are on the
way; your cameras activate once the Setnayan team confirms your transfer."*

**No such message exists.** There is no `payment_instructions` notification type in
the app — `lib/notification-emit.ts` records that in its own comment — and none of
these actions touches an email path. So a person who had just agreed to pay was sent
away to wait for something that was never coming. It is the same defect the owner hit
in onboarding the same day, in three more places a person can actually reach.

The instructions are not on the way; they are one tap away. The banner now links to
the order's own page — total, reference, accounts, and the form for telling us the
transfer is made — and every buy path carries the order id so the link lands on the
right bill rather than a list.

**And it repaired the guard that should have noticed.** `outcomes-are-shown.test.ts`
matched redirect params with a character class excluding `\n`, while these redirects
are template literals wrapped across lines — so each multi-line redirect contributed
only its FIRST parameter. Measured: 16 keys found, three real outcomes missed
(`papic_ref`, `papic_amount`, `papic_order`). Two of the three had been written into
the file's exemption list, which reads as a considered decision but was never doing
anything, because the scan had not seen them. A blind spot became a lie the moment it
was recorded as an intentional exclusion. The scan now spans lines, its vacuity floor
is a real number (19, not a comfortable 15 that the blindness cleared), and the
exemption list is pinned so widening it is a reviewed edit.

SPEC IMPACT: None.
