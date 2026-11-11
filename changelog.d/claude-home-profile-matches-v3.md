## 2026-11-11 · fix(home): the built page matches v3 (controller review)

- **Header = v3:** the photo is the logo's rounded square with its frame dot and a pencil on the corner; a pencil beside
  the name; the second line reads `@handle · setnayan.com/u/handle` (a link to the public twin). Pencils open the
  profile's identity tile (photo + frame, name) — real doors, no inline editor.
- **Doors = one row** that scrolls sideways (v3 `.counts`), the open section filled; the open door is scrolled into view.
- **＋ Create an event** — the full-width primary under the doors (v3 `.actions`).
- **Underlined tabs with counts** (Events N · People · Shop N · Memories) with a sliding underline, replacing the pill.
- **The pinned row shows only once the header has scrolled away**, above the tabs (v3 row 7, `.segwrap`): the shared
  `CollapsingTop` holds header + tabs at rest and locks to [pinned row + tabs]; each section's row is portalled into
  the top's seat (`HomePinPortal`). Home's row drops `usePinFold` (the ratchet's caller count goes down).
- Lab `/dev/bar-lab/dashboard`: the Events body draws the board's real Planning card on `SAMPLE_PLANNING`.
- Not drawn: v3's one line under the name — no column holds it (`users.public_greeting_opt_in` is a switch only).

SPEC IMPACT: None — brings the build to DECISION_LOG 2026-11-11 "HOME PAGE v3 APPROVED" (v3 prototype).
