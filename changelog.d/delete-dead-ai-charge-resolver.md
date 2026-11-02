## 2026-09-18 · chore(pricing): delete the callerless `resolveSetnayanAiEventChargeCentavos`

`resolveSetnayanAiEventChargeCentavos` (the superseded intro/renewal-cadence
Setnayan AI charge resolver) has had zero callers — TS or SQL — since the
2026-07-22 per-type ladder replaced it. Deleted the function and its dedicated
test file (`setnayan-ai-event-pricing.test.ts`), and dropped the now-unused
import in `setnayan-ai-event-pricing.ts` and the superseded-path test in
`sec7-refuse-rather-than-guess.test.ts`. `SETNAYAN_AI_RENEW_SKU` stays: the
`'SETNAYAN_AI_RENEW'` catalog code is still read directly elsewhere.

SPEC IMPACT: None.
