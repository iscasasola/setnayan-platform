/**
 * apps/web/lib/post-event-draft.ts
 *
 * POST EVENT'S SCENES IN THE EVENT HUB DRAFT — show / hide, order, and the
 * couple's own scenes, edited in the Maker and reaching guests only at Apply.
 *
 * Owner, 2026-09-25 (DECISION_LOG "POST EVENT IS MANY SMALL SCENES"): Post Event
 * is its separate scenes, and the couple may *"add new scenes"* — add, remove
 * and reorder. Every Maker edit is a draft guests do not see until Apply
 * (owner 2026-09-24, "Apply · Restore · Reset").
 *
 * ── ONE SOURCE OF TRUTH — THE STORY'S OWN THREE KEYS ─────────────────────────
 * The live story has carried its arrangement for months in `event_editorial.
 * draft_json`: `sections` (which blocks show — only `false` hides),
 * `sectionOrder` (the run's order, with the couple's own columns as
 * `custom:<id>`) and `customColumns` (the couple's own columns). The guest page
 * reads exactly these (`editorial/data.ts`), the story workroom writes them
 * (`saveEditorial`), and P8's navigator reads them (`draftToScenes`).
 *
 * 🔑 THIS FILE ADDS NO FOURTH KEY AND NO SECOND ORDER. The draft holds a DRAFTED
 * COPY of those same three keys — only the ones the couple changed — exactly as
 * the draft already holds a drafted `display_order` for a section row. The
 * Maker and the host's canvas read live-with-the-draft-laid-over-it
 * (`overlayPostEventDraftJson`); Apply writes the drafted keys back into the
 * story's row (`applyPostEventItems`). Guests read only the row.
 *
 * ── WHAT IS PRO ────────────────────────────────────────────────────────────
 * Show / hide and order are FREE (build plan D4, prototype "Order · Free").
 * Editing or removing a scene that is already live is the couple's own words —
 * free. A NEW scene of their own is Pro (prototype "Your own scene · Pro"): a
 * free couple may try it in the draft, and Apply holds it back until Event Hub
 * Pro, keeping everything else it can apply.
 *
 * Pure. No I/O. Client-safe: the Maker's panel builds its patches with these.
 */

import {
  EDITORIAL_ORDERABLE_KEYS,
  resolveSectionOrder,
  type EditorialOrderKey,
} from '@/app/[slug]/_components/editorial/editorial-order';
import {
  CUSTOM_COLUMN_BODY_MAX,
  CUSTOM_COLUMN_TITLE_MAX,
  MAX_CUSTOM_COLUMNS,
  customColumnId,
  customColumnKey,
  readCustomColumns,
  sectionOrderToPersist,
  type CustomColumn,
} from '@/app/[slug]/_components/editorial/custom-columns';
import { postEventPreset, type PostEventPresetId } from '@/lib/post-event-presets';
import { postEventSceneKeyForBlock } from '@/lib/post-event-scenes';

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

/** The story's arrangement — the three keys, complete. */
export type PostEventArrangement = {
  sections: PostEventSectionsOff;
  /** Null = the default order. */
  sectionOrder: string[] | null;
  customColumns: CustomColumn[];
};

