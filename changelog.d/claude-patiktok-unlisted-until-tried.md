## 2026-09-27 · fix(geo): Patiktok is unlisted from /llms.txt until it has been tried

Owner, 2026-09-27: *"we have never tried patiktok for now"*, then yes to pulling
it from /llms.txt. It is **still on sale** in the app. It is simply no longer
described to answer engines, because a model quoting an untried product to a
couple is a promise nobody has tested.

- New `UNLISTED_UNTIL_PROVEN` set in `lib/llms-txt.ts` (on sale, not
  advertised). This is a different state from retiring a SKU, which removes it
  from the catalogue.
- The Patiktok price line, its landing-page link and its `REQUIRED_RETAIL`
  entry are removed. `/patiktok` leaves `LINKED_ROUTES`.
- `llms-txt.test.ts`: "every active price is quoted" skips unlisted codes. A new
  test fails if llms.txt names Patiktok again (sabotage-checked: restoring the
  line goes RED). The missing-SKU sample pair moves from Patiktok to Live Studio,
  which is still required, so the test keeps testing two codes.
- The help centre never mentioned Patiktok, so there was nothing to remove there.

Not touched: the `/patiktok` page itself and its catalogue row. Whether to keep
selling it before it has been tried is an owner call.

SPEC IMPACT: None.
