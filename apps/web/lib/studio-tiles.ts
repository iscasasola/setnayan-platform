/**
 * lib/studio-tiles.ts — THE STUDIO HOME'S ELEVEN TILES (owner 2026-10-06,
 * DECISION_LOG "STUDIO OPENS ON A HOME OF TEN TILES…" + "PRINTS IS THE ELEVENTH
 * STUDIO TILE"; prototype `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`
 * `SHOME` / `studioHome()`; plan `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` PR 1).
 *
 * Owner, verbatim: *"studio, will have the same top nav, but a different
 * approach on the 10 studio pages"* → *"1. tiles · 2. yes for those 2"* →
 * *"yes add prints as the eleventh tile"*. In the order an event gets made:
 *
 *   Info · Look · Logo · Mood Board & Dress Code · Schedule · Love Story ·
 *   Wedding March · Seat plan · E-Gifts · RSVP · Prints
 *
 * 🔑 NEVER A SECOND TRUTH. A tile is chrome over an editor the Maker already
 * has (each opens its shipped Event Details item, `item`), and its ✓ / Missing
 * is read from the SAME derivation the Details rows and the guided flow read:
 * `guidedItemDone` over the launch page's one `guidedFactsFrom` (which is what
 * every `DetailsItemModel.done` the plan counts is), `wordsAndPlansItem` for the
 * Schedule's and the Love Story's lines, the RSVP setup step's own done
 * (`hubSetupDone('ask')` — a reply-by date), and the counts the page already
 * read (the seat plan's tables and seated, the E-Gifts manager's own methods).
 * A fact that could not be read makes NO claim (`done: undefined`) — never a
 * "Missing" nobody measured. Prints is always ✓ (nothing to fill).
 *
 * Pure: no I/O, no React. The launch page builds the models on the server
 * (only while the new Maker is on) and hands them to `MakerShell`; the shell
 * and `studio-home.tsx` import TYPES only, so nothing here reaches the phone.
 */
import { DETAILS_FIRST_PRINT, LOOK_SECTION_ITEM_KEYS, wordsAndPlansItem, type DetailsItemKey } from '@/lib/maker-details-items';
import { guidedItemDone, type GuidedDoneFacts } from '@/lib/details-guided-flow';
import { hubSetupDone, type HubSetupFacts } from '@/lib/hub-setup-steps';

export const STUDIO_TILE_KEYS = ['info', 'look', 'logo', 'mood', 'schedule', 'story', 'march', 'seats', 'gifts', 'rsvp', 'prints'] as const;
export type StudioTileKey = (typeof STUDIO_TILE_KEYS)[number];

type StudioTileDef = {
  /** The tile's name, and the short name the pill shows. */
  label: string;
  short: string;
  /** The shipped Event Details item the tile opens. */
  item: DetailsItemKey;
  /** The items whose `done` this tile reads (all must be read, and all true). */
  reads: readonly DetailsItemKey[];
  /** Wedding March and Seat plan: the top nav hides, ✓ Done returns (owner: "yes for those 2"). */
  immersive?: true;
  /** What it holds, in the prototype's words — the status line where no count says more. */
  sub: string;
};

export const STUDIO_TILES: Readonly<Record<StudioTileKey, StudioTileDef>> = {
  info: { label: 'Info', short: 'Info', item: 'names', reads: ['names', 'date', 'venues'], sub: 'Your event · Your Event Hub' },
  look: { label: 'Look', short: 'Look', item: 'background', reads: ['theme'], sub: 'Background · Colours · Font · Music' },
  logo: { label: 'Logo', short: 'Logo', item: 'logo', reads: ['logo'], sub: 'Mark · fonts · animation' },
  mood: { label: 'Mood Board & Dress Code', short: 'Mood Board', item: 'mood-board', reads: ['mood-board'], sub: 'Five colours · attire by role' },
  schedule: { label: 'Schedule', short: 'Schedule', item: 'schedule', reads: ['schedule'], sub: 'Times and moments' },
  story: { label: 'Love Story', short: 'Love Story', item: 'love-story', reads: ['love-story'], sub: 'Chapters with a photo' },
  march: { label: 'Wedding March', short: 'March', item: 'march', reads: ['march'], immersive: true, sub: 'Drag the names, two columns' },
  seats: { label: 'Seat plan', short: 'Seat plan', item: 'seating', reads: ['seating'], immersive: true, sub: 'Tables and who sits where' },
  gifts: { label: 'E-Gifts', short: 'E-Gifts', item: 'gifts', reads: [], sub: 'GCash · Maya · bank · PayPal' },
  rsvp: { label: 'RSVP', short: 'RSVP', item: 'rsvp', reads: [], sub: 'Reply by · what the form asks' },
  prints: { label: 'Prints', short: 'Prints', item: DETAILS_FIRST_PRINT, reads: [], sub: 'Invitation set · for the day' },
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
};

