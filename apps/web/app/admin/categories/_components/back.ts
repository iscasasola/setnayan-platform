/**
 * back.ts — where a save on "Categories & event types" lands afterwards.
 *
 * Every form on the page carries four hidden fields (`_list` · `_open` · `_q` ·
 * `_show`, rendered by `<BackFields>`), and every redirecting action reads them
 * through `backHref`, so a save keeps the same list, the same open panel, the
 * same search and the same Show ▾ filter. One module so the page and the
 * actions cannot disagree about the address.
 *
 * Address shape — `/admin/categories?list=…&open=…&q=…&show=…`:
 *   list  categories (default) · event-types · religions · hub-tools (admin supplier slice, 2026-10-28)
 *   open  g:<group id> · c:<category id> · s:<service key>   (categories list)
 *         p:<part key> · k:<service card id>                 (categories — the four-level map, ③b)
 *         <event_type>                                       (event types)
 *         <faith_key> · mixed                                (religions)
 *         c:<category id>                                     (hub tools — the category shown)
 *   show  requests · unfiled · religion · scoped · hidden · words (categories)
 *         needs · parts · nosvc-cat · nosvc-part             (the map's Show ▾, ③b)
 *   in    g:<group> · c:<category> — where the map stands (③b)
 *   at    the item the map has selected, drawer closed (③b)
 *   add   1 = the inline "+ Add" row is open (event types · religions; the
 *         categories list adds on the last row of each column since ③b)
 *
 * Pure: no React, no Supabase — imported by the server page, the client
 * islands and the 'use server' action files alike.
 */

export const CATEGORIES_PATH = '/admin/categories';

export const LISTS = ['categories', 'event-types', 'religions', 'hub-tools'] as const;
export type CategoriesList = (typeof LISTS)[number];

export const SHOWS = ['requests', 'unfiled', 'religion', 'scoped', 'hidden', 'words', 'needs', 'parts', 'nosvc-cat', 'nosvc-part'] as const;
export type CategoriesShow = (typeof SHOWS)[number];

export type BackState = {
  list: CategoriesList;
  open: string;
  q: string;
  show: CategoriesShow | '';
};

export function coerceList(v: string | null | undefined): CategoriesList {
  return (LISTS as readonly string[]).includes(v ?? '') ? (v as CategoriesList) : 'categories';
}

export function coerceShow(v: string | null | undefined): CategoriesShow | '' {
  return (SHOWS as readonly string[]).includes(v ?? '') ? (v as CategoriesShow) : '';
}

/** `open` is echoed into a URL, never into SQL or HTML — still, keep it to the
 *  characters a real key can contain (faith keys carry a space: "Born Again"). */
const SAFE_OPEN = /[^A-Za-z0-9_: -]/g;

export function cleanOpen(v: string | null | undefined): string {
  return String(v ?? '').replace(SAFE_OPEN, '').slice(0, 90);
}

/** Build a page address. Empty values are left out so URLs stay short. */
export function categoriesHref(
  state: Partial<BackState> & { add?: boolean; ok?: string; error?: string; in?: string; at?: string },
): string {
  const p = new URLSearchParams();
  const list = state.list ?? 'categories';
  if (list !== 'categories') p.set('list', list);
  if (state.q) p.set('q', state.q.slice(0, 80));
  if (state.show && list === 'categories') p.set('show', state.show);
  if (state.in && list === 'categories') p.set('in', cleanOpen(state.in));
  if (state.at && list === 'categories' && !state.open) p.set('at', cleanOpen(state.at));
  if (state.open) p.set('open', cleanOpen(state.open));
  if (state.add) p.set('add', '1');
  if (state.ok) p.set('ok', state.ok);
  if (state.error) p.set('error', state.error);
  const qs = p.toString();
  return qs ? `${CATEGORIES_PATH}?${qs}` : CATEGORIES_PATH;
}

/** The four hidden fields every form posts, read back. */
export function readBack(formData: FormData): BackState {
  return {
    list: coerceList(String(formData.get('_list') ?? '')),
    open: cleanOpen(String(formData.get('_open') ?? '')),
    q: String(formData.get('_q') ?? '').trim().slice(0, 80),
    show: coerceShow(String(formData.get('_show') ?? '')),
  };
}

/**
 * Where a redirecting action sends the admin. `override` lets an action that
 * KNOWS the better destination land there — a moved service lands on its new
 * category, a deleted category on its group.
 */
export function backHref(
  formData: FormData,
  kind: 'ok' | 'error',
  msg: string,
  override?: Partial<BackState>,
): string {
  const back = { ...readBack(formData), ...(override ?? {}) };
  return categoriesHref({ ...back, [kind]: msg });
}

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

/**
 * Read the address, including the Studio's old one: `/admin/taxonomy` forwards
 * here WITH its query, so `?view=vocab-event` lands on Event types,
 * `?view=vocab-faith` on Religions, `?view=requests` on Show ▾ › Requests, and
 * a bare `?open=<category>` opens that category.
 */
export function readState(sp: SearchParamsRecord): BackState {
  const view = first(sp.view);
  let list = coerceList(first(sp.list));
  let show = coerceShow(first(sp.show));
  if (!first(sp.list)) {
    if (view === 'vocab-event') list = 'event-types';
    if (view === 'vocab-faith') list = 'religions';
  }
  if (!first(sp.show)) {
    if (view === 'requests' || view === 'unfiled' || view === 'scoped') show = view;
    if (view === 'faith') show = 'religion';
  }
  let open = cleanOpen(first(sp.open));
  if (list === 'categories' && open && !/^[gcspk]:/.test(open)) open = `c:${open}`;
  return { list, open, q: first(sp.q).trim().slice(0, 80), show: list === 'categories' ? show : '' };
}


/**
 * Where the four-level map stands (③b): `in` (a group or category), `at` (the selected item while no
 * drawer is open). Old addresses keep working: `?open=c:<id>` / `g:` / `s:` (every link and every
 * redirect the page has ever written) opens that item's drawer with the map standing on it, and the
 * retired `?add=1` on the categories list simply lands on the map — each column ends in its own
 * "＋ Add …" row now.
 */
export function readMapParams(sp: SearchParamsRecord): { in: string; at: string } {
  const ctx = cleanOpen(first(sp.in));
  const at = cleanOpen(first(sp.at));
  return { in: /^[gc]:/.test(ctx) ? ctx : '', at: /^[gcspk]:/.test(at) ? at : '' };
}
