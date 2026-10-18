/**
 * apps/web/lib/scene-slot-pick.ts — WHAT ONE PICK IN A SCENE OF THEIR OWN'S PICTURE SLOT DOES (the phone Maker's
 * Photos row, `stage-panel/scene-photos.tsx`, owner 2026-10-18). Pure: the desktop's slot rule (`applySceneSlot`) on the
 * Maker's copy of the canvas, and the slot's name in the desktop panel's own words. No I/O.
 */
import { SCENE_TEMPLATES } from './scene-templates';
import { canvasFingerprint } from './maker-draft-store';
import { sanitizeHubCanvas, type HubSectionCanvas } from './hub-canvas';
import { applySceneSlot, type SlotPatch } from './scene-writes';

/** What one slot is called — "Photo", "Photo 2", "Clip" — the desktop panel's own words. */
export function slotName(template: number, index: number): string {
  const t = SCENE_TEMPLATES[template as keyof typeof SCENE_TEMPLATES];
  if (!t) return 'Photo';
  if (t.clip) return 'Clip';
  return t.media > 1 ? `Photo ${index + 1}` : 'Photo';
}

/** The slot's choices the template allows: a clip goes where the template takes moving pictures (the desktop's rule). */
export function slotTakesClips(template: number): boolean {
  const t = SCENE_TEMPLATES[template as keyof typeof SCENE_TEMPLATES];
  return Boolean(t && (t.clip || t.family === 'media' || t.family === 'media_text'));
}

/**
 * The scene's canvas with ONE slot changed — the desktop's rule (`applySceneSlot`) on the Maker's copy. Null: nothing
 * changes (the same picture again). The ownership fence is the server's, at ✓ Apply (`hub-draft-actions.ts`).
 */
export function slotCanvasNext(before: HubSectionCanvas, index: number, patch: SlotPatch): HubSectionCanvas | null {
  const w = applySceneSlot(before, index, patch, new Set(patch.media ? [patch.media] : []));
  if (!w.ok) return null;
  const next = sanitizeHubCanvas({ canvas: w.canvas });
  return canvasFingerprint(before) === canvasFingerprint(next) ? null : next;
}

