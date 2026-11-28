/**
 * 👗 gown/compat — the pairings that follow the way a gown is really made (prototype v197 `setGown`, `capeRules`,
 * `waistOpts`, `NO_SLIT`, `layerSync`), as data. One choice may change another; each such change carries one plain
 * line, which the maker shows with Undo right there. The server refuses what these rules would have changed
 * (`sanitizeGownConfig`), so a design that reaches it is always one that can be sewn.
 *
 * Women only: the men's collar and trouser rules are not ported. Plain data and pure functions: no DOM.
 */
import {
  GOWN_CAPES,
  GOWN_CAPE_ARMS,
  GOWN_CAPE_DEF,
  GOWN_CAPE_LENGTHS,
  GOWN_CAPE_STRAP,
  GOWN_SILHOUETTES,
  GOWN_STRAPLESS,
  GOWN_STRAPS,
  GOWN_STRAP_DEF,
  GOWN_STRAP_OK,
  gownCapeFlowersOn,
  gownCapeNow,
  gownFloorLength,
  gownFlowersOn,
  gownStrapCovers,
  gownStrapKind,
  gownStrapOk,
  gownStrapsHold,
  gownLayerCount,
  gownPettiOf,
  gownLookOf,
  gownSyncLayers,
  startingGownConfig,
  type GownConfig,
  type GownLook,
  type GownPieces,
  type GownSilhouette,
  type GownStraps,
  type GownWaistline,
} from '../gown-config';
import { gownFabricType } from './fabric/types';
import { GOWN_BORDER_LACES } from './parts/lace';

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
  when: (g: GownConfig, key: keyof GownConfig, was: unknown, ctx: GownChooseContext) => boolean;
  apply?: (g: GownConfig, was: unknown, ctx: GownChooseContext) => void;
  note?: string | ((g: GownConfig, was: unknown) => string);
  tell?: boolean;
  /** Say nothing when an earlier rule already put its line in the Undo line (v195: one line, not two). */
  quietAfterTell?: boolean;
  /** This line replaces the lines before it (the prototype sets the note rather than adding to it). */
  replaces?: boolean;
  /** Only when no earlier rule has said anything. */
  alone?: boolean;
};
/**
 * What the rules need from her body, worked out by the stage on her landmarks: `backCapT`, the deepest a strapless back
 * may be cut on her (v197 `backCapT`; 1 when it is not strapless). Without it, the back's limit is left to the stage.
 */
export type GownChooseContext = { backCapT?: number };
/** The rules also read the value she just chose (a rule before may have put the old one back). */
type RuleContext = GownChooseContext & { chosen?: unknown };
/** v198: an illusion back holds a strapless bodice up, so the bra-line cap does not apply; v199: so do straps that hold it. */
const capLifted = (g: GownConfig) => ((g.illuBack === 'on' && g.back !== 'closed') || gownStrapsHold(g)) && strapless(g);
/** v199: a cape's narrow strap is added where a strapless neckline has no strap of its own on that shoulder (`capeStrapNeeded`). */
const capeStrapNeeded = (g: GownConfig) => !!GOWN_CAPE_STRAP[g.cape] && strapless(g) && !gownStrapCovers(g, GOWN_CAPE_STRAP[g.cape]!);
/** v198: a cape's narrow strap holds the bodice up too (`illuStrapsHeld`); v199: and straps that hold it. */
const strapsHeld = (g: GownConfig) => capeStrapNeeded(g) || (g.cape === 'pair' && strapless(g)) || gownStrapsHold(g);
/** v199 strap names in a sentence ("spaghetti straps", "one-shoulder strap"). */
const strapName = (s: GownStraps) => (s === 'none' ? 'straps' : GOWN_STRAP_DEF[s].name.toLowerCase());
const isAre = (s: GownStraps) => (s === 'one' ? 'is' : 'are');
/** v199: sleeves that need both shoulders. */
const shoulderSleeve = (s: GownConfig['sleeve']) => s === 'cap' || s === 'butterfly' || s === 'flutter';
/** v199: a scalloped edge is for a strapless sweetheart or straight-across neckline. */
const scallopNeck = (g: GownConfig) => g.neck === 'sweetheart' || g.neck === 'straight';
/** v198 `illuBackLow`: a strapless back below the bra line, with no illusion back holding it. */
const backTooLow = (g: GownConfig, ctx: GownChooseContext) => strapless(g) && g.back !== 'closed' && !capLifted(g) && ctx.backCapT !== undefined && g.backT > ctx.backCapT + 0.002;

