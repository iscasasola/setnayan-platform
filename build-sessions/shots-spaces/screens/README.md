# Shop › Spaces — 375 light · 375 dark · desktop (20 Nov)

Drawn by the dev lab `/dev/spaces-lab` (the real `SpacesScreen` + `SpaceSheet` + `BaseLayout` over fixture rows; a cloud
session has no database or sign-in). Drawing: specs `prototypes/spaces_final_screens_2026-11-19.html` (specs d8f4fa8).
The lab is wrapped in the `data-supplier-look` marker the `/vendor-dashboard` template adds.

| file | drawing screen | state |
|---|---|---|
| `01-grid-*` | 2 | Pro shop on Sun 14 Feb: Grand Ballroom booked, Room002 in repair, chairs 8 in repair |
| `02-grid-plus-locks-*` | 2 · 7 | below Pro: generic names (Hall001 …) and the 🔒 "Make it a floor plan · Pro" row |
| `03-hall-booked-sheet-*` | 4 | a booked hall's sheet names who holds it: "Booked on Sun 14 Feb: Reyes wedding" |
| `04-hall-base-layout-*` | 4 (Base layout) | #7968's doors and tables in the hall, on the shared plan maker's Grid |
| `05-new-sheet-from-box-*` | 3 · 4 | typed "Deluxe suite" + ＋ in the box → New hall, the words as its name, preview, Add another like this |
| `06-new-rooms-plus-*` | 6 | below Pro: Room, How many 12 on 2F, 🔒 "Your own names · Given for you: Room003", preview Room003 … Room014 |
| `07-object-sheet-*` | 5 | Object: what it is, how many you own, in repair, More (space · power · person · out and back) |
| `08-clothing-sheet-*` | 5 | Clothing: type, colour, sizes as steppers, "4 in all" |
| `09-vehicle-sheet-*` · `10-cart-sheet-*` | 5 | Vehicle (type, seats, driver) · Cart (what it sells, space, power) |
| `11-show-filter-*` | 2 | the sliders' Show: All + the six kinds |
| `12-day-unread-*` | — | the day's holders refused: a warning, and no "Free" on any tile |
| `13-refused-*` | — | the spaces read refused: says so, Try again — never "no spaces yet" |
| `14-empty-*` | — | a shop with none yet |
| `15-card-add-first-*` | 8 | a venue CARD with no hall yet: "Uses · Which spaces this card books · None yet ▾" (`?state=first`) |
| `16-card-add-first-menu-*` | 8 | the menu: "＋ Add a hall · For your shop" · "＋ Add something else · The six kinds" |
| `17-card-add-first-sheet-*` | 8 · 4 | "Add a hall" opens the Spaces sheet in place, the first hall filled from Room size & capacity (300 seated) |

**Re-taken 22 Nov after the train merged origin/main:** `01`, `02`, `14`, and the new `15`–`17`. The others are the 20 Nov
takes; nothing they show changed in the merge. Dark is forced with the `dark` class: `/vendor-dashboard/spaces` is not
on the dark ready-list (`lib/appearance.ts`), like the rest of Shop, so production paints it light today.

Dark here is the EVENTS family (terracotta) because supplier navy is PR #7997, not on main.
