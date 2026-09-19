## 2026-09-19 · fix(vendor): a customer who asks to book you is named

The Customers roster showed a couple who had just asked to lock as "Customer"
with a "·" mark, although `events.display_name` ("Ana & Miguel") was already
read by the page and shown in the chat thread. Root cause: `customerLaneOf`
gated identity by LANE — `waiting` never carried a name — and ignored the
`revealed: true` flag the 2026-09-08 ruling added. The gate is removed; every
row carries the name and venue whenever they exist, and the fallback appears
only for a genuinely nameless event. Same sweep: Today's booking-ask cards
(answerable + lapsed) now name the couple, and the Clients tab's "In
conversation" list reads names/dates through `fetchInquiryCustomerFacts`
instead of an RLS-nulled `events` embed.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-19 row — extends the 2026-09-08
anonymization retirement to booking asks; supersedes PR-H's "no name at the
requested rung" for display. `get_vendor_event_brief` unchanged (flagged).
