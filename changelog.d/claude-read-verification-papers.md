## 2026-11-14 · feat(verify): read each verification paper; one upload place; clean papers verify on Submit

Owner rulings 2026-11-14 (DECISION_LOG): "we want to detect the text on their documents. Account Name · Registration
Number · Expiration Date" · "it will try to read their pdf/jpeg file" · THREE PAPERS AND ONE SUBMIT · THE QR ON A
VERIFICATION PAPER IS READ AND ITS LINK SHOWN TO THE ADMIN · CLEAN PAPERS VERIFY THE SHOP ON SUBMIT · ONE PAPER AT A
TIME, UP TO THREE TRIES EACH · ONE UPLOAD PLACE — THE APP TELLS WHICH PAPER IT IS · ONLY CLEAN FILES ARE ACCEPTED ·
THE BUSINESS PERMIT LEADS · THE RENEWAL DAY IS 30 MARCH. Outside-spec items 1–7 adopted by the controller.

- **Reading** (`lib/verification-paper-read*.ts`, `lib/verification-paper-file.ts`, `lib/pdf-embedded-images.ts`): the
  receipt reader's client and model; PDF as a document block, pictures through `sharp`; 10 MB and PDF/JPEG/PNG (HEIC
  where `sharp` opens it) checked by magic bytes, damaged files refused before any read. Per-field `confident`, the
  TIN with its branch code, the barangay. The expiry is never invented. The QR through the ONE decoder
  (`lib/qr-decode.ts`) on every picture of every page; `sharp` has no PDF input here, so a QR drawn as vector shapes
  is not seen and reads "Couldn't read the QR — check by hand".
- **One upload place** (`lib/paper-intake.ts` + `.server.ts`, via `updateDocUploadInline` intent=intake/typed — no new
  server action): classify each file / PDF page and file it under the paper it is; duplicate replaces; DTI+SEC keeps the
  clearer; unclear tries 1–2 and expired / unknown / other files are refused AND deleted from R2 (only the try count is
  kept); try 3 keeps the file for the typed form, which marks the paper manual (always a person); a 4th try is refused.
  One compare-and-set update per request. Every filed paper is SEALED (HMAC from the server secret) so an edited
  `doc_uploads` cannot feed the decision.
- **Auto-verify on Submit** (`lib/auto-verify.ts` pure + `.server.ts`): seven checks — papers read · name agrees
  (exact after normalising, fuzzy goes to a person) · nothing expired · DTI/SEC QR official and carries the same number
  · number and TIN on no other shop (branch-aware) · reader confident · BIR 2303 ↔ permit (name + barangay + city).
  `verify` approves through the admin's own engine (moved to `lib/verification-decision.server.ts`, out of the
  'use server' file) with `approved_by: 'automatic'`; anything else waits for a person. Never refuses. One masked JSON
  log per submission (`admin_audit_log` action `vendor_verification_auto_check`).
- **Live QR check** (`lib/qr-live-check*.ts`): https + allowlist (whole-label host match), DNS pinned to a checked
  public address, every redirect re-checked, 10 s, 1 MB, GET without cookies. It only ever falls back.
- **Permit → pin proposal**: geocoded with `geocodeAddressWithCity`; `registered_address` and the pin are written only
  on the supplier's confirm (`saveVerificationIdentityField` intent=confirm_permit_pin, nudge ≤ 2 km).
- **Badge**: reminders at 60, 30 and 7 days (`lib/verified-badge.ts`); the badge day stays 30 March
  (`lib/papers-due.ts`) for automatic and admin approvals; an approved shop may open a renewal draft once its deadline
  is within 60 days or past.
- **Admin › Verify**: read values, QR label and "Read it again" beside each paper; "Verified automatically" filter;
  "Why it passed · N of 7 checks", the exact reason on every "Waiting for Setnayan", and "Take the badge off".
- **Supplier**: the read is never drawn; Submit shows "Checking your papers…" then "You're verified" or "Waiting for
  Setnayan".

SPEC IMPACT: None — implements the DECISION_LOG rows named above as ruled; nothing in the corpus changes.
