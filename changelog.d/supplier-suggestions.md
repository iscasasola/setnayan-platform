## 2026-10-19 · feat(suggestions): a booked supplier suggests photos to its own parts; the couple keeps them

Owner 2026-10-19, DECISION_LOG "SUPPLIERS ADD INSPIRATION BY THEIR CATEGORY — EVERY PART, ATTIRE INCLUDED" + "FIVE
CONTROLLER RECOMMENDATIONS APPROVED" item 4 (option (b) + pick from the shop's own gallery). Built to the prototype
`prototypes/supplier_inspiration_suggestions_2026-10-19.html` (corpus 27eeb5e3), frames 1 · 2 · 3 · 3b · 4 · 5 · 7.

- **Schema** (migration `20271279311294`): `event_inspiration_suggestions` with RLS at CREATE TABLE (couple read ·
  booking read · admin all · no direct writes); `inspiration_suggestion_services(slot)` — the SQL mirror of the ONE
  slot→trade map (`MOODBOARD_SLOT_TRADES`); `event_inspiration_assets.source_kind` gains `'supplier_suggestion'` paired
  with `from_suggestion_id` by a CHECK biconditional; four SECURITY DEFINER functions — begin (booking · fee · trade ·
  3 waiting, under the supplier's session, opens an EMPTY row), withdraw, decide (Keep / No thanks; a full part answers
  `full` and writes nothing unless a photo is named), undo. The board's own insert policy did not move.
- **Supplier** (`/vendor-dashboard/clients/[eventId]/mood-board`): the couple's Palette in the couple's block shape —
  name, event line, "You are their florist — you can add photos to …", the five, then the lanes, the shop's own first;
  "＋ Suggest a photo" only on its own parts (the library's `slotUploadVerdict`); Upload a photo · Choose from your
  shop's photos (`lib/shop-own-photos.server.ts`, now also exporting the bytes reader the library used privately);
  every photo through the shipped content screen (`screenGalleryImage`) before the server moves it to waiting; "Sent to
  … · Undo"; a tap on a waiting photo takes it back. The sign-off asks and granted colours stay, above the palette.
- **Couple** (Studio › Mood Board, one-list Palette #6651): each waiting photo under the part's own, "From <shop>" ·
  "A photo for <part>", ✓ Keep · ✕ No thanks; Keep on a part with 3 asks which photo it replaces ("Keep all three for
  now" sends nothing); a kept photo carries its shop's mark and "3 photos · 1 from <shop>", and offers "Use for <part>";
  the "Kept. <shop> will see it." toast's Undo puts the board back; "N suggestions from your suppliers" at the top of
  Palette jumps to each (Attire boards included). A refused read is said, never drawn as nothing waiting. In-app only.
- **Guards**: `tests/db/a-supplier-suggests-only-to-its-own-parts.db.test.ts` (one map · own parts · booked only ·
  3 waiting · keep never replaces silently · who may decide), `lib/a-supplier-suggests-only-to-its-own-parts.test.ts`,
  test 5 of `every-palette-part-reaches-the-supplier-library.test.ts`; Ugat J54 + J46 claims.
- **Labs**: `/dev/supplier-lab?s=suggest` (&sent=1 · &sup=stylist|gown) · `/dev/details-lab?look=1&studio=1&suggest=1`.

SPEC IMPACT: None — implements the two 2026-10-19 DECISION_LOG rows above; no ruling changed.
