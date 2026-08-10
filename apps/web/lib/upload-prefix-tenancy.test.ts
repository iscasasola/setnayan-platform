/**
 * SEC-1 lane #1 — the last item on the #3729 deferred presign list.
 *
 * Two halves: the pure shape rule (real assertions), and a repo scan that keeps
 * the rule honest as new upload surfaces ship.
 *
 * ⚠ WHY SHAPE-BASED AND NOT AN ALLOWLIST. `<FileUpload>` takes `pathPrefix` as a
 * PROP, so the caller set is open-ended — 57 files reference it and several pass
 * it through as a function parameter. An allowlist built by grep would be a
 * guess, and its failure mode is a **broken upload on a surface nobody tested**.
 * The shape rule fails the other way: a new `receipts/<eventId>` surface is
 * covered the day it ships, and a prefix with no id is simply not this module's
 * business.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tenancyForPathPrefix, isUuid, UPLOAD_TENANCY_REFUSAL } from './upload-prefix-tenancy';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const EVENT = '00000000-0000-4000-8000-00000000e001';
const ORDER = '7f3d1c2e-9a4b-4c8d-b1e5-2f6a8c0d4e91';

// ⚠ Both of these were REAL PROD EVENT IDS — including this one, which the
// test used as a THREAD id. Nothing noticed, because the resolver only ever
// looks at the SHAPE of the segment. That is the tidiest possible proof that a
// real row was never needed here.
const THREAD = '00000000-0000-4000-8000-00000000c4a7';

/* ═══════════════════════════════════════════════════════════════════════════
   1 · THE SHAPE RULE
   ═══════════════════════════════════════════════════════════════════════════ */

test('EVERY pathPrefix in the repo resolves to a kind the route can check', () => {
  // 🚨 THIS TEST USED TO BE A HAND-TYPED LIST OF SIX PREFIXES, and that is
  // exactly how `payments/<orderId>` shipped broken. It was never added to the
  // list, so the list stayed green while the real call site was refused every
  // single time. **Two hand-maintained things are not a guard; they drift
  // together.** It is now an actual scan of the source.
  //
  // What it enforces: every prefix a component actually passes must resolve to
  // a tenancy KIND the upload route knows how to verify. A new prefix family
  // whose id is neither an event, a thread nor an order will fail here — at
  // authoring time — instead of failing closed in a user's face with an upload
  // box that turns red and logs nothing.
  const roots = new Set();
  for (const dir of ['app', 'components', 'lib']) {
    const base = join(process.cwd(), dir);
    if (!existsSync(base)) continue;
    for (const file of walk(base)) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/pathPrefix[=:]\s*[{'"`]+\s*`?([a-z0-9-]+)\//gi)) {
        if (m[1]) roots.add(m[1].toLowerCase());
      }
    }
  }

  assert.ok(roots.size > 0, 'the scan found no pathPrefix call sites — the regex is stale');

  const unhandled = [];
  for (const root of roots) {
    const kind = tenancyForPathPrefix(`${root}/${EVENT}`)?.kind;
    // 'event' is the default and always checkable; thread and order have their
    // own arms in the route. Anything else means the route cannot verify it.
    if (!kind || !['event', 'thread', 'order'].includes(kind)) unhandled.push(root);
  }
  assert.deepEqual(unhandled, [], `these prefix roots resolve to no checkable tenancy: ${unhandled.join(', ')}`);
});

test('a payments prefix demands the ORDER, never the event', () => {
  // 🚨 THE LIVE BREAK. `payments/<orderId>` carries an ORDER id. Read as an
  // event id it was checked against a wedding that does not exist, so the
  // couple's order page and the vendor's booking-fee page could not attach a
  // payment screenshot at all — and there is no other way to send one from
  // those screens. The first proof of a purchase still arrived via a different
  // screen, so what broke was the SECOND chance: an admin asking for a clearer
  // picture addressed it to someone who could not send it.
  assert.deepEqual(tenancyForPathPrefix(`payments/${ORDER}`), { kind: 'order', id: ORDER });
  assert.notEqual(
    tenancyForPathPrefix(`payments/${ORDER}`)?.kind,
    'event',
    'a payments prefix must never be checked against events — that is the bug',
  );
});

test('the route checks each tenancy kind against its OWN table', () => {
  // A kind the resolver can return but the route cannot check would fail
  // closed exactly like the original bug, silently.
  const route = readFileSync(join(process.cwd(), 'app/api/upload/route.ts'), 'utf8');
  assert.match(route, /kind === 'order'/, 'the route must handle order tenancy');
  assert.match(route, /from\('orders'\)/, 'order tenancy must be checked against the orders table');
  assert.match(route, /from\('events'\)/, 'event tenancy must still be checked against events');
  assert.match(route, /from\('chat_threads'\)/, 'thread tenancy must still be checked against chat_threads');
});

test('chat is the one thread-rooted family', () => {
  assert.deepEqual(tenancyForPathPrefix(`chat/${THREAD}`), { kind: 'thread', id: THREAD });
  // Case-insensitive on the root so a caller's casing can't dodge the stricter
  // table — and note the DEFAULT is 'event', so an unknown root fails toward
  // the stricter check rather than away from it.
  assert.deepEqual(tenancyForPathPrefix(`CHAT/${THREAD}`), { kind: 'thread', id: THREAD });
});

