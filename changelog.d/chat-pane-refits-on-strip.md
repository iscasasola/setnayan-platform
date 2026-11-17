## 2026-11-15 · fix(chat): the chat column re-fits when the strip arrives after load, even in a tab that is not painting

Follow-up to #7804. On live 1c8fe6b W1 measured the couple's composer still ending at 1093 of 1024 (768) and 869 of
800 (1280).
- The fit itself was right. It never re-ran when the "Plan with peace of mind" strip arrived ~0.7 s after load: the pane
  moved 93 → 173, the variable stayed 93 for 5 s or more, and any resize fixed it.
- The re-fit waited on `requestAnimationFrame`, and a tab that is not painting (in the background, or a hidden pane)
  runs no frames. A resize makes the tab paint, which released it. That matches every reading.
- Reproduced locally: with 1c8fe6b's wiring and no frames running, the composer's foot lands at 1120 of 1024 and 896
  of 800. In a painting tab the same wiring passes.

The fix — `watchChatPane` (new, `messages/_components/chat-pane-fit.ts`, plain DOM). `ChatPanes` now calls it, and so
does the spec:
- The re-fit runs on the next frame or after 120 ms, whichever comes first, so it no longer depends on frames.
- It re-fits on a node added anywhere in the page (`MutationObserver`, childList + subtree), on any ancestor of the chat
  changing size (`ResizeObserver` on each one up to `<body>`), and on resize and scroll.
- It is throttled to one read per frame and stops on unmount.

Guards:
- **Measured: `apps/web/tests/e2e/the-chat-box-is-in-the-window.spec.ts`** gains the late-strip case. It renders the real
  thread in the event layout's column and paints, THEN inserts the strip above the pane with no resize, in a painting
  tab and in one that runs no frames. It then checks that the composer's whole box is in the window and on top.
- **Seen red with 1c8fe6b's wiring and with frames only:** 1120 of 1024 and 896 of 800.
- **`lib/the-chat-composer-stays-in-the-window.test.ts`** checks the wiring. Both checks were seen red on sabotage.

No migration and no new server action.

SPEC IMPACT: None
