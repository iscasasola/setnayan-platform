## 2026-11-16 · feat(attribution): every material a shop hands out names itself — `?via=<piece>` rides view → inquiry → booking → sign-up; only Ultra's prints are own

Owner rulings 2026-11-16: b8d39503 (every material carries its own tag), b95998b3 (the photo-mark QR is untagged —
the fee applies), d2e360e4 (prints open to every plan; only Supplier Ultra's prints are the shop's own, judged at
INQUIRY time by the shop's CURRENT plan).

- **(a) Every QR / link writes its piece.** `lib/material-tags.ts` holds the ten words — card · standee · door ·
  backdrop · tarp · rollup · table (the seven `PRINT_PIECES` ids) · sticker · link · photo. `ownPageUrl` /
  `ownDatesUrl` / `ownReviewsUrl` now REQUIRE a `via`; the prints route tags each piece with its own id (one zip,
  seven tags), the door sticker `sticker`, the share link and every on-screen code `link`, and `photoMarkPageUrl`
  (for the photo-mark QR when it is drawn) `via=photo` with NO `src=own`.
- **(b) The piece rides along.** `arrivalParams` / `withShopArrival` carry `via` + utm through every inner door
  (Check a date, booth, review door, waitlist). `via` is a live shop param, so a tagged arrival renders live. The
  view row records `vendor_profile_views.via`; `startServiceInquiry` stamps `chat_threads.inquiry_via/_utm` on a new
  thread and the booking row fills `event_vendors.source_via/_utm` from the thread (only while empty, like `source`).
  NEW `signup_attributions`: the first tagged shop view of an account made within the last hour records which shop
  and piece brought it (written by the service role only; one row per user, first wins; a person may read — and
  exports — only their own row).
- **(c) 💳 Ultra-only own.** `arrivalInquirySourceOf(src, via, shopOnUltra)`: an own code whose piece is a PRINT is
  `website` (own, no fee) only when the shop is on Ultra; otherwise `shop_page` (Setnayan-sourced, fee). The server
  re-judges in `startServiceInquiry` with the plan read at that moment (`readShopOnUltraNow`: `tier_state =
  'enterprise'` and not past `tier_expires_at`; promotions not counted; a failed read is not Ultra). Sticker, link
  and on-screen codes keep the 13 Nov rule (the d2e360e4 row leaves them OPEN).
- Migration `20271349425906_material_tags_carry_the_piece.sql`: add-only, five nullable columns with CHECKs, one new
  table with RLS on at create, anon closed, authenticated reading only its own row (RA 10173 export). No row written.
- No UI change: the QR-stats screen (`qr_code_stats_2026-11-16_fable`) still awaits the owner.

SPEC IMPACT: None — implements DECISION_LOG rows b8d39503 · b95998b3 · d2e360e4 as written. Open questions for the
owner are listed in the PR body (legacy prints with no `via`; whether sticker/link codes fall under the Ultra rule;
admin promotions; the Shortlist print code).