/** The drafted part: each key present ONLY when the couple changed it in the Maker. */
export type PostEventDraft = Partial<PostEventArrangement>;

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
export function readSectionOrder(raw: unknown): string[] | null {
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

/** The live story's arrangement, from its `draft_json`. */
export function postEventArrangementOf(draftJson: unknown): PostEventArrangement {
  const d = isObj(draftJson) ? draftJson : {};
  return {
    sections: readSectionsOff(d.sections),
    sectionOrder: readSectionOrder(d.sectionOrder),
    customColumns: readCustomColumns(d),
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
    out.sectionOrder = readSectionOrder(raw.sectionOrder);
  }
  if ('customColumns' in raw && Array.isArray(raw.customColumns)) {
    out.customColumns = readCustomColumns({ customColumns: raw.customColumns });
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Live with the draft laid over it — what the Maker and the host's canvas show. */
export function withPostEventDraft(live: PostEventArrangement, draft: PostEventDraft | null | undefined): PostEventArrangement {
  if (!draft) return live;
  return {
    sections: draft.sections !== undefined ? draft.sections : live.sections,
    sectionOrder: draft.sectionOrder !== undefined ? draft.sectionOrder : live.sectionOrder,
    customColumns: draft.customColumns !== undefined ? draft.customColumns : live.customColumns,
  };
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
  if (draft.customColumns !== undefined) {
    if (draft.customColumns.length === 0) delete base.customColumns;
    else base.customColumns = draft.customColumns;
  }
  return base;
}

/** The full thirteen-switch map `saveEditorial` stores. */
function sectionsMap(off: PostEventSectionsOff): Record<PostEventSectionKey, boolean> {
  const out = {} as Record<PostEventSectionKey, boolean>;
  for (const k of POST_EVENT_SECTION_KEYS) out[k] = off[k] !== false;
  return out;
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
  if (customColumnId(sceneKey)) return sceneKey;
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

/** The run as the page draws it — the shipped blocks and the couple's own, resolved. */
export function postEventRun(arr: PostEventArrangement): string[] {
  return resolveSectionOrder(arr.sectionOrder, arr.customColumns.map((c) => c.id));
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
    sectionOrder: sectionOrderToPersist(
      next,
      EDITORIAL_ORDERABLE_KEYS as readonly EditorialOrderKey[],
      arr.customColumns.map((c) => c.id),
    ),
  };
}

export type PostEventEditRefusal = 'full' | 'unknown_preset' | 'empty_title' | 'empty_body' | 'too_long' | 'bad_id' | 'missing';

/** A fresh id for a new scene — the reader's own shape (`[a-z0-9]{4,24}`). */
export function newPostEventSceneId(random: () => number = Math.random): string {
  let id = 'pe';
  for (let i = 0; i < 10; i += 1) id += '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(random() * 36)]!;
  return id;
}

/** Add one of Post Event's presets as the couple's own scene, at the end of the run. */
export function postEventAdd(
  arr: PostEventArrangement,
  presetId: PostEventPresetId,
  id: string,
): PostEventDraft | { refused: PostEventEditRefusal } {
  const preset = postEventPreset(presetId);
  if (!preset) return { refused: 'unknown_preset' };
  if (arr.customColumns.length >= MAX_CUSTOM_COLUMNS) return { refused: 'full' };
  const col: CustomColumn = { id, title: preset.title, body: preset.body, preset: preset.id };
  const customColumns = readCustomColumns({ customColumns: [...arr.customColumns, col] });
  if (!customColumns.some((c) => c.id === id)) return { refused: 'bad_id' };
  // The run places a column nobody has dragged at its end — the resolver's own
  // rule — so a new scene needs no order written, unless an order is stored
  // (then it is appended to it, so it lands last and stays there).
  const out: PostEventDraft = { customColumns };
  if (arr.sectionOrder) out.sectionOrder = [...arr.sectionOrder, customColumnKey(id)];
  return out;
}

/** Rewrite one of the couple's own scenes' words. Neither may be left empty. */
export function postEventEdit(
  arr: PostEventArrangement,
  id: string,
  title: string,
  body: string,
): PostEventDraft | { refused: PostEventEditRefusal } {
  const t = title.trim();
  if (!arr.customColumns.some((c) => c.id === id)) return { refused: 'missing' };
  if (!t) return { refused: 'empty_title' };
  if (!body.trim()) return { refused: 'empty_body' };
  if (t.length > CUSTOM_COLUMN_TITLE_MAX || body.length > CUSTOM_COLUMN_BODY_MAX) return { refused: 'too_long' };
  return { customColumns: arr.customColumns.map((c) => (c.id === id ? { ...c, title: t, body } : c)) };
}

/** Remove one of the couple's own scenes — its column and its place in the run. */
export function postEventRemove(arr: PostEventArrangement, id: string): PostEventDraft {
  const key = customColumnKey(id);
  return {
    customColumns: arr.customColumns.filter((c) => c.id !== id),
    ...(arr.sectionOrder ? { sectionOrder: readSectionOrder(arr.sectionOrder.filter((k) => k !== key)) } : {}),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   APPLY — what differs from live, what is Pro, and the row it writes
   ═══════════════════════════════════════════════════════════════════════════ */

export type PostEventApplyItem =
  | { field: 'sections'; value: PostEventSectionsOff; pro: false }
  | { field: 'sectionOrder'; value: string[] | null; pro: false }
  /** Edits and removals of scenes that are already live — the couple's words. */
  | { field: 'customColumns'; value: CustomColumn[]; pro: false }
  /** A scene of their own that is not live yet — Pro. */
  | { field: 'newScene'; value: CustomColumn; pro: true };

const offKeys = (s: PostEventSectionsOff) => Object.keys(s).sort().join(',');

/**
 * Every drafted key that differs from the live story, in the order Apply
 * writes them. A key equal to live is not an item.
 */
export function classifyPostEventDraft(draft: PostEventDraft, liveDraftJson: unknown): PostEventApplyItem[] {
  const live = postEventArrangementOf(liveDraftJson);
  const items: PostEventApplyItem[] = [];
  if (draft.sections !== undefined && offKeys(draft.sections) !== offKeys(live.sections)) {
    items.push({ field: 'sections', value: draft.sections, pro: false });
  }
  if (draft.sectionOrder !== undefined) {
    const ids = [...new Set([...live.customColumns, ...(draft.customColumns ?? [])].map((c) => c.id))];
    const a = resolveSectionOrder(draft.sectionOrder, ids);
    const b = resolveSectionOrder(live.sectionOrder, ids);
    if (a.join('|') !== b.join('|')) items.push({ field: 'sectionOrder', value: draft.sectionOrder, pro: false });
  }
  if (draft.customColumns !== undefined) {
    const liveIds = new Set(live.customColumns.map((c) => c.id));
    const existing = draft.customColumns.filter((c) => liveIds.has(c.id));
    if (JSON.stringify(existing) !== JSON.stringify(live.customColumns)) {
      items.push({ field: 'customColumns', value: existing, pro: false });
    }
    for (const c of draft.customColumns) {
      if (!liveIds.has(c.id)) items.push({ field: 'newScene', value: c, pro: true });
    }
  }
  return items;
}

/**
 * The story's `draft_json` with the applied items written in — a NEW object.
 * 🔒 IT TOUCHES THREE KEYS AND NOTHING ELSE: the couple's words, the chapters'
 * curation, the compiled scenes, and everything that decides WHO reads the
 * story (which is not in `draft_json` at all) stay exactly as they were.
 */
export function applyPostEventItems(
  liveDraftJson: unknown,
  items: readonly PostEventApplyItem[],
): Record<string, unknown> {
  const base = isObj(liveDraftJson) ? { ...liveDraftJson } : {};
  let columns: CustomColumn[] | null = null;
  const live = postEventArrangementOf(liveDraftJson);
  for (const item of items) {
    if (item.field === 'sections') base.sections = sectionsMap(item.value);
    else if (item.field === 'sectionOrder') {
      if (item.value === null) delete base.sectionOrder;
      else base.sectionOrder = item.value;
    } else if (item.field === 'customColumns') columns = item.value;
  }
  const added = items.filter((i): i is Extract<PostEventApplyItem, { field: 'newScene' }> => i.field === 'newScene');
  if (columns !== null || added.length > 0) {
    const list = [...(columns ?? live.customColumns)];
    for (const a of added) if (!list.some((c) => c.id === a.value.id)) list.push(a.value);
    const clean = readCustomColumns({ customColumns: list });
    if (clean.length === 0) delete base.customColumns;
    else base.customColumns = clean;
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
    case 'customColumns':
      return 'Post Event · your scenes’ words';
    case 'newScene':
      return `Post Event · your new scene “${item.value.title}”`;
  }
}
