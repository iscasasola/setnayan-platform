/**
 * 🛍▶ THE STORE'S "TRY IT FIRST" DEMOS — every paid tool shows what couples and guests meet before a shop buys it
 * (owner 2026-11-23 app-store ruling, specs eb51e640: "every item has its demo before buying"; controller answers to
 * #8193, specs 7d487adb Q6: "all four paid tools get a 'Try it first' demo"; and the 21 Nov ruling "A LOCKED SPECIAL
 * TOOL SHOWS ITS FRONT-END EXPERIENCE, NOT ITS SETTINGS").
 *
 * The Cake Maker's demo is the couple's own designer on sample options (`lib/cake-demo.ts`). The other three copy its
 * shape: the SHIPPED customer-side piece, handed the sample below, in the browser.
 *   song_bank        the band's song list as couples see it — tap a cover to hear it, tap a row to pick it.
 *   papic_challenge  the guest's Papic camera — the shipped challenge pill and the line under the shutter.
 *   plan_3d          the couple's 3D plan — a sample room with the shop's own booth in it.
 *
 * Nothing here reads, saves or sends: no server action, no database, no price. The sample is made-up (no real event,
 * guest or couple), and a demo never shows money — a demo never invents a price (CLAUDE.md "never guess a money number").
 */
import { CAKE_DEMO_BAR_WORDS } from './cake-demo';
import type { PaidStoreTool } from './supplier-store';
import { boothMissionPrompt, type GuestMissionRow } from './papic-missions';
import type { Lab3DBooth, Lab3DFloor, Lab3DTable } from './seating-3d';
import type { GuestRole } from './guests';

/**
 * The one line under "Try it first", per paid tool — who meets the tool, and where. A `Record` over every paid tool, so
 * a paid tool with no demo does not compile.
 */
export const STORE_TOOL_DEMO_LINE: Record<PaidStoreTool, string> = {
  cake_tool: 'A demo · what couples see in your chat',
  song_bank: 'A demo · what couples see on your shop page',
  papic_challenge: 'A demo · what guests see in the Papic camera',
  plan_3d: 'A demo · your booth in the couple’s 3D plan',
};

/** The demos that open in the shared demo screen (the Cake Maker opens its own designer). */
export const SCREEN_DEMO_TOOLS = ['song_bank', 'papic_challenge', 'plan_3d'] as const satisfies readonly PaidStoreTool[];
export type ScreenDemoTool = (typeof SCREEN_DEMO_TOOLS)[number];

/** Each demo screen's head: the title and its one short line. */
export const STORE_TOOL_DEMO_HEAD: Record<ScreenDemoTool, { title: string; line: string }> = {
  song_bank: { title: 'Songs you play', line: 'Couples tap a cover to hear it, and a row to pick it.' },
  papic_challenge: { title: 'Papic challenge', line: 'Guests pick a challenge, then take the shot.' },
  plan_3d: { title: '3D plan', line: 'Your booth in the room. Drag to look around.' },
};

/** The calm bar in place of the tool's real button — the Cake Maker demo's own words ("included in Plus"). */
export const TOOL_DEMO_BAR_WORDS = CAKE_DEMO_BAR_WORDS;

/** The shop's name in a demo; a shop with no name yet reads as "Your shop". */
export function demoShopName(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  return n.length > 0 ? n : 'Your shop';
}

// ─── Song bank ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** One sample song, in `SongPreviewList`'s row shape (the onboarding song bank's row). No cached preview: the cover and
 *  the 30-second clip come from the same keyless lookup the couple's song bank uses — nothing is stored. */
export type DemoSong = { title: string; artist: string; lbl: string; previewUrl: null; artworkUrl: null };

const DEMO_SONGS_RAW: ReadonlyArray<readonly [string, string]> = [
  ['Can’t Help Falling in Love', 'Elvis Presley'],
  ['Perfect', 'Ed Sheeran'],
  ['Beautiful in White', 'Shane Filan'],
  ['Ikaw', 'Yeng Constantino'],
  ['Thinking Out Loud', 'Ed Sheeran'],
  ['Tadhana', 'Up Dharma Down'],
  ['A Thousand Years', 'Christina Perri'],
  ['Forevermore', 'Side A'],
  ['Marry You', 'Bruno Mars'],
  ['September', 'Earth, Wind & Fire'],
];

/** The band's sample set list — the song bank's `title|artist` label, the key `SongPreviewList` picks by. */
export function demoSongs(): DemoSong[] {
  return DEMO_SONGS_RAW.map(([title, artist]) => ({ title, artist, lbl: `${title}|${artist}`, previewUrl: null, artworkUrl: null }));
}

/** The songs a couple has already picked when the demo opens, so the "picked" state is visible at once. */
export const DEMO_SONGS_PICKED: readonly string[] = ['Perfect|Ed Sheeran'];

// ─── Papic challenge ────────────────────────────────────────────────────────────────────────────────────────────────

/** A mission id is a demo's own — never a real `papic_missions` id. */
export const DEMO_MISSION_PREFIX = 'demo-';

