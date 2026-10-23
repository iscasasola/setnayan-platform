/**
 * lib/memories-albums.ts — MEMORIES' ALBUMS (owner 2026-10-23, prototype `papic_controller_one_page_2026-10-23.html`
 * "Albums"): one dropdown — All · Papic · Challenges · Event Hub · Suppliers · Your uploads.
 *
 *   · All — every photo and clip, the Event Hub's files among them ("on the gallery as well as a separate album").
 *   · Papic — what the cameras took (crew seats and guests). Your uploads and the suppliers' are their own albums.
 *   · Challenges — the guest photos that answered a challenge, GROUPED BY CHALLENGE in board order, title + count.
 *   · Event Hub — the files the live Hub points at; read-only here ("Used on your Event Hub").
 *
 * "Follow moments in order" groups the photos by the day's moments in schedule order (`lib/alaala-chapters.ts`
 * builds them; this only orders what it is handed). Pure — the component draws it.
 */

export const ALBUM_KEYS = ['all', 'papic', 'challenges', 'hub', 'suppliers', 'uploads'] as const;
export type AlbumKey = (typeof ALBUM_KEYS)[number];

export const ALBUM_LABEL: Record<AlbumKey, string> = {
  all: 'All',
  papic: 'Papic',
  challenges: 'Challenges',
  hub: 'Event Hub',
  suppliers: 'Suppliers',
  uploads: 'Your uploads',
};

export function isAlbumKey(v: unknown): v is AlbumKey {
  return typeof v === 'string' && (ALBUM_KEYS as readonly string[]).includes(v);
}

type Capture = { album: 'papic' | 'uploads' | 'suppliers'; challenge?: { id: string; title: string; order: number } | null };

/** Does this capture belong in the album? (Event Hub files are not captures — the album draws them itself.) */
export function captureInAlbum(p: Capture, album: AlbumKey): boolean {
  if (album === 'all') return true;
  if (album === 'hub') return false;
  if (album === 'challenges') return Boolean(p.challenge);
  return p.album === album;
}

export type ChallengeGroup<T> = { id: string; title: string; photos: T[] };

/** The Challenges album: one group per challenge that has photos, in board order, each group's photos as given. */
export function challengeGroups<T extends Capture>(photos: readonly T[]): ChallengeGroup<T>[] {
  const by = new Map<string, { order: number; group: ChallengeGroup<T> }>();
  for (const p of photos) {
    const c = p.challenge;
    if (!c) continue;
    const at = by.get(c.id) ?? { order: c.order, group: { id: c.id, title: c.title || 'Challenge', photos: [] } };
    at.group.photos.push(p);
    by.set(c.id, at);
  }
  return [...by.values()].sort((a, b) => a.order - b.order).map((x) => x.group);
}

export type Moment = { key: string; label: string; photoIds: string[] };

/**
 * "Follow moments in order": the moments in schedule order, each with ITS photos from `photos` (kept in the order
 * the moment lists them), then whatever no moment holds under "Other moments". A moment with none here is left out.
 */
export function momentGroups<T extends { id: string }>(
  photos: readonly T[],
  moments: readonly Moment[],
): { key: string; label: string; photos: T[] }[] {
  const byId = new Map(photos.map((p) => [p.id, p]));
  const placed = new Set<string>();
  const out: { key: string; label: string; photos: T[] }[] = [];
  for (const m of moments) {
    const list = m.photoIds.flatMap((id) => {
      const p = byId.get(id);
      if (!p || placed.has(id)) return [];
      placed.add(id);
      return [p];
    });
    if (list.length > 0) out.push({ key: m.key, label: m.label, photos: list });
  }
  const rest = photos.filter((p) => !placed.has(p.id));
  if (rest.length > 0) out.push({ key: 'other', label: 'Other moments', photos: rest });
  return out;
}
