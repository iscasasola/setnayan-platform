# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · fix(events): remove the inert surprise-mode "hidden website" toggle

Owner-decided 2026-07-12 ("keep lean, fix the toggle"). The surprise-mode card shipped earlier the same day (the "🤫 hide your website until the reveal" toggle) rested on a surface that **doesn't exist for its own audience**: it was offered to non-wedding events, but non-wedding event types don't enable the `website` surface in V1 (their profile is `seating, budget, schedule, day_of, gallery` — see `20270221005058_seed_nonwedding_event_type_profiles.sql`), and `app/[slug]/page.tsx` only renders a public event site when `surfaceEnabled(profile, 'website')`. So the toggle sealed a website that was never there — a misleading no-op.

The reframe: **a non-wedding event is already private by default** — no public website, no public RSVP, no save-the-date. There is no pre-event surface a guest of honour could stumble onto, so a surprise party is protected without any special mode. The one thing that blows it is adding the honoree to the event; nothing to seal.

Removed the misleading UI + its dead code:
- **`website/privacy/page.tsx`** — the "Surprise mode" card, the surprise state computation, the `resolveSurpriseState` / `setSurpriseMode` / `Gift` imports, and the `is_surprise, event_type, event_date` select additions (restored to the original select).
- **`website/privacy/actions.ts`** — the `setSurpriseMode` action + the `surpriseRevealAtFor` import.
- **Deleted** `lib/event-surprise.ts` + its test (now unreferenced).

Kept: the `events.is_surprise` column (dormant, harmless — a no-op default FALSE; reserved should non-wedding events ever gain a public website surface). A true surprise-party *experience* (secret invite → RSVP → reveal) needs non-wedding guest-facing surfaces, which are intentionally wedding-only in V1 — deferred as a separate scope decision.

Verified: `tsc --noEmit` clean; no remaining references to the removed symbols.

SPEC IMPACT: Surprise-mode "hidden website" (the same-day toggle) is withdrawn as inert; non-wedding events are documented as private-by-default (surprise-safe without a special mode). The real gap — guest-facing surfaces (website/RSVP/invitations) for non-weddings — is a separate, deferred scope call. Logged in `DECISION_LOG.md`.
