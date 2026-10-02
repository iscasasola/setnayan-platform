'use client';

import { MAKER_DRAFT_BAR_EVENT, MAKER_REFRESH_EVENT, makerSave } from '@/lib/maker-refresh';
import { MAKER_OPEN_RESET_EVENT } from './maker-open-reset';
import { MAKER_PRESS_APPLY_EVENT, type MakerApplyOutcome, type MakerPressApplyDetail } from './maker-press-apply';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { Check, MoreVertical, RotateCcw, Undo2 } from 'lucide-react';
import { hubDraftAction } from '../hub-draft-actions';
import { MAKER_OPEN_PART_EVENT, useMaker } from '../../launch/_components/maker-context';
import { DraftButton } from './hub-draft-button';
import { ApplyProSheet } from './apply-pro-sheet';
import { UNLOCK_AND_APPLY_PARAM, unlockAndApplyOnReturn, type HubProEffectView } from '@/lib/hub-pro-effect-view';
import {
  HUB_RESET_NEVER_TOUCHES,
  hubDraftPanelStaysOpen,
  type HubDraftActionResult,
  type HubDraftBarLive,
  type HubDraftRefusal,
  type HubDraftSummary,
  type HubResetScope,
} from '@/lib/hub-draft';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';
import { makerSaveStatusText, onMakerSave, type MakerSaveStatus } from '@/lib/maker-save-status';
import { formatCount } from '@/lib/format-number';

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
  /** A form's draft save that did not land, in words (`?draft_error=`, via `HubDraftDock`). */
  saveError?: string | null;
  /**
   * 💎 The draft's Pro effects by name and place (`HubDraftBarData.proEffects`)
   * — non-empty means Apply opens the Apply sheet first. Empty in the shell.
   */
  proEffects?: readonly HubProEffectView[];
  /** The Apply sheet's first-visit tour (`customer_apply_pro_v1`) — an element, drawn inside the open sheet. */
  applyTour?: ReactNode;
  /** 👁 Owns Pro as this viewer is SHOWN (outside the store shell) — picks the half of a save's bar that is theirs. */
  ownsPro?: boolean;
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
  date_in_past: 'has already gone by — pick a day ahead; it stays in your draft',
  date_locked: 'clashes with a supplier you booked — ask them to move or unlock in Details › Date; it stays in your draft',
};

