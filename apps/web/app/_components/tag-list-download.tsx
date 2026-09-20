'use client';

import { Table2 } from 'lucide-react';
import { tagListCsv, tagListFileName, type TagRow } from '@/lib/tag-list-csv';

/**
 * "Download tag list" — every guest's name and tag link as a CSV, for
 * encoding a stack of stickers on a desktop writer instead of tapping a phone
 * once per guest. See lib/tag-list-csv.ts for why this exists.
 *
 * A plain anchor with a data: URI — the browser does the saving, and the file
 * is a few KB even for a large wedding.
 */
export function TagListDownload({
  rows,
  eventName,
  className,
}: {
  rows: TagRow[];
  eventName?: string | null;
  className?: string;
}) {
  if (rows.length === 0) return null;
  const href = `data:text/csv;charset=utf-8,${encodeURIComponent(tagListCsv(rows))}`;
  return (
    <a
      href={href}
      download={tagListFileName(eventName)}
      className={className ?? 'button-secondary inline-flex items-center gap-2'}
      title="Every guest's name and tag link, for writing a batch of NFC stickers"
    >
      <Table2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      Tag list ({rows.length})
    </a>
  );
}
