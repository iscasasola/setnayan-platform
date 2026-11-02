## 2026-07-05 · fix(privacy): consent timestamps, session-replay masking, signup consent default, data-export completeness

NPC / RA 10173 consent & telemetry hygiene:

- **Session-replay PII masking** — Sentry's error-time Replay integration now runs with `maskAllText: true` + `blockAllMedia: true`, and a best-effort `beforeSend` scrubber redacts email/phone-shaped strings and known PII-keyed values from every event payload (breadcrumbs, request data, extra context). `replaysOnErrorSampleRate` unchanged. (`apps/web/app/_components/deferred-observability.tsx`)
- **Freely-given showcase consent** — the "feature my wedding in Real Weddings" checkbox on `/signup` no longer ships `defaultChecked`; it starts unticked so consent is affirmative, not pre-selected.
- **Durable marketing-consent timestamp** — new `users.marketing_consent_at` column stamped `now()` when marketing opt-in flips ON and cleared to `NULL` when it flips OFF, giving a stable proof-of-consent that `updated_at` (overwritten by any edit) can't. Only stamped on an actual transition.
- **Wider self-serve data export** — `/api/profile/export` now includes the subject's own order + payment records (amounts, reference codes, status, dates; admin-only fields dropped) and their own `guest_face_enrollments` consent metadata (consent_at/source, revoked_at, timestamps) — raw `face_vector` embeddings excluded. Auth-gated + self-scoped as before.

Deferred (out of scope): full server-side cookie-consent event logging for anonymous visitors.

SPEC IMPACT: None
