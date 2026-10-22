/**
 * help-tips-and-tours-name-what-ships.test.ts — Help, every ⓘ and every tour say only what ships.
 *
 * ── WHY (owner, 2026-10-22: "have you updated our Help, all (i) and spotlight tutorials?") ──────────────
 * They had not been, for a week of features. A tour still told every supplier "The bar is Today, Customers,
 * Shop and More. Messages, Insights and the Event Hub live in More" — a day after More left the supplier
 * bar. The Event Hub stage's ⓘ still explained "That strip across the top is yours alone" a week after the
 * strip was removed. The People tour described a dropdown the page lost that morning. Nothing failed: words
 * are not code, so no build notices when the thing they name goes away.
 *
 * ── WHAT THIS HOLDS — a PROPERTY: no help, tour or ⓘ string names a thing that is gone ─────────────────
 * Each removed thing is listed with the PROOF that it is removed (a file that no longer exists, or the bar's
 * own labels). The proof is checked first, so this guard cannot keep forbidding a word for a thing that has
 * come back — it fails and says so, and the entry is taken out. The things:
 *   1. the cookie banner and analytics cookies (essential cookies only, 2026-10-22 — PostHog removed);
 *   2. Event Hub Plus (retired — Event Hub Pro is the one paid Event Hub);
 *   3. the token wallet (retired 2026-05-11 — apply-then-pay, PHP-direct);
 *   4. "celebration" (the house word is "event");
 *   5. More as a PLACE on a bar that has no More — the supplier bar (Today · Customers · Shop · Hub, since
 *      2026-10-21), the account bar (Events · Discover · Memories · People), and the iPhone app's event bar
 *      (Home · Guests · Suppliers · Hub, #6725). The bar's labels are READ from its own source, so when the web
 *      event bar loses More too (#6791) this is extended by adding one audience, not by rewording a list.
 *
 * WHERE IT LOOKS: every public help string (`HELP_TOPICS`, the app's own `appBody`), every tour string
 * (`TOURS` — labels, slides, spotlight stops, finales, the switched-off carousels too, since they are the
 * spotlight's script), and every `<InfoTip>` in the tree — its inline words, and, for the removed-thing
 * words 1–4, the whole comment-stripped source of the file that draws it (an ⓘ often reads a constant).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HELP_ROLES, HELP_TOPICS, helpTopicsFor } from './help';
import { TOURS, TOUR_KEYS, type TourKey } from './tours';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

type Text = { where: string; text: string };

/** Slide bodies are HTML — read them as a person does. */
function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&rsquo;|&#8217;/g, '’')
    .replace(/&times;/g, '×')
    .replace(/&equiv;/g, '≡')
    .replace(/&#9670;/g, '◆')
    .replace(/&amp;/g, '&');
}

/* ══ the strings ════════════════════════════════════════════════════════════════════════════════════════ */

type Audience = 'supplier' | 'account' | 'app' | 'other';

function helpTexts(): Array<Text & { audience: Audience }> {
  const out: Array<Text & { audience: Audience }> = [];
  for (const r of HELP_ROLES) out.push({ where: `help role ${r.key}`, text: `${r.label} ${r.blurb}`, audience: 'other' });
  for (const t of HELP_TOPICS) {
    out.push({ where: `help topic ${t.key}`, text: t.label, audience: 'other' });
    const supplierTopic = t.roles.length === 1 && t.roles[0] === 'vendor';
    for (const a of t.articles) {
      const audience: Audience = supplierTopic || /^Suppliers?:/.test(a.title) ? 'supplier' : t.key === 'people-memories' ? 'account' : 'other';
      out.push({ where: `/help/${a.slug}`, text: `${a.title}\n${a.body}`, audience });
    }
  }
  // What the iPhone app's /help shows — its event bar and its account bar have no More.
  for (const t of helpTopicsFor(HELP_TOPICS, true)) {
    for (const a of t.articles) out.push({ where: `/help/${a.slug} (app)`, text: `${a.title}\n${a.body}`, audience: 'app' });
  }
  return out;
}

const SUPPLIER_TOUR = (k: TourKey) => /^(?:vendor|supplier)_/.test(k);
const ACCOUNT_TOUR = (k: TourKey) => /^(?:customer_account_bar|customer_people|discover)_/.test(k);

