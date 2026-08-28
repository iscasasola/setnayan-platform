import { CalendarClock, Wallet } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { planLines, type PlanSituation } from '@/lib/vendor-plan-change-words';
import { cancelScheduledPlanChange } from '../actions';

/**
 * What a shop is told about a plan change, on the plan screen itself.
 *
 * Two facts, each in its own line, each shown only when it is true:
 *   • a scheduled change — what it becomes, and ON WHAT DATE
 *   • money they are holding — how much, and that it is spent for them
 *
 * Both sentences are built by `lib/vendor-plan-change-words.ts`, which is pure
 * and unit-tested — including a test that none of them uses a word out of the
 * plumbing. Nothing about the wording is decided in this file.
 *
 * ⚠ THE DATE IS `tierExpiresAt`, NOT A STORED EFFECTIVE DATE. There is no such
 * column, on purpose: a second copy of the date drifts the first time a shop
 * renews their current plan while a change is waiting, and the screen would
 * then promise a day the applier does not act on.
 *
 * The cancel control is here because a scheduled change with no way back traps
 * a shop in a decision made once. What they paid is not lost when they call it
 * off — it becomes money on their account, and the button says so.
 */
export function PlanChangeNotice({ situation }: { situation: PlanSituation }) {
  const lines = planLines(situation);
  if (!lines.change && !lines.credit) return null;

  return (
    <div className="mt-4 space-y-3">
      {lines.change ? (
        <div
          className="sn-card flex flex-wrap items-start gap-3 p-4 sm:flex-nowrap"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--m-paper)', border: '1px solid var(--m-line)' }}
          >
            <CalendarClock className="h-4 w-4 text-ink/70" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-sm text-ink">{lines.change}</p>
          <form action={cancelScheduledPlanChange} className="shrink-0">
            <SubmitButton className="text-sm font-medium text-ink underline underline-offset-4">
              Keep my current plan instead
            </SubmitButton>
          </form>
        </div>
      ) : null}

      {lines.credit ? (
        <div
          className="sn-card flex items-start gap-3 p-4"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--m-paper)', border: '1px solid var(--m-line)' }}
          >
            <Wallet className="h-4 w-4 text-ink/70" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-sm text-ink">{lines.credit}</p>
        </div>
      ) : null}
    </div>
  );
}
