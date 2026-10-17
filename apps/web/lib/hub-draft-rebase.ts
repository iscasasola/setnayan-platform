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

/** The live values a rebase compares with, for what the draft does not hold: `events` columns, and canvases by section. */
export type HubDraftRebaseLive = { events: Record<string, unknown>; canvas: Record<string, unknown> };

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
export function hubDraftRebaseNeeds(current: HubDraft, patch: HubDraftPatch, base: HubDraftState): { columns: string[]; canvases: string[] } {
  const columns = Object.keys(patch.events ?? {}).filter((c) => c in base.events && !(c in current.events));
  const canvases = Object.entries(patch.widgets ?? {})
    .filter(([t, w]) => w?.canvas !== undefined && base.widgets[t as keyof HubDraftState['widgets']]?.canvas !== undefined)
    .map(([t]) => t)
    .filter((t) => current.widgets[t as keyof HubDraftState['widgets']]?.canvas === undefined);
  return { columns, canvases };
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
    const theirs = col in current.events ? current.events[col] : theirsLive.events[col];
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
