'use client';

/**
 * The phone half of the 3D Plan homepage demo: opens the sample room AS the
 * scanned guest. One button — "Where am I seated?" — mounts the shipped guest
 * 3D explorer with `scene.you` set, whose avatar AUTO-WALKS from the entrance
 * to the seat (the tested steerPath pathfinding). "Watch again" remounts the
 * scene, replaying the walk. No camera, no consent — fictional guests only.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Footprints, Loader2, RotateCcw } from 'lucide-react';
import { plan3dDemoScene, type DemoGuest } from '@/app/_components/home/plan3d-demo-scene';

const GuestVenue3D = dynamic(() => import('@/app/[slug]/venue/_components/guest-venue-3d'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[72vh] items-center justify-center text-sm text-[var(--m-grey,#8c8884)]">
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={2} />
      <span className="ml-2">Setting the room…</span>
    </div>
  ),
});

const TABLE_LABEL: Record<string, string> = {
  head: 'the Head Table',
  t1: 'Table 1',
  t2: 'Table 2',
  t3: 'Table 3',
  t4: 'Table 4',
  t5: 'Table 5',
};

export function Plan3dWalk({ guest }: { guest: DemoGuest }) {
  const [walking, setWalking] = useState(false);
  // Remounting the scene replays the entrance-to-seat walk.
  const [runId, setRunId] = useState(0);

  if (!walking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--m-paper)] px-4 py-8 text-[var(--m-ink)]">
        <div className="w-full max-w-md rounded-2xl border border-[var(--m-line)] bg-white p-7 text-center shadow-sm">
          <Footprints aria-hidden className="mx-auto mt-2 h-7 w-7 text-[var(--m-mulberry)]" strokeWidth={1.75} />
          <h1 className="mt-3 text-xl font-semibold tracking-tight">
            You&rsquo;re {guest.name} tonight
          </h1>
          <p className="mt-2 text-sm text-[var(--m-grey,#8c8884)]">
            Welcome to Maria &amp; Jose&rsquo;s sample wedding — a live demo of
            the Setnayan 3D plan. Your seat is waiting at {TABLE_LABEL[guest.table] ?? guest.table}.
          </p>
          <button
            type="button"
            onClick={() => setWalking(true)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--m-mulberry)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <Footprints aria-hidden className="h-4 w-4" strokeWidth={2} />
            Where am I seated?
          </button>
          <p className="mt-3 text-[11px] text-[var(--m-grey,#8c8884)]">
            Every guest here is fictional — nothing about you is collected.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--m-paper)] px-3 py-4 text-[var(--m-ink)]">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between px-1 pb-2">
          <div>
            <h1 className="text-base font-semibold tracking-tight">{guest.name} → {TABLE_LABEL[guest.table] ?? guest.table}</h1>
            <p className="text-[11px] text-[var(--m-grey,#8c8884)]">Watch yourself walk in — then tap the floor to roam.</p>
          </div>
          <button
            type="button"
            onClick={() => setRunId((n) => n + 1)}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--m-line)] px-3 py-1.5 text-xs font-medium text-[var(--m-ink)] hover:bg-black/5"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Watch again
          </button>
        </div>
        <GuestVenue3D key={runId} scene={plan3dDemoScene(guest)} heightClass="h-[76vh]" />
        <p className="mt-3 text-center text-[11px] text-[var(--m-grey,#8c8884)]">
          This is the real Setnayan 3D plan — every wedding gets its own room, and every guest gets this walk.
        </p>
      </div>
    </main>
  );
}
