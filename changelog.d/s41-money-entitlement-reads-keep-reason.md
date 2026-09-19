## 2026-09-19 · fix(money): a refused entitlement / order / token read still fails closed, but leaves its reason (S41 · batch 3 of the money tier)

`result-dropped-silently` (S26 both-ends baseline, #5625), MONEY tier: 15 readers
that answer "has this been paid for or granted?" took the SAME branch for a
refusal and a genuine "no", and recorded nothing. Failing closed stays — a gate
must not open on an unreadable answer — but a couple locked out of something
they PAID for (RLS drift, a phantom column) now leaves `[supabase-error] <site>`
with the error object, instead of looking in every log exactly like a couple who
never bought it.

Sites: `entitlements` ×2 (comp grant, active comp SKUs), `papic-cameras` order
paid, `payable-by-reference` (still "not found" to the visitor, by design),
`upcoming-items` renewal orders, `vendor-3d-booth-event-pricing`, `self-purchase`,
`setnayan-gift.server` ×2, `live-studio-encoder-tokens` insert,
`vendor-autoreply/auto-accept` wallet + holds, `vendor-credit-warning` sweep,
`event-media-sweep` e-gift methods, `communities` invite token.

Pinned by `lib/entitlement-reads-keep-their-reason.test.ts` (6 readers executed
against a refusing and an empty stub; reverting `entitlements.ts` turns 2 of 12
red).

SPEC IMPACT: None
