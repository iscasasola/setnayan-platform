## 2026-11-16 · feat(attribution): every material a shop hands out names itself — `?via=<piece>` rides view → inquiry → booking → sign-up; verified = own, on any plan

Owner rulings 2026-11-16: b8d39503 (every material carries its own tag), b95998b3 (the photo-mark QR is untagged —
the fee applies), and 34909f12 "EVERY VERIFIED ACCOUNT GETS THE QR FEATURES, ON ANY PLAN" with its same-day amendment
("UNVERIFIED SHOPS DO GET THE QR — BUT NO FREE BOOKINGS FROM IT UNTIL VERIFIED"), which superseded d2e360e4 ("only
Supplier Ultra's prints are the shop's own").

- **(a) Every QR / link writes its piece.** `lib/material-tags.ts` holds the ten words — card · standee · door ·
  backdrop · tarp · rollup · table (the seven `PRINT_PIECES` ids) · sticker · link · photo. `ownPageUrl` /
  `ownDatesUrl` / `ownReviewsUrl` now REQUIRE a `via`; the prints route tags each piece with its own id (one zip,
  seven tags), the door sticker `sticker`, the share link and every on-screen code `link`. The photo-mark QR is main's
  `markQrUrl` (`via=photo`, NO `src=own`) — the one builder for that address.
- **(b) The piece rides along.** `arrivalParams` / `withShopArrival` carry `via` + utm through every inner door
  (Check a date, booth, review door, waitlist). `via` is a live shop param, so a tagged arrival renders live. The
  view row records `vendor_profile_views.via`; `startServiceInquiry` stamps `chat_threads.inquiry_via/_utm` on a new
  thread and the booking row fills `event_vendors.source_via/_utm` from the thread (only while empty, like `source`).
  NEW `signup_attributions`: the first tagged shop view of an account made within the last hour records which shop
  and piece brought it (written by the service role only; one row per user, first wins; a person may read — and
  exports — only their own row).
- **(c) 💳 Verified = own, on any plan.** The piece never decides the fee. Every own code (print, sticker, link) is
  `?src=own` on every plan; whether an own arrival is the shop's own client is decided at the inquiry by main's
  `ownLinkArrival` — a VERIFIED shop (any plan) with its own-link gift → own; an unverified shop → `shop_page`,
  Setnayan-sourced; a failed read → never charged on. The Ultra-only gate (`shopOnUltraNow`, `readShopOnUltraNow`,
  `isPrintVia`) is gone.
- Migration `20271350227421_material_tags_carry_the_piece.sql`: add-only, five nullable columns with CHECKs, one new
  table with RLS on at create, anon closed, authenticated reading only its own row (RA 10173 export). No row written.
- `lib/door-sticker.test.ts` scans the sticker at its real size (100 and 150 dpi) instead of one 1000-px square: with
  the v84 badge pictures and the longer `?via=sticker` address, jsQR missed it at exactly 1000 px only.
- No UI change: the QR-stats screen (`qr_code_stats_2026-11-16_fable`) still awaits the owner.

SPEC IMPACT: None — implements DECISION_LOG rows b8d39503 · b95998b3 · 34909f12 (+ its amendment) as written.
