/**
 * unihome.ts — UNIHOME v5 (owner-approved 23 Nov 2026, DECISION_LOG "UNIHOME v5 APPROVED"; drawing
 * `prototypes/one_profile_page_2026-11-23/unihome-v5.html`): ONE signed-in Home for the whole account — the profile,
 * a sticky row of jump icons, then Events · Shop · People · Memories · Discover on one scroll.
 *
 * This file holds only what the server reader hands the view: plain data, no reads, no React. The reads are
 * `lib/unihome.server.ts` (Shop · People · Memories · Discover) and the Home page itself (Events, which shares the full
 * board's membership reads and landing rule). Every field that came from a read can be `null` = "couldn't read": the
 * view then says so, and a number mark on a jump icon is simply not drawn (never a 0).
 */
import type { SceneCover } from '@/lib/event-poster';
import type { EventStance } from '@/lib/event-board';
import type { DiscoverEventCard } from '@/lib/discover-events-core';

/** The six jump icons, in page order. `you` goes back to the top. */
export const UNIHOME_JUMPS = ['you', 'events', 'shop', 'people', 'memories', 'discover'] as const;
export type UnihomeJump = (typeof UNIHOME_JUMPS)[number];
/** The five parts of the page (every jump but `you`) — their element ids, which the ☰ doors and the icons land on. */
export type UnihomePart = Exclude<UnihomeJump, 'you'>;
export const UNIHOME_PARTS: readonly UnihomePart[] = ['events', 'shop', 'people', 'memories', 'discover'];

export const UNIHOME_JUMP_WORD: Record<UnihomeJump, string> = {
  you: 'You',
  events: 'Events',
  shop: 'Shop',
  people: 'People',
  memories: 'Memories',
  discover: 'Discover',
};

/** Home, at one part — the address every ☰ door and every "back to Home" uses. */
export function unihomeHref(part?: UnihomePart): string {
  return part ? `/dashboard#${part}` : '/dashboard';
}

/** The full Events board (every shelf) — Events' "See all →". */
export const UNIHOME_EVENTS_ALL = '/dashboard?seg=events';

export type UnihomeEventCard = {
  key: string;
  eventId: string;
  stance: EventStance;
  /** "WEDDING" — the type badge, as the board prints it. */
  kind: string;
  title: string;
  /** "Sat 13 Mar 2027 · Tagaytay", or "Date to be set". */
  when: string;
  /** "110 days to go" · "Tomorrow" · "Happening today" — null when there is no date ahead. */
  countdown: string | null;
  /** "12 of 40 done" for an organiser; "Couldn't read your progress" when the read failed; null = nothing to say. */
  progress: string | null;
  /** Organiser and helper: the event dashboard. Invited: null (the card opens the Event Hub). */
  dashboardHref: string | null;
  /** The Event Hub's address, ONLY when guests can open it (Public or Unlisted, with its link — the shipped rule). */
  hubUrl: string | null;
  /** The card's picture — the same scene the board's card wears. */
  scene: { eventType: string; photoSrc: string; ownPhotoSrc: string | null; cover: SceneCover | null };
  /** The organiser's remove sheet needs these (the shipped two-screen sheet). */
  archived: boolean;
};

export type UnihomeEvents = {
  /** Events you organise or help with — the big cards, soonest first. */
  cards: UnihomeEventCard[];
  /** Events you're invited to — one row each. */
  invited: UnihomeEventCard[];
  /** How many more planning events the full board holds beyond those drawn here. */
  more: number;
  /** null = the board's reads were refused: the head says so instead of counting. */
  counts: { planning: number; celebrated: number } | null;
  /** The next "Worth planning" day — null = none ahead; 'unread' = the read was refused. */
  worth: { label: string; day: string } | null | 'unread';
};

export type UnihomeShop =
  | {
      kind: 'owner';
      id: string;
      name: string;
      initials: string;
      logoUrl: string | null;
      /** Public page — "View page ↗". */
      publicHref: string | null;
      /** null = the shop's row could not be read: neither word is drawn. */
      verified: boolean | null;
      /** The shop's own cover (`shopCoverKey`), else its first Online card's photo; null = the wash. */
      coverUrl: string | null;
      /** "N new for your shop" — the account's unread shop notices (`splitSheetUnread`). null = not read. */
      newCount: number | null;
      /** "X of Y service cards online" (`readHomeCardCounts`). null = not read. */
      cards: { cards: number; online: number } | null;
    }
  | { kind: 'helper'; name: string; initials: string; logoUrl: string | null; canOpenShop: boolean }
  | { kind: 'create' }
  /** No shop, may not open one (or the shops read was refused — a duplicate shop is permanent, so it stays closed). */
  | { kind: 'none' };

export type UnihomeFace = { key: string; name: string; initials: string; photoUrl: string | null; href: string };

export type UnihomePeople = {
  /** People waiting on your answer (`waitingRequestCount`). null = not read. */
  asking: number | null;
  /** The people you're connected to — null = not read, or People is not open yet. */
  faces: UnihomeFace[] | null;
};

export type UnihomeMemory = { key: string; title: string; sub: string | null; photoUrl: string; href: string };

/** null = the albums could not be read. */
export type UnihomeMemories = UnihomeMemory[] | null;

export type UnihomeSupplier = {
  key: string;
  name: string;
  sub: string | null;
  coverUrl: string;
  sample: boolean;
  href: string;
};

export type UnihomeDiscover = {
  /** "Upcoming from people you follow" — Discover's own shelf. */
  upcoming: { status: 'ok'; items: DiscoverEventCard[] } | { status: 'unavailable' } | null;
  /** "Suppliers · verified only" — null = the shops read was refused. */
  suppliers: UnihomeSupplier[] | null;
};

/** Initials for a face or a shop mark — up to two letters. */
export function unihomeInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '·';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
}
