/** A8·H-11: the Growth CSV marks a failed read as `unread` with an errors row — never 0. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildDemoGrowthStats } from './growth-stats';
import { toCsv } from './growth-csv';

const lines = (csv: string) => csv.trim().split('\n');

test('a clean read writes the numbers and no errors row', () => {
  const csv = toCsv(buildDemoGrowthStats('6m'));
  assert.ok(!lines(csv).some((l) => l.startsWith('errors,')));
  assert.ok(!csv.includes('unread'));
});

test('failed population, conversion, growth and breakdown reads are written as unread, never 0', () => {
  const stats = buildDemoGrowthStats('6m');
  const key = stats.series[0]?.key ?? 'users';
  stats.errors = ['population totals', 'guest conversion', `${key} growth`, 'events by type and region'];
  const rows = lines(toCsv(stats));
  for (const e of stats.errors) assert.ok(rows.includes(`errors,could_not_read,,${e}`), `no errors row for ${e}`);
  for (const r of rows.filter((l) => l.startsWith('population,'))) assert.match(r, /,unread$/, r);
  for (const r of rows.filter((l) => l.startsWith('conversion,'))) assert.match(r, /,unread$/, r);
  assert.ok(!rows.some((l) => l.startsWith('conversion_cumulative,')), 'no conversion points over a failed read');
  const growth = rows.filter((l) => l.startsWith(`growth_cumulative,${key},`));
  assert.deepEqual(growth, [`growth_cumulative,${key},,unread`]);
  assert.ok(rows.includes('breakdown_events_by_type,,,unread'));
});