const strapless = (g: GownConfig) => GOWN_STRAPLESS.includes(g.neck);
/** Strapless with nothing at the shoulder for a sleeve to join (off-shoulder keeps its band). */
const bareTop = (g: GownConfig) => strapless(g) && g.neck !== 'off';
const caped = (g: GownConfig) => g.cape !== 'none';
const capeName = (g: GownConfig) => GOWN_CAPES.find((c) => c.id === g.cape)!.label.toLowerCase();
/** A cape that lies over the arms (v196 `CAPE_ARMS`). */
const armCape = (g: GownConfig) => GOWN_CAPE_ARMS.includes(g.cape);
/** A cape down her back that a long veil would cover (v196: a back cape, or a long neck cape). */
const longBack = (g: GownConfig) => g.cape === 'back' || (g.cape === 'neck' && gownCapeNow(g).long);
/** A veil to the floor or beyond (v197 `VEIL_FLOOR`). */
const longVeil = (g: GownConfig) => g.veil === 'floor' || g.veil === 'chapel' || g.veil === 'cathedral';
/** A sheath or mermaid: too narrow at the hem for a long train, too close for a full petticoat (v197 `closeSil`). */
const closeSil = (g: GownConfig) => g.sil === 'sheath' || g.sil === 'mermaid';
const silName = (s: GownSilhouette) => GOWN_SILHOUETTES.find((x) => x.id === s)!.label.toLowerCase();
/** v197 `BACK_CAP_MSG`. */
export const GOWN_BACK_CAP_NOTE = 'The back stops at the bra line: a strapless bodice is held up all the way round there. Add straps (under Neckline) or an illusion back (under Back) to go lower.';
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

/** Every key of the design but one (a rule that follows whatever else she changes). */
const ALL_BUT = (k: keyof GownConfig) => (Object.keys(startingGownConfig()) as (keyof GownConfig)[]).filter((x) => x !== k);

