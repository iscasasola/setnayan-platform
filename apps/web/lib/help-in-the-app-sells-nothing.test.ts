/**
 * help-in-the-app-sells-nothing.test.ts — inside the iPhone app, the help
 * answers never point a reader at the web to buy, and never name Android.
 *
 * ── WHAT SHIPPED (Apple check 2026-10-19, rows #6 · #14) ────────────────────
 * Read INSIDE the App Store build, /help said: "one unlock … (current rate on
 * setnayan.com/pricing)", "a one-time purchase that unlocks the full planner",
 * "Everything you buy goes into one pot", and "Open setnayan.com in Safari on
 * iPhone or Chrome on Android … nothing to download". Guideline 3.1.1 forbids
 * steering an app user to buy outside the app; 2.3.10 forbids naming another
 * mobile platform. The web keeps every word; the app gets `appBody`.
 *
 * ── WHAT THIS GUARDS — PROPERTIES, NOT THE OLD SENTENCES ────────────────────
 *   1. Every answer the app can show — `helpBodyFor(article, true)` for every
 *      article, plus every title the app still lists — says none of: a pricing
 *      pointer, purchase / buy / unlock / top-up / upgrade / subscription /
 *      one-time / price / rate wording, ₱, Android / Google Play, the desktop
 *      download, or the supplier price-ladder page. Found by walking the whole
 *      corpus, so a new selling answer without app wording fails here.
 *   2. The app's /help index, /about FAQ and site search drop a question whose
 *      whole answer is a part the app does not include.
 *   3. Every surface that prints a help answer reads it through the store-shell
 *      choice — found by enumerating the importers of lib/help, not by name.
 *   4. The prerendered /help/<slug> page ships both words under
 *      data-web-only / data-app-only, so exactly one shows.
 *   5. The in-app mobile answer names no platform and no download.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALL_HELP_ARTICLES,
  HELP_NOT_IN_THE_APP,
  HELP_TOPICS,
  findHelpArticle,
  helpBodyFor,
  helpTopicsFor,
} from './help';
import { mobileAppAnswerInApp } from './where-setnayan-runs';
import { searchInCodeReads } from './site-search-core';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

/** What an App Store build may not say in a help answer. */
const SELLS: ReadonlyArray<[string, RegExp]> = [
  ['a pricing pointer', /setnayan\.com\/pricing|\bpricing\b/i],
  ['purchase', /\bpurchas/i],
  ['buy / bought', /\b(?:buy|buys|buying|bought)\b/i],
  ['unlock', /\bunlock/i],
  ['a peso sign', /₱/],
  ['a price', /\bpric(?:e|es|ed)\b/i],
  ['a rate', /\brates?\b/i],
  ['a top-up', /\btop[- ]?ups?\b/i],
  ['an upgrade', /\bupgrades?\b/i],
  ['a subscription', /\bsubscriptions?\b/i],
  ['one-time', /\bone-time\b/i],
  ['paid software', /\bpaid (?:software|planner|tier|features?|upgrades?)\b/i],
  ['another mobile platform', /\bAndroid\b|Google Play|Play Store/i],
  ['the desktop download', /desktop app|setnayan\.com\/download|\bWindows\b|\bmacOS\b/],
  ['the supplier price-ladder page', /for-suppliers/i],
];

/**
 * Hits that are not a Setnayan sale, each with its reason. A new entry needs
 * one; an entry whose hit is gone fails below, so the list cannot rot.
 */
const NOT_A_SALE = new Map<string, { what: string; why: string }>([
  ['build-your-online-presence', { what: 'unlock', why: '"That unlocks insights" — Instagram\'s own professional-account feature, not something Setnayan sells' }],
  [
    'sign-up-as-vendor',
    {
      what: 'the supplier price-ladder page',
      why: 'OWNER CALL (Apple check 2026-10-19): the only supplier sign-up door is /for-suppliers, which the app refuses — so the app has no in-app way to open a shop. Until he rules, the web answer stands.',
    },
  ],
]);

test('every help answer the app can show sells nothing and names no other platform (walked, not listed)', () => {
  assert.ok(ALL_HELP_ARTICLES.length >= 60, `walked only ${ALL_HELP_ARTICLES.length} articles — the anchor moved`);
  const offenders: string[] = [];
  const usedExceptions = new Set<string>();
  let withAppWords = 0;
  const listed = new Set(helpTopicsFor(HELP_TOPICS, true).flatMap((t) => t.articles.map((a) => a.slug)));
  for (const { article, topic } of ALL_HELP_ARTICLES) {
    if (article.appBody !== undefined) withAppWords++;
    const shown = helpBodyFor(article, true);
    // A question the app still lists is read by its title too.
    const text = listed.has(article.slug) ? `${article.title}\n${shown}` : shown;
    for (const [name, re] of SELLS) {
      const m = re.exec(text);
      if (!m) continue;
      const ex = NOT_A_SALE.get(article.slug);
      if (ex && ex.what === name) {
        usedExceptions.add(article.slug);
        continue;
      }
      offenders.push(`${topic.key}/${article.slug}: ${name} — "…${text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}…"`);
    }
  }
  console.log(`[help-in-app] ${ALL_HELP_ARTICLES.length} articles · ${withAppWords} with app words · ${offenders.length} selling in the app`);
  assert.ok(withAppWords >= 10, `only ${withAppWords} articles carry app words — the scan is not reaching them`);
  assert.deepEqual(
    offenders,
    [],
    'A help answer the iPhone app shows sells, points at the web to buy, or names another platform. Give the article an `appBody` that says what the feature does (or HELP_NOT_IN_THE_APP):\n  ' +
      offenders.join('\n  '),
  );
  for (const slug of NOT_A_SALE.keys()) assert.ok(usedExceptions.has(slug), `NOT_A_SALE "${slug}" no longer matches — drop it`);
});

