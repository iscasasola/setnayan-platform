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
 *   Chapter   Add to Chapter (Memories by chapter, owner 2026-11-01: "We can add media files inside other chapters on
 *             memories directly") — on a Papic shot only (a guest capture or a seat photo; a supplier's file or a Hub
 *             file cannot sit in a chapter). Drawn for the managers and for a chapter's people; it ACTS when the server
 *             answered that this viewer may move this photo and has a chapter to put it in (`who.chapter`, from
 *             `lib/memories-chapters.ts`) — else it says why. The database re-checks every add
 *             (`papic_memories_set_chapter`).
 *   Hide      the hosts, on a Papic file (`canModerate`) — or, on a supplier's file, that supplier's whole delivery
 *             (the shipped switch). Kept, not deleted. A screened frame's slot is Approve; a hidden one's is Show.
 *   Delete    the hosts, on a Papic file — every copy, never a supplier's or an Event Hub file.
 */
import { ORIGINAL_FROM_DRIVE_LABEL } from '@/lib/papic-originals-reminder-core';
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
  /** Add to Chapter for THIS photo: may this viewer move it (a host, or one of its chapter's people), and is there a
   *  chapter to put it in? Absent = no chapter read (the button explains). */
  chapter?: { canAdd: boolean; why: string | null } | null;
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

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/** The Share panel's one line, and its ⓘ — the full-resolution answer in words, never silently a smaller file. */
export function shareWords(src: ShareSource, item: Pick<MemoriesItem, 'preserved'>): { line: string; tip: string } {
  switch (src.what) {
    case 'original':
      return item.preserved
        ? { line: 'Full resolution · the original', tip: 'The photo as it was taken — Keep full resolution keeps it for good. Location data is removed before it leaves Setnayan.' }
        : {
            line: 'Full resolution · the original',
            tip: 'The photo as it was taken, location data removed. Originals are kept until 3 months after the event’s last day; then the 720p copy stays, free, for life. Copy to Google Drive (free) or save it before then.',
          };
    case 'kept-copy':
      return {
        line: 'The 720p copy, kept for life',
        tip: `The original was replaced by the 720p copy 3 months after the event. If your Google Drive still holds it and is connected, Download gives you the ${lowerFirst(ORIGINAL_FROM_DRIVE_LABEL)}.`,
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
        tip: `The photo as it was taken, location data removed. From 3 months after the event, the original is replaced by the 720p copy — then Download gives you the ${lowerFirst(ORIGINAL_FROM_DRIVE_LABEL)} when your Drive holds it, else the 720p copy.`,
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

/** No chapter to add it to — chapters are made on the Schedule page. */
export const CHAPTER_NONE = 'No chapter to add it to yet';
export const CHAPTER_NONE_TIP =
  'Chapters are made on your Schedule. Once there is one, a photo can sit in more than one chapter — each chapter decides who sees its photos, and when.';
/** The viewer is not one of this photo's chapter's people. */
export const CHAPTER_NOT_IN = 'You can add a photo only from a chapter you are in.';
/** An Unsorted photo is in no chapter — only the hosts place it (they are the ones who see Unsorted). */
export const CHAPTER_UNSORTED_HOSTS = 'Only the hosts can put an Unsorted photo in a chapter.';

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
      // A Papic shot only — the two tables a chapter link can name (`papic_chapter_captures`).
      if (isTaggableTable(item.table) && item.memSource !== 'hub' && (who.host || who.canTag || who.chapter?.canAdd)) {
        const canAdd = who.chapter?.canAdd === true;
        out.push({ key, label: 'Chapter', enabled: canAdd, why: canAdd ? null : (who.chapter?.why ?? CHAPTER_NONE) });
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
