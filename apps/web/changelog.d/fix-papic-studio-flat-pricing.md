## 2026-07-22 · fix(papic): Studio charges flat per-camera to match the /pricing promise

**The leak.** `/pricing` promises Papic One / cameras are FLAT per camera —
`_papic-estimator.tsx`: `productTotal = paidCameras × one.pricePhp`, no per-day or
per-hour math. But the Studio charge engine still multiplied by the capture-window
day count: `computeCameraQuote` and `computeLimitedQuote` billed
`count × rate × days`. A couple with a multi-day capture window (e.g. travel, or a
prep-day extension) was quoted and charged N× the advertised price.

This resolves a verified /pricing-vs-Studio contradiction. Context: the 2026-07-22
Papic naming lock (migration `20270830568357`) retired the old
`per-camera × rate × days` engine — renamed Mini → **Papic One** (flat ₱100/camera)
and deactivated `roll`/`ltd`/`unlimited`. `/pricing` was already flat; the Studio
charge + display code was the half that never got converted.

**What changed (charge is flat `count × rate`; the RATE is untouched — only the
days multiplier is removed):**

- `lib/papic-cameras.ts` — `computeCameraQuote`: `subtotalPhp = count × ratePhp`
  (was `× d`). `days` is retained as the capture-WINDOW length (seat validity +
  order description) but is no longer a price multiplier. Fixes the charge for
  `purchasePapicCameras` + `purchasePapicExtras`.
- `lib/papic-limited.ts` — `computeLimitedQuote`: `rawBillPhp = n × rate` and
  `cameraCap = floor(cap / rate)` (both had a `× days` / `× d` factor). Fixes the
  charge for `activatePapicLimited` (guest-list "Ready for Papic"; a roll guest
  camera IS a Papic One → must price flat).
- `app/.../studio/papic/extra-cameras-picker.tsx` — client quote `raw = count ×
  ratePhp` (was `× d`); "₱X / camera / day" → "₱X / camera".
- `app/.../studio/papic/guest-camera-tier-picker.tsx` — `perDayPhp` → `ratePhp`;
  "₱X / guest / day" → "₱X / guest" (+ the two `page.tsx` prop call-sites).
- `app/.../studio/papic/papic-window-picker.tsx` — copy no longer claims the
  window "sets your price"; it sets how long cameras can shoot (duration only).
- Doc-comments in `lib/papic-window.ts` + `actions.ts` de-claim the days-bill.
- Tests: rewrote `lib/papic-cameras.test.ts` "days multiply every rung" → asserts
  days do NOT multiply (flat, window-independent); added a Papic One flat-quote
  test pinning `/pricing == Studio` at the real ₱100 rate across windows
  {1,2,7,30}; new `lib/papic-limited.test.ts` pins the guest-list path flat.

**Worked money example (3 paid Papic One cameras, ₱100/camera, 3-day window):**
`/pricing` estimator = `3 × ₱100 = ₱300`; Studio displayed quote = `₱300`;
`computeCameraQuote` charge = `min(3 × ₱100, ₱6,000) = ₱300`. All three agree for
any window length. Pre-fix, a 3-day window billed `3 × ₱100 × 3 = ₱900` — the leak.

SPEC IMPACT: None (code catches up to the already-flat `/pricing` promise + the
2026-07-22 flat naming lock in migration `20270830568357`; no SKU/tier/rate
change — the per-camera rate is unchanged, only the days multiplier is removed).
