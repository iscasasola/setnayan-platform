/**
 * lib/guests-filter.ts — THE ONE ⇅ OF GUESTS: Show · Group by · Sort, one state for every view (R4 slice 1).
 *
 * Owner, 2026-10-29 (Guests prototype v12–v26, `renderThumb` / `filterSheet` / `setShow`): every Guests view — List, Map,
 * Seats, March — wears the same thumb row (`components/thumb-row.tsx`), and its ⇅ is ONE dropdown with up to three
 * sections. What it shows is ONE state, shared by the summary carousel's count doors, the List and the Map, and kept in
 * the address (`?gshow=` · `?ggroup=` · `?gsort=` — prefixed like `?gview=`: the page already reads a plain `?group=`
 * (a group's id, which NARROWS the server's read) and `?sort=` (its own order), so a bare name would collide), so a reload or a shared link opens the same list, and a switch between
 * views keeps it.
 *
 *   Show      — All · Attending · Not coming · No reply · To invite. The carousel's four count doors ARE these choices
 *               (`ReplyFilter`, `replyFilterMatches`) — a tap on a count and a pick here are one state.
 *   Group by  — the List's sections and the Map's circles: Role · Side · Group · RSVP, and on the List also Last name
 *               (A–Z headings — the shipped Sort's fifth choice, kept). The Map has no Last name: there it draws its
 *               own shipped default. NOTHING NEW: these are the shipped `ROSTER_VIEWS` / `MAP_ARRANGE`.
 *   Sort      — the List only: the order inside a heading. "Importance" is the shipped order (the page's
 *               importance-then-name read); Name and Table are re-orderings of the same rows, nothing read.
 *
 * Seats and March offer Show only (their people are not sectioned by these).
 *
 * Pure: no React, no I/O. The menu is built here so every view's ⇅ is the same list in the same words.
 * 🔒 lib/guests-filter.test.ts
 */
import {
  MAP_ARRANGE,
  ROSTER_VIEWS,
  isMapArrange,
  isRosterView,
  type MapArrange,
  type ReplyFilter,
  type RosterView,
} from '@/lib/guest-roster-view';
import { RSVP_ROW_WORDS } from '@/lib/guests';
import type { GuestsView } from '@/lib/guests-views';

export type GuestsSort = 'importance' | 'name' | 'table';

export type GuestsFilter = {
  /** Null = everyone. */
  show: ReplyFilter | null;
  /** Null = each view's shipped default (List: Role; Map: Side where the event has sides, else Role). */
  group: RosterView | null;
  sort: GuestsSort;
};

export const NO_GUESTS_FILTER: GuestsFilter = { show: null, group: null, sort: 'importance' };

/** Show, in the carousel's words and order (the four count doors, then everyone first). */
export const GUESTS_SHOW: readonly { key: ReplyFilter | 'all'; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'attending', label: RSVP_ROW_WORDS.attending },
  { key: 'declined', label: RSVP_ROW_WORDS.declined },
  { key: 'none', label: RSVP_ROW_WORDS.pending },
  { key: 'toinvite', label: 'To invite' },
];

export const GUESTS_SORTS: readonly { key: GuestsSort; label: string }[] = [
  { key: 'importance', label: 'Importance' },
  { key: 'name', label: 'Name' },
  { key: 'table', label: 'Table' },
];

const REPLY_FILTERS: readonly ReplyFilter[] = ['attending', 'declined', 'none', 'toinvite'];

function isReplyFilter(v: string | null | undefined): v is ReplyFilter {
  return REPLY_FILTERS.includes(v as ReplyFilter);
}
function isGuestsSort(v: string | null | undefined): v is GuestsSort {
  return GUESTS_SORTS.some((s) => s.key === v);
}

/** The address's words — `g`-prefixed, never the page's own `?group=` (a group id) or `?sort=`. */
export const FILTER_PARAMS = { show: 'gshow', group: 'ggroup', sort: 'gsort' } as const;

type Params = Record<string, string | string[] | undefined> | URLSearchParams;
const one = (sp: Params, k: string): string | null => {
  if (sp instanceof URLSearchParams) return sp.get(k);
  const v = sp[k];
  return typeof v === 'string' ? v : null;
};

/** The filter an address asks for — anything unknown is dropped, never guessed. */
export function parseGuestsFilter(sp: Params): GuestsFilter {
  const show = one(sp, FILTER_PARAMS.show);
  const group = one(sp, FILTER_PARAMS.group);
  const sort = one(sp, FILTER_PARAMS.sort);
  return {
    show: isReplyFilter(show) ? show : null,
    group: isRosterView(group) ? group : null,
    sort: isGuestsSort(sort) ? sort : 'importance',
  };
}

/** Write the filter into a URL's search params — only what differs from the default, so a plain list stays bare. */
export function writeGuestsFilter(params: URLSearchParams, f: GuestsFilter): URLSearchParams {
  const out = new URLSearchParams(params);
  if (f.show) out.set(FILTER_PARAMS.show, f.show);
  else out.delete(FILTER_PARAMS.show);
  if (f.group) out.set(FILTER_PARAMS.group, f.group);
  else out.delete(FILTER_PARAMS.group);
  if (f.sort !== 'importance') out.set(FILTER_PARAMS.sort, f.sort);
  else out.delete(FILTER_PARAMS.sort);
  return out;
}

