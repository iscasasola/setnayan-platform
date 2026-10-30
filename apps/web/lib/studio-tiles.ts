/**
 * lib/studio-tiles.ts — THE STUDIO HOME'S TILES (owner 2026-10-06,
 * DECISION_LOG "STUDIO OPENS ON A HOME OF TEN TILES…" + "PRINTS IS THE ELEVENTH
 * STUDIO TILE"; prototype `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`
 * `SHOME` / `studioHome()`; plan `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` PR 1).
 *
 * Owner, verbatim: *"studio, will have the same top nav, but a different
 * approach on the 10 studio pages"* → *"1. tiles · 2. yes for those 2"* →
 * *"yes add prints as the eleventh tile"*. In the order an event gets made:
 *
 *   Info · Look · Logo · Mood Board & Dress Code · Schedule · Love Story ·
 *   Wedding March · Seat plan · E-Gifts · Prints
 *
 * 🗂 RSVP LEFT (R1, owner 2026-10-28): its settings are Guests ⚙'s now; Studio's "n of N ready" counts the tiles that
 * are here, so a finished RSVP never reads as a Studio "Missing" and an unfinished one is Guests ⚙'s to say.
 * 🗂 WEDDING MARCH AND SEAT PLAN LEFT (R4, owner 2026-10-27/28): they are Guests › March and Guests › Seats — the same
 * makers, drawn whole there. Their ✓ is still counted where the guided flow counts it (a link step to the Guests view,
 * `lib/details-guided-flow.ts`), never as a Studio "Missing".
 *
 * 🔑 NEVER A SECOND TRUTH. A tile is chrome over an editor the Maker already
 * has (each opens its shipped Event Details item, `item`), and its ✓ / Missing
 * is read from the SAME derivation the Details rows and the guided flow read:
 * `guidedItemDone` over the launch page's one `guidedFactsFrom` (which is what
 * every `DetailsItemModel.done` the plan counts is), `wordsAndPlansItem` for the
 * Schedule's and the Love Story's lines, and the counts the page already
 * read (the E-Gifts manager's own methods).
 * A fact that could not be read makes NO claim (`done: undefined`) — never a
 * "Missing" nobody measured. Prints is always ✓ (nothing to fill).
 *
 * Pure: no I/O, no React. The launch page builds the models on the server
 * (only while the new Maker is on) and hands them to `MakerShell`; the shell
 * and `studio-home.tsx` import TYPES only, so nothing here reaches the phone.
 */
import { wordsAndPlansItem, type DetailsItemKey } from '@/lib/maker-details-items';
import { guidedItemDone, type GuidedDoneFacts } from '@/lib/details-guided-flow';

export { STUDIO_MENU_KEYS, STUDIO_TILE_KEYS, STUDIO_TILE_ITEM, isStudioMenuKey, studioTileItem, type StudioTileKey } from './studio-tile-defs';
import { STUDIO_TILE_ITEM, STUDIO_TILE_KEYS, isStudioMenuKey, type StudioTileKey } from './studio-tile-defs';
import { LOOK_SECTIONS, LOOK_SECTION_LABEL } from '@/lib/maker-look-sections';
import { STUDIO_TILE_UNREAD } from './studio-page-cards';
import { formatPhp } from '@/lib/php';
import { hubPart, type HubPartId } from '@/lib/hub-parts';

/**
 * 💎 STUDIO NESTING (owner 2026-10-22, "Event Hub Pro, part by part"): each Studio card names the Pro parts that live
 * on its page — a quiet "◆ … from ₱500" line, ✓ when owned. Info → Custom address · Look → Style, Background, Motion,
 * Music · Logo → Logo & QR · Love Story → Photos · Prints → Prints. Mood Board & Dress Code, Schedule, Wedding March,
 * Seat plan and E-Gifts show no price (free). (Reveal and Post Event live in the Stages, Your own
 * scenes on the stage canvas.)
 */
