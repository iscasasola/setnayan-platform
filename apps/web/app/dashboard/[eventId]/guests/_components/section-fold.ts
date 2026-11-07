/**
 * section-fold.ts — which Guests › List headings are open, in BOTH states of the list:
 *
 *   • the whole list (no search, no Show / +1 narrowing): a heading is open when the host opened it (`open`);
 *   • a NARROWED list (a search, or a Show / +1 filter): every heading with a hit arrives open (G19 — a hit inside a
 *     folded heading looked exactly like "not found"), and a tap folds it (`shut`).
 *
 * 🐞 Owner, 3 Nov 2026, verbatim: "when using filter and picking on show and group by and the rest of the choices, i
 * cannot collapse the search results group." The narrowed list used to answer `true` for every heading, whatever the
 * host tapped — the tap changed `open`, which a narrowed list never read, so the header looked dead. The narrowed
 * list now keeps its own folds, scoped to the narrowing they were made under (`at`): a new search, Show or Group by
 * opens every hit again; folding under one narrowing never leaks into the next, nor into the whole list.
 *
 * 🔒 guests/_components/a-filtered-group-folds.test.ts
 */

/** The folds a narrowed list holds, and the narrowing they were made under. */
export type NarrowFolds = { readonly at: string | null; readonly keys: ReadonlySet<string> };

export const NO_FOLDS: NarrowFolds = { at: null, keys: new Set() };

/** One string per narrowing — null when the list is whole. A change of any part starts the folds afresh. */
export function narrowingOf(parts: {
  q: string;
  show: string | null;
  plus: string | null;
  group: string;
}): string | null {
  if (!parts.q && !parts.show && !parts.plus) return null;
  return JSON.stringify([parts.q, parts.show ?? '', parts.plus ?? '', parts.group]);
}

/** Is this heading open? */
export function sectionIsOpen(
  key: string,
  state: { narrowing: string | null; open: ReadonlySet<string>; folds: NarrowFolds },
): boolean {
  if (state.narrowing === null) return state.open.has(key);
  return !(state.folds.at === state.narrowing && state.folds.keys.has(key));
}

/** A copy of `set` with `keys` added (`add`) or taken out — the one fold step both lists use. */
export function foldSet(set: Iterable<string>, keys: Iterable<string>, add: boolean): Set<string> {
  const next = new Set(set);
  for (const k of keys) {
    if (add) next.add(k);
    else next.delete(k);
  }
  return next;
}

/** The folds of a narrowed list after a heading is opened or shut. */
export function foldNarrowed(folds: NarrowFolds, narrowing: string, keys: Iterable<string>, opening: boolean): NarrowFolds {
  return { at: narrowing, keys: foldSet(folds.at === narrowing ? folds.keys : [], keys, !opening) };
}
