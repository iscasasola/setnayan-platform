/**
 * 👈 THE BUDGET'S ROWS DELETE BY THEIR SWIPE (owner 2026-11-03, DECISION_LOG "SWIPE LEFT TO DELETE ON EVERY LIST ROW —
 * NO VISIBLE ✕ ON ROWS") — each swipe reaches the SAME write its trash used to, with Undo:
 *
 *   · an expense on the Budget list      → `deleteEventCost` (event_id · cost_id), `deleteWithUndo`
 *   · a supplier's own line item         → the SAME "Delete this line item?" ask → `deleteLineItem`, Undo
 *   · a logged payment                   → the SAME "Remove this logged payment?" ask → `deletePayment`, Undo
 *
 * SABOTAGE (seen RED, then restored, 2026-11-03): the line item's ask dropped → test 2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(join(HERE, p), 'utf8'));

test('1 · an expense row gains the swipe — the same deleteEventCost, after the Undo window', () => {
  const screen = read('_components/budget-screen.tsx');
  assert.match(screen, /<SwipeToDelete\s+key=\{e\.costId\}\s+label=\{`Delete \$\{e\.name\}`\}[\s\S]*?fd\.set\('event_id', eventId\);\s*fd\.set\('cost_id', e\.costId\);\s*return deleteEventCost\(fd\);/);
  assert.match(screen, /<UndoToastHost \/>/);
});

test('2 · a line item and a logged payment: no trash — the row is the swipe, the same ask, then Undo', () => {
  const card = read('../_components/vendor-itemization-card.tsx');
  assert.doesNotMatch(card, /aria-label="Delete line item"|aria-label="Delete payment"/);
  assert.match(card, /<ConfirmSwipe\s+key=\{li\.line_item_id\}\s+action=\{deleteLineItem\}\s+fields=\{\{ event_id: eventId, line_item_id: li\.line_item_id \}\}\s+title="Delete this line item\?"/);
  assert.match(card, /<ConfirmSwipe\s+key=\{p\.payment_id\}\s+action=\{deletePayment\}\s+fields=\{\{ event_id: eventId, payment_id: p\.payment_id \}\}\s+title="Remove this logged payment\?"/);
  const swipe = read('../_components/confirm-swipe.tsx');
  assert.match(swipe, /const ok = await confirm\(\{ title, body: message, confirmLabel[\s\S]*?if \(!ok\) return close\(\);\s*deleteWithUndo\(\{/);
});
