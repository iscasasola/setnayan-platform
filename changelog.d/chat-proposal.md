## 2026-06-26 · feat(vendor): send a proposal straight from the chat thread

Vendors can now create + send a full structured `vendor_proposals` proposal
from inside the couple↔vendor conversation, instead of leaving for the
proposals page (which never posted anything back into the thread). The proposal
lands as a **card in the chat**; the couple taps through and accepts via the
existing DB-guarded `respond_vendor_proposal` RPC, which prices their
`event_vendors` row. No price is written in the new code path.

- **Migration `20270225000000_proposal_inquiry_stage_and_chat_link.sql`**
  (applied to prod): relaxes the `vendor_proposals` INSERT RLS so a vendor may
  also create a proposal for an event with an **accepted-inquiry** chat thread
  (not only a booked one) + adds `chat_messages.proposal_id` (FK, nullable) so a
  sent proposal links to its in-thread card.
- New `sendProposalFromChat` server action + `SendProposalCard` composer
  disclosure (template · optional package · price · title · valid-until), shown
  on accepted threads. Booked threads auto-fill the rich brief tokens; inquiry
  threads use a minimal token set (the couple's private planning data isn't
  shared until they book).
- Extracted shared `lib/proposal-merge.ts` (`resolveProposalValues` +
  `resolvePackageLineItems`) so the existing booked `createProposal` and the new
  chat path resolve merge tokens through one identical code path (no drift). The
  booked flow is behaviorally unchanged.
- `ChatMessageStream` renders the proposal card (title · price · status + a
  Review/View link); couple sees "Review & accept", vendor sees "View proposal".
- Exported `notifyOtherParty` so the proposal message notifies the couple via
  the same path as a normal vendor message.

SPEC IMPACT: **Unparks the owner-locked "proposals = BOOKED clients only" V1
scope** — inquiry-stage proposals are now permitted (owner-authorized
2026-06-26 in-session). DECISION_LOG row added. No SKU/pricing change; accepting
a proposal remains a signal, never an on-platform payment.
