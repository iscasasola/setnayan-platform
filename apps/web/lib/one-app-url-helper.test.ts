/**
 * one-app-url-helper.test.ts — 🔒 ONE PLACE KNOWS THE LOCAL DEV ADDRESS, AND PRODUCTION NEVER USES IT.
 *
 * Measured 2026-11-18 on main: seven shipped files built an absolute app URL as
 * `process.env.NEXT_PUBLIC_APP_URL ?? <the local dev address>` (the Google sign-in return, the signup confirm
 * link, the password-recovery and event-account links, the open-shop confirm link, the checkout order link, the
 * root layout's metadataBase), and two dev labs fell back to the local host when a request had no Host header.
 * On any deploy where the variable was missing, those links would have pointed real people at a laptop.
 * Every one of them reads `siteOrigin()` (lib/site-origin.ts) now.
 *
 * ── WHAT IT CLAIMS ──────────────────────────────────────────────────────────────────────────────────────────────
 *   1. `siteOrigin()` (run): with no address variable set, production and test resolve to https://www.setnayan.com
 *      and ONLY `next dev` (NODE_ENV=development) resolves to the local address; a set variable always wins and
 *      loses its trailing slash.
 *   2. No shipped source file other than lib/site-origin.ts spells the local dev address — comments stripped with
 *      lib/strip-comments.ts, so a mention in prose is fine and a string literal is not. Test and spec files are
 *      exempt (they assert on that address on purpose).
 *
 * ── NOT CLAIMED ─────────────────────────────────────────────────────────────────────────────────────────────────
 *   · Other fallbacks to a hard-coded production or vercel.app origin (`?? 'https://…'`) are not routed through
 *     the helper by this guard — they are safe in production, and moving them is a separate cleanup.
 *   · `scripts/`, `tests/` and the Playwright configs are tooling that runs on a dev machine or CI, not the app;
 *     they are not scanned.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { siteOrigin } from './site-origin';
import { stripComments } from './strip-comments';

const WEB = path.resolve(__dirname, '..');
const HELPER = 'lib/site-origin.ts';
const LOCAL = ['localhost', '3000'].join(':');
const SCANNED_DIRS = ['app', 'lib', 'components', 'types', 'models'];
const SCANNED_ROOT_FILES = ['middleware.ts', 'instrumentation.ts', 'next.config.ts', 'sentry.edge.config.ts', 'sentry.server.config.ts'];
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/;

const ADDRESS_VARS = ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SITE_URL', 'SITE_URL', 'NEXT_PUBLIC_SETNAYAN_BASE_URL', 'NODE_ENV'] as const;

function withEnv(env: Partial<Record<(typeof ADDRESS_VARS)[number], string>>, fn: () => void) {
  const saved = Object.fromEntries(ADDRESS_VARS.map((k) => [k, process.env[k]]));
  const vars = process.env as Record<string, string | undefined>;
  try {
    for (const k of ADDRESS_VARS) delete vars[k];
    Object.assign(vars, env);
    fn();
  } finally {
    for (const k of ADDRESS_VARS) {
      if (saved[k] === undefined) delete vars[k];
      else vars[k] = saved[k];
    }
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (SOURCE.test(e.name) && !TEST_FILE.test(e.name)) out.push(p);
  }
  return out;
}

test('1 · production and test never fall back to the local address', () => {
  for (const NODE_ENV of ['production', 'test']) {
    withEnv({ NODE_ENV }, () => assert.equal(siteOrigin(), 'https://www.setnayan.com', NODE_ENV));
  }
  withEnv({}, () => assert.equal(siteOrigin(), 'https://www.setnayan.com', 'NODE_ENV unset'));
});

test('1 · only next dev falls back to the local address', () => {
  withEnv({ NODE_ENV: 'development' }, () => assert.equal(siteOrigin(), `http://${LOCAL}`));
});

test('1 · a set address always wins, in every mode, without its trailing slash', () => {
  for (const NODE_ENV of ['production', 'development', 'test']) {
    withEnv({ NODE_ENV, NEXT_PUBLIC_APP_URL: 'https://preview.example.test/' }, () =>
      assert.equal(siteOrigin(), 'https://preview.example.test', NODE_ENV),
    );
  }
});

test('2 · no shipped source file outside lib/site-origin.ts spells the local dev address', () => {
  const files = [
    ...SCANNED_DIRS.filter((d) => fs.existsSync(path.join(WEB, d))).flatMap((d) => walk(path.join(WEB, d))),
    ...SCANNED_ROOT_FILES.map((f) => path.join(WEB, f)).filter((f) => fs.existsSync(f)),
  ];
  assert.ok(files.length > 1000, `the walk found only ${files.length} files — it is not reading the tree`);

  const rel = (f: string) => path.relative(WEB, f).split(path.sep).join('/');
  const helper = files.find((f) => rel(f) === HELPER);
  assert.ok(helper, 'lib/site-origin.ts was not found by the walk');
  assert.ok(stripComments(fs.readFileSync(helper, 'utf8')).includes(LOCAL), 'the helper no longer holds the dev address — this guard would be vacuous');

  const offenders = files
    .filter((f) => rel(f) !== HELPER)
    .filter((f) => stripComments(fs.readFileSync(f, 'utf8')).includes(LOCAL))
    .map(rel);
  assert.deepEqual(offenders, [], `build the absolute app URL with siteOrigin() from lib/site-origin.ts instead:\n  ${offenders.join('\n  ')}`);
});
