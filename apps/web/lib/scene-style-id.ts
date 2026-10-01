/**
 * 🎨 A STORED SCENE-STYLE ID — its shape, and nothing about which styles exist.
 *
 * Split from `lib/scene-styles.ts` (2026-09-29, the Maker JS budget): the canvas
 * sanitizer (`lib/hub-canvas.ts`), the fixed parts' picks and Post Event's looks
 * only need to know that a stored value is a well-formed id. Importing the
 * registry for that put every scene's style list into the first-load JavaScript
 * of every page that sanitizes a canvas — the Maker included. The registry —
 * not this — decides whether a style is drawn.
 *
 * Pure. No I/O. Client-safe.
 */

export const SCENE_STYLE_ID_RE = /^[a-z][a-z0-9-]{0,31}$/;

/** A stored style id, or undefined. The registry — not this — decides whether it is drawn. */
export function sanitizeSceneStyleId(v: unknown): string | undefined {
  return typeof v === 'string' && SCENE_STYLE_ID_RE.test(v) ? v : undefined;
}
