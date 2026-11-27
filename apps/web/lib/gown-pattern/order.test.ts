/**
 * 👗 THE GOWN ON THE ORDER (plan step B7): her design → the designer's cutting blocks, with the tape over her numbers.
 *
 *   1 · Every measurement is tagged (tape · typed · estimate); "ESTIMATE: measure before cutting" shows exactly when a
 *       number on a block is an estimate, and goes away once the tape covers it.
 *   2 · The order screen: reads the design through the one action, saves the tape through `fit`, draws the blocks only
 *       when opened, shows the estimate line, prices nothing itself, and has no "Open on the mannequin" yet (A8).
 *   (A couple session cannot read the tape: tests/db/gown-maker-keeps-her-numbers-private.db.test.ts, step B1.)
 *
 * Run: cd apps/web && npx tsx --test lib/gown-pattern/order.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startingGownBody, startingGownConfig, type GownMeasures } from '../gown-config';
import { gownOrderBlocks, gownOrderOf } from './order';
import { gownDraftInputs } from './inputs';

const config = { ...startingGownConfig(), sil: 'sheath' as const };
const body = startingGownBody();
const est: GownMeasures = { waistHip: { cm: 22, from: 'estimate' }, waistFloor: { cm: 100, from: 'estimate' } };

test('1 · every number is tagged; the estimate line shows exactly while an estimate is on a block', () => {
  const a = gownOrderBlocks(config, body, est);
  assert.ok(a.skirt.ok, 'the skirt did not draft');
  assert.equal(a.est, true, 'a block from estimates is not marked');
  const tagged = gownDraftInputs(gownOrderOf(config, body, est), { waistFloor: 101 });
  assert.deepEqual(tagged.waistFloor, { value: 101, source: 'tape' });
  assert.deepEqual(tagged.waistHip, { value: 22, source: 'estimate' });
  const taped = gownOrderBlocks(config, body, est, { waistHip: 21, waistFloor: 101 });
  assert.ok(taped.skirt.ok && !taped.skirt.est, 'the tape did not replace the estimate on the skirt');
  const typed = gownOrderBlocks(config, body, { waistHip: { cm: 22, from: 'typed' }, waistFloor: { cm: 100, from: 'typed' } });
  assert.ok(typed.skirt.ok && !typed.skirt.est);
});

test('2 · the order screen reads, saves the tape, draws on demand, marks estimates, prices nothing itself', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const panel = strip(readFileSync(join(__dirname, '..', '..', 'app/vendor-dashboard/clients/[eventId]/_components/gown-order-panel.tsx'), 'utf8'));
  assert.match(panel, /gownAction\(\{ op: 'design', threadId, messageId \}\)/);
  assert.match(panel, /gownAction\(\{ op: 'fit', threadId, designId: d\.designId, tape \}\)/);
  assert.match(panel, /import\('@\/lib\/gown-pattern\/order'\)/, 'the pattern engine is in the order page’s first load');
  assert.match(panel, /\{GOWN_DRAFT_ESTIMATE\}/);
  assert.match(panel, /svgs\.est \?/, 'the estimate line is not tied to the blocks’ own estimate flag');
  assert.doesNotMatch(panel, /gownDesignOf\(|pricePerMetre|\* l\.qty/, 'the screen prices the design itself');
  assert.doesNotMatch(panel, /mannequin'?\s*\/?>|Open on the mannequin/, 'a mannequin button ships before step A8');
  assert.doesNotMatch(panel, /onClick=\{\(\) => \{\}\}|href="#"/);
  const details = readFileSync(join(__dirname, '..', '..', 'app/vendor-dashboard/clients/[eventId]/_pages/details.tsx'), 'utf8');
  assert.match(details, /<GownDesignOnOrder ctx=\{ctx\} \/>/, 'the order page does not draw her design');
});
