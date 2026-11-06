'use client';

import { Check, Info, LockOpen } from 'lucide-react';

import { InfoTip } from '@/app/_components/info-tip';
import { Sheet } from '@/app/_components/sheet';
import { FIRST_BOOKING_FREE_LABEL, whatEachPlanHolds } from '@/lib/open-shop-more-services';

/** The refusal under the box (the prototype's `plan-continue` sentence). */
export const PLAN_AGREE_ERROR = 'Tick the box to continue.';

/**
 * ② "BEFORE YOU CONTINUE" — THE PLAN EXPLAINER, OPENED BY CONTINUE (prototype v16 `planSheetBody`; owner 6 Nov:
 * *"when do we explain? … and they agree"*, then v16: inline it sat below the fold, so it moved where it cannot be
 * missed). Shown only when the picks are more than Free holds and the box is not ticked yet: a bottom sheet on a phone
 * (the shipped `Sheet`), the right-hand pane when wide (`PlanPane`, the confirm card's place).
 *
 * The ladder is `planLadder()` — every number read from `TIER_CAPS`. No peso on this screen, no payment now.
 */
function PlanBody({
  agreed,
  onAgree,
  error,
  onContinue,
  onBack,
  headingId,
  inSheet = false,
}: {
  inSheet?: boolean;
  agreed: boolean;
  onAgree: (agreed: boolean) => void;
  error: string | null;
  onContinue: () => void;
  onBack: () => void;
  headingId: string;
}) {
  const tip = whatEachPlanHolds();
  return (
    <div className="grid gap-2.5" data-open-shop-plan-sheet="">
      {/* In the sheet, the first two lines keep clear of its ✕. */}
      <h2 id={headingId} className={`flex items-center gap-1 text-sm font-medium ${inSheet ? 'pr-10' : ''}`} style={{ color: 'var(--m-ink)' }}>
        <InfoTip label="Before you continue" labelClassName="text-sm font-medium" ariaLabel="What each plan adds" align="start">
          <span className="block space-y-1">
            <span className="block">{tip.after}</span>
            <span className="block">{tip.fine}</span>
          </span>
        </InfoTip>
      </h2>
      <p className={`flex items-start gap-1.5 text-[13.5px] ${inSheet ? 'pr-10' : ''}`} style={{ color: 'var(--m-slate)' }}>
        <LockOpen aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>{FIRST_BOOKING_FREE_LABEL} — everything you picked stays on until that booking is done.</span>
      </p>
      <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
        You hold more than Free does. Here is what each plan adds — no payment now.
      </p>
      <div className="grid gap-1.5" data-open-shop-plan-ladder="">
        {tip.ladder.map((r, i) => (
          <div
            key={r.name}
            className={`grid gap-0.5 py-1.5 text-[13px] ${i ? 'border-t' : ''}`}
            style={{ color: 'var(--m-slate)', borderColor: 'var(--m-line)' }}
          >
            <b className="font-semibold" style={{ color: 'var(--m-ink)' }}>
              {r.name}
            </b>
            <span>{r.caps}</span>
          </div>
        ))}
      </div>
      {/* The sheet's own words (prototype v16 `planSheetBody`) — the ⓘ under the meter phrases it its own way. */}
      <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
        Each service is its own listing in its category — more services, more of couples’ searches you appear in. Reach is
        how far from you couples search.
      </p>
      <button
        type="button"
        role="checkbox"
        aria-checked={agreed}
        onClick={() => onAgree(!agreed)}
        className="flex items-start gap-2 text-left text-[13.5px]"
        style={{ color: 'var(--m-ink)' }}
        aria-describedby={error ? 'open-shop-err-plan' : undefined}
        data-open-shop-plan-agree=""
      >
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border"
          style={{
            borderColor: agreed ? 'var(--m-mulberry)' : 'var(--m-slate-3)',
            background: agreed ? 'var(--m-mulberry)' : 'var(--m-paper)',
            color: 'var(--m-paper)',
          }}
        >
          {agreed ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
        </span>
        <span>
          I understand: my first booking is free once I’m verified, and everything I picked stays on until it is done.
          After it I keep one service free, or pick the plan that holds the rest.
        </span>
      </button>
      {error ? (
        <span
          id="open-shop-err-plan"
          className="flex items-start gap-1.5 text-xs"
          style={{ color: 'var(--m-mulberry-deep)' }}
          role="alert"
          data-open-shop-field-error="plan"
        >
          <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </span>
      ) : null}
      <button
        type="button"
        onClick={onContinue}
        className="button-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm"
        data-open-shop-plan-continue=""
      >
        Continue
      </button>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-9 items-center justify-center text-[13px] font-medium text-terracotta"
      >
        Back to my services
      </button>
    </div>
  );
}

type PlanProps = {
  agreed: boolean;
  onAgree: (agreed: boolean) => void;
  error: string | null;
  onContinue: () => void;
  onBack: () => void;
};

/** On a phone: the shipped bottom `Sheet`. */
export function PlanSheet({ open, ...p }: PlanProps & { open: boolean }) {
  return (
    <Sheet open={open} onClose={p.onBack} labelledById="open-shop-plan-title">
      <div className="px-4 pb-4 pt-2">
        <PlanBody {...p} headingId="open-shop-plan-title" inSheet />
      </div>
    </Sheet>
  );
}

/** When wide: the right-hand pane, where "Your shop at a glance" sat (the third pane). */
export function PlanPane(p: PlanProps) {
  return (
    <div
      className="sticky top-5 rounded-2xl border p-[18px]"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
      role="dialog"
      aria-labelledby="open-shop-plan-pane-title"
    >
      <PlanBody {...p} headingId="open-shop-plan-pane-title" />
    </div>
  );
}
