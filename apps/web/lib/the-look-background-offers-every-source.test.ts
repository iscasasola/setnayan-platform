/**
 * 🌄 STUDIO › LOOK › BACKGROUND OFFERS EVERY SOURCE — for EVERY event, on the web and in the app.
 *
 * Owner, in the app 2026-10-26: *"i cannot see the different background options. upload, color, videos, etc"*, and on
 * a free test event once the row was built only for Pro events in the app: *"still none for the background"*. The
 * main-background row (`MainBackgroundPanel`: Source ▾ Colour · Scene ◆ · Video ◆ · Upload ◆ and its cards) was
 * behind `storeShell` (then behind `ownsPro` in the shell).
 *
 *   (1) the row is built for every event — no gate in front of it in the editor page;
 *   (2) the ◆ sources' door: open on the web and for a Pro event; Apple's sheet in the app where Apple sells; locked
 *       (no price, no web link) in the app where nothing can be sold;
 *   (3) the panel honours it: on a ◆ source, the cards are locked (a tap says why) and Apple's sheet sells Event Hub
 *       Pro (`COUPLE_WEBSITE_PRO`) in place — only on 'apple'; Colour is never locked; the page hands the door.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { mainBackgroundProDoor } from './main-background-offered';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = code('app/dashboard/[eventId]/website/editor/page.tsx');
const PANEL = code('app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx');

test('(1) the Source ▾ row is built for every event — nothing gates it', () => {
  const at = PAGE.indexOf("key: 'main-background',");
  assert.ok(at > 0, 'premise: the main-background row');
  const before = PAGE.slice(PAGE.lastIndexOf('},', at), at);
  assert.doesNotMatch(before, /\?\s*\[\]\s*:/, 'the main-background row is gated again — an event in the app loses its Source ▾');
  assert.match(PAGE, /proDoor=\{mainBackgroundProDoor\(\{ storeShell, iap: iapGate\.iap, ownsPro \}\)\}/, 'the page no longer tells the panel how its ◆ sources open');
});

test('(2) the ◆ door: open on the web / for Pro, Apple where Apple sells, locked where nothing can be sold', () => {
  assert.equal(mainBackgroundProDoor({ storeShell: false, iap: false, ownsPro: false }), 'open');
  assert.equal(mainBackgroundProDoor({ storeShell: true, iap: true, ownsPro: true }), 'open', 'a Pro event in the app cannot use its own sources');
  assert.equal(mainBackgroundProDoor({ storeShell: true, iap: false, ownsPro: true }), 'open');
  assert.equal(mainBackgroundProDoor({ storeShell: true, iap: true, ownsPro: false }), 'apple');
  assert.equal(mainBackgroundProDoor({ storeShell: true, iap: false, ownsPro: false }), 'locked');
});

test('(3) the panel locks the ◆ cards off the open door, sells Pro through Apple only on "apple", never locks Colour', () => {
  assert.match(PANEL, /const proLockedHere = proDoor !== 'open' && \(view === 'scene' \|\| view === 'video' \|\| view === 'own'\);/);
  assert.match(PANEL, /const proOnly = \(fn: \(\) => void\) => \(proLockedHere \? \(\) => setNote\(PRO_LOCKED_LINE\) : fn\);/);
  const cards = PANEL.slice(PANEL.indexOf("{view === 'scene'"), PANEL.indexOf('</BgCards>', PANEL.indexOf("{view === 'scene'")));
  const picks = cards.match(/onPick=\{/g)?.length ?? 0;
  const guarded = cards.match(/onPick=\{proOnly\(/g)?.length ?? 0;
  assert.ok(picks >= 8 && guarded === picks, `${picks - guarded} ◆ card(s) still pick for an event that cannot use them`);
  const colour = PANEL.slice(PANEL.indexOf("{view === 'colour'"), PANEL.indexOf("{view === 'scene'"));
  assert.doesNotMatch(colour, /proOnly\(/, 'Colour is locked — it is everyone\'s');
  assert.match(PANEL, /proDoor === 'apple' \? \(\s*<IapUnlockSheet\s+eventId=\{eventId\}\s+serviceKey="COUPLE_WEBSITE_PRO"/, 'the app where Apple sells does not offer Event Hub Pro in place');
  assert.match(PANEL, /const PRO_LOCKED_LINE = 'Part of Event Hub Pro\.';/, 'the locked line names a price or a link');
});
