## 2026-07-31 · fix(papic): re-wire the Pool eligibility gate, drop retired rungs, derive the clip weight

Found by walking a real **Simple Event** end to end on prod (the first one ever
created — `events` had zero `simple_event` rows) and using Papic Pool on it.

**1. The Papic Pool eligibility predicate had no effective callers.**
`papicGuestPassAccess()` was wired into `app/dashboard/[eventId]/studio/page.tsx`
— a page that now `redirect()`s to `/suite` on its first statement whenever
`NEXT_PUBLIC_SUITE` is on, which it is in prod. The live renderer,
`app/dashboard/[eventId]/suite/page.tsx`, checked only the generic
`surfaceEnabled(profile, a.surface)`. Since migration `20270804110223` added
`rsvp` to **every** non-wedding profile row — all 16 types carry it in prod
today — the surface check alone admitted the pool on every event type,
**including `travel`**, which is on the permanent V1 deny list for a documented
bystander/DPA reason. The predicate, its travel deny, its anniversary controller
split and its fail-closed branch for unscoped types are now called from Suite.

The unit tests passed throughout: they exercise the predicate, and the predicate
was never wrong — the surface obliged to call it simply stopped being the
surface. Verify the CONSUMER, not the helper.

**2. `simple_event` added to `PAPIC_ACCESS_PHASE_1_TYPES`.** Wiring the gate
without this would have *retracted* a live offer rather than failed closed:
`commitSimpleEvent` arms the free 50-pt pool grant at create, and the onboarding
services card prints all three paid Pool rungs on this exact type. It satisfies
the predicate's own axis (the host writes the roster; role set `simple` is a
single flat `guest`; profile enables `rsvp`; single-day and anchored, so a pass
metered per event-day is the right unit) and it matches the 2026-07-27 lock,
"Papic on ALL 16 event types". `travel` remains denied at every phase.

**3. The studio was selling two RETIRED SKUs.** `studio/papic/page.tsx` mapped
the static `PAPIC_RUNGS` vocabulary straight to the extra-cameras picker and
never read `papic_tier_config.is_active`. Both `ltd` (migration
`20270828150000`) and `unlimited` (`20270830568357`) are inactive, as are their
catalog price rows — so they rendered on a live buy button at ₱50 / ₱200, quoted
off the fail-closed FALLBACK constants that exist so a retired rung cannot quote
₱0, not so it can keep selling. It also broke the 2026-07-30 naming lock: "Papic
Ltd" and "Papic Max" are not products. Now filtered before the map, and the
picker renders nothing when no rung survives.

**4. Clip capacity was overstated ~2.9×.** `extra-cameras-picker.tsx` computed
`Math.floor(pointsPerDay / 3)` while the fail-closed capture path meters a
10-second clip at `PAPIC_POINTS_PER_CLIP` (moved 7 → 8 by the 2026-07-29
currency lock). Live copy read "70 points a day — 70 photos, or 23 clips"; the
true figure is 8 clips, confirmed against `papic_reserve_event_points_for_seat`
on prod. Now renders `papicCapacityPhrase()`, which also fixes the SHAPE — "N
photos, or M clips" reads as two independent allowances when it is one purse.

**5. Guardrail gap closed.** `lib/papic-copy-guardrails.test.ts` never listed
`extra-cameras-picker.tsx`, and could not have caught this anyway: every regex
in it scans for literal DIGITS IN THE COPY, but the copy was a template literal
with no digits at all — the wrong number was manufactured one line earlier by
the divisor. Added the file, and added `COMPUTED_POINTS_DIVISOR`, which fails CI
on any points value divided by a literal. A guardrail that only reads the
sentence cannot see a lie that is computed.

SPEC IMPACT: `DECISION_LOG.md` — Papic Pool access widened to `simple_event`
(phase 1). Owner-surfaced in the PR body; `travel` deny unchanged.
