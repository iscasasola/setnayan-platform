/**
 * 🗝 ASK-KW / ASK-BRAIN — THE OWNER'S PLAIN WORDS → ONE RECOMMENDED ACTION (owner, 14 Nov 2026).
 *
 * Owner, verbatim: *"make sure we can properly message that search box to be capable of navigating. What if i said
 * add a new service in the catalog. or create a new promo. or change a pricelist"* · *"find keywords to my statement to
 * give me a recommended action. or access a specific part of the admin."*
 *
 * Measured on `origin/main` before this file (the palette's own ranker + `matchJobs`):
 *   "add a new service in the catalog" → Pricing first, no job        · "create a new promo" → Categories first
 *   "change a pricelist" → "pricelist" UNKNOWN, Pax changes first       · "change a price list" → Pricing, no job
 * The ranker matches WORDS; it cannot tell that "add … service" is a verb on a noun. This table can.
 *
 * ONE TABLE, read by the ⌘K box (`palette-rank.ts` → `admin-command-palette.tsx`), by the phrase bank
 * (`scripts/gen-ask-phrase-bank.ts`) and by their guards:
 *   · `ASK_VERBS`  — a verb (English or Taglish) → an intent;
 *   · `ASK_PLACES` — a noun → the admin page it lives on and, per intent, the job that does it.
 * When a sentence carries an intent AND a noun, the box's FIRST row is one "Recommended" action, then that page, then
 * the rest. ⛔ IT ONLY NAVIGATES OR PREPARES A FORM — it never saves, publishes, changes a price, removes, approves or
 * confirms anything; "remove" and "decide" only OPEN the page where the owner presses the real button (one-person admin
 * plan 2026-07-11; `ask-the-admin.ts` ⛔ block).
 *
 * Every `job` here must exist in the generated checklist and every `href` must be a page the box already offers —
 * the guard fails otherwise, so this table can never send the owner to a door that is not there.
 *
 * Pure: no I/O, no React, no model. The AI path is untouched (switched off 13 Nov; "no chat AI", 28 Oct).
 */

import type { AdminJob } from './scan-admin-jobs';

export type AskIntent = 'create' | 'edit' | 'open' | 'remove' | 'decide';

/** A verb → what the person wants to do. Lowercase, one word each. */
export const ASK_VERBS: Readonly<Record<string, AskIntent>> = {
  // create
  add: 'create', create: 'create', new: 'create', make: 'create', start: 'create', invite: 'create', setup: 'create',
  // Taglish (owner, 14 Nov: "gawa ng promo", "dagdag service")
  gawa: 'create', gumawa: 'create', magdagdag: 'create', dagdag: 'create', idagdag: 'create',
  // edit
  change: 'edit', edit: 'edit', update: 'edit', set: 'edit', adjust: 'edit', raise: 'edit', lower: 'edit',
  rename: 'edit', fix: 'edit', modify: 'edit',
  palitan: 'edit', baguhin: 'edit', ayusin: 'edit', itaas: 'edit', ibaba: 'edit',
  // open
  find: 'open', show: 'open', open: 'open', go: 'open', see: 'open', view: 'open', check: 'open', where: 'open',
  hanapin: 'open', nasaan: 'open', buksan: 'open', tingnan: 'open', ipakita: 'open',
  // remove — the box only OPENS the page; it never removes anything
  remove: 'remove', delete: 'remove', disable: 'remove', deactivate: 'remove', hide: 'remove', off: 'remove',
  tanggalin: 'remove', burahin: 'remove', patayin: 'remove', alisin: 'remove',
  // decide — the box only OPENS the queue; the owner decides on the real page
  approve: 'decide', confirm: 'decide', decline: 'decide', reject: 'decide',
  aprubahan: 'decide', kumpirmahin: 'decide',
};

export type AskPlace = {
  key: string;
  /** The nouns that name this place (English, Taglish, the usual misspellings). One place per noun (the guard checks). */
  nouns: readonly string[];
  /** The page (an `href` the box already offers). */
  href: string;
  /** What the recommendation says, per intent ("Add a service"). Missing → "Open <page>". */
  say: Partial<Record<AskIntent, string>>;
  /** The checklist job that does it, per intent — the box opens its form (or its page), never runs it. */
  job?: Partial<Record<AskIntent, string>>;
  /**
   * Edit lands on ONE ROW of the page when the rest of the sentence names it ("change the price of live watch" →
   * Pricing at Live Watch). The row is one of the box's own row destinations under this path.
   */
  rowsUnder?: string;
  /**
   * A screen that is a TAB of a page rather than one of the box's own destinations (Pricing › Free windows). The
   * recommendation draws it with this name; the guard checks the address is a view in `lib/admin/admin-tabs.ts`.
   */
  view?: { label: string; group: string };
};

