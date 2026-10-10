## 2026-10-10 · feat(suppliers): "Add your own supplier" — built as a pair (the couple's side and the supplier's side of one link)

Owner, 2026-10-10: *"the event suppliers page is interlinked to the supplier dashboard"* — every
step is built and checked on both sides. Contract: `prototypes/suppliers_add_your_own_2026-10-10.html`
(cases A–E). Rulings: `SUPPLIERS_OWNER_RULINGS_2026-10-10.md`. Nothing here is a new mechanism; one
new sheet is composed from shipped parts.

**No money code, no migration.** `lib/booking-fee-gate.ts`, its SQL mirror, `collectBookingFeeAtLock`
and `supabase/migrations/` are untouched. Fee rule B and the price check are the next step.

### The couple's side

- **The first add is a four-step walk** — Name · What they do · Contact · Their link
  (`add-your-own-walk.tsx`, words in `lib/add-your-own.ts`). Price and "already booked?" are not
  steps (owner: "out"). Typing a name searches Setnayan (`searchMarketplaceVendorsByName`); a match
  offers **Yes — Inquire**, which is the shipped pick-then-ask behind one button
  (`attachMarketplaceVendorToCategory` → `contactShortlistVendor`) — the real shop lands under the
  category waiting for its quote, never a hand-made twin. **Not them?** continues by hand. One
  contact is enough (who they talk to, or their mobile). The last step is their claim link — QR,
  link, **Download · Copy link** — with the note that this is the couple's record, not a booking.
  A name typed in the thumb row's box rides into step 1. The pre-replan bench keeps the
  eight-field sheet.
- **Editing is the one form** (`NewManualVendorModal`, edit mode), now with the pill "Your record,
  not a booking" and the claim link at its foot (read first; making a link is its own button).
- **The row says where the link stands** (`lib/supplier-invite-status.ts`): "Link sent 3 days ago ·
  no answer yet" · "They said they are not this supplier · your link is closed" · "Your link ran
  out with no answer" · "Now on Setnayan — their own card". A failed read says "Could not check
  their link just now" instead of looking like no link. `vendor_invites` records no "opened", so
  the row never claims one. `fetchLatestInvitesByVendorIds` finally has a caller.
- `SupplierConnectPanel` carries the approved words everywhere it is mounted; the line that
  promised the price "carries over … nothing is re-entered" is gone.

### The link and the supplier's side

- **A couple's own link names the couple and the date** (owner: "3 yes" — supersedes the
  2026-05-19 identity-only lock for a couple's own link, for these two facts). The shared link
  (`auto_share_link`) loaded neither and told the supplier they had been "locked in"; it now reads
  "**Ana & Paolo** invited you … for their wedding on **Fri, Dec 18, 2026**", with a vague date
  shown as vague. Price, what's included and the plan still wait until they join.
- **The claimed couple is a customer, not a new inquiry** (`seatClaimedCoupleAsCustomer`): after
  the link is made, the thread is opened with the same two writes Accept makes, on the supplier's
  own session. Fail-soft: a refusal leaves an inquiry they can accept by hand.
- **A hand-typed record does not hold the date; it reads "asking"** (`askingDates`): the supplier's
  calendar counts a claimed record's date as one more "asking" until the supplier's own yes. Nothing
  is written to any calendar.
- **On the couple-seeded first card the price box waits** for the photo and what's included
  (`lib/price-waits.ts`); the recorded price stays shown. Every other card is unchanged.

### Named, not built

- `vendor_invites.opened_at` (so the row can say opened / not opened), a `notification_type` value
  for a declined link (the bell), `invite_claim` in the inquiry-source CHECK, the leak-match column
  and the tolerance setting — all in `ADD-YOUR-OWN-PLAN.md`, each waiting on a word.
- A booking the couple marked by hand before the supplier joined has no "Agree" on the supplier's
  side: it reads "asking" with nothing to press. Needs an owner decision.

SPEC IMPACT: None applied in this change — it builds to `SUPPLIERS_OWNER_RULINGS_2026-10-10.md` and
the DECISION_LOG row "SUPPLIERS ⇄ SUPPLIER DASHBOARD ARE ONE CONNECTION" as written. One row for the
controller to add when this merges: the 2026-09-20 one-screen "Add manually" sheet stays for
editing; the first add is the four-step walk.
