## 2026-07-12 · feat(events): date-anchor model — anniversary capture + memorable-date reminders (PR-A)

Builds on the anchor foundation: the **Anniversary** type now captures its anchor and gets the annual reminder — including memorable-date anniversaries (owner: "place memorable dates we want to celebrate every year as anniversary"), not just on-platform weddings.

- **Create flow** — when the type is `anniversary`, the create form shows the anchor question: a **typed origin** picker (Our wedding · Our relationship · A milestone we're proud of · A date that matters to us — positive origins only) + the date it commemorates. Both optional (add now or later). `createWeddingEvent` stamps `anchor_date`, `anchor_origin` (validated against the positive-only set), and `recurs=true`. `event_date` stays NULL — the anchor is the commemorated date; the next occurrence is derived.
- **Reminder engine** — migration `20270731821239` generalizes `couples_with_anniversary_today()` so an event's effective anniversary date is its `anchor_date` when it's a recurring anniversary, else `event_date`. Weddings (recurs=false) match on `event_date` exactly as before — behavior-preserving. Memorable-date anniversaries now get the same daily-cron annual email (Manila-timezone, idempotent via `anniversary_email_log`) that weddings already got. Return signature unchanged; grants re-asserted (service_role only).
- **`lib/event-anchor.ts`** — adds `ANCHOR_ORIGINS` / `ANCHOR_ORIGIN_LABELS` / `isAnchorOrigin()` (the positive-only typed-origin set, mirroring the DB CHECK). +2 unit tests asserting no memorial/death/babang-luksa option can exist (31 total, all green).

No change to wedding behavior or any other event type. The dependent People layer (minors' birthdates) remains counsel-gated and untouched.

SPEC IMPACT: None (design already in the corpus: `Event_Anchor_Minimalist_Setup_Design_2026-07-12.md` § 3b memorable-date anniversaries).
