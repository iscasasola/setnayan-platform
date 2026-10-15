/**
 * THE WALLET PASS KEEPS ITS SECRETS — the Apple pass certificate, its key, the
 * key's passphrase and Apple's WWDR certificate live ONLY in Vercel env vars
 * (owner set-up 2026-10-13). This scan holds the code to three promises:
 *
 *   1 · ONE READER. The six env NAMES appear in source in exactly two places:
 *       `lib/wallet-pass-config.server.ts` (which reads them) and the Secrets
 *       board's registry (which lists them, names only). A second reader is a
 *       second place a value could be logged or returned.
 *   2 · NOTHING ON THE WALLET PATH LOGS A VALUE. In every file that touches the
 *       signing set there is no `console.*` at all, and no `logQueryError(…)`
 *       call mentions the signer, a PEM, the passphrase, the env, or a raw
 *       caught error (whose message could carry a library's echo of its input).
 *   3 · A FAILURE NAMES A STEP. `WalletSigningError` messages are fixed
 *       sentences — executed in `wallet-pass-is-the-ticket.test.ts`.
 *
 * Comments are stripped (`lib/strip-comments.ts`) so a docblock naming a
 * variable does not count, and a commented-out log does not hide.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

const SECRET_NAMES = [
  'APPLE_PASS_TYPE_ID',
  'APPLE_TEAM_ID',
  'APPLE_PASS_CERT_B64',
  'APPLE_PASS_KEY_B64',
  'APPLE_PASS_KEY_PASSPHRASE',
  'APPLE_WWDR_CERT_B64',
] as const;

const READER = 'lib/wallet-pass-config.server.ts';
const REGISTRY = 'lib/secrets/rotation-registry.ts';

/** Every file on the path from the env to the guest's phone. */
const WALLET_PATH = [
  READER,
  'lib/wallet-pass.ts',
  'lib/wallet-pass.server.ts',
  'lib/wallet-pass-pkpass.ts',
  'app/api/guest/wallet/apple/route.ts',
] as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.(ts|tsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Each `logQueryError(` call, up to its matching paren. */
function logCalls(src: string): string[] {
  const out: string[] = [];
  let i = src.indexOf('logQueryError(');
  while (i >= 0) {
    let depth = 0;
    let j = i + 'logQueryError'.length;
    for (; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')' && --depth === 0) break;
    }
    out.push(src.slice(i, j + 1));
    i = src.indexOf('logQueryError(', j);
  }
  return out;
}

test('1 · the Apple secret names are read in ONE module (and listed, names only, on the Secrets board)', () => {
  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))].map((p) => relative(WEB, p));
  const found = new Map<string, string[]>();
  for (const rel of files) {
    const src = code(rel);
    for (const n of SECRET_NAMES) if (src.includes(n)) found.set(rel, [...(found.get(rel) ?? []), n]);
  }
  assert.deepEqual([...found.keys()].sort(), [READER, REGISTRY].sort(), `a second module names an Apple secret: ${JSON.stringify([...found])}`);
  for (const n of SECRET_NAMES) assert.ok(found.get(READER)?.includes(n), `${READER} no longer reads ${n}`);
});

test('2 · nothing on the wallet path logs a value — no console, and no log call carries the signer, a PEM, the env or a raw error', () => {
  let calls = 0;
  for (const rel of WALLET_PATH) {
    const src = code(rel);
    assert.ok(!/\bconsole\s*\.\s*\w+\s*\(/.test(src), `${rel}: a console call on the wallet path`);
    for (const call of logCalls(src)) {
      calls++;
      assert.ok(!/signer|Pem\b|[Pp]em[A-Z]|[Pp]assphrase|process\.env|\benv\b/.test(call), `${rel}: a log call that can carry a secret — ${call}`);
      // The second argument is never the caught error itself.
      assert.ok(!/^logQueryError\(\s*'[^']*'\s*,\s*(err|error|e)\s*[,)]/.test(call), `${rel}: a raw error is logged — ${call}`);
    }
  }
  assert.ok(calls >= 3, `the scan found only ${calls} log calls — is it still reading the wallet files?`);
});

test('2b · the route hands a secret to nothing but the signer', () => {
  const route = code('app/api/guest/wallet/apple/route.ts');
  const uses = route.match(/config\.signer/g) ?? [];
  assert.equal(uses.length, 1, 'config.signer is used somewhere other than buildPkpass');
  assert.match(route, /buildPkpass\(.*config\.signer\)/);
  assert.ok(!/NextResponse\([^)]*config\b/.test(route), 'a response body built from the config');
});
