/**
 * Tayo database types — hand-written to match
 * `supabase/migrations/20260508120000_initial_guest_list_schema.sql`.
 *
 * Replace with `supabase gen types typescript --project-id <ref>` output when
 * we adopt the Supabase CLI in CI.
 */

// ─── Enums ──────────────────────────────────────────────────────────────────

export const WEDDING_SIDES = ["bride", "groom", "both"] as const;
export type WeddingSide = (typeof WEDDING_SIDES)[number];

export const GROUP_CATEGORIES = [
  "family",
  "friends",
  "work",
  "school",
  "officiant",
  "other",
] as const;
export type GroupCategory = (typeof GROUP_CATEGORIES)[number];

export const RSVP_STATUSES = ["pending", "attending", "declined", "maybe"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const MEAL_PREFERENCES = [
  "beef",
  "chicken",
  "fish",
  "vegetarian",
  "vegan",
  "kids",
  "no_preference",
] as const;
export type MealPreference = (typeof MEAL_PREFERENCES)[number];

export const CEREMONY_TYPES = ["catholic", "civil", "other"] as const;
export type CeremonyType = (typeof CEREMONY_TYPES)[number];

export const EVENT_STATUSES = ["planning", "ceremony_done", "archived"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_TIERS = ["essentials", "premium", "pro_event"] as const;
export type EventTier = (typeof EVENT_TIERS)[number];

export const WEDDING_ROLES = [
  "guest",
  "maid_of_honor",
  "matron_of_honor",
  "best_man",
  "bridesmaid",
  "groomsman",
  "principal_sponsor",
  "candle_sponsor",
  "veil_sponsor",
  "cord_sponsor",
  "coin_sponsor",
  "ring_bearer",
  "bible_bearer",
  "coin_bearer",
  "flower_girl",
  "officiant",
  "reader_lector",
  "soloist_musician",
] as const;
export type WeddingRole = (typeof WEDDING_ROLES)[number];

export const SCHEDULE_BLOCKS = [
  "ceremony",
  "reception",
  "cocktails",
  "after_party",
  "rehearsal_dinner",
] as const;
export type ScheduleBlock = (typeof SCHEDULE_BLOCKS)[number];

// ─── Display labels ─────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<WeddingRole, string> = {
  guest: "Guest",
  maid_of_honor: "Maid of Honor",
  matron_of_honor: "Matron of Honor",
  best_man: "Best Man",
  bridesmaid: "Bridesmaid",
  groomsman: "Groomsman",
  principal_sponsor: "Principal Sponsor",
  candle_sponsor: "Candle Sponsor",
  veil_sponsor: "Veil Sponsor",
  cord_sponsor: "Cord Sponsor",
  coin_sponsor: "Coin / Arrhae Sponsor",
  ring_bearer: "Ring Bearer",
  bible_bearer: "Bible Bearer",
  coin_bearer: "Coin Bearer",
  flower_girl: "Flower Girl",
  officiant: "Officiant",
  reader_lector: "Reader / Lector",
  soloist_musician: "Soloist / Musician",
};

export const ROLE_FAMILIES = {
  sponsor: [
    "principal_sponsor",
    "candle_sponsor",
    "veil_sponsor",
    "cord_sponsor",
    "coin_sponsor",
    "officiant",
    "reader_lector",
    "soloist_musician",
  ],
  entourage: [
    "maid_of_honor",
    "matron_of_honor",
    "best_man",
    "bridesmaid",
    "groomsman",
  ],
  bearer: ["ring_bearer", "bible_bearer", "coin_bearer", "flower_girl"],
  guest: ["guest"],
} as const satisfies Record<string, ReadonlyArray<WeddingRole>>;

export type RoleFamily = keyof typeof ROLE_FAMILIES;

export function familyForRole(role: WeddingRole): RoleFamily {
  for (const [fam, roles] of Object.entries(ROLE_FAMILIES) as Array<
    [RoleFamily, ReadonlyArray<WeddingRole>]
  >) {
    if (roles.includes(role)) return fam;
  }
  return "guest";
}

export const SIDE_LABELS: Record<WeddingSide, string> = {
  bride: "Bride's Side",
  groom: "Groom's Side",
  both: "Both / Mutual",
};

export const GROUP_LABELS: Record<GroupCategory, string> = {
  family: "Family",
  friends: "Friends",
  work: "Work / Office",
  school: "School / College",
  officiant: "Officiant",
  other: "Other",
};

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: "Pending",
  attending: "Attending",
  declined: "Declined",
  maybe: "Maybe",
};

export const SCHEDULE_BLOCK_LABELS: Record<ScheduleBlock, string> = {
  ceremony: "Ceremony",
  reception: "Reception",
  cocktails: "Cocktails",
  after_party: "After-Party",
  rehearsal_dinner: "Rehearsal Dinner",
};

// ─── Tables ─────────────────────────────────────────────────────────────────

export interface Address {
  street?: string;
  barangay?: string;
  city?: string;
  region?: string;
  country?: string;
  postal?: string;
}

