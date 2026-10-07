## 2026-10-07 · feat(maker): Studio's screens redrawn to the approved prototype (Builder SR)

Owner, verbatim (2026-10-07): *"the lower toolbar did not execute the designs style we agreed on
the prototype"* · *"seems like nothing was built properly"* · *"run all four"*. DECISION_LOG
2026-10-07 "THE STAGES PANEL IS REDRAWN FROM THE PROTOTYPE…" applies to Studio too; reference list
`MAKER_SIDE_BY_SIDE_2026-10-07.md` (M27–M31). Prototype:
`prototypes/maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`. The shipped DATA, SAVES and
draft writes are reused untouched — only the controls are redrawn. Everything is behind the new
Maker (`stagesStudio`); the shipped Maker renders as before.

- **One look for every Studio screen** — `lib/studio-skin.ts`: the prototype's `.fhead`, `.ddp`,
  `.fright.saved`, `.sdone`, `.autob`, `.gh`, `.grp .fr`, `.sw`, `.quiet`, `.pr-sv` as shared class
  strings on the app's tokens (the warm page is the gold ornament mixed into the page colour).
- **Tool row** (`StudioToolRow`): Tool ▾ across the row in capitals · ✓ Saved at its end (drawn
  from `MAKER_UNHELD_WRITE_EVENT` / `makerSavesInFlight` — "Saving…" while a write is in flight) ·
  ✓ Done on Wedding March and Seat plan. An end slot takes a tool's own control: the Mood Board's
  ✨ Auto and its Saved now sit IN the row (portalled), as the prototype draws them.
- **Studio home**: the prototype's icons (monogram for Logo, the board mark for Look and Mood
  Board, clock, walking figure), its warm page and badge colours.
- **Full screen** (`studioFullScreenCss`): the editor is the screen under the Tool row, edge to
  edge on the warm page (no floating sheet); every switch is the prototype's green `.sw`; fields are
  44 px; each field of a form is a row on a white band with a hairline (never a box —
  `lint-no-card`); form group headings ("Your event", "Your Event Hub", "Your invitation set",
  "For the day") via the workspace's new optional `formHeads`.
- **Info (M27/M28)**: one scrolling form grouped as the prototype; the opening line's tone chips
  are ONE "Start from ▾" dropdown with its helper behind ⓘ (shipped Maker keeps the chips).
- **Prints (M31, "one list")**: each piece is one row — name, its sizes, size ▾, its Saves as small
  buttons right under it (`PrintSaveButton` `chip`), then what it includes; "For the day" rows carry
  their blurb and chips. Same pickers, files and switches.
- **RSVP**: the prototype's rows — Reply by · How guests answer ▾ (with its line) · WORDS · WHAT THE
  REPLY ASKS (Attending · always asked, then a green switch per question) · When yes.
- **E-Gifts · Your Event Hub · quiet rows**: the same rows on white bands, 52 px switch rows,
  dropdowns as the prototype's `.dd`, Restore / Reset… / About as `.quiet` rows.
- **Look (M29)**: Studio › Look opens straight on its one full-width bar (Background · Colours ·
  Fonts · Music, the plain segmented), the panel the lower third's whole width — the tall tiles are
  gone there. Background's choices are drawn as the prototype's carousel of real pictures (each
  loop's still, the hero, the couple's upload, the plain colour) — the dropdown's own list and
  pick (`groundOptions` / `pickGround`).
- **Lab**: `/dev/maker-lab?studio=1` now mounts the Look stand-ins (Mood Board and Logo no longer
  fall back to Background — lab-only: the real launch page always passes `look`) and the march
  fixture, so Studio's side-by-sides show real-looking content.

Held by `apps/web/lib/studio-screens-follow-the-prototype.test.ts` (rendered Tool row, home,
opening line both ways, the Prints row both ways; the workspace's Look; the full-screen CSS).

- **On top of step 4c (#6395, merged)**: E-Gifts' QR upload and Registry link sit in the same
  white band as the four ways to give; Look › Colours' five colours are the prototype's `.lk-col`
  pills (swatch · name · job · hex · ▾) over 4c's one-colour draft; Pattern · Focus · Blur · Shade
  are the prototype's row dropdowns.

- **Mood Board › Attire** (owner 2026-10-07: *"the palettes can still be changed to colors
  manually"*): every colour a role wears is a button — it opens the SAME colour picker sheet as
  the five main colours (now · from your photos · swatches · custom — any colour), the change goes
  into the painted-palette draft (counted on ✓, published by Apply), and the sheet offers "Remove
  this colour" while the role keeps more than its minimum; ＋ still adds one.

Not in this PR: **Schedule and Love Story are NOT redrawn** — Studio opens the shipped Schedule rail
(`ScheduleDay`) and the Love Story scrapbook, which only render against the database, so the lab
cannot show them and no side-by-side was possible; they get the shared surface (warm page, edge to
edge, green switches) only. The top nav's Stages | Studio toggle (side-by-side S5) and the Stages
panel are Builder RD's. The Logo and Mood Board editors are lab stand-ins (no side-by-side).

SPEC IMPACT: None — translates the approved prototype; no decision changes.
