'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { formatPeso } from '@/lib/v2-catalog-pure';
import { formatCount } from '@/lib/format-number';
import { EVENT_TYPES, moneyWords, questionsFor, resultFor, stepsFor, type PlanPrices, type PlanState } from './_plan-steps';

/**
 * THE QUESTIONNAIRE (owner 2026-10-25; prototype `pricing_ours_only_2026-10-25/quiz.html`). One question per screen:
 * the event type (a set of choices → the house dropdown), the guest count (a slider 10–500 — the owner's explicit
 * exception to the dropdown rule), then one yes/no per screen in the thumb zone, a thin progress line and Back. The
 * result: what they said yes to with our prices (each read from the catalogue on the server), the "N of M included
 * with every event" highlight, the set-up switch, "Start your event", and "What Setnayan does for you" — against doing
 * it the old way, never against anyone else.
 *
 * Carrying the answers into the event creation is NOT built — "Start your event" opens the public type picker (/start).
 */

const PICK_FRAME = 'border border-ink/10';
const fmt = (n: number) => formatPeso(n);
const peso = (n: number) => `₱${formatPeso(n)}`;

export function PlanQuiz({ prices }: { prices: PlanPrices }) {
  const [s, setS] = useState<PlanState>({ type: 'A', count: 150, setup: true, answers: {} });
  const [i, setI] = useState(0);
  const qs = useMemo(() => questionsFor(s, prices, fmt), [s, prices]);
  const steps = stepsFor(s, qs);
  const key = steps[Math.min(i, steps.length - 1)]!;
  const n = steps.length;
  const prog = i / (n - 1);

  // Each screen starts at its top, as the prototype's render() does.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [i]);

  const back = () => setI((x) => Math.max(0, x - 1));
  const next = () => setI((x) => Math.min(n - 1, x + 1));
  const answer = (yes: boolean) => {
    setS((st) => ({ ...st, answers: { ...st.answers, [key]: yes } }));
    setI((x) => x + 1);
  };

  return (
    <div className="flex min-h-[calc(100dvh-140px)] flex-col pb-6 lg:min-h-[calc(100dvh-120px)] lg:max-w-[640px]" data-plan-step={key}>
      <div className="flex min-h-[44px] items-center justify-between pt-3">
        <button
          type="button"
          onClick={back}
          disabled={i === 0}
          className="min-h-[44px] bg-transparent p-0 text-[15px] text-ink/65 disabled:invisible"
        >
          ← Back
        </button>
        <Link href="/pricing" className="inline-flex min-h-[44px] items-center text-[15px] text-ink/65">
          Close
        </Link>
      </div>
      <div className="relative mt-2.5 h-px bg-ink/10" aria-hidden>
        <i className="absolute left-0 top-0 h-px bg-terracotta-700 transition-[width] duration-200" style={{ width: `${Math.round(prog * 100)}%` }} />
      </div>

      <div className="flex flex-1 flex-col">
        {key === 'type' ? (
          <>
            <p className="m-0 mt-[34px] font-mono text-[11px] uppercase leading-none tracking-[0.16em] text-ink/65">1 of {formatCount(n - 1)}</p>
            <h1 className="m-0 mt-[22px] font-pahina text-[36px] font-normal leading-[1.08] tracking-[-0.015em]">What are you planning?</h1>
            <p className="m-0 mt-3.5 max-w-[32ch] text-[16.5px] leading-normal text-ink/65">We price a few things by event type.</p>
            <div className="mt-9">
              <PickMenu
                label="Event type"
                value={s.type}
                options={EVENT_TYPES.map((t) => ({ key: t.band, label: t.label }))}
                onPick={(k) => setS((st) => ({ ...st, type: (EVENT_TYPES.find((t) => t.band === k)?.band ?? 'A') }))}
                dataAttr="data-plan-type"
                className={PICK_FRAME}
              />
            </div>
            <div className="mt-auto grid gap-3 pt-10">
              <button type="button" onClick={next} className="m-btn m-btn-primary min-h-[56px] w-full justify-center text-[17px] font-semibold">
                Continue
              </button>
            </div>
          </>
        ) : key === 'count' ? (
          <>
            <p className="m-0 mt-[34px] font-mono text-[11px] uppercase leading-none tracking-[0.16em] text-ink/65">2 of {formatCount(n - 1)}</p>
            <h1 className="m-0 mt-[22px] font-pahina text-[36px] font-normal leading-[1.08] tracking-[-0.015em]">How many guests?</h1>
            <p className="m-0 mt-3.5 max-w-[32ch] text-[16.5px] leading-normal text-ink/65">Roughly is fine. Nothing here has a guest limit.</p>
            <div className="mt-10 flex items-center gap-[18px]">
              <span className="min-w-[140px] shrink-0 font-pahina text-[44px] leading-none tabular-nums">
                {formatCount(s.count)}
                <small className="mt-1.5 block font-sans text-[13px] text-ink/65">guests</small>
              </span>
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={s.count}
                onChange={(e) => setS((st) => ({ ...st, count: Number(e.target.value) }))}
                aria-label="How many guests"
                className="h-11 min-w-0 flex-1 cursor-pointer accent-terracotta-700"
                data-plan-count=""
              />
            </div>
            <div className="mt-auto grid gap-3 pt-10">
              <button type="button" onClick={next} className="m-btn m-btn-primary min-h-[56px] w-full justify-center text-[17px] font-semibold">
                Continue
              </button>
            </div>
          </>
        ) : key === 'result' ? (
          <Result s={s} setS={setS} prices={prices} />
        ) : (
          (() => {
            const q = qs.find((x) => x.k === key);
            if (!q) return null;
            return (
              <>
                <p className="m-0 mt-[34px] font-mono text-[11px] uppercase leading-none tracking-[0.16em] text-ink/65">
                  {formatCount(i + 1)} of {formatCount(n - 1)}
                </p>
                <h1 className="m-0 mt-[22px] font-pahina text-[36px] font-normal leading-[1.08] tracking-[-0.015em]">{q.q}</h1>
                <div className="mt-3.5 max-w-[32ch] text-[16.5px] leading-normal text-ink/65">
                  <InfoTip label={q.line} align="start">
                    {q.tip}
                  </InfoTip>
                </div>
                <div className="mt-auto grid gap-3 pt-10">
                  <button
                    type="button"
                    onClick={() => answer(true)}
                    className="m-btn m-btn-primary min-h-[58px] w-full justify-center text-[17px] font-semibold"
                    data-plan-answer="yes"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => answer(false)}
                    className="min-h-[58px] w-full rounded-full border border-ink/10 bg-cream text-[17px] font-semibold text-ink"
                    data-plan-answer="no"
                  >
                    {q.no ?? 'Not needed'}
                  </button>
                </div>
              </>
            );
          })()
        )}
      </div>
    </div>
  );
}

