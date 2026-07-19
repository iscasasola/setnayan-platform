## 2026-07-18 · feat(vendor-autoreply): Phase 2 — deterministic reply engine

The pure, unit-tested reply engine for the vendor Auto-Reply Assistant (build plan
§3/§5). No DB, no LLM, not wired yet (Phase 3 hooks it to the inbox); everything
stays behind `NEXT_PUBLIC_VENDOR_AUTOREPLY_V1` (default OFF).

- `apps/web/lib/vendor-autoreply/` — `types` (normalized store + event contract),
  `intents` (deterministic EN + Taglish classifier), `answer` (templated replies
  built ONLY from the vendor's own catalog — structurally cannot misquote), `engine`
  (classify → confidence gate → answer, else hand off to the vendor).
- Handoff precedence: customization / booking / unknown / weak-confidence /
  no-store-data all route to the vendor (never auto-answer).
- 30 unit tests (`node:test`). Adversarially reviewed; confirmed findings fixed +
  regression-tested: no fabricated per-hour duration, booking word-forms hand off,
  coverage never prints a service category as a place, Taglish "po" particle handled,
  weak/ambiguous matches hand off.

SPEC IMPACT: None — implements Phase 2 of Vendor_Front_Desk_Chatbot_Build_Plan_2026-07-18.md.
