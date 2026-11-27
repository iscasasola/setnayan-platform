/**
 * 👗 gown-config — THE contract for the Gown Maker (plan: corpus `WHATS_NEXT_Gown_Maker_Port_2026-11-27.md` §2.3,
 * step A1). Pure: no React, no three.js, no money. Both builders build on this one file:
 *   · the bride's designer, the 3D stage and the engine (lib/gown/**) read the catalogs and the starting values;
 *   · the server (`gown_tool` op) refuses a design, a body, a set of measurements or a set of quantities before
 *     anything is stored (`sanitizeGownConfig`, `sanitizeGownBody`, `sanitizeGownMeasures`, `sanitizeGownQuantities`);
 *   · the shop prices `GownQuantities` with its own list on the server (lib/gown-maker.ts). Nothing here is a price,
 *     and nothing the bride's device holds is one (owner rule: designers see costs, clients see the proposal).
 *
 * The approved drawing for behaviour and wording is the prototype `prototypes/gown_maker_2026-11-27/gown_maker_v186.html`
 * (`LOOK_BASE`, `gown`, `FINE`, `RANGE.female`, `GMEAS`, `orderData`). Women only: the men's catalogs are not ported.
 *
 * Catalogs are append-only: a stored design must never dangle. The checks refuse; they never repair.
 * 🔒 lib/gown-config.test.ts
 */

/**
 * v2 (accuracy review, owner 27 Nov; prototype v197): the A-line now leaves the body at the waist, and the old hip-hugging
 * shape is a new silhouette, Fit and flare. A design saved at v1 with `sil: 'aline'` opens as Fit and flare, so it looks
 * as it did when it was saved (v197 `lookGown`, `LOOK_V`). Bodies and quantities did not change: v1 is read as is.
 */
export const GOWN_CONFIG_VERSION = 2;
/** Versions the checks still read (and migrate). */
export const GOWN_CONFIG_VERSIONS_READ: readonly number[] = [1, 2];
const versionOk = (v: unknown) => v == null || (typeof v === 'number' && GOWN_CONFIG_VERSIONS_READ.includes(v));
/** A design saved before v2 with the old A-line opens as Fit and flare (v197). Anything else is unchanged. */
export function gownMigrateSilhouette(sil: unknown, savedVersion: unknown): unknown {
  return sil === 'aline' && typeof savedVersion === 'number' && savedVersion < 2 ? 'fitflare' : sil;
}
/** A design, a body and its measurements are small: refuse anything bigger before reading it further. */
export const GOWN_CONFIG_MAX_BYTES = 8192;
export const GOWN_BODY_MAX_BYTES = 2048;
export const GOWN_MEASURES_MAX_BYTES = 4096;
export const GOWN_QUANTITIES_MAX_BYTES = 4096;
/** "Any special requests?" (v186: 1500 letters). */
export const GOWN_NOTES_MAX = 1500;
/** A look's name (the prototype's look and the shop's own looks). */
export const GOWN_LOOK_NAME_MAX = 60;
/** Your colours: up to three colour families (v186 "Up to three colour families"). */
export const GOWN_PALETTE_MAX = 3;
/** A bead layer may mix in up to two extra colours (v186 `mix-add` hides at two). */
export const GOWN_BEAD_MIX_MAX = 2;
/** Bead layers beyond the first. A size bound only: the drawn beads are capped by the engine (2500). */
export const GOWN_BEAD_LAYERS_MAX = 6;
/** v185 `CUP_MAX`: the bust is at most this many cm over the underbust; the ribs never grow for it. */
export const GOWN_CUP_MAX_CM = 28;
/** Closed decision: her weight stays within BMI 10–62 for her height (v169 `estKgW` clamp). */
export const GOWN_BMI_MIN = 10;
export const GOWN_BMI_MAX = 62;

type Entry = { readonly id: string; readonly label: string };
const ids = <T extends Entry>(list: readonly T[]) => list.map((x) => x.id) as T['id'][];
const isOneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

// ─────────────────────────────────────────────────────────────────────────────
// The design catalogs (labels are the prototype's chip words)
// ─────────────────────────────────────────────────────────────────────────────

export const GOWN_SILHOUETTES = [
  { id: 'aline', label: 'A-line' },
  { id: 'ball', label: 'Ball gown' },
  { id: 'mermaid', label: 'Mermaid' },
  { id: 'sheath', label: 'Sheath' },
  { id: 'terno', label: 'Filipiniana' },
  // v197: close over the hips, then opens out below them (the A-line's old shape).
  { id: 'fitflare', label: 'Fit and flare' },
] as const;
export type GownSilhouette = (typeof GOWN_SILHOUETTES)[number]['id'];

export const GOWN_PIECES = [
  { id: 'one', label: 'One piece' },
  { id: 'two', label: 'Two-piece (top + skirt)' },
  { id: 'crop', label: 'Two-piece, cropped top' },
] as const;
export type GownPieces = (typeof GOWN_PIECES)[number]['id'];

export const GOWN_WAISTLINES = [
  { id: 'natural', label: 'Natural' },
  { id: 'empire', label: 'Empire' },
  { id: 'dropped', label: 'Dropped' },
  { id: 'basque', label: 'Basque V' },
  { id: 'basqueU', label: 'Basque U' },
] as const;
export type GownWaistline = (typeof GOWN_WAISTLINES)[number]['id'];

export const GOWN_NECKLINES = [
  { id: 'sweetheart', label: 'Sweetheart' },
  { id: 'v', label: 'V-neck' },
  { id: 'off', label: 'Off-shoulder' },
  { id: 'high', label: 'High neck' },
  { id: 'bateau', label: 'Bateau' },
  { id: 'straight', label: 'Straight across' },
] as const;
export type GownNeckline = (typeof GOWN_NECKLINES)[number]['id'];
/** Necklines with nothing over the shoulders (v197 `STRAPLESS`). */
export const GOWN_STRAPLESS: readonly GownNeckline[] = ['sweetheart', 'off', 'straight'];

export const GOWN_SLEEVES = [
  { id: 'none', label: 'None' },
  { id: 'cap', label: 'Cap' },
  { id: 'long', label: 'Long' },
  { id: 'butterfly', label: 'Butterfly' },
  // v195: soft fabric from the shoulder over the upper arm to about the elbow, open underneath, a fluted hem.
  { id: 'flutter', label: 'Flutter' },
] as const;
export type GownSleeve = (typeof GOWN_SLEEVES)[number]['id'];

export const GOWN_SLEEVE_FABRICS = [
  { id: 'fabric', label: 'The gown fabric' },
  { id: 'lace', label: 'Sheer lace' },
  // v195: soft see-through chiffon for the sleeves, in the gown colour (or the accent colour).
  { id: 'chiffon', label: 'Sheer chiffon' },
] as const;
export type GownSleeveFabric = (typeof GOWN_SLEEVE_FABRICS)[number]['id'];

export const GOWN_BACKS = [
  { id: 'scoop', label: 'Scoop' },
  { id: 'closed', label: 'Closed' },
  { id: 'v', label: 'V back' },
] as const;
export type GownBack = (typeof GOWN_BACKS)[number]['id'];

export const GOWN_CLOSURES = [
  { id: 'zipper', label: 'Zipper' },
  { id: 'lace', label: 'Lace-up' },
  { id: 'buttons', label: 'Buttons' },
] as const;
export type GownClosure = (typeof GOWN_CLOSURES)[number]['id'];

export const GOWN_TRAINS = [
  { id: 'none', label: 'None' },
  { id: 'sweep', label: 'Sweep' },
  { id: 'chapel', label: 'Chapel' },
  { id: 'cathedral', label: 'Cathedral' },
] as const;
export type GownTrain = (typeof GOWN_TRAINS)[number]['id'];

/** Veil lengths (v197): elbow, fingertip and floor end where their names say; chapel and cathedral are measured from the crown. */
export const GOWN_VEILS = [
  { id: 'none', label: 'None' },
  { id: 'fingertip', label: 'Fingertip', why: 'To her fingertips, about 1 m from the crown.' },
  { id: 'chapel', label: 'Chapel' },
  { id: 'cathedral', label: 'Cathedral' },
  // v197 (appended: the catalog keeps its order; `GOWN_VEIL_ORDER` is the order she reads them in).
  { id: 'elbow', label: 'Elbow', why: 'To her elbows: a short, light veil.' },
  { id: 'floor', label: 'Floor', why: 'Just touches the floor behind her.' },
] as const;
export type GownVeil = (typeof GOWN_VEILS)[number]['id'];
/** Shortest to longest, as the prototype lists them (v197). */
export const GOWN_VEIL_ORDER: readonly GownVeil[] = ['none', 'elbow', 'fingertip', 'floor', 'chapel', 'cathedral'];
/** A classic veil's front layer (v197): worn back over the head, or over her face. */
export const GOWN_BLUSHERS = [
  { id: 'back', label: 'Worn back', why: 'The front layer is worn back over the head: her face is open.' },
  { id: 'over', label: 'Over the face', why: 'A short front layer of tulle falls over her face, lifted back at the ceremony.' },
] as const;
export type GownBlusher = (typeof GOWN_BLUSHERS)[number]['id'];
/** A small bow in the gown fabric (v197). */
export const GOWN_BOWS = [
  { id: 'none', label: 'None' },
  { id: 'back', label: 'Back waist', why: 'A small bow, about 8 cm wide, at the back of the waist, in the gown fabric.' },
  { id: 'shoulder', label: 'Shoulder', why: 'A small bow, about 7 cm wide, on her left shoulder or sleeve band, in the gown fabric.' },
] as const;
export type GownBow = (typeof GOWN_BOWS)[number]['id'];

export const GOWN_VEIL_STYLES = [
  { id: 'classic', label: 'Classic' },
  { id: 'mantilla', label: 'Mantilla' },
  { id: 'drop', label: 'Drop veil' },
  { id: 'juliet', label: 'Juliet cap' },
  { id: 'birdcage', label: 'Birdcage' },
] as const;
export type GownVeilStyle = (typeof GOWN_VEIL_STYLES)[number]['id'];

