# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-12 · feat(schedule): free Run-of-Show — per-type day-of program for non-wedding events

Owner-locked 2026-07-12: **Run-of-Show is FREE** (not a paid Kasangga tier). Weddings already got a schedule spine (`buildScheduleSeed` — Ceremony · Cocktails · Reception · After Party + ceremony parts); every OTHER event type opened its Schedule tab **empty** and built the whole program by hand. This authors a per-type Filipino program and seeds it on first open.

- **`lib/schedule-run-of-show.ts`** (new, pure) — `buildRunOfShowSeed(eventType, signatureDetails, eventDate)` → editable schedule blocks. Authored programs for **debut · birthday · christening · anniversary · reunion · corporate · gender_reveal · graduation** + a generic spine for the rest. Core beats always show (the 18s, the reveal, the awarding); a few are **signal-gated** so we never promise a beat the host isn't running (cotillion, renewal of vows, in-memoriam, guessing game). Notes are **enriched from the captured brief**: a captured cotillion → "Court of N. Schedule rehearsals 4–8 weeks out"; named 18 Candles → the names; a reveal method → the method + "confirm supplier & secret-keeper". Returns `[]` for weddings (they own their seed) — deterministic, Rule 1, no LLM.
- **`app/dashboard/[eventId]/schedule/actions.ts`** — `seedNonWeddingRunOfShow(eventId)`: idempotent first-open seed. Verifies access via the RLS-gated SELECT, skips if any block exists, reads `event_type` + `event_date` + `signature_details`, writes flat blocks with the admin client (a first-open fixture, mirroring the wedding `seedDefaultScheduleBlocks` guards). Wedding → 0 (untouched).
- **`app/dashboard/[eventId]/schedule/page.tsx`** — fires the seed **only when the schedule loads empty on a non-wedding event**, then re-fetches. Zero added cost on every later load (blocks exist → skipped). Wedding path byte-identical.

**Bonus:** the existing **emcee-script** generator reads these same blocks, so seeding a run-of-show also lights up the host script for non-wedding events (program-as-object, partially delivered). And this is the **second consumer** of the captured specialty signals (after the checklist), so a richer onboarding now visibly improves the day-of program.

Verified: `tsc --noEmit` clean; run-of-show 10/10; schedule + emcee suites 25/25 (wedding path unchanged); a debut sample renders the full program with enriched notes.

SPEC IMPACT: Non-wedding events now get a free, deterministic, per-type day-of Run-of-Show (owner-locked FREE 2026-07-12). No pricing/schema change. See `Event_Onboarding_Signals_All_Types_2026-07-12.md` (program-as-object capability).
