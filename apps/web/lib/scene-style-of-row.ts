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
