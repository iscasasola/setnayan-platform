'use client';

/**
 * hub-pick-body.tsx — the "Pick what shows" sheet's body (owner 2026-10-25: *"pick what shows makes them choose
 * between Save the Date, Invitation, The Day, Post Event only"*). ONE choice — the house `PickMenu` over the four
 * stages, the one guests see now marked "Now". The parts of each page stay in the Maker.
 *
 * The write is the SHIPPED `setLaunchPhase` — the Maker's own "Which version guests see" door, host-gated, and LIVE
 * (the launch pin is deliberately not drafted: "who sees the page stays live"), so there is no Apply bar here. It
 * lands back on Home (`return_to`), which re-draws the tile. The shipped Maker offers every stage at any time, so no
 * stage is greyed here; what each one is lives in the sheet's ⓘ.
 */
import { useEffect, useState, useTransition } from 'react';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { setLaunchPhase } from '../../website/editor/actions';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { readHomeHubPick } from './hub-pick-actions';
import type { HomeHubPickRead } from './hub-pick-types';

export default function HubPickBody({ eventId, preset = null }: { eventId: string; preset?: HomeHubPickRead | null }) {
  const [read, setRead] = useState<HomeHubPickRead | null>(preset);
  const [chosen, setChosen] = useState<LifecyclePhase | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [saving, start] = useTransition();
  useEffect(() => {
    if (read) return;
    let live = true;
    readHomeHubPick(eventId)
      .then((r) => {
        if (live) setRead(r);
      })
      .catch(() => {
        if (live) setRead({ ok: false, reason: 'unread' });
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the sheet opens
  }, []);

  if (!read) {
    return (
      <p className="sg-step" aria-live="polite">
        Loading…
      </p>
    );
  }
  if (!read.ok) {
    return (
      <p role="status" className="py-3 text-[13px] text-ink/65" data-home-hub-pick-refused={read.reason}>
        {read.reason === 'not_host'
          ? 'Only the hosts can change what your Event Hub shows.'
          : 'What your Event Hub shows couldn’t load. Open the Maker to change it.'}
      </p>
    );
  }
  /* What guests see now: the pin, else the date. */
  const now = chosen ?? read.pinned ?? read.byDate;

  const pick = (key: string) => {
    const next = PUBLIC_STAGE_ORDER.find((s) => s === key);
    if (!next || next === now || saving) return;
    const before = chosen;
    setChosen(next);
    setLine(null);
    start(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('launch_phase', next);
      fd.set('return_to', `${window.location.pathname}${window.location.search}`);
      try {
        await setLaunchPhase(fd);
      } catch (e) {
        /* A redirect is how the shipped action says "done" — it is not a failure. */
        if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) throw e;
        setChosen(before);
        setLine('That did not save, so it is back as it was. Please try again.');
      }
    });
  };

  return (
    <div className="flex flex-col gap-2 py-2" data-home-hub-pick="">
      <div className="flex items-center gap-3 py-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium">Guests see</span>
        </span>
        <PickMenu
          label="Guests see"
          value={now ?? ''}
          options={PUBLIC_STAGE_ORDER.map((s) => ({
            key: s,
            label: PUBLIC_STAGE_LABELS[s],
            ...(s === now ? { trail: { text: 'Now', tone: 'ok' as const } } : {}),
          }))}
          onPick={pick}
          dataAttr="data-home-hub-stage"
        />
      </div>
      {line ? (
        <p role="alert" className="text-[12.5px] font-semibold text-danger-700" data-home-hub-line="">
          {line}
        </p>
      ) : null}
    </div>
  );
}
