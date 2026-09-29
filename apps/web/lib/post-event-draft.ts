/**
 * apps/web/lib/post-event-draft.ts
 *
 * POST EVENT'S SCENES IN THE EVENT HUB DRAFT — show / hide, order, and each
 * scene's LOOK (its style, its words, its parts' own font · size · colour),
 * edited in the Maker and reaching guests only at Apply.
 *
 * Owner, 2026-09-25 (DECISION_LOG "POST EVENT IS MANY SMALL SCENES"): Post Event
 * is its separate scenes; 2026-09-29 ("EVERY STYLE OF EVERY SCENE SHIPS"): each
 * scene picks its style with one dropdown, and every part is tap-to-edit. Every
 * Maker edit is a draft guests do not see until Apply (owner 2026-09-24,
 * "Apply · Restore · Reset").
 *
 * ── ONE SOURCE OF TRUTH PER FACT ─────────────────────────────────────────────
 * The live story has carried its arrangement for months in `event_editorial.
 * draft_json`: `sections` (which blocks show — only `false` hides) and
 * `sectionOrder` (the run's order). The guest page reads exactly these
 * (`editorial/data.ts`), the story workroom writes them (`saveEditorial`), and
 * the navigator reads them (`draftToScenes`). 🔑 THIS FILE ADDS NO SECOND ORDER
 * AND NO SECOND EYE: the draft holds a DRAFTED COPY of those same keys — only
 * the ones the couple changed — exactly as the draft already holds a drafted
 * `display_order` for a section row.
 *
 * The ONE new key is `sceneLooks` — a fact nothing stored before: which style
 * each scene is drawn in, and the couple's own words and part styles for it.
 * It is the Post Event twin of a template scene's `canvas.template` /
 * `canvas.elements` (`lib/hub-canvas.ts`), kept with the story because these
 * scenes are the story's, not a section row's. It never carries an order or an
 * eye (`post-event-scene-styles.test.ts` holds that).
 *
 * The Maker and the host's canvas read live-with-the-draft-laid-over-it
 * (`overlayPostEventDraftJson`); Apply writes the drafted keys back into the
 * story's row (`applyPostEventItems`). Guests read only the row.
 *
 * ── WHAT IS PRO ────────────────────────────────────────────────────────────
 * Show / hide and order are FREE (E4). A style pick is FREE (owner 2026-09-29,
 * "a design pick is free"). The words are free. A part's own FONT and its
 * ANIMATION are Event Hub Pro — the same two fields every other scene's parts
 * gate (`HUB_ELEMENT_PRO_FIELDS`, owner 2026-09-28) — tried in the draft, held
 * at Apply while everything free beside them goes live (`sceneLooksFreePart`).
 *
 * Pure. No I/O. Client-safe: the Maker's panel builds its patches with these.
 */

import {
  EDITORIAL_ORDERABLE_KEYS,
  resolveSectionOrder,
  type EditorialOrderKey,
} from '@/app/[slug]/_components/editorial/editorial-order';
import { readCustomColumns, sectionOrderToPersist, customColumnId } from '@/app/[slug]/_components/editorial/custom-columns';
import {
  HUB_SCENE_ELEMENT_KEYS,
  sanitizeHubElements,
  type HubElementStyle,
  type HubElementStyles,
  type HubSceneElementKey,
} from '@/lib/element-style';
import { HUB_ELEMENT_PRO_FIELDS, combineChanges, refChange, type LookChange } from '@/lib/hub-look-pro';
import { postEventSceneKeyForBlock } from '@/lib/post-event-scenes';
import { isPostEventStyleId, postEventLookKey, postEventStyleHome, type PostEventStyleId } from '@/lib/post-event-styles';

/**
 * The story's visibility switches — `EditorialSections` (`editorial/data.ts`,
 * `EDITORIAL_SECTION_KEYS`; that module is `server-only`, so the list is named
 * here and `post-event-draft.test.ts` holds the two equal).
 */
