/**
 * model.ts — the shapes "Categories & event types" renders, and the pure rules
 * that turn them into list rows, counts and read-only links.
 *
 * Pure on purpose (no React, no Supabase): the server page builds these from
 * the database (`load.ts`), the list and panels render them, and the tests run
 * every rule here directly — including the four flows the approved prototype
 * draws (`flows.test.ts`).
 *
 * Words: "service" (never "leaf"), "supplier" (never "vendor"), "group" (a
 * tier-1 folder), "category" (a tier-2 tile). The stored keys keep their names.
 */
import type { CategoriesShow } from './back';
import { rankTaxonomyOptions, type RankableOption } from '@/lib/taxonomy-search-rank';

// ── Supplier categories ──────────────────────────────────────────────────────

export type Group = {
  id: string;
  label: string;
  short: string;
  iconName: string | null;
};

export type RefinementOption = {
  optionKey: string;
  emoji: string;
  label: string;
  status: string;
  photoRaw: string | null;
  photoUrl: string | null;
};

/** One "what couples choose" card (onboarding_refinements anchored to a category). */
export type RefinementCard = {
  leafKey: string;
  label: string;
  description: string;
  status: string;
  /** Faith-adaptive ceremony card — options follow the couple's religion. */
  dynamic: boolean;
  /** Matched card (ceremony / catering / photo_video) — options renamable, never added or removed. */
  isProjectable: boolean;
  mainPhotoRaw: string | null;
  mainPhotoUrl: string | null;
  options: RefinementOption[];
};

export type Category = {
  id: string;
  groupId: string;
  label: string;
  slug: string;
  iconName: string | null;
  photoRaw: string | null;
  photoUrl: string | null;
  /** NULL / [] = every event type (universal). Edited on the event type only. */
  eventTypes: string[] | null;
  hidden: boolean;
  sortOrder: number;
  serviceCount: number;
  faithCount: number;
  refinementCount: number;
};

export type SupplierFieldOption = { value: string; retired: boolean };

/** One field suppliers fill in for a service (category_specific_attributes[key]). */
export type SupplierField = {
  key: string;
  type: string;
  label: string;
  retired: boolean;
  options: SupplierFieldOption[];
};

export type SearchWord = {
  id: number;
  phrase: string;
  /** true = reviewed (answers suppliers); false = waiting for a person. */
  live: boolean;
  source: string;
};

export type Service = {
  canonical: string;
  en: string;
  tl: string | null;
  tileId: string | null;
  faith: string | null;
  ph: boolean;
  rental: boolean;
  tradition: boolean;
  /** Hidden from the suppliers' picker / marketplace (marketplace_hidden). */
  hidden: boolean;
  dietary: string | null;
  secondaryTiles: string[];
  /** Per-service override. NULL / [] = same as its category. */
  eventTypes: string[] | null;
  schemaVersion: number;
  sharedGroups: string[];
  fields: SupplierField[];
  words: SearchWord[];
  /** How many supplier requests were mapped onto this service (the demand signal). */
  askedFor: number;
};

export type RequestDraft = {
  suggestedLabel: string;
  suggestedTileId: string | null;
  suggestedTileLabel: string | null;
  tileReason: string | null;
  verdict: 'new' | 'existing';
  closestExisting: { canonical: string; label: string } | null;
  nearMatches: Array<{ canonical: string; label: string; whyNot: string }>;
  draftedBy: string;
};

export type SupplierRequest = {
  requestId: string;
  proposedLabel: string;
  proposedNote: string | null;
  supplierName: string;
  draft: RequestDraft | null;
};

export type Deadline = {
  deadlineId: string;
  kind: string;
  refKey: string;
  scope: string;
  label: string | null;
  offsetValue: number;
  offsetUnit: string;
  isActive: boolean;
};

/** One plan group's deadline pair, as it sits on a category (or group) panel. */
export type PlanDeadline = {
  planGroupId: string;
  label: string;
  /** The recommended "book by" row, when one exists. */
  bookBy: Deadline | null;
  /** Last-minute window start in months; null = off. */
  lastMinute: number | null;
};

