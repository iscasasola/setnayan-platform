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
import { TOPIC_ICON } from '@/lib/topic-icons';
import { InfoTip } from '@/app/_components/info-tip';
import type { SharedFileEntry } from '@/lib/chat-shared-files';
import { CHAT_DOCUMENT_MAX_MB, CHAT_FILE_EXPIRY_DAYS, CHAT_PHOTO_MAX_MB, CHAT_VIDEO_MAX_MB } from '@/lib/chat-file-rules';
import { formatCount } from '@/lib/format-number';
import type { PickedPageProps } from './context';
// ⚡ On-demand code (`./lazy`): the shipped `FilesFinder`, loaded with this page rather than the route's first load.
import type { ReactNode } from 'react';
import { FilesFinder } from './lazy';

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
  /** 📁 Piece 3b: the board (`EventFilesSection`), drawn by the client page — this page reads nothing itself. */
  board?: ReactNode;
};

export function FilesPage(props: FilesPageProps) {
  const { files, chatFilesMeasured, threadId, isBooked, board = null } = props;
  const hasAny = files.length > 0;

  return (
    <div className="space-y-4 pb-24" data-client-files="">
      {/* 📁 Piece 3b: This booking · From the chat · Links · one group per QUOTED service, with the two doors. */}
      {board}
      {board ? <h3 className="pt-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/70">Shared in the chat · contracts · handover</h3> : null}
      {!chatFilesMeasured ? (
        <div role="status" className="text-[13px] font-semibold text-warn-800" data-files-chat-unread="">
          <InfoTip label="Couldn’t load the chat’s files — this list may be incomplete" align="start">
            Files shared in your conversation could not be loaded just now. Everything is still in the chat itself.
          </InfoTip>
        </div>
      ) : null}

      {!hasAny ? (
        // 📐 Design template rule 6: one honest line where the rows would be — no icon box, no card.
        <div className="flex min-h-14 flex-wrap items-center gap-x-2 border-b border-ink/10 text-[15px] text-ink/70" data-files-empty="">
          <TOPIC_ICON.files aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <InfoTip label="No files shared yet." align="start">
            Contracts you upload for this couple appear here, and so does anything either of you attaches in the
            conversation.
          </InfoTip>
          {threadId ? (
            <Link
              href={`/vendor-dashboard/messages/${threadId}`}
              className="inline-flex min-h-11 items-center font-semibold text-sn-accent"
            >
              Share files in chat ›
            </Link>
          ) : null}
        </div>
      ) : (
        <FilesFinder files={files} />
      )}

      {hasAny && threadId ? (
        <Link
          href={`/vendor-dashboard/messages/${threadId}`}
          className="inline-flex min-h-11 items-center text-[15px] font-semibold text-sn-accent"
        >
          Share more files in chat ›
        </Link>
      ) : null}

      <div className="text-[13px] text-ink/70" data-files-limits="">
        <InfoTip label="Limits & keeping" align="start">
          Photo {formatCount(CHAT_PHOTO_MAX_MB)} MB · document {formatCount(CHAT_DOCUMENT_MAX_MB)} MB · video{' '}
          {formatCount(CHAT_VIDEO_MAX_MB)} MB. Chat files are deleted {formatCount(CHAT_FILE_EXPIRY_DAYS)} days after the event; contracts, payment proofs and anything pinned to
          Decisions are kept.
        </InfoTip>
        <span className="ml-1 text-ink/70">
          Photo {formatCount(CHAT_PHOTO_MAX_MB)} MB · document {formatCount(CHAT_DOCUMENT_MAX_MB)} MB · video{' '}
          {formatCount(CHAT_VIDEO_MAX_MB)} MB
        </span>
      </div>

      {isBooked ? (
        <p className="text-xs text-ink/70">
          Deliver albums and proofs from the Schedule page&rsquo;s handover panel — the couple
          confirms receipt there.
        </p>
      ) : null}
    </div>
  );
}
