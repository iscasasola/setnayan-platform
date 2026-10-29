import type { ReactNode } from 'react';
import { ThreadToolHashReveal } from './reveal-thread-tool';

/**
 * THE ONE THREAD PAGE — what an open conversation's route returns, on both sides (owner 2026-10-29, verbatim:
 * *"event dashboard chat is full screen. supplier chat not same?"*).
 *
 * Both thread routes mounted the same `ChatBox`, head, stream and composer, yet still read as two different pages,
 * because each page drew its OWN column around the box. The supplier's added a 19rem customer column docked beside the
 * chat from 1024 (the couple's chat had that width to itself), its own narrower `max-w` measure, and a line ABOVE the
 * box — the answer to a booking ask, with its Pay door — which on a phone sat UNDER the full-screen takeover, out of
 * sight and out of reach (measured 2026-10-29, `/dev/supplier-chat-lab?m=agreed` at 390: the door's centre point hit
 * the takeover's head). Same pieces, different page.
 *
 * So the page itself is now one piece. A thread route returns exactly this, holding exactly one `ChatBox`:
 *
 *   list      the conversation list, from 1280 (`ConversationColumn` — it hides itself below `xl`)
 *   children  the `ChatBox` — and nothing else. Every side's extra lives INSIDE the box's slots: the head's actions,
 *             the notice band, the pinned band, the composer's ＋ sheet, the tray.
 *
 * On a phone the box is the full-screen takeover (globals.css "AN OPEN CHAT THREAD IS FULL SCREEN ON A PHONE"); from
 * 1024 it is the page's column, the same width on both sides. `lib/one-chat-look-on-every-thread.test.ts` renders this
 * frame and reads both routes' returned tree.
 */
export function ChatThreadFrame({ list, children }: { list?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[27rem] gap-4" data-chat-thread-frame="">
      {list ?? null}
      {/* A deep link (`#build-quote`, `#deal-or-meeting`, `#pending-payments`) lands on a CLOSED panel; this opens it. */}
      <ThreadToolHashReveal />
      {/* The column scrolls ITSELF when the box outgrows it (a tool open on a short screen) — the box never clips its
          own composer (chat-box.tsx, 2026-09-19). */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</section>
    </div>
  );
}
