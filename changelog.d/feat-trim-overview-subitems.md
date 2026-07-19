## 2026-07-10 · feat(dashboard): Overview is a plain menu item — drop the sub-links

Owner: "the menu does not need the checklist, schedule, messages and contracts."
The couple Overview item is now a clean leaf — its sidebar children (Checklist ·
Schedule · Messages · Contracts · Refer a couple) are removed on both the desktop
sidebar (`customer-nav-config.ts`) and the mobile SSOT (`lib/customer-menu.ts`).

Nothing is stranded — every surface stays reachable from the dashboard body /
topbar: Schedule from the dashboard's Schedule section, Checklist from its task
cards, Messages from the Conversations card + vendor cards + the topbar bell,
Contracts from the vendor itemization cards. Routes (`/checklist`, `/schedule`,
`/messages`, `/contracts`, `/refer`) are unchanged; `/checklist` stays in the
Overview active-match so arriving there still lights the item.

SPEC IMPACT: None (nav decluttering only; no route/schema/pricing change).
