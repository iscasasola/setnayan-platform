## 2026-09-27 · feat(maker): every font we ship is in the Font dropdown — the five most used on top

Owner: *"remember to use all our fonts on the dropdown"* and *"place on top the top 5 most used
fonts on the website. so it is easy for them to manage."*

- The Maker's Font dropdown (per element, per letter run, and the Event Hub-wide typeface in the
  Colors panel) goes from 9 faces to 35 — every family the repo ships except DM Mono and Space Mono
  (monospaced UI faces) and the base "Cormorant" cut (the same look as the Cormorant already
  offered). "Event Hub font" stays first as the reset; then **Most used** (Cormorant, Cormorant SC,
  Jost, Quicksand, Outfit), then Serif · Script · Sans · Display, each face drawn in itself and
  listed once.
- "Most used" is COUNTED, not picked: `lib/hub-fonts-most-used.ts` counts how many face slots
  (heading · body · labels · script) of the ten Event Hub themes name each face. Couples' saved
  choices live only in production and are not read.
- The 24 new faces are declared in `app/_fonts/choice-faces.ts` with `preload: false`, so a guest
  page downloads a face only when text is actually set in it. Cardo, Pinyon Script and Poppins get
  latin `.woff2` cuts from the repo's own `.ttf`s (`scripts/subset-shipped-fonts.py`); the six
  Reserved-Font-Name faces are served from their committed `.ttf`, unmodified (OFL §3).
- Migration `20271249835872` widens the `events.site_font_key` CHECK to the 35 keys (the nine stored
  keys are unchanged).
- Guards: `hub-fonts-are-loaded.test.ts` now also fails if a shipped family is missing from the
  list, if a face is declared but not applied to `<html>`, if a new face preloads, or if the CHECK in
  force (the LATEST migration stating it) disagrees with the keys; `hub-fonts-most-used.test.ts`
  fails if the shelf and the count disagree or if a tie decides the fifth place.

SPEC IMPACT: None — extends the shipped Event Hub Pro "Custom Fonts" list (a fixed list, as locked);
no decision changes.
