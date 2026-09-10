/**
 * THE PAGES A READER IS SHOWN — step 5's one read (`10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`).
 *
 * The public story draws a sheet for every moment the host arranged by hand. This is where those
 * sheets are fetched and their images turned into addresses — and NOTHING ELSE on the public page
 * reads the arrangement.
 *
 * 🔒 SERVICE-ROLE READS ARE OUTSIDE EVERY RLS RULE. `/[slug]` renders with the admin client, so
 * the only fence between a stranger and a guest's photograph here is the one step 3 built:
 * `loadStoryArrangement` reads the story's audience off the arrangement's own row (the guests'
 * layer, S3) and builds the pool through the consent veto (S14). This module never reads the
 * column itself, and never hands an image address to anything that did not come out of that pool.
 *
 * Takes the admin client and the URL signer as PARAMETERS (type-only imports) so its guard can run
 * the whole path — read, gate, sign, draw — against a stand-in. The house pattern from
 * `story-cover.ts`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { loadStoryArrangement } from './story-arrangement-store';
import { sheetsOf, type Sheet, type SheetWords } from './story-sheet';
import type { StoryViewer } from './who-can-see-your-story';

export type DrawnPhoto = {
  kind: 'photo' | 'snippet';
  id: string;
  ref: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The image to draw — a photo, or a snippet's still. */
  src: string | null;
  /** A snippet's playable copy. */
  playSrc: string | null;
};

export type DrawnSheet = Omit<Sheet, 'objects'> & { objects: Array<DrawnPhoto | SheetWords> };

/** Turns a stored key into an address an `<img>` can load, or null. */
export type ResolveUrl = (storedKey: string) => Promise<string | null>;

/**
 * The arranged sheets for THIS viewer, with their images signed. Never throws: a story whose
 * arrangement cannot be read renders exactly as it did before there was one.
 */
export async function loadStoryPages(
  admin: SupabaseClient,
  eventId: string,
  viewer: StoryViewer,
  resolveUrl: ResolveUrl,
): Promise<DrawnSheet[]> {
  let sheets: Sheet[];
  try {
    sheets = sheetsOf(await loadStoryArrangement(admin, eventId, viewer));
  } catch {
    return [];
  }
  if (sheets.length === 0) return [];

  // Sign each key once, all at once — a page of forty photographs is forty round trips otherwise.
  const keys = new Set<string>();
  for (const s of sheets) {
    for (const o of s.objects) {
      if (o.kind === 'words') continue;
      if (o.stillKey) keys.add(o.stillKey);
      if (o.kind === 'snippet' && o.playKey) keys.add(o.playKey);
    }
  }
  const list = [...keys];
  const signed = await Promise.all(list.map((k) => resolveUrl(k).catch(() => null)));
  const urlOf = new Map(list.map((k, i) => [k, signed[i] ?? null] as const));

  const out: DrawnSheet[] = [];
  for (const s of sheets) {
    const objects: DrawnSheet['objects'] = [];
    for (const o of s.objects) {
      if (o.kind === 'words') {
        objects.push(o);
        continue;
      }
      const src = o.stillKey ? (urlOf.get(o.stillKey) ?? null) : null;
      const playSrc = o.kind === 'snippet' && o.playKey ? (urlOf.get(o.playKey) ?? null) : null;
      // Nothing to draw → not drawn (see `sheetsOf`): no empty frame on a guest's page.
      if (!src && !playSrc) continue;
      objects.push({ kind: o.kind, id: o.id, ref: o.ref, x: o.x, y: o.y, w: o.w, h: o.h, src, playSrc });
    }
    if (objects.length > 0) out.push({ ...s, objects });
  }
  return out;
}
