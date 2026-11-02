## 2026-07-24 · refactor(chat): negotiation requests as structured info cards (collapsible)

Owner 2026-07-24: "make this cleaner and easy to manage — differentiate from a message, a larger information card." The Phase 1/2 negotiation cards (schedule / discount / inclusion) read too much like fancy chat bubbles. This is a pure presentational upgrade — same data, same accept/counter/decline actions.

- New `negotiation-card-shell.tsx` — a shared, full-width **information card**: a coloured left stripe + icon tile (schedule = mulberry · discount = terracotta · inclusion = gold), a small-caps type label, a bold title, a status pill (Awaiting / Confirmed·Accepted / Declined), a structured `<dl>` details grid, and a dedicated action footer on a tinted strip. Visually distinct from a message bubble at a glance.
- **Collapsible** (owner-chosen): once a request is resolved (agreed / declined) the card collapses to a single tidy line — icon + type + title + status pill — and expands on tap, so a long negotiation doesn't clutter the scroll. Declined cards dim.
- `chat-appointment-card.tsx` + `chat-change-order-card.tsx` refactored to compose the shell; their data shapes, actions (`respondAppointment` / `respondChangeRequestFromChat` / `counterChangeRequestFromChat`), and the stream wiring are unchanged.

No schema, no new data, no migration. Behind the same `NEXT_PUBLIC_CHAT_NEGOTIATION_V1` (default OFF). typecheck + lint clean.

SPEC IMPACT: none (UI polish on iteration 0019 negotiation auto-reader). Next: Phase 3 — proposal counter-offer + the "Negotiations" summary strip (Agreed / Pending / All).
