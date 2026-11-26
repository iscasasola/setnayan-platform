/**
 * SW-TELE (final check 25 Nov: A6-B04 · A8·P-B-2) — the fault reporter never answers 500 for a report the deployment
 * keeps no copy of by design, and still answers 500 when production fails to store one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { faultIngestAnswer } from './ingest-shape';
import { backgroundWritesAllowed } from '@/lib/background-writes';

test('a stored fault answers 201 with its id', () => {
  assert.deepEqual(faultIngestAnswer('log-1', true), { status: 201, body: { ok: true, id: 'log-1' }, log: false });
});

test('a preview or dev server (no fault writes by design) answers 202, not stored — never a 500', () => {
  assert.equal(backgroundWritesAllowed({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }), false);
  const a = faultIngestAnswer(null, backgroundWritesAllowed({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }));
  assert.equal(a.status, 202);
  assert.deepEqual(a.body, { ok: true, recorded: false });
});

test('production that fails to store a fault answers 202, not 5xx — and asks the route to log it', () => {
  const a = faultIngestAnswer(null, backgroundWritesAllowed({ NODE_ENV: 'production', VERCEL_ENV: 'production' }));
  assert.equal(a.status, 202);
  assert.ok(a.status < 500);
  assert.deepEqual(a.body, { ok: false, recorded: false, error: 'insert_failed' });
  assert.equal(a.log, true);
});

test('no answer the fault door gives is ever a 5xx', () => {
  for (const id of ['x', null]) for (const w of [true, false]) assert.ok(faultIngestAnswer(id, w).status < 500);
});

test('the route answers through faultIngestAnswer, with the same writes rule recordFault uses', () => {
  const src = readFileSync(join(__dirname, '../../app/api/telemetry/client-fault/route.ts'), 'utf8');
  assert.match(src, /faultIngestAnswer\(await recordFault\(shaped\.record\), backgroundWritesAllowed\(\)\)/);
  assert.doesNotMatch(src, /status: 500/);
  assert.match(src, /if \(answer\.log\) console\.error\(/);
});