/** A cape in the gown's own fabric (v193). `why` is the line under the choice. */
export const GOWN_CAPES = [
  { id: 'none', label: 'None', why: 'No cape.' },
  { id: 'side', label: 'Side cape', why: 'One long panel from her left shoulder: over the upper arm, then down her side and back to the floor.' },
  { id: 'back', label: 'Back cape', why: 'Hangs from both shoulders down her back to the floor, and runs on over any train. The veil stays fingertip or shorter.' },
  { id: 'capelet', label: 'Capelet', why: 'A short cape round both shoulders, to about the middle of the upper arm. Covers the shoulders, for example in church.' },
] as const;
export type GownCape = (typeof GOWN_CAPES)[number]['id'];

/** An overlay over the skirt (v195), sewn at the waist, stopping above the floor. `why` is the line under the choice. */
export const GOWN_OVERLAYS = [
  { id: 'none', label: 'None', why: 'No overlay.' },
  { id: 'asym', label: 'Asymmetric', why: 'One panel of soft fabric over the skirt: high at her right hip, falling on a diagonal to near the floor on her left, with a soft cascade at the low point.' },
  { id: 'tiered', label: 'Tiered', why: 'Three soft layers over the skirt, each shorter than the one under it.' },
  { id: 'cascade', label: 'Cascade', why: 'Handkerchief hem: the overlay falls in six soft points round the skirt.' },
] as const;
export type GownOverlay = (typeof GOWN_OVERLAYS)[number]['id'];
/** What the overlay is made of (v195): a sheer, or the gown's own fabric. */
export const GOWN_OVERLAY_FABRICS = [
  { id: 'chiffon', label: 'Chiffon' },
  { id: 'georgette', label: 'Georgette' },
  { id: 'tulle', label: 'Tulle' },
  { id: 'organza', label: 'Organza' },
  { id: 'gown', label: 'The gown fabric' },
] as const;
export type GownOverlayFabric = (typeof GOWN_OVERLAY_FABRICS)[number]['id'];

/** The length (v186 `#hems`): "Tea" is the midi. */
export const GOWN_HEMS = [
  { id: 'knee', label: 'Knee' },
  { id: 'midi', label: 'Tea' },
  { id: 'floor', label: 'Floor' },
] as const;
export type GownHem = (typeof GOWN_HEMS)[number]['id'];

/**
 * The stock fabric types (v186 `FABRICS`). The database registry (`gown_fabric_types`, step B1) is the live list and
 * may add more; these are the code fallback and the seed. A type id is a slug, so a registry type not listed here is
 * still a valid id when the shop offers it (`GownOffer.fabricTypes`).
 */
export const GOWN_STOCK_FABRICS = [
  { id: 'satin', label: 'Satin' },
  { id: 'mikado', label: 'Mikado' },
  { id: 'crepe', label: 'Crepe' },
  { id: 'chiffon', label: 'Chiffon' },
  { id: 'georgette', label: 'Georgette' },
  { id: 'tulle', label: 'Tulle' },
  { id: 'organza', label: 'Organza' },
  { id: 'lace', label: 'Lace' },
  { id: 'sequin', label: 'Sequin' },
  { id: 'pina', label: 'Piña' },
  { id: 'jusi', label: 'Jusi' },
  { id: 'wool_suiting', label: 'Wool suiting' },
  { id: 'linen', label: 'Linen' },
  { id: 'velvet', label: 'Velvet' },
  { id: 'stretch_crepe_jersey', label: 'Stretch crepe jersey' },
] as const;
export type GownStockFabric = (typeof GOWN_STOCK_FABRICS)[number]['id'];
/** A fabric type id: a stock id or a registry slug. */
export const GOWN_FABRIC_TYPE_ID = /^[a-z][a-z0-9_]{1,39}$/;

/** The stock gown colours (v186 `#swatches`). `custom` carries its own hex. Hexes are product data, not skin. */
export const GOWN_COLOURS = [
  { id: 'white', label: 'White', hex: '#FBFAF6' },
  { id: 'ivory', label: 'Ivory', hex: '#F3ECDF' },
  { id: 'champagne', label: 'Champagne', hex: '#DCC49C' },
  { id: 'blush', label: 'Blush', hex: '#E9C3BD' },
  { id: 'navy', label: 'Navy', hex: '#1F2A44' },
  { id: 'custom', label: 'Custom colour', hex: null },
] as const;
export type GownColour = (typeof GOWN_COLOURS)[number]['id'];

/** Your colours: the colour families she may narrow the colour step to (v186 `FAMS`). */
export const GOWN_COLOUR_FAMILIES = [
  { id: 'whites', label: 'Whites & ivory' },
  { id: 'nude', label: 'Champagne & nude' },
  { id: 'blush', label: 'Blush & pink' },
  { id: 'red', label: 'Red & burgundy' },
  { id: 'purple', label: 'Purple & lilac' },
  { id: 'blue', label: 'Blue & navy' },
  { id: 'green', label: 'Green & sage' },
  { id: 'gold', label: 'Yellow & gold' },
  { id: 'brown', label: 'Brown & taupe' },
  { id: 'grey', label: 'Grey & black' },
] as const;
export type GownColourFamily = (typeof GOWN_COLOUR_FAMILIES)[number]['id'];

/** The stock lace motifs drawn by code (v186 `LACE_LIB`). A shop's own lace is a `laceRef` instead. */
export const GOWN_LACES = [
  { id: 'none', label: 'None' },
  { id: 'floral', label: 'Floral' },
  { id: 'alencon', label: 'Alençon' },
  { id: 'chantilly', label: 'Chantilly' },
  { id: 'guipure', label: 'Guipure' },
  { id: 'leaf', label: 'Leaf' },
  { id: 'scallop', label: 'Scallop border' },
] as const;
export type GownLace = (typeof GOWN_LACES)[number]['id'];

export const GOWN_LACE_PLACES = [
  { id: 'cascade', label: 'Cascade' },
  { id: 'bodice', label: 'Bodice' },
  { id: 'neck', label: 'Neckline edge' },
  { id: 'hem', label: 'Hem border' },
  { id: 'scatter', label: 'Scattered' },
  { id: 'all', label: 'All over' },
] as const;
export type GownLacePlace = (typeof GOWN_LACE_PLACES)[number]['id'];

export const GOWN_LACE_BEADS = [
  { id: 'none', label: 'None' },
  { id: 'light', label: 'Light' },
  { id: 'rich', label: 'Richly beaded' },
] as const;
export type GownLaceBeads = (typeof GOWN_LACE_BEADS)[number]['id'];

export const GOWN_LACE_COLOURS = [
  { id: 'white', label: 'White' },
  { id: 'ivory', label: 'Ivory' },
  { id: 'champagne', label: 'Champagne' },
  { id: 'blush', label: 'Blush' },
] as const;
export type GownLaceColour = (typeof GOWN_LACE_COLOURS)[number]['id'];

export const GOWN_BEADS = [
  { id: 'none', label: 'None' },
  { id: 'crystal', label: 'Crystals' },
  { id: 'pearl', label: 'Pearls' },
  { id: 'seed', label: 'Seed beads' },
  { id: 'sequin', label: 'Sequins' },
] as const;
export type GownBead = (typeof GOWN_BEADS)[number]['id'];
export type GownBeadKind = Exclude<GownBead, 'none'>;
export const GOWN_BEAD_KINDS = ids(GOWN_BEADS).filter((b): b is GownBeadKind => b !== 'none');

export const GOWN_BEAD_PLACES = [
  { id: 'cascade', label: 'Cascade' },
  { id: 'bodice', label: 'Bodice' },
  { id: 'neck', label: 'Neckline edge' },
  { id: 'waist', label: 'Waist band' },
  { id: 'hem', label: 'Hem' },
  { id: 'all', label: 'All over' },
] as const;
export type GownBeadPlace = (typeof GOWN_BEAD_PLACES)[number]['id'];

export const GOWN_BEAD_DENSITIES = [
  { id: 'light', label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'heavy', label: 'Heavy' },
] as const;
export type GownBeadDensity = (typeof GOWN_BEAD_DENSITIES)[number]['id'];

export const GOWN_BEAD_COLOURS = [
  { id: 'clear', label: 'Clear' },
  { id: 'ivory', label: 'Ivory' },
  { id: 'champagne', label: 'Champagne' },
  { id: 'silver', label: 'Silver' },
  { id: 'gold', label: 'Gold' },
  { id: 'custom', label: 'Custom' },
] as const;
export type GownBeadColour = (typeof GOWN_BEAD_COLOURS)[number]['id'];

export const GOWN_PLEATS = [
  { id: 'none', label: 'None' },
  { id: 'knife', label: 'Knife' },
  { id: 'box', label: 'Box' },
  { id: 'accordion', label: 'Accordion' },
] as const;
export type GownPleat = (typeof GOWN_PLEATS)[number]['id'];

export const GOWN_TEXTURES = [
  { id: 'none', label: 'None' },
  { id: 'pintuck', label: 'Pintucks' },
  { id: 'ruche', label: 'Ruching' },
  { id: 'smock', label: 'Smocking' },
] as const;
export type GownTexture = (typeof GOWN_TEXTURES)[number]['id'];

export const GOWN_TEXTURE_PLACES = [
  { id: 'bodice', label: 'Bodice' },
  { id: 'waist', label: 'Waist band' },
  { id: 'back', label: 'Back panel' },
  { id: 'skirt', label: 'Skirt' },
  { id: 'all', label: 'All over' },
] as const;
export type GownTexturePlace = (typeof GOWN_TEXTURE_PLACES)[number]['id'];

export const GOWN_TEXTURE_DIRECTIONS = [
  { id: 'v', label: 'Vertical' },
  { id: 'h', label: 'Horizontal' },
  { id: 'd', label: 'Diagonal' },
  { id: 'vv', label: 'V shape' },
] as const;
export type GownTextureDirection = (typeof GOWN_TEXTURE_DIRECTIONS)[number]['id'];

export const GOWN_DARTS = [
  { id: 'none', label: 'None' },
  { id: 'bust', label: 'Bust darts' },
  { id: 'waist', label: 'Waist darts' },
  { id: 'princess', label: 'Princess seams' },
  { id: 'corset', label: 'Corset panels' },
] as const;
export type GownDarts = (typeof GOWN_DARTS)[number]['id'];

