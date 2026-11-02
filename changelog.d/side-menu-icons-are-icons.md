## 2026-08-19 · fix(nav): the side menu draws icons, not characters

The rail's own rows drew typographic codepoints — `⌂ ◎ ⌕ ▦ ✧ ❖ ✎ ▣ ⛨ ▸ ⌃ ⌄` —
while the rows that push in below them (an event's sections, a shop's, the
admin's) drew Lucide SVGs. `front-door.css` said so in writing: *"The rail's own
rows use glyph characters; the app's nav rows use Lucide icons."* One list, two
icon systems, with the seam running through the middle of the account slot.

**A character is a font lookup, and the font decides.** These sit in
Miscellaneous-Technical and Dingbats, not the Latin the UI font ships, so every
platform resolves them for itself: `⌂` U+2302 is absent from the Android system
font, `⛨` U+26E8 is absent nearly everywhere, `⌃`/`⌄` U+2303/U+2304 are macOS
modifier-key glyphs, and `✎`/`✧` sit in ranges a phone may hand to the **emoji**
font. Nothing throws on a miss — the row keeps its label and its tap target — so
the only symptom is a wrong-looking glyph or an empty square. Same family as the
phantom column, the blocked iframe and the unresolved `r2://`: declined, not
thrown, and the only symptom is an absence. An SVG has no font to miss.

`⌕` U+2315 is TELEPHONE RECORDER. It had been doing duty as a magnifier in the
Marketplace row and in the signed-out search button.

Because the rail is ONE component mounted by all five signed-in trees and the
public doorways, this lands on phone, tablet and desktop at once.

- Twelve glyph rows → Lucide, through one `<RailIcon>` so a row cannot pick its
  own size. `⌕` → `Compass` for Marketplace, which is what `customer-menu` has
  always given Explore — the app's own answer, not a second one.
- The fifteen category rows drew the **same arrow fifteen times** while
  `WEDDING_FOLDER_ICON` — exhaustive over the taxonomy, pinned by
  `taxonomy-icons.test.ts` — was already giving each of them a distinct icon on
  the Explore strip. They now read `folderIcon(f.slug)`; no second map.
- **Size drift closed.** Two context rails drew 18px and the event rail drew
  16px in the SAME visual list — too small to report, enough to make the column
  read as unaligned. Stroke pinned to 1.75 for the same reason.
- **A CSS hole, not just a cosmetic one:** the only rule positioning an SVG in
  `.fd-gi` was scoped to `[data-chrome='app']`, and the same rail mounts on the
  public front door and the eight product doorways as `chrome="front-door"` —
  outside it. `.fd-gi` is now a flex box that centres its own child in every
  chrome. Verified live at `chrome="front-door"`: offset 0.
- The vendor rail's shop-name row drew a bare `▣`; it draws the same `Store` the
  rail's own shop row does.

**Guard:** `rail-icons-are-icons.test.ts`, over all four rail files. It strips
comments before matching — every retired glyph is named in the prose explaining
why it went, so a raw-source check would report the defect it just fixed.
**Seven sabotages, every one measured by occurrence count, all RED.** One
assertion was decoration on its first run and is recorded as such: a file-level
`match` for the stroke stayed **green** while one row dropped to Lucide's
default (2 → 1 occurrences, pass=4 fail=0), because a file-level count cannot
say which row still obeys the rule. Inverted to "every stroke must BE 1.75".

**Verified live** on the dev server at 1440 / 1100 / 375: real `lucide-house`,
`lucide-book-open`, `lucide-sparkles` and `lucide-search`, 18×18, stroke 1.75,
horizontally centred at offset 0, in full-rail, 72px icon-strip and off-canvas
phone modes. ⚠ **Signed-out only** — the machine has no Supabase credentials, so
the signed-in rows (People · Your Story · Shop · HQ · the fifteen categories)
are covered by the tests and by the shared `<RailIcon>`, **not** by an
observation. Do not upgrade that to "verified live".

SPEC IMPACT: None. No route, address, price, SKU or copy changes — the icon
drawing is the whole change, and every label is byte-identical.
