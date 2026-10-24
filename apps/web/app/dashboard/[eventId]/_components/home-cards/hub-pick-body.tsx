'use client';

/**
 * hub-pick-body.tsx — the "Pick what shows" sheet's body (owner 2026-10-25: *"pick what shows makes them choose
 * between Save the Date, Invitation, The Day, Post Event only"*, then, on the dropdown's screenshot: *"make it
 * choices. remove the guests see and place the choices there"*). ONE choice of four, drawn as FOUR CHOICE ROWS in the
 * sheet itself — single-select (`role="radio"`), the one guests see now marked ✓ "Now", each with its one-line ⓘ.
 *
 * ⚠ THIS SHEET IS A DELIBERATE EXCEPTION to the house rule "any set of choices is a dropdown"
 * (`lib/choices-are-one-dropdown.test.ts`) — on the owner's word of 2026-10-25. The rows are the whole sheet (a
 * dropdown inside a sheet that holds nothing else was one tap too many); they are pressable, so each has a frame and a
 * 44-px target. The parts of each page stay in the Maker.
 *
 * The write is the SHIPPED `setLaunchPhase` — the Maker's own "Which version guests see" door, host-gated, and LIVE
 * (the launch pin is deliberately not drafted: "who sees the page stays live"), so there is no Apply bar here. It
 * lands back on Home (`return_to`), which re-draws the tile. The shipped Maker offers every stage at any time, so no
 * stage is greyed here; what each one is lives in the sheet's ⓘ.
 */
import { useEffect, useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { setLaunchPhase } from '../../website/editor/actions';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import { LAUNCH_PHASE_CHOICES } from '../../website/editor/_components/launch-phase-choices';
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

  const pick = (key: LifecyclePhase) => {
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
    <div className="flex flex-col gap-2 pb-1 pt-3" data-home-hub-pick="">
      <div role="radiogroup" aria-label="Pick what shows" className="flex flex-col gap-2">
        {PUBLIC_STAGE_ORDER.map((s) => {
          const on = s === now;
          const hint = (LAUNCH_PHASE_CHOICES.find((c) => c.key === s)?.hint ?? '').replace(/\bcelebration\b/g, 'event');
          return (
            <div
              key={s}
              data-home-hub-stage={s}
              data-on={on ? '' : undefined}
              className={/* no-card-ok: a pressable choice row — the whole row is its radio button (owner 2026-10-25) */ `relative flex min-h-[52px] items-center gap-2 rounded-2xl border px-4 ${on ? 'border-mulberry bg-mulberry/[0.06]' : 'border-ink/15'}`}
            >
              {/* THE PRESS — the whole row (44 px and up); the ⓘ sits above it. */}
              <button
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={PUBLIC_STAGE_LABELS[s]}
                disabled={saving}
                onClick={() => pick(s)}
                className="absolute inset-0 min-h-11 rounded-2xl"
              />
              <span className="pointer-events-none relative min-w-0 flex-1 [&_button]:pointer-events-auto">
                <InfoTip label={PUBLIC_STAGE_LABELS[s]} labelClassName={`text-[15px] ${on ? 'font-semibold text-ink' : 'font-medium text-ink/85'}`} align="start">
                  {hint}
                </InfoTip>
              </span>
              {on ? (
                <span className="pointer-events-none relative flex items-center gap-1.5 text-[13px] font-semibold text-mulberry">
                  Now
                  <Check aria-hidden className="h-4 w-4" strokeWidth={2.2} />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {line ? (
        <p role="alert" className="text-[12.5px] font-semibold text-danger-700" data-home-hub-line="">
          {line}
        </p>
      ) : null}
    </div>
  );
}
