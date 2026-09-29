/**
 * apps/web/lib/scene-media-choices.ts — WHICH PICTURES A SCENE'S "UPLOAD MEDIA"
 * OFFERS, and where an in-place upload lands.
 *
 * Owner, 2026-09-28 (DECISION_LOG "“UPLOAD MEDIA” ON A SCENE BACKGROUND IS
 * ALWAYS THERE, UPLOADS IN PLACE, AND A PHOTO CAN BE PARALLAX"): *"where is the
 * upload media/: photo parallax effect or snippet that would run like the
 * background?"* Measured: the Maker offered only the hero photo + gallery, so an
 * event whose only picture was its Save the Date background saw no chip at all.
 *
 *   · the couple's EXISTING pictures — hero · gallery · the Save the Date's own
 *     UPLOADED background (`std_background.kind = 'upload'`; a library scene is
 *     Setnayan's picture, not theirs, and is not a `hubMediaRef`) · the one video;
 *   · anything they upload IN PLACE, into this event's own `scene-background`
 *     folder (the Main background's pattern: `<FileUpload>` → `/api/upload`,
 *     compressed in the browser, +0 server actions). Apply accepts that folder
 *     as the couple's own (`hub-draft-actions.ts`), like `main-background/`.
 *
 * Pure. No I/O — the editor page signs, in its one pass.
 */
import { hubMediaRef, sanitizeHubCanvas, resolveHubBackground } from './hub-canvas';
import { PUBLIC_R2_BUCKET } from './r2-client-ref';
import { resolveStdBackground } from './std-backgrounds';

/** The one folder a scene's in-place upload goes to: `events/<id>/scene-background/…`. */
export const SCENE_BACKGROUND_FOLDER = 'scene-background';

/** `pathPrefix` for `<FileUpload>` / `/api/upload`. */
export function sceneBackgroundPathPrefix(eventId: string): string {
  return `events/${eventId}/${SCENE_BACKGROUND_FOLDER}`;
}

/** The Save the Date background's ref when it is the couple's OWN upload, else null. */
export function stdBackgroundUploadRef(raw: unknown): string | null {
  const bg = resolveStdBackground(raw);
  return bg.kind === 'upload' ? hubMediaRef(bg.value) : null;
}

/** One in-place upload a scene already wears (drafted over live). */
export type SceneUploadRef = { ref: string; kind: 'photo' | 'snippet'; poster: string | null };

/**
 * THE SCENES' OWN UPLOADS — every scene background (and clip still) that lives
 * in this event's `scene-background` folder, from the canvases the Maker draws
 * (the draft over live), deduped. These are signed by the editor page so the
 * Upload media panel shows them as thumbnails after the save's refresh.
 */
export function sceneUploadRefs(eventId: string, configs: readonly unknown[]): SceneUploadRef[] {
  const prefix = `r2://${PUBLIC_R2_BUCKET}/${sceneBackgroundPathPrefix(eventId)}/`;
  const out = new Map<string, SceneUploadRef>();
  for (const config of configs) {
    const canvas = sanitizeHubCanvas(config);
    const bg = resolveHubBackground(canvas);
    if (!bg || (bg.kind !== 'photo' && bg.kind !== 'snippet')) continue;
    if (!bg.media.startsWith(prefix) || out.has(bg.media)) continue;
    const poster = bg.kind === 'snippet' && canvas.poster?.startsWith(prefix) ? canvas.poster : null;
    out.set(bg.media, { ref: bg.media, kind: bg.kind, poster });
  }
  return [...out.values()];
}
