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
## STATE (builder, 2026-10-18 ~23:10 PHT — account at cap, wrapped) — EXACT
PR #6645 (draft, label do-not-auto-merge, autoMergeRequest null). Branch rd/desktop-maker-area-1.
CI round 2 @08befd1dd: ALL GREEN except `bundle size check` — Maker first load 507.1 KB vs 507.0 budget (shared wall;
main is at 507.0). Headroom PR #6646 (13.4 KB freed) was merging: NEXT ACCOUNT → `git fetch && git merge origin/main`
(never rebase), push, watch CI once.
Latest push (this commit): the desk code is now 100% lazy — the shell no longer writes `data-maker-desk`/`desk`
(MakerDesk sets the attribute on mount; StageTools/StudioSideSwitch read `useIsDesktop('lg')`); shell's only additions:
`desktopColumns` prop, `ss = stagesStudio && (phone || desktopColumns)`, `lowerThird: (phone || ss)`, default device
Phone when desktopColumns. "Both" hidden by CSS at desk. Guard 4/4 green, sabotage (desk=true) red. Phone proof re-run:
390 Style/Animate pixel-identical; 375 + 390 open differ only in the Next dev "Issues" badge and the Top line field's
text scroll. NOT yet CI-run on this commit.
OPEN: one dev-only hydration-attribute warning seen in the lab walk (also seen once before this refactor at 390 —
check whether it is ours); "Both" hiding by CSS sibling selector not walked visually.
Built (slice 1): see changelog.d/rd-desktop-maker-area-1.md. Shots: ~/Documents/Claude/Projects/shots-2026-10-18/6645/.
NEXT (doc order): PR 3 stacked Style/Animate sections + 2-col preview grid; PR 4 rest (＋/grip/🗑 on the picked parts
row, hover ring); PR 5 Studio widths (today: shipped desktop Details layout full width; Mood Board desktop controls
null when stagesStudio); event name centre of top bar; Preview ▾ Desktop walk; area 1 part 2 guest Event Hub desktop.
