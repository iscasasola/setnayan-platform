## 2026-07-08 · feat(life-flash): PostHog instrumentation (PR-5, strategy §9 metrics)

The success measures from the strategy, wired as fire-and-forget, NO-PII telemetry (no names, person ids, event ids, or media — only scope KIND, counts, indices, booleans). All no-op without PostHog keys; all errors swallowed (telemetry must never break the room).

Client (`_components/life-flash-analytics.ts`, lazy posthog-js like guest-to-host-cta):
- `life_flash_started` { scope, beat_count, has_perspective, has_memoriam, reduced_motion }
- `life_flash_completed` { scope, beat_count } — reached present_forward
- `life_flash_cancelled` { scope, at_beat, beat_count } — closed before the end (drop-off signal)
- `life_flash_perspective_viewed` { scope } — the signature beat surfaced (USP reach)
- `life_flash_reel_reordered` { order }

Server (`actions.ts`, `lib/analytics.captureEvent`):
- `life_flash_person_remembered` { remembered } — ✦ adoption

Audit: safety contract from PR-4 re-confirmed (dialog + aria-modal, Escape/Stop, pause-on-any-input, reduced-motion sheet, focus restore). Focus-TRAP left as a v1.1 polish (body-scroll-lock + limited controls make tab-escape low-risk). Feature stays flag-off in prod.

SPEC IMPACT: None (implements Build Plan §7).
