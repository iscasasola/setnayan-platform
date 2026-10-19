'use client';

import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useMaker } from './maker-context';
import { STUDIO_FORM_ITEMS, STUDIO_INFO_HAIRLINE_CSS, STUDIO_MARCH_TRAY_PX, STUDIO_PAGE, STUDIO_PAGE_ITEMS, STUDIO_SKIN_CSS } from '@/lib/studio-details';

/**
 * 🖥 THE NEW MAKER ON A DESKTOP — THREE COLUMNS (owner 2026-10-07, all "A" on
 * `MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md`; DECISION_LOG 2026-10-15 "DESKTOP MOVES AHEAD OF THE ADMIN
 * DASHBOARD" · "DESKTOP COVERS THE WHOLE APP — FOUR AREAS, IN ORDER", area 1 = the Maker).
 *
 *   ┌──────────────── the top nav: ✕ Exit · [Stages | Studio] ··· 👁 Preview · ↺ Undo · ✓ Apply ────────────────┐
 *   │ PARTS (264, from 1280) │            THE PAGE (what is left)            │ TOOLS (384) — the lower third │
 *   └────────────────────────┴───────────────────────────────────────────────┴───────────────────────────────┘
 *
 * NOTHING IS ADDED: every word, control and order is the phone's — only where things sit changes. The shell is the
 * phone's own tree; on a desktop it wears `data-maker-desk` (`maker-shell.tsx`, never on a phone) and THIS rule set
 * lays that same tree out in columns. So a phone is untouched by construction: none of these rules can match a
 * phone (no `data-maker-desk` there), and this module is mounted only under `desk` by the lazy Stages | Studio
 * switch (`stages-studio-parts.tsx`) — it is never in the Maker's first load.
 *
 *   · 1024–1279 (an iPad landscape, a small laptop window): two columns — the parts column folds away (owner's "A"
 *     for answer 2); the page's own pages are the guests' tab bar under it, as on the phone.
 *   · ≥ 1280: three — parts 264 · page · tools 384 (answer 5, "Fixed").
 *   · Studio's home and a full-screen Studio tool draw no lower third: the page column then takes the whole width.
 *
 * The top nav keeps its four controls and shows their WORDS (the phone shows icons): a word is drawn by the rule
 * set (`::after`), so the phone's buttons — and the Maker's first load — carry not one byte more. Their names are
 * their `aria-label`s, as on the phone.
 */
export function MakerDesk() {
  useDeskPopAnchor();
  useDeskGuestDesktop();
  /* Drawn INTO the shell (a grid cell of its own), wherever the switch that mounts it sits. */
  const [shell, setShell] = useState<HTMLElement | null>(null);
  /* 🏷 …and MARKS it (`data-maker-desk`): the one switch every desk rule needs — set here, in lazy code, never by
     the shell (the Maker's first load carries no byte of the desktop). Gone the moment this unmounts (a phone's width). */
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>('[data-maker-shell]');
    setShell(el);
    el?.setAttribute('data-maker-desk', '');
    return () => el?.removeAttribute('data-maker-desk');
  }, []);
  /* 🏷 …and the event's name in the middle of its top bar (the doc's "Top nav": "the event's name in the middle"). */
  const title = useMaker()?.deskTitle ?? null;
  const bar = shell?.querySelector<HTMLElement>(':scope > [data-maker-toolbar]') ?? null;
  if (!shell) return null;
  return createPortal(
    <>
      <style>{MAKER_DESK_CSS}</style>
      {title && bar
        ? createPortal(
            <p data-maker-desk-title="" className="pointer-events-none truncate text-center font-serif text-[15px] text-[var(--sp-ink2,#5C564F)]">
              Event Hub · {title}
            </p>,
            bar,
          )
        : null}
      {/* 🗂 THE PARTS OF THIS PAGE — the left column. The Stages toolbar fills it (`stage-tools.tsx` → `DeskParts`),
          because it is the one that knows the page's parts and picks them; on Studio's side it stays empty. */}
      <aside aria-label="Parts of this page" data-maker-desk-parts="" ref={setDeskPartsSlot} />
    </>,
    shell,
  );
}

