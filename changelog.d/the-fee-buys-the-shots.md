## 2026-08-26 · fix(vendor-papic): a supplier's free shots finally scale with the booking fee they paid

Owner, 2026-08-26: *"photographer will buy shots or use their free shots from booking fee to upload their photos… and the owner of the event can view it as well."*

**Most of that was already his own ruling.** On **2026-07-22** he set *"points in proportion to what they paid"* — a supplier's free Papic allowance starts at **50 shots at ₱0** and rises to **200 at a ₱4,000 booking fee**, proportional in between, photos and video throughout.

## 🚨 That ruling was written, unit-tested, and called by nothing

`vendorPapicPointsForBookingFee` has existed since the ruling with **ten passing assertions and ZERO application callers** — only its own tests referenced it. Every supplier kept getting the flat tier number (50, or 70 if founder-comped) **regardless of what they paid**, and **not one test failed**, because a pure function tested in isolation passes whether or not anybody uses it.

🔑 **The same shape as a granted RPC nobody calls and a column with no writer.** It typechecks, its tests are green, and the owner's decision does nothing.

The reason was honest when written — the module's own header says the booking-fee mechanism was *"still a working doc (unbuilt)"*, so there was no fee to scale on. **`booking_fee_charges` shipped since, and nothing was watching for the reason to expire.** This is the wire.

## What shipped

- **`fetchVendorBookingFeePaidPhp`** — what this supplier actually paid for this event. 🔑 **Only `status = 'paid'` counts.** The other statuses are real and none is money we received: `pending`, `failed`, `expired`, `waived_import`, and **`waived_free5`** — the owner's own first-5-sourced-bookings-free rule, which by construction means they paid ₱0 and get the floor. **Reading a waived charge as paid would hand the free five a 200-point allowance.**
- **`allowancePointsFor(tier, feePaid)`** — the resolver, with two rules that are the whole safety of the change:
  - 🔑 **THE FEE CAN ONLY EVER RAISE, NEVER LOWER.** A founder-comped supplier sits on `ltd` (70) having paid nothing; the fee formula alone would hand them **50 and take 20 points away**. Nobody may lose an allowance they already had because a wire got connected. It is a `MAX`, not a replacement.
  - 🔑 **AN UNPROVEN FEE GRANTS NOTHING.** `null` means the read failed — never *"they paid nothing"*. It falls back to the tier's own number. This is the mirror of `fetchVendorPapicPointsSpent`, which already fails **closed** by assuming the budget is exhausted. **Neither invents generosity out of an outage.**
- **Both surfaces read the same three inputs.** `fetchVendorPapicAllowance` feeds the supplier's own on-the-day screen; the capture route decides what is accepted. Wiring only the route would have shown a supplier **"50 shots"** while the route accepted their **125th** — two screens disagreeing with no error anywhere.

🔢 **Safe by arithmetic today:** the booking fee is flag-dark and production holds **zero** fee charges, so every supplier reads `paid = ₱0` → the 50 floor → `MAX(50, 50)` = **exactly today's behaviour**. Nothing changes until the owner flips the fee on.

## 🛡 Guard `lib/the-fee-reaches-the-allowance.test.ts` — it does NOT check arithmetic

`vendor-papic-tier.test.ts` does that (5 new tests, including the comped-supplier regression). This guard asks the only question those tests cannot: **does the running product actually consult it?** Six rules, with an anti-vacuum floor.

**Mutations**, counts printed before → after: route stops reading the fee (1→0) 🔴 · fee read then dropped before `canCapture` (1→0) 🔴 · fee allowed to LOWER an allowance (1→0) 🔴 · an unread fee becomes a `0` (1→0) 🔴 · the two surfaces come apart (1→0) 🔴. Green on both clean sides.

## ⏭ Not in this PR, deliberately

- **A supplier BUYING extra shots.** The owner asked for it on 2026-08-26, but he **dropped it himself on 2026-07-18** (*"not allow upgrade +50 if it is difficult"*). Reversing an owner lock is his call to state explicitly, not something to infer from a follow-up sentence.
- **Uploading finished work** (vs capturing live on the day). Same machinery as the couple's upload — see `WHATS_NEXT_Papic_Uploads_Are_A_Way_In_2026-08-26.md` § 2. **Do not write a second capture path.**
- 🔴 The whole supplier lane is still **switched off** behind the DPO ruling (`isVendorPapicCaptureEnabled`, route 403s). This change is inert until that opens.

**SPEC IMPACT:** None — it connects an existing owner ruling (2026-07-22) that had never been wired.
