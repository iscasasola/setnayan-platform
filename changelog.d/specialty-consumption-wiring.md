# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · feat(checklist): surface the specialty recommendations as suggested tasks (consumption wired)

Closes the loop: the specialty recommendations engine (the deterministic consumer of the captured signature signals) was merged but wired to nothing. This connects it to the couple's planning checklist, so the captured signals finally produce something a user sees.

- **`app/dashboard/[eventId]/checklist-actions.ts`** — `ensureChecklistSeeded` now reads `events.signature_details`, runs `specialtyRecommendations(eventType, signatureDetails)`, and appends the results (mapped to `ChecklistTemplateItem`) to the per-type static template before `buildSeedRows`. Because the seed goes through the existing idempotent **top-up** path (insert only `missing` keys), the suggested tasks appear on a **brand-new event AND on an already-seeded one the moment its signals are captured** — without touching the couple's existing/done rows. Non-wedding path only; empty when nothing signature-worthy was captured → the seed is byte-identical to before.

Examples (from a real captured brief): a debut with a cotillion → "Confirm your cotillion court & schedule rehearsals" (vendors, T-110d); named 18 Candles → "Collect a message from each of your 18 Candles" (logistics, T-30d); a christening's ninong/ninang roster → "Collect each godparent's confirmation cert" (paperwork, T-60d).

Keys are distinct from the static template keys (de-dupe by `template_key`; unique index on `event_id+template_key` handles any race). No schema change (`signature_details` landed in #3144). Behind the same flag as the capture.

**Now genuinely end-to-end:** captured specialty signals → recommendations → checklist tasks the couple sees + completes. The parallel event-brief workstream's nudge-template engine can read the same recommendation source (complementary surface).

Verified: `tsc --noEmit` clean; checklist + recommendations suites 29/29; a direct pipeline check (captured cotillion → two real seed rows).

SPEC IMPACT: The captured specialty signals now drive real, user-visible suggested checklist tasks (deterministic, Rule 1). No pricing/schema change. See `Event_Onboarding_Signals_All_Types_2026-07-12.md`.
