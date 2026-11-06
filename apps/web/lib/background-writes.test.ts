/**
 * background-writes.test.ts — A DEV SERVER POINTED AT PRODUCTION WRITES
 * NOTHING IN THE BACKGROUND (2026-10-13, guest-load fix; lib/background-writes.ts).
 *
 *   1 · the rule: production deployment only — not `next dev`, not a preview,
 *       not a local `next start`, not a test;
 *   2 · the three writers ask it FIRST, before they build a client: the
 *       periodic-job claim (every job goes through it), the fault record and
 *       the telemetry counts;
 *   3 · executed: outside production a claim is refused without a request.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { backgroundWritesAllowed } from './background-writes';
import { stripComments } from './strip-comments';

test('1 · only Vercel’s production deployment', () => {
  assert.equal(backgroundWritesAllowed({ NODE_ENV: 'production', VERCEL_ENV: 'production' }), true);
  assert.equal(backgroundWritesAllowed({ NODE_ENV: 'development' }), false, 'next dev on the Mac');
  assert.equal(backgroundWritesAllowed({ NODE_ENV: 'development', VERCEL_ENV: 'production' }), false);
  assert.equal(backgroundWritesAllowed({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }), false, 'a preview shares the prod database');
  assert.equal(backgroundWritesAllowed({ NODE_ENV: 'production' }), false, 'a local next start');
  assert.equal(backgroundWritesAllowed({ NODE_ENV: 'test' }), false);
  assert.equal(backgroundWritesAllowed({}), false);
});

const src = (rel: string) => stripComments(readFileSync(join(__dirname, rel), 'utf8'));

function body(code: string, signature: string): string {
  const at = code.indexOf(signature);
  assert.ok(at >= 0, `${signature} is gone`);
  return code.slice(at, at + 900);
}

test('2 · every background writer asks first', () => {
  const jobs = src('periodic-jobs.ts');
  const claim = body(jobs, 'export async function claimPeriodicJob(');
  assert.ok(claim.indexOf('backgroundWritesAllowed()') > 0, 'claimPeriodicJob no longer asks — a dev server can claim a production job window');
  assert.ok(claim.indexOf('backgroundWritesAllowed()') < claim.indexOf("rpc('claim_periodic_job'"));
  // Every job is claimed through runClaimedJob → claimPeriodicJob; nothing else calls the RPC.
  assert.equal((jobs.match(/claim_periodic_job/g) ?? []).length, 1);

  const faults = src(join('telemetry', 'fault-log.ts'));
  const record = body(faults, 'export async function recordFault(');
  assert.ok(record.indexOf('backgroundWritesAllowed()') > 0, 'recordFault no longer asks — dev errors land in the owner’s Problems list');
  assert.ok(record.indexOf('backgroundWritesAllowed()') < record.indexOf('createAdminClient()'));
  const counts = body(faults, 'export async function bumpActionCounts(');
  assert.ok(counts.indexOf('backgroundWritesAllowed()') > 0 && counts.indexOf('backgroundWritesAllowed()') < counts.indexOf('createAdminClient()'));
});

test('3 · outside production a job claim is refused without a request', async () => {
  // NODE_ENV is unset in a test, as in a script: the claim must say no before it builds a client.
  const sent: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    sent.push(String(input));
    return new Response('true', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://db.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
  try {
    const Module = require('node:module') as { _resolveFilename: (r: string, ...a: unknown[]) => string };
    const resolve = Module._resolveFilename;
    Module._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
      if (request === 'server-only') return join(__dirname, 'guest-page-reads.empty.cjs');
      return resolve.call(this, request, ...rest);
    };
    const { claimPeriodicJob } = require('./periodic-jobs') as typeof import('./periodic-jobs');
    Module._resolveFilename = resolve;
    assert.equal(await claimPeriodicJob('test-job', 60_000), false);
    assert.deepEqual(sent, [], 'a request left for claim_periodic_job outside production');
  } finally {
    globalThis.fetch = realFetch;
  }
});
