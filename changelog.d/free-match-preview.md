## 2026-07-12 · fix(vendors): free "% match" floor survives the AI paywall (Gap 2 · Eventchy-parity)

Gap 2 fix: the vendor "% match" signal (pill + compat ranking + reception-proximity sort) is table-stakes against the free-AI rival, so it must stay FREE for every couple even after `SETNAYAN_AI_PAYWALL_ENABLED` flips ON. Previously these three signals were gated on the FULL Setnayan AI gate (`isSetnayanAiActiveForUser`), so flipping the paywall on would have hidden the advertised free "match preview" entirely (`aiActive` → false when the paywall is on and the event hasn't purchased).

Introduced a new free-tier floor keyed ONLY on the couple's own Assisted↔Manual toggle (`planning_mode`), never on the paywall/entitlement. The DEEPER AI behaviors (whole-plan auto-build, the dependency/eyeing nudge stream, deadline chips, last-minute surfacing, the AI-off-empty rule) stay behind the paywall on `aiActive` exactly as before.

- **`lib/setnayan-ai.ts`**: new `isMatchPreviewFree(event)` = `planning_mode !== 'manual'`. While the paywall is OFF this equals `isSetnayanAiActive`, so today's behavior is byte-identical; only when the paywall flips ON do they diverge — and that divergence IS the fix (the match preview survives).
- **`lib/vendors-plan-budget.ts`**: `PlanBudgetModel` input + `AccordionChild` gain a `matchPreviewEnabled` field, defaulting to `personalizationEnabled` when omitted (byte-identical for tests / other callers). The "% match" pill reads it; deadlines/dependency/dueList keep `personalizationEnabled`.
- **`app/dashboard/[eventId]/vendors/page.tsx`**: threads `matchPreviewEnabled: isMatchPreviewFree(ev)` into the model (kept `personalizationEnabled: aiActive`).
- **`app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx`**: the card pill + CompareSheet pill now gate on `matchPreviewEnabled` instead of `personalizationEnabled`; the deadline chip stays on `personalizationEnabled`.
- **`app/dashboard/[eventId]/vendors/_actions/category-search.ts`**: compat-score computation + reception-proximity sort now gate on `matchPreviewFree = isMatchPreviewFree(ev)`; last-minute searchability + the AI-off-empty rule stay on `aiActive`.
- **`lib/setnayan-ai.test.ts`**: pins the floor invariants — Manual-only keying, paywall-ON-unpaid → floor survives while the full gate closes, paywall-OFF → byte-identical to the full gate.

Net: flipping `SETNAYAN_AI_PAYWALL_ENABLED` ON no longer removes the basic match signal; with it OFF, behavior is unchanged. `pnpm typecheck` + `lint` + `test:unit` (1607) clean.

SPEC IMPACT: None (behavior guard; live prod runs with the paywall OFF, so no user-visible change today — the fix only matters at the future paywall flip, which stays coordinated with /pricing copy).
