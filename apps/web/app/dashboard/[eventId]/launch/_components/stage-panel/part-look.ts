/**
 * 🎨 A PART'S COLOUR AND SIZE, FOR STYLE'S LAST ROW (owner 2026-10-09: *"color and size share the same row"* ·
 * *"Color just 1 circle…"*; `TOOLBAR-SPEC-2026-10-09.md` § STYLE). They were two rows of the Text tool, which left
 * the toolbar with its Font (*"there is already a universal font"*).
 *
 * WHOSE colour and size: the picked part's own words — a line of the cover is its own part (`el`), a scene the
 * couple arranges is its heading. A part with no such words (a fixed block, a Post Event scene, the RSVP form) has
 * no row, and its cards take all four rows. What a part can take is the shipped table (`HUB_ELEMENT_FIELDS`: the
 * logo is a drawing — a size, no colour).
 *
 * KEEPING a pick is the part sheet's own write (`element-sheet.tsx` `choose` → `commit`), nothing new stored: the
 * scene's whole canvas with `elements[el].color` / `.size` set by the shipped `withElementChoice`, built on the
 * Maker's own copy (`draftedCanvasOr`), laid on the page at once (`elementPreview`, the bridge's `elStyle`), then
 * saved through the one draft door under the SAME queue key (`canvasWriteKey`) — so a pick here, in the part's
 * sheet and words typed beside them are one write, the latest. `held`: no Maker render. A refused save puts the
 * page and the Maker's copy back and says what did not save.
 */
import { FIXED_STYLE_SCENES } from '@/lib/fixed-scene-styles';
import { sceneStyleOptions } from '@/lib/scene-styles';
import type { HubStage } from '@/lib/hub-canvas';
import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { canvasFingerprint, canvasWriteKey, draftedCanvasOr, noteDraftedCanvas } from '@/lib/maker-draft-store';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import {
  HUB_ELEMENT_EXCLUDED_WIDGETS,
  HUB_ELEMENT_FIELDS,
  HUB_ELEMENT_SIZE_BASE,
  HUB_ELEMENT_SIZE_BOUNDS,
  HUB_ELEMENT_SIZE_STEPS,
  hubElementSizePct,
  isHubElementKey,
  withElementChoice,
  type HubElementKey,
} from '@/lib/element-style';
import { elementPreview, refusedChoiceWords } from '../../../website/editor/_components/element-preview';
import type { ElementDraftAction } from '../../../website/editor/_components/element-sheet';

export type PartLookTarget = { key: string; widgetType: string; el: HubElementKey };

/** The words whose colour and size Style's last row sets for a part — null: the part has none. */
export function partLookTarget(canvasKey: string | null | undefined, el: string | null | undefined): PartLookTarget | null {
  if (!canvasKey) return null;
  if (el) return canvasKey === 'f:hero' && isHubElementKey(el) ? { key: canvasKey, widgetType: 'hero', el } : null;
  if (!canvasKey.startsWith('w:')) return null;
  const type = canvasKey.slice(2);
  return HUB_ELEMENT_EXCLUDED_WIDGETS.includes(type) ? null : { key: canvasKey, widgetType: type, el: 'heading' };
}

/** What that part can take (the shipped table). Neither: no row. */
export function partLookFields(t: PartLookTarget | null): { colour: boolean; size: boolean } {
  const fields: readonly string[] = t ? HUB_ELEMENT_FIELDS[t.el] : [];
  return { colour: fields.includes('color'), size: fields.includes('size') };
}

/** The sizes a part may be set to — the shipped steps inside its bounds. */
export function partLookSizes(el: HubElementKey): number[] {
  const { min, max } = HUB_ELEMENT_SIZE_BOUNDS[el];
  return (HUB_ELEMENT_SIZE_STEPS as readonly number[]).filter((s) => s >= min && s <= max);
}

/** The part's colour (null: the theme's own) and size (100: the theme's own), on the Maker's own copy of its canvas. */
export function partLookNow(t: PartLookTarget, server: HubSectionCanvas | null | undefined): { colour: string | null; size: number } {
  const part = draftedCanvasOr(t.widgetType, server).elements?.[t.el];
  return { colour: part?.color ?? null, size: hubElementSizePct(part?.size) ?? HUB_ELEMENT_SIZE_BASE };
}

