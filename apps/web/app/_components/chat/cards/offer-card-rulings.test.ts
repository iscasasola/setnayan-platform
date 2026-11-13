/**
 * 🏷 THE OFFER CARD OBEYS THE 13 NOV RULINGS — the rules are executed in lib/offer-drop.test.ts; this proves the card
 * is WIRED to them, so a rule can't pass its own test while the screen ignores it. Read from source, comments stripped.
 *
 *   R1  the couple's card renders nothing unless `coupleSeesDrop` says so (active only · better only);
 *   R2  the supplier's picker greys a not-better offer through PickMenu's `disabledNote` from `dropPicks`, and a pick
 *       of a greyed offer is ignored (the row is not a button, and `onPick` re-checks);
 *   R3  the picked offer shows `dropSavesWords` — "<couple> will save ₱X more than the current quotation" + "New total is";
 *   R4  the greyed row says it is disabled (`aria-disabled`).
 *
 * SABOTAGE (seen red, restored): delete the `coupleSeesDrop` early return → R1; drop the `pickable` check in `onPick`
 * → R2. Run from apps/web: npx tsx --test app/_components/chat/cards/offer-card-rulings.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments as strip } from '@/lib/strip-comments';

const CARD = strip(readFileSync(join(process.cwd(), 'app/_components/chat/cards/offer-card.tsx'), 'utf8'));
const ROW = strip(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/website/editor/_components/pick-menu-off-row.tsx'), 'utf8'));

test('R1 — the couple sees a drop only when coupleSeesDrop allows it', () => {
  assert.match(CARD, /if \(viewer === 'couple' && !coupleSeesDrop\(st, preview\)\) return null;/);
});

test('R2 — a not-better offer is greyed via dropPicks and cannot be picked', () => {
  assert.match(CARD, /const picks = dropPicks\(/);
  assert.match(CARD, /disabledNote: pickOf\(o\.offer\.id\)\?\.pickable \? undefined : /);
  assert.match(CARD, /onPick=\{\(k\) => \{\s*if \(pickOf\(k\)\?\.pickable\) setPick\(k\);/);
  assert.match(CARD, /const chosen = chosenRow && chosenPick\?\.pickable \? chosenRow : null;/, 'a greyed offer could still be the one sent');
});

test('R3 — a better pick shows how much more the couple saves and the new total', () => {
  assert.match(CARD, /dropSavesWords\(ctx\?\.couple \?\? '', chosenPick\)/);
  assert.match(CARD, /\{saves\[0\]\}[\s\S]*\{saves\[1\]\}/);
});

test('R4 — the greyed row is announced as disabled', () => {
  assert.match(ROW, /aria-disabled="true"/);
});
