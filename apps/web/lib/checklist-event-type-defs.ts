/**
 * Per-event-type checklist definitions — the de-hardcode substrate.
 *
 * The couple checklist began wedding-only: `CHECKLIST_TEMPLATE` in
 * `lib/checklist.ts` is entirely wedding-shaped, and `ensureChecklistSeeded`
 * only applied it. This module lifts the four wedding-specific assumptions
 * (see `EventTypeChecklistDef`) into per-type data so a debut, birthday,
 * christening, etc. each seed their OWN performable-task list.
 *
 * Design note — vocabulary: these are TypeScript templates in the exact same
 * shape as the wedding `CHECKLIST_TEMPLATE` (a `ChecklistTemplateItem[]`), so
 * the seeder consumes them identically. The longer-term "admin edits event
 * types as data in `event_type_profiles`" path (0053 engine) can replace these
 * consts later without changing the seeder contract.
 *
 * WEDDING is intentionally NOT redefined here — it keeps using the canonical
 * `CHECKLIST_TEMPLATE` so the live wedding checklist stays byte-identical.
 * `checklistDefForEventType('wedding' | null)` returns `null`, signalling the
 * caller to fall back to the wedding template.
 *
 * Spec: 02_Specifications/Adaptive_Checklist_Event_Type_Definitions_2026-07-08.md (§5)
 *       02_Specifications/Adaptive_Checklist_Build_Plan_2026-07-08.md (lane C)
 *
 * Wired into checklist seeding via `checklistDefForEventType` (per-type template)
 * and `GENERIC_EVENT_CHECKLIST_DEF` (the fallback for typeless non-wedding types)
 * in app/dashboard/[eventId]/checklist-actions.ts.
 */
import type { ChecklistTemplateItem } from './checklist';

/**
 * Whether the event's DATE is discovered from venue availability (`output` —
 * wedding/christening: shortlist venue → find the date it's free → lock) or
 * chosen up front (`input` — a birthday is on the birthday). Drives whether the
 * checklist routes through the `/find-date` Schedule Matrix or counts deadlines
 * back from a set date.
 */
export type ChecklistDateModel = 'output' | 'input';

export type EventTypeChecklistDef = {
  /** The `events.event_type` value this def serves. */
  eventType: string;
  /** Date discovered from venues (`output`) vs chosen up front (`input`). */
  dateModel: ChecklistDateModel;
  /**
   * Plan-group/category key of the single most capacity/date-constraining
   * vendor — booked first, the budget Tier-1 anchor. `null` for events that can
   * happen at home with no venue booking (a small birthday / gender reveal).
   */
  anchorCategory: string | null;
  /** The 2–4 categories that dominate the remaining budget (budget Tier 2). */
  tier2Core: string[];
  /** The ordered, performable task list seeded for this event type. */
  template: ReadonlyArray<ChecklistTemplateItem>;
};

// ── Debut (Filipino 18th) ─────────────────────────────────────────────────
// Date anchored to the 18th birthday; venue booked around it.
const DEBUT_TEMPLATE: ChecklistTemplateItem[] = [
  { key: 'debut_theme', title: 'Decide your debut theme & overall vibe', category: 'foundations', dueOffsetDays: 240 },
  { key: 'debut_budget', title: 'Set your budget — Setnayan estimated one from your picks', category: 'foundations', dueOffsetDays: 235 },
  { key: 'debut_guest_list', title: 'Draft your guest list', category: 'guests', dueOffsetDays: 230 },
  { key: 'debut_venue', title: 'Research & book your venue (banquet hall or events place)', category: 'vendors', dueOffsetDays: 210 },
  { key: 'debut_court', title: 'Pick your court — 18 roses, 18 candles, 18 treasures, 18 shots', category: 'foundations', dueOffsetDays: 180 },
  { key: 'debut_catering', title: 'Book your caterer', category: 'vendors', dueOffsetDays: 170 },
  { key: 'debut_photo', title: 'Book your photo & video team', category: 'vendors', dueOffsetDays: 165 },
  { key: 'debut_hmua', title: 'Book your hair & makeup artist', category: 'vendors', dueOffsetDays: 150 },
  { key: 'debut_gown', title: 'Choose your debut gown & escort attire', category: 'attire', dueOffsetDays: 140 },
  { key: 'debut_host', title: 'Book your host / emcee', category: 'vendors', dueOffsetDays: 130 },
  { key: 'debut_lights_sounds', title: 'Book lights & sounds', category: 'vendors', dueOffsetDays: 120 },
  { key: 'debut_cotillion', title: 'Book a cotillion choreographer & schedule rehearsals', category: 'vendors', dueOffsetDays: 110 },
  { key: 'debut_program', title: 'Finalize your program (grand entrance, first dance, messages)', category: 'logistics', dueOffsetDays: 45 },
  { key: 'debut_final_headcount', title: 'Confirm your final headcount', category: 'guests', dueOffsetDays: 14 },
];

