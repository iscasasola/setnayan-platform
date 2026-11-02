## 2026-07-24 · feat(chat): confirmed vendor meetings show on the couple's Schedule

Owner 2026-07-24: "this should be also added to schedules when approved" + "schedule changes also affects the schedule as well."

- New `VendorMeetingsSection` on `/dashboard/[eventId]/schedule` — a **read-only** surface of the event's proposed/confirmed `event_appointments` (vendor meetings), sorted by time, each deep-linking back to its chat thread to manage. Because it reads the live appointment rows, a confirm / propose-new-time / decline in chat reflects here automatically (no data duplication, always in sync — exactly "changes affect the schedule").
- Flag-gated on `NEXT_PUBLIC_CHAT_NEGOTIATION_V1` (default OFF); RLS lets the couple read their own event's appointments. The Preparation copy already promised "vendor meetings" — this fills it in.

No schema, no migration. typecheck + lint + radius guard clean.

SPEC IMPACT: none (surfacing on iteration 0019/0016). Next: Phase-3 bundled proposal amendment (current-vs-requested, multi-item, freebies, specialized checklist asks).
