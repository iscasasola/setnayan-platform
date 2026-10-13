/**
 * csp-report-once.test.ts — A BURST OF CSP REPORTS IS ONE DATABASE WRITE
 * (2026-10-13, guest-load fix; lib/csp-report-once.ts has the story).
 *
 *   1 · a burst of 50 identical reports writes ONCE;
 *   2 · every DISTINCT block still writes (nothing the admin list needs is lost);
 *   3 · the same block writes again once the window has passed;
 *   4 · the memory is bounded, and past the bound it forgets (writes more, never fewer);
 *   5 · the route asks before it writes — the RPC call sits after the check.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MAX_REMEMBERED, RECORD_WINDOW_MS, cspReportKey, shouldRecordCspReport } from './csp-report-once';
import { stripComments } from './strip-comments';

const block = { directive: 'font-src', blockedOrigin: 'https://cdn.example.net', path: '/:slug' };

test('1 · a burst of 50 identical reports is one write', () => {
  const seen = new Map<string, number>();
  let writes = 0;
  for (let i = 0; i < 50; i++) if (shouldRecordCspReport(seen, cspReportKey(block), 1_000 + i)) writes++;
  assert.equal(writes, 1);
});

test('2 · every distinct block still writes', () => {
  const seen = new Map<string, number>();
  const blocks = [
    block,
    { ...block, directive: 'img-src' },
    { ...block, blockedOrigin: 'https://example.com' },
    { ...block, path: '/dashboard/:id' },
  ];
  assert.deepEqual(blocks.map((b) => shouldRecordCspReport(seen, cspReportKey(b), 5)), [true, true, true, true]);
});

test('3 · the same block writes again after the window', () => {
  const seen = new Map<string, number>();
  const key = cspReportKey(block);
  assert.equal(shouldRecordCspReport(seen, key, 0), true);
  assert.equal(shouldRecordCspReport(seen, key, RECORD_WINDOW_MS - 1), false);
  assert.equal(shouldRecordCspReport(seen, key, RECORD_WINDOW_MS), true);
});

test('4 · the memory is bounded and forgets past its bound', () => {
  const seen = new Map<string, number>();
  for (let i = 0; i < MAX_REMEMBERED * 3; i++) shouldRecordCspReport(seen, `k${i}`, 1);
  assert.ok(seen.size <= MAX_REMEMBERED);
});

test('5 · the route checks before it writes', () => {
  const route = stripComments(readFileSync(join(__dirname, '..', 'app', 'api', 'csp-report', 'route.ts'), 'utf8'));
  const check = route.indexOf('shouldRecordCspReport(');
  const write = route.indexOf("rpc('record_csp_violation'");
  assert.ok(check > 0, 'the route no longer asks whether this block was just written');
  assert.ok(write > check, 'the write happens before (or without) the check — one write per report again');
  assert.match(route, /if \(!shouldRecordCspReport\(.*\)\) return noContent\(\);/, 'a block already written no longer stops before the write');
});
