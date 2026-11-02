## 2026-06-26 · feat(schedule): guest day-of times shown in the viewer's timezone

Mirrors the native app (owner: "keep everything consistent everywhere"). The
public day-of schedule on `/[slug]` now renders each block in **the viewer's own
local time**, labelled "· your time" — a guest in PH viewing a US wedding sees
the PH-equivalent time. Also fixes a latent bug: the prior `toLocaleString`
display treated the naive event-local-stored time as a real UTC instant.

- The event timezone is **auto-derived from the venue coordinates** (option B):
  `lib/event-timezone.server.ts` (`tz-lookup`, **server-only** so it never enters
  the client bundle) → IANA string; `Asia/Manila` fallback when no coords.
- `lib/schedule.ts` gains `formatViewerTime` / `formatViewerTimeRange` /
  `wallClockToInstant` (Intl only, client-safe) — a 1:1 mirror of
  `~/Setnayan-Native/src/lib/timezone.ts` (the shared "brains", verified in Node
  LA⇄Manila). The stored value is reinterpreted as event-local, converted to the
  true instant via the event tz, then rendered in the viewer's browser-local time.
- `[slug]/page.tsx` derives the tz from each render component's `event` coords and
  passes it to `<ScheduleWidget eventTz>`. The widget's "happening now / up next"
  math now uses the true instant too. Viewer-local display is gated to post-mount
  (`now != null`) to avoid an SSR/hydration time flip.
- No DB migration: `start_at` is unchanged; the tz is derived on the fly (same
  model as native).

SPEC IMPACT: 0031 day-of-guest — public schedule times are viewer-local;
authoring stays in venue time. Follow-up: a cross-day indicator when the
viewer-local date differs from the event date.
