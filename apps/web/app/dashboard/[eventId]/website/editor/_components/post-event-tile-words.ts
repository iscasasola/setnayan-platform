import type { MakerStageList } from '@/lib/maker-scene-list';
import { SCENE_TEMPLATES } from '@/lib/scene-templates';

/**
 * 🎞 A POST EVENT TILE'S OWN WORDS — what the Maker's navigator prints on a
 * Post Event scene's row (its status word, its accessible label, its ⓘ note).
 *
 * ⚡ Split out of `post-event-scene-panel.tsx` so the navigator, which is on the
 * Maker's first screen, does not pull the whole scene panel into the Maker's
 * first-load JavaScript (`scripts/check-maker-js-budget.mjs`): the panel itself
 * loads when a Post Event scene is first tapped (`scene-styles-lazy.tsx`).
 */

export type PostEventTile = Extract<MakerStageList['shown'][number], { kind: 'post-event' }>;

/** The one word on the tile — what filled it, or why guests do not meet it. */
export function postEventStatusWord(tile: Pick<PostEventTile, 'status' | 'hidden'>): string {
  if (tile.status === 'skipped') return 'Skipped';
  if (tile.status === 'optional') return 'Optional';
  if (tile.status === 'waiting') return 'Not yet';
  if (tile.hidden) return 'Hidden';
  return 'Auto';
}

export function postEventTileLabel(tile: PostEventTile): string {
  if (tile.status === 'skipped') return `${tile.label} (skipped — ${tile.note ?? 'nothing to show yet'})`;
  if (tile.status === 'optional') return `${tile.label} (optional — ${tile.note ?? 'not chosen'})`;
  if (tile.status === 'waiting') return `${tile.label} (not yet — ${tile.note ?? 'it fills itself after the day'})`;
  if (tile.hidden) return `${tile.label} (hidden from guests)`;
  return `${tile.label} (written for you)`;
}

/** The ⓘ under the tile: what filled it — or what will. */
export function postEventTileNote(tile: PostEventTile): string {
  const tpl = tile.template ? `${SCENE_TEMPLATES[tile.template]?.name ?? ''}. ` : '';
  const what = tile.status === 'auto' ? `Filled from: ${tile.source}` : (tile.note ?? '');
  const open = tile.open ? ' A tap opens it full screen; Back returns to the same place.' : '';
  return `${tpl}${what}.${open}`;
}
