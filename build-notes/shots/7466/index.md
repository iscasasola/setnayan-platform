# PR #7466 · the six chat gaps · Now beside Proposed

Each picture puts **Now** (`main` @ `142ab58`, this branch's merge-base) on the left and **Proposed**
(`claude/sleepy-keller-6tftmi` @ `d2d4666`) on the right. Both draw the same chat from the same lab database. The
real actions are pressed as each person.

> **The branch moved after the shots.** The branch head is now `07a96f0`, a merge of `main` (#7468). It changes only
> where notices link to (`relatedUrl` in `lib/chat-actions.ts`), plus Clients-list files. None of the files these
> pictures draw changed: the stream, the composer, the (+) sheets, the notices list, `chat-send.ts`, the payment ask
> and the access ask. Re-check with `git diff --name-only d2d4666 07a96f0`.

## How these were taken

- **Lab data only.** The event is "Maria & Jose", the shop is "Lumière Photo", and there is one conversation between
  them. Nobody in it is real:

  | person | role |
  |---|---|
  | Maria | host, in the chat |
  | Jose | host, in the chat |
  | Lea | host, not in the chat |
  | Pia | the event's coordinator |
  | Lumen | the shop's owner |
  | Rafa | shop team member, role admin |

- **The database was a local stand-in.** It is an in-memory script that answers the app's database and sign-in calls
  with those rows, and records what each tree writes. The env was dummy. **No production database, no production URL,
  and never `cale-ice`.**
- **The code is unchanged.** Each tree ran `next dev` with its own code. One shot page was dropped into both trees and
  is **not committed**: `/dev/pr-shots-7466`. It mounts the real pieces:
  - `ChatBox` and `ChatMessageStream`;
  - `ChatSendForm` posting the real `sendChatMessage`;
  - the real (+) sheets;
  - the real `NotificationsList`;
  - two buttons that call the real `vendorAskForPayment` and `askHostForAccess`.

  Messages and notices are **read back from the lab database**, so a line or a notice appears only if that tree's code
  wrote it.
- **Live events.** A Playwright stand-in for Supabase Realtime delivers the "read" broadcast and the live rows on the
  stream's own channels (`chat-<thread>`, `chat-presence-<thread>`).
- **Replays.** Each width and theme replays the same story from a fresh database: Jose writes → Rafa writes → Lumen
  writes → Lumen asks for a payment → Lumen asks for access.
- **Sizes:** 375 × 812 and 390 × 844, light and dark.
  - ⚠ The chat routes are **not** on `DARK_READY` (`lib/appearance.ts`), so production draws them light whatever the
    phone says. The dark chat pictures are therefore light inside a dark frame.
  - The **notifications** pictures in dark use the app's own dark paint (`window.__snTheme`), because
    `/dashboard/notifications` *is* dark-ready.

File names: `<frame>-<width>-<theme>.png`.

## What each gap shows

| gap | frames | Now | Proposed |
|---|---|---|---|
| **1 · Seen is live** | `g1-host-before` → `g1-host-after-shop-read`; `g1-shop-before` → `g1-shop-after-host-read` | Stays "Delivered" after the other side reads (both sides) | Flips to **"Seen"** without a reload (both sides) |
| **1 · arrivals marked read** | `g1-host-live-arrival` | 0 read-marks after two live arrivals (4 of 4 runs) | **1** read-mark (one server-action POST) for the burst of two (4 of 4 runs) |
| **2 · co-host names** | `g2-cohost-maria-view` (also visible in every host-side frame) | Jose's messages are drawn as Maria's own, on the right in her colour, with "Delivered" under Jose's | Jose on the left, named **"Jose"**, with his own run; no "Delivered" under his |
| **3 · notices, a host writes** | `g3-host-wrote-tray-{owner,rafa,maria,pia,lea}` | Lumen only (`chat_message`) | Lumen (`chat_message`, unchanged) + Rafa, Maria and Pia (`chat_message_in_app`: "Jose wrote to Lumière Photo"); Lea none |
| **3 · notices, the shop writes** | `g3-shop-wrote-tray-{maria,jose,pia,lea}` | Maria, Jose **and Lea** (who is not in the chat); Pia none | Maria and Jose (`chat_message`) + Pia (`chat_message_in_app`); **Lea none** |
| **4 · a team member sends** | `g4-team-member-sends`, `g4-host-sees-team-member` | "Not sent · Try again"; the server says "Not a member of this thread"; Maria sees nothing | Sent; Maria sees it named **"Rafa"** |
| **5 · payments at once** | `g5-host-after-payment-ask` | The ask succeeds (`{ok:true}`), but nothing appears in the chat | **"Payment asked · ₱5,000 · due 12 Dec 2026"** line. A Setnayan line arriving live caused 1 page refresh in 3 of 4 runs; the first, cold-compile run saw 0 within the 3 s window. Now: 0 of 4 |
| **6 · Ask for access in (+)** | `g6-plus-not-booked`, `g6-plus-booked`, `g6-access-card`, `g6-host-after-access-ask` | No row in the (+); the ask succeeds (`{ok:true}`) but posts no line | Row present: greyed "Opens once they book you" before a booking, open after. The card is one `PickMenu`. The ask posts **"Lumière Photo asked to open: Seat plan, Guest list — the hosts answer in Access requests."** |

**What the stand-in recorded (every run):**

- Jose's send wrote 1 notice on Now and 4 on Proposed.
- Lumen's send wrote 3 on both trees, to different people (see gap 3).
- Rafa's send wrote 0 rows on Now. On Proposed it wrote 1 message plus 3 notices, the shop's usual set (Maria,
  Jose, Pia). So on Proposed the hosts' trays in `g3-shop-wrote-*` hold two shop notices: Rafa's and Lumen's.
- The Setnayan lines in the chat: 0 on Now; on Proposed, the two lines quoted above.

`g6-access-card` exists on Proposed only. Now has no such row, so its column says so.

## Not shot (and why)

- **The Messages badge.** Under migration `20271336137492`, system lines no longer count as unread. That is a SQL
  counter; the lab database cannot run it. The PR's PGlite test covers it
  (`tests/db/a-line-nobody-wrote-is-never-unread.db.test.ts`).
- **An arrival in a hidden tab, marked when the tab returns.** The unit test covers it (`lib/chat-gaps.test.ts`).
- **Emails.** These were not shot, but the stand-in recorded every email attempt (`email_deliveries`). None go out
  from a dummy env.
  - Now: one attempt per `chat_message` notice. That is Lumen for Jose's message; Maria, Jose **and Lea** for Lumen's.
  - Proposed: the same attempts for Lumen, Maria and Jose, **none for Lea**, and none for any `chat_message_in_app`.
    No new emails.
  - On Proposed, Rafa's accepted message is told to Maria and Jose as `chat_message` (emailed) and to Pia in the app,
    the same as any shop message.

## Found while shooting

Nothing in this PR's six gaps misbehaved in the lab.
