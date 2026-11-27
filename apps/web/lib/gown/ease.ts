/**
 * 👗 gown/ease — the gown's own sizes: body + ease (v186 `easeRows`, `renderEase`; women only). Pure.
 * The cutting blocks (lib/gown-pattern, step B6) read these rows; the bride and the designer see them as a small table.
 * 🔒 lib/gown/body-rules.test.ts
 */
import { GOWN_STRAPLESS, type GownBodyVals, type GownConfig, type GownMeasureKey } from '../gown-config';

export type GownEaseRow = {
  part: string;
  /** Her body, cm (in what she wears underneath). */
  body: number;
  /** Ease, cm (negative = cut smaller than the body). */
  ease: number;
  /** The gown's size in cm, or a word when the skirt flares free. */
  gown: number | string;
};

type EaseDesign = Pick<GownConfig, 'fabric' | 'boning' | 'neck' | 'sil' | 'sleeve'>;

/**
 * @param vals her numbers in what she wears underneath (`gownShapedVals`)
 * @param typed the gown measurements she typed, cm (only these give the arm, neck, wrist, thigh and knee rows)
 */
export function gownEaseRows(vals: GownBodyVals, design: EaseDesign, typed: Partial<Record<GownMeasureKey, number>> = {}): GownEaseRow[] {
  const stretch = design.fabric === 'stretch_crepe_jersey';
  const strapless = GOWN_STRAPLESS.includes(design.neck);
  const boned = design.boning !== 'soft' || strapless;
  const corset = design.boning === 'corset';
  const rows: GownEaseRow[] = [];
  const add = (part: string, body: number | undefined, ease: number, word?: string) => {
    if (body && body > 0) rows.push({ part, body, ease, gown: word ?? Math.round((body + ease) * 2) / 2 });
  };
  add('Bust', vals.bust, stretch ? -2 : corset ? 0 : boned ? 1 : 2.5);
  add('Waist', vals.waist, stretch ? -2 : corset ? -1 : boned ? 0.5 : 1.5);
  if (design.sil === 'sheath' || design.sil === 'mermaid') add('Hips', vals.hips, stretch ? -1 : design.sil === 'mermaid' ? 2 : 3);
  else add('Hips', vals.hips, 6, 'skirt flares: free');
  if (strapless && vals.underbust) add('Under bust', vals.underbust, corset ? -1 : 0.5);
  add('Upper arm', typed.upperArm, stretch ? 1 : design.sleeve === 'long' ? 4 : 3);
  add('Neck', typed.neck, 1.5);
  add('Wrist', typed.wrist, 3);
  add('Thigh', typed.thigh, stretch ? 0 : design.sil === 'mermaid' ? 3 : 5);
  add('Knee (mermaid flare starts below)', typed.knee, 4);
  return rows;
}

/** v186 `renderEase`: the one sentence under the table, for this design. */
export function gownEaseWhy(design: Pick<GownConfig, 'fabric' | 'boning' | 'neck'>): string {
  if (design.fabric === 'stretch_crepe_jersey') return 'Stretch fabric: cut a little smaller than the body (negative ease).';
  if (design.boning === 'corset') return 'Corset: cut to the body or a touch smaller; it is laced in.';
  if (design.boning !== 'soft' || GOWN_STRAPLESS.includes(design.neck)) return 'Boned or strapless: close to the body so it stays up.';
  return 'Woven, unboned: room to breathe, sit and dance.';
}
