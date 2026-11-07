/**
 * 🗂 FILES — a picked-client page (THE ONE BUILD, 8 Nov 2026 · v113).
 *
 * OWNER OF THIS FILE: **C1** (B2 §2.4 — the Finder-style view over `buildSharedFiles`; the root stays All files,
 * newest-first). L2 MOVED the shipped `FilesTab` here verbatim at hour 0 (spec §9 #2: "L2 removes FilesTab from
 * page.tsx"), so nothing is lost while C1 builds on it: same rows, same refused-is-not-empty line, same empty state.
 * The client page still owns the reads (the one `buildSharedFiles(` call and the `chatFilesMeasured` flag) and hands
 * the built rows in.
 */
import Link from 'next/link';
import { FileText, FolderOpen, Link2, MessageSquare, PackageCheck } from 'lucide-react';
import { ShopEmpty } from '../../../_components/kit';
import type { SharedFileEntry } from '@/lib/chat-shared-files';
import type { PickedPageProps } from './context';

function fmtShortDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

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
    <div className="space-y-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">Shared files</p>

      {!chatFilesMeasured ? (
        <p className="rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2 text-xs text-ink/60">
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
              className="mt-2 inline-block text-sm font-medium text-mulberry hover:underline"
            >
              Share files in chat →
            </Link>
          ) : null}
        </ShopEmpty>
      ) : (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.key}
              className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink/10 bg-white/70 text-ink/60">
                {f.kind === 'chat' ? (
                  <MessageSquare aria-hidden className="h-4 w-4" />
                ) : f.kind === 'gallery_link' ? (
                  <Link2 aria-hidden className="h-4 w-4" />
                ) : f.kind === 'handover' ? (
                  <PackageCheck aria-hidden className="h-4 w-4" />
                ) : (
                  <FileText aria-hidden className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-ink/55">
                  {[f.origin, f.typeLabel, f.sizeLabel, fmtShortDate(f.at)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              {f.href ? (
                <a
                  href={f.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-mulberry hover:underline"
                >
                  Open →
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {hasAny && threadId ? (
        <Link
          href={`/vendor-dashboard/messages/${threadId}`}
          className="inline-block text-sm font-medium text-mulberry hover:underline"
        >
          Share more files in chat →
        </Link>
      ) : null}

      {isBooked ? (
        <p className="text-xs text-ink/45">
          Deliver albums and proofs from the Schedule tab&rsquo;s handover panel — the couple
          confirms receipt there.
        </p>
      ) : null}
    </div>
  );
}
