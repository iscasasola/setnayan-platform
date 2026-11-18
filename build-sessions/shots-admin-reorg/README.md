# Admin reorg — Now beside Proposed (390 px and 1280 px)

Each PNG shows **NOW** (`origin/main` 9b2508c1), then **PROPOSED** (`claude/admin-reorg-18`), at the same address.

Drawn by the admin shell lab (`/dev/admin-shell-lab?at=<address>`) on fixture counts. The lab draws the real shell
(bottom bar, rail, pinned-row picker, thumb row, avatar) and the real tab dashboards (`TabLanding`). A page BODY that
reads the database (the queue lists, the everyone list, Badges & seals, the match lines) is shown as the lab's
placeholder, because a cloud session has no admin login and no database. Those bodies are the shipped pages,
mounted unchanged.

| File | Address |
|---|---|
| 01-work | `/admin/work`: Work dashboard (was the All list) |
| 02-queue-picker | `/admin/work?view=approvals` with the picker open: Queue · Kind ▾ |
| 03-money | `/admin/money`: Money dashboard |
| 04-people | `/admin/directory`: People counts. Look up + Papers cards removed; Show & sort on the phone's one search |
| 05-insights | `/admin/app-performance`: Insights dashboard (the shipped Overview charts sit under it) |
| 06-offers-badges | `/admin/offers?view=badges`: Money › Offers & gifts › Badges & seals |
| 07-setup | `/admin/switches?view=email`: Setup › Switches & delivery › Email delivery |
