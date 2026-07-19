## 2026-06-21 · fix(std): the running Save-the-Date veil continues across fullscreen / orientation change (no reset)

Owner: "when the website starts to run and it transfers to full screen or change orientation, it should continue as is and not reset."

Extends #1960. That fix stopped the mobile address-bar collapse (a height-only resize) from resetting the veil, but on a real **rotate** (aspect change) the veil's `ResizeObserver` still ran the full cloth rebuild (`applyView()` → `seedPose` resets `lift=0` + re-drapes), which momentarily **re-covers the running film** before re-lifting — the visible "reset."

Fix (`apps/web/app/[slug]/_components/reveal/veil-reveal.tsx`): once the veil is **lifted** (`liftTarget >= 1 || revealedRef.current`), the rotate/fullscreen branch now **returns early — no rebuild at all**. The always-on `cheapResize` already re-fits the renderer/camera to the new viewport, so the lifted valance just carries on as-is over the still-playing film. The drape is only rebuilt while the veil still **covers** the page (the guest hasn't started yet). A fire-time re-check inside the 240ms debounce also skips a stale covered-state rebuild if the guest lifts during it.

No change needed for the **film** (its own resize handler only re-scales via `setFitScale`; it never touches `idx`/`playing`, so playback continues) or the **`<video>`** (a media element — keeps playing). This was purely the veil re-draping.

Verified: `tsc --noEmit` exit 0; adversarial review (correctness · side-effects + the debounce race) clean. CI (lint + build) + Vercel preview are the gate; rotate + WebGL lift isn't headlessly testable → owner-verified on-device.

SPEC IMPACT: iter 0024 Save-the-Date veil reveal — a lifted veil survives rotate/fullscreen without re-draping. → DECISION_LOG row.