export const GOWN_DRAPES = [
  { id: 'none', label: 'None' },
  { id: 'grecian', label: 'Grecian bodice' },
  { id: 'cowl', label: 'Cowl neck' },
  { id: 'swag', label: 'Side swag' },
] as const;
export type GownDrape = (typeof GOWN_DRAPES)[number]['id'];

export const GOWN_BUSTLES = [
  { id: 'none', label: 'None' },
  { id: 'french', label: 'French' },
  { id: 'american', label: 'American' },
  { id: 'ballroom', label: 'Ballroom' },
] as const;
export type GownBustle = (typeof GOWN_BUSTLES)[number]['id'];

export const GOWN_PETTICOATS = [
  { id: 'none', label: 'None' },
  { id: 'soft', label: 'Soft tulle' },
  { id: 'full', label: 'Full tulle' },
  { id: 'hoop', label: 'Hoop (crinoline)' },
] as const;
export type GownPetticoat = (typeof GOWN_PETTICOATS)[number]['id'];

/** What she wears underneath (v186 `shape`). */
export const GOWN_SHAPEWEAR = [
  { id: 'none', label: 'None' },
  { id: 'light', label: 'Light shapewear' },
  { id: 'firm', label: 'Firm shapewear (girdle)' },
  { id: 'corset', label: 'Corset (boned)' },
] as const;
export type GownShapewear = (typeof GOWN_SHAPEWEAR)[number]['id'];

export const GOWN_BONING = [
  { id: 'soft', label: 'Soft (none)' },
  { id: 'complement', label: 'Complement' },
  { id: 'corset', label: 'Corset' },
] as const;
export type GownBoning = (typeof GOWN_BONING)[number]['id'];

export const GOWN_LININGS = [
  { id: 'satin', label: 'Satin' },
  { id: 'cotton', label: 'Cotton' },
  { id: 'silk', label: 'Silk' },
  { id: 'none', label: 'None' },
] as const;
export type GownLining = (typeof GOWN_LININGS)[number]['id'];

/**
 * Each layer under the skirt (v192/v193 `LTYPES`), counted out from her: layer 1 is next to her. A hoop can only be
 * layer 1. `fill` is how much the material holds the skirt out (v193 `LFULL`: smaller is fuller).
 */
export const GOWN_LAYER_TYPES = [
  { id: 'soft', label: 'Soft tulle', why: 'Light and airy: a gentle lift.', fill: 0.11 },
  { id: 'full', label: 'Full tulle', why: 'Stiffer net: more volume.', fill: 0.06 },
  { id: 'organza', label: 'Organza', why: 'Crisp and sheer: a soft glow and light body.', fill: 0.09 },
  { id: 'chiffon', label: 'Chiffon', why: 'Soft and flowing: almost no volume.', fill: 0.14 },
  { id: 'hoop', label: 'Hoop (crinoline)', why: 'Rings next to her body: the widest skirt.', fill: 0.06 },
] as const;
export type GownLayerType = (typeof GOWN_LAYER_TYPES)[number]['id'];
/** The most layers under a skirt (the skirtLayers slider's top). */
export const GOWN_MAX_LAYERS = 6;

/** The colour of an inside layer or the lining (v193 `LCOLS`): the gown's own, or a stock shade. */
export const GOWN_LAYER_COLOURS = [
  { id: 'match', label: 'Match the gown', hex: null },
  { id: 'ivory', label: 'Ivory', hex: '#f3ecdf' },
  { id: 'white', label: 'White', hex: '#fbfbf8' },
  { id: 'blush', label: 'Blush', hex: '#f1d3cf' },
  { id: 'champagne', label: 'Champagne', hex: '#e9d6b5' },
  { id: 'nude', label: 'Nude', hex: '#e3c3a8' },
] as const;
export type GownLayerColour = (typeof GOWN_LAYER_COLOURS)[number]['id'];

export const GOWN_SLITS = [
  { id: 'left', label: 'Left front' },
  { id: 'right', label: 'Right front' },
  { id: 'lside', label: 'Left side' },
  { id: 'rside', label: 'Right side' },
  { id: 'back', label: 'Back' },
] as const;
export type GownSlit = (typeof GOWN_SLITS)[number]['id'];

/** The ready-made cut-outs (v186 `CUTS`). Some are never allowed: see `GOWN_CUT_FORBIDDEN`. */
export const GOWN_CUTOUTS = [
  { id: 'waist', label: 'Side waist' },
  { id: 'keyhole', label: 'Keyhole' },
  { id: 'under', label: 'Under-bust' },
  { id: 'diamond', label: 'Back diamond' },
  { id: 'window', label: 'Back window' },
  { id: 'hip', label: 'Hip' },
  { id: 'slash', label: 'Distressed slashes' },
] as const;
export type GownCutout = (typeof GOWN_CUTOUTS)[number]['id'];
/** v186 `CUT_BLOCK`: the reason each forbidden cut-out is shown greyed out. A design carrying one is refused. */
export const GOWN_CUT_FORBIDDEN: Partial<Record<GownCutout, string>> = {
  under: 'Not allowed: an opening under the bust would take away the support that holds the bust.',
  diamond: 'Not allowed: a back cut-out would cut through the back closure (zipper, lace-up or buttons).',
  window: 'Not allowed: a back cut-out would cut through the back closure (zipper, lace-up or buttons).',
};

export const GOWN_CUT_EDGES = [
  { id: 'clean', label: 'Clean' },
  { id: 'bound', label: 'Bound' },
  { id: 'frayed', label: 'Frayed' },
  { id: 'scalloped', label: 'Scalloped' },
  { id: 'beaded', label: 'Beaded' },
] as const;
export type GownCutEdge = (typeof GOWN_CUT_EDGES)[number]['id'];

export const GOWN_CUT_FILLS = [
  { id: 'open', label: 'Open' },
  { id: 'illusion', label: 'Illusion mesh' },
] as const;
export type GownCutFill = (typeof GOWN_CUT_FILLS)[number]['id'];

/** v186 `#trim-chips`. The sash and bow were removed by the owner and are not a trim. */
export const GOWN_TRIMS = [
  { id: 'pipeNeck', label: 'Piping, neckline' },
  { id: 'pipeHem', label: 'Piping, hem' },
  { id: 'ruffleHem', label: 'Ruffle, hem' },
  { id: 'ruffleNeck', label: 'Ruffle, neckline' },
  { id: 'fringe', label: 'Fringe, hem' },
  { id: 'feather', label: 'Feathers, hem' },
] as const;
export type GownTrim = (typeof GOWN_TRIMS)[number]['id'];

export const GOWN_TRIM_COLOURS = [
  { id: 'match', label: 'Match gown' },
  { id: 'custom', label: 'Contrast' },
] as const;
export type GownTrimColour = (typeof GOWN_TRIM_COLOURS)[number]['id'];

/** The sliders: [min, max, step, start] (v186 range inputs). */
export const GOWN_RANGES = {
  hemCm: [-60, 0, 0.1, 0],
  heelCm: [0, 15, 0.5, 0],
  neckT: [0, 1, 0.002, 0.3],
  backT: [0, 1, 0.002, 0.3],
  slitCm: [10, 80, 1, 45],
  cutScale: [60, 160, 5, 100],
  pleatN: [12, 32, 2, 24],
  pleatCm: [1, 8, 0.5, 3],
  texSp: [0.3, 6, 0.1, 1],
  laceCm: [3, 20, 0.5, 8],
  beadMm: [2, 6, 0.5, 3],
  skirtLayers: [1, 6, 1, 2],
  mixPct: [1, 100, 1, 20],
} as const satisfies Record<string, readonly [number, number, number, number]>;
export type GownRangeKey = keyof typeof GOWN_RANGES;

// ─────────────────────────────────────────────────────────────────────────────
// The design
// ─────────────────────────────────────────────────────────────────────────────

export type GownBeadMix = { hex: string; pct: number };
export type GownBeadLayer = {
  bead: GownBead;
  beadAt: GownBeadPlace;
  beadDen: GownBeadDensity;
  beadCol: GownBeadColour;
  beadMm: number;
  /** Only when `beadCol` is custom. */
  beadHex: string | null;
  mix: GownBeadMix[];
};

export type GownConfig = {
  v: typeof GOWN_CONFIG_VERSION;
  /** The look she started from (a stock look's name or the shop's look), words only. */
  lookName: string;
  /** The shop's look row (`vendor_gown_looks`), when she started from one. */
  lookRef: string | null;
  sil: GownSilhouette;
  pieces: GownPieces;
  waist: GownWaistline;
  neck: GownNeckline;
  /** Front depth, 0–1; null = the neckline's own depth. */
  neckT: number | null;
  back: GownBack;
  backT: number;
  sleeve: GownSleeve;
  sleeveFab: GownSleeveFabric;
  closure: GownClosure;
  train: GownTrain;
  veil: GownVeil;
  veilStyle: GownVeilStyle;
  /** A classic veil's front layer (v197). */
  blusher: GownBlusher;
  /** A small bow in the gown fabric (v197). */
  bow: GownBow;
  hem: GownHem;
  /**
   * The length slider's own value (v189 `#g-hem`): 0 = the picked length (`hem`); below 0, the hem sits that many cm
   * above the floor (a length between the presets; the slider snaps back to Knee, Tea or Floor within 2 cm).
   */
  hemCm: number;
  /** Her wedding shoes, cm (Elevation). */
  heel: number;
  /** A fabric type id (stock or registry). */
  fabric: string;
  /** The shop's fabric row (`vendor_gown_fabrics`), when she picked one. Its type is `fabric`. */
  fabricRef: string | null;
  colour: GownColour;
  /** The custom colour; null unless `colour` is custom. */
  colourHex: string | null;
  /** Accent (sleeves) fabric type and colour; null = the gown's own. */
  accentFabric: string | null;
  accentFabricRef: string | null;
  accentHex: string | null;
  palette: GownColourFamily[];
  lace: GownLace;
  /** The shop's lace row; when set it is the lace, and `lace` is the stock pattern it draws as. */
  laceRef: string | null;
  laceAt: GownLacePlace;
  laceBeads: GownLaceBeads;
  laceCol: GownLaceColour;
  laceCm: number;
  /** The first bead layer, flat (the prototype's `gown.bead*`), then any extra layers. */
  bead: GownBead;
  beadAt: GownBeadPlace;
  beadDen: GownBeadDensity;
  beadCol: GownBeadColour;
  beadMm: number;
  beadHex: string | null;
  mix: GownBeadMix[];
  beadLayers: GownBeadLayer[];
  pleat: GownPleat;
  pleatN: number;
  pleatCm: number;
  tex: GownTexture;
  texAt: GownTexturePlace;
  texDir: GownTextureDirection;
  texSp: number;
  darts: GownDarts;
  drape: GownDrape;
  bustle: GownBustle;
  /** Derived from the layers (`gownPettiOf`): kept for the looks and the quantities. */
  petti: GownPetticoat;
  skirtLayers: number;
  /** Each layer's material and colour, layer 1 next to her (always GOWN_MAX_LAYERS long; the first `skirtLayers` are worn). */
  layerTypes: GownLayerType[];
  layerCols: GownLayerColour[];
  shape: GownShapewear;
  boning: GownBoning;
  lining: GownLining;
  liningCol: GownLayerColour;
  cape: GownCape;
  overlay: GownOverlay;
  ovFab: GownOverlayFabric;
  waistStay: boolean;
  horsehair: boolean;
  modesty: boolean;
  slits: GownSlit[];
  slitCm: number;
  cuts: GownCutout[];
  cutScale: number;
  cutEdge: GownCutEdge;
  cutFill: GownCutFill;
  trims: GownTrim[];
  trimCol: GownTrimColour;
  trimHex: string | null;
  notes: string;
};

