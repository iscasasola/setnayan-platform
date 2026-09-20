# Area click-test checklists — 2026-09-18

One section per area. Each is a numbered list: which account, what to click, what you should see.

---

## AREA-PAPIC — guest photo capture (checked 2026-09-19)

**Before you start.**
- The couple account is **testnayan3** and the event is **rosa-ben** (`2d4f1144-7816-4367-9c99-6ff0f9a6de10`). The supplier account is **testnayan2** (Saysay). Sign in with email and password, **never the Google button**. The Google button logs you in as an `is_internal` account, which passes every paid gate.
- Rosa-ben's pot holds **1 credit**. That is the free grant sized for a second celebration, so the test is enough for exactly **one photo**. Add a credit pack first if you want to shoot more.
- Rosa-ben's date is 2026-10-30. Guest cameras only open on the event day unless the couple opens them early (step 3). **Close them again at the end (step 12).**

**Why production shows 0 guest photos: nothing is broken, nobody has shot yet (measured 2026-09-19).**
- Per-guest credits are **not stored per guest**. `papic_record_guest_capture` works each guest's share out from the pot at the moment of each photo.
- The only per-guest rows are **named** limits (`papic_guest_spend_ceilings`). A couple has to choose those, and none has yet.
- Every function the capture path calls exists in production with matching arguments.
- The pool applies on all 10 events.
- Across all 122 guests on the lists, **no guest has ever accepted the photo terms** (`ugc_terms_accepted_at` is null everywhere). No guest has reached the shutter yet.
- Only two event days have passed with any guests on the list: 1 guest and 2 guests, both test events.
- Step 5 below is the first real end-to-end guest capture.

1. **testnayan3** → rosa-ben → **Studio → Papic** (`/dashboard/<eventId>/studio/papic`). You should see the Papic page with the credits pot. The settings list should include **When guests can shoot: Event day** and **How many credits each guest gets: Off**. Neither row should say "Couldn't load" or "Couldn't check". If one does, a read failed, so reload. Before PR #5675 those rows just disappeared.
2. Open **How many credits each guest gets** → **Turn this on**. The row should now read "N each". The sheet should list rosa-ben's 4 guests with a grey suggested number each. It should **not** say "Your guest list is empty". Turn it back **off** when you are done.
3. Open **When guests can shoot** → **Let guests shoot now**. The row should read **Open now**.
4. Find a guest's personal link on the Guest list: the guest's QR or invite link (`/<slug>?invite=<token>` or `/papic/me/<token>`). Open it in a **private window**, signed out.
5. **As that guest** (private window): open the invitation and tap **Camera** in the bottom bar, or open `/papic/me/<token>` and tap **Open my camera**. You should get the camera and a one-time photo-terms prompt. Accept it, then take **one** photo. It should upload, and the credit count should drop by 1. Refresh `/papic/me/<token>`: the photo is under **Photos of you** only if it is tagged to that guest. Untagged photos show on the couple side.
6. **As that guest**, take a second photo. The pot is now empty, so you should get a clear "out of credits" message. Nothing should look like the photo saved.
7. **testnayan3** → Studio → Papic → **Moderation** (`…/studio/papic/moderation`). The guest's photo should be listed. **Hide** it, then **unhide** it. The page must not say "Photos from your guests will appear here once Papic is on".
8. **As the guest**, on the invitation's photo wall, use **Take it down** on the photo (this sends a request, it does not delete). Then, **as testnayan3**, reload Moderation. The report should appear against that photo.
9. **As the guest**, open `/papic/guest` directly in a *new* private window, so there is no guest cookie. You should see "Open your invitation first." with a button back to Setnayan. There should be no camera.
10. **testnayan3** → **When guests can shoot** → **Only on my event day**. **As the guest**, go back to the invitation and tap **Camera**. You should see **"Guest cameras open on the day"**, which names 2026-10-30, and a **Back to the invitation** button that returns you to rosa-ben. Before PR #5668 this screen had no button at all.
11. **testnayan2** (Saysay) → **On the day → Live → rosa-ben → Papic** (`/vendor-dashboard/on-the-day/live/<eventId>/papic`). The page should show the supplier's portfolio credits as **0 held**. That is correct: ~~production has **no booking-fee charge ever billed** (`booking_fee_charges` is empty)~~ ⚠ **STALE — re-measured 2026-09-20: `booking_fee_charges` holds 2 rows, one of them 83,750 centavos (order `S89O-DW67KBQADN`). Re-measure with `select count(*), max(amount_charged_centavos) from booking_fee_charges`, never trust this line as current**, and credits are granted as 5% of a *paid* booking fee, capped at 1,000, when the admin approves the payment. The ₱500 pack price comes from `vendor_billing_catalog`. If the page quotes a number, it must match that table.
12. **Restore:** **testnayan3** → confirm **When guests can shoot: Event day** and **How many credits each guest gets: Off**. Leave the photo or delete it, whichever you prefer. It is your own test event.

