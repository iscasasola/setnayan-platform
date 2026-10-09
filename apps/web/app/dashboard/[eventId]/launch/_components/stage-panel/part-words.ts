/**
 * ✍ A PART'S WORDS, FOR THE TOOLBAR'S EDIT (owner 2026-10-09, verbatim: *"if the edit is just text, then don't need
 * to jump. but it can both adapt to whichever is edited. same goes to simple edits. Only jump if it has editing that
 * cannot be done there"*; `TOOLBAR-SPEC-2026-10-09.md` § EDIT).
 *
 * WHICH words a part has is the PAGE's to say, never a list kept here: the words the shipped typing door could put a
 * caret in — a line of the cover that takes one (`isTypeCaretPart`: the title, the names, the invite line, the
 * link) and every scene field the canvas marked (`[data-el-field]`, `markSceneWords`: Your message, Your reminders,
 * a scene of their own's Heading and Words) — and a Post Event scene's own (`post-event-edit.ts`). A part with none
 * has no field; it keeps its one door.
 *
 * KEEPING them is the SHIPPED write, through the one draft door (`hubDraftAction`), with the SAME sanitizers and the
 * SAME write keys the typing bar uses (`type-in-place.tsx`) — one value, however many doors:
 *
 *   the names          `typedDisplayName`   → { events: { display_name } }        `NAMES_WRITE_KEY`
 *   a line of the cover `withTypedWords`     → { widgets: { hero: { canvas } } }   `canvasWriteKey('hero')`
 *   a scene's field     `sceneTypeWrite`     → its own patch                        its own `writeKey`
 *
 * ONE write per edit (a field keeps once, when it closes — `TypedRow` `onKeep`), `held`: no Maker render, no canvas
 * reload; the Apply count comes back with the save. A refused or failed write puts the page's words back and says
 * why — never the look of success. Nothing here is in the Maker's first load.
 */
import { findMakerSection } from '@/app/[slug]/_components/maker-section-find';
import { partWords, sceneTypeField } from '@/app/[slug]/_components/type-in-place-canvas';
import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { canvasFingerprint, canvasWriteKey, draftedCanvasOr, draftedOwnWordsOr, noteDraftedCanvas, noteDraftedOwnWords } from '@/lib/maker-draft-store';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubDraftActionResult, HubDraftPatch } from '@/lib/hub-draft';
import { HUB_ELEMENT_LABEL, type HubElementKey } from '@/lib/element-style';
import { SCENE_TYPE_MULTILINE, isTypeCaretPart, type SceneTypeField } from '@/lib/hub-part-words';
import { withTypedWords } from '@/lib/type-in-place';
import { SCENE_FIELD_LABEL, sceneFieldMax, sceneTypeWrite, type SceneOwnWords } from '@/lib/scene-type-words';
import { DISPLAY_NAME_MAX, typedDisplayName } from '@/lib/typed-names';
import type { ElementDraftAction } from '../../../website/editor/_components/element-sheet';
import { readPostEventWords } from './post-event-edit';

/** The names' own queue key — the typing bar's (`type-in-place.tsx`): the two doors' writes never race. */
export const NAMES_WRITE_KEY = 'event:display_name';
/** At most this many fields — Edit's rows 1–3 (row 4 is always the part's place). */
export const PART_WORDS_MAX = 3;

/** One text of a part, as the page draws it now. */
export type PartWordsField = {
  /** The canvas key of the section it is drawn in, and the part inside it (`[data-el]`). */
  key: string;
  el: string;
  /** A scene's stored field (`message` · `reminders` · `title` · `body`) — null: a line of the cover. */
  field: SceneTypeField | null;
  /** What the row is called. */
  label: string;
  /** The words now. */
  text: string;
  /** The page's own words for it (`data-el-word`) — typing exactly these keeps no word of its own. */
  auto: string | null;
  /** Several lines (a message): the taller box. */
  long: boolean;
  maxLength: number;
  /** The names of two people ("Ana & Ben" — a name on each side). */
  twoPeople: boolean;
};

/** A stable name for a field — what "the text last tapped" is matched by. */
export const partWordsId = (f: Pick<PartWordsField, 'el' | 'field'>): string => f.field ?? f.el;

/**
 * The texts the page draws for a part: `el` names one line of the cover; without it, every field the section marks.
 * `partLabel` names a part's ONE text ("Names", "Invite line"); a part of several is named by its fields.
 */
export function readPartWords(doc: Document | null | undefined, key: string | null, el: string | null, partLabel: string): PartWordsField[] {
  if (!doc || !key) return [];
  const section = findMakerSection(doc, key);
  if (!section) return [];
  if (el) {
    if (key !== 'f:hero' || !isTypeCaretPart(el)) return [];
    const part = section.querySelector<HTMLElement>(`[data-el="${CSS.escape(el)}"]`);
    if (!part) return [];
    const names = el === 'names';
    return [
      {
        key,
        el,
        field: null,
        label: partLabel || HUB_ELEMENT_LABEL[el as HubElementKey] || 'Words',
        text: partWords(part),
        auto: part.getAttribute('data-el-word') ?? part.querySelector('[data-el-word]')?.getAttribute('data-el-word') ?? null,
        long: false,
        maxLength: names ? DISPLAY_NAME_MAX : 240,
        twoPeople: names && part.querySelectorAll('[data-el-person]').length > 1,
      },
    ];
  }
  /* 🎞 A Post Event scene: the parts its style draws with words the couple may rewrite (`post-event-edit.ts`). */
  if (key.startsWith('p:')) return readPostEventWords(doc, key);
  if (!key.startsWith('w:')) return [];
  const out: PartWordsField[] = [];
  for (const part of Array.from(section.querySelectorAll<HTMLElement>('[data-el-field]'))) {
    const field = sceneTypeField(part);
    const partEl = part.getAttribute('data-el');
    if (!field || !partEl || out.some((f) => f.field === field)) continue;
    out.push({ key, el: partEl, field, label: SCENE_FIELD_LABEL[field], text: partWords(part), auto: null, long: SCENE_TYPE_MULTILINE.includes(field), maxLength: sceneFieldMax(field), twoPeople: false });
  }
  return out.slice(0, PART_WORDS_MAX);
}

