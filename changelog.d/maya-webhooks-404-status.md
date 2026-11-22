## 2026-11-22 · fix(maya): Register webhooks treats a 404 list as "none yet" and says why it failed

- `registerMayaWebhooks` (`lib/maya-api.ts`): Maya answers 404 on `GET /payments/v1/webhooks` when an account has no webhook yet. That was read as a refusal, so a first-ever registration failed even with good keys. A 404 on the list is now an empty list, and the POSTs go ahead (same as the payment-rrns read).
- The failure reason now carries the HTTP status class: `keys_refused` (401/403), `no_answer` (no HTTP answer / timeout), or `refused` (anything else). The Integrations notice says which one, for example "Maya refused these keys — check they match the endpoint (sandbox keys → pg-sandbox, Business Manager keys → pg.maya.ph)". No key is ever shown.
- Tests: a 404 list followed by four successful POSTs; 401/403/500/timeout map to the right reason; no notice contains a key.

SPEC IMPACT: None.
