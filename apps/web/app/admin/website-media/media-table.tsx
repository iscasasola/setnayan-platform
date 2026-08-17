'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Download, FolderOpen, HelpCircle, Trash2 } from 'lucide-react';

import {
  formatStoredDate,
  humanBytes,
  isDeletableUsage,
  type MediaRow,
  type MediaUsage,
} from '@/lib/website-media';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { deleteWebsiteMediaAction, getDownloadUrlAction } from './actions';

/**
 * One folder's file list.
 *
 * Deliberately has no checkbox column and no select-all. Each row acts on
 * itself — see the note in actions.ts for why a bulk control would be unsafe
 * given where the "left over" verdict comes from. Download + Delete live INSIDE
 * a column's own cell, which is the only shape ConsoleTable allows: it has no
 * actions API, so a caller offering a control has to mean it.
 *
 * Delete is offered ONLY for files proven unreferenced. "Not sure" is refused
 * just as firmly as "In use": it means the check did not complete, and a review
 * found a live file sitting in a folder whose prose guessed it was junk.
 *
 * ⚠ THE FAILED LISTING ARRIVED AS A BOOLEAN AND ITS MESSAGE WAS THROWN AWAY.
 * The caller already held the reason the folder could not be read; `unreadable`
 * flattened it to true/false, so the one thing that would say WHY never reached
 * the screen. It now takes the message itself. Corrected 2026-08-17.
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
  listingError = null,
}: {
  rows: MediaRow[];
  /**
   * The reason the folder's listing FAILED, when it did — "nothing here" would
   * be a lie, and the message is what says which folder and why.
   */
  listingError?: string | null;
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

      <ConsoleTable
        rows={listingError ? null : visible}
        readPermitted
        readError={listingError ? { message: listingError } : null}
        reads="this folder’s files"
        label="Files in this folder"
        minWidth="40rem"
        rowKey={(row) => row.key}
        empty={{
          Icon: FolderOpen,
          title: 'Nothing left in this folder',
          blurb:
            'Every file that was here has been removed, or none was ever uploaded. Files land here from the admin pages that upload them.',
        }}
        columns={[
          {
            header: 'File',
            cell: (row) => {
              const folder = folderOf(row.key);
              return (
                <>
                  <div className="break-all font-medium text-ink">{fileName(row.key)}</div>
                  {folder ? (
                    <div className="break-all text-[11px] text-ink/70">{folder}</div>
                  ) : null}
                </>
              );
            },
          },
          {
            header: 'Size',
            align: 'right',
            mono: true,
            hideBelow: 'md',
            cell: (row) => <span className="text-ink/70">{humanBytes(row.size)}</span>,
          },
          {
            header: 'Added',
            mono: true,
            hideBelow: 'lg',
            cell: (row) => (
              <span className="whitespace-nowrap text-ink/70">
                {formatStoredDate(row.lastModified)}
              </span>
            ),
          },
          {
            header: 'Status',
            cell: (row) => {
              const style = USAGE_STYLE[row.usage];
              return (
                <span
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${style.className}`}
                  title={row.unknownReason ?? style.hint}
                >
                  <style.Icon className="h-3 w-3" aria-hidden />
                  {style.label}
                </span>
              );
            },
          },
          {
            header: 'Actions',
            align: 'right',
            cell: (row) => {
              const style = USAGE_STYLE[row.usage];
              const isBusy = busy.has(row.key);
              const canDelete = isDeletableUsage(row.usage);
              return (
                <span className="whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleDownload(row.key)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-2 py-1 text-[12px] text-ink hover:bg-ink/5 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(row.key)}
                    disabled={isBusy || !canDelete}
                    title={canDelete ? 'Delete this file permanently' : style.hint}
                    className="ml-2 inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[12px] text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-ink/10 disabled:text-ink/40 disabled:hover:bg-transparent"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete
                  </button>
                </span>
              );
            },
          },
        ]}
      />
    </div>
  );
}