export type StudioTilesInput = {
  /** The launch page's ONE derivation of "done" (`guidedFactsFrom`) — the Details rows' own. */
  facts: GuidedDoneFacts;
  /** The setup's facts (`hubSetupFactsFrom`) — RSVP's reply-by; null where the type has no setup. */
  setup: HubSetupFacts | null;
  /** E-Gifts switched on, from the E-Gifts manager's own read; null = could not be read. */
  giftMethods: number | null;
  /** The Seat plan row's counts; null = this type has no seat plan. */
  seat: { tables: number | null; seated: number | null } | null;
  /** Does this event draw the item (the type's own rule, `detailsItemApplies`, and what was read)? */
  offered: (item: DetailsItemKey) => boolean;
  /** The march's name in the event type's own words (`yourEventLabel('march', kind)`). */
  marchLabel?: string;
};

const UNREAD = 'Could not be read just now';

function readsDone(reads: readonly DetailsItemKey[], facts: GuidedDoneFacts): boolean | undefined {
  if (reads.length === 0) return undefined;
  const v = reads.map((k) => guidedItemDone(k, facts));
  return v.some((x) => x === undefined) ? undefined : v.every(Boolean);
}

function tileDone(key: StudioTileKey, input: StudioTilesInput): boolean | undefined {
  switch (key) {
    case 'gifts':
      return input.giftMethods === null ? undefined : input.giftMethods > 0;
    case 'rsvp':
      return input.setup ? (hubSetupDone('ask', input.setup) ?? undefined) : undefined;
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
    case 'seats': {
      const t = input.seat?.tables ?? null;
      const n = input.seat?.seated ?? null;
      if (!input.seat) return def.sub;
      if (t === null || n === null) return UNREAD;
      return t === 0 ? 'No tables yet' : `${t} ${t === 1 ? 'table' : 'tables'} · ${n} seated`;
    }
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
      label: key === 'march' && input.marchLabel ? input.marchLabel : def.label,
      short: key === 'march' && input.marchLabel ? input.marchLabel.split(' ').slice(-1)[0]! : def.short,
      item: def.item,
      immersive: def.immersive === true,
      done: tileDone(key, input),
      status: tileStatus(key, input),
    };
  });
}

/** "n of N ready" — a tile counts only when it is really done (no claim is not ready). */
export function studioReady(tiles: readonly Pick<StudioTileModel, 'done'>[]): { ready: number; total: number } {
  return { ready: tiles.filter((t) => t.done === true).length, total: tiles.length };
}

/**
 * 🧭 THE EDITOR A TILE OPENS — each tile its OWN (owner 2026-10-07: Look opened the Logo editor). Look keeps
 * the Look section the couple was on (Background · Colours · Font · Music) and otherwise opens on
 * Background — never another Look-group item (Logo, Mood Board, Cover page, Reveal), which the lower
 * third's "stay where you were" used to carry over. Every other tile opens its own item.
 */
export function studioTileItem(key: StudioTileKey, current: string | null): DetailsItemKey {
  if (key === 'look') {
    return current !== null && (LOOK_SECTION_ITEM_KEYS as readonly string[]).includes(current) ? (current as DetailsItemKey) : 'background';
  }
  return STUDIO_TILES[key].item;
}
