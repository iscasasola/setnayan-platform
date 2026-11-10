'use client';

/**
 * 🔒 ONE SUPPLIER LOCK, AS A SWITCH — the shared part for all three locks (quotation · payment plan · a sent form).
 * Lane C's cards may mount it beside their own content; `supplier-locks-section.tsx` mounts all of them together.
 *
 * The flip is a browser RPC (`lib/supplier-locks.ts` `flipLock`) — the supplier's own session, the database's own
 // one-render: keep (client-write) — the lock was flipped by an RPC in the browser, no server action rendered; re-read so the switch and the chat line show.
 * refusal of anyone else — then a `router.refresh()` so the page re-reads in place (a save never resets the screen).
 * The chat line is posted by the database trigger, not here. A refused flip says why where it was pressed.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { flipLock, LOCK_WORDS, type LockKind } from '@/lib/supplier-locks';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';

const REFUSED: Record<string, string> = {
  not_allowed: 'Only the shop’s owner or an admin can switch this.',
  not_found: 'This is no longer in the chat.',
  unauthenticated: 'Sign in again to switch this.',
  failed: 'Couldn’t switch it. Try again in a moment.',
};

export function LockSwitch({
  kind,
  refId,
  eventId,
  locked,
  title,
}: {
  kind: LockKind;
  /** quote / plan → proposal_id · form → form_id · questions → the shop's vendor_profile_id. */
  refId: string;
  eventId: string;
  locked: boolean;
  /** The item's own name ("Wedding day coverage"), read under the label. */
  title?: string | null;
}) {
  const router = useRouter();
  const [on, setOn] = useState(locked);
  const [refused, setRefused] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const words = LOCK_WORDS[kind];

  return (
    <li className="flex min-h-14 items-center gap-3 border-t py-2 first:border-t-0" style={{ borderColor: 'var(--sn-line)' }} data-lock-switch={kind}>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">
          {words.label}
          {title ? <span className="font-normal text-ink/60"> · {title}</span> : null}
        </span>
        <span className="block text-[13px] text-ink/60">{on ? words.on : words.off}</span>
        {refused ? (
          <span role="alert" className="mt-0.5 block text-[13px] text-danger-900">
            {refused}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`Lock ${words.label.toLowerCase()}${title ? ` · ${title}` : ''}`}
        disabled={pending}
        className={SWITCH_BUTTON}
        onClick={() => {
          const next = !on;
          setOn(next);
          setRefused(null);
          start(async () => {
            const r = await flipLock(createClient(), kind, refId, next, eventId);
            if (r !== 'ok') {
              setOn(!next);
              setRefused(REFUSED[r] ?? REFUSED.failed!);
              return;
            }
            // one-render: keep (client-write) — the lock was flipped by an RPC in the browser, no server action rendered; re-read so the switch and the chat line show.
            router.refresh();
          });
        }}
      >
        <SwitchTrack on={on} />
      </button>
    </li>
  );
}
