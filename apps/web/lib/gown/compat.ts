/**
 * 👗 gown/compat — the pairings that follow the way a gown is really made (prototype v193 `setGown`, `capeRules`,
 * `waistOpts`, `NO_SLIT`, `layerSync`), as data. One choice may change another; each such change carries one plain
 * line, which the maker shows with Undo right there. The server refuses what these rules would have changed
 * (`sanitizeGownConfig`), so a design that reaches it is always one that can be sewn.
 *
 * Women only: the men's collar and trouser rules are not ported. Plain data and pure functions: no DOM.
 */
import {
  GOWN_STRAPLESS,
  gownLayerCount,
  gownPettiOf,
  gownSyncLayers,
  type GownConfig,
  type GownPieces,
  type GownSilhouette,
  type GownWaistline,
} from '../gown-config';
import { gownFabricType } from './fabric/types';

/** A choice she can make: one key of the design and its new value. */
export type GownChoice = { [K in keyof GownConfig]: { key: K; value: GownConfig[K] } }[keyof GownConfig];

/**
 * One pairing rule. `when` reads the choice just made (`key`, the design after it, and the value before it); `apply`
 * changes the design in place. `note` is the line she reads; `tell` puts it in the Undo line (otherwise it is the hint
 * under the step).
 */
export type GownRule = {
  id: string;
  on: readonly (keyof GownConfig)[];
  when: (g: GownConfig, key: keyof GownConfig, was: unknown) => boolean;
  apply?: (g: GownConfig) => void;
  note?: string | ((g: GownConfig) => string);
  tell?: boolean;
};

const strapless = (g: GownConfig) => GOWN_STRAPLESS.includes(g.neck);
const caped = (g: GownConfig) => g.cape !== 'none';
const longVeil = (g: GownConfig) => g.veil === 'chapel' || g.veil === 'cathedral';
const accented = (g: GownConfig) => !!(g.accentFabric || g.accentHex);

/** Silhouettes made without a slit, and why (v193 `NO_SLIT`). */
export const GOWN_NO_SLIT: Partial<Record<GownSilhouette, string>> = {
  ball: 'A ball gown takes no slit: its volume comes from petticoat layers, and a slit would show them.',
  terno: 'A Filipiniana (terno) is traditionally made without a slit.',
};
/** The waistlines each way of making the gown allows (v193 `WAIST_FOR`). */
export const GOWN_WAIST_FOR: Record<GownPieces, readonly GownWaistline[]> = {
  one: ['natural', 'empire', 'dropped', 'basque', 'basqueU'],
  two: ['natural', 'dropped', 'basque', 'basqueU'],
  crop: ['natural'],
};
/** A texture's usual spacing (cm), set when she picks it (v193 `setGown`). */
export const GOWN_TEXTURE_SPACING = { pintuck: 0.8, ruche: 2.2, smock: 1.5 } as const;

