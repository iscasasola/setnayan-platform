import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { getGuestLiveGallery } from '@/lib/guest-live-gallery';
import { resolveLargeStillRef, type PapicDisplayRow } from '@/lib/papic-display-ref';
import { fetchMomentGraph } from '@/lib/life-story-moment-graph';
import { lifeStoryEnabled } from '@/lib/life-story-flag';
import { getSwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import {
  lensTotals,
  orderWall,
  surfaceBudget,
  type AlaalaWall,
  type WallFace,
  type WallItem,
} from '@/lib/alaala-wall';

/**
 * lib/alaala-wall-data.ts — the read half of Alaala's memory wall.
 *
 * Pure selection logic (and the reason this exists at all) is in
 * `lib/alaala-wall.ts`; this file only fetches. Split so the five-lenses rule
 * can be unit-tested — a `server-only` module cannot be imported by the node
 * test runner.
 *
 * ── THE READS, AND WHY EACH ONE ────────────────────────────────────────────
 *  · The event list comes from `getSwitcherData`, which is already `cache()`d
 *    and already runs on the launcher for the account switcher. Reusing it
 *    costs ZERO extra queries; a fresh `event_members` read would not.
 *  · OWNED media is read under the viewer's own RLS session.
 *  · ATTENDED media reuses `getGuestLiveGallery`, which returns ONLY the
 *    photos the viewer is TAGGED in, clean and not hidden. Nothing here
 *    widens that gate — an attended frame is, by construction, one the viewer
 *    could already see. Its `null` means the read FAILED and nothing else, so
 *    it maps straight onto `unreadable`.
 *  · FACES come from the moment graph, the SAME source the obsidian tile's
 *    face row uses. Deliberately not re-derived: `/dashboard/library` already
 *    carries a note that a second, drifting source of the same faces is the
 *    defect to avoid.
 *
 * ── `moderation_state = 'clean'`, NOT `!= 'nsfw_blocked'` ──────────────────
 * The column has five values: unscreened · clean · nsfw_blocked ·
 * consent_withheld · faceblock_withheld. This wall AUTO-RENDERS on the home
 * screen, so it takes the strict allowlist every other auto-rendering surface
 * takes (guest-live-gallery, the moment graph, the Alaala orb, download) — not
 * the couple's manage-my-gallery filter, which deliberately shows unscreened
 * rows so a couple can act on them. `hidden_at` is NOT a content proxy.
 *
 * ── A REJECTED QUERY IS NOT A THROWN ERROR ─────────────────────────────────
 * PostgREST answers a phantom column, a stale enum value or a missing grant
 * with `{ data: null, error }` — never a throw. Every read below checks
 * `.error` and raises `unreadable`, because "no photos yet" printed over a
 * REFUSED read is a lie told about somebody's memories.
 */

/** Events fanned out over. Beyond this the wall is still honest, just capped. */
const MAX_EVENTS = 12;
/** Rows pulled per owned table, per event, before ordering. */
const ROWS_PER_TABLE = 60;
/** Frames per attended event (this read is already tag-scoped and small). */
const ROWS_PER_ATTENDED = 24;
/**
 * Frames presigned PER LENS. Presign only what a surface can show — but give
 * each lens its OWN budget, never a shared one. A global cap over a filtered
 * view is a silent filter: see the measured failure in `surfaceBudget`.
 */
const TILES_PER_LENS = 36;

type Ref = {
  key: string;
  storedRef: string;
  isClip: boolean;
  capturedAt: string | null;
  eventId: string;
  eventName: string;
  role: 'couple' | 'guest';
};

/**
 * Request-scoped moment graph — the ONE source of faces on the home.
 *
 * The obsidian tile's face row and the People lens both call this, so they
 * cannot disagree and the graph is fetched once per request. `/dashboard/library`
 * already carries the note that a second, drifting source of the same faces is
 * the defect to avoid; this is how that stays true now that two components want
 * them.
 */
export const getMomentGraphForWall = cache(async (userId: string) => {
  const supabase = await createClient();
  return await fetchMomentGraph(supabase, userId);
});

/**
 * The viewer's own guest rows — the bridge that makes "With me" answerable.
 *
 * A tag names a `guest_id`, not a user. The viewer is reachable two ways: a
 * membership that carries a guest_id, or a guest row linked to the person node
 * they have claimed. Both are read; neither is assumed. When neither resolves,
 * "With me" is honestly empty rather than quietly equal to "Owned".
 */
async function viewerGuestIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  eventIds: string[],
): Promise<{ ids: string[]; unreadable: boolean }> {
  const ids = new Set<string>();
  let unreadable = false;

  const memberRes = await supabase
    .from('event_members')
    .select('guest_id')
    .eq('user_id', userId)
    .not('guest_id', 'is', null);
  if (memberRes.error) unreadable = true;
  for (const row of memberRes.data ?? []) {
    const id = (row as { guest_id: string | null }).guest_id;
    if (id) ids.add(id);
  }

  const personRes = await supabase
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (personRes.error) unreadable = true;
  const personId = (personRes.data as { person_id: string } | null)?.person_id ?? null;

  if (personId && eventIds.length > 0) {
    const guestRes = await supabase
      .from('guests')
      .select('guest_id')
      .eq('person_id', personId)
      .in('event_id', eventIds);
    if (guestRes.error) unreadable = true;
    for (const row of guestRes.data ?? []) {
      const id = (row as { guest_id: string }).guest_id;
      if (id) ids.add(id);
    }
  }

  return { ids: [...ids], unreadable };
}

