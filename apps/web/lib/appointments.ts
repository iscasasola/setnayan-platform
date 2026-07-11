// ============================================================================
// lib/appointments.ts
//
// Shared types + helpers for the two-sided Appointments scheduler
// (corpus: Relationship_Workspace_and_Appointments_2026-07-11.md § "Appointments
// system"; PR 12 of that build plan). ONE feature carries BOTH in-person
// meetings (food tasting / site visit / fitting → location + Directions) AND
// online calls (pre-shoot call / menu consult → Join via the relationship
// thread). Propose → confirm, either direction.
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
  /**
   * Optional link to the relationship chat thread. Used to key the live P2P
   * "Join" call for a video/voice appointment; falls back to the section's
   * resolved (event, vendor) thread when null.
   */
  thread_id: string | null;
  /** custom_label (custom) → catalog label → humanized type. */
  label: string;
};

export const APPOINTMENT_KINDS: ReadonlyArray<AppointmentKind> = [
  'in_person',
  'video',
  'voice',
];

export const APPOINTMENT_KIND_LABEL: Record<AppointmentKind, string> = {
  in_person: 'In-person',
  video: 'Video call',
  voice: 'Voice call',
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
// the universal Consultation / Voice-call presets. This is the ONLY bridge
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
 * ALWAYS included (universal Consultation / Voice call), and the app layers a
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
