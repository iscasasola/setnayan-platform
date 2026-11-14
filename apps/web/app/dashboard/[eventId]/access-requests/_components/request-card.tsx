'use client';

/**
 * One access request, answered LINE BY LINE.
 *
 * The owner's model is that the host approves each feature separately, so this
 * card has no "approve all" button: every line carries its own Share/Decline
 * pair and the host sends what they chose. A single yes/no would collapse the
 * decision the whole flow exists to make.
 */

import { useState, useTransition } from 'react';
import { Check, Loader2, ShieldCheck, X } from 'lucide-react';

import type { DelegateArea } from '@/lib/event-moderators';
import { FLOOR_AREA_LABEL, GRANT_WORDS, grantLevelFor, type AreaVerdict } from '@/lib/floor-command';
import { answerAccessRequest } from '../actions';
import { formatCount } from '@/lib/format-number';
import { formatRecordedAt } from '@/lib/recorded-at';

export type PendingRequest = {
  requestId: string;
  askerName: string;
  requestedAreas: DelegateArea[];
  note: string | null;
  createdAt: string;
  /**
   * 🧭 Is the asker the BOOKED COORDINATOR (owner 8 Nov 2026)? Then a share gives Edit; any other supplier sees the
   * part and proposes changes (`grantLevelFor`). The database decides either way — this only words the line.
   */
  askerIsCoordinator: boolean;
};

/**
 * 🤝 WHO IS ANSWERING (owner 8 Nov 2026). The hosts answer every line. The booked coordinator answers a supplier's
 * ask from their client page with the SAME card — but may share only a part they hold themselves (`shareable`); a part
 * they do not hold can still be declined, and its Share says only the host can give it. The database enforces the
 * same (`answer_area_access_request`).
 */
export type AnsweringAs = { as: 'host' } | { as: 'coordinator'; shareable: readonly DelegateArea[] };

/** Plain-English consequence of sharing this line. */
const AREA_MEANING: Partial<Record<DelegateArea, string>> = {
  seat_plan: 'Look up where a guest is sitting.',
  schedule: 'The schedule of the day, the emcee script and the songs.',
  guest_list: 'See who is coming.',
  vendors: 'See your other suppliers, their prices and their contact details.',
  mood_board: 'See your Mood Board photos.',
  budget: 'See your budget and payments. Never more than view.',
};

export function RequestCard({
  eventId,
  request,
  answering = { as: 'host' },
}: {
  eventId: string;
  request: PendingRequest;
  answering?: AnsweringAs;
}) {
  const mayShare = (area: DelegateArea) => answering.as === 'host' || answering.shareable.includes(area);
  const [verdicts, setVerdicts] = useState<Record<string, AreaVerdict>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = request.requestedAreas.filter((a) => verdicts[a]).length;

  function send() {
    if (chosen === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await answerAccessRequest(eventId, request.requestId, verdicts);
      if (!res.ok) setError(res.error ?? 'Could not send that.');
    });
  }

  return (
    <li className="sn-tile p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">
          {request.askerName} is asking for access
        </h3>
        <span className="text-xs text-ink/50">
          {formatRecordedAt(request.createdAt)}
        </span>
      </div>

      {request.note ? (
        <p className="mt-2 border-l-2 border-ink/15 pl-3 text-sm italic text-ink/70">
          “{request.note}”
        </p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {request.requestedAreas.map((area) => {
          const v = verdicts[area];
          return (
            <li
              key={area}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">
                  {FLOOR_AREA_LABEL[area]}
                  {grantLevelFor(area, { coordinator: request.askerIsCoordinator }) === 'view' ? (
                    <span className="ml-2 font-normal text-xs text-ink/45">{GRANT_WORDS.view}</span>
                  ) : (
                    <span className="ml-2 font-normal text-xs text-terracotta">{GRANT_WORDS.edit}</span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-ink/60">{AREA_MEANING[area]}</span>
              </span>
              <span className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => setVerdicts((p) => ({ ...p, [area]: 'granted' }))}
                  aria-pressed={v === 'granted'}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-40 ${
                    v === 'granted'
                      ? 'border-success-400 bg-success-500 text-white'
                      : 'border-ink/15 bg-white text-ink/70 hover:border-success-400'
                  }`}
                  disabled={!mayShare(area)}
                  title={mayShare(area) ? undefined : 'Only the host can share this — you do not hold it.'}
                >
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} /> Share
                </button>
                <button
                  type="button"
                  onClick={() => setVerdicts((p) => ({ ...p, [area]: 'declined' }))}
                  aria-pressed={v === 'declined'}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition ${
                    v === 'declined'
                      ? 'border-warn-600 bg-warn-600 text-white'
                      : 'border-ink/15 bg-white text-ink/70 hover:border-warn-600'
                  }`}
                >
                  <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} /> Decline
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-warn-600/10 px-3 py-2 text-sm text-warn-600">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={pending || chosen === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-ink/90 disabled:opacity-40"
        >
          {pending ? (
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : (
            <ShieldCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          )}
          Send my answer
        </button>
        <span className="text-xs text-ink/55">
          {chosen === 0
            ? 'Choose share or decline for each thing.'
            : `${formatCount(chosen)} of ${formatCount(request.requestedAreas.length)} decided`}
        </span>
      </div>

      <p className="mt-3 text-xs text-ink/45">
        {answering.as === 'host'
          ? 'You can take any of this back later, and they lose it straight away.'
          : 'You answer for the host. Only parts the host shared with you can be shared on. The host can take any of it back.'}
      </p>
    </li>
  );
}
