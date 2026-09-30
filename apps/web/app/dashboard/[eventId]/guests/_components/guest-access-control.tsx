'use client';

/**
 * guest-access-control.tsx — the guest card's "Access" line: one dropdown,
 * None · Co-host · Limited helper (owner 2026-09-28; "any set of choices is a
 * dropdown" — the shared PickMenu, never a pill row).
 *
 * It writes the seat and says what the database decided: live now, or
 * "starts as soon as they say yes and sign in". A celebrant co-host and the
 * creator are locked, with the reason in words — the dropdown never offers a
 * choice the database will refuse.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import {
  ACCESS_LEVEL_LABEL,
  accessNote,
  type GuestAccessLevel,
  type GuestAccessState,
} from '@/lib/guest-access';
import { setGuestAccess } from '../[guestId]/access-actions';

// ONE vocabulary for the card's Access line and the guest list's Access column
// (owner 2026-09-28: "None · Co-host · Limited helper") — `lib/guest-access`.
const LABELS = ACCESS_LEVEL_LABEL;

export function GuestAccessControl({
  eventId,
  guestId,
  firstName,
  initial,
  canManage,
}: {
  eventId: string;
  guestId: string;
  firstName: string;
  initial: GuestAccessState;
  canManage: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const celebrantNote = `${firstName} is a celebrant, so stays a co-host`;
  const options: PickOption[] = (['none', 'co_host', 'limited_helper'] as const).map((k) => ({
    key: k,
    label: LABELS[k],
    disabledNote: state.lock === 'celebrant' && k !== 'co_host' ? celebrantNote : undefined,
  }));

  const pick = (key: string) => {
    const level = key as GuestAccessLevel;
    if (level === state.level) return;
    setError(null);
    startTransition(async () => {
      const res = await setGuestAccess(eventId, guestId, level);
      if (res.ok) {
        setState(res.state);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="space-y-2" data-guest-access>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink">Access</span>
        {canManage && state.lock !== 'creator' ? (
          <PickMenu
            label={`${firstName}'s access to this event`}
            // PickMenu matches `value` against option KEYS, not labels.
            value={state.level}
            options={options}
            onPick={pick}
            dataAttr="data-guest-access-pick"
          />
        ) : (
          <span className="text-sm text-ink/60">{LABELS[state.level]}</span>
        )}
      </div>
      <p className="text-xs text-ink/55" aria-live="polite">
        {pending ? 'Saving…' : accessNote(state, firstName)}
      </p>
      {error ? (
        <p role="alert" className="text-xs text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
