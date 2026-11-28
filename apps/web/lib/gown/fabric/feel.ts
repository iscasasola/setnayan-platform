/**
 * 👗 gown/fabric/feel — one small card of numbers per fabric (prototype v207 `FEEL`, any-design plan step 2). The
 * drawing code reads only the card, so a new fabric is a new card: how wide and deep its folds are, how crisp, how it
 * takes the light, how see-through it is, how thick its edge is and how far it swings while she moves.
 * Weights and stiffness are research estimates (corpus fabric-types-research.md), marked to verify (D26).
 */
import type { GownStockFabric } from '../../gown-config';

export type GownShineType = 'satin' | 'mikado' | 'taffeta' | 'matte' | 'sheer' | 'crisp' | 'sequin' | 'velvet';

export type GownFeelCard = {
  name: string;
  /** Grams per square metre. */
  gsm: number;
  stretch: 'none' | '2way' | '4way';
  /** 0 floppy … 1 stiff. */
  stiff: number;
  /** How wide one fold is at the hem (cm). */
  foldCm: number;
  /** How deep a fold is (cm). */
  foldD: number;
  /** 0 round folds … 1 crisp, broken ones. */
  sharp: number;
  /** How this kind of cloth takes the light. */
  shine: GownShineType;
  /** How strong that shine is, 0 … 1. */
  gloss: number;
  /** How see-through, 0 … 1. */
  see: number;
  /** The hem and neckline edge (cm): thin for light cloth, a soft roll for heavy. */
  edge: number;
  /** How far it lags and lifts while she moves, 0 … 1. */
  swing: number;
  /** Fabric metres × this (bias-cut cloth is laid at 45°, so it takes more). */
  m?: number;
  /** One line for her under the fabric step. */
  why: string;
};

