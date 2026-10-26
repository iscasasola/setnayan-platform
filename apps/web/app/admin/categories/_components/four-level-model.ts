/**
 * four-level-model.ts — the shapes and the PURE rules of the four-level map (🌳 ③b; corpus
 * prototypes/admin_taxonomy_four_levels_2026-10-26/interactive-v4.html — THE CONTRACT — and PLAN.md
 * § 7.1–7.8). No React, no Supabase: the server builds `MapData` (`load-map.ts`), the client map draws it,
 * the export route prints it, and the tests run every rule here directly.
 *
 * The four words, everywhere (PLAN § 0): Group (tier-1 `service_categories`) · Category (tier 2) ·
 * Service (`canonical_service`) · Part (`inspiration_parts`). A service card (one `vendor_services` row)
 * only ever appears INSIDE a service. "Leaf" is never printed.
 */
import { formatCount } from '@/lib/format-number';

export type MapGroup = { id: string; label: string; iconName: string | null; hidden: boolean };
export type MapCategory = {
  id: string;
  groupId: string;
  label: string;
  hidden: boolean;
  iconName: string | null;
  /** `service_categories.coarse_category` (③0-c) — what its shops are filed under; null = "Other". */
  coarse: string | null;
};
export type MapService = {
  key: string;
  label: string;
  /** Home category; null = unfiled. */
  tileId: string | null;
  /** Hidden from the suppliers' picker (`marketplace_hidden`). */
  hidden: boolean;
  /** Real `vendor_services` rows under it (demo shops excluded) — the row's "N cards". */
  cards: number;
};
export type MapPart = {
  key: string;
  label: string;
  /** Exactly one home category (the couple's board heading). */
  home: string;
  /** `inspiration_part_services` — the services whose shops may add photos. */
  services: string[];
  hidden: boolean;
};
export type MapCard = {
  id: string;
  title: string;
  price: number | null;
  active: boolean;
  service: string;
  shopId: string;
  shopName: string;
  /** The shop is public (`public_visibility = 'verified'`, the only public state). */
  shopPublic: boolean;
  photoUrl: string | null;
};

export type MapData = {
  groups: MapGroup[];
  categories: MapCategory[];
  services: MapService[];
  parts: MapPart[];
  cards: MapCard[];
  /** False when the parts read was refused — the Parts column then says so, never "no part". */
  partsRead: boolean;
  /** False when the cards read was refused. */
  cardsRead: boolean;
};

/** Selection: the context (`g:` group or `c:` category) and the highlighted item. */
export type MapSel = { g: string; c: string; sel: string };

export type Column = 'groups' | 'categories' | 'services' | 'parts' | 'cards';

/** 🔒 OWNER RULING "no fifth column" (2026-10-26): never more than FOUR columns on screen. */
export const MAX_COLUMNS = 4;

// ── lookups ───────────────────────────────────────────────────────────────────

export const groupById = (d: MapData, id: string) => d.groups.find((g) => g.id === id) ?? null;
export const categoryById = (d: MapData, id: string) => d.categories.find((c) => c.id === id) ?? null;
export const serviceByKey = (d: MapData, k: string) => d.services.find((s) => s.key === k) ?? null;
export const partByKey = (d: MapData, k: string) => d.parts.find((p) => p.key === k) ?? null;
export const cardById = (d: MapData, id: string) => d.cards.find((c) => c.id === id) ?? null;

export const categoriesOf = (d: MapData, groupId: string) => d.categories.filter((c) => c.groupId === groupId);
export const servicesOf = (d: MapData, categoryId: string) => d.services.filter((s) => s.tileId === categoryId);
export const partsHomedIn = (d: MapData, categoryId: string) => d.parts.filter((p) => p.home === categoryId);
export const partsOfService = (d: MapData, key: string) => d.parts.filter((p) => p.services.includes(key));
export const cardsOf = (d: MapData, keys: readonly string[]) => {
  const set = new Set(keys);
  return d.cards.filter((c) => set.has(c.service));
};

