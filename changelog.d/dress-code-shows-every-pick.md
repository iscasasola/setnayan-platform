## 2026-10-17 · fix(dress-code): the guest page and Studio › Mood Board & Dress Code read one fact

Owner, on live `/cale-ice`: *"the website does not reflect what is picked on attires on mood board & dress code"*,
*"if on moodboard&dress code, nothing is picked, then nothing should show"*, *"for the dress code of women, there are
palettes but no indication of what the colors control"*, *"why do they have different palette icon?"*.

Measured (production, SELECT-only): the owner's picks were in the draft and reached the page once applied (06:32Z) —
but the page still drew rows the Studio has no row for (Maid / Matron of Honor, Best Man / Best Woman, Wedding Party),
a per-role "Parents of the Groom · Long gown" (a father told to wear a gown), empty headings, and eleven "Our colours"
against the five picked. And the Studio read its own dress code through `normalizeDressCodeConfig`, which dropped every
women's / girls' pick and the bride's, groom's and guests' Wear: after a reload the editor showed "Not said yet" for
saved picks, and its next save wrote the config back without them.

- `dressCodeForEveryone` builds the general view from the Studio's rows and people (`ATTIRE_ROWS` + `picksOf`);
  a person shows only with a picked Wear or picked colours, a row only with a person; nobody is drawn in an unpicked
  Wear; "Our colours" are the Mood Board's five main colours only (a name typed in the older form for one of those
  five still lends it its word).
- No "Our colours" in the Dress code scene (owner 2026-10-17: *"we must ommit the our colors here since we are
  talking about their dress code"*) — guest page and Maker canvas, every layout and palette look; a reader keeps their
  own "Your colours". The palette look's card is fitted on the roles' colours.
- The Studio's loader passes every stored dress-code key through (its save writes the whole config back): measured on
  cale-ice, the women's colours of VIP · Family and Secondary Sponsors were lost between 06:32Z and 09:32Z this way.
- `resolveAttireFor` / `readerAttire`: a reader is dressed by their Studio row (`studioRowOf`); the per-role tier is
  read only for the celebrant, the bride, the groom and the guests.
- `normalizeDressCodeConfig` keeps `women` and the couple's/guests' Wear (`isDressableRole`); so do the reader panel,
  the checklist, Me and the print set.
- `pickDots`: every colour dot says what it colours — the zone's word, a one-colour design's own name ("Long gown"),
  "Accent" past the zones, "Outfit" with no Wear — on the Studio and on the guest page (row key line `DotWords`, the
  reader's panel, the Palette and Line layouts).
- Row-size palette looks keep the full size's look: Paint chips in their card, Circles with rim and holes, Watercolour
  with its bled edge pre-rendered from its own filter (`public/palette/wc-edge-*.png`,
  `scripts/build-palette-row-masks.mjs`; 60 dots: 5.9 ms raster with the live filter, 0.8 ms with the mask).
- The older dress-code form (the Maker's Dress code scene › Content) no longer writes a Wear or a palette: it says the
  Studio's Wear, keeps call time and note, and carries the stored palette and per-role lines untouched.

Guard: `apps/web/lib/the-dress-code-shows-every-pick.test.ts` (seeded fuzz over every Studio row + cale-ice's own
config; CSS property check of every palette look at row vs full size).

SPEC IMPACT: Owner rulings to confirm in the corpus (not edited from this session — the brief forbids editing that
checkout): (1) the per-role dress-code tier is no longer read for roles inside a Studio group row (supersedes the
2026-09-24 "a role rule beats its group's"); (2) "Our colours" no longer appends `dress_code_config.palette`;
(3) the guest page draws no figure for a person whose Wear is not picked (supersedes `PLAIN_GARMENT` on the guest
page); (4) dot words "Long gown"-style design names, "Accent", "Outfit" (no word existed in the record);
(5) the older form's Wear ▾ and Palette are removed.