// ── Birthday ──────────────────────────────────────────────────────────────
// Kids' and adults' parties; interested_categories tailors the vendor tasks.
const BIRTHDAY_TEMPLATE: ChecklistTemplateItem[] = [
  { key: 'bday_theme', title: 'Set your party theme', category: 'foundations', dueOffsetDays: 90 },
  { key: 'bday_budget', title: 'Set your budget', category: 'foundations', dueOffsetDays: 88 },
  { key: 'bday_guest_list', title: 'Draft your guest list', category: 'guests', dueOffsetDays: 85 },
  { key: 'bday_venue', title: 'Choose your venue (or confirm at home)', category: 'vendors', dueOffsetDays: 75 },
  { key: 'bday_catering', title: 'Book catering / order food', category: 'vendors', dueOffsetDays: 55 },
  { key: 'bday_cake', title: 'Order your cake', category: 'vendors', dueOffsetDays: 45 },
  { key: 'bday_entertainment', title: 'Book entertainment (host, clown, magician, or band/DJ)', category: 'vendors', dueOffsetDays: 40 },
  { key: 'bday_photo', title: 'Book a photographer', category: 'vendors', dueOffsetDays: 35 },
  { key: 'bday_favors', title: 'Arrange party favors & giveaways', category: 'logistics', dueOffsetDays: 21 },
  { key: 'bday_final_headcount', title: 'Confirm your final headcount', category: 'guests', dueOffsetDays: 7 },
];

// ── Christening (Binyag / Baptism) ──────────────────────────────────────────
// date_model = output: the parish baptism schedule constrains the date.
const CHRISTENING_TEMPLATE: ChecklistTemplateItem[] = [
  { key: 'christ_budget', title: 'Set your budget', category: 'foundations', dueOffsetDays: 120 },
  { key: 'christ_guest_list', title: 'Draft your guest list', category: 'guests', dueOffsetDays: 115 },
  { key: 'christ_parish', title: 'Book your parish & confirm the baptism date', category: 'paperwork', dueOffsetDays: 110 },
  { key: 'christ_godparents', title: 'Confirm your godparents (ninong & ninang) & collect their requirements', category: 'paperwork', dueOffsetDays: 100 },
  { key: 'christ_application', title: 'Submit the baptismal application to the parish', category: 'paperwork', dueOffsetDays: 90 },
  { key: 'christ_seminar', title: 'Attend the pre-baptism seminar', category: 'paperwork', dueOffsetDays: 60 },
  { key: 'christ_reception', title: 'Book your reception venue & caterer', category: 'vendors', dueOffsetDays: 80 },
  { key: 'christ_photo', title: 'Book your photo & video team', category: 'vendors', dueOffsetDays: 70 },
  { key: 'christ_cake', title: 'Order your cake', category: 'vendors', dueOffsetDays: 45 },
  { key: 'christ_outfit', title: 'Prepare the baptismal outfit, candle & shell', category: 'attire', dueOffsetDays: 30 },
  { key: 'christ_final_headcount', title: 'Confirm your final headcount', category: 'guests', dueOffsetDays: 7 },
];

// ── Corporate ───────────────────────────────────────────────────────────────
const CORPORATE_TEMPLATE: ChecklistTemplateItem[] = [
  { key: 'corp_objective', title: 'Define the event objective & format', category: 'foundations', dueOffsetDays: 120 },
  { key: 'corp_budget', title: 'Set your budget', category: 'foundations', dueOffsetDays: 118 },
  { key: 'corp_headcount', title: 'Confirm your headcount & invite list', category: 'guests', dueOffsetDays: 110 },
  { key: 'corp_venue', title: 'Book your venue (function hall, hotel, or resort)', category: 'vendors', dueOffsetDays: 100 },
  { key: 'corp_catering', title: 'Book catering', category: 'vendors', dueOffsetDays: 80 },
  { key: 'corp_av', title: 'Book AV & production (sound, lights, staging)', category: 'vendors', dueOffsetDays: 75 },
  { key: 'corp_host', title: 'Book your host / emcee', category: 'vendors', dueOffsetDays: 60 },
  { key: 'corp_photo', title: 'Book photo & video coverage', category: 'vendors', dueOffsetDays: 55 },
  { key: 'corp_program', title: 'Finalize the program / agenda', category: 'logistics', dueOffsetDays: 30 },
  { key: 'corp_giveaways', title: 'Arrange giveaways / tokens & signage', category: 'logistics', dueOffsetDays: 25 },
  { key: 'corp_tech_run', title: 'Run the AV / tech rehearsal', category: 'logistics', dueOffsetDays: 7 },
];