function useDraftIntent(eventId: string) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<HubDraftActionResult | null>(null);
  const run = (fields: Record<string, string>) =>
    start(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      /* Undo · Restore · Reset · Apply are never drawn by the bridge: the
         canvas reloads (double-buffered) for the render they bring — ONE render,
         after the write, since the action no longer re-renders the Maker in its
         own response for a draft-only intent. */
      const r = await makerSave(() => hubDraftAction(eventId, fd), () => router.refresh());
      setResult(r);
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
  event: 'The Day',
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
 * The ⋯ panel opens by itself when an action reports something to read, so an
 * Apply that held keys back is never a silent one — and closes on a clean one.
 */
export function HubDraftToolbar({
  eventId,
  summary: renderedSummary,
  storeShell,
  priceLabel: renderedPriceLabel,
  proHref,
  readError: renderedReadError,
  saveError,
  proEffects: renderedProEffects = [],
  applyTour = null,
  ownsPro = false,
}: HubDraftBarProps) {
  /* ⚡ THE COUNT FROM THE SAVE ITSELF (owner 2026-09-30, SPEED FIRST). A pick
     the bridge drew is followed by no render of the Maker (`lib/maker-refresh.ts`),
     so its save answers with the bar and `makerSave` hands it here. The render's
     own props win again the moment a new render arrives (a new `summary`). */
  const [fromSave, setFromSave] = useState<HubDraftBarLive | null>(null);
  useEffect(() => {
    const onBar = (e: Event) => {
      const bar = (e as CustomEvent<HubDraftBarLive>).detail;
      if (bar && typeof bar === 'object' && bar.free && bar.owned) setFromSave(bar);
    };
    window.addEventListener(MAKER_DRAFT_BAR_EVENT, onBar);
    return () => window.removeEventListener(MAKER_DRAFT_BAR_EVENT, onBar);
  }, []);
  useEffect(() => setFromSave(null), [renderedSummary]);
  /* The save answers for both; this viewer's half is the one the render drew
     with (`ownsPro`, as viewed). In the store shell there is no Apply sheet. */
  const summary = fromSave ? (ownsPro ? fromSave.owned : fromSave.free) : renderedSummary;
  const proEffects = !fromSave || storeShell ? (storeShell ? [] : renderedProEffects) : ownsPro ? [] : fromSave.proEffects;
  const priceLabel = fromSave && !storeShell ? (fromSave.priceLabel ?? renderedPriceLabel) : renderedPriceLabel;
  const readError = fromSave ? false : renderedReadError;
  const maker = useMaker();
  /* 💎 THE APPLY SHEET (owner 2026-09-28: *"need to upgrade to pro when clicked
     on apply and point out the effect chosen"*). Apply opens it — never the
     write — while the draft holds a Pro effect this event has not unlocked. */
  const [sheetOpen, setSheetOpen] = useState(false);
  const asksForPro = !storeShell && proHref !== null && proEffects.length > 0;
  const stage: HubResetScope = maker?.stage ?? 'rsvp';
  const { pending, result, run } = useDraftIntent(eventId);
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  /* A page that autosaves into the draft (the Logo page) reports here, beside
     Apply — `lib/maker-save-status.ts`. An error stays until a save succeeds. */
  const [saveStatus, setSaveStatus] = useState<MakerSaveStatus | null>(null);
  useEffect(() => onMakerSave(setSaveStatus), []);
  /* 🔁 A Maker control with no router of its own (the RSVP settings) asks for
     the one refresh after its save (`requestMakerRefresh`); this bar is mounted
     once in every Maker with a work area, so it answers. */
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener(MAKER_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(MAKER_REFRESH_EVENT, refresh);
  }, [router]);
  /* More ▾ → "Reset this stage…" in the Maker toolbar opens THIS confirm. */
  useEffect(() => {
    const open = () => {
      setOpen(true);
      setAsking(true);
    };
    window.addEventListener(MAKER_OPEN_RESET_EVENT, open);
    return () => window.removeEventListener(MAKER_OPEN_RESET_EVENT, open);
  }, []);
  const act = (fields: Record<string, string>) => {
    run(fields);
    setAsking(false);
  };
  /* The guided flow's Ready screen presses THIS Apply (`maker-press-apply.ts`):
     the same three answers the button gives, and the first of the two mounted
     bars answers — one press is one Apply. */
  const pressRef = useRef<() => MakerApplyOutcome>(() => 'nothing');
  pressRef.current = () => {
    if (pending) return 'busy';
    if (!summary.hasChanges) return 'nothing';
    if (asksForPro) {
      setSheetOpen(true);
      return 'pro-sheet';
    }
    act({ intent: 'apply' });
    return 'applying';
  };
  useEffect(() => {
    const press = (e: Event) => {
      const detail = (e as CustomEvent<MakerPressApplyDetail>).detail;
      if (!detail || detail.handled) return;
      detail.handled = true;
      detail.outcome = pressRef.current();
    };
    window.addEventListener(MAKER_PRESS_APPLY_EVENT, press);
    return () => window.removeEventListener(MAKER_PRESS_APPLY_EVENT, press);
  }, []);
  /** "Go to" — the stage it is on, the scene (or row / tool), then its part. */
  const goTo = (effect: HubProEffectView) => {
    const j = effect.jump;
    setSheetOpen(false);
    if (!j || !maker) return;
    if (j.kind === 'scene') {
      if (j.stages.length > 0 && !j.stages.includes(maker.stage)) maker.setStage(j.stages[0]!);
      // A fixed scene (the hero) selects its own panel; the rest are scenes.
      maker.select(j.fixed ? { kind: 'row', key: `f:${j.fixed}` } : { kind: 'scene', id: j.widgetId, tab: j.tab });
      if (j.element) {
        const detail = { key: j.fixed ? `f:${j.fixed}` : `w:${j.widgetType}`, widgetType: j.widgetType, el: j.element };
        window.setTimeout(() => window.dispatchEvent(new CustomEvent(MAKER_OPEN_PART_EVENT, { detail })), 0);
      }
      return;
    }
    if (j.kind === 'main') maker.select({ kind: 'main' });
    else if (j.kind === 'row') maker.select({ kind: 'row', key: j.key });
    else maker.select({ kind: 'tool', key: j.key });
  };
  /* 💎 BACK FROM "UNLOCK PRO AND APPLY" (owner 2026-09-28). The purchase page
     returns with `?apply=1`. Pro active → Apply now, no second tap; still no
     Pro (cancelled, or under review) → the sheet again, the draft untouched.
     The toolbar is mounted twice (phone + desktop): the first mount to run
     takes the param off the address before it acts, so only one ever does. */
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(UNLOCK_AND_APPLY_PARAM) !== '1') return;
    url.searchParams.delete(UNLOCK_AND_APPLY_PARAM);
    window.history.replaceState(window.history.state, '', url.toString());
    const next = unlockAndApplyOnReturn({
      asked: true,
      proEffects: proEffects.length,
      hasChanges: summary.hasChanges,
      storeShell,
    });
    if (next === 'apply') act({ intent: 'apply' });
    else if (next === 'sheet') setSheetOpen(true);
    // Once, on the render the purchase page lands on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* The ⋯ panel follows the ANSWER, not the press: it opens when there is
     something to read (an error, a key Apply held back, Reset's note) and
     closes on a clean Apply · Undo · Restore — owner 2026-09-27, the panel
     stayed open over the Maker after Apply saying "2 changes are now live". */
  useEffect(() => {
    if (result) setOpen(hubDraftPanelStaysOpen(result));
  }, [result]);
  const appliedClean = result?.ok === true && result.intent === 'apply' && !hubDraftPanelStaysOpen(result);
  /* The newest word wins: a status this page announced, else a form save that
     came back refused (`saveError`). An error is never truncated away. */
  const status: MakerSaveStatus | null = saveStatus ?? (saveError ? { state: 'error', text: saveError } : null);

  const onlyPro = summary.proCount > 0 && summary.proCount === summary.changeCount;
  const freeCount = summary.changeCount - summary.proCount;
  const applyLabel = pending ? 'Applying…' : summary.proCount > 0 && !onlyPro ? `Apply ${formatCount(freeCount)}` : 'Apply';

  return (
    <div className="flex items-center gap-1" data-maker-draft-actions="">
      {status ? (
        <span
          role={status.state === 'error' ? 'alert' : 'status'}
          data-maker-save-status={status.state}
          className={`max-w-[9rem] text-[11px] font-semibold ${
            status.state === 'error' ? 'line-clamp-3 leading-tight text-terracotta-700' : 'truncate text-ink/60'
          }`}
          title={makerSaveStatusText(status)}
        >
          {makerSaveStatusText(status)}
        </span>
      ) : appliedClean ? (
        <span role="status" data-maker-save-status="applied" className="text-[11px] font-semibold text-ink/60">
          Live now
        </span>
      ) : null}
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
        onClick={() => (asksForPro ? setSheetOpen(true) : act({ intent: 'apply' }))}
      />
      {/* Portalled to <body>: the toolbar sits in a glass bar, and a `backdrop-filter`
          ancestor would make `position: fixed` hug the bar instead of the screen. */}
      {sheetOpen && proHref ? createPortal(
        <ApplyProSheet
          effects={asksForPro ? proEffects : []}
          priceLabel={priceLabel}
          proHref={proHref}
          pending={pending}
          onGo={goTo}
          onRemove={(e) => run({ intent: 'drop', effect: e.id })}
          onApplyFree={() => {
            setSheetOpen(false);
            act({ intent: 'apply' });
          }}
          onClose={() => setSheetOpen(false)}
          tour={applyTour}
        />,
        document.body,
      ) : null}
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
              {formatCount(summary.changeCount)}
            </span>
          ) : null}
        </summary>
        <div className="absolute right-0 top-full z-40 mt-2 flex w-80 flex-col gap-2 rounded-xl bg-cream p-3 shadow-lg">
          {summary.hasChanges ? (
            <p className="text-sm text-ink/80">
              {formatCount(summary.changeCount)} {summary.changeCount === 1 ? 'change' : 'changes'} guests do not see yet.
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
                {summary.proCount === 1 ? 'One change' : `${formatCount(summary.proCount)} changes`} can be applied on the web.
              </p>
            ) : (
              <p className="text-sm text-ink/70">
                <PaidMark state="try" bare label={paidMarkLabel('try', 'Event Hub Pro')} className="mr-1 align-middle" />
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
