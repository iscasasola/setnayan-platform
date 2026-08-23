import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * the-event-card-carries-a-photograph.test.ts
 *
 * The account home has shown a picture of each celebration since 2026-07-30.
 * Opening the celebration itself dropped to pure text — the one screen a couple
 * lives in was the one with nothing of theirs on it.
 *
 * 🔑 NOTHING WAS DRAWN. `EventScene` already ships and already owns the whole
 * precedence (own hero → per-type stock under a per-event treatment → branded
 * gradient). It is reused, so the two cards cannot disagree about which picture
 * an event has.
 *
 * 🛡 Mutation-checked by occurrence count.
 */

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (p: string) =>
  readFileSync(join(WEB, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const FOCAL = 'app/dashboard/[eventId]/_components/event-dashboard.tsx';

test('the focal card renders the SHARED scene, not a second implementation', () => {
  const focal = code(FOCAL);
  assert.match(focal, /<EventScene/, 'the band is mounted, not merely imported');
  assert.match(focal, /from '@\/app\/dashboard\/\(launcher\)\/_components\/event-scene'/);
  assert.ok(
    !/next\/image/.test(focal),
    'a hand-rolled <Image> here would be a second precedence the home card does not share',
  );
});

test('it is handed the same two sources, in the same precedence', () => {
  const focal = code(FOCAL);
  assert.match(focal, /photoSrc=\{typeHeroSrc\}/);
  assert.match(focal, /ownPhotoSrc=\{ownHeroSrc\}/);
  assert.match(focal, /eventTypePhotoSrc\(match\)/, 'the admin upload wins over the repo asset');
  assert.match(focal, /`\/event-types\/\$\{eventType\}\.webp`/, 'and the repo asset is the floor');
});

test('a host-writable column cannot reach an <img src> unnarrowed', () => {
  const focal = code(FOCAL);
  const block = focal.slice(focal.indexOf('const ownHeroSrc'), focal.indexOf('const ownHeroSrc') + 400);
  assert.match(block, /renderableImageSrc\(await displayUrlForStoredAsset\(stored\)\)/);
  assert.match(block, /catch \{\s*return null;/, 'a signing failure must not take the page down');
});

test('"one obsidian per view" is untouched — the band is INSIDE the card', () => {
  const focal = code(FOCAL);
  const at = focal.indexOf('<EventScene');
  const before = focal.slice(at - 400, at);
  assert.match(before, /-mx-\[18px\] -mt-\[18px\]/, 'full-bleed within the tile padding');
  assert.ok(
    !/sn-tile-dark[^`"]*<EventScene/s.test(focal.slice(at - 200, at)),
    'the band must not become a second dark surface',
  );
  // The shared class has seven consumers across the app; this change touches none.
  assert.ok(!/\.sn-tile-dark\s*\{/.test(focal), 'no restyling of the shared class from here');
});

test('the picture dims with the card when the celebration has passed', () => {
  assert.match(code(FOCAL), /muted=\{eventHasHappened\}/);
});
