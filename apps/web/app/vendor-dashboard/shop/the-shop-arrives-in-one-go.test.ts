/**
 * 🔒 THE SHOP ARRIVES IN ONE GO, AFTER ITS OWN GHOST (21 Nov 2026).
 *
 * Owner, on the supplier Shop page: *"loading feels long. and loading feels scattered and ungoranized. like there are
 * layers that are above each other that shouldn't be"*. Measured that day at 375 px, signed in:
 *   · Shop had NO `loading.tsx`, so it showed the supplier HOME's loader (a completion strip + six stat tiles).
 *   · The page then came in pieces: the service list, Analytics and both notices only STARTED their reads once the
 *     shop's own batch had finished (a second round of reads), and Analytics + both notices each streamed in their own
 *     <Suspense> — a placeholder swapped for the carousel, a notice landing late and pushing everything down.
 *
 * What is held (each part was broken on purpose and went red, then restored — see the PR):
 *   1 · Shop has its OWN loader, in Shop's shape: the "D · Ghost" parts, and every name it shows as known is a name the
 *       page really draws (so it never promises a section that is not there), and it shows no number.
 *   2 · The parts start BESIDE the batch: Analytics and the "Edit your name" notice start before the ONE WAIT, the
 *       service list and the couple photos before the page awaits the batch.
 *   3 · Nothing the reader sees streams in on its own: the only <Suspense> left in the page wraps a SHEET body (closed
 *       until tapped, so it moves nothing), and the started parts are drawn in place, never inside one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const SHOP = import.meta.dirname;
const read = (...p: string[]) => stripComments(readFileSync(join(SHOP, ...p), 'utf8'));
const LOADER_FILE = join(SHOP, 'loading.tsx');

/** What the page itself draws — the components the loader stands in for. */
const DRAWN = [
  read('_components', 'shop-cover.tsx'),
  read('_components', 'shop-makers.tsx'),
  read('_components', 'shop-badge-row.tsx'),
  read('_components', 'shop-services-head.tsx'),
  read('..', 'performance', '_components', 'analytics-carousel.tsx'),
  read('..', 'performance', '_components', 'one-analytics-section.tsx'),
  read('page.tsx'),
].join('\n');

/** Every text the loader shows as KNOWN: `known="…"`, a section head's `name="…"` / `line="…"`, and its word lists. */
function knownWords(loader: string): string[] {
  const out = [...loader.matchAll(/\b(?:known|name|line)="([^"]+)"/g)].map((m) => m[1]!);
  for (const list of loader.matchAll(/const [A-Z_]+ = \[([^\]]*)\] as const/g)) {
    out.push(...[...list[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!));
  }
  return out;
}

test('1 · Shop has its own Ghost loader, and it shows only what the page really draws', () => {
  assert.ok(existsSync(LOADER_FILE), 'shop/loading.tsx is gone — Shop shows the supplier home’s loader again (the wrong page)');
  const loader = read('loading.tsx');
  assert.match(loader, /from '@\/components\/skeletons'/, 'the Shop loader no longer uses the shared skeleton parts');
  assert.match(loader, /<Ghost\b/, 'the Shop loader shows nothing as known — it is the Sheen alone, not the Ghost');
  assert.match(loader, /<Screen\b/, 'the Shop loader lost its one "Loading…" announcement');
  assert.doesNotMatch(loader, /StatStripSkeleton|grid-cols-2 gap-3 sm:grid-cols-3/, 'the Shop loader draws the home’s stat tiles');

  const words = knownWords(loader);
  assert.ok(words.length >= 12, `the guard read only ${words.length} known words off the loader — teach it the loader’s new shape`);
  const html = (w: string) => w.replace(/’/g, '&rsquo;');
  for (const w of words) {
    assert.ok(DRAWN.includes(w) || DRAWN.includes(html(w)), `the Shop Ghost shows "${w}", which the Shop page does not draw`);
    assert.doesNotMatch(w, /\d/, `the Shop Ghost shows a number as known ("${w}") — a skeleton never shows a number as real`);
  }
  // The sections it stands in for are the page's, in the page's order.
  const order = ['Templates', 'Specialized tools', 'Analytics', 'Badges', 'Your bundles and services'].map((w) => loader.indexOf(`="${w}"`));
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1]!)), `the Ghost's sections are not the page's order: ${order.join(' · ')}`);
});

test('2 · every part starts beside the batch — one round of reads, never two', () => {
  const page = read('page.tsx');
  // The ONE WAIT, found by its code (the banner above it is a comment).
  const oneWait = page.indexOf('] = await Promise.all([');
  assert.ok(oneWait > 0, 'the one wait (`] = await Promise.all([`) is gone from the loader');
  for (const part of ["startPart('analytics'", "startPart(\n      'fairSweep'"]) {
    const at = page.indexOf(part);
    assert.ok(at > 0 && at < oneWait, `${part.replace(/\s+/g, ' ')} no longer starts BEFORE the one wait`);
  }
  const awaitBatch = page.indexOf('data = await dataRead;');
  assert.ok(awaitBatch > 0, 'the page no longer awaits the started batch (`data = await dataRead`)');
  for (const part of ["'servicesList'", "startPart('couplePhotos'"]) {
    const at = page.indexOf(part);
    assert.ok(at > 0 && at < awaitBatch, `${part} no longer starts before the page waits for the batch`);
  }
  assert.ok(page.indexOf('const dataRead = loadShopData();') < page.indexOf("'servicesList'"), 'the batch must be started first');
});

test('3 · nothing the reader sees streams in on its own — the only <Suspense> left wraps a closed sheet', () => {
  const page = read('page.tsx');
  const render = page.slice(page.indexOf('<ShopCover'));
  const suspense = [...render.matchAll(/<Suspense\b/g)].map((m) => m.index!);
  assert.ok(suspense.length > 0, 'the guard found no <Suspense> at all — teach it where the sheets went');
  for (const at of suspense) {
    const before = render.slice(Math.max(0, at - 30), at);
    assert.match(before, /\w+Body=\{\s*$/, `a <Suspense> in the Shop render wraps something that is not a sheet body: …${render.slice(at, at + 80)}`);
  }
  for (const drawn of ['{couplePhotos}', '{data.started.fairSweep}', '{data.started.analytics}', '{servicesList}']) {
    assert.ok(render.includes(drawn), `${drawn} is started but never drawn`);
  }
  assert.doesNotMatch(page, /AnalyticsPlaceholder|<OneAnalyticsSection\b|<FairSweepNotice\b|<CouplePhotosToAnswer\b|<VendorServicesManager\b/, 'a part is mounted the old way again — it starts only after the batch');
});
