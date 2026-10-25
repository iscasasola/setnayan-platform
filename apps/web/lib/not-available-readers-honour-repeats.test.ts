/**
 * EVERY READER OF "NOT AVAILABLE" HONOURS REPEATS AND HOURS (owner 2026-10-14 ✅ "APPROVE": repeating blocks + hour
 * ranges; DECISION_LOG 🏛 halls) — the TypeScript half. The SQL half (the booking path, the bench, the couple's busy
 * bit) is proved by behaviour in `tests/db/not-available-repeats-and-hours.db.test.ts`.
 *
 *   1 · A READER CANNOT MISS A REPEAT. A repeat's stored range is its FIRST day; a read that filters
 *       `blocked_until >= <window>` drops every repeat that began before the window — the parish's "every Sunday
 *       morning" since September vanishes from October. So every file that reads `vendor_calendar_blocks` must ask
 *       the one rule (`lib/not-available.ts`) and may not filter `blocked_until` from below.
 *   2 · THE RULE ITSELF (pure): repeats, ends, hours, words.
 *   3 · EXACT TIME SLOTS ARE ON EVERY PLAN (owner 🧑‍🤝‍🧑 call 3) — no plan is refused, no Enterprise words remain.
 *   4 · A CARD ON HALLS RESOLVES TO EVERY HALL (🏛) — the lock's resolver reads the card's halls.
 *
 * Sabotage (2026-10-14): a reader re-written with `.gte('blocked_until', …)` → 1 red; `blockOnDay` answering only the
 * range → 2 red; `canPlotTimeSlots` back to Enterprise → 3 red; the halls read removed from the resolver → 4 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  blockClosesDay,
  blockOnDay,
  blockTakesPartOfDay,
  closedDaysIn,
  dayPartMeetsTime,
  repeatOptions,
  repeatWords,
} from './not-available';
import { canPlotTimeSlots } from './vendor-tier-caps';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(abs);
  }
  return out;
}

/** Readers allowed without the rule — each with the reason it can never misjudge a repeat. */
const ALLOWED: Record<string, string> = {
  'app/api/admin/demo/seed/route.ts': 'writes demo one-off blocks; never reads one back',
};