/** What one shop offers the bride: the fabric types it works in and its own fabric, lace and look rows. */
export type GownOffer = {
  fabricTypes: string[];
  fabricRefs: string[];
  laceRefs: string[];
  lookRefs: string[];
};

/** The look keys (v197 `LOOK_BASE`): a look, and the design the supplier opens on the mannequin, carry exactly these. */
export const GOWN_LOOK_KEYS = [
  'bow', 'blusher', 'veilStyle', 'waist', 'pieces', 'sil', 'neck', 'sleeve', 'sleeveFab', 'back', 'closure', 'fabric', 'lace', 'laceAt', 'laceBeads', 'laceCol',
  'bead', 'beadAt', 'beadDen', 'beadCol', 'train', 'veil', 'pleat', 'tex', 'darts', 'drape', 'bustle', 'petti', 'shape', 'boning', 'overlay', 'ovFab',
] as const satisfies readonly (keyof GownConfig)[];
export type GownLookKey = (typeof GOWN_LOOK_KEYS)[number];
export type GownLook = Pick<GownConfig, GownLookKey>;

/** A fresh design: the prototype's `LOOK_BASE` and slider starts, white satin to the floor, flat shoes. */
export function startingGownConfig(): GownConfig {
  const r = (k: GownRangeKey) => GOWN_RANGES[k][3];
  return {
    v: GOWN_CONFIG_VERSION,
    lookName: '',
    lookRef: null,
    sil: 'aline',
    pieces: 'one',
    waist: 'natural',
    neck: 'sweetheart',
    neckT: null,
    back: 'scoop',
    backT: r('backT'),
    sleeve: 'none',
    sleeveFab: 'fabric',
    closure: 'zipper',
    train: 'none',
    veil: 'none',
    veilStyle: 'classic',
    blusher: 'back',
    bow: 'none',
    hem: 'floor',
    hemCm: r('hemCm'),
    heel: r('heelCm'),
    fabric: 'satin',
    fabricRef: null,
    colour: 'white',
    colourHex: null,
    accentFabric: null,
    accentFabricRef: null,
    accentHex: null,
    palette: [],
    lace: 'none',
    laceRef: null,
    laceAt: 'cascade',
    laceBeads: 'none',
    laceCol: 'ivory',
    laceCm: r('laceCm'),
    bead: 'none',
    beadAt: 'cascade',
    beadDen: 'medium',
    beadCol: 'clear',
    beadMm: r('beadMm'),
    beadHex: null,
    mix: [],
    beadLayers: [],
    pleat: 'none',
    pleatN: r('pleatN'),
    pleatCm: r('pleatCm'),
    tex: 'none',
    texAt: 'bodice',
    texDir: 'v',
    texSp: r('texSp'),
    darts: 'none',
    drape: 'none',
    bustle: 'none',
    petti: 'soft',
    skirtLayers: r('skirtLayers'),
    layerTypes: Array<GownLayerType>(GOWN_MAX_LAYERS).fill('soft'),
    layerCols: Array<GownLayerColour>(GOWN_MAX_LAYERS).fill('match'),
    shape: 'none',
    // v197: a fresh gown is boned, with a waist stay (its sweetheart bodice holds itself up).
    boning: 'complement',
    lining: 'satin',
    liningCol: 'match',
    cape: 'none',
    overlay: 'none',
    ovFab: 'chiffon',
    waistStay: true,
    horsehair: false,
    modesty: false,
    slits: [],
    slitCm: r('slitCm'),
    cuts: [],
    cutScale: r('cutScale'),
    cutEdge: 'bound',
    cutFill: 'open',
    trims: [],
    trimCol: 'match',
    trimHex: null,
    notes: '',
  };
}

/** How many layers she wears under the skirt (v193 `layerN`): none without a petticoat, else at least one. */
export const gownLayerCount = (c: Pick<GownConfig, 'petti' | 'skirtLayers'>) => (c.petti === 'none' ? 0 : Math.max(1, Math.round(c.skirtLayers || 1)));

/** The petticoat the worn layers make (v193 `layerPetti`): a hoop as layer 1, any full tulle, else soft. */
export function gownPettiOf(n: number, types: readonly GownLayerType[]): GownPetticoat {
  if (n === 0) return 'none';
  if (types[0] === 'hoop') return 'hoop';
  return types.slice(0, n).some((x) => x === 'full') ? 'full' : 'soft';
}

/**
 * Keep the layers and the petticoat choice in agreement (v193 `layerSync`): a hoop petticoat puts the hoop at layer 1,
 * a full one needs a full tulle layer, a soft one has neither. A hoop is never above layer 1. Returns a new list.
 */
export function gownSyncLayers(petti: GownPetticoat, n: number, types: readonly GownLayerType[]): GownLayerType[] {
  const t = Array.from({ length: GOWN_MAX_LAYERS }, (_, i) => types[i] ?? 'soft');
  if (petti === 'hoop' && t[0] !== 'hoop') t[0] = 'hoop';
  if (petti !== 'hoop') for (let i = 0; i < t.length; i++) if (t[i] === 'hoop') t[i] = 'full';
  if (petti === 'full' && !t.slice(0, n).some((x) => x === 'full')) t[0] = 'full';
  if (petti === 'soft') for (let i = 0; i < t.length; i++) if (t[i] === 'full' || t[i] === 'hoop') t[i] = 'soft';
  for (let i = 1; i < t.length; i++) if (t[i] === 'hoop') t[i] = 'full';
  return t;
}

/** The look keys of a design (what the supplier's "Open on the mannequin" and a saved look carry). */
export function gownLookOf(config: GownConfig): GownLook {
  const out = {} as Record<GownLookKey, unknown>;
  for (const k of GOWN_LOOK_KEYS) out[k] = config[k];
  return out as GownLook;
}

// ─────────────────────────────────────────────────────────────────────────────
// Her body (the Measurements steps) and the gown's own measurements
// ─────────────────────────────────────────────────────────────────────────────

/** The Measurements steps, in the owner's order (27 Nov; do not reorder). */
export const GOWN_MEASUREMENT_STEPS = ['height', 'weight', 'shape', 'bust', 'waist', 'hips'] as const;
export const GOWN_FINE_TUNE_STEPS = ['bustPos', 'underbust', 'shoulders', 'arm', 'leg', 'heel', 'whatMatters'] as const;
export type GownMeasurementStep = (typeof GOWN_MEASUREMENT_STEPS)[number] | (typeof GOWN_FINE_TUNE_STEPS)[number];
export const GOWN_STEP_LABELS: Record<GownMeasurementStep, string> = {
  height: 'Height',
  weight: 'Weight',
  shape: 'Body shape',
  bust: 'Bust',
  waist: 'Waist',
  hips: 'Hips',
  bustPos: 'Bust position',
  underbust: 'Underbust',
  shoulders: 'Shoulders',
  arm: 'Arm length',
  leg: 'Leg length',
  heel: 'Elevation',
  whatMatters: 'What matters to her',
};

export const GOWN_BODY_SHAPES = [
  { id: 'hourglass', label: 'Hourglass' },
  { id: 'pear', label: 'Pear' },
  { id: 'apple', label: 'Apple' },
  { id: 'rectangle', label: 'Straight' },
  { id: 'inverted', label: 'Inverted triangle' },
] as const;
export type GownBodyShape = (typeof GOWN_BODY_SHAPES)[number]['id'];

export const GOWN_BUST_POSITIONS = [
  { id: 'high', label: 'Higher' },
  { id: 'avg', label: 'Average' },
  { id: 'low', label: 'Lower' },
  { id: 'custom', label: 'In between' },
] as const;
export type GownBustPosition = (typeof GOWN_BUST_POSITIONS)[number]['id'];

export const GOWN_MATTERS = [
  { id: 'arms', label: 'Arms covered' },
  { id: 'back', label: 'Back covered' },
  { id: 'support', label: 'More support' },
  { id: 'move', label: 'Comfortable to sit and dance' },
] as const;
export type GownMatter = (typeof GOWN_MATTERS)[number]['id'];

/** Her numbers. Girths and height in cm, weight in kg; `arm` and `leg` are shares of the default (v186 `vals`). */
export const GOWN_BODY_KEYS = ['height', 'weight', 'bust', 'waist', 'hips', 'underbust', 'shoulders', 'arm', 'leg'] as const;
export type GownBodyKey = (typeof GOWN_BODY_KEYS)[number];
export type GownBodyVals = Record<GownBodyKey, number>;

/** v186 `RANGE.female`: [min, max, start]. The start is the 155 cm default figure. */
export const GOWN_BODY_RANGE: Record<GownBodyKey, readonly [number, number, number]> = {
  height: [140, 224, 155],
  weight: [20, 250, 52],
  bust: [65, 160, 84],
  waist: [50, 150, 68],
  hips: [70, 170, 90],
  underbust: [37, 156, 72],
  shoulders: [29, 63, 38], // v189 (owner-approved design review): 24.5 % of 155 cm
  arm: [0.28 / 0.3, 0.37 / 0.3, 1],
  leg: [0.45 / 0.525, 0.6 / 0.525, 0.915],
};

