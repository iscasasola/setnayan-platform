## 2026-11-10 · fix(reads): three reads production refused (42501) now ask with the right role — no grant widened (G6)

Build 5 Lane G, Step 0b rows 48–49 (Vercel runtime errors, 7 days). Each was a CALLER asking with the wrong client;
in all three the database grant was right and stays as it is.

- **Supplier shop packs + gift rows read "unavailable" (~105 errors from 4 Nov).** `fetchShopPapicPacks` and
  `fetchShopGiftUnlockRows` select `gift_price_php`, which 20271201188010's column allow-list withholds from
  `anon` + `authenticated` (the final price sheet added the column after it, and
  `the-catalog-keeps-its-margin.db.test.ts` lists it in DENIED_COLUMNS on purpose). Five callers passed the
  supplier's session client, so PostgREST refused the whole query: Shop › Promote's bought list, a new card, a
  bundle's Gift row (whose save always answered "Couldn't read your gift stock"). Now every caller passes a
  service-role client and the readers' parameter is named `admin`.
- **Inspiration parts refused to `anon` (58 errors on each of 3 relations, 36 visitors, since 28 Oct).**
  `getInspirationParts()` read through the viewer's cookie client while its callers grew to the public shop page
  and Find inspiration; signed-out visitors were refused and silently drew the SEED instead of the admin's edited
  parts. It now reads with the service role (the rows are the same for everyone, `USING (TRUE)`); `anon` still holds
  nothing, so the exposure surface does not widen.
- **Guests page reads as `anon`.** Not a signed-in couple: Next renders the layout and the page side by side, so a
  request with NO session started every guests-page read before the page's own sign-in redirect (the layout's
  redirect does not stop the page). The page now checks for a session cookie first (`isSessionCookieName`, no
  network trip, still two trips deep) and sends a signed-out request to sign in before any read leaves.

Guards (each sabotaged red once): `lib/catalog-denied-columns-read-by-service-role.test.ts` (a session client asks the
catalogue only for the db test's PUBLIC_COLUMNS; every caller of the gift-price readers passes a service-role
client), `lib/inspiration-parts-read-by-service-role.test.ts`, and test 6 of
`app/dashboard/[eventId]/guests/the-guests-page-asks-once.test.ts` (signed out → 0 requests, sent to /login).

SPEC IMPACT: None. (Plan row 48 said "migration via pipeline"; none was needed — the grants are deliberate and
correct, the callers were wrong.)
