'use client';

import { useState, useTransition } from 'react';
import { UserPlus, Check, X, Clock } from 'lucide-react';
import { proposeConnection, confirmConnection, declineConnection } from '../actions';
import { DECLARABLE_RELATIONS, type ConnectionRelation } from '@/lib/people-connections';

/**
 * Interactive connections UI — the flag-gated functional mode of the People page
 * (rendered only when `peopleConnectionsEnabled()`). Wires the shipped
 * propose/confirm/decline server actions. Nothing here runs in production until
 * the flag is on (post PH counsel).
 *
 * Known limitation (resolved by the counsel-gated cross-person name-visibility
 * RLS): a connected person's NAME shows only when the current account can see
 * that person's row under `people` RLS (i.e. people you added). Otherwise it
 * degrades to a neutral label until that RLS lands with the flag flip.
 */

export type ConnectionItem = {
  connectionId: string;
  relation: string;
  layer: string;
  status: string;
  otherName: string | null;
};

const RELATION_LABEL: Record<string, string> = {
  spouse: 'Spouse',
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  godparent: 'Godparent',
  godchild: 'Godchild',
  friend: 'Friend',
};

type Result = { ok: true } | { ok: false; error: string };

export function ConnectionsPanel({
  incoming,
  outgoing,
  confirmed,
}: {
  incoming: ConnectionItem[];
  outgoing: ConnectionItem[];
  confirmed: ConnectionItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [relation, setRelation] = useState<ConnectionRelation>('spouse');
  const [email, setEmail] = useState('');

  function run(fn: () => Promise<Result>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else onOk?.();
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-base font-semibold text-ink">Add a connection</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="conn-relation">
            Relationship
          </label>
          <select
            id="conn-relation"
            value={relation}
            onChange={(e) => setRelation(e.target.value as ConnectionRelation)}
            disabled={pending}
            className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
          >
            {DECLARABLE_RELATIONS.map((r) => (
              <option key={r} value={r}>
                {RELATION_LABEL[r]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="conn-email">
            Their email
          </label>
          <input
            id="conn-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="their email"
            disabled={pending}
            className="flex-1 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
          />
          <button
            type="button"
            onClick={() => run(() => proposeConnection({ relation, email }), () => setEmail(''))}
            disabled={pending || !email}
            className="button-primary inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <UserPlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Send request
          </button>
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        <p className="mt-2 text-xs text-ink/50">
          They confirm before it connects. Add only your closest — grandparents, cousins, and
          in-laws appear automatically.
        </p>
      </section>

      {incoming.length > 0 ? (
        <section>
          <h2 className="mb-3 text-base font-semibold text-ink">Requests for you</h2>
          <ul className="space-y-2">
            {incoming.map((c) => (
              <li
                key={c.connectionId}
                className="flex flex-col gap-2 rounded-lg border border-ink/10 bg-cream p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm text-ink">
                  <span className="font-medium">{c.otherName ?? 'Someone'}</span> added you as their{' '}
                  {(RELATION_LABEL[c.relation] ?? 'connection').toLowerCase()}.
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => run(() => confirmConnection(c.connectionId))}
                    disabled={pending}
                    className="button-primary inline-flex items-center gap-1 text-xs disabled:opacity-50"
                  >
                    <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => run(() => declineConnection(c.connectionId))}
                    disabled={pending}
                    className="button-secondary inline-flex items-center gap-1 text-xs disabled:opacity-50"
                  >
                    <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {confirmed.length > 0 ? (
        <section>
          <h2 className="mb-3 text-base font-semibold text-ink">Your people</h2>
          <ul className="space-y-2">
            {confirmed.map((c) => (
              <li
                key={c.connectionId}
                className="flex items-center gap-3 rounded-lg border border-ink/10 bg-cream p-3"
              >
                <span className="flex-1 text-sm font-medium text-ink">
                  {c.otherName ?? 'A connection'}
                </span>
                <span className="text-xs text-ink/55">{RELATION_LABEL[c.relation] ?? c.relation}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {outgoing.length > 0 ? (
        <section>
          <h2 className="mb-3 text-base font-semibold text-ink">Waiting to confirm</h2>
          <ul className="space-y-2">
            {outgoing.map((c) => (
              <li
                key={c.connectionId}
                className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white/40 p-3 opacity-80"
              >
                <Clock aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
                <span className="flex-1 text-sm text-ink">{c.otherName ?? 'Pending'}</span>
                <span className="text-xs text-ink/55">
                  {RELATION_LABEL[c.relation] ?? c.relation} · pending
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
