# AREA-VENDOR — click-test checklist (supplier pages)

Written 2026-09-19 by AREA-VENDOR. Sign in as **testnayan2** (the supplier *Saysay Host and Band*) with
email + password — never the Google button. The test booking is **Rosa & Ben** (couple testnayan3):
contracted, ₱10,170 total, a ₱2,000 GCash deposit the supplier already confirmed, no installment plan.

Each line names the PR that makes it true. Check `/api/health` shows a sha at or after the merge first —
a green PR is not "served yet". #5672 is a migration: it only takes effect after `deploy-prod` has run
`db push`.

## Today (`/vendor-dashboard`)

1. The focal tile reads **"Your next booking is on the books."** — not "shoot". (#5674)
2. The countdown tile is headed **"Next booking"**, shows *Rosa & Ben* and the days until 30 Oct. (#5674)
3. **Confirmed cash-flow** shows a ring at about **20%**, **₱2,000**, *"of ₱10,170 booked"* — not
   "No booked installments yet". (#5672)
4. **Earned · this year** shows **₱2,000** and *"1 payment confirmed"* — not ₱0 / "Paid bookings roll up
   here". Tap it: it opens My Shop → Earnings. (#5680)
5. Reload the page a few times. If it ever renders as raw unstyled text, note the time — it should now
   reload itself once (#5613, S24's); say whether it recovered.

## My Customers (`/vendor-dashboard/customers`)

6. Rosa & Ben's roster row shows **"Balance ₱8,170"** on the right — not "No plan yet". (#5672)
7. "Ongoing payments" (this month) counts the ₱2,000 received. (#5672)
8. Open **Payday** in the sections below: one Rosa & Ben group — **Deposit ₱2,000 · Received** and
   **Balance ₱8,170** under "No due date yet". Nothing is marked overdue. (#5672)

## The customer page (`/vendor-dashboard/clients/2d4f1144-7816-4367-9c99-6ff0f9a6de10`)

9. **Payments** tab: "₱2,000 received of ₱10,170", Deposit · Received, Balance · Not yet, then
   "Nothing waiting on you…" — not "No payments to confirm yet". (#5684, needs #5672 live)
10. **Quote** tab → payment section: the same summary — not "No formal payment schedule on this booking
    yet". (#5684, needs #5672 live)

## My Shop (`/vendor-dashboard/shop`)

11. Tap **Earnings**: Year-to-date **₱2,000**, "1 payment confirmed"; one row *Rosa & Ben · Band / DJ ·
    Paid 2026-09-18 · Deposit · GCash · ₱2,000*. (#5680)
12. Open `/vendor-dashboard/shop#gallery-media` in the address bar: the **Website** panel opens by
    itself and scrolls to *Gallery & media*. (#5690)
13. My Performance → the **"Add recent photos"** tip: its button now says **"Add photos"** and lands on
    the open gallery. (#5690)
14. Website tab (`/vendor-dashboard/website`) → **Edit page**: lands on My Shop with the Website panel
    open. (#5690)
15. On the Website tab, if Saysay is not both verified and listed, the button reads **"Open preview"**
    with an orange line "Only you can see this page…"; once verified and listed it reads **"Open live"**.
    (#5690)
16. Shop → Website editor → About box: the placeholder says "the couples you **work with**". (#5674)

## Still open (not fixed by AREA-VENDOR — see the report)

- Clients section lists booked customers only from pool bookings (a booking agreed without a pool row
  would sit under "In conversation"). Same cause as #5634, different page.
- Bookings list labels rows "New"/"Stale" from chat activity only, never from the booking's status.
- `/vendor-dashboard/bookings` and "View on calendar" link back to the same My Customers page.
- Pinning a review older than the newest 5 does not move it on the public page.
- The explore card omits inclusions/discount/showcase that the shop page and preview show.
- The card-maker intro sample promises an "Exclusive" perk suppliers cannot write, and says "shoot".
- Performance's Pro upsell names "Price-Position", which no page shows.
