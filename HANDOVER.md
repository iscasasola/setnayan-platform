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
## STATE (builder, 2026-10-18 ~21:30 PHT) — keep current
DONE (slice 1, pushed): gate `makerDesktopColumnsEnabled` (env `NEXT_PUBLIC_MAKER_DESKTOP_COLUMNS_ENABLED` OR internal,
in flag-chokepoint-scan); shell `ss = stagesStudio && (phone || desktopColumns)`, `desk = ss && !phone`,
`data-maker-desk`, `lowerThird: (phone || desk)`; `MakerDesk` (maker-desk.tsx: grid, top-bar words via ::after,
sheets as pop-overs anchored on the press, Studio side full width) mounted by the lazy StudioSideSwitch (zero
first-load stand-in); StageTools desk pieces (stage-panel/desk.tsx: panel over the column's rows, phone-class
visibility inside the panel, DeskStep caption+ⓘ+Previous/Next/Done, DeskParts left column, "You're editing" under
the page, guest bar at the page foot, the part's frame shown); editor-shell `stagesStudio && innerWidth<1024` → `stagesStudio`;
visibleBand/centrePart count the lower third only when under the page. Guard
`lib/the-desktop-maker-never-reaches-a-phone.test.ts` (sabotaged 3 ways, red). 7 pinned tests updated.
Phone proof: settled shots 375/390 × Edit/Style/Animate, base code vs branch with the flag on: identical except the
Next dev badge count and (one run) the Top line input's text scroll. Shots: scratchpad desktop-walk/shots
(before2-*, after4-*, final-*, sbs-*).
PR #6645 (draft, do-not-auto-merge). CI round 1 @51c056ed1: unit (1/3) an-added-rsvp-line band pin, (2/3)
numbers-carry-commas — fixed (formatCount; RSVP line + Camera page measure the band as centrePart). Maker first
load measured 507.0 KB (= budget) — the `data-maker-work` marker removed after; MakerDesk has no first-load stand-in.
NEXT: watch CI round 2; then doc PR 3 (stacked sections + 2-col preview grid), PR 4 rest (＋/grip/🗑 on the picked
parts row, hover ring), PR 5 (Studio widths: home 4 cols, tool 760/1100, Look two columns — today Studio shows the
old desktop Details layout full width; Mood Board's desktop controls are null when stagesStudio), event name in the
top bar centre, Preview ▾ Desktop walk, then area 1 part 2 (guest Event Hub desktop).
