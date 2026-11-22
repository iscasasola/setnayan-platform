/**
 * appearance-control.test.ts — THE APPEARANCE CONTROL, DRIVEN.
 *
 * "Appearance" is ONE dropdown, Light · Dark, in account settings › Preferences (owner 2026-10-07; "dark mode
 * should work", 2026-10-11): `app/dashboard/(account)/profile/_components/appearance-choice.tsx`. What a pick does
 * is `chooseAppearance` (lib/appearance.ts), and this file runs it for real against a stand-in page whose `setMode`
 * is the provider's own three steps (`lib/theme-switch.test.ts` (5) holds the provider to exactly those).
 *
 *   (1) CHOOSE DARK → the action is called once with theme=dark, this device's cookie is set, <html> has `.dark`,
 *       the browser bar is dark — and the page had ALREADY changed when the save began ("the page changes at once").
 *   (2) CHOOSE LIGHT → all three undone: the action is called with theme=light, the cookie is gone, `.dark` is gone.
 *   (3) A SAVE THAT FAILS IS NOT LEFT LOOKING SAVED — the page goes back, the cookie goes back, the caller is told.
 *   (4) PICKING WHAT IS ALREADY DRAWN saves nothing and changes nothing.
 *   (5) A STORED 'auto' RENDERS LIGHT — through the provider on the server, through what the page hands the control,
 *       and through what a signed-in layout adopts; and the account wins over a stale cookie in both directions.
 *   (6) THE CONTROL IS THE ONE DROPDOWN, WITH THE OTHER SETTINGS — the shipped PickMenu, two choices, no "auto", no
 *       pills; rendered inside the Preferences pane; the page reads `theme_preference`; the action sets the cookie
 *       only after the save and removes it for Light; the three signed-in layouts hand the account's value down.
 *
 * NOT SHOWN HERE: the control in a browser on the signed-in profile page (it needs an account) — see the report.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { APPEARANCE_OPTIONS, chooseAppearance } from './appearance';
import { THEME_COLOR, appliedTheme, paintTheme, themeCookieString, themeFromCookie, themeToAdopt, type AppliedTheme } from '../app/_components/theme-bootstrap-script';
import { ThemeProvider, useTheme } from '../app/_components/theme-provider';
import { stripComments } from './strip-comments';
import { fakeDocument } from './theme-fake-document';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

/** A page, the provider's `setMode` over it, and an action that records what it was sent and what the page looked like then. */
function rig(opts: { startsDark?: boolean; failing?: boolean } = {}) {
  const page = fakeDocument(opts.startsDark ? { cookie: 'a=1; sn-theme=dark', startsDark: true } : { cookie: 'a=1' });
  const drawn: AppliedTheme[] = [];
  const setMode = (chosen: AppliedTheme) => {
    paintTheme(chosen, page.doc);
    page.doc.cookie = themeCookieString(chosen, false);
    drawn.push(chosen);
  };
  const calls: { theme: FormDataEntryValue | null; pageWasDark: boolean; cookieThen: string }[] = [];
  const action = async (formData: FormData) => {
    calls.push({ theme: formData.get('theme'), pageWasDark: page.isDark(), cookieThen: page.doc.cookie });
    if (opts.failing) throw new Error('the database said no');
  };
  return { page, setMode, action, calls, drawn };
}

test('(1) choose Dark → the action is called with dark, the cookie is set, <html> has .dark — and the page changed first', async () => {
  const r = rig();
  const outcome = await chooseAppearance('dark', { current: 'light', setMode: r.setMode, action: r.action });
  assert.deepEqual(outcome, { saved: true, theme: 'dark' });
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0]!.theme, 'dark');
  assert.equal(r.calls[0]!.pageWasDark, true, 'the save began before the page changed');
  assert.equal(r.calls[0]!.cookieThen, 'a=1; sn-theme=dark');
  assert.equal(r.page.isDark(), true);
  assert.equal(r.page.doc.cookie, 'a=1; sn-theme=dark');
  assert.equal(themeFromCookie(r.page.doc.cookie), 'dark');
  assert.equal(r.page.meta.content, THEME_COLOR.dark);
});

test('(2) choose Light → all three undone', async () => {
  const r = rig({ startsDark: true });
  assert.equal(r.page.isDark(), true);
  const outcome = await chooseAppearance('light', { current: 'dark', setMode: r.setMode, action: r.action });
  assert.deepEqual(outcome, { saved: true, theme: 'light' });
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0]!.theme, 'light');
  assert.equal(r.page.isDark(), false);
  assert.equal(r.page.doc.cookie, 'a=1', 'the theme cookie is still on the device');
  assert.equal(r.page.meta.content, THEME_COLOR.light);
});

test('(3) a save that fails is undone and reported — in both directions', async () => {
  const toDark = rig({ failing: true });
  assert.deepEqual(await chooseAppearance('dark', { current: 'light', setMode: toDark.setMode, action: toDark.action }), { saved: false, theme: 'light' });
  assert.equal(toDark.calls.length, 1);
  assert.deepEqual(toDark.drawn, ['dark', 'light'], 'it should change at once, then go back');
  assert.equal(toDark.page.isDark(), false);
  assert.equal(toDark.page.doc.cookie, 'a=1');

  const toLight = rig({ startsDark: true, failing: true });
  assert.deepEqual(await chooseAppearance('light', { current: 'dark', setMode: toLight.setMode, action: toLight.action }), { saved: false, theme: 'dark' });
  assert.equal(toLight.page.isDark(), true);
  assert.equal(themeFromCookie(toLight.page.doc.cookie), 'dark');
});

