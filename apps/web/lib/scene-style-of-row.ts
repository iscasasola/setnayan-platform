/**
 * THE STYLE A SECTION ROW IS DRAWN IN, ON THIS STAGE — one line for every
 * guest-page mount.
 *
 * The pick lives on the row as `canvas.style` (`HubSectionCanvas.style`,
 * drafted and applied like `canvas.template`); the ONE resolver
 * (`lib/scene-styles.ts`) turns it into what this stage draws: the pick when
 * this stage draws it, else the stage's default. No stage (a caller that
 * never passed one) or no row → null, and every widget draws its shipped look
 * for null — so a mount that forgets the stage regresses nothing.
 */
import { sanitizeHubCanvas, type HubStage } from '@/lib/hub-canvas';
import { resolveSceneStyle, sceneStyleTypeOfWidget } from '@/lib/scene-styles';
import { resolvePaletteLook, type PaletteLookId } from '@/lib/palette-looks';

export function sceneStyleOfRow(
  row: { widget_type: string; config_json?: unknown } | null | undefined,
  stage: HubStage | null | undefined,
  eventType?: string | null,
): string | null {
  if (!row || !stage) return null;
  return resolveSceneStyle(
    sceneStyleTypeOfWidget(row.widget_type),
    stage,
    sanitizeHubCanvas(row.config_json).style,
    eventType ?? null,
  );
}

/**
 * 🎨 THE LOOK A ROW'S PALETTE IS DRAWN IN — `canvas.palette`, beside
 * `canvas.style` (`lib/palette-styles.ts`). Every stage draws it the same, so
 * there is no stage here; no row, no pick or an unknown id → Tags, today's look.
 */
export function paletteLookOfRow(row: { config_json?: unknown } | null | undefined): PaletteLookId {
  return resolvePaletteLook(row ? sanitizeHubCanvas(row.config_json).palette : undefined);
}


/**
 * 🏛 THE VENUE SCENE'S MAP — `canvas.venueMap` (owner 2026-09-30, "VENUE STYLES
 * APPROVED"): `'one'` = one map for every place (the default, absent) · `'none'`
 * = no map in any style. Every stage draws it the same.
 */
export function venueMapOfRow(row: { config_json?: unknown } | null | undefined): 'one' | 'none' {
  return row && sanitizeHubCanvas(row.config_json).venueMap === 'none' ? 'none' : 'one';
}
