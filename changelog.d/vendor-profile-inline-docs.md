## 2026-07-02 · feat(vendors): inline 12-doc verification checklist on My Shop

Owner-directed: the My Shop → Profile "Documents" row was a single deep-link.
It now **expands inline into the full 12-document verification checklist** —
each document named, with status, and the vendor's own documents uploadable in
place.

**Layout** — the row expands (lazy) into two groups:
- **Your documents (8)** — DTI/SEC Registration, BIR COR (2303), Business/Mayor's
  Permit, bank proof, portfolio samples, client references, live selfie, and a
  social link. Each **auto-saves on upload** (no Save button). Reuses the shared
  `DocSlotCard` / `SlotBadge` + the `vendor-verification` R2 bucket.
- **Setnayan handles (4)** — Government ID, the 15-min Google Meet, phone/email
  OTP, and AMLC/PEP screening — shown as status notices (owner-decided: these
  stay Setnayan-verified, not vendor uploads).

Submitting for review **links out to the verification page** (owner-decided) — the
inline row is upload + status only, so it never duplicates the submit / withdraw /
SLA UI. "Complete" stays **fully verified** (`docs_complete`, all 12 incl. admin
approval); the collapsed row reads "N of 8 of your documents in · Setnayan runs
the other 4" so it never looks stuck.

**Server actions** (`shop/inline-docs-actions.ts`, `'use server'`) — the
non-redirecting twins of the `/verify` actions (which `redirect()` away):
- `loadInlineDocs()` — lazy loader called only on FIRST expand, so My Shop never
  presigns doc thumbnails unless the vendor opens Documents. Does NOT create a
  draft.
- `updateDocUploadInline(prevState, formData)` — per-slot save for `useActionState`;
  `.eq(user_id)`-scoped, guards `vendor_profile_id` + `status='draft'`, rejects
  the 4 admin slots, recomputes `docs_complete` (all 12), returns a value. Creates
  the draft on the FIRST upload (typed/priced via `recommendedApplicationType`);
  a submitted/approved application is read-only.

**Refactor** — `buildSlotValue` + `DOC_SLOT_KEYS` extracted into
`lib/vendor-verification-slots.ts`, shared by the `/verify` action and the new
inline action so the slot-write logic has one source. `/verify` behavior
unchanged.

Reviewed with a 3-lens adversarial pass (security/RLS · draft-lifecycle · client
UX/a11y/perf) + verify, which confirmed two issues, both fixed: (1) HIGH — a
concurrent-upload draft race (two back-to-back uploads each created their own
draft → split docs). Fixed by find-or-creating the single draft on EXPAND (in
`loadInlineDocs`), so all uploads share one row; the client `!loading` guard
prevents a double-open. (2) LOW — the two group headers were `<h4>` above the
shared `DocSlotCard`'s `<h3>`, inverting the outline; changed to `<h3>`.
Verified `tsc`, `next lint`, production `next build`.

Known residuals (flagged, not blocking): multi-file slots persist a single
`r2_key` (pre-existing `/verify` parity); and a two-tab exact-timing double-open
could still make two drafts (the practical single-tab race is closed) — a partial
unique index on `(vendor_profile_id) WHERE status='draft'` would harden it if
desired.

SPEC IMPACT: None — code-only. Surfaces the existing 0006 verification checklist
inline on My Shop; no schema/migration; reuses `vendor_verification_applications`
+ the existing RLS (owner-read / owner-insert / owner-update-draft). `/verify` and
the admin console are unchanged.
