/** 👗 gown/send — what the bride sends passes every check the shop runs, and nothing she holds is a price (plan A10). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GOWN_STOCK_FABRICS, emptyGownHand, emptyGownQuantities, gownMeasuresNeeded, sanitizeGownBody, sanitizeGownConfig, sanitizeGownHand, sanitizeGownMeasures,
  sanitizeGownQuantities, startingGownBody, startingGownConfig, stockGownOffer,
} from '../gown-config';
import { gownChoose } from './compat';
import { stripComments } from '../strip-comments';
import { gownDesignSummary, gownMeasuresToSend, gownSendInput, gownSendPrivacy } from './send';

const fabrics = GOWN_STOCK_FABRICS.map((f) => ({ id: f.id, label: f.label }));

test('the design in words: one line per choice she can see', () => {
  const g = gownChoose(gownChoose(startingGownConfig(), { key: 'sil', value: 'ball' }).config, { key: 'veil', value: 'chapel' }).config;
  const lines = gownDesignSummary(g, fabrics);
  assert.ok(lines.includes('Silhouette: Ball gown'));
  assert.ok(lines.includes('Fabric: Satin'));
  assert.ok(lines.some((l) => l.startsWith('Veil: ')) && lines.some((l) => l.startsWith('Blusher: ')), 'a chosen veil brings its blusher');
  assert.ok(!gownDesignSummary(startingGownConfig(), fabrics).some((l) => l.startsWith('Blusher')), 'no veil, no blusher line');
  const own = { ...startingGownConfig(), lace: 'chantilly' as const, laceCol: 'custom' as const, laceHex: '#1F3A6E' };
  assert.ok(gownDesignSummary(own, fabrics).includes('Colour: her own colour #1F3A6E'), 'her own lace colour, said as itself (v207)');
});

test('the measurements sent are the ones this design needs, as the mannequin estimates them', () => {
  const g = gownChoose(startingGownConfig(), { key: 'sleeve', value: 'long' }).config, need = gownMeasuresNeeded(g);
  const est = Object.fromEntries(need.map((k, i) => [k, 30.26 + i])) as Record<string, number>;
  const m = gownMeasuresToSend(g, { ...est, waistFloor: 0 });
  assert.deepEqual(Object.keys(m).sort(), need.filter((k) => k !== 'waistFloor').sort());
  for (const v of Object.values(m)) assert.ok(v!.from === 'estimate' && v!.cm * 2 === Math.round(v!.cm * 2), 'an estimate, to the half cm');
  assert.ok(sanitizeGownMeasures(m).ok);
});

test('the send passes every check the shop runs, and carries no price or cost', () => {
  const config = startingGownConfig(), body = startingGownBody();
  const input = gownSendInput('thread-1', { config, body, hand: emptyGownHand(), quantities: emptyGownQuantities(), estimates: { napeWaist: 39 } });
  assert.equal(input.op, 'send');
  assert.ok(sanitizeGownConfig(input.config, stockGownOffer()).ok, 'the design');
  assert.ok(sanitizeGownBody(input.body).ok, 'her body');
  assert.ok(sanitizeGownMeasures(input.measures).ok, 'the measurements');
  assert.ok(sanitizeGownQuantities(input.quantities).ok, 'the quantities');
  assert.ok(sanitizeGownHand(input.hand).ok, 'her hand work, beside the design');
  assert.doesNotMatch(JSON.stringify(input), /price|cost|centavo|amount|₱/i, 'no money in what she sends');
  assert.equal(gownSendPrivacy('Casa Maria'), 'Your measurements go to Casa Maria only.', 'the approved privacy line (plan Q6)');
});

test('nothing the bride holds is a price: the maker\'s client files never read or print money', () => {
  for (const f of ['../../app/_components/gown-maker/gown-send.tsx', '../../app/_components/gown-maker/gown-designer.tsx', './send.ts', './quote/quantities.ts', './quote/measure.ts', './still.ts']) {
    const src = stripComments(readFileSync(join(__dirname, f), 'utf8'));
    assert.doesNotMatch(src, /formatPhp|centavos|estimateCentavos|forShop|unitCentavos|amountCentavos|₱|\bprice\b/i, `${f}: no price`);
  }
});
