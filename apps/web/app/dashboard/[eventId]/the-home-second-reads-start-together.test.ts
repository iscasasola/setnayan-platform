/**
 * the-home-second-reads-start-together.test.ts — ⚡ OPENING AN EVENT IS NOT A QUEUE OF READS.
 *
 * Owner, 2026-10-16: "Opening my events takes so long." Measured on a production build of
 * origin/main with the owner's own rows replayed (every read timed at its production
 * `pg_stat_statements` mean): the event Home was 116 reads in 12–16 waves. After the page's
 * one wait, the header's cover was read on its own; inside `EventDashboard` (What's next) the
 * type photo, own hero, profile + plan-group scope, poster, budget visibility, paywall flag,
 * Sai price, store shell and upcoming items were each awaited in turn — none needing the one
 * before it. They are now STARTED together (`lib/start-ahead.ts`) and awaited where they were.
 *
 * Holds: every top-level `await` in the two bodies is either the one wait, a value that must
 * come first (auth, params, the event row that `notFound()` gates), or a promise that was
 * started ahead (`…Read`). A new read added as its own `await` turns this red — start it with
 * the others instead.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../../lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Awaits at the function body's own indentation (two spaces) — the ones that queue the render. */
function topLevelAwaits(src: string, fnStart: string): string[] {
  const at = src.indexOf(fnStart);
  assert.ok(at >= 0, `${fnStart} not found — if it moved, move this guard with it`);
  const end = src.indexOf('\n}\n', at);
  return src
    .slice(at, end)
    .split('\n')
    .filter((l) => /^ {2}[^ ].*\bawait\b/.test(l) || /^ {4}\(await /.test(l))
    .map((l) => l.trim());
}

const MUST_COME_FIRST = [
  /^const \{ eventId \} = await params;$/,
  /^const search = searchParams \? await searchParams : \{\};$/,
  /^const user = await getCurrentUser\(\);$/,
  /^const supabase = await createClient\(\);$/,
  /^const eventRes = await \(async \(\) => \{$/, // the event row — notFound() gates every service-role read on it
  /^\] = await Promise\.all\(\[$/, // the one wait
];
const STARTED = /^(const [\w[\]{}, ]+ = )?(sceneCoverFor\()?\(?await \w+Read\)?/;

for (const [file, fn] of [
  ['app/dashboard/[eventId]/page.tsx', 'export default async function EventHomePage('],
  ['app/dashboard/[eventId]/_components/event-dashboard.tsx', 'export async function EventDashboard('],
] as const) {
  test(`${fn.replace(/\($/, '')}: no read waits for a neighbour it does not need`, () => {
    const awaits = topLevelAwaits(read(file), fn);
    assert.ok(awaits.length >= 4, `saw only ${awaits.length} awaits — the scan is broken`);
    const queued = awaits.filter((a) => !MUST_COME_FIRST.some((r) => r.test(a)) && !STARTED.test(a));
    assert.deepEqual(queued, [], `a read awaited in single file — start it with the others (startAhead):\n${queued.join('\n')}`);
  });
}

test('the started reads are the same calls, started once', () => {
  const dash = read('app/dashboard/[eventId]/_components/event-dashboard.tsx');
  for (const name of [
    'typeHeroRead',
    'ownHeroRead',
    'profileScopeRead',
    'posterRead',
    'budgetVisibilityRead',
    'aiPaywallRead',
    'fullSaiRead',
    'storeShellRead',
    'upcomingRead',
  ]) {
    assert.equal(dash.match(new RegExp(`const ${name} = startAhead\\(`, 'g'))?.length ?? 0, 1, `${name} is not started once`);
    assert.equal(dash.match(new RegExp(`await ${name}\\b`, 'g'))?.length ?? 0, 1, `${name} is not awaited exactly once`);
  }
  const page = read('app/dashboard/[eventId]/page.tsx');
  assert.match(page, /const homeCoverRead = startAhead\(homeCoverFor\(eventId\)\.catch\(\(\) => null\)\);/);
  // Service-role reads start only after notFound() has refused a caller who cannot read the event.
  assert.ok(page.indexOf('const homeCoverRead') > page.indexOf('if (!event) notFound();'));
});
