## 2026-07-03 · feat(vendors): "Get verified" section — verification lifted out of the Profile tile

The core of the owner-approved My Shop redesign (UX study verdict:
change-the-placement — a one-time, admin-gated trust milestone was the deepest,
least-discoverable element on the page and never sold its payoff).

**New "Get verified" section** (`verify-section.tsx`), an always-visible stage
directly under the Manage grid: a reward line ("Couples trust and message
verified shops first"), an overall progress bar, and a FLAT 3-step stepper —
max one accordion level deep, one open at a time:
1. **Your documents** — lazy `DocsBody` (extracted from the retired
   `inline-documents-row.tsx`); the 4 required docs carry a "Required" chip.
2. **Confirm your contacts** — copy-chip `VALIDATE <shop name>` + one-tap
   `mailto:`/`sms:` deep-links (send-to address/number read from admin-managed
   platform settings, soft-probed) + split "Email/Text · received/waiting"
   status read from the contact-confirmation stamps (soft-probed — the columns
   land in a parallel migration; pre-migration reads as "waiting").
3. **Meet the team** — the 15-min Google Meet, unlocked copy once docs are in;
   shows the booked time when scheduled.

**Soft-gate + inline Submit** — steps can start anytime; only "Submit for
review" is gated (profile-100% + 4 required docs + both contacts) via ONE
shared helper `verificationSubmitMissing` used by both the section's reasons
line and the new non-redirecting `submitInlineForReview` action (mirrors
`/verify`'s submit: pending_review + SLA + verification_state bump + audit +
admin fan-out), so client copy and server validation can never drift.

**Documents leave the Profile checklist** — `businessProfileChecklist` is now
the 8 identity fields only (signature drops `hasDocuments`); the **publish gate
no longer requires documents** (owner-approved: profile complete → couples can
find and contact you; verification gates only the badge). The Profile tile's
sub-line now reports fields left, and the Hero's passive "Unverified" chip
became a live **"Get verified · N of 3"** pill deep-linking to the section
("Verification in review" once submitted).

**DOC_SLOTS pruned 12 → 8** (owner: "we do not need this"): government_id,
live_selfie, phone_email_otp, and amlc_screening RETIRED (identity = the Meet;
OTP superseded by VALIDATE). Stored values under retired keys in doc_uploads
are ignored — in-flight applications keep working. `REQUIRED_DOC_SLOT_KEYS`
(DTI/SEC · BIR 2303 · Mayor's Permit · bank proof) is the new required set;
portfolio/references/social are optional.

Verified `tsc` (0), `next lint`, production `next build`.

SPEC IMPACT: 0006 verification checklist pruned 12→8 + publish gate no longer
includes documents (badge-track only) + vendor /verify page now redundant
(retirement is the follow-up PR). Logged in DECISION_LOG.
