/**
 * 👗 gown/dress/layers — the fabric the layers under the skirt take (quantities only, never money).
 *
 * Tulle stays as prototype v193 `quoteLines` has it: metres per petticoat for two layers, scaled by the layers worn.
 * Organza and chiffon (v192: each layer its own material) are derived like the gown's own skirt: the layer's hem
 * circumference times a gathering factor, cut in widths of the fabric, each width the layer's length plus a 10 cm
 * allowance, then +15 % for matching and waste, rounded up to the next 10 cm. The gathering factors are starting
 * estimates (coordinator, 27 Nov) that a designer can later adjust in the shop's setup (Builder B).
 */
import type { GownPetticoat } from '../../gown-config';

/** Tulle for the petticoat, metres per two layers (v193 `quoteLines`). */
export const GOWN_TULLE_M_PER_TWO_LAYERS: Record<GownPetticoat, number> = { none: 0, soft: 6, full: 12, hoop: 6 };
/** How much fuller than the hem each gathered layer is cut. Starting estimates; the designer may change them. */
export const GOWN_LAYER_GATHER = { organza: 1.5, chiffon: 2 } as const;
export type GownGatheredLayer = keyof typeof GOWN_LAYER_GATHER;
/** Fabric width when the designer sets none (cm). */
export const GOWN_FABRIC_WIDTH_CM = 150;

/** The petticoat's tulle (metres) for the layers worn (v193). */
export const gownTulleMetres = (petti: GownPetticoat, layers: number) => GOWN_TULLE_M_PER_TWO_LAYERS[petti] * (layers / 2);

/**
 * One organza or chiffon layer (metres): `hemM` its hem circumference and `lengthM` its length from the waist, both from
 * the same shell the 3D layer is drawn as. `gather` and `widthCm` default to the stock factor and 150 cm fabric.
 */
export function gownLayerMetres(kind: GownGatheredLayer, hemM: number, lengthM: number, opt: { gather?: number; widthCm?: number } = {}): number {
  if (!(hemM > 0) || !(lengthM > 0)) return 0;
  const gather = opt.gather ?? GOWN_LAYER_GATHER[kind], width = (opt.widthCm ?? GOWN_FABRIC_WIDTH_CM) / 100;
  const widths = Math.ceil((hemM * gather) / width);
  return Math.ceil(widths * (lengthM + 0.1) * 1.15 * 10) / 10;
}
