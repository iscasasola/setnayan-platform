/**
 * FINAL CHECK A1-166 (25 Nov 2026): with no signal, the help answers come from the last copy (or Setnayan's offline
 * page), never the browser's blank error. Phase B saw `/help`, `/help/<slug>` and `/help/topics/<key>` blank offline.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sw = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8');

test('help navigations are kept network-first with an offline fallback', () => {
  assert.match(sw, /const HELP_CACHE = `setnayan-help-\$\{VERSION\}`;/);
  assert.match(sw, /KNOWN_CACHES = \[[\s\S]*HELP_CACHE,[\s\S]*\];/, 'the help cache would be deleted on activate');
  const branch = sw.slice(sw.indexOf("request.method === 'GET' && isHelpNavigation(url)"));
  assert.ok(branch.length > 0, 'no help branch in the fetch handler');
  assert.match(branch.slice(0, 900), /caches\.match\(request\)\.then\(\(c\) => c \?\? caches\.match\('\/offline\.html'\)\)/);
});

test('the help matcher keeps answer pages, never a ?error= or ?submitted= page', () => {
  const fnSrc = sw.slice(sw.indexOf('function isHelpNavigation(url)'), sw.indexOf('function isDayOfGuestNavigation(url)'));
  const isHelp = new Function('self', `${fnSrc}; return isHelpNavigation;`)({ location: { origin: 'https://www.setnayan.com' } }) as (u: URL) => boolean;
  assert.equal(isHelp(new URL('https://www.setnayan.com/help')), true);
  assert.equal(isHelp(new URL('https://www.setnayan.com/help/what-is-setnayan')), true);
  assert.equal(isHelp(new URL('https://www.setnayan.com/help/topics/about-setnayan')), true);
  assert.equal(isHelp(new URL('https://www.setnayan.com/help?error=missing')), false);
  assert.equal(isHelp(new URL('https://www.setnayan.com/helpdesk')), false);
  assert.equal(isHelp(new URL('https://evil.example/help')), false);
});