// ── Tournament ──────────────────────────────────────────────────────────────
const TOURNAMENT_TEMPLATE: ChecklistTemplateItem[] = [
  { key: 'tourn_format', title: 'Set the format & brackets', category: 'foundations', dueOffsetDays: 90 },
  { key: 'tourn_budget', title: 'Set your budget', category: 'foundations', dueOffsetDays: 88 },
  { key: 'tourn_venue', title: 'Book your venue (court, field, or gym)', category: 'vendors', dueOffsetDays: 80 },
  { key: 'tourn_registration', title: 'Open registration', category: 'logistics', dueOffsetDays: 70 },
  { key: 'tourn_officials', title: 'Confirm your officials / referees', category: 'vendors', dueOffsetDays: 45 },
  { key: 'tourn_medic', title: 'Secure a medic / first-aid team', category: 'vendors', dueOffsetDays: 40 },
  { key: 'tourn_awards', title: 'Order awards (medals / trophies)', category: 'logistics', dueOffsetDays: 35 },
  { key: 'tourn_catering', title: 'Arrange catering / concessions', category: 'vendors', dueOffsetDays: 30 },
  { key: 'tourn_fixtures', title: 'Publish the schedule / fixtures', category: 'logistics', dueOffsetDays: 14 },
  { key: 'tourn_close_reg', title: 'Close registration & finalize participants', category: 'logistics', dueOffsetDays: 10 },
];

// ── Gender reveal ───────────────────────────────────────────────────────────
const GENDER_REVEAL_TEMPLATE: ChecklistTemplateItem[] = [
  { key: 'gr_budget', title: 'Set your budget', category: 'foundations', dueOffsetDays: 45 },
  { key: 'gr_guest_list', title: 'Draft your guest list', category: 'guests', dueOffsetDays: 42 },
  { key: 'gr_venue', title: 'Choose your venue (or confirm at home)', category: 'vendors', dueOffsetDays: 35 },
  { key: 'gr_mechanic', title: 'Choose your reveal mechanic (smoke, confetti, balloon, or cake)', category: 'foundations', dueOffsetDays: 30 },
  { key: 'gr_keeper', title: 'Assign the keeper of the secret', category: 'logistics', dueOffsetDays: 28 },
  { key: 'gr_reveal_order', title: 'Order your reveal element (plus a backup)', category: 'vendors', dueOffsetDays: 21 },
  { key: 'gr_catering', title: 'Arrange catering / snacks', category: 'vendors', dueOffsetDays: 18 },
  { key: 'gr_photo', title: 'Book a photographer', category: 'vendors', dueOffsetDays: 15 },
  { key: 'gr_final_headcount', title: 'Confirm your final headcount', category: 'guests', dueOffsetDays: 5 },
];

// ── Travel ──────────────────────────────────────────────────────────────────
// Itinerary-shaped; interim vendor-checklist form pending an itinerary surface.
const TRAVEL_TEMPLATE: ChecklistTemplateItem[] = [
  { key: 'travel_destination', title: 'Fix your destination & travel dates', category: 'foundations', dueOffsetDays: 120 },
  { key: 'travel_budget', title: 'Set your budget', category: 'foundations', dueOffsetDays: 118 },
  { key: 'travel_docs', title: 'Check travel documents (passport / visa validity, IDs)', category: 'paperwork', dueOffsetDays: 110 },
  { key: 'travel_transport', title: 'Book transport (flights / ferry / land)', category: 'vendors', dueOffsetDays: 100 },
  { key: 'travel_accommodation', title: 'Book your accommodation', category: 'vendors', dueOffsetDays: 90 },
  { key: 'travel_insurance', title: 'Arrange travel insurance', category: 'logistics', dueOffsetDays: 60 },
  { key: 'travel_itinerary', title: 'Build your day-by-day itinerary', category: 'logistics', dueOffsetDays: 45 },
  { key: 'travel_activities', title: 'Book tours / activities / excursions', category: 'vendors', dueOffsetDays: 30 },
  { key: 'travel_pack', title: 'Finalize packing & confirm all bookings', category: 'final_week', dueOffsetDays: 5 },
];

