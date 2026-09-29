# Logo editor — outline faces

One TrueType file per Event Hub font (`lib/hub-fonts.ts`) that the app did not
already serve as a `.ttf`. The Logo editor (`maker-logo.tsx`) turns a text
layer into paths with opentype.js, which cannot read the WOFF2 files the
stages load, so each face here is decoded from THAT SAME file
(`app/_fonts/…`, or `assets/cipher-fonts/…`), pinned to the weight the stage
draws, and cut to Latin. Rebuild with `python3 scripts/make-logo-outline-fonts.py`.
The eight faces the Monogram Studio already bundles are read from
`public/monogram-studio/fonts/` instead (`lib/logo-fonts.ts`).

Every face is licensed under the **SIL Open Font License 1.1** (OFL), which
permits bundling and embedding; source: the Google Fonts OFL collection
(`github.com/google/fonts/tree/main/ofl`). The copyright and Reserved Font
Name notices ship inside each file's `name` table; the full licence text is at
<https://openfontlicense.org>.
