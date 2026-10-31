/**
 * apps/web/lib/memories-viewer.ts — THE MEMORIES PHOTO VIEWER'S RULES: which buttons, in which order, for whom, and
 * which FILE a Share hands over. Pure, so `memories-viewer.test.ts` executes every row.
 *
 * Owner 2026-10-30 (live iPhone, on the old "YOUR UPLOAD" sheet — a tiny thumbnail and a list of rows):
 *   *"the preview is wrong and the buttons are not arranged properly to our design template. like how we open
 *   inspiration photos but with the buttons for memories. Share, Hide, Delete, Tag, Add to Chapter. this is not the
 *   arrangement sequence but these are the buttons i want."*
 * Order (controller's call, logged): Share · Tag · Add to Chapter · Hide · Delete — the destructive one last.
 * And the same day: *"download means we download the high res and not the preview"*.
 *
 * 🔒 WHO SEES WHICH — today's permissions, unchanged:
 *   Share     the file the viewer may already take away (`shareSourceOf`): a photo's full-res save route (the hosts —
 *             the route itself refuses anyone else), a clip's kept original, an Event Hub file.
 *   Tag       whoever manages the Memories rules (hosts + the coordinator, `memoriesManagerRole`), on the two photo
 *             tables a tag can name (`photo_tags.source_table`). Re-checked on the server.
 *   Chapter   the same managers (2026-10-30 ruling: "hosts and coordinators … settings AND chapter uploads") — drawn,
 *             but your own chapters are not built (no storage for a photo's chapter yet): it says so instead of acting.
 *   Hide      the hosts, on a Papic file (`canModerate`) — or, on a supplier's file, that supplier's whole delivery
 *             (the shipped switch). Kept, not deleted. A screened frame's slot is Approve; a hidden one's is Show.
 *   Delete    the hosts, on a Papic file — every copy, never a supplier's or an Event Hub file.
 */
import { canModerate, type MemoriesItem } from '@/lib/event-memories';

/** 🔒 THE ORDER — the owner's five, destructive last. */
export const MEMORIES_VIEWER_ORDER = ['share', 'tag', 'chapter', 'hide', 'delete'] as const;
export type ViewerButtonKey = (typeof MEMORIES_VIEWER_ORDER)[number];

/** The photo tables a tag can name — `photo_tags.source_table`'s CHECK. A supplier's file or a Hub file cannot be tagged. */
export const TAGGABLE_TABLES = ['papic_photos', 'papic_guest_captures'] as const;
export type TaggableTable = (typeof TAGGABLE_TABLES)[number];
export function isTaggableTable(t: unknown): t is TaggableTable {
  return t === 'papic_photos' || t === 'papic_guest_captures';
}

export type ViewerWho = {
  /** A host of the event (the couple + every co-host — `event_members.member_type = 'couple'`). */
  host: boolean;
  /** Manages the Memories rules (hosts + the coordinator) — the server's answer, `memoriesManagerRole`. */
  canTag: boolean;
  /** For a supplier's file: whether the couple has hidden that supplier's whole delivery (null = not a booked supplier). */
  supplierHidden?: boolean | null;
};

export type ViewerButton = {
  key: ViewerButtonKey;
  label: string;
  /** False = drawn, but pressing it explains (`why`) instead of acting. */
  enabled: boolean;
  why: string | null;
};

/**
 * 📦 WHAT A SHARE HANDS OVER — owner 2026-10-30: *"download means we download the high res and not the preview"*.
 *
 * 🔒 NEVER `url`, `largeUrl` or `viewUrl` — those are the grid's and the screen's compressed copies. A photo shares
 * through `saveUrl` (the same-origin save route: the ORIGINAL, location removed; the route falls back to the 1280
 * copy only once the original itself is gone), a clip through `downloadUrl` (its kept original, else its web copy),
 * an Event Hub file through `downloadUrl` (the file as uploaded — it has no other).
 */
export type ShareWhat = 'original' | 'kept-copy' | 'clip-original' | 'clip-web-copy' | 'hub-file' | 'shared-copy' | 'host-save';
export type ShareSource = { url: string; what: ShareWhat; baseName: string };

export function shareSourceOf(
  item: Pick<MemoriesItem, 'id' | 'kind' | 'memSource' | 'saveUrl' | 'downloadUrl' | 'alreadyCompressed'>,
  who: Pick<ViewerWho, 'host'>,
): ShareSource | null {
  const baseName = `setnayan-${item.kind === 'clip' ? 'clip' : 'photo'}-${item.id}`;
  if (item.memSource === 'hub') return item.downloadUrl ? { url: item.downloadUrl, what: 'hub-file', baseName } : null;
  if (item.kind === 'clip') {
    return item.downloadUrl
      ? { url: item.downloadUrl, what: item.alreadyCompressed ? 'clip-web-copy' : 'clip-original', baseName }
      : null;
  }
  // The save route answers the hosts only (it re-checks `member_type = 'couple'`) — so only they are offered it.
  if (!who.host || !item.saveUrl) return null;
  return { url: item.saveUrl, what: item.alreadyCompressed ? 'kept-copy' : 'original', baseName };
}

