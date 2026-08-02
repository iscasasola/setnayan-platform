/**
 * SEC-1 deferred lane #5 — the 7-day admin presign TTLs. **This is a "must not
 * shorten" finding, not a fix**, and this test is what stops the next hardening
 * pass from breaking the public homepage.
 *
 * The register lists these as "admin surfaces still issue 7-day TTLs,
 * `assertAdmin`-gated, so not urgent". Two corrections after reading the code:
 *
 *   1. They are NOT admin-only. `lib/background-videos.ts`
 *      are consumed by `app/page.tsx` — the PUBLIC homepage, on ISR
 *      (`revalidate = 300`). So a bad TTL change is a public breakage, which makes
 *      it MORE dangerous to touch casually, not less.
 *
 *   2. The 7 days is load-bearing, and both files say why: the signed URL is kept
 *      STABLE across the re-sign interval so a returning visitor re-uses the
 *      browser-cached frames instead of re-downloading tens of MB. 7d is the SigV4
 *      maximum and sits deliberately ABOVE the ~6d re-sign interval.
 *
 * So the invariant worth pinning is NOT the magic number — freezing it would just
 * trade one hazard for another — but the RELATIONSHIP:
 *
 *      presign lifetime  >  re-sign interval
 *
 * Violate it and the app hands out URLs that expire before it next re-signs them:
 * a dead hero video on the highest-traffic page in the product, appearing hours
 * after the deploy that caused it and only for visitors whose cache had gone cold.
 * A future pass may absolutely shorten these — but it has to shorten BOTH, and
 * this test makes that requirement impossible to miss.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LIB = dirname(fileURLToPath(import.meta.url));

/** Reads a `const NAME = <arithmetic>;` seconds value out of a module. */
function readSeconds(file: string, name: string): number {
  const src = readFileSync(join(LIB, file), 'utf8');
  const m = new RegExp(`const ${name} = ([0-9*\\s]+);`).exec(src);
  assert.ok(m, `${file}: expected a numeric \`const ${name}\``);
  // Arithmetic only (e.g. `60 * 60 * 24 * 7`) — no identifiers, so this is safe.
  const expr = m![1]!.trim();
  assert.match(expr, /^[0-9*\s]+$/, `${file}: ${name} must stay plain arithmetic`);
  return expr.split('*').reduce((a, b) => a * Number(b.trim()), 1);
}

const CASES: ReadonlyArray<[string, string, string, string]> = [
  // `hero-video.ts` was here until 2026-08-02. The sign-in hero was retired
  // (PR #4055) and the module deleted, so there is no longer a presign to check.
  // Re-add a row here if that surface ever comes back — see
  // website-media-retired-hero.test.ts, which fails if it does.
  ['background-videos.ts', 'PRESIGN_TTL_SECONDS', 'PRESIGN_CACHE_TTL_SECONDS', 'the homepage pillar videos'],
];

for (const [file, ttlName, resignName, what] of CASES) {
  test(`${file}: the presign outlives the re-sign interval (${what})`, () => {
    const ttl = readSeconds(file, ttlName);
    const resign = readSeconds(file, resignName);
    assert.ok(
      ttl > resign,
      `${file}: ${ttlName} (${ttl}s) must EXCEED ${resignName} (${resign}s). As written, a URL `
        + `would expire before the next re-sign — a dead video on the public homepage. If you are `
        + `shortening the TTL for security, shorten the re-sign interval too.`,
    );
    // And with real margin, not by a second: the re-signed batch is cached, so the
    // gap absorbs clock skew plus however long a cached page keeps serving.
    assert.ok(
      ttl - resign >= 60 * 60,
      `${file}: leave at least an hour of margin between ${ttlName} and ${resignName} `
        + `(currently ${(ttl - resign) / 60} minutes) — ISR keeps serving a cached page after the `
        + `re-sign is due.`,
    );
  });

  test(`${file}: the TTL stays within the SigV4 maximum`, () => {
    // 7d is the hard AWS/R2 ceiling for a SigV4 presign; asking for more yields a
    // URL that is rejected outright rather than one that merely expires early.
    assert.ok(
      readSeconds(file, ttlName) <= 60 * 60 * 24 * 7,
      `${file}: ${ttlName} exceeds the SigV4 7-day maximum — R2 will refuse the signature`,
    );
  });
}
