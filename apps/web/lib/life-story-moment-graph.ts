/**
 * Life Story · MomentGraph builder — own-events aggregation (Phase 1).
 *
 * Build plan §4: ~/Documents/Claude/Projects/Setnayan/03_Strategy/Life_Story_Build_Plan_2026-07-08.md
 *
 * Two layers, deliberately split:
 *   · assembleMomentGraph(raw, viewer) — a PURE core (unit-tested): person
 *     linking, burst clustering, coverage windows, recurrence, scoring.
 *   · fetchMomentGraph(supabase, userId) — the thin RLS-client query layer
 *     that feeds it. Runs under the USER's anon client, so row access is
 *     RLS-bounded by construction.
 *
 * SCOPE GUARD (load-bearing): events are selected via
 * event_members.member_type = 'couple' — the viewer's OWN celebrations only.
 * Events merely attended, and any person_story_items read, are Phase 1.5
 * (counsel-gated) and are a PR-blocker here by plan.
 *
 * Sparse dignity: events with zero captures still appear in graph.events
 * (with heroImageUrl) so the UI can render "chapter cards" — the graph never
 * reads as a rebuke for having few photos. (Plan §4 named this a low-weight
 * moment; implemented as events[] metadata instead so scoring stays media-only.)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CapturedBy,
  Moment,
  MomentGraph,
  MomentGraphEvent,
  MomentGraphViewer,
  MomentPerson,
} from './life-story-types';
import { scoreMoments } from './life-story-significance';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Same capturer, ≤ this gap between frames → one burst (one beat/tile). */
export const CLUSTER_GAP_MS = 20_000;
/** Distinct capturers within ± this window count toward a moment's coverage. */
export const COVERAGE_WINDOW_MS = 90_000;
/** Per-table fetch ceilings — Phase-1 volumes are one user's own events. */
const MAX_ROWS_PER_MEDIA_TABLE = 1_200;
const MAX_TAG_ROWS = 5_000;

// ---------------------------------------------------------------------------
// Raw row shapes (what the queries return / what the pure core consumes)
// ---------------------------------------------------------------------------

export type RawEvent = {
  event_id: string;
  display_name: string;
  event_type: string;
  event_date: string | null;
  landing_page_hero_image_url: string | null;
};
export type RawPhoto = {
  photo_id: string;
  event_id: string;
  r2_object_key: string;
  photo_type: 'photo' | 'clip';
  captured_at: string;
  captured_by_person_id: string | null;
};
export type RawGuestCapture = {
  capture_id: string;
  event_id: string;
  guest_id: string;
  r2_object_key: string | null;
  captured_at: string;
};
export type RawTag = {
  source_table: 'papic_photos' | 'papic_guest_captures';
  source_id: string;
  guest_id: string;
};
export type RawGuest = {
  guest_id: string;
  event_id: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
  person_id: string | null;
};
export type RawPerson = {
  person_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  in_memoriam: boolean;
};

export type RawInputs = {
  events: RawEvent[];
  photos: RawPhoto[];
  guestCaptures: RawGuestCapture[];
  tags: RawTag[];
  guests: RawGuest[];
  people: RawPerson[];
};

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

/**
 * Identity key for graph math. A guest linked to a person shares that person's
 * key (recurs across events); an unlinked guest gets an event-local pseudo-key
 * (guest rows are per-event, so they cannot recur by construction).
 */
export function personKeyForGuest(guest: RawGuest): string {
  return guest.person_id ?? `guest:${guest.guest_id}`;
}

type CaptureItem = {
  id: string;
  eventId: string;
  /** Cluster/coverage identity — pseudo-keys allowed (unlike CapturedBy.personId). */
  capturerKey: string | null;
  capturedAt: string;
};

/**
 * Burst clustering: same capturer, consecutive gaps ≤ CLUSTER_GAP_MS chain
 * into one cluster. Returns id → clusterId (only for clusters of ≥2; singles
 * stay unclustered/null). Unknown capturers never cluster together.
 */
