## 2026-10-19 · feat(supplier-library): suppliers fill the inspiration library without an event — every Palette part, findable, and from the shop's own photos

Owner 2026-10-19: *"first, we need to allow the suppliers to fill up the inspiration board even if it has not come from
an event. to help us create more inspirations faster"* → *"go"* (DECISION_LOG "SUPPLIERS FILL THE INSPIRATION LIBRARY
WITHOUT AN EVENT"). The library already shipped (`/vendor-dashboard/moodboard-library`, MB10/MB11/MB21) and held 0
supplier photos. Extended, not rebuilt:

- ONE list of the parts that hold photos — `palettePhotoParts()` / `libraryPhotoParts()` (`lib/inspiration-slots.ts`):
  Venue & decor · the room · the flowers · Cake, then the Attire boards. The couple's Studio "Which part?" and the
  supplier's dropdown both read it, so a supplier files a photo under the couple's own name for the part ("Walls",
  "Table linens", "Lights · warmth") in the couple's order; `uploadableSlotsForShop` follows it (older boards after,
  under "More boards"), and `libraryPartLabel` gives the refusal and the allowance line the same word.
- The slot → trade map (`MOODBOARD_SLOT_TRADES`) already carried #6651's new parts; unchanged.
- "Add to the inspiration library · Your photos help couples find you" on Today (the Shop group) and on Shop (Your shop,
  under Your collections), only for a shop the library lets in (`moodboardLibraryAccessForProfile`).
- "Choose from your shop's photos" beside the file picker: the page gallery and service-card photos
  (`lib/shop-own-photos.server.ts`) go through the SAME `uploadStylistAsset` — the ref is checked against the shop's own
  list server-side, then the rights tick, trade gate, per-category allowance, content screen, watermark, theft scan and
  Setnayan's approval run exactly as for a file. No new server action.
- 🔴 An approved supplier photo is never invisible for want of a colour tag (controller on this PR): the gallery used to
  withhold a photo with no tagged colours, and suppliers do not tag them. Now (a) every supplier upload — a file or one
  of the shop's own photos — is tagged at upload with the colours of its own pixels (`lib/extract-palette.server.ts`:
  the shipped extractor's bucketing, server-side, never its cream padding; labelled "Auto", adjustable); (b) a photo
  that still has none is SHOWN (`shapeGalleryPage`), never hidden by "Matches my colours" and drawn after the matches;
  saving it reads its colours off its pixels (`applyGalleryPick`). Also found: a supplier upload's bucket path
  (`moodboard-library/…`) was handed to `<img>` as-is — it is now its public URL (`galleryImageUrl`). Guard
  `lib/an-untagged-supplier-photo-still-reaches-search-ideas.test.ts` (six sabotages, each red).
- Fix found on the walk: the editor re-rendered on every colour-map report until React stopped ("Maximum update depth").
- Guard `lib/every-palette-part-reaches-the-supplier-library.test.ts` (six sabotages, each red); lab round trip
  `/dev/supplier-lab?s=library` → lab Approve → `/dev/details-lab?…&studio=1&library=1` (in-memory, no database).

SPEC IMPACT: None — implements the 2026-10-19 DECISION_LOG row as written (corpus 040b9f28); no schema change.
