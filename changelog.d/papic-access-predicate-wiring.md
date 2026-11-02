## 2026-07-21 · feat(papic): wire the guest-pass access predicate — it had zero production callers

`papicGuestPassAccess()` shipped in PR #3423 and **nothing consulted it.** Every hit outside
`lib/papic-event-access.ts` was its own test file or a prose comment. This is that wiring.

**Why the surface gate is not enough.** The Studio grid gates add-ons with
`surfaceEnabled(profile, a.surface)`. `papic-guest` is tagged `surface: 'rsvp'` — but **`travel`'s
profile DOES enable `rsvp` in prod** (migration `20270804110223`). So the surface check alone would
offer the flat per-event guest pass on a **roaming, multi-day trip**, where "per event-day" is
structurally the wrong unit. That is a fake door, and it is exactly what the predicate exists to stop.

`papicGuestPassAccess()` carries the permanent `travel` deny, the **anniversary community split**
(a couple's 25th is Phase 1; a community-owned one is Phase 2), and the phase ladder — and it **fails
closed**: a new event type does not inherit the pass merely by having an RSVP surface.

**`community_id` is joined onto the Studio hub's existing `Promise.all`** — no extra round trip. It
deliberately does *not* go into `resolveProfileByEvent`, which reads only `event_type` and is shared
by every surface; widening it would make every caller pay for a column one add-on needs.

### ⚠ This makes nothing purchasable

`papic-guest` remains `status: 'coming_soon'` and all four `PAPIC_GUEST*` catalog rows remain
`is_active = false`, blocked on **DPO gates 0d/0e** — the guest-media ROPA row, and confirmation that
the RSVP consent text names guest-phone capture *and* face-sorted delivery.

**This change only narrows WHO would ever see the card.** Flipping it live is a separate, DPO-gated
change, and doing it in the same PR would have coupled a safe correctness fix to a compliance
decision.

`tsc --noEmit` clean · all 8 `papic-event-access` unit tests pass.

SPEC IMPACT: closes the "zero production callers" gap noted in
`Papic_Website_Strategy_Council_Verdict_2026-07-20.md` § 5 (D2). The doorway flip (D3) stays open.
