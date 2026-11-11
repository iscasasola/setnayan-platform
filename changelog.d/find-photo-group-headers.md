## 2026-11-09 · feat(find): photo group headers that pin

Owner, 9 Nov: *"event dashboard> suppliers> find still doesn't have the photo effect done for the pinned group rows."*
The couple's Event › Suppliers › Find (the Find page and the bottom search's empty state) now opens every group —
"Popular for <type>" included — on the group header approved for the supplier's Shop › Services (corpus
`prototypes/shop_discounts_bundle_card_open_2026-11-09/shop-services-menu.html`, `gheadProp` / `.gphoto` / `.ghd`):

- **One shared component**, `app/_components/photo-group-header.tsx` (`PhotoGroupHeader`), so Shop › Services
  (Supplier Build 5) mounts the same header with its ⋯ menu in `trailing`. Find draws no menu.
- **The photo band** (96 px, 16 px corners, the count in mono caps on it) over **a title row that pins** under the app
  bar (`--fd-bar`; `--pgh-top: 0px` inside the bottom-search panel, which scrolls in its own box). Each group is its own
  `<section>`, so the next group's header pushes the pinned one up. Pinned, the photo comes back as a 36 px thumb (the
  family spring) and a hairline fades in; reduced motion: no transition.
- **No photo → the plain title row**, the count as its small line — never an empty box.
- **The photo is the ONE taxonomy source**: `service_categories.sample_photo_r2_key` through the snapshot the read is
  already handed (`TaxonomySnapshot.categoryPhotos`). Find's groups are a page-level map with no row of their own, so a
  header wears the photo of its own first photographed category (`pickFindHeaderPhotos`, `lib/supplier-find.ts`),
  passing over one an earlier header already wears. Resolved in `readFindList` the way Explore resolves a category
  photo (`displayUrlForCatalogueArt`), once per header, in parallel — no request per row. Lazy, sized `<img>`.
- One deviation from the prototype, flagged for the owner: a soft shade under the band's count so white 10.5 px caps
  stay readable on a bright photo (the prototype's gradient placeholders did not need it).
- `/dev/suppliers-lab?find=page` — the Find page's list in the real shell, on the photos the migrations write
  (`seed-photos.ts`, measured by replaying every migration into PGlite; `&nophotos=1`, `&type=wake`). A mode of the
  existing lab, not a new screen.
- The Find page's list had 32 px gutters on a phone (the layout's 16 + its own 16); below `sm` it now adds none.
- 🔒 `app/dashboard/[eventId]/vendors/find-photo-group-headers.test.ts` — photo when the taxonomy has one, text row
  when not, sticky on every group header (Popular included), one header per section, photos from the taxonomy only.

SPEC IMPACT: None — implements the owner-approved 2026-11-09 Shop › Services group header on Find, as the owner asked;
the look awaits the owner's OK on the draft PR before merge.
