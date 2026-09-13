/**
 * EVERY READ OF A RENDER, AND EVERY SIGN OF AN EVENT'S WEBSITE MEDIA, GOES
 * THROUGH A PINNED DOOR — derived from the source tree, not from a list of the
 * call sites that exist today.
 *
 * The rules (lib/moodboard-render-keys.ts, lib/site-media-ref.ts) are unit
 * tested beside themselves. What they cannot say is that nobody reads storage
 * AROUND them. So:
 *
 *   A · a file that names the render bucket (`RENDER_BUCKET_KEY`) may not call
 *       a raw read primitive — only `lib/moodboard-render-serve.ts` may;
 *   B · no raw read or sign CALL may take a render key column (`image_key` /
 *       `gallery_image_key`) in its arguments — same one exemption. Held per
 *       CALL, not per file: a file that exports render rows as data (the
 *       RA 10173 export) and signs something unrelated is not an offender, and
 *       a file-level test would have to exempt it blind;
 *   C · a file that reads a couple-writable website-media column AND calls the
 *       resolver must route through `@/lib/site-media-ref` — and every direct
 *       `displayUrlForStoredAsset(<… that column …>)` call must wrap it;
 *   D · the doors are actually used where renders are shown (positive control,
 *       so a refactor that deletes a call site cannot leave this vacuously
 *       green).
 *
 * Source is comment-stripped with the repo's ONE stripper (lib/strip-comments).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const SERVE_MODULE = 'lib/moodboard-render-serve.ts';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

type Src = { rel: string; code: string };
function sources(): Src[] {
  return [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))].map((p) => ({
    rel: relative(WEB, p).split(sep).join('/'),
    code: stripComments(readFileSync(p, 'utf8')),
  }));
}

const RAW_READ = /\b(r2SignedGet|r2GetBytes|presignDisplayUrl)\s*\(/;
const RAW_READ_OR_SIGN_FNS = [
  'r2SignedGet',
  'r2GetBytes',
  'presignDisplayUrl',
  'displayUrlForStoredAsset',
  'displayUrlsForStoredAssets',
  'presignClientRef',
];
const RENDER_KEY_COLUMN = /\b(image_key|gallery_image_key)\b/;
const SITE_MEDIA_COLUMN = /\b(landing_page_hero_image_url|landing_page_hero_video_r2_key|site_bg_music_r2_key|our_photos)\b/;
const SITE_RESOLVER = /\b(displayUrlForStoredAsset|displayUrlForStdBackground|displayUrlsForStoredAssets)\s*\(/;

/** Every `fn(` call's balanced argument text. */
function callArgs(code: string, fn: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\b${fn}\\s*\\(`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < code.length && depth > 0; i += 1) {
      if (code[i] === '(') depth += 1;
      else if (code[i] === ')') depth -= 1;
    }
    out.push(code.slice(start, i - 1));
  }
  return out;
}

test('A · only the serve module reads the render bucket with a raw primitive', () => {
  const offenders = sources()
    .filter((s) => s.rel !== SERVE_MODULE && /\bRENDER_BUCKET_KEY\b/.test(s.code) && RAW_READ.test(s.code))
    .map((s) => s.rel);
  assert.deepEqual(offenders, [], `read the render bucket through lib/moodboard-render-serve.ts: ${offenders.join(', ')}`);
});

test('B · no raw read or sign call is handed a render key column', () => {
  const offenders: string[] = [];
  let scanned = 0;
  for (const s of sources()) {
    if (s.rel === SERVE_MODULE || !RENDER_KEY_COLUMN.test(s.code)) continue;
    for (const fn of RAW_READ_OR_SIGN_FNS) {
      for (const arg of callArgs(s.code, fn)) {
        scanned += 1;
        if (RENDER_KEY_COLUMN.test(arg)) offenders.push(`${s.rel}: ${fn}(${arg.replace(/\s+/g, ' ').trim()})`);
      }
    }
  }
  assert.ok(scanned > 0, 'anti-vacuity: files that hold render keys do make storage calls — none were scanned');
  assert.deepEqual(offenders, [], `sign a render key through lib/moodboard-render-serve.ts:\n${offenders.join('\n')}`);
});

test('C · website media is held to the public bucket wherever it is signed', () => {
  const missingImport: string[] = [];
  const unwrapped: string[] = [];
  for (const s of sources()) {
    if (!SITE_MEDIA_COLUMN.test(s.code) || !SITE_RESOLVER.test(s.code)) continue;
    if (!s.code.includes('@/lib/site-media-ref')) missingImport.push(s.rel);
    for (const fn of ['displayUrlForStoredAsset', 'displayUrlForStdBackground', 'displayUrlsForStoredAssets']) {
      for (const arg of callArgs(s.code, fn)) {
        if (SITE_MEDIA_COLUMN.test(arg) && !/\bsiteMediaServeRefs?\s*\(/.test(arg)) {
          unwrapped.push(`${s.rel}: ${fn}(${arg.replace(/\s+/g, ' ').trim()})`);
        }
      }
    }
  }
  assert.deepEqual(missingImport, [], `signs website media without lib/site-media-ref: ${missingImport.join(', ')}`);
  assert.deepEqual(unwrapped, [], `website media signed without siteMediaServeRef:\n${unwrapped.join('\n')}`);
});

test('D · the pinned doors are what the render surfaces actually call (anti-vacuity)', () => {
  const byRel = new Map(sources().map((s) => [s.rel, s.code] as const));
  const expect: Array<[string, string]> = [
    ['app/dashboard/[eventId]/studio/mood-board/page.tsx', 'signOwnRenderImage('],
    ['app/admin/moodboard-renders/page.tsx', 'signOwnRenderImage('],
    ['app/dashboard/[eventId]/studio/mood-board/render-actions.ts', 'signOwnRenderImage('],
    ['app/dashboard/[eventId]/studio/mood-board/actions.ts', 'signPooledGalleryImage('],
    ['app/dashboard/[eventId]/studio/mood-board/actions.ts', 'readPooledGalleryBytes('],
    ['app/[slug]/_lib/loaders.ts', 'siteMediaServeRef('],
    ['lib/showcase-db.ts', 'siteMediaServeRef('],
  ];
  for (const [rel, call] of expect) {
    const code = byRel.get(rel);
    assert.ok(code, `${rel} is gone — move this expectation with the surface`);
    assert.ok(code.includes(call), `${rel} no longer calls ${call}`);
  }
  // And the doors themselves ask the question before touching storage.
  const serve = byRel.get(SERVE_MODULE)!;
  for (const door of ['signOwnRenderImage', 'signPooledGalleryImage', 'readPooledGalleryBytes']) {
    const body = serve.slice(serve.indexOf(`function ${door}`));
    const next = body.indexOf('export async function', 10);
    const own = next > 0 ? body.slice(0, next) : body;
    const ask = own.search(/\bis(Own|Pooled)Render\w*Key\(/);
    const touch = own.search(/\br2(SignedGet|GetBytes)\(/);
    assert.ok(ask > 0 && touch > ask, `${door} must check the key BEFORE it reads storage`);
  }
});
