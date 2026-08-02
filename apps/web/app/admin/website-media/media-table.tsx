'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, Download, HelpCircle, Trash2 } from 'lucide-react';

import { humanBytes, type MediaRow, type MediaUsage } from '@/lib/website-media';
import { deleteWebsiteMediaAction, getDownloadUrlAction } from './actions';

/**
 * One folder's file list.
 *
 * Deliberately has no checkbox column and no select-all. Each row acts on
 * itself — see the note in actions.ts for why a bulk control would be unsafe
 * given where the "left over" verdict comes from.
 */

const USAGE_STYLE: Record<
  MediaUsage,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  'in-use': {
    label: 'In use',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    Icon: CheckCircle2,
  },
  unreferenced: {
    label: 'Left over',
    className: 'bg-amber-50 text-amber-900 border-amber-200',
    Icon: AlertTriangle,
  },
  unknown: {
    label: 'Not sure',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
    Icon: HelpCircle,
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

export function MediaTable({ rows }: { rows: MediaRow[] }) {
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function handleDownload(key: string) {
    setError(null);
    setBusyKey(key);
    startTransition(async () => {
      const res = await getDownloadUrlAction(key);
      setBusyKey(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.open(res.url, '_blank', 'noopener,noreferrer');
    });
  }

  function handleDelete(key: string) {
    const ok = window.confirm(
      `Delete this file permanently?\n\n${key}\n\nThis cannot be undone. If you might want it ` +
        `later, press Download first and save a copy.`,
    );
    if (!ok) return;

    setError(null);
    setBusyKey(key);
    startTransition(async () => {
      const res = await deleteWebsiteMediaAction(key);
      setBusyKey(null);
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
              const isBusy = pending && busyKey === row.key;
              const folder = folderOf(row.key);
              return (
                <tr
                  key={row.key}
                  className="border-b border-[var(--m-line,#f0ece4)] align-middle"
                >
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
                    {row.lastModified
                      ? new Date(row.lastModified).toLocaleDateString('en-PH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${style.className}`}
                      title={row.unknownReason ?? undefined}
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
                      disabled={isBusy || row.usage === 'in-use'}
                      title={
                        row.usage === 'in-use'
                          ? 'This file is live on the site. Replace it from its own admin page instead.'
                          : 'Delete this file permanently'
                      }
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

      {visible.length === 0 ? (
        <p className="py-3 text-[13px] text-[var(--m-slate,#6a6e76)]">
          Nothing left in this folder.
        </p>
      ) : null}
    </div>
  );
}
