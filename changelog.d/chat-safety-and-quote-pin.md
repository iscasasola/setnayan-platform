# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-24 · feat(chat): safety banner + pinned latest quotation

Two surfacing-only enhancements to the couple↔vendor chat thread. No new proposal plumbing, no schema change — both read data that already exists.

- **Couple-facing safety banner** (`app/_components/chat-privacy-notice.tsx`): new `ChatSafetyBanner` extends the existing privacy-notice file. Warm, tasteful guidance pinned at the top of a couple's thread — keep chats + payments in Setnayan, approve only what you asked for, pay only the agreed amount, never share IDs/card numbers/OTPs, and treat a vendor rushing you off-app to pay as a red flag. Dismissible-but-remembered via `localStorage` (default visible; SSR-safe, applied post-hydration like `DemoModeBannerClient`). Wired onto the two COUPLE surfaces (`dashboard/[eventId]/messages/[threadId]` + the vendor-workspace chat tab), replacing the plain `<ChatPrivacyNotice>` there — it folds in the same "don't share private info" line. Vendor surfaces (`vendor-dashboard/messages/[threadId]`, `vendor-dashboard/clients/[eventId]`) keep `<ChatPrivacyNotice>` unchanged (the safety copy is couple-directed).
- **Pinned latest quotation + audit trail** (`app/dashboard/[eventId]/messages/[threadId]/_components/thread-quotations-card.tsx` + pure `lib/thread-quotations.ts`): the couple's thread now pins the newest `vendor_proposals` row at the top as the "current quote" — exact amount + inclusions (line items) + the accept CTA, which links to the existing shared `/proposals/[publicId]` detail page (accept RPC reused verbatim, never duplicated). Older proposals are never hidden — they collapse into an "Earlier quotes (N)" audit-trail list below. Newest-by-`created_at` is a safe pin because sending a new proposal already retires older live ones via `supersede_prior_vendor_proposals`. Read under the couple's own RLS (`status <> 'draft'`); graceful-degrade to nothing pre-migration or when the vendor has sent no proposals. No mutation — a pure UI layer over the booking-fee base.
- **Tests** (`lib/thread-quotations.test.ts`): `selectCurrentQuote` (empty → null, single, out-of-order newest-pinned + older kept newest-first, no input mutation, deterministic tie-break) + `isAcceptableStatus` gate. `tsc --noEmit` clean; lint clean; existing proposal test suites unaffected (13 pass).

No migration.

SPEC IMPACT: None — pure surfacing/UX over existing chat + `vendor_proposals` data; no new SKU, pricing, schema, or product-scope change.