**Still open (owner, not engineering):** none found in this pass. Two things were checked and are *not* defects:
- Supplier Papic credits are 0 because no booking fee has ever been billed.
- `/papic/order/<bad token>` returns a plain 404, the same as any other bad token.

---

## Exact peso on the money path (PR #5744) · 2026-09-20

The owner saw `/vendor-dashboard/booking-fees/7d1a014d-54ec-4e66-b882-03a085f5f7ca` tell him to
send **₱838** for a charge of **₱837.50**. Everything below is the same order
(`S89O-DW67KBQADN`, reference `SN9B7485DD`), so the figure is the SAME on every step or something
is wrong.

1. **testnayan2** (Saysay) → `/vendor-dashboard/booking-fees`. The unpaid row and the
   *"totalling"* line both read **₱837.50**. Neither says ₱838.
2. Open the row. The headline **Amount to send** reads **₱837.50**.
3. Scroll to **Payment instructions**. Its own **Amount to send** reads **₱837.50** — this is the
   second mount, and it is the one that used to disagree silently.
4. Press **Copy** beside it and paste somewhere. It must be **`837.50`** — not `837.5`, not `838`.
5. **Payment log** at the bottom → the logged row reads **₱837.50 · manual**.
6. **Send your payment** → `/pay/SN9B7485DD`. The headline, the caption above the QR and the
   sticky bar all read **₱837.50**, and the QR itself carries `837.50`. The fee page and the QR
   now agree; before this they did not.
7. As an **admin**, `/admin/payments` → find the order. The order total and the payment's
   **Amount** stat both read **₱837.50**. `/admin/money` → the same figure on the ledger row.
8. On `/admin/payments`, paste `Received PHP837.50 from S*** S***` into **Match a bank / GCash
   notification** → the pending fee is offered. Now paste `Received PHP838.00 from J*** D***`
   → **it must NOT be offered.** Before this it was, because the matcher searched for a rounded
   “838” that no row anywhere holds.
9. **A whole-peso order must look exactly as it always did.** Open any ₱2,499 or ₱50 order on
   the same screens → **₱2,499**, **₱50**. No `.00` anywhere.

**Still open (owner, not engineering):**
- ~~The fee hub renders `Number(... ?? 0)`, so an order with no stored total would read **₱0**
  rather than “—”. Not reachable today (every fee order is minted with a total) and the file is
  being rewritten by PR #5737 — flagged, not fixed here.~~
  ✅ **DONE — PR #5756.** Pure `feeOrderTotalPhp` / `sumFeeOrderTotalsPhp` return `null`, and
  the banner says it couldn’t load the total rather than silently under-stating the debt.
  The “not reachable today” half of that line was RIGHT and stays true
  (`orders.requested_total_php` is `NOT NULL`) — but the same shape on
  `app/papic/order/[token]/page.tsx` reads through a PostgREST **embed** the page itself types
  `number | null`, and that one IS reachable. Fixed there too.
- ~~Installment / quote-total surfaces still round centavos to the peso
  (`proposal-maker.tsx`, `chat-message-stream.tsx`, `overview-sections.tsx`). An installment IS
  money a couple is later asked to pay. Left alone because #5737/#5741/#5742 are rewriting all
  three files; worth a follow-up once they land.~~
  ✅ **DONE — PR #5756.** All three fixed, and the sweep found the rounding was **not only on
  the screen**: three further sites rounded an installment **before storing it**
  (`computePlanInstances` → `instances_json` at lock · `rowToDraft`, where a no-op Save rewrote
  the row · `sanitizeAndResolveSchedule`, the server’s own wire sanitizer). Root cause was a
  name collision — two exported `centavosToPhp`, only one of them correct. Fenced by
  `apps/web/lib/the-installment-keeps-its-centavos.test.ts`.
  ⏭ **Still open, flagged not fixed:** `lib/budget.ts` exports a SECOND `formatPhp` with
  `maximumFractionDigits: 0` across 10 importers — the same collision shape, but its callers are
  bands and planners, so it needs measuring per call site rather than a blind flip.

