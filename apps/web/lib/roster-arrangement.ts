/**
 * roster-arrangement.ts — HOW THE GUEST LIST IS ARRANGED, as arithmetic.
 *
 * ⚖ Owner 2026-09-20, pointing at the roster's ROLE header: *"when you click
 * on this row … it will arrange everything by name, by side … by group …
 * role (grouped by their roles), etc. add a checkbox beside them so we can set
 * how they are arranged."* And for the phone: *"an icon on the header of the
 * table … which will ask us group it by how? then we check which ones we
 * want."*
 *
 * ── WHAT CHANGED, AND IT IS NOT THE CAPABILITY ─────────────────────────────
 * Every arrangement below was already reachable from the Sort dropdown, and it
 * is worth being honest that this adds almost no new behaviour: one sort key
 * (Seat), and grouping by more than one column at a time. What it adds is that
 * the control is now ON the thing it arranges. A dropdown named "Sort: Side"
 * sits beside a column headed SIDE and neither one points at the other.
 *
 * ── TWO CONTROLS, BECAUSE THEY ARE TWO QUESTIONS ───────────────────────────
 * Until now one `?sort=` answered both: choosing `side` ALSO sectioned by side,
 * choosing `rsvp` silently dropped every heading. So a host could not ask for
 * "role sections, ordered by RSVP inside each" — the two questions shared one
 * answer. They are separate here:
 *
 *   • SORT     — one key, the order of rows. The header LABEL sets it.
 *   • ARRANGEMENT — an ORDERED LIST of keys. The header CHECKBOX toggles one.
 *
 * ⚖ AND ONLY THE FIRST ONE MAKES HEADINGS — owner 2026-09-20, ruling on this
 * directly: *"first one only groups[,] the second and succeeding just arranges
 * and does not group."*
 *
 *     ['side']              → headings per side
 *     ['side','role']       → headings per side; INSIDE each, ordered by role
 *     ['side','role','name']→ …then by name
 *
 * 🔑 ONE LEVEL OF HEADINGS, ALWAYS. Nesting was the other available reading of
 * "we check which ones we want", and it is the one that turns a 200-guest list
 * into forty headings with two rows under each. A second tick refines the
 * ORDER, which is what a host actually wants from a second column.
 *
 * 🔑 THE ORDER OF THE LIST IS THE ORDER THEY WERE TICKED, so it is never
 * sorted or normalised: `['side','role']` and `['role','side']` are different
 * arrangements and a host gets whichever they asked for.
 *
 * ── BACKWARDS COMPATIBILITY IS LOAD-BEARING HERE ───────────────────────────
 * ⚠ `?sort=side` and `?sort=group` have sectioned the list for months and are
 * in people's history and bookmarks. `groupingFromParams` therefore DERIVES
 * the old sectioning whenever `?by=` is absent, so every existing link keeps
 * its exact layout; `?by=` present (including empty, meaning "no headings")
 * always wins. New behaviour never arrives by changing what an old URL means.
 *
 * PURE — no I/O, no clock, no React, no database. The lookups a bucket needs
 * (a guest's custom group, their table) arrive as an injected `ctx`, so this
 * file can be executed by a test rather than grepped in a server component.
 */

export type ArrangeKey = 'name' | 'side' | 'role' | 'group' | 'rsvp' | 'seat';

/** The columns the roster actually shows, in the order it shows them. */
export const ARRANGE_COLUMNS: readonly { key: ArrangeKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'side', label: 'Side' },
  { key: 'role', label: 'Role' },
  { key: 'group', label: 'Groups' },
  { key: 'rsvp', label: 'RSVP' },
  { key: 'seat', label: 'Seat' },
];

const ARRANGE_KEYS = new Set<string>(ARRANGE_COLUMNS.map((c) => c.key));

export function isArrangeKey(v: string): v is ArrangeKey {
  return ARRANGE_KEYS.has(v);
}

export function arrangeLabel(key: ArrangeKey): string {
  return ARRANGE_COLUMNS.find((c) => c.key === key)!.label;
}

/**
 * `?by=side,role` → ['side','role'].
 *
 * Unknown keys are DROPPED rather than refused — a stale or hand-edited URL
 * must still render a guest list. Duplicates are dropped too: a key can only
 * be one nesting level, and `by=side,side` would otherwise bucket a bucket
 * into itself and render a heading with every row under it twice.
 */
export function parseGrouping(raw: string): ArrangeKey[] {
  const out: ArrangeKey[] = [];
  for (const part of raw.split(',')) {
    const k = part.trim();
    if (isArrangeKey(k) && !out.includes(k)) out.push(k);
  }
  return out;
}

export function serializeGrouping(keys: readonly ArrangeKey[]): string {
  return keys.join(',');
}

/** The one key that makes headings, or null for a list with none. */
export function groupingKeyOf(keys: readonly ArrangeKey[]): ArrangeKey | null {
  return keys[0] ?? null;
}

/** The keys that only ORDER rows, applied in turn inside each heading. */
export function orderingKeysOf(keys: readonly ArrangeKey[]): ArrangeKey[] {
  return keys.slice(1);
}

/**
 * What the list is grouped by, given the URL.
 *
 * ⚠ THE ABSENT CASE IS NOT "NOTHING". When `?by=` has never been set, the
 * sectioning is derived from `?sort=` exactly as it was before this module
 * existed — that is what keeps every bookmarked link rendering what it always
 * rendered. An EMPTY `?by=` is a real answer ("no headings"), so it must be
 * distinguishable from absent: pass `undefined`, never `''`, for absent.
 */
export function groupingFromParams(
  by: string | undefined,
  sort: string,
): ArrangeKey[] {
  if (by !== undefined) return parseGrouping(by);
  if (sort === 'side') return ['side'];
  if (sort === 'group') return ['group'];
  if (sort === 'importance') return ['role'];
  return [];
}

