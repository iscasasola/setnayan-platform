'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, MoreVertical, RotateCcw, Undo2 } from 'lucide-react';
import { hubDraftAction } from '../hub-draft-actions';
import { useMaker } from '../../launch/_components/maker-context';
import { DraftButton } from './hub-draft-button';
import {
  HUB_RESET_NEVER_TOUCHES,
  type HubDraftActionResult,
  type HubDraftRefusal,
  type HubDraftSummary,
  type HubResetScope,
} from '@/lib/hub-draft';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';

/**
 * THE DRAFT CONTROLS — Restore · Undo · Apply, ALWAYS VISIBLE at the upper
 * right of the Maker's toolbar (Event Hub Maker Phase 3). Mounted twice, once
 * for the phone top bar and once for the desktop row — CSS, not a
 * conditional, decides which copy shows — through the server `HubDraftDock`
 * (`launch/page.tsx` → `maker-shell.tsx`).
 *
 *   <MakerShell applySlot={<HubDraftDock eventId={eventId} />} …>
 *   <form …><HubDraftField /> … </form>   // an existing panel's form now saves
 *                                          // to the draft instead of going live
 *
 * 🔑 OWNER, 2026-09-25, ON THE LIVE MAKER: *"i thought there will be an action
 * buttons RESTORE/UNDO/APPLY on the upper right nav?"* → *"upper right of the
 * top nav"*. The Phase 2 dock answered with a "Draft" badge that vanished
 * entirely when there was nothing to do, and every real control sat one tap
 * deep in a `<details>` menu — on production that read as "Draft · No draft
 * — the preview is what guests see." with NOTHING to press. The three
 * buttons below never disappear; a button with nothing to do is DISABLED
 * and says why, on tap or hover, through an adjacent `InfoTip`
 * (`app/_components/info-tip.tsx`) — the same pairing `maker-play-menu.tsx`
 * uses for "Play this scene" with nothing selected.
 *
 * Reset (a confirm flow, never a single tap) and the outcome of the last
 * action stay behind ONE ⋯ — both are read AFTER pressing something, never
 * before, so hiding them costs nothing the owner asked to see.
 *
 * 🔑 `DraftButton` LIVES IN ITS OWN MODULE (`hub-draft-button.tsx`), same
 * reason `HubDraftField` does (below): this file also imports `hubDraftAction`,
 * which reaches `'server-only'` through `lib/hub-look-gate.ts` — real inside
 * Next's bundler, unresolvable to a bare `tsx --test` run. A test that wants
 * to actually MOUNT a button, not just read this file's source the way
 * `hub-draft-wiring.test.ts` reads a server action's, imports it from there.
 *
 * 💳 NO PRICE IS TYPED. `priceLabel` is the live catalogue row, formatted
 * server-side, or null (and then the figure is simply absent). In the store
 * shell (`storeShell`) there is no price, no link and no pay path — a Pro key
 * reads "Apply on the web" (owner 2026-09-25: Pro in the iPhone app, NOT YET).
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

/* `DraftButton` lives in `hub-draft-button.tsx` for the same reason. Re-exported
   here so this file stays the one thing other modules import by name. */
export { DraftButton } from './hub-draft-button';

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
 * THE MAKER TOOLBAR'S DRAFT CONTROLS — Restore · Undo · Apply always sit in
 * the bar, in that order, Apply filled. Reset and the outcome of the last
 * action open from one ⋯ beside them. Reset uses the stage the couple is
 * looking at (`useMaker().stage`; Invitation outside the Maker).
 *
 * The ⋯ panel opens by itself when an action reports back, so an Apply that
 * held keys back is never a silent one.
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
  const applyLabel = pending ? 'Applying…' : summary.proCount > 0 && !onlyPro ? `Apply ${freeCount}` : 'Apply';

  return (
    <div className="flex items-center gap-1" data-maker-draft-actions="">
      {readError ? (
        <span role="alert" className="text-[11px] font-semibold text-terracotta-700">
          Draft could not load
        </span>
      ) : null}
      <DraftButton
        label="Restore"
        icon={<RotateCcw aria-hidden className="h-4 w-4" strokeWidth={2} />}
        disabled={pending || !summary.hasChanges}
        disabledReason="Guests already see this"
        onClick={() => act({ intent: 'restore' })}
      />
      <DraftButton
        label="Undo"
        icon={<Undo2 aria-hidden className="h-4 w-4" strokeWidth={2} />}
        disabled={pending || !summary.canUndo}
        disabledReason="Nothing to undo yet"
        onClick={() => act({ intent: 'undo' })}
      />
      <DraftButton
        label={applyLabel}
        icon={<Check aria-hidden className="h-4 w-4" strokeWidth={2} />}
        primary
        disabled={pending || !summary.hasChanges}
        disabledReason="No changes to apply"
        onClick={() => act({ intent: 'apply' })}
      />
      <details className="relative" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary
          aria-label="Draft details and Reset"
          title="Draft details and Reset"
          className="sn-press relative inline-flex h-10 w-10 min-h-10 cursor-pointer items-center justify-center rounded-full text-ink/60 hover:bg-ink/5 hover:text-ink [&::-webkit-details-marker]:hidden"
        >
          <MoreVertical aria-hidden className="h-4 w-4" strokeWidth={2} />
          {summary.hasChanges ? (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta-700 px-1 text-[10px] font-bold leading-none text-cream"
            >
              {summary.changeCount}
            </span>
          ) : null}
        </summary>
        <div className="absolute right-0 top-full z-40 mt-2 flex w-80 flex-col gap-2 rounded-xl bg-cream p-3 shadow-lg">
          {summary.hasChanges ? (
            <p className="text-sm text-ink/80">
              {summary.changeCount} {summary.changeCount === 1 ? 'change' : 'changes'} guests do not see yet.
            </p>
          ) : readError ? (
            <p role="alert" className="text-sm text-terracotta-700">
              Draft could not be loaded — reload
            </p>
          ) : (
            <p className="text-sm text-ink/70">No draft — the preview is what guests see.</p>
          )}
          {summary.proCount > 0 &&
            (storeShell ? (
              <p className="text-sm text-ink/70">
                {summary.proCount === 1 ? 'One change' : `${summary.proCount} changes`} can be applied on the web.
              </p>
            ) : (
              <p className="text-sm text-ink/70">
                <PaidMark state="locked" label={paidMarkLabel('locked', 'Event Hub Pro')} className="mr-1 align-middle" />
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
          {!asking ? (
            <div className="flex flex-wrap gap-1">
              <button type="button" className={quietButton} onClick={() => setAsking(true)}>
                Reset {RESET_LABEL[stage]}…
              </button>
            </div>
          ) : (
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
          )}
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