/** A Guests address with the filter carried on it (a view switch keeps what is shown). */
export function hrefWithGuestsFilter(href: string, f: GuestsFilter): string {
  const [path, query = ''] = href.split('?');
  const qs = writeGuestsFilter(new URLSearchParams(query), f).toString();
  return qs ? `${path}?${qs}` : path!;
}

/** The List's grouping: the shared choice, else the shipped default (Role). */
export function listGroupOf(f: GuestsFilter): RosterView {
  return f.group ?? 'role';
}

/** The Map's grouping: the shared choice when the Map draws it (no Last name), else the Map's shipped default. */
export function mapGroupOf(f: GuestsFilter, hasSides: boolean): MapArrange {
  if (f.group && isMapArrange(f.group) && (hasSides || f.group !== 'side')) return f.group;
  return hasSides ? 'side' : 'role';
}

/** Anything narrowed or re-ordered away from the plain list — the ⇅'s dot. */
export function guestsFilterIsOn(f: GuestsFilter, view: GuestsView): boolean {
  if (f.show) return true;
  if (view === 'list') return f.group !== null || f.sort !== 'importance';
  if (view === 'map') return f.group !== null;
  return false;
}

/** One ⇅ option — `group` is the menu's section heading; the current choice of each section wears a ✓. */
export type GuestsFilterOption = { key: string; label: string; group: 'Show' | 'Group by' | 'Sort'; on: boolean };

/**
 * The ⇅ menu for one view, in the prototype's order: Show, then Group by (List · Map), then Sort (List). The keys are
 * `show:<key>`, `group:<key>`, `sort:<key>` — `applyGuestsFilterPick` reads them back.
 */
export function guestsFilterOptions(view: GuestsView, f: GuestsFilter, opts: { hasSides: boolean }): GuestsFilterOption[] {
  const out: GuestsFilterOption[] = GUESTS_SHOW.map((s) => ({
    key: `show:${s.key}`,
    label: s.label,
    group: 'Show',
    on: (f.show ?? 'all') === s.key,
  }));
  if (view === 'list') {
    const cur = listGroupOf(f);
    for (const v of ROSTER_VIEWS) {
      if (v.key === 'side' && !opts.hasSides) continue;
      out.push({ key: `group:${v.key}`, label: v.label, group: 'Group by', on: cur === v.key });
    }
    for (const s of GUESTS_SORTS) out.push({ key: `sort:${s.key}`, label: s.label, group: 'Sort', on: f.sort === s.key });
  } else if (view === 'map') {
    const cur = mapGroupOf(f, opts.hasSides);
    for (const v of MAP_ARRANGE) {
      if (v.key === 'side' && !opts.hasSides) continue;
      // The Map's own words were "By side…"; the section heading says "Group by", so the choice is the bare word.
      out.push({ key: `group:${v.key}`, label: ROSTER_VIEWS.find((r) => r.key === v.key)?.label ?? v.label, group: 'Group by', on: cur === v.key });
    }
  }
  return out;
}

/** A ⇅ pick → the next filter, or null when the key is not a filter key (an add way, Select, the Excel file…). */
export function applyGuestsFilterPick(f: GuestsFilter, key: string): GuestsFilter | null {
  const [kind, value = ''] = key.split(':');
  if (kind === 'show') return { ...f, show: value === 'all' ? null : isReplyFilter(value) ? value : f.show };
  if (kind === 'group') return isRosterView(value) ? { ...f, group: value } : f;
  if (kind === 'sort') return isGuestsSort(value) ? { ...f, sort: value } : f;
  return null;
}

/**
 * The List's order inside each heading. Importance is the order the rows came in (the page's read). Name and Table only
 * re-order the same rows — a +1 stays beside their guest because the sections keep a +1 beside them by rank.
 */
export function sortGuestsFor<G extends { guest_id: string; first_name: string | null; last_name: string | null }>(
  rows: readonly G[],
  sort: GuestsSort,
  tableOf: (id: string) => string | null,
): readonly G[] {
  if (sort === 'importance') return rows;
  const name = (g: G) => `${g.first_name ?? ''} ${g.last_name ?? ''}`.trim().toLocaleLowerCase();
  const out = rows.slice();
  if (sort === 'name') out.sort((a, b) => name(a).localeCompare(name(b)));
  else
    out.sort((a, b) => {
      const ta = tableOf(a.guest_id);
      const tb = tableOf(b.guest_id);
      // Seated first, by the table's own label (natural order: "Table 2" before "Table 10"); then everyone unseated.
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      const byTable = ta && tb ? ta.localeCompare(tb, undefined, { numeric: true }) : 0;
      return byTable || name(a).localeCompare(name(b));
    });
  return out;
}
