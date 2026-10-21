/**
 * 📸 A PHOTO KEEPS ONE ADDRESS ALL DAY — so a guest's browser can keep it (owner 2026-10-20: *"we want all pages to
 * load at its fastest."*).
 *
 * MEASURED on the live guest invitation (read-only, 2026-10-20): ~20 MB of R2 files, every one asked for again on
 * the next visit — each render signed a NEW address (`X-Amz-Date` = now) for the SAME object, and R2 answered with
 * no `Cache-Control`. The hero background was the 4.4 MB camera original, though a 25 KB screen-sized copy of it
 * already sat in the bucket. And Setnayan's own theme loops reached guests at `pub-….r2.dev`, the rate-limited
 * development host some networks block (#6691 moved the cover off it for exactly that).
 *
 * Held here by the PROPERTY, not by a phrasing:
 *   1 · the same object key signs to the same URL all through a window, and the URL handed out at the window's
 *       END still lives the full TTL (behaviour; fake keys, local HMAC — nothing leaves the machine);
 *   2 · the synchronous signer is the SDK's signer, byte for byte, over awkward keys (one answer, not two);
 *   3 · every media GET the display signers hand out carries `response-cache-control` — immutable for an
 *       upload-named (`<uuid>-…`) key, an hour for anything that can be replaced in place;
 *   4 · a private bucket is never signed by the stable path, and keeps its own TTL and fresh signature;
 *   5 · the theme ground and the moving background reach a guest SIGNED on the bucket's own host, never `r2.dev`;
 *   6 · no guest-facing file draws a media file at the public host — the only exceptions are named, with reasons;
 *   7 · the Main background's still asks for the screen-sized copy first.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { stripComments } from './strip-comments';
import {
  IMMUTABLE_MEDIA_CACHE_CONTROL,
  REPLACEABLE_MEDIA_CACHE_CONTROL,
  mediaCacheControl,
  presignR2GetSync,
  stableSigningWindow,
} from './r2-stable-sign';

{
  // `server-only` refuses to load outside Next; these modules are exercised here with fake keys only.
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const UPLOAD_KEY = 'events/11111111-2222-4333-8444-555555555555/love-story/0eabf2e1-c169-4922-8bf0-62cf66fb5cb8-IMG_1511.jpeg';
const FAKE = { accountId: 'acct0test', accessKeyId: 'AKIATEST', secretAccessKey: 'secret-test' };

function withR2<T>(fn: () => Promise<T>): Promise<T> {
  const keys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL'] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  process.env.R2_ACCOUNT_ID = FAKE.accountId;
  process.env.R2_ACCESS_KEY_ID = FAKE.accessKeyId;
  process.env.R2_SECRET_ACCESS_KEY = FAKE.secretAccessKey;
  process.env.R2_PUBLIC_URL = 'https://pub-0000.r2.dev';
  return fn().finally(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });
}

const param = (url: string, name: string) => new URL(url).searchParams.get(name);

/* ── 1 · one address per window, never a shorter life ─────────────────────── */

test('1 · the same key signs to the same URL through a window — and every URL lives at least the TTL asked for', () => {
  const DAY = 24 * 60 * 60;
  const t0 = Date.UTC(2026, 9, 20, 12, 0, 0);
  const sign = (nowMs: number, ttl = DAY) => {
    const w = stableSigningWindow(ttl, nowMs);
    return { url: presignR2GetSync({ ...FAKE, bucket: 'setnayan-media', key: UPLOAD_KEY, signingDate: w.signingDate, expiresIn: w.expiresIn }), w };
  };
  const a = sign(t0 + 1000);
  const b = sign(t0 + 11 * 3600 * 1000 + 59 * 60 * 1000); // 11 h 59 m later — same window
  assert.equal(a.url, b.url, 'one object signed to two addresses inside one window — no browser can keep it');
  const c = sign(t0 + 12 * 3600 * 1000 + 1000); // next window
  assert.notEqual(a.url, c.url, 'the window never rolls — the address would outlive its own expiry');
  for (const offset of [0, 1, 3600, 43_199]) {
    const now = t0 + offset * 1000;
    const { w } = sign(now);
    const expiresAt = w.signingDate.getTime() + w.expiresIn * 1000;
    assert.ok(expiresAt - now >= DAY * 1000, `a URL handed out ${offset}s into the window dies before its 24 h`);
    assert.ok(expiresAt - now <= 1.5 * DAY * 1000, 'a URL now lives longer than TTL + one window');
  }
  // A five-minute link stays a five-minute link, not a twelve-hour one.
  const short = stableSigningWindow(300, t0 + 7000);
  assert.ok(short.expiresIn <= 450, `a 300 s link now lives ${short.expiresIn} s`);
});

