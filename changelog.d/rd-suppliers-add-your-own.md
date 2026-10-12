## 2026-10-12 · feat(suppliers): "Add your own" and the supplier's half of its link, built as a pair — with fee rule B

Owner, 2026-10-10: *"the event suppliers page is interlinked to the supplier dashboard"* — every step is
built on both sides. Contract: `prototypes/suppliers_add_your_own_2026-10-10.html` (cases A–E); rulings
`SUPPLIERS_OWNER_RULINGS_2026-10-10.md`, DECISION_LOG 2026-10-10 and 2026-10-12 (the last open approvals;
"APPROVE ALL" look calls; "APPROVE ALL" booking-fee answers 8, 10, 11). Stacked on `rd/suppliers-page`.
Carries the 2026-10-10 WIP of the same task (branch `rd/suppliers-add-your-own`, never pushed), finished.

### The couple's side
- **The first add is a four-step walk** — Name · What they do · Contact · Their link
  (`add-your-own-walk.tsx`, words in `lib/add-your-own.ts`) on the templates: the house Sheet, Form rows
  (the first box already open), ONE PickMenu, ActionButton, the step line in the accent token. Price and
  "already booked?" are not steps. Typing a name searches Setnayan; **Yes — Inquire** puts the real shop
  under the category and sends the shipped Ask for a quote; **Not them?** continues by hand.
- **The leak line**: a name that matches a shop on this event that already quoted reads "This looks like
  X, who already sent you a quote" with **See their quote** — the prototype's card WITHOUT its fee clause.
- **One write per press**: Add is ONE call (`addManualSupplier` makes the record, runs the leak check and
  returns their link, `with_link=1`, `answer_in_place=1`); the page refreshes once, behind the link step.
- **The record sheet, the link panel, Connect, the plan rows, Also covers and the address** moved onto the
  templates (Sheet · Form rows posting by `fieldName` · PickMenu, Also covers is the checkmark dropdown ·
  ActionButton), no boxes round what is only read, dark tokens throughout.
- **The row says where the link stands**: "Link sent 3 days ago · not opened yet" · "They opened your
  link · not joined yet" · declined · ran out · joined. **A decline tells the couple in the app**
  (`vendor_invite_declined`, not emailed).
- **No couple screen says anything about a fee** (`a-brought-supplier-hears-no-fee.test.ts`).

### The supplier's side
- The couple's own link names **who invited them (first names) and the date**; the door is rows and
  dividers with the one ActionButton. The link remembers the first time it was opened (`first_opened_at`).
- The claimed couple is a **customer** (the thread opened as Accept would); the hand-typed record holds
  **nothing** on their calendar — it reads **"asking"**; on the couple-seeded first card **the price box
  waits** for the photo and what's included.
- **Their bill says why** a booking the couple typed in carries a fee: "Setnayan introduced this couple to
  you on <date>" (`booking_fee_introduced_on`) — the supplier's bill only.

### The fee (owner "APPROVE ALL" 2026-10-12, answer 8; audit items 9–10)
- `booking_fee_attribution_for` reads the three recorded facts before the booking — a chat started from
  Setnayan, a save from Find, a profile view for this event — for every booking; a row the supplier
  brought is never sourced. A couple's hand-typed record counts only when the shop claimed it or the
  server matched it (`event_manual_vendors.leak_match_vendor_profile_id`, server-stamped, guarded).
  "Not them?" cancels only the name match. Mirrored in `lib/booking-fee-gate.ts`
  `bookingFeeAttributionFromFacts`; one case table drives both (`lib/fee-rule-b-cases.ts`, db drift test).
- The 10 % price match (`platform_settings.fee_leak_price_tolerance` = 0.10, the owner's number) compares
  against THIS couple's quotes for this event in that category (`vendor_proposals`).
- Stamps fixed: a save from Find / an onboarding venue pick / the wizard's pick are `host_marketplace_search`
  (B7, B6); a shortlist ask of a shop the supplier brought keeps no source (B3).
- Migrations `20271267252894_add_your_own_leak_match_and_link_opened` and
  `20271268117342_notification_type_vendor_invite_declined` — never applied by hand. Ugat joint J53.

SPEC IMPACT: None applied — this implements DECISION_LOG 2026-10-10 / 2026-10-12 as written. For the
controller: (1) the first add is the four-step walk, editing stays the one form; (2) audit B4, B8 and the
budget-line door (B10) are not in this PR.

