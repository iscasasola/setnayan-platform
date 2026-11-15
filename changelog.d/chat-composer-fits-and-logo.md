## 2026-11-15 · fix(chat): the message box stays in the window from 701, and the Chats list draws the shop's real logo

Two faults W1 found on live 08b8522 (RW-327), after #7547 put the open thread beside the list.

- **The composer sat below the window on wide screens.** Measured: couple 1093 of 1024 at 768 and 861 of 800 at 1280;
  supplier 916 of 800 at 1280. Two causes:
  - The couple's "Plan with peace of mind" strip arrives after `ChatPanes` measured the gap above its column. It is now
    re-measured whenever the page above changes height, through a `ResizeObserver` on the body.
  - A busy thread outgrows a short window, so the column scrolls itself, and the composer scrolled away with it. In the
    pane, from 701, the composer now stays pinned to the column's foot (sticky, cream background) while the rest scrolls
    above it.
  - Phones are untouched.
- **A broken shop logo in the couple's Chats list.** Liwanag's logo was a stored `r2://` ref passed straight to
  `/_next/image`.
  - The list now signs each logo through `displayLogoUrl` (lib/uploads.ts → `displayUrlForStoredAsset`), the same call
    the open thread makes.
  - `ThreadListAvatar` refuses any stored ref and draws initials instead, so a raw ref can never reach an image.

Guards, each seen red on sabotage:
- `lib/the-chat-composer-stays-in-the-window.test.ts`
- `lib/a-chat-avatar-never-draws-a-stored-ref.test.ts`

No migration and no new server action.

SPEC IMPACT: None
