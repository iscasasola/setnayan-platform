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
11. **testnayan2** (Saysay) → **On the day → Live → rosa-ben → Papic** (`/vendor-dashboard/on-the-day/live/<eventId>/papic`). The page should show the supplier's portfolio credits as **0 held**. That is correct: production has **no booking-fee charge ever billed** (`booking_fee_charges` is empty), and credits are granted as 5% of a *paid* booking fee, capped at 1,000, when the admin approves the payment. The ₱500 pack price comes from `vendor_billing_catalog`. If the page quotes a number, it must match that table.
12. **Restore:** **testnayan3** → confirm **When guests can shoot: Event day** and **How many credits each guest gets: Off**. Leave the photo or delete it, whichever you prefer. It is your own test event.

**Still open (owner, not engineering):** none found in this pass. Two things were checked and are *not* defects:
- Supplier Papic credits are 0 because no booking fee has ever been billed.
- `/papic/order/<bad token>` returns a plain 404, the same as any other bad token.
