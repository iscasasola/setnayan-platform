/**
 * lib/hub-draft-rebase.ts — A MAKER SAVE MERGED FROM WHAT IT WAS BASED ON (owner 2026-10-18, two hosts never overwrite).
 *
 * Some Maker saves send a WHOLE value built from the screen's own copy: the Mood Board's painted board (`role_palette`),
 * the dress code (`dress_code_config`), the Love Story (`love_story`), a scene's canvas. The draft's merge
 * (`mergeHubDraft`) replaces such a value whole — so a copy taken before the other host's change wiped that change
 * (2026-10-17, cale-ice: two women's colour sets). A save that also sends its `base` (`MERGE_BASE_FIELD`, the same shape
 * as its patch: the value as that screen last knew it) is merged three ways here first (`mergeFromBase`): what the screen
 * did not change keeps the other host's value; a value both changed — the later save, this one, wins and is named.
 *
 * Pure. `theirs` for a value the draft does not hold is the LIVE value (what the screen showed), passed in by the caller.
 */
import { mergeFromBase } from './merge-from-base';
import { sanitizeHubDraftPatch, type HubDraft, type HubDraftPatch, type HubDraftState } from './hub-draft';

/** Set-like lists inside a rebased value (a role the couple painted stays painted when the other host paints another). */
export const HUB_DRAFT_REBASE_SET_KEYS = ['touched_roles'] as const;