/**
 * 🖱 THE HOVER RING — one soft gold ring, 2 px, on pressable things only (the desktop system sheet's piece 6,
 * `event_hub_one_page_and_desktop_2026-10-15_fable.html`, approved 2026-10-15: "the Maker desktop's ring"). Read-only
 * text never reacts. The keyboard's focus ring stays the app's own.
 */
export const DESK_GOLD = '#A9834B';
export const DESK_HOVER_RING = 'hover:shadow-[0_0_0_2px_#A9834B]';

/** A guest's desktop — the width Preview ▾ Desktop draws the page at before scaling it into the page column. */
export const DESK_GUEST_PX = 1280;
/** The scale, said by `useDeskGuestDesktop` on the shell. */
const PV_K = '--desk-pv-k';

/** The width of the tools column and of the parts column (answer 5: "Fixed"). */
export const DESK_TOOLS_PX = 384;
export const DESK_PARTS_PX = 264;
/** From here the parts column is drawn; under it, two columns (answer 2: "Fold"). */
export const DESK_PARTS_FROM_PX = 1280;

const D = '[data-maker-shell][data-maker-desk]';
/** The canvas while Preview ▾ is on Desktop (a phone's preview keeps its 430-px box). */
const PV = `${D} [data-maker-canvas-frames][class~="max-w-none"]`;
/** Studio's screen (a full-screen tool) — and Studio's side's workspace (every tool, Look too) — the desk switch on both. */
const S = `${D}[data-maker-studio-full]`;
const WS = `${D}:not(:has([data-stage-tools])) [data-details-workspace]`;
const onItems = (keys: readonly string[]) => `:is(${keys.map((k) => `[data-details-item="${k}"]`).join(',')})`;
/** The work area — the shell's one child that holds the work (no marker of its own: not a byte more in the first load). */
export const WORK = 'div:has([data-maker-work-area])';
/** A phone's sheet (`MakerSheet` without `everyWidth`) while a desktop's Maker is open — portalled to the body. */
const POP = 'html:has([data-maker-desk]) [data-maker-sheet][class~="lg:hidden"]';
/** …placed downward (under its button) or upward (over it). */
const popAt = (dir: 'down' | 'up') => `html[data-desk-pop="${dir}"]:has([data-maker-desk]) [data-maker-sheet][class~="lg:hidden"] [role="dialog"]`;
/** The phone's own words for its four controls (`MAKER_TOOLBAR_STAGES_STUDIO`, maker-bar.ts) — drawn, not re-typed. */
const WORD = 'font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap';
const BAR_PILL = 'width:auto!important;min-width:44px;padding:0 16px 0 12px;gap:8px';

/** Studio's tools that take the width (the doc's "Mood Board · Logo · Wedding March · Seat plan use the width"). */
export const DESK_STUDIO_WIDE_ITEMS = ['mood-board', 'logo', 'march', 'seating'] as const;
/** "The form in one comfortable column (760 px)" — and the width the four above take (1100 px). */
export const DESK_STUDIO_COLUMN_PX = 760;
export const DESK_STUDIO_WIDE_PX = 1100;

/**
 * A rule set written for a phone's Studio, made a desktop's: every selector is given the desk switch — the Studio
 * screen's own marker (`[data-maker-studio-full]`, on the shell) becomes the shell's with the switch, and a selector
 * without it is put under it. The rules themselves are the phone's, untouched.
 */
