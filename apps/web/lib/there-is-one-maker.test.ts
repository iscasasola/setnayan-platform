/**
 * 🧭 THERE IS ONE MAKER (owner, live, 2026-10-25: *"event hub maker is still showing old maker on other people · we
 * need that fixed · why is it so hard for you to let the new event hub maker to show and delete that old event hub
 * maker"*).
 *
 * WHY OTHER PEOPLE SAW THE OLD ONE: the new Maker ("Stages | Studio") was chosen per request — the env variables
 * `NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED` / `NEXT_PUBLIC_MAKER_DESKTOP_COLUMNS_ENABLED`, OR the VIEWER being internal
 * (`users.is_internal`). The owner is internal, so he always saw the new one; a co-host, a second couple account, any
 * real couple saw whatever the variables said — and a coordinator (no work in the Maker) got the old chrome always,
 * because the choice was `hasWork && …`. The choice is gone: no flag, no role, no read picks the Maker.
 *
 * This guard FAILS if one comes back — each check names a way it would:
 *
 *   1 · NO SWITCH EXISTS — the two flag modules are deleted, and nothing in app/ or lib/ reads the desktop variable;
 *       the stages variable is read by the GUEST side's one helper only (`lib/guest-stages-on.ts`).
 *   2 · THE SHELL TAKES NO CHOICE — `MakerShell` has no `stagesStudio` / `desktopColumns` prop, and the context it
 *       provides says `stagesStudio: true`, a literal: never a prop, a role or a reading.
 *   3 · NO CALLER HANDS ONE IN — the launch page and the dev lab pass no such prop and import no flag; the launch page's
 *       internal reading (`freeSwitch`) only offers the View-as-free switch.
 *   4 · THE OLD CHROME IS GONE FROM THE SOURCE — the old bar's screen label, its Page ▾ and its Event Details door.
 *   5 · EVERY VIEWER IS DRAWN THE ONE MAKER — the shell rendered for a couple AND for a coordinator (no work), even when
 *       handed the old props `stagesStudio: false, desktopColumns: false`, draws Stages | Studio and none of the old bar.
 *   6 · THE OLD DOOR FORWARDS — `/dashboard/[eventId]/website/editor` opened on its own redirects into the Maker.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('1 · no switch exists — the flag modules are gone, and only the guest side reads the old variable', () => {
  assert.equal(existsSync(join(WEB, 'lib/maker-stages-studio-flag.ts')), false, 'the Maker flag module is back');
  assert.equal(existsSync(join(WEB, 'lib/maker-desktop-columns-flag.ts')), false, 'the desktop-columns flag module is back');
  const files = [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))];
  assert.ok(files.length > 500, `precondition: the source was walked (${files.length} files)`);
  const stagesReaders: string[] = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    const rel = relative(WEB, f);
    assert.doesNotMatch(src, /NEXT_PUBLIC_MAKER_DESKTOP_COLUMNS_ENABLED/, `${rel} reads the desktop-columns variable again`);
    assert.doesNotMatch(src, /\bmaker(StagesStudio|DesktopColumns)Enabled\b|\bmakerChoiceIsUnread\b/, `${rel} asks a Maker flag again`);
    if (/NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED/.test(src)) stagesReaders.push(rel);
  }
  assert.deepEqual(stagesReaders, ['lib/guest-stages-on.ts'], 'the stages variable is read outside the guest side — is it choosing a Maker again?');
});

test('2 · the shell takes no choice — no prop, and its context says `stagesStudio: true`', () => {
  const shell = read(`${L}/_components/maker-shell.tsx`);
  const head = shell.slice(shell.indexOf('export function MakerShell('), shell.indexOf('}) {', shell.indexOf('export function MakerShell(')));
  assert.ok(head.length > 500, 'precondition: the props were read');
  assert.doesNotMatch(head, /\b(stagesStudio|desktopColumns)\b/, 'MakerShell takes a Maker choice as a prop again');
  assert.match(shell, /\bstagesStudio: true,/, 'the context no longer says the one Maker');
  assert.equal((shell.match(/\bstagesStudio\b/g) ?? []).length, 1, 'the shell names `stagesStudio` somewhere besides its literal');
  assert.doesNotMatch(shell, /\bdesktopColumns\b/, 'the shell branches on desktop columns again');
  /* The switch is drawn on its own — never inside a ternary or a `&&`. */
  assert.match(shell, /<\/IconPill>[\s{}]*<div data-maker-tool="side"[^>]*>\s*<StudioSideSwitch /, 'Stages | Studio is no longer drawn unconditionally after Exit');
  assert.match(shell, /<PickSheetContext\.Provider value=\{makerPickSheet\}>/, 'the one bottom sheet became conditional');
});

