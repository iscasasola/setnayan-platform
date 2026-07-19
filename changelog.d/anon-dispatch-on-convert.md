## 2026-06-20 · feat(anon): auto-dispatch held vendor inquiries the moment a couple secures their account

Completes the anon-draft inquiry model (PRs #1912 + #1923). An anonymous couple's inquiry fan-out is skipped at onboarding commit (a vendor reply would bounce to their placeholder email). This was the missing half: when they secure their account, the inquiries they held during onboarding now **send automatically** — no manual re-trigger.

- **`onboarding/wedding/actions.ts`** — when an anon couple opted into "reach my matches", stash the intent as `events.style_preferences.pending_inquiry_dispatch = { perCategory }` (the picks already live in `interested_categories`). No-op for signed-in couples (they fan out at commit as before).
- **`lib/pending-inquiries.ts`** (new) — `dispatchPendingInquiries(userId)`: finds the couple's events with the held intent, replays the fan-out via `unlockCategoryWithInquiry` (now passing the `is_anonymous` guard, since they've converted), then clears the flag. Idempotent — the `already_active` check + `chat_threads UNIQUE(event_id, vendor_profile_id)` dedupe any re-run, so a transient failure simply completes on the next load. Best-effort; never throws.
- **`dashboard/layout.tsx`** — triggers it from `after()` (post-response, non-blocking) only when the principal is **non-anonymous**. A converted couple's first authenticated dashboard load replays their inquiries; an anonymous couple browsing pre-conversion skips it (the SecureAccountBanner nudges them first).

Flow: anon onboarding → picks held (not sent) → secure account (convert-in-place) → re-login → dashboard → inquiries auto-fire to the held picks. Respects consent (only couples who opted into matches get a flag) and the vendor token economy (vendors only ever receive inquiries from real, contactable couples).

All dormant until anon-draft is live (no anon users → no held intent → the `after()` call is a one-cheap-query no-op). No schema change (JSONB flag on the existing `style_preferences`). tsc clean.

SPEC IMPACT: onboarding inquiry model — deferred dispatch on conversion. Logged in `DECISION_LOG.md`.