export type VocabLabel = { key: string; label: string };

// ── Event types ─────────────────────────────────────────────────────────────

export type EventTypeStatusWord = 'picker' | 'hidden' | 'retired';

export type EventType = {
  key: string;
  label: string;
  emoji: string;
  description: string | null;
  sortOrder: number;
  status: string;
  enabled: boolean;
  onboardingHref: string | null;
  heroPhotoUrl: string | null;
};

// ── Religions ───────────────────────────────────────────────────────────────

export type LaunchStatus = 'active' | 'coming_soon' | 'disabled';

export type Religion = {
  /** TITLE-CASE faith_key — never lowercase it. */
  key: string;
  label: string;
  status: string;
  isCivil: boolean;
  sortOrder: number;
  /** NULL = wedding only (the meaning before the column existed). */
  askedOn: string[] | null;
  /** events.ceremony_type key ('catholic', 'born_again', 'civil'), or null when unmapped. */
  ceremonyType: string | null;
  launch: {
    status: LaunchStatus;
    threshold: number;
    vendorCount: number;
    venueCount: number;
    total: number;
    ready: boolean;
  } | null;
};

// ── Pure rules ──────────────────────────────────────────────────────────────

/** The status word an event type's two columns spell. */
export function eventTypeStatusWord(t: Pick<EventType, 'status' | 'enabled'>): EventTypeStatusWord {
  if (t.status === 'retired') return 'retired';
  return t.enabled ? 'picker' : 'hidden';
}

export const EVENT_TYPE_STATUS_LABEL: Record<EventTypeStatusWord, string> = {
  picker: 'In the picker',
  hidden: 'Hidden from couples',
  retired: 'Retired',
};

export const LAUNCH_STATUS_LABEL: Record<LaunchStatus, string> = {
  active: 'Live',
  coming_soon: 'Coming soon',
  disabled: 'Switched off',
};

/** Does a category serve this event type? NULL / [] = every type. */
export function categoryServes(eventTypes: string[] | null, eventType: string): boolean {
  return !eventTypes || eventTypes.length === 0 || eventTypes.includes(eventType);
}

/**
 * The read-only "Shows for events" line on a category, in the SAME words the
 * event type panel edits it with. Universal reads "All events".
 */
export function showsForLabel(eventTypes: string[] | null, vocab: readonly VocabLabel[]): string {
  if (!eventTypes || eventTypes.length === 0) return 'All events';
  const label = new Map(vocab.map((v) => [v.key, v.label]));
  return eventTypes.map((k) => label.get(k) ?? k).join(' · ');
}

/** How many categories an event type offers, and how many are tailored to it. */
export function offeredCount(categories: readonly Category[], eventType: string): {
  offered: number;
  tailored: number;
  total: number;
} {
  let offered = 0;
  let tailored = 0;
  for (const c of categories) {
    if (!categoryServes(c.eventTypes, eventType)) continue;
    offered += 1;
    if (c.eventTypes && c.eventTypes.length > 0) tailored += 1;
  }
  return { offered, tailored, total: categories.length };
}

/**
 * Which religions an event type asks about — the read-only "Religions asked"
 * line on the event type panel, derived from each religion's own "Asked on".
 * NULL on a religion means wedding only.
 */
export function religionsAskedOn(religions: readonly Religion[], eventType: string): Religion[] {
  return religions.filter((r) =>
    r.status === 'active' && (r.askedOn === null ? eventType === 'wedding' : r.askedOn.includes(eventType)),
  );
}

/** A religion's effective "Asked on" list (NULL → wedding). */
export function askedOnKeys(r: Pick<Religion, 'askedOn'>): string[] {
  return r.askedOn === null ? ['wedding'] : r.askedOn;
}

/**
 * Next "Asked on" list after ticking or unticking one event type — the full
 * list the action stores. Starts from the effective list, so a wedding-only
 * religion keeps the wedding when another type is added.
 */
export function toggleAskedOn(r: Pick<Religion, 'askedOn'>, eventType: string): string[] {
  const now = new Set(askedOnKeys(r));
  if (now.has(eventType)) now.delete(eventType);
  else now.add(eventType);
  return [...now].sort();
}

