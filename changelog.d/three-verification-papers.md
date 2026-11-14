## 2026-11-14 · fix(verification): a shop is verified on THREE papers — bank-account proof removed

Owner, 14 Nov 2026 (specs DECISION_LOG f69ec167): *"delete bank account proof. we do not need that. just the 3. DTI/SEC, BIR, Mayor's/Business Permit"*.

- **The list.** `bank_account_proof` leaves `DOC_SLOTS` and `REQUIRED_DOC_SLOT_KEYS` (`lib/vendor-verification.ts`); the later slots renumber 4…7. The submit gate's sentence is now "Upload your DTI/SEC, BIR 2303, and Business Permit". `REQUIRED_DOC_COUNT` is 3, so every "n of N required" count on Today, the stepper, the Shop ⚙ and the cards follows by itself.
- **The paired papers** (`lib/verification-pairs.ts`): the bank pair, its read-only `bank_account_name` line and the `bank` registry are retired — 3 papers, 7 checks. A stored `read` block that still says `bank` degrades to `unreadable`, never throws.
- **Copy.** Setup papers, Get verified, the paired papers, the docs fold, Shop ⚙, first steps, the Verified badge row, the papers-due notice, Plan B, /for-suppliers and /for-coordinators now name three papers. The admin documents check reads "The three required documents are on file". The payout-name check stays (payout methods are untouched) and points the reviewer at the DTI/SEC paper and the payment settings instead of the bank proof.
- **Help.** The guide `how-to-prepare-bank-account-proof` is removed; its address 308-forwards to `/help?role=vendor#getting-verified` (`next.config.ts`).
- **Old uploads.** Nothing is deleted. A bank proof already in `doc_uploads` is an extra key and is not counted (the same rule as the 2026-07-03 prune); the 90-day identity-retention sweep still knows the key, as before.
- **Database.** Checked: no CHECK, trigger or function requires the bank slot to approve a shop (`20260516010000`, `20260516050000`, `20271218766967`, and every migration touching `doc_uploads`). `vendor_verifications.bank_account_proof_r2_key` is a nullable legacy column. No migration.
- **Not touched:** payout / payment-method settings (GCash or bank for receiving couple payments).

### Widened 2026-11-14 · verification is three papers and ONE Submit

Owner (specs DECISION_LOG "VERIFICATION IS THREE PAPERS AND ONE SUBMIT"): *"verification process is simple. submit the 3 documents and press submit. that's it. no other steps needed. we wait for admin cofirmation first."* — and, on the profile gate, *"Yes, remove it"*. Gates removed, each from where it lived:

