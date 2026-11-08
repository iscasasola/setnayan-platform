/**
 * lib/shared-files-view.ts — 📁 ONE CLIENT'S FILES, AS FOLDERS (pure; THE ONE BUILD B2 §2.4, v113 Files).
 *
 * The Files page is Finder-style over `buildSharedFiles` (contracts · handovers & gallery links · chat attachments):
 *
 *   · the ROOT stays "All files", newest-first ACROSS the three sources — the guard
 *     `lib/chat-files-appear-in-the-files-tab.test.ts` pins it: the supplier is looking for the thing that happened
 *     recently and does not know which door it came through;
 *   · three folders, one per SOURCE — Contracts · Chat files · Handover & albums — each with its count; there is no
 *     fourth folder (v113's sample "Payment-proof" under Contracts is WRONG: proofs are not a source here);
 *   · sort by date (the default, newest first) · name (A→Z) · kind · size (largest first); a file with no recorded
 *     size sorts last, never as 0.
 *
 * 🔒 lib/files-folders-are-the-three-sources.test.ts
 */
import type { SharedFileEntry, SharedFileKind } from '@/lib/chat-shared-files';

export type FilesFolder = 'contracts' | 'chat' | 'handover';
export type FilesView = 'all' | FilesFolder;
export type FilesSort = 'date' | 'name' | 'kind' | 'size';

/** Each source's folder. Total over `SharedFileKind` — a new kind is a compile error here, never a lost file. */
export const FOLDER_OF: Record<SharedFileKind, FilesFolder> = {
  contract: 'contracts',
  chat: 'chat',
  handover: 'handover',
  gallery_link: 'handover',
};

export function folderOf(kind: SharedFileKind): FilesFolder {
  return FOLDER_OF[kind];
}

/** The folders, in v113's order, with their words. */
export const FILES_FOLDERS: ReadonlyArray<{ key: FilesFolder; label: string }> = [
  { key: 'contracts', label: 'Contracts' },
  { key: 'chat', label: 'Chat files' },
  { key: 'handover', label: 'Handover & albums' },
];

export const FILES_SORTS: ReadonlyArray<{ key: FilesSort; label: string }> = [
  { key: 'date', label: 'Date' },
  { key: 'name', label: 'Name' },
  { key: 'kind', label: 'Kind' },
  { key: 'size', label: 'Size' },
];

/** How many files each folder holds. */
export function folderCounts(rows: readonly SharedFileEntry[]): Record<FilesFolder, number> {
  const out: Record<FilesFolder, number> = { contracts: 0, chat: 0, handover: 0 };
  for (const r of rows) out[folderOf(r.kind)] += 1;
  return out;
}

/** "2.4 MB" → bytes; "512 KB" → bytes; null / unreadable → null (sorts last, never as 0). */
export function sizeBytes(label: string | null): number | null {
  const m = label ? /^([\d.]+)\s*(B|KB|MB|GB)$/i.exec(label.trim()) : null;
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const mult = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }[m[2]!.toUpperCase() as 'B' | 'KB' | 'MB' | 'GB'];
  return n * mult;
}

const KIND_ORDER: Record<SharedFileKind, number> = { contract: 0, chat: 1, handover: 2, gallery_link: 3 };

/** The rows of one view, sorted: date newest-first (the root's promise), name A→Z, kind by source, size largest first; ties by date. */
export function filesFor(rows: readonly SharedFileEntry[], view: FilesView, sort: FilesSort): SharedFileEntry[] {
  const pick = view === 'all' ? [...rows] : rows.filter((r) => folderOf(r.kind) === view);
  const newest = (a: SharedFileEntry, b: SharedFileEntry) => b.at.localeCompare(a.at);
  switch (sort) {
    case 'date':
      return pick.sort(newest);
    case 'name':
      return pick.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || newest(a, b));
    case 'kind':
      return pick.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || newest(a, b));
    case 'size':
      return pick.sort((a, b) => {
        const x = sizeBytes(a.sizeLabel);
        const y = sizeBytes(b.sizeLabel);
        if (x === null && y === null) return newest(a, b);
        if (x === null) return 1;
        if (y === null) return -1;
        return y - x || newest(a, b);
      });
  }
}
