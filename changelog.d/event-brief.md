## 2026-07-12 · feat(ai): the Event Brief — one deterministic read-model from onboarding

Add `apps/web/lib/event-brief.ts` (`buildEventBrief`) + `event-brief.test.ts` (7 tests). The Brief is the single object Setnayan AI reads: it normalises the scattered onboarding persistence — typed `events` columns + the `style_preferences` / `love_story` / `experience_axes` JSONB blobs — into four layers (Constraints · Priorities · Taste · Story), plus a `richness` 0–1 completeness score.

Under **Rule 1** (Setnayan AI is 100% deterministic and absolutely free — no LLM, no per-call cost; owner-locked 2026-07-12), the Brief IS the intelligence: with no model to reason over thin context, output quality = brief richness × authored-rule richness. This is the shared foundation every downstream deterministic engine reads — the adaptive checklist, the `compat-score` scorer, the nudge templates — instead of re-deriving from raw columns.

Universal across all 14 event types: a wedding yields a rich Brief (`richness` 1.0 when fully answered), a simple event a thin one (~0.1), an empty row a safe zeroed Brief. Every field admits-unknown (null/empty), never throws; JSONB is tolerated as parsed object OR raw string; numeric columns coerce from strings. Pure in / pure out — no DB, no network, no LLM.

First of a sequence (per the onboarding signal map): this lands the read-model; follow-ups wire it into the scorer's computable dimensions, drive the adaptive checklist, and turn on the Priorities/Story capture layers.

SPEC IMPACT: None (new deterministic lib; no schema, pricing, or roster change). Reinforces the locked "Setnayan AI = deterministic + free" decision.