function tourTexts(): Array<Text & { audience: Audience }> {
  const out: Array<Text & { audience: Audience }> = [];
  for (const k of TOUR_KEYS) {
    const t = TOURS[k];
    const audience: Audience = SUPPLIER_TOUR(k) ? 'supplier' : ACCOUNT_TOUR(k) ? 'account' : 'other';
    out.push({ where: `tour ${k} (label/blurb)`, text: `${t.label}\n${t.blurb}`, audience });
    t.slides.forEach((s, i) => {
      out.push({ where: `tour ${k} slide ${i + 1}`, text: `${s.title}\n${plain(s.body)}`, audience });
    });
    const sp = t.spotlight;
    if (!sp) continue;
    sp.steps.forEach((s, i) => {
      const hint = (s as { hint?: string }).hint ?? '';
      out.push({ where: `tour ${k} stop ${i + 1} (${s.anchor})`, text: `${s.title}\n${s.body}\n${hint}`, audience });
    });
    out.push({ where: `tour ${k} finale`, text: `${sp.finale.title}\n${sp.finale.body}\n${sp.finale.button}`, audience });
  }
  return out;
}

function sources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, acc);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}

const INFO_TIP_HOSTS = ['app', 'components', 'lib']
  .filter((d) => existsSync(join(WEB, d)))
  .flatMap((d) => sources(join(WEB, d)))
  .map((f) => ({ rel: relative(WEB, f), code: stripComments(readFileSync(f, 'utf8')) }))
  .filter(({ rel, code }) => rel !== 'app/_components/info-tip.tsx' && /<InfoTip\b/.test(code));

/** Each ⓘ's own words — what sits between `<InfoTip …>` and `</InfoTip>`. */
function infoTipTexts(): Array<Text & { audience: Audience }> {
  const out: Array<Text & { audience: Audience }> = [];
  for (const { rel, code } of INFO_TIP_HOSTS) {
    const audience: Audience = rel.startsWith('app/vendor-dashboard/') ? 'supplier' : rel.startsWith('app/dashboard/(account)/') || rel.startsWith('app/dashboard/(launcher)/') ? 'account' : 'other';
    for (const m of code.matchAll(/<InfoTip\b[^>]*?(?:\/>|>([\s\S]*?)<\/InfoTip>)/g)) {
      const line = code.slice(0, m.index).split('\n').length;
      out.push({ where: `ⓘ ${rel}:~${line}`, text: (m[1] ?? '').replace(/\s+/g, ' '), audience });
    }
  }
  return out;
}

/* ══ the removed things, each with its proof ═════════════════════════════════════════════════════════════ */

type Gone = { name: string; re: RegExp; proof: () => string | null };

/** Labels a bar's own source gives its tabs (`label: 'Today'`), read from the file the bar is drawn from. */
function barLabels(rel: string, from: RegExp): string[] {
  const src = read(rel);
  const start = src.search(from);
  assert.ok(start >= 0, `${rel}: the bar's list moved — re-point this guard`);
  const end = src.indexOf('];', start);
  const block = src.slice(start, end > start ? end : start + 4000);
  return [...block.matchAll(/label:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]!);
}

const SUPPLIER_BAR = () => barLabels('app/vendor-dashboard/_components/vendor-nav-destinations.ts', /export const VENDOR_DESTINATIONS/);
const ACCOUNT_BAR = () => barLabels('app/dashboard/(launcher)/_components/account-bottom-nav.tsx', /const TAB: Record<AccountBarTab/);

const GONE: Gone[] = [
  {
    name: 'the cookie banner / analytics cookies',
    re: /\bcookie (?:banner|consent|settings|preferences)\b|\b(?:accept|allow|manage|decline) (?:all |optional )?cookies\b|\banalytics cookies\b|\bPostHog\b/i,
    proof: () =>
      ['app/_components/cookie-consent-banner.tsx', 'app/_components/posthog-provider.tsx', 'lib/cookie-consent.ts'].find((f) => existsSync(join(WEB, f))) ??
      null,
  },
  {
    name: 'Event Hub Plus (retired)',
    re: /\b(?:Event )?Hub Plus\b|\bHub\+/,
    proof: () => (/\bEVENT_HUB_PLUS\b/.test(read('lib/sku-catalog.ts')) ? 'lib/sku-catalog.ts still defines EVENT_HUB_PLUS' : null),
  },
  {
    name: 'the token wallet (retired 2026-05-11)',
    re: /\btoken wallet\b|\bwallet (?:tokens?|balance)\b|\b(?:buy|spend|top[- ]?up|earn) (?:\w+ ){0,2}tokens\b|\bSetnayan tokens?\b/i,
    proof: () => null,
  },
  { name: '"celebration" (say "event")', re: /\bcelebrations?\b/i, proof: () => null },
];

