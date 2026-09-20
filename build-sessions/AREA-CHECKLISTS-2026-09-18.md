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

  three files; worth a follow-up once they land.

---

## Money formatting · one peso formatter (PR: `claude/one-money-formatter`, 2026-09-20)

**What changed, in one line:** `formatPhp` was defined **four** times in two behaviours and
`formatCentavosPhp` **three** times in two behaviours, so a screen printed `₱837.50` or `₱838`
depending on which module its import line named. There is now exactly one definition of each,
in `apps/web/lib/php.ts`.

🔑 **Almost every screen below must look EXACTLY as it always did.** The exact and the rounding
formatter render a whole-peso figure to the same bytes — `₱125,000` either way — so if you see a
changed number anywhere on a whole-peso row, that is a bug, not the fix. They differ only where
centavos exist, and measured on 2026-09-20 there are **no centavo-bearing rows** in the budget or
package tables yet. The one live one is the owner's ₱837.50 booking fee (already covered above).

### As the couple (`testnayan1` / `testnayan3`, email + password — never the Google button)

1. `/dashboard/<event>/budget` → **Target · Agreed · Paid · Owed** and the per-vendor ledger.
   Every figure must read exactly as before. The ledger columns are the ones to scan.
2. Same page → the **allocation planner** (drag a category). Totals, cushion, "typical range"
   and the Save / Suggested / Splurge chips must read exactly as before. These now go through
   `formatPhpRounded`, which is the same function the page always had — just renamed and
   documented, because these are INTEGER columns, not money.
3. `/dashboard/<event>/budget` → **Costs with no supplier**. Add a cost of **₱837.50**
   (this is the one place a couple can type centavos today — `parseCostAmountPhp` keeps 2dp).
   **It must read back ₱837.50.** Before this it read **₱838**.
4. `/dashboard/<event>/vendors/<vendor>` → the itemization card: Budget / Paid / Balance,
   every line item, every logged payment. Unchanged.
5. A supplier chat thread → a **quote total**, an **amendment delta** and a **logged payment**
   in the decision strip. An amendment of −₱1,837.50 now reads **−₱1,837.50**; it used to read
   **−₱1,837.5** (one decimal — a bare `toLocaleString`).
6. `/vendor/lock/<token>` (the lock page) → a **percent installment**. 30% of a ₱187,501 booking
   now reads **₱56,250.30**; it used to read **₱56,250**.
7. `/dashboard/<event>/vendors/packages/<booking>` and the package **lock modal** → "Total
   package", every `+₱` upgrade and the consumable budget. Unchanged today (all whole pesos),
   but one centavo used to render as **₱1** here.
8. `/explore`, a vendor's public page, and "Starts at …" copy anywhere → unchanged.

### As the supplier (`testnayan2`)

9. `/vendor-dashboard/payday` → Expected / Received / Owed / Overdue, and each installment row.
10. `/vendor-dashboard/earnings` and `/vendor-dashboard/customers` → totals and balances.
11. `/vendor-dashboard` overview → the **quote draft** card's amount. Unchanged today.

### As admin

12. `/admin/payouts`, `/admin/booking-fees`, `/admin/pricing` → every figure unchanged.
    Admin pricing rows used to round a `.50` SKU price away; nothing sets one today.

**Still open (owner, not engineering):**
- `lib/supplies/pricing.ts#formatRetailLabel` rounds a **price a customer pays**, on the strength
  of a comment ("retail is always rounded to the nearest peso") that is a habit, not a database
  constraint. All 43 live `service_catalog` rows are whole pesos, so it is accurate today.
  **If you ever set a `.50` price on a supplies SKU, that label is where it will disappear.**
  Flagged in the file rather than changed, because it is a pricing decision.
- `centavosToPhp` / `phpToCentavos` are still defined twice (`lib/payouts.ts` and
  `lib/vendor-service-payment-schedules.ts`). Open PR #5756 makes the two agree; folding them
  into `lib/php.ts` is a ~7-file rename left for its own PR. Both are in the guard's baseline,
  which can only shrink.
