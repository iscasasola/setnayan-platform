# X0 — lead-time tracker

Owner ruling 2026-09-05: **no calendar waiting** — every item starts now. Update the Status column
in place; this file is the register (a GitHub issue could not be opened from the session that
wrote it — open one and link it here if you prefer).

| # | Item | Owner | Started | Needed by | Status |
|---|---|---|---|---|---|
| 1 | **Apple: accept the updated Program License Agreement** (developer.apple.com → Agreements). Membership is paid. Both `build-desktop` dispatches on 2026-09-05 (02:03Z run 33937991389, 02:52Z run 33940303449) failed ONLY at notarization: `HTTP status code: 403. A required agreement is missing or has expired.` Signing itself succeeded (cert "Indalecio Casasola" found). Windows leg passed both times. After accepting: re-dispatch `build-desktop` → the macOS leg should notarize. | owner | 2026-09-05 | before S11 (macOS half can be built now) | ⏳ open |
| 2 | **Apple identity**: is the Developer ID the PH organisation (needs D-U-N-S, ~15 business days + Apple review) or the individual the CI log shows? This is whose name appears on every couple's Gatekeeper dialog. | owner | 2026-09-05 | before S11 | ⏳ open |
| 3 | **Windows OV code-signing cert + cloud signing.** Azure Trusted/Artifact Signing excludes Philippine organisations (learn.microsoft.com, 2026-08-11). Keys must be hardware/cloud since 2023-06-01 → a file cert cannot sign from GitHub Actions. Default route: SSL.com OV (~$129/yr) + eSigner; alternative Certum. Charged at order; validation 3–4 weeks. | owner | 2026-09-05 | before S11's Windows half | ⏳ open — order now |
| 4 | **Production env flags** (Vercel → Environment Variables): record the prod values of `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`, `NEXT_PUBLIC_PANOOD_STREAMING_ENABLED`, `NEXT_PUBLIC_LIVE_STUDIO_POOL_ONLY`. In neither the repo nor Vercel `get_project`. Without the first two the controller returns `notFound()`. | owner | 2026-09-05 | before S13 / M0 | ⏳ open |
| 5 | **§ 4c free-tier branding** — two owner locks disagree on what the free tier's canvas draws; `program-bridge.tsx` says the flag must not flip until settled. | owner | 2026-09-05 | before S2 | ⏳ open |

**Windows artifact from the 02:52Z run** (run 33940303449): `setnayan-desktop-windows-latest`,
1,848,513 bytes, **unsigned** (workflow header: "Windows is still unsigned (Phase 2)"), expires
2026-09-19. SmartScreen will warn until item 3 lands; S10's rehearsal script teaches
"More info → Run anyway".

**Defaults if the owner says nothing** (Launch Plan § 6): Windows route = SSL.com OV + eSigner ·
OS floor stated on `/download` · browser key reveal hidden on desktop · 720p30 default ·
pool as-is with pool-only ON once the pool can broadcast · split-screen out of scope.
