/**
 * s41c-unclassified-batch-f-reads-are-honest.test.ts — S41c, UNCLASSIFIED
 * tier batch 1/2 (PR #5625's both-ends baseline, `result-dropped-silently`).
 *
 * 16 findings across 15 files, all sharing the same defect: a Supabase
 * `error` read only as an if/else condition whose branch records nothing — a
 * refused read leaves no log, no throw, no message. Two shapes fix it:
 *
 *   1. LOG-ONLY — the common case: the caller already fails closed correctly
 *      (an internal helper, an actions.ts/route.ts denial-by-absence), and
 *      the fix is one line that makes the error genuinely READ.
 *   2. HONEST RENDER STATE — `lib/coordinator-broadcasts-server.ts`'s
 *      `fetchLatestBroadcasts` fed the couple-facing day-of broadcast card,
 *      which rendered the exact same "No broadcast yet" copy whether the
 *      read was refused or genuinely empty. `BROADCASTS_UNREADABLE` is now a
 *      distinct sentinel, threaded through `BroadcastCardData.broadcastsMeasured`
 *      to a distinct "couldn't load" render.
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL — the render-order tests below assert
 * POSITION (the unreadable guard sits before the empty-state check), not just
 * that the right strings exist somewhere in the file, and the source scans
 * assert exact OCCURRENCE COUNTS rather than mere presence, per
 * [[green-shaped-nothing-five-costumes]] and [[a-guard-window-anchored-on-the-first-match-faces-the-wrong-cell]].
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';

/* ── `server-only` shim — same technique as
 * `app/dashboard/[eventId]/studio/papic/_components/guest-contributions-card`'s
 * S41 test: a bundler assertion with no runtime behaviour, resolved to an
 * empty module so modules that `import 'server-only'` can load under
 * `tsx --test`. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_s41c_batch_f__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

let broadcastsServer: typeof import('@/lib/coordinator-broadcasts-server');
let entitlements: typeof import('@/lib/entitlements');
let privacyControls: typeof import('@/lib/data-privacy-controls');
let honoreeLink: typeof import('@/lib/honoree-dependent-link');
before(async () => {
  broadcastsServer = await import('@/lib/coordinator-broadcasts-server');
  entitlements = await import('@/lib/entitlements');
  privacyControls = await import('@/lib/data-privacy-controls');
  honoreeLink = await import('@/lib/honoree-dependent-link');
});

/** A minimal chainable, thenable Supabase-builder stub. */
function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'in', 'is', 'not', 'order', 'limit', 'maybeSingle', 'rpc']) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder as unknown as SupabaseClient;
}

const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const orig = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = orig;
  }
};

/** Did `console.error` fire at least once while `fn` ran? */
async function logged(fn: () => Promise<unknown>): Promise<boolean> {
  let called = false;
  const orig = console.error;
  console.error = () => {
    called = true;
  };
  try {
    await fn();
  } finally {
    console.error = orig;
  }
  return called;
}

// ─── 1 · shape 2 — coordinator broadcasts: the distinct sentinel ──────────────

test('fetchLatestBroadcasts: a REFUSED read is BROADCASTS_UNREADABLE, and it logs', async () => {
  const client = stubClient({ data: null, error: { code: '42501', message: 'denied' } });
  let result: unknown;
  const wasLogged = await logged(async () => {
    result = await broadcastsServer.fetchLatestBroadcasts(client, 'evt_1', 3);
  });
  assert.equal(result, broadcastsServer.BROADCASTS_UNREADABLE);
  assert.ok(wasLogged, 'a refused broadcast read must log, not fail in silence');
});

test('fetchLatestBroadcasts: a genuine empty read is [], never the sentinel', async () => {
  const client = stubClient({ data: [], error: null });
  const result = await broadcastsServer.fetchLatestBroadcasts(client, 'evt_1', 3);
  assert.deepEqual(result, []);
  assert.notEqual(result, broadcastsServer.BROADCASTS_UNREADABLE);
});

// ─── 2 · shape 2 — render order: the unreadable guard faces the empty state ───

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('coordinator-broadcast-card.tsx: the unreadable guard sits BEFORE "No broadcast yet"', () => {
  const file = src('app/dashboard/[eventId]/_components/day-of-mode/coordinator-broadcast-card.tsx');
  const guardAt = file.indexOf('!broadcast.broadcastsMeasured');
  const emptyAt = file.indexOf('No broadcast yet — updates from the planning team');
  assert.ok(guardAt !== -1, 'the broadcastsMeasured guard must exist');
  assert.ok(emptyAt !== -1, 'the genuine-empty copy must still exist (not deleted)');
  assert.ok(
    guardAt < emptyAt,
    'a REFUSED read must be checked before the genuine-empty branch, or the empty copy runs first and the guard never fires',
  );
});

