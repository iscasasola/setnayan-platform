/**
 * 👗 gown/fabric/types — how each fabric type behaves on the mannequin (prototype v189 `FABRICS`, `softness`,
 * `applyFabric`). The live list is the database registry (`gown_fabric_types`, Builder B): each row names the stock
 * type it renders as (`renderAs`). This table is the code fallback and the seed. Weights and stiffness are research
 * estimates (corpus fabric-types-research.md), marked to verify (D26).
 */
import type { GownStockFabric } from '../../gown-config';
import { GOWN_FEEL, GOWN_FEEL_GLITTER_TULLE, gownFeelOf, gownFoldDepthK, gownSwing } from './feel';

export type GownStretch = 'none' | '2way' | '4way';
export type GownFabricProps = {
  name: string;
  /** Grams per square metre. */
  gsm: number;
  /** 0 floppy … 1 stiff. */
  stiff: number;
  /** 0 matte … 1 high shine. */
  sheen: number;
  /** 0 opaque … 1 see-through. */
  sheer: number;
  stretch: GownStretch;
};

/**
 * Glitter tulle (v200 `FABRICS.glitter_tulle`): tulle with a fine sparkle, for a veil, a cape, an overlay or a layer
 * under the skirt. A lookup only, never one of the gown's own fabrics; it shines as tulle does (v200 `SHINE.glitter_tulle`).
 */
export const GOWN_GLITTER_TULLE: GownFabricProps = { name: 'Glitter tulle', gsm: GOWN_FEEL_GLITTER_TULLE.gsm, stiff: GOWN_FEEL_GLITTER_TULLE.stiff, sheen: 0.3, sheer: GOWN_FEEL_GLITTER_TULLE.see, stretch: '2way' };

/** The fabrics' behaviour, derived from their feel cards (v207 `FABRICS`: a new fabric is a new card). */
export const GOWN_FABRIC_PROPS = Object.fromEntries(
  Object.entries(GOWN_FEEL).map(([k, c]) => [k, { name: c.name, gsm: c.gsm, stiff: c.stiff, sheen: c.gloss, sheer: c.see, stretch: c.stretch }]),
) as Record<GownStockFabric, GownFabricProps>;

/**
 * A type the code does not know and the registry gives no `renderAs` for draws as matte crepe: an honest neutral,
 * never satin (a wrong shine is a promise about the cloth).
 */
export const GOWN_FABRIC_FALLBACK: GownStockFabric = 'crepe';

/** A registry row as the bride's device receives it (Builder B's `gown_fabric_types`): only how the cloth behaves. */
export type GownFabricTypeRow = { id: string; name: string; renderAs: string; gsm?: number; stiff?: number; sheen?: number; sheer?: number; stretch?: GownStretch };

const isStock = (id: string): id is GownStockFabric => Object.prototype.hasOwnProperty.call(GOWN_FABRIC_PROPS, id);

/** The stock type a fabric type id draws as, and the properties it behaves with (the registry's numbers win over the stock's). */
export function gownFabricType(id: string, registry: readonly GownFabricTypeRow[] = []): { drawAs: GownStockFabric; props: GownFabricProps } {
  const row = registry.find((r) => r.id === id);
  const drawAs: GownStockFabric = isStock(id) ? id : row && isStock(row.renderAs) ? row.renderAs : GOWN_FABRIC_FALLBACK;
  const base = GOWN_FABRIC_PROPS[drawAs];
  if (!row) return { drawAs, props: base };
  const pick = (v: number | undefined, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    drawAs,
    props: { name: row.name || base.name, gsm: pick(row.gsm, base.gsm), stiff: pick(row.stiff, base.stiff), sheen: pick(row.sheen, base.sheen), sheer: pick(row.sheer, base.sheer), stretch: row.stretch ?? base.stretch },
  };
}

/** v189 `softness`: 0.05 (holds its shape) … 1 (floats). */
export const gownFabricSoftness = (f: GownFabricProps) => Math.min(1, Math.max(0.05, 1 - 0.55 * f.stiff - 0.45 * Math.min(f.gsm / 400, 1)));

/** v189 `PETTI`: how far the petticoat holds the skirt out. */
export const GOWN_PETTI_HOLD = { none: 0.86, soft: 1, full: 1.18, hoop: 1.32 } as const;

/**
 * How the cloth hangs and swings for a fabric and a number of skirt layers (v207 `applyFabric`): the swing comes from
 * the fabric's feel card (light cloth lags and lifts more, heavy cloth swings as one), and its folds are as deep as
 * the card says. `t` is `gownFabricType(...)`: a registry fabric moves as the stock type it draws as.
 */
export function gownClothFeel(t: { drawAs: GownStockFabric; props: GownFabricProps }, skirtLayers: number): { kc: number; damp: number; gain: number; foldK: number; hold: number } {
  const F = gownFabricSoftness(t.props), card = gownFeelOf(t.drawAs);
  return { ...gownSwing(card, skirtLayers), foldK: (0.6 + 0.8 * F) * gownFoldDepthK(card), hold: 0.78 + 0.45 * t.props.stiff };
}

/** The one-line note under the fabric step (v189 `applyFabric`). */
export function gownFabricNote(f: GownFabricProps, lined: boolean, why = ''): string {
  const F = gownFabricSoftness(f), sheer = f.sheer > 0.3;
  const feel = F > 0.8 ? 'very light and soft: floats, swings wide and settles slowly' : F > 0.6 ? 'light: drapes softly and swings freely' : F > 0.42 ? 'medium: drapes with some body' : 'firm: holds its shape, moves less and stops sooner';
  const stretch = f.stretch !== 'none' ? `, ${f.stretch === '4way' ? 'four-way' : 'two-way'} stretch` : '';
  const see = sheer ? (lined ? ' Sheer over its lining: shown with its own colour.' : ' Sheer and unlined: shown see-through.') : '';
  return `${why ? why + ' ' : ''}${f.name}: about ${f.gsm} gsm, ${feel}${stretch}.${see}`;
}
