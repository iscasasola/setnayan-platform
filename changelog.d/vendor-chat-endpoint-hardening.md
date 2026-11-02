## 2026-06-29 · fix(vendor-chat): harden the native-facing chat endpoints

Gap-check follow-up on the vendor-chat native-send endpoints (PR #2385):
- `/send` no longer leaks the raw Postgres/PostgREST error to the client on an
  insert failure — returns friendly copy, logs the raw error server-side.
- `/offer-service`, `/compose-options`, and the `invalid_json` paths now return
  the `{ error, message }` shape the native client's `asError()` expects (they
  were omitting `message`, so the app showed generic/wrong copy).
- `sendProposalCore` now enforces the FREE-vendor in-app messaging block (parity
  with `sendChatMessageCore`) — a proposal posts a vendor `chat_messages` row, so
  without this a FREE vendor on an admin-accepted thread could post a proposal
  card via `/proposal`, bypassing the FREE in-app block.

SPEC IMPACT: None (endpoint error-handling + tier-gate parity; no SKU/pricing/flow change).
