## 2026-07-11 · feat(vendors): relationship shell polish — desktop context rail + mark-read parity + chat height

Three additive polish passes on the flag-gated Relationship Workspace shell (both sides).
Everything lives ONLY on the flag-ON render path; flag OFF
(`NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED` unset) is byte-for-byte unchanged on both
pages (the new rail consts + the couple `searchParams` read all sit after the flag-OFF
early-returns, so that branch never evaluates them).

- **Desktop 3-pane context rail.** Both pages now pass a `contextRail` to
  `RelationshipTabShell` (the shell already rendered it as a desktop-only `lg:w-80` right
  rail; neither page fed one). It's a compact "next action" card + two quick links
  (Chat / Payments), built entirely from data already fetched — no new queries.
  - Couple (`app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx`): reuses
    `stage` / `STAGE_LABEL`, `isSetnayanService` + `activeSetnayanOrder.status`,
    `paidSoFarFormatted`, `displayName`. Next-step copy resolves to pay-for-service /
    payment-in-review / record-downpayment / keep-on-track / delivered. Cream/ink/
    terracotta/success tokens.
  - Vendor (`app/vendor-dashboard/clients/[eventId]/page.tsx`): reuses `stagePill`,
    `pendingPayments`, the pipeline booleans (`isBooked`/`isQuoted`/`isDelivered`/
    `hasReview`) and a newly-hoisted `inquiryStatus` (captured from the already-fetched
    `fullThread`, no extra read). Next-move copy resolves to respond-to-inquiry /
    confirm-N-payments / awaiting-confirmation / booked / quote-sent / send-a-quote.
    Card/white/ink/mulberry-family tokens.
  - Quick links are plain `<a href="?tab=…">` (full nav) so they reliably re-mount the
    shell, which reads the active tab from the URL on mount. Desktop-only by design; the
    mobile header already carries the next action, so the rail is never the only path.
- **Couple-side mark-read parity.** The couple page now takes `searchParams` (it only had
  `params`) and gates the flag-ON `markThreadRead` write to `!rawTab || rawTab === 'chat'`,
  exactly matching the vendor-side fix. Deep-linking `?tab=payments` no longer clears the
  unread badge without viewing chat. The chat NODE is still built either way — only the
  WRITE is gated.
- **Chat-tab height robustness.** Both Chat tabs swap the brittle fixed
  `h-[calc(100dvh-16rem)]` flex container for a `min-h-[24rem] max-h-[calc(100dvh-14rem)]`
  clamp. The `ChatMessageStream` `<ol>` (already `flex-1 overflow-y-auto`) scrolls
  internally and the composer stays pinned; the panel no longer collapses on short
  viewports or overflows awkwardly on tall ones.

SPEC IMPACT: None. Pure UI/UX polish on the existing flag-gated Relationship Workspace
shell (Relationship_Workspace_and_Appointments_2026-07-11.md); no schema, pricing, SKU,
or behavior change on the shipped (flag-OFF) surface.