/** In the order the prototype applies them. */
export const GOWN_RULES: readonly GownRule[] = [
  { id: 'neck-own-depth', on: ['neck'], when: () => true, apply: (g) => { g.neckT = null; } },
  { id: 'corset-boned', on: ['shape'], when: () => true, apply: (g) => { if (g.shape === 'corset') g.boning = 'corset'; else if (g.boning === 'corset') g.boning = 'complement'; } },
  { id: 'boned-corset', on: ['boning'], when: () => true, apply: (g) => { if (g.boning === 'corset') g.shape = 'corset'; else if (g.shape === 'corset') g.shape = 'none'; } },
  {
    id: 'strapless-boned', on: ['neck'], when: (g) => strapless(g) && g.boning === 'soft',
    apply: (g) => { g.boning = 'complement'; g.waistStay = true; }, note: 'A strapless bodice is boned and has a waist stay so it stays up.',
  },
  {
    id: 'ball-petticoat', on: ['sil'], when: (g) => g.sil === 'ball' && (g.petti === 'none' || g.petti === 'soft'),
    apply: (g) => { g.petti = 'full'; }, note: 'A ball gown gets a full tulle petticoat to hold its shape.',
  },
  { id: 'ball-needs-petticoat', on: ['petti'], when: (g) => g.sil === 'ball' && (g.petti === 'none' || g.petti === 'soft'), note: 'Warning: a ball gown needs a full petticoat or a hoop to hold its shape.' },
  { id: 'ruche-diagonal', on: ['tex'], when: (g) => g.tex === 'ruche' && g.texDir === 'v', apply: (g) => { g.texDir = 'd'; } },
  {
    id: 'texture-spacing', on: ['tex'], when: (g) => g.tex !== 'none',
    apply: (g) => { if (g.tex !== 'none') g.texSp = GOWN_TEXTURE_SPACING[g.tex]; if (g.tex === 'smock' && g.texAt === 'bodice') g.texAt = 'back'; },
  },
  {
    id: 'pieces', on: ['pieces'], when: (g) => g.pieces !== 'one',
    note: (g) => (g.pieces === 'two' ? 'Two-piece: a separate top and skirt; the skirt has its own waistband and closure.' : 'Cropped top: a band of skin shows between top and skirt; the skirt has its own waistband.'),
  },
  { id: 'pieces-waist', on: ['pieces'], when: (g) => !GOWN_WAIST_FOR[g.pieces].includes(g.waist), apply: (g) => { g.waist = 'natural'; } },
  { id: 'no-slit', on: ['sil'], when: (g) => !!GOWN_NO_SLIT[g.sil] && g.slits.length > 0, apply: (g) => { g.slits = []; }, note: (g) => `${GOWN_NO_SLIT[g.sil]} Slits removed.` },
  {
    id: 'terno-sleeves-leave', on: ['sil'], when: (g, _k, was) => was === 'terno' && g.sil !== 'terno' && g.sleeve === 'butterfly',
    apply: (g) => { g.sleeve = 'none'; }, note: 'The butterfly sleeves belong to the Filipiniana, so they come off with it.',
  },
  { id: 'veil-style-needs-veil', on: ['veilStyle'], when: (g) => g.veil === 'none', apply: (g) => { g.veil = g.veilStyle === 'birdcage' ? 'fingertip' : 'chapel'; } },
  {
    id: 'terno', on: ['sil'], when: (g) => g.sil === 'terno',
    apply: (g) => { g.sleeve = 'butterfly'; if (strapless(g)) g.neck = 'bateau'; }, note: 'A Filipiniana comes with butterfly sleeves and a bateau neckline. You can change either one.',
  },
  { id: 'butterfly-shoulder', on: ['sleeve'], when: (g) => g.sleeve === 'butterfly' && strapless(g), apply: (g) => { g.neck = 'bateau'; }, note: 'Butterfly sleeves sit on the shoulder, so the neckline is now bateau.' },
  { id: 'strapless-no-butterfly', on: ['neck'], when: (g) => strapless(g) && g.sleeve === 'butterfly', apply: (g) => { g.sleeve = 'none'; }, note: 'Butterfly sleeves need a shoulder, so sleeves are now none.' },
  { id: 'high-low', on: ['train'], when: (g) => g.train !== 'none' && g.hem !== 'floor', note: 'High-low: the front keeps its length; the back falls to the floor and runs on into the train.' },
  // Design review (v193): a cape and butterfly sleeves fight over the shoulder; a back cape and a long veil cover each other.
  { id: 'cape-no-butterfly', on: ['cape'], when: (g) => caped(g) && g.sleeve === 'butterfly', apply: (g) => { g.sleeve = 'none'; }, note: 'Sleeves are now none: butterfly sleeves stand where the cape lies.', tell: true },
  { id: 'back-cape-short-veil', on: ['cape'], when: (g) => g.cape === 'back' && longVeil(g), apply: (g) => { g.veil = 'fingertip'; }, note: 'The veil is now fingertip: a back cape and a long veil would cover each other.', tell: true },
  { id: 'veil-under-back-cape', on: ['veil'], when: (g) => g.cape === 'back' && longVeil(g), apply: (g) => { g.veil = 'fingertip'; }, note: 'With a back cape the veil stays fingertip or shorter.' },
  // v195: flutter sleeves. They hang from the shoulder line, a side cape or capelet would lie over them, and an opaque
  // gown makes them in sheer chiffon so her arm shows through.
  {
    id: 'flutter-replaces-butterfly', on: ['sleeve'], when: (g, _k, was) => g.sleeve === 'flutter' && was === 'butterfly' && g.sil === 'terno',
    note: 'Flutter sleeves now, in place of the butterfly sleeves the Filipiniana comes with.', tell: true,
  },
  {
    id: 'flutter-no-cape', on: ['sleeve'], when: (g) => g.sleeve === 'flutter' && (g.cape === 'side' || g.cape === 'capelet'),
    note: (g) => `The ${g.cape === 'side' ? 'side cape' : 'capelet'} is off: it would lie over the flutter sleeves.`, apply: (g) => { g.cape = 'none'; }, tell: true,
  },
  {
    id: 'flutter-off-shoulder', on: ['sleeve'], when: (g) => g.sleeve === 'flutter' && g.neck === 'sweetheart',
    apply: (g) => { g.neck = 'off'; g.neckT = null; }, note: 'Flutter sleeves hang from the shoulder line, so the neckline is now off-shoulder.', tell: true,
  },
  {
    id: 'flutter-sheer', on: ['sleeve'], when: (g) => g.sleeve === 'flutter' && g.sleeveFab === 'fabric' && !accented(g) && gownFabricType(g.fabric).props.sheer <= 0.3,
    apply: (g) => { g.sleeveFab = 'chiffon'; }, note: 'Flutter sleeves are made in sheer chiffon, so her arm shows through. Change it under "Sleeves made of".',
  },
  { id: 'sweetheart-no-flutter', on: ['neck'], when: (g) => g.neck === 'sweetheart' && g.sleeve === 'flutter', apply: (g) => { g.sleeve = 'none'; }, note: 'Sleeves are now none: flutter sleeves need a shoulder or an off-shoulder line.', tell: true },
  {
    id: 'cape-no-flutter', on: ['cape'], when: (g) => (g.cape === 'side' || g.cape === 'capelet') && g.sleeve === 'flutter', apply: (g) => { g.sleeve = 'none'; },
    note: (g) => `Sleeves are now none: the ${g.cape === 'side' ? 'side cape' : 'capelet'} would lie over the flutter sleeves.`, tell: true,
  },
  { id: 'butterfly-no-cape', on: ['sleeve', 'sil'], when: (g) => g.sleeve === 'butterfly' && caped(g), apply: (g) => { g.cape = 'none'; }, note: 'The cape is off: butterfly sleeves stand where it would lie.' },
  // v192: the layers under the skirt and the petticoat always agree.
  {
    id: 'layers-follow-petticoat', on: ['petti', 'skirtLayers', 'sil'], when: () => true,
    apply: (g) => { g.layerTypes = gownSyncLayers(g.petti, gownLayerCount(g), g.layerTypes); },
  },
];