/** Event columns the draft holds KEY BY KEY (`mergeHubDraft`): a save is merged only against the keys it sends. */
export const HUB_DRAFT_KEYED_COLUMNS: ReadonlyArray<string> = ['style_preferences', 'print_details'];
const isPlainObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The live values a rebase compares with, for what the draft does not hold: `events` columns, canvases by section —
 * and (round 3) a section's other whole values (`fields`: `main`, `custom`, by section) and the Post Event story's keys
 * (`editorial`, read through the story's own reader). Absent = not read: the save is taken as sent there.
 */
export type HubDraftRebaseLive = {
  events: Record<string, unknown>;
  canvas: Record<string, unknown>;
  fields?: Record<string, Record<string, unknown>>;
  editorial?: Record<string, unknown>;
};

/**
 * 👥 A section's whole values (beside its canvas) a based save may send — merged three ways like a canvas (round 3): a
 * scene of their own's words (`custom`: a heading and a body). NOT the Main background (`main`): its kinds (a photo that
 * follows the hero, the couple's own clip, a pattern, the theme's) share no fields, so merging two of them field by field
 * draws a background nobody picked — a pick there is whole, and the later pick is the background.
 */
export const HUB_DRAFT_REBASE_WIDGET_FIELDS = ['custom'] as const;

export type HubDraftRebased = {
  patch: HubDraftPatch;
  /** "role_palette.bridesmaids", "canvas:hero.title" … — values both screens changed (this save's value was kept). */
  clashed: string[];
  /** Another screen's change is in the result: the screen must show the merged values (`merged`). */
  moved: boolean;
  /** Only the values that differ from what the screen sent — what it must now show. */
  merged: HubDraftPatch;
};

/** Which live values a rebase of `patch` on `current` needs (the based values the draft does not hold). */
export function hubDraftRebaseNeeds(current: HubDraft, patch: HubDraftPatch, base: HubDraftState): { columns: string[]; canvases: string[]; editorial: boolean } {
  const columns = Object.keys(patch.events ?? {}).filter((c) => c in base.events && !(c in current.events));
  type T = keyof HubDraftState['widgets'];
  const fields = ['canvas', ...HUB_DRAFT_REBASE_WIDGET_FIELDS] as const;
  // A section whose live row must be read: a based whole value (canvas, main, custom) the draft does not hold.
  const canvases = Object.entries(patch.widgets ?? {})
    .filter(([t, w]) =>
      fields.some(
        (f) => (w as Record<string, unknown> | undefined)?.[f] !== undefined && (base.widgets[t as T] as Record<string, unknown> | undefined)?.[f] !== undefined && (current.widgets[t as T] as Record<string, unknown> | undefined)?.[f] === undefined,
      ),
    )
    .map(([t]) => t);
  const editorial = Object.keys(patch.editorial ?? {}).some((k) => base.editorial && k in base.editorial && !(current.editorial && k in current.editorial));
  return { columns, canvases, editorial };
}

/**
 * The save, merged from its base onto `current` (the draft as it is now). `rawBase === undefined` (an older page, or a
 * writer that sends single values): the patch exactly as sent.
 */
export function rebaseHubDraftPatch(current: HubDraft, patch: HubDraftPatch, rawBase: unknown, live: HubDraftRebaseLive): HubDraftRebased {
  const none: HubDraftRebased = { patch, clashed: [], moved: false, merged: {} };
  if (rawBase === undefined || rawBase === null) return none;
  const base = sanitizeHubDraftPatch(rawBase);
  const mine = sanitizeHubDraftPatch(patch);
  const theirsLive = sanitizeHubDraftPatch({ events: live.events, widgets: Object.fromEntries(Object.entries(live.canvas).map(([t, c]) => [t, { canvas: c }])) });
  const out: HubDraftPatch = { ...patch, ...(patch.events ? { events: { ...patch.events } } : {}), ...(patch.widgets ? { widgets: { ...patch.widgets } } : {}) };
  const merged: HubDraftPatch = {};
  const clashed: string[] = [];
  let moved = false;

  for (const col of Object.keys(mine.events) as Array<keyof HubDraftState['events']>) {
    if (!(col in base.events)) continue;
    let theirs: unknown = col in current.events ? current.events[col] : theirsLive.events[col];
    /* 🔑 A KEYED blob (`style_preferences`, `print_details`) is drafted KEY BY KEY (`mergeHubDraft`): a save sends only
       its own keys, so it is merged only against THOSE keys of what is held — every other key is not this save's to
       merge (nor news to this screen). Round 2: the blocks' looks (`useBlockLooksDraft`) send one key of
       `style_preferences` with its base. */
    if (HUB_DRAFT_KEYED_COLUMNS.includes(col) && isPlainObj(mine.events[col])) {
      const held = isPlainObj(theirs) ? theirs : {};
      theirs = Object.fromEntries(Object.keys(mine.events[col] as object).filter((k) => k in held).map((k) => [k, held[k]]));
    }
    const m = mergeFromBase(base.events[col], mine.events[col], theirs, { setKeys: HUB_DRAFT_REBASE_SET_KEYS });
    out.events![col] = m.value;
    for (const p of m.clashed) clashed.push(`${col}.${p}`);
    if (m.moved) {
      moved = true;
      (merged.events ??= {})[col] = m.value;
    }
  }
  for (const [type, w] of Object.entries(mine.widgets) as Array<[keyof HubDraftState['widgets'], NonNullable<HubDraftState['widgets'][keyof HubDraftState['widgets']]>]>) {
    if (w.canvas === undefined) continue;
    const b = base.widgets[type]?.canvas;
    if (b === undefined) continue;
    const drafted = current.widgets[type]?.canvas;
    const theirs = drafted !== undefined ? drafted : theirsLive.widgets[type]?.canvas;
    // A canvas that is not there is the empty canvas — unless this save takes the canvas off (`null`), a leaf.
    const m = w.canvas === null ? mergeFromBase(b, null, theirs ?? null) : mergeFromBase(b ?? {}, w.canvas, theirs ?? {});
    out.widgets![type] = { ...(out.widgets![type] ?? {}), canvas: m.value };
    for (const p of m.clashed) clashed.push(`canvas:${type}.${p}`);
    if (m.moved) {
      moved = true;
      ((merged.widgets ??= {})[type] ??= {}).canvas = m.value;
    }
  }
  /* 👥 ROUND 3 — a section's OTHER whole values (a scene of their own's `custom` words): the same three-way merge as its
     canvas, against the draft's value or the live row's. */
  for (const [type, w] of Object.entries(mine.widgets) as Array<[keyof HubDraftState['widgets'], Record<string, unknown>]>) {
    for (const f of HUB_DRAFT_REBASE_WIDGET_FIELDS) {
      if (w[f] === undefined) continue;
      const b = (base.widgets[type] as Record<string, unknown> | undefined)?.[f];
      if (b === undefined) continue;
      const drafted = (current.widgets[type] as Record<string, unknown> | undefined)?.[f];
      const theirs = drafted !== undefined ? drafted : live.fields?.[type]?.[f];
      if (theirs === undefined && !live.fields) continue; // not read: taken as sent
      const m = w[f] === null ? mergeFromBase(b, null, theirs ?? null) : mergeFromBase(b ?? {}, w[f], theirs ?? {});
      const outW = out.widgets as Record<string, Record<string, unknown> | undefined>;
      outW[type] = { ...(outW[type] ?? {}), [f]: m.value };
      for (const pth of m.clashed) clashed.push(`${f}:${type}.${pth}`);
      if (m.moved) {
        moved = true;
        const mw = (merged.widgets ??= {}) as Record<string, Record<string, unknown> | undefined>;
        mw[type] = { ...(mw[type] ?? {}), [f]: m.value };
      }
    }
  }
  /* 👥 …and the Post Event story's drafted keys (`editorial`: `sections`, `sectionOrder`, `sceneLooks` — each replaced
     whole by the draft): a scene's look sent from a stale arrangement keeps the other host's other scenes. */
  if (mine.editorial && base.editorial) {
    const ed: Record<string, unknown> = { ...(out.editorial ?? {}) };
    for (const [k, v] of Object.entries(mine.editorial)) {
      if (!(k in base.editorial)) continue;
      const theirs = current.editorial && k in current.editorial ? (current.editorial as Record<string, unknown>)[k] : live.editorial?.[k];
      if (theirs === undefined && !live.editorial) continue;
      const m = mergeFromBase((base.editorial as Record<string, unknown>)[k], v, theirs ?? null);
      ed[k] = m.value;
      for (const pth of m.clashed) clashed.push(`editorial.${k}.${pth}`);
      if (m.moved) {
        moved = true;
        ((merged.editorial ??= {}) as Record<string, unknown>)[k] = m.value;
      }
    }
    out.editorial = ed as HubDraftPatch['editorial'];
  }
  return { patch: out, clashed, moved, merged };
}

/**
 * ✓ WHAT APPLY LEAVES IN THE DRAFT, when another screen saved while Apply ran. Apply read the draft (`applied`), wrote
 * what it could live and keeps only what it held back (`left`). If the draft moved on in the meantime (`now`), the
 * other screen's saves are NOT live yet — they must stay drafted: everything Apply did not take keeps `now`'s value,
 * everything the other screen changed keeps `now`'s value even where Apply took the old one off. The Wedding March's
 * moves are a list in order: what Apply left of the old list, then the moves added since.
 */
export function draftLeftAfterApply(applied: HubDraft, left: HubDraft, now: HubDraft | null): HubDraft {
  if (!now) return left;
  const state = (d: HubDraft): HubDraftState => {
    const { v: _v, history: _h, ...rest } = d;
    return rest;
  };
  const base = state(applied);
  // mine = the other screen's draft (its change wins where both moved a value), theirs = Apply's trim.
  const m = mergeFromBase(base, state(now), state(left));
  const out = { ...(m.value as HubDraftState) };
  const baseMarch = base.march ?? [];
  const nowMarch = now.march ?? [];
  const sameStart = nowMarch.length >= baseMarch.length && baseMarch.every((mv, i) => JSON.stringify(mv) === JSON.stringify(nowMarch[i]));
  if (sameStart) {
    const march = [...(left.march ?? []), ...nowMarch.slice(baseMarch.length)];
    if (march.length > 0) out.march = march;
    else delete out.march;
  }
  return { v: 1, ...out, events: out.events ?? {}, widgets: out.widgets ?? {}, history: [] };
}