export type GownBra = { eu: string; us: string; uk: string; exact: boolean };

export type GownBody = {
  v: typeof GOWN_CONFIG_VERSION;
  vals: GownBodyVals;
  shape: GownBodyShape;
  athletic: boolean;
  bustPos: GownBustPosition;
  /** −1 higher … 0 average … +1 lower (v171). */
  bustT: number;
  /** Which numbers she gave herself; every other number is the mannequin's estimate. */
  given: GownBodyKey[];
  matters: GownMatter[];
  /** Shown to her and the designer (v170); null when it cannot be read from her numbers. */
  bra: GownBra | null;
};

export function startingGownBody(): GownBody {
  const vals = Object.fromEntries(GOWN_BODY_KEYS.map((k) => [k, GOWN_BODY_RANGE[k][2]])) as GownBodyVals;
  return { v: GOWN_CONFIG_VERSION, vals, shape: 'hourglass', athletic: false, bustPos: 'avg', bustT: 0, given: [], matters: [], bra: null };
}

/**
 * The gown's own measurements (v186 `GMEAS`, women only): [key, label, how to measure]. Which are needed depends on
 * the design (`gownMeasuresNeeded`).
 */
export const GOWN_MEASURES = [
  { id: 'napeWaist', label: 'Nape to waist', howTo: 'Down the spine, from the bone at the base of the neck to the natural waist.' },
  { id: 'frontLen', label: 'Front length', howTo: 'From where the shoulder meets the neck, over the bust point, down to the natural waist.' },
  { id: 'waistHip', label: 'Waist to hip', howTo: 'Down the side, from the natural waist to the fullest part of the hips.' },
  { id: 'apexApex', label: 'Bust point to bust point', howTo: 'Straight across, from one bust point to the other, wearing the bra for the gown.' },
  { id: 'acrossBack', label: 'Across back', howTo: 'Straight across the back from one arm crease to the other, about a third of the way down from the nape bone to the underarm.' },
  { id: 'acrossChest', label: 'Across chest', howTo: 'Across the front from one arm crease to the other, about 7 cm below the hollow of the throat.' },
  { id: 'shoulderLen', label: 'Shoulder length', howTo: 'Along the top of the shoulder, from where it meets the neck to the shoulder tip.' },
  { id: 'sideLen', label: 'Side length', howTo: 'Down the side, from 2 cm below the armpit to the natural waist.' },
  { id: 'shoulderApex', label: 'Shoulder to bust point', howTo: 'From where the shoulder meets the neck, straight down to the bust point.' },
  { id: 'neck', label: 'Neck', howTo: 'Around the base of the neck, one finger under the tape.' },
  { id: 'upperArm', label: 'Upper arm', howTo: 'Around the fullest part of the upper arm, arm relaxed.' },
  { id: 'armhole', label: 'Armhole', howTo: 'Around the arm where it joins the body, over the top of the shoulder and under the arm.' },
  { id: 'elbow', label: 'Elbow', howTo: 'Around the elbow with the arm bent.' },
  { id: 'wrist', label: 'Wrist', howTo: 'Around the wrist bone.' },
  { id: 'armBent', label: 'Arm length, bent', howTo: 'From the shoulder tip, around the bent elbow, to the wrist bone, hand on the hip.' },
  { id: 'thigh', label: 'Thigh', howTo: 'Around the fullest part of the thigh.' },
  { id: 'knee', label: 'Knee', howTo: 'Around the knee, standing straight.' },
  { id: 'waistFloor', label: 'Waist to floor (in your wedding shoes)', howTo: 'From the natural waist straight down to the floor, wearing the shoes for the day.' },
  { id: 'hollowHem', label: 'Hollow to hem', howTo: 'From the hollow at the base of the throat straight down to where the hem should end, in the wedding shoes.' },
  { id: 'waistHem', label: 'Waist to hem', howTo: 'From the natural waist down to where the hem should end.' },
] as const;
export type GownMeasureKey = (typeof GOWN_MEASURES)[number]['id'];
/** A gown measurement is at most this many cm (a typo guard). */
export const GOWN_MEASURE_MAX_CM = 250;

/** v186 `GMEAS[i][2]`: the measurements this design needs, in the list's order. */
export function gownMeasuresNeeded(c: Pick<GownConfig, 'neck' | 'boning' | 'sleeve' | 'sil' | 'slits' | 'hem' | 'train'>): GownMeasureKey[] {
  const shaped = GOWN_STRAPLESS.includes(c.neck) || c.boning !== 'soft' || c.neck === 'v';
  const floor = c.hem === 'floor' || c.train !== 'none';
  const need: Record<GownMeasureKey, boolean> = {
    napeWaist: true,
    frontLen: true,
    waistHip: true,
    apexApex: shaped,
    acrossBack: true,
    acrossChest: true,
    shoulderLen: true,
    sideLen: true,
    shoulderApex: shaped,
    neck: c.neck === 'high',
    upperArm: c.sleeve !== 'none' || c.neck === 'off',
    armhole: c.sleeve !== 'none',
    elbow: c.sleeve === 'long',
    wrist: c.sleeve === 'long',
    armBent: c.sleeve === 'long',
    thigh: c.sil === 'mermaid' || c.sil === 'sheath' || c.slits.length > 0,
    knee: c.sil === 'mermaid',
    waistFloor: floor,
    hollowHem: floor,
    waistHem: c.hem !== 'floor',
  };
  return ids(GOWN_MEASURES).filter((k) => need[k]);
}

/** Where a measurement came from: her tape (typed) or the mannequin's estimate. The designer's tape is `gown_fittings`. */
export type GownMeasureSource = 'typed' | 'estimate';
export type GownMeasure = { cm: number; from: GownMeasureSource };
export type GownMeasures = Partial<Record<GownMeasureKey, GownMeasure>>;

// ─────────────────────────────────────────────────────────────────────────────
// What the design needs — quantities only, never money
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computed by the engine on the bride's device (v186 `quoteLines`, the quantity half), checked by the server, priced by
 * the shop's own list on the server. Keys match the prototype's price items so the server maps each to one line.
 * Metres are metres of 150 cm fabric; counts are pieces. A zero means "not needed".
 */
export type GownQuantities = {
  v: typeof GOWN_CONFIG_VERSION;
  materials: {
    /** The outer fabric (`fabric` / `fabricRef`), with matching and waste (v186 `fabricMetres`). */
    outerM: number;
    /** The accent fabric for the sleeves, when it is not the outer. */
    accentM: number;
    liningM: number;
    /** Tulle for the layers under the skirt (soft and full tulle, and the net over a hoop). */
    netM: number;
    /** Organza and chiffon layers under the skirt (v192: each layer its own material). */
    organzaM: number;
    chiffonM: number;
    /** Chiffon for flutter sleeves made in sheer chiffon (v195). Flutter sleeves in the gown fabric are in `outerM`; in the accent, `accentM`. */
    sleeveChiffonM: number;
    /** The overlay's own fabric (`ovFab`), when it is not the gown's (v195). An overlay in the gown fabric is in `outerM`. */
    overlayM: number;
    /** The veil's own tulle, apart from the petticoat's, so a priced veil add-on is never counted twice. */
    veilM: number;
    illusionM: number;
    boningM: number;
    /** Lace by the yard (tiled lace and sheer lace sleeves). */
    laceYardM: number;
    laceMotifs: number;
    horsehairM: number;
    cordM: number;
    pipingM: number;
    fringeM: number;
    featherM: number;
    /** Outer fabric for ruffles (already folded and gathered). A cape is in `outerM` (cut from the same fabric). */
    ruffleM: number;
    zippers: number;
    buttons: number;
    eyelets: number;
    waistStays: number;
    hoops: number;
    beads: Record<GownBeadKind, number>;
  };
  /** What drives the workshop hours; the shop's own hour standards turn these into hours on the server. */
  labour: {
    sleeve: GownSleeve;
    beads: number;
    laceMotifs: number;
    laceYardM: number;
    pleats: number;
    tex: GownTexture;
    darts: boolean;
    cutouts: number;
    slits: number;
    train: GownTrain;
    veil: GownVeil;
    trimM: number;
    twoPiece: boolean;
    /** The cape to cut, sew and finish (its fabric is in `outerM`). */
    cape: GownCape;
    /** Flutter sleeves to cut, sew and finish, in pairs (v195). */
    flutter: number;
    /** The overlay to cut, sew and finish, in pieces (v195). */
    overlay: number;
  };
};

export const GOWN_MATERIAL_KEYS = [
  'outerM', 'accentM', 'liningM', 'netM', 'organzaM', 'chiffonM', 'sleeveChiffonM', 'overlayM', 'veilM', 'illusionM', 'boningM', 'laceYardM', 'laceMotifs', 'horsehairM', 'cordM', 'pipingM', 'fringeM',
  'featherM', 'ruffleM', 'zippers', 'buttons', 'eyelets', 'waistStays', 'hoops',
] as const satisfies readonly Exclude<keyof GownQuantities['materials'], 'beads'>[];
type GownMaterialKey = (typeof GOWN_MATERIAL_KEYS)[number];
/** Typo guards only (a quantity past these is not a gown): metres, pieces. Nothing here prices anything. */
export const GOWN_QUANTITY_MAX = { metres: 200, pieces: 5000, beads: 200000 } as const;
const COUNT_KEYS: ReadonlySet<GownMaterialKey> = new Set(['laceMotifs', 'zippers', 'buttons', 'eyelets', 'waistStays', 'hoops']);