test('the web keeps every word — app words never replace the web answer', () => {
  for (const { article } of ALL_HELP_ARTICLES) {
    assert.equal(helpBodyFor(article, false), article.body, `${article.slug}: the web shows the app words`);
  }
  assert.deepEqual(helpTopicsFor(HELP_TOPICS, false), [...HELP_TOPICS], 'off the store shell the topics must be untouched');
});

test('a question about a part the app does not include is not offered in the app', () => {
  const hidden = ALL_HELP_ARTICLES.filter(({ article }) => article.appBody === HELP_NOT_IN_THE_APP);
  assert.ok(hidden.length >= 3, `only ${hidden.length} not-in-the-app answers — the anchor moved`);
  const app = helpTopicsFor(HELP_TOPICS, true);
  const listed = new Set(app.flatMap((t) => t.articles.map((a) => a.slug)));
  for (const { article } of hidden) assert.ok(!listed.has(article.slug), `${article.slug}: still listed in the app's /help`);
  for (const t of app) assert.ok(t.articles.length > 0, `${t.key}: an empty topic is still listed in the app`);
  // …and site search in the app does not offer it either.
  for (const { article } of hidden) {
    const hrefs = searchInCodeReads(article.title, true).map((h) => h.href);
    assert.ok(!hrefs.includes(`/help/${article.slug}`), `search in the app still offers /help/${article.slug}`);
    assert.ok(searchInCodeReads(article.title, false).some((h) => h.href === `/help/${article.slug}`), `the web lost ${article.slug} from search`);
  }
  // The app's not-included answer is the /web-only page's own sentence.
  assert.match(readFileSync(join(WEB, 'app/(shell)/web-only/page.tsx'), 'utf8'), new RegExp(HELP_NOT_IN_THE_APP.replace(/\.$/, '').replace(/ /g, '\\s+')));
});

test('in the app, the mobile-app answer is "you are using it" — no platform, no download', () => {
  const inApp = mobileAppAnswerInApp();
  assert.equal(findHelpArticle('does-setnayan-have-mobile-app')?.article.appBody, inApp, '/help types its own in-app answer');
  assert.doesNotMatch(inApp, /Android|Google Play|iPhone|iPad|Safari|Chrome|home screen|download|desktop|Mac|Windows/i);
});

function sources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, acc);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}

test('every surface that prints a help answer goes through the store-shell choice (importers enumerated)', () => {
  // Not shown to a person, so not a surface: the sitemap lists URLs; llms.txt
  // is for answer engines and never renders in the app.
  const NOT_A_SURFACE = new Set(['app/sitemap-help.xml/route.ts', 'lib/llms-txt.ts']);
  const files = sources(join(WEB, 'app')).concat(sources(join(WEB, 'lib')), sources(join(WEB, 'components')));
  const importers = files
    .filter((f) => /from ['"](?:@\/lib\/help|\.{1,2}\/(?:[\w-]+\/)*help)['"]/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  assert.ok(importers.length >= 4, `only ${importers.length} importers of lib/help — the anchor moved`);
  const unchosen: string[] = [];
  for (const rel of importers) {
    if (NOT_A_SURFACE.has(rel)) continue;
    const code = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    if (!/\.body\b/.test(code)) continue; // prints no answer
    if (!/helpBodyFor|helpTopicsFor|appBody/.test(code)) unchosen.push(rel);
  }
  console.log(`[help-in-app] ${importers.length} importers of lib/help · ${unchosen.length} print an answer without the store-shell choice`);
  assert.deepEqual(unchosen, [], 'These print a help answer without asking which reader it is for:\n  ' + unchosen.join('\n  '));

  // The per-request pages pick on the server.
  for (const rel of ['app/(shell)/help/page.tsx', 'app/(shell)/about/page.tsx']) {
    assert.match(readFileSync(join(WEB, rel), 'utf8'), /helpTopicsFor\(HELP_TOPICS, (?:await isStoreShellRequest\(\)|storeShell)\)/, `${rel} does not pick the reader's words`);
  }
  assert.match(readFileSync(join(WEB, 'lib/site-search.ts'), 'utf8'), /searchInCodeReads\(query, await isStoreShellRequest\(\)\)/);
});

test('the prerendered /help/<slug> page ships both words and shows exactly one', () => {
  const page = stripComments(readFileSync(join(WEB, 'app/help/[slug]/page.tsx'), 'utf8'));
  assert.match(page, /<div data-web-only="">\{renderHelpBody\(article\.body\)\}<\/div>/);
  assert.match(page, /<div data-app-only="">\{renderHelpBody\(article\.appBody\)\}<\/div>/);
  assert.equal((page.match(/renderHelpBody\(article\.body\)/g) ?? []).length, 2, 'one unwrapped body for articles with no app words, one wrapped');
  assert.match(page, /article\.appBody === undefined \?\s*\(\s*renderHelpBody\(article\.body\)/);
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  assert.match(css, /html\[data-store-shell\] \[data-web-only\] \{\s*display: none !important;\s*\}/);
  assert.match(css, /html:not\(\[data-store-shell\]\) \[data-app-only\] \{\s*display: none !important;\s*\}/);
});
