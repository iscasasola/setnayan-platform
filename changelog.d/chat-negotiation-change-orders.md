## 2026-07-24 · feat(chat): negotiation auto-reader — discounts + inclusions (Phase 2, flag-dark)

Owner 2026-07-24: auto-read negotiations → accept/revise/reject inline. Phase 2 adds the **discount** and **inclusion** slices on top of P1 (schedules). Same reader (`lib/chat-negotiation-detect.ts`), same flag, same inline pattern — this time backed by the existing `vendor_change_orders` propose→accept/decline machine.

**Inline, reusing the change-order machine:**
- Under the sender's own message, when the reader flags a discount or inclusion topic, a one-tap chip appears (`change-request-suggest-chip.tsx`) — **"Request a discount"** (amount prefilled from the detected figure) or **"Request an inclusion"** (item prefilled). A message can raise both.
- The chip calls `createChangeRequestFromChat` (`negotiation-actions.ts`): resolves the booked `event_vendor_id`, inserts a `proposed` `vendor_change_orders` row (RLS-gated; discount = negative delta, inclusion = the item + an optional offer / ₱0 "please include"), and posts a `chat_messages` card via new **`chat_messages.change_order_id`** (migration `20270921698789`, mirrors `proposal_id`/`appointment_id`). Best-effort notification.
- The stream renders an in-chat card (`chat-change-order-card.tsx`) — the counterparty gets **Accept / Counter / Decline**. Accept + Decline forward to the existing single-winner `accept_change_order` / `decline_change_order` RPCs (accept settles the signed delta into the budget ledger). **Counter** declines the current request and raises the opposite-role change order in one step (`counterChangeRequestFromChat`), posting a fresh card — the accept/revise/reject loop.

**Guardrails:**
- Change orders settle into the budget ledger, so they require a **booked** vendor (an `event_vendors` row). A request before booking no-ops with a friendly "book this vendor first" flag rather than a silent failure.
- Ships DARK behind `NEXT_PUBLIC_CHAT_NEGOTIATION_V1` (same flag as P1, default OFF). OFF ⇒ stream byte-identical (column unused; `fetchMessages` selects `change_order_id` with the same pre-migration graceful degrade as `is_bot`/`appointment_id`).
- All writes run under the caller's own session — RLS + the SECURITY DEFINER RPCs are the boundary; the admin client only fans out notifications. No new state machine.

Follow-up (Phase 3): couple-side proposal counter-offer + the "Negotiations" summary strip (Agreed / Pending / All, derived from card statuses). Chip persists under the original message after creation (dedup = follow-up).

Full unit suite 2972 green · typecheck + lint clean · RA-10173 export guardrail green (additive column, no new subject table).

SPEC IMPACT: iteration 0019 negotiation auto-reader Phase 2. Logged in corpus `DECISION_LOG.md` (2026-07-24).
