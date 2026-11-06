## 2026-11-06 · feat(prints): prints by purpose and size — each piece carries what its reader needs, no prices, plus the member's own calling card

Owner, 6 Nov 2026 ("Yes ship it" · DECISION_LOG "PRINTS BY PURPOSE AND SIZE"). Shop › Promote › Prints, the ONE renderer `lib/supplier-prints-svg.ts`.

- **Each piece is the approved prototype's layout.** Who reads it from how far sets what it carries: the card holds identity, the standee services and a rating, the tarp adds since, area and web address, the roll-up adds a photo and the About, and the backdrop carries a big brand, a photo and a big QR. `PRINT_PURPOSE` in `lib/supplier-prints.ts` holds each piece's ⓘ text and its blocks. **The door print is unchanged.**
- **Real facts, read on the server** (`lib/supplier-prints.server.ts`):
  - logo: `logo_url`, which replaces the monogram;
  - services: active `vendor_services.title`, names only;
  - since: `in_business_since_year`;
  - area: the ring or nationwide, else the city;
  - photo: the hero where the page shows it, else the first portfolio photo;
  - About: only where the page shows it;
  - web address: the verified custom domain, then `setnayan.com/v/<slug>`.
  A missing fact drops its block. A print never shows a zero or an empty frame.
- **One fact, one place.** Where the stars line is drawn, the rating pill is not. Where "since" is drawn, the years pill is not.
- **A block switched off is gone everywhere** (controller, 6 Nov). With "Stars and reviews" off, the rating does not come back as a pill. With "In business since" off, the years pill does not come back.
- **`On your prints ▾`** is one PickMenu multi-pick (`picked`) over the 10 blocks; name and QR are always on. The picture, the Save file and "See it in use" all honour it (`hide=`).
- **🪪 Your own calling card** (owner "Yes", 6 Nov). The front carries the member's account name, their Team label only when set (never the access level), and the shop logo and name small. The back is the shop card's. The card is offered only to the signed-in member, and only when they have a name (`who=me`).
- **🔒 No price, no phone, no email on any print.**
  - Services print as names only.
  - `printSafe` strips any ₱ amount, phone or email that a supplier typed into a tagline, About, service title or role.
- New guard `lib/prints-by-purpose-and-size.test.ts` (17 tests). It checks:
  - the blocks each piece carries;
  - that missing facts drop their blocks;
  - every switch on every piece;
  - one-fact-one-place;
  - no ₱, phone or email in any piece × 15 looks × side × screen/Save. A sabotage check confirmed the guard catches it.
  - the personal card with and without a role;
  - the sheet wiring;
  - that the door is unchanged.
- Dev proof script: `scripts/render-supplier-prints-proof.ts`.

SPEC IMPACT: controller recorded the ruling (DECISION_LOG "PRINTS BY PURPOSE AND SIZE")

**2026-11-06 · owner: "Prints work for all. no limitations on plans."** The prints reader no longer gates the hero photo (was Pro) or the About (was Solo+) by plan; every plan gets every piece with the shop's own photo and About. The own web address still needs the plan, because the address only opens while the plan includes it. Guard: `prints work on every plan`.