export const GOWN_FEEL: Record<GownStockFabric, GownFeelCard> = {
  satin: { name: 'Satin', gsm: 100, stretch: 'none', stiff: 0.35, foldCm: 22, foldD: 1.3, sharp: 0.1, shine: 'satin', gloss: 0.8, see: 0, edge: 0.3, swing: 0.55, why: 'Smooth and glossy: long soft highlights run down each fold.' },
  duchess: { name: 'Duchess satin', gsm: 240, stretch: 'none', stiff: 0.65, foldCm: 30, foldD: 1.7, sharp: 0.2, shine: 'satin', gloss: 0.62, see: 0, edge: 0.6, swing: 0.28, why: 'Heavy satin with a soft, deep lustre: holds a full skirt in wide, rounded folds.' },
  bias_satin: { name: 'Bias satin', gsm: 110, stretch: 'none', stiff: 0.12, foldCm: 13, foldD: 1.1, sharp: 0.05, shine: 'satin', gloss: 0.85, see: 0, edge: 0.15, swing: 0.85, m: 1.35, why: 'Satin cut on the bias: it pours over the body in liquid folds; cutting it takes more fabric.' },
  mikado: { name: 'Mikado', gsm: 260, stretch: 'none', stiff: 0.85, foldCm: 28, foldD: 1.8, sharp: 0.65, shine: 'mikado', gloss: 0.55, see: 0, edge: 0.7, swing: 0.18, why: 'Firm silk blend with a broad, quiet sheen: sculpted, structured folds.' },
  taffeta: { name: 'Taffeta', gsm: 140, stretch: 'none', stiff: 0.7, foldCm: 17, foldD: 1.5, sharp: 0.9, shine: 'taffeta', gloss: 0.6, see: 0, edge: 0.35, swing: 0.4, why: 'Crisp and rustling: sharp, broken folds that catch a shimmer of light.' },
  crepe: { name: 'Crepe', gsm: 170, stretch: 'none', stiff: 0.4, foldCm: 40, foldD: 0.2, sharp: 0, shine: 'matte', gloss: 0.1, see: 0, edge: 0.3, swing: 0.55, why: 'Matte and smooth: a clean, modern line with almost no folds.' },
  chiffon: { name: 'Chiffon', gsm: 40, stretch: 'none', stiff: 0.1, foldCm: 7, foldD: 0.5, sharp: 0.15, shine: 'sheer', gloss: 0.2, see: 0.55, edge: 0.06, swing: 0.95, why: 'Light and floaty: fine soft folds you can see through.' },
  georgette: { name: 'Georgette', gsm: 75, stretch: 'none', stiff: 0.2, foldCm: 9, foldD: 0.5, sharp: 0.1, shine: 'matte', gloss: 0.1, see: 0.4, edge: 0.08, swing: 0.85, why: 'A little heavier than chiffon, with a dry, grainy feel: flows and drapes.' },
  tulle: { name: 'Tulle', gsm: 30, stretch: '2way', stiff: 0.45, foldCm: 9, foldD: 0.6, sharp: 0.3, shine: 'sheer', gloss: 0.15, see: 0.7, edge: 0.05, swing: 0.75, why: 'Fine net: airy layers, clear face-on and misty where they gather.' },
  organza: { name: 'Organza', gsm: 55, stretch: 'none', stiff: 0.7, foldCm: 14, foldD: 0.8, sharp: 0.55, shine: 'crisp', gloss: 0.5, see: 0.6, edge: 0.06, swing: 0.5, why: 'Sheer but crisp: stands away from the body in light, glassy folds.' },
  lace: { name: 'Lace', gsm: 120, stretch: '2way', stiff: 0.5, foldCm: 16, foldD: 0.6, sharp: 0.2, shine: 'matte', gloss: 0.1, see: 0.5, edge: 0.1, swing: 0.55, why: 'Lace all over: the pattern is the fabric.' },
  sequin: { name: 'Sequin', gsm: 380, stretch: '2way', stiff: 0.55, foldCm: 28, foldD: 0.9, sharp: 0.2, shine: 'sequin', gloss: 0.95, see: 0.1, edge: 0.4, swing: 0.3, why: 'Covered in tiny sequins: a scatter of glints that move as she does.' },
  pina: { name: 'Piña', gsm: 35, stretch: 'none', stiff: 0.7, foldCm: 14, foldD: 0.7, sharp: 0.5, shine: 'crisp', gloss: 0.25, see: 0.65, edge: 0.06, swing: 0.45, why: 'Pineapple fibre: fine, crisp and sheer, with a soft natural sheen.' },
  jusi: { name: 'Jusi', gsm: 55, stretch: 'none', stiff: 0.55, foldCm: 14, foldD: 0.6, sharp: 0.4, shine: 'crisp', gloss: 0.3, see: 0.5, edge: 0.07, swing: 0.5, why: 'Silk or abaca blend: sheer and light, a little softer than piña.' },
  wool_suiting: { name: 'Wool suiting', gsm: 270, stretch: 'none', stiff: 0.6, foldCm: 30, foldD: 0.5, sharp: 0.3, shine: 'matte', gloss: 0.1, see: 0, edge: 0.5, swing: 0.2, why: 'Tailoring cloth: holds a crisp line.' },
  linen: { name: 'Linen', gsm: 170, stretch: 'none', stiff: 0.5, foldCm: 20, foldD: 0.6, sharp: 0.6, shine: 'matte', gloss: 0.05, see: 0.05, edge: 0.3, swing: 0.3, why: 'Natural and dry: relaxed folds and small creases.' },
  velvet: { name: 'Velvet', gsm: 300, stretch: 'none', stiff: 0.5, foldCm: 26, foldD: 1.2, sharp: 0.1, shine: 'velvet', gloss: 0.5, see: 0, edge: 0.6, swing: 0.25, why: 'Deep pile: rich colour, glowing at the edges.' },
  stretch_crepe_jersey: { name: 'Stretch crepe jersey', gsm: 220, stretch: '4way', stiff: 0.3, foldCm: 18, foldD: 0.5, sharp: 0.05, shine: 'matte', gloss: 0.1, see: 0, edge: 0.2, swing: 0.65, why: 'Stretchy and fluid: follows the body closely.' },
};

