## 2026-10-24 · fix(guests): one guest card everywhere — the Wedding March and the parents open the Guest list's card

Owner, 24 Oct, on desktop with a screenshot: *"the guest card on wedding march is not same with the guest card."*
Tapping a name on the Wedding March (and a parent under the march, in Studio › Prints or in Details › Parents & hosts)
opened a second card: the shared body drawn by the Maker's hand-drawn kit, with no Invite ▾, no "✓ Saved", no Delete,
"Photos" instead of Papic, chevron rows instead of the approved folds, under a "Guests see this right away" header.

- **`GuestCard`** (`guests/_components/guest-card.tsx`) is now the only thing that draws a guest's card: the Guest list's
  panel (`?inspect=`), the standalone route, the in-place read and the dev labs all render it, with the approved ticket,
  Invite, ⋯, Papic, Access, helper pieces and Delete wired once.
- **`readGuestCard`** (`guest-card-read.ts`) is the one reader for a single card (the standalone route and the in-place
  read); **`openGuestCard`** (`guests/open-guest-card.tsx`) replaces `openMarchGuestCard` and serves the march and the
  parents.
- **`GuestCardSheet`** (`guest-card-sheet.tsx`) replaces `march-guest-card.tsx`: the Guest list's own sheet
  (`InspectorSheetAlone`, new in `inspector-column.tsx`): the phone sheet with its peek, the 440 panel from 701, and
  (`.sn-inspector-sheet--alone`) still 440 at ≥ 1280 where there is no rail. It is lifted over the Maker.
- The hand-drawn kit (`OLD_KIT`) and the `kit` prop are deleted; the card always draws with `TEMPLATE_KIT`. The Maker's
  page no longer reads or draws any parent's card up front (one fewer read per parent, nothing of the card in the
  Maker's first load).
- Guard: `guests/_components/one-guest-card.test.ts`. It checks that one component draws the body, that every entry
  point opens it, and that the second card stays gone. Guards that pinned the old march card or the old kit are
  re-aimed.

SPEC IMPACT: None. It applies the approved guest card (`guest_card_groups_and_papic_2026-10-23.html`) to every surface
and adds no new design.
