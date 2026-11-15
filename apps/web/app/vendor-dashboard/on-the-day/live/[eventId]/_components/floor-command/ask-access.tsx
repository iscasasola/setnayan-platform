'use client';

/**
 * "Ask for access" — a booked supplier's half of the access conversation (owner 2026-07-27, widened 8 Nov 2026:
 * *"each supplier or coordinator can request for access for different parts of the event. they only see these
 * specific parts and edit it as needed. only coordinator and hosts has the final say"*).
 *
 * ONE dropdown of the parts they do not hold yet (owner: any set of choices is one dropdown — `PickMenu` with
 * checkmarks), a note, Send. Above it, what they HAVE, in the words of what it lets them do (`GRANT_WORDS`): the
 * booked coordinator's parts "can make changes"; every other supplier's "can see it and propose changes". And what
 * they ASKED: the ask waiting, or the last answer line by line.
 *
 * Who answers: a host — or, for a supplier who is not the coordinator, the booked coordinator too. A coordinator's
 * own ask is the hosts' alone (never self-approval), so the waiting line names exactly who decides.
 *
 * ⚠ MOUNTED TWICE, AND THE SECOND ONE IS THE IMPORTANT ONE. This shipped only inside the live floor console, which
 * redirects unless the booking is dated today — so the ask could not be made until the morning of the wedding. It is
 * also on the client page now, where a supplier plans for months. The copy says nothing about "the day" for that reason.
 */

import { useState, useTransition } from 'react';
import { Lock, Send } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';

import type { DelegateArea } from '@/lib/event-moderators';
import { FLOOR_AREA_LABEL, GRANT_WORDS } from '@/lib/floor-command';
import { answerLines, whoDecides, type LastAccessAnswer } from '@/lib/access-ask-words';
import { formatCount } from '@/lib/format-number';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { askHostForAccess } from './access-actions';

export function AskAccess({
  eventId,
  askable,
  pendingAreas,
  held = {},
  lastAnswer = null,
  askerIsCoordinator = false,
}: {
  eventId: string;
  /** Parts not shared yet — the only ones worth asking for. */
  askable: DelegateArea[];
  /** An ask already waiting, if any. */
  pendingAreas: DelegateArea[] | null;
  /** What they hold now, as the database resolves it (`fetchMyAreaGrants`). */
  held?: Partial<Record<DelegateArea, 'edit' | 'view' | null>>;
  /** The last answered ask, when no ask is waiting. */
  lastAnswer?: LastAccessAnswer | null;
  /** The booked coordinator asks the hosts only. */
  askerIsCoordinator?: boolean;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<DelegateArea[] | null>(null);
  const [pending, startTransition] = useTransition();

  const holding = (Object.entries(held) as [DelegateArea, 'edit' | 'view' | null][]).filter(([, l]) => l);
  const waiting = sent ?? pendingAreas;

  function toggle(area: string) {
    setPicked((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await askHostForAccess(eventId, picked, note || null);
      if (!res.ok) setError(res.error ?? 'Could not send that.');
      else setSent(res.asked ?? (picked as DelegateArea[]));
    });
  }

  if (holding.length === 0 && !waiting && !lastAnswer && askable.length === 0) return null;

  return (
    <div className="space-y-2" data-ask-access="">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]">
        <Lock aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
        Access to this event
      </p>

      {holding.length > 0 ? (
        <ul className="divide-y divide-[color:var(--m-line)]" data-ask-access-held="">
          {holding.map(([area, level]) => (
            <li key={area} className="py-2 text-sm text-[color:var(--m-slate-2)]">
              <span className="font-semibold text-ink">{FLOOR_AREA_LABEL[area]}</span>{' '}
              <span className={level === 'edit' ? 'font-semibold text-ink' : 'text-[color:var(--m-slate-2)]'}>· {GRANT_WORDS[level!]}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {waiting && waiting.length > 0 ? (
        <p className="text-sm text-[color:var(--m-slate-2)]" data-ask-access-waiting="">
          You asked for{' '}
          <strong className="font-semibold text-ink">{waiting.map((a) => FLOOR_AREA_LABEL[a]).join(', ')}</strong>.
          Waiting for {whoDecides(askerIsCoordinator)}.
        </p>
      ) : lastAnswer ? (
        <p className="text-sm text-[color:var(--m-slate-2)]" data-ask-access-answer="">
          Last answer · {answerLines(lastAnswer)}
        </p>
      ) : null}

      {!waiting && askable.length > 0 ? (
        <div className="space-y-2 pt-1">
          <InfoTip
            label={askerIsCoordinator ? 'Ask the host for access' : 'Ask the host or the coordinator for access'}
            labelAs="p"
            labelClassName="text-sm font-semibold text-ink"
            align="start"
          >
            {askerIsCoordinator ? 'The host decides' : 'The host or the coordinator decides'} each part, and can take it
            back any time.
          </InfoTip>
          <PickMenu
            label="Parts to ask for"
            value={null}
            options={askable.map((a) => ({ key: a, label: FLOOR_AREA_LABEL[a] }))}
            picked={picked}
            onPick={toggle}
            buttonText={
              picked.length === 0
                ? 'Pick the parts you need'
                : `${formatCount(picked.length)} ${picked.length === 1 ? 'part' : 'parts'} picked`
            }
            dataAttr="data-ask-access-parts"
            doneNote="Tick each part you need."
          />

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={240}
            placeholder="Why you need it (optional)"
            aria-label="Why you need it (optional)"
            className="min-h-11 w-full rounded-lg border border-[color:var(--m-line)] bg-[color:var(--m-paper)] px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta"
          />

          {error ? (
            <p role="alert" className="text-sm font-semibold text-danger-700">
              {error}
            </p>
          ) : null}

          <ActionButton
            tone="brand"
            icon={Send}
            label="Send request"
            onClick={send}
            waiting={pending}
            disabled={!pending && picked.length === 0}
          />
        </div>
      ) : null}
    </div>
  );
}
