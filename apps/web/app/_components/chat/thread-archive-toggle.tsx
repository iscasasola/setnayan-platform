'use client';

import { Archive, ArchiveRestore } from 'lucide-react';
import { archiveThread, unarchiveThread } from '@/lib/chat-actions';
import { StayForm } from '@/app/_components/stay-form';

/**
 * <ThreadArchiveToggle> — per-user, Viber-style archive control on the inbox
 * thread rows (couple + vendor). Archiving is pure UI state (Data Retention
 * Schedule 2026-07-11) — it deletes nothing, just stamps
 * chat_thread_reads.archived_at so the row drops out of the active list until a
 * newer message auto-un-archives it. The server action redirects back to
 * `returnTo`; on an inbox that is read IN PLACE (the `pubChat.*` stay doors, owner 2026-10-26 "a save never resets
 * the screen"), so the inbox re-renders with the row moved between sections and the scroll kept.
 */
export function ThreadArchiveToggle({
  threadId,
  returnTo,
  archived,
}: {
  threadId: string;
  returnTo: string;
  archived: boolean;
}) {
  return (
    <StayForm
      door={archived ? 'pubChat.unarchiveThread' : 'pubChat.archiveThread'}
      action={archived ? unarchiveThread : archiveThread}
      className="shrink-0"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button
        type="submit"
        aria-label={archived ? 'Unarchive conversation' : 'Archive conversation'}
        title={archived ? 'Unarchive' : 'Archive'}
        className="grid h-11 w-11 place-items-center rounded-full text-ink/35 transition-colors hover:bg-ink/5 hover:text-ink/70"
      >
        {archived ? (
          <ArchiveRestore aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <Archive aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        )}
      </button>
    </StayForm>
  );
}