/** OWNED media for one event, under the viewer's RLS session. */
async function ownedRefs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  event: { event_id: string; display_name: string },
): Promise<{ refs: Ref[]; unreadable: boolean; saturated: boolean }> {
  const [photoRes, captureRes] = await Promise.all([
    supabase
      .from('papic_photos')
      .select('photo_id, r2_object_key, display_r2_key, thumb_r2_key, poster_r2_key, photo_type, captured_at')
      .eq('event_id', event.event_id)
      .eq('moderation_state', 'clean')
      .is('hidden_at', null)
      .order('captured_at', { ascending: false })
      .limit(ROWS_PER_TABLE),
    supabase
      .from('papic_guest_captures')
      .select('capture_id, r2_object_key, display_r2_key, thumb_r2_key, poster_r2_key, media_type, captured_at')
      .eq('event_id', event.event_id)
      .eq('moderation_state', 'clean')
      .is('hidden_at', null)
      .order('captured_at', { ascending: false })
      .limit(ROWS_PER_TABLE),
  ]);

  const unreadable = Boolean(photoRes.error) || Boolean(captureRes.error);

  const refs: Ref[] = [];
  for (const row of (photoRes.data ?? []) as Record<string, unknown>[]) {
    const isClip = row.photo_type === 'clip';
    // DISPLAY resolution, not thumb. A hand-rolled picker here preferred
    // `thumb_r2_key` — 320px q50, built for 80px album strips — and the wall
    // renders 105–192 CSS px squares, i.e. 310–383 device px, upscaling
    // 1.3×–1.6×. Owner, on seeing it: "the photos are pixelated."
    const storedRef = resolveLargeStillRef(row as PapicDisplayRow);
    if (!storedRef) continue;
    refs.push({
      key: `papic_photos:${row.photo_id as string}`,
      storedRef,
      isClip,
      capturedAt: (row.captured_at as string | null) ?? null,
      eventId: event.event_id,
      eventName: event.display_name,
      role: 'couple',
    });
  }
  for (const row of (captureRes.data ?? []) as Record<string, unknown>[]) {
    const isClip = row.media_type === 'clip';
    const storedRef = resolveLargeStillRef(row as PapicDisplayRow);
    if (!storedRef) continue;
    refs.push({
      key: `papic_guest_captures:${row.capture_id as string}`,
      storedRef,
      isClip,
      capturedAt: (row.captured_at as string | null) ?? null,
      eventId: event.event_id,
      eventName: event.display_name,
      role: 'couple',
    });
  }

  // Either table coming back exactly full means there may be more behind it —
  // so any total derived from this read is "at least", never a total.
  const saturated =
    (photoRes.data ?? []).length >= ROWS_PER_TABLE ||
    (captureRes.data ?? []).length >= ROWS_PER_TABLE;
  return { refs, unreadable, saturated };
}

