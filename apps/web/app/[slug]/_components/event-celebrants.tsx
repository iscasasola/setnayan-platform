'use client';

import { useState, useTransition } from 'react';
import { Check, Clock } from 'lucide-react';
import type { CelebrantRow } from '@/lib/event-celebrants.server';

/** The two server actions, HANDED IN by the page (`addCelebrantFromEvent`,
 *  `setFollowByPublicId` in people/actions.ts) rather than imported here: that
 *  module reaches `server-only` code, and this file is rendered by the guest
 *  pathway's unit test, where `server-only` does not resolve. */
export type CelebrantActions = {
  follow: (input: { publicId: string; follow: boolean }) => Promise<
    { ok: true; following: boolean } | { ok: false; error: string }
  >;
  add: (input: { eventId: string; publicId: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

/**
 * event-celebrants.tsx — "The celebrants", on a guest's own Me tab (owner
 * 2026-09-28): *"They have an option to add the celebrants from the event …
 * They can follow without request but adding them will be connected people."*
 *
 *   FOLLOW — one-way, no request; drawn only toward a public profile (the one
 *            case the write is accepted).
 *   ADD    — the connection request, tagged with THIS event, so the celebrant
 *            reads "{name} is trying to add you from your {event} event" and
 *            answers Accept / Decline on their People page.
 *
 * Only this event's celebrants, and only for a guest whose seat is linked to
 * their own account (the server decides both, and the Add action decides them
 * again). Nothing about a celebrant is shown beyond the name the host wrote on
 * the guest list and a photo.
 */
export function EventCelebrants({
  eventId,
  celebrants,
  canAdd,
  actions,
}: {
  eventId: string;
  celebrants: CelebrantRow[];
  /** Connections are switched on — Add is offered only then. */
  canAdd: boolean;
  actions: CelebrantActions | null;
}) {
  if (celebrants.length === 0 || !actions) return null;
  return (
    <section aria-labelledby="event-celebrants-title" data-event-celebrants>
      <h2
        id="event-celebrants-title"
        className="mb-1 font-mono text-xs font-medium uppercase tracking-[0.12em] text-ink/55"
      >
        The celebrants
      </h2>
      <p className="mb-2 text-xs text-ink/55">
        Follow them, or add them to your people — they say yes before you’re connected.
      </p>
      <ul className="flex list-none flex-col divide-y divide-ink/[0.07]">
        {celebrants.map((c) => (
          <CelebrantItem key={c.publicId} eventId={eventId} row={c} canAdd={canAdd} actions={actions} />
        ))}
      </ul>
    </section>
  );
}

function CelebrantItem({
  eventId,
  row,
  canAdd,
  actions,
}: {
  eventId: string;
  row: CelebrantRow;
  canAdd: boolean;
  actions: CelebrantActions;
}) {
  const [pending, startTransition] = useTransition();
  const [following, setFollowing] = useState(row.following);
  const [connection, setConnection] = useState(row.connection);
  const [error, setError] = useState<string | null>(null);

  const initials = row.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const src = row.photoUrl && /^https?:\/\//.test(row.photoUrl) ? row.photoUrl : null;

  function follow() {
    setError(null);
    startTransition(async () => {
      const res = await actions.follow({ publicId: row.publicId, follow: true });
      if (!res.ok) setError(res.error);
      else setFollowing(res.following);
    });
  }

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await actions.add({ eventId, publicId: row.publicId });
      if (!res.ok) setError(res.error);
      else setConnection('asked');
    });
  }

  return (
    <li className="flex items-center gap-3 py-3" data-celebrant>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden className="h-8 w-8 shrink-0 rounded-full object-cover" />
      ) : (
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-xs font-semibold text-ink/60"
        >
          {initials || '·'}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-ink">{row.name}</span>
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {following ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink/55">
            <Check aria-hidden className="h-3 w-3" strokeWidth={2.2} />
            Following
          </span>
        ) : row.followable ? (
          <button
            type="button"
            onClick={follow}
            disabled={pending}
            className="button-secondary min-h-11 text-xs disabled:opacity-50"
          >
            Follow
          </button>
        ) : null}
        {connection === 'connected' ? (
          <span className="rounded-full bg-success-100 px-2.5 py-1 text-xs font-medium text-success-800">
            Connected
          </span>
        ) : connection === 'asked' ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-warn-100 px-2.5 py-1 text-xs font-medium text-warn-900">
            <Clock aria-hidden className="h-3 w-3" strokeWidth={2} />
            Asked
          </span>
        ) : canAdd ? (
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className="button-secondary min-h-11 text-xs disabled:opacity-50"
          >
            Add
          </button>
        ) : null}
      </span>
    </li>
  );
}
