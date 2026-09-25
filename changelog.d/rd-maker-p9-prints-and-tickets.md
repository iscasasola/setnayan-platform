## 2026-09-25 · feat(event-hub): Prints & Tickets — the themed set, and the QR PDF on the Guest list

Event Hub Maker **Phase 9** (`EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md`) plus the owner's same-evening
rulings (watermark, low-res, formats, Details, QR-always, NFC 25 mm). The bar's "Prints & Tickets"
stops saying "coming next"; a new made-once item, **Details**, joins Logo · Hero · Reveal · Love Story.

**Guest list — "Download QR codes (PDF)"** (owner: *"the free version is the PDF of QRs … found on
Guestlist"*). A trailing door in the roster row (`lib/roster-doors.ts`, a plain `<a download>`),
before and after the day, every event, store shell included. A real A4 PDF, 12 per page: each guest's
own invitation QR (`renderInvitationQrPng`, same URL + monogram badge) with their formal name and table.

**Prints & Tickets** — six pieces in the couple's theme (`capiz` prints as Vintage): The Invitation ·
The Entourage · The Finer Details · Event pass · Welcome poster (A3) · Event card. Media themes print
the loop's first frame; Classic prints on paper alone; die-cut per theme. Preview chips redraw the set
in any theme without saving. **Formats** (`PRINT_FORMATS`, owner: *"calling card … train ticket, plane
ticket … index card / a5"*): pass = calling card 90×54 (default) · CR80 · train 140×70 · boarding pass
203×82 (Table · Seat · Time); cards = 5×7 · A5; event card = A5 · index 5×3 · 6×4 — laid out per
format, never stretched. **The Event Hub QR always prints** on every card and pass (*"QR is automatic.
NFC is optional"*); an optional **25 mm NFC sticker spot** (`NFC_STICKER_DIAMETER_MM`, true to size,
2 mm clear) sits beside it.
- **Free = a sample that cannot be cleaned up**: ONE flattened JPEG rendered on the server
  (`lib/print-sample-raster.ts`) — ≤ 800 px long edge, quality 60 (`SAMPLE_LONG_EDGE_PX`,
  `SAMPLE_JPEG_QUALITY`), a tiled diagonal "SAMPLE · SETNAYAN" watermark (opacity 12–22 %, over the
  names and the QR), every QR swapped for a non-scannable placeholder, no bleed, no marks. Never a PDF,
  never a vector — a free couple's Maker shows the same JPEG.
- **Event Hub Pro = print-ready, unwatermarked**: 3 mm bleed, TrimBox + BleedBox, crop marks, and
  named layers **Foil** · **White ink** · **Die cut**; the per-guest pass batch gangs onto A4 with cut
  lines (calling card 8 per sheet). Pro is checked in the route handler BEFORE anything is read or drawn.
- **App-store shell**: samples only; the print-ready controls are absent; no price.

**Details** (made-once, label in `MAKER_DETAILS_LABEL`): the Event Hub **address** (the shipped
`SlugField`, with its QR) · on/off toggles for what the prints include — Guest list (names on passes,
parents on the card), Seat plan (3D · 2D · List → the existing seating print), E-Gifts (details +
thank-you message), Love Story (excerpt), Schedule (guest-visible moments), Mood Board colours, NFC spot,
opening line, "Kindly reply", special message. Each reads its ONE home: parents from the Guest list
(roles Parents of the Bride/Groom), gifts from E-Gifts, the thank-you message IS `events.pabuya_message`
(the E-Gifts editor, reused), the special message IS `events.special_message` (its own action), the
reply line is a pick of a host / the coordinator (read from their account) or typed. Opening-line
templates follow the E-Gifts message pattern (a template fills the box; the text is what is saved).

**One layout, two renderers.** `lib/print-layout.ts` lays each piece out once as drawing ops;
`print-render-svg.ts` / `print-render-pdf.ts` draw them. Type is vector outlines from bundled TTFs. Print
uses the **ceremony block's** time (not the first schedule item). 🪤 opentype's `toPathData(2)` emits
`NaN` for some glyphs at some positions ("Ceremony" printed "Cere ony") — path data is built from the
commands instead.

**Migration** `20271247112792_events_print_details.sql`: one JSONB `events.print_details` —
`{ opening_line, rsvp: {kind, moderator_id|text}, include: {…} }` (only what has no other home). CHECK:
an object ≤ 16 KB. `GRANT SELECT` to `authenticated` only; `events_host` rebuilt verbatim from
20271243462207; post-conditions refuse a half-grant. Exposure baseline: +1 line
(`events.print_details anon=- authenticated=S`). Ugat: a column is structurally invisible to the concept
map — no node, no baseline line.

**+1 route handler** — `app/api/hub-print/[piece]/route.ts` (GET pieces × `mode=screen|sample|print` ×
`*_format`, `set`, `passes`, `qr-codes`; POST `words`). Server actions +0. Pages +0.

**Draft rule**: both Details forms and the address / thank-you editors say "Saves immediately" and sit
on the reasoned LIVE allowlist of `every-maker-form-drafts-or-says-so.test.ts`.

**Tests** — `lib/print-pieces.test.ts` (15): ceremony time from the ceremony block; † only when departed;
print_details stores choices, never copies; masking; die-cut per theme; every format lays out at its mm
size and its PDF TrimBox matches; the pass batch gangs on A4 and every pass format fits; the free sample
is a JPEG ≤ 800 px, watermarked across the whole sheet, QR replaced; print PDF has the three layers and
no watermark; GUARD: the free path never reaches `renderPrintPdf` / `renderImposedPdf` /
`renderPrintSvg`; the QR prints — on the sheet — for every piece × format × include combination × mode;
the NFC spot is 25 mm in every format that draws it; entourage order; no price on the workspace.
`roster-doors` +1; the Maker bar test now holds ten items (Details) and Prints & Tickets as a tool.

**Deferred (own PRs)**: `guests.in_memoriam` ("Passed away" on the guest row — listed, not counted;
prints "the late …"/†) with the headcount sweep; Details → scene-slot binding with "apply everywhere /
just this scene" overrides; the stages reading the include toggles (today only the prints do); the Seat
plan printing inside the set (today it links to the shipped seating print / 3D plan); the couple's own
hero photo on paper (P6 `resolveHero`); signs; CMYK; print-grade theme stills.

SPEC IMPACT: None beyond the plan and the 2026-09-25 owner rulings already in DECISION_LOG. Flagged for
the owner: the Guest-list QR sheet ships as a real PDF download (the plan said HTML + print first).
