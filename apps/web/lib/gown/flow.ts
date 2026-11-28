/**
 * 👗 gown/flow — the bride's way through the maker (prototype v210 phone flow: `MS`, `fine-yes`/`fine-no`, `fine-skip`,
 * `RECIPE`, `remember`/undo, the units). Women only. Pure: the designer component holds the state and renders a step;
 * this says which steps there are, in what order, where the camera looks on each, and what Skip and Undo do.
 */
import {
  GOWN_BACKS, GOWN_BEAD_DENSITIES, GOWN_BEAD_PLACES, GOWN_BEADS, GOWN_BLUSHERS, GOWN_BODY_SHAPES, GOWN_BONE_SHOWS, GOWN_BONING, GOWN_BOWS, GOWN_BUSTLES,
  GOWN_CAPE_COLOURS, GOWN_CAPE_EDGES, GOWN_CAPE_FABRICS, GOWN_CAPE_FASTENINGS, GOWN_CAPE_LENGTHS, GOWN_CAPES, GOWN_CLOSURES, GOWN_COLOURS, GOWN_FLOWERS, GOWN_HEMS,
  GOWN_FLOWER_TYPES, GOWN_FLOWER_SIZES, GOWN_FLOWER_DENSITIES, GOWN_FLOWER_COLOURS, GOWN_FLOWER_FROM, GOWN_ILLUSIONS, GOWN_ILLUSION_BACKS, GOWN_ILLUSION_COLOURS,
  GOWN_ILLUSION_CUPS, GOWN_LACES, GOWN_LACE_COLOURS, GOWN_LACE_PLACES, GOWN_LININGS, GOWN_NECKLINES, GOWN_OVERLAYS, GOWN_OVERLAY_FABRICS, GOWN_PEARLS, GOWN_PIECES,
  GOWN_PLUNGE_FILLS, GOWN_ROBE_SLEEVES, GOWN_SHAPEWEAR, GOWN_SILHOUETTES, GOWN_SLEEVES, GOWN_SLEEVE_FABRICS, GOWN_SLEEVE_WORN, GOWN_STEP_LABELS, GOWN_STRAPS,
  GOWN_STRAP_COLOURS, GOWN_STRAP_EDGES, GOWN_TOP_EDGES, GOWN_TRAINS, GOWN_VEILS, GOWN_VEIL_FABRICS, GOWN_VEIL_STYLES, GOWN_WAISTLINES, gownCapeKind,
  type GownBody, type GownBodyKey, type GownMatter, type GownConfig, type GownMeasurementStep,
} from '../gown-config';
import { GOWN_FEEL, gownFeelOf } from './fabric/feel';
import { gownFabricNote, gownFabricType } from './fabric/types';
import { gownHiddenChoices } from './compat';
import type { GownFocusKey } from './stage/focus';

// ─── Measurements ───

/** One measurement step: where the camera looks (v204 `MS[].f`) and whether it is a fine-tune step. */
export type GownMeasStep = { id: GownMeasurementStep | 'fineAsk'; label: string; focus: GownFocusKey; fine: boolean };
/** v210 `MS`, in the owner's order (27 Nov; do not reorder). The fine-tune steps join only after she says Yes. */
export const GOWN_MEAS_FLOW: readonly GownMeasStep[] = [
  { id: 'height', label: GOWN_STEP_LABELS.height, focus: 'm_full', fine: false },
  { id: 'weight', label: GOWN_STEP_LABELS.weight, focus: 'm_full', fine: false },
  { id: 'shape', label: GOWN_STEP_LABELS.shape, focus: 'm_full', fine: false },
  { id: 'bust', label: GOWN_STEP_LABELS.bust, focus: 'm_bust', fine: false },
  { id: 'waist', label: GOWN_STEP_LABELS.waist, focus: 'm_waist', fine: false },
  { id: 'hips', label: GOWN_STEP_LABELS.hips, focus: 'm_hips', fine: false },
  { id: 'fineAsk', label: 'Fine-tune', focus: 'm_full', fine: false },
  { id: 'bustPos', label: GOWN_STEP_LABELS.bustPos, focus: 'm_bust', fine: true },
  { id: 'underbust', label: GOWN_STEP_LABELS.underbust, focus: 'm_ub', fine: true },
  { id: 'shoulders', label: GOWN_STEP_LABELS.shoulders, focus: 'm_sh', fine: true },
  { id: 'arm', label: GOWN_STEP_LABELS.arm, focus: 'm_arm', fine: true },
  { id: 'leg', label: GOWN_STEP_LABELS.leg, focus: 'm_leg', fine: true },
  { id: 'heel', label: GOWN_STEP_LABELS.heel, focus: 'heels', fine: true },
  { id: 'whatMatters', label: GOWN_STEP_LABELS.whatMatters, focus: 'm_full', fine: true },
];
/** The steps she walks: without fine-tune, the fine steps are left out (v210 `MSL`). */
export const gownMeasSteps = (fineOn: boolean) => GOWN_MEAS_FLOW.filter((s) => fineOn || !s.fine);