test('a prefix with no id asks nothing of this module', () => {
  // These are the flat prefixes deliberately left on today's behaviour:
  // authenticated, sanitised, UUID-suffixed, non-overwriting.
  for (const prefix of ['locked-qr-proof', 'editorial-vendor', 'merchant-qr/bdo', 'papic/seat-3']) {
    assert.equal(tenancyForPathPrefix(prefix), null, `${prefix} carries no id`);
  }
  assert.equal(tenancyForPathPrefix(''), null);
});

test('the id must be a real UUID — near-misses are not ids', () => {
  // The whole rule rests on this: if a loose matcher accepted arbitrary
  // segments, every flat prefix would suddenly demand an entitlement nobody
  // holds and uploads would break app-wide.
  assert.equal(isUuid(EVENT), true);
  assert.equal(isUuid('not-a-uuid'), false);
  assert.equal(isUuid('seat-3'), false);
  assert.equal(isUuid('bdo'), false);
  assert.equal(isUuid('00000000-0000-4000-8000'), false, 'truncated');
  assert.equal(isUuid(`${EVENT}x`), false, 'trailing junk');
  // A v4-shaped string with a bad variant nibble is not a UUID we mint.
  // Variant nibble 0 instead of 8–b: shaped like a uuid, is not one.
  assert.equal(isUuid('00000000-0000-4000-0000-00000000e001'), false);
  assert.equal(tenancyForPathPrefix('locked-qr-proof'), null);
});

test('the first id wins, and a deeper id still gets asserted', () => {
  assert.deepEqual(tenancyForPathPrefix(`a/b/${EVENT}`), { kind: 'event', id: EVENT });
  assert.deepEqual(
    tenancyForPathPrefix(`${EVENT}/${THREAD}`),
    { kind: 'event', id: EVENT },
    'asserting the first is strictly better than asserting none',
  );
});

test('the refusal is non-specific — it must not become an existence oracle', () => {
  assert.doesNotMatch(UPLOAD_TENANCY_REFUSAL, /event|thread|exist|found|permission|own/i);
});

/* ═══════════════════════════════════════════════════════════════════════════
   2 · THE ROUTE ACTUALLY ENFORCES IT
   ═══════════════════════════════════════════════════════════════════════════ */

const code = (rel: string) =>
  readFileSync(resolve(WEB, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');

test('the upload route calls the rule and refuses on failure', () => {
  const src = code('app/api/upload/route.ts');
  assert.match(src, /tenancyForPathPrefix\(pathPrefix\)/);
  assert.match(src, /UPLOAD_TENANCY_REFUSAL/);
  assert.match(src, /status: 403/);
  // RLS is the check — the read must run on the CALLER's client, never the
  // service-role one, or the guard proves nothing.
  assert.match(src, /await supabase\s*\n?\s*\.from\('events'\)/);
  assert.match(src, /await supabase\s*\n?\s*\.from\('chat_threads'\)/);
  assert.doesNotMatch(
    src.slice(src.indexOf('tenancyForPathPrefix')),
    /createAdminClient\(\)[\s\S]{0,400}tenancy/,
    'the tenancy read must not be made with the admin client',
  );
});

test('seat mode is exempt — its prefix is server-derived', () => {
  // Seat uploads never carry a client-named id, and forcing them through an
  // events read would break anonymous seat claimers.
  assert.match(code('app/api/upload/route.ts'), /if \(!seatMode\) \{/);
});

/* ═══════════════════════════════════════════════════════════════════════════
   3 · REPO SCAN — the surface cannot grow silently
   ═══════════════════════════════════════════════════════════════════════════ */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('every interpolated pathPrefix has a resolvable static head', () => {
  // The runtime rule matches a UUID in ANY segment, so it cannot "miss" an id.
  // What it CANNOT do is tell a reader which family a prefix belongs to when the
  // head is an identifier. This scan resolves those identifiers against a
  // `const NAME = 'literal'` in the same file — which is how both shipped cases
  // (`DEPOSIT_PROOF_PATH_PREFIX`, `PHOTO_PATH_PREFIX`) are written — and fails
  // only on a head that nothing in the file defines. That is the case where a
  // future reader genuinely cannot tell what is being written where.
  const unresolved: string[] = [];
  let seen = 0;
  for (const file of ['app', 'lib'].flatMap((r) => walk(resolve(WEB, r)))) {
    const rel = relative(WEB, file);
    const src = code(rel);
    for (const m of src.matchAll(/pathPrefix:\s*[`'"]\$\{([A-Za-z_$][\w$]*)\}/g)) {
      seen += 1;
      const ident = m[1]!;
      const defined = new RegExp(`(?:const|let|var)\\s+${ident}\\s*(?::[^=]+)?=\\s*['"\`]([^'"\`]+)`).exec(src);
      if (!defined) unresolved.push(`${rel} → \${${ident}}`);
      else {
        // The resolved head must be a plain path segment, not another id.
        assert.ok(
          !isUuid(defined[1]!),
          `${rel}: ${ident} resolves to a UUID, which would make the family unreadable`,
        );
      }
    }
  }
  assert.ok(seen >= 2, `scan matched only ${seen} identifier-headed prefixes — the pattern has drifted`);
  assert.deepEqual(
    unresolved,
    [],
    'These prefixes start with an identifier this test could not resolve to a ' +
      'string literal, so neither it nor a reader can tell which family they ' +
      'belong to:\n' + unresolved.map((u) => `  • ${u}`).join('\n'),
  );
});
