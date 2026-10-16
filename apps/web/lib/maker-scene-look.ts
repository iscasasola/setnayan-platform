/**
 * lib/maker-scene-look.ts — 🎨 A STYLE PICK IS ON THE PAGE AT THE TAP (owner 2026-10-15: *"i still feel doing/editing
 * using maker still takes so long before i see changes"*).
 *
 * MEASURED on the production build of the Maker lab (`controller-2026-10-12/maker-speed/MEASURE.md`, Chromium 4× CPU +
 * Fast 4G): a scene's Style card (Countdown → Big number) and a part's (Names → One line) changed NOTHING on the page
 * until the save had landed AND the guest page had re-rendered itself — 4.1–4.3 s at production latency — because a
 * style is a different component, which the bridge cannot draw (`makerRedrawSave`). And its ↺ took the slow path (a
 * whole-Maker render and a new canvas page, 8.7 s), because a redraw save left no inverse in the ↺ journal.
 *
 * 🔑 BOTH PICTURES ALREADY EXIST IN THE MAKER — so they are laid on the page at once:
 *   · the AFTER: the card the couple tapped IS the guest page itself, that part alone in that style
 *     (`stage-panel/style-preview.tsx`, `?only=<key>&style=<type>:<id>`) — its section is copied onto the canvas;
 *   · the BEFORE: the canvas's own section, copied at the tap — what the ↺ lays back.
 * The bridge lays a copy OVER the page's own section (`sceneLook` → `layScenePicture`, the page's own node kept,
 * hidden), and takes it off in the very commit that brings the server's render (`undoLaidPreviews`), the same way a
 * dragged scene's slides and ＋'s placeholder go. The in-place redraw still follows the save — it is what makes the
 * page live again (a countdown that ticks) — but it now runs BEHIND a page that already shows the pick.
 *
 * Never imports the bridge (the guest page's chunk): only `maker-section-find.ts`, as the Maker's canvas code does.
 */
import { SCENE_LOOK_COPY_ATTR, SCENE_LOOK_HIDDEN_ATTR, findMakerSection } from '@/app/[slug]/_components/maker-section-find';
import { noteDraftedCanvas } from './maker-draft-store';
import type { HubSectionCanvas } from './hub-canvas';
import { requestCanvasRedraw } from './maker-refresh';
import type { DrawnUndo, UndoStep } from './maker-drawn-undo';

/** The bridge message that lays a picture of one section over the page (`editor-bridge.tsx`). */
export const SCENE_LOOK_MESSAGE = 'sceneLook';

const SHOWN_FRAME = 'iframe[data-maker-canvas-frame="shown"]';
/** The miniature's own furniture (`style-preview.tsx`) — never carried onto the page. */
const MINI_ATTRS = ['data-sn-mini-scene', 'data-sn-mini-focus'];

/** The section key a preview key frames: `f:hero.names` → `f:hero`. */
export const sectionKeyOf = (canvasKey: string) => canvasKey.split('.')[0]!;

/** One section as a picture to lay: its HTML, scripts and the miniature's own marks taken out. Null: nothing to copy. */
export function sectionPicture(section: Element | null): string | null {
  if (!section) return null;
  const copy = section.cloneNode(true) as Element;
  copy.querySelectorAll('script').forEach((s) => s.remove());
  for (const a of [...MINI_ATTRS, SCENE_LOOK_COPY_ATTR, SCENE_LOOK_HIDDEN_ATTR]) {
    copy.removeAttribute(a);
    copy.querySelectorAll(`[${a}]`).forEach((e) => e.removeAttribute(a));
  }
  const html = copy.outerHTML;
  return html.length > 0 && html.length < 400_000 ? html : null;
}

/** The section of `key` on the page the Maker shows NOW — the BEFORE of a pick. */
export function shownSectionPicture(key: string, doc: Document = document): string | null {
  try {
    const d = doc.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentDocument;
    return d ? sectionPicture(findMakerSection(d, sectionKeyOf(key))) : null;
  } catch {
    return null;
  }
}

/**
 * The AFTER of a style pick: the drawn card of that style (`?only=<canvasKey>&style=<type>:<id>`), its section.
 * Null when that card is not drawn yet (still "Drawing…"): the pick then shows when the redraw lands, as before.
 */
