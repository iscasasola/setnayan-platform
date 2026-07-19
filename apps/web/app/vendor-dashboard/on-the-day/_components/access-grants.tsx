'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, UserCheck } from 'lucide-react';
import { setEventAccessGrant } from '../actions';

export type GrantableMember = {
  userId: string;
  name: string;
  roleLabel: string;
  isOwnerAdmin: boolean;
  granted: boolean;
};

/**
 * Step 3 of the launcher — set which team accounts can open this event's
 * day-of app. Owner/admin accounts always have access (shown, not toggleable);
 * other teammates are granted per-event. Optimistic toggles persisted to
 * vendor_event_access_grants via setEventAccessGrant.
 */
export function AccessGrants({
  eventId,
  members,
}: {
  eventId: string;
  members: GrantableMember[];
}) {
  const [state, setState] = useState<Record<string, boolean>>(
    () => Object.fromEntries(members.map((m) => [m.userId, m.granted])),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(userId: string) {
    const next = !state[userId];
    setState((prev) => ({ ...prev, [userId]: next }));
    startTransition(async () => {
      const res = await setEventAccessGrant(eventId, userId, next);
      if (!res.ok) {
        setError(res.error ?? 'Could not save.');
        setState((prev) => ({ ...prev, [userId]: !next })); // revert
      } else {
        setError(null);
      }
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <UserCheck aria-hidden className="h-4 w-4" style={{ color: 'var(--m-orange-2)' }} strokeWidth={1.75} />
        <h2 className="sn-sec">Who can open this app</h2>
        {pending ? (
          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--m-slate-3)' }} strokeWidth={1.75} />
        ) : null}
      </div>
      <p className="mt-1 text-sm" style={{ color: 'var(--m-slate-2)' }}>
        You always have access. Grant a teammate access to just this event’s day-of app.
      </p>
      {error ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--sn-danger, #b42318)' }}>
          {error}
        </p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {members.map((m) => {
          const on = m.isOwnerAdmin ? true : (state[m.userId] ?? false);
          return (
            <li key={m.userId} className="sn-tile flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                  {m.name}
                </span>
                <span className="block text-xs" style={{ color: 'var(--m-slate-2)' }}>
                  {m.roleLabel}
                  {m.isOwnerAdmin ? ' · always has access' : ''}
                </span>
              </span>
              {m.isOwnerAdmin ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--sn-success, #157347)' }}>
                  <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> Access
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(m.userId)}
                  aria-pressed={on}
                  disabled={pending}
                  className="inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition"
                  style={{
                    background: on ? 'var(--m-ink)' : 'var(--m-line)',
                    justifyContent: on ? 'flex-end' : 'flex-start',
                    cursor: 'pointer',
                  }}
                >
                  <span className="h-5 w-5 rounded-full" style={{ background: 'var(--m-paper)' }} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
