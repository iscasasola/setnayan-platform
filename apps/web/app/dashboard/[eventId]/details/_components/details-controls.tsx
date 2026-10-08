'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { InfoTip } from '@/app/_components/info-tip';
import { Switch } from '@/app/_components/switch';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { REGION_OPTIONS } from '@/lib/match-criteria';
import { PLAN_MYSELF_LABEL } from '@/lib/plan-myself';
import { flipOptimistic } from '@/lib/optimistic-switch';
import { setPlanningMode, updateEventMatchCriteria, updatePaxSettings } from '../../actions';

/**
 * Event Details' own live controls — each saves AT ONCE through the action that
 * already owns its fact (owner 2026-10-07, "approve all": nothing here writes
 * the Event Hub draft, so there is no Undo · Apply). A pick shows on the tap;
 * a refusal puts the old value back and says why, in place.
 */

const FAILED_SAVE = 'We couldn’t save that just now. Try again.';

function Refusal({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="pt-1 text-[12.5px] text-terracotta-700">
      {text}
    </p>
  ) : null;
}

/** Area ⌄ — ONE dropdown over the canonical regions (`REGION_OPTIONS`); writes `region` alone. */
export function AreaPick({ eventId, value }: { eventId: string; value: string | null }) {
  const router = useRouter();
  const [shown, setShown] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const pick = (key: string) => {
    if (key === shown) return;
    const before = shown;
    setShown(key);
    setError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('only', 'region');
    fd.set('region', key);
    start(async () => {
      try {
        const res = await updateEventMatchCriteria(fd);
        if (!res.ok) {
          setShown(before);
          setError(res.message);
          return;
        }
        router.refresh();
      } catch (err) {
        console.error('[event-details] area save rejected', err);
        setShown(before);
        setError(FAILED_SAVE);
      }
    });
  };
  return (
    <div className="py-1.5" data-details-area-pick="">
      <PickMenu label="Area" value={shown} options={REGION_OPTIONS.map((o) => ({ key: o.value, label: o.label }))} onPick={pick} dataAttr="data-details-area" />
      <Refusal text={error} />
    </div>
  );
}

/** Costs shown ⌄ — Realtime / Final only; the stored reply-by date rides along unchanged (the action writes both). */
export function CostsPick({ eventId, mode, deadline }: { eventId: string; mode: 'realtime' | 'final_only'; deadline: string | null }) {
  const router = useRouter();
  const [shown, setShown] = useState(mode);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const pick = (key: string) => {
    const next = key === 'final_only' ? 'final_only' : 'realtime';
    if (next === shown) return;
    const before = shown;
    setShown(next);
    setError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('adaptive_pricing_mode', next);
    fd.set('guest_list_edit_deadline', deadline ?? '');
    start(async () => {
      try {
        const res = await updatePaxSettings(fd);
        if (!res.ok) {
          setShown(before);
          setError(res.message);
          return;
        }
        router.refresh();
      } catch (err) {
        console.error('[event-details] costs save rejected', err);
        setShown(before);
        setError(FAILED_SAVE);
      }
    });
  };
  return (
    <div className="py-1.5" data-details-costs-pick="">
      <PickMenu
        label="Costs shown"
        value={shown}
        options={[
          { key: 'realtime', label: 'Realtime', hint: 'Costs adapt as your count grows' },
          { key: 'final_only', label: 'Final only', hint: 'One adjustment, at the final count' },
        ]}
        onPick={pick}
        dataAttr="data-details-costs"
      />
      <Refusal text={error} />
    </div>
  );
}

/** Plan it myself — a switch row (`events.planning_mode`, the shipped `setPlanningMode`). */
export function PlanMyselfRow({ eventId, on }: { eventId: string; on: boolean | null }) {
  const router = useRouter();
  const [shown, setShown] = useState(on ?? false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const flip = (next: boolean) => {
    setError(null);
    start(async () => {
      const done = await flipOptimistic({
        next,
        show: setShown,
        save: async () => {
          const fd = new FormData();
          fd.set('event_id', eventId);
          fd.set('mode', next ? 'manual' : 'guided');
          await setPlanningMode(fd);
        },
        fail: setError,
      });
      if (done) router.refresh();
    });
  };
  return (
    <div className="border-t border-ink/10 py-2.5 first:border-t-0" data-details-row="plan-myself" data-plan-myself="">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <InfoTip
          label={PLAN_MYSELF_LABEL}
          labelClassName="text-[15px] font-medium text-ink"
          align="start"
          className="inline-flex min-w-0 items-center gap-1.5"
        >
          On: no supplier matching, deadlines or reminders from Setnayan. Free — off any time.
        </InfoTip>
        {on === null ? (
          <span className="text-[13px] text-ink/60">Couldn’t load</span>
        ) : (
          <Switch on={shown} onChange={flip} label={PLAN_MYSELF_LABEL} data="plan-myself" />
        )}
      </div>
      <Refusal text={error} />
    </div>
  );
}
