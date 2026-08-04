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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tenancyForPathPrefix, isUuid, UPLOAD_TENANCY_REFUSAL } from './upload-prefix-tenancy';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const EVENT = '044f7e64-95aa-4dcb-84c1-7263bf494eaa'; // a real prod event id shape
const THREAD = '947e7bab-893d-454d-b4c5-0a6e23f36009';

/* ═══════════════════════════════════════════════════════════════════════════
   1 · THE SHAPE RULE
   ═══════════════════════════════════════════════════════════════════════════ */

test('every id-bearing prefix shipped today resolves to an event', () => {
  // Enumerated from the live call sites, so a refactor that changes one of
  // these shapes shows up here rather than as a silent loss of the check.
  for (const prefix of [
    `deposit-proof/${EVENT}`,
    `manual-vendors/${EVENT}`,
    `force-majeure/${EVENT}`,
    `handovers/${EVENT}`,
    `events/${EVENT}/std-video-poster`,
    `inspiration/${EVENT}/hero`,
  ]) {
    assert.deepEqual(
      tenancyForPathPrefix(prefix),
      { kind: 'event', id: EVENT },
      `${prefix} must demand the event`,
    );
  }
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
  assert.equal(isUuid('044f7e64-95aa-4dcb-84c1'), false, 'truncated');
  assert.equal(isUuid(`${EVENT}x`), false, 'trailing junk');
  // A v4-shaped string with a bad variant nibble is not a UUID we mint.
  assert.equal(isUuid('044f7e64-95aa-4dcb-04c1-7263bf494eaa'), false);
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