// ── Celebration (generic fallback: anniversary / reunion / general party) ────
const CELEBRATION_TEMPLATE: ChecklistTemplateItem[] = [
  { key: 'celeb_purpose', title: 'Set the purpose & theme', category: 'foundations', dueOffsetDays: 90 },
  { key: 'celeb_budget', title: 'Set your budget', category: 'foundations', dueOffsetDays: 88 },
  { key: 'celeb_guest_list', title: 'Draft your guest list', category: 'guests', dueOffsetDays: 85 },
  { key: 'celeb_venue', title: 'Choose your venue', category: 'vendors', dueOffsetDays: 70 },
  { key: 'celeb_catering', title: 'Book catering / order food', category: 'vendors', dueOffsetDays: 50 },
  { key: 'celeb_photo', title: 'Book a photographer', category: 'vendors', dueOffsetDays: 40 },
  { key: 'celeb_host', title: 'Book a host (if you want one)', category: 'vendors', dueOffsetDays: 35 },
  { key: 'celeb_program', title: 'Finalize your program', category: 'logistics', dueOffsetDays: 21 },
  { key: 'celeb_final_headcount', title: 'Confirm your final headcount', category: 'guests', dueOffsetDays: 7 },
];

/**
 * The per-type registry. Keyed by `events.event_type`. Wedding is absent by
 * design (it uses the canonical `CHECKLIST_TEMPLATE`).
 */
export const EVENT_TYPE_CHECKLIST_DEFS: Readonly<Record<string, EventTypeChecklistDef>> = {
  debut: { eventType: 'debut', dateModel: 'input', anchorCategory: 'venue', tier2Core: ['catering', 'photo_video', 'hmua', 'lights_sounds'], template: DEBUT_TEMPLATE },
  birthday: { eventType: 'birthday', dateModel: 'input', anchorCategory: 'venue', tier2Core: ['catering', 'cake', 'entertainment', 'photo_video'], template: BIRTHDAY_TEMPLATE },
  christening: { eventType: 'christening', dateModel: 'output', anchorCategory: 'parish_schedule', tier2Core: ['catering', 'photo_video', 'cake'], template: CHRISTENING_TEMPLATE },
  corporate: { eventType: 'corporate', dateModel: 'input', anchorCategory: 'venue', tier2Core: ['catering', 'av_production', 'host', 'photo_video'], template: CORPORATE_TEMPLATE },
  tournament: { eventType: 'tournament', dateModel: 'input', anchorCategory: 'venue', tier2Core: ['officials', 'awards', 'catering', 'medic'], template: TOURNAMENT_TEMPLATE },
  gender_reveal: { eventType: 'gender_reveal', dateModel: 'input', anchorCategory: 'venue', tier2Core: ['reveal_element', 'catering', 'photo_video'], template: GENDER_REVEAL_TEMPLATE },
  travel: { eventType: 'travel', dateModel: 'input', anchorCategory: 'accommodation', tier2Core: ['transport', 'accommodation', 'activities'], template: TRAVEL_TEMPLATE },
  celebration: { eventType: 'celebration', dateModel: 'input', anchorCategory: 'venue', tier2Core: ['catering', 'photo_video', 'host'], template: CELEBRATION_TEMPLATE },
};

/**
 * Generic fallback checklist for any ENABLED non-wedding type that has no
 * dedicated def above — anniversary · graduation · reunion · gala_night ·
 * simple_event, plus any future admin-created type. Reuses the generic
 * `CELEBRATION_TEMPLATE` (purpose · budget · guests · venue · catering · photo ·
 * host · program · headcount) so those events open a REAL planning surface
 * instead of a blank checklist. (Enabling all 14 event types outran the per-type
 * defs — this closes that gap.) Only `.template` is consumed by the seeder.
 */
export const GENERIC_EVENT_CHECKLIST_DEF: EventTypeChecklistDef =
  EVENT_TYPE_CHECKLIST_DEFS.celebration;

/**
 * The checklist definition for an event type, or `null` for wedding / unset —
 * the caller falls back to the canonical wedding `CHECKLIST_TEMPLATE`. Keeping
 * wedding out of the registry is what guarantees the live wedding checklist
 * stays byte-identical through this change.
 */
export function checklistDefForEventType(
  eventType: string | null | undefined,
): EventTypeChecklistDef | null {
  if (eventType == null || eventType === 'wedding') return null;
  return EVENT_TYPE_CHECKLIST_DEFS[eventType] ?? null;
}
