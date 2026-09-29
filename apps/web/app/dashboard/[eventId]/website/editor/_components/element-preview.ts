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
 *       Restore, a scene order, a background pick that changes who draws the
 *       box (`backgroundPickRedrawsBox`) — or one that arrives after the hold
 *       lapsed, reloads the canvas exactly as before.
 *
 * Pure. No DOM, no React — `element-preview.test.ts` drives every rule here.
 */
import { hubBackgroundIsMedia, resolveHubBackground, type HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubElementKey, HubElementStyles } from '@/lib/element-style';
import { sceneWidgetIsBare } from '@/lib/scene-ground';

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
  /**
   * 🧭 WHICH SCENES THE CANVAS DRAWS, per stage, in order (`canvasOrderOf`) —
   * the second half of what the canvas shows. A hold started with it compares
   * it too, so a render that drew a different set of scenes (a scene shown, a
   * reorder, another tab's write) always reloads. Absent on a hold that was
   * started without it (the element sheet's own tests): canvases only.
   */
  order?: string | null;
};

export const NO_CANVAS_HOLD: CanvasHold = { until: 0, shows: null };

/**
 * The scenes each stage's canvas draws, in canvas order — ONE string, from the
 * navigator's own lists (`lib/maker-scene-list.ts`, the same resolver the page
 * asks). An empty scene is marked: filling it changes what is drawn.
 */
export function canvasOrderOf(
  stageLists: Record<string, { shown: ReadonlyArray<{ key: string; empty?: string }> }>,
): string {
  return Object.keys(stageLists)
    .sort()
    .map((stage) => `${stage}=${stageLists[stage]!.shown.map((t) => `${t.key}${t.empty ? '∅' : ''}`).join(',')}`)
    .join(';');
}

/**
 * 🙈 A SCENE TAKEN OFF THE PAGE: the order the canvas draws once `key` is no
 * longer drawn on ANY stage — exactly what the server's next render lists,
 * because a hidden scene moves to every stage's fold (`maker-scene-list.ts`).
 */
export function orderWithout(order: string, key: string): string {
  return order
    .split(';')
    .map((part) => {
      const at = part.indexOf('=');
      if (at < 0) return part;
      const keys = part.slice(at + 1).split(',').filter((k) => k.length > 0 && k.replace(/∅$/, '') !== key);
      return `${part.slice(0, at)}=${keys.join(',')}`;
    })
    .join(';');
}

type SceneGate = { mode: 'auto' | 'shown' | 'hidden'; isVisible: boolean };

/**
 * 👁 WHAT ONE EYE / Auto·Shown·Hidden WRITE DOES TO THE CANVAS — read the way
 * the page reads it: with open browsing ON, `mode` decides and `auto` falls
 * back to `is_visible` (`openBrowseSectionVisible`); with it OFF, the page
 * reads `is_visible` alone and `mode` changes nothing it draws.
 *
 *   'hide'    — a drawn scene leaves the page: the bridge hides it now, held;
 *   'none'    — nothing the canvas draws changes: held as it is;
 *   'show'    — a scene the page never drew must be drawn: reload;
 *   'unknown' — open browsing unread: reload (never guess).
 */
export function sceneDrawEffect(
  before: SceneGate,
  after: SceneGate,
  openBrowse: boolean | null | undefined,
): 'hide' | 'none' | 'show' | 'unknown' {
  if (typeof openBrowse !== 'boolean') return 'unknown';
  const drawn = (s: SceneGate) =>
    openBrowse ? (s.mode === 'hidden' ? false : s.mode === 'shown' ? true : s.isVisible) : s.isVisible;
  const was = drawn(before);
  const is = drawn(after);
  return was === is ? 'none' : was ? 'hide' : 'show';
}

/**
 * ⚡ ANY CHANGE THE BRIDGE HAS ALREADY DRAWN, held (owner 2026-09-28: *"picking
 * something takes a lot of time before the website reacts"*). The element
 * sheet's `holdCanvas` generalised: `canvases` are scenes whose canvas the
 * bridge laid (a background, a part, words), `order` the scenes it took off the
 * page (`orderWithout`). `server` is what the last render handed the shell; a
 * hold still running builds on what the canvas already shows.
 */
