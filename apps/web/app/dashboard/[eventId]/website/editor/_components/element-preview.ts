/**
 * ⚡ THE ELEMENT SHEET'S INSTANT PREVIEW — what it tells the canvas, and when
 * the canvas may keep its page instead of reloading.
 *
 * Owner, 2026-09-27, editing his own Event Hub: *"changing size does nothing"*
 * · *"the toolbars are not working"* · *"this applies to the rest of the
 * toolbar"*. Measured on production: the save WORKED, but the canvas showed it
 * only after ~6 s — ~3 s for the save and refresh, then the canvas iframe
 * REMOUNTED (its key carries `renderStamp`, a fresh `Date.now()` on every
 * server render) and took ~3 s more to load. To the couple every tap looked
 * dead.
 *
 * So, two halves:
 *
 *   1 · BEFORE the save, the sheet posts `elStyle` to the canvas and the bridge
 *       lays the choice on the part through the guest page's own functions
 *       (`editor-bridge.tsx`) — the change is on screen in one frame.
 *   2 · THE CANVAS HOLD. The save still refreshes the server render (the
 *       toolbar's Apply · Undo · Restore count reads the draft there), but the
 *       canvas iframe keeps its page for a render whose canvases are exactly
 *       what the canvas already shows. Any render that differs — Undo,
 *       Restore, a background, a scene order — or one that arrives after the
 *       hold lapsed, reloads the canvas exactly as before.
 *
 * Pure. No DOM, no React — `element-preview.test.ts` drives every rule here.
 */
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubElementKey, HubElementStyles } from '@/lib/element-style';

/* ── 1 · WHAT THE CANVAS IS TOLD ─────────────────────────────────────────── */

export type ElementPreviewMessage = {
  source: 'setnayan-editor';
  t: 'elStyle';
  /** The navigator key the sheet was opened from (`f:hero`, `w:<type>`). */
  key: string;
  el: HubElementKey;
  /** The scene's whole element map — a scene's `<style>` is written from all of it. */
  elements: HubElementStyles | null;
  /** The element's motion changed: re-lay its animation (never for a font or colour). */
  motion: boolean;
  /** Replay the element's In after laying it, so a new arrival is SEEN. */
  replay: boolean;
};

const motionOf = (canvas: HubSectionCanvas | null | undefined, el: HubElementKey) =>
  JSON.stringify(canvas?.elements?.[el]?.motion ?? null);

/**
 * The preview for moving the element from `before` to `next`. `replay` only on
 * a CHOICE the couple just made (`choice`), never on a revert — a failed save
 * puts the old look back quietly.
 */
export function elementPreview(
  key: string,
  el: HubElementKey,
  before: HubSectionCanvas | null | undefined,
  next: HubSectionCanvas,
  choice = true,
): ElementPreviewMessage {
  const motion = motionOf(before, el) !== motionOf(next, el);
  return {
    source: 'setnayan-editor',
    t: 'elStyle',
    key,
    el,
    elements: next.elements ?? null,
    motion,
    replay: choice && motion && Boolean(next.elements?.[el]?.motion?.in),
  };
}

/**
 * A SAVE CAME BACK REFUSED. When it was the latest choice, the canvas goes back
 * to the last SAVED canvas; when a later choice is already on its way, that
 * later save carries the whole canvas (the draft replaces a canvas whole), so
 * nothing is reverted and the later answer decides.
 */
export function revertAfterFailedSave(
  failed: HubSectionCanvas,
  latest: HubSectionCanvas,
  saved: HubSectionCanvas,
): HubSectionCanvas | null {
  return latest === failed ? saved : null;
}

/* ── 2 · THE CANVAS HOLD ─────────────────────────────────────────────────── */

/**
 * How long after an element choice a server render may be absorbed. A save and
 * its refresh took ~3–6 s on production; the hold is renewed by every choice,
 * and a render that differs from the canvas reloads it whatever the clock says.
 */
export const CANVAS_HOLD_MS = 15_000;

export type CanvasHold = {
  until: number;
  /** Every scene's canvas as the canvas iframe now SHOWS it, or null when not holding. */
  shows: Record<string, HubSectionCanvas> | null;
};

export const NO_CANVAS_HOLD: CanvasHold = { until: 0, shows: null };

/** A canvas map in one spelling — keys sorted, empty canvases dropped (absent = empty). */
export function canvasesFingerprint(canvases: Record<string, HubSectionCanvas> | null | undefined): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        const x = (v as Record<string, unknown>)[k];
        if (x !== undefined) out[k] = sort(x);
      }
      return out;
    }
    return v;
  };
  const kept: Record<string, unknown> = {};
  for (const [type, canvas] of Object.entries(canvases ?? {})) {
    if (canvas && Object.keys(canvas).length > 0) kept[type] = canvas;
  }
  return JSON.stringify(sort(kept));
}

/**
 * An element choice is on the canvas: hold it. `server` is the canvases the
 * last server render handed the shell; a hold already running keeps building on
 * what the canvas shows, so quick taps on two scenes both count.
 */
export function holdCanvas(
  hold: CanvasHold,
  server: Record<string, HubSectionCanvas>,
  widgetType: string,
  canvas: HubSectionCanvas,
  now: number,
): CanvasHold {
  const base = hold.shows && now < hold.until ? hold.shows : server;
  return { until: now + CANVAS_HOLD_MS, shows: { ...base, [widgetType]: canvas } };
}

/**
 * A NEW SERVER RENDER ARRIVED — may the canvas keep its page? Only while a hold
 * runs AND the render's canvases are exactly what the canvas already shows.
 * Anything else (no hold, a lapsed one, an Undo that changed a canvas) reloads.
 */
export function canvasKeepsItsPage(
  hold: CanvasHold,
  server: Record<string, HubSectionCanvas>,
  now: number,
): boolean {
  if (!hold.shows || now >= hold.until) return false;
  return canvasesFingerprint(hold.shows) === canvasesFingerprint(server);
}

/** The canvas a (re)opened sheet builds on: what the canvas shows while held, else the server's. */
export function heldCanvasFor(hold: CanvasHold, widgetType: string, now: number): HubSectionCanvas | null {
  if (!hold.shows || now >= hold.until) return null;
  return hold.shows[widgetType] ?? null;
}
