/**
 * GUARD — the front page downloads the JavaScript it draws, not its neighbours'.
 *
 * Measured 2026-11-13 on a production build with the repo's own Lighthouse profile (`.lighthouserc.json`: mobile,
 * simulated 150 ms RTT / 1.6 Mbps / 4× CPU). Lighthouse's simulator counts every byte requested before the LCP, and
 * three kinds of script the signed-out front page never runs were in its HTML:
 *
 *   1. THE (shell) LAYOUT'S CHUNKS. `FrontDoorShell` is rendered by both `/` and `app/(shell)/layout`; Next merges
 *      the root group's client-reference chunk lists with `Object.assign`, the `(shell)` layout recorded last, so `/`
 *      shipped `app/(shell)/layout-*.js` + `one-copy-_shell_layout-*.js` (~37KB gz). Fix: the front page has its own
 *      reference, `front-door-shell-for-home.tsx`, imported by nothing else.
 *   2. SIGNED-IN-ONLY CLIENT CODE. A `'use client'` module imported by the page's server tree is in the page's first
 *      load whether or not it renders. The signed-in search's "Add your own" walk and Discover's thumb row are now
 *      `next/dynamic` (still server-rendered when drawn) in `front-door-lazy.tsx`.
 *   3. THE `buffer` POLYFILL. A client module importing from `lib/account-jars.ts` (whose server helpers name the
 *      global `Buffer`) makes webpack ship ~17KB gz of `buffer`. Client code imports `lib/account-sign-out-path.ts`.
 *   4. THE SUPPLIER VIEW. `MarketplaceView` draws only with a supplier parameter on `/`, but its client pieces were in
 *      every `/`'s first load (sticky header + filter drawer ~27KB gz, a 268-icon map ~24KB gz). `marketplace-lazy.tsx`.
 *
 * Source-level on purpose: the unit suite has no build. Comments are stripped before every match.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const strip = stripComments;
const code = (rel: string) => strip(readFileSync(join(WEB, rel), 'utf8'));
const FD = 'app/_components/frontdoor';

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const ALL = () => ['app', 'lib', 'components'].flatMap((d) => sources(join(WEB, d)));

test('1 · the front page renders FrontDoorShell through its own reference, which nothing else imports', () => {
  const fd = code(`${FD}/front-door.tsx`);
  assert.match(fd, /import \{ FrontDoorShell \} from '\.\/front-door-shell-for-home';/);
  assert.doesNotMatch(fd, /from '\.\/front-door-shell'/, 'front-door.tsx imports the shared FrontDoorShell reference again');
  const own = code(`${FD}/front-door-shell-for-home.tsx`);
  assert.match(own, /^\s*'use client';/, 'the front page reference must be a client module of its own');
  const importers = ALL()
    .filter((f) => /front-door-shell-for-home['"]/.test(strip(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  assert.deepEqual(importers, [`${FD}/front-door.tsx`], `only front-door.tsx may import it — another entry would share its chunk list`);
});

test('2 · signed-in-only pieces reach the front page through next/dynamic, never a static import', () => {
  for (const f of [`${FD}/front-door.tsx`, `${FD}/front-door-results.tsx`]) {
    const src = code(f);
    assert.doesNotMatch(src, /from '\.\/(discover-add-own|shell-thumb-rows)'/, `${f} imports a signed-in-only module statically`);
  }
  assert.match(code(`${FD}/front-door-results.tsx`), /import \{ DiscoverAddOwn \} from '\.\/front-door-lazy';/);
  assert.match(code(`${FD}/front-door.tsx`), /import \{ DiscoverThumbRow \} from '\.\/front-door-lazy';/);
  const lazy = code(`${FD}/front-door-lazy.tsx`);
  assert.match(lazy, /^\s*'use client';/);
  assert.match(lazy, /DiscoverAddOwn = dynamic\(\(\) => import\('\.\/discover-add-own'\)/);
  assert.match(lazy, /DiscoverThumbRow = dynamic\(\(\) => import\('\.\/shell-thumb-rows'\)/);
  assert.doesNotMatch(lazy, /ssr:\s*false/, 'ssr:false would change what the server draws — keep them server-rendered');
  assert.doesNotMatch(lazy, /^import [^;]* from '\.\/(discover-add-own|shell-thumb-rows)'/m, 'a static import puts it back in the first load');
});

test('3 · no client module imports lib/account-jars (it names Buffer, which ships the buffer polyfill)', () => {
  const offenders = ALL()
    .filter((f) => {
      const src = strip(readFileSync(f, 'utf8'));
      return /^\s*['"]use client['"]/.test(src) && /from ['"](@\/lib|\.\.?(\/\.\.)*\/lib|\.)\/account-jars['"]/.test(src);
    })
    .map((f) => relative(WEB, f));
  assert.deepEqual(offenders, [], 'import signOutAllAction from @/lib/account-sign-out-path instead');
  assert.doesNotMatch(code('lib/account-sign-out-path.ts'), /\bBuffer\b/, 'the browser-safe module must not name Buffer');
  assert.match(code('app/_components/account-switcher/account-switcher.tsx'), /from '@\/lib\/account-sign-out-path'/);
});

test("4 · the supplier view's heavy client pieces reach the front page through next/dynamic", () => {
  const mv = code('app/(shell)/explore/_lib/marketplace-view.tsx');
  for (const m of ['sticky-marketplace-header', 'icon-tile-folder-strip', 'vendors-availability-banner', 'event-type-notify-form']) {
    assert.doesNotMatch(
      mv,
      new RegExp(`^import \\{[^}]*\\} from '\\.\\./_components/${m}';`, 'm'),
      `marketplace-view.tsx imports ${m} statically — it would join every front page's first load`,
    );
  }
  const lazy = code('app/(shell)/explore/_components/marketplace-lazy.tsx');
  assert.match(lazy, /^\s*'use client';/);
  for (const m of ['sticky-marketplace-header', 'icon-tile-folder-strip', 'vendors-availability-banner', 'event-type-notify-form']) {
    assert.match(lazy, new RegExp(`dynamic\\(\\(\\) =>\\s*import\\('\\./${m}'\\)`), `${m} is not loaded through next/dynamic`);
  }
  assert.doesNotMatch(lazy, /ssr:\s*false/, 'keep them server-rendered');
});
