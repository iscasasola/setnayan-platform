'use client';

import { useState } from 'react';
import { judgeVenue, PROBE_CHUNK_BYTES, PROBE_RUN_MS, PROBE_SLOT_MS } from '@/lib/venue-check';
import {
  VenueCheckBusy,
  VenueCheckDone,
  VenueCheckReady,
  type JudgedVenue,
} from '@/app/dashboard/[eventId]/studio/panood/setup/venue-check/_components/venue-check-runner';
import { VenueCheckCard } from '@/app/dashboard/[eventId]/studio/panood/setup/venue-check/_components/venue-check-card';
import type { VenueCheckStatusProps } from '@/app/dashboard/[eventId]/studio/panood/setup/venue-check/_components/venue-check-status';

const EVENT = '00000000-0000-4000-8000-000000000000';
const AT = '2026-11-05T03:20:00Z';

/** A run where every second uploads at `bps` — judged by the REAL judge, so the frames show what ships. */
function judged(bps: number): JudgedVenue {
  const ms = Math.round((PROBE_CHUNK_BYTES * 8 * 1_000) / bps);
  const samples = Array.from({ length: PROBE_RUN_MS / PROBE_SLOT_MS }, (_, i) => ({
    bytes: PROBE_CHUNK_BYTES,
    // a little wobble, as a real venue has
    ms: Math.round(ms * (1 + ((i % 5) - 2) * 0.06)),
  }));
  return judgeVenue(samples) as JudgedVenue;
}

const LAST: Record<string, VenueCheckStatusProps> = {
  found: { state: 'found', finishedAt: AT, verdict: 'full', placeName: 'Main hall, by the stage' },
  none: { state: 'none' },
  unread: { state: 'unread' },
};

export function VenueCheckLabFrames({ f }: { f: string }) {
  const [place, setPlace] = useState(f === 'ready' ? 'Main hall, by the stage' : '');
  if (f === 'ready' || f === 'ready-none') {
    return (
      <VenueCheckReady place={place} onPlace={setPlace} error={null} onStart={() => {}} last={f === 'ready' ? LAST.found! : LAST.none!} />
    );
  }
  if (f === 'error') {
    return (
      <VenueCheckReady
        place={place}
        onPlace={setPlace}
        error="We couldn’t reach Setnayan from here. Check the connection, then try again."
        onStart={() => {}}
        last={LAST.none!}
      />
    );
  }
  if (f === 'busy') return <VenueCheckBusy saving={false} progress={0.44} liveBps={6_400_000} onStop={() => {}} />;
  if (f === 'full' || f === 'reduced' || f === 'not_enough') {
    const bps = f === 'full' ? 9_000_000 : f === 'reduced' ? 2_200_000 : 900_000;
    return (
      <VenueCheckDone
        judgement={judged(bps)}
        delayMs={f === 'not_enough' ? 310 : 72}
        checkedAt={AT}
        placeName="Main hall, by the stage"
        setupHref="/dev/venue-check-lab?f=card"
        onAgain={() => {}}
      />
    );
  }
  if (f === 'card' || f === 'card-none' || f === 'card-unread') {
    const latest = f === 'card' ? LAST.found! : f === 'card-none' ? LAST.none! : LAST.unread!;
    return <VenueCheckCard href={`/dashboard/${EVENT}/studio/panood/setup/venue-check`} latest={latest} />;
  }
  return <p>Unknown frame.</p>;
}
