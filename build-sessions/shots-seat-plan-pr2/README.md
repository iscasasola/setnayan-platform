# Seat plan part 2: a hall's floor plan in venue mode (390 px, 23 Nov)

Drawn by the dev lab `/dev/spaces-lab`. It mounts the real `SpacesScreen` → `SpaceSheet` → `BaseLayout` → `VenueSeatPlan` → `SeatingEditor` (`source.kind = 'venue'`) over fixture rows, because a cloud session has no database or sign-in. The fixture is Hall001: 20 × 30 m, five round tables of 10, and one long table of 12 with chairs at the ends. None of the six has a saved spot. The main door is on the front wall.

Dark is forced with the `dark` class, as in `build-sessions/shots-spaces/screens/README.md`. The Next dev "issues" badge is hidden; it only reports the layout's Supabase reads failing with no database.

Drawing: specs `prototypes/spaces_final_screens_2026-11-19.html` screen 4 (Base layout). The editor's own look is the couple's approved seat-plan floor (DECISION_LOG d1fafcd5, option B: one editor).

| file | what it shows |
|---|---|
| `01-hall-base-layout-390-*` | The hall's Spaces sheet, Base layout open: the hall's picture (`PlanPoster`), "Open the floor plan", and the rows. |
| `02-hall-floor-plan-venue-mode-390-*` | "Open the floor plan" → the one editor, full screen, in venue mode. It shows the hall's wall at 20 × 30 m, its six tables inside it, the entrance, and Fit · + · −. There are no guests, no status line, no View picker, no 3D and no List. |

## Fixed on the way to these shots (each was live in the lab)

1. **The editor opened behind the sheet.** `RiseScreen` sits on the pop layer (40) and the Sheet on the modal layer (50). Opened from inside a Sheet, it now rises on `--sn-z-modal`, using `[data-rise-over-sheet]` in `globals.css`.
2. **On a phone it opened on the guests' List.** A hall now stays on its floor at every width.
3. **The hall's tables lay metres outside its wall, and Fit zoomed to 0.15.** The floor's first layout was 134 px wide. Unplaced tables dodged each other there, and `prev` kept those spots. Tables are now placed and framed in layout pixels (`layoutRectOf`), and a table nobody moved is placed again when the canvas size changes.
4. **Couple wording in a hall.** "0 seated · guests see it on the day", the people search, "Long banquet (8 seats)" on a 12-chair table, and the List and 3D views are gone in venue mode. Rows read "Long · 12 chairs · 2 at the ends".

## Seen, not changed here

- The first table's outer chairs touch the left wall. This is the editor's shelf padding, the same on a couple's plan.
- Each table still prints a tiny "0/10" under its number.
- A strip of the cell above the floor is empty, because the room's 2:3 letterbox is narrower than the cell.
