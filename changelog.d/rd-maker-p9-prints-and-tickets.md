## 2026-09-25 · feat(event-hub): Prints & Tickets — the themed set, and the QR PDF on the Guest list

Event Hub Maker **Phase 9** (`EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md`). The bar's third group,
"Prints & Tickets", stops saying "coming next" and opens a workspace; the Guest list gains the free
do-it-yourself QR PDF.

**The Guest list — "Download QR codes (PDF)"** (owner 2026-09-25: *"the free version is the PDF of QRs
if they want to do it themselves"* → *"found on Guestlist"*). A trailing door in the roster row
(`lib/roster-doors.ts`, rendered as a plain `<a download>`), before and after the day, for every
event, store shell included. A real PDF (pdf-lib), A4, 12 per page: each guest's own invitation QR
(`renderInvitationQrPng` — the same URL and monogram badge their on-screen code carries) with their
formal name, and their table once seating is published.

**Prints & Tickets in the Maker** — six pieces in the couple's theme (a retired id is read as its
alias, so `capiz` prints as Vintage): The Invitation · The Entourage · The Finer Details (5 × 7 in) ·
Event pass (CR80) · Welcome poster (A3) · Event card (3 : 4). Media themes print the loop's first
frame; Classic prints on paper alone. Die-cut per theme (scallop, arch, chevron, deckle, rounded).
Preview chips redraw the set in any of the ten themes without saving anything. One line points back
to the Guest list for "just the QR codes".
- **Free = samples**: screen resolution, the still recompressed, a diagonal "Sample" mark baked into
  the SVG and the PDF, no bleed, no crop marks, no layers.
- **Event Hub Pro = print-ready**: 3 mm bleed with paper and still running into it, TrimBox +
  BleedBox, crop marks in a slug, and optional-content LAYERS named for the print shop — **Foil**
  (names, on Luxe · Gatsby · Regency · Cinderella), **White ink** (an underprint of every inked outline
  on dark or kraft stock), **Die cut** (the cutter's line). Plus "Every guest's pass (PDF)" — one CR80
  page per guest, each QR opening that guest's own invitation.
- **App-store shell**: samples show; the print-ready controls are absent (not locked); no price.

**One layout, two renderers.** `lib/print-layout.ts` lays each piece out once as drawing ops in points;
`lib/print-render-svg.ts` draws the on-screen sample and `lib/print-render-pdf.ts` the PDF — so the
sample a couple approves IS the file. Type is vector outlines from the TTFs traced into every lambda
(the `lib/glyph-path.ts` pipeline), never a host font.

**Facts, never placeholders.** Print uses the **ceremony block's** time (`block_type = 'ceremony'`,
read as the venue's wall clock), not the first schedule item. Venues: the block's location, else the
finalized booking, else the Save-the-Date field. Entourage from `lib/entourage.ts` in the couple's own
section order. Dress code from `dress_code_config` (group + role rules) with Mood Board swatches.

**New field** — migration `20271247112792_events_print_details.sql`: one JSONB `events.print_details`
(`parents: [{name, deceased, side}]` → the **†**, `opening_line`, `rsvp_contact`, `gift_lines` — account
digits print masked `•••• 1234`). CHECK: an object ≤ 16 KB. `GRANT SELECT` to `authenticated` only (no
UPDATE — the one writer is the route, through the admin client after `getHostUserId`; no `anon` —
nothing anonymous reads it), `events_host` rebuilt verbatim from 20271243462207, post-conditions
refuse a half-grant. Ugat: an ordinary column is structurally invisible to the concept map (its
coverage test says so), so no node or baseline line.

**+1 route handler** — `app/api/hub-print/[piece]/route.ts`: GET `invitation|entourage|details|pass|poster|card|set`
× `mode=screen|sample|print`, `passes` (Pro), `qr-codes` (free); POST `words` saves the card words
(Origin-checked, host-gated, 303 back to the Maker). **The Pro gate is server-side**: a free event
asking for `print` or `passes` gets 403 before anything is read. Server actions: +0. Pages: +0.

**Draft rule**: the card-words form carries "Saves immediately" and sits on the reasoned LIVE list in
`every-maker-form-drafts-or-says-so.test.ts` (paper-only words; no guest surface reads them).

Tests: `lib/print-pieces.test.ts` (12 — ceremony time from the ceremony block with a different first
block, † only when departed, masking, every theme has a die-cut, CR80 + 3 mm bleed, sample PDF has no
BleedBox/TrimBox/OCProperties, print PDF has the three named layers, Sample mark in the SVG, the gate
incl. store shell, the route refuses before it reads, entourage order, no price on the workspace);
`lib/roster-doors.test.ts` +1; the Maker bar test now holds Prints & Tickets as a real tool.

Deferred: the couple's own hero photo on paper (P6's `resolveHero` — not on main when this was cut;
the owner's event has no hero photo, so the theme still is what prints), signs (table / directional),
the Ninong/Ninang ask card, a share-ready video invite, re-pointing the four existing print pages'
look (`invitation/print`, `seating/print`, `event-qr`, `[slug]/print`) to the theme, and CMYK. The theme
stills are the loop's first frame at the loop's resolution — fine for a 5 × 7 at typical print
density only if the source frame is large enough; a print-grade still per theme is an asset task.

SPEC IMPACT: None — implements `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` Phase 9 and the DECISION_LOG
2026-09-24/25 rows (PRINTABLES MATCH THE EVENT HUB · PRINTABLES ARE PRO · FREE = QR PDF ON THE GUEST LIST)
as written. One reading flagged for the owner: the guest-list QR PDF ships as a real PDF download (the
controller's brief asked for a valid PDF), where the plan said "HTML + window.print() first".
