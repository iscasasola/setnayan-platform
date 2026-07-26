/**
 * SEC-6 — the SEAL, tested against faked R2.
 *
 * ── WHY THIS FILE HAD TO EXIST ──────────────────────────────────────────────
 * `lib/std-video-gate.ts` opens with `import 'server-only'`, so `tsx --test`
 * cannot import a single line of it. Round two's ENTIRE sealing mechanism
 * therefore shipped with zero coverage — a reviewer demonstrated that reverting
 * the public serve path to the couple's mutable key left every unit test and the
 * whole DB suite green. Extracting the logic into `lib/std-seal.ts` (pure, R2
 * injected) is what makes it testable; this is the test that justifies the split.
 *
 * The three failures below cannot be produced on demand against a live bucket,
 * which is precisely why they are the ones worth faking: a source that moves
 * mid-copy, a backend that ignores the conditional header, and a malformed
 * target key.
 *
 * THE CONTRACT: `sealObject` returns null unless it can PROVE the copy holds the
 * bytes that were examined. Null means NO APPROVAL — the caller must leave the
 * verdict undecided rather than record an examination it cannot bind.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SEALED_SEGMENT,
  sealObject,
  sealTargetKey,
  splitFingerprint,
  type SealDeps,
} from './std-seal';
import { R2_SEALED_SEGMENT, pathPrefixIsAcceptable } from './r2-client-ref';

const EVENT = '044f7e64-95aa-4dcb-84c1-7263bf494eaa';
const NONCE = 'a1b2c3d4-0000-4000-8000-000000000001';
const BUCKET = 'setnayan-media';
const SOURCE = `events/${EVENT}/std-video/016d9fc1-clip.mp4`;
const FP = 'etagv:1048576';

type Call = Record<string, unknown>;

/** A fake R2 that copies faithfully and honours `CopySourceIfMatch`. */
function fakeR2(opts: {
  /** ETag the source currently carries. A copy is refused unless it matches. */
  sourceEtag?: string;
  /** What the copied object reads back as (defaults to a faithful copy). */
  copiedFingerprint?: string | null;
} = {}) {
  const sourceEtag = opts.sourceEtag ?? 'etagv';
  const copies: Call[] = [];
  const warnings: Call[] = [];
  const stored = new Map<string, string>();
  const deps: SealDeps = {
    copy: async (args) => {
      copies.push({ ...args });
      if (args.sourceIfMatch !== sourceEtag) {
        // What R2 does: 412 Precondition Failed.
        throw new Error('PreconditionFailed: CopySourceIfMatch did not match');
      }
      stored.set(args.toKey, opts.copiedFingerprint === undefined ? FP : (opts.copiedFingerprint as string));
    },
    fingerprint: async (args) => stored.get(args.key) ?? null,
    warn: (message, context) => warnings.push({ message, ...context }),
  };
  return { deps, copies, warnings, stored };
}

const request = (over: Partial<Parameters<typeof sealObject>[1]> = {}) => ({
  eventId: EVENT,
  role: 'video' as const,
  bucket: BUCKET,
  sourceKey: SOURCE,
  fingerprint: FP,
  nonce: NONCE,
  ...over,
});

// ── 0. Positive control ─────────────────────────────────────────────────────

test('POSITIVE CONTROL: a faithful conditional copy seals, and pins the source ETag', async () => {
  const r2 = fakeR2();
  const key = await sealObject(r2.deps, request());
  assert.ok(key, 'the legitimate seal failed — every refusal below proves nothing');
  assert.equal(r2.copies.length, 1);
  assert.equal(
    r2.copies[0]!.sourceIfMatch,
    'etagv',
    'the copy was not conditioned on the examined bytes — the examine→copy window is open',
  );
  assert.equal(r2.warnings.length, 0);
  assert.ok(key!.startsWith(`events/${EVENT}/${SEALED_SEGMENT}/`));
});

// ── 1. The source moved between examine and copy ────────────────────────────

test('a source that changed since we fingerprinted it is REFUSED, loudly', async () => {
  // The couple holds a 5-minute presigned PUT for their own key. If they re-PUT
  // between the classification and the copy, the copy must not silently capture
  // the new bytes under an approval earned by the old ones.
  const r2 = fakeR2({ sourceEtag: 'a-different-etag' });
  const key = await sealObject(r2.deps, request());
  assert.equal(key, null, 'a moved source was sealed anyway');
  // …and it must be AUDIBLE. Sealing fails closed, so a systemic breakage looks
  // exactly like "nobody uploaded a video" unless something shouts.
  assert.equal(r2.warnings.length, 1, 'a fail-closed refusal was silent');
  assert.match(String(r2.warnings[0]!.message), /conditional copy refused/i);
  assert.equal(r2.warnings[0]!.eventId, EVENT);
});

// ── 2. A backend that IGNORES the condition ─────────────────────────────────

