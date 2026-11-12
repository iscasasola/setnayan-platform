## 2026-11-12 · feat(service-card): the cover plays its photos, a swipe turns it — and a bundle plays its services'

Owner, 12 Nov: *"on service cards the photos will slideshow play so even if there is a bundle created, it will also show the slideshow of all the services it includes"* · *"can we swipe it to go the the next photo?"* · *"check our events>suppliers>find page"* → *"Yes, build it"* on the one Suppliers prototype.

- The ONE face (`service-face.tsx`) takes `photos`: with the cover they make ≥2 → `service-face-cover-show.tsx` plays them (cover first, ≤6, the front door hero's 5 s beat and 0.9 s fade; only while half on screen; still under reduced motion; only the first photo loads with the page).
- Swipe the photo: left = next, right = back (axis decided on the first 8 px, 28 px turns one — `lib/service-cover-show.ts`). A swipe pauses that card until it leaves the screen. `touch-action: pan-y` + touch events stopped at the photo, so a sideways rail it sits in stays still and a row's swipe-to-delete never sees it; pointer events still bubble, so Find's long-press keeps its own 8 px slop. A tap on the photo is handed to what the card's press would hit (its door, else the topmost link under it); the tap that ends a swipe is swallowed.
- Find: `BenchServiceCard.photos` from `showcase_photo_r2_keys` in the SAME read as the cover; emptied with the name while a supplier is withheld. Shop page / Explore: `ServiceCardView` hands its showcase. Bundles: one photo from each of its services in turn, captioned with the service (`interleaveServicePhotos`).
- Held by `lib/the-service-cover-plays.test.ts`.

SPEC IMPACT: DECISION_LOG 12 Nov "SERVICE CARD PHOTOS PLAY AS A SLIDESHOW" (already in the corpus, rows 6f4502c4 / 8b093677 / f44aa83a); prototype `prototypes/service_card_slideshow_2026-11-12/`. No new schema.
