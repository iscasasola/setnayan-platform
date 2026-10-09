/**
 * 🎞 A POST EVENT SCENE, FOR THE TOOLBAR'S EDIT (owner 2026-10-09, `TOOLBAR-SPEC-2026-10-09.md` § EDIT: *"Post Event
 * scenes: heading field + 'Shown to guests' switch"*; the approved prototype's Post Event — its words in row 1,
 * "Shown to guests" in row 2, ↑ Earlier · ↓ Later · Remove in row 4).
 *
 * They were rows of the scene's own panel (`post-event-scene-panel.tsx`), drawn under Style's cards: 473 px in a
 * 339-px room with no scroller — the switch, the order and "Its parts" could not be reached on a phone.
 *
 * 🔑 NOTHING NEW IS STORED AND NOTHING NEW IS POSTED. Each save is the panel's own, built by the story's own rules
 * (`lib/post-event-draft.ts`) on the arrangement the Maker shows, and sent through the one draft door
 * (`hubDraftAction` intent=save):
 *
 *   a part's words      `postEventSetWords`  → { editorial: { sceneLooks } }   (the panel's `PostEventWordsField`)
 *   "Shown to guests"   `postEventShow`      → { editorial: { sections } }     (the panel's Shown switch)
 *
 * …followed by a Maker render, as the panel's saves are (never held): every writer of the story builds on the
 * arrangement the LAST render read, so a held save would be overwritten by the next one. The scene's place and
 * Remove are the frame's (`add-part-sheet.tsx` `usePartEdits`), unchanged.
 *
 * WHICH words: the parts the scene's STYLE draws with words the couple may rewrite (`postEventWordParts` — the
 * panel's "Its parts"), read off the page as guests read them now. Edit holds ONE of them in row 1 — the one last
 * tapped on the page, else the Heading, else the scene's first — because row 2 is the switch.
 *
 * Lazy: reached only from the toolbar (`stage-tools.tsx`, `part-words.ts`); nothing here is in the Maker's first load.
 */
import { findMakerSection } from '@/app/[slug]/_components/maker-section-find';
import { partWords } from '@/app/[slug]/_components/type-in-place-canvas';
import { HUB_ELEMENT_LABEL } from '@/lib/element-style';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import {
  POST_EVENT_WORDS_MAX,
  postEventLookOf,
  postEventSetWords,
  postEventShow,
  type PostEventArrangement,
  type PostEventDraft,
  type PostEventPart,
} from '@/lib/post-event-draft';
import { postEventStyleHome, postEventWordParts } from '@/lib/post-event-styles';
import type { ElementDraftAction } from '../../../website/editor/_components/element-sheet';
import { MAKER_PART_OPS_EVENT, type MakerPartRaw } from '../maker-part-ops';
import type { PartWordsField } from './part-words';

const NOT_SAVED = 'That change could not be saved. Please try again — nothing was lost.';

/** The order Edit offers a scene's words in: the Heading first (the prototype's box), then its label, then its words. */
export const POST_EVENT_EDIT_ORDER: readonly PostEventPart[] = ['heading', 'label', 'body'];

/** A Post Event scene as the Maker holds it NOW — its tile, the story's arrangement, the one draft door. */
export type PostEventSceneNow = {
  scene: string;
  label: string;
  /** Guests do not meet it (its switch is off). */
  hidden: boolean;
  /** The story switch that shows / hides it — null: it cannot be hidden from here. */
  switchKey: string | null;
  runKey: string | null;
  status: string;
  /** The section row its style lives on, when it is one value with a section's (`postEventStyleHome`). */
  styleHome: string | null;
  /** The parts its style draws with words the couple may rewrite (the panel's "Its parts"), in Edit's order. */
  parts: PostEventPart[];
  arrangement: PostEventArrangement;
  eventId: string;
  draftAction: ElementDraftAction | null;
};

/** The work area's own values, now (it answers inside the dispatch — `maker-part-ops.ts`). */
function askRaw(): MakerPartRaw | null {
  let got: MakerPartRaw | null = null;
  window.dispatchEvent(new CustomEvent(MAKER_PART_OPS_EVENT, { detail: (raw: MakerPartRaw) => (got = raw) }));
  return got;
}

