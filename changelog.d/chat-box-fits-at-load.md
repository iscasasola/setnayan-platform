## 2026-11-15 · fix(chat): the message box is in the window at load and nothing draws over it — measured, on both sides

Follow-up to #7801. W1 measured three faults on live f896598 (RW-330):

1. **Couple, 768 × 1024 and 1280 × 800: the composer's foot was at 1093 / 869.** The pane was sized as if it stood at
   the pin line plus a measured gutter, while the "Plan with peace of mind" strip and the "Chats" title stood above it
   (pane at y≈173, sized as if at 93).
   - It is now sized from its OWN top on screen. `fitChatPane` (new, `messages/_components/chat-pane-fit.ts`) reads the
     pane's `getBoundingClientRect().top`.
   - `ChatPanes` re-reads it on load, resize, scroll and any change in the page's height.
   - The guessed `--sn-chat-pane-gap` is gone.
2. **Supplier, 1280 × 800: a message bubble drew over the composer.** The bubble is `SwipeToDelete`'s `relative z-10`;
   the composer was at z 1.
   - The composer is now on the sticky layer (`--sn-z-sticky`), above bubbles (`--sn-z-raised`) and below menus and
     sheets.
3. **Supplier phone, 390 × 844: the composer's foot was at 879 (older than #7801).** A busy thread outgrew the screen
   and took the composer with it.
   - The sticky composer now applies wherever the open thread scrolls as one: the phone takeover, the column from 701,
     and a picked page's chat.

Guards:
- **Measured: `apps/web/tests/e2e/the-chat-box-is-in-the-window.spec.ts`.** It mounts the REAL thread (`ChatPanes` →
  `SupplierColumns` → `ChatThreadFrame` → `ChatBox`, bubbles in `SwipeToDelete`) with the app's compiled CSS and runs
  the real `fitChatPane`. At 390 × 844, 768 × 1024 and 1280 × 800, at load and after scrolling, it checks that:
  - the composer's whole box lies inside the window;
  - `elementFromPoint` across the composer hits the composer.
- **Seen red locally against the compiled CSS:**
  - with #7801's sizing, the foot is at 1136 / 1080 of 1024 and 912 of 800;
  - with the composer at z 1, the bubble covers it;
  - with no sticky composer, the foot is at 1986 of 844 on the phone.
- **`lib/the-chat-composer-stays-in-the-window.test.ts`** is now wiring only: the shipped `ChatPanes` calls
  `fitChatPane` on every event that moves the pane, and the spec runs the shipped parts.

No migration and no new server action.

SPEC IMPACT: None
