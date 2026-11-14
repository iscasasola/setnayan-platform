'use client';

/**
 * Life Story · the people in your story + the ✦ opt-in (PR-3).
 *
 * Lives on the Life Story route (not the connections-flagged people page) so
 * the toggle is reachable whenever Life Story itself is on. Quiet by design:
 * a two-step inline confirm, feather-light copy, fully reversible, and only
 * offered on people the viewer added (canEdit computed server-side).
 */

import { Sparkle, Undo2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { formatCount } from '@/lib/format-number';
import { useState, useTransition } from 'react';
import { markPersonInMemoriam } from '../actions';

export type StoryPerson = {
  personId: string;
  displayName: string;
  inMemoriam: boolean;
  recurrence: number;
  canEdit: boolean;
};

export function StoryPeople({ people }: { people: StoryPerson[] }) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (people.length === 0) return null;

  const run = (personId: string, remembered: boolean) => {
    setError(null);
    setConfirming(null);
    startTransition(async () => {
      const res = await markPersonInMemoriam(personId, remembered);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-base font-semibold text-ink">The people in your story</h2>
        <span className="text-[13px] tabular-nums text-ink/70">{formatCount(people.length)}</span>
      </div>
      {error ? (
        <p role="alert" className="mb-3 text-sm text-[rgb(var(--color-danger))]">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-ink/10 border-y border-ink/10">
        {people.map((p) => (
          <li
            key={p.personId}
            className="flex min-h-14 flex-wrap items-center gap-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
              {p.displayName}
              {p.inMemoriam ? (
                <span aria-hidden className="ml-1.5 text-ink/70">
                  ✦
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs text-ink/70">
              in {p.recurrence} {p.recurrence === 1 ? 'event' : 'events'}
            </span>
            {p.canEdit ? (
              p.inMemoriam ? (
                <ActionButton
                  tone="neutral"
                  icon={Undo2}
                  label="Unmark ✦"
                  disabled={pending}
                  onClick={() => run(p.personId, false)}
                />
              ) : confirming === p.personId ? (
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-ink/75">Hold them a little longer in your story?</span>
                  <ActionButton
                    tone="brand"
                    icon={Sparkle}
                    label="Remember ✦"
                    disabled={pending}
                    waiting={pending}
                    onClick={() => run(p.personId, true)}
                  />
                  <ActionButton tone="neutral" icon={X} label="Not now" onClick={() => setConfirming(null)} />
                </span>
              ) : (
                <ActionButton
                  tone="neutral"
                  icon={Sparkle}
                  label="Remembered ✦"
                  disabled={pending}
                  onClick={() => setConfirming(p.personId)}
                />
              )
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
