## 2026-10-28 · fix(privacy): a supplier's event photo waits 7 days for the guests, and a takedown pulls it off the supplier's page

Owner, 2026-10-28 ("OWNER: Agree to all" (1)), carrying out the 2026-10-03 rulings "A SUPPLIER'S OWN PAPIC PHOTOS GO ON
ITS PORTFOLIO AUTOMATICALLY AFTER A 7-DAY GUEST NOTICE" and "CHALLENGE PHOTOS … WITH NO RECOGNISED FACES, EVERY GUEST
GETS THE ONE-LINE 7-DAY NOTICE" (2). In-app only — no new email.

**Before:** "Put on my page" (`putAlbumPhotoOnMyPage`) copied an event-album photo onto the supplier's public page the
same second, and nobody in it was told. A guest's takedown hid the album row but left the page copy up.
`askToTakeMyPhotoDown` could not reach a supplier's photo at all.

- Migration `20271294058580_supplier_page_photo_notice` (re-allocated after #6892's wallet migrations): `supplier_page_photo_notices` (RLS at create; the supplier files its own
  notice under its own session, four columns only). A trigger stamps `noticed_at` / `public_from = now() + 7 days` and a
  CHECK pins the 7 days, so a request cannot shorten them; another CHECK pins the page ref inside the shop's own folder.
  `publish_supplier_page_photo` (service role) puts the ref on the page only after the window, if nobody removed it and
  the album photo is not hidden. Trigger `a_hidden_album_photo_leaves_the_page`: ANY hide of an album row (a honoured
  takedown, an NSFW block) closes its notice and removes its ref from `vendor_profiles.portfolio_r2_keys` in the same
  write. `remove_supplier_page_photo` (service role) is the guest's Remove, bound to the event the cookie proved.
  Backfill: page copies that went up with no notice come off — hidden ones for good, visible ones into a fresh 7-day
  notice (they return by themselves).
- The tap now files the notice through ONE priced door, `file_supplier_page_notice` (owner-only, under the shop
  wallet's per-shop lock): the shop wallet's free room (50, or the personal-invite allowance), then 1 credit a photo
  (owner 2026-10-23, #6892) — with the photos still WAITING counted toward the free room. The credit is taken at the
  tap (`shop_papic_wallet_spend`, spend_ref `page-notice:<id>`); the publish never charges. An empty wallet files
  nothing and says so. No session can INSERT the table directly. Toast: "Goes on your page Nov 4 — the guests are
  told first[ · 1 credit from your shop wallet]"; the album tile shows Goes up · On your page · A guest asked to keep
  it off.
- Event Hub (Gallery): one quiet line per supplier — "<Supplier> will show N photos from this event on their page" ·
  See them · each photo with Remove. Every guest of the event sees it (a supplier's album photo is never face-tagged,
  so the ruled no-recognised-faces branch applies). Not gated on the day.
- `askToTakeMyPhotoDown` takes `vendor_papic_portfolio_photos`: Remove takes the photo off the supplier's page at once,
  deletes the copied file, and files the takedown of the supplier's album copy (the moderator's Hide already reaches it).
- An honoured takedown on an album photo deletes the page copy's file (`deletePageCopyAfterTakedown`).
- Cron-free job `supplier-page-photo-publish` (hourly claim; admin + supplier layouts) copies the file and publishes.
- An event-album photo can no longer be ADDED to the page by a gallery save, put on a service card, or offered by the
  shop-photo picker (library / another couple's board) — each would be out of reach of the notice and a takedown.
- Tests: `tests/db/a-suppliers-guest-photo-waits-seven-days.db.test.ts` (9, the supplier's half as its own signed-in
  session), `lib/supplier-page-notice.test.ts` (8), `lib/put-photo-on-my-page.test.ts` updated.

SPEC IMPACT: DECISION_LOG row added (2026-10-28, "SUPPLIER PHOTO PRIVACY GAP — BUILT") recording what was built under
the 2026-10-03 / 2026-10-28 rulings, the backfill, and the open owner points.
