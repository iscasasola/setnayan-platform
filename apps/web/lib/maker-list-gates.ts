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

/**
 * 👁 …AND THE EYE IS PER STAGE NOW (owner 2026-10-10, "WHAT GUESTS SEE"). Remove no longer writes the two gates above:
 * it writes the stage's own value (`config_json.stage_show[stage]`, `editor-shell.tsx` `eyeWrite`) and keeps what it
 * just took off in the work area's `hereOff` (`"<stage>:<scene id>"`) until a render agrees. `listWithGates` read the
 * gates only — so on the merged copy the SAME two taps said *"Every part is already on this page."* again (the walk of
 * 2026-10-11, M03), and the only way back was ↺. `hereOff` is the third thing the list is laid under.
 */
export type HereOff = Readonly<Record<string, true>>;
export const hereOffKey = (stage: string, sceneId: string): string => `${stage}:${sceneId}`;

export function listWithGates(list: MakerStageList, scenes: readonly Gated[], hereOff: HereOff = {}): MakerStageList {
  const off = new Set(scenes.filter((s) => !gatedSceneShows(s)).map((s) => s.id));
  const here = (id: string) => hereOff[hereOffKey(list.stage, id)] === true;
  const gone = list.shown.filter((t) => t.kind === 'scene' && (off.has(t.widgetId) || here(t.widgetId)));
  if (gone.length === 0) return list;
  return {
    ...list,
    shown: list.shown.filter((t) => !gone.includes(t)),
    folded: [
      ...list.folded,
      ...gone.flatMap((t) =>
        t.kind === 'scene'
          ? [{ key: t.key, widgetId: t.widgetId, type: t.type, label: t.label, reason: 'You took it off this page.', hiddenByCouple: true, ...(here(t.widgetId) ? { hiddenHere: true as const } : {}) }]
          : [],
      ),
    ],
  };
}

/**
 * ↩ WHAT IS STILL HELD OFF ONCE A RENDER ARRIVES. A key leaves when the render's list no longer shows its scene (the
 * server agrees — its fold says so now), and when the render was ASKED FOR after the hide (`asked`) and still shows
 * it (the draft no longer hides it: an Undo, "Back to our picks", a Reset). Otherwise it stays: a render that was
 * already on its way when the scene was taken off proves nothing about it. Returns `h` itself when nothing leaves.
 */
export function hereOffAfterRender(
  h: HereOff,
  lists: Readonly<Record<string, Pick<MakerStageList, 'shown'> | undefined>>,
  asked: ReadonlySet<string>,
): Record<string, true> {
  const keep = Object.keys(h).filter((k) => {
    const at = k.indexOf(':');
    const shown = lists[k.slice(0, at)]?.shown.some((t) => t.kind === 'scene' && t.widgetId === k.slice(at + 1)) === true;
    return shown && !asked.has(k);
  });
  return keep.length === Object.keys(h).length ? (h as Record<string, true>) : Object.fromEntries(keep.map((k) => [k, true as const]));
}

/** 🫥 Is this canvas key a scene the couple took off the stage on screen? The fold's own word — never a guess from the page. */
export function partTakenOff(ops: { list: Pick<MakerStageList, 'folded'> } | null, canvas: string | null): boolean {
  return Boolean(ops && canvas && ops.list.folded.some((f) => f.key === canvas && f.hiddenByCouple));
}