/** Read a scene out of the work area's values — pure, so the guard can hand it a fixture. Null: not a scene the Maker holds. */
export function postEventSceneOf(raw: Pick<MakerPartRaw, 'eventId' | 'list' | 'navigator' | 'elementEditing'> | null, canvasKey: string | null): PostEventSceneNow | null {
  if (!raw || !canvasKey || !canvasKey.startsWith('p:')) return null;
  const pe = raw.navigator.postEvent;
  if (!pe || pe === 'unreadable') return null;
  const tile = raw.list.shown.find((t) => t.kind === 'post-event' && (t.anchor === canvasKey || t.key === canvasKey));
  if (!tile || tile.kind !== 'post-event') return null;
  const style = pe.styles[tile.scene] ?? null;
  const drawn = postEventWordParts(tile.scene, style);
  return {
    scene: tile.scene,
    label: tile.label,
    hidden: tile.hidden,
    switchKey: tile.switchKey,
    runKey: tile.runKey,
    status: tile.status,
    styleHome: postEventStyleHome(tile.scene),
    parts: POST_EVENT_EDIT_ORDER.filter((p) => drawn.includes(p)),
    arrangement: pe.arrangement,
    eventId: raw.eventId,
    draftAction: raw.elementEditing?.draftAction ?? null,
  };
}

/** The scene drawn at this canvas key, as the Maker holds it now. */
export function postEventSceneNow(canvasKey: string | null): PostEventSceneNow | null {
  return postEventSceneOf(askRaw(), canvasKey);
}

/**
 * The scene's words for Edit: one field per part its style draws, in Edit's order — each holding the words guests
 * read NOW (the couple's own, else the line written from the day, read off the page). `auto`: that written line,
 * when the couple has none of their own — typing exactly it keeps nothing.
 */
export function postEventWordsFields(now: PostEventSceneNow | null, doc: Document | null | undefined, key: string): PartWordsField[] {
  if (!now) return [];
  const section = doc ? findMakerSection(doc, key) : null;
  const own = postEventLookOf(now.arrangement, now.scene).words ?? {};
  return now.parts.map((part) => {
    const drawnAt = section?.querySelector<HTMLElement>(`[data-el="${part}"]`) ?? null;
    const written = drawnAt ? partWords(drawnAt) : '';
    const mine = own[part] ?? null;
    return {
      key,
      el: part,
      field: null,
      label: HUB_ELEMENT_LABEL[part],
      text: mine ?? written,
      auto: mine === null ? written : null,
      long: part === 'body',
      maxLength: POST_EVENT_WORDS_MAX[part],
      twoPeople: false,
    };
  });
}

/** Read off the canvas for the picked scene (`part-words.ts` `readPartWords` hands a `p:` key here). */
export function readPostEventWords(doc: Document | null | undefined, key: string): PartWordsField[] {
  return postEventWordsFields(postEventSceneNow(key), doc, key);
}

export type PostEventWrite = { ok: true; patch: { editorial: PostEventDraft } | null } | { ok: false; reason: string };

/**
 * The ONE patch a part's words post — the panel's own (`PostEventWordsField` `commit`): the story's rule decides
 * (`postEventSetWords`), '' goes back to the line written from the day, a line too long is refused in the row's own
 * words. `patch: null`: nothing changed, nothing is sent.
 */
export function postEventWordsWrite(now: Pick<PostEventSceneNow, 'arrangement' | 'scene'>, part: PostEventPart, typed: string, auto: string | null): PostEventWrite {
  /* The written line, left as it is, is not the couple's own words. */
  if (auto !== null && typed.trim() === auto.trim()) return { ok: true, patch: null };
  const r = postEventSetWords(now.arrangement, now.scene, part, typed);
  if (!r) return { ok: true, patch: null };
  if ('refused' in r) return { ok: false, reason: `Keep it under ${POST_EVENT_WORDS_MAX[part]} characters.` };
  return { ok: true, patch: { editorial: r } };
}

