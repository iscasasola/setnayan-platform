/**
 * 👗 gown/quote/quantities — what this design needs, as the shop's quote reads it (prototype v206 `quoteLines`, the
 * quantity half). Materials and the things that drive the workshop hours only; never a price (the shop prices them on
 * the server, from its own list). Women only.
 *
 * The stage measures the parts on her (`GownMeasured`); this turns the design and those measurements into the contract's
 * `GownQuantities`. Her hand-placed beads and lace are NOT counted here: they travel beside the design (`GownHand`) and the
 * shop's quote adds them itself, so counting them here too would charge them twice.
 */
import {
  GOWN_BEAD_KINDS, emptyGownQuantities, gownCapeInGownFabric, gownCapeKind, gownCapeNow, gownSleeveDetach, gownSleeveIsExtra,
  type GownBeadKind, type GownConfig, type GownQuantities, type GownStraps, type GownTrim,
} from '../../gown-config';

/** What the stage measured on her and this gown (metres, or counts). Raw: before any allowance is added here. */
export type GownMeasured = {
  /** The gown's own panels laid flat on 150 cm fabric (v189 `fabricMetres` before the cape, the extras and the 15 %). */
  panelM: number;
  /** The cape laid flat (v196 `capeMetres`), its edge length, and whether it hangs from one shoulder of a strapless neckline. */
  capeM: number; capeEdgeM: number; capeStrap: boolean;
  /** The overlay laid flat (v195 `ovMetres`). */
  overlayM: number;
  /** Flutter sleeves laid flat (v195 `flutterMetres`); the new sleeves' panels (v203 `slxSleeveMetres`). */
  flutterM: number; sleeveM: number;
  /** The bodice, neckline to waist, and the back opening, neckline to waist (v186: `T.top[0] − T.yS`, `T.top[N/2] − T.yS`). */
  bodiceM: number; backM: number;
  /** The bones in this gown (v198 `boneSet(B).n`). */
  bones: number;
  /** Round the hem (for horsehair braid). */
  hemRoundM: number;
  /** The ready-made lace motifs to make, mirrored (v202 `countN`), without the ones placed by hand. */
  laceMotifs: number;
  /** Beads by kind: the ready-made layers and the scattered pearls, without the ones placed by hand. */
  beads: Record<GownBeadKind, number>;
  /** Each trim's edge length round the gown (v186 `edge`). */
  trims: { trim: GownTrim; edgeM: number }[];
  /** v199 straps as built: their kind, metres (rouleau or cloth), and crystals on a beaded edge. */
  straps: { kind: GownStraps; metres: number; ribbon: boolean; beads: number } | null;
  /** v200: 3D flowers to make (every one, not only those drawn); raised lace; glitter tulle metres in the layers and the veil. */
  flowers: number; laceRaised: boolean; glitterLayersM: number; glitterVeilM: number;
  /** v197/v198: the illusion zone is worn (a bodice, a back or a plunge mesh) and its tulle metres. */
  illusionWorn: boolean; illusionM: number;
};

const r1 = (x: number) => Math.round(x * 10) / 10;
const ceil1 = (x: number) => Math.ceil(x * 10) / 10;
/** v186: petticoat tulle by petticoat (for two layers), and the veil's own tulle by length (metres). */
export const GOWN_PETTI_NET_M = { none: 0, soft: 6, full: 12, hoop: 6 } as const;
export const GOWN_VEIL_NET_M = { none: 0, elbow: 1.2, fingertip: 1.5, floor: 2.5, chapel: 3, cathedral: 3.6 } as const;
/** v186: a set length of sleeve fabric by sleeve (metres), when the sleeves are their own line. */
const SLEEVE_M: Partial<Record<GownConfig['sleeve'], number>> = { long: 1, butterfly: 0.8, cap: 0.4 };

/** The accent is on when the design has its own accent fabric or colour (v161 `accentOn`). */
export const gownAccentOn = (g: Pick<GownConfig, 'accentFabric' | 'accentHex'>) => !!(g.accentFabric || g.accentHex);