## Money · an installment keeps its centavos (PR #5756, follow-up to #5744)

**As Saysay (testnayan2), supplier:**

1. Open a service's **payment schedule** with a fixed installment that carries centavos
   (e.g. `amount_centavos = 1340050`) → it reads **₱13,400.50**.
2. Press **Save without changing anything**, then reload → still **₱13,400.50**.
   ⚠ Before this PR the no-op Save rewrote the row to ₱13,401 — a read-only visit moved
   the money, with nothing on screen to show it had happened.
3. In a thread, open the **quote maker**. Set an installment to a percent of a
   centavo-bearing total, then tap the **₱/%** toggle → it becomes the exact peso figure
   (e.g. **₱1,999.95**), and the field now accepts centavos when you type into it.
4. Tap **Add payment · splits the balance** on a balance like ₱11,333.35 → the new row
   carries the exact balance and **no stray ₱0.35 "Final balance" row appears**.
5. `/vendor-dashboard` **Today** → a saved-never-sent quote card shows its exact total.
6. `/vendor-dashboard/booking-fees` → the banner and every row read the exact amount.
   Nothing reads **₱0**; a total we could not read now reads **—**, not free.

**As testnayan3, couple:**

7. Open the booked supplier's **workspace** → the **payment plan stepper** lists each
   installment to the centavo. An unresolved percent row says **"20% of total"** or
   **"Amount TBD"** — never **₱0**.
8. In the thread, the **quote decision card** title carries the exact total (it used to
   round the very figure the couple is being asked to accept).

🔑 **What is NOT a bug to report here:** the budget pages and the couple's
supplier-workspace header still round to the peso, deliberately — they are band and
estimate formatters. See PR #5756's "Still rounding, deliberately NOT touched" table;
`lib/budget.ts`'s second `formatPhp` is flagged there as the recommended follow-up.

---

## An approval notice follows the payer (PR #5751) · 2026-09-20

**What was wrong, in your own words:** you approved the ₱837.50 booking fee (order
`S89O-DW67KBQADN`, ref `SN9B7485DD`) and Saysay got two notices and two emails — every one of
them linking to **Ana & Miguel's planning dashboard**. Saysay is the supplier; that is not their
page. They landed on a **404**, so nothing of the couple's was shown — but they were still sent
somewhere that has nothing to do with them.

**Sign in as the SUPPLIER — testnayan2 (Saysay), by email + password, never the Google button.**

1. Open the bell tray. The two notices about `SN9B7485DD` are the OLD ones and still point at the
   couple's dashboard — **old rows are not rewritten**, so expect them to stay wrong. This
   checklist is about the NEXT payment.
2. As **admin**, go to `/admin/payments` and approve any pending **booking-fee** payment (a
   `vendor_booking_fee__…` order — the supplier is the payer).
3. Back as **testnayan2**, open the bell tray → the new *"Payment of … matched"* row.
   **Tap it.** It must land on **`/vendor-dashboard/booking-fees/<order>`** — the supplier's own
   fee page, with the amount and the payment log. **Not** a 404, and **not** any URL containing
   the couple's event id.
4. The *"marked paid"* row, same thing. Tap it → the same fee page.
5. Read that second notice's **body**. It must NOT say *"We'll start work right away."* Setnayan
   starts no work when you settle a fee you owe us; it should read *"Your booking fee is settled
   — nothing further is owed on it."*
6. Check the **email** for both (if `RESEND_API_KEY` is set in Vercel — if it is not, both send
   nothing, silently). The link in the email must be the same fee page, and the **subject must
   carry the centavos**: *"Payment of ₱837.50 matched"*, never ₱838.
7. **Now prove the couple did not lose anything.** Sign in as **testnayan3** (the couple) and have
   an admin approve any payment on one of *their* orders. The notice must still deep-link to
   **`/dashboard/<their event>/orders/<order>`**, exactly as before, and its body must still read
   *"We'll start work right away."*

**What this does not cover (say so if you want it):**
- Notices emitted from anywhere other than the admin payments desk. The waived-booking-fee
  receipt was swept and is already correct (it uses the vendor lane).
- The two notices already sitting in Saysay's tray from 2026-09-20. Rewriting historical
  `notifications.related_url` rows is a **data** change on production, which a session must not
  make — your call whether it is worth doing at all, given both rows are read.
