## 2026-07-18 · feat(papic): roll→Mini cap remap + wedding-only caps in the quote code (PR-3 of 12)

Wires the PR-1/PR-2 caps model into the pure quote functions and both surfaces that quote them, so the picker never shows a number the checkout doesn't charge. Code-only — no migration (the `papic_mini_cap_php` column + caps trigger already landed in PR-2, applied to prod).

- **`lib/papic-cameras.ts`** — `CameraCaps` gains `mini`; the `'roll'`/Mini tier now clamps to the **Mini cap** (₱6,000 fallback), not the dormant Ltd cap; `caps.ltd` is reserved for the distinct Ltd tier that ships later. New `isPapicUncapped(eventType)` (`true` for every non-`wedding` type) + `computeCameraQuote(..., { uncapped })`: when uncapped the charge runs to the raw subtotal and `capped` stays `false`. Constant flips: `PAPIC_FREE_CAMERA_COUNT` 5→3, `PAPIC_MIN_PAID_CAMERAS` 5→1.
- **`studio/papic/actions.ts`** — both charge paths (`computeCameraQuote` extras + `computeLimitedQuote` guest-list) read `papic_mini_cap_php` + `event_type` and pass `uncapped` / `MAX_SAFE_INTEGER`; weddings clamp, all other event types bill the raw subtotal.
- **`studio/papic/page.tsx`** — the picker DISPLAY reads the Mini cap for the guest-list Limited tier and uncaps for non-weddings (mirrors the charge path), so the quoted price equals the billed price in every case — closes a would-be overcharge-vs-quote gap for non-wedding events.
- **`lib/papic-cameras.test.ts`** — `CameraCaps` fixture gains `mini`; 3 new tests pin the uncapped (non-wedding) path (raw subtotal, `capped:false`, unlocks still free) and that the wedding path still clamps. 12/12 pass.

**SPEC IMPACT:** None — corpus already carries the v3 caps model (`0012_papic/Papic_Good_Better_Best_Pricing_2026-07-17.md` · `Papic_Build_Brief_2026-07-17.md`; Free = 3 cameras, weddings-only caps). This is the code catching up to the locked spec.
