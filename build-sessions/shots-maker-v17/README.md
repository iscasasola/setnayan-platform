# Shots — Event Hub Maker, drawing v17 (PR #8072, after the merge of the one-toolbar branches)

Taken 20 Nov 2026. **Left in every pair: the drawing**, `prototypes/maker_one_toolbar_expand_2026-11-20_fable.html` v17 at
Setnayan-specs `d8f4fa89`, its Proposed phone, Free couple, driven by its own script. **Right: this branch** in
`/dev/maker-lab` (maria-and-jose's real shape, no database) on a local `next dev`, 375 × 812 at 2×. Desktop: the build at
1280 × 800 (the drawing has no desktop).

| # | State | 375 light | 375 dark | Desktop |
|---|---|---|---|---|
| 01 | Resting bar — "Tap any scene to edit it · Look · Pages" | `01-resting-375-light.png` | `-dark` | `01-resting-desktop-1280.png` |
| 02 | A scene picked (Event title) — Edit | `02-edit-375-*` | ✓ | ✓ |
| 03 | Style tab | `03-style-375-*` | ✓ | ✓ |
| 04 | Animate ◆ tab | `04-animate-375-*` | ✓ | ✓ |
| 05 | Pages | `05-pages-375-*` | ✓ | ✓ (opened from the toolbar's name ▾) |
| 06 | ⚙ Event Hub settings | `06-gear-375-*` | ✓ | ✓ |
| 07 | 🎨 Look | `07-look-375-*` | ✓ | ✓ (desktop opens it from the same event) |
| 08 | Logo · ⤢ Expand → full screen | `08-expand-375-*` | ✓ | ✓ |
| 09 | ✓ Apply | `09-apply-375-*` | ✓ | ✓ |

⚠ **Dark:** the Maker still has no dark theme on `main` (the work-area half of #7993 never landed), so the build's
dark-scheme shots render it light — they show nothing breaks, not a dark design. The red "N · 3 Issues" pill is Next's
dev overlay (the lab's database reads have no database), not the app.

## Ways in walked (in the lab — no signed-in event exists here)

Resting bar → 🎨 Look and ≡ Pages · a scene tapped on the page → its toolbar · the toolbar's name ▾ → Pages · Pages →
Whole Event Hub (Look) · Pages → a page's 👁 → "What guests see" · ⚙ → every row · 👁 on the bar → Preview · ⤢ → full
screen → ✓ Done / ⤡ / Esc · ✕ / tap outside / drag down → resting bar · Stage ▾ → four stages. Not walked: the app's
own ways into the Maker (Event Hub tab, Today's card, notifications) — they need a signed-in event and a database.

## Matches v17

Full screen · ‹ · Stage ▾ · 👁 · ✓ · ⚙ · one toolbar on every scene (head ‹ name · page ▾ › ✕, foot Edit · Style ·
Animate ◆ · Expand) · ◆ only for a couple without the full Event Hub · a tap selects, nothing picked on arrival · the
resting bar · the way back (✕, Back, drag down, tap outside, Esc) · ⤢ on Logo, Love Story, Schedule, E-Gifts, never
Dress code · ⚙ in v17's five groups with "Nothing waiting" and Event info 🔒 · Look, "What guests see" and E-Gifts out
of ⚙ · Stage ▾ = four stages · Pages: Whole Event Hub first, "Before they come in" built-ins, Me · Live · Camera
built in · Animate words · picking a motion plays it · Edit heading last · Apply words · "Upload your own song ◆".

## Parity gaps — what differs, and why

| Drawing v17 | Build | Why / who decides |
|---|---|---|
| 🎨 Look = a "Whole Event Hub" part with the same Edit · Style · Animate toolbar | Opens the shipped Look editor (Background · Elements · Music) | Same fields, not yet moved into a part toolbar — a build of its own |
| Video scene ("Gifts, photos & video") | Not built | Needs a new `invitation_widgets.widget_type` value → the table's CHECK must widen = a migration (forbidden here). **Question for the controller** |
| Pages: ≡ drag, 👁 per scene, "Add a scene to X" | Scenes listed (tap selects), 👁 per page opens "What guests see", ↑ ↓ ＋ on the page | Per-scene hide/drag store is the shipped "What guests see" table; wiring it per row is next |
| Built-in pages' words editable (door, pass, Live, Camera headings + lines; Watch on/off) | Shown 🔒 with what they do | No store holds those words today (would need one — owner/controller) |
| Guest bar under the canvas goes (Pages replaces it) | Still drawn (Home · Details · Story · Me) | Overlaps #8074 (one bar per stage) |
| Canvas name tag ▾ and ＋ on the selected scene go | Still drawn | "What this removes" 10 — follows the Pages drag/add rows |
| Style: four groups Layout · Background · Words (Colours · Font · Text size) · Extras ◆, starting "Like the Event Hub", "Back to the theme look" | Layout and Background are named groups; Words is the toolbar's Colour · Size row; Font per scene, Extras ◆ and "Like the Event Hub" not yet | The look cards' rows are a guarded four-row grid |
| Animate: four dropdown rows (Arrives · While showing · Leaves · With the scroll) | The shipped three-phase panel, renamed; "With the scroll" is the shipped Plays ▾ (Scrolls normally · Plays with the scroll ◆) | Structure kept; words and play-on-pick are v17's |
| ◆ lead line "Style/Animate comes with the full Event Hub…" | Not drawn | No room in the four-row grid without moving a row |
| Edit: title = Event name › Date and place › Top line; Dress code second line "Made in Event › Mood Board" | Heading-last ordering for scene fields; the cover's parts keep their own Edit | Cover parts are separate parts |
| Apply: two buttons | "◆ Get the full Event Hub and apply" + the shipped per-part offer where the catalogue sells parts | Prices are catalogue data — never changed here |
| ⚙ sheet title as a title | The house Sheet's small-caps title | App-wide `sheet.tsx` change. **Question for the controller** |
| ⚙ rows as one style (doors with ›) | Shipped controls (switch, address field, dropdowns) | The writes are the shipped ones; "Live for guests" cannot be switched off once live (no un-launch exists — Who can view is the way back) |
| Full screen ⤡ where ⤢ was (foot) | ⤡ beside ✓ Done | Kept from the earlier review: at the foot it covered the Logo editor's Spacing slider |
| ⤢ on Wedding March and Memories | Not offered | No full-screen editor for either exists in the Maker |
| Dark Maker | Light | Maker dark theme not on `main` |
| Themes | As shipped (Classic · Modern · Cyber Neon free) | "OWN TEN THEMES — PARKED" |
