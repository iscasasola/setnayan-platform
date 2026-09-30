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

/* ── 2 · the canvas lays them — `lib/maker-live-preview-apply.ts` ─────────
   Its OWN module, imported only by the guest page's editor bridge: a module
   both the Maker and the guest page import is split into a chunk of its own,
   and every new chunk grows the webpack runtime every page downloads (the
   shared bundle has no bytes to spare). */
