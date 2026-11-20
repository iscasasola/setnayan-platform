/**
 * 🛡 A REVEAL NEVER LEAVES CONTENT BLANK (walker D7 on live f8f278f, 18 Nov 2026: after a jump-scroll Home's
 * `.sn-reveal` sections sat blank about 1 s). Red on main, where nothing finishes an off-screen reveal.
 * SABOTAGE: drop the mount pass, the hashchange listener or the layout's mount → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the watcher finishes off-screen reveals at once, and every reveal on a jump', () => {
  const c = src('app/_components/reveal-what-is-seen.tsx');
  assert.match(c, /querySelectorAll\('\.sn-reveal'\)\.forEach\(\(el\) => offScreen\(el\) && finish\(el\)\)/);
  assert.match(c, /a\.finish\(\)/);
  assert.match(c, /new MutationObserver/, 'content that streams in later is not covered');
  assert.match(c, /addEventListener\('hashchange', showAll\)/);
  assert.match(c, /Math\.abs\(y - last\) > window\.innerHeight \* 0\.75\) showAll\(\)/);
});

test('Home and Discover both mount it — inside the (hub) layout\'s one <main>', () => {
  const hub = src('app/(hub)/layout.tsx');
  const main = hub.slice(hub.indexOf('<main'), hub.indexOf('</main>'));
  assert.match(main, /<RevealWhatIsSeen \/>/);
});

test('the reveal it finishes is still the opacity-0 entrance it is written against', () => {
  const css = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
  assert.match(css, /@keyframes sn-rise\s*\{ from \{ opacity:0;/);
  assert.match(css, /\.sn-reveal \{ animation: sn-rise var\(--sn-dur-enter\) both/);
});
