# Click test — supplier Earnings (2026-09-21)

Sign in as **testnayan2 (Saysay)** by email + password — never the Google button
(`is_internal` passes every paid gate and hides real behaviour).

1. Open `/vendor-dashboard/earnings`.
   **Expect:** "Year-to-date" reads **₱5,350** with the help line "2 payments
   confirmed"; "This month" reads **₱5,350 · 2 bookings** (both deposits were
   confirmed in September 2026). Before this PR it read ₱0.
2. Scroll to **Last 12 months**.
   **Expect:** Sep 2026 shows ₱5,350 / 2 orders; the other eleven months show ₱0
   and the "No earnings yet" placeholder is NOT shown.
3. Scroll to the payment list at the bottom.
   **Expect:** two rows — *Ana & Miguel · ₱3,350 · Deposit · GCash · paid
   2026-09-20* and *Rosa & Ben · ₱2,000 · Deposit · GCash · paid 2026-09-18*,
   newest first. Each says "You keep 100%".
4. Confirm **no other shop's money is on the page.** There should be no row for a
   couple Saysay is not booked with. (Both prod shops sit in different categories
   today, so this is the guard's job, not the eye's — see the two-shops-in-one-
   category test.)
5. Open `/vendor-dashboard` (the Today page) and find the **"Earned · this year"**
   tile. **Expect:** the same ₱5,350. If the two screens ever disagree, one of
   them stopped using `fetchVendorLedgerEarnings` — say so rather than picking a
   number.
6. **The failure state** (engineering check, not a click): with the ledger read
   refused, the page must show "We couldn't load your earnings ledger", two
   em-dashes instead of the money tiles, and "We couldn't load your payment
   ledger" where the list is — and must still render the payouts section, the
   booking-fee bills and the verification chip. It must NEVER show ₱0 or "No
   confirmed payments yet."

## Owner questions from this session

None. The two defects named in the dispatch (`service_key` ↔ `category` matching,
and platform-wide scope) were already fixed and merged on `origin/main` as PR
**#5680** on 2026-09-19 — re-measured today. What was left was the third one: the
page had no honest failure branch, and its own honesty guard could not see a
silent empty.