/** What a fine step can change, as it was when she arrived on it (v210 `msArr`). */
export type GownStepSnap = { vals: GownBody['vals']; bustPos: GownBody['bustPos']; bustT: number; matters: GownMatter[]; given: GownBodyKey[]; heel: number };
export const gownSnapStep = (body: GownBody, heel: number): GownStepSnap => ({ vals: { ...body.vals }, bustPos: body.bustPos, bustT: body.bustT, matters: [...body.matters], given: [...body.given], heel });

/**
 * v202/v210 Skip (28 Nov owner: in the bottom row, beside Next): what she changed on this step goes back to the estimate
 * she arrived with, the step's number is hers no longer, and the flow moves on. Returns the body and heel to keep.
 */
export function gownSkipStep(body: GownBody, snap: GownStepSnap, step: GownMeasStep['id']): { body: GownBody; heel: number } {
  const key = step as GownBodyKey;
  return {
    body: { ...body, vals: { ...snap.vals }, bustPos: snap.bustPos, bustT: snap.bustT, matters: [...snap.matters], given: snap.given.filter((k) => k !== key) },
    heel: snap.heel,
  };
}

/** The tape in her units: centimetres, or inches. Weight in kilograms or pounds. */
export type GownUnits = { len: 'cm' | 'in'; mass: 'kg' | 'lb' };
export const GOWN_LB_PER_KG = 2.20462;
export function gownSayLength(cm: number, units: GownUnits): string {
  if (units.len === 'cm') return `${Math.round(cm * 2) / 2} cm`;
  return `${(Math.round((cm / 2.54) * 4) / 4).toFixed(2).replace(/\.?0+$/, '')} in`;
}
export function gownSayHeight(cm: number, units: GownUnits): string {
  if (units.len === 'cm') return `${Math.round(cm)} cm`;
  const inches = Math.round(cm / 2.54), ft = Math.floor(inches / 12);
  return `${ft}′ ${inches - ft * 12}″`;
}
export const gownSayWeight = (kg: number, units: GownUnits) => (units.mass === 'kg' ? `${Math.round(kg)} kg` : `${Math.round(kg * GOWN_LB_PER_KG)} lb`);

// ─── Undo ───

/** The last designs and bodies, newest last (v210 `remember`). Kept short; the oldest falls off. */
export const GOWN_UNDO_MAX = 40;
export type GownMoment = { config: GownConfig; body: GownBody; heel: number };
export function gownRemember(stack: readonly GownMoment[], m: GownMoment): GownMoment[] {
  const last = stack[stack.length - 1];
  if (last && JSON.stringify(last) === JSON.stringify(m)) return [...stack];
  return [...stack, structuredClone(m)].slice(-GOWN_UNDO_MAX);
}

// ─── Design steps ───

