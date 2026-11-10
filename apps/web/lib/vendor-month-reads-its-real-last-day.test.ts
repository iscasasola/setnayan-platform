/**
 * 📅 A MONTH READ ENDS ON THE MONTH'S REAL LAST DAY — AND A REFUSED READ IS NEVER A FREE MONTH (G7, Build 5, 10 Nov 2026).
 *
 * Seen in production (Vercel runtime errors, 17 since 4 Sep): `vendor_calendar_day_states` 400
 * `date out of range: "2026-11-31"` on /vendor-dashboard/customers. Every month read asked `${month}-01` → `${month}-31`;
 * Postgres refuses the 31st of a 30-day month (and the 29th–31st of February), and `fetchVendorDayStates` turned the
 * refusal into `[]` — so April, June, September, November and every February drew with no held / approve-first day,
 * i.e. as free, to a supplier who had held them.
 *
 * Held here:
 *   1. `monthDayRange` gives each month its real last day — Feb 28 / Feb 29 (leap), Apr 30, Nov 30, Dec 31.
 *   2. The month read asks exactly that range (a fake client records the `lte`).
 *   3. A refused read is NULL, never `[]`, and the month / day screens say so.
 *   4. No source file builds a month's end by gluing a fixed 29/30/31 onto a variable.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fetchVendorDayStates, fetchVendorMonthDayStates, monthDayRange } from './vendor-schedule';

test('each month ends on its real last day — Feb 28/29, Apr 30, Nov 30, Dec 31', () => {
  assert.deepEqual(monthDayRange('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(monthDayRange('2028-02'), { from: '2028-02-01', to: '2028-02-29' }, 'a leap February has its 29th');
  assert.deepEqual(monthDayRange('2026-04'), { from: '2026-04-01', to: '2026-04-30' });
  assert.deepEqual(monthDayRange('2026-11'), { from: '2026-11-01', to: '2026-11-30' }, 'the production 400: "2026-11-31"');
  assert.deepEqual(monthDayRange('2026-12'), { from: '2026-12-01', to: '2026-12-31' });
  assert.deepEqual(monthDayRange('2027-01'), { from: '2027-01-01', to: '2027-01-31' });
  for (const bad of ['2026-13', '2026-00', '2026-1', '2026-11-01', '', 'nov']) {
    assert.equal(monthDayRange(bad), null, `"${bad}" is not a month`);
  }
});

/** A Supabase stand-in: records the range it was asked, then resolves the way Supabase does — `{ data, error }`. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const asked: Record<string, string> = {};
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: (_c: string, v: string) => ((asked.from = v), chain),
    lte: (_c: string, v: string) => ((asked.to = v), chain),
    order: () => Promise.resolve(result),
  };
  return { client: { from: () => chain } as never, asked };
}

test('the month read asks the 1st to the real last day — never the 31st of November', async () => {
  for (const [month, last] of [['2026-11', '2026-11-30'], ['2026-02', '2026-02-28'], ['2028-02', '2028-02-29'], ['2026-04', '2026-04-30']] as const) {
    const { client, asked } = fakeClient({ data: [], error: null });
    const rows = await fetchVendorMonthDayStates(client, 'S89B-TEST', month);
    assert.deepEqual(rows, [], 'a read that succeeded with nothing held is an empty list');
    assert.deepEqual(asked, { from: `${month}-01`, to: last });
  }
});

test('a refused day-state read is NULL — never [] (which draws every day free)', async () => {
  const refused = { data: null, error: { code: '22008', message: 'date/time field value out of range: "2026-11-31"' } };
  assert.equal(await fetchVendorDayStates(fakeClient(refused).client, 'S89B-TEST', '2026-11-01', '2026-11-30'), null);
  assert.equal(await fetchVendorMonthDayStates(fakeClient(refused).client, 'S89B-TEST', '2026-11'), null);
  // Not a month at all: nothing is asked, and nothing is claimed.
  assert.equal(await fetchVendorMonthDayStates(fakeClient({ data: [], error: null }).client, 'S89B-TEST', '2026-11-31'), null);
});

const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
const src = (rel: string) => code(readFileSync(rel, 'utf8'));

test('the screens say a refused month or day — never draw it as free', () => {
  const page = src('app/vendor-dashboard/customers/page.tsx');
  const actions = src('app/vendor-dashboard/customers/actions.ts');
  const calendar = src('app/vendor-dashboard/customers/_components/customers-calendar.tsx');
  // The month's first paint hands the read's outcome to the calendar…
  assert.match(page, /fetchVendorMonthDayStates\(supabase, vendorProfileId, month\)/, 'the month read is not the real-last-day read');
  assert.match(page, /initialDayStatesRead: monthDayStates !== null/, 'the first-painted month does not know its day states were refused');
  // …a month paged to says it too…
  assert.equal((actions.match(/fetchVendorMonthDayStates\(supabase, vendorProfileId, month\)/g) ?? []).length, 2, 'a month action read is not the real-last-day read');
  assert.match(actions, /dayStatesRead: dayStates !== null/, 'a paged-to month does not say its day states were refused');
  assert.match(actions, /if \(dayStates === null\) return null;/, "the Schedule page's month draws refused held days as free");
  // …and the calendar says it on screen.
  assert.match(calendar, /const dayStatesUnread = monthInputs\.get\(month\)\?\.dayStatesRead === false;/);
  assert.match(calendar, /\{dayStatesUnread \? \([\s\S]{0,200}couldn&rsquo;t load/, 'a refused month is drawn without a word');
  // The one day: its hold read refused is said over the day.
  assert.match(page, /\{dayStates === null \? \([\s\S]{0,200}couldn&rsquo;t load/, 'a refused day is drawn without a word');
  // The read itself: no `[]` on error.
  const lib = src('lib/vendor-schedule.ts');
  const body = lib.slice(lib.indexOf('export async function fetchVendorDayStates('), lib.indexOf('export async function fetchVendorMonthDayStates('));
  assert.doesNotMatch(body, /if \(error \|\| !data\) return \[\];/, 'the refusal is back to an empty list');
});

test('no source builds a month end from a fixed 29/30/31 glued onto a variable', () => {
  const files = execSync("git ls-files -- 'app/**/*.ts' 'app/**/*.tsx' 'lib/**/*.ts' 'lib/**/*.tsx' ':!**/*.test.ts' ':!**/*.test.tsx'", {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);
  assert.ok(files.length > 100, 'the guard found nothing to scan — its file list is stale');
  const offenders: string[] = [];
  for (const f of files) {
    const s = src(f);
    // `${month}-31` · `${y}-${m}-30` · month + '-31'
    if (/\$\{[^}`]*\}-(29|30|31)`/.test(s) || /\+\s*['"]-(29|30|31)['"]/.test(s)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], 'a month end hard-coded to a day — use monthDayRange / lastDayOf (Postgres refuses "2026-11-31")');
});
