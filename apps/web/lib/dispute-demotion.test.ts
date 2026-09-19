import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { reconcileDisputeCount } from './dispute-demotion';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const ROUTE = 'app/api/admin/cron/dispute-counter/route.ts';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ── the decision, executed ────────────────────────────────────────────────

test('the database count decides, and agreement is not assumed', () => {
  const agree = reconcileDisputeCount({ scanned: 3, authoritative: 3, threshold: 3 });
  assert.deepEqual(agree, { ok: true, count: 3, demote: true, disagreed: false });

  // The scan said demote; the database said no. The database wins, and the
  // disagreement is reported rather than folded into either answer.
  const dbSaysLess = reconcileDisputeCount({ scanned: 3, authoritative: 2, threshold: 3 });
  assert.deepEqual(dbSaysLess, { ok: true, count: 2, demote: false, disagreed: true });

  // The reverse: the scan under-counted. Still the database's number.
  const dbSaysMore = reconcileDisputeCount({ scanned: 2, authoritative: 5, threshold: 3 });
  assert.deepEqual(dbSaysMore, { ok: true, count: 5, demote: true, disagreed: true });
});

test('PostgREST returning an integer as a string is still a count', () => {
  assert.deepEqual(reconcileDisputeCount({ scanned: 4, authoritative: '4', threshold: 3 }), {
    ok: true,
    count: 4,
    demote: true,
    disagreed: false,
  });
});

test('a non-count is a FAULT, never a zero and never a demotion', () => {
  for (const bad of [null, undefined, '', 'three', -1, 2.5, Number.NaN, {}, [3]]) {
    const v = reconcileDisputeCount({ scanned: 3, authoritative: bad, threshold: 3 });
    assert.equal(v.ok, false, `${JSON.stringify(bad)} was accepted as a count`);
    if (!v.ok) assert.match(v.reason, /not a count/);
  }
  const t = reconcileDisputeCount({ scanned: 3, authoritative: 3, threshold: 0 });
  assert.equal(t.ok, false, 'a threshold of 0 would demote everyone');
});

// ── the route really calls the helper, in the right order ────────────────

test('the cron asks count_vendor_disputes_30d before it demotes, and reads the answer', () => {
  const src = read(ROUTE);
  const rpcCalls = src.match(/admin\.rpc\(\s*'count_vendor_disputes_30d'/g) ?? [];
  console.log(`# dispute-counter: ${rpcCalls.length} call(s) to count_vendor_disputes_30d`);
  assert.equal(rpcCalls.length, 1, 'the cron must ask the SQL count exactly once per candidate');

  const rpcAt = src.indexOf("admin.rpc(\n      'count_vendor_disputes_30d'");
  const reconcileAt = src.indexOf('reconcileDisputeCount(');
  const demoteAt = src.indexOf(".from('vendor_profiles')\n      .update(update)");
  assert.ok(rpcAt > -1 && reconcileAt > -1 && demoteAt > -1, 'an anchor moved — re-point, do not delete');
  assert.ok(rpcAt < reconcileAt && reconcileAt < demoteAt, 'the count must be reconciled BEFORE the demotion write');

  // The RPC's error is read, not discarded — a dropped result is the disease
  // the both-ends guard's result-dropped-silently class exists for.
  assert.match(src, /if \(countErr\) \{/, 'the RPC error is not handled');
  assert.match(src, /if \(!verdict\.ok\) \{/, 'a non-count from the RPC is not recorded');
  assert.match(src, /if \(verdict\.disagreed\) \{/, 'a scan/database disagreement is not recorded');
  // The scan's number never reaches the audit row or the email once the
  // database has answered.
  assert.match(src, /const count = verdict\.count;/, 'the demotion must read the DATABASE count');
});
