# AREA-COUPLE — click-test checklist (the host's own pages)

Written 2026-09-19 by AREA-COUPLE. Sign in by **email + password**, never the Google button
(an internal account passes every paid gate and hides real behaviour). Each item says which
account, where to click, and what you should see. Items marked **(after #NNNN)** only hold once
that PR is live — check `https://www.setnayan.com/api/health` `version` against `origin/main`.

## A · After the lock — the deposit step (rosa-ben, testnayan3)

1. As **testnayan3**, open Rosa & Ben → **Your Team** (Vendors). Saysay Host and Band shows under
   *Locked in*. Under it: **"Deposit confirmed"** (its deposit is recorded and Saysay confirmed it).
2. Tiles at the top: **Locked ₱10,170** beside **Still to lock ₱0** — not "In build ₱0" (S19, #5599).
3. On a phone-width window, the floating chip at the bottom reads **"1 locked · 0 to lock · …"** —
   not "0 in build" **(after #5671)**.
4. Tap Saysay → its workspace. The header says **Paid so far ₱2,000**. Scroll to the costs card:
   the row under Total reads **"Paid so far ₱2,000"** — not "Deposit paid —" **(after #5670)**.
5. Bottom of the workspace: the action is **"Raise a dispute"**, not "Cancel booking" — money has
   moved, so a cancel would only be refused **(after #5670)**.
6. For a fresh lock (any contracted supplier with no deposit yet): the locked card on Your Team
   shows **"Next: pay your deposit to hold the date."** and a **Pay your deposit** button. Tap it →
   the workspace deposit card shows **1 · Pay {supplier}** (their GCash/bank methods, with the
   "Setnayan never holds your money" line) and then **2 · Record it here** with a
   **Record deposit** button. That button is the "record that I paid" step; paying happens in 1.

## B · A birthday / debut is not a wedding (new event, testnayan1)

There is no non-wedding test event with vendors. As **testnayan1**, create a **Birthday** (or
Debut) from the launcher, then:

7. **Schedule → Preparation** with nothing added: the empty state says **"Set your event date
   first…"** (or "…up to your event day"), never "wedding" **(after #5676)**.
8. **Schedule → Event day**: the seeded first block "Guest arrival" shows the type **Arrival**,
   not "Pre-ceremony"; the **Add a block → Type** picker lists **Arrival** too **(after #5681)**.
9. **Overview**: the schedule preview shows "Arrival" beside Guest arrival **(after #5681)**.
10. **Guests → Mind map** (desktop "Map" view): the centre node reads **"Your event"**, not
    "Your wedding" **(after #5676)**.
11. Open any guest → the role field is labelled **"Role"**, not "Role in wedding" **(after #5676)**.
12. **Your Team** → lock a supplier whose lock also fixes the date: the confirmation says
    **"This locks your date."** and the toast **"Your date is now locked in."** (weddings see the
    same neutral words now) **(after #5676)**.
13. Add an off-platform supplier with no Setnayan account → its workspace → "Send … this link":
    the share text reads **"…for our event"** **(after #5676)**.
14. Signed out, open **https://www.setnayan.com/movie-night** (a public `date` event): the
    programme's first row reads **ARRIVAL · Guest arrival** **(after #5681)**.

## C · Still open — for the owner, not fixed here

- `lib/wedding-essentials.ts` links "Set date" to `/dashboard/{id}/settings`, a route that does
  not exist. Nothing renders that list today (only a test imports it), so no person can reach
  the dead link — flagged, not fixed.
- The couple's "Record deposit" stores the amount in the payment log, never in
  `event_vendors.deposit_paid_php`. #5670 made the workspace read the log; any OTHER reader of
  `deposit_paid_php` still sees an empty deposit after a recorded one.
