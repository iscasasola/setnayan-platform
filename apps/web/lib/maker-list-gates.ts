/**
 * lib/maker-list-gates.ts — 🗑 A SCENE TAKEN OFF A MOMENT AGO IS ONE ＋ CAN BRING BACK.
 *
 * Measured 2026-10-11 at 375 px, on the Maker's own toolbar: Remove on a scene ("Message removed from this page"),
 * then ＋ on the part beside it — the sheet said *"Every part is already on this page."* and the scene could not be
 * brought back until the whole Maker was drawn again.
 *
 * Why: the eye's save is HELD (`editor-shell.tsx` `gateWrite`) — the bridge hides the scene on the canvas and no
 * render of the Maker follows, on purpose (a hide that is already on screen owes none). The work area knows the
 * scene is off (its `gates`, laid over `scenes`); the stage's LIST is the last render's, and still shows the scene.
 * The ＋ sheet reads the list (`add-part-sheet.tsx`: what a stage can take back is `list.folded` with
 * `hiddenByCouple`), so it offered nothing.
 *
 * `listWithGates` is the list as the work area's own scenes say it is: a scene the list still shows, that the
 * couple's two gates have off, is folded — hidden by the couple — exactly as the next render will fold it. Nothing
 * else moves; a scene put BACK is drawn by the render its save brings (that save is not held).
 *
 * Pure — `maker-list-gates.test.ts`. Types only from the list.
 */
import type { MakerStageList } from './maker-scene-list';

type Gated = { id: string; mode: 'auto' | 'shown' | 'hidden'; isVisible: boolean };

/** Is this scene on the guest page? Both gates, the way the page reads them (`editor-shell.tsx` `sceneShowing`). */
export function gatedSceneShows(scene: Pick<Gated, 'mode' | 'isVisible'>): boolean {
  if (scene.mode === 'hidden') return false;
  if (scene.mode === 'shown') return true;
  return scene.isVisible;
}

export function listWithGates(list: MakerStageList, scenes: readonly Gated[]): MakerStageList {
  const off = new Set(scenes.filter((s) => !gatedSceneShows(s)).map((s) => s.id));
  if (off.size === 0) return list;
  const gone = list.shown.filter((t) => t.kind === 'scene' && off.has(t.widgetId));
  if (gone.length === 0) return list;
  return {
    ...list,
    shown: list.shown.filter((t) => !gone.includes(t)),
    folded: [
      ...list.folded,
      ...gone.flatMap((t) => (t.kind === 'scene' ? [{ key: t.key, widgetId: t.widgetId, type: t.type, label: t.label, reason: 'You took it off this page.', hiddenByCouple: true }] : [])),
    ],
  };
}
