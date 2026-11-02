## 2026-07-21 · feat(live-studio): free rig-verification tier + camera-claim UI

Makes the owner's core model reachable. Until now it was impossible **at any price**: cameras
could be provisioned but no UI ever rendered a claim link, and the control room hard-returned an
upsell wall to anyone without `PANOOD_SYSTEM`.

### 🔴 Also fixes a live defect: Mobile-tier buyers were locked out of what they paid for

Three separate gates checked `PANOOD_SYSTEM` alone, so a couple who bought the **₱1,500 Mobile
Controller** got an upsell wall on their own control room, a redirect out of the OBS pop-out, and
`"The multicam controller is a paid upgrade"` on every control action. Replaced by
`resolvePanoodTier()`, which checks both SKUs — all new ownership checks must go through it.

### 🔴 And two overlay bypasses shipped in #3432

- **The mobile camera strip rendered unmarked live video.** `SourceTileBody` was mounted without
  `overlay=`, so the guard never fired — every phone/tablet operator saw clean feeds.
- **The operator's own phone preview is uncovered**, and both `setnayan-overlay.tsx` and
  `panood-watermark.ts` claimed it was. Comments corrected rather than the surface covered: it is
  a local `getUserMedia` preview of the operator's own camera, so covering it stops nothing the
  stock camera app already allows. Flagged for the owner rather than silently left.

### What ships

- `PANOOD_FREE_CAMERA_COUNT = 3` + `panoodCameraCapForTier(tier, grantedCap?)` — the council
  ladder (free 3 overlaid → Mobile 3 clean → Desktop 8 clean, the only shape where Mobile isn't a
  paid *downgrade*). A grant can only raise, never past the transport's 8-slot ceiling.
- `resolvePanoodTier()` · `reissuePanoodCameraToken()` — the latter is the first write to
  `revoked_at`/`status` anywhere; it recycles a seat when an operator drops out.
- **`/studio/panood/cameras`** — one row per seat: copyable link + QR for open seats, reissue for
  claimed ones. Server component; `claim_qr_token` never crosses the client boundary.
- Control room, pop-out and control actions all reachable free. The paywall is the overlay, not a
  refusal — `setLive` especially must reach the DB free, since it stamps `first_live_at`.
- The full-page upsell wall becomes an inline `UpgradeBanner`.

Provisioning runs **before** the camera fetch, or a first free visit renders an empty rail that
only self-heals on reload. Free takes indexes 1..3, so a later paid order tops up to 8 in place
and never disturbs a claimed camera or its token.

6 new unit tests (28 in the file, all pass). Typecheck + production build clean; new route 3.47 kB.

SPEC IMPACT: Implements the free-tier half of the council verdict
(`Live_Studio_Trial_Council_Verdict_2026-07-21.md`). Corpus SKU tables unchanged — free is a tier,
not a SKU.
