## 2026-11-07 · feat(taxonomy): "Ceremony essentials" (arrhae, cord, veil, candles, Bible, pillows, rosary, the set) · Pabati hidden · Photoman added

Owner, 7 Nov 2026: *"do we have the wedding essentials taxonomy? for catholic weddings? the bible the arrhea, the cord, the veil, the candles? where can they be located?"* → *"add that to the taxonomy"* → *"most supplier sells them as a set"*.

Measured first: none of these existed. The only near match, `wedding_veil` (the bride's veil, Look › Jewelleries & accessories), is a different thing and is left where it is.

Migration `20271320042798_ceremony_essentials_category.sql` seeds the one source, Admin › Categories. It uses the same shape as Chairs & tents (`20271257951866`): `service_categories` + `canonical_service_taxonomy` + `canonical_service_schemas`, with `ON CONFLICT DO NOTHING` and a post-condition block that refuses a dead shelf. `getTaxonomy()` reads the rows.

**The code fallback copy got the same rows.** This is not a second source. The one-source guards (`one-source-buckets`, `one-source-category-key`, `thin-event-types-are-scoped`, `taxonomy-folder-counts`, `category-hints`) require the fallback snapshot to equal the replayed seed, because it is what `getTaxonomy()` serves when the read fails. The files are the same ones Chairs & tents touched:

- `lib/taxonomy.ts`: the `WeddingTile` union, the parent, order, label and slug maps, and `TAXONOMY_MAP` (8 + photoman, plus `marketplaceHidden` on pabati)
- `lib/vendor-branch-category.ts`
- `lib/category-hints.ts`
- `lib/taxonomy-icons.ts`
- `lib/supplier-find.ts`
- `app/_components/plan3d/kit/booth-templates.ts`

Two test baselines also changed. The pinned wedding category list gains `ceremony_essentials`, which is the deliberate-addition path that test documents. The folder counts go Look 54 → 62 and Booths 42 → 43, for a total of 256 → 265.

- **Category:** `ceremony_essentials` "Ceremony essentials", slug `ceremony-essentials`. It sits in Look right after Jewelleries & accessories (sort 39).
  - Scoped to `wedding` and `anniversary`. A vow renewal is an anniversary with `renewal_of_vows`; there is no vow-renewal type.
  - Coarse category `rings`, the same as its neighbour. Icon `HeartHandshake`. ⓘ text written in `hint_en`.
- **Services, in this order:**
  - `ceremony_essentials_set` "Complete ceremony set" (first)
  - `arrhae_arras` "Arrhae (arras)"
  - `unity_cord` "Unity cord"
  - `unity_veil` "Unity veil"
  - `ceremony_candles` "Ceremony candles"
  - `wedding_bible` "Wedding Bible"
  - `ring_coin_bearer_pillow` "Ring & coin bearer pillows"
  - `wedding_rosary` "Wedding rosary"
- **Flags on every service:**
  - `is_ph` and `is_tradition` are TRUE, the convention for Filipino traditional items.
  - `faith` is NULL. It is a single, exclusive filter, so tagging "Catholic" would hide the cord and veil from Christian couples who use them too.
  - `is_rental` is FALSE.
  - The scope is inherited from the category.

**Pabati is no longer offered as a service** (owner, same day: *"pabati is not a service"*).

Pabati was retired into Papic on 2026-08-21 (DECISION_LOG "Pabati is RETIRED — it is part of Papic"). Its `canonical_service_taxonomy` row was still a visible supplier service under Booths › Photo booth. Because the key has no `setnayan_` prefix, it also slipped past the /open-shop first-party filter (`isFirstPartyService`), so a new supplier was offered Pabati as a trade.

The same migration sets `marketplace_hidden = TRUE` on that row. The code fallback entry in `lib/taxonomy.ts` gets the same flag, so a failed DB read does not bring Pabati back.

- **Hidden, not merged:** `merged_into` is the trade-merge forwarder, and Pabati has no trade to forward to.
- **Not deleted:** SetnaProd's `vendor_profiles.services` still holds the key.
- **No longer offered:**
  - the sign-up picker, through `getCoverageTaxonomy`;
  - Explore, through `deriveBuckets`;
  - the coverage editor;
  - the vendor profile vocabulary.
- **Still reads the key:**
  - SetnaProd's `services[]`, untouched;
  - Admin › Categories, which shows hidden services to admins.
- **Unrelated words, untouched:** `pabati` as a reserved route slug, and the Papic challenge slug.

**The photoman gets a service** (owner, same day). A photoman is a roving photographer who shoots guests at their tables and prints souvenir photos on the spot; he is not the main wedding photographer. Nothing like it existed.

- New service `photoman` "Photoman (instant prints)" under Booths › Photo booth, beside `polaroid_booth`.
- It has exactly its siblings' flags: phase V1.1.6, every flag FALSE, sort 0.
- Its scope is NULL, so it inherits every event type Photo booth allows (16 types).

Guard: new `tests/db/ceremony-essentials-is-a-real-category.db.test.ts` (8 tests). It covers the photoman, plus the category, the 8 services in order, their flags and scope, `wedding_veil` left in place, the sign-up picker's filter, the Explore buckets, and that Pabati is hidden with its row kept.

SPEC IMPACT: DECISION_LOG row "Ceremony essentials" (2026-11-07), written by the controller.
