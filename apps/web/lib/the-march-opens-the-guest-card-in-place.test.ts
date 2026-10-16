/**
 * 🪪 A NAME ON THE WEDDING MARCH OPENS THEIR OWN GUEST CARD — IN PLACE (owner, verbatim, 2026-10-14: *"on Wedding march. when
 * we click a guest, we can show the guest card on the guest's page so they can rename edit it there and do not need to go
 * back to guests."*).
 *
 * What this holds, each part a way the feature could quietly stop being true:
 *   1 · a TAP (pressed and let go without lifting — under the drag's own 4 px / 8 px) on a walking name OR a "Not walking"
 *       chip opens the card; Enter does it from the keyboard; Space still picks the name up to move it;
 *   2 · the card is the SHIPPED card (`GuestCardBody`, panel variant, the hand-drawn kit — never the Guests' template kit,
 *       which the Maker's first load does not carry), read by ONE action through the Guest list's own loader;
 *   3 · it opens as the parents' sheet does (`Sheet` + `rise`, on <body>), says the edit is live (`HubSavesImmediately`),
 *       mounts the card's own Undo (`UndoToastHost`), and closing after a save re-reads the Maker once — no stale name;
 *   4 · no "go back to Guests": nothing on the march or its card links or navigates to the Guest list;
 *   5 · it stays out of the Maker's first load (the march is lazy; the sheet rides with it).
 *
 * SABOTAGE (each seen red, then restored — controller-2026-10-12/march-card/sabotage-out.txt).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}
const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const MARCH = read(`${L}/details-march.tsx`);
const SHEET = read(`${L}/march-guest-card.tsx`);
const ACTION = read('app/dashboard/[eventId]/launch/march-card-actions.tsx');

test('1 · a tap (no lift, under the drag’s own slop) on a walking name or a tray chip opens their card; Enter too; Space still moves', () => {
  const up = MARCH.slice(MARCH.indexOf('const onUp = useCallback('), MARCH.indexOf('const onCancel = useCallback('));
  assert.match(up, /const press = pending\.current;\s*stopAll\(\);\s*if \(!d\) \{/, 'the release no longer keeps the press it ends — a tap cannot be told from nothing');
  assert.match(
    up,
    /press\.source\.kind === 'name' \|\| press\.source\.kind === 'out'[\s\S]{0,200}Math\.hypot\(e\.clientX - press\.x, e\.clientY - press\.y\)[\s\S]{0,120}press\.touch \? TAP_SLOP_TOUCH : TAP_SLOP_MOUSE[\s\S]{0,40}setCard\(\{ id: press\.source\.id/,
    'a tap on a name does not open their card',
  );
  // The tap's own click must not reach the sheet's scrim (a finger's pointerup opens the card, then its click closes it).
  assert.match(up, /setCard\(\{ id: press\.source\.id[^;]*;\s*swallowTapClick\(\);/, 'the tap’s own click is not swallowed — on a phone the card closes the instant it opens');
  assert.match(MARCH, /function swallowTapClick\(\): void \{[\s\S]{0,300}addEventListener\('click', eat, true\)/, 'swallowTapClick no longer catches the next click in the capture phase');
  assert.match(MARCH, /const TAP_SLOP_MOUSE = 4;\s*const TAP_SLOP_TOUCH = 8;/, 'the tap’s slop is no longer the drag’s own (a lift at 4 px, a scroll at 8 px)');
  // The drag's thresholds are the same numbers, so a press is EITHER a tap or a drag, never both.
  assert.match(MARCH, /if \(moved > 8\) stopAll\(\);/);
  assert.match(MARCH, /if \(moved > 4\) lift\(e\.clientX, e\.clientY\);/);
  assert.match(MARCH, /if \(e\.key === 'Enter' && !carried\) \{[\s\S]{0,400}setCard\(\{ id: source\.id/, 'Enter does not open the card');
  assert.match(MARCH, /if \(e\.key === ' ' \|\| e\.key === 'Enter'\) \{/, 'Space no longer picks a name up');
});

test('1b · the march draws the card for the tapped person, with the reader it was handed (the lab’s) or the shipped one', async () => {
  assert.match(MARCH, /openCard = openCardShipped,/);
  assert.match(MARCH, /const \{ openMarchGuestCard \} = await import\('\.\.\/march-card-actions'\);/, 'the card’s read is no longer loaded at the first tap');
  assert.match(MARCH, /<MarchGuestCard eventId=\{eventId\} person=\{card\} open=\{openCard\} onClose=\{\(\) => setCard\(null\)\} onSaved=\{onCardSaved\} \/>/);
  // OUTSIDE the drag's section: a key typed in the card must never reach the drag's handlers.
  assert.match(MARCH, /<\/section>\s*(?:\{\s*\}\s*)?\{card && card\.id \? \(\s*<MarchGuestCard/, 'the card is drawn inside the march’s section — its keys and presses would reach the drag');
  /* The rendered march: every name is a ≥ 44 px pressable that says Enter opens the card. */
  const { MarchMaker } = await import(`../${L}/details-march`);
  const { labMarchSections } = await import('../app/dev/details-lab/march-fixture');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const m = labMarchSections();
  const html = renderToStaticMarkup(React.createElement(MarchMaker as never, { eventId: 'E1', sections: m.sections, printed: m.printed, out: m.out } as never));
  const names = [...html.matchAll(/<div[^>]*data-march-drag="name\|[^"]+"[^>]*>/g)].map((x) => x[0]);
  assert.ok(names.length >= 20, `the march drew ${names.length} names`);
  for (const n of names) {
    assert.match(n, /role="button"/);
    assert.match(n, /min-h-11/, 'a name is under 44 px to the finger');
    assert.match(n, /Enter opens their guest card/, 'a name does not say how to open the card');
  }
});

