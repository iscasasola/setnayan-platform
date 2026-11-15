/**
 * 🗞✂ THE BLOG AND REAL STORIES ARE RETIRED — and nothing on the site still sends anyone there.
 *
 * Owner, 16 Nov 2026 (DECISION_LOG "THE BLOG AND REAL STORIES ARE RETIRED" + "RETIRED ADDRESSES FORWARD"):
 * *"we retired these blogs already"* · *"our real stories are retire but we created post event which are the new
 * stories"*, then "YES" to /blog → /features and /realstories → Discover. W1 had found /blog and /blog/[slug] still
 * serving on live 035086e, linked from the footer, the front page, the feature pages and the search box.
 *
 * This holds the claim itself, not a proxy for it:
 *   1. no shipped source carries an address under `/blog` or `/realstories` as a string — a link, a nav route, a
 *      notification URL, a sitemap or llms.txt row — except a FILE under public/ (a dot in the last segment: the
 *      sample photos and clips other screens still show);
 *   2. no nav slot routes there;
 *   3. the pages are gone;
 *   4. the old addresses forward, at every depth, to where the owner ruled — and the media files do not.
 *
 * Scope it does NOT cover, on purpose: the blog's own article corpus (`lib/blog.ts`, `lib/blog-batches/`), whose
 * bodies cross-link each other and which only the admin spotlight tool still reads — it renders nowhere public; and
 * `lib/legacy-redirects.ts`, which names the retired trees to forward them. Comments are stripped first.
 *
 * SABOTAGE (run 2026-11-16): putting `<Link href="/blog">Articles</Link>` back into `reskin-footer.tsx` turns test 1
 * red naming that file; changing the `/realstories` row of `RETIRED_TREES` to `/features` turns test 4 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { legacyRedirectTarget } from './legacy-redirects';
import { NAV_SLOT_DEFAULTS } from './nav-registry-defaults';
import { stripComments } from './strip-comments';

const WEB = path.resolve(import.meta.dirname, '..');

/** Files allowed to name the retired trees — each for a reason given in the docblock. */
const EXEMPT = new Set(['lib/blog.ts', 'lib/legacy-redirects.ts']);
const EXEMPT_DIRS = ['lib/blog-batches/'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.(ts|tsx|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * A string that STARTS with a retired address: `'/blog'`, `"/realstories/x"`, `` `/blog/${slug}` ``, an absolute
 * `https://…/realstories`, or one built on an origin — `` `${origin}/blog/${slug}` `` (the social sweep's shape). The address must end at the quote, a `/`, `?`, `#` or `${` — so `/blogger` is not it.
 */
const RETIRED_ADDRESS = /(?:['"`]|\})(?:https?:\/\/[^'"`/\s]+)?\/(blog|realstories)(?=['"`/?#]|\$\{)/g;

test('1 · no shipped source links /blog or /realstories', () => {
  const offenders: string[] = [];
  for (const root of ['app', 'components', 'lib']) {
    for (const file of walk(path.join(WEB, root))) {
      const rel = path.relative(WEB, file).split(path.sep).join('/');
      if (EXEMPT.has(rel) || EXEMPT_DIRS.some((d) => rel.startsWith(d))) continue;
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const m of src.matchAll(RETIRED_ADDRESS)) {
        // The WHOLE string, to its closing quote — a template like `/realstories/${clip}.mp4` ends in a file.
        const quote = m[0][0]!;
        const close = src.indexOf(quote, m.index! + 1);
        const literal = src.slice(m.index! + 1, close < 0 ? undefined : close).split(/[?#]/)[0]!;
        const last = literal.split('/').pop() ?? '';
        if (/\.[a-z0-9]{2,5}$/i.test(last)) continue; // a file under public/ (sample media), never a page
        const line = src.slice(0, m.index).split('\n').length;
        offenders.push(`${rel}:${line}  ${m[0]}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `these still send people to a retired page (it only forwards now):\n${offenders.join('\n')}`);
});

test('1b · the walk is pointed at something (a sabotage string is caught)', () => {
  const caught = (s: string) => [...s.matchAll(RETIRED_ADDRESS)].length > 0;
  assert.ok(caught(`<Link href="/blog">Articles</Link>`));
  assert.ok(caught('href={`/blog/${a.slug}`}'));
  assert.ok(caught(`relatedUrl: '/realstories#storytellers'`));
  assert.ok(caught("url('https://www.setnayan.com/realstories')"));
  assert.ok(caught('link_url: `${origin}/blog/${article.slug}`'), 'an origin-built URL is still a link');
  assert.ok(!caught(`href="/blogger"`), 'a neighbour that only shares letters must not count');
  assert.ok(!caught(`'/features'`));
});

test('2 · no nav slot routes to a retired page', () => {
  const bad = NAV_SLOT_DEFAULTS.filter((s) => /^\/(blog|realstories)(\/|$)/.test(s.route ?? ''));
  assert.deepEqual(bad.map((s) => s.key), []);
});

test('3 · the pages are gone', () => {
  for (const page of [
    'app/(shell)/blog/page.tsx',
    'app/blog/[slug]/page.tsx',
    'app/(shell)/realstories/page.tsx',
    'app/realstories/[slug]/page.tsx',
    'app/vendor-dashboard/real-stories/page.tsx',
    'app/sitemap-blog.xml/route.ts',
  ]) {
    assert.ok(!existsSync(path.join(WEB, page)), `${page} is back — the owner retired it`);
  }
});

test('4 · the old addresses forward where the owner ruled, at every depth — and the media does not', () => {
  for (const [from, to] of [
    ['/blog', '/features'],
    ['/blog/', '/features'],
    ['/blog/filipino-wedding-traditions-explained', '/features'],
    ['/realstories', '/'],
    ['/realstories/maria-and-juan-tagaytay-garden-wedding', '/'],
    ['/vendor-dashboard/real-stories', '/vendor-dashboard'],
  ] as const) {
    assert.equal(legacyRedirectTarget(from), to, `${from} must forward to ${to}`);
  }
  for (const file of ['/realstories/maria-juan-tagaytay.jpg', '/realstories/clips/mj-first-dance.mp4', '/blog/setnayan-wedding-checklist.pdf']) {
    assert.equal(legacyRedirectTarget(file), null, `${file} is a file — forwarding it would break the image/video`);
  }
});
