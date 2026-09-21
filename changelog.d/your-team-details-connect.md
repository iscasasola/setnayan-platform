## 2026-09-21 · feat(your-team): tap a self-added supplier for its details; [Connect] gives them a portal

Owner, across one exchange:
*"if the info is incomplete. allow us to complete it. so on the your team."* ·
*"with this we have the power to update [and] improve the purchase details for
that vendor. create a way for the user to give the vendor a portal to connect
this to their new account"* · *"pressing on the card will open the details
then. until there is a vendor"* · *"since clicking a card will open the
vendor-user connection"*. Asked directly, he chose **the same sheet, pre-filled**
for Details, and to **keep "Add to build" before Lock**.

**The card, for a supplier the couple added themselves:**
- **Tap → details.** The same one-screen sheet used to add them, pre-filled
  (`loadSelfAddedSupplier`) and saved through `updateSelfAddedSupplier`. One form
  to add a supplier; the same one to complete them — e.g. a price that was never
  recorded.
- **[Connect] · Add to build · [Lock]** while deciding; **[Connect]** once locked.
- The moment the supplier claims an account, the card goes back to what every
  vendor card does — the vendor–user connection. One value, `actions.connect`,
  decides both the button and the tap, so the two cannot disagree, and flag-OFF
  renders byte-identically.

**Connect is the one-shot QR, made permanent.** The claim QR + link lived only
in the Add-manually sheet's post-save step — one render, gone when the sheet
closed; that is what the owner hit on 2026-09-20. It is now
`SupplierConnectPanel`, mounted by that step AND by [Connect]. Opening [Connect]
only **reads** (`readSupplierInvite`); the only thing that mints a link is the
panel's own "Create their link" button. Looking must not create a row.

**Found and fixed on the way:**

- 🔴 **Setting a price on the bench card reset the supplier's crew settings.**
  `updateVendorCosts` rewrites every costing column per call, reading an absent
  field as null/false. The bench price control (#5777) echoed transport and food
  back but not crew, so every save set `crew_size` null and `crew_meal_covered`
  false — erasing "the event feeds this crew" and the food rule that depends on
  it. Fixed once at the writer: a `price_only` mode that touches only
  `total_cost_php`, used by the bench control and both sheets. The echo plumbing
  it made dead (4 files) is removed rather than left under a docblock that would
  have become false.
- 🔴 **Saving the Details sheet would have erased the payment-method note.** The
  contact writer always wrote `payment_method_note`; the sheet has no such field.
  Each column is now written only when the posting form carries it. Same for the
  new name and map pin.
- 🔴 **[Connect] would never have appeared on a LOCKED self-added card.** The rail
  draws the action row only if "any action?" — a check that predated `connect`.
  A locked self-added supplier's ONLY action is Connect, so the row was judged
  empty while every resolver test passed. Found reading the render path, before
  shipping.
- **The payment plan now keeps the rule the couple typed.** `instances_json`
  stored resolved dates only, so "7 days before the event" could not be pre-filled
  back into the sheet. Each instance now carries its `authored` rule (JSONB; every
  existing reader ignores unknown fields). A legacy instance comes back as its
  peso amount with the rule left blank — never a rule guessed from a date.

**Tests changed, honestly.** Four existing resolver tests needed the new field.
Three were shape-only. The fourth — "a booked OFF-PLATFORM pick still shows
nothing" — protected a real property: never offer *Inquire* to a supplier who
cannot be messaged. That is still asserted (`inquiry: null`); only its "shows
nothing" claim was retired, by owner decision, and the test says so.

**Guards:** `the-self-added-card-opens-its-details.test.ts` (Connect counts as an
action · the button renders · the tap opens the sheet in edit mode · modified
clicks still open the full page · opening Connect only reads) and
`price-only-leaves-the-rest-alone.test.ts`. Four sabotages, each red.
The `agreed-total` roster count for `vendors/actions.ts` moved 13 → 21 with the
reason recorded on the entry: seven are writes, and the eighth pre-fills the
editable Price field with the HEADLINE on purpose — pre-filling headline +
changes would count the changes twice when saved back.

SPEC IMPACT: `DECISION_LOG.md` — (k) on Your Team, a self-added supplier's card
opens its details on tap until they have an account, and carries [Connect] at
every status; "Add to build" stays before Lock (owner, 2026-09-21).
