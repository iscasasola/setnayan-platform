'use client';

import { useLayoutEffect, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Lock, X } from 'lucide-react';
import { StageAbout } from './kit';
import { makerPartSource, type MakerPartKey, type MakerStageKey } from '@/lib/maker-parts';
import { makerPartLabelOn } from '@/lib/maker-part-groups';
import { STAGE_BAR_GRID_CSS } from '@/lib/maker-stage-room';
import { DESK_PARTS_FROM_PX, DESK_PARTS_PX, DESK_TOOLS_PX, useDeskPartsSlot } from '../maker-desk';

/**
 * 🖥 THE STAGES TOOLBAR ON A DESKTOP — the tools column (`MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md` § Stages,
 * RIGHT, and the build plan's PR 2 + PR 4). The SAME toolbar as the phone's (`stage-tools.tsx`): its selector, its
 * rows, its ▶ — drawn full height in the right-hand column (`maker-desk.tsx`). Only what a mouse needs instead of a
 * swipe is added, and only on a desktop (`useMaker().desk`, never a phone):
 *
 *   · under the selector, the picked part's caption — "COUNTDOWN · 7 of 8" — and ‹ Previous · Next › · ✕ Done
 *     (the phone swipes across its toolbar; a mouse clicks) — `DeskStep`;
 *   · the parts of this page in the left column, in the order the page draws them, each with where it comes from
 *     (Studio · Suppliers) — a click is a tap on that part of the page; the Reveal reads locked — `DeskParts`;
 *   · the work area's tool (Style, Background, Animate) laid over the toolbar's rows, as the phone lays it over its
 *     four rows — the same rule set, with the column's measures (`STAGE_DESK_CSS`, `useDeskRowsTop`).
 *
 * 🔒 Nothing here writes: a click picks, steps or lets go — the phone's own moves (`pickPart` · `step` · `deselect`).
 */

/** The measured top of the toolbar's rows, said to the rule set (the work area's tool stands from there). */
export const DESK_ROWS_TOP_VAR = '--desk-rows-top';

const D = '[data-maker-shell][data-maker-desk]';
const PANEL = `${D}:has([data-stage-tools]) [data-phone-chrome="panel"]`;
/** Three rows tall (a row of the toolbar's own is under it — Style's Colour · Size, a line, a card's settings). */
const THREE_ROWS = 'calc(3 * var(--sp-rh) + 2 * var(--sp-rg))';

/**
 * The phone's rules for the work area's tool, with the column's measures (`stage-tools.tsx`, its `max-width` block):
 * the tool stands where the rows begin, the column's width, to the foot of the screen; Edit's rows are the toolbar's
 * own, so the tool waits out of sight; a part whose rows are the toolbar's (a block, the cover) hides it too.
 */
