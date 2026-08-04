## 2026-07-15 · feat(vendor): inquiries anonymized until accept — identity is what the token buys

Glass PR-6b (functional privacy change, not a reskin). Per the spec
`Vendor_Inquiry_Anonymization_Spec_2026-07-15.md`: pre-accept, a vendor sees the
JOB (event type · date · city/area · guest/budget bands · category · message
text) but NOT WHO the couple is (no display name, initials, photo, event title,
public-page link, contact). Accepting — the unchanged flat 1-token burn (₱200)
via `unlock_vendor_event` — reveals everything. Identity is what the token buys.

Enforcement is at the DATA layer (a masked UI over leaked props would be a fake
door). The reveal predicate is the token-burn timestamp (`chat_threads.accepted_at`,
with the `inquiry_status='accepted'` enum as fallback) — the same source of truth
the accept machinery stamps; "revealed stays revealed" across later status
transitions. No change to burn amount, settlement, refunds, RLS, or schema.

New:
- `lib/inquiry-mask.ts` — pure, dependency-free `isInquiryRevealed()` +
  `inquiryPlaceholderLabel({eventType, city})` ("A couple planning a {type} in
  {city}", a/an-aware, graceful fallbacks). Unit-testable.
- `lib/inquiry-mask.server.ts` — `inquiryCityLabel()` (region→city/area, never a
  venue) + `fetchInquiryMaskMeta()` (admin-scoped batched read of ONLY
  `event_type`+`region` for a vendor's own unrevealed threads).

Masking applied:
- `lib/chat.ts` `fetchVendorThreads` — the DTO now STRIPS `event.display_name`
  (event title) + `event.public_id` (public-page link) for any unrevealed thread;
  `event_date` kept. Single source feeding My Customers / Bookings / Messages /
  Overview, so no vendor surface can leak them regardless of its render logic.
- `lib/vendor-overview.ts` — the "What's new" inquiry card (fed to the FENCED
  `overview-sections.tsx` — props only, component untouched) now uses the neutral
  placeholder for `eventName` and a city-only `place` (drops the admin-read
  `display_name`/`venue` that were the true pre-accept leak).
- `lib/chat-actions.ts` `notifyOtherParty` — the `vendor_inquiry_received`
  notification + email (first couple→vendor message) drop the couple's event name
  from the title. Couple's message TEXT is not scrubbed (they may sign it).
- Bookings + Messages list surfaces, the thread detail header + customer rail
  (`messages/[threadId]/page.tsx`), and the admin demo-inquiry list + detail —
  all render the placeholder pre-accept. Thread decision screen now carries the
  honest trade copy: "Accept to see who they are and reply — 1 token (₱200). You
  only spend when you accept."

Tests: `lib/inquiry-mask.test.ts` (predicate + placeholder invariants) and
`lib/chat.test.ts` (fetcher DTO: pending strips identity / accepted preserves it /
declined stays masked / accepted-then-displaced stays revealed). Full suite 1811
pass; typecheck + lint + production build green.

OWNER FLAG: the owner-locked "returning client" enrichment (2026-06-12) still
reveals a PRIOR event's name pre-accept (it deliberately tells a vendor a repeat
client is reaching out). Preserved here; flag for reconciliation against this
anonymization pass.

SPEC IMPACT: Vendor_Inquiry_Anonymization_Spec_2026-07-15.md (implemented) +
DECISION_LOG.md row (2026-07-15). Positive RA-10173 delta (couple identity shared
with a vendor only after the vendor commits) — note for the next privacy-notice
sweep. No SKU/pricing/schema change.
