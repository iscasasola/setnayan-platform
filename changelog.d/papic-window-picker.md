## 2026-06-26 · feat(papic): capture-window picker — date range sets BOTH the price and how long cameras shoot

Owner direction: when buying Papic the couple "must pick a date and a start day
and time and end day (time auto-set)" — and that span sets the bundle price AND
how long the QR/cameras last for the event. Travel = day 1 → end of trip;
wedding (and every anchored event) must cover the event day and may extend
**before** it but never **after** (the end is pinned to `event_date`). Day
counting is **calendar-inclusive** (owner pick: Mon→Fri = 5 days); the picker is
offered for **all event types** (anchored-style for single-day, travel-style for
multi-day).

The per-camera engine already multiplied by `days` and the seat schema already
had `valid_from/valid_until` — both were hardcoded to a single day. This wires a
real event-level window through both halves.

- **migration `20270306…_papic_capture_window_per_event`** — `events.papic_window_start/end`
  (timestamptz, nullable). NULL = legacy single-day anchored to `event_date`.
  Applied to prod (additive · idempotent · ledger row backfilled to the file
  version).
- **`lib/papic-window.ts`** (pure, +12 unit tests) — `resolvePapicWindow`
  (event-type rules), `resolveStoredWindow` (read-back + legacy fallback),
  `inclusiveDays`, Manila (+08:00) start/end-of-day helpers, `formatWindowSummary`.
- **`lib/papic-limited.ts`** — `fetchEventPapicWindow` (graceful pre-migration);
  `syncGuestCameras` now stamps guest cameras with the window bounds, not `event_date`.
- **studio/papic `actions.ts`** — `setPapicWindow` (validates + saves + re-stamps
  existing per-camera seats); `purchasePapicCameras` / `activatePapicLimited` /
  `purchasePapicExtras` all price by `window.days` and provision seats to the
  window. Order descriptions carry the window summary.
- **`papic-window-picker.tsx`** (new) — event-type-aware date/time UI with a live
  day-count + price-impact preview; mounted atop "Your cameras".
- **`extra-cameras-picker.tsx` + studio `page.tsx` (LimitedCard)** — price preview
  ×days; "· 1 day" → live window summary. Save/error banners added.
- **capture gate** — `app/papic/actions.ts` (`recordSeatCapture`) + `app/api/upload/route.ts`
  presign probe now refuse a per-camera capture outside `[valid_from, valid_until]`
  (`capture_not_started` / `capture_window_closed`). Fail-OPEN on null bounds
  (legacy seats) + sampler/legacy-pack seats are untouched.

⚠ The window closes **capture only** — gallery, Drive copies and reels persist
forever, and the guest tagging QR stays event-scoped (so guests still view/tag
after the shoot). Editing the window after cameras exist re-stamps their validity
bounds but does NOT retro-adjust the already-frozen order bill — a deliberate
extension grace, flagged for the pricing-holistic review. Per-tier caps
(₱6,000 Ltd / ₱10,000 Unli) apply to the full multi-day subtotal.

SPEC IMPACT: 0012 Papic — adds a per-event capture WINDOW that drives day-based
pricing + seat validity, with travel/anchored event-type rules. Reverses the
"1 day for ~all weddings" default. Corpus + DECISION_LOG updated.
