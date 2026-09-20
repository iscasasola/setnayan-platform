## 2026-09-20 · feat(self-added-suppliers): an address, a price you can type, and a claim link that is still there tomorrow

Four defects the owner hit in one sitting, all the same disease: a supplier the
couple added themselves is routed through machinery built for marketplace
suppliers, so it offers actions with no recipient and hides the ones that work.

**1. A self-added venue had nowhere to put its address.**
`event_manual_vendors` captured business_name + contact_person +
contact_number and nothing else. For a florist that is the whole truth; for the
two categories that ARE a place it is not — the ceremony and reception venues
are where every guest is sent. New `event_manual_vendors.address` (nullable in
SQL, with a not-blank CHECK), REQUIRED at the application layer for
`venue` and `religious_venue` only, per the owner's call: the field is there for
everyone, the demand is on the two that are a place. The rule is ONE pure
module — `lib/manual-venue-address.ts` — that the add modal, `createManualVendor`,
`updateManualVendor` and the new workspace editor all import, with
`manual-venue-address.test.ts` executing its truth table (13 cases; verified to
go red under sabotage).

**2. The contact card was write-only.** `contact_person` and `contact_number`
have been captured since 2026-06-04 and were **never rendered anywhere** — grep
`contact_person` across `app/` before this change and every hit is a write path
or a docblock. Adding an address beside two invisible fields would have shipped
the same defect one field wider, so `SelfAddedContactCard` now shows all three
on the workspace Details tab, with the address editable through
`updateSelfAddedSupplierAddress` (one column, `.select()`-checked so an RLS
refusal cannot read as a save). It is also the only way to fix a row that
predates the column — `updateManualVendor` has no UI caller anywhere.

**3. The claim QR was a one-shot.** The add modal offers the invite link at
status `considering`; that panel dies with the modal. The workspace — the only
other door — demanded `contracted+` before it would even offer to MAKE one. So
between "added" and "locked" there was nowhere to get the QR back. Owner:
*"i failed the qr code to import the vendor. i dont have access for this qr and
link to share to the vendor."* Measured on prod the same day: `Seda Vertis
North`, added that morning, off platform, status `considering`, **zero rows in
`vendor_invites`**. `canOfferInvite` now asks only `canInviteSupplier` — the
shared predicate whose own docblock says off-platform and finalized are
independent axes (owner 2026-09-02) — and a source guard
(`the-invite-link-outlives-the-modal.test.ts`) fails CI if a status clause
returns.

**4. "Ask for a price" had no recipient, and the Quote tab was blank.** The
bench card told couples to ask a self-added supplier for a price; there is no
account on the other end. Owner: *"manual upload can have no requesting … they
can just list manually."* The resolver gains `set_price` for off-platform picks
(marketplace picks keep `needs_price` — same absence, two suppliers, two
answers, and both are tested). It writes through `updateVendorCosts`, the SAME
action the add modal and workspace Costing editor use, and carries
`transport_php` / `food_allowance_php` back untouched so typing a price cannot
blank money recorded elsewhere. Separately, `VendorProposalsCard` opens
`if (!marketplaceVendorId) return null`, so the Quote tab rendered a literally
empty page for a self-added supplier — the tab is no longer offered when there
can be no quote.

**Not built, because it already ships:** categories covered, inclusions, price,
transport and food allowance were all requested and all already exist —
`HostServiceDetails` (2026-06-11) for the first two, the workspace Costing
editor for the rest. The gap was discoverability, not capability.

SPEC IMPACT: `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md` — new row
for the 2026-09-20 owner decisions: (a) a self-added supplier in `venue` or
`religious_venue` must carry an exact address; every other category may; (b) a
self-added supplier's claim invite is offered at any booking status, because
being off-platform and being booked are independent axes; (c) a self-added
supplier is never asked to quote — the couple records the price directly, with
no request and no approval.

## 2026-09-20 · chore(security): accept the three new event_manual_vendors columns in the exposure baseline

`exposure-freeze.db.test.ts` failed the branch — correctly. `address`,
`payment_method_note` and `payment_terms_note` inherit the table's grant to
`authenticated`, because a column-level grant is not something a new column
opts into: it arrives with whatever the table already gives out. RLS is
ROW-level and can never hide a column from someone the row policy admits.

Accepted, not narrowed, and the reason is that the posture is **identical to
the eight columns already on the table** — every one of them reads
`anon=- authenticated=SIU`, including `contact_person` and `contact_number`,
which are the same kind of couple-private fact. `anon` has no reach at all
(REVOKEd in 20271148681647). The couple must be able to read and write their
own notes, and `event_manual_vendors_host_all` already scopes every row to
events they hold.

Baseline regenerated in the same PR so the three added lines show up in
review, which is the point of the file.
