/**
 * the-nested-address-never-loops-or-eats-a-file.test.ts — two holes in the address move (PR #7868, Opus review
 * 2026-11-18), each measurable only with the cutover switch ON (`NEXT_PUBLIC_U_NESTING_CUTOVER`), which is exactly
 * when they would bite.
 *
 * 1. A REDIRECT LOOP. An event whose own word is a page word that is NOT reserved (`recap`, `welcome`, `seat`,
 *    `everyone`, `print`, `story` …) keeps its bare address (`nestableEventSlug`), so `publicEventPath` hands back
 *    `/{event}` itself. The page forwarded its bare request whenever the creator had a username — to itself, forever.
 *
 * 2. `bareNestingRewrite` READ EVERY 3-WORD PATH AS A NESTED EVENT. `/cipher/glyphs/a.json`,
 *    `/monogram-studio/fonts/x.ttf`, `/add-ons/demo/x.mp4` (real files under `public/`, which the middleware matcher
 *    does not skip) were rewritten to `/glyphs/a.json` → 404. And `/{anyone}/{event}/cached/{key}` was rewritten to the
 *    internal Event Hub copy, which the middleware otherwise refuses to the outside (`isHubViewPath`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bareNestingRewrite, nestableEventSlug, EVENT_SUB_ROUTES, SHOP_SUB_ROUTES } from './u-nesting';
import { eventPageForward } from './public-event-url';
import { RESERVED_SLUGS } from './reserved-slugs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const reserved = (w: string) => RESERVED_SLUGS.has(w);
const FLAG = 'NEXT_PUBLIC_U_NESTING_CUTOVER';

function withCutover<T>(fn: () => T): T {
  const was = process.env[FLAG];
  process.env[FLAG] = 'true';
  try {
    return fn();
  } finally {
    if (was === undefined) delete process.env[FLAG];
    else process.env[FLAG] = was;
  }
}

test('1 · a page-word event never forwards its bare address to itself', () => {
  withCutover(() => {
    const pageWords = [...EVENT_SUB_ROUTES, ...SHOP_SUB_ROUTES].filter((w) => /^[a-z0-9-]{3,32}$/.test(w) && !reserved(w));
    assert.ok(pageWords.length > 5, 'the scan is blind');
    for (const w of pageWords) {
      assert.ok(!nestableEventSlug(w));
      const to = eventPageForward(w, 'ana', false, null);
      assert.notEqual(to, `/${w}`, `/${w} forwards to itself — a redirect loop`);
      assert.equal(to, null);
    }
    // The ordinary cases still forward.
    assert.equal(eventPageForward('our-wedding', 'ana', false, null), '/ana/our-wedding');
    assert.equal(eventPageForward('our-wedding', null, false, null), null, 'no username → stays at the old address');
    assert.equal(eventPageForward('our-wedding', 'ana', true, 'ana'), null, 'the real address renders');
    assert.equal(eventPageForward('our-wedding', 'ana', true, 'old-name'), '/ana/our-wedding', 'a renamed username forwards');
    assert.equal(eventPageForward('our-wedding', null, true, 'someone'), '/our-wedding', 'no username → the old address');
  });
  const page = readFileSync(join(WEB, 'app', '[slug]', 'page.tsx'), 'utf8');
  assert.match(page, /eventPageForward\(event\.slug, ownerSlug, viaNesting, askedOwner\)/, 'the page decides its forward with eventPageForward');
});

test('2 · a file under public/ and the internal cached copy are never read as a nested event', () => {
  // Every real file under public/ at depth ≥ 3 that the middleware matcher does NOT skip.
  const skipped = /\.(svg|png|jpg|jpeg|gif|webp)$/i;
  const files: string[] = [];
  const walk = (dir: string, rel: string[]) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p, [...rel, n]);
      else if (rel.length >= 2 && !skipped.test(n)) files.push(`/${[...rel, n].join('/')}`);
    }
  };
  walk(join(WEB, 'public'), []);
  assert.ok(files.length > 10, `only ${files.length} public files found — the scan is blind`);
  for (const f of files) assert.equal(bareNestingRewrite(f, reserved), null, `${f} was rewritten as somebody's event`);

  assert.equal(bareNestingRewrite('/ana/our-wedding/cached/v2.abc', reserved), null, 'nesting reached the internal copy');
  assert.equal(bareNestingRewrite('/ana/our-wedding/not-a-page', reserved), null);
  // The real event pages still nest.
  assert.deepEqual(bareNestingRewrite('/ana/our-wedding/invite/enter', reserved), { eventPath: '/our-wedding/invite/enter', owner: 'ana' });
  assert.deepEqual(bareNestingRewrite('/ana/our-wedding/manifest.webmanifest', reserved), {
    eventPath: '/our-wedding/manifest.webmanifest',
    owner: 'ana',
  });
});