export function deskScoped(css: string, shell: string): string {
  return css.replace(/([^{}]+)\{/g, (_m, head: string) => {
    const parts: string[] = [];
    let depth = 0;
    let cur = '';
    for (const ch of head) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        parts.push(cur);
        cur = '';
      } else cur += ch;
    }
    parts.push(cur);
    const scoped = parts.map((p) => {
      const t = p.trim();
      return t.startsWith('[data-maker-studio-full]') ? t.replace('[data-maker-studio-full]', `${shell}[data-maker-studio-full]`) : `${shell}[data-maker-studio-full] ${t}`;
    });
    return `${scoped.join(',')}{`;
  });
}

export const MAKER_DESK_CSS =
  '@media (min-width:1024px){' +
  /* ── the grid: the bar, a row for the View-as strip, then the columns ── */
  `${D}{display:grid!important;grid-template-columns:0 minmax(0,1fr) ${DESK_TOOLS_PX}px;grid-template-rows:auto auto minmax(0,1fr)}` +
  `${D}>*{grid-column:1/-1;grid-row:2}` +
  /* The bar's menus (👁 Preview) open over the columns under it. */
  `${D}>[data-maker-toolbar]{grid-row:1;height:60px;padding:0 12px;gap:8px;z-index:40}` +
  `${D}>${WORK}{grid-column:2;grid-row:3}` +
  `${D}:not(:has(>[data-maker-lower-third]))>${WORK}{grid-column:1/-1}` +
  /* Studio's side (its home, a tool, Look) is Studio's own page — it takes the width; the tools and parts columns
     are the Stages toolbar's (Studio's own widths are the build plan's PR 5). */
  `${D}:not(:has([data-stage-tools]))>${WORK}{grid-column:1/-1}` +
  `${D}:not(:has([data-stage-tools]))>:is([data-maker-lower-third],[data-maker-desk-parts]){display:none!important}` +
  `${D}>[data-maker-lower-third]{grid-column:3;grid-row:3;display:flex!important;height:auto!important;min-height:0;padding:0!important;border-top:0;border-left:1px solid rgba(44,42,41,.1)}` +
  `${D}>[data-maker-desk-parts]{grid-column:1;grid-row:3;min-height:0;overflow:hidden;border-right:1px solid rgba(44,42,41,.1);background:#FBFAF7}` +
  /* ── the top nav: the phone's four controls with their words; the old desktop's Page ▾ and Event Details go ── */
  `${D} [data-maker-tool="page"],${D} [data-maker-toolbar] [data-maker-tool="details"]{display:none!important}` +
  `${D} [data-maker-tool="side"]{display:flex!important;flex:0 1 380px;min-width:300px}` +
  `${D} [data-maker-tool="exit"]{${BAR_PILL};background:#B3261E;color:#FFF}` +
  `${D} [data-maker-tool="exit"]:hover{background:#9A1F19;color:#FFF}` +
  `${D} [data-maker-tool="exit"]>svg:first-child{display:block!important}` +
  `${D} [data-maker-tool="exit"]>svg:last-child{display:none!important}` +
  `${D} [data-maker-tool="exit"]::after{content:"Exit";${WORD}}` +
  `${D} [data-maker-draft-actions] [data-bar-item="Undo"]{${BAR_PILL};background:rgba(44,42,41,.06)}` +
  `${D} [data-maker-draft-actions] [data-bar-item="Undo"]::after{content:"Undo";${WORD}}` +
  `${D} [data-maker-tool="preview"]{${BAR_PILL};background:rgba(44,42,41,.06);margin-left:8px}` +
  `${D} [data-maker-tool="preview"]::after{content:"Preview";${WORD}}` +
  `${D} [data-maker-apply] button[data-bar-item]{${BAR_PILL};background:rgb(var(--ramp-success-600));color:#FFF}` +
  `${D} [data-maker-apply] button[data-bar-item]:hover{background:rgb(var(--ramp-success-700))}` +
  `${D} [data-maker-apply] button[data-bar-item]:disabled{background:rgba(44,42,41,.1);color:rgba(44,42,41,.4)}` +
  `${D} [data-maker-apply] button[data-bar-item]::after{content:"Apply";${WORD}}` +
  `${D} [data-icon-pill]{gap:8px}` +
  /* 👁 PREVIEW ▾ DESKTOP IS A GUEST'S REAL DESKTOP PAGE (answer 4, "Real"): the page column is narrower than a
     desktop, so the page is drawn at a guest's desktop width and scaled into it (`useDeskGuestDesktop`) — the
     canvas's own measures read the scale (`partBox`'s `k`), so a tap and the picked part's frame land true. */
  `${PV}{overflow:hidden}` +
  `${PV}>iframe{width:${DESK_GUEST_PX}px!important;height:calc(100% / var(${PV_K},1))!important;right:auto!important;bottom:auto!important;transform:scale(var(${PV_K},1));transform-origin:0 0}` +
  `${D}>[data-maker-toolbar]{position:relative}` +
  `${D} [data-maker-desk-title]{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:300px;margin:0}` +
  /* The phone's bar says why a control is grey in its title, not an ⓘ beside it — so does this one. */
  `${D} [data-maker-draft-actions] button[data-bar-item]:disabled~span{display:none}` +
  /* 👁 Preview ▾ swaps the page — "Both" (the row after Phone / Desktop) is dropped (answer 1), and the old scenes
     column is the parts column's. */
  `${D} [data-maker-tool-menu] button:has([data-maker-tool-row="view"])+button:not(:has([data-maker-tool-row])),${D} [data-maker-tool-menu] button:has([data-maker-tool-row="scenes"]){display:none}` +
  /* ── the page: the old desktop's scenes column, See as ▾ over it and the Event Bar switch under it are the
        phone's elsewhere (the parts column · ▶ held · Studio) ── */
  `${D} nav[aria-label="Scenes"],${D} [data-maker-see-as],${D} [data-maker-guest-bars]{display:none!important}` +
  `${D} [data-maker-guest-bars-label]{display:none}` +
  /* ── the tools column: the phone's lower third, full height — no handle, no resting height, no curve ── */
  `${D} [data-maker-lower-third]>[data-lt-grab],${D} [data-stage-handle],${D} [data-stage-keys]{display:none!important}` +
  `${D} [data-maker-lower-third]:has(>[data-stage-tools])>:not([data-stage-tools]){display:none}` +
  `${D} [data-stage-tools]{border-radius:0;box-shadow:none;padding:12px 14px 0}` +
  `${D} [data-maker-lower-third]{background:var(--sp-page,#F3F0EA)}` +
  /* ── 🗨 THE MAKER'S ONE SHEET IS A POP-OVER BESIDE ITS BUTTON (the doc's "Sheets": anchored, 400 px, opening
        downward or upward to fit; nothing opens from the bottom of the screen). Only the phone's sheets — the ✕ sheet
        and "What guests see", drawn on every width already, keep their own shape. The place is the press that opened
        it (`useDeskPopAnchor`). ── */
  `${POP}{display:block!important}` +
  `${POP} [data-maker-sheet-dark]{display:none}` +
  `${POP} [role="dialog"]{left:clamp(8px,var(--desk-pop-left,8px),calc(100vw - 408px))!important;right:auto!important;width:400px;max-width:none!important;margin:0!important;border-radius:18px!important;padding-bottom:8px!important;box-shadow:0 24px 48px -20px rgba(30,26,18,.45)!important}` +
  `${popAt('down')}{top:var(--desk-pop-top,64px);bottom:auto!important;max-height:calc(100dvh - var(--desk-pop-top,64px) - 16px)!important}` +
  `${popAt('up')}{bottom:var(--desk-pop-bottom,16px)!important;max-height:calc(100dvh - var(--desk-pop-bottom,16px) - 16px)!important}` +
  `${POP} [role="dialog"]>span[aria-hidden]:first-child{display:none}` +
  /* ── 🎨 STUDIO ON A DESKTOP (the doc's "Studio"; build plan PR 5): each tool is the phone's own screen — its form, or
        its page — no old navigator beside it (Studio ▾ in the top bar lists the pages, as on the phone), the form in
        one comfortable column, the four big tools the width, Look its page beside its controls. Which half a tool
        shows is the phone's own list (`STUDIO_FORM_ITEMS` · `STUDIO_PAGE_ITEMS`, `lib/studio-details.ts`). ── */
  `${WS} [data-phone-chrome="strip"]{display:none!important}` +
  `${WS}{background:${STUDIO_PAGE}}` +
  `${WS} [data-details-row]{width:100%;max-width:${DESK_STUDIO_COLUMN_PX}px;margin-inline:auto}` +
  `${WS}${onItems(DESK_STUDIO_WIDE_ITEMS)} [data-details-row]{max-width:${DESK_STUDIO_WIDE_PX}px}` +
  /* A form is the form alone, the column's width — its preview is the phone's too: not drawn. */
  `${WS}${onItems(STUDIO_FORM_ITEMS)} [data-details-body]{display:none!important}` +
  `${WS}${onItems(STUDIO_FORM_ITEMS)} [data-details-editor-panel]{width:100%!important;border-left:0!important;background:${STUDIO_PAGE}!important}` +
  `${WS} [data-details-editor-panel]>p[class~="lg:block"]{display:none!important}` +
  /* A page (the Schedule, the Love Story, the Mood Board) and the Seat plan are the page alone. */
  `${WS}${onItems([...STUDIO_PAGE_ITEMS, 'seating'])} [data-details-editor-panel]{display:none!important}` +
  /* 🚶 The march: its walks, then the Not-walking tray at the foot (the parents are the march's own rows). */
  `${WS}${onItems(['march'])} [data-details-row]{flex-direction:column}` +
  `${WS}${onItems(['march'])} [data-details-editor-panel]{width:100%!important;height:${STUDIO_MARCH_TRAY_PX}px!important;border-left:0!important;border-top:1px solid rgba(44,42,41,.1)}` +
  `${S} [data-march-parents]{display:none}` +
  /* 🌄 Look: the page beside its controls — two columns, the controls the tools column's width. */
  `${WS}:has([data-details-editor]:not([hidden]) [data-studio-look-bar]) [data-details-row]{max-width:none}` +
  `${WS} [data-details-editor-panel]:has([data-details-editor]:not([hidden]) [data-studio-look-bar]){width:${DESK_TOOLS_PX}px!important}` +
  `${WS} [data-details-editor-panel]:has([data-details-editor]:not([hidden]) [data-studio-look-bar]) [data-details-sheet-head]{display:none!important}` +
  /* …its background previews as a 2-column grid (the doc's "the background previews as a 2-column grid"). */
  `${WS} [data-details-editor-panel] [data-bg-cards]{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;overflow:visible!important;margin-inline:0!important;padding-inline:0!important}` +
  `${WS} [data-details-editor-panel] [data-bg-cards]>[data-bg-card]{width:auto!important}` +
  `${WS} [data-details-editor-panel] [data-bg-cards]>[data-bg-card]>:first-child{width:100%!important;height:auto!important;aspect-ratio:3/4}` +
  `${WS} [data-details-editor-panel] [data-bg-cards]>[data-bg-card]:not([aria-pressed="true"]):hover>:first-child{box-shadow:0 0 0 2px ${DESK_GOLD}}` +
  /* The home of tiles, in four columns (kept until the owner says whether it goes — the bar no longer leads there). */
  `${D} [data-studio-home]>*{max-width:${DESK_STUDIO_WIDE_PX}px;margin-inline:auto}` +
  `${D} [data-studio-home] [data-studio-cards]{grid-template-columns:repeat(4,minmax(0,1fr))}` +
  /* The phone's form skin (rows, the warm page, the switches) — the same rules, on the desktop's screen. */
  deskScoped(STUDIO_SKIN_CSS + STUDIO_INFO_HAIRLINE_CSS, D) +
  '}' +
  `@media (min-width:${DESK_PARTS_FROM_PX}px){${D}{grid-template-columns:${DESK_PARTS_PX}px minmax(0,1fr) ${DESK_TOOLS_PX}px}}` +
  `@media (max-width:${DESK_PARTS_FROM_PX - 0.02}px){${D}>[data-maker-desk-parts],${D} [data-maker-desk-title]{display:none}}`;

