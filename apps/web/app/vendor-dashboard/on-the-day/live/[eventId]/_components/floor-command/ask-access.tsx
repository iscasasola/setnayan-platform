'use client';

/**
 * "Ask the host for access" — the coordinator's half of the owner's 2026-07-27
 * ruling. They tick what they need and send it; the host answers line by line
 * at /dashboard/[eventId]/access-requests.
 *
 * Only areas they do NOT already hold are offered, because asking for what you
 * already have wastes the one scarce thing in this flow: the host's attention.
 *
 * ⚠ MOUNTED TWICE, AND THE SECOND ONE IS THE IMPORTANT ONE. This shipped only
 * inside the live floor console, which redirects unless the booking is dated
 * today — so the ask could not be made until the morning of the wedding. It is
 * also on the client card now, where a coordinator plans for months. The copy
 * here says nothing about "the day" or "here" for that reason.
 */

import { useState, useTransition } from 'react';
import { Loader2, Lock, Send } from 'lucide-react';

import type { DelegateArea } from '@/lib/event-moderators';
import { FLOOR_AREA_LABEL } from '@/lib/floor-command';
import { askHostForAccess } from './access-actions';

export function AskAccess({
  eventId,
  askable,
  pendingAreas,
}: {
  eventId: string;
  /** Areas the host has not shared yet — the only ones worth asking for. */
  askable: DelegateArea[];
  /** An ask already sitting with the host, if any. */
  pendingAreas: DelegateArea[] | null;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set(askable));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (pendingAreas) {
    return (
      <p className="rounded-xl border border-dashed border-ink/20 px-3 py-3 text-sm text-ink/60">
        You’ve asked the host for{' '}
        <strong className="font-medium text-ink/80">
          {pendingAreas.map((a) => FLOOR_AREA_LABEL[a]).join(', ')}
        </strong>
        . Waiting on their answer.
      </p>
    );
  }

  if (sent) {
    return (
      <p className="rounded-xl border border-success-400/40 bg-success-500/5 px-3 py-3 text-sm text-success-700">
        Sent. The host decides each one, and the parts they share open up for you.
      </p>
    );
  }

  if (askable.length === 0) return null;

  function toggle(area: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      return next;
    });
  }

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await askHostForAccess(eventId, [...picked], note || null);
      if (!res.ok) setError(res.error ?? 'Could not send that.');
      else setSent(true);
    });
  }

  return (
    <div className="rounded-xl border border-ink/15 bg-white p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <Lock aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
        Ask the host for access
      </p>
      <p className="mt-1 text-xs text-ink/60">
        The host decides what to share with you, and can take it back any time.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {askable.map((area) => {
          const on = picked.has(area);
          return (
            <button
              key={area}
              type="button"
              onClick={() => toggle(area)}
              aria-pressed={on}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                on
                  ? 'border-terracotta bg-terracotta/10 text-ink'
                  : 'border-ink/15 bg-white text-ink/60 hover:border-terracotta'
              }`}
            >
              {FLOOR_AREA_LABEL[area]}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={240}
        placeholder="Why you need it (optional)"
        className="mt-3 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
      />

      {error ? (
        <p role="alert" className="mt-2 rounded-lg bg-warn-600/10 px-3 py-2 text-sm text-warn-600">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={send}
        disabled={pending || picked.size === 0}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-cream transition hover:bg-ink/90 disabled:opacity-40"
      >
        {pending ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <Send aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        )}
        Send request
      </button>
    </div>
  );
}
