# Lane 3 — chat beside its list from 701 · Now beside Proposed

`<side>-<width>.png` is the pair: **Now** (`origin/main` at 2524ccec) on the left and **Proposed** (this branch) on
the right. `-now.png` and `-proposed.png` are the single frames, at deviceScaleFactor 2. Each shows a thread open.

Where they come from: the real routes need a signed-in session and a database, and this sandbox has neither. So each
side is the chat lab's thread (`/dev/chat-lab/t/<id>`, the real `ChatThreadFrame` · `ChatBox` · head · stream ·
composer in that side's real shell, `?side=vendor` for the supplier). For Proposed it is wrapped exactly as the new
`messages/[threadId]/layout.tsx` wraps the real routes: `ChatPanes open` around the real `ChatInbox` (couple) or
`SupplierChats` (supplier). The throwaway lab used for that was never committed.

`measure-*.json` holds the boxes behind each frame. In short (composer bottom / window height):

| side · width | Now | Proposed |
|---|---|---|
| couple 390 | fixed full screen · 836/844 | the same: list hidden, fixed full screen · 836/844 |
| couple 768 | **fixed full screen, no list** · 1016/1024 | list 324 px · thread 324 px · 1016/1024 |
| couple 1280 | framed card, no list · 684/800 | list 444 px · thread 532 px · 792/800 |
| supplier 390 | fixed full screen · 836/844 | the same · 836/844 |
| supplier 768 | **fixed full screen, no list** · 1016/1024 | list 348 px · thread 348 px · 1016/1024 |
| supplier 1280 | framed card, no list · 684/800 | list 473 px · thread 567 px · 792/800 |

No horizontal scroll anywhere (`scrollWidth` = the window width). The red "3 Issues" pill is Next's dev overlay; it
comes from the missing database (refused Supabase reads in dev).