export function clusterBursts(items: CaptureItem[]): Map<string, string> {
  const byCapturer = new Map<string, CaptureItem[]>();
  for (const item of items) {
    if (!item.capturerKey) continue;
    const key = `${item.eventId}::${item.capturerKey}`;
    const list = byCapturer.get(key);
    if (list) list.push(item);
    else byCapturer.set(key, [item]);
  }

  const clusterIds = new Map<string, string>();
  for (const list of byCapturer.values()) {
    const sorted = [...list].sort(
      (a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id),
    );
    let cluster: CaptureItem[] = [];
    const flush = () => {
      if (cluster.length >= 2) {
        const clusterId = `burst:${cluster[0]!.id}`;
        for (const member of cluster) clusterIds.set(member.id, clusterId);
      }
      cluster = [];
    };
    for (const item of sorted) {
      const prev = cluster[cluster.length - 1];
      if (
        prev &&
        Date.parse(item.capturedAt) - Date.parse(prev.capturedAt) <= CLUSTER_GAP_MS
      ) {
        cluster.push(item);
      } else {
        flush();
        cluster = [item];
      }
    }
    flush();
  }
  return clusterIds;
}

/**
 * Coverage: per item, how many DISTINCT capturers (unknowns count once as
 * anonymous) captured anything in the same event within ±COVERAGE_WINDOW_MS.
 * Always ≥1 (the item's own capturer).
 */
export function computeCoverage(items: CaptureItem[]): Map<string, number> {
  const byEvent = new Map<string, CaptureItem[]>();
  for (const item of items) {
    const list = byEvent.get(item.eventId);
    if (list) list.push(item);
    else byEvent.set(item.eventId, [item]);
  }

  const coverage = new Map<string, number>();
  for (const list of byEvent.values()) {
    const sorted = [...list].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    const times = sorted.map((i) => Date.parse(i.capturedAt));
    for (let i = 0; i < sorted.length; i++) {
      const keys = new Set<string>();
      for (let j = i; j >= 0 && times[i]! - times[j]! <= COVERAGE_WINDOW_MS; j--) {
        keys.add(sorted[j]!.capturerKey ?? 'anonymous');
      }
      for (let j = i + 1; j < sorted.length && times[j]! - times[i]! <= COVERAGE_WINDOW_MS; j++) {
        keys.add(sorted[j]!.capturerKey ?? 'anonymous');
      }
      coverage.set(sorted[i]!.id, Math.max(1, keys.size));
    }
  }
  return coverage;
}

function displayNameFor(guest: RawGuest | null, person: RawPerson | null): string {
  if (person) {
    const fromParts = [person.first_name, person.last_name].filter(Boolean).join(' ');
    if (person.display_name) return person.display_name;
    if (fromParts) return fromParts;
  }
  if (guest) {
    if (guest.display_name) return guest.display_name;
    return [guest.first_name, guest.last_name].filter(Boolean).join(' ');
  }
  return 'Someone';
}

// ---------------------------------------------------------------------------
// The pure core
// ---------------------------------------------------------------------------

