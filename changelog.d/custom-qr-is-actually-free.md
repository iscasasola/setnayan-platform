## 2026-09-06 · fix(pricing): the Custom QR per Guest is actually free, not just priced at zero

Owner: *"keep custom QR per guest free"* — resolving a contradiction the product had been
carrying in public.

**It was already ₱0.00 and still locked, which is the worst of both.**
`platform_retail_catalog_v2.CUSTOM_QR_GUEST` reads ₱0.00 · active, and `lib/llms-txt.ts` has been
publishing it to AI crawlers under "Free — Explore" — while `eventOwnsSku` still required an
ORDER, so the branded QR stayed locked until a couple checked out for zero pesos. A ₱0 price
never made the published claim true; only `FREE_FOR_ALL_SKUS` does, and it does now.

Four layers moved together, because any one alone leaves the contradiction somewhere else:

- `FREE_FOR_ALL_SKUS` += `CUSTOM_QR_GUEST` — the entitlement, which decides whether it renders.
- `add-ons-catalog.ts` gains `tier: 'free'` + a Free tag — the Suite card, which decides what it
  says. Without it the grid keeps offering a purchase for something every event owns.
- The demo scene's `"Default — free"` / `"Upgrade"` pair became `"Plain"` / `"Branded — Free"`.
  Leaving it would advertise a purchase that no longer exists.
- `lib/qr.ts` stopped calling it *"the paid CUSTOM_QR_GUEST SKU (₱1,499)"* — a figure that had
  been wrong since the catalogue moved to ₱0, in a comment nothing checks.

**The baked copies were re-recorded** — `custom-qr-guest.mp4` and its four stills had the old
pill burnt into their pixels. Verified by opening the frame.

**Two guards were inverted, not deleted.** `suite-doorway-guardrails` asserted
`tier !== 'free'` (*"custom-qr-guest routes to the paid buy wall"*) — correct while it was sold.
Now it asserts the opposite, so a quiet re-gating fails; deleting it would have left the reversal
unguarded in both directions. The free-layer baseline gained the key with its reason.

**And four picture bans were lifted** for the same reason: `spotlights-are-real.test.ts` banned
the `custom-qr-guest` frames for showing the PAID branded QR where only the free one could be
claimed. The branded QR *is* the free one now, so those frames are true pictures. A ban whose
reason has expired teaches the next reader something false.

SPEC IMPACT: DECISION_LOG row added (pricing, 2026-09-06).