// A reader is EITHER a direct `.from('vendor_calendar_blocks')` OR an EMBEDDED `vendor_calendar_blocks(...)` inside
// another table's select (supplier batch walk W2: Today read the blocks embedded under `vendor_schedule_pools` and
// this guard, matching only `.from(...)`, could not see it).
const READS_BLOCKS = /\.from\(\s*['"`]vendor_calendar_blocks['"`]\s*\)|\bvendor_calendar_blocks\s*\(/;
/** `blocked_until` filtered from below — direct, or through the embed's dotted path. */
const FILTERS_FROM_BELOW = /\.gte?\(\s*['"`](?:vendor_calendar_blocks\.)?blocked_until['"`]/;

test('1 · every reader of vendor_calendar_blocks asks the one rule and never filters blocked_until from below', () => {
  const readers: string[] = [];
  const bad: string[] = [];
  for (const abs of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const src = stripComments(readFileSync(abs, 'utf8'));
    if (!READS_BLOCKS.test(src)) continue;
    const rel = relative(WEB, abs);
    readers.push(rel);
    if (ALLOWED[rel]) continue;
    if (!/from ['"](?:@\/lib\/|\.\/|\.\.\/)*not-available['"]/.test(src)) bad.push(`${rel}: reads the blocks without lib/not-available`);
    if (FILTERS_FROM_BELOW.test(src)) bad.push(`${rel}: filters blocked_until from below — every repeat that began earlier is dropped`);
  }
  assert.deepEqual(bad, []);
  // Not vacuous: the readers this file was written against are all still found.
  for (const must of ['lib/vendor-availability.ts', 'lib/vendor-schedule.ts', 'lib/vendor-waitlist.ts', 'app/v/[slug]/page.tsx', 'app/vendor-dashboard/invite/date-status-actions.ts', 'lib/supplier-today.server.ts']) {
    assert.ok(readers.includes(must), `${must} no longer reads the blocks — re-derive this guard`);
  }
  assert.ok(readers.length >= 9, `only ${readers.length} readers found — the scan is blind`);
});

test('1b · the supplier month and day ask the rule, never a bare range', () => {
  for (const f of ['lib/vendor-customers.ts', 'lib/vendor-dates.ts']) {
    const src = stripComments(readFileSync(join(WEB, f), 'utf8'));
    assert.match(src, /blockOnDay\(/, `${f} decides a block's days without the rule`);
    assert.doesNotMatch(src, /\.startDate <= (?:day|date) && \w+\.endDate >= (?:day|date)/, `${f} reads a block as a bare range again`);
  }
  const page = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/customers/page.tsx'), 'utf8'));
  assert.doesNotMatch(page, /const covers = \(b: \{ startDate: string; endDate: string \}\)/, 'the day screen decides a block’s days by its range again');
  assert.match(page, /dayGroupsOf\(day,/, 'the day screen does not build its groups through the rule');
});

test('2 · the rule: a weekly repeat covers its weekday from its first day; an end stops it; hours never close a day', () => {
  const sundayMornings = { startDate: '2026-09-06', endDate: '2026-09-06', repeat: 'weekly' as const, dayPart: 'morning' as const };
  assert.equal(blockOnDay(sundayMornings, '2026-10-11'), true);
  assert.equal(blockOnDay(sundayMornings, '2026-10-12'), false);
  assert.equal(blockOnDay(sundayMornings, '2026-08-30'), false, 'a repeat covers a day before its first');
  assert.equal(blockClosesDay(sundayMornings, '2026-10-11'), false, 'a morning closed the whole day');
  assert.equal(blockTakesPartOfDay(sundayMornings, '2026-10-11'), true);
  const retreat = { startDate: '2026-10-05', endDate: '2026-10-05', repeat: 'daily' as const, repeatUntil: '2026-10-07' };
  assert.deepEqual(closedDaysIn(retreat, '2026-10-01', '2026-10-31'), ['2026-10-05', '2026-10-06', '2026-10-07']);
  const weekends = { startDate: '2026-10-01', endDate: '2026-10-01', repeat: 'weekend' as const };
  assert.deepEqual(closedDaysIn(weekends, '2026-10-01', '2026-10-07'), ['2026-10-03', '2026-10-04']);
  assert.deepEqual(closedDaysIn({ startDate: '2026-10-14', endDate: '2026-10-15' }, '2026-10-01', '2026-10-31'), ['2026-10-14', '2026-10-15'], 'a one-off is its range');
  // Hours: 10 AM meets the morning, 3 PM does not; a slot across noon meets both halves.
  assert.equal(dayPartMeetsTime('morning', '10:00', '11:00'), true);
  assert.equal(dayPartMeetsTime('morning', '15:00', '16:00'), false);
  assert.equal(dayPartMeetsTime('afternoon', '11:30', '12:30'), true);
  assert.equal(dayPartMeetsTime('evening', '17:00', '18:00'), false, 'a slot ending at 6 PM met the evening');
  assert.equal(dayPartMeetsTime('morning', null), false, 'a booking with no time was refused by hours');
  assert.equal(dayPartMeetsTime('all_day', null), true);
  // Words, as the sheet and the rows say them.
  assert.equal(repeatWords({ startDate: '2026-10-11', repeat: 'weekly' }), 'Every Sunday');
  assert.equal(repeatWords({ startDate: '2026-10-11', repeat: 'weekend' }), 'Every Saturday and Sunday');
  assert.deepEqual(repeatOptions('2026-10-11').map((o) => o.label), ['Just these days', 'Every Sunday', 'Every Saturday and Sunday', 'Every day']);
});

test('3 · exact time slots are on every plan — no plan is refused, no Enterprise gate or word remains', () => {
  for (const tier of ['free', 'verified', 'solo', 'pro', 'enterprise', 'custom', null]) assert.equal(canPlotTimeSlots(tier), true, `${tier} may not plot slots`);
  const actions = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/services/actions.ts'), 'utf8'));
  assert.doesNotMatch(actions, /Time slots are an Enterprise feature|assertCanPlotSlots/, 'adding a slot is still gated on Enterprise');
  const manager = readFileSync(join(WEB, 'app/vendor-dashboard/services/_components/services-manager.tsx'), 'utf8');
  assert.doesNotMatch(manager, /Time slots \(Enterprise\)|Time slots are an Enterprise feature/, 'the slot editor still says Enterprise');
});

test('4 · a card on halls resolves to every hall it uses (owner 2026-10-14 🏛)', () => {
  const src = stripComments(readFileSync(join(WEB, 'lib/schedule-pools.ts'), 'utf8'));
  assert.match(src, /\.from\('vendor_service_halls'\)\.select\('pool_id'\)\.eq\('vendor_service_id', serviceId\)/, 'the lock no longer reads a card’s halls');
  assert.match(src, /if \(halls\.length > 0\) \{\s*for \(const h of halls\) poolIds\.add\(h\);\s*\} else if \(namedCalendars\)/, 'a card on halls is not on EXACTLY its halls');
});