export function assembleMomentGraph(raw: RawInputs, viewer: MomentGraphViewer): MomentGraph {
  const personById = new Map(raw.people.map((p) => [p.person_id, p]));
  const guestById = new Map(raw.guests.map((g) => [g.guest_id, g]));

  // personKey → identity (name + ✦ flag; inMemoriam only ever from people rows).
  const identity = new Map<string, { displayName: string; inMemoriam: boolean }>();
  const identify = (key: string, guest: RawGuest | null, person: RawPerson | null) => {
    if (!identity.has(key)) {
      identity.set(key, {
        displayName: displayNameFor(guest, person),
        inMemoriam: person?.in_memoriam ?? false,
      });
    }
  };

  // Tags → people present per (source_table, source_id).
  const presence = new Map<string, Set<string>>(); // media key → personKeys
  const mediaKey = (t: RawTag['source_table'], id: string) => `${t}:${id}`;
  for (const tag of raw.tags) {
    const guest = guestById.get(tag.guest_id);
    if (!guest) continue;
    const key = personKeyForGuest(guest);
    identify(key, guest, guest.person_id ? (personById.get(guest.person_id) ?? null) : null);
    const mk = mediaKey(tag.source_table, tag.source_id);
    const set = presence.get(mk);
    if (set) set.add(key);
    else presence.set(mk, new Set([key]));
  }

  // Normalize both capture tables into CaptureItems + capturedBy resolvers.
  const items: CaptureItem[] = [];
  const capturedByFor = new Map<string, CapturedBy>();
  const mediaFor = new Map<
    string,
    { sourceTable: 'papic_photos' | 'papic_guest_captures'; sourceId: string; type: 'photo' | 'clip'; r2Key: string; eventId: string; capturedAt: string }
  >();

  for (const photo of raw.photos) {
    const mk = mediaKey('papic_photos', photo.photo_id);
    const capturerPerson = photo.captured_by_person_id
      ? (personById.get(photo.captured_by_person_id) ?? null)
      : null;
    if (photo.captured_by_person_id && capturerPerson) {
      identify(photo.captured_by_person_id, null, capturerPerson);
    }
    capturedByFor.set(mk, {
      kind:
        photo.captured_by_person_id && photo.captured_by_person_id === viewer.personId
          ? 'self'
          : 'papic_seat',
      personId: photo.captured_by_person_id,
      displayName: capturerPerson ? displayNameFor(null, capturerPerson) : null,
    });
    items.push({
      id: mk,
      eventId: photo.event_id,
      capturerKey: photo.captured_by_person_id,
      capturedAt: photo.captured_at,
    });
    mediaFor.set(mk, {
      sourceTable: 'papic_photos',
      sourceId: photo.photo_id,
      type: photo.photo_type,
      r2Key: photo.r2_object_key,
      eventId: photo.event_id,
      capturedAt: photo.captured_at,
    });
  }

  for (const capture of raw.guestCaptures) {
    if (!capture.r2_object_key) continue; // quota-only rows carry no bytes to show
    const mk = mediaKey('papic_guest_captures', capture.capture_id);
    const guest = guestById.get(capture.guest_id) ?? null;
    const person = guest?.person_id ? (personById.get(guest.person_id) ?? null) : null;
    const capturerKey = guest ? personKeyForGuest(guest) : null;
    if (guest && capturerKey) identify(capturerKey, guest, person);
    capturedByFor.set(mk, {
      kind: person && person.person_id === viewer.personId ? 'self' : 'guest',
      // CapturedBy.personId is a REAL person id only (pseudo guest keys stay
      // internal) — the perspective beat requires a durable, named person.
      personId: person?.person_id ?? null,
      displayName: guest ? displayNameFor(guest, person) : null,
    });
    items.push({ id: mk, eventId: capture.event_id, capturerKey, capturedAt: capture.captured_at });
    mediaFor.set(mk, {
      sourceTable: 'papic_guest_captures',
      sourceId: capture.capture_id,
      type: 'photo',
      r2Key: capture.r2_object_key,
      eventId: capture.event_id,
      capturedAt: capture.captured_at,
    });
  }

  // Recurrence = distinct events a person APPEARS in (presence, not capturing).
  const eventsByPerson = new Map<string, Set<string>>();
  for (const [mk, keys] of presence) {
    const media = mediaFor.get(mk);
    if (!media) continue; // tag on a hidden/absent frame
    for (const key of keys) {
      const set = eventsByPerson.get(key);
      if (set) set.add(media.eventId);
      else eventsByPerson.set(key, new Set([media.eventId]));
    }
  }
  const recurrenceOf = (key: string) => eventsByPerson.get(key)?.size ?? 0;

  const toMomentPerson = (key: string): MomentPerson => {
    const id = identity.get(key);
    return {
      personId: key,
      displayName: id?.displayName ?? 'Someone',
      inMemoriam: id?.inMemoriam ?? false,
      recurrence: recurrenceOf(key),
    };
  };

  const clusterIds = clusterBursts(items);
  const coverage = computeCoverage(items);
  const eventById = new Map(raw.events.map((e) => [e.event_id, e]));

  const moments: Moment[] = [];
  for (const [mk, media] of mediaFor) {
    const event = eventById.get(media.eventId);
    if (!event) continue;
    moments.push({
      id: mk,
      eventId: event.event_id,
      eventName: event.display_name,
      eventType: event.event_type,
      eventDate: event.event_date ?? media.capturedAt.slice(0, 10),
      media: {
        sourceTable: media.sourceTable,
        sourceId: media.sourceId,
        type: media.type,
        r2Key: media.r2Key,
      },
      capturedAt: media.capturedAt,
      capturedBy: capturedByFor.get(mk)!,
      peoplePresent: [...(presence.get(mk) ?? [])].sort().map(toMomentPerson),
      coverage: coverage.get(mk) ?? 1,
      clusterId: clusterIds.get(mk) ?? null,
    });
  }

  const people = [...eventsByPerson.keys()]
    .map(toMomentPerson)
    .sort((a, b) => b.recurrence - a.recurrence || a.personId.localeCompare(b.personId));

  const events: MomentGraphEvent[] = raw.events.map((e) => ({
    eventId: e.event_id,
    eventName: e.display_name,
    eventType: e.event_type,
    eventDate: e.event_date ?? '',
    heroImageUrl: e.landing_page_hero_image_url,
  }));

  return {
    moments: scoreMoments(moments, { viewerBirthDate: viewer.birthDate }),
    people,
    events,
    viewer,
  };
}

