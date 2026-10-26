/**
 * NO RENDER IS READ, AND EVERY SIGN OF AN EVENT'S WEBSITE MEDIA GOES THROUGH A
 * PINNED DOOR — derived from the source tree, not from a list of the call sites
 * that exist today.
 *
 * 🗑 Mood Board renders were RETIRED 2026-10-26 (owner: "can we delete that?").
 * Their serve module, its doors and rule A ("only the serve module reads the
 * render bucket") went with them, and the render tables were dropped
 * (migration 20271289858095), so:
 *
 *   B · no raw read or sign CALL may take a render key column (`image_key` /
 *       `gallery_image_key`) in its arguments — there is no exemption any more.
 *       Held per CALL, not per file: a file that exports render rows as data
 *       (the RA 10173 export) and signs something unrelated is not an
 *       offender, and a file-level test would have to exempt it blind;
 *   C · a file that reads a couple-writable website-media column AND calls the
 *       resolver must route through `@/lib/site-media-ref` — and every direct
 *       `displayUrlForStoredAsset(<… that column …>)` call must wrap it;
 *   D · the website-media doors are actually used (positive control, so a
 *       refactor that deletes a call site cannot leave this vacuously green).
 *
 * Source is comment-stripped with the repo's ONE stripper (lib/strip-comments).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');

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

test('B · no raw read or sign call is handed a render key column', () => {
  const offenders: string[] = [];
  let scanned = 0;
  for (const s of sources()) {
    if (!RENDER_KEY_COLUMN.test(s.code)) continue;
    for (const fn of RAW_READ_OR_SIGN_FNS) {
      for (const arg of callArgs(s.code, fn)) {
        scanned += 1;
        if (RENDER_KEY_COLUMN.test(arg)) offenders.push(`${s.rel}: ${fn}(${arg.replace(/\s+/g, ' ').trim()})`);
      }
    }
  }
  /* No anti-vacuity floor any more: the render tables were dropped (migration 20271289858095) and no file holds a render
     key, so `scanned` is legitimately 0. The offender check stays — it is what fires if a render key ever comes back. */
  void scanned;
  assert.deepEqual(offenders, [], `renders are retired — nothing may read or sign a render key:\n${offenders.join('\n')}`);
});

test('C · website media is held to the public bucket wherever it is signed', () => {
  const missingImport: string[] = [];
  const unwrapped: string[] = [];
  for (const s of sources()) {
    if (!SITE_MEDIA_COLUMN.test(s.code) || !SITE_RESOLVER.test(s.code)) continue;
    // `@/lib/event-hero` (`resolveHero`) wraps the hero columns in
    // `siteMediaServeRef` itself — it is the one hero resolver (Maker Phase 6).
    if (!s.code.includes('@/lib/site-media-ref') && !s.code.includes('@/lib/event-hero')) missingImport.push(s.rel);
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

test('D · the pinned website-media doors are what the surfaces actually call (anti-vacuity)', () => {
  const byRel = new Map(sources().map((s) => [s.rel, s.code] as const));
  const expect: Array<[string, string]> = [
    ['app/[slug]/_lib/loaders.ts', 'siteMediaServeRef('],
    ['lib/showcase-db.ts', 'siteMediaServeRef('],
  ];
  for (const [rel, call] of expect) {
    const code = byRel.get(rel);
    assert.ok(code, `${rel} is gone — move this expectation with the surface`);
    assert.ok(code.includes(call), `${rel} no longer calls ${call}`);
  }
});