test('a copy that lands with DIFFERENT bytes is refused even though the copy "succeeded"', async () => {
  // r2Copy had no caller in this codebase before SEC-6, so CopySourceIfMatch is
  // being exercised against R2 for the first time. If a backend ever ignored the
  // header — or a multipart path produced a different ETag shape — the copy
  // would report success while holding bytes nobody examined. The post-copy
  // fingerprint is the belt for that brace: the seal is never taken on trust.
  const r2 = fakeR2({ copiedFingerprint: 'somethingelse:99' });
  const key = await sealObject(r2.deps, request());
  assert.equal(key, null, 'a seal was recorded over bytes that were never examined');
  assert.equal(r2.warnings.length, 1);
  assert.match(String(r2.warnings[0]!.message), /does not hold the bytes we examined/i);
});

test('a copy that cannot be read back at all is refused (null is never "unchanged")', async () => {
  const r2 = fakeR2({ copiedFingerprint: null });
  const key = await sealObject(r2.deps, request());
  assert.equal(key, null);
  assert.equal(r2.warnings.length, 1);
});

// ── 3. The target key ───────────────────────────────────────────────────────

test('the sealed key lands under the RESERVED prefix /api/upload refuses to presign', () => {
  const key = sealTargetKey({ eventId: EVENT, role: 'video', fingerprint: FP, nonce: NONCE });
  assert.ok(key);
  assert.equal(key!.startsWith(`events/${EVENT}/${SEALED_SEGMENT}/`), true);
  // THE load-bearing property. If the client could presign into this prefix the
  // seal would be writable and the whole mechanism would be decoration.
  assert.equal(pathPrefixIsAcceptable(`events/${EVENT}/${SEALED_SEGMENT}`), false);
  assert.equal(pathPrefixIsAcceptable(`events/${EVENT}/${SEALED_SEGMENT}/${NONCE}`), false);
});

test('the two SEALED_SEGMENT constants must not drift apart', () => {
  // lib/std-seal.ts restates the segment rather than importing it, to stay
  // dependency-free. A rename in either file must fail here rather than silently
  // opening the reserved-segment ban.
  assert.equal(SEALED_SEGMENT, R2_SEALED_SEGMENT);
});

test('a re-seal never overwrites an earlier one (the nonce is what makes that true)', () => {
  const a = sealTargetKey({ eventId: EVENT, role: 'video', fingerprint: FP, nonce: NONCE });
  const b = sealTargetKey({
    eventId: EVENT,
    role: 'video',
    fingerprint: FP,
    nonce: 'b2c3d4e5-0000-4000-8000-000000000002',
  });
  assert.notEqual(a, b);
  // Overwriting in place would mean an approval recorded against a key could
  // later describe different bytes at that same key — the exact bug class.
});

test('the video and poster roles cannot collide on one key', () => {
  const v = sealTargetKey({ eventId: EVENT, role: 'video', fingerprint: FP, nonce: NONCE });
  const p = sealTargetKey({ eventId: EVENT, role: 'poster', fingerprint: FP, nonce: NONCE });
  assert.notEqual(v, p);
});

test('a hostile eventId, nonce or fingerprint yields NO key rather than a sanitised one', () => {
  for (const bad of ['../..', 'a/b', '', 'a b', 'a b', 'x/../../y']) {
    assert.equal(
      sealTargetKey({ eventId: EVENT, role: 'video', fingerprint: FP, nonce: bad }),
      null,
      `nonce ${JSON.stringify(bad)} produced a key`,
    );
    assert.equal(
      sealTargetKey({ eventId: bad, role: 'video', fingerprint: FP, nonce: NONCE }),
      null,
      `eventId ${JSON.stringify(bad)} produced a key`,
    );
  }
  for (const bad of ['', 'noseparator', ':1024', 'etag:notanumber']) {
    assert.equal(
      sealTargetKey({ eventId: EVENT, role: 'video', fingerprint: bad, nonce: NONCE }),
      null,
      `fingerprint ${JSON.stringify(bad)} produced a key`,
    );
  }
});

test('a malformed fingerprint refuses BEFORE any copy is attempted', async () => {
  const r2 = fakeR2();
  const key = await sealObject(r2.deps, request({ fingerprint: 'garbage' }));
  assert.equal(key, null);
  assert.equal(r2.copies.length, 0, 'a copy was attempted for a key we could not even build');
});

// ── 4. The fingerprint format itself ────────────────────────────────────────

test('splitFingerprint is total, and splits on the LAST colon (etags may contain them)', () => {
  assert.deepEqual(splitFingerprint('etagv:1048576'), { etag: 'etagv', size: 1048576 });
  assert.deepEqual(splitFingerprint('"abc-2":10'), { etag: '"abc-2"', size: 10 });
  assert.deepEqual(splitFingerprint('a:b:30'), { etag: 'a:b', size: 30 });
  for (const bad of ['', ':', ':10', 'nocolon', 'etag:', 'etag:NaN', 'etag:abc']) {
    assert.equal(splitFingerprint(bad), null, `${JSON.stringify(bad)} parsed`);
  }
});
