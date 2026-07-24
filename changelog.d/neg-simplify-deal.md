## 2026-07-24 · refactor(chat): collapse negotiation money cards to ONE "Deal" (council verdict)

Owner 2026-07-24 (council verdict `Negotiation_Exchange_Council_Verdict_2026-07-24.md`): "as simple as possible." Collapse the money surface to a single card.

- Removed the separate **discount/inclusion change-order card** from the chat stream (`ChatChangeOrderCard` deleted; the `change_order_id` render branch + fetch effect removed). The bundled amendment is a superset (discount = a one-line amendment), so a couple now sees **one money card** instead of three. Existing `vendor_change_orders` table + the now-unused server actions are left dormant (removable later) — no data, flag-dark.
- **Relabelled "amendment" → "Deal"** everywhere customer-facing (card header, the suggest chip "Send a deal", the posted card body). No more "change order" / "amendment" jargon. Table names unchanged.

Negotiation surface is now the intended **two cards: Deal (money) + Meeting (time).** Behind the same `NEXT_PUBLIC_CHAT_NEGOTIATION_V1` (default OFF). Full suite 2990 green · typecheck + full lint + radius clean.

SPEC IMPACT: implements the 2026-07-24 council verdict (iteration 0019). Next in the rework: an explicit "+" composer entry (Send a Deal / Request a Meeting) + the customer "Lock this deal" action (`thread.agreed_price`). Payment/5% = separate session.