/**
 * ATTENDED media for one event. `getGuestLiveGallery` presigns its own URLs, so
 * these arrive already resolved and pass through the shared presign step
 * unchanged (`parseStoredAsset` returns them verbatim as legacy URLs).
 */
async function attendedRefs(
  userId: string,
  event: { event_id: string; display_name: string },
): Promise<{ refs: Ref[]; unreadable: boolean; saturated: boolean }> {
  const admin = createAdminClient();
  // .error is checked, not discarded: a refused membership read here used to be
  // indistinguishable from "not a guest", and the lens then stated the viewer
  // had attended nothing.
  const { data: member, error } = await admin
    .from('event_members')
    .select('guest_id')
    .eq('event_id', event.event_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { refs: [], unreadable: true, saturated: false };
  const guestId = (member?.guest_id as string | null | undefined) ?? null;
  if (!guestId) return { refs: [], unreadable: false, saturated: false };

  // `prefer: 'display'` or half this wall stays soft: attended frames arrive
  // already presigned, so the resolution is chosen inside that function, not
  // here. Its default stays 'thumb' for the venue-WiFi day-of grid.
  const gallery = await getGuestLiveGallery(event.event_id, guestId, ROWS_PER_ATTENDED, {
    prefer: 'display',
  });
  // `null` now means ONE thing: the read failed. The ordinary "this guest has
  // no tags yet" comes back as a real, empty result, so raising the banner here
  // no longer cries wolf at the entire guest population — which is exactly why
  // this was left as `unreadable: false` when the wall shipped, and why it
  // could be closed once that contract was made honest.
  if (!gallery) return { refs: [], unreadable: true, saturated: false };

  const refs: Ref[] = gallery.photos.map((p) => ({
    key: `${p.sourceTable}:${p.id}`,
    storedRef: p.url,
    isClip: false,
    capturedAt: p.capturedAt,
    eventId: event.event_id,
    eventName: event.display_name,
    role: 'guest' as const,
  }));
  return { refs, unreadable: false, saturated: gallery.total > gallery.photos.length };
}

/** Faces, from the moment graph — the tile's own source, fetched once. */
async function wallFaces(
  userId: string,
): Promise<{ faces: WallFace[]; measured: boolean }> {
  if (!lifeStoryEnabled()) return { faces: [], measured: false };
  try {
    const graph = await getMomentGraphForWall(userId);
    const faces = graph.people
      // An unnamed ephemeral guest is not a face; the graph keeps it for
      // presence counting, the People lens must not render it as a person.
      .filter((p) => !(p.personId.startsWith('guest:') && p.displayName === 'Someone'))
      .map((p) => ({
        key: p.personId,
        displayName: p.displayName,
        inMemoriam: p.inMemoriam,
        eventCount: p.recurrence,
      }))
      .sort((a, b) => b.eventCount - a.eventCount || a.displayName.localeCompare(b.displayName));
    return { faces, measured: true };
  } catch {
    // A failed graph is NOT "nobody was there" — say we could not measure.
    return { faces: [], measured: false };
  }
}

/**
 * The whole wall for one account. `cache()`d so the home can render five lens
 * bodies from ONE read, and so a surface that mounts it twice pays once.
 */
export const getAlaalaWall = cache(async (userId: string): Promise<AlaalaWall> => {
  const supabase = await createClient();

  let events: Array<{ event_id: string; display_name: string; role: 'couple' | 'guest' }> = [];
  let unreadable = false;
  let partial = false;
  let allEvents = 0;
  try {
    const switcher = await getSwitcherData(userId);
    allEvents = switcher.events.length;
    events = switcher.events.slice(0, MAX_EVENTS).map((e) => ({
      event_id: e.event_id,
      display_name: e.display_name,
      role: e.role,
    }));
  } catch {
    unreadable = true;
  }
  // More events than we fanned out over ⇒ every total below is "at least".
  if (allEvents > events.length) partial = true;

  const ownedIds = events.filter((e) => e.role === 'couple').map((e) => e.event_id);
  const hasAttendedEvents = events.some((e) => e.role === 'guest');

  const [perEvent, tagged, faces] = await Promise.all([
    Promise.all(
      events.map(async (event) => {
        try {
          if (event.role === 'couple') return await ownedRefs(supabase, event);
          return await attendedRefs(userId, event);
        } catch {
          // One bad event never empties the whole wall — but it is not silence.
          return { refs: [] as Ref[], unreadable: true, saturated: false };
        }
      }),
    ),
    taggedKeys(supabase, userId, ownedIds),
    wallFaces(userId),
  ]);

  const refs: Ref[] = [];
  for (const chunk of perEvent) {
    if (chunk.unreadable) unreadable = true;
    if (chunk.saturated) partial = true;
    refs.push(...chunk.refs);
  }
  if (tagged.unreadable) unreadable = true;

  // ORDER AND COUNT ON THE FULL SET — then budget PER LENS.
  // The first cut sliced the merged list to a single global cap and filtered
  // afterwards, which emptied Attended and With me over frames it had already
  // read. `totals` therefore come from `ordered` (uncapped) and never from the
  // budgeted `items`.
  const ordered = orderWall(
    refs.map((r) => ({
      key: r.key,
      url: '',
      isClip: r.isClip,
      capturedAt: r.capturedAt,
      eventId: r.eventId,
      eventName: r.eventName,
      role: r.role,
      // An attended frame IS a tagged frame — that is the only way it was read.
      withMe: r.role === 'guest' || tagged.keys.has(r.key),
    })),
  );
  const totals = lensTotals(ordered, faces.faces.length);
  const surfaced = surfaceBudget(ordered, TILES_PER_LENS);

  const byKey = new Map(refs.map((r) => [r.key, r.storedRef]));
  const signed = await Promise.all(
    surfaced.map(async (item) => {
      try {
        const url = await displayUrlForStoredAsset(byKey.get(item.key) ?? null);
        return url ? { ...item, url } : null;
      } catch {
        return null;
      }
    }),
  );

  // Drop the ref AND its item together. Never zip a filtered URL list back
  // against the unfiltered refs — one null silently shifts every later frame
  // onto the wrong photo.
  const items: WallItem[] = signed.filter((i): i is WallItem => i !== null);
  // A frame that was read but could not be resolved to a fetchable URL is a
  // memory going missing with no error anywhere. Say so rather than serving a
  // quietly shorter wall.
  if (items.length < surfaced.length) unreadable = true;

  return {
    items,
    totals,
    partial,
    hasAttendedEvents,
    faces: faces.faces,
    unreadable,
    facesMeasured: faces.measured,
  };
});

/** The frames the viewer is tagged in, across their OWN events. */
async function taggedKeys(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  ownedEventIds: string[],
): Promise<{ keys: Set<string>; unreadable: boolean }> {
  if (ownedEventIds.length === 0) return { keys: new Set(), unreadable: false };

  const { ids, unreadable: idsUnreadable } = await viewerGuestIds(
    supabase,
    userId,
    ownedEventIds,
  );
  if (ids.length === 0) return { keys: new Set(), unreadable: idsUnreadable };

  const { data, error } = await supabase
    .from('photo_tags')
    .select('source_table, source_id')
    .in('event_id', ownedEventIds)
    .in('guest_id', ids)
    .is('removed_at', null);

  const keys = new Set<string>();
  for (const row of (data ?? []) as Array<{ source_table: string; source_id: string }>) {
    keys.add(`${row.source_table}:${row.source_id}`);
  }
  return { keys, unreadable: idsUnreadable || Boolean(error) };
}