/**
 * The place whose noun comes FIRST after the verb wins ("add a new service in the catalog" → the service; "add a new
 * category on the taxonomy service" → the category). Table order breaks a tie.
 */
export const ASK_PLACES: readonly AskPlace[] = [
  {
    key: 'service',
    nouns: ['service', 'services', 'serbisyo', 'leaf', 'leaves'],
    href: '/admin/categories',
    say: { create: 'Add a service', edit: 'Change a service', open: 'Open the catalogue', remove: 'Open the catalogue' },
    job: { create: 'createCanonicalLeaf' },
  },
  {
    key: 'event-type',
    nouns: ['event-type', 'occasion', 'occasions'],
    href: '/admin/categories',
    say: { create: 'Add an event type', edit: 'Change an event type', open: 'Open event types' },
    job: { create: 'createEventTypeRoster' },
  },
  {
    key: 'faith',
    nouns: ['faith', 'faiths', 'religion', 'religions'],
    href: '/admin/categories',
    say: { create: 'Add a faith', edit: 'Change a faith', open: 'Open faiths' },
    job: { create: 'createFaithVocab' },
  },
  {
    key: 'catalogue',
    nouns: ['catalog', 'catalogue', 'category', 'categories', 'kategorya', 'taxonomy', 'folder', 'folders', 'tile', 'tiles'],
    href: '/admin/categories',
    say: { create: 'Add a category', edit: 'Change a category', open: 'Open the catalogue', remove: 'Open the catalogue' },
    job: { create: 'createTaxonomyNode' },
  },
  {
    key: 'free-window',
    nouns: ['free-window'],
    href: '/admin/pricing?tab=free-windows',
    view: { label: 'Free windows', group: 'Money' },
    say: { create: 'Create a free window', edit: 'Change a free window', open: 'Open free windows' },
    job: { create: 'createFreeWindow' },
  },
  {
    key: 'launch-offer',
    nouns: ['launch-offer'],
    href: '/admin/launch-offer',
    say: { create: 'Set the launch offer', edit: 'Change the launch offer', open: 'Open the launch offer' },
  },
  {
    key: 'promo',
    nouns: ['promo', 'promos', 'promotion', 'promotions', 'discount', 'discounts', 'voucher', 'vouchers', 'coupon', 'coupons', 'code', 'codes', 'sale', 'sales'],
    href: '/admin/studio?tab=discount-codes',
    say: { create: 'Create a promo code', edit: 'Change a promo code', open: 'Open discount codes', remove: 'Open discount codes' },
    job: { create: 'createDiscountCode' },
  },
  {
    key: 'price',
    nouns: ['price', 'prices', 'pricing', 'presyo', 'rate', 'rates', 'sku', 'skus'],
    href: '/admin/pricing?tab=pricing',
    say: { create: 'Add a price', edit: 'Change a price', open: 'Open pricing' },
    rowsUnder: '/admin/pricing',
  },
  {
    key: 'payment',
    nouns: ['payment', 'payments', 'slip', 'slips', 'proof', 'proofs', 'bayad', 'screenshot'],
    href: '/admin/payments',
    say: { open: 'Open payments to confirm', decide: 'Confirm a payment', edit: 'Open payments' },
  },
  {
    key: 'fee',
    nouns: ['fee', 'fees'],
    href: '/admin/booking-fees',
    say: { open: 'Open booking fees owed', decide: 'Open booking fees owed', edit: 'Open booking fees owed' },
  },
  {
    key: 'venue',
    nouns: ['venue', 'venues'],
    href: '/admin/accounts?tab=venues',
    say: { create: 'Add a venue', edit: 'Change a venue', open: 'Open venues' },
    job: { create: 'createVenue' },
  },
  {
    key: 'supplier',
    nouns: ['supplier', 'suppliers', 'vendor', 'vendors', 'shop', 'shops'],
    href: '/admin/accounts?tab=vendors',
    say: { create: 'Invite a supplier', edit: 'Open suppliers', open: 'Open suppliers', remove: 'Open suppliers' },
    job: { create: 'createAdminVendorInvite' },
  },
  {
    key: 'person',
    nouns: ['couple', 'couples', 'client', 'clients', 'user', 'users', 'person', 'people', 'account', 'accounts', 'customer', 'customers'],
    href: '/admin/accounts?tab=users',
    say: { open: 'Open people', edit: 'Open people', remove: 'Open people', decide: 'Open people' },
  },
  {
    key: 'event',
    nouns: ['event', 'events', 'wedding', 'weddings', 'debut', 'debuts', 'birthday', 'birthdays', 'christening'],
    href: '/admin/accounts?tab=events',
    say: { open: 'Open events', edit: 'Open events', remove: 'Open events' },
  },
  {
    key: 'announcement',
    nouns: ['announcement', 'announcements', 'post', 'posts'],
    href: '/admin/studio?tab=social-queue',
    say: { create: 'Write an announcement', edit: 'Change an announcement', open: 'Open the social queue' },
    job: { create: 'createAnnouncement' },
  },
  {
    key: 'partnership',
    nouns: ['partnership', 'partnerships', 'partner', 'partners'],
    href: '/admin/vendor-partnerships',
    say: { create: 'Add a partnership', edit: 'Change a partnership', open: 'Open partnerships' },
    job: { create: 'createPartnershipHq' },
  },
  {
    key: 'recommendation',
    nouns: ['recommendation', 'recommendations'],
    href: '/admin/vendor-recommendations',
    say: { create: 'Add a recommendation', edit: 'Change a recommendation', open: 'Open recommendations' },
    job: { create: 'addRecommendation' },
  },
];

