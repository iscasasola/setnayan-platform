## 2026-07-15 · feat(schema): composable-event foundation — event classing + service nature + multi-day hook

Additive, behavior-neutral scaffolding for the composable-event build (reservations · dining · goods · communities/Samahan · multi-day · coordination). Nothing consumes the new columns yet; every default preserves current behavior byte-for-byte (deny-by-exception, copying the `marketplace_enabled` pattern).

- `event_type_profiles.event_class` (`personal` | `community_eligible`) — owner-locked 2026-07-15: a community can never own personal-milestone types. Seeded: simple_event / corporate / travel / celebration / tournament / reunion / anniversary → community_eligible.
- `event_type_profiles.layer_mode` (`anchored` | `roaming`) — routes the food layer (catering vs timed dining reservations). Seeded: travel → roaming.
- `event_type_profiles.multi_day` — "one event, several days" switch. Seeded TRUE: wedding · travel · reunion · corporate.
- `service_categories.service_nature` (`reservation` | `service` | `goods` | `in_app`, default `service`) — the 4-class spine of the composable stack.
- `events.event_end_date DATE` (nullable) + `events_end_date_after_start` CHECK — the multi-day hook `lib/payouts.ts` already anticipates by name.
- `lib/event-type-profile.ts` reads the trio via the deploy-order-safe optional-column retry; hard-coded fallback profiles carry matching values.

Verified against prod schema in a rolled-back transaction (all 13 profile rows seed correctly; idempotent on double-run).

SPEC IMPACT: Implements the foundation step of `Composable_Event_Build_Map_2026-07-15.md` (+ vision doc `Composable_Event_Coordination_and_Token_Model_2026-07-15.md`) in the spec corpus — both already document these exact columns/seeds; no further corpus edit needed.
