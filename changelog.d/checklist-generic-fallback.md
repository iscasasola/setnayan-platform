## 2026-07-12 · fix(checklist): generic fallback so typeless event types never open a blank checklist

Enabling all 14 event types (#3127) outran the per-type checklist defs: `getOrSeedChecklist` did `if (perTypeDef == null && !isWeddingEvent(eventType)) return 0` — so **anniversary · graduation · reunion · gala_night · simple_event** (all live to couples) opened the flagship planning checklist to a **blank page**.

Fix: any enabled non-wedding type with no dedicated def now falls back to `GENERIC_EVENT_CHECKLIST_DEF` (a new export reusing the generic `CELEBRATION_TEMPLATE` — purpose · budget · guests · venue · catering · photo · host · program · headcount) instead of seeding nothing. Wedding / unset (→ canonical wedding template) and the eight typed non-wedding defs are byte-for-byte unchanged (`checklistDefForEventType` itself is untouched; the fallback lives at the seed call site). Also refreshed the stale "no importers on landing" module comment.

Tests: +1 in `checklist-event-type-defs.test.ts` (the fallback is valid + the 5 typeless types resolve to null so the caller falls back). `tsx --test`: 35/35 pass.

SPEC IMPACT: None — behaviour fix for live breakage; no schema/pricing/roster change. (Advances `Adaptive_Checklist_Build_Plan_2026-07-08.md` lane C coverage to all enabled types.)
