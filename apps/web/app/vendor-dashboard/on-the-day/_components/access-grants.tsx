'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Explain } from '@/app/_components/explain';
import { FormRow, FormRows } from '@/app/_components/form-row';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
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
 *
 * 🗓 v13 (owner "Approved." 2026-10-29): Hub › Crew — one hairline row per teammate with the house switch. Same action.
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
    <div data-hub-team="">
      <div className="flex items-center justify-between gap-2 pt-4">
        <p className="home-k2">Your team on this event</p>
        <span className="flex items-center gap-1.5">
          {pending ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin text-ink/55" strokeWidth={1.75} /> : null}
          <Explain title="Your team on this event">
            You always have access. Switch a teammate on to let them open just this event’s Event Hub — nothing else
            of your shop changes.
          </Explain>
        </span>
      </div>
      {error ? (
        <p role="alert" className="py-2 text-[13px] font-semibold text-danger-700">
          {error}
        </p>
      ) : null}
      <FormRows data="hub-team">
        {members.map((m) => {
          const on = m.isOwnerAdmin ? true : (state[m.userId] ?? false);
          return (
            <FormRow
              key={m.userId}
              name={m.name}
              line={`${m.roleLabel}${m.isOwnerAdmin ? ' · always has access' : on ? ' · can open this event' : ''}`}
              attrs={{ 'data-hub-team-member': m.userId }}
            >
              {m.isOwnerAdmin ? (
                <span className="inline-flex items-center gap-1 text-[13px] font-medium text-success-700 dark:text-success-600">
                  <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> In
                </span>
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${m.name} can open this event`}
                  onClick={() => toggle(m.userId)}
                  disabled={pending}
                  className={SWITCH_BUTTON}
                >
                  <SwitchTrack on={on} />
                </button>
              )}
            </FormRow>
          );
        })}
      </FormRows>
    </div>
  );
}
