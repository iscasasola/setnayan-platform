## 2026-07-16 · docs(privacy): disclose biometric/geo/social-featuring processing on /privacy [DRAFT — counsel]

Updates the public privacy notice (`apps/web/app/privacy/page.tsx` → `setnayan.com/privacy`)
to match what the app actually does, closing transparency gaps from the social-sharing audit.
Content-only; no schema/SKU change.

Added / corrected:
- **Biometric face data** — enumerated the per-event enrollment surfaces (RSVP selfie, in-event
  guest photo page, on-site check-in), and disclosed that the account-wide face profile is
  **not active** (flag-off pending DPO). The live notice already had proper opt-in biometric copy
  (it did NOT deny biometrics — that earlier claim came from a stale local checkout; verified
  against `origin/main`).
- **Photo/clip location data** — originals may carry GPS; outbound photo shares are EXIF/GPS
  stripped (drop-if-strip-fails); video-clip strip noted as still rolling out. Reworded the
  now-inaccurate "Location … we do not collect" bullet to remove the contradiction.
- **Guest photo capture** — the capture-time opt-in (off by default) + couple-approval double
  gate, and **FaceBlock** server-side fail-closed blur / live-wall opt-out.
- **Social featuring** — Setnayan may feature published recaps + consented artifacts
  (monogram/save-the-date/website/reel/LED) on its own FB/IG/TikTok, per-artifact consent with
  first-names-or-anonymous credit, the recap re-post opt-out, and post-event-only timing.
- **Minors/dependents & religion** — collected only behind consent, some features still gated,
  and **never surfaced publicly** (page, search, or social).
- **Data-subject rights** — named the `/api/profile/export` endpoint (excludes raw face vectors)
  and added an explicit face-forget (withdraw biometric consent) right.
- Bumped "last updated" to 2026-07-16.

> ⚠ **DRAFT / do-not-merge** until owner (DPO) + external PH counsel sign off — publishing a
> privacy disclosure is a legal/public act. Auto-merge intentionally NOT enabled.
> **Complementary to open PR #2865** (anti-fraud / trust-integrity disclosure, also DRAFT):
> the two edit the same page from different bases and must be reconciled/merged by counsel.

SPEC IMPACT: Implements item #10 of `Social_Sharing_Followthrough_Build_Plan_2026-07-16.md`
(owner-approved 2026-07-16) and ticks the corresponding rows in the privacy reconciliation gap
register (`Privacy_Reconciliation_Home_and_Data_Flows_2026-07-13.md` / memory
`project_setnayan_privacy_reconciliation`) — biometric/geo/social-featuring/guest-consent
disclosures. No schema / SKU / pricing change.
