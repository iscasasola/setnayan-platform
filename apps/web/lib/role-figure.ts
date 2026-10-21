/**
 * lib/role-figure.ts — THE ILLUSTRATED PERSON, IN A ROLE'S EXACT COLOURS.
 *
 * Owner 2026-09-27 (DECISION_LOG "OWNER: 'YES TO ALL' — PALETTE, DAY-OF
 * SCHEDULE…", item 1): the dress-code scene shows the palette three ways —
 * swatches · an ILLUSTRATED person in the exact role colours (*"not AI — exact
 * colour, free"*) · mood board photos. This file is the second.
 *
 * ♻ NOT A NEW DRAWING SYSTEM. The gown and suit figures are the reception
 * scene's own people (`lib/reception-scene.ts` draws the couple, the party and
 * the guests with them), moved here verbatim so both surfaces draw ONE figure.
 * The scene imports them back and renders byte-for-byte as before. The one
 * addition is an optional ACCENT (the Mood Board's "color 1 is the main piece,
 * the rest accents", `PALETTE_LIMITS[*].meaning === 'outfit'`): a sash on the
 * gown, the tie on the suit. With no accent the markup is exactly the old one.
 *
 * EXACT COLOUR. Every fill is the role's hex as stored — no tint, no blend, no
 * photo recolour (the Mood Board's `RecolorStudio` keeps a photo's lightness,
 * so a navy gown comes out light blue; this does not).
 *
 * Pure strings, no DOM, no React: the Event Hub's server-rendered dress-code
 * scene and the Mood Board's client palette both call it.
 *
 * 👗 2026-10-14 (owner, DECISION_LOG "EFFECTS + ATTIRE DESIGN APPROVED"): the PERSON a role's palette wears is now
 * the illustrated figure (`lib/attire-figures.ts` — the artwork seam), in the garment its Wear ▾ names, ONE drawing
 * for the Studio's Attire and the guest's dress code (`roleFigurePeople` → `app/_components/role-figure.tsx`). The little gown and
 * suit below stay what the reception scene draws its crowd with.
 */

import { FIGURE_ART, controlOfZone, designOfArt, garmentFor, roleOfArt, tieZoneColours, wearsColourOnTie, zonesOf, type FigureGarment, type FigureWho, type ZoneKey } from './attire-figures';
import { GUEST_OPTIONS_MAX, designLabel, roleArtKey, type FigureRole } from './attire-designs';
import type { AttireStyle } from './role-dress-code';

export const SKIN = '#E7C8A2';
export const HAIR = '#352720';

