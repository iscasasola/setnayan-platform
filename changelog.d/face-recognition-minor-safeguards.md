## 2026-07-05 · feat(guests): face-recognition minor safeguards (DPIA BV-8)

Closes the one real gap the face-vector DPIA surfaced: guests carry no age, so
nothing structurally stopped a MINOR's face from being enrolled for auto-tagging.
(The consent standard itself was already compliant — explicit, separate,
default-OFF `biometric_consent`; the "implicit consent" concern was stale-doc, now
corrected in the privacy policy + DPIA.)

Two additive, compliant-by-default safeguards — no age/birthdate collected:
- **Host exclude control** — new `guests.face_recognition_excluded` (default FALSE)
  + a "Exclude from face recognition (e.g. a minor)" checkbox on the guest-edit
  page. A host attestation ("this guest is a minor"), mirroring the "don't run
  face recognition on minors" minimization careful platforms rely on.
- **Enforced at every enrolment path** — the RSVP path (`app/[slug]/actions.ts`)
  and the day-of path (`app/papic/face-enroll-actions.ts`) both refuse to create
  a face vector for an excluded guest, regardless of the consent checkbox.
  Marking a guest excluded also **revokes any existing enrolment** (does NOT
  delete their display photo — that stays photo-consent's job).
- **18+ consent copy** — the RSVP face-recognition opt-in now states the guest is
  an adult (18+).

Deeper age-gating (actually collecting/verifying age) stays Phase-3 counsel-first.
Validated in a rolled-back prod txn (column added, NOT NULL DEFAULT FALSE, 0 rows
affected). tsc + lint + migration-timestamp checks clean.

SPEC IMPACT: Privacy Policy §6.1 corrected (explicit-consent reality) + face-vector
DPIA BV-1 corrected / BV-8 addressed (both under `01_Contracts/` and `NPC_Compliance/`).