/**
 * The sentences the box is advertised to understand — the "What can I ask?" source (shown in the box while it is
 * empty). Each one is pinned to its first row by `ask-keywords.test.ts`, so the box never advertises a sentence it does
 * not honour.
 */
export const ASK_EXAMPLES: readonly string[] = [
  'add a new service in the catalog',
  'create a new promo',
  'change a pricelist',
  'change the price of live watch',
];

/** Misspellings and run-together words → the word the table knows. "pricelist" was an UNKNOWN word (14 Nov). */
const SPELLINGS: ReadonlyArray<[RegExp, string]> = [
  [/\bprice[\s-]?lists?\b/gi, 'price list'],
  [/\bcatal(?:ouge|ouge|og?ue|ogeu|gue|og)\b/gi, 'catalogue'],
  [/\bcatelog(?:ue)?\b/gi, 'catalogue'],
  [/\bpromo[\s-]?codes?\b/gi, 'promo code'],
  [/\bdiscount[\s-]?codes?\b/gi, 'discount code'],
  [/\bvo?ucher\b/gi, 'voucher'],
  [/\bvocher\b/gi, 'voucher'],
  [/\bsupplyer\b/gi, 'supplier'],
  [/\bpayement\b/gi, 'payment'],
  [/\bevent[\s-]types?\b/gi, 'event-type'],
  [/\bfree[\s-]windows?\b/gi, 'free-window'],
  [/\blaunch[\s-]offers?\b/gi, 'launch-offer'],
  [/\bset\s+up\b/gi, 'setup'],
  [/\bturn(?:ed)?\s+off\b/gi, 'off'],
  [/\bswitch\s+off\b/gi, 'off'],
];

/**
 * The query the whole box reads: the misspellings and joins above, mended. Applied before the ranker too, so a
 * mended word is never reported as "a word no page has".
 */
export function normaliseAskQuery(query: string): string {
  let out = query;
  for (const [re, to] of SPELLINGS) out = out.replace(re, to);
  return out;
}

