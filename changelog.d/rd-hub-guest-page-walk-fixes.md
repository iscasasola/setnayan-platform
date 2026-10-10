## 2026-10-11 · fix(hub): the guest page walk — seven faults a stranger met in the first two minutes

A tester walked the live sample event's guest page (`/maria-and-jose`, version
a316051) as a stranger on a phone: 0 console errors, 9 things WRONG, 12 ROUGH.
This branch fixes seven of the nine at their cause, one commit each, each with a
test that holds a property (and was sabotaged once to see it go red).

- **G01 · the cookie banner sat on the bottom bar** in 5 of 12 fresh visits (a
  tap on Details pressed "Manage"). The banner measured the route's bottom
  chrome once; the bar is streamed in afterwards. It now re-measures when the
  page changes under it (`MutationObserver`, once a frame, only while the banner
  is up). Geometry moved unchanged to `lib/bottom-chrome.ts` so a test runs it.
  The banner also publishes where its top is (`--cookie-banner-top`).
- **G09 · no button on the first screen** at 375 × 667; half under the bar at
  375 × 812. The signed-out "Get inside" docks above the bar while its own place
  is below the screen (`.sn-door-dock`, `position: sticky` — one button, never a
  copy), stands above the cookie banner on a first visit, and returns to its
  place (scrolled into view) when opened.
- **G02 · unreadable words on a dark Look** — the "and" between the names, the
  programme's times, "Our colours": 1.4 : 1. `--color-gild-text` became a word
  token on 2026-10-05 and was never added to `WORD_INK_TOKENS`, the list
  `pinWordInks` re-measures once a background replaces the paper. It is on the
  list now. No Look is repainted: a word that still reads is left as it is.
- **G03 · the report sheet's reasons and text box**, 1.09 : 1: drawn with the
  page's paper and ink only (a fill is a tint of the ink), all controls 44 px.
- **G04 · "the day, the place, the story ↓"** opened a page with no place and no
  story. The link's default words follow what the viewer's page holds
  (`hubLinkWords`). The couple's own words for the link are never rewritten.
- **G06 · a loading line for 10–12 s after Back.** The Back / Forward door of
  `NavProgress` now asks the rule the link-click door already asked
  (`navStartsTheLine`): only a change of pathname starts the line.
- **G07 · `/hub` said "THE DAY" with a lit "Live" tab 61 days early.** The hub
  page composes the stage exactly as the event's page does (preview → the
  couple's pin → the venue's clock) and, while that stage is before the day,
  redirects to the event's page. Outside the day's window its header reads the
  stage's word from `STAGE_BAR`.
- **G15 (rough)** · the banner's Cookie policy / Manage / Learn more: 40 → 44 px.

**What a guest page changes (the golden, regenerated deliberately):** one thing —
an event with no love story reads "the day, the place" under the date where it
read "the day, the place, the story".

**Not fixed, reported for an owner call:** the monogram's colour on a dark Look
(G02 — the couple's own logo ink), the home shelf's "the host approves who
joins" over a list-only event (G05), the link preview's face and the fixed
`theme-color` (G08), and the remaining ROUGH items.

**Not verified:** a real iPhone, Safari, the live site. The local server cannot
read the event (the copied `.env.local` carries no service key), so the browser
proof is the tester's saved copy of the live page drawn statically, and the real
banner / loading line / report sheet components run alone in Chromium.

SPEC IMPACT: None — no schema, no SKU, no locked decision. Two behaviours worth
the owner's eye are noted above rather than written into the corpus: `/hub`
before the day now opens the event's own page, and the cover's link no longer
names a place or a story the viewer's page does not hold.
