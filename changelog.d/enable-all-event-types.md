## 2026-07-11 · feat(event-types): enable all active event types in the couple create-event picker

Flip `enabled=TRUE` for the four staged `event_type_vocab` rows — **Anniversary 💞 · Graduation 🎓 · Reunion 🤝 · Gala Night 🌟** — so all fourteen active types are now couple-facing in `/dashboard/create-event` (was ten: wedding, debut, gender_reveal, birthday, celebration, travel, corporate, tournament, christening, simple_event).

Migration: `supabase/migrations/20270726622326_enable_all_event_types.sql` — a scoped, idempotent `UPDATE ... SET enabled=TRUE WHERE status='active' AND enabled=FALSE` (mirrors `20270307211733_enable_simple_event_in_create_picker.sql`; cannot resurrect a retired type).

The four newly-enabled types have no dedicated `onboarding_href`, so they create via the generic inline create-event form and render dashboard terminology through the `GENERIC_PROFILE` fallback in `resolveProfile()` — no seeded event-type profile row required. `EVENT_TYPES_FALLBACK` (the fail-open hardcoded roster) is intentionally NOT changed, per the roster convention.

SPEC IMPACT: Roster launch-state change — all 14 active event types are now visible to couples (was 10). Follow-up (not blocking): tailored onboarding flows + seeded profiles/terminology for the newly-enabled types. Logged at the bottom of `DECISION_LOG.md` in the spec corpus.