// ─── 3 · shape 1 — behavioural: log fires AND the existing fail-closed/fallback
//        behaviour is unchanged (the log must never become the new failure) ───

test('isDataPrivacyControlActiveWith: a refused read logs and still fails CLOSED', async () => {
  const admin = stubClient({ data: null, error: { code: '42501', message: 'denied' } });
  let active: boolean | undefined;
  const wasLogged = await logged(async () => {
    active = await privacyControls.isDataPrivacyControlActiveWith(admin, 'coordinator_day_of_broadcast');
  });
  assert.equal(active, false);
  assert.ok(wasLogged, 'a refused data_privacy_controls read must log');
});

test('fetchBundleComponents: a refused read logs and still falls back to BUNDLE_CHILD_SKUS', async () => {
  const supabase = stubClient({ data: null, error: { code: '42501', message: 'denied' } });
  let out: unknown;
  const wasLogged = await logged(async () => {
    out = await entitlements.fetchBundleComponents(supabase);
  });
  assert.deepEqual(out, entitlements.BUNDLE_CHILD_SKUS);
  assert.ok(wasLogged, 'a refused bundle_components read must log');
});

test('resolveHonoreeDependentId: a refused read logs and still drops the link (returns null)', async () => {
  const client = stubClient({ data: null, error: { code: '42501', message: 'denied' } });
  let out: unknown;
  const wasLogged = await logged(async () => {
    out = await honoreeLink.resolveHonoreeDependentId(client, {
      userId: 'user_1',
      dependentId: '11111111-2222-3333-4444-555555555555',
      honoreeLabel: 'Lola Nena',
    });
  });
  assert.equal(out, null);
  assert.ok(wasLogged, 'a refused dependents read must log');
});

// ─── 4 · shape 1 — source scans: exact occurrence counts, never mere presence ─

test('consent-veto.ts: BOTH from(src.table) call sites log — count is exactly 2', () => {
  const file = src('app/[slug]/_components/editorial/consent-veto.ts');
  const marker = '[supabase-error] app/[slug]/_components/editorial/consent-veto.ts';
  const count = file.split(marker).length - 1;
  assert.equal(count, 2, 'the S26 baseline finding for this file is count=2 — both call sites must log');
});

test('the remaining 9 shape-1 sites each carry exactly one [supabase-error] log at their read', () => {
  const sites: { file: string; needle: string }[] = [
    {
      file: 'app/[slug]/_components/editorial/data.ts',
      needle: '[supabase-error] app/[slug]/_components/editorial/data.ts · from:panood_broadcasts.select',
    },
    {
      file: 'app/[slug]/_lib/loaders.ts',
      needle: '[supabase-error] app/[slug]/_lib/loaders.ts · from:coordinator_broadcasts.select',
    },
    {
      file: 'app/auth/callback/route.ts',
      needle: '[supabase-error] app/auth/callback/route.ts · from:users.update',
    },
    {
      file: 'app/open-shop/actions.ts',
      needle: '[supabase-error] app/open-shop/actions.ts · from:dependents.select',
    },
    {
      file: 'app/panood/actions.ts',
      needle: '[supabase-error] app/panood/actions.ts · from:panood_camera_operators.select',
    },
    {
      file: 'app/u/_actions/audience-actions.ts',
      needle: '[supabase-error] app/u/_actions/audience-actions.ts · from:user_follows.delete',
    },
    {
      file: 'lib/alaala-wall-data.ts',
      needle: '[supabase-error] lib/alaala-wall-data.ts · from:people.select',
    },
    {
      file: 'lib/interconnect/verdicts.ts',
      needle: '[supabase-error] lib/interconnect/verdicts.ts · from:interconnection_probe_runs.select',
    },
    {
      file: 'lib/known-hash-match.ts',
      needle: '[supabase-error] lib/known-hash-match.ts · from:media_hash_checks.select',
    },
  ];
  const missing: string[] = [];
  for (const { file, needle } of sites) {
    const count = src(file).split(needle).length - 1;
    if (count !== 1) missing.push(`${file} (found ${count}, want 1)`);
  }
  assert.deepEqual(missing, [], `every site must log exactly once: ${missing.join(', ')}`);
});

test('faith-vocab.ts getFaithVocab: the error branch logs before falling back', () => {
  const file = src('lib/faith-vocab.ts');
  const readAt = file.indexOf(".from('faith_vocab')");
  const logAt = file.indexOf('[supabase-error] lib/faith-vocab.ts');
  const fallbackAt = file.indexOf('if (error || !data || data.length === 0) return [...FALLBACK_ITEMS];');
  assert.ok(readAt !== -1 && logAt !== -1 && fallbackAt !== -1, 'all three anchors must exist');
  assert.ok(
    readAt < logAt && logAt < fallbackAt,
    'the log must sit between the read and the fallback branch it explains',
  );
});
