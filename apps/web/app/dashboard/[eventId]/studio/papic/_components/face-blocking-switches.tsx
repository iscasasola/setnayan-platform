'use client';

import { useMemo, useState, useTransition } from 'react';
import { SwitchTrack } from '@/app/_components/switch-track';
import { setGuestFaceblock } from '@/app/dashboard/[eventId]/guests/[guestId]/actions';

export type FaceBlockGuest = { id: string; name: string; role: string | null; on: boolean };

/** The search and the per-guest switches — optimistic, snapping back with one plain line when a save does not land. */
export function FaceBlockingSwitches({ eventId, guests }: { eventId: string; guests: FaceBlockGuest[] }) {
  const [q, setQ] = useState('');
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(guests.map((g) => [g.id, g.on])));
  const [problem, setProblem] = useState<string | null>(null);
  const [, start] = useTransition();
  const shown = useMemo(() => {
    const w = q.trim().toLowerCase();
    const list = w ? guests.filter((g) => g.name.toLowerCase().includes(w)) : guests;
    return list.slice(0, w ? 40 : 8);
  }, [guests, q]);
  const flip = (g: FaceBlockGuest) => {
    const next = !on[g.id];
    setOn((m) => ({ ...m, [g.id]: next }));
    setProblem(null);
    start(async () => {
      const r = await setGuestFaceblock(eventId, g.id, next);
      if (!r.ok) {
        setOn((m) => ({ ...m, [g.id]: !next }));
        setProblem(`That didn’t save for ${g.name} — try again.`);
      }
    });
  };
  return (
    <div className="flex flex-col gap-1">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${guests.length} guests`}
        aria-label="Search your guests"
        className="h-11 rounded-full border border-ink/15 bg-paper px-4 text-[14px] text-ink placeholder:text-ink/50"
        data-face-blocking-search=""
      />
      <ul className="divide-y divide-ink/10">
        {shown.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              role="switch"
              aria-checked={on[g.id] === true}
              aria-label={`Blur ${g.name}`}
              onClick={() => flip(g)}
              className="flex min-h-11 w-full items-center justify-between gap-3 py-1.5 text-left"
            >
              <span className="min-w-0 truncate text-[14px] text-ink">
                {g.name}
                {on[g.id] ? <span className="ml-2 text-[12px] text-terracotta">Blurred</span> : null}
              </span>
              <SwitchTrack on={on[g.id] === true} />
            </button>
          </li>
        ))}
      </ul>
      {problem ? (
        <p role="alert" className="text-xs text-terracotta">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
