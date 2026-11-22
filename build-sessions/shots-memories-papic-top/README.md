# Memories · Papic on top — Now beside Proposed (390 px, light + dark)

Taken 2026-11-20 at 390 × 844, deviceScaleFactor 2, from the dev lab `/dev/bar-lab/dashboard/ev-lab/memories?n=7`.
The lab is the REAL `EventMemoriesGallery`, `PapicCard`, `MemoriesKeepsakeRow` and the four cards, on fixtures. It has
no sign-in and no database, and makes no prod writes.

- **Now** = `origin/main` @ 459ccbadc, with the same fixture Papic card handed to the lab in its old shape. The lab draws
  no Papic card on main.
- **Proposed** = this branch.

| File | What |
|---|---|
| `01-top-*` | the page top: Papic block → keepsakes → filter row → grid |
| `02-papic-settings-*` | the opened Papic settings (Now: unfolded in place · Proposed: risen full screen) |
| `03-magazine-*` · `04-recap-*` · `05-flash-*` · `06-thank-you-*` | the four keepsake sheets |

⚠ The lab has no database. The camera settings themselves (Filter, Credits per guest, Face tagging…) read the event,
so both lab sheets show only "Shooting into" + "How the camera works". Their order and words are unchanged by this
PR. On the real event the sheet holds them all, below "Shooting into".
