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
  created_at: string;
  updated_at: string;
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

// ─── Joined views ──────────────────────────────────────────────────────────

export interface GuestWithHousehold extends Guest {
  household: Pick<Household, "household_id" | "name"> | null;
  table: Pick<WeddingTable, "table_id" | "table_name"> | null;
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
