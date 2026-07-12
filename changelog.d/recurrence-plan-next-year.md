# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · feat(events): recurrence — "Plan next year" clones a recurring event forward

Owner-locked 2026-07-12, clone scope **"Details, not the guest list"**. Events that come back every year (birthdays, anniversaries, reunions, annual corporate galas) shouldn't be rebuilt from scratch. This adds a one-tap "Plan next year" that clones the event's identity + captured details forward into next year's fresh planning instance.

- **`lib/event-recurrence.ts`** (new, pure) — `RECURRENCE_CAPABLE_TYPES` (birthday · anniversary · reunion · corporate) + `canPlanNextYear(type)` + `buildNextYearClonePayload(source)`. **Carries forward:** name, type, the Event-Brief `signature_details` (honoree, theme, rosters), the recurring `anchor_date`, rough scale + location, and `recurs=true`. **Starts fresh:** the guest list, schedule, payments, venue, and the date (`event_date=null`, date-as-output). Wedding-CHECK columns null/false by construction. 8 unit tests.
- **`create-event/actions.ts`** — `planNextYearEvent(formData)`: RLS-gated source read (a non-member reads NULL → bounced), `canPlanNextYear` guard, then **mirrors `createWeddingEvent`'s exact write path** — `generateUniqueSlug` + admin `events` insert + `event_members` couple row + the `on_event_created` trigger — so slug uniqueness, `is_primary`, and every CHECK behave identically. Redirects to the new event.
- **`dashboard/[eventId]/page.tsx`** — a "Make it an annual tradition · Plan next year" card in the home overlays, shown only for recurrence-capable events (added to `hasOverlays`).

Surfaced a real gap this closes: only anniversaries got `recurs=true` at creation (`recurs: isAnniversary`); birthdays/reunions/corporate weren't marked recurring, so the affordance is gated on a **type-set**, and the clone always stamps `recurs=true`.

Verified: `tsc --noEmit` clean; recurrence suite 8/8. Server-rendered card — live visual on the Vercel preview.

SPEC IMPACT: New free capability — recurring events can be cloned forward a year (owner-locked 2026-07-12, "Details, not the guest list"). No schema change (reuses `recurs`/`anchor_date`). See `Event_Onboarding_Signals_All_Types_2026-07-12.md` (cross-cutting capability #4, recurrence).
