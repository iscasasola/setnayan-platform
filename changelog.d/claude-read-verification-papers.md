## 2026-11-14 · feat(verify): read each verification paper for the admin (name · number · expiry)

Owner rulings 2026-11-14 ("we want to detect the text on their documents. Account Name · Registration Number ·
Expiration Date" · "it will try to read their pdf/jpeg file") and "VERIFICATION IS THREE PAPERS AND ONE SUBMIT"
(the read is an ADMIN aid only).

- `lib/verification-paper-read.ts` (pure) + `lib/verification-paper-file.ts` + `lib/verification-paper-read.server.ts`:
  after a DTI/SEC, BIR 2303 or Mayor's Permit upload, the paper (PDF as a document block; JPEG/PNG/WebP/HEIC via
  `sharp`, the receipt reader's downscale) is shown to the receipt reader's model, and the answer is written to
  `vendor_verification_applications.doc_uploads[slot].read` — the seam `verification-pairs.ts` left for it. No migration.
- Runs in `after()` from `updateDocUploadInline`: the upload is saved first and never waits on, or fails with, the read.
  Missing key, model error, unreadable file → nothing is written.
- `PaperRead` gains `expiresOn` (ISO day or null). Never invented: a paper with no printed expiry (a BIR 2303) reads null.
- Admin › Verify: each paper shows what was read (name, number, notes, expiry, unreadable lines) beside Open, with
  "Read it again" (rides `openApplicationDocument` with `intent=read` — the server-action ceiling has no headroom).
  The approve form shows the permit's read expiry beside the date the reviewer types; it is never prefilled or written.
- 🔳 The paper's QR is read too (owner "yes", DECISION_LOG "THE QR ON A VERIFICATION PAPER IS READ AND ITS LINK SHOWN
  TO THE ADMIN"), with the ONE decoder `lib/qr-decode.ts`. A PDF's pictures are pulled with `pdf-lib`
  (`lib/pdf-embedded-images.ts`) because the shipped `sharp` has no PDF input — a QR drawn as vector shapes is not seen
  and reads "Couldn't read the QR — check by hand". Stored as `read.qrText` / `read.qrUnreadable` (old blocks parse
  with neither). Admin only: "Official DTI/SEC/BIR site" on a strict https host match (`dti.gov.ph.evil.com` fails),
  "⚠ Not a government site", "This QR holds text, not a link". The server never fetches the link; the admin taps it
  (new tab, `rel="noopener noreferrer"`). The QR is read even with no model key.
- The supplier screen no longer parses the read block, so no mismatch / pick / "Read as" is ever shown to a supplier.
- A read never verifies, refuses, or writes a profile column. Registries (DTI/SEC/BIR) are still not called.

SPEC IMPACT: None — implements DECISION_LOG 2c92173a + f69ec167 and the "three papers and one submit" row as ruled.
