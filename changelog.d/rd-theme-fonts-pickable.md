## 2026-10-04 · feat(look): the ten theme fonts are pickable in Font ▾; Most-used ties follow theme count

Owner, 4 Oct, verbatim *"Yes to both"* (DECISION_LOG "THE TEN REAL THEME FONTS JOIN THE FONT ▾ DROPDOWN…").
Stacked on #6332.

- **Look › Font offers the ten real theme faces** — Lora · Libre Baskerville · Crimson Pro · Josefin Sans ·
  Kaushan Script · Alex Brush · Parisienne · Cookie · Mrs Saint Delafield · Monoton — appended to
  `HUB_FONT_KEYS` / `HUB_FONTS` (`lib/hub-fonts.ts`) as `lora · baskerville · crimson · josefin · kaushan ·
  alexbrush · parisienne · cookie · delafield · monoton`, each pointing at the very `--font-hub-*` variable
  its theme already wears (still `preload: false`). Weights/italic for the Text tab read from the loaders
  (variable ranges now understood by `hub-font-faces-are-loaded.test.ts`).
- **Migration `20271263752844_the_ten_theme_faces_are_faces_a_couple_can_save.sql`** re-states
  `events_site_font_key_check` from its latest definition (20271249835872) with the full 35-key vocabulary
  plus the ten. Only widened. New db test `the-ten-theme-faces-are-savable.db.test.ts`.
- **Logo** — the Logo's Typeface list is the stage list, so each face got an outline `.ttf` in
  `public/logo-fonts/` (`scripts/make-logo-outline-fonts.py`, THEME_FACES). The eight Reserved-Font-Name faces
  are the stage WOFF2 decompressed and nothing else; Josefin Sans (variable, default 100) is pinned to 400 at
  draw time (`LOGO_FONT_VARIATION`, `pinLogoFaceWeight`).
- **Most used** — ties on slot count now order by how many THEMES use the face, then the owner's named order
  `MOST_USED_OWNER_TIE_ORDER` (Lora, Libre Baskerville, Crimson Pro). ⚠ Measured: theme count does NOT break
  today's tie (Lora, Libre Baskerville, Crimson Pro, Jost, Quicksand, Outfit are each 2 slots in 1 theme), so
  the owner's named order is what decides; the shelf is now Cormorant · Cormorant SC · Lora · Libre
  Baskerville · Crimson Pro. The guard asserts list order never decides the cut.

SPEC IMPACT: `DECISION_LOG.md` (2026-10-04 row "THE TEN REAL THEME FONTS JOIN THE FONT ▾ DROPDOWN…") — built as
decided, with one correction recorded in the PR for owner sign-off: the "theme count" tie-break does not
separate the six tied faces (each is in exactly one theme); the shelf follows the owner's named order instead.
