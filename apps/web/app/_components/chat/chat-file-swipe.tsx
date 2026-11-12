'use client';

/**
 * 👈 YOUR OWN FILE SWIPES AWAY (owner, ruling 6076 — "swipe-to-remove for your OWN file in chat"; 12 Nov 2026,
 * "delete it outright").
 *
 * Moved, not re-invented: THE ONE SWIPE (`swipe-to-delete.tsx`) and the swipe-with-Undo of a working note
 * (`working-note-swipe.tsx`) — the bubble hides at once, an Undo stands for its window, and only then is the file
 * deleted: the message row by `remove_my_chat_file` (the database decides it is yours and carries a file) and its
 * object, through `DELETE /api/chat/attachment/<id>` — the route that already owns a file in a conversation. A refusal
 * brings the bubble back with the reason. Only YOUR file bubble is wrapped (the stream decides); words never swipe.
 */
import { useState, type ReactNode } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';

export const CHAT_FILE_REMOVED_LABEL = 'Your file was removed';

export function ChatFileSwipe({ messageId, name, children }: { messageId: string; name: string | null; children: ReactNode }) {
  const [gone, setGone] = useState(false);
  // The Undo toast's host stays mounted while the bubble is hidden — it IS the way back.
  if (gone)
    return (
      <>
        <UndoToastHost />
        <div hidden data-swipe-gone="" />
      </>
    );
  return (
    // `data-no-page-swipe`: inside the picked shell a sideways swipe turns the page — on YOUR file it opens Remove instead.
    <div data-no-page-swipe="" className="max-w-full">
      <UndoToastHost />
      <SwipeToDelete
        label={`Remove your file${name ? ` ${name}` : ''}`}
        word="Remove"
        radiusClass="rounded-2xl"
        surfaceClass="bg-cream"
        className="max-w-full"
        onDelete={() =>
          deleteWithUndo({
            label: CHAT_FILE_REMOVED_LABEL,
            hide: () => setGone(true),
            restore: () => setGone(false),
            commit: async () => {
              // keepalive: the Undo window may end as the page closes (deleteWithUndo flushes on pagehide).
              const r = await fetch(`/api/chat/attachment/${encodeURIComponent(messageId)}`, { method: 'DELETE', keepalive: true }).catch(() => null);
              return r && r.ok ? { ok: true } : { ok: false, error: 'refused' };
            },
            failed: 'Couldn’t remove your file. It’s back — try again.',
          })
        }
      >
        {children}
      </SwipeToDelete>
    </div>
  );
}

/** The stream's wrapper: YOUR file bubble swipes; every other bubble is drawn exactly as before. */
export function MaybeChatFileSwipe({ on, messageId, name, children }: { on: boolean; messageId: string; name: string | null; children: ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <ChatFileSwipe messageId={messageId} name={name}>
      {children}
    </ChatFileSwipe>
  );
}
