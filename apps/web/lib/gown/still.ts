/**
 * 👗 gown/still — the design's 2D picture (prototype v210 tile shapes, `ICONS`): the silhouette with its neckline, the
 * sleeves, a train and a veil, drawn in a 40 × 56 box in the gown's own colour. The card and the send screen show this
 * first; the stage's one 3D frame replaces it once on screen (`GownStill`). Women only.
 */
import { GOWN_COLOURS, type GownConfig } from '../gown-config';

/** v210 `ICONS`: each choice's shape in a 40 × 56 box (the picker tiles' own paths). */
export const GOWN_STILL_PATHS = {
  sil: { aline: 'M15 6h10l-1 12 10 34H6l10-34z', fitflare: 'M15 6h10l-1 14 1 8 7 24H8l7-24 1-8z', ball: 'M15 6h10l-1 14q14 10 13 32H3q-1-22 13-32z', mermaid: 'M15 6h10l-1 14-1 16 9 16H8l9-16-1-16z', sheath: 'M15 6h10l-1 14 1 32H15l1-32z', terno: 'M15 9h10l-1 11 7 32H9l7-32zM15 9q-8-7-7 5zM25 9q8-7 7 5z' },
  sleeve: { cap: 'M13 12l-6 4 3 5 3-2zM27 12l6 4-3 5-3-2z', long: 'M13 12l-7 4v30h4V20zM27 12l7 4v30h-4V20z', butterfly: 'M13 14Q4 2 6 16zM27 14q9-12 7 2z', flutter: 'M13 12l-9 6 2 12 7-6zM27 12l9 6-2 12-7-6z' },
  train: { sweep: 'M27 46h4v2H31z', chapel: 'M28 46l9 2v2H28z', cathedral: 'M26 44l13 4v2H26z' },
  veil: { elbow: 'M16 3l-7 20h6z', fingertip: 'M16 3l-8 30h6z', floor: 'M16 3L8 52h6z', chapel: 'M16 3L6 52h8z', cathedral: 'M16 3L2 54h14z' },
} as const;

/** The gown's colour as a colour value (the design's own data, never a style choice). */
export function gownStillColour(g: Pick<GownConfig, 'colour' | 'colourHex'>): string {
  if (g.colour === 'custom' && g.colourHex) return g.colourHex;
  return GOWN_COLOURS.find((c) => c.id === g.colour)?.hex ?? GOWN_COLOURS[0]!.hex;
}

/** The layers to draw, back to front: the veil (sheer), the train, the gown, its sleeves. */
export function gownStillLayers(g: Pick<GownConfig, 'sil' | 'sleeve' | 'train' | 'veil' | 'colour' | 'colourHex'>): { d: string; sheer: boolean }[] {
  const P = GOWN_STILL_PATHS, out: { d: string; sheer: boolean }[] = [];
  const veil = (P.veil as Record<string, string>)[g.veil];
  if (veil) out.push({ d: veil, sheer: true });
  const train = (P.train as Record<string, string>)[g.train];
  if (train) out.push({ d: train, sheer: false });
  out.push({ d: P.sil[g.sil], sheer: false });
  const sleeve = (P.sleeve as Record<string, string>)[g.sleeve];
  if (sleeve) out.push({ d: sleeve, sheer: g.sleeve === 'flutter' });
  return out;
}