/** Every part a category's services feed — its HOME parts first, then the others (v4 Parts column). */
export function partsForCategory(d: MapData, categoryId: string): MapPart[] {
  const keys = new Set(servicesOf(d, categoryId).map((s) => s.key));
  const home = partsHomedIn(d, categoryId);
  const linked = d.parts.filter((p) => p.home !== categoryId && p.services.some((k) => keys.has(k)));
  return [...home, ...linked];
}

/** The service picked inside the current category (a selected service, or the service of a selected card). */
export function pickedService(d: MapData, s: MapSel): MapService | null {
  let key = '';
  if (s.sel.startsWith('s:')) key = s.sel.slice(2);
  else if (s.sel.startsWith('k:')) key = cardById(d, s.sel.slice(2))?.service ?? '';
  const sv = key ? serviceByKey(d, key) : null;
  return sv && sv.tileId === s.c ? sv : null;
}

/** The Parts column: narrowed to the picked service, else every part of the category's services. */
export function partsShown(d: MapData, s: MapSel): { list: MapPart[]; service: MapService | null } {
  if (!s.c) return { list: [], service: null };
  const sv = pickedService(d, s);
  return sv ? { list: partsOfService(d, sv.key), service: sv } : { list: partsForCategory(d, s.c), service: null };
}

/**
 * The Finder shift (PLAN § 7.8): with a SERVICE picked, Groups slides off and Cards takes the fourth slot.
 * The only place the columns are decided — the desktop map renders exactly this list.
 */
export function columnsFor(d: MapData, s: MapSel): Column[] {
  return pickedService(d, s) ? ['categories', 'services', 'parts', 'cards'] : ['groups', 'categories', 'services', 'parts'];
}

/** Resolve a selection from the address: `in` = g:<id> | c:<id>, `at` / `open` = the item. */
export function resolveSel(d: MapData, input: { in?: string; at?: string; open?: string }): MapSel {
  const item = input.open || input.at || '';
  let g = '';
  let c = '';
  const ctx = input.in ?? '';
  if (ctx.startsWith('c:') && categoryById(d, ctx.slice(2))) c = ctx.slice(2);
  else if (ctx.startsWith('g:') && groupById(d, ctx.slice(2))) g = ctx.slice(2);
  if (!c) {
    if (item.startsWith('c:')) c = categoryById(d, item.slice(2))?.id ?? '';
    else if (item.startsWith('s:')) c = serviceByKey(d, item.slice(2))?.tileId ?? '';
    else if (item.startsWith('p:')) c = partByKey(d, item.slice(2))?.home ?? '';
    else if (item.startsWith('k:')) {
      const cd = cardById(d, item.slice(2));
      c = cd ? serviceByKey(d, cd.service)?.tileId ?? '' : '';
    } else if (item.startsWith('g:') && !g) g = groupById(d, item.slice(2))?.id ?? '';
  }
  if (c) g = categoryById(d, c)?.groupId ?? g;
  return { g, c, sel: item };
}

/** The desktop default: the first group and its first category, so the map is never four empty boxes. */
export function withDesktopDefaults(d: MapData, s: MapSel): MapSel {
  const g = s.g || d.groups[0]?.id || '';
  const c = s.c || (g ? categoriesOf(d, g)[0]?.id ?? '' : '');
  return { ...s, g, c };
}

// ── words ─────────────────────────────────────────────────────────────────────

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

/** A card's status word (PLAN § 7.8, until the card checks ship: is_active + shop visibility stand in). */
export function cardWord(cd: MapCard): string {
  if (!cd.shopPublic) return 'Held · shop hidden';
  if (!cd.active) return 'Held · off';
  return 'Live';
}

export const cardHeld = (cd: MapCard) => !cd.active || !cd.shopPublic;

