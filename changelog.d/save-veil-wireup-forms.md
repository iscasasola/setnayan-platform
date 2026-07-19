# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-05 · feat(loading): form saves raise the no-touch veil (Rule 2, form lever)

Owner directive (2026-07-05, "wire them up"): saving data without leaving the screen should lock the screen behind the branded "no touch until saving is complete" veil. This lands the **form-save lever** — the single shared change that covers the dominant save path across the app (~180 `<form action>` saves) — plus the client-handler helper for the follow-up sweep.

- **`app/_components/submit-button.tsx`**: `<SubmitButton>` now raises the app-wide `useLoader()` veil while its form action is pending (bridged via a new non-throwing `useOptionalLoader()`), so the whole screen — not just the button — is locked during the write. **On by default**; opt out per-form with `overlay={false}` (lightweight inline submits: search, add-a-row, tiny toggles), and override copy with `overlaySteps` / `overlayHint`. Actions that redirect keep the veil up until the destination's screen loader takes over (same bridge the sign-in form already used); in-place actions hide it when pending falls false; unmount hides it. The existing inline spinner + double-submit guard are unchanged.
- **`components/sd-loader/loader-overlay.tsx`**: new `useOptionalLoader()` — returns `null` instead of throwing when there's no provider, so shared primitives can raise the veil safely anywhere.
- **`components/sd-loader/use-save-loader.ts`** (new): `useSaveLoader()` — the one-line counterpart for `onClick` + `useState`/`useTransition` saves that don't go through a form. `await save.run(() => action())` shows the veil, `complete()`s with a "Saved ✓" beat on success, `hide()`s on error, and re-throws. This is what the client-handler sweep (next) converts those ~100 call sites onto.
- **`components/sd-loader/loader-steps.ts`**: new `LOADER_STEPS.saving` narration ("Saving your changes" → "Updating your details"), the default copy for both the form lever and `useSaveLoader()`.
- Barrel exports updated.

`tsc --noEmit` clean across all touched files. Veil solidity/speed/pop remain admin-configurable (PR #2854).

SPEC IMPACT: None — behavioral wiring of the shipped loader onto form saves; no schema, pricing, or SKU change.
