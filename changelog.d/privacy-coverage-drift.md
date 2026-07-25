## 2026-07-21 · feat(admin): Data Privacy — filing coverage & drift panel

Bridges the two halves of `/admin/data-privacy` that were disconnected: the live
**control board** (what's ON) and the **NPC filing** (what's declared). A new
"Filing coverage & drift" panel between them answers "did we list everything?":

- **`lib/privacy-coverage.ts`** — a hand-authored (DPO-maintained) map from each
  control to the NPC document(s) that declare it, exhaustive over
  `PrivacyControlKey` (a new control won't typecheck until its coverage is
  declared, so coverage can't silently drift behind the catalog). Plus two drift
  lists + a candidate-flows list, and `computePrivacyCoverage`.
- **`_components/coverage-panel.tsx`** flags, in order:
  1. **Live but not declared** — privacy-sensitive controls that are Active but
     absent from the filing (surfaces the new `coordinator_consent_money` +
     `coordinator_prep_release`, which aren't in the ROPA yet).
  2. **Declared, but no live control** — activities with a filed DPIA and no
     board control (`dpia-antifraud`, `device-fingerprint-review`).
  3. **Candidate flows to review** — app privacy flows not yet on the board
     (RSVP consent, marketing-share consents, payment-proof uploads, …).

Non-privacy activation switches (run-of-show, broadcast) are marked "n/a".
Read-only; no schema change.

SPEC IMPACT: None (admin compliance-visibility tooling).