export function holdChange(
  hold: CanvasHold,
  server: { canvases: Record<string, HubSectionCanvas>; order: string },
  change: { canvases?: Record<string, HubSectionCanvas>; order?: (shown: string) => string },
  now: number,
): CanvasHold {
  const running = hold.shows && now < hold.until;
  const shows = running ? hold.shows! : server.canvases;
  const order = running && typeof hold.order === 'string' ? hold.order : server.order;
  return {
    until: now + CANVAS_HOLD_MS,
    shows: { ...shows, ...(change.canvases ?? {}) },
    order: change.order ? change.order(order) : order,
  };
}

/**
 * 🖼 A BACKGROUND PICK THAT CHANGES WHO DRAWS THE BOX CANNOT BE HELD.
 *
 * Owner, 2026-09-28, with a screenshot: Format → Background → "No background"
 * on the Countdown, and the canvas kept the Countdown's own pink card. The
 * draft was right and the server render was right — reloading the canvas frame
 * flipped its `data-scene-card="own"` to `"bare"`. The hold had kept the page:
 * the bridge paints the FRAME (`sceneBg`), but whether a widget draws its OWN
 * card is decided server-side (`lib/scene-ground.ts` `sceneWidgetIsBare`, read
 * by both dispatchers), and nothing the bridge lays can take that card off or
 * put it back.
 *
 * So a background pick is held only while every touched scene's answer to
 * "does the widget draw its own card?" is the same before and after — asked of
 * the SAME function the server asks (`sceneWidgetIsBare` → `hubBackgroundOwnsBox`),
 * never a second rule. When any answer flips, the shell releases the hold and
 * the save's render reloads the canvas through the buffered swap (no flash,
 * scroll kept). Both directions: no background at all → "No background" (the
 * card goes) and a background taken off entirely (the card comes back). A
 * photo or snippet whose URL the Maker does not hold cannot be answered — that
 * pick reloads too (never guess), as `sceneDrawEffect`'s 'unknown' does.
 */
export function backgroundPickRedrawsBox(
  before: Record<string, HubSectionCanvas>,
  after: Record<string, HubSectionCanvas>,
  mediaUrls: Readonly<Record<string, string>>,
): boolean {
  for (const type of Object.keys(after)) {
    const was = sceneCardBareFor(before[type] ?? {}, mediaUrls);
    const is = sceneCardBareFor(after[type]!, mediaUrls);
    if (was === null || is === null) return true;
    if (was !== is) return true;
  }
  return false;
}

/**
 * The server's answer to "does this scene's widget draw NO card of its own?"
 * for a canvas the Maker holds — `sceneWidgetIsBare` itself, never a second
 * rule — or `null` when it cannot be answered here (a photo or snippet whose
 * URL the Maker does not hold: never guess). Read by `backgroundPickRedrawsBox`
 * (release the hold) and by the `sceneBg` message (`scene-bg-preview-message.ts`
 * → the bridge swaps the card at once, `lib/scene-card-look.ts`).
 */
export function sceneCardBareFor(canvas: HubSectionCanvas, mediaUrls: Readonly<Record<string, string>>): boolean | null {
  const bg = resolveHubBackground(canvas);
  if (bg && hubBackgroundIsMedia(bg) && !(bg.media in mediaUrls)) return null;
  /* 🎞 The Maker's canvas is the couple's own (`ownClipPlays`) — their clip
     plays there, so ask the question the way that canvas answers it. */
  return sceneWidgetIsBare({ config_json: { canvas } }, mediaUrls, { ownClipPlays: true });
}

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
  /** The render's scene order (`canvasOrderOf`) — held too, so a render that drew other scenes reloads. */
  serverOrder?: string,
): CanvasHold {
  const running = hold.shows && now < hold.until;
  const base = running ? hold.shows! : server;
  const order = running && typeof hold.order === 'string' ? hold.order : (serverOrder ?? null);
  return { until: now + CANVAS_HOLD_MS, shows: { ...base, [widgetType]: canvas }, ...(order !== null ? { order } : {}) };
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
  /** The render's scene order (`canvasOrderOf`). A hold that carries an order must match it. */
  serverOrder?: string,
): boolean {
  if (!hold.shows || now >= hold.until) return false;
  if (typeof hold.order === 'string' && hold.order !== serverOrder) return false;
  return canvasesFingerprint(hold.shows) === canvasesFingerprint(server);
}

/** The canvas a (re)opened sheet builds on: what the canvas shows while held, else the server's. */
export function heldCanvasFor(hold: CanvasHold, widgetType: string, now: number): HubSectionCanvas | null {
  if (!hold.shows || now >= hold.until) return null;
  return hold.shows[widgetType] ?? null;
}
