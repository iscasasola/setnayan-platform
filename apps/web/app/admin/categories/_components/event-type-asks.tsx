'use client';

/**
 * event-type-asks.tsx — "Asked for by hosts" on Admin › Event types (owner 2026-10-28, DECISION_LOG "EVENT TYPES MUST
 * BE SPECIFIC": "an in-app request in Admin › Event types (no email); the requester is told in-app when it is added").
 *
 * One row per open ask: what the host typed, who, when — then the three answers, every one a SHIPPED action:
 *   · Add as new  → `createEventTypeRoster` with `request_id` (the new type starts hidden; the host is told when its
 *                   Status becomes “In the picker”);
 *   · It is ▾     → `setEventTypeStatus` with `request_id` + `request_answer=link` (an existing type; told now if it
 *                   is in the picker);
 *   · Close       → `setEventTypeStatus` with `request_id` + `request_answer=dismiss`.
 * +0 server actions. Nothing here presses by itself.
 */
import { useState } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import { formatCount } from '@/lib/format-number';
import type { EventTypeAsk } from '@/lib/event-type-requests';
import { createEventTypeRoster, setEventTypeStatus } from '../actions';
import { SavePick, type Choice } from './pickers';

function Hidden({ back }: { back: Record<string, string> }) {
  return (
    <>
      {Object.entries(back).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

function AskRow({ ask, types, back }: { ask: EventTypeAsk; types: readonly Choice[]; back: Record<string, string> }) {
  const [name, setName] = useState(ask.label);
  const linkedTo = ask.eventType ? (types.find((t) => t.key === ask.eventType)?.label ?? ask.eventType) : null;
  return (
    <li className="space-y-2 rounded-2xl bg-sky-50/40 p-3 dark:bg-raised" data-ask-row="">
      <p className="text-sm text-ink">
        <span className="font-semibold">“{ask.label}”</span> from {ask.askedBy}
        <span className="text-ink/70"> · {new Date(ask.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
      </p>
      {linkedTo ? (
        <p className="text-xs text-ink/70">Linked to {linkedTo} — they’re told when its Status is “In the picker”.</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {!linkedTo ? (
          <form action={createEventTypeRoster} className="flex flex-wrap items-center gap-2">
            <Hidden back={back} />
            <input type="hidden" name="event_type" value="" />
            <input type="hidden" name="request_id" value={ask.requestId} />
            <label className="sr-only" htmlFor={`ask-name-${ask.requestId}`}>
              Name for the new event type
            </label>
            <input
              id={`ask-name-${ask.requestId}`}
              name="label_en"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={80}
              className="min-h-10 w-44 rounded-md border border-ink/15 bg-raised px-2.5 text-sm text-ink"
            />
            <SubmitButton
              className="min-h-10 rounded-full bg-ink px-3 text-xs font-semibold text-cream"
              pendingLabel="Adding…"
            >
              Add as new
            </SubmitButton>
          </form>
        ) : null}
        <SavePick
          label="It is this event type"
          value=""
          buttonText={linkedTo ? 'Link to another' : 'It is…'}
          choices={types}
          action={setEventTypeStatus}
          field="event_type"
          hidden={{ ...back, request_id: ask.requestId, request_answer: 'link' }}
        />
        <form action={setEventTypeStatus}>
          <Hidden back={back} />
          <input type="hidden" name="request_id" value={ask.requestId} />
          <input type="hidden" name="request_answer" value="dismiss" />
          <SubmitButton className="min-h-10 rounded-full px-3 text-xs font-medium text-ink/70 hover:text-ink" pendingLabel="Closing…">
            Close
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}

export function EventTypeAsks({
  asks,
  failed,
  types,
  back,
}: {
  asks: readonly EventTypeAsk[];
  failed: boolean;
  types: readonly Choice[];
  back: Record<string, string>;
}) {
  if (failed) {
    return (
      <p role="alert" className="mt-3 rounded-xl bg-[var(--sn-warning-soft)] px-3 py-2 text-sm text-ink">
        Couldn’t load the hosts’ asks — refresh to try again.
      </p>
    );
  }
  if (asks.length === 0) return null;
  return (
    <section aria-label="Asked for by hosts" className="mt-3" data-event-type-asks="">
      <h2 className="px-1 pb-2 text-sm font-semibold text-ink">Asked for by hosts ({formatCount(asks.length)})</h2>
      <ul className="space-y-2">
        {asks.map((a) => (
          <AskRow key={a.requestId} ask={a} types={types} back={back} />
        ))}
      </ul>
    </section>
  );
}