export function cardSectionPicture(canvasKey: string, sceneType: string | null, styleId: string, doc: Document = document): string | null {
  try {
    for (const f of Array.from(doc.querySelectorAll<HTMLIFrameElement>('iframe[data-style-preview-frame]'))) {
      const src = f.getAttribute('src');
      if (!src) continue;
      const q = new URL(src, 'http://x').searchParams;
      const style = q.get('style') ?? '';
      if (q.get('only') !== canvasKey || (sceneType ? style !== `${sceneType}:${styleId}` : !style.endsWith(`:${styleId}`))) continue;
      const d = f.contentDocument;
      if (!d || d.readyState === 'loading') continue;
      const pic = sectionPicture(findMakerSection(d, sectionKeyOf(canvasKey)));
      if (pic) return pic;
    }
  } catch {
    /* a card on another origin, or gone mid-read: no picture */
  }
  return null;
}

/** Every canvas frame the Maker holds (the stage on show and its warm stages). */
function post(message: unknown): void {
  if (typeof document === 'undefined') return;
  document.querySelectorAll<HTMLIFrameElement>('iframe[data-maker-canvas-frame]').forEach((frame) => {
    frame.contentWindow?.postMessage(message, window.location.origin);
  });
}

/** Lay `html` over the section of `key` on every page the Maker shows — at once. */
export function drawScenePicture(key: string, html: string): void {
  post({ source: 'setnayan-editor', t: SCENE_LOOK_MESSAGE, key: sectionKeyOf(key), html });
}

/**
 * ↺ The inverse of a redraw-saved pick: the BEFORE picture laid back at once (and the Maker's own copy of the canvas,
 * when it has one); once the ↺'s own held save lands, the page redraws in place so it is live again. A refused ↺ lays
 * the AFTER back. With no BEFORE picture (no canvas shown at the tap) it is not drawn: the slow path, as before.
 */
export function scenePictureUndo(
  key: string,
  before: string | null,
  canvas?: { type: string; before: HubSectionCanvas; next: HubSectionCanvas; server: HubSectionCanvas | null | undefined },
  onUndone?: (undone: boolean) => void,
): UndoStep {
  return {
    undraw: (): DrawnUndo | null => {
      if (!before) return null;
      const after = shownSectionPicture(key);
      drawScenePicture(key, before);
      if (canvas) noteDraftedCanvas(canvas.type, canvas.before, canvas.server);
      onUndone?.(true);
      return {
        settle: Promise.resolve('shown'),
        now: true,
        landed: (ok) => {
          if (ok) {
            /* the page is the BEFORE picture, still — the server's render makes it live again, in place */
            requestCanvasRedraw();
            return;
          }
          if (after) drawScenePicture(key, after);
          if (canvas) noteDraftedCanvas(canvas.type, canvas.next, canvas.server);
          onUndone?.(false);
        },
      };
    },
  };
}

/**
 * 🎨 THE TAP ON A STYLE CARD — the one door both style rows use (`use-scene-canvas.ts`, `fixed-scene-style-row.tsx`):
 * the BEFORE picture copied off the canvas, the tapped card's section laid on the page NOW, and only then the save,
 * HELD, with its ↺ in the journal. Returns the save (the caller reads its answer) and the BEFORE picture (a refused
 * save lays it back).
 */
export function styleTap<T>(at: {
  /** The section (or `section.part`) the cards frame — `w:countdown`, `f:hero.names`. */
  canvasKey: string;
  sceneType: string | null;
  styleId: string;
  send: () => Promise<T>;
  refresh: () => void;
  ok?: (result: T) => boolean;
  canvas?: Parameters<typeof scenePictureUndo>[2];
  onUndone?: (undone: boolean) => void;
  /** The save door — `makerRedrawSave` (a parameter so the guard drives this very function with its own clock). */
  save: (send: () => Promise<T>, refresh: () => void, o: { ok?: (result: T) => boolean; undo: UndoStep }) => Promise<T>;
}): { saved: Promise<T>; before: string | null; drawn: boolean } {
  const before = shownSectionPicture(at.canvasKey);
  const after = cardSectionPicture(at.canvasKey, at.sceneType, at.styleId);
  if (after) drawScenePicture(at.canvasKey, after);
  const saved = at.save(at.send, at.refresh, { ...(at.ok ? { ok: at.ok } : {}), undo: scenePictureUndo(at.canvasKey, before, at.canvas, at.onUndone) });
  return { saved, before, drawn: Boolean(after) };
}
