'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, GripVertical, Lock, Plus, Trash2, X } from 'lucide-react';
import { Phases, StageAbout } from './kit';
import { AnimateRows, type StageAnimateProps } from './stage-animate';
import { setDeskAnimateStack, useAnimatePhase, type AnimatePhase } from './store';
import { makerPartSource, type MakerPartKey, type MakerStageKey } from '@/lib/maker-parts';
import { makerPartCanvasOn, makerPartLabelOn } from '@/lib/maker-part-groups';
import { formatCount } from '@/lib/format-number';
import { STAGE_BAR_GRID_CSS } from '@/lib/maker-stage-room';
import { DESK_GOLD, DESK_HOVER_RING, DESK_PARTS_FROM_PX, DESK_PARTS_PX, DESK_TOOLS_PX, WORK, useDeskPartsSlot } from '../maker-desk';

/**
 * 🖥 THE STAGES TOOLBAR ON A DESKTOP — the tools column (`MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md` § Stages,
 * RIGHT, and the build plan's PR 2 + PR 4). The SAME toolbar as the phone's (`stage-tools.tsx`): its selector, its
 * rows, its ▶ — drawn full height in the right-hand column (`maker-desk.tsx`). Only what a mouse needs instead of a
 * swipe is added, and only on a desktop's width (`useIsDesktop`; the toolbar is there only when the columns are on):
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
/** The looks of a part, under Style (the work area's \`StyleCards\` — the strip on a phone, a grid here). */
const GRID = '[data-stage-style-rows] [data-look-cards]';
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
  /* The picked part's frame on the page — its outline, name tag, ＋ above / below, grip and 🗑 — is the phone's, drawn
     over the page column too (it is laid on the canvas by the canvas's own measures). */
  `html:has([data-maker-desk]) :is([data-part-edges],[data-part-error]){display:block!important}` +
  /* The RSVP stage's screens are the parts column's rows (the phone's are its tab bar) — the old desktop list goes. */
  `${D} [data-rsvp-stage-scenes],${D} [data-rsvp-stage-scene-title]{display:none!important}` +
  /* The page column keeps the room for them under the page — the page is never under its own caption. */
  `${D}>${WORK}{padding-bottom:36px}` +
  `${D}:has([data-stage-guest-bar]:not([hidden]))>${WORK}{padding-bottom:81px}` +
  `${D}:has([data-stage-guest-bar]:not([hidden])) [data-desk-editing]{bottom:45px}` +
  /* ✨ ANIMATE, STACKED (\`DeskAnimateStack\`): the work area's tool stands from the rows to the foot of the column. */
  `${PANEL}:has([data-desk-animate-stack]){height:auto!important;bottom:0!important}` +
  /* 🎠 STYLE'S LOOKS AS A 2-COLUMN GRID OF THE REAL PREVIEWS (the doc's RIGHT › Style: "the layout carousel becomes a
     2-column grid of real previews") — the same cards, their pictures and their order; a look of one long line takes
     the grid's width, as it takes 60 % of the phone's strip. The grid stands from the rows to the column's foot and
     scrolls; Style's own last row (Colour · Size, the toolbar's row 4) stays its last row, at the foot. */
  `${PANEL}:has(${GRID}){height:auto!important;bottom:12px!important}` +
  `${D}:has([data-stage-tools][data-stage-row4]) [data-phone-chrome="panel"]:has(${GRID}){bottom:calc(12px + var(--sp-rh) + var(--sp-rg))!important}` +
  `${D}:has([data-phone-chrome="panel"] ${GRID}) [data-stage-tools][data-stage-row4] [data-stage-look]{position:absolute;left:0;right:0;bottom:12px;grid-template-rows:var(--sp-rh)!important}` +
  `${D}:has([data-phone-chrome="panel"] ${GRID}) [data-stage-tools][data-stage-row4] [data-stage-look]>*{grid-row:1!important}` +
  `${D} [data-phone-chrome="panel"] ${GRID}{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:max-content;align-content:start;gap:10px;margin:0!important;padding:4px 4px 8px!important;overflow-x:hidden!important;overflow-y:auto!important;scroll-snap-type:none!important;scrollbar-width:thin}` +
  `${D} [data-phone-chrome="panel"] ${GRID}>[data-look-end]{display:none}` +
  `${D} [data-phone-chrome="panel"] ${GRID}>[data-style-card]{height:auto!important;width:auto!important;aspect-ratio:3/4}` +
  `${D} [data-phone-chrome="panel"] ${GRID}>[data-style-card][data-wide]{grid-column:1/-1;aspect-ratio:3/1!important;inline-size:auto!important}` +
  /* 🖱 The mouse's soft gold ring on a look (the doc's "Mouse"). */
  `${D} [data-phone-chrome="panel"] ${GRID}>[data-style-card]:not([aria-checked="true"]):hover{box-shadow:0 0 0 2px ${DESK_GOLD}}` +
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
            {formatCount(at + 1)} of {formatCount(order.length)}
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
  `sn-press flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-1.5 text-left text-[14.5px] text-[var(--sp-ink)] transition-shadow duration-sn-control ease-sn ${DESK_HOVER_RING}`;
