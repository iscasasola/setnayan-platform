/**
 * apps/web/lib/maker-live-preview.ts — ⚡ THE LOVE STORY AND THE PROGRAMME, ON
 * THE CANVAS AT THE KEYSTROKE.
 *
 * Owner, 2026-09-30, on the Event Hub Maker: *"editing Our Story and the
 * Programme … so hard to edit … Takes so long to edit both. the delay of
 * response is terrible"*; earlier the same day: *"every edit alteration …
 * forces the whole screen to reload"*. DECISION_LOG "EVERYTHING REBUILT IN THE
 * MAKER IS INSTANT BY DESIGN": an edit is visible in < 150 ms through client
 * state + the editor bridge; the save runs behind it; the Maker is never
 * re-rendered for it.
 *
 * Three halves, one file:
 *
 *   1 · THE MESSAGES the Maker posts to its canvas frames (the editor bridge's
 *       own `source: 'setnayan-editor'`): `loveStory` — every scene's words,
 *       when and place; `scheduleMoment` — one moment's name, time and place.
 *       Posted through `postToMakerCanvas` (a window event the stage shell
 *       hears and broadcasts to the shown frame, the Both pane and every warm
 *       stage), so an editor in Details reaches the stages without holding a
 *       reference to their frames.
 *   2 · THE APPLIERS the canvas runs (`editor-bridge.tsx`): each lays the
 *       words on the page the server already drew — `[data-love-scene]` /
 *       `[data-schedule-moment]` — and fetches nothing, reloads nothing.
 *   3 · WHAT THE BRIDGE CANNOT DRAW (a moment added, removed, hidden or moved to
 *       another chapter; a programme moment shown or hidden) reloads the canvas
 *       once, AFTER its save has landed (`markMakerCanvasStale`) — double
 *       buffered, the old page stays until the new one is ready, and the Maker
 *       itself is never re-rendered.
 *
 * And the one flag a Maker save sets so its action revalidates nothing
 * (`MAKER_QUIET_FIELD`): a `revalidatePath` inside a server action makes its
 * answer carry a whole render of the page it was sent from — the Maker, 3–6 s
 * on production — whatever path it names.
 */

/* ── 0 · the quiet save ─────────────────────────────────────────────────── */

/**
 * `'1'` on a Maker save = the action writes, and revalidates NO path. Its value
 * is the one the RSVP stage's reply-by save already sends (`maker_quiet`).
 * Only cache freshness depends on it — never who may write what.
 */
export const MAKER_QUIET_FIELD = 'maker_quiet';

/** Was this write sent by the Maker, asking its action to revalidate nothing? */
export function makerQuietWrite(formData: { get(name: string): unknown }): boolean {
  return formData.get(MAKER_QUIET_FIELD) === '1';
}

/* ── 1 · Maker → the stage shell → its canvas frames ─────────────────────── */

/** A bridge message for every canvas frame the stage shell holds (`detail` = the message). */
export const MAKER_CANVAS_POST_EVENT = 'setnayan:maker-canvas-post';
/** The canvas frames show something the bridge could not draw: load them again, behind the page shown. */
export const MAKER_CANVAS_STALE_EVENT = 'setnayan:maker-canvas-stale';

export function postToMakerCanvas(message: unknown): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MAKER_CANVAS_POST_EVENT, { detail: message }));
}

export function markMakerCanvasStale(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(MAKER_CANVAS_STALE_EVENT));
}

export const LOVE_STORY_PREVIEW = 'loveStory';
export const SCHEDULE_PREVIEW = 'scheduleMoment';

export type LoveScenePreview = { id: string; when: string; chapterLabel: string; line: string; place: string };
export type ScheduleMomentPreview = { id: string; label?: string; time?: string; location?: string };

export function loveStoryPreviewMessage(scenes: readonly LoveScenePreview[]) {
  return { source: 'setnayan-editor', t: LOVE_STORY_PREVIEW, scenes: scenes.map((s) => ({ ...s })) } as const;
}

export function schedulePreviewMessage(moment: ScheduleMomentPreview) {
  return { source: 'setnayan-editor', t: SCHEDULE_PREVIEW, moment: { ...moment } } as const;
}

/* ── 2 · the canvas lays them (run inside the guest page's editor bridge) ── */

/** The part of the DOM an applier touches — a real document, or a test's. */
export type PreviewRoot = { querySelectorAll(selector: string): ArrayLike<PreviewEl> };
type PreviewEl = {
  textContent: string | null;
  hidden: boolean;
  querySelectorAll(selector: string): ArrayLike<PreviewEl>;
};

const TEXT_MAX = 2000;
const str = (v: unknown): string | null => (typeof v === 'string' ? v.slice(0, TEXT_MAX) : null);
/** Attribute-selector-safe: the ids the Maker sends are ours (`m…`, uuids) — anything else is dropped. */
const safeId = (v: unknown): string | null => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(v) ? v : null);

function setText(root: PreviewEl, selector: string, text: string): void {
  const list = root.querySelectorAll(selector);
  for (let i = 0; i < list.length; i++) {
    const el = list[i]!;
    if (el.textContent !== text) el.textContent = text;
  }
}

/** One optional line (a place): its words, hidden while empty. */
function setOptional(root: PreviewEl, selector: string, text: string): void {
  const list = root.querySelectorAll(selector);
  for (let i = 0; i < list.length; i++) {
    const el = list[i]!;
    if (el.textContent !== text) el.textContent = text;
    el.hidden = text.trim() === '';
  }
}

/**
 * Every Love Story scene on this page takes the Maker's words. Returns how many
 * scenes it found — 0 on a page that draws no such scene (the canvas's own
 * business; the Maker reloads it once the save lands if it had to).
 */
export function applyLoveStoryPreview(doc: PreviewRoot, raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  let found = 0;
  for (const s of raw.slice(0, 200)) {
    if (!s || typeof s !== 'object') continue;
    const r = s as Record<string, unknown>;
    const id = safeId(r.id);
    const line = str(r.line);
    if (!id || line === null) continue;
    const when = str(r.when) ?? '';
    const chapter = str(r.chapterLabel) ?? '';
    const place = str(r.place) ?? '';
    const scenes = doc.querySelectorAll(`[data-love-scene="${id}"]`);
    for (let i = 0; i < scenes.length; i++) {
      const el = scenes[i]!;
      found += 1;
      setText(el, '[data-love-line]', line);
      setText(el, '[data-love-when]', `${when ? `${when} · ` : ''}${chapter}`);
      setOptional(el, '[data-love-place]', place);
    }
  }
  return found;
}

/** One programme moment on this page takes the Maker's name, time and place. */
export function applySchedulePreview(doc: PreviewRoot, raw: unknown): number {
  if (!raw || typeof raw !== 'object') return 0;
  const r = raw as Record<string, unknown>;
  const id = safeId(r.id);
  if (!id) return 0;
  const rows = doc.querySelectorAll(`[data-schedule-moment="${id}"]`);
  for (let i = 0; i < rows.length; i++) {
    const el = rows[i]!;
    const label = str(r.label);
    if (label !== null && label.trim() !== '') setText(el, '[data-schedule-label]', label);
    const time = str(r.time);
    if (time !== null && time !== '') setText(el, '[data-schedule-time]', time);
    const location = str(r.location);
    if (location !== null) setOptional(el, '[data-schedule-location]', location);
  }
  return rows.length;
}
