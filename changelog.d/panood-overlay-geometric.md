## 2026-07-21 · fix(live-studio): geometric paywall — shrink the picture, mark the chrome

Replaces the translucent scrim shipped in #3432, which was a weak paywall on two counts.

**It was defeatable.** OBS ships a Color Correction filter and the target users are *by
definition* OBS users — any purely tonal treatment is a ten-second slider drag from being undone.
Geometry is not: no colour filter can un-shrink a picture.

**And it didn't clear a contrast floor.** This contradicts the council's own ruling, which called
for a gold mark at ≥0.78 opacity over a 55% scrim. Measured against a white-dress frame that
reaches **~1.47:1** — *worse* than the ~1.59:1 of the overlay it was meant to replace, and far
below the 3.00:1 needed to be perceivable at all. Nothing clears 3:1 over live video without
drowning the picture so thoroughly the couple can no longer verify their framing — the one job
the free tier exists to do.

**The fix:** shrink the video to 62% and draw the mark on the letterbox chrome the shrink
creates, where there is no video behind it. Same gold on the frame's dark ground measures
**~4.94:1**. This keeps the council's intent (geometry is not colour-invertible) while fixing its
arithmetic. **Flagged as a delta from the literal ruling text.**

Also ships 4 anti-crop corner marks, so cropping into a quadrant in OBS still yields marked video.

### Detail

- `PAYWALL_VIDEO_SCALE = 0.62` + `<PaywalledVideo>` wraps the video **branch**, never a leaf
  `<video>` and never an individual split pane — `splitRatioFromPointer` reads
  `getBoundingClientRect()`, which reports the *post-transform* box, so a scale on any ancestor
  of the divider would silently desync it from the operator's pointer.
- The pop-out's **outer window is never scaled**, so OBS's window-capture resolution is unchanged;
  only the picture inside shrinks. The OBS ordering notice moved to `bottom-[20%]` so it clears
  the new bottom band and corner marks.
- A paid, cleared feed renders with **no transform in the tree at all** — `MaybePaywalled`/
  `PaywallShrink` apply the wrapper only while the overlay is up.
- Mark is an alpha `mask-image` of `/brand/setnayan-mark.svg` filled with the asset's own
  `#cb9e4b`. Inline styles with `-webkit-` pairs: **Tailwind here is v3, which has no `mask-*`
  utilities**, and `no-repeat` is mandatory — the asset declares width/height, so a bare
  `mask-image` tiles across a 1080p surface.

104 unit tests pass; typecheck + production build clean.

SPEC IMPACT: Amends the overlay treatment in `Live_Studio_Trial_Council_Verdict_2026-07-21.md`
§2.2 — the ruled scrim+mark measurement was wrong; the mark moves to the letterbox chrome.
