## 2026-07-31 · feat(design): branded gradient hero tiles for `date` + `hangout` event types

Ships the two missing event-type hero assets — `apps/web/public/event-types/date.webp`
and `hangout.webp` — so the two newest types stop rendering the hash-derived
`eventTypePlaceholderGradient()` fallback in a grid of fourteen designed tiles.
**Assets only; zero code changes** — `eventTypePhotoSrc()` already resolves
`/event-types/<key>.webp` and only falls back to the gradient on a 404.

Why gradient art, not photography (owner directive): these two types are moods,
not productions — and the placeholder gradient was already the right *idea*,
just undesigned. Both tiles are authored as the intentional version of that
recipe: same ~155° axis, same terminal ink (`#1B1A17` / `#17160F`), gold accents
from the Atelier tokens (`--sn-gold-100/300`), soft radial-glow language shared
between the pair so they read as siblings, plus film grain so they sit next to
the photo tiles without banding.

- **date** — "candlelight for two": deep mulberry-wine falling to ink; one warm
  gold glow with a muted-rose companion pressed against its shoulder. Intimate,
  evening, two lights close together.
- **hangout** — "golden hour, open circle": amber over warm olive falling to
  ink; a low paper-gold sun and several overlapping translucent rounds, no one
  centred. Casual, plural, easy.

Format matches the shipped set: 880x1100 (exact 4:5 for the picker's
`aspect-[4/5]` tile), sRGB WebP q85, ~58–59 KB each (existing band 33–77 KB).
Bottom third stays dark in both so the white label + tagline overlay and the
`from-ink/85` scrim keep full legibility. No text, no logos, no faces in the
art. The other fourteen assets are untouched.

SPEC IMPACT: None — no pricing, schema, or product-behavior change; fills an asset gap the picker/`event-scene` fallback path already anticipated.