/** "6 of 6 here · + 3 other categories" — how a part row says which services it links. */
export function partLinkSummary(d: MapData, p: MapPart): { text: string; gap: boolean } {
  if (p.services.length === 0) return { text: 'no service', gap: true };
  const inHome = servicesOf(d, p.home);
  const own = p.services.filter((k) => serviceByKey(d, k)?.tileId === p.home).length;
  const otherCats = new Set(p.services.map((k) => serviceByKey(d, k)?.tileId).filter((t): t is string => !!t && t !== p.home));
  if (inHome.length > 0 && own === inHome.length && otherCats.size === 0) return { text: `all ${p.services.length} services`, gap: false };
  return {
    text: `${formatCount(own)} of ${formatCount(inHome.length)} here${otherCats.size ? ` · + ${plural(otherCats.size, 'other category', 'other categories')}` : ''}`,
    gap: false,
  };
}

/** The categories a part reaches (its home, then each linked service's own category) — for the drawer. */
export function partCategoryIds(d: MapData, p: MapPart): string[] {
  const out = [p.home];
  for (const k of p.services) {
    const t = serviceByKey(d, k)?.tileId;
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

// ── needs a look · gaps ───────────────────────────────────────────────────────

export const gapCategories = (d: MapData) => d.categories.filter((c) => servicesOf(d, c.id).length === 0);
export const gapParts = (d: MapData) => d.parts.filter((p) => p.services.length === 0);
/** A category whose shops would be filed under "Other" (③0-c part 2: "needs a look" lists it). */
export const unfiledCategories = (d: MapData) => d.categories.filter((c) => !c.coarse);
export const heldCards = (d: MapData) => d.cards.filter(cardHeld);

export function needsCount(d: MapData): number {
  return gapCategories(d).length + gapParts(d).length + heldCards(d).length + unfiledCategories(d).length;
}

export const categoryNeeds = (d: MapData, c: MapCategory) =>
  servicesOf(d, c.id).length === 0 || !c.coarse || servicesOf(d, c.id).some((s) => serviceNeeds(d, s));
export const serviceNeeds = (d: MapData, s: MapService) => cardsOf(d, [s.key]).some(cardHeld);
export const groupNeeds = (d: MapData, g: MapGroup) => categoriesOf(d, g.id).some((c) => categoryNeeds(d, c));

// ── search + Show ▾ (flat results: icon + path, tap = jump) ───────────────────

/** The Show ▾ choices the MAP answers (flat results); the shipped requests · unfiled · religion · scoped ·
 *  words keep the shipped list. "Hidden from couples" lists hidden groups, categories AND parts. */
export const MAP_SHOWS = ['needs', 'parts', 'nosvc-cat', 'nosvc-part', 'hidden'] as const;
export type MapShow = (typeof MAP_SHOWS)[number];

export type FlatHit =
  | { kind: 'group'; id: string; label: string; path: string; note?: string }
  | { kind: 'category'; id: string; label: string; path: string; note?: string }
  | { kind: 'service'; id: string; label: string; path: string; note?: string }
  | { kind: 'part'; id: string; label: string; path: string; note?: string }
  | { kind: 'card'; id: string; label: string; path: string; note?: string };

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function textHit(q: string, label: string): boolean {
  const n = fold(q.trim());
  return n.length > 0 && fold(label).includes(n);
}

function categoryPath(d: MapData, categoryId: string | null): string {
  const c = categoryId ? categoryById(d, categoryId) : null;
  if (!c) return 'Unfiled';
  return `${groupById(d, c.groupId)?.label ?? c.groupId} › ${c.label}`;
}

/**
 * Search across all four levels, every hit with its path (PLAN § 2.5: a part matches by its own name or
 * by any linked service's name — "via …"); or a Show ▾ list. Tests: `four-level-model.test.ts`.
 */
export function flatHits(d: MapData, q: string, show: string): FlatHit[] {
  const out: FlatHit[] = [];
  if (q.trim()) {
    for (const g of d.groups) if (textHit(q, g.label)) out.push({ kind: 'group', id: g.id, label: g.label, path: 'Group' });
    for (const c of d.categories) if (textHit(q, c.label)) out.push({ kind: 'category', id: c.id, label: c.label, path: groupById(d, c.groupId)?.label ?? c.groupId });
    for (const s of d.services) if (textHit(q, s.label)) out.push({ kind: 'service', id: s.key, label: s.label, path: categoryPath(d, s.tileId) });
    for (const p of d.parts) {
      const own = textHit(q, p.label);
      const via = own ? null : p.services.map((k) => serviceByKey(d, k)).find((s) => s && textHit(q, s.label)) ?? null;
      if (own || via) out.push({ kind: 'part', id: p.key, label: p.label, path: categoryPath(d, p.home), note: via ? `via ${via.label}` : undefined });
    }
    return out;
  }
  if (show === 'needs' || show === 'nosvc-cat') {
    for (const c of gapCategories(d)) out.push({ kind: 'category', id: c.id, label: c.label, path: groupById(d, c.groupId)?.label ?? '', note: 'no service' });
  }
  if (show === 'needs') {
    for (const c of unfiledCategories(d)) {
      if (servicesOf(d, c.id).length === 0) continue; // already listed as a gap
      out.push({ kind: 'category', id: c.id, label: c.label, path: groupById(d, c.groupId)?.label ?? '', note: 'shops filed under Other' });
    }
  }
  if (show === 'needs' || show === 'nosvc-part') {
    for (const p of gapParts(d)) out.push({ kind: 'part', id: p.key, label: p.label, path: categoryPath(d, p.home), note: 'no service' });
  }
  if (show === 'needs') {
    for (const cd of heldCards(d)) {
      const sv = serviceByKey(d, cd.service);
      out.push({ kind: 'card', id: cd.id, label: cd.title, path: `${categoryPath(d, sv?.tileId ?? null)} › ${sv?.label ?? cd.service}`, note: cardWord(cd) });
    }
  }
  if (show === 'parts') for (const p of d.parts) out.push({ kind: 'part', id: p.key, label: p.label, path: categoryPath(d, p.home) });
  if (show === 'hidden') {
    for (const g of d.groups) if (g.hidden) out.push({ kind: 'group', id: g.id, label: g.label, path: 'Group', note: 'hidden' });
    for (const c of d.categories) if (c.hidden) out.push({ kind: 'category', id: c.id, label: c.label, path: groupById(d, c.groupId)?.label ?? '', note: 'hidden' });
    for (const p of d.parts) if (p.hidden) out.push({ kind: 'part', id: p.key, label: p.label, path: categoryPath(d, p.home), note: 'hidden' });
  }
  return out;
}

/** The address a flat hit jumps to: its category in context, the item opened in the drawer. */
export function hitTarget(d: MapData, h: FlatHit): { in: string; open: string } {
  switch (h.kind) {
    case 'group':
      return { in: `g:${h.id}`, open: `g:${h.id}` };
    case 'category':
      return { in: `c:${h.id}`, open: `c:${h.id}` };
    case 'service':
      return { in: serviceByKey(d, h.id)?.tileId ? `c:${serviceByKey(d, h.id)!.tileId}` : '', open: `s:${h.id}` };
    case 'part':
      return { in: `c:${partByKey(d, h.id)?.home ?? ''}`, open: `p:${h.id}` };
    case 'card': {
      const sv = serviceByKey(d, cardById(d, h.id)?.service ?? '');
      return { in: sv?.tileId ? `c:${sv.tileId}` : '', open: `k:${h.id}` };
    }
  }
}

/** Near-match words for an add row ("Close to what we have"), across the level being added to. */
export function addPool(d: MapData, kind: 'group' | 'category' | 'service'): Array<{ key: string; label: string; where: string }> {
  if (kind === 'group') return d.groups.map((g) => ({ key: g.id, label: g.label, where: '' }));
  if (kind === 'category') return d.categories.map((c) => ({ key: c.id, label: c.label, where: groupById(d, c.groupId)?.label ?? '' }));
  return d.services.map((s) => ({ key: s.key, label: s.label, where: categoryById(d, s.tileId ?? '')?.label ?? '' }));
}
