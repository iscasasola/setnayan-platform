/**
 * 🖥 THE DESKTOP MAKER NEVER REACHES A PHONE (owner 2026-10-15, "DESKTOP COVERS THE WHOLE APP", area 1 = the
 * Maker; `MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md`, all "A"). The new Maker's three desktop columns are the
 * phone's own tree laid out differently — so the one promise is that a phone (99 % of viewers) is exactly as it was.
 * Held four ways, each a way that promise breaks:
 *
 *   1 · ONE SWITCH, NEVER A PHONE'S — `data-maker-desk` is set only by the lazy `MakerDesk`, mounted only on a
 *       desktop's width; the shell carries none of it. (Since 2026-10-25 there is no flag: the columns are every
 *       desktop's — `lib/there-is-one-maker.test.ts`.)
 *   2 · EVERY DESK RULE NEEDS THAT SWITCH — every selector in the desk rule sets (`maker-desk.tsx`,
 *       `stage-panel/desk.tsx`) names `data-maker-desk`, so none can match a phone's page whatever it says.
 *   3 · THE DESK CODE IS LAZY — `MakerDesk` is mounted only by the lazy Stages | Studio switch, under `desk` (no
 *       stand-in in the Maker's first load), and the toolbar draws its desk pieces only under `desk`.
 *   4 · THE FIRST PAINT CARRIES NO DESK — the server render (what a phone paints first) never wears the desk switch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · one switch, never a phone’s — `desk` needs a desktop width', () => {
  const shell = read(`${L}/maker-shell.tsx`);
  assert.match(shell, /const wide = useIsDesktop\('lg'\);/);
  assert.match(shell, /const phone = !wide;/);
  assert.doesNotMatch(shell, /data-maker-desk/, 'the shell writes the desk switch itself — a byte of the desktop in the phone’s first load');
  /* The one place it is written: the lazy layout, on mount — and taken off on unmount. */
  const desk = read(`${L}/maker-desk.tsx`);
  assert.match(desk, /el\?\.setAttribute\('data-maker-desk', ''\);\s*return \(\) => el\?\.removeAttribute\('data-maker-desk'\);/);
  /* …mounted only by the Stages | Studio switch, only for the new Maker on a desktop's width. */
  const parts = read(`${L}/stages-studio-parts.tsx`);
  assert.match(parts, /const desk = useMaker\(\)\?\.stagesStudio === true && wide;/);
  assert.match(parts, /const wide = useIsDesktop\('lg'\);/);
});

/** Every selector of a rule set, split out of its `@media` blocks. */
function selectorsOf(css: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{/g;
  for (const m of css.matchAll(re)) {
    const head = m[1]!.trim();
    if (head.startsWith('@media') || head === '') continue;
    /* Split at TOP-LEVEL commas only — a selector list nests (`:is(a:has(b),c:has(> d))`, 2026-10-19). */
    let depth = 0;
    let cur = '';
    for (const ch of head) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
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
  assert.doesNotMatch(shell, /'\.\/maker-desk'|stage-panel\/desk/, 'the shell imports the desk code statically');
  assert.doesNotMatch(read(`${L}/details-lazy.tsx`), /'\.\/maker-desk'|stage-panel\/desk/, 'the desk code gained a stand-in in the Maker’s first load');
  /* Mounted by the lazy Stages | Studio switch, and only under `desk`. */
  assert.match(read(`${L}/details-lazy.tsx`), /export const StudioSideSwitch = dynamic\(/);
  const parts = read(`${L}/stages-studio-parts.tsx`);
  assert.match(parts, /\{desk \? <MakerDesk \/> : null\}/, 'the desk layout is mounted without `desk`');
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /const desk = useIsDesktop\('lg'\);/);
  assert.match(tools, /\{desk \? <DeskStep /, 'Previous · Next · Done is drawn without `desk`');
  assert.match(tools, /\{desk && !away \? \(\s*<DeskParts/, 'the parts column is drawn without `desk`');
  assert.match(tools, /\(desk \? STAGE_DESK_CSS : ''\)/, 'the desk rule set is written without `desk`');
});

async function paint(): Promise<string> {
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
        studio: { tiles: [] },
      },
      React.createElement('div', { 'data-stub': 'work' }),
    ),
  );
}

test('4 · the first paint carries no desk — the server render never wears the desk switch', async () => {
  /* ⏱ The bar holds `next/dynamic` parts (`details-lazy.tsx`): paint until two paints agree, so the loaded parts are
     the ones checked (2026-10-19, #6668). */
  let settled = await paint();
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 25));
    const again = await paint();
    if (again === settled) break;
    settled = again;
  }
  assert.ok(settled.includes('data-maker-shell=""') && settled.length > 2000, 'precondition: the shell was rendered');
  assert.ok(!settled.includes('data-maker-desk'), 'the first paint wears the desk switch');
});
