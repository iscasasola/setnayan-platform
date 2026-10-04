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

## The ten theme faces (2026-10-04)

`lora` · `baskerville` · `crimson` · `josefin` · `kaushan` · `alexbrush` ·
`parisienne` · `cookie` · `delafield` · `monoton` are decoded from the stage files
PR #6332 committed under `app/_fonts/<family>/`, where each family's upstream
`OFL.txt` sits beside its fonts. Eight of them carry a **Reserved Font Name**
(all but Crimson Pro and Alex Brush), and a subset or an instance is a Modified
Version that may not keep that name (OFL §3, OFL-FAQ 2.6). So those eight are the
stage WOFF2 **decompressed and nothing else** — every glyph and table, a variable
font left variable (the Logo pins Josefin Sans to 400 at draw time,
`LOGO_FONT_VARIATION` in `lib/logo-fonts.ts`). Crimson Pro and Alex Brush reserve
nothing; their stage files are already Latin cuts and are decoded as they are.
