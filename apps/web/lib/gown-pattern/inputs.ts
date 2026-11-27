/**
 * 👗 gown-pattern/inputs — every number a cutting block reads, and where it came from (plan step B6; prototype v179
 * `draftInputs`, and the `inp` / `er` helpers inside `draftSkirt` and `draftBodice`). Pure.
 *
 * The order of trust is the designer's: her TAPE at the fitting (gown_fittings) → what the bride TYPED → the 3D
 * ESTIMATE. Her body numbers (height, bust, waist, hips, underbust, shoulders) are tagged `body`; the heel `design`.
 * A block drawn from any estimate prints "ESTIMATE: measure before cutting" (lib/gown-pattern/draft-constants.ts).
 * 🔒 lib/gown-pattern/pattern.test.ts
 */
import {
  GOWN_MEASURES,
  type GownBodyVals,
  type GownHem,
  type GownMeasureKey,
  type GownMeasures,
  type GownSilhouette,
} from '../gown-config';
import type { GownEaseRow } from '../gown/ease';

export type GownDraftSource = 'tape' | 'typed' | 'estimate' | 'body' | 'design' | 'missing';

/** The designer's tape for one design (gown_fittings.fit): cm by measurement. */
export type GownTape = Partial<Record<GownMeasureKey, number>>;

/** What the blocks need from one sent design. Nothing here carries money. */
export type GownDraftOrder = {
  vals: Partial<GownBodyVals>;
  sil: GownSilhouette;
  hem: GownHem;
  /** Heel height, cm (0 = flat). */
  heel?: number;
  measures: GownMeasures;
  /** The design's ease rows (lib/gown/ease.ts `gownEaseRows`). */
  ease: readonly GownEaseRow[];
};

const positive = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;

/** One gown measurement by the order of trust: tape → typed → estimate. `[0, 'missing']` when none is known. */
export function draftMeasure(order: GownDraftOrder, tape: GownTape, key: GownMeasureKey): [number, GownDraftSource] {
  const t = tape[key];
  if (positive(t)) return [t, 'tape'];
  const m = order.measures[key];
  if (m && positive(m.cm) && m.from === 'typed') return [m.cm, 'typed'];
  if (m && positive(m.cm) && m.from === 'estimate') return [m.cm, 'estimate'];
  return [0, 'missing'];
}

/** The ease of the first row whose part starts with `part`, or null (prototype `er`). */
export function draftEase(order: GownDraftOrder, part: string): number | null {
  const row = order.ease.find((r) => r.part.startsWith(part));
  return row && Number.isFinite(row.ease) ? row.ease : null;
}

/** The label a designer reads for a measurement key. */
export function measureLabel(key: string): string {
  return GOWN_MEASURES.find((m) => m.id === key)?.label ?? key;
}

export type GownDraftInput = { value: number; source: Exclude<GownDraftSource, 'missing'> };

/** Every number a block may use, each tagged with its source (prototype v179 `draftInputs`). */
export function gownDraftInputs(order: GownDraftOrder, tape: GownTape = {}): Record<string, GownDraftInput | null> {
  const out: Record<string, GownDraftInput | null> = {};
  for (const { id } of GOWN_MEASURES) {
    const [value, source] = draftMeasure(order, tape, id);
    out[id] = source === 'missing' ? null : { value, source };
  }
  for (const k of ['height', 'bust', 'waist', 'hips', 'underbust', 'shoulders'] as const) {
    const x = order.vals[k];
    if (positive(x)) out[k] = { value: x, source: 'body' };
  }
  out.heel = { value: positive(order.heel) ? order.heel : 0, source: 'design' };
  return out;
}
