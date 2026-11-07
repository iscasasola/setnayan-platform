/**
 * 🗂 FILES — a picked-client page (THE ONE BUILD, 8 Nov 2026 · v113).
 *
 * OWNER OF THIS FILE: **C1** (B2 §2.4 — the Finder-style view over `buildSharedFiles`). The shipped `FilesTab` (moved
 * here by L2 at hour 0) is kept, line for line, for everything it SAID — the refused-is-not-empty line, the empty state
 * with its door into the chat, the handover sentence — and its one list became the finder (`FilesFinder`):
 *
 *   All files ▾ (the root, newest-first ACROSS the three sources) · View & sort ▾
 *   Folders · by source — Contracts · Chat files · Handover & albums, each with its count
 *   All files · N · by date — each row: name · who shared it · type · size · day; the row opens it
 *   Limits & keeping ⓘ — the chat's own limits (`lib/chat-file-rules.ts`, never typed here)
 *
 * NOT built (B2 §2.4): a search field and ＋ Upload (INVENTED), and v113's sample "Payment-proof" under Contracts
 * (WRONG — there is no fourth source). The client page owns the reads (the one `buildSharedFiles(` call and the
 * `chatFilesMeasured` flag) and hands the built rows in — this page reads nothing.
 *
 * 🔒 lib/files-folders-are-the-three-sources.test.ts
 */
import Link from 'next/link';
import { FolderOpen } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { ShopEmpty } from '../../../_components/kit';
import type { SharedFileEntry } from '@/lib/chat-shared-files';
import { CHAT_DOCUMENT_MAX_MB, CHAT_FILE_EXPIRY_DAYS, CHAT_PHOTO_MAX_MB, CHAT_VIDEO_MAX_MB } from '@/lib/chat-file-rules';
import type { PickedPageProps } from './context';
import { FilesFinder } from './files-finder';

export type FilesPageProps = PickedPageProps & {
  /**
   * Contracts, handover deliverables AND the files shared in the couple's
   * conversation, already merged and sorted newest-first by
   * `buildSharedFiles`. THREE sources, one list: the supplier is looking for
   * the thing that happened recently and does not know which door it came
   * through.
   */
  files: SharedFileEntry[];
  /**
   * FALSE when the read of the conversation's files was REFUSED rather than
   * empty. Both return zero rows in this app, and only one of them means "there
   * is nothing here" — so the tab is told which, and says so.
   */
  chatFilesMeasured: boolean;
  threadId: string | null;
  isBooked: boolean;
};

export function FilesPage(props: FilesPageProps) {
  const { files, chatFilesMeasured, threadId, isBooked } = props;
  const hasAny = files.length > 0;

  return (
    <div className="space-y-4 pb-24" data-client-files="">
      {!chatFilesMeasured ? (
        <p role="status" className="text-[13px] text-[rgb(var(--color-danger))]" data-files-chat-unread="">
          Files shared in your conversation could not be loaded just now, so this list may be
          incomplete. Everything is still in the chat itself.
        </p>
      ) : null}

      {!hasAny ? (
        <ShopEmpty>
          <FolderOpen aria-hidden className="mx-auto h-6 w-6 text-ink/30" strokeWidth={1.5} />
          <p className="mt-2 text-sm text-ink/55">
            No files shared yet. Contracts you upload for this couple appear here, and so does
            anything either of you attaches in the conversation.
          </p>
          {threadId ? (
            <Link
              href={`/vendor-dashboard/messages/${threadId}`}
              className="mt-2 inline-block text-sm font-medium text-sn-accent hover:underline"
            >
              Share files in chat →
            </Link>
          ) : null}
        </ShopEmpty>
      ) : (
        <FilesFinder files={files} />
      )}

      {hasAny && threadId ? (
        <Link
          href={`/vendor-dashboard/messages/${threadId}`}
          className="inline-block text-sm font-medium text-sn-accent hover:underline"
        >
          Share more files in chat →
        </Link>
      ) : null}

      <p className="text-[13px] text-ink/70" data-files-limits="">
        <InfoTip label="Limits & keeping" align="start">
          Photo {CHAT_PHOTO_MAX_MB} MB · document {CHAT_DOCUMENT_MAX_MB} MB · video {CHAT_VIDEO_MAX_MB} MB. Chat files
          are deleted {CHAT_FILE_EXPIRY_DAYS} days after the event; contracts, payment proofs and anything pinned to
          Decisions are kept.
        </InfoTip>
        <span className="ml-1 text-ink/55">
          Photo {CHAT_PHOTO_MAX_MB} MB · document {CHAT_DOCUMENT_MAX_MB} MB · video {CHAT_VIDEO_MAX_MB} MB
        </span>
      </p>

      {isBooked ? (
        <p className="text-xs text-ink/45">
          Deliver albums and proofs from the Schedule page&rsquo;s handover panel — the couple
          confirms receipt there.
        </p>
      ) : null}
    </div>
  );
}