- **Profile-100% gate** — `verificationSubmitMissing` (`lib/vendor-verification.ts`) lost its `profileComplete` / `onlyLogoMissing` inputs; its three callers (`submitInlineForReview` in `shop/inline-docs-actions.ts`, `profile/details-data.ts`, `lib/vendor-first-steps.server.ts`) no longer pass the checklist. The "First step: finish your business profile" banner and profile auto-open in `verify-section.tsx` are gone; Today's documents step is never `blockedBy` the profile and the logo step no longer says "Needed to go live". The 2026-11-06 "logo gates live" guards are flipped to the new ruling.
- **VALIDATE contact step** — Step 2 "Confirm your contacts" (`ContactsStep`, `ReceiptLine`) removed from `verify-section.tsx`; the "Phone/Email confirmed" badges on Your details removed; `VerifySummary` drops the VALIDATE fields and `details-data.ts` no longer reads the VALIDATE settings. The reviewer's `contact_validate` check is removed from `runVerificationChecks`. (It was never enforced at Submit.) Stored `contact_*_confirmed_at` stamps and the admin stamping action are untouched.
- **Google Meet step** — the `google_meet` slot leaves `DOC_SLOTS`; the "final confirmation, a 15-min Google Meet" copy and booked time are gone; the reviewer's `identity_meeting` check is removed; locks read "then press Submit", help says the papers are checked by an admin. Stored `scheduled_at` values stay.
- **`docs_complete`** now means the three required papers are in (it counted every slot, the Meet included, so it could not turn true off an upload).
- The shop cover chip reads "Get verified · n of 3 papers" (was "n of 2" steps).
- Database: no CHECK, trigger or function requires a profile, a VALIDATE stamp or a Meet before submit or approve (the only verification triggers are the self-grant guards, which keep the admin's approval the only way to verified). No migration.

### 2026-11-14 · the paper labels match the approved demo

Owner approved the supplier papers demo (DECISION_LOG 7e4de291). The three `DOC_SLOTS` labels now read as the demo does: **DTI or SEC registration** · **BIR 2303** · **Business Permit** (were "DTI or SEC Registration", "BIR Form 2303 (Certificate of Registration)", "Mayor's Permit (current year)"). Renewal and branches from the same demo are follow-ons, not in this PR.

### Widened 2026-11-14 · no typed registration number before Submit

Controller, relaying the corpus (DECISION_LOG "VERIFICATION IS THREE PAPERS AND ONE SUBMIT": "no other steps needed"; "ONE UPLOAD PLACE": the app reads name · number · dates off the paper and shows them read-only — the supplier never types or confirms them):

- `verificationSubmitMissing` takes the uploads alone; "Add your government registration number" is gone. Its callers (`submitInlineForReview`, `profile/details-data.ts`, `lib/vendor-first-steps.server.ts`) no longer read `registration_number_raw` for the gate (the two reads that existed only for it are removed).
- The duplicate-business check stays on the admin's side ("CLEAN PAPERS VERIFY THE SHOP ON SUBMIT" — any doubt goes to the admin): the reviewer check `registration_number` now says **"Same registration number as <shop>"**, and a shop with no number on file is the reviewer's to read off the certificate, never a request to type one. The automatic read itself is B7's (#7624); no field was put back on the supplier.

### Widened 2026-11-14 · a send-back names only the paper that needs a new copy

Owner (specs DECISION_LOG "A SEND-BACK NAMES ONLY THE PAPER THAT NEEDS A NEW COPY"): *"Only the named one"*.

- Both send-back doors (`rejectApplication` on /admin/verify, "Needs a fix" on the work list) now take ticked papers (`sent_back_slots`); `applyApplicationDecision` refuses a send-back naming none and writes `doc_uploads[slot].sent_back = { reason, at }` on the named papers only (`markSentBack`), with the status, in one update. Files are kept.
- The supplier's next draft is seeded from the send-back (`seedDraftAfterSendBack`): un-named papers carried over as they were (not re-uploaded), named ones carry only the marker until a new copy replaces it.
- `setupPapers` and the paired papers show "Needs a new copy · <reason>" on the named paper only; un-named papers read "Uploaded". The reason line above the rows, "Needs attention" and Today's rail reason now show only for a send-back made before this rule (which named nothing and still reads as before).
- Words matched to the approved Fable v8 design: a held paper reads "Waiting for Setnayan".
- No migration: the marker rides in `doc_uploads` beside the `r2_key`, like the paper `read` block.

Guards: new `lib/three-verification-papers.test.ts` and `lib/a-send-back-names-only-its-paper.test.ts` (sabotage-checked: marking every paper turns 4 red) (three required, submit with three, an old bank proof reads the same, no supplier-facing copy names a bank proof or four papers, the old guide forwards). Updated to three with the ruling cited: `lib/verification-pairs.test.ts`, `lib/verification-pairs-wiring.test.ts`, `lib/verification-checks.test.ts` (admin approves with three; an old bank proof does not change the check), `app/vendor-dashboard/a-new-shop-is-counted-for-what-it-was-asked.test.ts`, `app/vendor-dashboard/_components/the-papers-and-the-qr-hold.test.ts`, `app/_components/lock/every-lock-shows-problem-and-solution.test.ts`.

SPEC IMPACT: Corpus DECISION_LOG f69ec167 already carries the ruling. The verification iteration docs (0006 § Vendor Verification flow, the 2026-07-03 four-paper lock) still list bank proof — not editable from this cloud session (the corpus is not attached); flagged in the PR for the controller.
