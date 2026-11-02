## 2026-06-27 · feat(events): Simple Event type — foundation (PR1)

Inert foundation for the **Simple Event** type (owner 2026-06-27): a vendor-free
event whose only purpose is to exercise Setnayan's in-app services. No vendor
marketplace ("Explore" hidden), a generic single-`guest` role list (no
bride/groom, no tiers), and a date-only onboarding (activation PR builds the
flow + flips the type on).

- `lib/role-sets.ts` — new `SIMPLE_ROLE_SET` (offers only `guest`; no
  singletons/tiers/couple roles) registered under key `simple`.
- `lib/event-type-profile.ts` — new `marketplaceEnabled` flag on
  `EventTypeProfile` (deny-by-exception; DEFAULTs TRUE so every existing type is
  byte-identical) + `SIMPLE_PROFILE` fallback + `simple_event` fallback mapping.
- Migration `20270307127948` — `event_type_profiles.marketplace_enabled` column
  (DEFAULT TRUE), plus the `simple_event` vocab row (seeded **enabled=FALSE** —
  not yet in the picker) and its profile row (`marketplace_enabled=FALSE`,
  `role_set_key='simple'`, tools-only surfaces).
- `lib/role-sets.test.ts` — locks the single-`guest` role set + seating tier 4.

Type is seeded disabled → zero behaviour change for all existing event types.

SPEC IMPACT: New `simple_event` type in iteration 0053 (Event-Type Engine)
lineage. Decision-log row to be appended at activation.
