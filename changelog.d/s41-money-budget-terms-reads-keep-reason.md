## 2026-09-19 · fix(money): a refused budget / floor-plan / service-terms read still degrades, but leaves its reason (S41 · batch 4 of the money tier)

`result-dropped-silently` (S26 both-ends baseline, #5625), MONEY tier, last
batch: 14 readers that feed money arithmetic with a documented degrade — the
budget allocator's config and benchmarks, budget bands, the budget's package
customisations, the checklist budget-health read, the floor plan (seating +
the story spine), and a service's payment schedule, price brackets and
discounts. The degrade stays; a REFUSAL now records `[supabase-error] <site>`
with the error object instead of reading, in every log, exactly like "the
supplier set no discount" or "no floor plan yet".

Sites: `budget-allocation-data` ×2, `budget-bands-read`, `budget`
(package customisations), `checklist-budget`, `seating`, story `spine-data`,
`vendor-service-payment-schedules` ×2, `vendor-service-public` ×2,
`vendor-services` ×2.

Pinned by `lib/budget-and-terms-reads-keep-their-reason.test.ts` (9 readers
executed against a refusing and an empty stub; reverting `vendor-services.ts`
turns 2 of 18 red).

With batches 1–4 (#5650, #5652, #5653, this) the MONEY tier's
`result-dropped-silently` lines read 0 under #5625's scanner, excluding the five
`lib/booking-fee-*` sites owned by S6 (#5615) and S34.

SPEC IMPACT: None
