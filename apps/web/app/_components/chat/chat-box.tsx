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
 */
export function ChatBox({
  header,
  notice,
  pinned,
  children,
  composer,
  tray,
}: {
  /** Counterparty · one muted line · the ⋮ menu. */
  header: ReactNode;
  /** The one-line safety / privacy notice. */
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
  return (
    <div data-chat-box className="sn-row flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-ink/10 px-2 py-2 sm:gap-3 sm:px-3">
        {header}
      </div>
      {notice}
      {pinned}
      <div className="flex min-h-0 flex-1 flex-col px-2 pt-2 sm:px-3">{children}</div>
      <div className="border-t border-ink/10 px-2 py-2 sm:px-3">{composer}</div>
      {tray}
    </div>
  );
}
