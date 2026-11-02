## 2026-10-19 · fix(cover): the cover video is served where the Main background is, and shows its own first frame

Owner report (cale-ice, live): *"claire tried to check the invitation link. and it did not show the video. just the photo under the reveal."*

- **Cause (reproduced):** the Cover Scene's clip and still were drawn at the bucket's public development host
  (`pub-….r2.dev`, `publicUrlForStoredAsset`) while the Main background is signed on `….r2.cloudflarestorage.com`.
  A laptop that cannot reach `*.r2.dev` (Safari and Chrome alike) got neither cover file (video error 4), so the cover
  drew nothing and the Main background photo showed through. Blocking `*.r2.dev` alone in Playwright reproduces it.
  Cloudflare also rate-limits `r2.dev` and calls it not for production.
- **Fix:** `signCoverSceneMedia` signs every ref the cover draws (snippet clip + still, ready-made loop) once per render
  through the Main background's own signer and one-bucket fence; `coverSceneLayer` draws the signed address first.
- **Frame 0 behind the veil** (owner: *"shouldn't before the reveal, it should be the first frame of the video?"*): the
  cover clip is drawn from the start with no separate poster (cale-ice's stored poster is an all-black grab), `#t=0.001`
  + `preload="auto"`, so the unveil plays on from exactly that frame.
- **A refused play is never a dead still:** on `NotAllowedError` a ▶ shows on the frame and the next tap plays it; the
  unveil asks the clip to play again inside the tap. Reduced motion / Save-Data keep the frame, no ▶.
- Guard: `lib/the-cover-is-served-where-the-main-background-is.test.ts` (+ two existing guards' anchors updated).

SPEC IMPACT: None (implements the 2026-10-15 veil rule and the 2026-10-16 cover-video ruling as written; the owner's
2026-10-19 "first frame" answer is the controller's to record). Open for the owner: `media.setnayan.com` is in the CSP but
does not resolve — an R2 custom domain needs a Cloudflare DNS zone (DNS is at GoDaddy), so every other public R2 file on
the site still uses `r2.dev`.
