## 2026-09-06 · fix(features): /features says what ships

Continuation of the `/features` audit that began with `_PlanningToolkit.tsx`. The
same vocabulary appeared in two more sections and was false in both — checked
against shipped code and the live schema, not against the documents.

**`_VendorsLedger.tsx` — calendar export (EN + TL).** Claimed "a single .ics
feed your phone subscribes to · updates push live; you don't re-import · family
members get their own subscribable feed (filtered)". There is no feed.
`/api/budget/[eventId]/ics` returns `Content-Disposition: attachment` behind
`supabase.auth.getUser()`, so a phone cannot subscribe (it cannot
authenticate), nothing pushes, and it carries vendor payment due dates only —
no RSVP cutoffs, fittings, tastings or run-of-show. Rewritten to the two
exports that exist: the budget `.ics`, and the per-appointment `.ics` on a
confirmed vendor meeting.

**`_VendorsLedger.tsx` — contract vault (EN + TL).** Claimed "Drop the PDF the
vendor sent you… OCR-scans the signed page, and surfaces the key fields
(deposit amount, balance due date, deliverables list) into the ledger
automatically". Three falsehoods: the couple cannot upload (their contracts
page says "Vendors will upload PDFs here once you agree on terms in chat"),
there is no OCR anywhere in the tree, and the SKU that would have read
contracts — Contract Intelligence, iteration 0032 — was retired 2026-05-18 by
`20260518200000_vendor_contracts_dual_esign_retire_0032`. Rewritten to the
dual-signature flow that actually ships.

**`_OutsourcingPacing.tsx` — Scheduling (EN + TL).** Same feed claim, plus a
"single calendar surface" aggregating four sources. Two of the four exist and
live in two different places. Rewritten to those two; the file's own header
comment said "unified calendar" and is corrected rather than left to disagree
with the code beneath it.

`app/features/features-page-says-what-ships.test.ts` bans each phrase in both
languages, pairing every ban with the shipped fact that makes it false so a
session that genuinely builds the feature knows what to change. Mutation-checked
against the pre-fix copy: it fails.

Claims checked in the same sweep that HELD UP and were left alone: the guest
microsite really does update in real time, dietary preferences and song
requests are real columns, RSVP really does close at the guest-list deadline,
account deletion and data export exist, and the Google Drive photo-delivery
OAuth is genuinely built.

SPEC IMPACT: None. This removes claims the corpus never made; no product
decision changes.
