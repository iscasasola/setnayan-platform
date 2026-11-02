# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · feat(events): surprise-mode ("hidden website") for surprise events

Owner-locked 2026-07-12 (chosen scope: "just the hidden website"). Some events are a **surprise for the guest of honour** — a surprise 50th anniversary the kids plan, a surprise 60th for Lola. The one way the app could spoil it is the event's **public website**: if the link leaks, the honoree can stumble on it. This adds a one-tap "keep it hidden until the day" control that **reuses the machinery we already have** — no new gate, no RLS surgery, no change to the public page.

- **migration `20270801100000_events_is_surprise.sql`** — `events.is_surprise BOOLEAN NOT NULL DEFAULT FALSE`, a host-side framing marker. The actual seal stays `landing_page_visibility` + `scheduled_launch_at`. Existing events RLS covers it (no policy change).
- **`lib/event-surprise.ts`** (new, pure) — `resolveSurpriseState(event, now)` → `{ isSurprise, sealed, revealAt, needsRevealDate }` on top of `resolveEffectiveVisibility`. The load-bearing bit is `sealed`: the surprise protects the honoree exactly while the site reads private, and stops the instant the scheduled reveal is due. `surpriseRevealAtFor(eventDate)` → the reveal instant (event date at local midnight). 7 unit tests.
- **`website/privacy/actions.ts`** — `setSurpriseMode`: ON → `is_surprise=true` + `landing_page_visibility='private'` + `scheduled_launch_at = <event date>` (so the cron-free read-time auto-launch reveals it on the day); OFF → clears the flag only, **never auto-publishes** (host reveals deliberately). Same host gate + revalidation as the visibility toggle.
- **`website/privacy/page.tsx`** — a "🤫 Surprise mode" card beside the visibility picker (non-wedding events only — a wedding isn't a surprise to the couple). States: off → invite; on+scheduled → "hidden, reveals on <date>"; on+no-date → "set your event date"; on+revealed → "the surprise is out".

The People-layer is attribute-only (owner 2026-07-12): the honoree is event data, not a login, so the website is the only leak surface — which this fully covers. The gender-reveal "sealed result" (a secret-keeper submits via a private link) is a deliberately separate, larger build, not in this PR.

Verified: `tsc --noEmit` clean; surprise suite 7/7. Public-page render unchanged (the seal already respected `scheduled_launch_at`); the card is server-rendered — live visual on the Vercel preview.

SPEC IMPACT: New free capability — surprise events keep their public website hidden until the event date (owner-locked 2026-07-12, scope "hidden website"). New column `events.is_surprise`. See `Event_Onboarding_Signals_All_Types_2026-07-12.md` (cross-cutting capability #3, surprise-mode).
