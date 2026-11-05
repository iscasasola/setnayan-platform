/**
 * the-day-of-rows-delete-by-swipe.test.ts — 👈 the day-of console's rows delete by their SWIPE, not a visible trash
 * (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"), each with Undo:
 * a shot (same `removeShot` write, after the window), an issue (device-local), a song in a set
 * (`removeSongFromVendorEventSet`). A whole SET — whose songs cascade — is deleted from its rename editor, also after
 * the Undo window, never at once from a ✕ on the card.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const shots = read('_components/shot-list.tsx');
const issues = read('_components/issues-log.tsx');
const sets = read('live/[eventId]/_components/song-desk/sets-panel.tsx');
const page = read('page.tsx');

test('a shot is the one SwipeToDelete and its write waits out the Undo window', () => {
  assert.match(shots, /<SwipeToDelete[\s\S]{0,200}?label=\{`Remove "\$\{s\.label\}"`\}/);
  assert.match(shots, /deleteWithUndo\(\{[\s\S]{0,900}?commit: \(\) => commitRef\.current\(shotsRef\.current, \(\) => removeShot\(eventId, shot\.id\)\)/);
  assert.doesNotMatch(shots, /aria-label=\{`Remove "\$\{s\.label\}"`\}/);
});

test('an issue is the one SwipeToDelete, with Undo', () => {
  assert.match(issues, /<SwipeToDelete[\s\S]{0,200}?onDelete=\{\(\) => remove\(i\)\}/);
  assert.match(issues, /deleteWithUndo\(/);
  assert.doesNotMatch(issues, /aria-label="Remove issue"/);
});

test('the console mounts the one Undo toast', () => {
  assert.equal((page.match(/<UndoToastHost \/>/g) ?? []).length, 1);
});

test('a set song swipes out with Undo; a set is deleted from its editor, after the Undo window', () => {
  assert.match(sets, /<SwipeToDelete[\s\S]{0,200}?label=\{`Remove \$\{s\.title\} from \$\{set\.name\}`\}/);
  assert.match(sets, /commit: \(\) => removeSongFromVendorEventSet\(eventId, setSongId\)/);
  assert.match(sets, /commit: \(\) => deleteVendorEventSet\(eventId, set\.setId\)/);
  assert.doesNotMatch(sets, /run\(\(\) => deleteVendorEventSet/, 'the set no longer deletes at once');
  const editor = sets.slice(sets.indexOf('function SetHeaderEditor('));
  assert.match(editor, /aria-label=\{`Delete set \$\{set\.name\}`\}/, 'the set’s Delete is its editor’s own');
});
