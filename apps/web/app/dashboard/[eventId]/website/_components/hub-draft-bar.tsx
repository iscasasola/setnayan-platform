'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { hubDraftAction } from '../hub-draft-actions';
import {
  HUB_DRAFT_FIELD,
  HUB_RESET_NEVER_TOUCHES,
  type HubDraftActionResult,
  type HubDraftRefusal,
  type HubDraftSummary,
  type HubResetScope,
} from '@/lib/hub-draft';

/**
 * THE DRAFT BAR — Apply · Restore · Reset, and the "Draft" badge (Event Hub Maker
 * Phase 2). Self-contained: the Maker shell mounts it; it owns no layout beyond
 * its own row.
 *
 *   const bar = await loadHubDraftBarData(eventId);   // lib/hub-draft-store.ts
 *   <HubDraftBadge summary={bar.summary} />
 *   <HubDraftBar {...bar} />
 *   <HubDraftReset eventId={eventId} />               // always reachable
 *   <form …><HubDraftField /> … </form>                // an existing panel's form
 *                                                      // now saves to the draft
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

/** The hidden field that sends an existing Event Hub form's save to the draft. */
export function HubDraftField() {
  return <input type="hidden" name={HUB_DRAFT_FIELD} value="1" />;
}

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

/**
 * Apply · Undo · Restore. Renders nothing while there is no draft — except the
 * outcome of the last Apply, and a read failure, which are always shown.
 */
export function HubDraftBar({ eventId, summary, storeShell, priceLabel, proHref, readError }: HubDraftBarProps) {
  const { pending, result, run } = useDraftIntent(eventId);

  if (readError) {
    return (
      <p role="alert" className="text-sm text-terracotta-700">
        Your draft could not be loaded just now. Nothing was lost — reload to try again.
      </p>
    );
  }
  if (!summary.hasChanges) return <ResultLine result={result} />;

  const onlyPro = summary.proCount > 0 && summary.proCount === summary.changeCount;
  const freeCount = summary.changeCount - summary.proCount;

  return (
    <section
      aria-label="Your draft"
      className="flex flex-col gap-2 bg-cream/95 px-4 py-3 shadow-lg backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-2">
        <HubDraftBadge summary={summary} />
        <p className="text-sm text-ink/80">
          {summary.changeCount} {summary.changeCount === 1 ? 'change' : 'changes'} guests do not see yet.
        </p>
      </div>

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

      <div className="flex flex-wrap items-center gap-2">
        {!onlyPro && (
          <button
            type="button"
            className="button-primary inline-flex"
            disabled={pending}
            onClick={() => run({ intent: 'apply' })}
          >
            {summary.proCount > 0 ? `Apply ${freeCount} ${freeCount === 1 ? 'change' : 'changes'}` : 'Apply'}
          </button>
        )}
        {summary.canUndo && (
          <button
            type="button"
            className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5"
            disabled={pending}
            onClick={() => run({ intent: 'undo' })}
          >
            Undo
          </button>
        )}
        <button
          type="button"
          className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5"
          disabled={pending}
          onClick={() => run({ intent: 'restore' })}
        >
          Restore what guests see
        </button>
        {pending && <span className="text-xs text-ink/50">Saving…</span>}
      </div>
      <ResultLine result={result} />
    </section>
  );
}

const RESET_LABEL: Record<HubResetScope, string> = {
  save_the_date: 'Save the Date',
  rsvp: 'Invitation',
  event: 'On the Day',
  editorial: 'Post Event',
  all: 'the whole Event Hub',
};

/**
 * Reset to default — our design for one stage, written into the DRAFT (so Undo
 * or Restore can take it back until Apply). The confirm names what it will not
 * touch, from the same list the tests hold the reset plan to.
 */
export function HubDraftReset({ eventId, stage = 'rsvp' }: { eventId: string; stage?: HubResetScope }) {
  const { pending, result, run } = useDraftIntent(eventId);
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5"
          onClick={() => setAsking(true)}
        >
          Reset {RESET_LABEL[stage]} to our design…
        </button>
        {result?.ok && result.intent === 'reset' && (
          <p role="status" className="text-sm text-ink/70">
            Reset in your draft. Guests still see the old page until you Apply.
          </p>
        )}
        <ResultLine result={result} />
      </div>
    );
  }
  return (
    <div role="dialog" aria-label="Reset to our design" className="flex flex-col gap-2 bg-cream/95 px-4 py-3 shadow-lg">
      <p className="text-sm text-ink">
        Reset {RESET_LABEL[stage]} to the page we designed? It goes into your draft — guests see nothing until you
        Apply, and Undo or Restore takes it back.
      </p>
      <p className="text-sm text-ink/70">It never touches:</p>
      <ul className="list-disc pl-5 text-sm text-ink/70">
        {HUB_RESET_NEVER_TOUCHES.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="button-primary inline-flex"
          disabled={pending}
          onClick={() => {
            run({ intent: 'reset', stage });
            setAsking(false);
          }}
        >
          Reset in my draft
        </button>
        <button
          type="button"
          className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-ink/5"
          onClick={() => setAsking(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
