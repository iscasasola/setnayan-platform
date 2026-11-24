# #8057 proof — 375 light · 375 dark · desktop (20 Nov)

Drawn by the dev lab `/dev/guests-lab?part=screen&gview=seats` (the real Guests › Seats over fixture rows; no sign-in, no
database), on the branch's final code. Drawing: specs `prototypes/guests_redesign_2026-11-20/guests_redesign_2026-11-20_fable.html` §5 · §6 · §9 · §10.

| file | drawing | what it proves |
|---|---|---|
| `01-floor-2d-*` | § 5 | the room fitted, "Your room · 24 × 18 m", rings, legend "22 seated · 9 to seat", the zoom pill (fit · − · +) in the thumb row, nothing on the plan's edge |
| `02-spots-list-*` | § 5 | "Supplier spots · 1" opens who is where ("1 · Lechon station") |
| `03-empty-floor-*` | § 9 | the empty floor: "No tables yet — Seat everyone for me, or Add a table" in the lower third |
| `04-add-table-box-*` | § 9 | the Add box: Shape ▾ · Seats − 10 + above it, "Table 1" filled, "Table ▾" at its right end |
| `05-room-3d-*` | § 6 | Walk in · Accents · View only, one row, with words |

Dark: the lab's stand-in shell (SETNAYAN header, bottom nav) stays light, because `/dashboard` is not on `DARK_READY`
(`lib/appearance.ts`) on main; the floor itself follows the tokens. A parity gap of the lab and of main, not of this PR.
