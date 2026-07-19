## 2026-07-12 · feat(vendors): budget planner's compat % now reflects faith fit

Follows PR #3177 (budgetFit on the same %). The couple's budget-planner accordion compat % now also feeds `compat-score`'s `faithMatch` → `faithFit` dim (0.07) — the last cheap dim left frozen there. `vendor_market_stats` already exposes `compatible_ceremony_types` and the accordion enrichment already queries that view, so this is a `select` addition (no new query/join): each vendor gets `faith_match: true` only when it EXPLICITLY serves one of the couple's faiths, NULL vendor faiths = "serves all" → neutral (never a penalty). Mirrors the category-search overlay exactly.

Couple faiths come from `buildEventBrief(ev).constraints.ceremony.faiths` — this makes the accordion a genuine **Event Brief object** consumer (raw lowercase ceremony ids, the same representation category-search uses; a `buildCoupleFaithSet` `WeddingFaithKey` set is title-case and would never intersect the lowercase `compatible_ceremony_types` — an adversarial review caught exactly that no-op before merge). Stamped onto `AccordionPick` via `VendorEnrichment`; both accordion `computeCompatScore` sites feed it, so a positive faith match lifts the % and adds the "matches your ceremony" reason. No schema change.

Deferred (own follow-ups): `dateHeadroom` (0.08, frozen everywhere) needs a multi-date availability RPC; checklist priority-tailoring needs an authored priority→category map.

SPEC IMPACT: None (behaviour — matching signal, no schema/pricing change; further realises the Event Brief → compat-score wiring).
