## 2026-11-18 · fix(verification): automatic approval held while fake "TEST" papers can read as Recognised

The seal fix in this PR makes the automatic paper check run again. Until W1-B34 is closed, a shop whose every check passes still goes to a person: `holdAutoApproval` (`lib/auto-verify.ts`, `AUTO_APPROVAL_HELD = true`) turns a `verify` into `to_admin` before the decision is logged, so the admin sees every check and the reason "Automatic approval is on hold for now, so a person approves." Guard: `lib/auto-approval-is-held.test.ts` (fails without the hold).

SPEC IMPACT: None (controller pick under the owner's "don't wait for me to decide", 18 Nov; releasing it needs B34 closed and the owner's word).
