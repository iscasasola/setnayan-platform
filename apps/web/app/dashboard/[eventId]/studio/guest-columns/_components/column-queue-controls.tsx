'use client';

/**
 * Guest Columns review queue — interactive controls (kwento-queue-controls
 * clone, minus the wall/thumbnail machinery). Approve publishes to the paper;
 * Decline RETURNS the column to the guest with an optional note (owner rule:
 * "decline returns it"); an approved column can be taken back down with the
 * same decline action.
 */

import { useState, useTransition } from 'react';
import { Check, Loader2, Undo2, X } from 'lucide-react';
import { approveColumn, declineColumn } from '../actions';

export type ColumnRow = {
  columnId: string;
  title: string;
  body: string;
  author: string;
  status: 'pending' | 'approved' | 'rejected' | 'user_deleted';
  moderation: 'unscreened' | 'clean' | 'flagged' | 'blocked';
  labels: string[];
  declineNote: string | null;
  edited: boolean;
  submittedAt: string;
};

const STATUS_BADGE: Record<ColumnRow['status'], { label: string; className: string }> = {
  pending: { label: 'Awaiting review', className: 'bg-terracotta/10 text-terracotta' },
  approved: { label: 'Published', className: 'bg-mulberry/10 text-mulberry' },
  rejected: { label: 'Returned to guest', className: 'bg-ink/5 text-ink/60' },
  user_deleted: { label: 'Withdrawn by guest', className: 'bg-ink/5 text-ink/50' },
};

export function ColumnQueueControls({ eventId, rows }: { eventId: string; rows: ColumnRow[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? 'something hiccuped');
      else {
        setNoteFor(null);
        setNote('');
      }
    });
  };

  return (
    <div className="mt-4 space-y-3">
      {error ? <p className="text-xs text-terracotta">{error}</p> : null}
      {rows.map((row) => (
        <div key={row.columnId} className="rounded-xl border border-ink/10 bg-cream/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">{row.author}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[row.status].className}`}
            >
              {STATUS_BADGE[row.status].label}
            </span>
            {row.edited ? (
              <span className="text-[11px] text-terracotta">· changed after you saw it</span>
            ) : null}
          </div>
          {row.moderation === 'flagged' ? (
            <p className="mt-1 text-xs text-terracotta">
              ⚠ Held for your review ({row.labels.join(', ') || 'language'}) — a held column
              stays off the public page even if approved.
            </p>
          ) : null}
          <p className="mt-2 font-display text-base font-medium italic text-ink">{row.title}</p>
          <p className="mt-1 break-words text-sm text-ink/80">{row.body}</p>
          {row.status === 'rejected' && row.declineNote ? (
            <p className="mt-1.5 text-xs text-ink/50">
              Your note to the guest: <span className="italic">&ldquo;{row.declineNote}&rdquo;</span>
            </p>
          ) : null}

          {row.status === 'pending' || row.status === 'approved' ? (
            <div className="mt-3 space-y-2">
              {noteFor === row.columnId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={note}
                    maxLength={200}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional note to the guest (why it's coming back)"
                    className="w-full max-w-md rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-xs text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => declineColumn(eventId, row.columnId, note))}
                    className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-2.5 py-1.5 text-xs text-ink/70 hover:bg-ink/5 disabled:opacity-60"
                  >
                    {pending ? (
                      <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    ) : (
                      <Undo2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                    Return it
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setNoteFor(null);
                      setNote('');
                    }}
                    className="text-xs text-ink/50 hover:text-ink/80"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {row.status === 'pending' ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => approveColumn(eventId, row.columnId))}
                      className="inline-flex items-center gap-1 rounded-md bg-mulberry px-2.5 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600 disabled:opacity-60"
                    >
                      <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} /> Approve
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setNoteFor(row.columnId)}
                    className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-2.5 py-1.5 text-xs text-ink/70 hover:bg-ink/5 disabled:opacity-60"
                  >
                    <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    {row.status === 'approved' ? 'Take down & return' : 'Return to guest'}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
