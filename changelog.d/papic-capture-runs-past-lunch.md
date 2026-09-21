## 2026-09-22 · feat(papic): capture runs twelve hours past the end of the event day

Owner, 2026-09-22, in two messages in one sitting: *"okay, we give them until
lunch the next day."* then *"just do 12 hours after the event ends."* Those are
one rule. `events` holds no clock time for an event anywhere — `event_date` and
`event_end_date` are DATE columns, the only `time` columns on the table are the
partners' birth times, and no run-of-show table carries times either (measured
2026-09-22) — so "when their event ends" can only mean the end of the event's
calendar day, 23:59:59 Asia/Manila. Twelve hours past that is 11:59:59 the next
morning, which is lunch the next day. No new column, and no new question in
front of a couple. Adding an event end-TIME field was considered and rejected:
`event_end_date` is NULL on all 11 live events, so a second optional field would
be null too and would fall back to this rule anyway.

**One term, `PAPIC_CAPTURE_GRACE_HOURS`, and one resolver,
`manilaCaptureCloseIso()`** (`apps/web/lib/papic-window.ts`). Every gate and
every screen comes through it: `resolvePapicWindow` and `resolveStoredWindow`
stamp its answer into `events.papic_window_end` and
`paparazzi_seats.valid_until`, `captureWindowState` and `guestCaptureGate` close
on it, and the picker prints it through `formatCaptureCloseLabel`.

**🛑 Why this is a migration and not a one-line change.**
`paparazzi_seats.valid_until` was a **DATE**, and `captureWindowState()` reads a
bare date as a whole Manila day — deliberately, because six of thirteen
production seats once carried `valid_from = valid_until`, the window collapsed
to a single millisecond, and every shutter tap both claimed photographers ever
made was refused (that is why `papic_photos` had zero rows). So both shortcuts
fail: stamping `last day + 1` into a DATE grants the WHOLE next day, and reading
a bare date twelve hours longer changes the meaning of every legacy row under a
rule nobody applied to it. The column is widened to `timestamptz` instead
(migration `20271238778987`) and all existing rows are rewritten by the same
rule the app now applies. `events.papic_window_end` was already `timestamptz`;
every row still sitting on 23:59:59 Manila moves forward twelve hours, which
also makes the UPDATE idempotent.

**`valid_from` is deliberately left a DATE.** Widening it would suddenly honour
the couple's picked start TIME, which Postgres has always truncated to midnight
— a camera that opens at 2 PM instead of 00:00 REFUSES shots that work today.
This ruling was about the END.

**Also moved, each checked rather than assumed:**

- `guestCaptureGate`'s switch-OFF branch — it is a capture gate, and without the
  tail a guest at a reception past midnight was refused her photograph while the
  couple's own cameras beside her kept shooting. Direction is OPEN; nothing that
  worked before stops working.
- `papic_challenge_ends_at()` — takes `events.papic_window_end` as its third
  term, so a celebration WITH a window follows the ruling for free; its NULL
  fallback now carries the tail too, so the SQL and TypeScript fallbacks agree.
  A first draft of that fallback was one second off (`(event_date + 1)` is
  MIDNIGHT after, not the last instant of the day) — caught by the db test that
  compares the two.
- `StoredWindow` gained `startDate` / `endDate`. The close instant now lands on
  the morning AFTER the last day, so every label built with
  `manilaDate(endIso)` would have turned a one-day wedding into "Dec 20 – Dec 21
  · 2 days" on the price tile, the order description and the settings row at
  once. `days` still counts the days the couple picked.
- Copy on the window picker and the guest-camera card, both of which said
  "cameras run to the end of that day". They now name the closing instant,
  formatted from the gate's own number.
- The full-res retention clock was checked and does NOT move: it is
  `GREATEST(first_capture + 6 months, event_date + 3 months)`, and neither term
  reads the window.
- `papic_guest_spend_ceiling()`'s automatic pool release reads
  `papic_window_end - 2 hours`, so it moves with the window by construction —
  left alone on purpose. It stays "two hours before the cameras stop", which is
  what the term always expressed, and its own docblock says being late is the
  harmless direction.

Proved by `lib/capture-runs-past-lunch.test.ts`, which runs under Asia/Manila
with fixed clocks (a UTC-only run is blind to this whole class) and derives
every assertion from the constant, plus `tests/db/capture-runs-past-lunch.db.test.ts`
for the widening and the SQL fallback. Four sabotage runs: grace → 0 (6 red), a
screen recomputing the tail itself (1 red), the ALTER removed (2 red), the SQL
`+ 12 hours` removed (1 red).

SPEC IMPACT: DECISION_LOG.md — a new dated row for the 2026-09-22 capture-tail
ruling, and the Papic capture-window section of the iteration that owns it.
