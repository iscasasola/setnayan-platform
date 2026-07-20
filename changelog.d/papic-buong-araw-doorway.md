## 2026-07-20 · feat(papic): Buong Araw doorway + event-type access predicate (gates 0g + 0h)

Phase-0 gates **0g** and **0h** of `Papic_Access_Scope_Council_Verdict_2026-07-20.md`.
The flat, event-level guest-camera pass (**Papic Buong Araw** · SKU `PAPIC_GUEST`)
had **no app-wide doorway** — its only mention outside checkout was the wedding
onboarding pricing list — and **no event-type predicate anywhere**
(`platform_retail_catalog_v2` has no event-type column; `/papic/guest` never read
`events.event_type`). The blocker on opening access was the missing doorway, not
a gate.

**Added — `apps/web/lib/papic-event-access.ts`** (new): one pure, synchronous
predicate, `papicGuestPassAccess()`, so no surface hand-maintains its own
allow-list.

- Phase 1 = closed-roster personal types (wedding · debut · birthday ·
  christening · gender_reveal · graduation) **plus** `anniversary` when
  `events.community_id IS NULL`; Samahan-owned anniversary is Phase 2.
- `travel` is an **explicit permanent V1 deny** at every phase. It cannot be left
  to the surface check: migration `20270804110223` added `rsvp` to *every*
  non-wedding profile row, so travel's profile enables `rsvp` in prod today.
  `layer_mode='roaming'` + `multi_day` make "per event-day" the wrong unit.
- `simple_event` falls out of `surfaceEnabled(profile,'rsvp')` — asserted by
  test, not hand-listed. (Belt-and-braces: it is also in no phase set, which
  matters because its profile row predates the 20270804110223 unlock.)
- **NOT** `event_type_profiles.event_class` — that column is an *ownership* axis
  ("may a community own this type?") and seeds anniversary community-eligible.
  The memory note directing its use is corrected by the verdict § 0.3.

**Added — `add-ons-catalog.ts` entry `papic-guest`** ("Papic Buong Araw",
`surface: 'rsvp'`, `serviceKey: 'PAPIC_GUEST'`, Capture group) + an `addOnHref`
branch routing it at the real Papic set-up surface so the row can never 404.
Ships **`status: 'coming_soon'`** on purpose: gates 0b (owner DB action pricing
`PAPIC_GUEST` off the pax curve — the live catalog row still says ₱2,999), 0c
(event-scoped points pool), 0d/0e (ROPA row + DPO consent-text sign-off) are all
open, so a live card would advertise a wrong price against a buy path that cannot
honour it. Flipping to `'live'` is a one-word change guarded by a test.

**Changed — `app/papic/guest/page.tsx`**: de-wedded. "for this wedding" and the
`'the wedding'` name fallback are gone; every state now names the event itself
(fallback "this event") and no copy assumes a couple. The event-name read moved
into the existing ownership `Promise.all` (same query count) so the
cameras-not-on state can name the event too.

No price changed. `PAPIC_GUEST` is **not** reactivated or repriced — that stays an
owner DB action.

SPEC IMPACT: None (implements a verdict already in the corpus at
`Papic_Access_Scope_Council_Verdict_2026-07-20.md` § 2 + § 5 gates 0g/0h).
