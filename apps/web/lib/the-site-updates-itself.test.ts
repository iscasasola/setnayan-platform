/**
 * 🔄 THE SITE UPDATES BY ITSELF WHEN NOTHING IS TYPED (owner ruling 22e93e56, 16 Nov 2026).
 *
 * Three promises, each executed here against the real decision functions (`lib/build-version.ts`) and pinned in the
 * one component that acts on them (`app/_components/stale-tab-notice.tsx`):
 *   1. a newer served version + nothing typed → the page updates itself (no notice);
 *   2. anything typed → it NEVER reloads; the notice stays for that case only;
 *   3. never twice: one self-update per served version, claimed before reloading.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  SELF_UPDATE_KEY_PREFIX,
  claimSelfUpdate,
  fieldIsDirty,
  hasUnsavedTyping,
  staleTabAction,
} from './build-version';

const OLD = '496bdc4';
const NEW = '06f9ab2';

function memory() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}
const input = (over: Record<string, unknown> = {}) => ({ tagName: 'INPUT', type: 'text', value: '', defaultValue: '', isConnected: true, ...over });
const page = (fields: object[], activeElement: unknown = null) => ({ activeElement, querySelectorAll: () => fields });

/* ── 1 · nothing typed → it updates itself ── */

test('a newer version on a page with nothing typed updates itself — once claimed, with no notice', () => {
  const clean = page([input({ value: 'Maria', defaultValue: 'Maria' }), input({ type: 'hidden', value: 'x', defaultValue: '' }), { tagName: 'BUTTON' }], { tagName: 'BUTTON' });
  assert.equal(hasUnsavedTyping(clean), false, 'a drawn value, a hidden field and a focused button are not typing');
  assert.equal(staleTabAction({ loaded: OLD, serving: NEW, typing: false, selfUpdateUsed: false }), 'update');
  const s = memory();
  assert.equal(claimSelfUpdate(s, NEW), true, 'the update is claimed');
  assert.equal(s.m.get(SELF_UPDATE_KEY_PREFIX + NEW), '1');
  assert.equal(staleTabAction({ loaded: NEW, serving: NEW, typing: false, selfUpdateUsed: false }), 'none', 'current → nothing');
});