// ---------------------------------------------------------------------------
// The query layer (RLS client — the user sees only what their policies allow)
// ---------------------------------------------------------------------------

export async function fetchMomentGraph(
  supabase: SupabaseClient,
  userId: string,
): Promise<MomentGraph> {
  // The viewer's person node (claimed) — powers 'self' capturedBy + the bump.
  const { data: viewerRow } = await supabase
    .from('people')
    .select('person_id, birth_date')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  const viewer: MomentGraphViewer = {
    personId: (viewerRow?.person_id as string | undefined) ?? null,
    birthDate: (viewerRow?.birth_date as string | undefined) ?? null,
  };

  // SCOPE GUARD: own celebrations only (member_type='couple'). Attended-events
  // assembly is Phase 1.5, counsel-gated — do not widen this filter.
  const { data: memberRows, error: memberErr } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('user_id', userId)
    .eq('member_type', 'couple');
  if (memberErr) throw memberErr;
  const eventIds = (memberRows ?? []).map((r) => r.event_id as string);
  if (eventIds.length === 0) {
    return { moments: [], people: [], events: [], viewer };
  }

  const [eventsRes, photosRes, capturesRes, tagsRes] = await Promise.all([
    supabase
      .from('events')
      .select('event_id, display_name, event_type, event_date, landing_page_hero_image_url')
      .in('event_id', eventIds),
    supabase
      .from('papic_photos')
      .select('photo_id, event_id, r2_object_key, photo_type, captured_at, captured_by_person_id')
      .in('event_id', eventIds)
      .is('hidden_at', null)
      .order('captured_at', { ascending: false })
      .limit(MAX_ROWS_PER_MEDIA_TABLE),
    supabase
      .from('papic_guest_captures')
      .select('capture_id, event_id, guest_id, r2_object_key, captured_at')
      .in('event_id', eventIds)
      .is('hidden_at', null)
      .not('r2_object_key', 'is', null)
      .order('captured_at', { ascending: false })
      .limit(MAX_ROWS_PER_MEDIA_TABLE),
    supabase
      .from('photo_tags')
      .select('source_table, source_id, guest_id')
      .in('event_id', eventIds)
      .limit(MAX_TAG_ROWS),
  ]);
  const firstError = eventsRes.error ?? photosRes.error ?? capturesRes.error ?? tagsRes.error;
  if (firstError) throw firstError;

  const photos = (photosRes.data ?? []) as RawPhoto[];
  const guestCaptures = (capturesRes.data ?? []) as RawGuestCapture[];
  const tags = (tagsRes.data ?? []) as RawTag[];

  // Guests referenced by tags or as capturers; then their linked people plus
  // any seat-claim capturers.
  const guestIds = [
    ...new Set([...tags.map((t) => t.guest_id), ...guestCaptures.map((c) => c.guest_id)]),
  ];
  const guests: RawGuest[] = guestIds.length
    ? (
        (
          await supabase
            .from('guests')
            .select('guest_id, event_id, display_name, first_name, last_name, person_id')
            .in('guest_id', guestIds)
        ).data ?? []
      ) as RawGuest[]
    : [];

  const personIds = [
    ...new Set(
      [
        ...guests.map((g) => g.person_id),
        ...photos.map((p) => p.captured_by_person_id),
        viewer.personId,
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const people: RawPerson[] = personIds.length
    ? (
        (
          await supabase
            .from('people')
            .select('person_id, display_name, first_name, last_name, in_memoriam')
            .in('person_id', personIds)
        ).data ?? []
      ) as RawPerson[]
    : [];

  return assembleMomentGraph(
    { events: (eventsRes.data ?? []) as RawEvent[], photos, guestCaptures, tags, guests, people },
    viewer,
  );
}
