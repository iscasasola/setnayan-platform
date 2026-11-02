# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · feat(onboarding): specialty recommendations engine — first consumer of the captured signals

The audit's top gap was "captured but not consumed": the rich per-type signals landed in `events.signature_details` / the Brief's `specialty` layer, but nothing read them. This lands the first consumer — a deterministic engine that turns the captured signals into **suggested next steps** ("AI suggests + recommends", owner-directed; it never acts).

- **`lib/onboarding/specialty-recommendations.ts`** (new, pure) — `specialtyRecommendations(eventType, signatureDetails)` applies per-type authored rules that read what the host actually captured and emit `SpecialtyRecommendation[]` (`key · title · reason · category · dueOffsetDays`). Examples: a debut with a captured **cotillion** → "Confirm your court & schedule rehearsals (4–8 weeks)"; **18 Candles** named → "Collect a message from each" (counts them); a christening's **ninong/ninang** roster → "Collect each godparent's confirmation cert" (counts them); a gender reveal's **secret-keeper** → "Confirm they have the sealed result"; a reunion's **matching shirt** → "Collect sizes & place the print order". A recommendation only fires when a real captured signal backs it (no signal → none — never invented). Rules for debut · christening · anniversary · birthday · gender_reveal · reunion · graduation · corporate. Output is **checklist-shaped** so the surface adopts it without re-modelling.
- **`lib/onboarding/specialty-recommendations.test.ts`** — 8 invariants: no-signal → none, unknown/null → [], per-type firing (cotillion/candles/godparents/secret-keeper), captured counts + the theme peg echoed into the copy, well-formedness (category/schedule/unique keys), purity + no-mutation.

**Coordination / next step (owner-directed "coordinate + check first"):** this is the deterministic *intelligence*; the SURFACE is the coordinated step. Recommendations are keyed to drop into the DB-seeded checklist (`event_checklist_items` via checklist-actions `ensureSeeded`/sync) as suggested items — a shared engine, so the wiring is left to coordinate with the checklist owners. The parallel event-brief workstream's intended consumer is the **nudge-template** engine; both surfaces can read this one deterministic source (complementary, not competing).

Not wired to a UI yet (by design — the surface is the coordinated step). No schema change.

Verified: `tsc --noEmit` clean; recommendations suite 8/8.

SPEC IMPACT: The captured specialty signals now have a deterministic consumer (suggested next-steps). Surface wiring (checklist) pending coordination. See `Event_Onboarding_Signals_All_Types_2026-07-12.md`.
