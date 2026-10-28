## 2026-10-29 · fix(chat): one thread page for both sides — the supplier's chat is the couple's chatbox, nothing beside it; the ⋮ rows wear their own icons

Owner, 29 Oct: *"event dashboard chat is full screen. supplier chat not same?"* · *"when i press the ... on upper right i
see quote payments files, etc with the same icon"*.

- **Measured first:** both thread routes already mounted the shared `ChatBox` / `ChatThreadHead` / stream / composer,
  and the supplier's opens full screen on a phone in the supplier's own shell (lab, Chromium + WebKit). What differed
  was what each PAGE drew around the box: the supplier's docked a 19rem customer column beside the chat from 1024, used
  its own narrower measure, and drew the answer to a booking ask — with its **Pay door** — ABOVE the box, where on a
  phone the full-screen takeover covered it (the door's centre hit the takeover's head).
- **`ChatThreadFrame`** (`app/_components/chat/chat-thread-frame.tsx`, in `thread-kit.ts`): the ONE thread page —
  the list from 1280 and exactly one `ChatBox`. Both routes and both labs return it. The supplier page's wrapper is the
  event layout's own column, so the chat has the same width on both sides.
- Supplier extras now live inside the box: the booking-ask answer is a band in the notice slot (visible on a phone);
  the customer card is the head's **Customer** sheet at every width (no docked column); the private inquiry-source and
  returning chips moved from a second head row onto that card. Nothing removed — every control is listed in the PR.
- `.sn-page-enter:has([data-chat-takeover])` does not rise on a phone: the 400 ms rise is a transform, which captured
  the fixed takeover inside the page under the top bar before it jumped to full screen.
- The ⋮ menu's links each wear their own lucide picture (`CHAT_MENU_ICONS`: Receipt · Wallet · FolderOpen ·
  CalendarDays · ClipboardList · UserRound) instead of one shared ↗.
- Guards: `lib/one-chat-look-on-every-thread.test.ts` now reads each route's RETURNED tree (TypeScript AST: frame →
  one ChatBox, nothing beside it) and renders the frame (one takeover; nothing between the list and the box) — the old
  version checked imports and mount counts only, which is why it passed while the pages differed. New
  `lib/the-chat-menu-rows-wear-their-own-icons.test.ts` renders every menu icon and requires distinct drawings.
  Five guards that read the column from the pages now read it from the frame.
- Labs: `/dev/chat-lab/t/<id>?side=vendor` stands in the supplier's real shell; `/dev/supplier-chat-lab` draws the
  shared head, the shared stream and the Customer sheet inside the supplier's shell and the one frame.

Canonical supplier thread address stays `/vendor-dashboard/messages/[threadId]`; `/vendor-dashboard/clients/[eventId]`
(bare, `?tab=chat`, `?tab=call`) keeps forwarding to it. No route moved, no new request, no emails.

SPEC IMPACT: None — the approved Messenger-shaped chat (chat prototype 2026-10-28) already draws one frame for both
sides; this makes the supplier's page match it.
