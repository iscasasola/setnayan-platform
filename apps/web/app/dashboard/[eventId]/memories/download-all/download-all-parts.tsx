'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Share } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import { OpenFileLink } from '@/app/_components/open-file-link';

/** One part as the page lists it — words already formatted on the server. */
export type PartRow = {
  chapterKey: string;
  chapterLabel: string;
  part: number;
  of: number;
  countWords: string;
  sizeWords: string;
  /** The part's contents fingerprint — sent back so the server builds exactly the zip listed here. */
  fp: string;
};

type RowState =
  | { k: 'idle' }
  | { k: 'making' }
  | { k: 'ready'; url: string; fileName: string; skipped: number }
  | { k: 'error'; message: string };

/** The ✓ is a per-device convenience (it never decides anything), keyed to the part's exact contents. */
const doneKey = (eventId: string, r: PartRow) => `sn-download-all:${eventId}:${r.chapterKey}:${r.part}:${r.fp}`;

function readDone(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function writeDone(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    /* private window — the ✓ just isn't remembered */
  }
}

const ERRORS: Record<string, string> = {
  changed: 'Your photos changed since this list was made — refresh the page to see the new zips.',
  storage_unavailable: 'Storage is not answering just now. Please try again in a moment.',
  build_failed: 'That zip could not be made just now. Please try again.',
  read_failed: 'We couldn’t read your photos just now. Please try again in a moment.',
  chapters_refused: 'We couldn’t read your chapters just now. Please try again in a moment.',
};

export function DownloadAllParts({ eventId, rows }: { eventId: string; rows: readonly PartRow[] }) {
  const [state, setState] = useState<Record<string, RowState>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const r of rows) next[doneKey(eventId, r)] = readDone(doneKey(eventId, r));
    setDone(next);
  }, [eventId, rows]);

  const make = async (r: PartRow) => {
    const id = doneKey(eventId, r);
    setState((s) => ({ ...s, [id]: { k: 'making' } }));
    try {
      const res = await fetch(`/dashboard/${encodeURIComponent(eventId)}/studio/papic/gallery-zip/part`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter: r.chapterKey, part: r.part, fp: r.fp }),
      });
      const json = (await res.json().catch(() => null)) as
        | { url?: string; fileName?: string; skipped?: number; error?: string }
        | null;
      if (!res.ok || !json?.url) {
        setState((s) => ({ ...s, [id]: { k: 'error', message: ERRORS[json?.error ?? ''] ?? ERRORS.build_failed! } }));
        return;
      }
      setState((s) => ({ ...s, [id]: { k: 'ready', url: json.url!, fileName: json.fileName ?? 'photos.zip', skipped: json.skipped ?? 0 } }));
    } catch {
      setState((s) => ({ ...s, [id]: { k: 'error', message: 'That zip could not be made — check your connection and try again.' } }));
    }
  };

  if (rows.length === 0) return null;

  return (
    <ul className="divide-y divide-ink/10" data-download-all="parts">
      {rows.map((r) => {
        const id = doneKey(eventId, r);
        const st = state[id] ?? { k: 'idle' };
        const saved = done[id] === true;
        return (
          <li key={id} className="flex items-center gap-3 py-3" data-download-part={`${r.chapterKey}:${r.part}`}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-ink">
                {r.chapterLabel}
                {r.of > 1 ? ` · part ${formatCount(r.part)} of ${formatCount(r.of)}` : ''}
              </span>
              <span className="block text-[13px] text-ink/70">
                {r.countWords} · about {r.sizeWords}
              </span>
              {st.k === 'error' ? (
                <span role="alert" className="block text-[13px] text-danger-700">
                  {st.message}
                </span>
              ) : st.k === 'ready' && st.skipped > 0 ? (
                <span className="block text-[13px] text-warn-800">
                  {formatCount(st.skipped)} {st.skipped === 1 ? 'file' : 'files'} could not be read and {st.skipped === 1 ? 'is' : 'are'} not in this zip.
                </span>
              ) : null}
            </span>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-[13px] font-medium text-success-800" data-download-done="">
                <Check className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                Saved
              </span>
            ) : null}
            {st.k === 'ready' ? (
              <OpenFileLink
                href={st.url}
                download={st.fileName}
                // OpenFileLink owns the click (the app's in-app browser sheet); the ✓ is marked on the same press.
                onPointerUp={() => {
                  writeDone(id);
                  setDone((d) => ({ ...d, [id]: true }));
                }}
                onKeyUp={(e) => {
                  if (e.key !== 'Enter') return;
                  writeDone(id);
                  setDone((d) => ({ ...d, [id]: true }));
                }}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/15 px-4 text-[14px] font-medium text-ink"
              >
                <Share className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Save
              </OpenFileLink>
            ) : (
              <button
                type="button"
                onClick={() => void make(r)}
                disabled={st.k === 'making'}
                aria-busy={st.k === 'making' || undefined}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/15 px-4 text-[14px] font-medium text-ink disabled:opacity-60"
              >
                {st.k === 'making' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                    Making…
                  </>
                ) : saved ? (
                  'Again'
                ) : (
                  'Make zip'
                )}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