/** Case-blind text match for the one search box. */
export function matches(q: string, ...texts: Array<string | null | undefined>): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return texts.some((t) => (t ?? '').toLowerCase().includes(needle));
}

export type CategoryListRow =
  | { kind: 'group'; group: Group; categories: CategoryListRow[]; categoryCount: number }
  | { kind: 'category'; category: Category; services: Service[]; requests: SupplierRequest[] };

/**
 * The Supplier categories list: Group › Category rows, filtered by the one
 * search box and the Show ▾ filter. A search that matches a SERVICE keeps its
 * category and lists the service under it, so a service is never unfindable
 * from the list. Requests ride as ghost rows under their suggested category.
 */
export function categoryListRows(input: {
  groups: readonly Group[];
  categories: readonly Category[];
  services: readonly Service[];
  requests: readonly SupplierRequest[];
  q: string;
  show: CategoriesShow | '';
}): Extract<CategoryListRow, { kind: 'group' }>[] {
  const { q, show } = input;
  const byTile = new Map<string, Service[]>();
  for (const s of input.services) {
    if (!s.tileId) continue;
    const list = byTile.get(s.tileId) ?? [];
    list.push(s);
    byTile.set(s.tileId, list);
  }
  const requestsByTile = new Map<string, SupplierRequest[]>();
  for (const r of input.requests) {
    const tile = r.draft?.suggestedTileId;
    if (!tile) continue;
    const list = requestsByTile.get(tile) ?? [];
    list.push(r);
    requestsByTile.set(tile, list);
  }

  const out: Extract<CategoryListRow, { kind: 'group' }>[] = [];
  for (const g of input.groups) {
    const groupHit = q ? matches(q, g.label, g.short, g.id) : false;
    const cats: CategoryListRow[] = [];
    const inGroup = input.categories.filter((c) => c.groupId === g.id);
    for (const c of inGroup) {
      if (show === 'religion' && c.faithCount === 0) continue;
      if (show === 'scoped' && !(c.eventTypes && c.eventTypes.length > 0)) continue;
      if (show === 'hidden' && !c.hidden) continue;
      const services = byTile.get(c.id) ?? [];
      const catHit = !q || groupHit || matches(q, c.label, c.id);
      const serviceHits = q ? services.filter((s) => matches(q, s.en, s.tl, s.canonical)) : [];
      if (!catHit && serviceHits.length === 0) continue;
      cats.push({
        kind: 'category',
        category: c,
        services: q ? serviceHits : [],
        requests: show === '' ? requestsByTile.get(c.id) ?? [] : [],
      });
    }
    if (cats.length === 0 && !(groupHit && show === '')) continue;
    out.push({ kind: 'group', group: g, categories: cats, categoryCount: inGroup.length });
  }
  return out;
}

/** "Unfiled": services with a schema but no category. */
export function unfiledServices(services: readonly Service[], q: string): Service[] {
  return services.filter((s) => !s.tileId && matches(q, s.en, s.tl, s.canonical));
}

/** "Words waiting": every search word still waiting for a person, across services. */
export function wordsWaiting(services: readonly Service[], q: string): Array<{ service: Service; word: SearchWord }> {
  const out: Array<{ service: Service; word: SearchWord }> = [];
  for (const s of services) {
    for (const w of s.words) {
      if (w.live) continue;
      if (!matches(q, w.phrase, s.en, s.canonical)) continue;
      out.push({ service: s, word: w });
    }
  }
  return out.sort((a, b) => a.word.phrase.localeCompare(b.word.phrase));
}

/**
 * "Map to ▾" options for a supplier's request, CLOSEST FIRST: the drafted
 * closest existing service, then the drafted near-matches, then the rest of
 * the services in the suggested category, then everything else. Flow B — the
 * reviewer meets the likeliest answer at the top, never a guessed selection.
 */