export const STAGE_DESK_CSS =
  '@media (min-width:1024px){' +
  `${PANEL}{position:fixed!important;top:var(${DESK_ROWS_TOP_VAR},180px)!important;right:0!important;left:auto!important;bottom:auto!important;width:${DESK_TOOLS_PX}px!important;height:${STAGE_BAR_GRID_CSS}!important;max-height:none!important;z-index:30!important;order:0!important;outline:none!important;border-radius:0!important;box-shadow:none!important;background:var(--sp-page)!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;padding:0 4px!important;overflow:hidden}` +
  /* 📱 THE TOOLS COLUMN IS A PHONE'S TOOLBAR: inside the work area's tool, what a phone hides is hidden here too (the
     old desktop inspector's own title, ×, Part ▾ and section bar — the selector above says all of it), and what
     only a phone draws is drawn (a sheet's own lead). Read off the tool's own phone classes, so no tool needs a
     desktop branch of its own and the phone's tree is untouched. */
  `${PANEL} :is([class~="max-lg:hidden"],[class~="hidden"][class*="lg:flex"],[class~="hidden"][class*="lg:block"],[class~="hidden"][class*="lg:inline-flex"]){display:none!important}` +
  `${PANEL} [class~="lg:hidden"][class~="flex"]{display:flex!important}` +
  `${PANEL} [class~="lg:hidden"][class~="inline-flex"]{display:inline-flex!important}` +
  `${PANEL} [class~="lg:hidden"][class~="block"]{display:block!important}` +
  `${D}:has([data-stage-tool-now="edit"]) [data-phone-chrome="panel"]{visibility:hidden;pointer-events:none}` +
  `${D}:has([data-stage-tools][data-stage-edit-own]) [data-phone-chrome="panel"]{visibility:visible;pointer-events:auto}` +
  `${D}:has([data-stage-tools][data-stage-edit-card]) [data-phone-chrome="panel"]{visibility:visible;pointer-events:auto;height:${THREE_ROWS}!important}` +
  `${D}:has([data-stage-tools][data-stage-own-rows]) [data-phone-chrome="panel"],${D}:has([data-stage-tools][data-stage-cover-rows]) [data-phone-chrome="panel"],${D}:has([data-stage-tools][aria-hidden="true"]) [data-phone-chrome="panel"]{visibility:hidden;pointer-events:none}` +
  `${D}:has([data-stage-tools][data-stage-row4]) [data-phone-chrome="panel"],${D}:has([data-stage-tools][data-stage-line]) [data-phone-chrome="panel"]{height:${THREE_ROWS}!important}` +
  `${D} [data-stage-style-rows]:has(>[data-look-cards])>:not([data-look-cards],[data-look-row],[role="alert"]){display:none!important}` +
  `${D} [data-stage-style-rows]:not(:has(>[data-look-cards])){overflow-y:auto;gap:8px;padding-bottom:8px}` +
  /* "You're editing" is the page's caption on a desktop (under the page), and the guests' tab bar is the page's foot. */
  `${D} [data-stage-caption]{display:none}` +
  `${D} [data-stage-guest-bar]{display:block!important;left:0!important;right:${DESK_TOOLS_PX}px!important;bottom:0!important;transition:none!important}` +
  `${D} [data-stage-exit-preview]{display:flex!important;right:${DESK_TOOLS_PX + 12}px!important}` +
  `${D} [data-desk-editing]{left:0;right:${DESK_TOOLS_PX}px}` +
  /* ⓘ stands at the end of the part's caption (its phone place, the "You're editing" line, is under the page here). */
  `${D} [data-stage-tools]>[data-stage-about]{display:none}` +
  `${D} [data-desk-step] [data-stage-about]{position:static}` +
  /* The RSVP stage's screens are the parts column's rows (the phone's are its tab bar) — the old desktop list goes. */
  `${D} [data-rsvp-stage-scenes],${D} [data-rsvp-stage-scene-title]{display:none!important}` +
  /* The page column keeps the room for them under the page — the page is never under its own caption. */
  `${D}>[data-maker-work]{padding-bottom:36px}` +
  `${D}:has([data-stage-guest-bar]:not([hidden]))>[data-maker-work]{padding-bottom:81px}` +
  `${D}:has([data-stage-guest-bar]:not([hidden])) [data-desk-editing]{bottom:45px}` +
  '}' +
  `@media (min-width:${DESK_PARTS_FROM_PX}px){${D} [data-stage-guest-bar],${D} [data-desk-editing]{left:${DESK_PARTS_PX}px!important}}` +
  /* The four rows keep the phone's measures — the toolbar fills from the top and nothing is centred up and down. */
  `${D} [data-stage-rows]{min-height:${STAGE_BAR_GRID_CSS}}`;

/** 📏 Where the toolbar's rows begin on the screen — the work area's tool stands there (re-measured as anything moves). */
export function useDeskRowsTop(desk: boolean, rows: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = rows.current;
    const shell = el?.closest<HTMLElement>('[data-maker-shell]');
    if (!desk || !el || !shell) return;
    const say = () => shell.style.setProperty(DESK_ROWS_TOP_VAR, `${Math.round(el.getBoundingClientRect().top)}px`);
    say();
    const ro = new ResizeObserver(say);
    ro.observe(el);
    ro.observe(shell);
    const root = el.closest('[data-stage-tools]');
    if (root) ro.observe(root);
    window.addEventListener('resize', say);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', say);
      shell.style.removeProperty(DESK_ROWS_TOP_VAR);
    };
  }, [desk, rows]);
}

/** Where a part comes from, as the parts column says it under its name (the approved frame: Studio · Suppliers). */
function partSourceWord(key: MakerPartKey): string | null {
  const src = makerPartSource(key);
  return src.kind === 'studio' ? 'Studio' : src.kind === 'supplier' ? 'Suppliers' : null;
}

const STEP =
  'sn-press inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--sp-line)] bg-white px-3 text-[14px] font-semibold text-[var(--sp-ink)] transition-colors duration-sn-control ease-sn hover:border-[var(--sp-gold)] disabled:cursor-default disabled:opacity-40 disabled:hover:border-[var(--sp-line)]';

/**
 * ‹ Previous · Next › · ✕ Done — under the selector, with the picked part's caption over them ("COUNTDOWN · 7 of 8") —
 * a line of words, never a box (a frame is only on what you press, owner 2026-10-11).
 * The phone's swipe and its ✕ (a tap on nothing), for a mouse. Nothing picked: nothing drawn.
 */