export const STUDIO_TILE_PARTS: Readonly<Record<StudioTileKey, readonly HubPartId[]>> = {
  info: ['address'],
  look: ['style', 'background', 'motion', 'music'],
  logo: ['logo_qr'],
  mood: [],
  schedule: [],
  story: ['photos'],
  gifts: [],
  prints: ['prints'],
};

/** The card's quiet Pro line — every figure a catalogue read; null where the page holds no part (or no price was read). */
export function studioTilePro(
  key: StudioTileKey,
  pro: { owned: readonly HubPartId[]; full: boolean; pricePhp: Partial<Record<HubPartId, number>> } | null | undefined,
): { owned: boolean; words: string } | null {
  const parts = STUDIO_TILE_PARTS[key];
  if (!pro || parts.length === 0) return null;
  const names = parts.map((p) => hubPart(p).name);
  if (pro.full || parts.every((p) => pro.owned.includes(p))) return { owned: true, words: names.join(' · ') };
  const open = parts.filter((p) => !pro.owned.includes(p));
  const figures = open.map((p) => pro.pricePhp[p]).filter((n): n is number => typeof n === 'number');
  if (figures.length === 0) return null;
  const least = Math.min(...figures);
  const same = figures.every((n) => n === least) && open.length === 1;
  return { owned: false, words: `${open.map((p) => hubPart(p).name).join(' · ')} ${same ? '' : 'from '}${formatPhp(least)}` };
}

type StudioTileDef = {
  /** The tile's name, and the short name the pill shows. */
  label: string;
  short: string;
  /** The shipped Event Details item the tile opens. */
  item: DetailsItemKey;
  /** The items whose `done` this tile reads (all must be read, and all true). */
  reads: readonly DetailsItemKey[];
  /** A tile whose page takes the whole screen — the top nav hides, ✓ Done returns (owner: "yes for those 2" — the
   *  Wedding March and Seat plan, both Guests' views since R4; none is left). */
  immersive?: true;
  /** What it holds, in the prototype's words — the status line where no count says more. */
  sub: string;
};

export const STUDIO_TILES: Readonly<Record<StudioTileKey, StudioTileDef>> = {
  info: { label: 'Info', short: 'Info', item: STUDIO_TILE_ITEM.info, reads: ['names', 'date', 'venues'], sub: 'Your event · Your Event Hub' },
  /* Its line IS Look's sections (`LOOK_SECTIONS` — Background · Elements · Music since 2026-10-08), never a second list of them. */
  look: { label: 'Look', short: 'Look', item: STUDIO_TILE_ITEM.look, reads: ['theme'], sub: LOOK_SECTIONS.map((k) => LOOK_SECTION_LABEL[k]).join(' · ') },
  logo: { label: 'Logo', short: 'Logo', item: STUDIO_TILE_ITEM.logo, reads: ['logo'], sub: 'Mark · fonts · animation' },
  /* 🎨 "PALETTE + DRESS CODE" (owner 2026-10-27, "STUDIO IS LOOK AND WORDS ONLY"): the Mood Board's inspiration part goes to
     Suppliers › Find; what stays is the five colours and attire by role — named for what it is (the 30 Oct prototype). */
  mood: { label: 'Palette + Dress Code', short: 'Palette', item: STUDIO_TILE_ITEM.mood, reads: ['mood-board'], sub: 'Five colours · attire by role' },
  schedule: { label: 'Schedule', short: 'Schedule', item: STUDIO_TILE_ITEM.schedule, reads: ['schedule'], sub: 'Times and moments' },
  story: { label: 'Love Story', short: 'Love Story', item: STUDIO_TILE_ITEM.story, reads: ['love-story'], sub: 'Chapters with a photo' },
  gifts: { label: 'E-Gifts', short: 'E-Gifts', item: STUDIO_TILE_ITEM.gifts, reads: [], sub: 'GCash · Maya · bank · PayPal' },
  prints: { label: 'Prints', short: 'Prints', item: STUDIO_TILE_ITEM.prints, reads: [], sub: 'Invitation set · for the day' },
};