/** More named as a PLACE — "in More", "tap More", "the More tab", "Shop and More", "More ›". */
const MORE_AS_A_PLACE = /\b(?:in|tap|open|opens|under|from|and|or) More\b(?! than)|\bMore (?:tab|menu|button)\b|,\s*More\b(?! than)|\bMore\s*[›>]/;

test('the scan is looking at something', () => {
  const h = helpTexts().length;
  const t = tourTexts().length;
  const i = infoTipTexts().length;
  console.log(`[help-sync] ${h} help strings · ${t} tour strings · ${i} ⓘ in ${INFO_TIP_HOSTS.length} files`);
  assert.ok(h > 100, `only ${h} help strings — did HELP_TOPICS move?`);
  assert.ok(t > 100, `only ${t} tour strings — did TOURS move?`);
  assert.ok(i > 40, `only ${i} ⓘ found — did <InfoTip> get renamed?`);
});

test('🔑 every removed thing is still removed (the proof behind each forbidden word)', () => {
  const back = GONE.map((g) => [g.name, g.proof()] as const).filter(([, p]) => p !== null);
  assert.deepEqual(back, [], 'A thing this guard calls removed is back — take its entry out of GONE (and its words are fine again):');
});

test('no Help, tour or ⓘ string names a removed thing', () => {
  const offenders: string[] = [];
  const all = [...helpTexts(), ...tourTexts(), ...infoTipTexts()];
  for (const { where, text } of all) {
    for (const g of GONE) {
      const m = g.re.exec(text);
      if (m) offenders.push(`${where}: ${g.name} — "…${text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\s+/g, ' ')}…"`);
    }
  }
  // An ⓘ often reads a constant from its own file — so the removed-thing words are not in the file at all.
  for (const { rel, code } of INFO_TIP_HOSTS) {
    for (const g of GONE) {
      const m = g.re.exec(code);
      if (m) offenders.push(`${rel} (draws an ⓘ): ${g.name} — "${m[0]}"`);
    }
  }
  assert.deepEqual(offenders, [], 'Help, a tour or an ⓘ names something that is gone:\n  ' + offenders.join('\n  '));
});

test('no Help, tour or ⓘ string sends anyone to a More the bar does not have', () => {
  const supplierBar = SUPPLIER_BAR();
  const accountBar = ACCOUNT_BAR();
  assert.deepEqual(supplierBar, ['Today', 'Customers', 'Shop', 'Hub'], 'premise: the supplier bar is Today · Customers · Shop · Hub (2026-10-21)');
  assert.ok(accountBar.includes('People') && accountBar.includes('Memories'), `premise: the account bar is the 2026-10-21 one (read ${accountBar.join(' · ')})`);
  const noMore: Record<Audience, boolean> = {
    supplier: !supplierBar.includes('More'),
    account: !accountBar.includes('More'),
    // The iPhone app's event bar is Home · Guests · Suppliers · Hub (#6725) and its account bar is the one above.
    app: true,
    other: false,
  };
  const offenders: string[] = [];
  for (const { where, text, audience } of [...helpTexts(), ...tourTexts(), ...infoTipTexts()]) {
    if (!noMore[audience]) continue;
    // A slide that sells is dropped in the app (`TourSlide.sells`) — it is a web reader's, not the app's.
    const m = MORE_AS_A_PLACE.exec(text);
    if (m) offenders.push(`${where} [${audience}]: "…${text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 30).replace(/\s+/g, ' ')}…"`);
  }
  assert.deepEqual(offenders, [], 'A string points at More on a bar with no More:\n  ' + offenders.join('\n  '));
});

test('the account screens’ tours are spotlights, and their optional stop is never the last', () => {
  // Owner 2026-10-10: our tour is a SPOTLIGHT. A stop the screen may not draw (Loved ones is gated) is skipped
  // only when a LATER stop is on screen (`spotlight-tour.tsx`), so it may never be the last one.
  for (const k of ['customer_account_bar_v1', 'customer_people_v2'] as const) {
    const sp = TOURS[k].spotlight;
    assert.ok(sp && sp.steps.length >= 2, `${k} has no spotlight`);
    assert.equal(TOURS[k].slides.length, 0, `${k} carries carousel slides — the carousel is off`);
  }
  const people = TOURS.customer_people_v2.spotlight!.steps.map((s) => s.anchor);
  assert.notEqual(people.at(-1), 'people-loved-ones', 'Loved ones is People’s last stop — on an account without it the tour would stall');
  assert.equal(people.at(-1), 'people-find', 'People’s last stop is the thumb row’s field, which every view draws');
});
