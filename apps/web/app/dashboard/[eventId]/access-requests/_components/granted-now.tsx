'use client';

/**
 * WHAT THEY CAN SEE RIGHT NOW — and the button that takes it back.
 *
 * ── WHY THIS READS `event_moderators` AND NOT THE ANSWER IT IS SITTING UNDER ──
 *
 * "Already answered" below prints the DECISION: what the host said on the day,
 * kept as a record. This section prints the GRANT: what the coordinator can open
 * this minute. They are two different facts and they diverge the moment anything
 * is taken back — the decision stays "shared" forever, because it was.
 *
 * 🔑 So a take-back that only rewrote history would leave the couple reading
 * "Seat plan: shared" about somebody who can no longer open it, and — far worse
 * on the other side of the same coin — a couple who pressed Take back and still
 * saw "shared" would reasonably press it again, or conclude it had not worked.
 * The live grant is the one that must reach the render.
 *
 * ── AND AN AREA THEY NEVER HELD SIMPLY DOES NOT APPEAR ──────────────────────
 *
 * Rows are built from `resolveAreaLevel`, so a declined line and a taken-back
 * line look identical here, which is correct: both are "cannot open it". The
 * history of which is which is the section below.
 */

import { useState, useTransition } from 'react';
import { Loader2, Undo2 } from 'lucide-react';

import type { AreaLevel, DelegateArea } from '@/lib/event-moderators';
import { FLOOR_AREA_LABEL } from '@/lib/floor-command';
import { revokeArea } from '../actions';

export type LiveGrant = {
  moderatorUserId: string;
  holderName: string;
  areas: Array<{ area: DelegateArea; level: AreaLevel }>;
};

function GrantRow({
  eventId,
  grant,
  area,
  level,
}: {
  eventId: string;
  grant: LiveGrant;
  area: DelegateArea;
  level: AreaLevel;
}) {
  // Optimism is wrong here: this is a permission. The row disappears when the
  // server confirms, never before — a take-back that only LOOKED like it worked
  // is the failure mode this whole section exists to prevent.
  const [taken, setTaken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (taken) return null;

  function takeBack() {
    setError(null);
    startTransition(async () => {
      const res = await revokeArea(eventId, grant.moderatorUserId, area);
      if (res.ok) setTaken(true);
      else setError(res.error ?? 'Could not take that back.');
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">
          {FLOOR_AREA_LABEL[area]}
          {level === 'view' ? (
            <span className="ml-2 text-xs font-normal text-ink/45">view only</span>
          ) : null}
        </span>
        {error ? <span className="mt-0.5 block text-xs text-red-600">{error}</span> : null}
      </span>
      <button
        type="button"
        onClick={takeBack}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/80 transition hover:border-ink/30 hover:text-ink disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Undo2 className="h-3.5 w-3.5" aria-hidden />
        )}
        Take back
      </button>
    </li>
  );
}

export function GrantedNow({ eventId, grants }: { eventId: string; grants: LiveGrant[] }) {
  if (grants.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="sn-sec">Shared right now</h2>
      <p className="mt-1 text-xs text-ink/50">
        What each person can open this minute. Taking something back is immediate — they
        keep their other areas.
      </p>
      <ul className="mt-3 space-y-4">
        {grants.map((g) => (
          <li key={g.moderatorUserId} className="sn-tile p-4">
            <h3 className="text-sm font-semibold text-ink">{g.holderName}</h3>
            <ul className="mt-3 space-y-2">
              {g.areas.map(({ area, level }) => (
                <GrantRow
                  key={area}
                  eventId={eventId}
                  grant={g}
                  area={area}
                  level={level}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