/** The Share panel's one line, and its ⓘ — the full-resolution answer in words, never silently a smaller file. */
export function shareWords(src: ShareSource, item: Pick<MemoriesItem, 'preserved'>): { line: string; tip: string } {
  switch (src.what) {
    case 'original':
      return item.preserved
        ? { line: 'Full resolution · the original', tip: 'The photo as it was taken — Keep full resolution keeps it for good. Location data is removed before it leaves Setnayan.' }
        : {
            line: 'Full resolution · the original',
            tip: 'The photo as it was taken, location data removed. Keep full resolution (in ⚙) is off, so after 6 months only a smaller copy stays — share or save it before then.',
          };
    case 'kept-copy':
      return {
        line: 'The best copy left · 1280 px',
        tip: 'Full resolution wasn’t kept for this photo — the original was replaced by a smaller copy after 6 months. This is that copy. Keep full resolution (in ⚙) keeps every original.',
      };
    case 'clip-original':
      return { line: 'Full resolution · the original clip', tip: 'The clip as it was recorded.' };
    case 'clip-web-copy':
      return { line: 'The web copy of this clip', tip: 'The original clip wasn’t kept, so this is the copy that plays here.' };
    case 'hub-file':
      return { line: 'The file on your Event Hub', tip: 'The file as it was added to your Event Hub — it has no larger copy.' };
    case 'host-save':
      return {
        line: 'Full resolution · the original',
        tip: 'The photo as it was taken, location data removed. Where Keep full resolution was off and 6 months have passed, the original was replaced by a smaller copy — then this is the best copy left (1280 px).',
      };
    case 'shared-copy':
      return {
        line: 'The copy shared with you',
        tip: 'A guest’s Memories hold the copy the event shared with you, not the full-resolution original — the original stays with the hosts.',
      };
  }
}

/** The extension a shared file is named with, from the type the server actually sent (a dropped original is AVIF). */
export function shareExtension(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('avif')) return 'avif';
  if (t.includes('webp')) return 'webp';
  if (t.includes('png')) return 'png';
  if (t.includes('heic')) return 'heic';
  if (t.includes('webm')) return 'webm';
  if (t.includes('quicktime')) return 'mov';
  if (t.includes('mp4')) return 'mp4';
  if (t.startsWith('video/')) return 'mp4';
  return 'jpg';
}

export const CHAPTER_NOT_YET = 'Chapters you make arrive soon';
export const CHAPTER_NOT_YET_TIP =
  'Today Memories follows your schedule’s moments by itself (⚙ › Follow the moments in order). Making your own chapters, and moving a photo into one, comes next.';

/** The hidden/screened words for a Share the save route would refuse. */
export const SHARE_HELD_WHY = 'Show it in Memories first — a hidden photo isn’t shared.';

/** The buttons this viewer sees on this file, in the owner's order. Absent = not theirs to see. */
export function viewerButtons(
  item: Pick<MemoriesItem, 'id' | 'kind' | 'memSource' | 'table' | 'look' | 'saveUrl' | 'downloadUrl' | 'alreadyCompressed'>,
  who: ViewerWho,
): ViewerButton[] {
  const out: ViewerButton[] = [];
  const papicFile = canModerate({ source: item.memSource }) && isTaggableTable(item.table);
  const held = item.look === 'hidden' || item.look === 'screened';
  for (const key of MEMORIES_VIEWER_ORDER) {
    if (key === 'share') {
      const src = shareSourceOf(item, who);
      if (!src) continue;
      // The save route serves a shown, clean photo only — a held one would answer "not found", so it says why first.
      const refused = item.kind === 'photo' && item.memSource !== 'hub' && held;
      out.push({ key, label: 'Share', enabled: !refused, why: refused ? SHARE_HELD_WHY : null });
    } else if (key === 'tag') {
      if (who.canTag && isTaggableTable(item.table)) out.push({ key, label: 'Tag', enabled: true, why: null });
    } else if (key === 'chapter') {
      if ((who.host || who.canTag) && item.memSource !== 'hub') {
        out.push({ key, label: 'Chapter', enabled: false, why: CHAPTER_NOT_YET });
      }
    } else if (key === 'hide') {
      if (who.host && papicFile) {
        out.push({ key, label: item.look === 'screened' ? 'Approve' : item.look === 'hidden' ? 'Show' : 'Hide', enabled: true, why: null });
      } else if (who.host && item.memSource === 'suppliers' && who.supplierHidden != null) {
        out.push({ key, label: who.supplierHidden ? 'Show' : 'Hide', enabled: true, why: null });
      }
    } else if (key === 'delete') {
      if (who.host && papicFile) out.push({ key, label: 'Delete', enabled: true, why: null });
    }
  }
  return out;
}

/**
 * 📤 THE ACCOUNT'S MEMORIES (`/dashboard/library`) — the same rule, on a wall frame (`WallItem`): a frame from YOUR
 * event shares through the hosts' save route (the original, location removed); a frame from an event you attended
 * shares the copy you were already given to open — the original stays with the hosts, and the panel says so. A clip
 * of your own has no save route (the route refuses clips), so it offers no Share — as the page offered none.
 */
export function wallShareSourceOf(item: { key: string; url: string; isClip: boolean; role: 'couple' | 'guest'; eventId: string }): ShareSource | null {
  const [table, id] = item.key.split(':');
  if (!id) return null;
  const baseName = `setnayan-${item.isClip ? 'clip' : 'photo'}-${id}`;
  if (item.role === 'guest') return item.url ? { url: item.url, what: 'shared-copy', baseName } : null;
  if (item.isClip || !isTaggableTable(table)) return null;
  const src = table === 'papic_photos' ? 'seat' : 'guest';
  return {
    url: `/dashboard/${encodeURIComponent(item.eventId)}/studio/papic/save-photo?id=${encodeURIComponent(id)}&src=${src}`,
    what: 'host-save',
    baseName,
  };
}