type Opt = { readonly id: string; readonly label: string };
type K = keyof GownConfig;
/** One choice on a design step: the design key, its list, and the values the design rules out right now. */
export type GownPick = { key: K; label: string; options: readonly Opt[]; hidden?: (g: GownConfig) => readonly string[]; when?: (g: GownConfig) => boolean };
/** A design step (v210 `RECIPE` row): its name, its tab, where the camera looks, its choices, and when it shows. */
export type GownDesignStep = { id: string; label: string; tab: 'base' | 'addon' | 'interior'; focus: GownFocusKey; picks: GownPick[]; when?: (g: GownConfig) => boolean };
const H = gownHiddenChoices;
const pick = (key: K, label: string, options: readonly Opt[], more: Partial<GownPick> = {}): GownPick => ({ key, label, options, ...more });
const one = (id: string, label: string, tab: GownDesignStep['tab'], focus: GownFocusKey, p: GownPick, when?: GownDesignStep['when']): GownDesignStep => ({ id, label, tab, focus, picks: [p], when });

/** v210 `RECIPE`, the parts already ported, in its order. Each step opens on its own close-up. */
export const GOWN_DESIGN_STEPS: readonly GownDesignStep[] = [
  { id: 'palette', label: 'Your colours', tab: 'base', focus: 'gown', picks: [] },
  one('sil', 'Silhouette', 'base', 'gown', pick('sil', 'Silhouette', GOWN_SILHOUETTES)),
  { id: 'fabric', label: 'Fabric', tab: 'base', focus: 'fabric', picks: [] },
  one('colour', 'Colour', 'base', 'fabric', pick('colour', 'Colour', GOWN_COLOURS)),
  one('sleeve', 'Sleeves', 'base', 'sleeve', pick('sleeve', 'Sleeves', GOWN_SLEEVES, { hidden: (g) => H(g).sleeve })),
  one('sleeveFab', 'Sleeves made of', 'base', 'sleeveFab', pick('sleeveFab', 'Sleeves made of', GOWN_SLEEVE_FABRICS), (g) => g.sleeve !== 'none'),
  one('cape', 'Cape', 'base', 'cape', pick('cape', 'Cape', GOWN_CAPES, { hidden: (g) => H(g).cape })),
  {
    id: 'capeDet', label: 'Cape details', tab: 'base', focus: 'capeFab', when: (g) => gownCapeKind(g) !== 'none',
    picks: [
      pick('capeFab', 'Made of', GOWN_CAPE_FABRICS), pick('capeLen', 'Length', GOWN_CAPE_LENGTHS, { hidden: (g) => H(g).capeLen }), pick('capeEdge', 'Edge', GOWN_CAPE_EDGES),
      pick('capeFasten', 'Fastened at', GOWN_CAPE_FASTENINGS, { when: (g) => !H(g).capeFasten }), pick('capeCol', 'Colour', GOWN_CAPE_COLOURS, { when: (g) => !H(g).capeCol }),
    ],
  },
  one('sleeveDet', 'Sleeves worn', 'base', 'sleeve', pick('sleeveDet', 'Sleeves worn', GOWN_SLEEVE_WORN), (g) => !H(g).sleeveDet),
  one('robeSl', 'Over-robe sleeves', 'base', 'cape', pick('robeSl', 'Over-robe sleeves', GOWN_ROBE_SLEEVES), (g) => !H(g).robeSl),
  one('pieces', 'Pieces', 'base', 'pieces', pick('pieces', 'Pieces', GOWN_PIECES)),
  one('waist', 'Waistline', 'base', 'pieces', pick('waist', 'Waistline', GOWN_WAISTLINES, { hidden: (g) => H(g).waist }), (g) => g.pieces !== 'crop'),
  one('neck', 'Neckline', 'base', 'neck', pick('neck', 'Neckline', GOWN_NECKLINES, { hidden: (g) => H(g).neck })),
  one('plungeFill', 'Plunge filled with', 'base', 'neck', pick('plungeFill', 'Plunge filled with', GOWN_PLUNGE_FILLS), (g) => !H(g).plungeFill),
  one('straps', 'Straps', 'base', 'neck', pick('straps', 'Straps', GOWN_STRAPS, { hidden: (g) => H(g).straps }), (g) => !H(g).strapRow),
  {
    id: 'strapDet', label: 'Strap details', tab: 'base', focus: 'neck', when: (g) => !H(g).strapDetails,
    picks: [pick('strapCol', 'Colour', GOWN_STRAP_COLOURS, { when: (g) => !H(g).strapCol }), pick('strapEdge', 'Edge', GOWN_STRAP_EDGES)],
  },
  one('topEdge', 'Top edge', 'base', 'neck', pick('topEdge', 'Top edge', GOWN_TOP_EDGES), (g) => !H(g).topEdge),
  one('illu', 'Bodice made of', 'base', 'shape', pick('illu', 'Bodice made of', GOWN_ILLUSIONS)),
  {
    id: 'illuDet', label: 'Illusion details', tab: 'base', focus: 'shape', when: (g) => !H(g).illuDetails,
    picks: [pick('illuBase', 'Cups', GOWN_ILLUSION_CUPS), pick('illuCol', 'Tulle colour', GOWN_ILLUSION_COLOURS)],
  },
  one('boneShow', 'Boning you can see', 'base', 'boning', pick('boneShow', 'Boning you can see', GOWN_BONE_SHOWS)),
  one('back', 'Back', 'base', 'back', pick('back', 'Back', GOWN_BACKS)),
  one('illuBack', 'Illusion back', 'base', 'back', pick('illuBack', 'Illusion back', GOWN_ILLUSION_BACKS), (g) => !H(g).illuBack),
  one('closure', 'Closure', 'base', 'closure', pick('closure', 'Closure', GOWN_CLOSURES)),
  one('hem', 'Skirt length', 'base', 'hems', pick('hem', 'Skirt length', GOWN_HEMS)),
  one('train', 'Train', 'base', 'train', pick('train', 'Train', GOWN_TRAINS, { hidden: (g) => H(g).train })),
  one('veilStyle', 'Veil style', 'base', 'veil', pick('veilStyle', 'Veil style', GOWN_VEIL_STYLES)),
  one('veil', 'Veil', 'base', 'veil', pick('veil', 'Veil', GOWN_VEILS, { hidden: (g) => H(g).veil }), (g) => g.veilStyle !== 'birdcage'),
  one('blusher', 'Blusher', 'base', 'blusher', pick('blusher', 'Blusher', GOWN_BLUSHERS), (g) => H(g).blusher),
  one('veilFab', 'Veil made of', 'base', 'veil', pick('veilFab', 'Veil made of', GOWN_VEIL_FABRICS), (g) => !H(g).veilFab),
  one('overlay', 'Overlay', 'addon', 'skirtLayers', pick('overlay', 'Overlay', GOWN_OVERLAYS, { hidden: (g) => H(g).overlay })),
  one('ovFab', 'Overlay fabric', 'addon', 'skirtLayers', pick('ovFab', 'Overlay fabric', GOWN_OVERLAY_FABRICS), (g) => g.overlay !== 'none'),
  one('bow', 'Small bow', 'addon', 'bow', pick('bow', 'Small bow', GOWN_BOWS)),
  {
    id: 'lace', label: 'Lace appliqué', tab: 'addon', focus: 'lace',
    picks: [pick('lace', 'Lace', GOWN_LACES), pick('laceAt', 'Where', GOWN_LACE_PLACES, { when: (g) => g.lace !== 'none' }), pick('laceCol', 'Colour', GOWN_LACE_COLOURS, { when: (g) => g.lace !== 'none' })],
  },
  {
    id: 'flowers', label: '3D flowers', tab: 'addon', focus: 'lace',
    picks: [
      pick('flowers', '3D flowers', GOWN_FLOWERS, { hidden: (g) => H(g).flowers }),
      pick('flowerFrom', 'Starting from', GOWN_FLOWER_FROM, { hidden: (g) => H(g).flowerFrom, when: (g) => !H(g).flowerFromRow }),
      pick('flowerType', 'Flower', GOWN_FLOWER_TYPES, { when: (g) => !H(g).flowerDetails }),
      pick('flowerSize', 'Size', GOWN_FLOWER_SIZES, { hidden: (g) => H(g).flowerSize, when: (g) => !H(g).flowerDetails }),
      pick('flowerDen', 'How many', GOWN_FLOWER_DENSITIES, { when: (g) => !H(g).flowerDetails }),
      pick('flowerCol', 'Colour', GOWN_FLOWER_COLOURS, { hidden: (g) => H(g).flowerCol, when: (g) => !H(g).flowerDetails }),
    ],
  },
  {
    id: 'bead', label: 'Beading', tab: 'addon', focus: 'bead',
    picks: [pick('bead', 'Beading', GOWN_BEADS), pick('beadAt', 'Where', GOWN_BEAD_PLACES, { when: (g) => g.bead !== 'none' }), pick('beadDen', 'How many', GOWN_BEAD_DENSITIES, { when: (g) => g.bead !== 'none' })],
  },
  one('pearls', 'Scattered pearls', 'addon', 'bead', pick('pearls', 'Scattered pearls', GOWN_PEARLS, { hidden: (g) => H(g).pearls })),
  one('shape', 'Body shaping', 'interior', 'shape', pick('shape', 'Body shaping', GOWN_SHAPEWEAR)),
  one('lining', 'Lining', 'interior', 'shape', pick('lining', 'Lining', GOWN_LININGS)),
  one('boning', 'Boning', 'interior', 'boning', pick('boning', 'Boning', GOWN_BONING)),
  one('bustle', 'Bustle', 'interior', 'bustle', pick('bustle', 'Bustle', GOWN_BUSTLES), (g) => g.train !== 'none'),
];

