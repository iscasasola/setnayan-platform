/**
 * lib/merge-from-base.ts — TWO HOSTS NEVER OVERWRITE EACH OTHER (owner 2026-10-18, "the similar fix").
 *
 * 🔴 THE INCIDENT. 2026-10-17, cale-ice: the Mood Board & Dress Code editor saved its WHOLE board from a copy taken
 * before the other host's change, and two women's colour sets (Immediate Family; Secondary Sponsors) were gone. Two
 * hosts on one event — an unlock belongs to the event, both edit — or one host on two phones, save at once; a save that
 * writes a whole value built from a stale copy silently wipes the other person's change.
 *
 * 🔑 THE ONE PATTERN — "merge from base". Every save carries the value its edit was BASED ON (`base`: what that screen
 * last knew the server held). The server then merges three values, never two:
 *   · `base`   — what this screen started from,
 *   · `mine`   — what this screen sends now,
 *   · `theirs` — what the server holds now (another screen may have moved it).
 * Whatever this screen did NOT change keeps the other writer's value. Objects merge KEY BY KEY, lists of items with an
 * `id` (or `key`) merge ITEM BY ITEM, named set-like lists merge as sets. Only when BOTH changed the SAME leaf does the
 * later save — this one — win, and that leaf is named in `clashed`. `moved` says the result differs from what this
 * screen sent: the screen must show the newest, with one calm line (`TWO_SCREENS_NOTE`) — never a modal, never a
 * choice ("we handle the chaos").
 *
 * The server-side half (one write at a time) lives with each table's writer: the Maker draft row is a compare-and-set
 * on its `updated_at` (`updateHubDraft`, lib/hub-draft-store.ts). Pure: no I/O, no React — the client imports it too.
 */

/** The one line a screen shows when another screen's change reached it — kept where the Maker's status words live. */
export { TWO_SCREENS_NOTE } from './maker-save-status';

/** The form field a save carries its base in (JSON, the same shape as what it sends). */
export { MERGE_BASE_FIELD } from './merge-base-field';

export type MergeOptions = {
  /** Keys whose value is a list of plain strings that means a SET (order and duplicates mean nothing) — e.g. `touched_roles`. */
  setKeys?: readonly string[];
};

export type Merged<T = unknown> = {
  value: T;
  /** Paths ("reception", "moments.m3.line") BOTH screens changed; this save's value was kept. */
  clashed: string[];
  /** The result differs from `mine`: another screen's change is in it, and this screen must show it. */
  moved: boolean;
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One spelling of a value — keys sorted, `undefined` dropped — so equal values compare equal however they were built. */
function canon(v: unknown): string {
  const sort = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(sort);
    if (isObj(x)) {
      const out: Obj = {};
      for (const k of Object.keys(x).sort()) if (x[k] !== undefined) out[k] = sort(x[k]);
      return out;
    }
    return x;
  };
  return JSON.stringify(sort(v)) ?? 'undefined';
}
export function sameValue(a: unknown, b: unknown): boolean {
  return canon(a) === canon(b);
}

/** The id an item of an id-list answers to: `id`, else `key` — a string, unique in its list. */
function itemId(v: unknown): string | null {
  if (!isObj(v)) return null;
  if (typeof v.id === 'string' && v.id) return v.id;
  if (typeof v.key === 'string' && v.key) return v.key;
  return null;
}
function idList(v: unknown): Map<string, unknown> | null {
  if (!Array.isArray(v)) return null;
  const m = new Map<string, unknown>();
  for (const item of v) {
    const id = itemId(item);
    if (id === null || m.has(id)) return null;
    m.set(id, item);
  }
  return m;
}
const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

function merge(base: unknown, mine: unknown, theirs: unknown, path: string, key: string, opts: MergeOptions, clashed: string[]): unknown {
  if (sameValue(mine, theirs)) return mine;
  if (sameValue(base, theirs)) return mine; // nobody else touched it
  if (sameValue(base, mine)) return theirs; // I did not touch it: theirs stands

  // A SET (`setKeys`): what I added and what they added both stay; what either took out goes.
  if (opts.setKeys?.includes(key) && (base === undefined || isStringList(base)) && isStringList(mine) && isStringList(theirs)) {
    const b = new Set(base ?? []);
    const mineAdded = mine.filter((x) => !b.has(x));
    const mineRemoved = new Set([...b].filter((x) => !mine.includes(x)));
    const out = theirs.filter((x) => !mineRemoved.has(x));
    for (const x of mineAdded) if (!out.includes(x)) out.push(x);
    return out;
  }

  // OBJECTS: key by key.
  if (isObj(mine) && isObj(theirs) && (base === undefined || base === null || isObj(base))) {
    const b: Obj = isObj(base) ? base : {};
    const out: Obj = {};
    for (const k of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      const v = merge(b[k], mine[k], theirs[k], path ? `${path}.${k}` : k, k, opts, clashed);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  // LISTS OF ITEMS WITH AN ID: item by item, in this screen's order, the other screen's new items after.
  const mi = idList(mine);
  const ti = idList(theirs);
  const bi = base === undefined || base === null ? new Map<string, unknown>() : idList(base);
  if (mi && ti && bi) {
    const out: unknown[] = [];
    const at = (id: string) => (path ? `${path}.${id}` : id);
    for (const [id, m] of mi) {
      if (ti.has(id)) {
        const v = merge(bi.get(id), m, ti.get(id), at(id), id, opts, clashed);
        if (v !== undefined) out.push(v);
      } else if (!bi.has(id)) {
        out.push(m); // I added it
      } else if (!sameValue(bi.get(id), m)) {
        clashed.push(at(id)); // they took it out, I changed it: mine (the later save) stays
        out.push(m);
      } // else: they took it out and I never touched it — it goes
    }
    for (const [id, t] of ti) {
      if (mi.has(id)) continue;
      if (!bi.has(id)) out.push(t); // they added it
      else if (!sameValue(bi.get(id), t)) {
        clashed.push(at(id)); // I took it out, they changed it — the later save (mine) wins: it goes
      } // else: I took it out — it goes
    }
    return out;
  }

  // A LEAF both changed: the later save wins, and says so.
  clashed.push(path || '(whole value)');
  return mine;
}

/**
 * Merge one save into what the server holds now, from the value the save was based on. `base === undefined` means the
 * screen did not say what it started from (an older page): the save is taken whole, exactly as before this fix.
 */
export function mergeFromBase<T>(base: unknown, mine: T, theirs: unknown, opts: MergeOptions = {}): Merged<T> {
  if (base === undefined) return { value: mine, clashed: [], moved: false };
  const clashed: string[] = [];
  const value = merge(base, mine, theirs, '', '', opts, clashed) as T;
  return { value, clashed, moved: !sameValue(value, mine) };
}

/**
 * ROW-SHAPED SAVES (a form that posts every field it shows — the guest card): which fields did THIS screen change?
 * `base` and `mine` are field → posted value(s). A field absent from `base` counts as changed (the screen never said).
 */
export function changedFields(base: Readonly<Record<string, unknown>>, mine: Readonly<Record<string, unknown>>): Set<string> {
  const out = new Set<string>();
  for (const k of new Set([...Object.keys(base), ...Object.keys(mine)])) {
    if (!(k in base) || !sameValue(base[k], mine[k])) out.add(k);
  }
  return out;
}
