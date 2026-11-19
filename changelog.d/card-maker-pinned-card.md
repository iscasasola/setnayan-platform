## 2026-11-16 · feat(card-maker): the card pinned on top grows into the grown card; hiding lives only there

Ruling c160a2aa (owner-approved 2026-11-16; design = the "Approved" side of the prototype artifact).

- **Pinned again.** In the Card Maker the card as couples see it is always drawn at the top on a phone ("As couples see it" · "updates as you type"), redrawing as you type — it replaces cut 3's "See it as couples do" tap of 14 Nov and restores the 9/10 Nov design. The face is the shipped `ServiceCardFace`; the short form stays under it unchanged. From 820 up the right-hand card is the same pinned card.
- **Tap → the grown card.** For a saved card, the shipped face door (`ServiceFaceDoorButton`) rises into the shipped `ServiceDetailsSheet` from the tapped face, with no Inquire (`inquireMode="none"`), hide per card, 👁 Couple view and the card's opens. It shows the SAVED card (`lib/service-card-for-maker.server.ts`, built with the same lib calls as the shop page: `toServiceCard` · `withCoupleLooks` · `buildCardReviews`/`withCardReviews` · `toAlbumViews` · `withCardHides` · `withInspirationLooks`) with the typed name, price line and what's-included laid over it (`overlayTyped`). A new, unsaved card does not grow. Only while `serviceDetailsEnabled()` is on (couples have no grown card otherwise). Any part that could not be read is said under the card; a refused hides read offers no hiding and leaves the hideable items out.
- **Hiding lives in ONE place.** The shop page (`/v/[slug]`) no longer curates: hidden items are dropped for every viewer, the shop included, and its grown card carries no owner panel. The hide wiring moved unchanged from `services-gallery.tsx` to `maker-grown-card.tsx`, still through `couplePhotoShare` op `card_hide` (no new server action). The shop page's own-shop check stays only for photos by service's private "Only you" photos (renamed `viewerSeesPrivatePhotos` / `privatePhotosFor`).
- The form gallery keeps "Set as primary photo · Delete photo"; the grown card only hides.

Guards: new `app/vendor-dashboard/services/the-card-maker-grows-the-card.test.ts`; re-aimed `laptop-gets-two-columns.test.ts`, `lib/supplier-cuts-the-card.test.ts`, `lib/service-card-hides.test.ts`, `the-service-card-grows.test.ts` — each sabotaged once and seen red.

SPEC IMPACT: None (implements approved ruling c160a2aa)