/** *"it can both adapt to whichever is edited"*: the text last tapped on the page comes first; the rest keep the page's order. */
export function orderPartWords(fields: readonly PartWordsField[], tapped: string | null): PartWordsField[] {
  const at = tapped ? fields.findIndex((f) => partWordsId(f) === tapped || f.el === tapped) : -1;
  return at > 0 ? [fields[at]!, ...fields.slice(0, at), ...fields.slice(at + 1)] : [...fields];
}

/** The work area's own, as it lends them (`maker-part-ops.ts`). */
export type PartWordsDoor = {
  eventId: string;
  draftAction: ElementDraftAction;
  /** The hero's canvas as the last render drew it — the Maker's own copy is laid over it (`draftedCanvasOr`). */
  heroCanvas: HubSectionCanvas | null | undefined;
  /** A scene of their own's words as the last render had them, by scene type. */
  ownWords: Readonly<Record<string, SceneOwnWords>> | null | undefined;
};

export type PartWordsWrite =
  | { ok: true; writeKey: string; patch: HubDraftPatch | null; words: string; undo: () => void }
  | { ok: false; reason: string };

/**
 * The ONE draft write for a field's words — pure but for the Maker's own copies it notes (`noteDrafted…`), which
 * `undo` puts back. `patch: null`: nothing changed, nothing is sent.
 */
export function partWordsWrite(f: PartWordsField, typed: string, door: Pick<PartWordsDoor, 'heroCanvas' | 'ownWords'>): PartWordsWrite {
  if (f.field) {
    const type = f.key.slice(2);
    const server = door.ownWords?.[type] ?? null;
    const own = draftedOwnWordsOr(type, server);
    const w = sceneTypeWrite(f.field, type, typed, own);
    if (!w.ok) return { ok: false, reason: w.reason };
    const custom = (w.patch.widgets as Record<string, { custom?: SceneOwnWords }> | undefined)?.[type]?.custom;
    if (custom) noteDraftedOwnWords(type, custom, server);
    return { ok: true, writeKey: w.writeKey, patch: w.patch, words: w.words, undo: () => (custom ? noteDraftedOwnWords(type, own, server) : undefined) };
  }
  if (f.el === 'names') {
    const name = typedDisplayName(typed, f.twoPeople);
    if (!name) return { ok: false, reason: f.twoPeople ? 'Type a name on each side — the names cannot be left empty.' : 'The name cannot be left empty.' };
    return { ok: true, writeKey: NAMES_WRITE_KEY, patch: { events: { display_name: name } }, words: name, undo: () => {} };
  }
  const el = f.el as HubElementKey;
  const before = draftedCanvasOr('hero', door.heroCanvas);
  const { elements, refused } = withTypedWords(before.elements, el, typed, f.auto);
  if (refused) return { ok: false, reason: 'Those words cannot be used here — keep it to one short line of words.' };
  const next: HubSectionCanvas = { ...before };
  if (elements) next.elements = elements;
  else delete next.elements;
  const words = next.elements?.[el]?.word ?? f.auto ?? '';
  if (canvasFingerprint(before) === canvasFingerprint(next)) return { ok: true, writeKey: canvasWriteKey('hero'), patch: null, words, undo: () => {} };
  noteDraftedCanvas('hero', next, door.heroCanvas);
  return {
    ok: true,
    writeKey: canvasWriteKey('hero'),
    patch: { widgets: { hero: { canvas: next } } },
    words,
    undo: () => noteDraftedCanvas('hero', before, door.heroCanvas),
  };
}

/** The page shows these words for the field — on every canvas the Maker holds (the bridge's own `typeText`). */
export function showPartWords(f: Pick<PartWordsField, 'key' | 'el' | 'field'>, text: string): void {
  const message = { source: 'setnayan-editor', t: 'typeText', key: f.key, el: f.el, text, ...(f.field ? { field: f.field } : {}) };
  document.querySelectorAll<HTMLIFrameElement>('iframe[data-maker-canvas-frame]').forEach((frame) => {
    frame.contentWindow?.postMessage(message, window.location.origin);
  });
}

/**
 * KEEP a field's words: the shipped write, once, held. Answers `TypedRow`'s `onKeep` — `{ ok: false, error }` when
 * the words are refused or the save did not land (the page then shows `f.text`, the words it had).
 */
export async function keepPartWords(f: PartWordsField, typed: string, door: PartWordsDoor): Promise<{ ok: true } | { ok: false; error: string }> {
  const w = partWordsWrite(f, typed, door);
  if (!w.ok) {
    showPartWords(f, f.text);
    return { ok: false, error: w.reason };
  }
  showPartWords(f, w.words);
  if (!w.patch) return { ok: true };
  const patch = w.patch;
  let res: HubDraftActionResult | typeof SUPERSEDED;
  try {
    res = await makerSave(
      () =>
        makerLatestWrite(w.writeKey, () => {
          const fd = new FormData();
          fd.set('intent', 'save');
          fd.set('patch', JSON.stringify(patch));
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
  if (res === SUPERSEDED || res.ok) return { ok: true };
  w.undo();
  showPartWords(f, f.text);
  return { ok: false, error: res.error || 'That did not save. The words are back as they were.' };
}
