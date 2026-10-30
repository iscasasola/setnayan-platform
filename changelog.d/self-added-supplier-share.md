## 2026-10-30 · feat(suppliers): a self-added supplier gets the guest card's Share — the approved invite text and their digital card

Builds the SUPPLIER half of the DECISION_LOG row of 2026-10-30, "THE INVITE TEXTS — GUEST AND SELF-ADDED SUPPLIER —
APPROVED; A SELF-ADDED SUPPLIER GETS A SHARE BUTTON, AN AUTOMATIC CLAIM LINK AND A DIGITAL CARD" (owner: *"for the
manual suppliers. we will use the same share button. with a text to invite them to sync with our event."*). The guest
text is not touched.

- **Share on both cards** (`SupplierShareButton`, `_components/supplier-share-button.tsx`): the record card's head
  (beside the QR, `SupplierConnectPanel layout="top"`) and the service card's verb row on Event › Suppliers
  (`bench-vendor-actions.tsx`, gated on `actions.connect` = `canInviteSupplier` — never a supplier with a shop). The
  press is the guest card's own share (`shareInvite`): the phone's sheet with the message AND the card where it takes
  a file, the message alone where it does not, and on a computer the message is copied with "Download card" beside
  it. The bare-link `navigator.share` the panel had is gone.
- **The approved text, word for word** (`lib/supplier-invite-message.ts`): "Hi {supplier}! 👋 / You're part of the
  team behind {event} on {date} … / {hosts}", one line per " / ", filled from real facts — the contact's first name
  (else the shop), "our wedding", the guest message's date rule, the row they were added under, their claim link, the
  hosts. An absent fact takes its lead-in with it.
- **The link is automatic, and the Share is ONE request**: `createManualVendorInvite({ …, withShare: true })` — the
  ONE link writer returns the live link (or makes it for an older supplier: no "create link" step) together with the
  message and the card (`supplierSharePayload`, lib/supplier-share.server.ts). No new server action and no new route:
  the server-action budget sits at its ceiling (`lint-server-action-budget`), and each route is a Vercel route. Asked
  for on the record card's open, and on the service card's first touch — never for a whole page of cards.
- **The digital card** (`lib/supplier-card.ts`, handed back as a PNG data address): the approved prototype
  (`build-contracts-2026-10-30/supplier-digital-card/`) as a 1080 × 1440 PNG — shop name · contact · covers · invited
  by · event · date · the claim-link QR — laid out in the guest ticket's own `PrintDoc` vocabulary and flattened by
  the ticket's own `renderPassCardPng`. Cormorant + Jost outlines from the repo's own files; a missing fact is left
  off; a long name steps down a size; the QR (black on white) decodes back to the link in the test.

Guards: `lib/the-supplier-invite-text-is-the-approved-one.test.ts` (the exact text) ·
`lib/the-supplier-card-is-the-prototype.test.ts` (a real render: size, facts, QR decode) ·
`app/dashboard/[eventId]/_components/a-self-added-supplier-shares-its-invite.test.ts` (Share only for self-added, on
both cards, through `shareInvite` and the one link writer; reading the facts writes nothing).

No migration. No email — the message leaves from the couple's own phone.

SPEC IMPACT: None — implements the 2026-10-30 DECISION_LOG row as ruled (its "Nothing built yet" is now this PR).
