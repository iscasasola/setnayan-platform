/**
 * 🗃 THE PHRASE BANK — every way the owner is likely to ask the ⌘K box for something, each with the ONE place its first
 * row must open (ASK-BRAIN, owner 14 Nov 2026: *"a fully comprehensive database for the search bar to be able to
 * simulate all the possible text i will place and to produce the most accurate output"*).
 *
 * BUILT, NEVER TYPED. `buildPhraseBank()` derives every entry from three sources that already exist:
 *   1. the box's own destinations (`buildDestinations`) — "open <page>", "where is <page>", "hanapin <page>", the bare
 *      name — expected: that page;
 *   2. every form-driven job in the generated checklist — its own phrase, and the same with each synonym of its verb —
 *      expected: the page that job lives on;
 *   3. the keyword table (`ask-keywords.ts`) — every verb (English + Taglish) on a place's first noun, and the place's
 *      first verb on every one of its nouns — expected: that place's page;
 * plus a short list of misspellings and run-together words the owner actually types (`TYPOS`).
 *
 * `scripts/gen-ask-phrase-bank.ts` writes the result to `ask-phrase-bank.generated.ts`, a file a person can read;
 * `ask-phrase-bank.test.ts` rebuilds it and fails when the two differ, then runs EVERY phrase through the shipped box
 * (`rankPalette`) and holds the top-1 accuracy to a measured floor, printing each miss.
 *
 * "Same place" compares the page and its `tab` — never the anchor, the order of a query string or a redirect stub's
 * own address (`samePlace`).
 */

import type { AdminJob } from './scan-admin-jobs';
import type { AdminRoute } from './scan-admin-routes';
import { ASK_PLACES, ASK_VERBS, type AskDest, type AskIntent } from './ask-keywords';

export type BankEntry = {
  phrase: string;
  /** The place the box's FIRST row must open. */
  expect: string;
  /** Which source produced it — so a miss can be traced back. */
  from: 'page' | 'job' | 'keyword' | 'typo';
};

/** Misspellings and joins the owner types, each with the keyword-table place it means. */
export const TYPOS: ReadonlyArray<[string, string]> = [
  ['change pricelist', 'price'],
  ['update the pricelist', 'price'],
  ['open price list', 'price'],
  ['add a service to the catalouge', 'service'],
  ['add category to catelog', 'catalogue'],
  ['open the catalog', 'catalogue'],
  ['make a promocode', 'promo'],
  ['create a vocher', 'promo'],
  ['find a supplyer', 'supplier'],
  ['check payement proof', 'payment'],
  ['palitan presyo', 'price'],
  ['gawa ng promo', 'promo'],
  ['dagdag service', 'service'],
  ['hanapin bayad', 'payment'],
  ['nasaan ang mga supplier', 'supplier'],
  ['tingnan events', 'event'],
];

/** The page path + its `tab`, which together say WHICH screen. */
function placeKey(href: string): string {
  const [pathAndQuery] = href.split('#');
  const [path, query] = (pathAndQuery ?? '').split('?');
  const tab = new URLSearchParams(query ?? '').get('tab');
  return tab ? `${path}?tab=${tab}` : (path ?? '');
}

/** Two addresses open the same screen — the same path and tab, a redirect stub followed first. */
export function samePlace(a: string, b: string, routes: readonly AdminRoute[]): boolean {
  const follow = (href: string) => {
    const path = href.split(/[?#]/)[0] ?? href;
    const stub = routes.find((r) => r.kind === 'redirect' && r.path === path && r.redirectsTo);
    return placeKey(stub && !href.includes('?') ? stub.redirectsTo! : href);
  };
  return follow(a) === follow(b);
}

const CREATE_VERBS = Object.entries(ASK_VERBS).filter(([, i]) => i === 'create').map(([v]) => v);

/** The words of a job's own phrase after its verb ("create discount code" → "discount code"). */
function jobObject(job: AdminJob): { verb: string; object: string } | null {
  const [verb, ...rest] = job.phrase.split(' ');
  if (!verb || rest.length === 0) return null;
  return { verb, object: rest.join(' ') };
}

/** Article for "a new <noun>" phrasing. */
function withArticle(intent: AskIntent, noun: string): string {
  return intent === 'create' ? `a new ${noun}` : `the ${noun}`;
}

export function buildPhraseBank<D extends AskDest>(
  dests: readonly D[],
  jobs: readonly AdminJob[],
  routes: readonly AdminRoute[],
): BankEntry[] {
  const out: BankEntry[] = [];
  const seen = new Set<string>();
  const add = (phrase: string, expect: string, from: BankEntry['from']) => {
    const p = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
    if (p.length < 2 || seen.has(p)) return;
    seen.add(p);
    out.push({ phrase: p, expect, from });
  };

  // 1 · Pages — every menu page, by its own name. (Scanned pages and rows are reached through their menu page.)
  const pages = dests.filter((d) => d.source === 'menu');
  for (const d of pages) {
    const name = d.label.toLowerCase();
    add(name, d.href, 'page');
    add(`open ${name}`, d.href, 'page');
    add(`where is ${name}`, d.href, 'page');
    add(`hanapin ${name}`, d.href, 'page');
  }

  // 2 · Jobs — every form-driven job, by its own phrase and with each synonym of a create verb.
  for (const job of jobs.filter((j) => j.fields.length > 0)) {
    const host = dests.find((d) => d.source !== 'row' && samePlace(d.href, job.resolvedPath, routes));
    if (!host) continue; // a job with no page the box offers cannot be expected anywhere
    add(job.phrase, host.href, 'job');
    const parts = jobObject(job);
    if (parts && ASK_VERBS[parts.verb] === 'create') {
      for (const v of CREATE_VERBS) add(`${v} ${parts.object}`, host.href, 'job');
    }
  }

  // 3 · The keyword table — every verb on the first noun, the first verb on every noun.
  for (const place of ASK_PLACES) {
    const intents = Object.keys(place.say) as AskIntent[];
    for (const intent of intents) {
      const verbs = Object.entries(ASK_VERBS).filter(([, i]) => i === intent).map(([v]) => v);
      const first = place.nouns[0]!;
      for (const v of verbs) add(`${v} ${withArticle(intent, first)}`, place.href, 'keyword');
      for (const n of place.nouns) add(`${verbs[0]} ${withArticle(intent, n)}`, place.href, 'keyword');
    }
  }

  // 4 · Misspellings and joins.
  for (const [phrase, key] of TYPOS) {
    const place = ASK_PLACES.find((p) => p.key === key);
    if (place) add(phrase, place.href, 'typo');
  }

  return out;
}

/** Read the generated bank's text block back into entries (one line per phrase, tab-separated). */
export function parsePhraseBank(text: string): BankEntry[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [phrase, expect, from] = line.split('\t');
      return { phrase: phrase ?? '', expect: expect ?? '', from: (from ?? 'page') as BankEntry['from'] };
    });
}