/** The canvas a pick makes: `before` with the one choice set — null when it changes nothing. */
export function partLookNext(t: PartLookTarget, before: HubSectionCanvas, field: 'color' | 'size', value: string | number | null): HubSectionCanvas | null {
  const elements = withElementChoice(before.elements, t.el, field, value);
  const next: HubSectionCanvas = { ...before };
  if (elements) next.elements = elements;
  else delete next.elements;
  return canvasFingerprint(before) === canvasFingerprint(next) ? null : next;
}

function show(message: unknown): void {
  document.querySelectorAll<HTMLIFrameElement>('iframe[data-maker-canvas-frame]').forEach((frame) => {
    frame.contentWindow?.postMessage(message, window.location.origin);
  });
}

export type PartLookDoor = { eventId: string; draftAction: ElementDraftAction; canvases: Readonly<Record<string, HubSectionCanvas>> | null | undefined };

/** KEEP a colour or a size: on the page now, then ONE draft write (the latest of a burst), held. */
export async function keepPartLook(t: PartLookTarget, field: 'color' | 'size', value: string | number | null, door: PartLookDoor): Promise<{ ok: true } | { ok: false; error: string }> {
  const server = door.canvases?.[t.widgetType] ?? null;
  const before = draftedCanvasOr(t.widgetType, server);
  const next = partLookNext(t, before, field, value);
  if (!next) return { ok: true };
  show(elementPreview(t.key, t.el, before, next));
  noteDraftedCanvas(t.widgetType, next, server);
  let res: HubDraftActionResult | typeof SUPERSEDED;
  try {
    res = await makerSave(
      () =>
        makerLatestWrite(canvasWriteKey(t.widgetType), () => {
          const fd = new FormData();
          fd.set('intent', 'save');
          fd.set('patch', JSON.stringify({ widgets: { [t.widgetType]: { canvas: next } } }));
          fd.set(HUB_DRAFT_BAR_FIELD, '1');
          return door.draftAction(door.eventId, fd);
        }),
      // Owed only if something else in the burst asked for a render (`makerNeedsRender`).
      requestMakerRefresh,
      { held: true, ok: (r) => r !== SUPERSEDED && r.ok === true },
    );
  } catch {
    res = { ok: false, intent: 'save', error: '' };
  }
  /* A later pick carried this one — its answer decides for both. */
  if (res === SUPERSEDED || res.ok) return { ok: true };
  /* ↩ Refused, and nothing newer is on the Maker's copy: the page and the copy go back. */
  if (canvasFingerprint(draftedCanvasOr(t.widgetType, server)) === canvasFingerprint(next)) {
    show(elementPreview(t.key, t.el, next, before, false));
    noteDraftedCanvas(t.widgetType, before, server);
  }
  return { ok: false, error: refusedChoiceWords(t.el, field, res.error || null) };
}

/**
 * 🚫 STYLE WITH NOTHING TO SET **ON THIS STAGE** (owner rule: a tool with nothing to change is grey and says so —
 * `lib/a-tool-with-nothing-to-do-says-so.test.ts`; seen on the review copy, 2026-10-10: Save the Date › E-Gifts ›
 * Style was live over four empty rows). The part rule (`makerPartToolWorks`) cannot see it: whether a part has looks
 * depends on the STAGE — E-Gifts has its four on the Invitation and none on Save the Date (`scene-styles-parts.ts`).
 *
 * A fixed section whose Style is ONE row — its scene's looks (`editor-shell.tsx` `fixedStylePanel` →
 * `fixed-scene-style-row.tsx`: E-Gifts, the guest's look, and the fixed scenes with styles of their own) — draws that
 * row only where there is a CHOICE (`sceneStyleOptions`: two or more on this stage; the row's own test, asked here
 * with the same function). Fewer: nothing is drawn, so the tool is grey. The cover's parts are not here — each has
 * its Colour · Size row. Asked without the event type, which can only take looks away: never grey where the row
 * could still be drawn.
 */
export const PART_LOOKS_ONLY: Readonly<Record<string, string>> = {
  'f:gifts': 'gifts',
  'f:look': 'my_wear',
  ...Object.fromEntries(FIXED_STYLE_SCENES.map((scene) => [`f:${scene}`, scene])),
};
export function partStyleIsEmptyOn(stage: HubStage, canvasKey: string | null | undefined): boolean {
  const type = canvasKey ? PART_LOOKS_ONLY[canvasKey] : undefined;
  return type !== undefined && sceneStyleOptions(type, stage).length < 2;
}
