/**
 * WHERE A `PickMenu` LIST OPENS — pure, so the placement is executed by a test,
 * not described by one.
 *
 * Measured live on production (2026-09-27, controller, commit 3e45275): the
 * element sheet's Font dropdown opened ENTIRELY below a 390×844 phone screen
 * (button at 455, list drawn at 880), and off the right edge of a 1440 desktop.
 * Two faults, fixed in two places:
 *
 *   1. CONTAINING BLOCK — the sheet is `.sn-glass-bare`, whose `backdrop-filter`
 *      makes it the containing block for every `position: fixed` descendant, so
 *      viewport coordinates were added to the sheet's own offset. `PickMenu`
 *      now portals the list to `document.body`; that fix lives there.
 *   2. NO ROOM BELOW — "Home ▾" sits near the bottom of a phone, and a list
 *      that always opens downward shows ~66px of itself. THIS function decides:
 *      below when it fits; otherwise ABOVE when there is more room above; and
 *      the height is always capped to the room on the chosen side, so a long
 *      list scrolls inside itself instead of leaving the screen.
 *
 * All figures are CSS pixels in viewport coordinates (getBoundingClientRect).
 */

import { createContext, type ReactNode } from 'react';

/** Gap between the button and the list. */
export const PICK_LIST_GAP = 6;
/** Distance the list always keeps from every screen edge. */
export const PICK_LIST_MARGIN = 8;
/** The list is never narrower than this, nor than its button. */
export const PICK_LIST_MIN_WIDTH = 160;
/** Never taller than this share of the screen, even with room (was `max-h-[60dvh]`). */
export const PICK_LIST_MAX_SHARE = 0.6;

export type PickListPlacement = {
  top: number;
  left: number;
  minWidth: number;
  /** The list scrolls inside itself past this. */
  maxHeight: number;
  side: 'below' | 'above';
};

export function placePickList({
  button,
  listHeight,
  viewport,
}: {
  /** The button's rect. */
  button: { top: number; bottom: number; left: number; width: number };
  /** The list's full content height (its `scrollHeight`), 0 before it has mounted. */
  listHeight: number;
  viewport: { width: number; height: number };
}): PickListPlacement {
  const minWidth = Math.max(button.width, PICK_LIST_MIN_WIDTH);
  const left = Math.max(PICK_LIST_MARGIN, Math.min(button.left, viewport.width - minWidth - PICK_LIST_MARGIN));

  const cap = Math.floor(viewport.height * PICK_LIST_MAX_SHARE);
  const want = Math.min(Math.max(0, listHeight), cap);
  const roomBelow = Math.max(0, viewport.height - button.bottom - PICK_LIST_GAP - PICK_LIST_MARGIN);
  const roomAbove = Math.max(0, button.top - PICK_LIST_GAP - PICK_LIST_MARGIN);

  if (want <= roomBelow || roomBelow >= roomAbove) {
    return {
      top: button.bottom + PICK_LIST_GAP,
      left,
      minWidth,
      maxHeight: Math.min(cap, roomBelow),
      side: 'below',
    };
  }
  const maxHeight = Math.min(cap, roomAbove);
  const drawn = Math.min(want, maxHeight);
  return {
    top: button.top - PICK_LIST_GAP - drawn,
    left,
    minWidth,
    maxHeight,
    side: 'above',
  };
}

/**
 * The list's RUNS: consecutive options that share a `group` sit under one
 * heading; options with no group (every picker but the compact Maker bar) form
 * a run with `group: null` and are drawn with no heading at all. Order is kept
 * exactly — a group is never gathered from two places in the list.
 */
export function pickRuns<T extends { group?: string }>(options: readonly T[]): { group: string | null; options: T[] }[] {
  const runs: { group: string | null; options: T[] }[] = [];
  for (const o of options) {
    const g = o.group ?? null;
    const last = runs[runs.length - 1];
    if (last && last.group === g) last.options.push(o);
    else runs.push({ group: g, options: [o] });
  }
  return runs;
}

/** A group heading's classes; `sticky` pins it while its own options scroll under it. */
export function groupHeadClass(sticky: boolean): string {
  return `px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50 ${
    sticky ? 'sticky top-0 z-[1] rounded-lg bg-cream/95' : ''
  }`;
}

