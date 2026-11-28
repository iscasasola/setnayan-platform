/**
 * 👗 gown/quote/measure — what the quote needs, measured on the gown as the stage just built it (prototype v206
 * `fabricMetres`, `capeMetres`, `ovMetres`, `flutterMetres`, `slxSleeveMetres`, `boneSet`, the trim edges, the lace and
 * bead counts). The stage calls it after a full build and hands the result to `gownQuantitiesOf`. Women only.
 */
import type * as THREE from 'three';
import { GOWN_BEAD_KINDS, gownSleeveIsExtra, type GownBeadKind, type GownConfig } from '../../gown-config';
import type { GownRig } from '../body/rig';
import { TAU } from '../body/constants';
import type { GownDress } from '../dress/build';
import type { GownEnvelope } from '../dress/table';
import { capeMetres, gownCapeStrapNeeded, type GownCapeMesh } from '../dress/cape';
import { gownPanelMetres } from '../dress/flat';
import { overlayMetres, type GownOverlayMesh } from '../parts/overlay';
import { flutterMetres } from '../parts/flutter';
import { GOWN_SLEEVE_GATHER, gownSleeveMetres } from '../parts/sleeves-extra';
import { gownTrimMetres } from '../parts/trims';
import { gownBoneSet, gownIlluMetres, type GownIllu } from '../parts/illusion';
import { gownStrapQuantities, type GownStrapMesh } from '../parts/straps';
import { gownFlowerQuantities, type GownFlowers } from '../parts/flowers';
import type { GownLacePlan } from '../parts/lace';
import type { GownBeadSet } from '../parts/beads';
import type { GownMeasured } from './quantities';

type Piece = { pos: ArrayLike<number>; index: ArrayLike<number> } | null;
/** What the stage built for this design (null where the part is not worn). */
export type GownBuilt = {
  cape: GownCapeMesh | null;
  overlay: GownOverlayMesh | null;
  /** The flutter sleeves' geometry (v195), when she wears them. */
  flutter: readonly (THREE.BufferGeometry | null)[];
  /** The new sleeves' drawn pieces (v203): left, right, and the ruffle band's back. */
  sleeves: readonly Piece[];
  lace: GownLacePlan | null;
  /** The ready-made bead layers and the scattered pearls (never the beads placed by hand). */
  beads: readonly GownBeadSet[];
  straps: GownStrapMesh | null;
  flowers: GownFlowers | null;
  illu: GownIllu | null;
};

/** v206 `quoteLines`' measurements: metres and counts on this gown as it stands. */
export function gownMeasure(B: GownRig, T: GownEnvelope, D: GownDress, g: GownConfig, built: GownBuilt): GownMeasured {
  const S = B.P.S, N = T.top.length, on = !!D.geo && !!D.L;
  const beads = Object.fromEntries(GOWN_BEAD_KINDS.map((k) => [k, 0])) as Record<GownBeadKind, number>;
  for (const s of built.beads) beads[s.kind] += s.count || s.n;
  const st = built.straps ? gownStrapQuantities(g, built.straps) : null;
  const fq = built.flowers ? gownFlowerQuantities(g, built.flowers, built.lace?.countN ?? 0) : null;
  return {
    panelM: on ? gownPanelMetres(B, D) : 0,
    capeM: built.cape ? capeMetres(B, built.cape) : 0,
    capeEdgeM: built.cape?.edgeL ?? 0,
    capeStrap: !!built.cape && gownCapeStrapNeeded(g),
    overlayM: built.overlay ? overlayMetres(B, built.overlay) : 0,
    flutterM: g.sleeve === 'flutter' ? flutterMetres(B, built.flutter) : 0,
    sleeveM: gownSleeveIsExtra(g.sleeve) ? gownSleeveMetres(B, built.sleeves, GOWN_SLEEVE_GATHER[g.sleeve]) : 0,
    bodiceM: on ? (T.top[0]! - T.yS) * S : 0.35,
    backM: on ? Math.max(0.1, (T.top[N / 2]! - T.yS) * S) : 0.4,
    bones: g.boning !== 'soft' ? gownBoneSet(B, D.L, g.boning).n : 0,
    hemRoundM: TAU * (D.hemR || 0.4) * S,
    laceMotifs: built.lace ? built.lace.countN - built.lace.hand : 0,
    beads,
    trims: on ? gownTrimMetres(B, D, g.trims).map((t) => ({ trim: t.trim, edgeM: t.edgeM })) : [],
    straps: st,
    flowers: fq?.flowers ?? 0,
    laceRaised: fq?.laceRaised ?? false,
    glitterLayersM: fq?.glitter.layers ?? 0,
    glitterVeilM: fq?.glitter.veil ?? 0,
    illusionWorn: !!built.illu?.zoneOn,
    illusionM: built.illu && D.geo ? gownIlluMetres(B, D, built.illu) : 0,
  };
}
