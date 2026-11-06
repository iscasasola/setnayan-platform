'use client';

import { useEffect, useId, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { ActionButton, type ActionTone } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { papicBuySizes } from '../actions';
import { PapicBuyForm } from './papic-buy-form';
import { ladderEnds } from './credit-stepper';
import type { PoolRung } from '@/lib/papic-pool-rungs';

const ERROR_COPY: Record<string, string> = {
  unknown_rung: 'That option is no longer available. Pick one of the sizes.',
  unavailable: 'That option is not on sale right now. Try another size.',
  order_failed: "We couldn't start that order, so nothing was charged. Please try again.",
  event_over: 'Your day is over — credits can no longer be added.',
};

/**
 * 🎨 "BUY MORE" — the sheet (owner "approve all", 2026-10-14, prototype
 * `renderBuySheet`; made simpler 2026-10-24, owner: *"it should just ask how much
 * they want to add more and purchase. no need for not now because there is (X) on
 * upper right"*): "Add credits" with its ⓘ and the sheet's own ✕ · "You have N
 * credits" · the shipped − / + stepper · "New total: N credits" · ONE button,
 * "Add N credits · ₱X" → /pay. The range of sizes lives in the ⓘ. The same sheet
 * on Home's row, on Home's Next card and on the Papic page's band.
 *
 * 🔌 THE LADDER IS READ ON THE TAP, NOT ON THE VIEW (`papicBuySizes`): Home is
 * the most-opened screen and production is on the free database plan, so the
 * two catalog reads happen only when somebody asks to buy.
 *
 * 🔘 The press shows pressed at once; the sheet opens and says its one step
 * ("Loading sizes…") until the sizes are in. Portalled to <body>: the dashboard's
 * page-enter transform would otherwise pin a fixed sheet to the page, not the
 * screen.
 */
export function PapicBuySheet({
  eventId,
  left,
  tone = 'brand',
  main = false,
  label = 'Buy more',
  defaultOpen = false,
  error = null,
  sizes = null,
}: {
  eventId: string;
  /** Credits left now — for the sheet's sentence and "After this". */
  left: number | null;
  tone?: ActionTone;
  main?: boolean;
  label?: string;
  /** Open on arrival — a purchase error to read, or "?buy=1". */
  defaultOpen?: boolean;
  /** A `papic_pool_error` the purchase redirected back with. */
  error?: string | null;
  /** The ladder, when the caller already holds it (the dev lab) — else read on the tap. */
  sizes?: PoolRung[] | null;
}) {
  const headingId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [rungs, setRungs] = useState<PoolRung[] | null>(sizes);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = () => {
    if (rungs || pending) return;
    setRefusal(null);
    start(async () => {
      try {
        const r = await papicBuySizes(eventId);
        if (r.ok) setRungs(r.rungs);
        else
          setRefusal(
            r.reason === 'not_couple'
              ? 'Only the couple can add credits.'
              : r.reason === 'over'
                ? ERROR_COPY.event_over!
                : 'Credits are not on sale right now.',
          );
      } catch {
        setRefusal('We couldn’t load the sizes. Try again.');
      }
    });
  };
  // Opened on arrival (an error to read, "?buy=1"): the sizes load once, then.
  useEffect(() => {
    if (defaultOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  const sheet = open ? (
    <Sheet open onClose={() => setOpen(false)} labelledById={headingId} rise>
      <div className="px-4 pb-4 pt-3.5" data-papic-buy-sheet="">
        {/* The title and its ONE ⓘ; the sheet's own ✕ closes it (no "Not now" — owner 2026-10-24). */}
        <InfoTip
          label="Add credits"
          labelAs="h3"
          labelId={headingId}
          labelClassName="text-[19px] font-semibold tracking-tight text-ink"
          align="start"
        >
          One credit is one camera photo; a short clip uses a little more.
          {rungs && ladderEnds(rungs) ? ` ${ladderEnds(rungs)} — add more any time.` : ' Add more any time.'}
        </InfoTip>
        <p className="mb-3.5 text-sm text-ink/60" data-papic-buy-have="">
          {left === 0
            ? 'Your cameras restart the moment this is paid.'
            : left !== null
              ? `You have ${left.toLocaleString('en-PH')} credits`
              : 'Credits land once your payment is confirmed.'}
        </p>
        {error ? (
          <p className="mb-3 text-sm font-medium" role="alert" style={{ color: 'rgb(var(--color-danger))' }}>
            {ERROR_COPY[error] ?? 'Something went wrong, and nothing was charged. Please try again.'}
          </p>
        ) : null}
        {rungs ? (
          <PapicBuyForm eventId={eventId} rungs={rungs} left={left} />
        ) : refusal ? (
          <p className="text-sm" role="alert" style={{ color: 'rgb(var(--color-danger))' }}>
            {refusal}
          </p>
        ) : (
          <p className="sg-step" aria-live="polite">
            Loading sizes…
          </p>
        )}
      </div>
    </Sheet>
  ) : null;

  return (
    <>
      <ActionButton
        tone={tone}
        main={main}
        icon={<Plus aria-hidden="true" strokeWidth={1.9} />}
        label={label}
        onClick={() => {
          setOpen(true);
          load();
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="papic-buy-more"
      />
      {sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </>
  );
}