/** The ONE patch "Shown to guests" posts — the panel's own switch (`postEventShow` on the scene's story switch). Null: the scene has none. */
export function postEventShownWrite(now: Pick<PostEventSceneNow, 'arrangement' | 'switchKey'>, shown: boolean): { editorial: PostEventDraft } | null {
  if (!now.switchKey) return null;
  return { editorial: postEventShow(now.arrangement, now.switchKey as Parameters<typeof postEventShow>[1], shown) };
}

/** Post a story patch to the draft — the one door, then a Maker render (never held: see the docblock). */
async function saveStory(now: PostEventSceneNow, patch: { editorial: PostEventDraft }): Promise<{ ok: true } | { ok: false; error: string }> {
  const door = now.draftAction;
  if (!door) return { ok: false, error: NOT_SAVED };
  try {
    const fd = new FormData();
    fd.set('intent', 'save');
    fd.set('patch', JSON.stringify(patch));
    const r: HubDraftActionResult = await makerSave(() => door(now.eventId, fd), requestMakerRefresh);
    return r.ok ? { ok: true } : { ok: false, error: r.error || NOT_SAVED };
  } catch {
    return { ok: false, error: NOT_SAVED };
  }
}

/** To every canvas the Maker holds (the bridge's own messages). */
function toCanvases(message: unknown): void {
  document.querySelectorAll<HTMLIFrameElement>('iframe[data-maker-canvas-frame]').forEach((frame) => {
    frame.contentWindow?.postMessage(message, window.location.origin);
  });
}

/**
 * KEEP a scene's words (Edit's row 1 — `TypedRow` `onKeep`): the one patch, once. A refused or failed keep puts the
 * page's words back and answers the row — never the look of success.
 */
export async function keepPostEventWords(f: PartWordsField, typed: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const back = () => toCanvases({ source: 'setnayan-editor', t: 'typeText', key: f.key, el: f.el, text: f.text });
  const now = postEventSceneNow(f.key);
  if (!now) {
    back();
    return { ok: false, error: NOT_SAVED };
  }
  const w = postEventWordsWrite(now, f.el as PostEventPart, typed, f.auto);
  if (!w.ok) {
    back();
    return { ok: false, error: w.reason };
  }
  if (!w.patch) {
    /* Nothing of the couple's own to keep: the page reads the line it had. */
    if (typed.trim() !== f.text.trim()) back();
    return { ok: true };
  }
  const res = await saveStory(now, w.patch);
  if (!res.ok) back();
  return res;
}

/**
 * KEEP "Shown to guests": drawn on the page at the tap (a scene switched off leaves the page now — the bridge's
 * `sceneShow`; one switched on is drawn by the render that follows), then the one patch.
 */
export async function keepPostEventShown(now: PostEventSceneNow, canvasKey: string, shown: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch = postEventShownWrite(now, shown);
  if (!patch) return { ok: false, error: NOT_SAVED };
  if (!shown) toCanvases({ source: 'setnayan-editor', t: 'sceneShow', key: canvasKey, shown: false });
  const res = await saveStory(now, patch);
  if (!res.ok && !shown) toCanvases({ source: 'setnayan-editor', t: 'sceneShow', key: canvasKey, shown: true });
  return res;
}

/**
 * What the scene is, for the toolbar's ONE ⓘ (owner 2026-10-09, decided: the explanations do not get rows) — the
 * panel's own sentences, word for word (`POST_EVENT_ABOUT`, handed in so this file stays free of the panel): what
 * fills it, and — where they are so — that its style, its switch or its place is shared.
 */
export function postEventAbout(
  now: PostEventSceneNow | null,
  words: Readonly<{ waiting: string; written: string; sharedStyle: string; galleryShare: string; chaptersMove: string }>,
): string | null {
  if (!now) return null;
  return [
    now.status === 'waiting' ? words.waiting : words.written,
    now.styleHome ? words.sharedStyle : null,
    now.switchKey === 'gallery' ? words.galleryShare : null,
    now.runKey === 'chapters' ? words.chaptersMove : null,
  ]
    .filter(Boolean)
    .join(' ');
}
