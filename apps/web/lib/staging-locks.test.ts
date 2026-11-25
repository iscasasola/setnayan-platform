/**
 * 🔒 THE STAGING LOCKS, HELD — every rule in lib/staging-locks.ts by behaviour, and each rule's wiring into its ONE
 * choke point by reading that file (comments stripped, so a docblock that merely mentions a lock does not count).
 *
 *   (a) EMAIL     sendEmail (lib/email.ts) routes every send through stagingEmailRoute before Resend is called
 *   (b) PAYMENTS  resolveMayaConfig (lib/integration-config.ts) hands back NO keys for a live endpoint on staging
 *   (c) HIDDEN    next.config.ts headers() spreads noindexHeaderRules(process.env); middleware has none
 *   (d) STORAGE   getR2Client / isR2Configured / publicUrlFor / r2StableMediaGet (lib/r2.ts) all ask stagingStorage
 *   (e) FLAGS     held in scripts/staging/flags.ts's own test (lib/staging-flags.test.ts)
 *
 * The SDK half of (d) — what a confined client really puts on the wire — is lib/staging-r2-confine.test.ts.
 *
 * SABOTAGE (each seen red, restored): route the email to `args.to` instead of `route.to` · drop the staging check in
 * resolveMayaConfig · spread nothing in headers() · let `stagingEmailRoute` keep the recipient when the sink is
 * malformed · accept `events/` as a staging prefix.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { mayaEnvironment, mayaRailState } from './maya-checkout';
import {
  PRODUCTION_HOST_PATTERN,
  confineCopySource,
  confineKey,
  confineR2Input,
  isStagingCopy,
  maskForSubject,
  noindexHeaderRules,
  stagingEmailRoute,
  stagingRefusesMoney,
  stagingStorage,
} from './staging-locks';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const STAGING = { STAGING: '1' } as const;

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start > -1, `${signature} moved — this guard is blind`);
  const end = src.indexOf('\n}\n', start);
  assert.ok(end > start, `could not bound ${signature}`);
  return src.slice(start, end);
}

// ── STAGING itself ──────────────────────────────────────────────────────────────────────────────────────────────────

test('a lock reads STAGING wide (any yes engages it) and nothing else engages it', () => {
  for (const v of ['1', 'true', 'TRUE', ' yes ', 'on']) assert.equal(isStagingCopy({ STAGING: v }), true, v);
  for (const v of [undefined, '', '0', 'false', 'no', 'off', 'staging']) assert.equal(isStagingCopy({ STAGING: v }), false, String(v));
});

// ── (a) EMAIL ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('(a) outside staging an email goes exactly where it was addressed', () => {
  assert.deepEqual(stagingEmailRoute({ to: 'ana@example.com', subject: 'Hi' }, {}), {
    send: true,
    to: 'ana@example.com',
    subject: 'Hi',
    rerouted: false,
  });
});

test('(a) on staging with no valid sink, every email is DROPPED — never sent to its real address', () => {
  for (const sink of [undefined, '', 'not-an-address', 'a@b.com, c@d.com', 'QA <qa@example.com>', 'qa@ex ample.com']) {
    const r = stagingEmailRoute({ to: 'ana@example.com', subject: 'Hi' }, { ...STAGING, STAGING_EMAIL_SINK: sink });
    assert.equal(r.send, false, `sink ${JSON.stringify(sink)} must drop`);
  }
});

test('(a) on staging with a sink, a real recipient is rerouted to the sink and masked into the subject', () => {
  const r = stagingEmailRoute({ to: 'ana.cruz@gmail.com', subject: 'Your booking' }, { ...STAGING, STAGING_EMAIL_SINK: 'qa@setnayan-test.example' });
  assert.deepEqual(r, { send: true, to: 'qa@setnayan-test.example', subject: '[staging → a***@gmail.com] Your booking', rerouted: true });
  assert.equal(maskForSubject('nonsense'), 'someone');
});

test('(a) the sink inbox and its +tags keep their own address (the same mailbox)', () => {
  const env = { ...STAGING, STAGING_EMAIL_SINK: 'qa@setnayan-test.example' };
  for (const to of ['qa@setnayan-test.example', 'QA+couple-plan@setnayan-test.example']) {
    const r = stagingEmailRoute({ to, subject: 'Hi' }, env);
    assert.ok(r.send && !r.rerouted && r.to === to && r.subject === '[staging] Hi', to);
  }
  const other = stagingEmailRoute({ to: 'qa@another.example', subject: 'Hi' }, env);
  assert.ok(other.send && other.rerouted && other.to === 'qa@setnayan-test.example', 'same local part, other domain is a person');
});

test('(a) sendEmail asks the route before Resend, and sends to the ROUTE, not the address it was given', () => {
  const send = body(code('lib/email.ts'), 'export async function sendEmail');
  const routeAt = send.indexOf('stagingEmailRoute(args, process.env)');
  const resendAt = send.indexOf('await sendViaResend(');
  assert.ok(routeAt > -1, 'sendEmail no longer asks stagingEmailRoute');
  assert.ok(resendAt > routeAt, 'the route must be decided before Resend is called');
  assert.match(send, /await sendViaResend\(\{ \.\.\.args, to: route\.to, subject: route\.subject \}\)/);
  assert.match(send, /route\.send\s*\?/, 'a dropped email must not reach sendViaResend');
});

// ── (b) PAYMENTS ────────────────────────────────────────────────────────────────────────────────────────────────────

test('(b) staging takes Maya sandbox only; live money is refused; outside staging nothing changes', () => {
  const sandbox = mayaEnvironment('https://pg-sandbox.paymaya.com/checkout/v1/checkouts');
  const live = mayaEnvironment('https://pg.maya.ph/checkout/v1/checkouts');
  assert.equal(sandbox, 'sandbox');
  assert.equal(live, 'production');
  assert.equal(stagingRefusesMoney(sandbox, STAGING), false);
  assert.equal(stagingRefusesMoney(live, STAGING), true);
  assert.equal(stagingRefusesMoney(live, {}), false, 'production keeps its live rail');
  // What a refusal hands back (no keys) is a CLOSED rail — nothing is ever sent with a live key.
  assert.deepEqual(mayaRailState({ enabled: true, publicKey: '', secretKey: '' }), { open: false, reason: 'missing_both_keys' });
});

test('(b) resolveMayaConfig refuses a live endpoint’s keys on staging, and is the only reader of the keys', () => {
  const resolve = body(code('lib/integration-config.ts'), 'export async function resolveMayaConfig');
  assert.match(resolve, /if \(stagingRefusesMoney\(mayaEnvironment\(resolved\.checkoutEndpoint\), process\.env\)\) \{/);
  assert.match(resolve, /return \{ publicKey: '', secretKey: '', checkoutEndpoint: resolved\.checkoutEndpoint \};/);
  assert.ok(resolve.indexOf('stagingRefusesMoney(') < resolve.lastIndexOf('return resolved;'), 'the refusal must come before the keys are returned');
  // No second door to the keys: only this resolver reads MAYA_*_API_KEY from the environment.
  for (const rel of ['lib/maya-checkout.server.ts', 'lib/maya-api.ts', 'lib/maya-settle.ts', 'lib/maya-reversal.server.ts']) {
    assert.doesNotMatch(code(rel), /process\.env\.MAYA_(PUBLIC|SECRET)_API_KEY/, `${rel} reads a Maya key around the lock`);
  }
});

// ── (c) HIDDEN ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('(c) every published non-production build answers noindex; production never does', () => {
  // Production gets no rule — not even with STAGING set by mistake.
  assert.deepEqual(noindexHeaderRules({ VERCEL_ENV: 'production' }), []);
  assert.deepEqual(noindexHeaderRules({ VERCEL_ENV: 'production', STAGING: '1' }), []);
  // Every Vercel preview/development deployment, and every staging build wherever it is built.
  for (const env of [{ VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'development' }, { STAGING: '1' }, { VERCEL_ENV: '', STAGING: 'true' }]) {
    const rules = noindexHeaderRules(env);
    assert.equal(rules.length, 1, JSON.stringify(env));
    assert.equal(rules[0]!.source, '/(.*)');
    assert.deepEqual(rules[0]!.headers, [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]);
  }
  // A local or CI build that is not on Vercel and not staging: no rule — it is what Lighthouse audits.
  assert.deepEqual(noindexHeaderRules({}), []);
  assert.deepEqual(noindexHeaderRules({ VERCEL_ENV: '' }), []);
});

test('(c) the belt: the rule never fires on setnayan.com or a subdomain, always on a Vercel preview host', () => {
  const [rule] = noindexHeaderRules({ VERCEL_ENV: 'preview' });
  assert.deepEqual(rule!.missing, [{ type: 'host', value: PRODUCTION_HOST_PATTERN }]);
  // Next matches a `host` condition against the whole host.
  const live = new RegExp(`^${PRODUCTION_HOST_PATTERN}$`);
  for (const h of ['setnayan.com', 'www.setnayan.com', 'supplier.setnayan.com', 'coordinator.setnayan.com']) assert.ok(live.test(h), h);
  for (const h of ['setnayan-platform-web-git-preview-final-check-setnayan.vercel.app', 'staging.example.com', 'notsetnayan.com']) {
    assert.ok(!live.test(h), h);
  }
});

test('(c) next.config.ts spreads the rule into headers(), and middleware does not carry its own', () => {
  const cfg = code('next.config.ts');
  assert.match(cfg, /import \{ noindexHeaderRules \} from '\.\/lib\/staging-locks';/);
  const headers = cfg.slice(cfg.indexOf('async headers()'), cfg.indexOf('async redirects()'));
  assert.match(headers, /\.\.\.noindexHeaderRules\(process\.env\),/);
  assert.doesNotMatch(code('middleware.ts'), /X-Robots-Tag/i, 'one place for the header: next.config.ts');
});

// ── (d) STORAGE ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('(d) R2 is untouched outside staging, OFF on staging without a valid prefix, confined with one', () => {
  assert.deepEqual(stagingStorage({ STAGING_R2_PREFIX: 'staging/x/' }), { mode: 'live' });
  for (const p of [undefined, '', '/', 'staging', 'staging//', '../', 'staging/../', 'Staging/', 'events/', 'staging/a b/', ' /staging/']) {
    assert.equal(stagingStorage({ ...STAGING, STAGING_R2_PREFIX: p }).mode, 'off', JSON.stringify(p));
  }
  for (const p of ['staging/', 'staging/final-check/', 'staging-2026-11/run_1/']) {
    assert.deepEqual(stagingStorage({ ...STAGING, STAGING_R2_PREFIX: p }), { mode: 'confined', prefix: p });
  }
});

test('(d) a key is confined once, a copy source keeps its bucket, a batch delete is confined key by key', () => {
  const P = 'staging/fc/';
  assert.equal(confineKey('events/e1/a.jpg', P), 'staging/fc/events/e1/a.jpg');
  assert.equal(confineKey('/events/e1/a.jpg', P), 'staging/fc/events/e1/a.jpg');
  assert.equal(confineKey('staging/fc/events/e1/a.jpg', P), 'staging/fc/events/e1/a.jpg');
  assert.equal(confineCopySource('setnayan-media/a%20b.jpg?versionId=1', P), 'setnayan-media/staging/fc/a%20b.jpg?versionId=1');
  assert.throws(() => confineCopySource('setnayan-media', P), /names no object/);
  const input = { Bucket: 'b', Delete: { Objects: [{ Key: 'x' }, { Key: 'staging/fc/y' }] } };
  assert.deepEqual(confineR2Input('DeleteObjectsCommand', input, P).Delete, { Objects: [{ Key: 'staging/fc/x' }, { Key: 'staging/fc/y' }] });
  assert.deepEqual(input.Delete.Objects[0], { Key: 'x' }, 'the caller’s input is not mutated');
  assert.equal(confineR2Input('ListObjectsV2Command', { Bucket: 'b' }, P).Prefix, P);
  for (const c of ['PutBucketPolicyCommand', 'DeleteBucketCommand', 'CreateBucketCommand', 'PutBucketCorsCommand']) {
    assert.throws(() => confineR2Input(c, { Bucket: 'b' }, P), /bucket-level write/, c);
  }
});

test('(d) lib/r2.ts asks the storage lock at its one constructor and its two browser-facing builders', () => {
  const r2 = code('lib/r2.ts');
  assert.match(body(r2, 'export function isR2Configured'), /if \(stagingStorage\(process\.env\)\.mode === 'off'\) return false;/);
  const ctor = body(r2, 'export function getR2Client');
  assert.match(ctor, /confineR2Client\(_client, storage\.prefix, \{ liveReadBuckets: new Set\(\[R2_BUCKETS\.media\]\) \}\)/);
  assert.ok(ctor.indexOf('confineR2Client(') > ctor.indexOf('_client = new S3Client('), 'confined after it is built, before it is returned');
  assert.match(body(r2, 'export function publicUrlFor'), /storedKey\(key\)\.split\('\/'\)/);
  assert.match(body(r2, 'export function r2StableMediaGet'), /key: storedKey\(key\),/);
  assert.equal((r2.match(/new S3Client\(/g) ?? []).length, 1, 'one R2 client constructor');
});

test('(d) nothing in the app builds an R2 client or a raw signature around the lock', () => {
  // git grep finds the candidates; a file counts only if the call survives comment stripping.
  const grep = (pattern: string) =>
    execFileSync('git', ['grep', '-l', '-E', pattern, '--', 'app', 'lib', 'components'], { cwd: WEB, encoding: 'utf8' })
      .split('\n')
      .filter((f) => f && !f.endsWith('.test.ts'))
      .filter((f) => new RegExp(pattern).test(code(f)));
  assert.deepEqual(grep('new S3Client\\('), ['lib/r2.ts']);
  assert.deepEqual(grep('presignR2GetSync\\(').sort(), ['lib/r2-stable-sign.ts', 'lib/r2.ts'], 'defined in one file, called from lib/r2.ts only');
});
