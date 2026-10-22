/**
 * every-share-card-has-a-picture.test.ts — a page that writes its own share card keeps the picture.
 *
 * ── THE DEFECT (live check 2026-10-23) ──────────────────────────────────────
 * /features, /tl/features, /pricing, /explore and /for-suppliers shipped with NO `og:image`, so a link
 * pasted into Messenger or Viber previewed as a bare grey box. The root layout declares the 1200×630
 * brand card, but Next.js merges metadata SHALLOWLY: a page that declares its own `openGraph` (or
 * `twitter`) object REPLACES the layout's whole object, `images` included. Every page that gave itself
 * a title and a description silently gave up the picture.
 *
 * ── THE PROPERTY ────────────────────────────────────────────────────────────
 * Every `openGraph: { … }` object written in a page, layout or metadata module under `app/` names `images` —
 * its own, or the brand card from `lib/brand-og.ts`. A `twitter: { … }` object names its own too, OR sits in a
 * file whose every `openGraph` does (X falls back to `og:image` when `twitter:image` is absent; a twitter object
 * with no picture beside an openGraph with none is the blank card). Read from the source with comments stripped
 * and braces balanced, so the explanation of the fix is never the finding.
 *
 * KNOWN, NOT YET FIXED — each named with why it is not this PR's: an entry that stops being true fails
 * too, so the list can only shrink.
 *
 * SABOTAGE: delete `images: BRAND_OG_IMAGES,` from app/(shell)/pricing/page.tsx → RED.
 * SABOTAGE: delete `images: BRAND_TWITTER_IMAGES,` from app/(shell)/explore/page.tsx → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { BRAND_OG_IMAGES, BRAND_OG_IMAGE_URL, BRAND_TWITTER_IMAGES } from '@/lib/brand-og';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(WEB, 'app');

const KNOWN: Readonly<Record<string, string>> = {
  'app/(shell)/acceptable-use/page.tsx': 'legal page — legal text has its own review; not this sweep',
  'app/(shell)/cookies/page.tsx': 'legal page — owned by the privacy-pages PR in flight',
  'app/(shell)/privacy/page.tsx': 'legal page — owned by the privacy-pages PR in flight (rd/privacy-pages-say-what-is-true)',
  'app/(shell)/terms/page.tsx': 'legal page — owned by the privacy-pages PR in flight',
  'app/(shell)/refunds/page.tsx': 'legal page — #6798 just reworded it; the owner approves those words first',
  'app/v/[slug]/booth/page.tsx': "an event's booth page — its picture should be the event's own card, not the brand card",
};

function walk(p: string): string[] {
  const s = statSync(p);
  if (s.isDirectory()) return readdirSync(p).flatMap((n) => walk(join(p, n)));
  return /\.(tsx?)$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : [];
}

/** The body of every `<key>: { … }` object in `src`, braces balanced (strings are not parsed — none of these hold one). */
function objects(src: string, key: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\b${key}\\s*:\\s*\\{`, 'g');
  for (const m of src.matchAll(re)) {
    let depth = 0;
    const start = (m.index ?? 0) + m[0].length - 1;
    for (let i = start; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) {
        out.push(src.slice(start + 1, i));
        break;
      }
    }
  }
  return out;
}

/** Only the object's OWN keys — a nested `{ images }` deeper down does not count. */
function namesImages(body: string): boolean {
  let depth = 0;
  let top = '';
  for (const ch of body) {
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') depth--;
    else if (depth === 0) top += ch;
  }
  return /(?:^|[\s,])images\s*(?::|,|$)/.test(top);
}

function missing(): string[] {
  const out: string[] = [];
  for (const f of walk(APP)) {
    const src = stripComments(readFileSync(f, 'utf8'));
    if (!/\b(?:metadata|generateMetadata)\b/.test(src) && !/Metadata\b/.test(src)) continue;
    const rel = relative(WEB, f).split(sep).join('/');
    const og = objects(src, 'openGraph');
    const ogAll = og.length > 0 && og.every(namesImages);
    for (const body of og) if (!namesImages(body)) out.push(`${rel} · openGraph`);
    for (const body of objects(src, 'twitter')) if (!namesImages(body) && !ogAll) out.push(`${rel} · twitter`);
  }
  return [...new Set(out)].sort();
}

test('the brand card is the 1200×630 file the root layout shows', () => {
  assert.equal(BRAND_OG_IMAGES[0]!.url, BRAND_OG_IMAGE_URL);
  assert.deepEqual(BRAND_TWITTER_IMAGES, [BRAND_OG_IMAGE_URL]);
  assert.equal(BRAND_OG_IMAGES[0]!.width, 1200);
  assert.equal(BRAND_OG_IMAGES[0]!.height, 630);
  const layout = stripComments(readFileSync(join(APP, 'layout.tsx'), 'utf8'));
  assert.ok(layout.includes(`'${BRAND_OG_IMAGE_URL}'`), 'the root layout no longer shows this card — the fallback moved');
  statSync(join(WEB, 'public', BRAND_OG_IMAGE_URL.replace(/^\//, ''))); // throws if the file is gone
});

test('the reader sees an object with and without its own images', () => {
  const [withImg] = objects("openGraph: { title: 'x', images: BRAND_OG_IMAGES, url: '/a' }", 'openGraph');
  const [without] = objects("openGraph: { title: 'x', url: '/a', alternates: { images: 1 } }", 'openGraph');
  const [shorthand] = objects('openGraph: { title, images }', 'openGraph');
  assert.equal(namesImages(withImg!), true);
  assert.equal(namesImages(without!), false, 'a nested images key is not the share picture');
  assert.equal(namesImages(shorthand!), true);
});

test('every page that writes its own share card names its picture', () => {
  const all = missing();
  const files = new Set(all.map((m) => m.split(' · ')[0]!));
  const bad = all.filter((m) => !(m.split(' · ')[0]! in KNOWN));
  console.log(`[share-card] ${all.length} card(s) without a picture · ${bad.length} not known`);
  assert.deepEqual(
    bad,
    [],
    'A page declares its own openGraph / twitter object without `images`, which REPLACES the layout\'s brand ' +
      "card — a shared link previews blank. Add `images: BRAND_OG_IMAGES` (twitter: `BRAND_TWITTER_IMAGES`) from lib/brand-og.ts.",
  );
  for (const f of ['app/(shell)/features/(hub)/page.tsx', 'app/(shell)/tl/features/(hub)/page.tsx', 'app/(shell)/pricing/page.tsx', 'app/(shell)/explore/page.tsx', 'app/for-suppliers/page.tsx']) {
    assert.ok(!files.has(f), `${f} — one of the five the live check found blank`);
  }
  const stale = Object.keys(KNOWN).filter((k) => !files.has(k));
  assert.deepEqual(stale, [], 'A KNOWN page now has its picture (or moved) — delete its entry so the list only shrinks.');
});
