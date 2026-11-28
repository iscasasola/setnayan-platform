/**
 * Final check, area 1, batch a1-a9-help-legal-seo: help answers, legal pages, and what search engines and AI read.
 * Every source check strips comments first, so a docblock that names the old words cannot satisfy it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { INVITE_PARTNERS_AT_ONCE } from './supplier-invite';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** These files tell hosts no "0% commission" in any form (owner 28 Nov 2026: hosts own the event). */
function noHostCommissionLine(file: string): void {
  const s = src(file);
  for (const m of s.matchAll(/[^.'"`>(]*Hosts pay 0% commission[^.'"`<]*/g)) {
    assert.fail(`${file}: a host is told "0% commission": "${m[0].trim()}"`);
  }
}

test('A1-084 · a failed stories read on a /help search is said, even with no feature hits', () => {
  const s = src('app/_components/how-search/how-search.tsx');
  assert.match(s, /if \(hits\.length === 0\) \{\s*return storiesFailed \? \([\s\S]*?Stories didn&rsquo;t load just now/);
  assert.doesNotMatch(s, /if \(title\) \{\s*if \(hits\.length === 0\) return null;/);
});

test('A1-093 · A1-092 · help answers make no banned promise and say the commission one way', () => {
  for (const f of ['lib/help/topics-existing.ts', 'app/_components/help-ask/help-ask-places.ts']) {
    const s = src(f);
    assert.doesNotMatch(s, /for good|always free/i, `${f}: a forever promise`);
    assert.doesNotMatch(s, /\bcompliant\b/, `${f}: a compliance slogan`);
    noHostCommissionLine(f);
  }
});

test('A1-086 · A1-107 · house words in help, privacy and the Logo Maker page', () => {
  assert.doesNotMatch(src('lib/help/topics-existing.ts'), /title: '[^']*[Mm]onogram/);
  assert.doesNotMatch(src('app/(shell)/privacy/page.tsx'), /Pabuya/);
  assert.doesNotMatch(src('lib/feature-pages/invite.ts'), /title: \{ en: '[^']*Monogram/);
});

test('A1-066 · /waitlist says the ruled commission line and asks no supplier to pre-register', () => {
  noHostCommissionLine('app/(shell)/waitlist/page.tsx');
  assert.doesNotMatch(src('app/(shell)/waitlist/page.tsx'), /Pre-register|Zero commission|no commission on bookings/);
});

test('A1-069 · the invite card and the /i page say one rule about partners', () => {
  assert.equal(INVITE_PARTNERS_AT_ONCE, 'Joining makes you partners at once');
  assert.match(src('app/i/[slug]/page.tsx'), /\$\{INVITE_PARTNERS_AT_ONCE\}/);
  assert.match(src('app/vendor/claim/[token]/_components/claim-parts.tsx'), /\{INVITE_PARTNERS_AT_ONCE\}/);
  assert.doesNotMatch(src('app/i/[slug]/page.tsx'), /once you have served an event together/);
});

test('A1-088 · A1-090 · A1-087 · privacy names a live address, no jargon, and the longer keep', () => {
  const p = src('app/(shell)/privacy/page.tsx');
  assert.doesNotMatch(p, /realstories/, 'the retired stories address');
  assert.doesNotMatch(p, /Phase 4 starts at T\+1d/, 'internal jargon');
  assert.match(p, /longer\s+on a plan that includes a longer keep, such as Event Ultra/);
  assert.doesNotMatch(p, /animated\s+monogram|personal reel/, 'retired products in the featuring list');
});

test('A1-163 · llms.txt tells the truth in house words', () => {
  const s = src('lib/llms-txt.ts');
  assert.doesNotMatch(s, /Monogram Maker/);
  assert.doesNotMatch(s, /for good|Ever\."/);
  assert.doesNotMatch(s, /\[Find suppliers on Discover\]\(\$\{url\('\/'\)\}\)/, 'a stranger opening supplier browsing lands on sign-in');
  assert.match(s, /\[Find suppliers\]\(\$\{url\('\/suppliers'\)\}\)/);
  assert.doesNotMatch(s, /at 0% commission|0% commission for hosts/);
});

test('A1-164 · robots lets search read Home and the help answers; the help sitemap is listed', () => {
  const robots = src('app/robots.ts');
  const allowed = robots.slice(robots.indexOf('const ALLOWED_PATHS'), robots.indexOf('];', robots.indexOf('const ALLOWED_PATHS')));
  assert.match(allowed, /'\/',/);
  assert.match(allowed, /'\/help',/);
  assert.match(src('app/sitemap.xml/route.ts'), /slug: 'sitemap-help\.xml'/);
});

test('A1-162 · the stories sitemap is listed only while it holds a page', () => {
  const s = src('app/sitemap.xml/route.ts');
  assert.match(s, /\.\.\.\(hasRealStories \? \[\{ slug: 'sitemap-weddings\.xml', lastmod: now \}\] : \[\]\)/);
  assert.match(s, /m\.loadPublishedShowcases\(\)[\s\S]*?rows\.some\(\(r\) => !r\.isSample\)/);
});

test('A1-161 · no doubled brand, short titles, own descriptions, and a share picture on legal pages', () => {
  assert.match(src('app/(hub)/page.tsx'), /title: \{ absolute: HOME_TITLE \}/);
  assert.match(src('app/(shell)/privacy/google-access/metadata.ts'), /const TITLE = 'What connecting Google does';/);
  assert.doesNotMatch(src('app/(shell)/creators/page.tsx'), /const TITLE = 'Setnayan for/);
  assert.match(src('app/(shell)/(help-list)/help/topics/page.tsx'), /description: '/);
  assert.match(src('app/(shell)/(help-pages)/help/topics/[key]/page.tsx'), /description: `Setnayan help on/);
  assert.match(src('app/(shell)/web-only/page.tsx'), /description: '/);
  for (const f of ['privacy', 'terms', 'cookies', 'refunds', 'acceptable-use']) {
    assert.match(src(`app/(shell)/${f}/page.tsx`), /openGraph: \{\s*images: BRAND_OG_IMAGES,/, `/${f} has no share picture`);
  }
});