export function emptyGownQuantities(): GownQuantities {
  const materials = Object.fromEntries(GOWN_MATERIAL_KEYS.map((k) => [k, 0])) as Record<GownMaterialKey, number>;
  const beads = Object.fromEntries(GOWN_BEAD_KINDS.map((k) => [k, 0])) as Record<GownBeadKind, number>;
  return {
    v: GOWN_CONFIG_VERSION,
    materials: { ...materials, beads },
    labour: { sleeve: 'none', beads: 0, laceMotifs: 0, laceYardM: 0, pleats: 0, tex: 'none', darts: false, cutouts: 0, slits: 0, train: 'none', veil: 'none', trimM: 0, twoPiece: false, cape: 'none', flutter: 0, overlay: 0 },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The server's checks — refuse, never repair
// ─────────────────────────────────────────────────────────────────────────────

export type GownRefusal =
  | 'too_big'
  | 'not_a_design'
  | 'not_offered'
  | 'out_of_range'
  | 'cut_forbidden'
  | 'colours'
  | 'text'
  | 'body_range'
  | 'bust_over_underbust'
  | 'weight_for_height'
  | 'measures'
  | 'quantities';

export const GOWN_REFUSAL_WORDS: Record<GownRefusal, string> = {
  too_big: 'This design is too large to send.',
  not_a_design: 'This design could not be read.',
  not_offered: 'Something in this design is no longer offered. Pick again.',
  out_of_range: 'A setting in this design is out of range.',
  cut_forbidden: 'A cut-out in this design is not allowed. Remove it and send again.',
  colours: 'A colour in this design could not be read. Pick it again.',
  text: 'Your special requests are too long.',
  body_range: 'A measurement is outside what the mannequin can show. Check it and try again.',
  bust_over_underbust: `The bust can be at most ${GOWN_CUP_MAX_CM} cm more than the underbust. Set the underbust first.`,
  weight_for_height: 'This weight does not fit this height. Check both and try again.',
  measures: 'A gown measurement could not be read. Check it and try again.',
  quantities: 'What this design needs could not be worked out. Try again.',
};

type Result<T> = { ok: true; value: T } | { ok: false; reason: GownRefusal };
const no = (reason: GownRefusal) => ({ ok: false, reason }) as const;
const HEX = /^#[0-9a-f]{6}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sizeOk(input: unknown, max: number): 'ok' | 'too_big' | 'not_a_design' {
  try {
    return JSON.stringify(input ?? null).length > max ? 'too_big' : 'ok';
  } catch {
    return 'not_a_design';
  }
}
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** On the slider's own steps, within its range (a little float slack). */
function onRange(v: unknown, k: GownRangeKey): v is number {
  const [lo, hi, step] = GOWN_RANGES[k];
  if (!finite(v) || v < lo - 1e-9 || v > hi + 1e-9) return false;
  const n = (v - lo) / step;
  return Math.abs(n - Math.round(n)) < 1e-6;
}
function hexOrNull(v: unknown): string | null | undefined {
  if (v == null) return null;
  return typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : undefined;
}
function refOrNull(v: unknown): string | null | undefined {
  if (v == null) return null;
  return typeof v === 'string' && UUID.test(v) ? v.toLowerCase() : undefined;
}
/** A set of catalog ids, no repeats. */
function idSet<T extends string>(v: unknown, all: readonly T[], max: number): T[] | null {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > max) return null;
  const out: T[] = [];
  for (const x of v) {
    if (!isOneOf(x, all) || out.includes(x)) return null;
    out.push(x);
  }
  return out;
}

function sanitizeMix(v: unknown): GownBeadMix[] | null {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > GOWN_BEAD_MIX_MAX) return null;
  const out: GownBeadMix[] = [];
  for (const m of v) {
    if (!isRecord(m) || typeof m.hex !== 'string' || !HEX.test(m.hex) || !onRange(m.pct, 'mixPct')) return null;
    out.push({ hex: m.hex.toUpperCase(), pct: m.pct });
  }
  return out;
}

function sanitizeBeadLayer(r: Record<string, unknown>, base: GownBeadLayer): Result<GownBeadLayer> {
  const pick = <T extends string>(v: unknown, all: readonly T[], fallback: T): T | null => {
    const x = v ?? fallback;
    return isOneOf(x, all) ? x : null;
  };
  const bead = pick(r.bead, ids(GOWN_BEADS), base.bead);
  const beadAt = pick(r.beadAt, ids(GOWN_BEAD_PLACES), base.beadAt);
  const beadDen = pick(r.beadDen, ids(GOWN_BEAD_DENSITIES), base.beadDen);
  const beadCol = pick(r.beadCol, ids(GOWN_BEAD_COLOURS), base.beadCol);
  if (!bead || !beadAt || !beadDen || !beadCol) return no('not_a_design');
  const beadMm = r.beadMm ?? base.beadMm;
  if (!onRange(beadMm, 'beadMm')) return no('out_of_range');
  const hex = hexOrNull(r.beadHex);
  if (hex === undefined) return no('colours');
  if (beadCol === 'custom' && !hex) return no('colours');
  const mix = sanitizeMix(r.mix);
  if (!mix) return no('colours');
  return { ok: true, value: { bead, beadAt, beadDen, beadCol, beadMm, beadHex: beadCol === 'custom' ? hex : null, mix } };
}

/**
 * The server's check of a design. Refuses (never repairs) anything not in the catalogs, a slider off its range or steps,
 * a fabric, lace or look the shop does not offer, a forbidden cut-out, a colour that is not a hex, or long notes.
 * A missing key takes the starting value (an older design stays readable as the catalog grows).
 */
