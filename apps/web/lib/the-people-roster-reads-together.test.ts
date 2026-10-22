/**
 * the-people-roster-reads-together.test.ts — the People tab does not make a
 * phone wait for reads that need nothing from each other.
 *
 * MEASURED 2026-10-23 (the speed pass), `people-page-reads.harness.ts` — the
 * REAL `getPeopleRoster` and the REAL `PeoplePage` against a database that
 * counts how deep each request ran:
 *
 *   · the roster was 10 trips one after another (me → my connections → names →
 *     which event asked → their accounts → my samahan → its members → the
 *     partner's shared event → the loved-ones gate → loved ones);
 *   · the page then asked the follow list and the spouse rule AFTER the roster
 *     came back — three more trips on Connected, Requests and Loved ones.
 *
 * Connections, samahan and loved ones need only the signed-in id, so they now
 * start together; inside connections the three reads that need only the rows
 * start together; every partner is asked at once; and the page asks the spouse
 * rule in the roster's own wait. The property held here is the DEPTH — what a
 * person waits for — and that the roster hands the screen exactly the same rows.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

type View = { calls: number; depth: number; ms: number; steps: string[]; repeats: string[] };
type Report = {
  roster: View;
  page: View;
  rosterShape: {
    people: unknown[][];
    mySamahan: Array<{ id: string; name: string }>;
    counts: Record<string, number | null>;
    samahanUnavailable: boolean;
    connectionsUnavailable: boolean;
  };
};

const WEB = join(__dirname, '..');
const HARNESS = join(WEB, 'app', 'dashboard', '(account)', 'people', 'people-page-reads.harness.ts');

function measure(): Report {
  const out = execFileSync(join(WEB, '..', '..', 'node_modules', '.bin', 'tsx'), [HARNESS], {
    cwd: WEB,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_OPTIONS: '', PEOPLE_PAGE_READS_DELAY_MS: '3' },
    timeout: 180_000,
  });
  const line = out.split('\n').find((l) => l.startsWith('PEOPLE_PAGE_READS '));
  assert.ok(line, `the harness printed no report:\n${out.slice(-2000)}`);
  return JSON.parse(line.slice('PEOPLE_PAGE_READS '.length)) as Report;
}

const REPORT = measure();
const shape = (v: View) => `${v.calls} requests, ${v.depth} deep\n  ${v.steps.join('\n  ')}`;

test('0 · the fixture reached every branch — or the depth below would be about nothing', () => {
  const kinds = REPORT.rosterShape.people.map((p) => p[0]);
  assert.deepEqual(kinds, ['connection', 'connection', 'connection', 'alaga'], 'connections first, loved ones after — the order the screen lists them in');
  const all = REPORT.roster.steps.join('\n');
  for (const read of ['person_connections', 'rpc/visible_connection_names', 'rpc/connection_request_events', 'communities', 'dependents', 'event_members']) {
    assert.ok(all.includes(read), `the fixture never made the roster read ${read}:\n${shape(REPORT.roster)}`);
  }
});

test('1 · the roster hands the screen the same rows it always did', () => {
  assert.deepEqual(REPORT.rosterShape.people, [
    ['connection', 'Ana Reyes', 'connected', 'partner', true, null, '', null],
    ['connection', 'Ben Cruz', 'waiting_you', 'friend', null, 'Ben & Lea', '', null],
    ['connection', 'Cai Santos', 'connected', 'friend', null, null, 'Barkada', null],
    ['alaga', 'Lola Nena', 'in_your_care', null, null, null, '', 'My grandparent'],
  ]);
  assert.deepEqual(REPORT.rosterShape.mySamahan, [{ id: 'k-1', name: 'Barkada' }]);
  assert.equal(REPORT.rosterShape.counts.alaga, 1);
  assert.equal(REPORT.rosterShape.counts.samahan, 1);
  assert.equal(REPORT.rosterShape.samahanUnavailable, false);
  assert.equal(REPORT.rosterShape.connectionsUnavailable, false);
});

/** me → my connections → (names · which event asked · their accounts) → the partner's shared event. */
const ROSTER_MAX_DEPTH = 4;

test(`2 · the roster is at most ${ROSTER_MAX_DEPTH} trips deep (it was 10)`, () => {
  assert.ok(REPORT.roster.depth <= ROSTER_MAX_DEPTH, `the roster waits on reads one after another again:\n${shape(REPORT.roster)}`);
});

test('3 · the page asks the spouse rule and the follow list in the roster’s own wait', () => {
  // The page adds the sign-in check in front of the roster; nothing may wait AFTER it.
  assert.ok(REPORT.page.depth <= ROSTER_MAX_DEPTH + 1, `the People page waits on a read after the roster again:\n${shape(REPORT.page)}`);
  assert.ok(REPORT.page.steps.some((s) => / users\(civil_status/.test(s)), `the Connected view no longer reads the spouse rule:\n${shape(REPORT.page)}`);
});
