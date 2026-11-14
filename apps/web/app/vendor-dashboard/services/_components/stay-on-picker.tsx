'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Check, RotateCcw } from 'lucide-react';

import { ActionButton, actionButtonClass } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SubmitButton } from '@/app/_components/submit-button';
import { StayForm } from '@/app/_components/stay-form';
import {
  HOLD_WORDS,
  capsOf,
  defaultKeep,
  meterWords,
  planHoldsWords,
  toggleKeep,
  type PickMode,
  type PlanCard,
} from '@/lib/service-plan-hold';
import { TIER_LABEL, type VendorTier } from '@/lib/vendor-tier-caps';

/**
 * "WHICH SERVICES STAY ON" — the plan picker with swap (owner 2026-11-06, DECISION_LOG "… THE AFTER-FIRST-BOOKING
 * CHOICE IS A PLAN PICKER WITH SWAP"). One plan dropdown (house rule: any set of choices is a dropdown); under it
 * every service with what it does on that plan; a tap on a service swaps it on or off, refused when over the plan;
 * then one button that says what happens and when.
 *
 * Every rule is `lib/service-plan-hold.ts` — the same fit the server action re-checks before it writes, so this
 * screen can never promise a pick the server refuses. Numbers come from `TIER_CAPS`, never typed.
 */

export type StayOnPlan = { tier: VendorTier; mode: PickMode };

export function StayOnPicker({
  cards,
  plans,
  startPlan,
  founder,
  owner,
  nowWaits,
  action,
}: {
  cards: PlanCard[];
  /** The ladder (`ladderFor`), each with when its pick takes effect (`pickModeFor`). */
  plans: StayOnPlan[];
  startPlan: VendorTier;
  founder: boolean;
  /** Only the shop's owner picks (a plan decision is a money decision). */
  owner: boolean;
  /** Free / Verified before the first booking: a pick for the plan they are on waits (everything stays on). */
  nowWaits: boolean;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const preferred = useMemo(() => cards.filter((c) => c.hold === null).map((c) => c.id), [cards]);
  const [plan, setPlan] = useState<VendorTier>(startPlan);
  const caps = capsOf(plan, founder);
  const [keep, setKeep] = useState<string[]>(() => defaultKeep(cards, capsOf(startPlan, founder), preferred));
  const [refused, setRefused] = useState<string | null>(null);
  const mode = plans.find((p) => p.tier === plan)?.mode ?? 'now';
  const canPick = owner && !(mode === 'now' && nowWaits);
  const waitNote = !owner ? 'Only the shop owner picks which services stay on.' : mode === 'now' && nowWaits ? HOLD_WORDS.beforeFirstBooking : null;

  const pickPlan = (key: string) => {
    const t = plans.find((p) => p.tier === key)?.tier;
    if (!t) return;
    setPlan(t);
    setRefused(null);
    setKeep((prev) => defaultKeep(cards, capsOf(t, founder), [...prev, ...preferred]));
  };
  const tap = (id: string) => {
    const r = toggleKeep(keep, id, cards, caps, plan);
    setKeep(r.keep);
    setRefused(r.refused);
  };
  const kept = cards.filter((c) => keep.includes(c.id));
  const offWord = mode === 'now' ? HOLD_WORDS.tag : `On hold from ${TIER_LABEL[plan]}`;
  const button =
    mode === 'upgrade'
      ? { label: `Pick ${TIER_LABEL[plan]} with these`, tone: 'brand' as const, icon: <ArrowRight aria-hidden strokeWidth={1.9} /> }
      : mode === 'at_plan_change'
        ? { label: `Keep these when ${TIER_LABEL[plan]} starts`, tone: 'ok' as const, icon: <Check aria-hidden strokeWidth={1.9} /> }
        : { label: 'Keep these on', tone: 'ok' as const, icon: <Check aria-hidden strokeWidth={1.9} /> };

  return (
    <section id="stay-on" aria-labelledby="stay-on-title" className="scroll-mt-24 space-y-3" data-stay-on="">
      <InfoTip label={HOLD_WORDS.door} labelAs="h3" labelId="stay-on-title" labelClassName="text-base font-semibold text-ink" align="start">
        {HOLD_WORDS.tip}
      </InfoTip>

      <PickMenu
        label="Plan"
        value={plan}
        options={plans.map((p) => ({ key: p.tier, label: `${TIER_LABEL[p.tier]} — ${planHoldsWords(p.tier)}` }))}
        onPick={pickPlan}
        dataAttr="data-stay-on-plan"
        className="!min-h-11 w-full"
      />

      <p className="text-[13px] text-[color:var(--m-slate-2)]" data-stay-on-meter="">
        {meterWords(kept, plan)}
      </p>

      <ul className="divide-y divide-ink/10 border-y border-ink/10">
        {cards.map((c) => {
          const on = keep.includes(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => tap(c.id)}
                aria-pressed={on}
                data-stay-on-row={on ? 'on' : 'held'}
                className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.name}</span>
                <span
                  className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-[12px] font-medium ${
                    on ? 'bg-[rgb(var(--color-ok)/0.08)] text-[rgb(var(--color-ok))]' : 'bg-ink/5 text-[color:var(--m-slate-2)]'
                  }`}
                >
                  {on ? 'Stays on' : offWord}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {refused ? (
        <p role="status" className="text-[13px] text-[rgb(var(--color-warn))]" data-stay-on-refused="">
          {refused}
        </p>
      ) : null}

      {/* Saves in place through the door (`pickServicesThatStayOn`); `action` stays the no-JavaScript path. Picking an
          UPGRADE still goes to the Plan page, where it is paid. */}
      <StayForm door="svServices.pickServicesThatStayOn" action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="plan" value={plan} />
        {keep.map((id) => (
          <input key={id} type="hidden" name="keep" value={id} />
        ))}
        {canPick ? (
          <SubmitButton className={actionButtonClass(button.tone, { main: true, extra: '!h-11 !min-h-11' })} pendingLabel="Saving…" aria-label={button.label} title={button.label}>
            {button.icon}
            <span className="lbl">{button.label}</span>
          </SubmitButton>
        ) : (
          <ActionButton tone={button.tone} main waiting icon={button.icon} label={button.label} className="!h-11 !min-h-11" />
        )}
        <ActionButton
          tone="neutral"
          icon={RotateCcw}
          label="Cancel"
          className="!h-11 !min-h-11"
          onClick={() => {
            setPlan(startPlan);
            setRefused(null);
            setKeep(defaultKeep(cards, capsOf(startPlan, founder), preferred));
          }}
        />
      </StayForm>
      {waitNote ? <p className="text-[12px] text-[color:var(--m-slate-2)]">{waitNote}</p> : null}
    </section>
  );
}