export const POST_EVENT_SECTION_KEYS = [
  'byTheNumbers',
  'gallery',
  'reviews',
  'team',
  'poweredBy',
  'liveWall',
  'fromTheCouple',
  'fromVendors',
  'vendorsWeLoved',
  'kwento',
  'challengeAnswers',
  'guestColumns',
  'watchFilm',
] as const;
export type PostEventSectionKey = (typeof POST_EVENT_SECTION_KEYS)[number];

/** The switches that are OFF. Absent = shown — the page's own rule (only `false` hides). */
export type PostEventSectionsOff = Partial<Record<PostEventSectionKey, false>>;

/* ── ONE SCENE'S LOOK ─────────────────────────────────────────────────────── */

/** The parts of a Post Event scene the couple can tap — the same three every scene has. */
export type PostEventPart = HubSceneElementKey;
export const POST_EVENT_PARTS: readonly PostEventPart[] = HUB_SCENE_ELEMENT_KEYS;

/** How long each part's own words may be. A scene is not a second website. */
export const POST_EVENT_WORDS_MAX: Readonly<Record<PostEventPart, number>> = {
  label: 60,
  heading: 120,
  body: 600,
};

export type PostEventSceneLook = {
  /** Absent = the type's recommended style (`resolvePostEventStyle`). */
  style?: PostEventStyleId;
  /** The couple's own words for a part. Absent = the words written from the day. */
  words?: Partial<Record<PostEventPart, string>>;
  /** A part's own font · size · colour · animation — `lib/element-style.ts`. */
  elements?: HubElementStyles;
};

/** Every scene's look, by its look key (`postEventLookKey` — the chapters share one). */
export type PostEventSceneLooks = Record<string, PostEventSceneLook>;

/**
 * The scene keys a look may be kept under — the compiled scenes' keys, with the
 * chapters as one. Anything else a POST names is dropped, never stored.
 */
export const POST_EVENT_LOOK_KEYS = [
  'cover',
  'before',
  'numbers',
  'chapters',
  'gallery',
  'film',
  'you',
  'wishes',
  'asked',
  'letters',
  'vendors',
  'wall',
  'said',
  'powered',
  'loved',
  'couple',
  'song',
  'next',
] as const;
const LOOK_KEYS = new Set<string>(POST_EVENT_LOOK_KEYS);

/** The story's arrangement as the Maker edits it. */
export type PostEventArrangement = {
  sections: PostEventSectionsOff;
  /** Null = the default order. */
  sectionOrder: string[] | null;
  sceneLooks: PostEventSceneLooks;
  /**
   * The couple's own workroom columns' ids — READ ONLY here. They take part in
   * the run's order (so moving a scene past one keeps it), and are written only
   * by the story workroom.
   */
  customIds: string[];
};

/** The drafted part: each key present ONLY when the couple changed it in the Maker. */
export type PostEventDraft = Partial<Pick<PostEventArrangement, 'sections' | 'sectionOrder' | 'sceneLooks'>>;

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/* ═══════════════════════════════════════════════════════════════════════════
   READING — every value through the same rule the page reads it by
   ═══════════════════════════════════════════════════════════════════════════ */

/** `sections` → the OFF set. Only an explicit `false` hides (the page's rule). */
export function readSectionsOff(raw: unknown): PostEventSectionsOff {
  const src = isObj(raw) ? raw : {};
  const out: PostEventSectionsOff = {};
  for (const k of POST_EVENT_SECTION_KEYS) if (src[k] === false) out[k] = false;
  return out;
}

const ORDERABLE = new Set<string>(EDITORIAL_ORDERABLE_KEYS);

/**
 * `sectionOrder` → the keys a story may store: a shipped orderable block, or a
 * well-formed `custom:<id>`. A dangling custom key is harmless — the page's
 * resolver admits a custom key only when its column exists — but nothing else
 * (a locked-close key, junk, a forged namespace) is ever kept. Empty → null.
 */
export function readStorableSectionOrder(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of raw) {
    if (typeof k !== 'string' || seen.has(k)) continue;
    if (!ORDERABLE.has(k) && !customColumnId(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length >= 40) break;
  }
  return out.length ? out : null;
}

