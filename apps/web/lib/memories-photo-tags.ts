/**
 * apps/web/lib/memories-photo-tags.ts — the shapes the Memories viewer's Tag sheet and its one action
 * (`app/dashboard/[eventId]/memories/photo-tag-actions.ts`) pass each other, plus the sheet's pure list logic.
 * Types only and pure functions — imported by the client sheet and the server action alike.
 */
import type { TaggableTable } from '@/lib/memories-viewer';

export type PhotoTagInput = {
  /** 'chapter' = Add to Chapter (Memories by chapter, 2026-11-01) — the same action, so the server-action budget holds. */
  op: 'read' | 'add' | 'remove' | 'chapter';
  table: TaggableTable;
  photoId: string;
  guestId?: string;
  /** op 'chapter': the chapter, and whether the photo goes in (true) or an added link comes out (false). */
  blockId?: string;
  on?: boolean;
};

export type PhotoTagPerson = {
  guestId: string;
  name: string;
  /** Tagged by the face match (a guess the hosts can correct), not by a QR, a pick or the guest. */
  auto: boolean;
};

export type PhotoTagState = {
  /** Who this photo is tagged with now (live tags only). */
  tagged: PhotoTagPerson[];
  /** The event's guests, to add from. */
  guests: { guestId: string; name: string }[];
  /** Guests who said "Not me" on this photo — their objection stands; they are not offered here. */
  saidNotMe: string[];
  /** False when the guest list could not be read to its end — the sheet says so rather than looking complete. */
  complete: boolean;
};

export type PhotoTagResult =
  | { ok: true; state: PhotoTagState }
  /** op 'chapter': the chapters this viewer now sees the photo in (and the ones it was shot in). */
  | { ok: true; state: null; chapters: { in: string[]; shotIn: string[] } }
  | { ok: false; error: string };

/** The people the Add list offers for a search: not already tagged, not a "Not me", matching the words. Capped. */
export function addCandidates(state: PhotoTagState, query: string, cap = 30): { guestId: string; name: string }[] {
  const tagged = new Set(state.tagged.map((t) => t.guestId));
  const refused = new Set(state.saidNotMe);
  const q = query.trim().toLowerCase();
  return state.guests.filter((g) => !tagged.has(g.guestId) && !refused.has(g.guestId) && (!q || g.name.toLowerCase().includes(q))).slice(0, cap);
}
