/**
 * 🧭 THE NEW MAKER SHIPS DARK — "Stages | Studio" (owner 2026-10-06; plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 1, "held by
 * `lib/maker-stages-studio-ships-dark.test.ts` from PR 1 on").
 *
 * A flag-dark feature makes one promise: flag OFF (and not an internal viewer)
 * renders exactly what couples have today. Held here four ways:
 *
 *   1 · THE DECISION — the launch page resolves the flag ONCE, from the env and
 *       the internal reading View-as-free already made, and hands `MakerShell`
 *       that one boolean. Hard-code it (`= true`) and this goes red.
 *   2 · FLAG OFF, RENDERED — the shell draws the shipped bar (`MAKER_TOOLBAR`),
 *       the shipped lower third (`MAKER_LT_HEIGHT`, its two-group menu) and none
 *       of the new chrome: no Stages | Studio, no grab handle, no item ▾, no Studio.
 *   3 · THE NEW CHROME IS UNREACHABLE WITH IT OFF — Studio's home is a lazy piece
 *       (`details-lazy.tsx`, never a static import) drawn only under `ss`, which
 *       needs `stagesStudio`; the one bottom sheet is handed down only when on.
 *   4 · FLAG ON, RENDERED — a phone's bar is `MAKER_TOOLBAR_STAGES_STUDIO`
 *       (✕ · Stages | Studio · ↺ · ✓): Page ▾, Event Details and 👁 Preview are
 *       a desktop's only.
 *
 * (Measured once by hand on 2026-10-06: the flag-off render of eight Maker
 * states was byte-identical to origin/main's — including React's ids.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { makerStagesStudioEnabled } from './maker-stages-studio-flag';
import { MAKER_LT_HEIGHT } from './maker-phone-room';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const KEY = 'NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED';

function envOff<T>(fn: () => T): T {
  const prev = process.env[KEY];
  delete process.env[KEY];
  try {
    return fn();
  } finally {
    if (prev !== undefined) process.env[KEY] = prev;
  }
}

async function paint(stagesStudio: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerShell } = await import(`../${L}/maker-shell`);
  const { useMaker } = await import(`../${L}/maker-context`);
  function DraftStandIn() {
    const maker = useMaker();
    return React.createElement(
      'div',
      { className: 'contents' },
      React.createElement('button', { 'data-maker-tool': 'undo' }, 'Undo'),
      maker?.previewMenu ?? null,
      React.createElement('button', { 'data-maker-tool': 'apply' }, 'Apply'),
    );
  }
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
        applySlot: React.createElement(DraftStandIn),
        details: { page: React.createElement('div', { 'data-stub': 'details-page' }), controls: null },
        stagesStudio,
        studio: { tiles: [] },
      },
      React.createElement('div', { 'data-stub': 'work' }),
    ),
  );
}

const headerOf = (html: string) => {
  const start = html.indexOf('<header data-maker-toolbar=""');
  assert.ok(start >= 0, 'the toolbar was not rendered');
  return html.slice(start, html.indexOf('</header>', start));
};
const toolsOf = (html: string) => [...headerOf(html).matchAll(/data-maker-tool="([^"]+)"/g)].map((m) => m[1]);

test('1 · the launch page decides ONCE — the env or an internal viewer — and hands the shell that one boolean', () => {
  const page = read('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(
    page,
    /const stagesStudio = hasWork && makerStagesStudioEnabled\(\{ internal: freeSwitch\.offered \}\);/,
    'the launch page no longer asks makerStagesStudioEnabled (with the internal reading) — a hard-coded value ships the new Maker to every couple',
  );
  assert.equal((page.match(/makerStagesStudioEnabled\(/g) ?? []).length, 1, 'the flag is asked more than once on the page');
  assert.match(page, /\bstagesStudio=\{stagesStudio\}/, 'the shell is not handed the decision');
  assert.match(page, /const freeSwitch = await viewAsFreeSwitch\(\);/, 'the internal reading moved — re-read this guard');
  const shell = read(`${L}/maker-shell.tsx`);
  assert.match(shell, /\bstagesStudio = false,/, 'MakerShell no longer defaults to the shipped Maker');
  assert.doesNotMatch(shell, /process\.env|makerStagesStudioEnabled/, 'the shell reads the flag itself — the launch page is the one place it is decided');
  envOff(() => assert.equal(makerStagesStudioEnabled({ internal: false }), false, 'with the env unset a couple gets the new Maker'));
});

test('2 · flag OFF (not internal): the shipped bar, the shipped lower third — none of the new chrome', async () => {
  const off = envOff(() => makerStagesStudioEnabled({ internal: false }));
  assert.equal(off, false);
  const { MAKER_TOOLBAR } = await import(`../${L}/maker-bar`);
  const html = await paint(off);
  assert.deepEqual(toolsOf(html), [...MAKER_TOOLBAR], 'flag off, the bar is not the shipped MAKER_TOOLBAR');
  assert.ok(html.includes(`--maker-lt-h:${MAKER_LT_HEIGHT}`), 'flag off, the lower third is not MAKER_LT_HEIGHT');
  assert.match(html, /data-lt-menu-button=""/, 'flag off, the shipped menu ▾ is gone');
  assert.match(html, /data-lt-menu-group="global"/, 'flag off, the menu lost its two groups');
  assert.match(html, /data-maker-screen-label=""/, 'flag off, the bar lost the screen you are on');
  for (const mark of ['data-maker-tool="side"', 'data-lt-grab', 'data-lt-item-menu', 'data-maker-studio', 'data-studio-home', 'data-maker-sheet']) {
    assert.ok(!html.includes(mark), `flag off, the new Maker's "${mark}" is drawn`);
  }
});

test('3 · the new chrome is unreachable with the flag off — Studio is a lazy piece drawn only under the flag', () => {
  const shell = read(`${L}/maker-shell.tsx`);
  // `ss` is the only door, and it needs the flag (a phone's only).
  assert.match(shell, /const ss = stagesStudio && phone;/);
  assert.match(shell, /const studioOn = ss && side === 'studio';/);
  assert.match(shell, /const studioHomeOn = studioOn && studioAt === 'home';/);
  assert.match(shell, /const studioTile = studioOn && /);
  assert.equal((shell.match(/<StudioCover\b/g) ?? []).length, 1);
  assert.match(shell, /\{studioHomeOn \? \(\s*<StudioCover\b/, 'Studio\'s home is drawn outside its flag-gated door');
  /* No title row under the top bar any more (owner 2026-10-08, "we will not have these."): only ✓ Done, on the two
     pages that hide the top nav — behind the same flag-gated door. */
  assert.match(shell, /\) : studioImmersive \? \(\s*<StudioDoneBar\b/, 'the full-screen pages\' ✓ Done is drawn outside its flag-gated door');
  assert.doesNotMatch(shell, /StudioToolRow/, 'the title row is back under the top bar');
  assert.match(shell, /const ltItemMenu = !ss \? null :/, 'the item ▾ is drawn without the flag');
  /* PR 2: on the Stages side the lower third's top slot is the Stages panel (`stage-tools.tsx`) — the same `ss` door. */
  assert.match(
    shell,
    /grab=\{ss \? side === 'stages' \? <StageTools\b[\s\S]*?\/> : <LowerThirdGrab px=\{ltPx\} onPx=\{setLtPx\} \/> : null\}/,
    'the grab handle or the Stages panel is drawn without the flag',
  );
  assert.equal((shell.match(/<StageTools\b/g) ?? []).length, 1, 'the Stages panel has one door');
  assert.match(shell, /<StudioSideSwitch side=\{side\} onPick=\{pickSide\} at=\{studioTile\} tiles=\{studio\?\.tiles\} onOpen=\{openStudio\} \/>/);
  assert.match(shell, /\{stagesStudio \? \(\s*(?:\/\*[\s\S]*?\*\/\s*)?<div data-maker-tool="side"/, 'Stages | Studio is drawn without the flag');
  assert.match(shell, /withPickSheet\(\s*stagesStudio,/, 'the one bottom sheet is handed down without the flag');
  // The new chrome is never in a static import of the Maker — only the lazy stand-ins load it.
  const lazy = read(`${L}/details-lazy.tsx`);
  for (const name of ['StudioSideSwitch', 'StudioToolMenu', 'StudioDoneBar', 'StudioCover', 'LowerThirdGrab', 'MakerSheet']) {
    assert.match(lazy, new RegExp(`export const ${name} = dynamic\\(\\(\\) => import\\(\\s*'\\./stages-studio-parts'\\)`), `${name} is not a lazy piece`);
  }
  for (const f of [`${L}/maker-shell.tsx`, `${L}/maker-lower-third.tsx`, 'app/dashboard/[eventId]/launch/page.tsx', `${L}/maker-details.tsx`]) {
    assert.doesNotMatch(read(f), /from '\.\/(?:_components\/)?(?:studio-home|stages-studio-parts)'/, `${f} imports the new chrome statically — it would ride the Maker's first load`);
  }
});

test('4 · flag ON: a phone\'s bar is ✕ · Stages | Studio · ↺ · ✓ — Page ▾, Event Details and 👁 are a desktop\'s', async () => {
  const { MAKER_TOOLBAR_STAGES_STUDIO } = await import(`../${L}/maker-bar`);
  assert.deepEqual([...MAKER_TOOLBAR_STAGES_STUDIO], ['exit', 'side', 'undo', 'apply']);
  const html = await paint(true);
  const header = headerOf(html);
  // Tools drawn for a desktop only: inside a `max-lg:hidden` wrapper, or `hidden lg:…` themselves.
  const desktopOnly = new Set<string>();
  if (/<div class="[^"]*max-lg:hidden[^"]*" data-maker-tool="page"/.test(header)) desktopOnly.add('page');
  if (/<button[^>]*data-maker-tool="details"[^>]*class="[^"]*\bhidden lg:inline-flex/.test(header) || /data-maker-tool="details"[^>]*class="[^"]* hidden lg:inline-flex/.test(header)) desktopOnly.add('details');
  if (/<span class="contents max-lg:hidden"><span class="relative inline-flex shrink-0"><button[^>]*data-maker-tool="preview"/.test(header)) desktopOnly.add('preview');
  assert.deepEqual([...desktopOnly].sort(), ['details', 'page', 'preview'], 'a desktop-only tool shows on a phone in the new Maker');
  const phone = toolsOf(html).filter((t) => !desktopOnly.has(t!));
  assert.deepEqual(phone, [...MAKER_TOOLBAR_STAGES_STUDIO]);
  assert.match(html, /data-lt-item-menu=""/, 'the lower third has no item ▾');
  // The lazy pieces, drawn as they arrive: ONE segmented control, and the handle.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const parts = await import(`../${L}/stages-studio-parts`);
  const seg = renderToStaticMarkup(React.createElement(parts.StudioSideSwitch, { side: 'studio', onPick: () => {} }));
  assert.match(seg, /aria-label="Stages or Studio"[\s\S]*?aria-pressed="false"[^>]*>Stages<\/button>[\s\S]*?aria-pressed="true"[^>]*>Studio<\/button>/, 'Stages | Studio is not one segmented control');
  assert.equal((seg.match(/role="group"/g) ?? []).length, 1);
  assert.match(renderToStaticMarkup(React.createElement(parts.LowerThirdGrab, { px: null, onPx: () => {} })), /data-lt-grab=""/, 'the lower third has no grab handle');
  assert.doesNotMatch(html, /data-lt-menu-group=/, 'the two-group menu is still drawn beside the item ▾');
});

test('5 · a list opens as the one bottom sheet only where it is handed down, and only on a phone', async () => {
  const { pickOpensAsSheet } = await import('../app/dashboard/[eventId]/website/editor/_components/pick-menu-place');
  assert.equal(pickOpensAsSheet(false, 375), false, 'a list opened as a sheet with no sheet handed down');
  assert.equal(pickOpensAsSheet(true, 375), true);
  assert.equal(pickOpensAsSheet(true, 1023), true);
  assert.equal(pickOpensAsSheet(true, 1024), false, 'a desktop list became a sheet');
});
