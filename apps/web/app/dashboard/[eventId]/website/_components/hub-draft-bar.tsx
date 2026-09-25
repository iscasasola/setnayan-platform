'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { hubDraftAction } from '../hub-draft-actions';
import { useMaker } from '../../launch/_components/maker-context';
import {
  HUB_RESET_NEVER_TOUCHES,
  type HubDraftActionResult,
  type HubDraftRefusal,
  type HubDraftSummary,
  type HubResetScope,
} from '@/lib/hub-draft';

/**
 * THE DRAFT CONTROLS — Apply · Undo · Restore · Reset, and the "Draft" badge
 * (Event Hub Maker Phase 2). Mounted once, in the Maker toolbar's `applySlot`,
 * through the server `HubDraftDock` (`launch/page.tsx`).
 *
 *   <MakerShell applySlot={<HubDraftDock eventId={eventId} />} …>
 *   <form …><HubDraftField /> … </form>   // an existing panel's form now saves
 *                                          // to the draft instead of going live
 *
 * 🔑 IT SAYS WHAT HAPPENED, EVERY TIME. An Apply that held keys back lists them
 * with the reason in words; a draft that could not be read says so rather than
 * rendering as "no changes" (`readError`) — the disease this codebase keeps
 * curing is a failure that renders identically to success or to emptiness.
 *
 * 💳 NO PRICE IS TYPED. `priceLabel` is the live catalogue row, formatted
 * server-side, or null (and then the figure is simply absent). In the store shell
 * (`storeShell`) there is no price, no link and no pay path — a Pro key reads
 * "Apply on the web" (owner 2026-09-25: Pro in the iPhone app, NOT YET).
 */

export type HubDraftBarProps = {
  eventId: string;
  summary: HubDraftSummary;
  storeShell: boolean;
  priceLabel: string | null;
  proHref: string | null;
  readError?: boolean;
};

/* The hidden field lives in `hub-draft-field.tsx` — a module with no server
   imports, so panels that render tests load can carry it. Re-exported here for
   the callers that name this file. */
export { HubDraftField } from './hub-draft-field';

/** "Draft" — shown only while the draft differs from what guests see. */
export function HubDraftBadge({ summary }: { summary: HubDraftSummary }) {
  if (!summary.hasChanges) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-terracotta-700 px-2 py-0.5 text-[11px] font-semibold text-cream"
      title="Guests do not see these changes until you Apply"
    >
      Draft
      <span className="sr-only"> — {summary.changeCount} changes guests do not see yet</span>
    </span>
  );
}

const HELD_REASON: Record<HubDraftRefusal, string> = {
  needs_pro: 'needs Event Hub Pro — it stays in your draft',
  apply_on_the_web: 'can be applied on the web — it stays in your draft',
  not_your_photo: 'uses a photo that is not in your Event Hub',
  empty_section: 'has nothing in it yet, so it cannot be shown',
  missing_section: 'no longer exists',
};

function useDraftIntent(eventId: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<HubDraftActionResult | null>(null);
  const run = (fields: Record<string, string>) =>
    start(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      const r = await hubDraftAction(eventId, fd);
      setResult(r);
      if (r.ok) router.refresh();
    });
  return { pending, result, run };
}

