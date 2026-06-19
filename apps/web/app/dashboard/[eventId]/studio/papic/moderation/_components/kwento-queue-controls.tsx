'use client';

/**
 * Kwento queue — interactive controls. One-tap actions per the owner locks:
 * Approve (publish to gallery surfaces) · Show on wall (THE one-tap projector
 * gate; disabled for flagged — the DB CHECK backstops a race) · Hide from
 * wall · Reject · Block this guest from messaging.
 */

import { useState, useTransition } from 'react';
import { Check, Loader2, MonitorPlay, MonitorOff, ShieldBan, X } from 'lucide-react';
import {
  approveKwento,
  blockKwentoGuest,
  kwentoOffWall,
  kwentoToWall,
  rejectKwento,
} from '../actions';

export type KwentoRow = {
  messageId: string;
  body: string;
  author: string;
  guestId: string;
  status: 'pending' | 'approved' | 'rejected' | 'user_deleted';
  moderation: 'unscreened' | 'clean' | 'flagged' | 'blocked';
  labels: string[];
  onWall: boolean;
  edited: boolean;
  thumbUrl: string | null;
};

export function KwentoQueueControls({ eventId, rows }: { eventId: string; rows: KwentoRow[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? 'something hiccuped');
    });
  };

  return (
    <div className="mt-4 space-y-3">
      {rows.map((row) => (
        <div
          key={row.messageId}
          className="flex gap-3 rounded-xl border border-ink/10 bg-cream/40 p-3"
        >
          <div className="h-16 w-16 flex-none overflow-hidden rounded-md border border-ink/10 bg-ink/5">
            {row.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- presigned R2 thumb
              <img src={row.thumbUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">
              <span className="font-medium">{row.author}</span>
              {row.edited ? (
                <span className="ml-1.5 text-[11px] text-terracotta">· changed after you saw it</span>
              ) : null}
            </p>
            {row.moderation === 'flagged' && row.status === 'pending' ? (
              <p className="mt-0.5 text-xs text-terracotta">
                ⚠ Held for your review ({row.labels.join(', ') || 'language'}) — only you can see it.
              </p>
            ) : null}
            <p className="mt-1 break-words text-sm italic text-ink/80">&ldquo;{row.body}&rdquo;</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {row.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => approveKwento(eventId, row.messageId))}
                    className="inline-flex items-center gap-1 rounded-md bg-mulberry px-2.5 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-600 disabled:opacity-60"
                  >
                    <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => rejectKwento(eventId, row.messageId))}
                    className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-2.5 py-1.5 text-xs text-ink/70 hover:bg-ink/5 disabled:opacity-60"
                  >
                    <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Reject
                  </button>
                </>
              ) : null}
              {row.status !== 'rejected' ? (
                row.onWall ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => kwentoOffWall(eventId, row.messageId))}
                    className="inline-flex items-center gap-1 rounded-md border border-ink/15 px-2.5 py-1.5 text-xs text-ink/70 hover:bg-ink/5 disabled:opacity-60"
                  >
                    <MonitorOff aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Take off wall
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pending || row.moderation !== 'clean'}
                    title={
                      row.moderation !== 'clean'
                        ? 'Held messages can never go on the venue wall'
                        : 'Show this message on the venue wall'
                    }
                    onClick={() => run(() => kwentoToWall(eventId, row.messageId))}
                    className="inline-flex items-center gap-1 rounded-md border border-terracotta/40 px-2.5 py-1.5 text-xs font-medium text-terracotta hover:bg-terracotta/10 disabled:opacity-40"
                  >
                    <MonitorPlay aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Show on wall
                  </button>
                )
              ) : (
                <span className="text-[11px] text-ink/40">rejected</span>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => blockKwentoGuest(eventId, row.guestId))}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] text-ink/45 hover:bg-ink/5 hover:text-ink/70 disabled:opacity-60"
              >
                <ShieldBan aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Block guest
              </button>
            </div>
          </div>
        </div>
      ))}
      {error ? <p className="text-xs text-terracotta">{error}</p> : null}
    </div>
  );
}
