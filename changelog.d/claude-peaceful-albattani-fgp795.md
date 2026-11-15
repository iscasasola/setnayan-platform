## 2026-11-15 · feat(verification): the paper is the only input — the number is read, the VALIDATE stamp and the call are gone

Cut (2) of the supplier cuts (specs DECISION_LOG 93ed7cd0), on top of #7624 (the paper reader) and #7627 (three papers, one Submit).

- **The registration number is read off the DTI/SEC paper, never typed.** On Submit, the number on the sealed DTI/SEC slot is claimed for the shop: the number read off a clean copy or, only after the third unclear try, the number typed from that paper (`registrationNumberOnPaper` in `lib/paper-intake.ts`). It goes through the same rule as before: the partial-UNIQUE index, plus the soft review flag when another shop holds it. So the admin's "Same registration number as <shop>" now has a number to compare.
  - Before this, nothing wrote the number any more. The typed box was retired by #7624, so every new shop's number stayed empty and the duplicate check could never fire.
  - The old exported action `saveRegistrationNumberInline` had no caller. It is now the internal `claimRegistrationNumber`, which takes no form field. This is one fewer server action.
  - A number the parser cannot make out is not claimed, and the claim never refuses a Submit that already landed.
- **No VALIDATE email or text.** The supplier side went in #7627. This removes the admin half: the "Contact confirmation" block on /admin/verify, its "Mark email received / Mark text received" buttons, the `markVendorContactConfirmed` action (one fewer server action), the "VALIDATE message marked as received" notice, and the stamps as reviewer-check facts, which no check read any more.
  - Stamps already stored on old applications are kept; nothing is deleted. The VALIDATE contact settings in Avatar › Switches are not touched.
- **No call.** The Meet step, the call check and the call copy were already gone in #7627. The admin help answer "How do I verify a supplier?" no longer says "confirm the call yourself and record the contact check". It now describes the send-back that names its paper.
- **Bank proof** stays fully dropped (#7627). Nothing moved to payment setup.
- **Guard:** `lib/verify-cut-the-paper-is-the-only-input.test.ts`. It fails if:
  - the number is taken from a request or the claim becomes a public action again;
  - the claim runs after the automatic decision;
  - the admin VALIDATE stamp, its action or the stamp facts come back;
  - call copy reappears on the supplier's path.
  - Proved by mutation: exporting the claim, or feeding it a form field, each turns it red.
- Regenerated: `scripts/port-control-baseline.json` (the three removals, deliberate), `lib/admin-map/admin-jobs.generated.ts` and `admin-routes.generated.ts`.

No migration. No production writes. Design unchanged: this extends the approved v10 upload only.

SPEC IMPACT: None. This implements the existing ruling (DECISION_LOG 93ed7cd0, cut 2) and adds no new decision.
