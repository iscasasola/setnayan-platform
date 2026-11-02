## 2026-07-24 · feat(chat): bundled proposal amendments (Phase 3, flag-dark)

Owner 2026-07-24: "for proposals / price adjustments, show what the current proposal is and what they want added"; one request can bundle multiple items (discount + price adjustment + freebies + a specialized ask like "upload photos"); the vendor can offer freebies too. Owner-chosen shape: ONE bundled amendment card; specialized asks are checklist items the vendor marks done.

- Migration `20270924533987_proposal_amendments.sql` — `proposal_amendments` + `proposal_amendment_items` (kinds: discount / addon / freebie / request) + `chat_messages.amendment_id` FK. RLS mirrors `event_appointments`; state machine via a `status='proposed'` precondition update (single-winner, no RPC). ⚠ ledger auto-settle is a tracked follow-up (accepted amendment = agreement record). Classified in the RA-10173 export guardrail (KNOWN_GAPS, ceiling 87→88).
- `lib/proposal-amendments.ts` — item kinds + signed-amount conversion + net-delta / new-total math. 3 tests.
- Actions (`negotiation-actions.ts`): `createAmendmentFromChat` (validates a serialized item bundle, resolves the booked event_vendor + base proposal), `respondAmendmentFromChat` (accept/decline), `counterAmendmentFromChat` (decline + raise), `markAmendmentItemDelivered` (vendor stamps an accepted `request` item done).
- UI: `AmendmentBuilder` (reusable multi-line editor), `ChatAmendmentCard` (**current proposal → requested items → new total**, accept-all / counter / decline, request checklist with Mark-delivered), `AmendmentSuggestChip` ("🧾 Request proposal changes", prefilled from the reader). Wired into the stream (fetch amendment + items + base total).
- **Supersedes the P2 single-item chip** for creating new proposal changes (deleted `change-request-suggest-chip.tsx`); existing change-order cards still resolve.

Behind the same `NEXT_PUBLIC_CHAT_NEGOTIATION_V1` (default OFF). Full suite 2977 green · typecheck + full lint + radius guard clean.

SPEC IMPACT: iteration 0019 negotiation Phase 3. Logged in corpus `DECISION_LOG.md` (2026-07-24). Follow-ups: ledger settlement on accept; a "Negotiations" summary strip.
