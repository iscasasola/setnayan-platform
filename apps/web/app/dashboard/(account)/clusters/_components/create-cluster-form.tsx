'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
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
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--sn-ink-500)]">
        Start a group
      </h2>
      <p className="mt-1 text-sm text-ink/75">
        Name it whatever you call it — “Our year”, “The Cruz wedding”.
      </p>

      {error ? (
        <p
          className="mt-3 text-sm text-[rgb(var(--color-danger))]"
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
          autoComplete="off"
          id="cluster-display-name"
          name="display_name"
          required
          maxLength={80}
          placeholder="Our year"
          className="input-field flex-1"
        />
        <ActionButton
          type="submit"
          tone="brand"
          main
          icon={Plus}
          label={pending ? 'Creating…' : 'Create group'}
          disabled={pending}
          waiting={pending}
        />
      </form>

      {/*
        Say the next step will be blocked BEFORE they hit it. A person who makes
        a group and then finds nothing to put in it has been walked into a dead
        end by the screen. `linkableMeasured === false` is "we do not know",
        which is not the same as "you have none" — so it says neither.
      */}
      {linkableMeasured && !hasLinkable ? (
        <p className="mt-3 text-sm text-ink/75">
          Every event you host is already in a group, so a new one would start empty.
        </p>
      ) : null}
    </section>
  );
}