/** A font row is `content-visibility: auto` — see the notes in `pick-menu-types.ts`. */
export function fontRowClass(fontFamily: string | undefined): string | undefined {
  return fontFamily ? '[contain-intrinsic-size:auto_44px] [content-visibility:auto]' : undefined;
}

/**
 * ▁ ON A PHONE IN THE NEW MAKER A LIST OPENS AS THE ONE BOTTOM SHEET (owner
 * 2026-10-06: every pop-up opens from the bottom; `MakerSheet`, launch/_components/maker-sheet.tsx).
 * The shell hands the sheet down (`PickSheetContext`) only while
 * `makerStagesStudioEnabled` is on; with none handed — every other page, and
 * the shipped Maker — a list opens where `placePickList` puts it, as before.
 */
export type PickSheet = (p: { label: string; onClose: () => void; children: ReactNode }) => ReactNode;
export const PickSheetContext = createContext<PickSheet | null>(null);
/** The list goes into the sheet: one was handed down, and the screen is a phone's (< lg). */
export function pickOpensAsSheet(sheet: boolean, viewportWidth: number): boolean {
  return sheet && viewportWidth < 1024;
}

/** The ▾ button. */
export function pickButtonClass(compact: boolean): string {
  return `sn-press sn-press-ring inline-flex min-w-0 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full bg-white/70 font-semibold text-ink transition-colors duration-300 ease-in-out hover:bg-white ${
    compact ? 'min-h-7 px-2 text-xs' : 'min-h-10 px-3 text-[13px]'
  }`;
}

/**
 * 🎨 THE DROPDOWN'S COLOURS (owner 2026-10-08, the approved template gallery: *"Dropdown — Chevron should be teracota
 * color?"* · "what is ON or PICKED is terracotta; what is off is grey"). Everywhere but the guest's Event Hub:
 *   · the ▾ is the accent — the small mark that says "you can tap this";
 *   · the PICKED option is said by accent words and an accent ✓ at its end — no longer a filled ink row;
 *   · a multi-pick's ✓ is the accent too (it was green).
 * The accent is the ONE token by its job (`accent`, `globals.css` `--sn-accent`) — never a colour written here.
 *
 * 🚪 THE ONE EXEMPTION — inside the guest's Event Hub (`.sn-editorial`, `app/[slug]`) nothing is app-styled: the ▾
 * takes the page's own ink (a CSS rule on the button's side, so it holds on the first paint), and the list — which
 * is portalled to <body>, outside the hub's box — is told by `pickInHub` and keeps the look it always had there.
 */
export function pickInHub(button: Element | null): boolean {
  return Boolean(button?.closest('.sn-editorial'));
}

/** The ▾ in the button: the accent; inside the guest's Event Hub, the page's own ink. Turns over while open. */
export function pickArrowClass(open: boolean): string {
  return `h-3.5 w-3.5 shrink-0 text-sn-accent transition-transform duration-300 [.sn-editorial_&]:text-inherit ${open ? 'rotate-180' : ''}`;
}

/** One option's row — `chosen` is the single-pick value: accent words (`plain`, the guest hub: the filled ink row it always was). */
export function pickOptionClass(roomy: boolean, chosen: boolean, plain = false): string {
  return `flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[14px] transition-colors duration-300 ease-in-out disabled:cursor-default disabled:text-ink/40 ${
    roomy ? 'py-2' : ''
  } ${chosen ? (plain ? 'bg-ink text-cream' : 'text-sn-accent hover:bg-ink/5') : 'text-ink hover:bg-ink/5'}`;
}

/** The ✓ at the end of a picked option (single- or multi-pick). After a trail it sits beside it, not pushed apart. */
export function pickTickClass(plain: boolean, afterTrail = false): string {
  return `${afterTrail ? 'pl-2' : 'ml-auto pl-3'} shrink-0 text-[14px] font-semibold ${plain ? 'text-success-700' : 'text-sn-accent'}`;
}

/** An option's trailing word or mark, in its tone — `onFill`: it sits on the hub's filled ink row and takes that row's ink. */
export function pickTrailClass(tone: 'ok' | 'left' | 'muted', onFill: boolean): string {
  return `ml-auto shrink-0 pl-3 text-[13px] font-semibold ${
    onFill ? 'opacity-80' : tone === 'ok' ? 'text-success-700' : tone === 'left' ? 'text-terracotta-700' : 'text-ink/50'
  }`;
}
