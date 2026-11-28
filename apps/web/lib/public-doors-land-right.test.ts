/**
 * Final check, area 1, batch a1-a6-doors: buttons that landed a stranger in the wrong place, and search hygiene for
 * utility pages. Every source check strips comments first.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { routes } from './routes';
import { withArticle } from './a-sample-says-what-it-is';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

test('A1-031 · A1-112 · no public page links wedding onboarding or sign-up as its "Start planning" door', () => {
  assert.equal(routes.start(), '/start');
  // The wedding-only doors that stay on purpose: their own words say "wedding", or the flow hands a design to it.
  const WEDDING_WORDED = new Set([
    'app/_components/marketing/reskin-footer.tsx', // "Plan your wedding"
    'app/_components/marketing/OurStory.tsx', // "Start your wedding"
  ]);
  const offenders: string[] = [];
  for (const root of ['app/(shell)', 'app/features', 'app/tour', 'app/sample', 'app/_components']) {
    for (const file of walk(join(WEB, root))) {
      const rel = relative(WEB, file);
      if (WEDDING_WORDED.has(rel)) continue;
      if (/['"`]\/onboarding\/wedding(\?[^'"`]*)?['"`]/.test(stripComments(readFileSync(file, 'utf8')))) offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], 'these public pages still open the wedding flow for every host');

  for (const f of [
    'app/features/_sections/_FinalCTA.tsx',
    'app/features/_row-sheet.tsx',
    'app/features/_feature-page.tsx',
    'app/(shell)/about/page.tsx',
    'app/(shell)/tl/about/page.tsx',
  ]) {
    const s = src(f);
    assert.doesNotMatch(s, /href[=:]\s*\{?\s*['"]\/signup['"]/, `${f}: a host start button still asks for an account first`);
    assert.match(s, /routes\.start\(\)/, `${f}: the host start button is not /start`);
  }
});

test('A1-050 · A1-051 · A1-052 · the supplier landing pages: /start, a narrowed "See them all", and the right article', () => {
  const s = src('app/(shell)/suppliers/_landing.tsx');
  assert.match(s, /<Link href=\{routes\.start\(\)\}[^>]*>Start planning free<\/Link>/);
  assert.doesNotMatch(s, /href="\/signup"/);
  assert.match(s, /\['tile', page\.tile\],\s*\['event_type', page\.event\],[\s\S]*?\['city', page\.city\]/);
  assert.match(s, /<Link href=\{allOnDiscover\}[^>]*>See them all on the marketplace<\/Link>/);
  assert.doesNotMatch(s, /Planning a \{|for a \$\{|for a \{/, 'no fixed "a" before an event name');
  assert.equal(withArticle('Anniversary'), 'an anniversary');
  assert.equal(withArticle('Event'), 'an event');
  assert.equal(withArticle('Wedding'), 'a wedding');
  assert.equal(withArticle('Debut'), 'a debut');
});

test('A1-113 · "Browse suppliers" and "Try it" open the public supplier directory', () => {
  assert.ok(statSync(join(WEB, 'app/(shell)/suppliers/(index)/page.tsx')).isFile(), '/suppliers is a real page');
  for (const f of ['app/(shell)/about/page.tsx', 'app/(shell)/tl/about/page.tsx']) {
    const s = src(f);
    assert.doesNotMatch(s, /href="\/\?browse=1"/, `${f}: Browse suppliers bounces a stranger to sign-in`);
    assert.match(s, /href="\/suppliers"/);
  }
  assert.match(src('lib/feature-pages/plan-b.ts'), /tryHref: '\/suppliers'/);
  assert.doesNotMatch(src('lib/feature-pages/plan-b.ts'), /tryHref: '\/\?browse=1'/);
});

test('A1-003 · /samahan keeps "Create a group" for everybody', () => {
  const s = src('app/(shell)/samahan/page.tsx');
  assert.doesNotMatch(s, /studioKey=/, 'a group is not added to an event');
  assert.match(s, /primary=\{\{ href: '\/dashboard\/samahan\/new', label: 'Create a group' \}\}/);
});

test('A1-121 · /start owns its <main> landmark', () => {
  const s = src('app/(shell)/start/page.tsx');
  assert.equal((s.match(/<main\b/g) ?? []).length, 1);
  assert.match(src('app/_components/frontdoor/front-door-shell.tsx'), /const MainEl = ownsMain \? 'div' : 'main'/);
});

test('A1-160 · sign-in pages and the API reference stay out of search', () => {
  for (const f of ['app/login/page.tsx', 'app/signup/page.tsx', 'app/forgot-password/page.tsx']) {
    assert.match(src(f), /robots: \{ index: false, follow: true \}/, `${f} is indexable`);
  }
  assert.match(src('app/signup/you/page.tsx'), /robots: \{ index: false/);
  assert.match(src('app/reset-password/page.tsx'), /robots: \{ index: false/);
  const api = src('app/api/v1/page.tsx');
  assert.match(api, /robots: \{ index: false, follow: false \}/);
  assert.match(api, /canonical: '\/api\/v1'/);
  const sitemap = src('app/sitemap-static.xml/route.ts');
  assert.doesNotMatch(sitemap, /path: '\/(login|signup)'/, 'a noindex page is not in the sitemap');
});

test('A1-172 · the sign-in card’s ✕ is a real link to where it dismisses', () => {
  const s = src('app/login/_components/sign-in-card-modal.tsx');
  assert.match(s, /\{dismissible && dismissHref \? \(\s*<a href=\{dismissHref\} className="hr-ov-x" aria-label="Close">/);
  assert.match(s, /if \(dismissHref\) window\.location\.assign\(dismissHref\);/);
  assert.doesNotMatch(s, /router\.push\(dismissHref\)/);
});
