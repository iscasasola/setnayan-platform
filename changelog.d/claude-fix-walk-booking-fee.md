## 2026-11-13 · fix(booking-fee): a couple who found the shop on Setnayan is Setnayan-sourced (F-W1-58)

Owner ruling 2026-11-13 ("the supplier's personal QR is free; their shop page is charged"). Measured on the walk: a
booking made wholly in the app (quote → ask to confirm → agree) read "In-house · No Setnayan booking fee · This client
did not come from Setnayan", and no fee row opened. Cause (read-only prod): its chat thread had `inquiry_source` NULL
and its `event_vendors.source` NULL — the shop page stamped nothing on an untagged arrival, NULL is an import, and the
supplier's own QR pointed at the same page untagged, so the two could not be told apart.

- Migration `20271345227050_shop_page_inquiry_is_setnayan_sourced`: new `inquiry_source = 'shop_page'` (CHECK) and it
  joins `booking_fee_is_sourced_surface`. `website` keeps its locked meaning — the supplier's own link (an import).
- `app/v/[slug]/page.tsx`: an untagged arrival stamps `shop_page`; `?src=own` stamps `website`.
- `ownPageUrl` (`lib/supplier-qr-codes.ts`): every code the supplier hands out — Today's QR, Promote "My page", the door
  sticker, the printed code, the shop's share link — carries `?src=own`.
- The TS twin `SOURCED_INQUIRY_SOURCES` + label "Shop Page Inquiry".

Not changed: rows already written. The walk's booking (thread NULL) stays an import — fixing it is a production write.

SPEC IMPACT: None — implements the corpus row of 2026-11-13 as written.

## 2026-11-13 · fix(supplier): Agreed now loads on a booked client; times in Manila (F-W1-59, F-W1-61)

- **F-W1-59** "Agreed now" read the couple's `events` row with the supplier's own session, which RLS refuses — an
  empty event counted as a failure ("Couldn't load what is agreed"). It now reads the event's three facts with the
  service client, as the client page itself does, once the supplier's own session shows it is on the event (a thread
  or a quote of its own).
- **F-W1-61** Three supplier-side times were formatted with no zone (a server render prints UTC): the manpower gig
  card (a gig application's time), Deep Search's dates, and the verification meeting time — all now Asia/Manila.
