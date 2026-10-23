/**
 * event-memories.ts — THE ALBUMS OF AN EVENT'S MEMORIES (pure; the server read is `event-memories.server.ts`).
 *
 * Owner, 2026-10-23: *"Gallery is the collection of the files for that event"* · *"the media files uploaded on event
 * hub [are] on the gallery as well as a separate album"* · and, of the challenges, *"on the memories. a place for the
 * papic challenges also. how they are categorized."* Approved: `prototypes/papic_controller_one_page_2026-10-23.html`
 * (Albums ▾) + the controller's call for Challenges (2026-10-23):
 *
 *   All · Papic · Challenges · Event Hub · Suppliers · Your uploads
 *
 *   Papic        every frame a guest or a camera took (not the host's own uploads, not a supplier's)
 *   Challenges   the frames that answered a challenge, grouped BY CHALLENGE in the board's order
 *   Event Hub    the files the Event Hub itself uses — shown, never managed here ("Used on your Event Hub")
 *   Suppliers    what a booked supplier shot on the day
 *   Your uploads the host's own uploads (the uploads camera)
 *
 * Pure: `event-memories.test.ts`.
 */

import type { GalleryPhoto } from '@/lib/papic-gallery';

/** One file in an event's Memories — a gallery frame plus where it came from and the host's mark on it. */
export type MemoriesItem = GalleryPhoto & {
  memSource: MemoriesSource;
  look: MemoriesLook;
  /** The table a moderation action names — 'hub' for an Event Hub file, which is never moderated here. */
  table: 'papic_photos' | 'papic_guest_captures' | 'vendor_papic_captures' | 'hub';
  challengeId: string | null;
  /** An Event Hub file's place on the Hub ("Cover photo", "Background", …). */
  hubUse: string | null;
};

export const MEMORIES_ALBUMS = [
  { key: 'all', label: 'All' },
  { key: 'papic', label: 'Papic' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'hub', label: 'Event Hub' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'uploads', label: 'Your uploads' },
] as const;

export type MemoriesAlbumKey = (typeof MEMORIES_ALBUMS)[number]['key'];
/** Where a file came from — every file has exactly one; Challenges is a VIEW over Papic, not a source. */
export type MemoriesSource = 'papic' | 'hub' | 'suppliers' | 'uploads';
/** The host's mark on a file: shown · withheld by the content screen · reported · hidden by the host. */
export type MemoriesLook = 'ok' | 'screened' | 'reported' | 'hidden';

export function isMemoriesAlbum(v: unknown): v is MemoriesAlbumKey {
  return typeof v === 'string' && MEMORIES_ALBUMS.some((a) => a.key === v);
}

export type AlbumMember = { source: MemoriesSource; challengeId: string | null };

export function inAlbum(item: AlbumMember, album: MemoriesAlbumKey): boolean {
  if (album === 'all') return true;
  if (album === 'challenges') return item.challengeId !== null;
  return item.source === album;
}

/** "Needs a look" — what only the host can clear: a frame the screen withheld, or one somebody reported. */
export function needsALook(item: { look: MemoriesLook }): boolean {
  return item.look === 'screened' || item.look === 'reported';
}

/** Moderation (Hide · Report · Stop · Approve · Delete) is for Papic files only — never a Hub or a supplier file. */
export function canModerate(item: { source: MemoriesSource }): boolean {
  return item.source === 'papic' || item.source === 'uploads';
}

export type MemoriesChallenge = {
  id: string;
  /** The prompt guests saw. */
  title: string;
  /** The supplier who added it — said in the ⓘ, never in the header (controller 2026-10-23). */
  supplier: string | null;
};

/**
 * The Challenges album: one group per challenge, in the BOARD'S order (`challenges` arrives already in that order —
 * `board_slot`, then created), only challenges somebody answered, each with its frames in the order given.
 */
export function challengeGroups<T extends { challengeId: string | null }>(
  items: readonly T[],
  challenges: readonly MemoriesChallenge[],
): { challenge: MemoriesChallenge; items: T[] }[] {
  const by = new Map<string, T[]>();
  for (const it of items) {
    if (!it.challengeId) continue;
    const list = by.get(it.challengeId);
    if (list) list.push(it);
    else by.set(it.challengeId, [it]);
  }
  return challenges.flatMap((c) => {
    const list = by.get(c.id);
    return list && list.length > 0 ? [{ challenge: c, items: list }] : [];
  });
}

/** The count line: "1,284 photos" · "4 files" for the Event Hub (they are the Hub's files, not shots). */
export function albumCountWords(n: number, album: MemoriesAlbumKey, format: (n: number) => string): string {
  if (album === 'hub') return `${format(n)} ${n === 1 ? 'file' : 'files'}`;
  return `${format(n)} ${n === 1 ? 'photo' : 'photos'}`;
}


/** Folders of this event's media that the Event Hub draws as pictures (`events/<id>/<folder>/…`). */
const HUB_IMAGE_FOLDERS: Readonly<Record<string, string>> = {
  'landing-page-hero': 'Cover photo',
  'main-background': 'Background',
  'std-background': 'Background',
  'scene-background': 'Scene photo',
  'our-photos': 'Our photos',
  'love-story': 'Love story',
};
const IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif|heic)$/i;

/** Every image ref in a JSON value that sits in THIS event's own Hub folders — nothing else is ever presigned. */
export function hubImageRefs(value: unknown, eventId: string): { ref: string; use: string }[] {
  const out = new Map<string, string>();
  const prefix = `/events/${eventId}/`;
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      if (!v.startsWith('r2://') || !IMAGE_EXT.test(v.split('?')[0]!)) return;
      const at = v.indexOf(prefix);
      if (at < 0) return;
      const folder = v.slice(at + prefix.length).split('/')[0] ?? '';
      const use = HUB_IMAGE_FOLDERS[folder];
      if (use && !out.has(v)) out.set(v, use);
      return;
    }
    if (Array.isArray(v)) for (const x of v) walk(x);
    else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x);
  };
  walk(value);
  return [...out].map(([ref, use]) => ({ ref, use }));
}