/** The design steps she sees now: each step's own rule and at least one choice showing. */
export function gownDesignSteps(g: GownConfig): GownDesignStep[] {
  return GOWN_DESIGN_STEPS.filter((s) => (!s.when || s.when(g)) && (s.picks.length === 0 || s.picks.some((p) => !p.when || p.when(g))));
}
/** A choice's list with what the design rules out taken away. */
export const gownPickOptions = (p: GownPick, g: GownConfig) => {
  const hide = new Set(p.hidden?.(g) ?? []);
  return p.options.filter((o) => !hide.has(o.id));
};
export { GOWN_BODY_SHAPES };

/**
 * A pick that can take a colour of her own, and the field that holds it (`custom` on the gown, the lace (v207), the
 * beads and the trims). The designer shows a colour well under the pick while it reads `custom`.
 */
export const GOWN_CUSTOM_HEX = { colour: 'colourHex', laceCol: 'laceHex', beadCol: 'beadHex', trimCol: 'trimHex' } as const satisfies Partial<Record<keyof GownConfig, keyof GownConfig>>;
export type GownCustomColourKey = keyof typeof GOWN_CUSTOM_HEX;
export const gownHasCustomHex = (k: string): k is GownCustomColourKey => Object.prototype.hasOwnProperty.call(GOWN_CUSTOM_HEX, k);

