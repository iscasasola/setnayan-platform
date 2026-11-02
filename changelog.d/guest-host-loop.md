### Guest→host growth loop — CTAs + conversion instrumentation (PR-F slice)

The strategy's #1 growth lever: at the moments a wedding guest is most delighted, a soft "start your own event" nudge — turning every wedding's ~150 guests into the next host cohort at ~₱0 CAC. This is the visible loop + the metric; persistent guest accounts (the addressability enhancement) are a separate later pass.

- **`app/_components/guest-to-host-cta.tsx`** (NEW) — a tasteful CTA card linking to `/signup?ref=guest&src_event=<public_id>`. Fires `guest_to_host_cta_shown` (once, strict-mode-guarded) + `guest_to_host_cta_clicked` to PostHog. **No PII** — only `surface`/`event_id`/`event_public_id`/`destination`. Lazy-imports posthog; every capture try/caught so telemetry never breaks the page.
- **Mounted on the two highest-intent guest surfaces** (`app/[slug]/page.tsx`): the RSVP confirmation ("Your place is reserved") and the "Your Photos" widget. (Day-of hub deferred — too noisy live.)
- **Attribution** — `app/signup/page.tsx` threads `ref`/`src_event` through; the `signUp` action fires `guest_to_host_signup` (no-PII: `attributed_to_event_public_id` + `ref`) on a successful guest-sourced signup, next to the existing `signup_completed` capture. Lets us measure the **north-star metric: % of an event's guests who create their own event** — no DB change needed.

SPEC IMPACT: None (growth instrumentation on existing guest surfaces).
