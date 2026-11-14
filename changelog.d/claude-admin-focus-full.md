## 2026-11-14 · feat(admin): Focus | Full — admin opens on what needs you, with one ask box

Owner, 14 Nov: *"admin focus and full approved"* (prototype https://claude.ai/artifact/M2EWM32A9Y9LrJBsYXgagq, specs
`02028b1a`; DECISION_LOG "ADMIN FOCUS | FULL — APPROVED (v6)", "THE SIX CALLS ANSWERED", and d83cf0b9 — the ask box is
plain words + learning, no AI). Stacked on the request cards (#7697).

- **Top-bar toggle Focus | Full** (`admin-mode-toggle.tsx`): icons only on a phone, icon + word from 1024, the filled
  half is the mode. The choice is a cookie (`lib/admin/admin-mode.ts`) — no server action, no row; admin opens in Focus.
- **Focus** (`/admin`, `focus-home.tsx`): the date, "N things need you", Reply / Fix sections. Each row is a real queue
  item titled by its request card; tapping it opens the SAME approved card in a sheet (`?card=`). Queues that do not
  peek are one row with their count. Unread queues are said ("not an all-clear"). No bottom nav, no thumb row; "View all
  pages" is gone — Full is the way to every page.
- **The ask box** (`admin-ask-pill.tsx`): "Ask or go anywhere" + the ? → "What can I ask?". Thumb zone on a phone, top
  on a computer. It opens the console's ONE search panel (no second search), docked at the bottom so the field stays in
  the pill and suggestions rise above it; "What can I ask?" is its last suggestion.
- **What can I ask?** (`/admin/ask`): the cheat sheet + Download (one A4 page, the browser's Save as PDF). Lists only
  what the box answers today. Also in the avatar menu.
- **Full**: the shipped five tabs, ▾ view pickers and thumb-row search, unchanged.

SPEC IMPACT: None — ports an approved design. Not built here (other areas or not yet buildable), listed in the PR:
Refresh rows (no drift check exists), shop summary / address search / progress answers, staff areas inside the tabs
(#7585), Events held told/untold (Insights), Approve-with-undo shop history, owner-only setup (avatar screens #7685).