/** Glitter tulle (v207: a tulle card with its own weight and see-through): never one of the gown's own fabrics. */
export const GOWN_FEEL_GLITTER_TULLE: GownFeelCard = { ...GOWN_FEEL.tulle, name: 'Glitter tulle', gsm: 35, see: 0.66 };

/** The card for a stock id; an unknown id reads as satin, exactly as the prototype's `feelOf`. */
export const gownFeelOf = (k: string): GownFeelCard => (Object.prototype.hasOwnProperty.call(GOWN_FEEL, k) ? GOWN_FEEL[k as GownStockFabric] : GOWN_FEEL.satin);

/** The shine types in the shader's own numbering (v207 `SHINE_IX`). */
export const GOWN_SHINE_IX: Record<GownShineType, number> = { satin: 1, mikado: 2, taffeta: 3, matte: 4, sheer: 5, crisp: 6, sequin: 7, velvet: 8 };

/**
 * The uneven folds round the skirt, 0 … 1 per column (v207 `foldPattern`): three waves of the fabric's own fold width
 * over a slow swell, so no two folds are alike (the old even "pumpkin" ribs are gone).
 */
export function gownFoldPattern(k: string, n: number): Float32Array {
  const c = gownFeelOf(k), K = Math.min(14, Math.max(6, Math.round(220 / c.foldCm))), K2 = Math.round(K * 1.53), K3 = Math.max(2, Math.round(K * 0.57));
  const a = new Float32Array(n), dth = (Math.PI * 2) / n;
  let lo = 1e9, hi = -1e9;
  for (let q = 0; q < n; q++) {
    const f = q * dth, v = (0.55 * Math.cos(K * f + 0.6) + 0.3 * Math.cos(K2 * f + 2.1) + 0.25 * Math.cos(K3 * f + 4.2)) * (0.72 + 0.28 * Math.cos(2 * f + 1.1));
    a[q] = v; lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  for (let q = 0; q < n; q++) a[q] = (a[q]! - lo) / (hi - lo);
  return a;
}

/**
 * How much a sheer cloth hides her face-on (v207 `seeAlpha`): clear enough to see what is under it; a lining and more
 * petticoat layers make it denser.
 */
export function gownSeeAlpha(c: Pick<GownFeelCard, 'see'>, lined: boolean, layers: number): number {
  const a = lined ? 1 - 0.85 * c.see + 0.05 * layers : 1 - 0.95 * c.see + 0.04 * layers;
  return Math.min(0.85, Math.max(0.22, a));
}

/** How the cloth swings while she moves (v207 `applyFabric`): light cloth lags and lifts more, heavy cloth swings as one. */
export function gownSwing(c: Pick<GownFeelCard, 'swing'>, skirtLayers: number): { kc: number; damp: number; gain: number } {
  const sw = c.swing, lay = (skirtLayers || 2) - 1;
  return { kc: 26 + 100 * (1 - sw), damp: 1.2 + 3.6 * (1 - sw) + 0.35 * lay, gain: (0.25 + 2.6 * sw * sw) * (1 - 0.07 * lay) };
}

/** How deep the skirt's folds read for this cloth (v207: `foldK × clamp(foldD / 1.3, 0.2, 1.25)`). */
export const gownFoldDepthK = (c: Pick<GownFeelCard, 'foldD'>) => Math.min(1.25, Math.max(0.2, c.foldD / 1.3));

/** The neckline lip's inset (model metres, before the body's scale): as thick as the cloth (v207). */
export const gownEdgeLip = (c: Pick<GownFeelCard, 'edge'>) => Math.min(0.0045, 0.001 + 0.006 * c.edge);
