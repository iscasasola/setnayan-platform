## 2026-09-17 · docs(pabuya): the premise cited for the QR validation feature was false

Three places in this repo — `lib/pabuya-qr-verdict.ts`, the
`a-gift-qr-must-be-scannable` suite, and the comment in
`dashboard/[eventId]/pabuya/actions.ts` — said the owner's own event carried
`IMG_4424.jpg`, "a phone photo", as its `bank` QR, framed as the defect that
motivated validating uploads. One of them added that the owner "found out by
scanning a code in GCash and being told it was invalid."

🔴 **That is false, and it was written by the same session that later disproved
it.** `IMG_4424.jpg` is a phone screenshot of a bank app AND a perfectly valid
QR Ph code. Decoded with this repo's own tools it passes `verifyCrc` and
`isQrPhPayload`, and carries `com.p2pqrpay` · `BNORPHMMXXX` (BDO) · a 12-digit
account matching the row's stored handle · tag 53 = 608 · tag 01 = 11 (static,
which is correct for a gift code). What GCash rejected was a LINK QR generated
for the owner by mistake — not his own code.

🔑 **The feature is still right; the story was not.** Nothing validated uploads,
and that gap is real whether or not this particular file ever exercised it. But
a docblock that invents a victim is the same disease as a comment asserting an
unmeasured fact — and this one sat in the file whose entire subject is refusing
to trust an image without decoding it first.

Also corrected: `build-sessions/PABUYA-PLAN-2026-09-17.md` carried an
owner-decision table listing NINE questions. Checked against `DECISION_LOG.md`,
only ONE was genuinely open (suppliers). `A` was already ruled 2026-07-30 —
and presenting it as a question nearly lost the second half of that ruling, the
`bucketForPrefix` rule that is only expressible with a ROOT prefix. `C`, `G`,
`H`, `I` have no evidence of ever having been asked. Meanwhile the
moderator/host divergence, which WAS a real decision, was absent from the table.
A correction banner now sits ABOVE the table, so the correction is read before
the claim.

⚠ **The general rule this cost:** a planning pass generates plausible questions
as readily as real ones, and a narrative written to justify a feature will
reach for the nearest concrete example whether or not it fits.

SPEC IMPACT: None — corrections to this repo's own comments and a session
document; no ruling changes.