/** In the order the prototype applies them. */
export const GOWN_RULES: readonly GownRule[] = [
  // v196: each cape comes with its own material, length and edge (changed under Cape details).
  { id: 'cape-own-details', on: ['cape'], when: () => true, apply: (g) => { g.capeFab = null; g.capeLen = null; g.capeEdge = null; g.capeFasten = null; } },
  { id: 'neck-own-depth', on: ['neck'], when: () => true, apply: (g) => { g.neckT = null; } },
  { id: 'corset-boned', on: ['shape'], when: () => true, apply: (g) => { if (g.shape === 'corset') g.boning = 'corset'; else if (g.boning === 'corset') g.boning = 'complement'; } },
  { id: 'boned-corset', on: ['boning'], when: () => true, apply: (g) => { if (g.boning === 'corset') g.shape = 'corset'; else if (g.shape === 'corset') g.shape = 'none'; } },
  {
    id: 'strapless-boned', on: ['neck'], when: (g) => strapless(g) && g.boning === 'soft',
    apply: (g) => { g.boning = 'complement'; g.waistStay = true; }, note: 'A strapless bodice is boned and has a waist stay so it stays up.',
  },
  // Accuracy review (v197): a strapless bodice is held up all the way round at the bra line, so its back stops there; it
  // has nothing at the shoulder for a cap sleeve or a cowl; its long sleeves are detachable.
  {
    id: 'strapless-back-cap', on: ['neck'], when: (g, _k, _w, ctx) => strapless(g) && g.back !== 'closed' && !capLifted(g) && ctx.backCapT !== undefined && g.backT > ctx.backCapT + 1e-3,
    apply: (g, _w, ctx) => { g.backT = ctx.backCapT!; }, note: GOWN_BACK_CAP_NOTE, tell: true, replaces: true,
  },
  { id: 'strapless-no-cap', on: ['neck'], when: (g) => bareTop(g) && g.sleeve === 'cap', apply: (g) => { g.sleeve = 'none'; }, note: 'Cap sleeves need a shoulder to sit on, so sleeves are now none.', tell: true },
  { id: 'strapless-detachable', on: ['neck'], when: (g) => bareTop(g) && g.sleeve === 'long', note: 'On a strapless bodice the long sleeves are detachable: each one on its own band round the upper arm.', alone: true },
  { id: 'cap-needs-shoulder', on: ['sleeve'], when: (g) => g.sleeve === 'cap' && bareTop(g), apply: (g, was) => { g.sleeve = was as GownConfig['sleeve']; }, note: 'Cap sleeves need a shoulder to sit on: pick a neckline with shoulders first.', replaces: true },
  { id: 'detachable-sleeves', on: ['sleeve'], when: (g) => g.sleeve === 'long' && bareTop(g), note: 'Detachable sleeves: each one on its own band round the upper arm, separate from the strapless bodice.', replaces: true },
  { id: 'strapless-no-cowl', on: ['neck'], when: (g) => strapless(g) && g.drape === 'cowl', apply: (g) => { g.drape = 'none'; }, note: 'The cowl drape is off: a cowl hangs from the shoulders.', tell: true },
  {
    id: 'ball-petticoat', on: ['sil'], when: (g) => g.sil === 'ball' && (g.petti === 'none' || g.petti === 'soft'),
    apply: (g) => { g.petti = 'full'; }, note: 'A ball gown gets a full tulle petticoat to hold its shape.',
  },
  { id: 'ball-needs-petticoat', on: ['petti'], when: (g) => g.sil === 'ball' && (g.petti === 'none' || g.petti === 'soft'), note: 'Warning: a ball gown needs a full petticoat or a hoop to hold its shape.', replaces: true },
  // Accuracy review (v197): no leftover petticoat or hoop under a slimmer skirt; a sheath or mermaid carries a sweep
  // train at most, no full petticoat or hoop; a sheath falls too close for pleats.
  {
    id: 'leave-ball-soft', on: ['sil'], when: (g, _k, was) => was === 'ball' && g.sil !== 'ball' && (g.petti === 'full' || g.petti === 'hoop' || g.skirtLayers > 2),
    apply: (g) => { g.petti = 'soft'; g.skirtLayers = Math.min(2, g.skirtLayers || 2); g.layerTypes = g.layerTypes.map((x) => (x === 'full' || x === 'hoop' ? 'soft' : x)); },
    note: (g) => `The petticoat is back to soft tulle: a${g.sil === 'aline' ? 'n' : ''} ${silName(g.sil)} doesn't need the ball gown's full layers.`, tell: true,
  },
  {
    id: 'close-sweep-train', on: ['sil', 'train'], when: (g, k) => (k === 'train' || g.sil === 'sheath' || g.sil === 'mermaid') && closeSil(g) && (g.train === 'chapel' || g.train === 'cathedral'),
    apply: (g) => { g.train = 'sweep'; }, note: (g) => `The train is now a sweep: a ${silName(g.sil)} is too narrow at the hem to carry a longer train.`, tell: true,
  },
  {
    id: 'sheath-no-pleats', on: ['sil', 'pleat'], when: (g) => g.sil === 'sheath' && g.pleat !== 'none',
    apply: (g) => { g.pleat = 'none'; }, note: 'Pleats are off: a sheath falls too close to the body for pleats to open.', tell: true,
  },
  {
    id: 'close-soft-petticoat', on: ['petti'], when: (g) => closeSil(g) && (g.petti === 'full' || g.petti === 'hoop'),
    apply: (g) => { g.petti = 'soft'; }, note: (g) => `A ${silName(g.sil)} is too close-fitting for a ${g.petti === 'hoop' ? 'hoop' : 'full petticoat'}: soft tulle at most.`, tell: true, replaces: true,
  },
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
  // Design review (v193): a cape and butterfly sleeves fight over the shoulder.
  { id: 'cape-no-butterfly', on: ['cape'], when: (g) => caped(g) && g.sleeve === 'butterfly', apply: (g) => { g.sleeve = 'none'; }, note: 'Sleeves are now none: butterfly sleeves stand where the cape lies.', tell: true },
  // v196: the neck cape has its own band; a cape from one shoulder (or the pair) gets a strap where the neckline has none.
  { id: 'neck-cape-band', on: ['cape'], when: (g) => g.cape === 'neck', note: 'The neck cape fastens at its own thin band round her neck (with a clasp at the back), so it works with any neckline.', tell: true },
  {
    id: 'cape-strap', on: ['cape'], when: (g) => capeStrapNeeded(g),
    note: (g) => `This neckline has no strap, so a narrow strap is added on her ${GOWN_CAPE_STRAP[g.cape] === 'L' ? 'left' : 'right'} shoulder to hold the ${capeName(g)}.`, tell: true,
  },
  { id: 'pair-straps', on: ['cape'], when: (g) => g.cape === 'pair' && strapless(g) && !(gownStrapCovers(g, 'L') && gownStrapCovers(g, 'R')), note: 'Each cape is fastened on a narrow strap over the shoulder, with a small brooch.', tell: true },
  {
    id: 'strapless-cape-strap', on: ['neck'], when: (g, _k, was) => strapless(g) && !GOWN_STRAPLESS.includes(was as GownConfig['neck']) && (capeStrapNeeded(g) || g.cape === 'pair'),
    note: (g) => `A narrow strap is added to hold the ${capeName(g)}: this neckline has none.`, tell: true,
  },
  // A cape down her back and a long veil cover each other.
  {
    id: 'back-cape-short-veil', on: ['cape', 'capeLen'], when: (g) => longBack(g) && longVeil(g), apply: (g) => { g.veil = 'fingertip'; },
    note: (g) => `The veil is now fingertip: the ${capeName(g)} and a long veil would cover each other.`, tell: true,
  },
  { id: 'veil-under-back-cape', on: ['veil'], when: (g) => longBack(g) && longVeil(g), apply: (g) => { g.veil = 'fingertip'; }, note: (g) => `With the ${capeName(g)} the veil stays fingertip or shorter.`, replaces: true },
  { id: 'cape-accent-first', on: ['capeCol'], when: (g) => g.capeCol === 'accent' && !accented(g), note: 'Pick an accent colour first (under Sleeves); until then the cape stays in the gown colour.', replaces: true },
  // v195: flutter sleeves. They hang from the shoulder line, a side cape or capelet would lie over them, and an opaque
  // gown makes them in sheer chiffon so her arm shows through.
  {
    id: 'flutter-replaces-butterfly', on: ['sleeve'], when: (g, _k, was) => g.sleeve === 'flutter' && was === 'butterfly' && g.sil === 'terno',
    note: 'Flutter sleeves now, in place of the butterfly sleeves the Filipiniana comes with.', tell: true,
  },
  {
    id: 'flutter-no-cape', on: ['sleeve'], when: (g) => g.sleeve === 'flutter' && armCape(g),
    note: (g) => `The ${capeName(g)} is off: it would lie over the flutter sleeves.`, apply: (g) => { g.cape = 'none'; }, tell: true,
  },
  {
    id: 'flutter-off-shoulder', on: ['sleeve'], when: (g) => g.sleeve === 'flutter' && g.neck === 'sweetheart',
    apply: (g) => { g.neck = 'off'; g.neckT = null; }, note: 'Flutter sleeves hang from the shoulder line, so the neckline is now off-shoulder.', tell: true,
  },
  {
    id: 'flutter-sheer', on: ['sleeve'], when: (g) => g.sleeve === 'flutter' && g.sleeveFab === 'fabric' && !accented(g) && gownFabricType(g.fabric).props.sheer <= 0.3,
    apply: (g) => { g.sleeveFab = 'chiffon'; }, note: 'Flutter sleeves are made in sheer chiffon, so her arm shows through. Change it under "Sleeves made of".', quietAfterTell: true,
  },
  { id: 'sweetheart-no-flutter', on: ['neck'], when: (g) => g.neck === 'sweetheart' && g.sleeve === 'flutter', apply: (g) => { g.sleeve = 'none'; }, note: 'Sleeves are now none: flutter sleeves need a shoulder or an off-shoulder line.', tell: true },
  {
    id: 'cape-no-flutter', on: ['cape'], when: (g) => armCape(g) && g.sleeve === 'flutter', apply: (g) => { g.sleeve = 'none'; },
    note: (g) => `Sleeves are now none: the ${capeName(g)} would lie over the flutter sleeves.`, tell: true,
  },
  { id: 'butterfly-no-cape', on: ['sleeve', 'sil'], when: (g) => g.sleeve === 'butterfly' && caped(g), apply: (g) => { g.cape = 'none'; }, note: 'The cape is off: butterfly sleeves stand where it would lie.' },
  // v195: over a ball gown an overlay sits as soft tiers.
  {
    id: 'ball-overlay-tiered', on: ['sil'], when: (g) => g.sil === 'ball' && (g.overlay === 'asym' || g.overlay === 'cascade'),
    apply: (g) => { g.overlay = 'tiered'; }, note: 'The overlay is now tiered: over a ball gown an overlay sits as soft tiers.', tell: true,
  },
  // v195: a border lace runs along an edge.
  {
    id: 'border-lace-on-hem', on: ['lace'], when: (g) => GOWN_BORDER_LACES.includes(g.lace) && g.laceAt !== 'neck' && g.laceAt !== 'hem',
    apply: (g) => { g.laceAt = 'hem'; }, note: 'This is border lace, so it is placed along the hem. Neckline edge works too.',
  },
  // v199 `strapSet`: straps, the scalloped edge and the plunge to the waist. Their lines go in the Undo line.
  {
    id: 'plunge-needs-straps', on: ['neck'], when: (g) => g.neck === 'plungewaist',
    apply: (g) => { g.plungeFill = 'mesh'; if (g.illu === 'neck') g.illu = 'none'; if (!GOWN_STRAP_OK.plungewaist!.includes(g.straps)) g.straps = 'spaghetti'; },
    note: (g) => (GOWN_STRAP_OK.plungewaist!.includes(g.straps)
      ? 'Sheer modesty mesh fills the plunge between the cups, so the bodice stays in place.'
      : 'A plunge to the waist needs straps to stay in place, so spaghetti straps are added, and sheer modesty mesh fills the plunge between the cups.'),
    tell: true,
  },
  // A sheer corset on a plunge: the cups are cut as a plunge too.
  { id: 'plunge-corset-cups', on: ['neck', 'illu'], when: (g) => g.neck === 'plungewaist' && g.illu === 'corset' && g.illuBase !== 'plunge', apply: (g) => { g.illuBase = 'plunge'; }, note: 'The lined cups follow the plunge.', tell: true },
  {
    id: 'illusion-neck-leaves-plunge', on: ['illu'], when: (g) => g.illu === 'neck' && g.neck === 'plungewaist', apply: (g) => { g.neck = 'v'; g.neckT = null; },
    note: 'An illusion neckline runs up from lined cups, so the plunge is now a V-neck with sheer tulle above the cups.', tell: true,
  },
  {
    id: 'one-shoulder-sleeves-off', on: ['straps'], when: (g) => (g.straps === 'halter' || g.straps === 'one') && shoulderSleeve(g.sleeve), apply: (g) => { g.sleeve = 'none'; },
    note: (g) => `Sleeves are now none: ${g.sleeve} sleeves need both shoulders, and ${g.straps === 'halter' ? 'a halter leaves the shoulders bare' : 'a one-shoulder gown has only one'}.`, tell: true,
  },
  {
    id: 'shoulder-sleeves-straps-off', on: ['sleeve'], when: (g, _k, _w, ctx) => shoulderSleeve(g.sleeve) && (g.straps === 'halter' || g.straps === 'one') && g.sleeve === (ctx as RuleContext).chosen,
    apply: (g) => { g.straps = 'none'; }, note: (g) => `The ${strapName(g.straps)} ${isAre(g.straps)} off: ${g.sleeve} sleeves need both shoulders.`, tell: true,
  },
  {
    // The back cap comes back with nothing holding the bodice.
    id: 'straps-off-back-cap', on: ['straps'], when: (g, _k, _w, ctx) => (g.straps === 'none' || !GOWN_STRAP_DEF[g.straps].holds) && strapless(g) && g.back !== 'closed' && !capLifted(g) && !strapsHeld(g) && ctx.backCapT !== undefined && g.backT > ctx.backCapT + 1e-3,
    apply: (g, _w, ctx) => { g.backT = ctx.backCapT!; },
    note: (g) => `With ${g.straps === 'none' ? 'no straps' : `${strapName(g.straps)} (they don't hold the bodice)`}, the back is raised to the bra line: a strapless bodice is held up all the way round there. Add an illusion back (under Back) to go lower.`, tell: true,
  },
  {
    id: 'strap-carries-cape', on: ['straps'], when: (g) => g.straps !== 'none' && !!GOWN_CAPE_STRAP[g.cape] && strapless(g) && gownStrapCovers(g, GOWN_CAPE_STRAP[g.cape]!),
    note: (g) => `The ${capeName(g)} now hangs from this strap (no extra narrow strap).`, tell: true,
  },
  { id: 'scallop-strapless', on: ['topEdge'], when: (g) => g.topEdge === 'scallop' && !scallopNeck(g), apply: (g) => { g.topEdge = 'plain'; }, note: 'A scalloped edge is for a strapless sweetheart or straight-across neckline.', tell: true },
  {
    // The neckline (or the sleeves, or the illusion) moved under the straps: never leave a strap that can't be worn.
    id: 'straps-follow-design', on: ALL_BUT('straps'), when: (g) => g.straps !== 'none' && !gownStrapOk(g, g.straps),
    apply: (g) => { g.straps = g.neck === 'plungewaist' ? 'spaghetti' : 'none'; },
    note: (g) => (g.neck === 'plungewaist'
      ? `Spaghetti straps now: ${strapName(g.straps)} don't go with a plunge to the waist.`
      : `The ${strapName(g.straps)} ${isAre(g.straps)} off: ${g.illu === 'neck' ? "the illusion neckline's sheer tulle already runs over the shoulders" : g.sleeve === 'butterfly' ? 'butterfly sleeves stand on the shoulders of the bodice' : g.neck === 'high' ? 'a high neck covers the shoulders' : g.neck === 'bateau' ? 'a bateau neckline covers the shoulders' : g.neck === 'off' ? 'an off-shoulder neckline takes off-shoulder straps only' : "they don't go with this neckline"}.`),
    tell: true,
  },
  {
    id: 'scallop-plain-again', on: ALL_BUT('topEdge'), when: (g) => g.topEdge === 'scallop' && !scallopNeck(g), apply: (g) => { g.topEdge = 'plain'; },
    note: 'The top edge is plain again: a scalloped edge is for strapless necklines.', tell: true,
  },
  // v200 `flowerSet`: 3D flowers and scattered pearls. Their lines go in the Undo line.
  {
    id: 'sheath-flowers-medium', on: ['sil', 'flowerSize', 'flowers', 'capeFlowers'], when: (g) => g.sil === 'sheath' && g.flowerSize === 'large' && (gownFlowersOn(g) || gownCapeFlowersOn(g)),
    apply: (g) => { g.flowerSize = 'medium'; }, note: 'The flowers are now medium: on a sheath they stay small or medium, close to the body.', tell: true,
  },
  {
    id: 'hem-flowers-need-floor', on: ['flowers'], when: (g) => g.flowers === 'hem' && !gownFloorLength(g), apply: (g, was) => { g.flowers = (was as GownConfig['flowers']) || 'none'; },
    note: 'A hem border of flowers needs a floor-length hem: pick Floor under Length first.', tell: true,
  },
  {
    id: 'cascade-strapless-bodice', on: ['flowers', 'flowerFrom'], when: (g, k) => (k === 'flowerFrom' || g.flowers === 'cascade') && strapless(g) && g.flowerFrom !== 'bodice',
    apply: (g) => { g.flowerFrom = 'bodice'; }, note: 'On a strapless gown the cascade starts at the bodice edge.', tell: true,
  },
  {
    id: 'strapless-cascade-bodice', on: ['neck'], when: (g, _k, was) => strapless(g) && !GOWN_STRAPLESS.includes(was as GownConfig['neck']) && g.flowers === 'cascade' && g.flowerFrom === 'shoulder',
    apply: (g) => { g.flowerFrom = 'bodice'; }, note: 'The flower cascade now starts at the bodice edge: a strapless neckline has no shoulder.', tell: true,
  },
  {
    id: 'veil-off-pearls', on: ['veil'], when: (g) => g.veil === 'none' && (g.pearls === 'veil' || g.pearls === 'both'), apply: (g) => { g.pearls = g.pearls === 'both' ? 'neck' : 'none'; },
    note: 'The pearls on the veil edge are off with the veil.', tell: true,
  },
  {
    id: 'pearls-need-veil', on: ['pearls'], when: (g) => (g.pearls === 'veil' || g.pearls === 'both') && g.veil === 'none', apply: (g, was) => { g.pearls = (was as GownConfig['pearls']) || 'none'; },
    note: 'Pick a veil first: these pearls are scattered along its edge.', tell: true,
  },
  {
    id: 'flowers-accent-first', on: ['flowerCol'], when: (g) => g.flowerCol === 'accent' && !accented(g), apply: (g, was) => { g.flowerCol = (was as GownConfig['flowerCol']) || 'gown'; },
    note: 'Pick an accent colour first (under Sleeves); until then the flowers stay in the gown colour.', tell: true,
  },
  {
    // v200 `flowerSync`: a shorter hem takes the hem border of flowers off.
    id: 'short-hem-flowers-off', on: ['hem', 'hemCm'], when: (g) => g.flowers === 'hem' && !gownFloorLength(g), apply: (g) => { g.flowers = 'none'; },
    note: 'The hem border of 3D flowers is off: it needs a floor-length hem.', tell: true,
  },
  // v198: the illusion bodice, the illusion back and the boning you can see. Their lines go in the Undo line.
  {
    id: 'illusion-needs-neckline', on: ['illu'], when: (g) => g.illu === 'neck' && bareTop(g), apply: (g) => { g.neck = 'bateau'; g.neckT = null; },
    note: 'An illusion neckline needs a neckline above the cups, so the neckline is now bateau: sheer tulle from the cups up to it.', tell: true,
  },
  {
    id: 'strapless-no-illusion', on: ['neck'], when: (g) => bareTop(g) && g.illu === 'neck', apply: (g) => { g.illu = 'none'; },
    note: 'A strapless neckline is the top of the cups, so there is no sheer part above it: the bodice is the gown fabric again ("Sheer corset" keeps tulle below the cups).', tell: true,
  },
  { id: 'sheer-corset-boned', on: ['illu'], when: (g) => g.illu === 'corset' && g.boning === 'soft', apply: (g) => { g.boning = 'complement'; }, note: 'A sheer corset is boned so it keeps its shape: boning is now Complement.', tell: true },
  { id: 'show-bones-adds-bones', on: ['boneShow'], when: (g) => g.boneShow === 'on' && g.boning === 'soft', apply: (g) => { g.boning = 'complement'; }, note: 'Bones are added (Complement) so there is boning to show. Change them under Inside, Boning.', tell: true },
  { id: 'soft-hides-bones', on: ['boning'], when: (g) => g.boning === 'soft' && g.boneShow === 'on', apply: (g) => { g.boneShow = 'off'; }, note: 'Visible boning is off: a soft bodice has no bones.', tell: true },
  { id: 'closed-back-no-illusion', on: ['back'], when: (g) => g.back === 'closed' && g.illuBack === 'on', apply: (g) => { g.illuBack = 'off'; } },
  {
    // Owner: a strapless low back needs straps or an illusion back. Turning the illusion back off raises the back.
    id: 'illusion-back-off-raises', on: ['illuBack'], when: (g, _k, _w, ctx) => g.illuBack === 'off' && backTooLow(g, ctx) && !strapsHeld(g),
    apply: (g, _w, ctx) => { g.backT = Math.round(ctx.backCapT! * 500) / 500; }, note: 'The back is raised to the bra line: a strapless bodice with no straps needs its back (or an illusion back) to stay up.', tell: true,
  },
  {
    id: 'low-back-adds-illusion', on: ['back', 'neck', 'cape', 'backT'], when: (g, _k, _w, ctx) => backTooLow(g, ctx) && !strapsHeld(g) && g.illuBack !== 'on',
    apply: (g) => { g.illuBack = 'on'; }, note: "A strapless bodice can't stay up with a back this low, so an illusion back is added: sheer tulle closes it up to the top edge, and the back still looks open.", tell: true,
  },
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
export function gownChoose(config: GownConfig, choice: GownChoice, ctx: GownChooseContext = {}): GownChosen {
  const g = structuredClone(config) as GownConfig, was = config[choice.key];
  (g as Record<keyof GownConfig, unknown>)[choice.key] = choice.value;
  const notes: string[] = [], rc: RuleContext = { ...ctx, chosen: choice.value };
  let tell = false;
  for (const r of GOWN_RULES) {
    if (!r.on.includes(choice.key) || !r.when(g, choice.key, was, rc)) continue;
    if (r.alone && notes.length) continue;
    // A rule's line reads the design before the rule changes it (it names what she had, or asked for).
    const n = typeof r.note === 'function' ? r.note(g, was) : r.note;
    r.apply?.(g, was, rc);
    if (n && !(r.quietAfterTell && tell)) { if (r.replaces) notes.length = 0; notes.push(n); }
    if (r.tell) tell = true;
  }
  const changed = (Object.keys(g) as (keyof GownConfig)[]).filter((k) => k !== choice.key && JSON.stringify(g[k]) !== JSON.stringify(config[k]));
  return { config: g, notes, tell, changed };
}

/**
 * The choices a design rules out, shown hidden in the lists themselves (v197 `capeRules`, `waistOpts`, slit chips), and
 * how a list names a choice: on a strapless bodice the long sleeves read "Detachable". `blusher` says whether the
 * blusher row shows (a classic veil only).
 */
export function gownHiddenChoices(g: GownConfig): {
  sleeve: string[]; veil: string[]; waist: string[]; slits: boolean; overlay: string[]; petti: string[]; train: string[]; pleat: boolean; drape: string[]; blusher: boolean; longSleeveLabel: string;
  capeLen: string[]; capeFasten: boolean; capeCol: boolean; capeCm: boolean; neck: string[]; illuDetails: boolean; illuBack: boolean;
  straps: string[]; strapRow: boolean; strapDetails: boolean; strapCol: boolean; topEdge: boolean; plungeFill: boolean;
  flowers: string[]; flowerDetails: boolean; flowerFromRow: boolean; flowerFrom: string[]; flowerSize: string[]; flowerCol: string[]; pearls: string[]; veilFab: boolean;
} {
  const k = gownStrapKind(g), two = k === 'halter' || k === 'one';
  return {
    overlay: g.sil === 'ball' ? ['asym', 'cascade'] : [],
    // v199: halter and one-shoulder straps leave no pair of shoulders for cap, butterfly or flutter sleeves.
    sleeve: [...new Set([...(caped(g) ? ['butterfly'] : []), ...(bareTop(g) ? ['cap'] : []), ...(two ? ['cap', 'butterfly', 'flutter'] : [])])],
    veil: longBack(g) ? ['floor', 'chapel', 'cathedral'] : [],
    waist: (['natural', 'empire', 'dropped', 'basque', 'basqueU'] as const).filter((w) => !GOWN_WAIST_FOR[g.pieces].includes(w)),
    slits: !!GOWN_NO_SLIT[g.sil],
    petti: closeSil(g) ? ['full', 'hoop'] : [],
    train: closeSil(g) ? ['chapel', 'cathedral'] : [],
    pleat: g.sil === 'sheath',
    drape: strapless(g) ? ['cowl'] : [],
    blusher: g.veil !== 'none' && g.veilStyle === 'classic',
    longSleeveLabel: bareTop(g) ? 'Detachable' : 'Long',
    // v196 Cape details: the lengths this cape can be; where a back cape fastens; its colour once there is an accent;
    // its own train once it has one.
    capeLen: g.cape === 'none' ? [] : GOWN_CAPE_LENGTHS.map((l) => l.id).filter((l) => !GOWN_CAPE_DEF[g.cape as Exclude<GownConfig['cape'], 'none'>].lens.includes(l)),
    capeFasten: g.cape !== 'back',
    capeCol: !accented(g),
    capeCm: gownCapeNow(g).len !== 'train',
    // v198: an illusion neckline needs a neckline above the cups; the illusion details while it is on; no illusion back on a closed back.
    // v199: nor a plunge to the waist.
    neck: g.illu === 'neck' ? [...GOWN_STRAPLESS.filter((n) => n !== 'off'), 'plungewaist'] : [],
    illuDetails: g.illu === 'none',
    illuBack: g.back === 'closed',
    // v199: the straps this design can wear (none on a high neck, a bateau, an illusion neckline or butterfly sleeves);
    // their details while there are straps (their colour once there is an accent); the top edge on a strapless
    // sweetheart or straight-across neckline; what fills a plunge.
    straps: GOWN_STRAPS.map((x) => x.id).filter((x) => !gownStrapOk(g, x)),
    strapRow: g.neck === 'high' || g.neck === 'bateau' || g.illu === 'neck' || g.sleeve === 'butterfly',
    strapDetails: k === 'none',
    strapCol: !accented(g),
    topEdge: !scallopNeck(g),
    plungeFill: g.neck !== 'plungewaist',
    // v200 `flwChips`: a hem border only on a floor-length hem; the flowers' details while there are flowers (where a
    // cascade starts only for a cascade, and never at her shoulder on a strapless gown); no large flowers on a sheath; the
    // accent colour once there is an accent; pearls on the veil's edge and the veil's tulle only with a veil.
    flowers: gownFloorLength(g) ? [] : ['hem'],
    flowerDetails: !(gownFlowersOn(g) || gownCapeFlowersOn(g)),
    flowerFromRow: g.flowers !== 'cascade',
    flowerFrom: strapless(g) ? ['shoulder'] : [],
    flowerSize: g.sil === 'sheath' ? ['large'] : [],
    flowerCol: accented(g) ? [] : ['accent'],
    pearls: g.veil === 'none' ? ['veil', 'both'] : [],
    veilFab: g.veil === 'none',
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

/** v197 `LOOK_BASE`: a look is laid over these (a fresh design's look keys, but unboned). */
export function gownLookBase(): GownLook {
  return { ...gownLookOf(startingGownConfig()), boning: 'soft' };
}

/**
 * Apply a look (v197 `applyLook`): the look base and the look, choice by choice through the pairing rules; then the
 * look's own choices again, so its pairings win over automatic ones; a strapless look starts boned, like a strapless
 * neckline picked by hand. The design passed in is not changed.
 */
export function gownApplyLook(config: GownConfig, look: Partial<GownLook>, ctx: GownChooseContext = {}): GownConfig {
  let g = structuredClone(config) as GownConfig;
  const set = (k: keyof GownLook, v: unknown, always: boolean) => {
    if (always || JSON.stringify(g[k]) !== JSON.stringify(v)) g = gownChoose(g, { key: k, value: v } as GownChoice, ctx).config;
  };
  for (const [k, v] of Object.entries({ ...gownLookBase(), ...look }) as [keyof GownLook, unknown][]) set(k, v, k === 'sil' || k === 'neck');
  for (const [k, v] of Object.entries(look) as [keyof GownLook, unknown][]) set(k, v, false);
  if (strapless(g) && g.boning === 'soft' && look.boning === undefined) { g.boning = 'complement'; g.waistStay = true; }
  return g;
}
