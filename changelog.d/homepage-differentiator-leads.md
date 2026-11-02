## 2026-06-20 · feat(marketing): homepage narrative leads with the differentiator (owner-chosen)

The `FeaturesNarrative` step-through buried Papic + Setnayan AI in panel 2 behind the free-tools panel — the table-stakes ground incumbents occupy. Owner chose "reorder — differentiator leads." Reordered to **Overview → Premium (the moat) → Free tools → Marketplace**:

- `app/_components/marketing/FeaturesNarrative.tsx` — swapped the `step===1`/`step===2` render, fixed each panel's `StepDots current` (0/1/2/3 preserved), rotated the three `NextBtn` labels, reframed the Overview intro to lead with the moat ("a live guest photo gallery, an AI that finds your vendors — the things other planners don't have"), reframed the premium eyebrow/heading ("What others don't have" / "Where Setnayan goes further"), and led both paid arrays (`PAID_FEATURES`, `OVERVIEW_PAID`) with Setnayan AI + Papic. Free-first value preserved via the premium panel's "the planning always stays free" bridge.

SPEC IMPACT: None (homepage copy/ordering; no SKU / schema / pricing / branding change).