/** v207 `lace-pick`'s starting colour: the colour well opens on it the first time she picks "Any colour…". */
const LACE_PICK_START = '#1F3A6E';

/**
 * Picking "custom" with no colour of her own yet starts from the colour she sees now (the gown's own colour, or the
 * v207 lace picker's start), so the design is never left asking for a colour it does not have (the send would refuse it).
 */
export function gownSeedCustomHex(g: GownConfig, key: GownCustomColourKey): GownConfig {
  const field = GOWN_CUSTOM_HEX[key];
  if (g[key] !== 'custom' || g[field]) return g;
  const start = key === 'laceCol' ? LACE_PICK_START : GOWN_COLOURS.find((c) => c.id === g.colour)?.hex ?? GOWN_COLOURS[0]!.hex;
  return { ...g, [field]: start.toUpperCase() };
}

/** The fabrics in the prototype's own order (v207 `FEEL`); a shop's own fabric types follow, as given. */
export function gownFabricOrder<T extends { id: string }>(list: readonly T[]): T[] {
  const order = Object.keys(GOWN_FEEL), at = (id: string) => { const i = order.indexOf(id); return i < 0 ? order.length : i; };
  return [...list].map((f, i) => ({ f, i })).sort((a, b) => at(a.f.id) - at(b.f.id) || a.i - b.i).map((x) => x.f);
}

/** The line under the fabric step (v207 `fabric-note`): what it feels like, then its weight, drape and see-through. */
export function gownFabricLine(fabric: string, lined: boolean): string {
  const t = gownFabricType(fabric);
  return gownFabricNote(t.props, lined, gownFeelOf(t.drawAs).why);
}
