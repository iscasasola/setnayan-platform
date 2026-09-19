/**
 * s41c-admin-reads-are-honest.test.ts — S41c, the ADMIN/OPS tier of the
 * `result-dropped-silently` class from S26's both-ends baseline (#5625).
 *
 * ── The disease ─────────────────────────────────────────────────────────────
 * Fourteen sites across this tier read a Supabase `{ data, error }` result and
 * branched on `error` (or `error || !data`) as a bare boolean — the branch it
 * took recorded nothing: no log, no throw, no reference to the reason. A
 * REFUSED read then renders (or behaves) identically to a legitimately EMPTY
 * one; nobody downstream — not the admin console, not Vercel logs, not
 * Sentry — can tell "we couldn't check" from "there is nothing there".
 *
 * All fourteen sites here are ADMIN/OPS internals (cron jobs, admin-console
 * reads, feature-flag/config reads with a documented fallback default,
 * telemetry writes), so every fix is shape 1 — log-only via the shared
 * `logQueryError` helper (`lib/supabase/error-detect.ts`) or, in
 * `lib/telemetry/fault-log.ts`, the same helper used directly (that file IS
 * part of the logging/audit-trail mechanism, so a discarded error there is
 * doubly ironic). None of the fallback DEFAULT VALUES changed — only that the
 * refusal now leaves a trace.
 *
 * ── Two proof shapes below ──────────────────────────────────────────────────
 * 1. FUNCTIONAL — the three sites whose function takes an injected
 *    `SupabaseClient` parameter (`fetchPlatformSettings`,
 *    `fetchVendorValidateContacts`, `fetchFirstLookConfig`) get a stub client
 *    that returns `{ data: null, error }`, and the test asserts
 *    `console.error` was actually called with that error AND that the
 *    function still returns its documented fallback (the fix must never
 *    change fallback behaviour, only add the trace).
 * 2. SOURCE-ASSERTION — the remaining eleven sites either construct their own
 *    client via `createAdminClient()` internally (not injectable), are
 *    wrapped in `unstable_cache`, or — `lib/demand-radar.ts` — open with
 *    `import 'server-only'`, which this repo's test runner cannot resolve at
 *    all (no `server-only` package is installed; Next aliases it at build
 *    time — see `lib/vendor-card-copy.test.ts`'s docblock for the same
 *    constraint). For these the test reads the stripped source and asserts a
 *    `logQueryError(` call sits at the exact call site that used to discard
 *    `error` silently — mirroring the pattern used by
 *    `app/vendor-dashboard/reads-are-honest.test.ts` and
 *    `lib/deposit-refusal-history.test.ts`.
 *
 * 🛡 Sabotage-checked locally: each functional assertion was confirmed RED by
 * temporarily reverting its fix, and the count in every source-assertion
 * `matchAll` was checked to be exactly the number of call sites the finding
 * named (never just "greater than zero" — see MEMORY.md "a guard window
 * anchored on the first match faces the wrong cell").
 */
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

import { fetchPlatformSettings, fetchVendorValidateContacts } from '@/lib/platform-settings';
import { fetchFirstLookConfig } from '@/lib/firstlook';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ---------------------------------------------------------------------------
// 1. FUNCTIONAL — injected-client sites
// ---------------------------------------------------------------------------

/** A chainable Supabase query-builder stub returning one fixed result. */
function chainStub(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const self = new Proxy(chain, {
    get(_target, prop) {
      if (prop === 'then') return undefined; // not thenable — tests always terminate the chain explicitly
      if (prop === 'maybeSingle' || prop === 'single') return async () => result;
      return () => self;
    },
  });
  return self;
}

