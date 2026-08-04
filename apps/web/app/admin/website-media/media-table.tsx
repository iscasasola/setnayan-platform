'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Download, HelpCircle, Trash2 } from 'lucide-react';

import {
  formatStoredDate,
  humanBytes,
  isDeletableUsage,
  type MediaRow,
  type MediaUsage,
} from '@/lib/website-media';
import { deleteWebsiteMediaAction, getDownloadUrlAction } from './actions';

/**
 * One folder's file list.
 *
 * Deliberately has no checkbox column and no select-all. Each row acts on
 * itself — see the note in actions.ts for why a bulk control would be unsafe
 * given where the "left over" verdict comes from.
 *
 * Delete is offered ONLY for files proven unreferenced. "Not sure" is refused
 * just as firmly as "In use": it means the check did not complete, and a review
 * found a live file sitting in a folder whose prose guessed it was junk.
 */

const USAGE_STYLE: Record<
  MediaUsage,
  { label: string; className: string; Icon: typeof CheckCircle2; hint: string }
> = {
  'in-use': {
    label: 'In use',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Icon: CheckCircle2,
    hint: 'This file is live on the site. Replace it from its own admin page instead.',
  },
  unreferenced: {
    label: 'Left over',
    className: 'bg-amber-50 text-amber-900 border-amber-200',
    Icon: AlertTriangle,
    hint: 'Nothing on the site points at this file any more.',
  },
  unknown: {
    label: 'Not sure',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
    Icon: HelpCircle,
    hint: 'We could not check this one, so it cannot be removed from here.',
  },
};

function fileName(key: string): string {
  const parts = key.split('/');
  return parts[parts.length - 1] || key;
}

function folderOf(key: string): string {
  const at = key.lastIndexOf('/');
  return at === -1 ? '' : key.slice(0, at + 1);
}

export function MediaTable({
  rows,
  unreadable = false,
}: {
  rows: MediaRow[];
  /** True when the folder's listing FAILED — "nothing here" would be a lie. */
  unreadable?: boolean;
}) {
  const [, startTransition] = useTransition();
  // A SET, not one key: two rows can be in flight at once, and a single shared
  // key would unlock a row whose own request is still running.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);

  function mark(key: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function handleDownload(key: string) {
    setError(null);
    setBlockedUrl(null);

    // Opened SYNCHRONOUSLY, inside the click's user activation. Opening after
    // the await would be blocked by Safari outright and by Chrome once the
    // activation window lapses — losing the "save a copy first" step that makes
    // deleting safe. No 'noopener' here: that makes window.open return null by
    // spec, and the handle is needed. `opener` is cleared manually instead.
    const w = window.open('about:blank', '_blank');
    if (w) w.opener = null;

    mark(key, true);
    startTransition(async () => {
      const res = await getDownloadUrlAction(key);
      mark(key, false);
      if (!res.ok) {
        w?.close();
        setError(res.error);
        return;
      }
      if (w && !w.closed) {
        w.location.href = res.url;
      } else {
        // Popup blocked — hand the owner a link instead of failing silently.
        setBlockedUrl(res.url);
      }
    });
  }

  function handleDelete(key: string) {
    const ok = window.confirm(
      `Delete this file permanently?\n\n${key}\n\nThis cannot be undone. If you might want it ` +
        `later, press Download first and save a copy.`,
    );
    if (!ok) return;

    setError(null);
    setBlockedUrl(null);
    mark(key, true);
    startTransition(async () => {
      const res = await deleteWebsiteMediaAction(key);
      mark(key, false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGone((prev) => new Set(prev).add(key));
    });
  }

  const visible = rows.filter((r) => !gone.has(r.key));

  return (
    <div>
      {error ? (
        <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          {error}
        </p>
      ) : null}

      {blockedUrl ? (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Your browser blocked the download window.{' '}
          <a
            href={blockedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            Open the file here
          </a>{' '}
          instead — the link works for ten minutes.
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--m-line,#e6e2da)] text-left text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)]">
              <th className="py-2 pr-3 font-medium">File</th>
              <th className="py-2 pr-3 font-medium text-right tabular-nums">Size</th>
              <th className="py-2 pr-3 font-medium">Added</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const style = USAGE_STYLE[row.usage];
              const isBusy = busy.has(row.key);
              const canDelete = isDeletableUsage(row.usage);
              const folder = folderOf(row.key);
              return (
                <tr key={row.key} className="border-b border-[var(--m-line,#f0ece4)] align-middle">
                  <td className="py-2.5 pr-3">
                    <div className="font-medium text-[var(--m-ink,#1b1a17)] break-all">
                      {fileName(row.key)}
                    </div>
                    {folder ? (
                      <div className="text-[11px] text-[var(--m-slate,#8a8e96)] break-all">
                        {folder}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-[var(--m-slate,#4f535b)]">
                    {humanBytes(row.size)}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-[var(--m-slate,#4f535b)]">
                    {formatStoredDate(row.lastModified)}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${style.className}`}
                      title={row.unknownReason ?? style.hint}
                    >
                      <style.Icon className="h-3 w-3" aria-hidden />
                      {style.label}
                    </span>
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleDownload(row.key)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--m-line,#ddd8cf)] px-2 py-1 text-[12px] text-[var(--m-ink,#1b1a17)] hover:bg-[var(--m-cloud,#f6f3ee)] disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(row.key)}
                      disabled={isBusy || !canDelete}
                      title={canDelete ? 'Delete this file permanently' : style.hint}
                      className="ml-2 inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[12px] text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-[var(--m-line,#e6e2da)] disabled:text-[var(--m-slate,#a8acb4)] disabled:hover:bg-transparent"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && !unreadable ? (
        <p className="py-3 text-[13px] text-[var(--m-slate,#6a6e76)]">Nothing left in this folder.</p>
      ) : null}
    </div>
  );
}
