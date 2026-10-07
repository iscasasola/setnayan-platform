/**
 * apps/web/lib/love-story-moment-intent.ts — ONE MOMENT CHANGE, APPLIED ONE WAY.
 *
 * `loveStoryMomentAction` (the server) and the Maker's instant scrapbook
 * (`love-story-live.tsx`, owner 2026-09-30: *"Takes so long to edit … the
 * delay of response is terrible"*) both turn a moment form — add · edit ·
 * delete · arrange — into the next list of moments. This is that one function,
 * lifted out of the action unchanged, so what the couple sees at the tap is
 * exactly what the server would have written.
 *
 * 'pick' (photos from another event) is NOT here: it must ask the server which
 * of those photos the couple may use (`ourEventPhotoRefs`), so it always goes
 * to the action. So does any change that brings a NEW photo — the action
 * screens it before it is kept (`screenNewPhotoRefs`); see `momentNeedsServer`.
 *
 * Pure: no I/O, no React. `love-story-live.test.ts` drives it.
 */
import {
  MOMENT_BY_MAX,
  MOMENT_LINE_MAX,
  MOMENT_PLACE_MAX,
  MOMENT_TITLE_MAX,
  newMomentId,
  readMomentDate,
  readMomentMedia,
  withMomentOrder,
  type LoveStoryMoment,
} from './love-story-moments';
import { storyStr, type StoryFormRead } from './love-story-words';

/** ✋ `order` — the couple's own order, a drag of a card in Studio › Love Story (owner 2026-10-07). */
export const LOCAL_MOMENT_INTENTS = ['add', 'edit', 'delete', 'arrange', 'order'] as const;
export type LocalMomentIntent = (typeof LOCAL_MOMENT_INTENTS)[number];

/** The moment the form describes, or null when it lacks a year or a line. */
export function momentFromForm(formData: StoryFormRead, prior: LoveStoryMoment | null, id: string): LoveStoryMoment | null {
  const date = readMomentDate({
    y: formData.get('date_y'),
    m: formData.get('date_m'),
    d: formData.get('date_d'),
  });
  const line = storyStr(formData.get('line'), MOMENT_LINE_MAX);
  if (!date || !line) return null; // a moment needs at least a year and a line
  const place = storyStr(formData.get('place'), MOMENT_PLACE_MAX);
  /* 📖 The title (owner 2026-10-07). A form without the field keeps the moment's own. */
  const titleRaw = formData.get('title');
  const title = titleRaw === null ? (prior?.title ?? '') : storyStr(titleRaw, MOMENT_TITLE_MAX).replace(/\s+/g, ' ');
  const addedBy = storyStr(formData.get('added_by'), MOMENT_BY_MAX);
  const anchorRaw = formData.get('anchor');
  const anchor = anchorRaw === 'met' || anchorRaw === 'yes' ? anchorRaw : undefined;
  const media = readMomentMedia(formData.getAll('media'));
  return {
    id,
    date,
    ...(title ? { title } : {}),
    line,
    ...(place ? { place } : {}),
    ...(media.length ? { media } : {}),
    ...(addedBy ? { added_by: addedBy } : {}),
    ...(anchor ? { anchor } : {}),
    ...(formData.get('hidden') === 'on' ? { hidden: true } : {}),
    /* ✋ An edit never moves the moment out of the couple's own order. */
    ...(typeof prior?.order === 'number' ? { order: prior.order } : {}),
    canvas: prior?.canvas ?? {},
  };
}

/** One anchor of each kind: tagging a second "How we met" moves the tag. */
export function oneAnchorEach(list: LoveStoryMoment[], keeper: LoveStoryMoment): LoveStoryMoment[] {
  if (!keeper.anchor) return list;
  return list.map((m) => {
    if (m.id === keeper.id || m.anchor !== keeper.anchor) return m;
    const { anchor: _drop, ...rest } = m;
    return rest;
  });
}

export type MomentIntentResult =
  | { ok: true; after: LoveStoryMoment[]; touched: LoveStoryMoment | null }
  | { ok: false; error: string };

/** add · edit · delete · arrange — the next list, or the words the action would have said. */
export function applyMomentIntent(
  before: readonly LoveStoryMoment[],
  intent: LocalMomentIntent,
  formData: StoryFormRead,
  random?: () => number,
): MomentIntentResult {
  const list = [...before];
  const id = storyStr(formData.get('id'), 40);
  const prior = list.find((m) => m.id === id) ?? null;
  if (intent === 'add') {
    const m = momentFromForm(formData, null, newMomentId(list, random));
    if (!m) return { ok: false, error: 'A moment needs a year and a line — nothing else is required.' };
    return { ok: true, after: oneAnchorEach([...list, m], m), touched: m };
  }
  if (intent === 'edit') {
    if (!prior) return { ok: false, error: 'That moment is no longer here.' };
    const m = momentFromForm(formData, prior, id);
    if (!m) return { ok: false, error: 'A moment needs a year and a line — nothing else is required.' };
    return { ok: true, after: oneAnchorEach(list.map((x) => (x.id === id ? m : x)), m), touched: m };
  }
  if (intent === 'delete') return { ok: true, after: list.filter((m) => m.id !== id), touched: null };
  /* ✋ 'order' — the couple's own order: `order` = every moment's id, first to last. */
  if (intent === 'order') {
    const ids = String(formData.get('order') ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (ids.length === 0) return { ok: false, error: 'That order did not come through. Please try again.' };
    return { ok: true, after: withMomentOrder(list, ids), touched: null };
  }
  // 'arrange' — show on / keep off the Event Hub, per moment.
  if (!prior) return { ok: false, error: 'That moment is no longer here.' };
  const hide = formData.get('hidden') === 'on';
  return {
    ok: true,
    after: list.map((m) => {
      if (m.id !== id) return m;
      const { hidden: _h, ...rest } = m;
      return hide ? { ...rest, hidden: true } : rest;
    }),
    touched: null,
  };
}

/**
 * Must this moment form go to the SERVER action rather than be applied here?
 * 'pick' always (the server decides which photos are the couple's), and any
 * add/edit carrying a photo ref the story does not already hold (the server
 * screens a new photo before it is kept). Everything else — words, dates, the
 * place, the anchor, show/hide, remove — is applied at the tap.
 */
export function momentNeedsServer(before: readonly LoveStoryMoment[], formData: StoryFormRead): boolean {
  const intent = formData.get('intent');
  if (!(LOCAL_MOMENT_INTENTS as readonly unknown[]).includes(intent)) return true;
  if (intent !== 'add' && intent !== 'edit') return false;
  const held = new Set(before.flatMap((m) => m.media ?? []));
  return readMomentMedia(formData.getAll('media')).some((ref) => !held.has(ref));
}
