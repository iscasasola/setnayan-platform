'use client';

import { useState } from 'react';
import { FileText, Folder, Image as ImageIcon, Link2, MessageSquare, PackageCheck, ChevronRight } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { SharedFileEntry } from '@/lib/chat-shared-files';
import { CHAT_FILE_EXPIRED_LABEL } from '@/lib/chat-file-rules';
import { formatCount } from '@/lib/format-number';
import { FILES_FOLDERS, FILES_SORTS, filesFor, folderCounts, type FilesSort, type FilesView } from '@/lib/shared-files-view';

/**
 * 📁 THE FILES FINDER (THE ONE BUILD B2 §2.4, v113 Files) — the client half of the Files page: what is being looked at
 * (All files ▾ · a folder), and how (View & sort ▾: List · Grid, then Date · Name · Kind · Size). Both are ONE dropdown
 * each (any set of choices is one `PickMenu`); no pill row, no segmented control.
 *
 * The rows are the ones the client page built (`buildSharedFiles`, newest-first across the three sources) — this only
 * groups and orders them (`lib/shared-files-view.ts`). Each row opens its own href (`chatAttachmentHref` for a chat
 * file — the card never builds a link of its own). Nothing here reads or writes.
 */
export function FilesFinder({ files }: { files: readonly SharedFileEntry[] }) {
  const [view, setView] = useState<FilesView>('all');
  const [sort, setSort] = useState<FilesSort>('date');
  const [layout, setLayout] = useState<'list' | 'grid'>('list');
  const counts = folderCounts(files);
  const rows = filesFor(files, view, sort);
  const folderWord = (v: FilesView) => (v === 'all' ? 'All files' : FILES_FOLDERS.find((f) => f.key === v)!.label);
  const sortWord = FILES_SORTS.find((s) => s.key === sort)!.label.toLowerCase();

  return (
    <div data-files-finder="" data-files-view={view} data-files-layout={layout}>
      <div className="flex items-center gap-2 pb-3" data-files-bar="">
        <PickMenu
          compact
          label="Folder"
          value={view}
          buttonText={folderWord(view)}
          dataAttr="files-folder"
          options={[
            { key: 'all', label: 'All files', trail: { text: formatCount(files.length), tone: 'muted' } },
            ...FILES_FOLDERS.map((f) => ({ key: f.key, label: f.label, trail: { text: formatCount(counts[f.key]), tone: 'muted' as const } })),
          ]}
          onPick={(k) => setView(k as FilesView)}
        />
        <span className="flex-1" aria-hidden />
        <PickMenu
          compact
          label="View & sort"
          value={sort}
          buttonText="View & sort"
          dataAttr="files-view-sort"
          picked={[layout, `sort-${sort}`]}
          options={[
            { key: 'list', label: 'List', group: 'View' },
            { key: 'grid', label: 'Grid', group: 'View' },
            ...FILES_SORTS.map((s) => ({ key: `sort-${s.key}`, label: s.label, group: 'Sort by' })),
          ]}
          onPick={(k) => {
            if (k === 'list' || k === 'grid') setLayout(k);
            else if (k.startsWith('sort-')) setSort(k.slice(5) as FilesSort);
          }}
        />
      </div>

      {view === 'all' ? (
        <section aria-label="Folders" data-files-folders="">
          <p className="text-[15px] font-semibold text-ink">Folders · by source</p>
          <ul role="list">
            {FILES_FOLDERS.map((f) => (
              <li key={f.key} className="border-t border-ink/10 first:border-t-0">
                <button
                  type="button"
                  onClick={() => setView(f.key)}
                  className="flex min-h-14 w-full items-center gap-3 py-2 text-left"
                  data-files-folder-row={f.key}
                >
                  <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-ink/[0.06] text-ink/70">
                    <Folder className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-ink">{f.label}</span>
                    <span className="block text-[13px] text-ink/60">
                      {formatCount(counts[f.key])} item{counts[f.key] === 1 ? '' : 's'}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label={folderWord(view)} className="pt-3" data-files-list="">
        <p className="text-[15px] font-semibold text-ink" data-files-list-head="">
          {folderWord(view)} · {formatCount(rows.length)} · by {sortWord}
        </p>
        {rows.length === 0 ? (
          <p className="py-3 text-[13.5px] text-ink/60" data-files-folder-empty="">
            Nothing in {folderWord(view)} yet.
          </p>
        ) : layout === 'list' ? (
          <ul role="list">
            {rows.map((f) => (
              <li key={f.key} className="border-t border-ink/10 first:border-t-0" data-files-row={f.kind}>
                <FileRow f={f} />
              </li>
            ))}
          </ul>
        ) : (
          <ul role="list" className="grid grid-cols-2 gap-2 pt-2" data-files-grid="">
            {rows.map((f) => (
              <li key={f.key} data-files-row={f.kind}>
                <FileTile f={f} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FileIcon({ f }: { f: SharedFileEntry }) {
  const I = f.kind === 'chat' ? (f.isImage ? ImageIcon : MessageSquare) : f.kind === 'gallery_link' ? Link2 : f.kind === 'handover' ? PackageCheck : FileText;
  return <I aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.8} />;
}

function dateWord(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
}

/** One file: its name, who shared it and its type, its size and day — the whole row opens it. */
function FileRow({ f }: { f: SharedFileEntry }) {
  const body = (
    <>
      <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-ink/[0.06] text-ink/70">
        <FileIcon f={f} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-ink">{f.name}</span>
        <span className="block truncate text-[13px] text-ink/60">{[f.origin, f.typeLabel].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="flex-none text-right text-[12.5px] leading-tight text-ink/60">
        <span className="block">{f.expired ? CHAT_FILE_EXPIRED_LABEL : (f.sizeLabel ?? '—')}</span>
        <span className="block">{dateWord(f.at)}</span>
      </span>
    </>
  );
  return f.href && !f.expired ? (
    <a href={f.href} target="_blank" rel="noopener noreferrer" className="flex min-h-14 items-center gap-3 py-2" aria-label={`Open ${f.name}`} data-files-open="">
      {body}
    </a>
  ) : (
    <div className="flex min-h-14 items-center gap-3 py-2">{body}</div>
  );
}

function FileTile({ f }: { f: SharedFileEntry }) {
  const body = (
    <>
      <span aria-hidden className="grid h-16 place-items-center rounded-xl bg-ink/[0.06] text-ink/70">
        <FileIcon f={f} />
      </span>
      <span className="mt-1.5 block truncate text-[13.5px] font-medium text-ink">{f.name}</span>
      <span className="block truncate text-[12px] text-ink/60">{f.expired ? CHAT_FILE_EXPIRED_LABEL : [f.sizeLabel, dateWord(f.at)].filter(Boolean).join(' · ')}</span>
    </>
  );
  return f.href && !f.expired ? (
    <a href={f.href} target="_blank" rel="noopener noreferrer" className="block" aria-label={`Open ${f.name}`} data-files-open="">
      {body}
    </a>
  ) : (
    <div>{body}</div>
  );
}
