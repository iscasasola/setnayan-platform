/**
 * theme-switch.test.ts — THE SWITCH WORKS, AND ITS DEFAULT IS LIGHT.
 *
 * Owner 2026-10-11: "dark mode should work." From 2026-06-04 until then the app was light-locked:
 * `ThemeProvider.setMode` was a no-op and the script in <head> only ever REMOVED `.dark`. This file
 * holds the switch that replaced the lock (`app/_components/theme-bootstrap-script.ts` — read its
 * docblock first; `app/_components/theme-provider.tsx`).
 *
 *   (1) THE INLINE SCRIPT, EXECUTED — the real string `app/layout.tsx` puts first in <head> is run
 *       against a stand-in document: the `sn-theme=dark` cookie puts `.dark` on <html> and tints
 *       the browser bar; no cookie, another cookie, a look-alike cookie or a cookie saying anything
 *       else leaves the page light AND strips a stale `.dark`; a document that throws does not
 *       throw out of the script. The device's own setting is offered (`matchMedia` answering "dark")
 *       and is never asked.
 *   (2) A STORED VALUE → WHAT IS DRAWN — only 'dark' is dark. 'auto' (the column's default, so
 *       nearly every account), 'light', null, undefined and junk are light.
 *   (3) THE COOKIE — Dark is remembered for a year; Light REMOVES the cookie (it exists only while
 *       Dark is chosen); what the script reads and what `themeFromCookie` reads agree on every case.
 *   (4) PAINT — `paintTheme` sets and clears the class and the bar's tint, and survives a page with
 *       no theme-color tag.
 *   (5) THE PROVIDER IS NOT LOCKED — its source no longer holds a frozen value or a no-op `setMode`;
 *       `setMode` paints, writes the cookie and holds the state; and the layout still injects the
 *       script first in <head>, from a module that is not 'use client'.
 *
 * NOT SHOWN HERE: a real browser. Driven in Chromium at 375 × 812 against the dev labs on
 * 2026-10-11 (the report of rd/dark-mode-foundation); Safari and a real phone were not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

import {
  THEME_COLOR,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  appliedTheme,
  paintTheme,
  themeBootstrapScript,
  themeCookieString,
  themeFromCookie,
} from '../app/_components/theme-bootstrap-script';
import { stripComments } from './strip-comments';
import { fakeDocument } from './theme-fake-document';

const WEB = join(__dirname, '..');

/** Run the real <head> script against a stand-in page. `matchMedia` says the DEVICE is dark, and counts being asked. */
function boot(cookie: string, startsDark = false) {
  const page = fakeDocument({ cookie, startsDark });
  let mediaAsked = 0;
  const win = {
    matchMedia: () => {
      mediaAsked += 1;
      return { matches: true };
    },
  };
  vm.runInNewContext(themeBootstrapScript, { document: page.doc, window: win, matchMedia: win.matchMedia });
  return { ...page, mediaAsked: () => mediaAsked };
}

test('(1) the <head> script: dark only with the sn-theme=dark cookie — never from the device, never from anything else', () => {
  for (const cookie of ['sn-theme=dark', 'a=1; sn-theme=dark', 'sn-theme=dark; b=2', 'a=1; sn-theme=dark; b=2', 'a=1;sn-theme=dark']) {
    const page = boot(cookie);
    assert.equal(page.isDark(), true, `"${cookie}" should draw dark`);
    assert.equal(page.meta.content, THEME_COLOR.dark, 'the browser bar is tinted to the dark ground');
    assert.equal(page.classes.has('font-var'), true, 'the other classes on <html> are left alone');
  }
  const light = ['', 'a=1', 'sn-theme=light', 'sn-theme=auto', 'sn-theme=', 'sn-theme=darker', 'sn-theme=DARK', 'xsn-theme=dark', 'sn-theme-old=dark', 'theme=dark', 'dark=1; sn-theme=light'];
  for (const cookie of light) {
    for (const startsDark of [false, true]) {
      const page = boot(cookie, startsDark);
      assert.equal(page.isDark(), false, `"${cookie}" (stale .dark: ${startsDark}) must draw light`);
      assert.equal(page.meta.content, THEME_COLOR.light, 'the browser bar is left as served');
      assert.equal(page.mediaAsked(), 0, 'the device\'s own setting was asked');
    }
  }
  assert.equal(boot('sn-theme=dark').mediaAsked(), 0);
  assert.doesNotMatch(themeBootstrapScript, /matchMedia|prefers-color-scheme|localStorage/, 'the script reads only the cookie');
  // A document that throws on every touch: the page must still load.
  const hostile = new Proxy({}, { get() { throw new Error('blocked'); } });
  assert.doesNotThrow(() => vm.runInNewContext(themeBootstrapScript, { document: hostile }));
});