/** ＋ Add above / below — the picked row's own, a dashed line of words (the approved frame's \`.addrow\`). */
const ADD_ROW =
  `sn-press flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--sp-line)] text-[12.5px] font-semibold text-[var(--sp-cta)] transition-shadow duration-sn-control ease-sn ${DESK_HOVER_RING}`; // no-card-ok: the class of the ＋ Add above / below <button> (a press)
/** The picked row's grip and 🗑 — 44 px presses on the row's right. */
const ROW_ICON = `sn-press inline-flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--sp-ink2)] ${DESK_HOVER_RING}`;

/** The picked part's own tools on its row — the frame's (`usePartEdits` `PartEditsNow`, read structurally: the drag's module is reached only through the Stages panel), never new ones. */
export type DeskPartTools = {
  addAbove: (() => void) | null;
  addBelow: (() => void) | null;
  remove: (() => void) | null;
  removeWord: string;
  earlier: (() => void) | null;
  later: (() => void) | null;
  moveAmong: () => string[];
  moveNear: ((target: string, where: 'above' | 'below') => boolean) | null;
  why: { earlier: string; later: string };
  say: (words: string) => void;
};

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
  tools,
}: {
  stage: MakerStageKey;
  pages: ReadonlyArray<{ key: string; label: string; option: string }>;
  shownPage: string | null;
  onPage: (key: string, option: string) => void;
  order: readonly MakerPartKey[];
  picked: MakerPartKey | null;
  onPick: (key: MakerPartKey) => void;
  /** The picked part's ＋ above · grip · 🗑 · ＋ below — the same the page draws on it. */
  tools: DeskPartTools;
}) {
  const slot = useDeskPartsSlot();
  /* ✋ THE GRIP, HELD WITH A MOUSE: the row under the pointer, and whether it lands above or below it. */
  const [drop, setDrop] = useState<{ key: MakerPartKey; where: 'above' | 'below' } | null>(null);
  const [holding, setHolding] = useState(false);
  const among = useRef<string[]>([]);
  const at = (e: ReactPointerEvent): { key: MakerPartKey; where: 'above' | 'below' } | null => {
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-desk-part]');
    const key = row?.getAttribute('data-desk-part') as MakerPartKey | null;
    const canvas = key && key !== picked ? makerPartCanvasOn(stage, key) : null;
    if (!row || !key || !canvas || !among.current.includes(canvas)) return null;
    const r = row.getBoundingClientRect();
    return { key, where: e.clientY < r.top + r.height / 2 ? 'above' : 'below' };
  };
  const grip = {
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      if (!tools.moveNear) return tools.say(tools.why.earlier);
      e.currentTarget.setPointerCapture(e.pointerId);
      among.current = tools.moveAmong();
      setHolding(true);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (holding) setDrop(at(e));
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!holding) return;
      const d = at(e);
      setHolding(false);
      setDrop(null);
      const c = d ? makerPartCanvasOn(stage, d.key) : null;
      if (d && c) tools.moveNear?.(c, d.where);
    },
    onPointerCancel: () => {
      setHolding(false);
      setDrop(null);
    },
    /* ⌨ …and the keyboard's way: ↑ ↓ one place, as the tag's Move up · Move down. */
    onKeyDown: (e: ReactKeyboardEvent) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      /* …the grip's own: never also the toolbar's ↑ ↓ (the next part). */
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      const go = e.key === 'ArrowUp' ? tools.earlier : tools.later;
      if (go) go();
      else tools.say(e.key === 'ArrowUp' ? tools.why.earlier : tools.why.later);
    },
  };
  /* The picked row in view in the column (a part picked on the page may sit low in a long list). */
  useEffect(() => {
    if (!slot || !picked) return;
    const list = slot.querySelector<HTMLElement>('[data-desk-parts-list]');
    const row = list?.querySelector<HTMLElement>(`[data-desk-part="${picked}"]`)?.closest('li');
    if (!list || !row) return;
    const top = row.offsetTop - list.offsetTop;
    if (top < list.scrollTop + 8 || top + row.offsetHeight > list.scrollTop + list.clientHeight - 8) list.scrollTop = Math.max(0, top - list.clientHeight / 3);
  }, [slot, picked]);
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
        <span>{formatCount(order.length)}</span>
      </p>
      <ul className="flex flex-col gap-0.5">
        {order.map((k) => {
          const on = k === picked;
          const from = partSourceWord(k);
          const name = makerPartLabelOn(stage, k);
          const line = drop?.key === k ? drop.where : null;
          return (
            <li key={k} className="relative" data-desk-drop={line ?? undefined}>
              {line ? <span aria-hidden data-desk-drop-line={line} className={`pointer-events-none absolute inset-x-2 z-[1] h-0.5 rounded-full bg-[var(--sp-cta)] ${line === 'above' ? '-top-px' : '-bottom-px'}`} /> : null}
              {on && tools.addAbove ? (
                <button type="button" data-desk-add="above" onClick={tools.addAbove} className={`${ADD_ROW} mb-1`}>
                  <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Add above
                </button>
              ) : null}
              <div className={`flex items-center rounded-xl ${on ? 'bg-[var(--sp-cta-wash)] shadow-[inset_3px_0_0_var(--sp-cta)]' : ''} ${on && holding ? 'opacity-70' : ''}`}>
                <button
                  type="button"
                  aria-pressed={on}
                  data-desk-part={k}
                  onClick={() => onPick(k)}
                  className={`${ROW} min-w-0 flex-1 ${on ? 'font-semibold' : ''}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{name}</span>
                    {from ? <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-[var(--sp-gold)]">{from}</span> : null}
                  </span>
                  {k === 'reveal' ? <Lock aria-label="Stays first" className="h-3.5 w-3.5 shrink-0 text-[var(--sp-mute)]" strokeWidth={2} /> : null}
                </button>
                {on && tools.moveNear ? (
                  <button type="button" data-desk-grip="" aria-label={`Move ${name} — drag, or ↑ ↓`} title="Drag to move" className={`${ROW_ICON} cursor-grab touch-none active:cursor-grabbing`} {...grip}>
                    <GripVertical aria-hidden className="h-4 w-4" strokeWidth={2} />
                  </button>
                ) : null}
                {on && tools.remove ? (
                  <button type="button" data-desk-remove="" aria-label={`${tools.removeWord} ${name}`} title={tools.removeWord} onClick={tools.remove} className={`${ROW_ICON} mr-1 text-[rgb(var(--color-danger))]`}>
                    <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2} />
                  </button>
                ) : null}
              </div>
              {on && tools.addBelow ? (
                <button type="button" data-desk-add="below" onClick={tools.addBelow} className={`${ADD_ROW} mt-1`}>
                  <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
                  Add below
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>,
    slot,
  );
}

/** Animate's three phases, in the phone's order and words (`StageAnimate` row 1). */
const PHASES: ReadonlyArray<readonly [AnimatePhase, string]> = [
  ['in', 'Build in'],
  ['act', 'Action'],
  ['out', 'Build out'],
];

/**
 * ✨ ANIMATE ON A DESKTOP — the three phases STACKED under their bar (the doc's RIGHT › Animate; owner's "A" for
 * answer 3, DECISION_LOG 2026-10-07 "DESKTOP ADAPTATION APPROVED — ALL FIVE A"). The bar is the phone's own
 * Build in | Action | Build out; under it Build in, Action and Build out each draw the phone's rows 2–4 for that
 * phase (`AnimateRows`, the same controls and saves), one under the other, so all three are in view together. A
 * press on the bar JUMPS to its phase; scrolling lights the phase in view — and that is the phase ▶ plays and the
 * next part opens on, as the phone's segment is (`useAnimatePhase`). The column scrolls when the three do not fit.
 * Lines the caller words for the phase on show (a Build in's note, an Action's note) stand under that phase.
 */
export function DeskAnimateStack(p: StageAnimateProps) {
  const [phase, setPhase] = useAnimatePhase();
  const box = useRef<HTMLDivElement>(null);
  /** A jump glides; the scroll it makes must not light the phases it passes. */
  const gliding = useRef<number | null>(null);
  const jump = (k: AnimatePhase) => {
    setPhase(k);
    const el = box.current;
    const to = el?.querySelector<HTMLElement>(`[data-desk-phase="${k}"]`);
    if (!el || !to) return;
    if (gliding.current) window.clearTimeout(gliding.current);
    gliding.current = window.setTimeout(() => (gliding.current = null), 700);
    const bar = el.querySelector<HTMLElement>('[data-desk-phase-bar]')?.offsetHeight ?? 0;
    el.scrollTo({ top: Math.max(0, to.offsetTop - bar), behavior: 'smooth' });
  };
  const spy = () => {
    const el = box.current;
    if (!el || gliding.current) return;
    const bar = el.querySelector<HTMLElement>('[data-desk-phase-bar]')?.offsetHeight ?? 0;
    let lit: AnimatePhase = 'in';
    for (const [k] of PHASES) {
      const s = el.querySelector<HTMLElement>(`[data-desk-phase="${k}"]`);
      if (s && s.offsetTop - bar <= el.scrollTop + 8) lit = k;
    }
    /* The foot of the column reached: the last phase is the one in view. */
    if (el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 2) lit = 'out';
    if (lit !== phase) setPhase(lit);
  };
  useEffect(() => () => {
    if (gliding.current) window.clearTimeout(gliding.current);
  }, []);
  return (
    <div
      ref={box}
      onScroll={spy}
      data-desk-animate-stack=""
      data-stage-animate={phase}
      className="flex min-h-0 flex-col overflow-y-auto overscroll-contain px-[10px] pb-3 [scrollbar-width:thin]"
      style={{ maxHeight: `calc(100dvh - var(${DESK_ROWS_TOP_VAR}, 180px) - 8px)` }}
    >
      <div data-desk-phase-bar="" className="sticky top-0 z-[2] bg-[var(--sp-page)] pb-1">
        <Phases<AnimatePhase> label="Animate" value={phase} options={PHASES} onPick={jump} data="animate" />
      </div>
      {PHASES.map(([k, words]) => (
        <section key={k} data-desk-phase={k} aria-label={words} className="flex flex-col gap-[var(--sp-rg)] border-t border-[var(--sp-line)] pb-2 pt-2 first-of-type:border-t-0">
          <h3 className="flex h-6 items-end px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sp-mute)]">{words}</h3>
          <AnimateRows {...p} phase={k} bare note={k === phase ? p.note : null} noteDoor={k === phase ? p.noteDoor : null} actNote={k === phase ? p.actNote : null} />
        </section>
      ))}
    </div>
  );
}

/** 🖥 Animate stacks while a desktop's columns are on — handed to `StageAnimate` for as long as the toolbar is. */
export function useDeskAnimate(desk: boolean): void {
  useEffect(() => {
    if (!desk) return;
    setDeskAnimateStack(DeskAnimateStack);
    return () => setDeskAnimateStack(null);
  }, [desk]);
}

/**
 * 🎠 The picked look in view in Style's grid (the phone's strip centres it sideways; a grid scrolls up and down) — on
 * opening Style and on picking another part. Only the grid scrolls: nothing else on the screen moves.
 */
export function useDeskLookInView(desk: boolean, tool: string, picked: string | null): void {
  useEffect(() => {
    if (!desk || tool !== 'style') return;
    const put = () => {
      const grid = document.querySelector<HTMLElement>(`[data-maker-desk] [data-phone-chrome="panel"] ${GRID}`);
      const on = grid?.querySelector<HTMLElement>('[data-style-card][aria-checked="true"]');
      if (!grid || !on) return;
      const top = on.offsetTop - grid.offsetTop;
      if (top < grid.scrollTop || top + on.offsetHeight > grid.scrollTop + grid.clientHeight) grid.scrollTop = Math.max(0, top - 8);
    };
    /* The looks are the work area's and arrive a moment after the tool (their pictures later still). */
    const t = [120, 600, 1500].map((ms) => window.setTimeout(put, ms));
    return () => t.forEach((x) => window.clearTimeout(x));
  }, [desk, tool, picked]);
}
