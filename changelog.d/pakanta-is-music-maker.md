## 2026-09-29 · feat(copy): plain-English feature names — Music Maker · Groups · Memories · Loved ones · Watch Live · Photo Notes

Owner, verbatim: *"Change pakanta to Music Maker."* · *"Only Papic is customized and all other
namings should be generic"* · *"Samahan - Group"* · *"Ala ala - Memories"* · Alaga → *"Loved ones"*.
Then (DECISION_LOG "OWNER ANSWERS — NINE PENDING DECISIONS"): Panood → *"Watch Live"*, Kwento →
*"Photo Notes"*. Papic and Patiktok keep their names. The Tagalog noun "kwento" ("ang inyong kwento")
is a word, not the feature, and stays. Kwento in `story-spine.tsx` / `editorial-editor.tsx` is left to
the in-flight Post Event build (#6106 / #6110), recorded as a narrow `IN_FLIGHT` row in the guard.

- **Every word a person reads** changed: menus, rails, page titles and headings, SEO/OG metadata,
  the /pakanta · /samahan · /alaala landing pages, tours, help, notifications, the Maya checkout
  line, llms.txt, /features, admin labels (Music Maker queue, Ugat map), the Google Drive subfolder
  name for new song copies ("Music Maker"), and the Tagalog about page. 239 visible occurrences
  across 78 files, then hand-fixed for grammar ("a group", "your groups", "Add a loved one",
  "your Memories gather").
- **No identifier moved**: routes (`/studio/pakanta`, `/dashboard/samahan`, `/alaala`), tables and
  columns (`samahan_*`, `pakanta_song_*`), the `PAKANTA` SKU code, `kind === 'alaga'`, file names,
  CSS classes and nav slot keys are unchanged, so every old link keeps working.
- **DB display copy** by one forward migration `20271251630856_plain_english_feature_names.sql`
  (catalogue titles/descriptions, taxonomy display names, nav/search/dock labels, and the two fixed
  notification titles; glue-aware, idempotent; never touches words a person wrote).
- **Guard** `lib/retired-names-stay-off-screen.test.ts` + `lib/retired-names-scan.ts`: an AST scan of
  every .ts/.tsx under app/ lib/ components/ that flags a retired name in JSX text, prose literals
  and bare Title-case labels, while allowing routes, keys, columns, SKU codes, imports and
  `console.*` / `logXxx(…)`. Retiring another name is one row in `RETIRED_NAMES`. DB test
  `tests/db/plain-english-feature-names.db.test.ts`.

SPEC IMPACT: brand/feature rename. Corpus edited directly — rename banners on
`0036_pakanta/0036_pakanta.md` (+ `.docx` regenerated), `03_Strategy/Alaala_Pillar_2026-06-15.md`,
`Samahan_Minimal_Build_Plan_2026-07-15.md`, `0011_panood/0011_panood.md` (+ `.docx`),
`02_Specifications/09_Panood_Feature_Specification.md`, `02_Specifications/Kwento_Monumental_Upgrade_2026-06-18.md`; the 0036 row in the corpus `CLAUDE.md` names Music Maker.
Dated historical docs are left as history. DECISION_LOG rows were recorded by the controller.