export function mapTargetsClosestFirst(
  request: SupplierRequest,
  services: readonly Service[],
): Array<{ canonical: string; label: string; closest: boolean }> {
  const seen = new Set<string>();
  const out: Array<{ canonical: string; label: string; closest: boolean }> = [];
  const byKey = new Map(services.map((s) => [s.canonical, s]));
  const push = (key: string, closest: boolean) => {
    if (seen.has(key)) return;
    const s = byKey.get(key);
    if (!s) return;
    seen.add(key);
    out.push({ canonical: key, label: s.en, closest });
  };
  const d = request.draft;
  if (d?.closestExisting) push(d.closestExisting.canonical, true);
  for (const m of d?.nearMatches ?? []) push(m.canonical, false);
  if (d?.suggestedTileId) {
    for (const s of services) if (s.tileId === d.suggestedTileId) push(s.canonical, false);
  }
  for (const s of [...services].sort((a, b) => a.en.localeCompare(b.en))) push(s.canonical, false);
  return out;
}

/**
 * The deadlines a category panel shows: every plan group whose couple-side
 * card lands on this category. Document deadlines (in days) belong to the
 * paperwork category, which is where the documents are booked.
 */
export function deadlinesForCategory(
  categoryId: string,
  planGroups: ReadonlyArray<{ id: string; label: string; catalogTile?: string | null }>,
  deadlines: readonly Deadline[],
  paperworkTileId: string | null,
): { plan: PlanDeadline[]; documents: Deadline[] } {
  const plan: PlanDeadline[] = [];
  for (const g of planGroups) {
    if (g.catalogTile !== categoryId) continue;
    const bookBy = deadlines.find((d) => d.kind === 'service' && d.scope === 'category' && d.refKey === g.id) ?? null;
    const lm = deadlines.find((d) => d.kind === 'last_minute_start' && d.scope === 'category' && d.refKey === g.id);
    plan.push({ planGroupId: g.id, label: g.label, bookBy, lastMinute: lm ? lm.offsetValue : null });
  }
  const documents =
    paperworkTileId && paperworkTileId === categoryId ? deadlines.filter((d) => d.kind === 'document') : [];
  return { plan, documents };
}

/** Title-Case a fresh religion key from its name — acronyms kept (INC, LDS). */
export function religionKeyFromName(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

/** snake_case event-type key from its name — the same rule the add action runs. */
export function eventTypeKeyFromName(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 31);
}

/** Where `id` lands in `order` for one Order ▾ choice. Pure — tested directly. */
export function reordered(order: readonly string[], id: string, how: string): string[] {
  const from = order.indexOf(id);
  if (from === -1) return [...order];
  const next = order.filter((x) => x !== id);
  const at =
    how === 'up' ? Math.max(0, from - 1) : how === 'down' ? Math.min(next.length, from + 1) : how === 'top' ? 0 : next.length;
  next.splice(at, 0, id);
  return next;
}


/**
 * "Close to what we have" for a name being added — found by MATCHING WORDS
 * with the shipped ranker (`rankTaxonomyOptions`), never a model. The whole
 * name first; then, when that finds fewer than `limit`, each of its words of
 * four letters or more, so "Dirty ice cream cart" still meets "Ice Cream
 * Cart" and "Sorbetes Cart". Options hit by more words rank first.
 */
export function nearMatches<T extends RankableOption>(name: string, options: readonly T[], limit = 3): T[] {
  const whole = rankTaxonomyOptions(options, name, limit);
  if (whole.length >= limit) return whole;
  const score = new Map<string, { opt: T; hits: number; firstAt: number }>();
  whole.forEach((o, i) => score.set(o.key, { opt: o, hits: 100, firstAt: i }));
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
  words.forEach((w, wi) => {
    for (const o of rankTaxonomyOptions(options, w, 20)) {
      const cur = score.get(o.key);
      if (cur) cur.hits += 1;
      else score.set(o.key, { opt: o, hits: 1, firstAt: 1000 + wi });
    }
  });
  return [...score.values()]
    .sort((a, b) => b.hits - a.hits || a.firstAt - b.firstAt || a.opt.label.localeCompare(b.opt.label))
    .slice(0, limit)
    .map((s) => s.opt);
}
