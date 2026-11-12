'use client';

/**
 * THE LIMITS SHEET — moving DOWN a plan (ruling 5683, supplier downgrade). The scheduled change itself is shipped
 * (b826b24b5, "moving down waits for the term already paid for"); this is what the supplier sees before it:
 *
 *   · inside a lower plan's row (`PlanSheet`): "What doesn't fit <plan>" — one row per limit, each with its Fix, which
 *     goes to the page that fixes that limit;
 *   · on "Switch to <plan>": this list RISES (the shipped `RiseScreen`, the sibling of `lock/limit-sheet.tsx`) with the
 *     switch in the thumb. A STORAGE FLOOR row holds the switch shut until some is removed; nothing else does — services
 *     go on hold when the plan starts (you pick which), seats and branches are kept.
 *   · the Verified badge row is good news: it keeps its own day, whatever the plan.
 *
 * Every word and number is `downgradeFit` (`lib/downgrade-limits.ts`); nothing here holds a limit.
 * 🔒 lib/downgrade-limits.test.ts · app/vendor-dashboard/subscription/the-plan-is-rows.test.ts
 */
import { useState, type ReactNode } from 'react';
import { ArrowRight, BadgeCheck, CircleAlert, Wallet } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { planWord } from '@/lib/vendor-plan-change-words';
import type { DowngradeFit, FitRow } from '@/lib/downgrade-limits';

function FitLine({ r }: { r: FitRow }) {
  const Icon = r.state === 'keeps' ? BadgeCheck : CircleAlert;
  const tint = r.state === 'keeps' ? 'text-success' : r.state === 'blocks' ? 'text-danger' : 'text-ink/55';
  return (
    <div className="flex min-h-11 items-start gap-3 border-t border-ink/10 py-2 first:border-t-0" data-fit-row={r.key} data-fit-state={r.state}>
      <Icon aria-hidden className={`mt-0.5 h-[18px] w-[18px] flex-none ${tint}`} strokeWidth={1.9} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-medium text-ink">{r.title}</span>
        <span className="block text-[12.5px] leading-snug text-ink/70">{r.line}</span>
        {r.fix ? (
          <span className="block pt-1.5">
            <ActionButton tone={r.state === 'blocks' ? 'brand' : 'neutral'} quiet icon={ArrowRight} label={r.fix.label} href={r.fix.href} />
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** "What doesn't fit <plan>" — drawn in a lower plan's row. */
export function LimitsList({ fit }: { fit: DowngradeFit }) {
  const name = planWord(fit.plan);
  const misfits = fit.rows.filter((r) => r.state !== 'keeps');
  return (
    <div className="pt-3" data-limits-list={fit.plan}>
      <p className="hc-k2">{misfits.length > 0 ? `What doesn’t fit ${name}` : `Everything you have fits ${name}`}</p>
      {fit.rows.length > 0 ? (
        <div className="pt-1">
          {[...fit.rows.filter((r) => r.state === 'blocks'), ...fit.rows.filter((r) => r.state !== 'blocks')].map((r) => (
            <FitLine key={r.key} r={r} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The switch to a lower plan. When something does not fit, the button first RISES the limits sheet; the real form
 * (`switchForm`, the shipped Pay form) sits in its thumb, shut while a floor row stands.
 */
export function LowerPlanSwitch({ fit, switchForm, endsOn }: { fit: DowngradeFit; switchForm: ReactNode; endsOn: string | null }) {
  const [open, setOpen] = useState(false);
  const name = planWord(fit.plan);
  if (fit.fits) return <>{switchForm}</>;
  return (
    <>
      <ActionButton tone="brand" main icon={Wallet} label={`Switch to ${name}`} onClick={() => setOpen(true)} />
      {open ? (
        <RiseScreen
          title={`Before you switch to ${name}`}
          line={endsOn ? `${name} starts on ${endsOn}, when your paid days end.` : `${name} starts when your paid days end.`}
          onClose={() => setOpen(false)}
          data="limits-sheet"
          thumb={
            fit.blocked ? (
              <p className="text-center text-[13px] text-ink/70" data-limits-blocked="">
                Fix the storage line first — then you can switch.
              </p>
            ) : (
              <div className="[&_button]:w-full [&_form]:w-full" data-limits-switch="">
                {switchForm}
              </div>
            )
          }
        >
          <div className="px-4 pt-4" data-limits-sheet="">
            <p className="text-[17px] font-semibold leading-snug text-ink">
              {fit.blocked ? `${name} holds less than you have` : `A few things change on ${name}`}
            </p>
            <p className="pt-2 text-[14px] text-ink/70">Each line opens the page that fixes it. Nothing is deleted by the switch.</p>
            <LimitsList fit={fit} />
          </div>
        </RiseScreen>
      ) : null}
    </>
  );
}
