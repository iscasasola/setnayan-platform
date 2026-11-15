## 2026-11-13 · feat(events): per-event-type maximum days (`event_type_profiles.max_days`)

`max_days` (1–30) is now the source of truth for how long an event type may run; `multi_day` is derived from it by trigger (`max_days > 1`). Table per the 13 Nov owner ruling. `lib/event-type-profile.ts` exposes `maxDays` and `eventSpanRefusal` (nothing writes `events.event_end_date` yet, so the shared check is ready for its first writer).

SPEC IMPACT: None — ruling already in DECISION_LOG ("DAYS PER EVENT TYPE").