/**
 * 🗨 Where the next pop-over opens: under the button just pressed (or over it, when the button sits low on the
 * screen). Read off the press itself, so every sheet — the stage list, Studio's pages, ＋ Add a part — opens beside
 * the control that opened it with no change to that control.
 */
function useDeskPopAnchor(): void {
  useEffect(() => {
    const root = document.documentElement;
    const onPress = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== 'Enter' && e.key !== ' ') return;
      const el = (e.target as Element | null)?.closest?.('button,[role="button"],a');
      if (!el || el.closest('[data-maker-sheet]')) return;
      const r = el.getBoundingClientRect();
      const up = r.bottom + 8 > window.innerHeight * 0.55;
      root.dataset.deskPop = up ? 'up' : 'down';
      root.style.setProperty('--desk-pop-left', `${Math.round(r.left)}px`);
      root.style.setProperty('--desk-pop-top', `${Math.round(r.bottom + 8)}px`);
      root.style.setProperty('--desk-pop-bottom', `${Math.round(window.innerHeight - r.top + 8)}px`);
    };
    window.addEventListener('pointerdown', onPress, true);
    window.addEventListener('keydown', onPress, true);
    return () => {
      window.removeEventListener('pointerdown', onPress, true);
      window.removeEventListener('keydown', onPress, true);
      delete root.dataset.deskPop;
      for (const v of ['--desk-pop-left', '--desk-pop-top', '--desk-pop-bottom']) root.style.removeProperty(v);
    };
  }, []);
}