function ResultLine({ result }: { result: HubDraftActionResult | null }) {
  if (!result) return null;
  if (!result.ok) {
    return (
      <p role="alert" className="text-sm text-terracotta-700">
        {result.error}
      </p>
    );
  }
  if (result.intent !== 'apply') return null;
  return (
    <div role="status" className="text-sm text-ink/70">
      <p>
        {result.applied === 0
          ? 'Nothing new went live.'
          : `${result.applied} ${result.applied === 1 ? 'change is' : 'changes are'} now live.`}
      </p>
      {result.held.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {result.held.map((h, i) => (
            <li key={`${h.label}-${i}`}>
              {h.label} {HELD_REASON[h.reason]}.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const RESET_LABEL: Record<HubResetScope, string> = {
  save_the_date: 'Save the Date',
  rsvp: 'Invitation',
  event: 'On the Day',
  editorial: 'Post Event',
  all: 'the whole Event Hub',
};

const quietButton =
  'inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5';

/**
 * THE MAKER TOOLBAR'S DRAFT CONTROLS — compact: the "Draft" badge and Apply sit
 * in the bar; Undo · Restore · Reset and the outcome of the last action open
 * from one small menu beside them. Reset uses the stage the couple is looking
 * at (`useMaker().stage`; Invitation outside the Maker).
 *
 * The menu opens by itself when an action reports back, so an Apply that held
 * keys back is never a silent one.
 */
export function HubDraftToolbar({ eventId, summary, storeShell, priceLabel, proHref, readError }: HubDraftBarProps) {
  const maker = useMaker();
  const stage: HubResetScope = maker?.stage ?? 'rsvp';
  const { pending, result, run } = useDraftIntent(eventId);
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const act = (fields: Record<string, string>) => {
    run(fields);
    setAsking(false);
    setOpen(true);
  };

  const onlyPro = summary.proCount > 0 && summary.proCount === summary.changeCount;
  const freeCount = summary.changeCount - summary.proCount;

  return (
    <div className="flex items-center gap-1.5">
      {readError ? (
        <span role="alert" className="text-xs text-terracotta-700">
          Draft could not be loaded — reload
        </span>
      ) : null}
      <HubDraftBadge summary={summary} />
      {summary.hasChanges && !onlyPro ? (
        <button
          type="button"
          className="button-primary inline-flex"
          disabled={pending}
          onClick={() => act({ intent: 'apply' })}
        >
          {summary.proCount > 0 ? `Apply ${freeCount}` : 'Apply'}
        </button>
      ) : null}
      <details className="relative" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className={`${quietButton} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
          {pending ? 'Saving…' : summary.hasChanges ? `${summary.changeCount} not live` : 'Draft'}
        </summary>
        <div className="absolute right-0 top-full z-40 mt-2 flex w-80 flex-col gap-2 rounded-xl bg-cream p-3 shadow-lg">
          {summary.hasChanges ? (
            <p className="text-sm text-ink/80">
              {summary.changeCount} {summary.changeCount === 1 ? 'change' : 'changes'} guests do not see yet.
            </p>
          ) : readError ? null : (
            <p className="text-sm text-ink/70">No draft — the preview is what guests see.</p>
          )}
          {summary.proCount > 0 &&
            (storeShell ? (
              <p className="text-sm text-ink/70">
                {summary.proCount === 1 ? 'One change' : `${summary.proCount} changes`} can be applied on the web.
              </p>
            ) : (
              <p className="text-sm text-ink/70">
                Apply needs Event Hub Pro{priceLabel ? ` · ${priceLabel}` : ''} · one-time · all four stages
                {proHref && (
                  <>
                    {' '}
                    <Link href={proHref} className="font-semibold text-terracotta-700 underline underline-offset-2">
                      Get Event Hub Pro
                    </Link>
                  </>
                )}
              </p>
            ))}
          <div className="flex flex-wrap gap-1">
            {summary.canUndo ? (
              <button type="button" className={quietButton} disabled={pending} onClick={() => act({ intent: 'undo' })}>
                Undo
              </button>
            ) : null}
            {summary.hasChanges ? (
              <button type="button" className={quietButton} disabled={pending} onClick={() => act({ intent: 'restore' })}>
                Restore what guests see
              </button>
            ) : null}
            {!asking ? (
              <button type="button" className={quietButton} onClick={() => setAsking(true)}>
                Reset {RESET_LABEL[stage]}…
              </button>
            ) : null}
          </div>
          {asking ? (
            <div role="group" aria-label="Reset to our design" className="flex flex-col gap-2">
              <p className="text-sm text-ink">
                Reset {RESET_LABEL[stage]} to the page we designed? It goes into your draft — guests see nothing
                until you Apply, and Undo or Restore takes it back. It never touches:
              </p>
              <ul className="list-disc pl-5 text-sm text-ink/70">
                {HUB_RESET_NEVER_TOUCHES.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className="button-primary inline-flex"
                  disabled={pending}
                  onClick={() => act({ intent: 'reset', stage })}
                >
                  Reset in my draft
                </button>
                <button type="button" className={quietButton} onClick={() => setAsking(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          {result?.ok && result.intent === 'reset' ? (
            <p role="status" className="text-sm text-ink/70">
              Reset in your draft. Guests still see the old page until you Apply.
            </p>
          ) : null}
          <ResultLine result={result} />
        </div>
      </details>
    </div>
  );
}
