# HANDOVER — rd/desktop-maker-area-1 · started 2026-10-18 ~19:00 PHT by the controller

Owner list item 4 ("Desktop + iPhone together") + "Continue as it becomes available" + "Build until 97%". Ship-on-green
authorised through 19 Oct. THE RULINGS (corpus DECISION_LOG, read via `git -C ~/Documents/Claude/Projects/Setnayan show
origin/main:DECISION_LOG.md | /usr/bin/grep -n "DESKTOP"`): 2026-10-15 "DESKTOP MOVES AHEAD OF THE ADMIN DASHBOARD",
"DESKTOP COVERS THE WHOLE APP — FOUR AREAS, IN ORDER" (area 1 = Maker + guest Event Hub first), and "ONE-PAGE INVITATION
+ SAVE THE DATE, THE DESKTOP SYSTEM SHEET, AND FIVE ANSWERS — APPROVED" (top bar, Home · Story · Me on Save the Date, Home
jumps to the first section, keep the details card, Reply as a side panel).
CONTRACTS: MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md (3 columns; owner answered "all A") ·
prototypes/event_hub_one_page_and_desktop_2026-10-15_fable.html (the desktop system sheet, approved) ·
prototypes/event_hub_guest_desktop_2026-10-15_fable.html (check its status in the DL before building from it) ·
IPHONE_DUO_READINESS_2026-10-08.md (23 points: width-only breakpoints, asymmetric safe areas, fold, camera restart).
SCOPE OF THIS PR (area 1, part 1): the MAKER on desktop exactly as the adaptation doc draws it (3 columns), plus the
Duo-readiness points that live in the Maker/hub shells (width-only breakpoints, safe areas). The guest Event Hub desktop
is part 2 — only if the approved sheet covers it and time allows; otherwise name it as next.
Phone (375/390) must be pixel-identical to today (memory: phone first, 99 % of viewers) — prove it with before/after phone
shots. Desktop shots at 1280 and 1440 + side-by-side vs the doc/prototype. Keep the Maker first-load budget (≈0.1 KB
left; desktop-only code must be lazy and not load on phones; never raise the budget).
Other builders in the Maker right now: rd/logo-ornament-l5 (#6641, logo files), rd/edit-switches-follow-undo (#6642,
Edit panel state) — avoid their files; if you must touch a shell file they touch, keep it minimal and say so.
This is XL: commit + push after EVERY step and keep this HANDOVER current (done / next / exact state) — the account may
stop you at any time and the work continues on a new account. Own walk folder (scratchpad/desktop-walk/).
Shots → ~/Documents/Claude/Projects/shots-2026-10-18/<pr>/. Fragment changelog.d/rd-desktop-maker-area-1.md.

---
## STATE (builder, 2026-10-18 ~19:40 PHT) — keep current
Mechanism (decided, built): gate `makerDesktopColumnsEnabled` (lib/maker-desktop-columns-flag.ts — env
`NEXT_PUBLIC_MAKER_DESKTOP_COLUMNS_ENABLED` OR internal; registered in flag-chokepoint-scan). Launch page hands
`desktopColumns`; lab `/dev/maker-lab?studio=1&desk=1`. In maker-shell: `ss = stagesStudio && (phone || desktopColumns)`,
`desk = ss && !phone` → shell wears `data-maker-desk` and mounts lazy `MakerDesk` (maker-desk.tsx: the grid + top-bar
words via ::after, all CSS keyed on `[data-maker-desk]`, so it can never match a phone). StageTools (lazy) at desk:
`stage-panel/desk.tsx` — the work area's tool laid over the column's rows (phone's rule set with the column's measures,
`--desk-rows-top` measured), phone-class visibility inside the panel, `DeskStep` (caption n of N · Previous · Next ·
Done), `DeskParts` (left column, portal into MakerDesk's slot), "You're editing" under the page, guest tab bar at the
page foot. editor-shell: the `stagesStudio && innerWidth<1024` checks are now `stagesStudio` (same on a phone).
Decisions: the phone moved stage ▾ into the top bar's Stages half (owner 10-08), so the left column does not repeat it;
"Tap a part" hint not drawn (phone retired it 10-09); default Preview = Phone at desk (prototype "Preview · Phone").
Walk folder: scratchpad desktop-walk (scripts/serve.sh, desk.mjs, walk1.mjs); before shots in desktop-walk/before/.
NEXT: Studio side at desk (home 4 cols, tool 760/1100), 1024 + 1440 shots, phone before/after diff, Preview ▾ rows,
event name centre (not built), ＋/grip/🗑 on the picked parts row (not built), pop-over sheets (PR 2b), stacked
sections (PR 3), changelog fragment, draft PR.