export interface Event {
  event_id: string;
  slug: string;
  couple_user_id_1: string;
  couple_user_id_2: string | null;
  bride_first_name: string;
  bride_last_name: string;
  groom_first_name: string;
  groom_last_name: string;
  event_date: string; // YYYY-MM-DD
  ceremony_type: CeremonyType;
  ceremony_venue: string | null;
  reception_venue: string | null;
  guest_count_estimate: number | null;
  status: EventStatus;
  tier: EventTier;
  monogram_svg: string | null;
  rsvp_deadline: string | null;
  photos_released_at: string | null; // 0002 — flag for the deferred 0005 cloud-delivery pipeline
  // 0012 Paparazzi additive
  paparazzi_tier: 3 | 5 | null;
  gallery_review_window_days: number;
  gallery_public_unlocked_at: string | null;
  hot_retention_days: number;
  custom_monogram_unlocked: boolean;
  // 0000 App shell
  is_primary: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

// ─── 0000 — App shell / multi-event account model ─────────────────────────

export const MEMBER_TYPES = ["couple", "guest", "vendor"] as const;
export type MemberType = (typeof MEMBER_TYPES)[number];

export const JOINED_VIAS = ["qr_scan", "invited", "created_event"] as const;
export type JoinedVia = (typeof JOINED_VIAS)[number];

export interface TayoUser {
  user_id: string;
  email: string;
  phone: string | null;
  display_name: string | null;
  profile_photo_url: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface EventJoinToken {
  event_id: string;
  token: string;
  created_at: string;
  rotated_at: string | null;
  revoked_at: string | null;
}

export interface EventMember {
  member_id: string;
  event_id: string;
  user_id: string;
  member_type: MemberType;
  role: string | null;
  guest_id: string | null;
  joined_via: JoinedVia | null;
  joined_at: string;
}

export interface EventCard {
  event_id: string;
  slug: string;
  bride_first_name: string;
  groom_first_name: string;
  event_date: string;
  is_primary: boolean;
  archived: boolean;
  guest_count_estimate: number | null;
  member_type: MemberType;
}

export interface Household {
  household_id: string;
  event_id: string;
  name: string;
  address: Address | null;
  created_at: string;
  updated_at: string;
}

export interface WeddingTable {
  table_id: string;
  event_id: string;
  table_name: string;
  capacity: number;
  position_x: number | null;
  position_y: number | null;
  created_at: string;
}

export interface Guest {
  guest_id: string;
  event_id: string;
  household_id: string | null;
  pair_with_guest_id: string | null;
  first_name: string;
  last_name: string;
  display_name: string | null;
  side: WeddingSide;
  group_category: GroupCategory;
  role: WeddingRole;
  plus_one_allowed: boolean;
  plus_one_name: string | null;
  email: string | null;
  mobile: string | null;
  address: Address | null;
  meal_preference: MealPreference | null;
  dietary_restrictions: string | null;
  photo_consent: boolean;
  table_assignment_id: string | null;
  invited_to_blocks: string[]; // ScheduleBlock[] but stored as text[] in PG
  custom_tags: string[];
  rsvp_status: RsvpStatus;
  rsvp_responded_at: string | null;
  invitation_sent_at: string | null;
  notes: string | null;
  qr_token: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // 0002 additions
  profile_photo_url: string | null;
  profile_photo_set_at: string | null;
  profile_photo_segment: "arrival" | "ceremony" | "cocktails" | "reception" | "manual" | null;
  first_rule_completed_at: string | null;
  first_rule_captured_by_user_id: string | null;
  download_completed_at: string | null;
  scan_tracking_opt_out: boolean;
  // 0001 plus-one model upgrade (2026-05-09)
  plus_one_of_guest_id: string | null;
  plus_one_mode: PlusOneMode | null;
}

export const PLUS_ONE_MODES = ["full", "limited"] as const;
export type PlusOneMode = (typeof PLUS_ONE_MODES)[number];

export const PLUS_ONE_MODE_LABELS: Record<PlusOneMode, string> = {
  full: "Full",
  limited: "Limited",
};

// ─── 0002 — scan_events + guest_rsvp_extras ───────────────────────────────

export const SCAN_SOURCES = ["browser", "tayo_native", "tayo_din", "coordinator"] as const;
export type ScanSource = (typeof SCAN_SOURCES)[number];

export interface ScanEvent {
  scan_id: string;
  event_id: string;
  guest_id: string;
  scanned_at: string;
  source: ScanSource;
  scanner_user_id: string | null;
  context: Record<string, unknown> | null;
  user_agent: string | null;
  ip_anon: string | null;
}

export const DANCE_STYLES = ["slow", "line_dancing", "hip_hop", "no_preference"] as const;
export type DanceStyle = (typeof DANCE_STYLES)[number];

export interface GuestRsvpExtras {
  guest_id: string;
  event_id: string;
  song_request: string | null;
  dance_style: DanceStyle | null;
  photo_challenges_opt_in: boolean;
  freeform_note: string | null;
  updated_at: string;
}

// ─── 0012 — Paparazzi ──────────────────────────────────────────────────────

export const CAPTURE_TYPES = ["photo", "clip"] as const;
export type CaptureType = (typeof CAPTURE_TYPES)[number];

export const CAPTURE_MODERATION_STATUSES = [
  "pending",
  "approved",
  "flagged",
  "rejected",
] as const;
export type CaptureModerationStatus = (typeof CAPTURE_MODERATION_STATUSES)[number];

export const CAPTURE_ORIENTATIONS = ["portrait", "landscape"] as const;
export type CaptureOrientation = (typeof CAPTURE_ORIENTATIONS)[number];

export const CAPTURE_TAG_SOURCES = [
  "individual_qr",
  "table_qr",
  "manual_pick",
  "auto_face_match",
] as const;
export type CaptureTagSource = (typeof CAPTURE_TAG_SOURCES)[number];

export const REEL_RENDER_STATUSES = ["queued", "rendering", "ready", "failed"] as const;
export type ReelRenderStatus = (typeof REEL_RENDER_STATUSES)[number];

export const PAPARAZZI_GALLERY_FILTERS = [
  "chronological",
  "photos_of_us",
  "untagged",
  "type",
] as const;
export type PaparazziGalleryFilter = (typeof PAPARAZZI_GALLERY_FILTERS)[number];

export const PAPARAZZI_GALLERY_FILTER_LABELS: Record<PaparazziGalleryFilter, string> = {
  chronological: "Chronological",
  photos_of_us: "Photos of us",
  untagged: "Untagged",
  type: "Type",
};

export interface PaparazziSeat {
  seat_id: string;
  event_id: string;
  seat_index: number;
  role_label: string | null;
  claim_qr_token: string;
  claimer_user_id: string | null;
  claimer_label: string | null;
  claimed_at: string | null;
  device_platform: "ios" | "android" | null;
  device_app_build: string | null;
  last_seen_at: string | null;
  battery_pct_last: number | null;
  handed_off_to_seat_id: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Capture {
  capture_id: string;
  event_id: string;
  paparazzi_seat_id: string;
  type: CaptureType;
  duration_seconds: number | null;
  flash_used: boolean;
  orientation: CaptureOrientation;
  client_capture_id: string;
  captured_at: string;
  uploaded_at: string;
  r2_object_key: string;
  r2_thumbnail_key: string | null;
  width_px: number | null;
  height_px: number | null;
  byte_size: number | null;
  moderation_status: CaptureModerationStatus;
  nsfw_score: number | null;
  hidden_by_couple_at: string | null;
  hidden_reason: string | null;
  favorite_of_couple: boolean;
  tags_count: number;
  created_at: string;
  updated_at: string;
}

export interface CaptureTag {
  capture_id: string;
  guest_id: string;
  source: CaptureTagSource;
  tagged_at: string;
  tagged_by_seat_id: string | null;
}

export interface ReelTemplate {
  template_id: string;
  slug: string;
  display_name: string;
  feel_category:
    | "bridgerton_feel"
    | "taylor_swift_feel"
    | "mj_feel"
    | "jazz"
    | "sunday_morning"
    | "hip_hop";
  manifest_json: Record<string, unknown>;
  preview_video_key: string | null;
  paired_track_ids: string[];
  duration_min_s: number;
  duration_max_s: number;
  production_ready: boolean;
  retired_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonalReel {
  reel_id: string;
  event_id: string;
  guest_id: string;
  template_id: string;
  selected_capture_ids: string[];
  couple_clip_ids: string[];
  duration_s: number;
  music_track_id: string | null;
  monogram_applied: boolean;
  status: ReelRenderStatus;
  r2_output_key: string | null;
  preview_thumb_key: string | null;
  enqueued_at: string;
  rendering_started_at: string | null;
  rendered_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaparazziWalletSku {
  service_key: "paparazzi_3_seat" | "paparazzi_5_seat" | "paparazzi_template";
  display_name_en: string;
  php_price_centavos: number;
  token_display: number;
  ref_type: string;
  one_time_per_event: boolean;
  created_at: string;
}

// ─── Joined views ──────────────────────────────────────────────────────────

export interface GuestWithHousehold extends Guest {
  household: Pick<Household, "household_id" | "name"> | null;
  table: Pick<WeddingTable, "table_id" | "table_name"> | null;
}

export interface CaptureWithTags extends Capture {
  tagged_guest_ids: string[];
}

// ─── Display helpers ───────────────────────────────────────────────────────

export function guestDisplayName(g: Pick<Guest, "first_name" | "last_name" | "display_name">): string {
  return g.display_name?.trim() || `${g.first_name} ${g.last_name}`.trim();
}

export function eventCoupleNames(e: Pick<Event, "bride_first_name" | "groom_first_name">): string {
  return `${e.bride_first_name} & ${e.groom_first_name}`;
}

export function avatarInitials(name: string): string {
  const parts = name.replace(/&/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const p0 = parts[0] ?? "";
  const p1 = parts[1] ?? "";
  if (parts.length === 1) return p0.slice(0, 2).toUpperCase();
  return ((p0.charAt(0) || "?") + (p1.charAt(0) || "?")).toUpperCase();
}

export function daysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00`).getTime();
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((target - today) / 86_400_000));
}
