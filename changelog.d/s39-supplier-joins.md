## 2026-09-18 · fix(supplier): two readers that could only show emptiness get their writer (S39)

From S26's orphan sweep (`rpc-no-caller`, supplier tier). Both are **(a) join the missing end** —
the read side shipped and is live; the only writer had no caller.

- **Funnel benchmark.** `recompute_market_funnel_bands()` is the only writer of
  `market_funnel_bands`, which every supplier's My Performance funnel card reads through
  `funnel_benchmark_for_vendor`. Nothing called it: production held **0 rows**, so every
  supplier was told "not enough peer data" whatever the data. New admin action
  `recomputeFunnelBands` (same gate and cron-free contract as `recomputePriceBands`) and a
  "Recompute funnel bands" row on `/admin/pricing?tab=price-bands`, with its own last-run,
  band count, refused-read line and success flash. ⚠ `market_price_bands` is ALSO 0 rows in
  prod — its button exists but has never been pressed; that is an owner action, not a code gap.
- **Booth Studio words.** `vendor_set_booth_studio_content()` is the only writer of
  `event_vendor_booth_posters.poster_content`, which the 3D booth already renders in the
  couple's palette. New server action `setBoothStudioContent` (sanitizes with the renderer's
  own `sanitizeBoothStudioContent` before storing) and a `BoothStudioCard` composer on the
  supplier's client page beside the poster upload. **Dark**: mounted only when
  `NEXT_PUBLIC_BOOTH_STUDIO_ENABLED` is on — the same flag the renderer reads, and it is NOT set
  in Vercel production (checked `vercel env ls`), so nothing changes for anyone today.
  The `booth_studio` SKU was deleted as a switched-off price on 2026-08-29; whether Booth Studio
  is free, bundled or re-priced when the flag goes on is an owner call.
- Guard: `lib/two-supplier-ends-are-joined.test.ts` pins every hop (RPC call → action → mounted
  form/component, once, and the composer behind the renderer's flag). Sabotaged locally: moving
  the form to the other action and dropping the flag each turn it red.
- `admin-jobs.generated.ts` regenerated (+1 job).

SPEC IMPACT: None — both features were already specified and shipped on the read side.
