/**
 * settings-v2-one-shell.test.ts — 🧭 SETTINGS V2, STEP 1 (owner 2026-11-13, *"one setting shell approved"*; prototype
 * `prototypes/approved_2026-11-13/settings-shell-fable.html` v3, § 2, § 7, § 8 and build notes § 13).
 *
 *   (1) rise is the ONLY frame of a ⚙: the `rise` switch is gone, and `inLayer` (the old sheet) has exactly ONE caller —
 *       the picked client, already a risen layer — until its in-place swap lands;
 *   (2) the head's save seat and the foot's waiting bar pass straight through to the one risen screen;
 *   (3) ONE section heading (`SettingsSection`, `home-k2`) on the screens ported in this step — no local caps heading,
 *       no icon tile in front of a Shop settings row, and Shop's notification switch out of its fold;
 *   (4) a short supplier settings screen ends with the doors to the others (`?gear=1`), never a dead end;
 *   (5) the save seat says nothing at rest, "Saving…", "Saved ✓", "Not saved".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { SETTINGS_ENTRY, SUPPLIER_SETTINGS_DOORS } from './menu-settings';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
(globalThis as unknown as { React: unknown }).React = React;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

const PORTED = [
  'app/vendor-dashboard/_components/today-settings.tsx',
  'app/vendor-dashboard/on-the-day/_components/hub-settings.tsx',
  'app/vendor-dashboard/shop/_components/shop-settings-rows.tsx',
];

test('(1) rise is the only frame; `inLayer` has no caller (the picked client rises, 17 Nov)', () => {
  const door = read('app/_components/menu-settings-button.tsx');
  assert.doesNotMatch(door, /\brise\??:\s*boolean/, 'the `rise` switch is back');
  const callers = walk(join(WEB, 'app'))
    .filter((p) => /<MenuSettingsButton\b[^>]*\binLayer\b/.test(stripComments(readFileSync(p, 'utf8'))))
    .map((p) => relative(WEB, p));
  // main bf8998a1 (17 Nov, "the client gear rises full screen like the other gear sheets") took the picked client off
  // the sheet too, so `inLayer` now has NO caller — every ⚙ rises.
  assert.deepEqual(callers, [], 'a ⚙ opens the old sheet (`inLayer`) — the picked client rises since 17 Nov');
  const rise = walk(join(WEB, 'app')).filter((p) => /<MenuSettingsButton\b[^>]*\srise[\s>]/.test(stripComments(readFileSync(p, 'utf8'))));
  assert.deepEqual(rise, [], 'a caller still passes the retired `rise` switch');
});

test('(2) the save seat and the waiting bar pass through to the one risen screen', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MenuSettingsButton } = await import('@/app/_components/menu-settings-button');
  const html = renderToStaticMarkup(
    React.createElement(
      MenuSettingsButton,
      {
        menu: 'today',
        open: true,
        onOpenChange: () => {},
        state: React.createElement('span', { 'data-probe-state': '' }, 'Saving…'),
        thumb: React.createElement('span', { 'data-probe-thumb': '' }, 'Apply'),
      },
      React.createElement('p', null, 'rows'),
    ),
  );
  assert.match(html, /data-rise-screen="settings-today"/);
  const head = html.slice(html.indexOf('data-rise-head'), html.indexOf('data-rise-body'));
  assert.match(head, /data-probe-state/, 'the save seat is not in the head');
  assert.match(html.slice(html.indexOf('data-rise-thumb')), /data-probe-thumb/, 'the waiting bar is not in the thumb zone');
  assert.match(head, new RegExp(SETTINGS_ENTRY.today.sheet), 'the screen is not headed by the menu’s own name');
});

test('(3) one section heading on the ported screens; no icon tiles; Shop’s push switch out of its fold', () => {
  const section = read('app/_components/settings/settings-section.tsx');
  assert.match(section, /className="home-k2 /, 'the one heading is not the shipped home-k2');
  for (const f of PORTED) {
    const src = read(f);
    assert.match(src, /<SettingsSection title=/, `${f} does not use the one section heading`);
    assert.doesNotMatch(src, /<p className="home-k2|font-mono[^"]*uppercase|tracking-\[0\.1[48]em\][^"]*uppercase/, `${f} draws its own caps heading`);
  }
  const shop = read('app/vendor-dashboard/shop/_components/shop-settings-rows.tsx');
  assert.doesNotMatch(shop, /\blead=\{/, 'a Shop settings row has an icon tile again');
  assert.doesNotMatch(shop, /<Fold\b[^>]*anchor="notifications"/, 'the notification switch is back in a fold');
  assert.match(shop, /id="notifications"/, 'the #notifications deep link lost its place');
  for (const t of ['Your page', 'Plan and team', 'Papers']) assert.match(shop, new RegExp(`<SettingsSection title="${t}"`), `Shop settings lost its "${t}" heading`);
});

test('(4) a short supplier settings screen ends with the doors to the others', () => {
  assert.deepEqual(SUPPLIER_SETTINGS_DOORS.map((d) => d.href), ['/vendor-dashboard/shop?gear=1', '/vendor-dashboard/customers?gear=1']);
  for (const d of SUPPLIER_SETTINGS_DOORS) assert.equal(d.name, SETTINGS_ENTRY[d.key].sheet, `${d.key}'s door retypes its name`);
  assert.match(read('app/vendor-dashboard/_components/today-settings.tsx'), /<MoreSupplierSettings except="today" \/>/);
  assert.match(read('app/vendor-dashboard/on-the-day/_components/hub-settings.tsx'), /<MoreSupplierSettings except="supplier-hub" \/>/);
});

test('(5) the save seat: quiet at rest, Saving…, Saved ✓, Not saved', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SettingsSaveState } = await import('@/app/_components/settings/settings-section');
  const say = (state: 'idle' | 'saving' | 'saved' | 'failed') => renderToStaticMarkup(React.createElement(SettingsSaveState, { state }));
  assert.match(say('idle'), /<span[^>]*role="status"[^>]*><\/span>/, 'something is said at rest');
  assert.match(say('saving'), />Saving…</);
  assert.match(say('saved'), />Saved ✓</);
  assert.match(say('failed'), />Not saved</);
  assert.match(read('lib/help/settings-shell.ts'), /slug: 'how-settings-open-and-save'/);
});

test('(6) the help answer promises the doors only where they ship — the supplier’s short screens, never a couple’s', async () => {
  const { SETTINGS_SHELL_TOPICS } = await import('./help/settings-shell');
  for (const topic of SETTINGS_SHELL_TOPICS) {
    if (!topic.roles.includes('couple')) continue;
    for (const a of topic.articles) {
      for (const sentence of a.body.split(/(?<=\.)\s+/)) {
        if (/links to your other settings/i.test(sentence)) {
          assert.match(sentence, /\bsupplier\b/i, `"${sentence}" tells a couple their short settings screens end with doors — only the supplier's do`);
        }
      }
    }
  }
});