function Result({
  s,
  setS,
  prices,
}: {
  s: PlanState;
  setS: (f: (st: PlanState) => PlanState) => void;
  prices: PlanPrices;
}) {
  const qs = questionsFor(s, prices, fmt);
  const r = resultFor(s, qs, prices);
  const any = r.yes.length > 0;
  const toolList = r.yes.filter((q) => q.tool).map((q) => q.item.toLowerCase()).join(', ');

  return (
    <>
      <p className="m-eyebrow mt-[34px]">Your Setnayan plan</p>
      <h1 className="m-0 mt-[22px] font-pahina text-[34px] font-normal leading-[1.08] tracking-[-0.015em]">
        {any ? 'Your event, built with Setnayan.' : 'Nothing picked yet.'}
      </h1>
      <p className="m-0 mt-3.5 max-w-[32ch] text-[16.5px] leading-normal text-ink/65">
        {any ? 'What you get — made with care, in one place.' : 'Go back and say yes to what your event needs.'}
      </p>
      {any ? (
        <>
          <ul className="m-0 mt-7 list-none p-0" data-plan-result="">
            {r.yes.map((q) => (
              <li key={q.k} className="flex min-h-[54px] items-baseline justify-between gap-3.5 border-t border-ink/5 py-3 first:border-t-0">
                <span className="flex items-baseline text-base font-medium leading-snug">
                  {q.php != null ? (
                    <i aria-hidden className="mr-1.5 align-[2px] text-[11px] not-italic text-terracotta-700">
                      ◆
                    </i>
                  ) : null}
                  <InfoTip label={q.item} align="start">
                    {q.tip}
                  </InfoTip>
                </span>
                <span className="whitespace-nowrap font-pahina text-[19px] tabular-nums text-terracotta-700">
                  {q.php != null ? peso(q.php) : 'Included'}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-baseline justify-between gap-3.5 border-t border-ink pt-5">
            <span className="text-base">
              Your event with Setnayan
              <small className="mt-0.5 block text-[13px] text-ink/65">for {formatCount(s.count)} guests</small>
            </span>
            <span className="font-pahina text-[36px] leading-none tabular-nums text-terracotta-700" data-plan-total="">
              {r.total > 0 ? peso(r.total) : 'Included'}
            </span>
          </div>
          {/* The included count, highlighted (owner: "why no highlight on the free"). */}
          <div className="mt-3.5 flex items-baseline gap-3 rounded-xl bg-terracotta/[0.08] px-4 py-3.5" data-plan-included="">
            <b className="font-pahina text-[30px] font-normal leading-none tracking-[-0.02em] text-terracotta-700">
              {formatCount(r.includedCount)} of {formatCount(r.yes.length)}
            </b>
            <span className="text-[15px]">included with every event</span>
          </div>
          {r.showSetupSwitch ? (
            <div className="mt-[22px] flex items-center gap-3.5 text-[15px] text-ink/65">
              <button
                type="button"
                role="switch"
                aria-checked={s.setup}
                aria-label="Buying while you set up your event"
                onClick={() => setS((st) => ({ ...st, setup: !st.setup }))}
                className="flex min-h-[44px] shrink-0 items-center bg-transparent p-0"
                data-plan-setup=""
              >
                <span
                  className={`relative block h-[26px] w-11 rounded-full border transition-colors ${s.setup ? 'border-terracotta-700 bg-terracotta-700' : 'border-ink/10 bg-cream'}`}
                >
                  <span
                    className={`absolute top-[3px] h-[18px] w-[18px] rounded-full transition-[left] ${s.setup ? 'left-[21px] bg-white' : 'left-[3px] bg-ink/60'}`}
                  />
                </span>
              </button>
              <InfoTip label="Buying while I set up my event" align="start">
                Event Hub Pro and Setnayan AI are cheaper while you are setting up your event. Switch off to see the regular prices.
              </InfoTip>
            </div>
          ) : null}
          <div className="mt-[30px] flex flex-wrap items-center gap-[18px]">
            <Link href="/start" className="m-btn m-btn-primary min-h-[52px] px-[26px] text-base font-semibold">
              Start your event
            </Link>
            <Link href="/pricing#prices" className="inline-flex min-h-[44px] items-center text-[15px] font-medium text-ink/65">
              What each one does
            </Link>
          </div>

          <div className="mt-12 border-t border-ink/10 pt-7" data-plan-does="">
            <h2 className="m-0 font-pahina text-[26px] font-normal leading-[1.12]">What Setnayan does for you</h2>
            <p className="m-0 mt-3.5 max-w-[32ch] text-[15px] leading-normal text-ink/65">
              Against doing it the old way — not against anyone else.
            </p>
            <ul className="m-0 mt-[18px] list-none p-0 text-[15.5px]">
              <li className="flex items-baseline justify-between gap-3.5 border-t border-ink/5 py-3 first:border-t-0">
                <InfoTip label="One place" align="start">
                  {`Each of these would be its own app, account or spreadsheet the old way: ${toolList}.`}
                </InfoTip>
                <b className="whitespace-nowrap font-pahina text-[19px] font-normal">
                  1 place instead of {r.tools} {r.tools === 1 ? 'tool' : 'tools'}
                </b>
              </li>
              {s.answers.together ? (
                <li className="flex items-baseline justify-between gap-3.5 border-t border-ink/5 py-3">
                  <InfoTip label="Everyone on one event" align="start">
                    Your co-hosts, your people and your group plan on the same event: one link for guests, one plan for hosts, one unlock for all of you.
                  </InfoTip>
                  <b className="whitespace-nowrap font-pahina text-[19px] font-normal">one link, one plan</b>
                </li>
              ) : null}
              {r.money.total > 0 ? (
                <li className="flex items-baseline justify-between gap-3.5 border-t border-ink/5 py-3" data-plan-money="">
                  <InfoTip label="Money kept" align="start">
                    {`Against printing it yourself, at Philippine shop prices, Oct 2026: ${moneyWords(r.money, fmt)}. Invitations are counted per household, about half the guest count. Nothing else is counted.`}
                  </InfoTip>
                  <b className="whitespace-nowrap font-pahina text-[19px] font-normal">{peso(r.money.total)}</b>
                </li>
              ) : null}
              {r.hoursBack != null ? (
                <li className="flex items-baseline justify-between gap-3.5 border-t border-ink/5 py-3" data-plan-hours="">
                  <InfoTip label="Time back" align="start">
                    {`About ${r.hoursBack} hours on the guest list alone — a UK survey of 2,000 married couples, 2019. Nothing else is counted; no other task has a sourced figure.`}
                  </InfoTip>
                  <b className="whitespace-nowrap font-pahina text-[19px] font-normal">about {r.hoursBack} hours</b>
                </li>
              ) : (
                <li className="flex items-baseline justify-between gap-3.5 border-t border-ink/5 py-3">
                  <InfoTip label="Time back" align="start">
                    One place for everything: the list, the replies, the seats, the door, the photos — nothing to copy between tools. No hours are claimed here; the only sourced figure is for the guest list.
                  </InfoTip>
                  <b className="whitespace-nowrap font-pahina text-[19px] font-normal">One place for everything</b>
                </li>
              )}
            </ul>
            <p className="m-0 mt-[22px] text-[13px] text-ink/65">Paid once, for this event and everyone on it. No subscription.</p>
          </div>
        </>
      ) : null}
    </>
  );
}
