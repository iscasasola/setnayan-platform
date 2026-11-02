## 2026-07-31 · fix(event-types): the last three ACTIVE types had no profile row

All sixteen event types are `status='active'` and `enabled=true` in prod (owner 2026-07-31: *"all must be active. ALL EVENTS."*). Three of them — **gala_night · date · hangout** — had no `event_type_profiles` row at all.

They are not broken. `resolveProfile()` falls back to `GENERIC_PROFILE`, which enables website · rsvp · seating · budget · schedule · day_of · gallery, so those surfaces work today. They are **undeclared**, which is a different problem: `onboarding_flow_key`, `role_set_key` and all six content-pack keys come back **null**, while every other active type names its own flow. These three ride a default nobody chose.

The risk is the next reader, not today's user. Any future column on this table whose consumer doesn't go through `resolveProfile()`, or any path that reads the row directly, degrades for exactly these three — and the symptom is a wrong **value**, not an error. That failure mode is this codebase's most expensive one; declaring the rows costs one INSERT each.

**Values were taken from shipped neighbours, not invented.** `gala_night` mirrors `corporate` (formal, organizer-run, VIP guests — and it sits with corporate/debut at Tier B in the AI ladder), `multi_day` FALSE because a gala is one night by name. `date` and `hangout` keep plain host/table wording. `marketplace_enabled` stays TRUE on all three — `date` and `hangout` are genuinely tiered for vendors (restaurant, florist, cake already map to them); `simple_event` remains the only marketplace-off type.

`event_class = 'community_eligible'`, matching celebration / anniversary / corporate. The owner-locked exclusion covers **personal-milestone** types only (wedding · debut · christening · gender reveal · birthday · graduation) — a gala, a date night or a barkada hangout is exactly what a Samahan should be able to own.

**Idempotent** — `ON CONFLICT (event_type) DO NOTHING`, so it never overwrites a row an admin has since authored from `/admin/event-types`. Once a row exists the console is the authority.

Two post-conditions. The first asserts the invariant against `event_type_vocab` rather than a hardcoded list, so a type added later **fails loudly** instead of silently riding the fallback. The second fails if a backfilled row lost the `website` surface — that would 404 every guest page for those types.

**Verified against prod before writing:** PK is on `event_type` (so the conflict target is valid), both CHECK constraints accept the chosen `event_class`/`layer_mode`, `enabled_surfaces` is `text[]`, and all three keys satisfy the FK to `event_type_vocab`. A read-only simulation confirms the invariant holds after these three and only these three.

SPEC IMPACT: None. No behaviour changes — this records the configuration these types were already running on.
