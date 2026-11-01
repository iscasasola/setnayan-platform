/**
 * the-prints-gear-opens-print-settings.test.ts — ON PRINTS THE ⚙ IS PRINT SETTINGS; ON THE EVENT HUB IT STAYS EVENT HUB SETTINGS.
 *
 * Owner 2026-10-31, relayed: the Prints page (its own page since #7020) drew the Event Hub's ⚙ (`HubSettingsGear`) in its top bar,
 * whose sheet — Look · Your Event Hub · What guests see — changes nothing on a print. Agreed: *"the ⚙ on Prints opens Prints' own
 * settings, if there is a real Prints setting"*. There is one: `StudioPrintSettings`, the ONE print settings sheet (Your Event Hub
 * look ◆ · the print words · ticket style · special message · thank-you), until now opened from each slide.
 *
 * Held as properties, measured on what RENDERS (the shell drawn with its lazy pieces arrived, `renderSettled`):
 *   1 · the Prints page's top bar draws exactly ONE ⚙, at the bar's Settings spot — the house door named "Print settings"
 *       (`data-menu-settings="prints"`) — and the Hub's door is not drawn there at all;
 *   2 · the Event Hub (the Maker) draws exactly ONE ⚙ there, the Hub's (`data-menu-settings="hub"`) — unchanged;
 *   3 · the door and the sheet are ONE state: the door writes the print settings store the sheet reads (`prints-view-store.ts`),
 *       reached through the one lazy door (`StudioTool`), and draws no sheet of its own even open; shut, the sheet is hidden but
 *       its fields stay in the page (`studio-prints-posts-the-same.test.ts` holds what they post). The open state is walked in
 *       the lab (a server render reads the store's server snapshot, always shut);
 *   4 · no slide draws a ⚙ of its own any more — one ⚙ per page (`prints-carousel-follows-the-prototype.test.ts` claim 4 reads the
 *       slides' toolbars).
 *
 * SABOTAGE (seen RED, then restored — see the PR): the shell's `printsPage ? (…) : hasWork ? (` turned back into `hasWork ? (` → 1
 * red (the Prints bar drew the Hub's ⚙).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderSettled } from './render-settled.test-helper';
import { SETTINGS_ENTRY } from './menu-settings';
import { PRINT_SETTINGS_LABEL } from './studio-prints-settings';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const ROUTER = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} };

async function shell(printsPage: boolean): Promise<string> {
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { MakerShell } = await import(`../${L}/maker-shell`);
  return renderSettled(
    React.createElement(
      AppRouterContext.Provider,
      { value: ROUTER as never },
      React.createElement(
        MakerShell as unknown as React.ComponentType<Record<string, unknown>>,
        {
          eventId: 'e1',
          slug: 'ana-and-miguel',
          liveStage: null,
          initialStage: 'rsvp',
          initialSelection: { kind: 'tool', key: 'details' },
          storeShell: false,
          tourSlides: [],
          firstVisit: false,
          completeTourAction: async () => {},
          renderStamp: '1',
          more: null,
          hasWork: true,
          applySlot: React.createElement('i', { 'data-stub': 'draft-bar' }),
          details: { page: React.createElement('div', { 'data-stub': 'prints-workspace' }), controls: null },
          studio: { tiles: [] },
          printsPage,
        },
        null,
      ),
    ),
  );
}

const headerOf = (html: string) => {
  const at = html.indexOf('data-maker-toolbar=""');
  assert.ok(at > 0, 'anti-vacuity: the top bar was not drawn');
  return html.slice(html.lastIndexOf('<header', at), html.indexOf('</header>', at));
};
const doors = (html: string) => [...html.matchAll(/data-menu-settings="([a-z]+)"/g)].map((m) => m[1]);

test('1 · the Prints page’s top bar draws ONE ⚙ — Print settings — and no Hub ⚙', async () => {
  const html = await shell(true);
  const bar = headerOf(html);
  assert.match(bar, /data-prints-page-title=""/, 'anti-vacuity: this is not the Prints page’s bar');
  assert.deepEqual(doors(html), ['prints'], `the Prints page draws ⚙ doors ${JSON.stringify(doors(html))}, want exactly ["prints"]`);
  const spot = /<span\b[^>]*data-bar-item="Settings"[^>]*>[\s\S]*?<button\b[^>]*>/.exec(bar)?.[0] ?? '';
  assert.match(spot, /data-prints-gear=""/, 'the bar’s Settings spot is not the Prints ⚙');
  assert.match(spot, /data-menu-settings="prints"/, 'the ⚙ at the bar’s end is not the Print settings door');
  assert.match(spot, new RegExp(`aria-label="${PRINT_SETTINGS_LABEL}"`), 'the ⚙ is not named "Print settings"');
  assert.match(spot, /class="ab ab-neutral icon-only"/, 'the ⚙ is not the house 44 px icon-only button');
  assert.doesNotMatch(html, /data-hub-settings=|aria-label="Event Hub settings"/, 'the Event Hub settings door or sheet is on the Prints page');
  assert.equal(SETTINGS_ENTRY.prints.sheet, PRINT_SETTINGS_LABEL, 'the door and the sheet are named differently');
});

test('2 · the Event Hub keeps ITS ⚙ — Event Hub settings — exactly as before', async () => {
  const html = await shell(false);
  const bar = headerOf(html);
  assert.match(bar, /data-bar-item="Stages or Studio"/, 'anti-vacuity: this is not the Maker’s bar');
  assert.deepEqual(doors(html), ['hub'], `the Event Hub draws ⚙ doors ${JSON.stringify(doors(html))}, want exactly ["hub"]`);
  assert.doesNotMatch(bar, /data-prints-gear/, 'the Event Hub draws the Prints ⚙');
  const src = stripComments(readFileSync(join(WEB, `${L}/maker-shell.tsx`), 'utf8'));
  assert.match(src, /\) : hasWork \? \(\s*<span data-maker-tool="settings"[^>]*>\s*<HubSettingsGear\s+open=\{moreOpen\}\s+onOpenChange=\{setMoreOpen\}/, 'the Hub’s ⚙ is no longer the one `moreOpen` sheet, after the Prints branch');
});

test('3 · the door and the sheet are one state — the door opens the print settings store; shut, the sheet keeps its fields', async () => {
  /* The two read ONE store (`prints-view-store.ts`): the door writes it, the sheet reads it. (A server render reads a store's
     server snapshot — always shut — so the open state itself is walked in the lab, 390×844, see the PR.) */
  const door = stripComments(readFileSync(join(WEB, `${L}/studio-prints-settings.tsx`), 'utf8'));
  const body = door.slice(door.indexOf('export function StudioPrintSettingsDoor('), door.indexOf('\n}\n', door.indexOf('export function StudioPrintSettingsDoor(')));
  assert.match(body, /const open = usePrintSettingsOpen\(\);\s*return <MenuSettingsButton menu="prints" open=\{open\} onOpenChange=\{setPrintSettingsOpen\} \/>;/, 'the door does not read and write the print settings store');
  const sheet = door.slice(door.indexOf('export function StudioPrintSettings('), door.indexOf('export function StudioPrintSettingsDoor('));
  assert.match(sheet, /const open = usePrintSettingsOpen\(\);\s*const setOpen = setPrintSettingsOpen;/, 'the sheet reads another state than the door writes');
  /* The shell reaches the door through the one lazy door (`StudioTool`) — no stand-in of its own in the Maker's first load. */
  const tools = stripComments(readFileSync(join(WEB, `${L}/studio-tools.tsx`), 'utf8'));
  assert.match(tools, /case 'print-settings-door':\s*return <StudioPrintSettingsDoor \/>;/);
  const lazy = stripComments(readFileSync(join(WEB, `${L}/details-lazy.tsx`), 'utf8'));
  assert.doesNotMatch(lazy, /StudioPrintSettingsDoor/, 'the Prints ⚙ got a lazy stand-in of its own');

  /* The door alone draws no sheet of its own, even open — the print settings sheet is the only one. */
  const { MenuSettingsButton } = await import('../app/_components/menu-settings-button');
  const opened = renderToStaticMarkup(React.createElement(MenuSettingsButton, { menu: 'prints', open: true, onOpenChange: () => {} }));
  assert.match(opened, /data-menu-settings="prints"[\s\S]*?aria-expanded="true"/, 'the door does not say it is open');
  assert.doesNotMatch(opened, /data-menu-settings-sheet=|role="dialog"/, 'the door draws a second, empty settings sheet');

  /* Shut, the print settings sheet is hidden and its fields stay in the page (a field not in the page is not posted). */
  const S = await import(`../${L}/studio-prints-settings`);
  const field = React.createElement('input', { form: 'details-print-words', name: 'probe_field', defaultValue: 'x' });
  const both = renderToStaticMarkup(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(S.StudioPrintSettingsDoor),
      React.createElement(S.StudioPrintSettings, { sections: [{ key: 'every', title: 'On every print', body: field }], form: 'details-print-words' }),
    ),
  );
  assert.match(both, /data-menu-settings="prints"[\s\S]*?aria-expanded="false"[\s\S]*?aria-label="Print settings"/, 'the door is not drawn, shut, as Print settings');
  assert.match(both, /data-print-settings-layer="" hidden=""/, 'the sheet is drawn open while shut');
  assert.match(both, /name="probe_field"/, 'a field left the page while the sheet is shut — a post would not send it');
});

test('4 · no slide draws a ⚙ of its own — the top bar’s is the page’s one', () => {
  const carousel = stripComments(readFileSync(join(WEB, `${L}/studio-prints-carousel.tsx`), 'utf8'));
  assert.ok(carousel.length > 5000, 'anti-vacuity: the carousel was not read');
  assert.doesNotMatch(carousel, /setPrintSettingsOpen|data-prints-settings|<Settings\b/, 'a slide opens print settings itself again — two ⚙ on one page');
});
