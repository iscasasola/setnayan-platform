/**
 * Life Story · dev fixtures — a demoable MomentGraph without real data.
 *
 * Runs through the REAL pure assembly path (assembleMomentGraph), so fixtures
 * exercise exactly the pipeline production uses — person linking, clustering,
 * coverage, recurrence, scoring. Deterministic: no randomness, fixed dates.
 *
 * Usage is gated at the page layer (dev/preview + ?fixtures=1, never in prod
 * paths — Build Plan §4). The cast mirrors the design prototype so the flash
 * demos every beat: recurring partner, ✦ Lola, multi-camera coverage for the
 * perspective turn.
 */

import type { MomentGraph } from './life-story-types';
import { assembleMomentGraph, type RawInputs } from './life-story-moment-graph';

type FixtureEvent = {
  id: string;
  name: string;
  type: string;
  date: string; // ISO date
  /** [captureOffsetSec, capturerKey, taggedPeople[]] triples become media. */
  frames: Array<[number, 'self' | 'bea' | 'kiko' | 'cora' | 'anon-seat', string[]]>;
};

// Reveal order matches the prototype's "dial the years" arc: the wedding
// first, then the life filling in around it.
const FIXTURE_EVENTS: FixtureEvent[] = [
  { id: 'fx-wedding', name: 'Your wedding', type: 'wedding', date: '2024-06-01', frames: [
    [0, 'bea', ['marco']],
    [12, 'bea', ['marco']], // burst with previous → clusters
    [300, 'kiko', ['marco', 'elena', 'ramon']],
    [305, 'self', ['marco', 'elena']], // second camera in-window → coverage
    [900, 'kiko', ['marco']],
  ]},
  { id: 'fx-anniv', name: 'Your first anniversary', type: 'anniversary', date: '2025-06-01', frames: [
    [0, 'self', ['marco']],
    [600, 'self', ['marco']],
  ]},
  { id: 'fx-lola80', name: 'Lola Rosario’s 80th', type: 'birthday', date: '2013-08-14', frames: [
    [0, 'cora', ['rosario', 'elena', 'kiko']],
    [120, 'self', ['rosario', 'elena', 'ramon']],
    [125, 'kiko', ['rosario']], // Lola through Kiko's lens, multi-camera
  ]},
  { id: 'fx-christening', name: 'Mateo’s christening', type: 'christening', date: '2026-03-15', frames: [
    [0, 'bea', ['marco', 'elena']],
    [60, 'self', ['elena', 'cora']],
  ]},
  { id: 'fx-debut', name: 'Your debut', type: 'debut', date: '2014-02-02', frames: [
    [0, 'bea', ['elena', 'ramon', 'rosario']],
    [200, 'kiko', ['ramon']],
  ]},
  { id: 'fx-reunion', name: 'The family reunion', type: 'reunion', date: '2019-04-20', frames: [
    [0, 'cora', ['elena', 'ramon', 'kiko']],
    [45, 'self', ['kiko']],
  ]},
  { id: 'fx-noche', name: 'Noche Buena', type: 'reunion', date: '2023-12-24', frames: [
    [0, 'bea', ['elena', 'ramon', 'kiko', 'cora']],
    [500, 'self', ['elena']],
  ]},
  { id: 'fx-e60', name: 'Elena’s 60th', type: 'birthday', date: '2022-09-09', frames: [
    [0, 'bea', ['elena', 'ramon']],
    [30, 'self', ['elena']],
  ]},
];

const CAST: Record<string, { name: string; inMemoriam?: boolean }> = {
  marco: { name: 'Marco' },
  elena: { name: 'Elena' },
  ramon: { name: 'Ramon' },
  rosario: { name: 'Lola Rosario', inMemoriam: true },
  kiko: { name: 'Kiko' },
  cora: { name: 'Tita Cora' },
  bea: { name: 'Bea' },
};

const VIEWER_PERSON_ID = 'fx-person-viewer';

