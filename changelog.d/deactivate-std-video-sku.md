## 2026-07-10 · chore(pricing): retire the stray STD_VIDEO_UPLOAD ₱100 SKU

Video on the Save-the-Date is now bundled into the Cinematic Reveal (STD_PREMIUM_OPENINGS), so the standalone ₱100 video add-on is retired.

- Migration `20270713475096` deactivates `STD_VIDEO_UPLOAD` (idempotent — already inactive in prod; pins it in repo history).
- Removed the "STD video upload" row + `stdVideo` const from the homepage pricing overlay (it was still showing via the hardcoded ₱100 fallback).
- Clarified the Reveal row label: "cinematic openings + your music, video & photos".

Verified: typecheck.

SPEC IMPACT: None (cleanup of a retired SKU).