export function sanitizeGownConfig(input: unknown, offer: GownOffer): { ok: true; config: GownConfig } | { ok: false; reason: GownRefusal } {
  const size = sizeOk(input, GOWN_CONFIG_MAX_BYTES);
  if (size !== 'ok') return no(size);
  if (!isRecord(input)) return no('not_a_design');
  const r = input;
  if (!versionOk(r.v)) return no('not_a_design');
  const s = startingGownConfig();

  const pick = <T extends string>(k: keyof GownConfig, all: readonly T[]): T | null => {
    const x = r[k] ?? s[k];
    return isOneOf(x, all) ? x : null;
  };
  const picks = {
    sil: isOneOf(gownMigrateSilhouette(r.sil ?? s.sil, r.v), ids(GOWN_SILHOUETTES)) ? (gownMigrateSilhouette(r.sil ?? s.sil, r.v) as GownSilhouette) : null,
    pieces: pick('pieces', ids(GOWN_PIECES)),
    waist: pick('waist', ids(GOWN_WAISTLINES)),
    neck: pick('neck', ids(GOWN_NECKLINES)),
    back: pick('back', ids(GOWN_BACKS)),
    sleeve: pick('sleeve', ids(GOWN_SLEEVES)),
    sleeveFab: pick('sleeveFab', ids(GOWN_SLEEVE_FABRICS)),
    closure: pick('closure', ids(GOWN_CLOSURES)),
    train: pick('train', ids(GOWN_TRAINS)),
    veil: pick('veil', ids(GOWN_VEILS)),
    veilStyle: pick('veilStyle', ids(GOWN_VEIL_STYLES)),
    blusher: pick('blusher', ids(GOWN_BLUSHERS)),
    bow: pick('bow', ids(GOWN_BOWS)),
    hem: pick('hem', ids(GOWN_HEMS)),
    colour: pick('colour', ids(GOWN_COLOURS)),
    lace: pick('lace', ids(GOWN_LACES)),
    laceAt: pick('laceAt', ids(GOWN_LACE_PLACES)),
    laceBeads: pick('laceBeads', ids(GOWN_LACE_BEADS)),
    laceCol: pick('laceCol', ids(GOWN_LACE_COLOURS)),
    pleat: pick('pleat', ids(GOWN_PLEATS)),
    tex: pick('tex', ids(GOWN_TEXTURES)),
    texAt: pick('texAt', ids(GOWN_TEXTURE_PLACES)),
    texDir: pick('texDir', ids(GOWN_TEXTURE_DIRECTIONS)),
    darts: pick('darts', ids(GOWN_DARTS)),
    drape: pick('drape', ids(GOWN_DRAPES)),
    bustle: pick('bustle', ids(GOWN_BUSTLES)),
    petti: pick('petti', ids(GOWN_PETTICOATS)),
    shape: pick('shape', ids(GOWN_SHAPEWEAR)),
    boning: pick('boning', ids(GOWN_BONING)),
    lining: pick('lining', ids(GOWN_LININGS)),
    liningCol: pick('liningCol', ids(GOWN_LAYER_COLOURS)),
    cape: pick('cape', ids(GOWN_CAPES)),
    overlay: pick('overlay', ids(GOWN_OVERLAYS)),
    ovFab: pick('ovFab', ids(GOWN_OVERLAY_FABRICS)),
    cutEdge: pick('cutEdge', ids(GOWN_CUT_EDGES)),
    cutFill: pick('cutFill', ids(GOWN_CUT_FILLS)),
    trimCol: pick('trimCol', ids(GOWN_TRIM_COLOURS)),
  };
  for (const v of Object.values(picks)) if (v === null) return no('not_a_design');
  const p = picks as { [K in keyof typeof picks]: NonNullable<(typeof picks)[K]> };
  // A design saved before version 2 opens as v197 opens an order (through its pairing rules): a sheath or mermaid's long
  // train becomes a sweep and its full petticoat or hoop soft tulle, a sheath loses its pleats, a strapless bodice its
  // cap sleeves and cowl. What is stored is then a version 2 design, which the refusals below hold.
  if (typeof r.v === 'number' && r.v < 2) {
    const bare = GOWN_STRAPLESS.includes(p.neck), close = p.sil === 'sheath' || p.sil === 'mermaid';
    if (close && (p.train === 'chapel' || p.train === 'cathedral')) p.train = 'sweep';
    if (close && (p.petti === 'full' || p.petti === 'hoop')) p.petti = 'soft';
    if (p.sil === 'sheath') p.pleat = 'none';
    if (bare && p.neck !== 'off' && p.sleeve === 'cap') p.sleeve = 'none';
    if (bare && p.drape === 'cowl') p.drape = 'none';
  }

  // Sliders: on their own range and steps. neckT may be null (the neckline's own depth).
  const num = (k: keyof GownConfig, range: GownRangeKey): number | null => {
    const x = r[k] ?? s[k];
    return onRange(x, range) ? x : null;
  };
  const nums = {
    backT: num('backT', 'backT'),
    hemCm: num('hemCm', 'hemCm'),
    heel: num('heel', 'heelCm'),
    laceCm: num('laceCm', 'laceCm'),
    pleatN: num('pleatN', 'pleatN'),
    pleatCm: num('pleatCm', 'pleatCm'),
    texSp: num('texSp', 'texSp'),
    skirtLayers: num('skirtLayers', 'skirtLayers'),
    slitCm: num('slitCm', 'slitCm'),
    cutScale: num('cutScale', 'cutScale'),
  };
  for (const v of Object.values(nums)) if (v === null) return no('out_of_range');
  const n = nums as { [K in keyof typeof nums]: number };
  const neckT = r.neckT ?? null;
  if (neckT !== null && !onRange(neckT, 'neckT')) return no('out_of_range');

  // Inside: each layer's material and colour. Given layers must make the petticoat the design names; a design without
  // them (older, or a look) takes the layers its petticoat implies.
  const layerList = <T extends string>(k: 'layerTypes' | 'layerCols', all: readonly T[], fill: T): T[] | null => {
    const x = r[k];
    if (x == null) return Array<T>(GOWN_MAX_LAYERS).fill(fill);
    return Array.isArray(x) && x.length === GOWN_MAX_LAYERS && x.every((v) => isOneOf(v, all)) ? (x as T[]) : null;
  };
  const layerTypes = layerList('layerTypes', ids(GOWN_LAYER_TYPES), 'soft'), layerCols = layerList('layerCols', ids(GOWN_LAYER_COLOURS), 'match');
  if (!layerTypes || !layerCols || layerTypes.slice(1).includes('hoop')) return no('not_a_design');
  const worn = gownLayerCount({ petti: p.petti, skirtLayers: n.skirtLayers });
  if (r.layerTypes != null && gownPettiOf(worn, layerTypes) !== p.petti) return no('not_a_design');
  const inside = { layerTypes: r.layerTypes != null ? layerTypes : gownSyncLayers(p.petti, worn, layerTypes), layerCols };
  // Pairings that cannot be made (v193 `setGown`): the server refuses what the maker would have changed.
  if (p.cape !== 'none' && p.sleeve === 'butterfly') return no('not_a_design');
  if (p.cape === 'back' && (p.veil === 'floor' || p.veil === 'chapel' || p.veil === 'cathedral')) return no('not_a_design');
  // v195: flutter sleeves hang from the shoulder line (never a sweetheart), and a side cape or capelet would lie over them.
  if (p.sleeve === 'flutter' && (p.neck === 'sweetheart' || p.cape === 'side' || p.cape === 'capelet')) return no('not_a_design');
  // v195: over a ball gown an overlay sits as soft tiers only.
  if (p.sil === 'ball' && (p.overlay === 'asym' || p.overlay === 'cascade')) return no('not_a_design');
  // Accuracy review (v197): a strapless bodice has no shoulder for a cap sleeve or a cowl; a sheath or mermaid carries a
  // sweep train at most and no full petticoat or hoop; a sheath takes no pleats. (A strapless back's bra-line limit
  // depends on her body, so the maker holds it.)
  const strapless = GOWN_STRAPLESS.includes(p.neck), close = p.sil === 'sheath' || p.sil === 'mermaid';
  if (strapless && ((p.neck !== 'off' && p.sleeve === 'cap') || p.drape === 'cowl')) return no('not_a_design');
  if (close && (p.train === 'chapel' || p.train === 'cathedral' || p.petti === 'full' || p.petti === 'hoop')) return no('not_a_design');
  if (p.sil === 'sheath' && p.pleat !== 'none') return no('not_a_design');

  const bools = { waistStay: r.waistStay ?? false, horsehair: r.horsehair ?? false, modesty: r.modesty ?? false };
  for (const v of Object.values(bools)) if (typeof v !== 'boolean') return no('not_a_design');
  const b = bools as Record<keyof typeof bools, boolean>;

  // Fabric, lace and look: the shop's own rows only; a fabric type the shop works in.
  const fabricType = (v: unknown): string | null => (typeof v === 'string' && GOWN_FABRIC_TYPE_ID.test(v) ? v : null);
  const fabric = fabricType(r.fabric ?? s.fabric);
  if (!fabric) return no('not_a_design');
  if (!offer.fabricTypes.includes(fabric)) return no('not_offered');
  const accentFabric = r.accentFabric == null ? null : fabricType(r.accentFabric);
  if (r.accentFabric != null && !accentFabric) return no('not_a_design');
  if (accentFabric && !offer.fabricTypes.includes(accentFabric)) return no('not_offered');
  const refs = {
    fabricRef: refOrNull(r.fabricRef),
    accentFabricRef: refOrNull(r.accentFabricRef),
    laceRef: refOrNull(r.laceRef),
    lookRef: refOrNull(r.lookRef),
  };
  if (refs.fabricRef === undefined || refs.accentFabricRef === undefined || refs.laceRef === undefined || refs.lookRef === undefined) return no('not_a_design');
  const ref = refs as { [K in keyof typeof refs]: string | null };
  if (ref.fabricRef && !offer.fabricRefs.includes(ref.fabricRef)) return no('not_offered');
  if (ref.accentFabricRef && !offer.fabricRefs.includes(ref.accentFabricRef)) return no('not_offered');
  if (ref.laceRef && !offer.laceRefs.includes(ref.laceRef)) return no('not_offered');
  if (ref.lookRef && !offer.lookRefs.includes(ref.lookRef)) return no('not_offered');

  // Colours.
  const colourHex = hexOrNull(r.colourHex);
  const accentHex = hexOrNull(r.accentHex);
  const trimHex = hexOrNull(r.trimHex);
  if (colourHex === undefined || accentHex === undefined || trimHex === undefined) return no('colours');
  if (p.colour === 'custom' && !colourHex) return no('colours');
  if (p.trimCol === 'custom' && !trimHex) return no('colours');
  const palette = idSet(r.palette, ids(GOWN_COLOUR_FAMILIES), GOWN_PALETTE_MAX);
  if (!palette) return no('colours');

  // Beads: the first layer is flat on the design; any extra layers follow.
  const first = sanitizeBeadLayer(r, { bead: s.bead, beadAt: s.beadAt, beadDen: s.beadDen, beadCol: s.beadCol, beadMm: s.beadMm, beadHex: null, mix: [] });
  if (!first.ok) return first;
  const layers: GownBeadLayer[] = [];
  if (r.beadLayers != null) {
    if (!Array.isArray(r.beadLayers) || r.beadLayers.length > GOWN_BEAD_LAYERS_MAX) return no('not_a_design');
    for (const l of r.beadLayers) {
      if (!isRecord(l)) return no('not_a_design');
      const got = sanitizeBeadLayer(l, first.value);
      if (!got.ok) return got;
      layers.push(got.value);
    }
  }

  // Many-of sets, and the cut-outs that are never allowed.
  const slits = idSet(r.slits, ids(GOWN_SLITS), GOWN_SLITS.length);
  const cuts = idSet(r.cuts, ids(GOWN_CUTOUTS), GOWN_CUTOUTS.length);
  const trims = idSet(r.trims, ids(GOWN_TRIMS), GOWN_TRIMS.length);
  if (!slits || !cuts || !trims) return no('not_a_design');
  if (cuts.some((c) => GOWN_CUT_FORBIDDEN[c])) return no('cut_forbidden');

  const text = (v: unknown, max: number): string | null => {
    if (v == null) return '';
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t.length > max ? null : t;
  };
  const notes = text(r.notes, GOWN_NOTES_MAX);
  const lookName = text(r.lookName, GOWN_LOOK_NAME_MAX);
  if (notes === null || lookName === null) return no('text');

  const l = first.value;
  return {
    ok: true,
    config: {
      v: GOWN_CONFIG_VERSION,
      lookName,
      lookRef: ref.lookRef,
      sil: p.sil,
      pieces: p.pieces,
      waist: p.waist,
      neck: p.neck,
      neckT: neckT as number | null,
      back: p.back,
      backT: n.backT,
      sleeve: p.sleeve,
      sleeveFab: p.sleeveFab,
      closure: p.closure,
      train: p.train,
      veil: p.veil,
      veilStyle: p.veilStyle,
      blusher: p.blusher,
      bow: p.bow,
      hem: p.hem,
      hemCm: n.hemCm,
      heel: n.heel,
      fabric,
      fabricRef: ref.fabricRef,
      colour: p.colour,
      colourHex: p.colour === 'custom' ? colourHex : null,
      accentFabric,
      accentFabricRef: ref.accentFabricRef,
      accentHex,
      palette,
      lace: p.lace,
      laceRef: ref.laceRef,
      laceAt: p.laceAt,
      laceBeads: p.laceBeads,
      laceCol: p.laceCol,
      laceCm: n.laceCm,
      bead: l.bead,
      beadAt: l.beadAt,
      beadDen: l.beadDen,
      beadCol: l.beadCol,
      beadMm: l.beadMm,
      beadHex: l.beadHex,
      mix: l.mix,
      beadLayers: layers,
      pleat: p.pleat,
      pleatN: n.pleatN,
      pleatCm: n.pleatCm,
      tex: p.tex,
      texAt: p.texAt,
      texDir: p.texDir,
      texSp: n.texSp,
      darts: p.darts,
      drape: p.drape,
      bustle: p.bustle,
      petti: p.petti,
      skirtLayers: n.skirtLayers,
      layerTypes: inside.layerTypes,
      layerCols: inside.layerCols,
      shape: p.shape,
      boning: p.boning,
      lining: p.lining,
      liningCol: p.liningCol,
      cape: p.cape,
      overlay: p.overlay,
      ovFab: p.ovFab,
      waistStay: b.waistStay,
      horsehair: b.horsehair,
      modesty: b.modesty,
      slits,
      slitCm: n.slitCm,
      cuts,
      cutScale: n.cutScale,
      cutEdge: p.cutEdge,
      cutFill: p.cutFill,
      trims,
      trimCol: p.trimCol,
      trimHex: p.trimCol === 'custom' ? trimHex : null,
      notes,
    },
  };
}

const BRA_SIZE = /^\d{2,3}[A-K]{1,3}$/;

/**
 * The server's check of her body. Every number within the mannequin's range (v186 `RANGE.female`), her weight within
 * BMI 10–62 for her height, and her bust at most 28 cm over her underbust (v185: the ribs never grow for the bust).
 */