/** The words the table reads: lowercase, apostrophes dropped, hyphenated compounds kept whole. */
function words(query: string): string[] {
  return normaliseAskQuery(query)
    .toLowerCase()
    .replace(/['’]/g, '')
    .split(/[^a-z0-9-]+/)
    .filter(Boolean);
}

/** The words that say WHAT — the sentence minus its verbs and filler ("add a new service in the catalog" → service catalogue). */
export function contentWords(query: string): string[] {
  return words(query).filter((w) => !ASK_VERBS[w] && !FILLER.has(w));
}

/** Filler that never names a row ("the price OF live watch"). English + Taglish particles. */
const FILLER = new Set([
  'a', 'an', 'the', 'of', 'for', 'on', 'in', 'to', 'my', 'our', 'new', 'please', 'i', 'want', 'need', 'list', 'its',
  'it', 'is', 'from', 'with', 'by', 'and', 'ng', 'sa', 'ang', 'mga', 'na', 'yung', 'ung', 'ko', 'po',
]);

export type AskDest = { label: string; href: string; group: string; hay: string; source: string };

export type AskRecommendation<D extends AskDest> = {
  intent: AskIntent | null;
  /** The keyword-table place it came from — `null` when it came from a job's own words. */
  place: AskPlace | null;
  /** "Add a service" / "Change the price of Live Watch". */
  say: string;
  /** The page this lives on — drawn second, straight after the recommendation. */
  page: D;
  /** One row of that page, when the sentence named it. */
  row: D | null;
  /** The job whose form is opened (never run). */
  job: AdminJob | null;
  /** Where the recommendation goes when it is not a form to prepare. */
  href: string;
};

/** The intent a sentence carries: the first verb found. */
export function intentOf(query: string): AskIntent | null {
  for (const w of words(query)) {
    const i = ASK_VERBS[w];
    if (i) return i;
  }
  return null;
}

/** The place a sentence names: the one whose noun comes first; table order breaks a tie. */
export function placeOf(query: string): AskPlace | null {
  const ws = words(query);
  let best: { place: AskPlace; at: number; order: number } | null = null;
  ASK_PLACES.forEach((place, order) => {
    const at = ws.findIndex((w) => place.nouns.includes(w));
    if (at === -1) return;
    if (!best || at < best.at || (at === best.at && order < best.order)) best = { place, at, order };
  });
  return best ? (best as { place: AskPlace }).place : null;
}

/**
 * THE RECOMMENDATION — or null when the sentence lacks an intent or a noun, or names a page the box does not offer.
 * `dests` is the box's own destination list (pages + rows); `jobs` the generated checklist.
 */
export function recommendAction<D extends AskDest>(
  query: string,
  dests: readonly D[],
  jobs: readonly AdminJob[],
): AskRecommendation<D> | null {
  const intent = intentOf(query);
  const place = placeOf(query);
  if (!intent || !place) return null;
  const tablePage =
    dests.find((d) => d.href === place.href && d.source !== 'row') ??
    (place.view
      ? ({ label: place.view.label, href: place.href, group: place.view.group, hay: '', source: 'menu' } as unknown as D)
      : null);
  if (!tablePage) return null;
  // A page NAMED outright beats the table's page for its noun: "open price bands" means Price bands, not Pricing.
  const named = namedPage(query, dests);
  const page = named && named.href !== tablePage.href ? named : tablePage;

  // A named row: the words left once the verbs, the place's nouns and the filler are gone, all found in ONE row.
  let row: D | null = null;
  if (place.rowsUnder && intent !== 'create' && page === tablePage) {
    const rest = words(query).filter((w) => !ASK_VERBS[w] && !place.nouns.includes(w) && !FILLER.has(w));
    if (rest.length > 0) {
      const named = dests.filter(
        (d) =>
          d.source === 'row' &&
          d.href.startsWith(place.rowsUnder!) &&
          rest.every((w) => `${d.label} ${d.hay}`.toLowerCase().split(/[^a-z0-9]+/).includes(w)),
      );
      // Exactly one, or none: two rows that both match are a question, not an answer.
      if (named.length === 1) row = named[0]!;
    }
  }

  const jobName = page === tablePage ? place.job?.[intent] : undefined;
  const job = jobName ? (jobs.find((j) => j.name === jobName) ?? null) : null;
  const base = page === tablePage ? (place.say[intent] ?? `Open ${page.label}`) : `Open ${page.label}`;
  const say = row && place.key === 'price' ? `Change the price of ${row.label}` : row ? `Open ${row.label}` : base;

  return { intent, place, say, page, row, job, href: row ? row.href : page.href };
}

/**
 * The page whose whole name the sentence spells out ("open price bands" → Price bands). Only names of two or more
 * words count — a one-word name ("Payments") is a noun the table already reads. The longest name wins.
 */
export function namedPage<D extends AskDest>(query: string, dests: readonly D[]): D | null {
  const said = ` ${words(query).join(' ')} `;
  let best: D | null = null;
  for (const d of dests) {
    if (d.source === 'row') continue;
    const name = d.label.toLowerCase().replace(/[^a-z0-9 -]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (name.split(' ').length < 2) continue;
    if (said.includes(` ${name} `) && (!best || name.length > best.label.length)) best = d;
  }
  return best;
}

/** True when the keyword table understands this word — so the box never calls it "a word no page has". */
export function tableKnowsWord(word: string): boolean {
  const w = normaliseAskQuery(word).toLowerCase().replace(/['\u2019]/g, '');
  return Boolean(ASK_VERBS[w]) || FILLER.has(w) || ASK_PLACES.some((p) => p.nouns.includes(w));
}

/** "Add a service → Catalogue › Categories & event types" — the recommendation's whole line. */
export function recommendationLine<D extends AskDest>(rec: AskRecommendation<D>): string {
  return `${rec.say} → ${rec.page.group} › ${rec.page.label}`;
}