test('(4) picking what is already drawn saves nothing; a value that is not a theme is Light', async () => {
  const r = rig({ startsDark: true });
  assert.deepEqual(await chooseAppearance('dark', { current: 'dark', setMode: r.setMode, action: r.action }), { saved: true, theme: 'dark' });
  assert.equal(r.calls.length, 0);
  assert.deepEqual(r.drawn, []);
  await chooseAppearance('auto', { current: 'dark', setMode: r.setMode, action: r.action });
  assert.equal(r.calls[0]!.theme, 'light', '"auto" must never be sent or drawn as anything but light');
  assert.equal(r.page.isDark(), false);
});

test("(5) a stored 'auto' renders light — on the server, in the control, and on a signed-in page", () => {
  const Probe = () => React.createElement('i', { 'data-theme': useTheme().resolvedTheme, 'data-mode': useTheme().mode });
  const render = (initialMode?: 'light' | 'dark' | 'auto') => renderToStaticMarkup(React.createElement(ThemeProvider, { initialMode, children: React.createElement(Probe) }));
  assert.equal(render('auto'), '<i data-theme="light" data-mode="light"></i>');
  assert.equal(render(undefined), '<i data-theme="light" data-mode="light"></i>');
  assert.equal(render('light'), '<i data-theme="light" data-mode="light"></i>');
  assert.equal(render('dark'), '<i data-theme="dark" data-mode="dark"></i>', 'the probe cannot see dark — the three above prove nothing');

  // What the profile page hands the control.
  assert.equal(appliedTheme('auto'), 'light');
  // What a signed-in layout does with the account's value: nothing when they agree, the account when they do not.
  assert.equal(themeToAdopt('auto', ''), null);
  assert.equal(themeToAdopt('auto', 'a=1'), null);
  assert.equal(themeToAdopt('light', ''), null);
  assert.equal(themeToAdopt('dark', 'sn-theme=dark'), null);
  assert.equal(themeToAdopt('dark', ''), 'dark', 'a new device must follow an account that chose Dark');
  assert.equal(themeToAdopt('auto', 'sn-theme=dark'), 'light', 'a stale Dark cookie must not outlive an account that says auto');
  assert.equal(themeToAdopt('light', 'sn-theme=dark'), 'light');
  // A read that did not answer is not a choice of Light.
  assert.equal(themeToAdopt(undefined, 'sn-theme=dark'), null);
  assert.equal(themeToAdopt(null, 'sn-theme=dark'), null);
});

test('(6) the control is ONE dropdown with two choices, in Preferences; the page, the action and the layouts are wired', () => {
  assert.deepEqual(APPEARANCE_OPTIONS.map((o) => [o.key, o.label]), [['light', 'Light'], ['dark', 'Dark']]);

  const control = stripComments(read('app/dashboard/(account)/profile/_components/appearance-choice.tsx'));
  assert.match(control, /import \{ PickMenu \} from '@\/app\/dashboard\/\[eventId\]\/website\/editor\/_components\/pick-menu';/, 'not the shipped PickMenu');
  assert.equal(control.split('<PickMenu').length - 1, 1, 'ONE dropdown');
  assert.match(control, /<PickMenu label="Appearance" value=\{shown\} options=\{APPEARANCE_OPTIONS\} onPick=\{pick\}/);
  assert.doesNotMatch(control, /PillTrack|PillButton|PillSelector|role="radio"|type="radio"|<select/, 'a set of choices is one dropdown, never pills');
  assert.match(control, /chooseAppearance\(key, \{ current: shown, setMode, action: updateThemePreference \}\)/);
  assert.match(control, /role="alert"/, 'a failed save says nothing');

  const page = read('app/dashboard/(account)/profile/page.tsx');
  const pane = page.slice(page.indexOf('const preferencesPane = ('), page.indexOf('const accountPane = ('));
  assert.ok(pane.length > 200, 'the Preferences pane was not found');
  assert.equal(page.split('<AppearanceChoice').length - 1, 1);
  assert.match(pane, /<AppearanceChoice stored=\{appliedTheme\(profile\?\.theme_preference\)\} \/>/, 'Appearance is not in Preferences, or is not handed the stored value through appliedTheme');
  const select = /\.from\('users'\)\s*\.select\(\s*'([^']+)'/.exec(page)?.[1] ?? '';
  assert.match(select, /(?:^|, )theme_preference(?:,|$)/, 'the page does not read users.theme_preference');

  const actions = stripComments(read('app/dashboard/(account)/profile/actions.ts'));
  const body = actions.slice(actions.indexOf('export async function updateThemePreference'), actions.indexOf('export async function updatePersonalInfo'));
  const failAt = body.indexOf('if (error) throw new Error(error.message);');
  const setAt = body.indexOf("jar.set(THEME_COOKIE, 'dark'");
  const deleteAt = body.indexOf('jar.delete(THEME_COOKIE)');
  assert.ok(failAt > 0 && setAt > failAt && deleteAt > failAt, 'the cookie must be written only after the save succeeded');
  assert.match(body, /if \(appliedTheme\(raw\) === 'dark'\) \{/, 'only Dark may set the cookie');
  assert.match(body, /httpOnly: false/, 'the <head> script must be able to read the cookie');

  for (const layout of ['app/dashboard/layout.tsx', 'app/vendor-dashboard/layout.tsx', 'app/admin/layout.tsx']) {
    const src = read(layout);
    assert.match(src, /<ThemeFromAccount stored=\{profile\?\.theme_preference\} \/>/, `${layout} does not hand the account's theme down`);
    assert.match(src, /tour_seen_keys(?:, terms_accepted_at, created_at)?, theme_preference'/, `${layout} does not read users.theme_preference`);
  }
});