/**
 * The event's running challenges as a guest's camera reads them (`GuestMissionRow`, the `/api/papic/guest-missions`
 * shape): the shop's own two (its booth mission, worded as the database words it — `boothMissionPrompt` — and a prompt
 * of its own), and one from the couple,
 * so the shop sees where its challenges sit among the rest.
 */
export function demoMissions(shopName: string): GuestMissionRow[] {
  const shop = { vendor_id: `${DEMO_MISSION_PREFIX}shop`, vendor_name: shopName, target_guest_id: null, target_role: null, completed: false, consent_shared: false, library_id: null };
  return [
    { ...shop, mission_id: `${DEMO_MISSION_PREFIX}booth`, mission_type: 'vendor_booth', prompt: boothMissionPrompt(shopName), source: 'vendor', capture_kind: 'photo', board_slot: 1 },
    { ...shop, mission_id: `${DEMO_MISSION_PREFIX}prompt`, mission_type: 'prompt', prompt: `Catch the best moment from ${shopName}`, source: 'vendor', capture_kind: 'photo', board_slot: 2 },
    {
      mission_id: `${DEMO_MISSION_PREFIX}couple`,
      mission_type: 'prompt',
      prompt: 'Catch the lola dancing',
      vendor_id: null,
      vendor_name: null,
      target_guest_id: null,
      target_role: null,
      completed: false,
      consent_shared: false,
      source: 'couple',
      capture_kind: 'photo',
      library_id: null,
      board_slot: 3,
    },
  ];
}

// ─── 3D plan ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A seated guest in the sample room — `Plan3DGuest`'s shape (the 3D scene's guest). */
export type DemoRoomGuest = {
  id: string;
  name: string;
  tableId: string;
  seatNumber: number | null;
  side: 'bride' | 'groom' | 'both';
  photoUrl: null;
  attire: 'gown' | 'suit';
  outfit: null;
  role: GuestRole;
};

export type DemoRoom = { tables: Lab3DTable[]; floor: Lab3DFloor; guests: DemoRoomGuest[]; booths: Lab3DBooth[] };

const DEMO_FIRST = ['Ana', 'Ben', 'Carla', 'Dino', 'Ela', 'Fe', 'Gino', 'Hana', 'Ivo', 'Jo', 'Kat', 'Lito'];

/** The category a sample booth falls back to when none of the shop's services has a booth of its own. */
export const DEMO_BOOTH_FALLBACK_CATEGORY = 'photobooth';

/**
 * The sample reception, long and narrow so a phone sees all of it: six round tables, a stage, a dance floor, a door,
 * guests at every table — and ONE booth, the shop's, beside the dance floor. The booth wears the shop's name and is drawn branded, as the homepage's illustrative room
 * is (`plan3d-demo-actions.ts`): this is a preview of the tool, not a couple's real plan, so it checks no entitlement.
 *
 * `category` is the shop's booth category (the caller resolves it from its services, as `/v/[slug]/booth` does), or
 * null → the fallback, so the room never comes up empty.
 */
export function demoRoom(shopName: string, category: string | null): DemoRoom {
  const tables: Lab3DTable[] = Array.from({ length: 6 }, (_, i) => ({
    id: `${DEMO_MISSION_PREFIX}t${i}`,
    label: `Table ${i + 1}`,
    type: 'round_8',
    shape: 'round',
    capacity: 8,
    removedSeats: [],
    xPct: i % 2 ? 72 : 28,
    yPct: 48 + Math.floor(i / 2) * 18,
    rotationDeg: 0,
    linkGroupId: null,
  }));
  const guests: DemoRoomGuest[] = Array.from({ length: 30 }, (_, i) => {
    const t = tables[i % tables.length]!;
    return {
      id: `${DEMO_MISSION_PREFIX}g${i}`,
      name: DEMO_FIRST[i % DEMO_FIRST.length]!,
      tableId: t.id,
      seatNumber: Math.floor(i / tables.length) + 1,
      side: (['bride', 'groom', 'both'] as const)[i % 3]!,
      photoUrl: null,
      attire: i % 2 ? 'suit' : 'gown',
      outfit: null,
      role: 'guest',
    };
  });
  const booths: Lab3DBooth[] = [
    {
      id: `${DEMO_MISSION_PREFIX}booth`,
      kind: 'custom',
      label: '',
      xPct: 74,
      yPct: 26,
      vendor: { name: shopName, category: category ?? DEMO_BOOTH_FALLBACK_CATEGORY, logoUrl: null, tier: 'pro', slug: null, bookable: false, boothAddonActive: true },
    },
  ];
  return {
    tables,
    floor: {
      venueWidthM: 14,
      venueLengthM: 22,
      stage: { xPct: 50, yPct: 5, wPct: 44, hPct: 6 },
      entrance: { enabled: true, xPct: 50, yPct: 98, kind: 'door', depthM: 3 },
      dance: { enabled: true, xPct: 32, yPct: 24, wPct: 40, hPct: 12 },
      published: true,
    },
    guests,
    booths,
  };
}
