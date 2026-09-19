## 2026-09-19 · fix(money): a refused catalogue/price read still falls back, but no longer silently (S41 · batch 2 of the money tier)

`result-dropped-silently` (S26 both-ends baseline, #5625), MONEY tier: 20 price
and catalogue readers took the SAME branch for "the catalogue refused the read"
and "the row is missing / retired", then returned a fallback with nothing left
behind. The fallbacks are deliberate and unchanged — seat ₱250, branch ₱1,000,
Setnayan Pay 5%, application fee 0, the add-on constants, "no price shown" for
Papic packs. What changes is that a REFUSAL now records `[supabase-error] <site>`
with the error object, and a genuine missing row still records nothing.

Sites: `v2-catalog` ×4, `v2/sku-catalog-v2`, `vendor-3d-booth-pricing`,
`vendor-addon-pricing`, `vendor-branches`, `vendor-seats`,
`vendor-deep-search-addon`, `vendor-photo-challenge`, `vendor-custom-catalog`,
`vendor-papic-grants` ×2, `vendor-verification`, `payouts`,
`moodboard-render-credits` ×2, Papic pool card + guest buy panel rung prices.

Why a record and not a render: none of these readers states an absence to a
person — each prices something with a documented fallback — so the missing end
was the reason, not a screen. `console.error`, not `logQueryError`, because
several of these modules are imported by client components and Sentry is
deferred in the browser bundle.

Pinned by `lib/price-reads-keep-their-reason.test.ts` (7 readers executed
against a refusing and a missing stub; reverting two sites turns 2 of 14 red).

SPEC IMPACT: None