test('2 · the card is the SHIPPED card — GuestCardBody, panel, no template kit — read by the Guest list’s own loader, once', () => {
  assert.match(ACTION, /^'use server';/);
  assert.match(ACTION, /const \[data, eventRow\] = await Promise\.all\(\[\s*loadGuestCard\(supabase, eventId, guestId\),/, 'the card is not read by the Guest list’s loader');
  assert.match(ACTION, /<GuestCardBody\s+eventId=\{eventId\}\s+data=\{data\}[\s\S]{0,200}variant="panel"/);
  assert.doesNotMatch(ACTION, /guest-card-template-kit|TEMPLATE_KIT|\bkit=\{|actions=\{/, 'the march’s card takes the template kit or other writes than the shipped card’s');
  assert.match(ACTION, /if \(!isUuid\(eventId\) \|\| !isUuid\(guestId\)\)/);
  // A refusal is a sentence, never the database's words.
  assert.match(ACTION, /catch \{\s*return \{ ok: false, reason: COULD_NOT_OPEN \};/);
  assert.doesNotMatch(ACTION, /\.message\b/, 'a thrown error’s words could reach the couple');
});

test('3 · the parents’ sheet, the live-save line, the card’s own Undo — and closing after a save re-reads the Maker once', () => {
  assert.match(SHEET, /createPortal\(\s*<>\s*<Sheet open onClose=\{close\} labelledById=\{headId\} rise>/, 'the card is not the parents’ sheet on <body>');
  assert.match(SHEET, /<HubSavesImmediately \/>/, 'the sheet no longer says a guest edit goes live (Apply does not cover it)');
  assert.match(SHEET, /<UndoToastHost \/>/, 'the card’s own Undo has no host in the Maker');
  assert.match(SHEET, /onSubmitCapture=\{\(\) => \{\s*saved\.current = true;\s*\}\}/);
  assert.match(SHEET, /onClose\(\);\s*if \(saved\.current\) \(onSaved \?\? requestMakerRefresh\)\(\);/, 'closing a card that saved does not re-read the march — the old name would stay');
  assert.match(SHEET, /Opening their card…/, 'the sheet does not open at the tap');
  assert.match(SHEET, /<StatusLine tone="bad" data="march-card" action=\{\{ label: 'Try again'/, 'a card that could not open is not said with a way to try again');
});

test('4 · no "go back to Guests" — nothing on the march or its card links or navigates to the Guest list', () => {
  for (const [name, src] of [['details-march.tsx', MARCH], ['march-guest-card.tsx', SHEET]] as const) {
    assert.doesNotMatch(src, /next\/link|<Link\b|href=|router\.push|location\.(?:href|assign)/, `${name} sends the couple somewhere else`);
    assert.doesNotMatch(src.replace(/^import[^;]*;$/gm, ''), /\/guests['`/?]/, `${name} names the Guest list’s address`);
  }
});

test('5 · out of the Maker’s first load: the march is lazy and only the march imports the sheet', () => {
  const lazy = read(`${L}/details-lazy.tsx`);
  assert.match(lazy, /export const MarchMaker = dynamic\(\(\) => import\(\s*'\.\/details-march'\)/);
  const importers: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(p);
      } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && /from '[^']*march-guest-card'/.test(read(p))) importers.push(p);
    }
  };
  walk('app');
  assert.deepEqual(importers, [`${L}/details-march.tsx`], 'the card sheet is imported outside the (lazy) march');
});