export type GownChosen = {
  config: GownConfig;
  /** The lines she reads, in order (the hint under the step). */
  notes: string[];
  /** True when another choice changed and the line goes in the Undo line. */
  tell: boolean;
  /** The keys a rule changed, apart from the one she chose. */
  changed: (keyof GownConfig)[];
};

/** Make one choice and apply every pairing rule it triggers. The design passed in is not changed. */
export function gownChoose(config: GownConfig, choice: GownChoice): GownChosen {
  const g = structuredClone(config) as GownConfig, was = config[choice.key];
  (g as Record<keyof GownConfig, unknown>)[choice.key] = choice.value;
  const notes: string[] = [];
  let tell = false;
  for (const r of GOWN_RULES) {
    if (!r.on.includes(choice.key) || !r.when(g, choice.key, was)) continue;
    r.apply?.(g);
    const n = typeof r.note === 'function' ? r.note(g) : r.note;
    if (n) notes.push(n);
    if (r.tell) tell = true;
  }
  const changed = (Object.keys(g) as (keyof GownConfig)[]).filter((k) => k !== choice.key && JSON.stringify(g[k]) !== JSON.stringify(config[k]));
  return { config: g, notes, tell, changed };
}

/** The choices a design rules out, shown hidden in the lists themselves (v193 `capeRules`, `waistOpts`, slit chips). */
export function gownHiddenChoices(g: GownConfig): { sleeve: string[]; veil: string[]; waist: string[]; slits: boolean } {
  return {
    sleeve: caped(g) ? ['butterfly'] : [],
    veil: g.cape === 'back' ? ['chapel', 'cathedral'] : [],
    waist: (['natural', 'empire', 'dropped', 'basque', 'basqueU'] as const).filter((w) => !GOWN_WAIST_FOR[g.pieces].includes(w)),
    slits: !!GOWN_NO_SLIT[g.sil],
  };
}

/**
 * Set the layers under the skirt (v193 `setLayers`): how many she wears and each one's material. The petticoat follows
 * the layers (a hoop as layer 1, any full tulle, else soft), and its own pairings apply.
 */
export function gownChooseLayers(config: GownConfig, n: number, types: readonly GownConfig['layerTypes'][number][]): GownChosen {
  const g = structuredClone(config) as GownConfig;
  g.layerTypes = Array.from({ length: g.layerTypes.length }, (_, i) => types[i] ?? 'soft');
  if (n > 0) g.skirtLayers = n;
  const petti = gownPettiOf(n, g.layerTypes);
  if (petti === g.petti) return { config: g, notes: [], tell: false, changed: [] };
  const out = gownChoose(g, { key: 'petti', value: petti });
  return { ...out, changed: out.changed.filter((k) => k !== 'layerTypes' && k !== 'skirtLayers').concat('petti') };
}