/** Toggle one key, appending at the END so ticking order is nesting order. */
export function toggleGrouping(
  keys: readonly ArrangeKey[],
  key: ArrangeKey,
): ArrangeKey[] {
  return keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key];
}

// ── BUCKETING ──────────────────────────────────────────────────────────────

/**
 * Everything a bucket label needs that is not on the guest row itself.
 *
 * Each returns the label to show, or null for "this guest has none of that" —
 * which becomes its own trailing bucket rather than being hidden. A guest with
 * no table is still a guest, and a heading they fall out of is a guest the
 * host stops seeing.
 */
export type ArrangeCtx<G> = {
  lastName: (g: G) => string;
  sideLabel: (g: G) => string;
  roleGroupLabel: (g: G) => string;
  groupLabel: (g: G) => string | null;
  rsvpLabel: (g: G) => string;
  seatLabel: (g: G) => string | null;
  /**
   * [tier, label] — 0 placed · 1 suggested · 2 none.
   *
   * 🪤 A SEAT CANNOT BE ORDERED BY ITS OWN LABEL. "Suggested T1" sorts before
   * "Table 3" alphabetically, which puts every guess ahead of every real
   * assignment — so the tier is explicit rather than sniffed off the string.
   */
  seatRank: (g: G) => [number, string];
};

/** The label for a guest under one grouping key. */
export function bucketOf<G>(key: ArrangeKey, g: G, ctx: ArrangeCtx<G>): string {
  switch (key) {
    case 'name': {
      const ln = ctx.lastName(g).trim();
      // A first initial is not a surname initial. A guest saved with no last
      // name would otherwise all pile into one unlabelled bucket.
      return ln ? ln[0]!.toUpperCase() : 'No last name';
    }
    case 'side':
      return ctx.sideLabel(g);
    case 'role':
      return ctx.roleGroupLabel(g);
    case 'group':
      return ctx.groupLabel(g) ?? 'No group yet';
    case 'rsvp':
      return ctx.rsvpLabel(g);
    case 'seat':
      return ctx.seatLabel(g) ?? 'No table yet';
  }
}

/**
 * THE ONE ORDER, used twice.
 *
 * 🔑 Bucket order and row order are the SAME comparison — a known order first
 * (Bride's side before Groom's before Both), then anything unknown
 * alphabetically, with a "no value" bucket trailing. Deriving both from this
 * function is what stops "grouped by Side" and "ordered by Side" from
 * disagreeing about which side comes first.
 */
export function compareLabels(
  key: ArrangeKey,
  a: string,
  b: string,
  knownOrder: (key: ArrangeKey) => readonly string[],
): number {
  if (a === b) return 0;
  const known = knownOrder(key);
  const ia = known.indexOf(a);
  const ib = known.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  // A "No …" bucket trails its named siblings; two of them sort by name.
  const na = a.startsWith('No ');
  const nb = b.startsWith('No ');
  if (na !== nb) return na ? 1 : -1;
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Order two guests by one column. Returns 0 when the column cannot tell. */
export function compareByKey<G>(
  key: ArrangeKey,
  a: G,
  b: G,
  ctx: ArrangeCtx<G>,
  knownOrder: (key: ArrangeKey) => readonly string[],
): number {
  // ⚠ NOT the bucket label. Bucketing by name uses the first letter; ORDERING
  // by name has to use the whole surname, or every B sorts as one block in
  // whatever order they arrived.
  if (key === 'name') return ctx.lastName(a).localeCompare(ctx.lastName(b));
  if (key === 'seat') {
    const [ta, la] = ctx.seatRank(a);
    const [tb, lb] = ctx.seatRank(b);
    return ta - tb || la.localeCompare(lb, undefined, { numeric: true });
  }
  return compareLabels(key, bucketOf(key, a, ctx), bucketOf(key, b, ctx), knownOrder);
}

/**
 * The comparator for the ORDERING keys — every ticked column after the first,
 * applied in turn. Returns 0 when they all agree, so the caller's own sort
 * (`?sort=`) and its name tiebreak still decide.
 */
export function compareByKeys<G>(
  keys: readonly ArrangeKey[],
  a: G,
  b: G,
  ctx: ArrangeCtx<G>,
  knownOrder: (key: ArrangeKey) => readonly string[],
): number {
  for (const key of keys) {
    const r = compareByKey(key, a, b, ctx, knownOrder);
    if (r !== 0) return r;
  }
  return 0;
}

export type RosterSection<G> = {
  key: string;
  label: string;
  count: number;
  guests: G[];
};

/**
 * Split `guests` into ONE level of headings by `key`.
 *
 * ⚠ ORDER WITHIN A SECTION IS THE CALLER'S. `guests` arrives already sorted
 * and each section preserves that relative order, so the chosen sort still
 * decides rows under a heading. This function never re-sorts people; it only
 * decides which heading they fall under — which is why a sort and a grouping
 * can be chosen independently at all.
 */
export function buildRosterSections<G>(
  guests: readonly G[],
  key: ArrangeKey,
  ctx: ArrangeCtx<G>,
  knownOrder: (key: ArrangeKey) => readonly string[],
): RosterSection<G>[] {
  const buckets = new Map<string, G[]>();
  for (const g of guests) {
    const label = bucketOf(key, g, ctx);
    const bucket = buckets.get(label);
    if (bucket) bucket.push(g);
    else buckets.set(label, [g]);
  }
  return [...buckets.keys()]
    .sort((a, b) => compareLabels(key, a, b, knownOrder))
    .map((label) => ({
      key: `${key}:${label}`,
      label,
      count: buckets.get(label)!.length,
      guests: buckets.get(label)!,
    }));
}