/** One tile, as the Studio home draws it and the Tool ▾ lists it. */
export type StudioTileModel = {
  key: StudioTileKey;
  label: string;
  short: string;
  item: DetailsItemKey;
  immersive: boolean;
  /** ✓ (true) · Missing (false) · no claim (undefined: not read, or "done" means nothing). */
  done: boolean | undefined;
  status: string;
  /** 💎 Its Pro parts' quiet line (`studioTilePro`) — null where it holds none, and in the store shell. */
  pro?: { owned: boolean; words: string } | null;
};

export type StudioTilesInput = {
  /** The launch page's ONE derivation of "done" (`guidedFactsFrom`) — the Details rows' own. */
  facts: GuidedDoneFacts;
  /** E-Gifts switched on, from the E-Gifts manager's own read; null = could not be read. */
  giftMethods: number | null;
  /** Does this event draw the item (the type's own rule, `detailsItemApplies`, and what was read)? */
  offered: (item: DetailsItemKey) => boolean;
  /** 💎 What the event holds of Event Hub Pro and each part's price — null in the store shell (no web price). */
  pro?: { owned: readonly HubPartId[]; full: boolean; pricePhp: Partial<Record<HubPartId, number>> } | null;
};

/* The one sentence for a fact that could not be read — the Studio home's card says it too (`lib/studio-page-cards.ts`). */
const UNREAD = STUDIO_TILE_UNREAD;

function readsDone(reads: readonly DetailsItemKey[], facts: GuidedDoneFacts): boolean | undefined {
  if (reads.length === 0) return undefined;
  const v = reads.map((k) => guidedItemDone(k, facts));
  return v.some((x) => x === undefined) ? undefined : v.every(Boolean);
}

function tileDone(key: StudioTileKey, input: StudioTilesInput): boolean | undefined {
  switch (key) {
    case 'gifts':
      return input.giftMethods === null ? undefined : input.giftMethods > 0;
    case 'prints':
      return true;
    default:
      return readsDone(STUDIO_TILES[key].reads, input.facts);
  }
}

function tileStatus(key: StudioTileKey, input: StudioTilesInput): string {
  const def = STUDIO_TILES[key];
  switch (key) {
    case 'schedule':
      return wordsAndPlansItem('schedule', input.facts.words).sub ?? def.sub;
    case 'story':
      return wordsAndPlansItem('love-story', input.facts.words).sub ?? def.sub;
    case 'gifts': {
      const n = input.giftMethods;
      if (n === null) return UNREAD;
      return n === 0 ? 'No gift method yet' : `${n} ${n === 1 ? 'way' : 'ways'} to give`;
    }
    default:
      return def.sub;
  }
}

/** The tiles this event draws, in the owner's order, each with its ✓ / Missing and its line. */
export function studioTiles(input: StudioTilesInput): StudioTileModel[] {
  return STUDIO_TILE_KEYS.filter((k) => input.offered(STUDIO_TILES[k].item)).map((key) => {
    const def = STUDIO_TILES[key];
    return {
      key,
      label: def.label,
      short: def.short,
      item: def.item,
      immersive: def.immersive === true,
      done: tileDone(key, input),
      status: tileStatus(key, input),
      pro: studioTilePro(key, input.pro),
    };
  });
}

/**
 * 🎛 The pages Studio ▾ lists (`STUDIO_MENU_KEYS`, owner 2026-10-27/30) — the rest are opened from their new homes.
 * Studio ▾, the Studio home's cards and "n of N ready" all read THIS, so the count never says "Missing" about a page
 * the menu does not show.
 */
export function studioMenuTiles<T extends Pick<StudioTileModel, 'key'>>(tiles: readonly T[]): T[] {
  return tiles.filter((t) => isStudioMenuKey(t.key));
}

/** "n of N ready" — a tile counts only when it is really done (no claim is not ready). */
export function studioReady(tiles: readonly Pick<StudioTileModel, 'done'>[]): { ready: number; total: number } {
  return { ready: tiles.filter((t) => t.done === true).length, total: tiles.length };
}

