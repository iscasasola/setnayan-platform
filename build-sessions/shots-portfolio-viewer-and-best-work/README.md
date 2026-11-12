# Portfolio — rulings 5951 + 5940 · 390 px · Now beside Proposed

Lab: `/dev/supplier-lab?s=portfolio-tab` (`&none=1` empty shop · `&unread=1` every read refused). Now = `origin/main`
(d7adb5d8), Proposed = this branch. Playwright, iPhone-width 390 × 844, DPR 2.

| Moment | Now | Proposed |
|---|---|---|
| First sections | `now-1-first-sections.png` | `proposed-1-first-sections.png` — **Your best work** first (most viewed, 280 px tiles) |
| Closing rows | `now-2-closing-rows.png` | `proposed-2-closing-rows.png` — More, then **Reorder** |
| A photo opened | `now-3-photo-opened.png` (hand-over Show, no actions) | `proposed-3-photo-opened.png` — the shared viewer, ‹ ›, **Send to a chat** |
| Slide | — (snapped) | `proposed-3b-slide-out-mid.png` (a real frame, −342 px, frozen for the picture) → `proposed-3c-landed-4-of-10.png` |
| Empty shop | `now-4-empty-first-sections.png` | `proposed-4-empty-first-sections.png` — best work keeps its title, Example, placeholder and Upload door |
| Send to a chat | — | `proposed-5a…5d` — list · search "cruz" · confirm + note · "Posted in Cruz debut’s chat" |
| Reorder | — | `proposed-6-reorder-sheet.png` (↑ ↓ per section; best work moved down one) |
| Unread | — | `proposed-8-unread-first-sections.png` — "Couldn’t load this just now", no Example |

Measured in the browser (Playwright, per animation frame, one › press): the photo travels 0 → −390 px in ~280 ms, then
the next lands +390 → 0 px in ~280 ms; the counter reads "4 of 10" when it lands. Reduced motion: no travel at all; the
house-wide reduced-motion rule (`globals.css`, transitions 0.001 ms) makes the fade instant, and the swap still completes.
