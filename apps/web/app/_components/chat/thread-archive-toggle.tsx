'use client';

import { Archive, ArchiveRestore } from 'lucide-react';
import { archiveThread, unarchiveThread } from '@/lib/chat-actions';

/**
 * <ThreadArchiveToggle> — per-user, Viber-style archive control on the inbox
 * thread rows (couple + vendor). Archiving is pure UI state (Data Retention
 * Schedule 2026-07-11) — it deletes nothing, just stamps
 * chat_thread_reads.archived_at so the row drops out of the active list until a
 * newer message auto-un-archives it. The server action redirects back to
 * `returnTo`, so the inbox re-renders with the row moved between sections.
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
    <form action={archived ? unarchiveThread : archiveThread} className="shrink-0">
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button
        type="submit"
        aria-label={archived ? 'Unarchive conversation' : 'Archive conversation'}
        title={archived ? 'Unarchive' : 'Archive'}
        className="grid h-full min-h-[3.5rem] w-11 place-items-center rounded-xl border border-ink/10 bg-cream text-ink/45 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5 hover:text-terracotta"
      >
        {archived ? (
          <ArchiveRestore aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <Archive aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        )}
      </button>
    </form>
  );
}
