import type { ReactNode } from 'react';

/**
 * ONE BORDERED FRAME AROUND THE WHOLE CONVERSATION — header, notice, the
 * conversation, the composer, and the tool tray — on both sides.
 *
 * ── WHY (owner, 2026-09-18 · "One Chat Box", approved layout) ──────────────
 * The couple's thread stacked SEVEN separate cards down the column: a header
 * tile, the safety panel, the pinned quote, the "Inquiring about" row, the
 * conversation, the call row, the "+ Deal or meeting" pill, then the composer.
 * The conversation was one card among the others and got whatever they left —
 * measured on production at **32px of visible height against 498px of
 * content** on a 390px phone. The design reference was Facebook Business
 * Messenger: one frame, one scroll region, actions on the composer row,
 * everything else collapsed until asked for.
 *
 * ── WHAT THIS IS, AND IS NOT ────────────────────────────────────────────────
 * It is the frame and the slots, nothing else. It is deliberately a server-safe
 * component that renders whatever each page passes, so BOTH thread pages keep
 * mounting their own `<ChatSafetyBanner>`, `<ChatMessageStream>`,
 * `<ChatSendForm>` …: `scripts/lint-port-no-lost-controls.mjs` inventories a
 * route by the components ITS OWN files render, and a frame that swallowed
 * those mounts would read as the route having lost every one of them.
 *
 * `children` is the conversation — the only part that is allowed to grow and
 * the only part that scrolls (`min-h-0 flex-1`); the stream inside it keeps
 * its own floor. The tray comes LAST, below the composer, as the approved
 * prototype draws it: a tool opens where a phone's attachment tray opens.
 *
 * ── 2026-09-19 · THE FRAME ITSELF HAS NO `min-h-0` — on purpose ────────────
 * Owner, supplier side, "Send a quote" open: "something is terribly wrong" —
 * the message bubbles painted ON TOP of the quote builder's couple name and
 * PAX / HRS inputs. Measured live at 988×1265: the stream's wrapper had a
 * COMPUTED HEIGHT OF 0 while its list kept its 224px floor and spilled out
 * of that zero box, down across the open 701px panel (the wrapper is
 * `relative`, so it paints above the panel, and clicks landed on bubbles).
 *
 * Cause: every box from this frame down to the list said `min-h-0`, so the
 * list's `min-h-[14rem]` floor reached NOTHING above it — the frame shrank to
 * the column's fixed height and the open tray took the stream's share.
 * The fix is the pair, not either half:
 *   · this root keeps its AUTOMATIC minimum (no `min-h-0`), so it can never be
 *     shorter than header + stream floor + composer + open tray — the column
 *     (`overflow-y-auto` on the page's `<section>`) scrolls instead;
 *   · each view scroller in `chat-message-stream.tsx` is `basis-0` + a floor,
 *     so that automatic minimum counts the FLOOR, not the whole thread.
 *     Without `basis-0` an 80-message thread measured ~3,900px tall and the
 *     composer left the screen on every busy thread.
 * Harness (Chromium, real Tailwind build, 320 / 375 / 988 / 1440 wide, 2 and
 * 80 messages, tray open and closed): list ≥ 224px in every case, zero
 * overlap with the composer or the tray, composer position unchanged with the
 * tray closed. Guarded by `an-open-tool-cannot-flatten-the-stream.test.ts`.
 */
export function ChatBox({
  header,
  notice,
  pinned,
  children,
  composer,
  tray,
}: {
  /** ‹ · avatar · name · the event line · ⓘ. */
  header: ReactNode;
  /** The pinned safety line — folds away. */
  notice?: ReactNode;
  /** Cards that must stay in sight (a logged payment to confirm). Usually empty. */
  pinned?: ReactNode;
  /** The conversation — the stream, with its own switch and floor. */
  children: ReactNode;
  /** The composer row, or whatever stands in its place (Accept / Decline…). */
  composer: ReactNode;
  /** The closed tool panels. Zero height until one is revealed. */
  tray?: ReactNode;
}) {
  /*
    💬 MESSENGER-SHAPED (chat prototype 2026-10-28, frame B · owner 2026-10-27 "full screen", "look and feel like
    Messenger"). `data-chat-takeover` is the whole move: on a phone the thread fixes itself over the shell (globals.css,
    "AN OPEN CHAT THREAD IS FULL SCREEN"); from 1024 it keeps its place in the page's column with a quiet frame. No
    `sn-row` card any more — nothing framed but what you press. The automatic minimum stays (no `min-h-0` here; the
    2026-09-19 note above): when a tool is open the takeover itself scrolls rather than flattening the stream.
  */
  return (
    <div data-chat-box data-chat-takeover="" className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-h-[52px] items-center gap-2 border-b border-ink/10 py-1 pl-1 pr-2 sm:gap-2.5">
        {header}
      </div>
      {notice}
      {pinned}
      <div className="flex min-h-0 flex-1 flex-col px-2.5 pt-1">{children}</div>
      <div className="border-t border-ink/10 px-1.5 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)]">{composer}</div>
      {tray}
    </div>
  );
}
