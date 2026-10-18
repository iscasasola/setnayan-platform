/**
 * 🖥 THE DESKTOP MAKER NEVER REACHES A PHONE (owner 2026-10-15, "DESKTOP COVERS THE WHOLE APP", area 1 = the
 * Maker; `MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md`, all "A"). The new Maker's three desktop columns are the
 * phone's own tree laid out differently — so the one promise is that a phone (99 % of viewers) is exactly as it was.
 * Held four ways, each a way that promise breaks:
 *
 *   1 · ONE SWITCH, NEVER A PHONE'S — the shell wears `data-maker-desk` only when `desk`, and `desk` needs a
 *       desktop's width (`!phone`); the launch page asks the flag once and hands the boolean in.
 *   2 · EVERY DESK RULE NEEDS THAT SWITCH — every selector in the desk rule sets (`maker-desk.tsx`,
 *       `stage-panel/desk.tsx`) names `data-maker-desk`, so none can match a phone's page whatever it says.
 *   3 · THE DESK CODE IS LAZY — `MakerDesk` reaches the shell only through `details-lazy.tsx` (a phone never
 *       downloads it), and the toolbar draws its desk pieces only under `desk`.
 *   4 · THE FIRST PAINT IS THE SAME — the server render (what a phone paints first) with the desktop columns ON is
 *       byte-identical to the render with them OFF.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { makerDesktopColumnsEnabled } from './maker-desktop-columns-flag';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const KEY = 'NEXT_PUBLIC_MAKER_DESKTOP_COLUMNS_ENABLED';

test('1 · one switch, never a phone’s — `desk` needs a desktop width, and the launch page decides once', () => {
  const shell = read(`${L}/maker-shell.tsx`);
  assert.match(shell, /const wide = useIsDesktop\('lg'\);/);
  assert.match(shell, /const phone = !wide;/);
  assert.match(shell, /const ss = stagesStudio && \(phone \|\| desktopColumns\);/, 'the new Maker no longer needs the flag');
  assert.match(shell, /const desk = ss && !phone;/, '`desk` no longer needs a desktop width');
  assert.match(shell, /data-maker-desk=\{desk \? '' : undefined\}/, 'the shell wears the desk switch without `desk`');
  assert.equal((shell.match(/data-maker-desk\b/g) ?? []).length, 1, 'the desk switch is written in more than one place');
  assert.match(shell, /\{desk \? <MakerDesk \/> : null\}/, 'the desk layout is mounted without `desk`');
  assert.match(shell, /\bdesktopColumns = false,/, 'MakerShell no longer defaults to today’s desktop');
  const page = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(page, /const desktopColumns = stagesStudio && makerDesktopColumnsEnabled\(\{ internal: freeSwitch\.offered \}\);/);
  assert.match(page, /\bdesktopColumns=\{desktopColumns\}/);
  const prev = process.env[KEY];
  delete process.env[KEY];
  try {
    assert.equal(makerDesktopColumnsEnabled({ internal: false }), false, 'with the env unset a couple gets the desktop columns');
    assert.equal(makerDesktopColumnsEnabled({ internal: true }), true, 'an internal viewer does not get them to check');
  } finally {
    if (prev !== undefined) process.env[KEY] = prev;
  }
});

/** Every selector of a rule set, split out of its `@media` blocks. */
function selectorsOf(css: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{/g;
  for (const m of css.matchAll(re)) {
    const head = m[1]!.trim();
    if (head.startsWith('@media') || head === '') continue;
    out.push(...head.split(/,(?![^(]*\))/).map((s) => s.trim()));
  }
  return out;
}

test('2 · every desk rule needs the switch — no selector can match a phone’s page', async () => {
  const { MAKER_DESK_CSS } = await import(`../${L}/maker-desk`);
  const { STAGE_DESK_CSS } = await import(`../${L}/stage-panel/desk`);
  for (const [name, css] of [['MAKER_DESK_CSS', MAKER_DESK_CSS], ['STAGE_DESK_CSS', STAGE_DESK_CSS]] as const) {
    const sels = selectorsOf(css);
    assert.ok(sels.length > 10, `${name}: precondition — its rules were read (${sels.length})`);
    for (const s of sels) assert.match(s, /\[data-maker-desk\]/, `${name}: "${s}" can match a phone`);
  }
});

test('3 · the desk code is lazy — a phone never downloads it, and the toolbar draws its desk pieces only on a desktop', () => {
  const shell = read(`${L}/maker-shell.tsx`);
  assert.doesNotMatch(shell, /from '\.\/maker-desk'|stage-panel\/desk/, 'the shell imports the desk code statically');
  assert.match(read(`${L}/details-lazy.tsx`), /export const MakerDesk = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/maker-desk'\)/);
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /const desk = maker\?\.desk === true;/);
  assert.match(tools, /\{desk \? <DeskStep /, 'Previous · Next · Done is drawn without `desk`');
  assert.match(tools, /\{desk && !away \? \(\s*<DeskParts/, 'the parts column is drawn without `desk`');
  assert.match(tools, /\(desk \? STAGE_DESK_CSS : ''\)/, 'the desk rule set is written without `desk`');
});

async function paint(desktopColumns: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerShell } = await import(`../${L}/maker-shell`);
  return renderToStaticMarkup(
    React.createElement(
      MakerShell as unknown as React.ComponentType<Record<string, unknown>>,
      {
        eventId: 'ev-1',
        slug: 'maria-and-jose',
        liveStage: 'rsvp',
        initialStage: 'invitation',
        initialSelection: null,
        storeShell: false,
        tourSlides: [],
        firstVisit: false,
        completeTourAction: async () => {},
        renderStamp: '1',
        more: null,
        hasWork: true,
        applySlot: null,
        details: null,
        stagesStudio: true,
        desktopColumns,
        studio: { tiles: [] },
      },
      React.createElement('div', { 'data-stub': 'work' }),
    ),
  );
}

test('4 · the first paint is the same — the desktop columns ON render byte-identical to OFF', async () => {
  const off = await paint(false);
  const on = await paint(true);
  assert.ok(off.includes('data-maker-shell=""') && off.length > 2000, 'precondition: the shell was rendered');
  assert.ok(!on.includes('data-maker-desk'), 'the first paint wears the desk switch');
  assert.equal(on, off, 'the first paint changed with the desktop columns on');
});
