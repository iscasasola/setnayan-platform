## 2026-07-24 · feat(chat): negotiation auto-reader — schedules (Phase 1, flag-dark)

Owner 2026-07-24: "make negotiations easier to manage — auto-read schedules, proposals, inclusions, discounts" so the other side can accept / revise / reject, inline in the chat. Phase 1 ships the reader + the SCHEDULE slice; inclusions/discounts (Phase 2) and proposal-counter + the "Negotiations" summary strip (Phase 3) follow.

**The reader — `apps/web/lib/chat-negotiation-detect.ts` (pure, no-LLM per Setnayan-AI Rule 1, 8 tests).** `detectNegotiation(body)` → `{ hasSignal, signals[], primary }`, classifying a message as schedule / discount / inclusion / quote and extracting an excerpt (datetime / amount / item). EN + high-signal Tagalog (kita tayo, tawad, magkano, kasama), word-boundaried. Suggestion-grade — a hit surfaces an affordance, never mutates anything; false reads are a dismissible chip.

**Schedule slice (Phase 1), inline in the chat, reusing the EXISTING appointment machine:**
- Under the sender's OWN message, when the reader flags a meeting topic, a one-tap **"Set up this meeting"** chip appears (`schedule-suggest-chip.tsx`) → opens a tiny form (kind + a datetime prefilled from the detected date/time) → `createScheduleRequestFromChat` (`negotiation-actions.ts`).
- That action inserts a `proposed` `event_appointments` row (RLS-scoped; the existing propose→confirm/decline/propose-new machine, migration 20270713200000) AND posts a `chat_messages` card pointing at it via new **`chat_messages.appointment_id`** (migration `20270920827160`, mirrors `proposal_id`). Best-effort notification to the other party.
- The stream renders that row as an **in-chat appointment card** (`chat-appointment-card.tsx`) — the counterparty gets **Accept / Propose new time / Decline**, all backed by the existing `respondAppointment` (single-winner). The proposer sees "awaiting response". No new state machine — this is surfacing what already existed on the separate Schedule tab into the chat.

**Ships DARK** behind `NEXT_PUBLIC_CHAT_NEGOTIATION_V1` (default OFF · client + server read one value). OFF ⇒ the stream is byte-identical to before (no reader, no chip, no card; the appointment_id column just sits unused). `lib/chat.ts` `fetchMessages` selects `appointment_id` in its optimistic query with the same pre-migration graceful-degrade as `is_bot`, so the thread never crashes ahead of the migration.

Follow-ups (tracked): a fuzzy date ("next Friday") is left for the composer's date-picker (the reader flags the topic + excerpt only); the chip persists under the original message after creation (each tap makes a new request); Phase 2/3 wire inclusions/discounts + the summary strip.

Tests: `chat-negotiation-detect.test.ts` (8). Full unit suite 2972 green · typecheck + lint clean · RA-10173 export guardrail green (additive column, no new subject table).

SPEC IMPACT: iteration 0019 (Communications) — negotiation auto-reader. Logged in corpus `DECISION_LOG.md` (2026-07-24). Builds on the Relationship-Workspace Appointments design (Relationship_Workspace_and_Appointments_2026-07-11.md).
