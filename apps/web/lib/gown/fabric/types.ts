/**
 * 👗 gown/fabric/types — how each fabric type behaves on the mannequin (prototype v189 `FABRICS`, `softness`,
 * `applyFabric`). The live list is the database registry (`gown_fabric_types`, Builder B): each row names the stock
 * type it renders as (`renderAs`). This table is the code fallback and the seed. Weights and stiffness are research
 * estimates (corpus fabric-types-research.md), marked to verify (D26).
 */
import type { GownStockFabric } from '../../gown-config';

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

export const GOWN_FABRIC_PROPS: Record<GownStockFabric, GownFabricProps> = {
  satin: { name: 'Satin', gsm: 100, stiff: 0.35, sheen: 0.8, sheer: 0, stretch: 'none' },
  mikado: { name: 'Mikado', gsm: 260, stiff: 0.85, sheen: 0.55, sheer: 0, stretch: 'none' },
  crepe: { name: 'Crepe', gsm: 170, stiff: 0.4, sheen: 0.1, sheer: 0, stretch: 'none' },
  chiffon: { name: 'Chiffon', gsm: 40, stiff: 0.1, sheen: 0.2, sheer: 0.55, stretch: 'none' },
  georgette: { name: 'Georgette', gsm: 75, stiff: 0.2, sheen: 0.1, sheer: 0.4, stretch: 'none' },
  tulle: { name: 'Tulle', gsm: 30, stiff: 0.45, sheen: 0.15, sheer: 0.7, stretch: '2way' },
  organza: { name: 'Organza', gsm: 55, stiff: 0.7, sheen: 0.5, sheer: 0.6, stretch: 'none' },
  lace: { name: 'Lace', gsm: 120, stiff: 0.5, sheen: 0.1, sheer: 0.5, stretch: '2way' },
  sequin: { name: 'Sequin', gsm: 380, stiff: 0.55, sheen: 0.95, sheer: 0.1, stretch: '2way' },
  pina: { name: 'Piña', gsm: 35, stiff: 0.7, sheen: 0.25, sheer: 0.65, stretch: 'none' },
  jusi: { name: 'Jusi', gsm: 55, stiff: 0.55, sheen: 0.3, sheer: 0.5, stretch: 'none' },
  wool_suiting: { name: 'Wool suiting', gsm: 270, stiff: 0.6, sheen: 0.1, sheer: 0, stretch: 'none' },
  linen: { name: 'Linen', gsm: 170, stiff: 0.5, sheen: 0.05, sheer: 0.05, stretch: 'none' },
  velvet: { name: 'Velvet', gsm: 300, stiff: 0.5, sheen: 0.5, sheer: 0, stretch: 'none' },
  stretch_crepe_jersey: { name: 'Stretch crepe jersey', gsm: 220, stiff: 0.3, sheen: 0.1, sheer: 0, stretch: '4way' },
};

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

/** How the cloth hangs and swings for a fabric and a number of skirt layers (v189 `applyFabric`). */
export function gownClothFeel(f: GownFabricProps, skirtLayers: number): { kc: number; damp: number; gain: number; foldK: number; hold: number } {
  const F = gownFabricSoftness(f), lay = (skirtLayers || 2) - 1;
  return {
    kc: 30 + 90 * (1 - F),
    damp: 1.3 + 3.4 * (1 - F) + 0.35 * lay,
    gain: (0.3 + 2.2 * F * F) * (1 - 0.07 * lay),
    foldK: 0.6 + 0.8 * F,
    hold: 0.78 + 0.45 * f.stiff,
  };
}

/** The one-line note under the fabric step (v189 `applyFabric`). */
export function gownFabricNote(f: GownFabricProps, lined: boolean): string {
  const F = gownFabricSoftness(f), sheer = f.sheer > 0.3;
  const feel = F > 0.8 ? 'very light and soft: floats, swings wide and settles slowly' : F > 0.6 ? 'light: drapes softly and swings freely' : F > 0.42 ? 'medium: drapes with some body' : 'firm: holds its shape, moves less and stops sooner';
  const stretch = f.stretch !== 'none' ? `, ${f.stretch === '4way' ? 'four-way' : 'two-way'} stretch` : '';
  const see = sheer ? (lined ? ' Sheer over its lining: shown with its own colour.' : ' Sheer and unlined: shown see-through.') : '';
  return `${f.name}: about ${f.gsm} gsm, ${feel}${stretch}.${see}`;
}
