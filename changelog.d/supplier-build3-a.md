## 2026-11-09 · feat(chats): one picked shell for both sides; Chats lists one row per event, unread pinned on top (Supplier Build 3 · Lane A)

Owner, 8 Nov (DECISION_LOG ✉️ 🪞): the supplier's envelope lists *"all the events (no dupes)"* in Messenger order with unread pinned above, and a row opens the picked client on Chat. The host's chat icon lists this event's suppliers by the same rule, and a supplier opens in *"the same full screen effect"*.

- **One picked shell.** `app/_components/picked/picked-shell.tsx` is now the only picked screen. It owns the portal on `--sn-z-pop`, the `pickedMotion` open and its reverse on ✕/Esc, the `history.replaceState(?tab=)` page switch, the swipe and the thumb layer. `PickedClientShell` (supplier) and the new `PickedSupplierShell` (host) are thin wrappers that pass menu, icons and doors. `picked-motion.ts` and the nav context moved beside it; the old path re-exports them. Guard: `app/_components/picked/one-picked-shell.test.ts`, sabotage-checked.
- **Supplier Chats.** `readSupplierChats` folds threads by event (`lib/chats-by-event.ts` `foldByEvent`). Each row goes to `/vendor-dashboard/clients/<eventId>?tab=chat`, which `vendor-dashboard/messages/@client/(..)clients/[eventId]` intercepts, so the picked client rises over the still-mounted list. The Clients list still opens on Details.
- **Host Chats.** For a supplier with a workspace row, the row goes to `vendors/<id>/workspace?tab=chat`, intercepted by `messages/@supplier/(..)vendors/[vendorId]/workspace`. With the relationship flag on, the workspace now draws the picked shell with Details · Chat · Schedule · Quotation · Payment · Forms · Files · Inspiration. It opens on Details by default and no longer redirects `?tab=chat` to the thread page. Chat embeds the host thread page (`__embed=chat`, read-marked only while shown, the `SupplierThreadBody` pattern) through `CoupleThreadBody`.
- **Messenger order in the shared inbox.** `ChatInbox` groups rows under "Unread · pinned" and then "Recent", using `messengerOrder`. It gains `opensPicked` (records the row as the open origin) and `needsYou` (🚦 dot: blocker stronger than due-now). The level is read from Lane B's `needsYouLevel()`; until that lands no row passes one, so no dot is drawn (TODO in `lib/chats-by-event.ts`).
- Labs: `/dev/supplier-chat-lab?m=chats&pick=…` and `/dev/chat-lab?pick=…` draw the picked shell over the list, sharing one Chat body, `app/dev/_components/lab-picked-chat.tsx`.
- Regenerated: `lib/ugat/screens.generated.json`, `scripts/port-control-baseline.json`.

SPEC IMPACT: None to the corpus. This implements the 2026-11-08 ✉️/🪞 rows as recorded. These choices need the owner's eye:
- the host's tab order follows the DECISION_LOG/brief (Details first), not the prototype's host order (Chat first);
- the host keeps a Files tab;
- the host list title stays "Chats".
