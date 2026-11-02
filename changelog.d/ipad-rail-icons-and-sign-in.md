## 2026-10-20 · fix(rail): every tool row wears its own icon, and "Sign in" fits the 72-px strip

Found on an iPad 13" (PR #6716 walk, D6 — the app shell, upright at 1032 px, inside the 72-px icon strip):

- **The dots.** The rail's Planner · Builder · Together · Studio rows drew a 6-px bullet (`.fd-dot`) in the icon slot
  while every other row drew a Lucide icon. In the strip the word is hidden, so Marketplace, Guest list, Seat plan,
  Budget, Schedule, Groups and Mood Board came out as a lone dot over a caption. Each row now names its icon
  (`RailTool.icon`, required; `StudioApp.railIcon` for the products) from `EVENT_MENU_ICONS` — the event menu's own
  vocabulary, gaining six names for Groups, Group Stories, Supplier chat, Event chat, Compare and Contracts — and the
  shell draws it through `RailIcon`. Same row at every width: the strip, the 1280+ word rail and the phone drawer.
- **"Sign / in".** The strip's Sign-in prompt kept its 12-px side padding inside a 64-px column, leaving the button
  40 px for the label, and the button allowed wrapping. The strip now drops that padding (the 280-px drawer keeps it)
  and the label never wraps: 64 px, one line, 37.5 px of ink at 11 px.
- The dev lab shell (`&shell=1`) now carries the in-event Builder and Together rows, as the event layout does, so the
  strip's tool rows can be walked.
- Guard `rail-tool-rows-wear-icons.test.ts` (data + render + CSS + strip geometry), 7 sabotages each red.
- Walked: Chromium + WebKit, /help · /explore (web and store shell) · /dev/budget-lab?shell=1, at 1032×1376,
  1376×1032, 1024×1366, 1366×1024, 820×1180, 1180×820, 1280: 0 rows without an icon, Sign in one line, unclipped.

SPEC IMPACT: None. (The 2026-08-13 one-shell drawing drew the tool rows with a bullet; the rail's own
`rail-icons-are-icons` rule — one list, one icon system — already replaced that drawing's glyphs with Lucide.)
