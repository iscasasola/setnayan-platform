/**
 * 👈 THE SCHEDULE'S ROWS DELETE BY THEIR SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST
 * ROW — NO VISIBLE ✕ ON ROWS") — and each swipe reaches the SAME write the row's ✕ used to, with Undo:
 *
 *   · a hand-added step (Planning Stage)  → `deletePreparationItem` (event_id · item_id), `deleteWithUndo`
 *   · a block on the block list           → `deleteScheduleBlock` (event_id · block_id), `deleteWithUndo`
 *   · a part inside a moment              → `deleteScheduleBlock`, `deleteWithUndo`
 *   · a moment on the Studio day          → its inspector's OWN warning (parts · tasks · Papic), then Undo
 *
 * SABOTAGE (seen RED, then restored, 2026-11-03): the trash button put back on the prep row → test 1 red · the
 * moment's swipe pointed at `deleteScheduleBlock` directly (skipping the warning) → test 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(join(HERE, p), 'utf8'));

test('1 · a hand-added step: no trash on the row — its swipe deletes it with Undo, through the same write', () => {
  const agenda = read('_components/preparation-agenda.tsx');
  assert.doesNotMatch(agenda, /DeletePreparationItemButton/, 'the row still draws its own trash');
  assert.match(agenda, /<PrepItemSwipe eventId=\{eventId\} itemId=\{item\.itemId\} label=\{item\.title\}>\s*\{row\}\s*<\/PrepItemSwipe>/);
  const ctl = read('_components/prep-item-controls.tsx');
  const swipe = ctl.slice(ctl.indexOf('export function PrepItemSwipe('));
  assert.match(swipe, /<SwipeToDelete\b[\s\S]*?label=\{`Delete \$\{label\}`\}/);
  assert.match(swipe, /deleteWithUndo\(\{[\s\S]*?fd\.set\('event_id', eventId\);\s*fd\.set\('item_id', itemId\);\s*return deletePreparationItem\(fd\);/);
  assert.match(swipe, /<UndoToastHost \/>/, 'no Undo toast to say it');
});

test('2 · a block on the block list: its card is the swipe, the same deleteScheduleBlock, with Undo', () => {
  const page = read('page.tsx');
  assert.doesNotMatch(page, /aria-label="Delete block"/, 'the card still draws its trash');
  assert.match(page, /<BlockSwipe eventId=\{eventId\} blockId=\{b\.block_id\} label=\{b\.label\}>\s*<BlockCard/);
  const swipe = read('_components/block-swipe.tsx');
  assert.match(swipe, /deleteWithUndo\(\{[\s\S]*?fd\.set\('event_id', eventId\);\s*fd\.set\('block_id', blockId\);\s*return deleteScheduleBlock\(fd\);/);
});

test('3 · a part inside a moment: no ✕ — its line is the swipe, the same deleteScheduleBlock, with Undo', () => {
  const insp = read('_components/moment-inspector.tsx');
  assert.doesNotMatch(insp, /aria-label=\{`Remove the part/, 'the part still draws its ✕');
  assert.match(insp, /<SwipeToDelete\s+key=\{p\.block_id\}\s+as="li"\s+label=\{`Delete the part \$\{p\.label\}`\}/);
  assert.match(insp, /commit: async \(\) => \{\s*await deleteScheduleBlock\(toFormData\(\{ event_id: eventId, block_id: p\.block_id \}\)\);/);
});

test('4 · a moment on the Studio day gains the swipe — it opens the moment’s own warning, whose Delete keeps an Undo', () => {
  const studio = read('_components/studio-day.tsx');
  assert.match(studio, /<SwipeToDelete\b[\s\S]*?hover=\{false\}[\s\S]*?onDelete=\{\(close\) => \{\s*close\(\);\s*onAskDelete\(m\.block_id\);/);
  assert.doesNotMatch(studio.slice(studio.indexOf('function MomentRow(')), /deleteScheduleBlock/, 'the swipe skips the warning');
  const rail = read('_components/day-rail.tsx');
  assert.match(rail, /onAskDelete=\{\s*canEdit\s*\?\s*\(id\) => \{\s*setAskDelete\(/);
  assert.equal((rail.match(/onGone=\{hideMoment\}/g) ?? []).length, (rail.match(/<MomentInspector\b/g) ?? []).length, 'an inspector deletes without Undo');
  const insp = read('_components/moment-inspector.tsx');
  assert.match(insp, /function removeMoment\(\)[\s\S]*?deleteWithUndo\(\{[\s\S]*?hide: \(\) => \{\s*onGone\(id, true\);/);
  assert.match(insp, /useState\(askDelete > 0 && canEdit\)/, 'the swipe does not open at the warning');
});
