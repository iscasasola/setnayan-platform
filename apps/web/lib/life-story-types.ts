/**
 * Life Story · Phase 1 (own-events, ship-live) — shared data contracts.
 *
 * Strategy:   ~/Documents/Claude/Projects/Setnayan/03_Strategy/Life_Story_Strategy_2026-07-08.md
 * Build plan: ~/Documents/Claude/Projects/Setnayan/03_Strategy/Life_Story_Build_Plan_2026-07-08.md §1
 *
 * The MomentGraph is a read/aggregation view over the user's OWN events
 * (event_members-scoped). Cross-event assembly stays counsel-gated behind
 * person_story_items (Phase 1.5) and is deliberately NOT represented here —
 * any read of person_story_items in Phase-1 code is a PR-blocker by plan.
 */

export type MomentPerson = {
  personId: string;
  displayName: string;
  /** people.in_memoriam — the user's own opt-in ✦ flag. Never inferred. */
  inMemoriam: boolean;
  /** Distinct own-events this person appears in ("who kept showing up"). */
  recurrence: number;
};

export type CapturedBy = {
  kind: 'self' | 'papic_seat' | 'guest';
  /**
   * Resolved capturer person — papic_photos.captured_by_person_id (seat claim)
   * or guests.person_id (guest capture). NULL = unclaimed/ephemeral seat, or a
   * capturer with no person node. NEVER face-derived
   * (project_setnayan_face_recognition_boundary).
   */
  personId: string | null;
  displayName: string | null;
};

export type MomentMedia = {
  sourceTable: 'papic_photos' | 'papic_guest_captures';
  sourceId: string;
  type: 'photo' | 'clip';
  /** Canonical R2 key. Signed lazily per surfaced beat/page — never for the whole graph. */
  r2Key: string;
};

export type Moment = {
  /** Source row id (photo_id / capture_id) — stable across recomputes. */
  id: string;
  eventId: string;
  eventName: string;
  /** events.event_type value ('wedding' | 'birthday' | …). Open-keyed: unknown types score at the default weight. */
  eventType: string;
  /** events.event_date, ISO date. */
  eventDate: string;
  media: MomentMedia;
  /** ISO timestamp. */
  capturedAt: string;
  capturedBy: CapturedBy;
  /** From photo_tags → guests → people. Untagged frames have []. */
  peoplePresent: MomentPerson[];
  /**
   * Subset of `peoplePresent` tagged via a HIGH-TRUST source only (a guest
   * scanned their own QR, or a human hand-picked the tag) — never table-QR
   * fan-out or a low-confidence auto-face guess. This is the ONLY presence the
   * memoriam beat is allowed to name, so a deceased person is never captioned
   * onto a photo they aren't actually in. Untrusted/untagged frames have [].
   */
  peoplePresentHighTrust: MomentPerson[];
  /** Distinct capturers within this moment's ±window (multi-perspective richness). */
  coverage: number;
  /** Burst-dedup id (same capturer ≤20s). NULL when unclustered. */
  clusterId: string | null;
  /** Reserved for v1.1 (pinned_at column). Scoring treats it as 0 in v1 either way. */
  pinned?: boolean;
};

export type ScoredMoment = Moment & { significance: number };

export type MomentGraphEvent = {
  eventId: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  /** events.landing_page_hero_image_url — sparse-dignity chapter-card fallback. */
  heroImageUrl: string | null;
};

export type MomentGraphViewer = {
  /** people.person_id claimed by the account, when one exists. */
  personId: string | null;
  /** people.birth_date — powers the reminiscence-bump bonus; absent ⇒ bonus silently off. */
  birthDate: string | null;
};

export type MomentGraph = {
  /** Scored, significance-ordered (ties broken deterministically). */
  moments: ScoredMoment[];
  /** Everyone across the graph, for recurrence ranking (face_open pulls from here). */
  people: MomentPerson[];
  events: MomentGraphEvent[];
  viewer: MomentGraphViewer;
};