/**
 * Fixture media = REAL external demo imagery so owner QA can actually judge
 * the experience (owner 2026-07-08: gradients alone were "not decipherable").
 * Deterministic: picsum seeds derive from event+frame ids (same moment always
 * shows the same picture); clips rotate through Google's long-lived sample
 * video bucket. FIXTURE-ONLY: the page's fixture branch passes https:// keys
 * straight through as display URLs — production media never takes this path
 * (real rows carry R2 keys, signed per-surface).
 */
function fixturePhotoUrl(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/900`;
}
const SAMPLE_CLIPS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
];

/**
 * Build a fixture MomentGraph covering the first `eventCount` fixture events
 * (1..8). Deterministic for a given count.
 */
export function lifeStoryFixtureGraph(eventCount = 4): MomentGraph {
  const chosen = FIXTURE_EVENTS.slice(0, Math.max(1, Math.min(FIXTURE_EVENTS.length, eventCount)));

  const raw: RawInputs = { events: [], photos: [], guestCaptures: [], tags: [], guests: [], people: [] };

  raw.people = Object.entries(CAST).map(([key, p]) => ({
    person_id: `fx-person-${key}`,
    display_name: p.name,
    first_name: null,
    last_name: null,
    in_memoriam: p.inMemoriam ?? false,
  }));
  raw.people.push({
    person_id: VIEWER_PERSON_ID,
    display_name: 'You',
    first_name: null,
    last_name: null,
    in_memoriam: false,
  });

  for (const event of chosen) {
    raw.events.push({
      event_id: event.id,
      display_name: event.name,
      event_type: event.type,
      event_date: event.date,
      landing_page_hero_image_url: null,
    });

    // One guest row per cast member per event (guests are event-scoped, linked
    // to the durable person — exactly how the resolver seeds real data).
    const guestIdsThisEvent = new Set<string>();
    const guestIdFor = (castKey: string) => {
      const guestId = `fx-guest-${event.id}-${castKey}`;
      if (!guestIdsThisEvent.has(guestId)) {
        guestIdsThisEvent.add(guestId);
        raw.guests.push({
          guest_id: guestId,
          event_id: event.id,
          display_name: CAST[castKey]!.name,
          first_name: CAST[castKey]!.name,
          last_name: '',
          person_id: `fx-person-${castKey}`,
        });
      }
      return guestId;
    };

    event.frames.forEach(([offsetSec, capturer, tagged], index) => {
      const capturedAt = new Date(
        Date.parse(`${event.date}T16:00:00Z`) + offsetSec * 1000,
      ).toISOString();

      if (capturer === 'self' || capturer === 'bea' || capturer === 'anon-seat') {
        // Papic crew frame (seat claim → captured_by_person_id).
        const photoId = `fx-photo-${event.id}-${index}`;
        const isClip = index % 4 === 3;
        raw.photos.push({
          photo_id: photoId,
          event_id: event.id,
          r2_object_key: isClip
            ? SAMPLE_CLIPS[index % SAMPLE_CLIPS.length]!
            : fixturePhotoUrl(`${event.id}-${index}`),
          photo_type: isClip ? 'clip' : 'photo',
          captured_at: capturedAt,
          captured_by_person_id:
            capturer === 'self' ? VIEWER_PERSON_ID : capturer === 'bea' ? 'fx-person-bea' : null,
        });
        for (const castKey of tagged) {
          raw.tags.push({ source_table: 'papic_photos', source_id: photoId, guest_id: guestIdFor(castKey) });
        }
      } else {
        // Guest disposable-camera frame (kiko / cora shooting as guests).
        const captureId = `fx-capture-${event.id}-${index}`;
        raw.guestCaptures.push({
          capture_id: captureId,
          event_id: event.id,
          guest_id: guestIdFor(capturer),
          r2_object_key: fixturePhotoUrl(`${event.id}-guest-${index}`),
          captured_at: capturedAt,
        });
        for (const castKey of tagged) {
          raw.tags.push({ source_table: 'papic_guest_captures', source_id: captureId, guest_id: guestIdFor(castKey) });
        }
      }
    });
  }

  return assembleMomentGraph(raw, { personId: VIEWER_PERSON_ID, birthDate: '1996-01-15' });
}
