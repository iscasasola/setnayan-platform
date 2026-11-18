## 2026-11-18 · fix(verify): a city permit's .gov.ph QR is no longer called "Not a government site"

Owner, 17 Nov 2026: "Yes, build QR checks" (QR checks on supplier papers). Rule 0 found them **already shipped** on 14 Nov:
- the QR on every paper is read (`lib/qr-decode.ts`, jsqr + sharp);
- it is labelled for the admin as Official DTI / SEC / BIR site or not;
- auto-verify check 4 requires the DTI/SEC QR to sit on the official host and carry the printed number, with a live-page read on top.

**The one gap this closes:** a Mayor's Permit QR that opens the city's own portal (`makati.gov.ph`, `eboss.quezoncity.gov.ph`) showed the reviewer **"⚠ Not a government site"**. City portals were left off the official list ("LGU portals not yet", DECISION_LOG 2026-11-14), so a real permit read as a fake.

- `classifyPaperQr` gains a third link label, `gov_other`: "A .gov.ph site — not DTI, SEC or BIR. Check it is the city's."
  - It applies to any https sub-domain of `gov.ph`, with no credentials, never bare `gov.ph`, never `gov.ph.evil.com`.
  - It is drawn in the **warning colour** and is **never `official`**, so a look-alike such as `evil-dti.gov.ph` still never reads "Official DTI site".
- Nothing verifies on it. Auto-verify, its checks and the live-check allowlist are unchanged; the label only changes what the reviewer reads.
- Tests: two new cases. With the fallback removed, 2 fail (mutation-checked).

SPEC IMPACT: None. This applies the 2026-11-14 row "THE QR ON A VERIFICATION PAPER IS READ AND ITS LINK SHOWN TO THE ADMIN — LABELLED OFFICIAL OR NOT"; LGU portals stay off the official list.