/* ── 2 · the sync signer IS the SDK's signer ──────────────────────────────── */

test('2 · the synchronous signer matches the AWS SDK byte for byte', async () => {
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${FAKE.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: FAKE.accessKeyId, secretAccessKey: FAKE.secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const signingDate = new Date(Date.UTC(2026, 9, 20, 12, 0, 0));
  const keys = [UPLOAD_KEY, "x/My Photo (1)!*'~ñ.jpg", 'theme-backgrounds/2026-09-24/cyber-neon-loop.mp4', 'a/b+c&d=e?.png', 'a//b/ü 漢.webp'];
  let compared = 0;
  for (const key of keys) {
    for (const cc of [undefined, IMMUTABLE_MEDIA_CACHE_CONTROL, REPLACEABLE_MEDIA_CACHE_CONTROL]) {
      const sdk = await getSignedUrl(client, new GetObjectCommand({ Bucket: 'setnayan-media', Key: key, ResponseCacheControl: cc }), { expiresIn: 129_600, signingDate });
      const mine = presignR2GetSync({ ...FAKE, bucket: 'setnayan-media', key, signingDate, expiresIn: 129_600, responseCacheControl: cc });
      assert.equal(mine, sdk, `the sync signer disagrees with the SDK for ${JSON.stringify(key)} cc=${cc}`);
      compared += 1;
    }
  }
  assert.equal(compared, 15);
});

/* ── 3 · 4 · every media GET carries Cache-Control; private stays as it was ── */

test('3 · the key decides the cache: an upload-named key is immutable, anything else an hour', () => {
  assert.equal(mediaCacheControl(UPLOAD_KEY), IMMUTABLE_MEDIA_CACHE_CONTROL);
  assert.equal(mediaCacheControl(`${UPLOAD_KEY}__stdbg-w1600.webp`), IMMUTABLE_MEDIA_CACHE_CONTROL, 'the screen-sized copy is a derived, never-rewritten key');
  for (const k of ['site/branding/favicon.ico', 'theme-backgrounds/2026-09-24/cyber-neon-loop.mp4', 'events/x/render.png']) {
    assert.equal(mediaCacheControl(k), REPLACEABLE_MEDIA_CACHE_CONTROL, `${k} could be rewritten in place and is cached for a year`);
  }
});

test('3 · 4 · the display signers: media is stable + cached, a private bucket keeps a fresh, uncached, unstretched link', async () => {
  await withR2(async () => {
    const { displayUrlForStoredAsset, presignDisplayUrl, stableDisplayUrlForStoredAsset, R2_BUCKETS } = await import('./uploads');
    const ref = `r2://setnayan-media/${UPLOAD_KEY}`;
    const a = await displayUrlForStoredAsset(ref);
    const b = await displayUrlForStoredAsset(ref);
    const s = stableDisplayUrlForStoredAsset(ref);
    assert.ok(a && b && s);
    assert.equal(a, b, 'two renders signed one photo to two addresses');
    assert.equal(a, s, 'the sync and async signers hand out different addresses for one photo');
    assert.match(a!, /^https:\/\/setnayan-media\.acct0test\.r2\.cloudflarestorage\.com\//, 'not signed on the bucket host');
    assert.equal(param(a!, 'response-cache-control'), IMMUTABLE_MEDIA_CACHE_CONTROL, 'a media GET carries no Cache-Control');

    // Private: the SDK path, exactly as before — fresh signature, the caller's own TTL, no cache header.
    const priv = await presignDisplayUrl(R2_BUCKETS.threadFiles, 'threads/x/proof.png', 300);
    assert.equal(param(priv, 'X-Amz-Expires'), '300', 'a private link was stretched');
    assert.equal(param(priv, 'response-cache-control'), null, 'a private file was made cacheable');
    // And the stable path refuses anything but the media bucket.
    assert.equal(stableDisplayUrlForStoredAsset('r2://setnayan-thread-files/threads/x/proof.png'), null, 'the stable signer signed a private bucket');
    assert.equal(stableDisplayUrlForStoredAsset('r2://setnayan-vendor-verification/v/id.jpg'), null, 'the stable signer signed a private bucket');
  });
});

/* ── 5 · the theme art reaches a guest signed ─────────────────────────────── */

test('5 · the theme ground is signed on the bucket host, never r2.dev', async () => {
  await withR2(async () => {
    const { resolveThemeGround } = await import('@/app/[slug]/_lib/theme-ground');
    const g = resolveThemeGround('cyber', { ownColours: false });
    assert.ok(g?.loop && g.poster, 'the cyber theme lost its loop');
    for (const u of [g!.loop!, g!.poster!]) {
      assert.doesNotMatch(u, /r2\.dev/, 'a theme file still reaches a guest at r2.dev');
      assert.match(u, /\.r2\.cloudflarestorage\.com\/.+X-Amz-Signature=/, 'a theme file is not signed on the bucket host');
      assert.ok(param(u, 'response-cache-control'), 'a theme file carries no Cache-Control');
    }
    assert.equal(resolveThemeGround('cyber', { ownColours: false })!.loop, g!.loop, 'the theme loop changes address per render');
  });
});

/* ── 6 · no guest-facing media at the public host ─────────────────────────── */

/** Guest-facing files that may still build a public-host URL — each with the reason it is not a guest's media. */
const PUBLIC_HOST_ALLOWED: Record<string, string> = {
  'app/[slug]/_lib/cover-scene-layer.ts': 'the lab fallback only — the guest page always passes `signed` (#6691 guard)',
  'app/[slug]/venue/page.tsx': 'Booth Studio logo inside a CACHED 3D scene payload; a signature would expire in the cache (lib/booth-studio.ts)',
  'app/api/venue-scene/[slug]/route.ts': 'the same cached Booth Studio scene payload',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

test('6 · no guest-facing file draws media at the public r2.dev host, except the named ones', () => {
  const PUBLIC_HOST = /(?<![\w$.])(publicUrlForStoredAsset|publicUrlFor|r2PublicUrl)\s*\(|process\.env\.R2_PUBLIC_URL|NEXT_PUBLIC_R2_PUBLIC_URL|\.r2\.dev/;
  const files = [...walk(join(WEB, 'app', '[slug]')), ...walk(join(WEB, 'app', 'api', 'venue-scene'))];
  assert.ok(files.length > 50, `only ${files.length} guest files scanned — the scan is blind`);
  const found = files
    .map((p) => relative(WEB, p).split(sep).join('/'))
    .filter((rel) => PUBLIC_HOST.test(read(rel)));
  const unknown = found.filter((f) => !(f in PUBLIC_HOST_ALLOWED)).sort();
  const stale = Object.keys(PUBLIC_HOST_ALLOWED).filter((f) => !found.includes(f)).sort();
  assert.deepEqual(unknown, [], `guest-facing media built at the public host: ${unknown.join(', ')}`);
  assert.deepEqual(stale, [], `allowed but no longer building a public URL — shrink the list: ${stale.join(', ')}`);
});

/* ── 7 · the hero asks for the screen-sized copy ──────────────────────────── */

test('7 · the Main background still is the screen-sized copy when one can be had', () => {
  const layer = /* the main background's two files — the layer draws, `main-ground-picture.ts` answers (2026-10-22) */ (read('app/[slug]/_lib/main-ground-layer.tsx') + '\n' + read('app/[slug]/_lib/main-ground-picture.ts'));
  // Per function, not per file: a file-wide count also counts the helper's own definition.
  const body = (start: string) => {
    const from = layer.indexOf(start);
    assert.ok(from >= 0, `${start} is gone — re-read this guard`);
    const next = layer.indexOf('\nfunction ', from + start.length);
    const nextAsync = layer.indexOf('\nasync function ', from + start.length);
    const nextExport = layer.indexOf('\nexport ', from + start.length);
    const ends = [next, nextAsync, nextExport].filter((i) => i > 0);
    return layer.slice(from, ends.length ? Math.min(...ends) : undefined);
  };
  for (const fn of ['async function mainGroundOf(', 'export async function mainGroundStillFor(']) {
    const n = (body(fn).match(/screenSizedStill\(/g) ?? []).length;
    console.log(`${fn} → ${n} screen-sized call(s)`);
    assert.ok(n >= 1, `${fn} draws the camera original — no screen-sized copy asked for`);
  }
  assert.match(layer, /displayUrlForStdBackground\(siteMediaServeRef\(ref\)\)/, 'the screen-sized copy is not produced by the one existing variant pipeline');
  const lib = read('lib/std-bg-image.ts');
  assert.match(lib, /VARIANT_KNOWN\.has\(variantKey\)/, 'every render HEADs R2 again for a copy it already found');
});
