/**
 * 👗 gown-pattern/order — one sent design → its cutting blocks, for the designer's order view (plan step B7). Pure.
 *
 * Her numbers in what she wears underneath (`gownShapedVals`), the design's own ease rows (`gownEaseRows`), the
 * gown measurements she gave or the mannequin estimated, and the designer's tape over both (tape > typed >
 * estimate, `draftMeasure`). Designer only: no price, no amount, anywhere on a block.
 * 🔒 lib/gown-pattern/order.test.ts
 */
import type { GownBody, GownConfig, GownMeasureKey, GownMeasures } from '../gown-config';
import { gownEaseRows } from '../gown/ease';
import { gownShapedVals } from '../gown/body-rules';
import { draftSkirt, type GownDraftRefusal, type GownSkirtDraft } from './skirt';
import { draftBodice, type GownBodiceDraft } from './bodice';
import { draftSleeve, type GownSleeveDraft, type GownSleeveNone } from './sleeve';
import { draftMeasure, type GownDraftOrder, type GownTape } from './inputs';
import { gownLinesOnBlocks, type GownOrderLines } from './lines';

export type GownOrderBlocks = {
  skirt: GownSkirtDraft | GownDraftRefusal;
  bodice: GownBodiceDraft | GownDraftRefusal;
  /** Step B10: the set-in sleeve (no block for no sleeve or a butterfly sleeve). */
  sleeve: GownSleeveDraft | GownSleeveNone | GownDraftRefusal;
  /** True when any number on either block is a 3D estimate: the sheet prints "ESTIMATE: measure before cutting". */
  est: boolean;
};

export function gownOrderOf(config: GownConfig, body: GownBody, measures: GownMeasures): GownDraftOrder {
  const typed: Partial<Record<GownMeasureKey, number>> = {};
  for (const [k, m] of Object.entries(measures)) if (m && m.from !== 'estimate') typed[k as GownMeasureKey] = m.cm;
  const vals = gownShapedVals(body.vals, config.shape);
  return { vals, sil: config.sil, hem: config.hem, measures, ease: gownEaseRows(vals, config, typed) };
}

export function gownOrderBlocks(config: GownConfig, body: GownBody, measures: GownMeasures, tape: GownTape = {}, lines: GownOrderLines | null = null): GownOrderBlocks {
  const order = gownOrderOf(config, body, measures);
  const skirt = draftSkirt(order, tape);
  const bodice = draftBodice(order, tape);
  // B9 (v209 patDrafts → lnBlocks): the design's own lines, drawn on the blocks when the order carries them.
  gownLinesOnBlocks(lines, draftMeasure(order, tape, 'waistFloor')[0], bodice, skirt);
  const sleeve = draftSleeve({ ...order, sleeve: config.sleeve }, tape);
  return { skirt, bodice, sleeve, est: (skirt.ok && skirt.est) || (bodice.ok && bodice.est) || (sleeve.ok && sleeve.est) };
}
