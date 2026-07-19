# Vector Monogram Studio — bundled typefaces

These 8 faces are loaded at runtime by the Vector Monogram Studio
(`app/dashboard/[eventId]/monogram/monogram-studio-engine.ts`) via opentype.js,
which needs the raw TTF outlines to build the editable glyph geometry. They are
self-hosted here (rather than fetched from a CDN) so the studio has no external
runtime dependency.

All eight are licensed under the **SIL Open Font License 1.1** (OFL), which
permits bundling and embedding. Source: the Google Fonts OFL collection
(`github.com/google/fonts/tree/main/ofl`).

| File | Family | Authors |
|---|---|---|
| Cardo-Italic.ttf | Cardo | David J. Perry |
| GildaDisplay-Regular.ttf | Gilda Display | The Gilda Display Project Authors |
| PlayfairDisplaySC-Regular.ttf | Playfair Display SC | The Playfair Display Project Authors |
| Marcellus-Regular.ttf | Marcellus | Astigmatic (AOETI) |
| YesevaOne-Regular.ttf | Yeseva One | The Yeseva One Project Authors |
| CinzelDecorative-Regular.ttf | Cinzel Decorative | Natanael Gama |
| GreatVibes-Regular.ttf | Great Vibes | The Great Vibes Project Authors |
| PinyonScript-Regular.ttf | Pinyon Script | The Pinyon Script Project Authors |

The full OFL 1.1 text and per-family copyright/Reserved Font Name notices ship
inside each TTF's `name` table and are available at
<https://openfontlicense.org>.