test('3 · no caller hands a choice in — the launch page and the lab', () => {
  const page = read(`${L}/page.tsx`);
  assert.doesNotMatch(page, /\b(stagesStudio|desktopColumns)\b/, 'the launch page decides a Maker again');
  assert.doesNotMatch(page, /maker-(stages-studio|desktop-columns)-flag|guest-stages-on/, 'the launch page imports a Maker switch');
  /* The viewer's internal reading only offers the View-as-free switch. */
  const uses = page.match(/\bfreeSwitch\.\w+/g) ?? [];
  assert.ok(uses.length > 0, 'precondition: freeSwitch is read');
  for (const u of uses) assert.ok(u === 'freeSwitch.offered' || u === 'freeSwitch.on', `the launch page reads ${u}`);
  assert.match(page, /viewAsFree=\{freeSwitch\.offered \? \{ on: freeSwitch\.on \} : null\}/);
  assert.equal((page.match(/freeSwitch\./g) ?? []).length, 2, 'the internal reading is used for something besides View as free');
  for (const lab of ['app/dev/maker-lab/page.tsx', 'app/dev/maker-lab/maker-lab-shell.tsx']) {
    assert.doesNotMatch(read(lab), /\b(stagesStudio|desktopColumns)=/, `${lab} hands the shell a Maker choice`);
  }
});

test('4 · the old chrome is gone from the source', () => {
  const shell = read(`${L}/_components/maker-shell.tsx`);
  assert.doesNotMatch(shell, /data-maker-screen-label/, 'the old bar’s screen label is back');
  assert.doesNotMatch(shell, /data-maker-page-menu/, 'the old bar’s Page ▾ is back');
  assert.doesNotMatch(shell, /data-maker-tool=\{door\}|ShutDoor|MAKER_DOOR_BUTTON/, 'the old bar’s Event Details door is back');
  assert.doesNotMatch(shell, /withPickSheet/, 'the bottom sheet is switched again');
});

async function paint(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerShell } = await import(`../${L}/_components/maker-shell`);
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
        applySlot: null,
        details: null,
        studio: { tiles: [] },
        ...props,
      },
      React.createElement('div', { 'data-stub': 'work' }),
    ),
  );
}

test('5 · every viewer is drawn the one Maker — a couple, a coordinator, and a caller handing the old props', async () => {
  const viewers: Array<[string, Record<string, unknown>]> = [
    ['a couple', { hasWork: true }],
    ['a coordinator (no work in the Maker)', { hasWork: false, theHost: 'the couple' }],
    ['a caller handing the old OFF props', { hasWork: true, stagesStudio: false, desktopColumns: false }],
    ['a coordinator handed the old OFF props', { hasWork: false, stagesStudio: false, desktopColumns: false }],
  ];
  for (const [who, props] of viewers) {
    const html = await paint(props);
    assert.ok(html.includes('data-maker-shell=""') && html.length > 2000, `${who}: precondition — the shell was rendered`);
    assert.match(html, /data-maker-tool="side"/, `${who} is not drawn Stages | Studio`);
    assert.doesNotMatch(html, /data-maker-screen-label|data-maker-page-menu|data-maker-tool="details"/, `${who} is drawn the old bar`);
  }
});

test('6 · the old door forwards — the website editor opened on its own redirects into the Maker', () => {
  const editor = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(
    editor,
    /if \(inMaker !== '1'\) \{[\s\S]{0,600}?redirect\(`\/dashboard\/\$\{eventId\}\/launch\?\$\{q\.toString\(\)\}`\);/,
    'the old editor address no longer forwards into the Maker',
  );
});
