## 2026-10-08 · feat(maker): the Invitation's looks are pictures — palette cards, sample shapes for empty scenes, Do's & Don'ts in the hub's own type

Owner's preview checks, 08 Oct (Stages panel), built in the order A · E · D · B · C · F, one commit each.

- **A · The palette's looks are picture cards** (*"palette should show the actual previews like the other styles"*).
  On the Dress code part, the "Palette ▾" dropdown is replaced by the shared look-card carousel (`StyleCards`):
  one card per look (Tags · Fabric swatches · Paint chips · Circles · Ribbon), each the couple's own page asked
  for the Dress code scene with its colours in that look (`?style=dress_code_palette:<id>` → `canvas.palette`,
  host canvas only, nothing written), fitted on "Our colours" and sized by its shape. The stored value, its
  default (Tags = absent) and the guest page are unchanged. Studio › Look › Colours keeps the dropdown (the page
  under it may be a stage that draws no Dress code to picture).
- **E · An empty scene draws its look in sample shapes** (*"still cannot see the gallery style? maybe show what
  it could look like with boxes?"*). In the place every look card and the canvas share — the scene's own empty
  state on the Maker's canvas (`MakerEmptyScene`) — each look now draws its real arrangement in grey boxes
  (photos) and short grey lines (words): Special message · Schedule · Venue map · Reminders · Love Story ·
  Photos (the gallery) · Countdown, plus an empty Dress code (its three layouts and, under Colours and roles,
  its five palette looks) and the E-Gifts door (`app/[slug]/_components/maker-scene-samples.tsx`, keyed by the
  registry's own ids). Shapes only — never a name, date or photo; `aria-hidden`; replaced whole by real
  content. A guest is never served one: the callers mount them only on the verified host canvas, and
  `globals.css` hides `[data-maker-sample]` on any page without a Maker marker.
- **D · Do's & Don'ts in the Event Hub's own type** (*"the presentation of do's and don'ts doesn't look good
  with the rest of the website"*). Two looks beside the shipped notes (`lib/dress-code-looks.ts`, drawn by
  `dress-code-dos.tsx`): **Ticks and crosses** and **Side by side** — headings in the page's display face,
  lines at the scene's body size, a ✓ (gild) before each do and a ✕ (ink) before each don't, NO filled box.
  Picked as picture cards on the Dress code part ("Do's & Don'ts", three cards), stored beside the palette look
  as `config_json.canvas.dos` (no migration), followed by all three layouts and the guest's own panel. **The
  shipped two notes stay the default and an absence** — a page that never picked is byte-identical (guests are
  opening invitations the morning this ships); flipping the default is one constant, on the owner's word. The
  approved prototype draws no guest-page looks for this part, so the two are built from the owner's words and
  the shipped tokens.
- **B · Photos of you presents its three gallery styles** (*"this needs to present different gallery
  styles"*). The Maker's stand-in (`MakerDayPartStandIn`) now lays its sample photos exactly as the shipped
  looks do — The grid (three across, the count under) · The big one (the latest large, its line, a strip that
  slides) · Polaroids (instant prints two across, each with its time) — read against the shipped renderer by
  the test, fenced like every sample (`data-maker-sample`, `aria-hidden`), and still ONE section right after
  its marker, so the pick frame is the part's own box.
- **C · Figures ▾ Drawn · Hidden — Photos blocked** (*"allow an option not to show this also or pick a style
  to show or upload a photo for each?"*). The Dress code part carries one dropdown, **Figures ▾ Drawn ·
  Hidden**. It is ONE setting with two doors: it reads and writes the same
  `events.dress_code_config.show_figure` the Mood Board's switch does, the whole config through the one draft
  door — no second key, no migration, guests unchanged until ✓ Apply. **Photos is not offered**: a photo per
  role is not stored (the Attire boards hold three slots — bride · groom · entourage; the other four wait on
  a migration widening `event_inspiration_assets_slot_key_check`) and guests cannot read
  `event_inspiration_assets` (host-members-only RLS; no guest loader reads it).

SPEC IMPACT: `STAGES_PANEL_BUILD_STATUS_2026-10-08.md` gains "Round 5 — looks as pictures" (status only; no
decision changed).