test('fetchPlatformSettings logs a refused read and still returns the safe FALLBACK', async () => {
  const dbError = { code: '42P01', message: 'relation "platform_settings" does not exist' };
  const errorCalls: unknown[][] = [];
  const restore = mock.method(console, 'error', (...args: unknown[]) => {
    errorCalls.push(args);
  });
  try {
    const stubClient = { from: () => chainStub({ data: null, error: dbError }) } as never;
    const row = await fetchPlatformSettings(stubClient);
    assert.equal(row.business_name, 'Setnayan', 'fallback default must be unchanged');
    const hit = errorCalls.find((args) =>
      String(args[0]).includes('platform-settings: fetchPlatformSettings'),
    );
    assert.ok(hit, `expected a console.error mentioning the call site; got ${JSON.stringify(errorCalls)}`);
  } finally {
    restore.mock.restore();
  }
});

test('fetchVendorValidateContacts logs a refused read and still returns the documented default email', async () => {
  const dbError = { code: '42703', message: 'column "vendor_validate_email" does not exist' };
  const errorCalls: unknown[][] = [];
  const restore = mock.method(console, 'error', (...args: unknown[]) => {
    errorCalls.push(args);
  });
  try {
    const stubClient = { from: () => chainStub({ data: null, error: dbError }) } as never;
    const contacts = await fetchVendorValidateContacts(stubClient);
    assert.equal(contacts.vendor_validate_email, 'verify@setnayan.com');
    const hit = errorCalls.find((args) =>
      String(args[0]).includes('platform-settings: fetchVendorValidateContacts'),
    );
    assert.ok(hit, `expected a console.error mentioning the call site; got ${JSON.stringify(errorCalls)}`);
  } finally {
    restore.mock.restore();
  }
});

test('fetchFirstLookConfig logs a refused read and still returns FIRSTLOOK_DEFAULTS', async () => {
  const dbError = { code: '42703', message: 'column "firstlook_sla_hours" does not exist' };
  const errorCalls: unknown[][] = [];
  const restore = mock.method(console, 'error', (...args: unknown[]) => {
    errorCalls.push(args);
  });
  try {
    const stubClient = { from: () => chainStub({ data: null, error: dbError }) } as never;
    const cfg = await fetchFirstLookConfig(stubClient);
    assert.equal(cfg.slaHours, 24);
    assert.equal(cfg.boostWeight, 0.1);
    const hit = errorCalls.find((args) => String(args[0]).includes('firstlook: platform_settings'));
    assert.ok(hit, `expected a console.error mentioning the call site; got ${JSON.stringify(errorCalls)}`);
  } finally {
    restore.mock.restore();
  }
});

// ---------------------------------------------------------------------------
// 2. SOURCE-ASSERTION — internal-admin-client / unstable_cache-wrapped /
//    `import 'server-only'` sites (cannot be imported by this test runner)
// ---------------------------------------------------------------------------

