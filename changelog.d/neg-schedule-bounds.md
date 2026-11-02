## 2026-07-24 · feat(chat): meeting requests are date-bounded with time-slot options

Owner 2026-07-24: a meeting scheduled from chat "must be between today and the day before the event date," and the picker should "place time options."

- New `lib/appointment-slots.ts` — `TIME_SLOTS` (8:00 AM → 8:00 PM, 30-min) + date-window helpers (`todayIsoLocal`, `dayBeforeEventIso`). 3 tests.
- The meeting form (`schedule-suggest-chip.tsx`) + the propose-new form (`chat-appointment-card.tsx`) now use a bounded `<input type=date>` (min today, max = day before the event) + a `<select>` of time slots instead of a raw datetime. Prefilled best-effort from the detected date/time, clamped to the window.
- `createScheduleRequestFromChat` takes `date` + `time`, combines them at Manila (+08:00), and **re-validates the window server-side** (rejects a past date or a date on/after the event day with a friendly flag) — the authoritative gate.
- `eventDate` threaded from both thread pages → `ChatMessageStream` → the chip + card (couple page now selects `events.event_date`; vendor page already had it).

Behind the same `NEXT_PUBLIC_CHAT_NEGOTIATION_V1` (default OFF). Full suite 2975 green · typecheck + lint + radius guard clean.

SPEC IMPACT: none (constraint on the Phase-1 schedule flow). Next: approved meeting → event schedule; proposal amendments (current-vs-requested, multi-item, freebies).
