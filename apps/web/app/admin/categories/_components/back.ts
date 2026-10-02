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
 *   list  categories (default) · event-types · religions
 *   open  g:<group id> · c:<category id> · s:<service key>   (categories list)
 *         <event_type>                                       (event types)
 *         <faith_key> · mixed                                (religions)
 *   show  requests · unfiled · religion · scoped · hidden · words (categories)
 *   add   1 = the inline "+ Add" row is open
 *
 * Pure: no React, no Supabase — imported by the server page, the client
 * islands and the 'use server' action files alike.
 */

export const CATEGORIES_PATH = '/admin/categories';

export const LISTS = ['categories', 'event-types', 'religions'] as const;
export type CategoriesList = (typeof LISTS)[number];

export const SHOWS = ['requests', 'unfiled', 'religion', 'scoped', 'hidden', 'words'] as const;
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
  state: Partial<BackState> & { add?: boolean; ok?: string; error?: string },
): string {
  const p = new URLSearchParams();
  const list = state.list ?? 'categories';
  if (list !== 'categories') p.set('list', list);
  if (state.q) p.set('q', state.q.slice(0, 80));
  if (state.show && list === 'categories') p.set('show', state.show);
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
  if (list === 'categories' && open && !/^[gcs]:/.test(open)) open = `c:${open}`;
  return { list, open, q: first(sp.q).trim().slice(0, 80), show: list === 'categories' ? show : '' };
}

