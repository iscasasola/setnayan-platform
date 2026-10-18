'use client';

import { useSyncExternalStore } from 'react';

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
 * phone (no `data-maker-desk` there), and this module is lazy (`details-lazy.tsx`) — a phone never downloads it.
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
  return (
    <>
      <style>{MAKER_DESK_CSS}</style>
      {/* 🗂 THE PARTS OF THIS PAGE — the left column. The Stages toolbar fills it (`stage-tools.tsx` → `DeskParts`),
          because it is the one that knows the page's parts and picks them; on Studio's side it stays empty. */}
      <aside aria-label="Parts of this page" data-maker-desk-parts="" ref={setDeskPartsSlot} />
    </>
  );
}

/** The width of the tools column and of the parts column (answer 5: "Fixed"). */
export const DESK_TOOLS_PX = 384;
export const DESK_PARTS_PX = 264;
/** From here the parts column is drawn; under it, two columns (answer 2: "Fold"). */
export const DESK_PARTS_FROM_PX = 1280;

const D = '[data-maker-shell][data-maker-desk]';
/** The phone's own words for its four controls (`MAKER_TOOLBAR_STAGES_STUDIO`, maker-bar.ts) — drawn, not re-typed. */
const WORD = 'font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap';
const BAR_PILL = 'width:auto!important;min-width:44px;padding:0 16px 0 12px;gap:8px';

export const MAKER_DESK_CSS =
  '@media (min-width:1024px){' +
  /* ── the grid: the bar, a row for the View-as strip, then the columns ── */
  `${D}{display:grid!important;grid-template-columns:0 minmax(0,1fr) ${DESK_TOOLS_PX}px;grid-template-rows:auto auto minmax(0,1fr)}` +
  `${D}>*{grid-column:1/-1;grid-row:2}` +
  `${D}>[data-maker-toolbar]{grid-row:1;height:60px;padding:0 12px;gap:8px}` +
  `${D}>[data-maker-work]{grid-column:2;grid-row:3}` +
  `${D}:not(:has(>[data-maker-lower-third]))>[data-maker-work]{grid-column:1/-1}` +
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
  /* The phone's bar says why a control is grey in its title, not an ⓘ beside it — so does this one. */
  `${D} [data-maker-draft-actions] button[data-bar-item]~span{display:none}` +
  /* 👁 Preview ▾ swaps the page — "Both" is dropped (answer 1), and the old scenes column is the parts column's. */
  `${D} [data-maker-tool-menu] button:has([data-maker-tool-row="scenes"]){display:none}` +
  /* ── the page: the old desktop's scenes column, See as ▾ over it and the Event Bar switch under it are the
        phone's elsewhere (the parts column · ▶ held · Studio) ── */
  `${D} nav[aria-label="Scenes"],${D} [data-maker-see-as],${D} [data-maker-guest-bars]{display:none!important}` +
  `${D} [data-maker-guest-bars-label]{display:none}` +
  /* ── the tools column: the phone's lower third, full height — no handle, no resting height, no curve ── */
  `${D} [data-maker-lower-third]>[data-lt-grab],${D} [data-stage-handle],${D} [data-stage-keys]{display:none!important}` +
  `${D} [data-maker-lower-third]:has(>[data-stage-tools])>:not([data-stage-tools]){display:none}` +
  `${D} [data-stage-tools]{border-radius:0;box-shadow:none;padding:12px 14px 0}` +
  `${D} [data-maker-lower-third]{background:var(--sp-page,#F3F0EA)}` +
  '}' +
  `@media (min-width:${DESK_PARTS_FROM_PX}px){${D}{grid-template-columns:${DESK_PARTS_PX}px minmax(0,1fr) ${DESK_TOOLS_PX}px}}` +
  `@media (max-width:${DESK_PARTS_FROM_PX - 0.02}px){${D}>[data-maker-desk-parts]{display:none}}`;

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
