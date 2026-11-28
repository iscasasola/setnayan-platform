/**
 * 👗 gown/fabric/weave — the fabric's surface at thread scale (prototype v195 `weaveTile`, `WEAVE_CM`, `WEAVE_AMT`,
 * `applyWeave`): a seamless 128 px tile of threads, grain, net or pile, with no lighting baked in, laid on the cloth so
 * one tile covers its real size. The weave only shades: its gain keeps the colour's brightness.
 *
 * The drawing takes any 2D context (the stage passes a canvas's; a test passes a recording one), so it stays testable.
 */
import type { GownStockFabric } from '../../gown-config';

/** The tile's size (px). */
export const GOWN_WEAVE_PX = 128;
/** How much cloth one tile covers (cm). */
export const GOWN_WEAVE_CM: Record<GownStockFabric, number> = {
  satin: 1.5, duchess: 1.5, bias_satin: 1.5, taffeta: 1, mikado: 1.2, crepe: 2, georgette: 2, chiffon: 1, organza: 1, tulle: 2.5, lace: 6, sequin: 2.4, pina: 1.6, jusi: 1.6, linen: 1.8, wool_suiting: 1.2, velvet: 2, stretch_crepe_jersey: 1.2,
};
/** How strongly the weave shades the cloth (v207; 0.55 when not listed). */
export const GOWN_WEAVE_AMT: Partial<Record<GownStockFabric, number>> = { satin: 0.25, duchess: 0.25, bias_satin: 0.25, taffeta: 0.4, mikado: 0.7, velvet: 0.35, crepe: 0.5, georgette: 0.5, lace: 0.45, sequin: 0.6 };
export const gownWeaveAmount = (k: GownStockFabric) => GOWN_WEAVE_AMT[k] ?? 0.55;

/** The few 2D drawing calls the tile uses (a CanvasRenderingContext2D has them all). */
export type GownCanvas2D = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'strokeStyle' | 'lineWidth' | 'fillRect' | 'beginPath' | 'moveTo' | 'lineTo' | 'arc' | 'ellipse' | 'fill' | 'stroke' | 'save' | 'restore' | 'translate' | 'rotate'
>;

const TAU = Math.PI * 2;

/** Draw the weave tile for a fabric (v195 `weaveTile`): white cloth, dark threads. */
export function drawGownWeave(g: GownCanvas2D, k: GownStockFabric): void {
  const W = GOWN_WEAVE_PX;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, W);
  // A seeded random per fabric, so a fabric always looks the same.
  let sd = 3;
  for (const ch of k) sd = (sd * 31 + ch.charCodeAt(0)) % 9973;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return (sd % 10000) / 10000; };
  const rows = (step: number, a: number, vert: boolean) => {
    g.fillStyle = `rgba(0,0,0,${a})`;
    for (let x = 0; x < W; x += step) vert ? g.fillRect(x, 0, Math.max(1, step / 2), W) : g.fillRect(0, x, W, Math.max(1, step / 2));
  };
  const twill = (step: number, a: number) => {
    g.strokeStyle = `rgba(0,0,0,${a})`;
    g.lineWidth = step / 2;
    for (let x = -W; x < 2 * W; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + W, W); g.stroke(); }
  };
  const dots = (n: number, r: number, a: number) => {
    for (let i = 0; i < n; i++) {
      const x = rnd() * W, y = rnd() * W;
      g.fillStyle = `rgba(0,0,0,${a * (0.5 + rnd())})`;
      for (const [dx, dy] of [[0, 0], [W, 0], [0, W], [-W, 0], [0, -W]] as const) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, TAU); g.fill(); }
    }
  };
  switch (k) {
    case 'satin': case 'duchess': case 'bias_satin': rows(4, 0.05, false); break; // long floats: barely there
    case 'taffeta': rows(3, 0.09, false); rows(6, 0.03, true); break; // a fine crosswise rib
    case 'mikado': twill(4, 0.12); rows(8, 0.04, true); break;
    case 'crepe': case 'georgette': dots(2600, 0.9, 0.12); break;
    case 'chiffon': case 'organza': rows(4, 0.1, false); rows(4, 0.1, true); break;
    case 'tulle':
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 1.2;
      for (let y = 0; y <= W; y += 8) for (let x = 0; x <= W; x += 16) {
        const ox = (y / 8) % 2 ? 8 : 0;
        g.beginPath();
        for (let a = 0; a <= 6; a++) { const t = (a / 6) * TAU, px = x + ox + 5 * Math.cos(t), py = y + 5 * Math.sin(t); if (a) g.lineTo(px, py); else g.moveTo(px, py); }
        g.stroke();
      }
      break;
    case 'lace':
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.lineWidth = 2;
      for (const [cx, cy] of [[32, 32], [96, 96], [96, 32], [32, 96]] as const) for (let p = 0; p < 6; p++) {
        g.save(); g.translate(cx, cy); g.rotate((p / 6) * TAU); g.beginPath(); g.ellipse(0, -11, 5, 10, 0, 0, TAU); g.stroke(); g.restore();
      }
      break;
    case 'sequin':
      for (let y = 0; y < W; y += 8) for (let x = ((y / 8) % 2) * 4; x < W + 4; x += 8) { g.fillStyle = `rgba(0,0,0,${0.12 + rnd() * 0.18})`; g.beginPath(); g.arc(x, y, 3.4, 0, TAU); g.fill(); }
      break;
    case 'pina': case 'jusi': case 'linen':
      rows(4, 0.1, false); rows(4, 0.1, true);
      // Slub threads.
      for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(0,0,0,${0.06 + rnd() * 0.08})`; g.fillRect(0, Math.floor((rnd() * W) / 2) * 2, W, 1 + Math.floor(rnd() * 2)); }
      break;
    case 'wool_suiting': twill(3, 0.14); break;
    case 'velvet': dots(1800, 0.6, 0.08); break;
    case 'stretch_crepe_jersey':
      g.strokeStyle = 'rgba(0,0,0,0.14)';
      g.lineWidth = 1;
      for (let y = 0; y < W; y += 4) for (let x = 0; x < W; x += 4) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 2, y + 3); g.lineTo(x + 4, y); g.stroke(); }
      break;
  }
}

/** The tile's repeat on the cloth (tiles per model unit), for the shader's weave scale. */
export const gownWeaveScale = (k: GownStockFabric, bodyScale: number) => (bodyScale * 100) / (GOWN_WEAVE_CM[k] || 1.5);

/** The weave only shades: the gain that keeps the colour's brightness, from the tile's red channel (RGBA bytes). */
export function gownWeaveGain(rgba: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < rgba.length; i += 4) m += rgba[i]!;
  return m > 0 ? (255 * (rgba.length / 4)) / m : 1;
}
