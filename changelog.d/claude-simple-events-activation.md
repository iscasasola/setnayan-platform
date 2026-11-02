## 2026-06-27 · feat(events): Simple Event type — activation (PR2)

Activates the **Simple Event** type (foundation in PR1): a vendor-free event for
exercising Setnayan's in-app services. Date-only onboarding, no vendor
marketplace, generic single-`guest` guest list.

- **`/onboarding/simple`** — lean date-only flow (event name + date →
  `commitSimpleEvent`, which sets `events.event_date` with day precision and
  NULLs every wedding CHECK column). The picker routes here via
  `event_type_vocab.onboarding_href`.
- **Per-event-type nav gating** — `buildCustomerMenuTree` + `buildCustomerNavGroups`
  take an optional `hideKeys`; the event layout resolves the profile once and
  drops **Explore** (when `marketplace_enabled=FALSE`) and **Budget** (when
  `budget` isn't an enabled surface). Wedding + all existing types resolve to
  `[]` → byte-identical. Studio (in-app services), Home, Guests stay.
- Migration `20270307211733` — flips `simple_event` `enabled=TRUE` so it appears
  in the create-event picker.
- `lib/customer-menu.test.ts` — locks the gating + the byte-identical default.

SPEC IMPACT: Simple Event type live in the create-event picker (iteration 0053
Event-Type Engine lineage). Decision-log row appended.