export function sanitizeGownBody(input: unknown): { ok: true; body: GownBody } | { ok: false; reason: GownRefusal } {
  const size = sizeOk(input, GOWN_BODY_MAX_BYTES);
  if (size !== 'ok') return no(size);
  if (!isRecord(input) || !isRecord(input.vals)) return no('not_a_design');
  const r = input;
  const rv = input.vals;
  if (!versionOk(r.v)) return no('not_a_design');
  const vals = {} as GownBodyVals;
  for (const k of GOWN_BODY_KEYS) {
    const x = rv[k];
    const [lo, hi] = GOWN_BODY_RANGE[k];
    if (!finite(x)) return no('not_a_design');
    if (x < lo - 1e-9 || x > hi + 1e-9) return no('body_range');
    vals[k] = x;
  }
  const bmi = vals.weight / (vals.height / 100) ** 2;
  if (bmi < GOWN_BMI_MIN - 1e-9 || bmi > GOWN_BMI_MAX + 1e-9) return no('weight_for_height');
  if (vals.bust < vals.underbust) return no('body_range');
  if (vals.bust - vals.underbust > GOWN_CUP_MAX_CM + 1e-9) return no('bust_over_underbust');

  const shape = r.shape ?? 'hourglass';
  const bustPos = r.bustPos ?? 'avg';
  if (!isOneOf(shape, ids(GOWN_BODY_SHAPES)) || !isOneOf(bustPos, ids(GOWN_BUST_POSITIONS))) return no('not_a_design');
  const athletic = r.athletic ?? false;
  if (typeof athletic !== 'boolean') return no('not_a_design');
  const bustT = r.bustT ?? 0;
  if (!finite(bustT) || bustT < -1 || bustT > 1) return no('body_range');
  const given = idSet(r.given, GOWN_BODY_KEYS, GOWN_BODY_KEYS.length);
  const matters = idSet(r.matters, ids(GOWN_MATTERS), GOWN_MATTERS.length);
  if (!given || !matters) return no('not_a_design');

  let bra: GownBra | null = null;
  if (r.bra != null) {
    const z = r.bra;
    if (!isRecord(z) || typeof z.exact !== 'boolean') return no('not_a_design');
    for (const k of ['eu', 'us', 'uk'] as const) if (typeof z[k] !== 'string' || !BRA_SIZE.test(z[k] as string)) return no('not_a_design');
    bra = { eu: z.eu as string, us: z.us as string, uk: z.uk as string, exact: z.exact };
  }
  return { ok: true, body: { v: GOWN_CONFIG_VERSION, vals, shape, athletic, bustPos, bustT, given, matters, bra } };
}

/** The server's check of the gown's own measurements: known keys only, each a positive cm tagged typed or estimate. */
export function sanitizeGownMeasures(input: unknown): { ok: true; measures: GownMeasures } | { ok: false; reason: GownRefusal } {
  const size = sizeOk(input, GOWN_MEASURES_MAX_BYTES);
  if (size !== 'ok') return no(size);
  if (!isRecord(input)) return no('measures');
  const all = ids(GOWN_MEASURES);
  const out: GownMeasures = {};
  for (const [k, m] of Object.entries(input)) {
    if (!isOneOf(k, all) || !isRecord(m)) return no('measures');
    if (!finite(m.cm) || m.cm <= 0 || m.cm > GOWN_MEASURE_MAX_CM) return no('measures');
    if (m.from !== 'typed' && m.from !== 'estimate') return no('measures');
    out[k] = { cm: m.cm, from: m.from };
  }
  return { ok: true, measures: out };
}

/**
 * The server's check of what a design needs. Every quantity a finite number ≥ 0 within its typo guard; counts are whole.
 * Refuses any key it does not know, so a price or a cost line can never ride along to be stored.
 */
export function sanitizeGownQuantities(input: unknown): { ok: true; quantities: GownQuantities } | { ok: false; reason: GownRefusal } {
  const size = sizeOk(input, GOWN_QUANTITIES_MAX_BYTES);
  if (size !== 'ok') return no(size);
  if (!isRecord(input) || !isRecord(input.materials) || !isRecord(input.labour)) return no('quantities');
  if (!versionOk(input.v)) return no('quantities');
  const known = (o: Record<string, unknown>, keys: readonly string[]) => Object.keys(o).every((k) => keys.includes(k));
  if (!known(input, ['v', 'materials', 'labour'])) return no('quantities');
  const qty = (v: unknown, count: boolean, max: number): number | null =>
    finite(v) && v >= 0 && v <= max && (!count || Number.isInteger(v)) ? v : null;

  const m = input.materials;
  if (!known(m, [...GOWN_MATERIAL_KEYS, 'beads']) || !isRecord(m.beads) || !known(m.beads, GOWN_BEAD_KINDS)) return no('quantities');
  const q = emptyGownQuantities();
  for (const k of GOWN_MATERIAL_KEYS) {
    const count = COUNT_KEYS.has(k);
    const x = qty(m[k] ?? 0, count, count ? GOWN_QUANTITY_MAX.pieces : GOWN_QUANTITY_MAX.metres);
    if (x === null) return no('quantities');
    q.materials[k] = x;
  }
  for (const k of GOWN_BEAD_KINDS) {
    const x = qty(m.beads[k] ?? 0, true, GOWN_QUANTITY_MAX.beads);
    if (x === null) return no('quantities');
    q.materials.beads[k] = x;
  }

  const L = input.labour;
  const keys = Object.keys(q.labour);
  if (!known(L, keys)) return no('quantities');
  const sleeve = L.sleeve ?? 'none';
  const tex = L.tex ?? 'none';
  const train = L.train ?? 'none';
  const veil = L.veil ?? 'none';
  const cape = L.cape ?? 'none';
  if (!isOneOf(cape, ids(GOWN_CAPES))) return no('quantities');
  const flutter = qty(L.flutter ?? 0, true, 1);
  const overlay = qty(L.overlay ?? 0, true, 1);
  if (flutter === null || overlay === null) return no('quantities');
  if (!isOneOf(sleeve, ids(GOWN_SLEEVES)) || !isOneOf(tex, ids(GOWN_TEXTURES)) || !isOneOf(train, ids(GOWN_TRAINS)) || !isOneOf(veil, ids(GOWN_VEILS))) {
    return no('quantities');
  }
  const darts = L.darts ?? false;
  const twoPiece = L.twoPiece ?? false;
  if (typeof darts !== 'boolean' || typeof twoPiece !== 'boolean') return no('quantities');
  const beads = qty(L.beads ?? 0, true, GOWN_QUANTITY_MAX.beads);
  const laceMotifs = qty(L.laceMotifs ?? 0, true, GOWN_QUANTITY_MAX.pieces);
  const laceYardM = qty(L.laceYardM ?? 0, false, GOWN_QUANTITY_MAX.metres);
  const pleats = qty(L.pleats ?? 0, true, GOWN_QUANTITY_MAX.pieces);
  const cutouts = qty(L.cutouts ?? 0, true, GOWN_QUANTITY_MAX.pieces);
  const slits = qty(L.slits ?? 0, true, GOWN_SLITS.length);
  const trimM = qty(L.trimM ?? 0, false, GOWN_QUANTITY_MAX.metres);
  if (beads === null || laceMotifs === null || laceYardM === null || pleats === null || cutouts === null || slits === null || trimM === null) {
    return no('quantities');
  }
  q.labour = { sleeve, beads, laceMotifs, laceYardM, pleats, tex, darts, cutouts, slits, train, veil, trimM, twoPiece, cape, flutter, overlay };
  return { ok: true, quantities: q };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading a v186 order (the prototype's `orderData`) — for the port's round-trip proof and the lab's seed
// ─────────────────────────────────────────────────────────────────────────────

/** The v186 `orderData()` fields this contract reads (women only). */
export type GownPrototypeOrder = {
  notes?: string;
  look?: string;
  design3d: { v?: number; gown: Partial<Record<GownLookKey, string>>; col?: string | null; colHex?: string | null; hem?: string; heel?: number };
  vals: Partial<Record<GownBodyKey, number>>;
  fine: { bustT?: number; bustPos?: string; athletic?: boolean; given?: string[] };
  matters?: string[];
  body?: { bra?: GownBra | null };
  gownMeas?: Partial<Record<string, number>>;
  gownMeasEst?: Partial<Record<string, number | null>>;
};

/**
 * A v186 order → this contract, through the same checks the server runs. Typed measurements win over estimates (the
 * prototype keeps both; an estimate is sent only for what she did not type).
 */
export function gownFromPrototypeOrder(
  order: GownPrototypeOrder,
  offer: GownOffer,
): { ok: true; config: GownConfig; body: GownBody; measures: GownMeasures } | { ok: false; reason: GownRefusal } {
  const d = order.design3d;
  const custom = d.colHex && !d.col ? 'custom' : d.col;
  const config = sanitizeGownConfig(
    {
      ...d.gown,
      // A prototype order from before v197 (no design version) made its A-line the old way: it opens as Fit and flare.
      v: d.v ?? 1,
      lookName: order.look ?? '',
      hem: d.hem,
      heel: d.heel,
      colour: custom ?? undefined,
      colourHex: custom === 'custom' ? d.colHex : null,
      notes: order.notes ?? '',
    },
    offer,
  );
  if (!config.ok) return config;
  const body = sanitizeGownBody({
    vals: order.vals,
    athletic: order.fine.athletic,
    bustPos: order.fine.bustPos,
    bustT: order.fine.bustT,
    given: order.fine.given,
    matters: order.matters,
    bra: order.body?.bra ?? null,
  });
  if (!body.ok) return body;
  const raw: Record<string, GownMeasure> = {};
  for (const [k, v] of Object.entries(order.gownMeasEst ?? {})) if (finite(v) && v > 0) raw[k] = { cm: v, from: 'estimate' };
  for (const [k, v] of Object.entries(order.gownMeas ?? {})) if (finite(v) && v > 0) raw[k] = { cm: v, from: 'typed' };
  const measures = sanitizeGownMeasures(raw);
  if (!measures.ok) return measures;
  return { ok: true, config: config.config, body: body.body, measures: measures.measures };
}

/** Every stock fabric type, nothing else: the lab and a fresh offer read it. */
export function stockGownOffer(): GownOffer {
  return { fabricTypes: ids(GOWN_STOCK_FABRICS), fabricRefs: [], laceRefs: [], lookRefs: [] };
}
