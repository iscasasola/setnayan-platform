'use client';

import { ArrowLeft, ArrowRight, Check, Info, LockOpen } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { Sheet } from '@/app/_components/sheet';
import { whatEachPlanHolds, type planSplit } from '@/lib/open-shop-more-services';

/** The refusal under the box (the prototype's `plan-continue` sentence). */
export const PLAN_AGREE_ERROR = 'Tick the box to continue.';

/** The prototype v19 lead — the owner's own words (7 Nov: "Your first booking is free so you can experience our app"). */
export const PLAN_LEAD = 'Your first booking is free, so you can experience Setnayan.';

/**
 * ② "BEFORE YOU CONTINUE" — THE PLAN EXPLAINER, OPENED BY CONTINUE (prototype v16 → v19 `planSheetBody`). Shown only when
 * the picks are more than Free holds and the box is not ticked yet: a bottom sheet on a phone (the shipped `Sheet`), the
 * right-hand pane when wide (`PlanPane`, the confirm card's place).
 *
 * v19 (owner 7 Nov: *"a better explanation and simpler to show what is deemed free, and the others will be part of
 * pro"*): a third of its length. One lead line, then THEIR picks in two columns — what stays Free (the main service)
 * and the plan that holds the rest (`planSplit`, named from TIER_CAPS — usually Pro). The four-plan ladder moved into
 * the title's ⓘ. No peso on this screen, no number typed here, no payment now.
 */
function PlanBody({
  agreed,
  onAgree,
  error,
  onContinue,
  onBack,
  headingId,
  main,
  rest,
  split,
  backLabel = 'Back to my services',
  inSheet = false,
}: PlanProps & { headingId: string; inSheet?: boolean }) {
  const tip = whatEachPlanHolds();
  return (
    <div className="grid gap-3" data-open-shop-plan-sheet="">
      {/* In the sheet, the first line keeps clear of its ✕. */}
      <h2 id={headingId} className={`flex items-center gap-1 text-sm font-medium ${inSheet ? 'pr-10' : ''}`} style={{ color: 'var(--m-ink)' }}>
        <InfoTip label="Before you continue" labelClassName="text-sm font-medium" ariaLabel={tip.title} align="start">
          <span className="block space-y-1">
            <b className="block">{tip.title}</b>
            {tip.ladder.map((r) => (
              <span key={r.name} className="block">
                <b>{r.name}</b> · {r.caps}
              </span>
            ))}
            <span className="block">{tip.listing}</span>
            <span className="block">{tip.after}</span>
            <b className="block">{tip.firstBooking}</b>
            <span className="block">{tip.fine}</span>
          </span>
        </InfoTip>
      </h2>
      <p className={`flex items-start gap-1.5 text-[13.5px] ${inSheet ? 'pr-10' : ''}`} style={{ color: 'var(--m-slate)' }}>
        <LockOpen aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <span>{PLAN_LEAD}</span>
      </p>
      {/* THEIR picks, in two columns (prototype v19 `.split`): Free keeps the main; the plan that holds the rest. */}
      <div className="grid grid-cols-2 gap-2.5" data-open-shop-plan-split="">
        <div
          className="grid min-w-0 content-start gap-1 rounded-xl border px-3 py-2.5 text-[13.5px]" // no-card-ok: the owner-approved v19 two-column split (prototype `.split`, 7 Nov) — Free · the plan that holds the rest
          style={{ borderColor: 'rgb(var(--color-ok))', color: 'var(--m-slate)' }}
          data-open-shop-plan-free=""
        >
          <b className="text-[15px] font-semibold" style={{ color: 'rgb(var(--color-ok))' }}>
            {split.free.name}
          </b>
          <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {split.free.caps}
          </span>
          <span className="[overflow-wrap:anywhere]" style={{ color: 'var(--m-ink)' }}>
            {main}
          </span>
        </div>
        <div
          className="grid min-w-0 content-start gap-1 rounded-xl border px-3 py-2.5 text-[13.5px]" // no-card-ok: the owner-approved v19 two-column split (prototype `.split`, 7 Nov) — Free · the plan that holds the rest
          style={{ borderColor: 'var(--m-orange-3)', background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
          data-open-shop-plan-held=""
        >
          <b className="text-[15px] font-semibold">{split.held.name}</b>
          <span className="text-xs">
            {split.held.caps}
            {split.held.choose ? ' — you choose which' : ''}
          </span>
          <span className="grid gap-0.5">
            {rest.map((x) => (
              <span key={x} className="[overflow-wrap:anywhere]">
                {x}
              </span>
            ))}
          </span>
        </div>
      </div>
      <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
        All of it stays on until that booking is done. Then {main} stays free; {split.held.name} keeps the rest.
      </p>
      <button
        type="button"
        role="checkbox"
        aria-checked={agreed}
        onClick={() => onAgree(!agreed)}
        className="flex min-h-11 items-center gap-2 text-left text-[13.5px]"
        style={{ color: 'var(--m-ink)' }}
        aria-describedby={error ? 'open-shop-err-plan' : undefined}
        data-open-shop-plan-agree=""
      >
        <span
          aria-hidden
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border"
          style={{
            borderColor: agreed ? 'var(--m-mulberry)' : 'var(--m-slate-3)',
            background: agreed ? 'var(--m-mulberry)' : 'var(--m-paper)',
            color: 'var(--m-paper)',
          }}
        >
          {agreed ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
        </span>
        <span>I understand how this works.</span>
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
        <ArrowRight className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </button>
      {/* BUTTON_RULE (v18): an action is a pill, grey for going back. */}
      <span className="flex justify-center">
        <ActionButton tone="neutral" icon={ArrowLeft} label={backLabel} onClick={onBack} />
      </span>
    </div>
  );
}

type PlanProps = {
  agreed: boolean;
  onAgree: (agreed: boolean) => void;
  error: string | null;
  onContinue: () => void;
  onBack: () => void;
  /** The main service's name — what stays Free. */
  main: string;
  /** Every other picked service's name — what the plan holds. */
  rest: string[];
  /** `planSplit(...)` — both columns' names and caps, read from TIER_CAPS. */
  split: ReturnType<typeof planSplit>;
  /** The grey pill under Continue — the sign-up's own words by default. */
  backLabel?: string;
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
      // Space and type, not a box (DESIGN-FOUNDATION): the right column is already its own place.
      className="os-in-r sticky top-5 py-1"
      role="dialog"
      aria-labelledby="open-shop-plan-pane-title"
    >
      <PlanBody {...p} headingId="open-shop-plan-pane-title" />
    </div>
  );
}

/**
 * 🔗 THE CLAIM DOOR'S "WHICH PLAN FITS" SLIDE (owner 2026-11-07, DECISION_LOG "THE CLAIM (QR IMPORT) DOOR SAYS WHICH
 * PLAN THEIR SERVICES FIT": *"the same 'Before you continue' sheet as sign-up v16"*) — the SAME body, drawn in the page
 * as its own slide rather than over it. Counts and caps from TIER_CAPS through `planSplit`, never typed.
 */
export function PlanInline(p: PlanProps) {
  return (
    <div className="os-in-r max-w-[620px] py-1" data-claim-door-plan="">
      <PlanBody {...p} headingId="claim-door-plan-title" />
    </div>
  );
}
