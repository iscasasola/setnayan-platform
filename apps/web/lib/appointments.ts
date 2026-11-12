// ============================================================================
// lib/appointments.ts
//
// Shared types + helpers for the two-sided Appointments scheduler
// (corpus: Relationship_Workspace_and_Appointments_2026-07-11.md § "Appointments
// system"; PR 12 of that build plan). ONE feature carries BOTH in-person
// meetings (food tasting / site visit / fitting → location + Directions) AND
// Virtual meetings (pre-shoot call / menu consult → Join hands off to the
// proposer's own Meet / Zoom / Messenger / Viber / phone — never an in-app
// call, owner 2026-10-28). Propose → confirm, either direction.
//
// Backed by two tables (schema on main, unchanged here):
//   • event_appointments      — one row per vendor↔couple meeting.
//   • appointment_type_catalog — the category → meeting-type presets.
//
// Pure module — no 'use client' / 'use server' — safe to import from both a
// server component (to shape data) and a client component (for labels/format).
// ============================================================================

export type AppointmentKind = 'in_person' | 'video' | 'voice';
export type AppointmentStatus = 'proposed' | 'confirmed' | 'done' | 'cancelled';
export type AppointmentInitiator = 'vendor' | 'couple';

/** A preset row from appointment_type_catalog (already category-filtered). */
export type AppointmentTypePreset = {
  type: string;
  label: string;
  default_mode: AppointmentKind;
  default_duration_min: number;
};

/** A single event_appointments row, with a resolved display `label`. */
export type AppointmentView = {
  appointment_id: string;
  kind: AppointmentKind;
  type: string;
  custom_label: string | null;
  location: string | null;
  scheduled_at: string | null;
  duration_min: number | null;
  status: AppointmentStatus;
  initiated_by: AppointmentInitiator | null;
  note: string | null;
  /** Optional link to the relationship chat thread. */
  thread_id: string | null;
  /** A Virtual meeting's room: when somebody on it first pressed "Create the room" (set once). */
  room_created_at?: string | null;
  /** custom_label (custom) → catalog label → humanized type. */
  label: string;
};

/**
 * 🚫 NO CALLS INSIDE SETNAYAN (owner 2026-10-28, "remove both voice and video
 * call"; the meetings follow-up approved 2026-11-04). A meeting is In-person or
 * Virtual — and a Virtual meeting is a Jitsi room Setnayan makes (owner
 * 2026-11-04 "VIRTUAL = JITSI ONLY"), opened outside the app, never an in-app
 * room. The link, the room and its one button live in `lib/virtual-meeting.ts`.
 *
 * STORAGE — no new schema. `event_appointments.kind` is a text CHECK of
 * in_person / video / voice; a new Virtual meeting is stored as 'video', and an
 * old 'voice' row reads as Virtual too. Composers offer ONLY `MEETING_MODES`.
 * Guard: `meetings-never-open-an-in-app-call.test.ts`.
 */
export type MeetingMode = 'in_person' | 'virtual';

export const MEETING_MODES: ReadonlyArray<MeetingMode> = ['in_person', 'virtual'];

export const MEETING_MODE_LABEL: Record<MeetingMode, string> = {
  in_person: 'In-person',
  virtual: 'Virtual',
};

/** Any stored kind → the mode it reads as. 'video' and the retired 'voice' are both Virtual. */
export function meetingModeOf(kind: string): MeetingMode {
  return kind === 'in_person' ? 'in_person' : 'virtual';
}

/** Every kind the database may hold (for READING rows — composers offer MEETING_MODES). */
export function isStoredAppointmentKind(k: unknown): k is AppointmentKind {
  return k === 'in_person' || k === 'video' || k === 'voice';
}

/**
 * A posted form `kind` → the kind to store. 'virtual' (and, from a stale open
 * tab, the old 'video' / 'voice') all store as 'video'. Nothing new is ever
 * written as 'voice'.
 */
export function postedKindToStored(raw: unknown): 'in_person' | 'video' | null {
  if (raw === 'in_person') return 'in_person';
  if (raw === 'virtual' || raw === 'video' || raw === 'voice') return 'video';
  return null;
}

/** Display label of a stored kind — "In-person" or "Virtual". */
export const APPOINTMENT_KIND_LABEL: Record<AppointmentKind, string> = {
  in_person: 'In-person',
  video: 'Virtual',
  voice: 'Virtual',
};

export const APPOINTMENT_STATUS_META: Record<
  AppointmentStatus,
  { label: string; cls: string }
> = {
  proposed: { label: 'Proposed', cls: 'bg-warn-100 text-warn-900' },
  confirmed: { label: 'Confirmed', cls: 'bg-success-100 text-success-900' },
  done: { label: 'Done', cls: 'bg-ink/10 text-ink/60' },
  cancelled: { label: 'Cancelled', cls: 'bg-ink/5 text-ink/50' },
};

// ----------------------------------------------------------------------------
// vendor_category (event_vendors.category / VendorCategory) → the free-text
// `category` key used by appointment_type_catalog (photo_video / caterer /
// venue / couturier / hmua / cake / florist / coordinator / band_dj /
// officiant). Anything unmapped falls through to 'any' — which always carries
// the universal Consultation preset. This is the ONLY bridge
// between the two taxonomies; keep it here so both entry pages agree.
// ----------------------------------------------------------------------------
const VENDOR_CATEGORY_TO_APPOINTMENT_CATEGORY: Record<string, string> = {
  venue: 'venue',
  religious_venue: 'venue',
  catering: 'caterer',
  crew_meals: 'caterer',
  mobile_bar: 'caterer',
  photographer: 'photo_video',
  videographer: 'photo_video',
  florist: 'florist',
  reception_decor: 'florist',
  cake_maker: 'cake',
  band_dj: 'band_dj',
  string_quartet: 'band_dj',
  choir: 'band_dj',
  officiant: 'officiant',
  planner_coordinator: 'coordinator',
  makeup_artist: 'hmua',
  hair_stylist: 'hmua',
  gown_designer: 'couturier',
  suit_designer: 'couturier',
};

/**
 * Resolve the set of appointment_type_catalog `category` keys a scheduler
 * should offer, given the vendor's booked service category(ies). 'any' is
 * ALWAYS included (universal Consultation), and the app layers a
 * "Custom" option on top regardless of the catalog.
 */
export function appointmentCategoriesFor(
  vendorCategories: ReadonlyArray<string>,
): string[] {
  const set = new Set<string>(['any']);
  for (const c of vendorCategories) {
    set.add(VENDOR_CATEGORY_TO_APPOINTMENT_CATEGORY[c] ?? 'any');
  }
  return Array.from(set);
}

/** Title-case a snake_case type key as a last-resort label. */
export function humanizeAppointmentType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve an appointment's display label: the free-text name for a custom
 * meeting, the catalog label for a preset type, else a humanized type key.
 */
export function resolveAppointmentLabel(
  a: { type: string; custom_label: string | null },
  typeLabels: Record<string, string>,
): string {
  if (a.type === 'custom') {
    return a.custom_label?.trim() || 'Custom appointment';
  }
  return typeLabels[a.type] ?? humanizeAppointmentType(a.type);
}

/** The (+) Meeting card's field: `createScheduleRequestFromChat` answers IN PLACE (a result, no redirect). */
export const MEETING_IN_PLACE_FIELD = 'in_place';
