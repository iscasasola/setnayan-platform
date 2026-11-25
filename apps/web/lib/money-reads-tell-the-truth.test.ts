/**
 * Final check, area 1, batch a1-a5-money: failed reads that showed as a real answer, and pesos formatted by hand.
 * One claim per finding. Every source check strips comments first, so a docblock that names the old shape cannot
 * satisfy it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { featurePriceLabel, resolveFeaturePrice } from './feature-pages/price';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('A1-100 · the customer catalogue read keeps its failure, and Home, /pricing and /pricing/plan say it', () => {
  const cat = src('lib/v2-catalog.ts');
  const read = cat.slice(cat.indexOf('export async function fetchV2CustomerCatalogRead('));
  const body = read.slice(0, read.indexOf('\nexport '));
  assert.match(body, /if \(error\) \{[\s\S]*?return \{ rows: \[\], ok: false \};/, 'a refused read must say ok: false');
  assert.match(body, /catch \{\s*return \{ rows: \[\], ok: false \};/, 'no admin client is a failure, not "nothing on sale"');

  const door = src('app/_components/frontdoor/front-door.tsx');
  assert.match(door, /fetchV2CustomerCatalogRead\(\)/);
  assert.match(door, /pricesRead=\{catalogRead\.ok\}/, 'Home passes the outcome to the plan list');
  const landing = src('app/_components/frontdoor/front-door-landing.tsx');
  assert.match(landing, /\{pricesRead \? null : \([\s\S]*?Couldn&rsquo;t read the prices of the paid plans/);

  const reads = src('app/(shell)/pricing/_pricing-reads.ts');
  assert.match(reads, /pricesRead: catalog\.ok/);
  const pricing = src('app/(shell)/pricing/page.tsx');
  assert.match(pricing, /\{pricesRead \? null : \([\s\S]*?Couldn&rsquo;t read the prices of the paid extras/);
  const plan = src('app/(shell)/pricing/plan/page.tsx');
  assert.match(plan, /: pricesRead \? null : \([\s\S]*?Couldn&rsquo;t read the plan prices/);
});

test('A1-023 · /papic says it could not read the prices, with Try again, and never draws a free-only dial', () => {
  const page = src('app/(shell)/papic/page.tsx');
  assert.match(page, /if \(!catalogRead\.ok \|\| poolTiers\.length === 0\) return 'unread';/);
  assert.match(page, /anchor === 'unread' \? \([\s\S]*?Couldn&rsquo;t read the Papic prices[\s\S]*?Try again/);
  assert.ok(
    page.indexOf("anchor === 'unread'") < page.indexOf('<PapicDial'),
    'the unread branch is decided before the dial can draw',
  );
});

test('A1-034 · A1-114 · these pesos go through lib/php.ts, never a hand-built "₱"', () => {
  const files = [
    'app/(shell)/papic/_papic-dial.tsx',
    'app/_components/frontdoor/front-door-landing.tsx',
    'app/(shell)/pricing/page.tsx',
    'app/(shell)/pricing/_pricing-reads.ts',
    'app/(shell)/pricing/plan/page.tsx',
    'app/(shell)/pricing/plan/_plan-quiz.tsx',
    'app/(shell)/pricing/plan/_plan-steps.ts',
    'lib/feature-pages/price.ts',
  ];
  const handBuilt = /'₱'\s*\+|₱\$\{|₱\{/;
  for (const f of files) {
    const s = src(f);
    assert.doesNotMatch(s, handBuilt, `${f} builds a peso by hand`);
    assert.match(s, /formatPhp/, `${f} does not use formatPhp`);
  }
});

test('A1-114 · a feature price that could not be read says so; one that is not sold still says "See pricing"', () => {
  const paid = { kind: 'paid', catalogue: 'customer', codes: ['X'] } as unknown as Parameters<typeof resolveFeaturePrice>[0];
  const unread = resolveFeaturePrice(paid, null);
  assert.equal(featurePriceLabel(unread, 'en'), 'Couldn’t read the price');
  assert.equal(featurePriceLabel(unread, 'tl'), 'Hindi mabasa ang presyo');
  assert.equal(featurePriceLabel(resolveFeaturePrice(paid, []), 'en'), 'See pricing');
});

test('A1-036 · a failed /panood demo has a Try again that mints a fresh pair in place', () => {
  const s = src('app/_components/home/panood-demo-overlay.tsx');
  assert.match(s, /\}, \[open, attempt\]\);/, 'the mint effect re-runs on Try again');
  assert.match(s, /failed \? \([\s\S]*?onClick=\{\(\) => setAttempt\(\(n\) => n \+ 1\)\}[\s\S]*?Try again/);
  assert.doesNotMatch(s, /Close this and try again/);
});

test('A1-033 · "Add to an event" says it could not read your events — never "none", never the signed-out look', () => {
  const data = src('app/_components/marketing/add-to-event-data.ts');
  assert.match(data, /userEventsReadRefused\(supabase, userId, 'couple'\)/);
  assert.match(data, /if \(refused\) return readFailed;/);
  const tail = data.slice(data.lastIndexOf('catch {'));
  assert.match(tail, /return readFailed;/, 'a throw after sign-in is a failure, not the signed-out view');
  const ui = src('app/_components/marketing/add-to-event.tsx');
  assert.match(ui, /\{readFailed \? \([\s\S]*?Couldn&rsquo;t read your events[\s\S]*?router\.refresh\(\)[\s\S]*?Try again/);
  const cta = src('app/_components/marketing/add-to-event-cta.tsx');
  assert.match(cta, /readFailed=\{state\.readFailed \?\? false\}/);
});

test('A1-045 · "Start a new event" starts one, and each row opens where the service lives', () => {
  const doorway = src('app/_components/marketing/_doorway.tsx');
  assert.match(
    doorway,
    /\[primary, secondary\]\.find\(\s*\(d\) => d\.href === routes\.start\(\) \|\| d\.href\.startsWith\(routes\.onboarding\.wedding\(\)\),?\s*\) \?\? primary/,
  );
  const cta = src('app/_components/marketing/add-to-event-cta.tsx');
  assert.match(cta, /createHref=\{create\.href\}/);
  assert.doesNotMatch(cta, /createHref=\{primary\.href\}/);
  const data = src('app/_components/marketing/add-to-event-data.ts');
  assert.match(data, /href: app\.eventHref\s*\? app\.eventHref\(e\.eventId\)/, 'a free tool opens its own room first');
  assert.doesNotMatch(data, /`\/dashboard\/\$\{/, 'no hand-typed event address');
  // The marketplace page: primary is Browse, secondary is the start door — the create row must take the latter.
  const market = src('app/(shell)/marketplace/page.tsx');
  assert.match(market, /secondary=\{\{ href: (?:'\/onboarding\/wedding\?from=marketplace'|routes\.start\(\))/);
});

test('A1-041 · Compare says each failed read in its own place', () => {
  const s = src('app/(shell)/explore/compare/page.tsx');
  assert.match(s, /const \{ data: rowsRaw, error: rowsError \}/);
  assert.match(s, /if \(rowsError\) \{[\s\S]*?<ErrorState[\s\S]*?Try again/, 'a failed shops read is said, not a silent redirect');
  assert.match(s, /fetchTrustedReviewStatsForManyRead\(/);
  assert.match(s, /if \(trustedReviewStats === null\) \{[\s\S]*?Couldn&rsquo;t read reviews/);
  assert.match(s, /if \(eventReadFailed \|\| venueReadFailed\) \{[\s\S]*?Couldn&rsquo;t read your venue/);
  assert.match(s, /if \(savedError\) savedReadFailed = true;/);
  assert.match(s, /\{savedReadFailed \? \([\s\S]*?Couldn&rsquo;t read whether it&rsquo;s already saved/);
  const reviews = src('lib/reviews.ts');
  const read = reviews.slice(reviews.indexOf('export async function fetchTrustedReviewStatsForManyRead('));
  assert.match(read.slice(0, read.indexOf('\n}\n')), /if \(error\) \{[\s\S]*?return null;/);
});

test('A1-042 · Compare asks the one findable rule and the one badge rule', () => {
  const s = src('app/(shell)/explore/compare/page.tsx');
  assert.match(s, /: await shopsBase\.match\(FINDABLE_SHOP_GATE\);/, 'outside demo mode the shops read asks the gate');
  assert.match(s, /\{hasVerifiedBadge\(row\) \? \(/, 'the ✓ Verified pill is the one badge predicate');
  assert.doesNotMatch(s, /visibility === 'verified' \?/);
  assert.match(s, /next_renewal_due_at/, 'the badge deadline is read');
});

test('A1-043 · Compare reads the saved state, the distance and the save from the same event', () => {
  const s = src('app/(shell)/explore/compare/page.tsx');
  assert.doesNotMatch(s, /fetchUserEvents/, 'no second rule for "your" event');
  assert.match(s, /coupleEventId = \(await resolvePrimaryHostEvent\(admin, user\.id\)\)\?\.event_id \?\? null;/);
  assert.match(s, /events=\{saveChoices\}/, 'a host with several events is asked which');
  const actions = src('app/(shell)/explore/actions.ts');
  assert.match(actions, /resolvePrimaryHostEvent\(admin, user\.id\)/, 'the save resolves the same way');
});

test('A1-157 · the supplier grid says a failed read; it never filters on who is looking', () => {
  const gate = src('lib/vendor-inquirable-gate.ts');
  const read = gate.slice(gate.indexOf('export async function fetchVendorIdsWithActiveServiceRead('));
  assert.match(read, /if \(error\) \{[\s\S]*?return null;/);
  assert.match(read, /catch \{\s*return null;/);
  const view = src('app/(shell)/explore/_lib/marketplace-view.tsx');
  assert.match(view, /let gridReadFailed = inquirableRead === null;/);
  assert.match(view, /if \(rowsError\) \{[\s\S]*?gridReadFailed = true;/);
  assert.match(view, /readFailed=\{gridReadFailed\}/);
  assert.match(view, /if \(readFailed\) \{[\s\S]*?Couldn’t read the suppliers/);
  assert.doesNotMatch(view, /account_type === 'vendor'|viewerVendor|excludeOwn/, 'the grid must not depend on the viewer being a supplier');
  assert.doesNotMatch(src('lib/explore-empty-grid.ts'), /every week/, 'no unmeasured promise');
});
