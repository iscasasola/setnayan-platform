'use client';

/**
 * Life Story · the people in your story + the ✦ opt-in (PR-3).
 *
 * Lives on the Life Story route (not the connections-flagged people page) so
 * the toggle is reachable whenever Life Story itself is on. Quiet by design:
 * a two-step inline confirm, feather-light copy, fully reversible, and only
 * offered on people the viewer added (canEdit computed server-side).
 */

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
        <span className="text-xs text-ink/40">{people.length}</span>
      </div>
      {error ? (
        <p className="mb-3 rounded-xl border border-ink/10 bg-white/40 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <ul className="space-y-2">
        {people.map((p) => (
          <li
            key={p.personId}
            className="flex items-center gap-3 rounded-lg border border-ink/10 bg-cream p-3"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
              {p.displayName}
              {p.inMemoriam ? (
                <span aria-hidden className="ml-1.5 text-ink/50">
                  ✦
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-xs text-ink/55">
              in {p.recurrence} {p.recurrence === 1 ? 'event' : 'events'}
            </span>
            {p.canEdit ? (
              p.inMemoriam ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(p.personId, false)}
                  className="shrink-0 text-xs font-medium text-ink/60 hover:text-ink disabled:opacity-50"
                >
                  Unmark ✦
                </button>
              ) : confirming === p.personId ? (
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  <span className="text-ink/60">Hold them a little longer in your story?</span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(p.personId, true)}
                    className="font-medium text-ink hover:underline disabled:opacity-50"
                  >
                    Remember ✦
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="text-ink/50 hover:text-ink"
                  >
                    Not now
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(p.personId)}
                  className="shrink-0 text-xs font-medium text-ink/60 hover:text-ink disabled:opacity-50"
                >
                  Remembered ✦
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
