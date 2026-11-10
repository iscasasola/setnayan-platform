'use client';

/**
 * THE PLAN SHEET — DOOR 1, going past a plan limit (Build 5 · Lane B; owner 10 Nov 2026: *"increasing allows them but we
 * ask if they want to upgrade to X Plan to allow this feature up to 5... see other features that will unlock"*;
 * DECISION_LOG 2026-11-09 "GOING PAST A PLAN LIMIT ASKS TO UPGRADE…").
 *
 * Pressing + past the plan's limit (bookings a day on a card · cards in a category · main categories · team seats ·
 * branches · reach) lets the number go up, then RISES this sheet (the shipped `RiseScreen`):
 *   "Upgrade to <the lowest plan that allows it> to take up to <its limit> <thing>"
 *   + "Also unlocks with <plan>" — the other differences, read from the plan table
 *   + two equal buttons: **Upgrade** (to the Plan sheet, that plan open) · **Keep <old number>**.
 * Until the plan is paid the setting SAVES AT THE CURRENT LIMIT (apply-then-pay; nothing given free) — the caller saves
 * `ask.savedAt`, never the number pressed.
 *
 * Every word is `limitAsk` (`lib/plan-sheet.ts`); nothing here holds a limit or a price. An unverified shop is offered
 * Get verified first (no paid plan opens before the papers, 2026-11-04). The store shell gets no Upgrade (`tier-gate.tsx`).
 * 🚫 Not for the shop's own "How many a day" — that has no plan limit (up to 50, owner 23 Oct).
 *
 * 🔒 app/_components/lock/every-lock-shows-problem-and-solution.test.ts · lib/plan-sheet.test.ts
 */
import { BadgeCheck, Sparkles, Undo2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { GET_VERIFIED_HREF } from '@/app/_components/lock/locked-feature';
import { planWord } from '@/lib/vendor-plan-change-words';
import type { LimitAsk } from '@/lib/plan-sheet';

/** Where Upgrade lands: the Plan, with the offered plan's row open. */
export function planSheetHref(plan: string): string {
  return `/vendor-dashboard/subscription#plan-sheet-${encodeURIComponent(plan)}`;
}

export function LimitSheet({
  ask,
  verified,
  price = null,
  storeShell = false,
  onKeep,
  onClose,
}: {
  ask: LimitAsk;
  verified: boolean;
  /** The offered plan's catalogue price, worded by the caller from the catalogue ("₱… / 28 days"); null = not shown. */
  price?: string | null;
  storeShell?: boolean;
  /** Keep the current number — the caller saves `ask.savedAt`. */
  onKeep: () => void;
  onClose: () => void;
}) {
  const plan = ask.plan;
  const needsPapers = plan !== null && (plan === 'verified' || !verified);
  const upgrade =
    plan === null ? null : needsPapers ? (
      <ActionButton tone="brand" main icon={BadgeCheck} label="Get verified" href={GET_VERIFIED_HREF} />
    ) : storeShell ? null : (
      <ActionButton tone="brand" main icon={Sparkles} label={`Upgrade to ${planWord(plan)}`} href={planSheetHref(plan)} />
    );
  const keep = <ActionButton tone="neutral" icon={Undo2} label={ask.keep} onClick={onKeep} />;
  return (
    <RiseScreen
      title={plan ? (needsPapers && plan !== 'verified' ? 'Get verified first' : `Upgrade to ${planWord(plan)}`) : 'At the most a plan takes'}
      line={ask.headline}
      onClose={onClose}
      data="limit-sheet"
      thumb={
        <div className={upgrade ? 'grid grid-cols-2 gap-2 [&>*]:w-full [&_a]:w-full [&_button]:w-full' : ''} data-limit-sheet-buttons="">
          {upgrade}
          {keep}
        </div>
      }
    >
      <div className="px-4 pt-4" data-limit-sheet="">
        <p className="text-[17px] font-semibold leading-snug text-ink" data-limit-headline="">
          {ask.headline}
        </p>
        {plan && needsPapers && plan !== 'verified' ? (
          <p className="pt-2 text-[14px] text-ink/70">
            {planWord(plan)} opens once Setnayan approves your shop. Your papers first, then the plan.
          </p>
        ) : null}
        {price && plan && !needsPapers && !storeShell ? (
          <p className="pt-2 text-[14px] text-ink/70" data-limit-price="">
            {planWord(plan)} · {price}
          </p>
        ) : null}
        {ask.alsoUnlocks.length > 0 && plan ? (
          <div className="pt-5">
            <p className="hc-k2">Also unlocks with {planWord(plan)}</p>
            <ul className="pt-2" data-limit-also="">
              {ask.alsoUnlocks.map((line) => (
                <li key={line} className="border-t border-ink/10 py-2 text-[14.5px] text-ink first:border-t-0">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="pt-5 text-[13px] text-ink/60" data-limit-saved="">
          Until then it stays at {ask.keep.replace(/^Keep /, '')}. Nothing is given free, and nothing is lost.
        </p>
      </div>
    </RiseScreen>
  );
}