const HEX = /^#[0-9a-fA-F]{6}$/;

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt)));
  g = Math.max(0, Math.min(255, Math.round(g + amt)));
  b = Math.max(0, Math.min(255, Math.round(b + amt)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
export function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}
/** A contrast edge for a figure: darker if the fill is light, lighter if dark —
 *  so figures separate from a same-toned background (white gown on a pale wall,
 *  dark suit on a dark backdrop). */
export function outlineOf(hex: string): string {
  return lum(hex) > 150 ? shade(hex, -82) : shade(hex, 92);
}

// ---- people ----
// Figures carry a contrast outline so they never blend into a same-toned
// backdrop (white gown on a pale wall, dark suit on a dark backdrop) — issue
// caught by the legibility-verification workflow 2026-06-09.
export function figHead(cx: number, cy: number, r: number): string {
  return (
    `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${SKIN}" stroke="${shade(SKIN, -55)}" stroke-width="0.7"/>` +
    `<path d="M ${(cx - r).toFixed(1)} ${cy.toFixed(1)} a ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(2 * r).toFixed(1)} 0 Z" fill="${HAIR}"/>`
  );
}
export function gownFig(cx: number, baseY: number, h: number, color: string, accent?: string): string {
  const w = h * 0.5;
  const ol = outlineOf(color);
  return (
    `<polygon points="${(cx - w / 2).toFixed(1)},${baseY.toFixed(1)} ${(cx + w / 2).toFixed(1)},${baseY.toFixed(1)} ${(cx + w * 0.18).toFixed(1)},${(baseY - h * 0.58).toFixed(1)} ${(cx - w * 0.18).toFixed(1)},${(baseY - h * 0.58).toFixed(1)}" fill="${color}" stroke="${ol}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<rect x="${(cx - w * 0.18).toFixed(1)}" y="${(baseY - h * 0.78).toFixed(1)}" width="${(w * 0.36).toFixed(1)}" height="${(h * 0.26).toFixed(1)}" rx="3" fill="${color}" stroke="${ol}" stroke-width="1.1"/>` +
    // The accent: a sash at the waist, where the bodice meets the skirt.
    (accent
      ? `<rect x="${(cx - w * 0.2).toFixed(1)}" y="${(baseY - h * 0.6).toFixed(1)}" width="${(w * 0.4).toFixed(1)}" height="${(h * 0.06).toFixed(1)}" rx="1" fill="${accent}" stroke="${outlineOf(accent)}" stroke-width="0.6"/>`
      : '') +
    figHead(cx, baseY - h * 0.86, h * 0.13)
  );
}
export function suitFig(cx: number, baseY: number, h: number, color: string, accent?: string): string {
  const w = h * 0.34;
  const ol = outlineOf(color);
  return (
    `<rect x="${(cx - w / 2).toFixed(1)}" y="${(baseY - h * 0.72).toFixed(1)}" width="${w.toFixed(1)}" height="${(h * 0.72).toFixed(1)}" rx="2" fill="${color}" stroke="${ol}" stroke-width="1.2"/>` +
    // The tie: the jacket's own lighter stripe, or — with an accent — the accent itself.
    (accent
      ? `<rect x="${(cx - 1.6).toFixed(1)}" y="${(baseY - h * 0.72).toFixed(1)}" width="3.2" height="${(h * 0.5).toFixed(1)}" fill="${accent}" stroke="${outlineOf(accent)}" stroke-width="0.4"/>`
      : `<rect x="${(cx - 1.6).toFixed(1)}" y="${(baseY - h * 0.72).toFixed(1)}" width="3.2" height="${(h * 0.5).toFixed(1)}" fill="${shade(color, 40)}" opacity="0.5"/>`) +
    figHead(cx, baseY - h * 0.8, h * 0.13)
  );
}

// ─── A role, drawn ──────────────────────────────────────────────────────────

export type FigureKind = 'gown' | 'suit';

/**
 * Who a role's figure is. The couple and the gendered attendants are one
 * person; every other role (sponsors, parents, the party, custom roles…) is a
 * PAIR — a gown and a suit — because the role holds both. Keyed on the Mood
 * Board's `PaletteKey` (a custom role's `custom:<slug>` falls to the pair).
 */
const SINGLE: Record<string, FigureKind> = {
  // Mood Board keys.
  bride: 'gown',
  groom: 'suit',
  maid_of_honor: 'gown',
  bridesmaids: 'gown',
  best_man: 'suit',
  groomsmen: 'suit',
  // A reader's own guest-list role (the dress-code scene's "You are …"): a
  // ninang is one woman, not the sponsors' pair.
  matron_of_honor: 'gown',
  // Colours with the best man (palette key `best_man`), dresses as a woman.
  best_woman: 'gown',
  // Colours with the maid of honor (palette key `maid_of_honor`), dresses as a man (owner 2026-10-19).
  man_of_honor: 'suit',
  bridesmaid: 'gown',
  groomsman: 'suit',
  principal_sponsor_ninang: 'gown',
  principal_sponsor_ninong: 'suit',
  flower_girl: 'gown',
  ring_bearer: 'suit',
  bible_bearer: 'suit',
  coin_bearer: 'suit',
};

/**
 * The people who wear a role's colours, and what each wears:
 *   · an OUTFIT role (`meaning: 'outfit'`): colour 1 is the main piece and
 *     colour 2 its accent — one person, or the pair, dressed alike;
 *   · an OPTIONS role (the guests, `meaning: 'options'`): guests wear ANY ONE of
 *     the colours, never combined — so one person per colour, gown and suit in
 *     turn (up to six).
 * Nothing valid to wear → nobody (a figure in a guessed colour is not the
 * couple's palette).
 */
export function roleFigures(
  key: string,
  hexes: readonly string[],
  meaning: 'outfit' | 'options' = 'outfit',
): Array<{ kind: FigureKind; color: string; accent?: string }> {
  const colors = hexes.filter((h) => HEX.test(h));
  if (!colors.length) return [];
  if (meaning === 'options') return colors.slice(0, GUEST_OPTIONS_MAX).map((color, i) => ({ kind: i % 2 ? 'suit' : 'gown', color }));
  const [color, accent] = [colors[0]!, colors[1]];
  const kinds: FigureKind[] = SINGLE[key] ? [SINGLE[key]!] : ['gown', 'suit'];
  return kinds.map((kind) => ({ kind, color, ...(accent ? { accent } : {}) }));
}

/** A role's single wearer by the shipped figure rule — a gown or a suit — or null for a role that holds both (`readerAttire`'s `single`). */
export function singleWearerOf(role: string): 'gown' | 'suit' | null {
  const people = roleFigures(role, ['#000000']);
  return people.length === 1 ? people[0]!.kind : null;
}

/* ── the people, drawn (owner 2026-10-14) ────────────────────────────────── */

/**
 * One person in a picture: who, what they wear, and the colour their garment is dyed (the role's hex, exactly). A role
 * drawing wears `colours` ZONE BY ZONE (dot 1 the garment, dot 2 the accent…, `zoneTints`); `main` is dot 1.
 */
export type FigurePerson = { who: FigureWho; garment: FigureGarment; main: string; colours?: readonly string[] };
/** A pick as a reader sees it (`picksOf`, lib/attire-rows.ts): who, the Wear (null = not said), its own colours (null =
 *  the row's), and — for a row with its own designs — the role it is drawn as (`columnRole`, lib/attire-designs.ts). */
export type FigurePick = { who: FigureWho; style: AttireStyle | null; colours: readonly string[] | null; role?: FigureRole | null };

/** A colour a shade deeper — a tie in the suit's own cloth (the approved prototype's `deeper`, ×0.72). */
export function deeper(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const k = 0.72;
  const c = (v: number) => Math.round(v * k);
  return `#${((c((n >> 16) & 255) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, '0').toUpperCase()}`;
}

/** The colour each zone of a design wears for these dots — a dot given wears its own; one not given, the zone's default. */
export function zoneColours(style: AttireStyle | null | undefined, colours: readonly string[]): string[] {
  const own = colours.filter((h) => HEX.test(h));
  const first = own[0] ?? '#9B9B9B';
  return zonesOf(style).map((z, i) => own[i] ?? (z.fallback === 'first' ? first : z.fallback === 'deeper' ? deeper(first) : z.fallback));
}

/**
 * 🏷 WHAT EACH COLOUR DOT COLOURS — one word under every dot, the SAME on Studio › Mood Board & Dress Code and on the
 * guest's dress code (owner 2026-10-17: *"for the dress code of women, there are palettes but no indication of what
 * the colors control"*).
 *
 * The approved zones prototype (`prototypes/attire_colour_zones_2026-10-16.md`, "How the editor says it") put a word
 * only under a ZONED garment's dots ("Coat & pants · Tie · Shirt") and "nothing under a one-zone garment's dots" — so
 * a gown's colours, and every colour past a design's zones, said nothing. The words now:
 *   · a zone's own word (`DESIGN_ZONES`, the record's) — Coat & pants · Tie & accent · Long sleeves · Vest & pants · Barong · Pants;
 *   · a ONE-colour design (a gown, a terno, a dress) — the design's own name for the person ("Long gown", "Filipiniana
 *     (terno)", "Tulle dress"): the colour IS that garment;
 *   · a colour past the design's zones — `DOT_WORD_ACCENT`, the record's word for every colour after the garment
 *     ("Dot 2 is the accent", DECISION_LOG 2026-10-16), numbered past the first (`accentWord`: Accent · Accent 2) — it
 *     paints nothing on the drawing, and is still the couple's;
 *   · no Wear said yet — `DOT_WORD_OUTFIT` for the first colour (the word the guest's own panel already says,
 *     "Outfit to be confirmed"), accents after.
 *   · guests (`options`) — every colour is its own outfit, so each says the first zone's word.
 * 🔑 The one-zone word, "Accent" and "Outfit" are build calls (no word existed in the record) — named in the PR for
 * the owner.
 *
 * The colours are the ones the figure WEARS (`zoneColours`): a zone with no colour of its own shows the colour it is
 * drawn in (a white shirt), exactly as the Studio's dot does.
 */
export const DOT_WORD_OUTFIT = 'Outfit';
export const DOT_WORD_ACCENT = 'Accent';
/**
 * 🔢 NO TWO DOTS OF ONE PERSON SAY THE SAME WORD (owner 2026-10-21, on Secondary Sponsors' women — "Long gown · Accent ·
 * Accent"): the accents are numbered as the record already numbers them (2026-09-21, "the editor labels them Main /
 * Accent / Accent 2…") — Accent · Accent 2 · Accent 3. They still paint nothing on a one-zone drawing (it has one mask).
 */
export function accentWord(n: number): string {
  return n === 0 ? DOT_WORD_ACCENT : `${DOT_WORD_ACCENT} ${n + 1}`;
}
export type PickDot = { hex: string; word: string };
export function pickDots(
  style: AttireStyle | null | undefined,
  colours: readonly string[],
  role: FigureRole | null | undefined,
  options = false,
): PickDot[] {
  const own = colours.filter((h) => HEX.test(h));
  if (own.length === 0) return [];
  if (!style) return own.map((hex, i) => ({ hex, word: options || i === 0 ? DOT_WORD_OUTFIT : accentWord(i - 1) }));
  const zones = zonesOf(style);
  const zoneWord = (i: number) => zones[i]?.label ?? designLabel(role ?? null, style);
  /* 👔 A guest man in a tie wears each colour on the tie (`wearsColourOnTie`, owner 2026-10-21) — so it says "Tie". */
  const onTie = wearsColourOnTie(role, style);
  if (options) {
    const optionWord = onTie ? zoneWord(zones.findIndex((z) => z.key === 't')) : zoneWord(0);
    return own.map((hex) => ({ hex, word: optionWord }));
  }
  const worn = onTie && own.length === 1 ? tieZoneColours(style, own[0]!) : zoneColours(style, own);
  return [...zones.map((_, i) => ({ hex: worn[i]!, word: zoneWord(i) })), ...own.slice(zones.length).map((hex, i) => ({ hex, word: accentWord(i) }))];
}

/**
 * 🎨 THE RULE (DECISION_LOG 2026-10-16 "ATTIRE COLOUR ZONES"): one tint layer per zone of the drawing — its mask and
 * its colour. A garment drawing (the 13) has one zone, dyed dot 1, exactly as before.
 */
export function zoneTints(garment: FigureGarment, colours: readonly string[]): Array<{ key: ZoneKey; mask: string; colour: string }> {
  if (garment === 'unset') return [];
  const art = FIGURE_ART[garment];
  const own = colours.filter((h) => HEX.test(h));
  if (!art.zones) return [{ key: 'a', mask: art.mask, colour: own[0] ?? '#9B9B9B' }];
  const design = designOfArt(garment);
  /* 👔 A GUEST MAN'S ONE OPTION COLOUR IS HIS TIE (owner 2026-10-21, `wearsColourOnTie`): coat & pants black, shirt
     white. Colours given zone by zone (more than one) are the host's own and are worn as given. */
  const worn = design && own.length === 1 && wearsColourOnTie(roleOfArt(garment), design) ? tieZoneColours(design, own[0]!) : zoneColours(design, own);
  /* Each mask wears its control's colour — a zone with no control of its own (a 3-piece's vest) wears the one it follows. */
  const controls = zonesOf(design).map((z) => z.key);
  return art.zones.map((z) => ({ key: z.key, mask: z.mask, colour: worn[controls.indexOf(controlOfZone(design, z.key))]! }));
}

/** The drawing for a pick: its role's own drawing of the design, else the shipped garment of that style (`garmentFor`). */
export function garmentOfPick(p: { who: FigureWho; style: AttireStyle | null; role?: FigureRole | null }): FigureGarment {
  return (p.role ? roleArtKey(p.role, p.style) : null) ?? garmentFor(p.who, p.style);
}

/** What a person wears on the GUEST page when the Wear is not said but their colours are: the plain garment of
 *  their kind — the palette still wears a person (the dotted silhouette is the Studio's "Not said yet"). */
export const PLAIN_GARMENT: Readonly<Record<FigureWho, FigureGarment>> = { f: 'gown', m: 'suit', girl: 'flowergirl', boy: 'suitb' };

/** Keys whose single person is a child. */
const CHILD: Record<string, FigureWho> = { flower_girl: 'girl', ring_bearer: 'boy', bible_bearer: 'boy', coin_bearer: 'boy' };

/**
 * The people a role's picture shows.
 *   · `picks` given (the dress code's rows and the reader's own panel): one person per pick, in the pick's garment
 *     (its plain one when not said), dyed its FIRST colour — the main piece (the drawings are dyed one colour; an
 *     OPTIONS role, the guests, wears its first, never two combined);
 *   · no `picks` (the Mood Board's palette cards): `roleFigures`' people — a gown is a woman, a suit a man — each in
 *     their plain garment.
 * Nothing valid to wear → nobody.
 */
export function roleFigurePeople(key: string, hexes: readonly string[], _meaning: 'outfit' | 'options' = 'outfit', picks?: readonly FigurePick[] | null): FigurePerson[] {
  if (picks && picks.length > 0) {
    const out: FigurePerson[] = [];
    for (const p of picks) {
      const colours = (p.colours && p.colours.length > 0 ? p.colours : hexes).filter((h) => HEX.test(h));
      if (!colours.length) continue;
      /* Not said — or said, but not this person's (`garmentFor` → 'unset'): their plain garment, never another's. */
      const drawn = garmentOfPick(p);
      const garment = drawn === 'unset' ? PLAIN_GARMENT[p.who] : drawn;
      /* 👗 GUESTS (an OPTIONS role): each colour is its own person, side by side — up to five (owner 2026-10-16). */
      if (_meaning === 'options') {
        for (const c of colours.slice(0, GUEST_OPTIONS_MAX)) out.push({ who: p.who, garment, main: c, colours: [c] });
        continue;
      }
      out.push({ who: p.who, garment, main: colours[0]!, colours });
    }
    return out;
  }
  const isPair = key === 'bearers_flower_girl';
  return roleFigures(key, hexes, _meaning).map((f) => {
    const who: FigureWho = CHILD[key] ?? (isPair ? (f.kind === 'gown' ? 'girl' : 'boy') : f.kind === 'gown' ? 'f' : 'm');
    return { who, garment: PLAIN_GARMENT[who], main: f.color };
  });
}
