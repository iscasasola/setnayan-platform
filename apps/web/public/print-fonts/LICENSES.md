# Supplier prints — outline faces

The faces the 15 approved print looks set their type in (Setnayan-specs
`prototypes/supplier_prints_2026-11-05/index.html`), at the weights each look draws.
`lib/supplier-prints-svg.ts` turns every letter into a path with opentype.js, so a
print shop needs none of these fonts installed and a lambda never asks the host for one.

Each file is the TrueType the Google Fonts CSS API serves for that family and weight,
**unmodified** (fetched 2026-11-05). Every face is licensed under the **SIL Open Font
License 1.1** (OFL), which permits bundling and embedding; source: the Google Fonts OFL
collection (`github.com/google/fonts/tree/main/ofl`). The copyright and Reserved Font
Name notices ship inside each file's `name` table; the full licence text is at
<https://openfontlicense.org>.

| file | family · weight |
|---|---|
| `cormorant-700.ttf` · `cormorant-600.ttf` | Cormorant Garamond 700 · 600 |
| `playfair-700.ttf` · `playfair-500.ttf` · `playfair-500i.ttf` | Playfair Display 700 · 500 · 500 italic |
| `bodoni-600.ttf` | Bodoni Moda 600 |
| `caslon-text-700.ttf` · `caslon-text-400.ttf` | Libre Caslon Text 700 · 400 |
| `jost-500.ttf` · `jost-600.ttf` · `jost-700.ttf` | Jost 500 · 600 · 700 |
| `syne-800.ttf` · `syne-700.ttf` | Syne 800 · 700 |
| `manrope-500.ttf` | Manrope 500 |
| `italiana-400.ttf` | Italiana 400 |
| `fraunces-700.ttf` | Fraunces 700 |
| `marcellus-400.ttf` | Marcellus 400 |
