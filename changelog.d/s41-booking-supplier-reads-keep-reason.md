## 2026-09-19 · fix(booking): a refused read on a supplier's booking path still degrades, but leaves its reason (S41 · booking 2/5)

`result-dropped-silently` (S26 both-ends baseline, #5625), BOOKING tier, the
supplier's side — 16 sites. Each degrade is deliberate and unchanged (a gate
fails closed, a list reads empty, a badge reads 0); each REFUSAL now records
`[supabase-error] <file> · <target>` with the error object.

Sites: `vendor-dashboard/contracts/actions.ts` ×2 (booking resolve for a
contract), `vendor-dashboard/layout.tsx` (pending-inquiry badge),
`vendor-dashboard/proposals/actions.ts` ×2 (template save, couple's response —
both already redirect with a failure notice), `vendor-addon-first5-free`,
`vendor-first-steps.server`, `vendor-inquirable-gate`, `vendor-overview`
(disputed handovers), `vendor-papic-grants` (accept provenance),
`vendor-services` (booth card items), `vendor-sponsored-shots`,
`vendor-time-slots` ×3, `vendor-waitlist`.

Pinned by `lib/supplier-booking-reads-keep-their-reason.test.ts` (5 readers
executed against a refusing and an empty stub; reverting `vendor-time-slots.ts`
turns its 2 refusal cases red).

SPEC IMPACT: None
