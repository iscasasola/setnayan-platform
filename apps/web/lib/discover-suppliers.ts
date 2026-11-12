/**
 * discover-suppliers.ts — WHEN Discover (`/`) shows its supplier view, and how its addresses are built.
 *
 * Owner, verbatim (2026-11-12): *"find suppliers needs to be also inside discover already. they do not need to have
 * their own page"*. Approved drawing: `prototypes/discover_with_suppliers_2026-11-12_fable.html` (DECISION_LOG
 * 2026-11-12 "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED"). Choosing a category, applying a filter, or "See all
 * suppliers" swaps Discover's shelves for a SUPPLIER VIEW on `/` — the same way a search already replaces them.
 *
 * Pure (no I/O, no React), so the rule is held by real assertions (`discover-suppliers.test.ts`), not a regex.
 *
 * ─── THE RULE FOR `q` (the drawing's Map card: "Typing in the one search while a category is open narrows that
 * category") ───────────────────────────────────────────────────────────────────────────────────────────────
 *   · no supplier parameter → `?q=` is Discover's own search, exactly as before (events, people, shops by name);
 *   · any supplier parameter → the supplier view, and `q` narrows IT (the marketplace's multi-field search).
 * `q` is therefore NOT a supplier parameter on its own — it is the one key both views read.
 */

/**
 * Every `/explore` parameter that opens (or travels with) the supplier view on `/` — `parseFilters` in
 * `app/(shell)/explore/_lib/marketplace-view.tsx` reads each of these. `browse` is the plain "show me the suppliers"
 * mark ("See all suppliers"; the old `/explore?browse=1` catalogue door — the drawing's Map card: "The link lands on
 * the supplier view"). `notice` is NOT here: the old compare notice is dropped (the compare line says it).
 */
export const DISCOVER_SUPPLIER_PARAM_KEYS = [
  'category',
  'folder',
  'tile',
  'city',
  'sort',
  'page',
  'verified',
  'match',
  'offseason',
  'event_type',
  'faith',
  'venue',
  'lens',
  'from',
  'browse',
] as const;

export type DiscoverSupplierParamKey = (typeof DISCOVER_SUPPLIER_PARAM_KEYS)[number];

/** The mark that opens the supplier view with nothing narrowed ("See all suppliers", "Clear all filters"). */
export const SUPPLIER_VIEW_MARK = { key: 'browse', value: '1' } as const;

const SUPPLIER_KEYS: ReadonlySet<string> = new Set(DISCOVER_SUPPLIER_PARAM_KEYS);

type ParamBag = Record<string, string | string[] | undefined> | URLSearchParams;

function firstOf(v: string | string[] | undefined | null): string {
  const one = Array.isArray(v) ? v[0] : v;
  return typeof one === 'string' ? one.trim() : '';
}

function entriesOf(params: ParamBag): Array<[string, string]> {
  if (params instanceof URLSearchParams) return [...params.entries()].map(([k, v]) => [k, v.trim()]);
  return Object.entries(params).map(([k, v]) => [k, firstOf(v)]);
}

/** Does this address open Discover's supplier view? Any supplier parameter with a value does; `q` alone does not. */
export function opensSupplierView(params: ParamBag): boolean {
  return entriesOf(params).some(([k, v]) => SUPPLIER_KEYS.has(k) && v.length > 0);
}

/**
 * A supplier-view address on `/` from its parameters. With no supplier parameter left (only `q`, or nothing), the
 * mark is added — otherwise "Clear all filters" or a cleared category would fall out of the supplier view into
 * Discover's search or its shelves.
 */
export function discoverSupplierHref(params: URLSearchParams): string {
  const out = new URLSearchParams(params);
  if (!opensSupplierView(out)) out.set(SUPPLIER_VIEW_MARK.key, SUPPLIER_VIEW_MARK.value);
  const qs = out.toString();
  return qs ? `/?${qs}` : '/';
}

/**
 * The supplier parameters the ONE search box must carry while the supplier view is open, so typing narrows the
 * category you are in (the drawing's Map card) instead of dropping it. `page` is left behind — new words start at
 * page 1 — and an empty value is never carried. Order follows `DISCOVER_SUPPLIER_PARAM_KEYS`.
 */
export function supplierSearchCarry(params: ParamBag): Array<[DiscoverSupplierParamKey, string]> {
  const have = new Map(entriesOf(params));
  const out: Array<[DiscoverSupplierParamKey, string]> = [];
  for (const k of DISCOVER_SUPPLIER_PARAM_KEYS) {
    if (k === 'page') continue;
    const v = have.get(k) ?? '';
    if (v) out.push([k, v]);
  }
  return out;
}

/**
 * Where a category pick goes, from the address you are on (`search` = `location.search`). A category replaces any
 * folder or tile scope (`tile` would otherwise win in the pipeline) and starts again at page 1; every other filter
 * stays. `null` = "All categories": the scope is dropped and the view stays open (the mark is added if nothing else
 * is left).
 */
export function categoryPickHref(search: string, category: string | null): string {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  p.delete('folder');
  p.delete('tile');
  p.delete('page');
  p.delete(SUPPLIER_VIEW_MARK.key);
  if (category) p.set('category', category);
  else p.delete('category');
  return discoverSupplierHref(p);
}
