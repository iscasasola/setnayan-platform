/**
 * GUARD — THE KEEPSAKE ROW AND THE ＋ ADD CELL (owner 2026-10-31, asked *"on memories. the Photo Magazine, Flash Life,
 * and Thank You. must be added as a row of buttons? and maybe a cell also that allows them to upload a photo in trade
 * of a papic credit?"* → "Build both"). Hosts only.
 *
 * Held here, each property sabotaged once and seen red before this shipped:
 *   1 · the row's doors are Magazine · Recap · Flash · Thank You, in that order (`lib/memories-keepsakes.ts`), and a
 *       door with nothing YET is dimmed with its reason — never silently missing; a card that must say nothing draws none;
 *   2 · each door opens the SHIPPED card (MagazineCard · RecapCard · LifeFlashCard · ServiceParts service="papic"), in
 *       the house sheet, handed the page's ONE read;
 *   3 · the bottom "Made from your memories" stack is gone — the cards are mounted once, in the row;
 *   4 · Thank You has ONE home: the row — not the ⚙;
 *   5 · the ＋ Add cell and the thumb row's ＋ share ONE handler and ONE sheet (no second uploader);
 *   6 · hosts only — the page builds both inside its host branch, and the gallery draws both only for a host.
 *
 * Source is read with comments stripped (this fix's own notes name what was removed).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { KEEPSAKE_ORDER, keepsakeDoors, type KeepsakeReads } from '@/lib/memories-keepsakes';
import { addCellWords } from '@/lib/memories-add-cell';
import { papicCaptureCost } from '@/lib/papic-cameras-pure';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = read('app/dashboard/[eventId]/memories/page.tsx');
const SETTINGS = read('app/dashboard/[eventId]/memories/_components/memories-settings.tsx');
const ROW = read('app/_components/memories/memories-keepsake-row.tsx');
const GALLERY = read('app/_components/memories/event-memories-gallery.tsx');

const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) ?? []).length;

const ALL_READY: KeepsakeReads = {
  magazine: { photos: 12 },
  recap: { privatePhotos: 12, approvedKwentos: 2 },
  flash: { moments: 9 },
  flashMin: 3,
  thankYou: true,
};

test('1 · the four doors, in the owner’s order: Magazine · Recap · Flash · Thank You', () => {
  assert.deepEqual([...KEEPSAKE_ORDER], ['magazine', 'recap', 'flash', 'thank-you']);
  const doors = keepsakeDoors(ALL_READY);
  assert.deepEqual(doors.map((d) => d.key), ['magazine', 'recap', 'flash', 'thank-you']);
  assert.deepEqual(doors.map((d) => d.word), ['Magazine', 'Recap', 'Flash', 'Thank You']);
  assert.ok(doors.every((d) => d.ready && d.reason === null), 'a door with something to open is dimmed');
});

test('1 · nothing YET is a dimmed door with its reason — never silently missing', () => {
  const doors = keepsakeDoors({
    magazine: { photos: 0 },
    recap: { privatePhotos: 0, approvedKwentos: 0 },
    flash: { moments: 1 },
    flashMin: 3,
    thankYou: true,
  });
  assert.deepEqual(doors.map((d) => d.key), ['magazine', 'recap', 'flash', 'thank-you'], 'a door with nothing yet went missing');
  for (const d of doors.slice(0, 3)) {
    assert.equal(d.ready, false, `${d.key} opens onto a card that renders nothing`);
    assert.ok(d.reason && d.reason.length > 20, `${d.key} is dimmed with no reason for its ⓘ`);
  }
  assert.match(doors[2]!.reason!, /3 moments.*1 so far/, 'the Flash reason does not say the threshold and the count');
  // A refused count is "couldn't check", never "nothing yet" — and it still opens no door.
  const unmeasured = keepsakeDoors({ ...ALL_READY, flash: { moments: null } }).find((d) => d.key === 'flash')!;
  assert.equal(unmeasured.ready, false, 'an unmeasured moment count opens the Flash door');
  assert.match(unmeasured.reason!, /couldn’t check/i);
});

test('1 · a card whose own rule says NOTHING draws no door (Flash flag off / not the couple · Thank You not offered)', () => {
  assert.deepEqual(keepsakeDoors({ ...ALL_READY, flash: null }).map((d) => d.key), ['magazine', 'recap', 'thank-you']);
  assert.deepEqual(keepsakeDoors({ ...ALL_READY, thankYou: false }).map((d) => d.key), ['magazine', 'recap', 'flash']);
});

test('2 · each door opens the SHIPPED card, handed the page’s one read — in the house sheet', () => {
  for (const [key, re] of [
    ['magazine', /magazine:\s*<MagazineCard eventId=\{eventId\} state=\{magazine\} \/>/],
    ['recap', /recap:\s*<RecapCard eventId=\{eventId\} state=\{recap\} \/>/],
    ['flash', /flash:\s*<LifeFlashCard eventId=\{eventId\} state=\{flash\} \/>/],
    ['thank-you', /'thank-you':\s*<ServiceParts eventId=\{eventId\} service="papic" door=\{thankYou\} \/>/],
  ] as const) {
    assert.match(PAGE, re, `the ${key} door no longer opens its shipped card with the page's read`);
  }
  // The reads are each card's OWN, read once and handed to both the row and the card.
  assert.match(
    PAGE,
    /Promise\.all\(\[\s*readMagazineCard\(eventId\),\s*loadRecapCoupleSummary\(eventId\),\s*readLifeFlashCard\(eventId\),\s*readServicePart\(eventId, 'papic'\),?\s*\]\)/,
    'the row no longer asks the cards’ own reads',
  );
  assert.match(PAGE, /<MemoriesKeepsakeRow key="keepsakes" doors=\{doors\} cards=\{cards\} \/>/, 'the row is no longer handed the doors and their cards');
  // The row opens the card it was handed, in the house Sheet (whose scrim is the one OverlayBackdrop) — no hand-made dimmer.
  assert.match(ROW, /import \{ Sheet \} from '@\/app\/_components\/sheet'/);
  assert.match(ROW, /<Sheet open onClose=\{\(\) => setOpen\(null\)\}[^>]*>[\s\S]*?\{cards\[opened\.key\] \?\? null\}[\s\S]*?<\/Sheet>/, 'the sheet no longer shows the card');
  assert.match(ROW, /d\.key === open && d\.ready/, 'a dimmed door can open a sheet');
  assert.doesNotMatch(ROW, /fixed inset-0|bg-black\/\d/, 'the row draws its own scrim — use the house Sheet');
  // The cards still gate themselves when drawn alone (the props are optional, the reads their own).
  for (const [file, re] of [
    ['app/dashboard/[eventId]/studio/papic/_components/magazine-card.tsx', /state \?\? \(await readMagazineCard\(eventId\)\)/],
    ['app/dashboard/[eventId]/studio/papic/_components/recap-card.tsx', /state \?\? \(await loadRecapCoupleSummary\(eventId\)\)/],
    ['app/dashboard/[eventId]/studio/papic/_components/life-flash-card.tsx', /state === undefined \? await readLifeFlashCard\(eventId\) : state/],
    ['app/dashboard/[eventId]/studio/_components/service-parts.tsx', /given === undefined \? await readServicePart\(eventId, service\) : given/],
  ] as const) {
    assert.match(read(file), re, `${file} no longer reads for itself when it is drawn without the page's read`);
  }
});

test('3 · the bottom stack is gone — each card is mounted ONCE, in the row', () => {
  assert.doesNotMatch(PAGE, /data-memories-keepsakes/, 'the bottom "Made from your memories" stack is back');
  assert.doesNotMatch(PAGE, /aria-label="Made from your memories"/, 'the bottom stack is back');
  for (const tag of ['MagazineCard', 'RecapCard', 'LifeFlashCard', 'ServiceParts']) {
    assert.equal(count(PAGE, new RegExp(`<${tag}\\b`)), 1, `<${tag}> is mounted other than once on Memories`);
  }
  // …and the row is the gallery's, under its top row.
  assert.match(PAGE, /keepsakes=\{keepsakes\}/, 'the page no longer hands the row to the gallery');
  assert.match(GALLERY, /data-memories-top=""[\s\S]*?<\/div>\s*(?:\{\s*\}\s*)?\{host \? keepsakes : null\}/, 'the row is not directly under the top row');
});

test('4 · Thank You has ONE home — the row, not the ⚙', () => {
  assert.doesNotMatch(SETTINGS, /<ServiceParts\b/, 'the Thank-You door is back in the ⚙');
  assert.doesNotMatch(SETTINGS, /data-memories-setting="thank-you"/);
  assert.equal(count(PAGE, /<ServiceParts\b[^>]*service="papic"/), 1);
});

test('5 · the ＋ Add cell and the thumb row’s ＋ share ONE handler and ONE sheet — no second uploader', () => {
  assert.equal(count(GALLERY, /setAdding\(true\)/), 1, 'something other than the one handler opens the Add photos sheet');
  assert.match(GALLERY, /const openAdding = useCallback\(\(\) => setAdding\(true\), \[\]\)/);
  assert.match(GALLERY, /<AddCell key="add-cell" words=\{addCell\} dense=\{dense\} roomy=\{cols <= 3\} onAdd=\{openAdding\} \/>/, 'the cell does not call the one handler');
  assert.match(GALLERY, /<MemoriesThumbRow[\s\S]*?onAdd=\{openAdding\}/, 'the thumb row does not call the one handler');
  assert.match(GALLERY, /label: 'Add photos', onClick: onAdd,/, 'the thumb row’s ＋ has its own handler again');
  const cell = /function AddCell\([\s\S]*?\n\}\n/.exec(GALLERY)?.[0] ?? '';
  assert.ok(cell, 'the AddCell component is gone');
  assert.match(cell, /onClick=\{onAdd\}/);
  assert.doesNotMatch(cell, /AddToLibrary|<Sheet|<input|startAddingPhotos/, 'the cell grew its own uploader');
  assert.equal(count(GALLERY, /title="Add photos"/), 1, 'a second Add photos sheet');
  assert.equal(count(GALLERY, /\{addPhotos\}/), 1, 'the uploader is drawn in a second place');
  // The cell is the grid's FIRST tile, in each grid shape it joins.
  assert.match(GALLERY, /<div className=\{gridClass\}>\s*\{addTile\}\s*\{shown\.map/, 'the cell is not the flat grid’s first tile');
  assert.match(GALLERY, /\{gi === 0 \? addTile : null\}\s*\{list\.map/, 'the cell is not the first moment’s first tile');
  assert.match(GALLERY, /\{addTile \? <div className=\{gridClass\}>\{addTile\}<\/div> : null\}/, 'an empty album hides the cell');
});

test('5 · the cell’s words: the price is the gate’s own function, and its faces are the door’s faces', () => {
  const open = addCellWords('open', 24);
  assert.equal(open.line, `${papicCaptureCost('photo', null, 'upload')} credits each`);
  assert.match(open.tip, /Your uploads/);
  assert.equal(addCellWords('open', 'unmetered').line, 'Your pass covers it');
  assert.equal(addCellWords('off', 24).line, 'Turned off');
  // The page picks the face from the SAME branch that picks the door.
  // Every host has their own camera since #7111 (2026-10-31), so there is no "other host's" face any more.
  assert.match(PAGE, /addCell = addCellWords\(!uploadsOpen \? 'off' : 'open', pot\)/);
});

test('6 · hosts only — built in the page’s host branch, drawn by the gallery only for a host', () => {
  const branch = /\n  if \(host\) \{[\s\S]*?\n  \}\n/.exec(PAGE)?.[0] ?? '';
  assert.ok(branch, 'the host branch is gone');
  assert.match(branch, /keepsakes = <MemoriesKeepsakeRow\b/, 'the row is built outside the host branch');
  assert.match(branch, /addCell = addCellWords\(/, 'the cell is built outside the host branch');
  assert.equal(count(PAGE, /<MemoriesKeepsakeRow\b/), 1);
  assert.match(GALLERY, /\{host \? keepsakes : null\}/, 'the gallery draws the row for a guest');
  assert.match(GALLERY, /const addTile =\s*host && addPhotos && addCell &&/, 'the gallery draws the cell for a guest');
});