export function DeskStep({
  stage,
  picked,
  order,
  onStep,
  onDone,
}: {
  stage: MakerStageKey;
  picked: MakerPartKey | null;
  /** The page's parts in the order it draws them. */
  order: readonly MakerPartKey[];
  onStep: (dir: 1 | -1) => void;
  onDone: () => void;
}) {
  if (!picked) return null;
  const at = order.indexOf(picked);
  return (
    <div data-desk-step="" className="flex shrink-0 flex-col gap-2 pb-2.5">
      <p className="flex h-11 items-center gap-1 border-b border-[var(--sp-line)] px-1 text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--sp-ink)]">
        <span className="min-w-0 truncate">{makerPartLabelOn(stage, picked)}</span>
        {at >= 0 ? (
          <span className="ml-auto shrink-0 pl-2 font-semibold normal-case tracking-normal text-[var(--sp-mute)]">
            {at + 1} of {order.length}
          </span>
        ) : null}
        <StageAbout />
      </p>
      <div className="flex gap-2">
        <button type="button" data-desk-step-go="prev" onClick={() => onStep(-1)} className={STEP}>
          <ChevronLeft aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          Previous
        </button>
        <button type="button" data-desk-step-go="next" onClick={() => onStep(1)} className={STEP}>
          Next
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.2} />
        </button>
        <button type="button" data-desk-step-go="done" onClick={onDone} className={`${STEP} !flex-none`}>
          <X aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          Done
        </button>
      </div>
    </div>
  );
}

const ROW =
  'sn-press flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[14.5px] text-[var(--sp-ink)] transition-colors duration-sn-control ease-sn hover:bg-[rgba(44,42,41,.05)]';

/**
 * 🗂 THE PARTS OF THIS PAGE — the left column (the doc's LEFT, 264 px; the build plan's PR 4). The stage's pages
 * first (the guests' tab bar's, as rows — the one on screen marked), then every part the page draws, in its order,
 * with where it comes from. A click is the same as a tap on that part of the page (`onPick`); a page row turns the
 * page as the guests' bar does (`onPage`). The Reveal leads its page and is locked: it never moves.
 */
export function DeskParts({
  stage,
  pages,
  shownPage,
  onPage,
  order,
  picked,
  onPick,
}: {
  stage: MakerStageKey;
  pages: ReadonlyArray<{ key: string; label: string; option: string }>;
  shownPage: string | null;
  onPage: (key: string, option: string) => void;
  order: readonly MakerPartKey[];
  picked: MakerPartKey | null;
  onPick: (key: MakerPartKey) => void;
}) {
  const slot = useDeskPartsSlot();
  if (!slot) return null;
  return createPortal(
    <div data-desk-parts-list="" className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain px-2.5 pb-6 pt-3 [scrollbar-width:thin]">
      {pages.length > 1 ? (
        <ul className="flex flex-col gap-0.5 border-b border-[var(--sp-line)] pb-2.5">
          {pages.map((p) => {
            const here = p.key === shownPage;
            return (
              <li key={p.key}>
                <button
                  type="button"
                  aria-current={here ? 'page' : undefined}
                  data-desk-page={p.key}
                  onClick={() => (here ? undefined : onPage(p.key, p.option))}
                  className={`${ROW} ${here ? 'bg-[rgba(44,42,41,.07)] font-semibold shadow-[inset_3px_0_0_var(--sp-ink)]' : ''}`}
                >
                  {p.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="flex items-center justify-between px-3 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sp-mute)]">
        <span>Parts of this page</span>
        <span>{order.length}</span>
      </p>
      <ul className="flex flex-col gap-0.5">
        {order.map((k) => {
          const on = k === picked;
          const from = partSourceWord(k);
          return (
            <li key={k}>
              <button
                type="button"
                aria-pressed={on}
                data-desk-part={k}
                onClick={() => onPick(k)}
                className={`${ROW} ${on ? 'bg-[var(--sp-cta-wash)] font-semibold shadow-[inset_3px_0_0_var(--sp-cta)]' : ''}`}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{makerPartLabelOn(stage, k)}</span>
                  {from ? <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-[var(--sp-gold)]">{from}</span> : null}
                </span>
                {k === 'reveal' ? <Lock aria-label="Stays first" className="h-3.5 w-3.5 shrink-0 text-[var(--sp-mute)]" strokeWidth={2} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>,
    slot,
  );
}
