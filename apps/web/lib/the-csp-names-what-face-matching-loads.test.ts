/**
 * the-csp-names-what-face-matching-loads.test.ts — the policy must name the
 * host the code actually fetches from.
 *
 * ── The defect (register LAU-10) ────────────────────────────────────────────
 * The register's wording is *"the browser protection can be switched on WITHOUT
 * BREAKING FACE MATCHING."* This is the thing it meant.
 *
 * `lib/face-gate.ts` loads MediaPipe from `https://cdn.jsdelivr.net/npm/...`,
 * and the report-only CSP named that host **nowhere**. Production's
 * `csp_violation_reports` recorded 4 `script-src-elem` violations against it
 * between 2026-08-22 and 2026-09-18 — so the enforcing policy would have broken
 * face matching, silently, on somebody's wedding photos.
 *
 * 🔑 THE REPORT-ONLY HEADER IS THE MEASUREMENT, AND IT WAS ANSWERING. Enforcing
 * was never blocked on "we do not know what would break" — the table said. What
 * was missing is anything that reads it back into the policy.
 *
 * ── Why this guard is coupled to the CODE, not to a list ────────────────────
 * A hardcoded allowlist rots the moment someone bumps the MediaPipe version or
 * swaps CDN. This reads the host **out of `face-gate.ts`** and asserts the
 * policy names it. Change the CDN and this fails, which is the only moment
 * anyone would otherwise find out — in production, in an enforcing policy, on a
 * wedding.
 *
 * ⚠ BOTH directives matter and it is not duplication: MediaPipe loads a LOADER
 * SCRIPT (`script-src`) and then FETCHES the wasm binary (`connect-src`).
 * Naming one leaves the other failing with a different error.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/**
 * EVERY origin `face-gate.ts` loads from, read from the code.
 *
 * ⚠ Plural on purpose. The first version of this returned the FIRST match and
 * so proved only one host — while face-gate loads two: the wasm runtime from
 * jsdelivr and the model from storage.googleapis.com. Only jsdelivr ever
 * reached `csp_violation_reports`, because the model fetch happens only when
 * face matching actually runs. A guard that checks one host is the same
 * half-fix wearing a test.
 */
function faceGateOrigins(): string[] {
  const src = read('lib/face-gate.ts');
  const hosts = [...src.matchAll(/https:\/\/([a-z0-9.-]+)\//gi)].map((m) => m[1]!);
  const unique = [...new Set(hosts)];
  assert.ok(
    unique.length >= 2,
    `face-gate.ts names ${unique.length} host(s); it loads a wasm runtime AND a model, so fewer ` +
      'than two means this guard has stopped seeing one of them',
  );
  return unique;
}

/** One CSP directive's value, out of next.config.ts. */
function directive(name: string): string {
  const src = read('next.config.ts');
  const m = src.match(new RegExp(`"${name} ([^"]*)"`));
  assert.ok(m, `the ${name} directive is gone from next.config.ts`);
  return m[1]!;
}

test('the CSP names EVERY host face matching loads from', () => {
  const hosts = faceGateOrigins();
  console.log(`[csp-face] face-gate loads from ${hosts.length} host(s): ${hosts.join(', ')}`);

  // The wasm runtime needs script-src AND connect-src; the model is a plain
  // fetch, so connect-src. Requiring connect-src for every host is correct and
  // strictly safer than trying to guess which is which from the URL.
  const missing: string[] = [];
  for (const host of hosts) {
    if (!directive('connect-src').includes(host)) missing.push(`connect-src is missing ${host}`);
  }
  if (!directive('script-src').includes('cdn.jsdelivr.net')) {
    missing.push('script-src is missing cdn.jsdelivr.net (the wasm LOADER, not the binary)');
  }

  assert.deepEqual(
    missing,
    [],
    'The CSP does not name something lib/face-gate.ts loads. Under an ENFORCING policy this ' +
      'breaks face matching — silently, on somebody\u2019s wedding photos.\n  ' +
      missing.join('\n  '),
  );
});

test('both directives are named — a half-fix fails with a different error', () => {
  // MediaPipe loads a loader SCRIPT and then FETCHES the wasm. Naming only one
  // leaves the other failing, which reads as a mystery rather than as this.
  const host = 'cdn.jsdelivr.net';
  const script = directive('script-src').includes(host);
  const connect = directive('connect-src').includes(host);
  assert.equal(
    script && connect,
    true,
    `script-src: ${script}, connect-src: ${connect} — MediaPipe needs both, for different reasons`,
  );
});

test('the first-party origins are named too — they were the other half', () => {
  // Production reported violations against the site's OWN image host and, until
  // 2026-09-21, the OSM tile host. Both are first-party infrastructure; a policy
  // that blocks its own images can never be enforced.
  const img = directive('img-src');
  for (const host of ['r2.dev', 'tile.openstreetmap.org']) {
    assert.ok(img.includes(host), `img-src does not name ${host}`);
  }
});
