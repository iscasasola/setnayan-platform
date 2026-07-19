## 2026-06-21 · fix(std): veil lift survives the address-bar / fullscreen resize (swipe-up no longer resets)

Owner report: "when I swipe up to open the veil, the screen goes full screen and the veil resets — the swipe-up doesn't complete."

Root cause (`apps/web/app/[slug]/_components/reveal/veil-reveal.tsx`): the veil's `ResizeObserver` ran a debounced **full cloth rebuild** (`applyView()` → `seedPose` resets `lift = 0; liftTarget = 0`) on *every* resize, and the only restore was `if (revealedRef.current) liftTarget = 1`. On a swipe-up, `setLift(1)` starts the lift but `revealedRef` only flips true once the lift passes 0.985 — so a resize landing **mid-lift** re-draped the cloth and the veil snapped back, never completing. The trigger: on mobile the **Safari address bar collapses** the instant you swipe up ("goes full screen") → a viewport height change → resize mid-lift. Entering true fullscreen (iPad/desktop) is the same height-only change.

Fix:
- **Skip the rebuild for height-only resizes.** The `ResizeObserver` now only runs the full `applyView()` rebuild when the **aspect ratio** actually changes (a rotate; `|Δaspect| ≥ 0.1`). The immediate `cheapResize()` (re-fit, no reset) already handles minor height changes like the address bar collapsing or going fullscreen — so the lift is never interrupted by them. First observation is used only to baseline the aspect.
- **Preserve the lift intent on a real rotate.** Even when a rebuild does run, it now restores the lift if it was completed *or* still animating up (`liftTarget >= 1 || revealedRef.current`), not just the completed case.

No video/audio change. Verified: `tsc --noEmit` exit 0. CI (lint + build) + Vercel preview are the gate; the address-bar-collapse + WebGL lift can't be reproduced headlessly, so it's owner-verified on-device.

SPEC IMPACT: iter 0024 Save-the-Date veil reveal — lift is resilient to the mobile address-bar / fullscreen resize. → DECISION_LOG row.