test('(2) a stored value → what is drawn: only the word dark is dark', () => {
  assert.equal(appliedTheme('dark'), 'dark');
  for (const v of ['auto', 'light', null, undefined, '', 'DARK', 'dark ', 1, true, {}]) {
    assert.equal(appliedTheme(v), 'light', `${JSON.stringify(v)} must be light`);
  }
});

test('(3) the cookie: Dark kept a year, Light removes it, and the script and the reader agree', () => {
  assert.equal(THEME_COOKIE, 'sn-theme');
  assert.equal(themeCookieString('dark', false), `sn-theme=dark; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`);
  assert.equal(themeCookieString('dark', true), `sn-theme=dark; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax; secure`);
  assert.equal(themeCookieString('light', false), 'sn-theme=; path=/; max-age=0; samesite=lax');
  assert.equal(THEME_COOKIE_MAX_AGE, 31_536_000);

  const page = fakeDocument({ cookie: 'a=1' });
  page.doc.cookie = themeCookieString('dark', false);
  assert.equal(page.doc.cookie, 'a=1; sn-theme=dark');
  assert.equal(themeFromCookie(page.doc.cookie), 'dark');
  page.doc.cookie = themeCookieString('light', false);
  assert.equal(page.doc.cookie, 'a=1', 'choosing Light leaves no theme cookie behind');
  assert.equal(themeFromCookie(page.doc.cookie), 'light');

  for (const cookie of ['', 'sn-theme=dark', 'a=1; sn-theme=dark; b=2', 'a=1;sn-theme=dark', 'sn-theme=light', 'sn-theme=darker', 'xsn-theme=dark', 'sn-theme-old=dark', null, undefined]) {
    assert.equal(themeFromCookie(cookie), boot(cookie ?? '').isDark() ? 'dark' : 'light', `the reader and the script disagree on ${JSON.stringify(cookie)}`);
  }
});

test('(4) paintTheme sets and clears the class and the browser bar', () => {
  const page = fakeDocument();
  paintTheme('dark', page.doc);
  assert.equal(page.isDark(), true);
  assert.equal(page.meta.content, '#17160F');
  paintTheme('light', page.doc);
  assert.equal(page.isDark(), false);
  assert.equal(page.meta.content, '#FBFBFA');
  const bare = fakeDocument({ noMeta: true });
  assert.doesNotThrow(() => paintTheme('dark', bare.doc));
  assert.equal(bare.isDark(), true);
});

test('(5) the provider is a switch, not a lock — and the layout still boots it first in <head> from a plain module', () => {
  const provider = stripComments(readFileSync(join(WEB, 'app/_components/theme-provider.tsx'), 'utf8'));
  assert.doesNotMatch(provider, /LIGHT_LOCKED/, 'the frozen light value is back');
  assert.doesNotMatch(provider, /setMode:\s*\(\)\s*=>\s*\{\s*\}/, '`setMode` is a no-op again');
  assert.doesNotMatch(provider, /classList\.remove\(\s*['"]dark['"]\s*\)/, 'an effect strips `.dark` unconditionally again');
  const setMode = /const setMode = useCallback\(\(next: ThemeMode\) => \{([\s\S]*?)\}, \[\]\);/.exec(provider)?.[1] ?? '';
  assert.match(setMode, /paintTheme\(chosen, document\)/, 'setMode does not draw the theme');
  assert.match(setMode, /document\.cookie = themeCookieString\(chosen,/, 'setMode does not remember the theme');
  assert.match(setMode, /setTheme\(chosen\)/, 'setMode does not hold the theme');
  assert.match(setMode, /const chosen = appliedTheme\(next\)/, 'setMode must pass the choice through appliedTheme (auto → light)');
  assert.doesNotMatch(provider, /matchMedia|prefers-color-scheme/, 'the provider consults the device');

  const layout = readFileSync(join(WEB, 'app/layout.tsx'), 'utf8');
  const head = layout.slice(layout.indexOf('<head>'), layout.indexOf('</head>'));
  const scripts = [...head.matchAll(/<script[^>]*dangerouslySetInnerHTML=\{\{ __html: (\w+)/g)].map((m) => m[1]);
  assert.equal(scripts[0], 'themeBootstrapScript', 'the theme script must be the FIRST script in <head> (before first paint)');
  assert.match(layout, /import \{ themeBootstrapScript \} from '\.\/_components\/theme-bootstrap-script';/);
  assert.doesNotMatch(stripComments(readFileSync(join(WEB, 'app/_components/theme-bootstrap-script.ts'), 'utf8')), /^\s*['"]use client['"]/m, 'the script module became a client module (hydration error #418)');
  assert.match(stripComments(layout), /<html\s[^>]*suppressHydrationWarning/, '<html> must allow the class the script adds before hydration');
  // The root layout decides nothing about the theme on the server: no cookie read, so marketing pages stay static.
  assert.doesNotMatch(stripComments(layout), /cookies\(\)|next\/headers/, 'the root layout reads request data — every page just became dynamic');
});