function readWords(raw: unknown): Partial<Record<PostEventPart, string>> | null {
  if (!isObj(raw)) return null;
  const out: Partial<Record<PostEventPart, string>> = {};
  for (const part of POST_EVENT_PARTS) {
    const v = raw[part];
    if (typeof v !== 'string') continue;
    // Newlines are kept in the words (a paragraph break); nothing else of
    // markup survives — the page renders these as TEXT, never as HTML.
    const t = v.replace(/\r\n?/g, '\n').trim();
    if (!t || t.length > POST_EVENT_WORDS_MAX[part]) continue;
    out[part] = t;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Only a scene's three parts — never the hero's six. */
function readSceneElements(raw: unknown): HubElementStyles | null {
  const all = sanitizeHubElements(raw);
  if (!all) return null;
  const out: HubElementStyles = {};
  for (const part of POST_EVENT_PARTS) if (all[part]) out[part] = all[part];
  return Object.keys(out).length > 0 ? out : null;
}

/** One scene's look, or null when nothing usable is in it. */
export function readSceneLook(raw: unknown): PostEventSceneLook | null {
  if (!isObj(raw)) return null;
  const out: PostEventSceneLook = {};
  if (isPostEventStyleId(raw.style)) out.style = raw.style;
  const words = readWords(raw.words);
  if (words) out.words = words;
  const elements = readSceneElements(raw.elements);
  if (elements) out.elements = elements;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * `sceneLooks` → every scene's look, in the fixed key order (compared as JSON).
 * A style kept for a scene whose style lives on a section row is dropped — that
 * fact has ONE home (`postEventStyleHome`).
 */
export function readSceneLooks(raw: unknown): PostEventSceneLooks {
  if (!isObj(raw)) return {};
  const out: PostEventSceneLooks = {};
  for (const key of POST_EVENT_LOOK_KEYS) {
    const read = readSceneLook(raw[key]);
    if (!read) continue;
    const { style, ...rest } = read;
    const look = style && !postEventStyleHome(key) ? { style, ...rest } : rest;
    if (Object.keys(look).length > 0) out[key] = look;
  }
  return out;
}

/** The live story's arrangement, from its `draft_json`. */
export function postEventArrangementOf(draftJson: unknown): PostEventArrangement {
  const d = isObj(draftJson) ? draftJson : {};
  return {
    sections: readSectionsOff(d.sections),
    sectionOrder: readStorableSectionOrder(d.sectionOrder),
    sceneLooks: readSceneLooks(d.sceneLooks),
    customIds: readCustomColumns(d).map((c) => c.id),
  };
}

/**
 * Anything → a well-formed drafted part, or undefined when nothing usable is
 * in it. A draft `save` is a public POST like any other: every key is re-read
 * here through the page's own readers, never trusted.
 */
export function sanitizePostEventDraft(raw: unknown): PostEventDraft | undefined {
  if (!isObj(raw)) return undefined;
  const out: PostEventDraft = {};
  if ('sections' in raw && isObj(raw.sections)) out.sections = readSectionsOff(raw.sections);
  if ('sectionOrder' in raw && (raw.sectionOrder === null || Array.isArray(raw.sectionOrder))) {
    out.sectionOrder = readStorableSectionOrder(raw.sectionOrder);
  }
  if ('sceneLooks' in raw && isObj(raw.sceneLooks)) out.sceneLooks = readSceneLooks(raw.sceneLooks);
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Live with the draft laid over it — what the Maker and the host's canvas show. */
export function withPostEventDraft(live: PostEventArrangement, draft: PostEventDraft | null | undefined): PostEventArrangement {
  if (!draft) return live;
  return {
    sections: draft.sections !== undefined ? draft.sections : live.sections,
    sectionOrder: draft.sectionOrder !== undefined ? draft.sectionOrder : live.sectionOrder,
    sceneLooks: draft.sceneLooks !== undefined ? draft.sceneLooks : live.sceneLooks,
    customIds: live.customIds,
  };
}

/** The full thirteen-switch map `saveEditorial` stores. */
function sectionsMap(off: PostEventSectionsOff): Record<PostEventSectionKey, boolean> {
  const out = {} as Record<PostEventSectionKey, boolean>;
  for (const k of POST_EVENT_SECTION_KEYS) out[k] = off[k] !== false;
  return out;
}

/**
 * The story's `draft_json` with the drafted keys laid over it — a NEW object,
 * every other key (the words, the chapters' curation, the compiled scenes)
 * untouched. The host's canvas and the Maker's navigator read this; a guest
 * never does (the overlay is only ever handed a draft for a verified host).
 */
export function overlayPostEventDraftJson(
  draftJson: unknown,
  draft: PostEventDraft | null | undefined,
): Record<string, unknown> {
  const base = isObj(draftJson) ? { ...draftJson } : {};
  if (!draft) return base;
  if (draft.sections !== undefined) base.sections = sectionsMap(draft.sections);
  if (draft.sectionOrder !== undefined) {
    if (draft.sectionOrder === null) delete base.sectionOrder;
    else base.sectionOrder = draft.sectionOrder;
  }
  if (draft.sceneLooks !== undefined) {
    if (Object.keys(draft.sceneLooks).length === 0) delete base.sceneLooks;
    else base.sceneLooks = draft.sceneLooks;
  }
  return base;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE SCENE → WHAT IT ANSWERS TO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The block of the run a scene moves with, or null when its place is fixed
 * (the cover, Before the day, Were you there?, By the Numbers and the pinned
 * close). Every chapter moves with the chapters block — the day's chapters
 * stay in the order they happened.
 */
export function postEventRunKey(sceneKey: string): string | null {
  if (sceneKey === 'chapters' || /^ch-\d+$/.test(sceneKey)) return 'chapters';
  for (const block of EDITORIAL_ORDERABLE_KEYS) {
    if (block !== 'chapters' && postEventSceneKeyForBlock(block) === sceneKey) return block;
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE COUPLE'S EDITS — each returns the drafted keys it changes
   ═══════════════════════════════════════════════════════════════════════════ */

/** Show or hide a scene by its switch. */
export function postEventShow(arr: PostEventArrangement, sw: PostEventSectionKey, show: boolean): PostEventDraft {
  const sections: PostEventSectionsOff = { ...arr.sections };
  if (show) delete sections[sw];
  else sections[sw] = false;
  return { sections };
}

/** The run as the page draws it — the shipped blocks and the couple's own columns, resolved. */
export function postEventRun(arr: PostEventArrangement): string[] {
  return resolveSectionOrder(arr.sectionOrder, arr.customIds);
}

/**
 * Move a scene one place earlier (-1) or later (+1) in the run. Null when it
 * cannot move (its place is fixed, or it is already at that end). The order
 * stored is `sectionOrderToPersist`'s — the workroom's own rule — so the
 * default arrangement stores nothing.
 */
export function postEventMove(arr: PostEventArrangement, sceneKey: string, dir: -1 | 1): PostEventDraft | null {
  const key = postEventRunKey(sceneKey);
  if (!key) return null;
  const run = postEventRun(arr);
  const i = run.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= run.length) return null;
  const next = [...run];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return {
    sectionOrder: sectionOrderToPersist(next, EDITORIAL_ORDERABLE_KEYS as readonly EditorialOrderKey[], arr.customIds),
  };
}

/** The whole map with one scene's look replaced — an empty look is taken off. */
function withLook(arr: PostEventArrangement, sceneKey: string, look: PostEventSceneLook): PostEventDraft {
  const key = postEventLookKey(sceneKey);
  const next: Record<string, unknown> = { ...arr.sceneLooks };
  if (Object.keys(look).length === 0) delete next[key];
  else next[key] = look;
  return { sceneLooks: readSceneLooks(next) };
}

/** A scene's current look (the chapters share one). */
export function postEventLookOf(arr: PostEventArrangement, sceneKey: string): PostEventSceneLook {
  return arr.sceneLooks[postEventLookKey(sceneKey)] ?? {};
}

/**
 * Pick a style — FREE. Null (or the default) goes back to an absence, so the
 * default is never frozen into the story. 🔗 Null for a scene whose style lives
 * on a section row (`postEventStyleHome` — Schedule, Gallery): ONE value across
 * stages, written on that row's `canvas.style`, never a second copy here.
 */
export function postEventSetStyle(
  arr: PostEventArrangement,
  sceneKey: string,
  style: PostEventStyleId | null,
  recommended: PostEventStyleId | null,
): PostEventDraft | null {
  const key = postEventLookKey(sceneKey);
  if (!LOOK_KEYS.has(key) || postEventStyleHome(sceneKey)) return null;
  const { style: _was, ...rest } = postEventLookOf(arr, sceneKey);
  return withLook(arr, sceneKey, style && style !== recommended ? { ...rest, style } : rest);
}

/** A part's own words — null (or empty) goes back to the words written from the day. */
export function postEventSetWords(
  arr: PostEventArrangement,
  sceneKey: string,
  part: PostEventPart,
  text: string | null,
): PostEventDraft | { refused: 'too_long' } | null {
  const key = postEventLookKey(sceneKey);
  if (!LOOK_KEYS.has(key)) return null;
  const t = (text ?? '').replace(/\r\n?/g, '\n').trim();
  if (t.length > POST_EVENT_WORDS_MAX[part]) return { refused: 'too_long' };
  const look = postEventLookOf(arr, sceneKey);
  const words: Partial<Record<PostEventPart, string>> = { ...(look.words ?? {}) };
  if (t) words[part] = t;
  else delete words[part];
  const { words: _was, ...rest } = look;
  return withLook(arr, sceneKey, Object.keys(words).length > 0 ? { ...rest, words } : rest);
}

/** A scene's parts' own looks, replaced whole — what the element sheet sends. */
export function postEventSetElements(
  arr: PostEventArrangement,
  sceneKey: string,
  elements: HubElementStyles | null,
): PostEventDraft | null {
  const key = postEventLookKey(sceneKey);
  if (!LOOK_KEYS.has(key)) return null;
  const clean = readSceneElements(elements);
  const { elements: _was, ...rest } = postEventLookOf(arr, sceneKey);
  return withLook(arr, sceneKey, clean ? { ...rest, elements: clean } : rest);
}

/* ═══════════════════════════════════════════════════════════════════════════
   APPLY — what differs from live, what is Pro, and the row it writes
   ═══════════════════════════════════════════════════════════════════════════ */

export type PostEventApplyItem =
  | { field: 'sections'; value: PostEventSectionsOff; change: LookChange; pro: false }
  | { field: 'sectionOrder'; value: string[] | null; change: LookChange; pro: false }
  | {
      field: 'sceneLooks';
      value: PostEventSceneLooks;
      change: LookChange;
      /** A part's own font or animation added or changed — Event Hub Pro. */
      pro: boolean;
      /** Set only on the FREE PART of a held look (`sceneLooksFreePart`). */
      freePart?: true;
    };

const asText = (v: unknown): string | null => (v === null || v === undefined ? null : typeof v === 'string' ? v : JSON.stringify(v));
const offKeys = (s: PostEventSectionsOff) => Object.keys(s).sort().join(',');
const grows = (c: LookChange) => c === 'add' || c === 'change';

/**
 * The looks, live → drafted, as the ONE look rule sees them: only a part's own
 * FONT and ANIMATION are inputs (`HUB_ELEMENT_PRO_FIELDS`). A style, the words
 * and every other part field are never inputs — so no direction of them can
 * make the looks Pro.
 */
export function sceneLooksChange(live: PostEventSceneLooks, next: PostEventSceneLooks): LookChange {
  const changes: LookChange[] = [refChange('same', 'same')];
  const keys = new Set([...Object.keys(live), ...Object.keys(next)]);
  for (const key of keys) {
    for (const part of POST_EVENT_PARTS) {
      for (const field of HUB_ELEMENT_PRO_FIELDS) {
        changes.push(
          refChange(asText(live[key]?.elements?.[part]?.[field]), asText(next[key]?.elements?.[part]?.[field])),
        );
      }
    }
  }
  return combineChanges(...changes);
}

/**
 * 💎 THE FREE PART OF DRAFTED LOOKS — `next` with every Pro addition or change
 * put back to what is live, every free edit kept (the scene canvas's own rule,
 * `canvasFreePart` in `lib/hub-draft.ts`). 🔒 FAIL-CLOSED: checked against
 * `sceneLooksChange`; if anything Pro would still go through, live comes back.
 */
export function sceneLooksFreePart(live: PostEventSceneLooks, next: PostEventSceneLooks): PostEventSceneLooks {
  const out: Record<string, unknown> = {};
  for (const [key, look] of Object.entries(next)) {
    const was = live[key];
    const elements: Record<string, HubElementStyle> = {};
    for (const [part, style] of Object.entries(look.elements ?? {}) as Array<[PostEventPart, HubElementStyle]>) {
      const liveStyle = was?.elements?.[part];
      const el: Record<string, unknown> = { ...style };
      for (const field of HUB_ELEMENT_PRO_FIELDS) {
        if (grows(refChange(asText(liveStyle?.[field]), asText(style[field])))) {
          if (liveStyle?.[field] === undefined) delete el[field];
          else el[field] = liveStyle[field];
        }
      }
      if (Object.keys(el).length > 0) elements[part] = el as HubElementStyle;
    }
    const { elements: _e, ...rest } = look;
    out[key] = Object.keys(elements).length > 0 ? { ...rest, elements } : rest;
  }
  const free = readSceneLooks(out);
  return grows(sceneLooksChange(live, free)) ? live : free;
}

/**
 * Every drafted key that differs from the live story, in the order Apply
 * writes them. A key equal to live is not an item.
 */
export function classifyPostEventDraft(draft: PostEventDraft, liveDraftJson: unknown): PostEventApplyItem[] {
  const live = postEventArrangementOf(liveDraftJson);
  const items: PostEventApplyItem[] = [];
  if (draft.sections !== undefined && offKeys(draft.sections) !== offKeys(live.sections)) {
    items.push({ field: 'sections', value: draft.sections, change: 'change', pro: false });
  }
  if (draft.sectionOrder !== undefined) {
    const a = resolveSectionOrder(draft.sectionOrder, live.customIds);
    const b = resolveSectionOrder(live.sectionOrder, live.customIds);
    if (a.join('|') !== b.join('|')) items.push({ field: 'sectionOrder', value: draft.sectionOrder, change: 'change', pro: false });
  }
  if (draft.sceneLooks !== undefined && JSON.stringify(draft.sceneLooks) !== JSON.stringify(live.sceneLooks)) {
    const change = sceneLooksChange(live.sceneLooks, draft.sceneLooks);
    items.push({ field: 'sceneLooks', value: draft.sceneLooks, change: change === 'none' ? 'change' : change, pro: grows(change) });
  }
  return items;
}

/**
 * The story's `draft_json` with the applied items written in — a NEW object.
 * 🔒 IT TOUCHES THREE KEYS AND NOTHING ELSE: the couple's workroom words and
 * columns, the chapters' curation, the compiled scenes, and everything that
 * decides WHO reads the story (which is not in `draft_json` at all) stay
 * exactly as they were.
 */
export function applyPostEventItems(liveDraftJson: unknown, items: readonly PostEventApplyItem[]): Record<string, unknown> {
  const base = isObj(liveDraftJson) ? { ...liveDraftJson } : {};
  for (const item of items) {
    if (item.field === 'sections') base.sections = sectionsMap(item.value);
    else if (item.field === 'sectionOrder') {
      if (item.value === null) delete base.sectionOrder;
      else base.sectionOrder = item.value;
    } else {
      const clean = readSceneLooks(item.value);
      if (Object.keys(clean).length === 0) delete base.sceneLooks;
      else base.sceneLooks = clean;
    }
  }
  return base;
}

/** A sentence-ready name for one Post Event item (the Apply bar's "held back" list). */
export function postEventItemLabel(item: PostEventApplyItem): string {
  switch (item.field) {
    case 'sections':
      return 'Post Event · which scenes show';
    case 'sectionOrder':
      return 'Post Event · the order of its scenes';
    case 'sceneLooks':
      return 'Post Event · a font or an animation on a scene';
  }
}
