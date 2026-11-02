## 2026-07-12 · feat(family-graph): faith rites for children on the Year view (Phase 3 · flag-off)

A dependent with a religion surfaces their next RITE on the guardian's year — a Catholic child's Binyag → **First Communion → Confirmation (Kumpil)** (owner-confirmed both), a Muslim child's Aqiqah, a Protestant dedication, INC baptism. Rites are age-windowed but PARISH-DATED, so the moment is a soft "around age N · the parish sets the day" nudge; nothing auto-created.

- **`lib/faith-rites.ts`** — `RITE_LADDER` (per-religion, authored) + `upcomingRite()` (the next rite a child approaches; infant rites surface while <1) + `buildDependentRiteMoments()` (→ Year-view moments, `eventId: null`). 8 unit tests.
- **`year/page.tsx`** — folds rite moments in alongside milestone moments when `dependentPeopleEnabled()` (adds `religion` to the dependents fetch). Gated → zero effect when off.

Inert in production. Consumes a child's birthdate + religion only behind the counsel gate.

SPEC IMPACT: master plan Phase-3 faith rites for children (Faith_Aware_Person_Graph §2 Catholic ladder incl. Confirmation), flag-off.
