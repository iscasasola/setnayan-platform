# HANDOVER — Prints: one settings sheet + one download per piece (builder, 2026-10-17)

Branch `rd/prints-settings-downloads` · worktree `~/Documents/Claude/Projects/wt-prints-settings` · base origin/main 03996514e9.
Ruling: corpus DECISION_LOG 2026-10-17 "APPROVED — PRINTS: ONE SETTINGS SHEET, ONE DOWNLOAD PER PIECE, VIEW AS ▾ …".
Contract: corpus `prototypes/prints_settings_and_downloads_2026-10-17.html` + `after-375-01..10` (copies in the session scratchpad;
re-extract with `git -C ~/Documents/Claude/Projects/Setnayan show origin/main:<path>` — never pull that checkout).
NOT committed into the PR at the end (delete before the final push when CI is green).

## Plan (status)
1. [x] Print settings — `EVERY_PRINT_ITEM` in Studio becomes the ⚙ row that opens ONE sheet; every include switch / field moves in.
2. [x] Piece rows — picture · size ▾ · ONE Download.
3. [x] Guest pieces — shared View as ▾, Download for that guest, All guests ◆ (pass · digital ticket · QR codes · place cards).
4. [x] Everything ◆ — replaces Download the set's buttons.
5. [x] Bar — "Print settings" first, ⬇ step opens the Download sheet.
6. [x] Routes — QR sheet + place-card pack Pro; one guest's QR / place card; Everything.
7. [~] Guards + sabotage (done, 6/6 red), changelog fragment (done); walk (waiting for the WALK lane — serve script
   `controller-2026-10-12/serve-generic.sh wt-prints-settings 3217 prints-settings <dir>/serve`, queued), side-by-sides; PR + CI at 375 (WebKit iPhone 13), side-by-sides, draft PR.

## Decisions taken (not in the record)
- Download label: "Download" everywhere; a Pro theme the couple has not unlocked downloads Classic and says "Download · Classic".
- The pass count line follows the prototype (no size in it): "N passes · a coming, p not replied yet · ganged on A4 with cut lines".
- QR sheet + place-card pack count lines carry no number (not read here — never a guess); pass/ticket counts are the file's own read.
- View as ▾ lists the pass guests (`loadPassGuestNames`, the ticket rule) for all four guest prints; a guest with no seat → the place
  card route says so in words (404). No search box: `PickMenu` sits at its inline-size line (a search row would split its chunk).
- Place-card row picture stays the pack's page 1 (a per-guest picture would show the route's 404 for an unseated guest).
- Everything = set + registry + QR sheet (one doc) + passes (imposed, merged) + pack, chart (by table, default size), caterer PDF,
  2D seat plan (each from its own route handler, called in-process, pages copied). Event QR (a PNG) is not in it.
- The seating page's printable HTML pack (`/seating/print` with no format) is left free — a different door; flagged for the owner.
- Retired: StudioPassRows, StudioOnePass, StudioAllInOne, StudioActionDoor parts; PassCardsPanel/PrintSetDownloads lost their studio branch
  (the shipped Details still draws them). Port baseline regenerated for the removals.