/** v206 `quoteLines`, the quantity half: the design and what the stage measured, as the contract's quantities. */
export function gownQuantitiesOf(g: GownConfig, m: GownMeasured): GownQuantities {
  const q = emptyGownQuantities(), M = q.materials, L = q.labour, accent = gownAccentOn(g), ck = gownCapeKind(g), capeIn = ck !== 'none' && gownCapeInGownFabric(g);
  const flutterFab = g.sleeve === 'flutter' && g.sleeveFab === 'fabric' && !accent;
  // The outer: the panels, a cape or overlay in the gown fabric and flutter sleeves in it, plus 15 % for matching and waste.
  const outer = ceil1((m.panelM + (capeIn ? m.capeM : 0) + (g.overlay !== 'none' && g.ovFab === 'gown' ? m.overlayM : 0) + (flutterFab ? m.flutterM : 0)) * 1.15);
  M.outerM = outer;
  // The accent (sleeves): its own line, with its own yardage.
  const sm = g.sleeve === 'flutter' ? m.flutterM : (SLEEVE_M[g.sleeve] ?? 0);
  if (sm && g.sleeveFab !== 'lace' && accent) M.accentM += sm;
  if (g.sleeve === 'flutter' && g.sleeveFab === 'chiffon') M.sleeveChiffonM += m.flutterM;
  if (g.overlay !== 'none' && g.ovFab !== 'gown') M.overlayM = r1(m.overlayM * 1.15);
  if (g.lining !== 'none') M.liningM = outer * 0.85;
  // Tulle: the petticoat's (for two layers) and the veil's own, glitter tulle apart.
  M.netM = Math.max(0, GOWN_PETTI_NET_M[g.petti] * (g.skirtLayers / 2) - m.glitterLayersM);
  M.veilM = Math.max(0, GOWN_VEIL_NET_M[g.veil] - m.glitterVeilM);
  M.glitterM = m.glitterLayersM + m.glitterVeilM;
  if (g.petti === 'hoop') M.hoops = 1;
  if (g.cutFill === 'illusion' && g.cuts.length) M.illusionM += 0.5;
  if (g.boning !== 'soft') M.boningM = m.bones * m.bodiceM;
  // The closure, sized by the back opening.
  if (g.closure === 'zipper') M.zippers = 1;
  else if (g.closure === 'buttons') M.buttons = Math.round((m.backM * 100) / 2);
  else { M.eyelets = 2 * Math.round((m.backM * 100) / 2.5); M.cordM = 3; }
  if (g.sleeve === 'flutter') L.flutter = 1;
  if (g.overlay !== 'none') L.overlay = 1;
  // v197/v198: the illusion bodice and back, their tulle, the bones shown.
  if (m.illusionWorn) {
    if (g.illu !== 'none') L.illuBodice = g.illu;
    L.illuBack = g.illuBack !== 'off' && g.back !== 'closed';
    M.illusionM += m.illusionM;
    if (g.boneShow === 'on' && g.boning !== 'soft') L.boneShow = m.bones;
  }
  // v199: straps (their cloth in the gown or the accent fabric, or a rouleau) and the scalloped edge.
  if (m.straps && m.straps.kind !== 'none') {
    L.straps = m.straps.kind;
    if (m.straps.ribbon) M.ribbonM += m.straps.metres;
    else if (g.strapCol === 'accent' && accent) M.accentM += m.straps.metres;
    else M.outerM += m.straps.metres;
    if (g.strapEdge === 'beaded' && m.straps.beads) M.beads.crystal += m.straps.beads;
  }
  L.scallop = g.topEdge === 'scallop' && (g.neck === 'sweetheart' || g.neck === 'straight');
  // v200: 3D flowers and raised lace.
  L.flowers = m.flowers;
  L.laceRaised = m.laceRaised;
  // v196: the cape: its type, its own cloth when it is not the gown's, its edge and a strap when it hangs from one shoulder.
  if (ck !== 'none') {
    L.cape = g.cape;
    // Cut from the gown fabric in the gown colour, it is in the outer; otherwise its own cloth (or the accent's).
    if (!capeIn) M.capeM = r1(m.capeM * 1.15);
    const edge = gownCapeNow(g).edge, eL = r1(m.capeEdgeM * 1.1);
    if (edge === 'lace') M.laceYardM += eL;
    if (edge === 'applique') M.laceMotifs += Math.max(6, Math.round((m.capeEdgeM / 0.15) * 1.5));
    if (edge === 'beaded') M.beads.crystal += 100 * Math.max(1, Math.ceil(m.capeEdgeM / 0.025 / 100));
    if (m.capeStrap) M.ribbonM += g.cape === 'pair' ? 0.9 : 0.45;
    if (ck === 'robe') L.overrobe = true;
  }
  // v203: the new sleeves: their panels in chiffon, the accent or the gown fabric (lace below), and detachable bands.
  if (gownSleeveIsExtra(g.sleeve) && g.sleeveFab !== 'lace') {
    if (g.sleeveFab === 'chiffon') M.sleeveChiffonM += m.sleeveM;
    else if (accent) M.accentM += m.sleeveM;
    else M.outerM += m.sleeveM;
  }
  L.sleeveDetach = gownSleeveDetach(g, g.sleeve) && (gownSleeveIsExtra(g.sleeve) || g.sleeve === 'long');
  if (g.waistStay) M.waistStays = 1;
  if (g.horsehair) M.horsehairM = m.hemRoundM;
  // Lace: sheer lace sleeves, then the lace on the gown (motifs to make, mirrored).
  if (g.sleeveFab === 'lace' && (g.sleeve !== 'none' || g.neck === 'off')) {
    M.laceYardM += g.sleeve === 'long' ? 1 : g.sleeve === 'butterfly' ? 0.8 : g.sleeve === 'flutter' ? Math.max(0.6, m.flutterM) : gownSleeveIsExtra(g.sleeve) ? Math.max(0.3, m.sleeveM) : 0.4;
  }
  M.laceMotifs += m.laceMotifs;
  for (const k of GOWN_BEAD_KINDS) M.beads[k] += m.beads[k];
  // Trims: piping, fringe and feather by their edge; a ruffle in the gown fabric, gathered 2.5 times on a 15 cm strip.
  let trimM = 0;
  for (const t of m.trims) {
    trimM += t.edgeM;
    if (t.trim.startsWith('pipe')) M.pipingM += t.edgeM;
    else if (t.trim === 'fringe') M.fringeM += t.edgeM;
    else if (t.trim === 'feather') M.featherM += t.edgeM;
    else M.ruffleM += t.edgeM * 2.5 * 0.15;
  }
  // The labour drivers.
  L.sleeve = g.sleeve;
  L.beads = GOWN_BEAD_KINDS.reduce((s, k) => s + M.beads[k], 0);
  L.laceMotifs = M.laceMotifs;
  L.laceYardM = M.laceYardM;
  L.pleats = g.pleat !== 'none' ? g.pleatN : 0;
  L.tex = g.tex;
  L.darts = g.darts !== 'none';
  L.cutouts = g.cuts.length;
  L.slits = g.slits.length;
  L.train = g.train;
  L.veil = g.veil;
  L.trimM = trimM;
  L.twoPiece = g.pieces !== 'one';
  if (L.twoPiece) M.zippers += 1;
  // Two decimals, as the quote reads them; counts stay whole.
  for (const k of Object.keys(M) as (keyof typeof M)[]) if (typeof M[k] === 'number') (M as Record<string, number>)[k] = Math.round((M[k] as number) * 100) / 100;
  L.trimM = Math.round(L.trimM * 100) / 100;
  L.laceYardM = Math.round(L.laceYardM * 100) / 100;
  return q;
}
