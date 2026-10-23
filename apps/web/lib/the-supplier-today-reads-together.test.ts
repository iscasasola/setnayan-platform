/**
 * the-supplier-today-reads-together.test.ts — a supplier's Today does not make
 * a phone wait for reads that need nothing from each other.
 *
 * MEASURED 2026-10-23 (the speed pass), `app/vendor-dashboard/today-page-reads.harness.ts`
 * — the REAL Today page (and the supplier layout beside it) against a database
 * that counts how deep each request ran:
 *
 *   · the page asked the auth server who this is AGAIN, though the layout had
 *     already asked (`getCurrentUser`, remembered per request);
 *   · the desk read (`fetchVendorOverviewData`) was five rounds: own reads →
 *     the reply owed → six admin desk reads that need only the shop's id → the
 *     event meta → the couple's first message;
 *   · what the shop owes Setnayan (`fetchDueFeeBills`) and the fee gate
 *     (`resolveFeeEnforcement`) started only after all of that.
 *
 * Now: one sign-in check; own and admin desk reads start together, the reply
 * owed and the first message share a round, and the fee reads start beside the
 * desk. The property held here is the DEPTH — what the supplier waits for —
 * and the single auth request per view.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

type View = { calls: number; depth: number; ms: number; steps: string[]; repeats: string[]; authReads: number };
type Report = { page: View; layoutAndPage: View };

const WEB = join(__dirname, '..');

function measure(): Report {
  const out = execFileSync(join(WEB, '..', '..', 'node_modules', '.bin', 'tsx'), [join(WEB, 'app', 'vendor-dashboard', 'today-page-reads.harness.ts')], {
    cwd: WEB,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_OPTIONS: '', TODAY_PAGE_READS_DELAY_MS: '3' },
    timeout: 180_000,
  });
  const line = out.split('\n').find((l) => l.startsWith('TODAY_PAGE_READS '));
  assert.ok(line, `the harness printed no report:\n${out.slice(-2000)}`);
  return JSON.parse(line.slice('TODAY_PAGE_READS '.length)) as Report;
}

const REPORT = measure();
const shape = (v: View) => `${v.calls} requests, ${v.depth} deep\n  ${v.steps.join('\n  ')}`;

test('0 · the fixture reached the desk — or the depth below would be about nothing', () => {
  const all = REPORT.page.steps.join('\n');
  for (const read of ['chat_threads', 'chat_messages', '[service] events']) {
    assert.ok(all.includes(read), `the fixture never made Today read ${read}:\n${shape(REPORT.page)}`);
  }
});

test('1 · one view asks the auth server once — the layout and the page share the answer', () => {
  assert.equal(REPORT.layoutAndPage.authReads, 1, `Today asks who the supplier is more than once:\n${shape(REPORT.layoutAndPage)}`);
});

/** sign-in → the shop row → its role → the desk (own + admin together) → the lock asks' second step → the reply owed
 *  and the first message → the event meta → wave 2. MEASURED: 10 deep before (11 with the layout), 8 after. */
const TODAY_MAX_DEPTH = 8;

test(`2 · Today is at most ${TODAY_MAX_DEPTH} trips deep, alone and beside its layout (it was 10 and 11)`, () => {
  assert.ok(REPORT.page.depth <= TODAY_MAX_DEPTH, `Today waits on reads one after another again:\n${shape(REPORT.page)}`);
  assert.ok(REPORT.layoutAndPage.depth <= TODAY_MAX_DEPTH, `Today with its layout waits longer than the page alone:\n${shape(REPORT.layoutAndPage)}`);
});

test('3 · the admin desk reads leave in the same round as the threads', () => {
  const at = (what: RegExp) => REPORT.page.steps.find((s) => what.test(s))?.split(' ')[0];
  const threads = at(/ chat_threads\(/);
  const dateAsks = at(/\[service\] event_date_change_answers\(/);
  assert.ok(threads && dateAsks, `the fixture lost a read:\n${shape(REPORT.page)}`);
  assert.equal(dateAsks, threads, `the admin desk reads wait for the own-session reads again:\n${shape(REPORT.page)}`);
});
