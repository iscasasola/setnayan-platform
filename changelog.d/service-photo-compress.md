## 2026-07-27 · fix(vendor-services): service photos now web-optimize in the browser before upload

Cover photos and showcase gallery photos on service cards now run through the existing
`compressImage` pass (canvas downscale to 2000 px on the longest edge + re-encode) before
landing on R2 — the machinery `FileUpload` already had (step 0a, deliberately ordered AFTER
the watermark), switched on for the four service photo fields: wizard cover, manager
edit-cover, manager new-cover, and the showcase gallery. The showcase clip already compressed
(`compressVideo`); photos were uploading at original size bounded only by the 5 MB cap.
Best-effort by design: on any failure the original uploads unchanged.

SPEC IMPACT: None (behavioural optimisation; no schema, no pricing, no flow change).