test('getAdminDemandRadar logs a refused RPC before falling back to EMPTY_RADAR', () => {
  const s = src('lib/demand-radar.ts');
  assert.match(
    s,
    /export async function getAdminDemandRadar\([\s\S]{0,200}?if \(error\) \{\s*logQueryError\('demand-radar: demand_radar_admin', error\);\s*return EMPTY_RADAR;/,
  );
  // The vendor-facing sibling was out of scope for THIS batch and pinned as
  // "unchanged" — then S41c batch B (#5699) deliberately made it honest: a
  // refused RPC now logs AND returns DEMAND_RADAR_UNREADABLE instead of
  // EMPTY_RADAR, so the supplier's card can say "couldn't load" rather than
  // "not enough data yet". Assert that stronger property instead of the old
  // phrasing: the error branch logs and returns the sentinel, never EMPTY_RADAR.
  const vendorBody = s.slice(s.indexOf('export async function getVendorDemandRadar'), s.indexOf('export async function getAdminDemandRadar'));
  assert.match(vendorBody, /if \(error\) \{[\s\S]*?\[supabase-error\][\s\S]*?return DEMAND_RADAR_UNREADABLE;/, 'a refused vendor radar RPC must log and return the unreadable sentinel');
  assert.doesNotMatch(vendorBody, /if \(error[^)]*\)[^{;]*return EMPTY_RADAR;/, 'a refused vendor radar RPC must never read as an empty radar');
});

test('the NPC data-sheet page logs both count reads it used to discard (countOf + activeFaceCount)', () => {
  const s = src('app/admin/compliance/data-sheet/page.tsx');
  assert.match(
    s,
    /const countOf = async[\s\S]*?if \(error\) \{\s*logQueryError\(/,
    'countOf(table) must log before returning null on a refused count',
  );
  assert.match(
    s,
    /const activeFaceCount = async[\s\S]*?if \(error\) \{\s*logQueryError\(/,
    'activeFaceCount() must log before returning null on a refused count',
  );
  // The pre-existing honest-render state for platform_compliance_facts
  // (factsError → <ErrorState>, propagated to ConsoleTable's readError) must
  // still be intact — this fix only adds the missing trace on the two counts.
  assert.match(s, /const factsError = factsRes\.error \?\? null;/);
  assert.match(s, /readError=\{factsError\}/);
});

test('auto-recap logs the patiktok_render_jobs read it used to discard, without changing the graceful-degrade default', () => {
  const s = src('lib/auto-recap.ts');
  assert.match(
    s,
    /\.from\('patiktok_render_jobs'\)[\s\S]{0,400}?if \(error\) \{\s*logQueryError\('auto-recap: patiktok_render_jobs', error/,
  );
  // Still degrades to no reels on error — the recap page must never throw.
  assert.match(s, /if \(!error && data\) \{/);
});

test('brand-settings and loader-settings log their platform_settings refusal without changing the built-in fallback', () => {
  const brand = src('lib/brand-settings.ts');
  assert.match(
    brand,
    /\.from\('platform_settings'\)[\s\S]{0,200}?if \(error\) \{\s*logQueryError\('brand-settings: platform_settings', error\);\s*return FALLBACK;/,
  );
  const loader = src('lib/loader-settings.ts');
  assert.match(
    loader,
    /\.from\('platform_settings'\)[\s\S]{0,200}?if \(error\) \{\s*logQueryError\('loader-settings: platform_settings', error\);\s*return DEFAULT_LOADER_CONFIG;/,
  );
});

test('every daily-email-jobs.ts lock-insert logs an UNEXPECTED failure but stays silent on the expected 23505 (already sent)', () => {
  const s = src('lib/daily-email-jobs.ts');
  const tables = [
    'anniversary_email_log',
    'anniversary_headsup_log',
    'godchild_reminder_log',
    'renewal_reminder_log',
  ];
  for (const table of tables) {
    const re = new RegExp(
      `\\.from\\('${table}'\\)[\\s\\S]{0,60}?\\.insert\\([\\s\\S]{0,200}?if \\(lockErr\\) \\{[\\s\\S]{0,300}?if \\(lockErr\\.code !== '23505'\\) \\{[\\s\\S]{0,200}?logQueryError\\('daily-email-jobs: ${table} lock insert'`,
    );
    assert.match(s, re, `${table} insert must log a non-23505 lockErr before continuing`);
  }
});

test('demo-sessions logs every failed insert attempt (collisions are not an expected path here)', () => {
  const s = src('lib/demo-sessions.ts');
  assert.match(
    s,
    /\.from\('demo_sessions'\)[\s\S]{0,400}?if \(error\) \{\s*[\s\S]{0,300}?logQueryError\('demo-sessions: demo_sessions insert', error/,
  );
});

test('telemetry/fault-log.ts logs both its insert and its update — the mechanism must not silently drop its own audit trail', () => {
  const s = src('lib/telemetry/fault-log.ts');
  assert.match(
    s,
    /\.insert\(\{[\s\S]{0,400}?if \(error\) \{\s*[\s\S]{0,200}?logQueryError\('lib\/telemetry\/fault-log\.ts: app_telemetry_logs insert', error\);/,
  );
  assert.match(
    s,
    /\.update\(\{[\s\S]{0,400}?if \(error\) \{\s*logQueryError\('lib\/telemetry\/fault-log\.ts: app_telemetry_logs update', error/,
  );
});