/**
 * 👁 The scale a guest's desktop page is drawn at in the page column: the column's width over a guest's desktop
 * (never more than 1). Read off the box the canvas stands in — its width does not wait for the preview's own
 * width transition — whenever the work area changes or the window is resized.
 */
function useDeskGuestDesktop(): void {
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('[data-maker-shell]');
    const work = shell?.querySelector<HTMLElement>(`:scope > ${WORK}`);
    if (!shell || !work) return;
    let raf = 0;
    let last = '';
    const say = () => {
      raf = 0;
      const box = work.querySelector<HTMLElement>('[data-maker-canvas-frames]')?.parentElement;
      const k = box && box.clientWidth > 0 ? Math.min(1, box.clientWidth / DESK_GUEST_PX) : 1;
      const v = k.toFixed(4);
      if (v === last) return;
      last = v;
      shell.style.setProperty(PV_K, v);
    };
    const soon = () => {
      if (!raf) raf = window.requestAnimationFrame(say);
    };
    say();
    const ro = new ResizeObserver(soon);
    ro.observe(work);
    const mo = new MutationObserver(soon);
    mo.observe(work, { childList: true, subtree: true });
    window.addEventListener('resize', soon);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', soon);
      if (raf) window.cancelAnimationFrame(raf);
      shell.style.removeProperty(PV_K);
    };
  }, []);
}

/* ── the parts column's place, handed to the Stages toolbar (one at a time) ── */
let partsSlot: HTMLElement | null = null;
const subs = new Set<() => void>();
function setDeskPartsSlot(el: HTMLElement | null): void {
  if (el === partsSlot) return;
  partsSlot = el;
  subs.forEach((f) => f());
}
/** Where the Stages toolbar draws the parts column — null on a phone, under 1280 px it is drawn but not shown. */
export function useDeskPartsSlot(): HTMLElement | null {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    () => partsSlot,
    () => null,
  );
}
