'use client';

import { useState, useTransition } from 'react';
import { createCluster } from '../actions';

/**
 * Make a group. On success the action redirects into the new group, so there is
 * no success state to render here — only the failure one.
 */
export function CreateClusterForm({
  hasLinkable,
  linkableMeasured,
}: {
  hasLinkable: boolean;
  linkableMeasured: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="sn-tile">
      <h2 className="sn-sec">Start a group</h2>
      <p className="sn-sec-sub">
        Name it whatever you call it — “Our year”, “The Cruz wedding”.
      </p>

      {error ? (
        <p
          className="mt-3 rounded-xl border border-ink/10 bg-white/40 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const res = await createCluster(formData);
            // A successful createCluster redirects and never returns a value.
            if (res && !res.ok) setError(res.error);
          });
        }}
      >
        <label className="sr-only" htmlFor="cluster-display-name">
          Name this group
        </label>
        <input
          id="cluster-display-name"
          name="display_name"
          required
          maxLength={80}
          placeholder="Our year"
          className="input-field flex-1"
        />
        <button type="submit" disabled={pending} className="button-primary disabled:opacity-50">
          {pending ? 'Creating…' : 'Create group'}
        </button>
      </form>

      {/*
        Say the next step will be blocked BEFORE they hit it. A person who makes
        a group and then finds nothing to put in it has been walked into a dead
        end by the screen. `linkableMeasured === false` is "we do not know",
        which is not the same as "you have none" — so it says neither.
      */}
      {linkableMeasured && !hasLinkable ? (
        <p className="mt-3 text-sm text-ink-soft">
          Every celebration you host is already in a group, so a new one would start empty.
        </p>
      ) : null}
    </section>
  );
}