test('the component takes the update: on the tab shown again, or as the next in-app link becoming a full load', () => {
  const src = stripComments(readFileSync(join(__dirname, '..', 'app', '_components', 'stale-tab-notice.tsx'), 'utf8'));
  assert.match(src, /staleTabAction\(\{[\s\S]{0,200}typing: typing\(\)/, 'the decision reads the typing check');
  assert.match(src, /if \(shown && claimSelfUpdate\(tabStorage\(\), serving\)\) window\.location\.reload\(\)/, 'tab shown → reload, after the claim');
  assert.match(src, /if \(!claimSelfUpdate\(tabStorage\(\), serving\)\) return;\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*window\.location\.assign\(href\)/, 'link press → full load, after the claim');
  assert.match(src, /document\.addEventListener\('click', onClick, true\)/, 'caught before the router (capture)');
  assert.match(src, /void check\(false\)/, 'the mount check never reloads by itself');
});

/* ── 2 · typing → never reloads ── */

test('anything typed counts — and a page with typing gets the notice, never a reload', () => {
  assert.equal(hasUnsavedTyping(page([input({ value: 'Maria Sa', defaultValue: '' })])), true, 'a dirty input');
  assert.equal(hasUnsavedTyping(page([], { tagName: 'TEXTAREA', value: '', defaultValue: '' })), true, 'a focused textarea');
  assert.equal(hasUnsavedTyping(page([], { tagName: 'DIV', isContentEditable: true })), true, 'a focused contenteditable');
  const controlled = input({ value: 'Jose', defaultValue: 'Jose' }); // React keeps the default in step
  assert.equal(hasUnsavedTyping(page([controlled]), (el) => el === controlled), true, 'a controlled field typed into');
  assert.equal(hasUnsavedTyping(page([{ ...controlled, isConnected: false }]), () => true), false, 'gone with its page');
  assert.equal(fieldIsDirty({ tagName: 'INPUT', type: 'checkbox', checked: true, defaultChecked: false }), true);
  assert.equal(fieldIsDirty({ tagName: 'SELECT', options: [{ selected: true, defaultSelected: false }] }), true);
  assert.equal(staleTabAction({ loaded: OLD, serving: NEW, typing: true, selfUpdateUsed: false }), 'notice');
});

test('the component never reloads past the typing check', () => {
  const src = stripComments(readFileSync(join(__dirname, '..', 'app', '_components', 'stale-tab-notice.tsx'), 'utf8'));
  const click = src.slice(src.indexOf('const onClick'), src.indexOf('document.addEventListener'));
  assert.ok(click.indexOf('if (typing())') > -1 && click.indexOf('if (typing())') < click.indexOf('window.location.assign'), 'the link press checks typing first');
  const reloads = src.match(/window\.location\.(reload|assign)\(/g) ?? [];
  console.log(`  ${reloads.length} reload points: 1 self-update on show · 1 link press · 1 the notice's own button`);
  assert.equal(reloads.length, 3);
  assert.match(src, /onClick=\{\(\) => \{\s*setReloading\(true\);\s*window\.location\.reload\(\);\s*\}\}/, 'the third is the notice button the person presses');
});

/*
  ⏳ LIVE FAULT (app_telemetry_logs, DEAD_TAP "Reload" · "nothing happened within 2s", 6× on the Suppliers tab and on
  admin, the shop, Launch and the Event Hub editor, 18–23 Nov). `window.location.reload()` changes nothing on screen
  until the new page arrives — on a phone's slow line, seconds of a button that looked dead. The press must say it is
  working AT ONCE, in the button itself, before the reload is asked. Sabotage: drop `setReloading(true)` or the
  "Reloading…" word → red.
*/
test('the notice\'s Reload says "Reloading…" the moment it is pressed — never a button that looks dead', () => {
  const src = stripComments(readFileSync(join(__dirname, '..', 'app', '_components', 'stale-tab-notice.tsx'), 'utf8'));
  assert.match(src, /<ActionButton\b[\s\S]{0,200}icon=\{RotateCw\}/, 'the notice button is the one house button');
  assert.match(src, /label=\{reloading \? 'Reloading…' : 'Reload'\}/, 'the word changes on the press');
  assert.match(src, /waiting=\{reloading\}/, 'a second press does nothing while the page is on its way');
  const press = src.slice(src.indexOf('setReloading(true)'), src.indexOf('window.location.reload();', src.indexOf('setReloading(true)')));
  assert.ok(src.includes('setReloading(true)') && press.length > 0, 'the busy state is set BEFORE the reload is asked');
  assert.doesNotMatch(src, /<button\b[^>]*>\s*Reload\s*<\/button>/, 'a hand-made Reload button is back');
});

/* ── 3 · never twice ── */

test('no double reload: one self-update per served version; storage that cannot remember never self-updates', () => {
  const s = memory();
  assert.equal(claimSelfUpdate(s, NEW), true);
  assert.equal(claimSelfUpdate(s, NEW), false, 'the second claim for the same version is refused');
  assert.equal(staleTabAction({ loaded: OLD, serving: NEW, typing: false, selfUpdateUsed: true }), 'notice', 'spent → the notice');
  assert.equal(claimSelfUpdate(s, 'a1b2c3d'), true, 'a NEWER deploy is a new fact');
  assert.equal(claimSelfUpdate(null, NEW), false);
  const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(claimSelfUpdate(throwing, NEW), false);
  const forgetful = { getItem: () => null, setItem: () => undefined };
  assert.equal(claimSelfUpdate(forgetful, NEW), false, 'a write that does not stick cannot promise once');
});
