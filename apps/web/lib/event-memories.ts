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


// ── THE ONE PHOTO VIEWER ON MEMORIES (owner 2026-10-27) ───────────────────────────────────────────────────────────

/** A guest the couple can tag in a photo (`photo_tags.guest_id`). */
export type MemoriesPerson = { guestId: string; name: string };
/** Who is tagged where — `"<table>:<id>"` → guest ids. `refused` = a read failed: say so, never "nobody". */
export type MemoriesTags = { people: MemoriesPerson[]; byItem: Record<string, string[]>; refused: boolean };

export const tagKey = (it: { table: string; id: string }) => `${it.table}:${it.id}`;

/** A Papic file the couple can put a name on — `photo_tags.source_table`'s own CHECK (never a supplier or Hub file). */
export function canTag(item: { table: string }): boolean {
  return item.table === 'papic_photos' || item.table === 'papic_guest_captures';
}

/** Delete forever is a Papic file's (camera or guest) — never a supplier's, never the Event Hub's own file. */
export function canDeleteForever(item: { memSource: MemoriesSource; table: string }): boolean {
  return canModerate({ source: item.memSource }) && canTag(item);
}

export type ViewerActionKey = 'download' | 'tag' | 'delete' | 'more';

/**
 * The viewer's icons for one file, in the bar's order — Download · Tag · Delete · ⋯. An action that does not apply is
 * ABSENT, never a dead button: an Event Hub file only downloads ("Used on your Event Hub" — it is managed on the Hub);
 * a supplier's file downloads and offers ⋯ (hide that supplier's photos); a viewer who is not the couple only
 * downloads.
 */
export function viewerActionsFor(
  item: { memSource: MemoriesSource; table: string; canDownload: boolean },
  ctx: { host: boolean; hasSupplier: boolean },
): ViewerActionKey[] {
  const out: ViewerActionKey[] = [];
  if (item.canDownload) out.push('download');
  if (!ctx.host) return out;
  if (canTag(item)) out.push('tag');
  if (canDeleteForever(item)) out.push('delete');
  if (moreFor(item, { hasSupplier: ctx.hasSupplier, guest: false }).length > 0) out.push('more');
  return out;
}

export type MoreKey = 'approve' | 'hide' | 'report' | 'stop' | 'supplier';

/** What ⋯ holds — the photo sheet's moderation that is not on the bar (Hide/Show or Approve · Report · Stop · a supplier's photos). */
export function moreFor(
  item: { memSource: MemoriesSource; table: string; look?: MemoriesLook; guestId?: string | null },
  ctx: { hasSupplier: boolean; guest: boolean },
): MoreKey[] {
  if (item.memSource === 'suppliers') return ctx.hasSupplier ? ['supplier'] : [];
  if (!canDeleteForever(item)) return [];
  const out: MoreKey[] = [item.look === 'screened' ? 'approve' : 'hide'];
  if (item.table === 'papic_guest_captures' && item.look !== 'reported') out.push('report');
  if (item.guestId && item.memSource === 'papic') out.push('stop');
  return out;
}

/**
 * The order the viewer swipes through = the order the grid DRAWS: by challenge in the Challenges album; by the day's
 * moments (then "More") when following the moments; otherwise the filtered list as it stands.
 */
export function displayOrder<T extends { id: string; challengeId: string | null }>(
  shown: readonly T[],
  opts: {
    album: MemoriesAlbumKey;
    challenges: readonly MemoriesChallenge[];
    chapters: ReadonlyArray<{ photoIds: string[] }> | null;
    moments: boolean;
    needsLook: boolean;
  },
): T[] {
  if (opts.album === 'challenges') return challengeGroups(shown, opts.challenges).flatMap((g) => g.items);
  if (opts.moments && opts.chapters && opts.chapters.length > 1 && !opts.needsLook && (opts.album === 'all' || opts.album === 'papic')) {
    const byId = new Map(shown.map((it) => [it.id, it]));
    const used = new Set<string>();
    const out: T[] = [];
    for (const c of opts.chapters) {
      for (const id of c.photoIds) {
        const it = byId.get(id);
        if (it && !used.has(id)) {
          used.add(id);
          out.push(it);
        }
      }
    }
    return [...out, ...shown.filter((it) => !used.has(it.id))];
  }
  return [...shown];
}
