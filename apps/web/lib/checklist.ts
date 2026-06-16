/**
 * Couple planning checklist — template, persistence, and the urgency filter.
 *
 * A lightweight, deterministic planning checklist for the couple dashboard.
 * Owner-authorized 2026-06-13 as a NEW surface — see the lineage note below.
 *
 * ── Relationship to the retired "Today's Focus" wizard ──────────────────────
 * The single-thing "Today's Focus" wizard was owner-retired 2026-06-03 (/today
 * redirects; lib/wizard.ts + lib/todays-one-thing.ts are dormant). This is a
 * DIFFERENT surface: a multi-item checklist the couple checks off at their own
 * pace, with a pure ranking filter that surfaces only the few most time-urgent
 * items for wherever they are in the runway. It does NOT revive the wizard.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Split, mirroring lib/guests.ts:
 *   - The TEMPLATE + pure helpers (daysUntilEvent / dueDateForItem /
 *     rankUrgentChecklistItems) are integration-agnostic — no Supabase, no
 *     React. Same inputs → same output; safe on server and client.
 *   - The fetcher reads persisted rows (a couple can complete / un-complete
 *     items, and the done-state must survive reloads — hence a table, not a
 *     derived list).
 *
 * The ranking is the feature the brief asks for: given the days remaining until
 * the event, surface only the top-N most urgent OPEN items for that window. Each
 * template item carries a `dueOffsetDays` (how many days BEFORE the event it
 * should be done); the item's due date = event_date − offset, and "most urgent"
 * = soonest (or most overdue) due date among still-open items.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelationError, logQueryError } from '@/lib/supabase/error-detect';

export type ChecklistCategory =
  | 'foundations'
  | 'vendors'
  | 'guests'
  | 'paperwork'
  | 'attire'
  | 'design'
  | 'logistics'
  | 'final_week';

export const CHECKLIST_CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  foundations: 'Foundations',
  vendors: 'Vendors',
  guests: 'Guests',
  paperwork: 'Paperwork',
  attire: 'Attire',
  design: 'Design',
  logistics: 'Logistics',
  final_week: 'Final week',
};

export type ChecklistStatus = 'pending' | 'done';

export type ChecklistTemplateItem = {
  /** Stable key — the link between the seeded row and this template entry. */
  key: string;
  title: string;
  category: ChecklistCategory;
  /**
   * Days BEFORE the event this item should be done by (its planning window).
   * May exceed 365 (18-month-out tasks) or go <= 0 (wedding day & after).
   */
  dueOffsetDays: number;
  /**
   * Deterministic ceremony-tailoring (the free "Setnayan AI" personalization):
   * when present and it returns false for the couple's ceremony_type, the item
   * is NOT seeded for that event. Omit for universal tasks. Church-specific
   * steps (banns, canonical interview, Pre-Cana) use {@link isChurchCeremony}.
   */
  appliesTo?: (ceremonyType: string | null | undefined) => boolean;
};

/**
 * Church-path predicate for ceremony-specific tailoring. True for a Catholic
 * ceremony OR when the type isn't set yet (don't hide guidance prematurely);
 * false once the couple has chosen a non-church path (civil, etc.). Matches the
 * `applies_to = 'catholic'` precedent in lib/upcoming-items statutory deadlines.
 */
export function isChurchCeremony(ceremonyType: string | null | undefined): boolean {
  return ceremonyType == null || ceremonyType === 'catholic';
}

/**
 * The standard PH-wedding planning checklist, ordered from earliest planning
 * runway (≈12 months out) to the final-week tasks. `dueOffsetDays` places each
 * item on the countdown; the ranking filter reads it to know what's urgent now.
 * The host can complete, skip, or ignore any item — this is a guide, not a gate.
 *
 * Seeded into `event_checklist_items` on first open (see actions.ensureSeeded).
 */
export const CHECKLIST_TEMPLATE: ReadonlyArray<ChecklistTemplateItem> = [
  // ══ 18–12 months before — Foundations & the big bookings ══
  { key: 'decide_type', title: 'Decide your wedding type & overall vibe (church, civil, garden, destination)', category: 'foundations', dueOffsetDays: 540 },
  { key: 'who_pays', title: 'Agree on the budget split — who pays for what', category: 'foundations', dueOffsetDays: 530 },
  { key: 'shortlist_dates', title: 'Shortlist 2–3 possible wedding dates', category: 'foundations', dueOffsetDays: 520 },
  { key: 'draft_guest_list', title: 'Draft a rough guest list (start lean — it always grows)', category: 'guests', dueOffsetDays: 510 },
  { key: 'pick_party', title: 'Choose your wedding party (maid of honour, best man, entourage)', category: 'foundations', dueOffsetDays: 500 },
  { key: 'shortlist_venues', title: 'Research & shortlist your ceremony and reception venues', category: 'vendors', dueOffsetDays: 470 },
  { key: 'ask_parish', title: 'Ask your parish for its full requirements list & timeline', category: 'paperwork', dueOffsetDays: 460, appliesTo: isChurchCeremony },

  // ══ 12–9 months before — Lock your look & key vendors ══
  { key: 'set_date', title: 'Lock your wedding date', category: 'foundations', dueOffsetDays: 365 },
  { key: 'set_budget', title: 'Set your overall budget', category: 'foundations', dueOffsetDays: 360 },
  { key: 'guest_estimate', title: 'Estimate your guest count', category: 'foundations', dueOffsetDays: 350 },
  { key: 'lock_theme', title: 'Lock your theme, palette & overall style', category: 'design', dueOffsetDays: 340 },
  { key: 'book_venue', title: 'Book your ceremony & reception venue', category: 'vendors', dueOffsetDays: 330 },
  { key: 'book_host', title: 'Book your host / emcee', category: 'vendors', dueOffsetDays: 320 },
  { key: 'book_ceremony_music', title: 'Book your ceremony musicians (string quartet, choir, soloist)', category: 'vendors', dueOffsetDays: 310 },
  { key: 'book_reception_music', title: 'Book your reception music (band, DJ, or mobile bar)', category: 'vendors', dueOffsetDays: 305 },
  { key: 'book_florist', title: 'Book your florist / stylist', category: 'vendors', dueOffsetDays: 300 },
  { key: 'hotel_block', title: 'Reserve hotel room blocks for out-of-town guests', category: 'logistics', dueOffsetDays: 290 },
  { key: 'honeymoon_plan', title: 'Start planning your honeymoon (visas, peak-season bookings)', category: 'logistics', dueOffsetDays: 285 },
  { key: 'invite_sponsors', title: 'Personally invite your principal sponsors (Ninong & Ninang)', category: 'guests', dueOffsetDays: 280 },

  // ══ 9–6 months before — The details take shape ══
  { key: 'book_caterer', title: 'Book your caterer', category: 'vendors', dueOffsetDays: 270 },
  { key: 'collect_contacts', title: 'Collect complete contact details for your guest list', category: 'guests', dueOffsetDays: 265 },
  { key: 'book_photo', title: 'Book photographer & videographer', category: 'vendors', dueOffsetDays: 260 },
  { key: 'save_the_dates', title: 'Design & send your Save-the-Dates', category: 'guests', dueOffsetDays: 255 },
  { key: 'order_cake', title: 'Order your wedding cake', category: 'vendors', dueOffsetDays: 250 },
  { key: 'book_photobooth', title: 'Book a photobooth', category: 'vendors', dueOffsetDays: 245 },
  { key: 'book_hmua', title: 'Book hair & makeup artist', category: 'vendors', dueOffsetDays: 240 },
  { key: 'book_lights_sound', title: 'Book your lights & sound', category: 'vendors', dueOffsetDays: 235 },
  { key: 'book_coordinator', title: 'Book your coordinator', category: 'vendors', dueOffsetDays: 230 },
  { key: 'book_bridal_car', title: 'Book your bridal car / transportation', category: 'logistics', dueOffsetDays: 225 },
  { key: 'book_groom_attire', title: 'Book groom & groomsmen attire (barong / suit)', category: 'attire', dueOffsetDays: 215 },
  { key: 'choose_secondary_sponsors', title: 'Choose your secondary sponsors (candle, veil, cord) & bearers', category: 'guests', dueOffsetDays: 205 },

  // ══ 6–4 months before — Invitations, fittings & flow ══
  { key: 'attire', title: 'Order wedding attire (gown & suit)', category: 'attire', dueOffsetDays: 180 },
  { key: 'psa_cenomar', title: 'Request PSA / CENOMAR documents', category: 'paperwork', dueOffsetDays: 180 },
  { key: 'order_invitations', title: 'Design & order your invitations', category: 'guests', dueOffsetDays: 175 },
  { key: 'mood_board', title: 'Finalize your mood board & palette', category: 'design', dueOffsetDays: 170 },
  { key: 'prenup_shoot', title: 'Book your prenup / engagement shoot', category: 'vendors', dueOffsetDays: 165 },
  { key: 'first_fitting', title: 'First gown fitting & makeup trial', category: 'attire', dueOffsetDays: 160 },
  { key: 'pre_cana', title: 'Book a pre-Cana / marriage seminar', category: 'paperwork', dueOffsetDays: 150, appliesTo: isChurchCeremony },
  { key: 'choose_favours', title: 'Choose your guest favours', category: 'design', dueOffsetDays: 145 },
  { key: 'reception_flow', title: 'Finalize your reception flow with your coordinator', category: 'logistics', dueOffsetDays: 140 },
  { key: 'pick_songs', title: 'Pick your processional, first-dance & parents’ songs', category: 'design', dueOffsetDays: 135 },
  { key: 'work_leave', title: 'Apply for time off / leave from work', category: 'logistics', dueOffsetDays: 130 },
  { key: 'canonical_interview', title: 'Schedule your canonical interview with the priest', category: 'paperwork', dueOffsetDays: 125, appliesTo: isChurchCeremony },

  // ══ 4–2 months before — Legal crunch time ══
  { key: 'marriage_license', title: 'Apply for your marriage license', category: 'paperwork', dueOffsetDays: 120 },
  { key: 'invitations', title: 'Send your invitations (set the RSVP deadline ~3 weeks out)', category: 'guests', dueOffsetDays: 120 },
  { key: 'submit_church_reqs', title: 'Submit your church requirements to your parish', category: 'paperwork', dueOffsetDays: 115, appliesTo: isChurchCeremony },
  { key: 'monogram', title: 'Finalize your monogram', category: 'design', dueOffsetDays: 110 },
  { key: 'confirm_banns', title: 'Confirm your church banns are posted', category: 'paperwork', dueOffsetDays: 108, appliesTo: isChurchCeremony },
  { key: 'church_fee', title: 'Pay your church wedding fee / package', category: 'paperwork', dueOffsetDays: 105, appliesTo: isChurchCeremony },
  { key: 'guest_list', title: 'Finalize your guest list', category: 'guests', dueOffsetDays: 90 },
  { key: 'sponsors', title: 'Confirm your principal sponsors', category: 'guests', dueOffsetDays: 90 },
  { key: 'second_fitting', title: 'Second gown fitting', category: 'attire', dueOffsetDays: 80 },
  { key: 'menu_tasting', title: 'Do your menu tasting', category: 'vendors', dueOffsetDays: 75 },
  { key: 'party_gifts', title: 'Buy gifts for your wedding party & parents', category: 'design', dueOffsetDays: 70 },

  // ══ 2–1 months before — Tighten every detail ══
  { key: 'schedule', title: 'Build your wedding-day timeline', category: 'logistics', dueOffsetDays: 60 },
  { key: 'rings', title: 'Buy your wedding rings', category: 'attire', dueOffsetDays: 60 },
  { key: 'final_vendor_meetings', title: 'Hold your final vendor meetings (times, deliverables, balances)', category: 'vendors', dueOffsetDays: 45 },
  { key: 'shot_list', title: 'Give your photo & video team your shot list & must-have moments', category: 'vendors', dueOffsetDays: 40 },
  { key: 'final_fittings', title: 'Final attire fittings — no more changes after this', category: 'attire', dueOffsetDays: 36 },
  { key: 'hmua_trial', title: 'Do your hair & makeup trial', category: 'attire', dueOffsetDays: 34 },
  { key: 'write_vows', title: 'Write your vows & any speeches', category: 'logistics', dueOffsetDays: 32 },
  { key: 'confirm_honeymoon', title: 'Confirm honeymoon bookings, tickets & visas (passports valid 6+ months)', category: 'logistics', dueOffsetDays: 31 },

  // ══ 1 month – 2 weeks before — Final confirmations ══
  { key: 'seating', title: 'Finalize your seating chart', category: 'logistics', dueOffsetDays: 30 },
  { key: 'rsvp_followup', title: 'Follow up with pending RSVPs', category: 'guests', dueOffsetDays: 30 },
  { key: 'reconfirm_vendors', title: 'Reconfirm every vendor in writing (date, call-time, address, balance)', category: 'vendors', dueOffsetDays: 22 },
  { key: 'distribute_calltimes', title: 'Distribute call-times & roles to the entire entourage', category: 'logistics', dueOffsetDays: 20 },
  { key: 'master_timeline', title: 'Hand your coordinator the master timeline & emergency contacts', category: 'logistics', dueOffsetDays: 18 },
  { key: 'cash_envelopes', title: 'Prepare labelled cash envelopes for tips & balances', category: 'logistics', dueOffsetDays: 15 },

  // ══ The final 2 weeks — Hand off the wheel ══
  { key: 'final_headcount', title: 'Give caterer your final headcount', category: 'vendors', dueOffsetDays: 14 },
  { key: 'break_in_shoes', title: 'Break in your wedding shoes at home', category: 'attire', dueOffsetDays: 12 },
  { key: 'confirm_officiant', title: 'Confirm the officiant’s fee & church donation', category: 'paperwork', dueOffsetDays: 11, appliesTo: isChurchCeremony },
  { key: 'final_payments', title: 'Settle remaining vendor balances', category: 'vendors', dueOffsetDays: 10 },
  { key: 'confirm_vendors', title: 'Confirm call times with all vendors', category: 'final_week', dueOffsetDays: 7 },
  { key: 'handoff_docs', title: 'Hand rings, marriage licence & documents to your coordinator', category: 'logistics', dueOffsetDays: 6 },
  { key: 'emcee_script', title: 'Prepare your emcee / host script', category: 'final_week', dueOffsetDays: 5 },
  { key: 'pack_overnight', title: 'Pack for the wedding night & honeymoon', category: 'logistics', dueOffsetDays: 4 },
  { key: 'pack_emergency', title: 'Pack a wedding-day emergency kit', category: 'final_week', dueOffsetDays: 3 },
  { key: 'beauty_prep', title: 'Final beauty prep (nails, grooming)', category: 'attire', dueOffsetDays: 2 },
  { key: 'rehearsal', title: 'Run your ceremony rehearsal', category: 'final_week', dueOffsetDays: 1 },
  { key: 'lay_out_everything', title: 'Lay out everything for the day (attire, shoes, docs, rings, vows)', category: 'final_week', dueOffsetDays: 1 },
  { key: 'confirm_prep_meals', title: 'Confirm morning prep meals are arranged', category: 'logistics', dueOffsetDays: 1 },
  { key: 'early_night', title: 'Get an early night — no late-night stress', category: 'logistics', dueOffsetDays: 1 },

  // ══ Wedding day & after — Be present, then wrap up ══
  { key: 'eat_breakfast', title: 'Eat a real breakfast', category: 'logistics', dueOffsetDays: 0 },
  { key: 'hand_to_coordinator', title: 'Hand the day to your coordinator — just be present', category: 'logistics', dueOffsetDays: 0 },
  { key: 'sign_contract', title: 'Make sure the marriage contract is signed (you, spouse, officiant, sponsors)', category: 'paperwork', dueOffsetDays: 0 },
  { key: 'enjoy_day', title: 'Be present and soak it all in', category: 'logistics', dueOffsetDays: 0 },
  { key: 'settle_after', title: 'Settle balances & tips for any pay-after vendors', category: 'vendors', dueOffsetDays: -1 },
  { key: 'claim_marriage_cert', title: 'Claim your PSA-registered Marriage Certificate', category: 'paperwork', dueOffsetDays: -21 },
  { key: 'name_change', title: 'Begin your name-change documents (PSA › IDs › bank › SSS/PhilHealth/Pag-IBIG › passport)', category: 'paperwork', dueOffsetDays: -30 },
  { key: 'thank_you_notes', title: 'Write & send your thank-you notes', category: 'guests', dueOffsetDays: -35 },
  { key: 'rate_vendors', title: 'Rate your vendors & preserve your photos and videos', category: 'vendors', dueOffsetDays: -45 },
];

// ── Countdown phases ─────────────────────────────────────────────────────────
// Nine time-buckets the full checklist is grouped under on the browsable page,
// derived purely from `dueOffsetDays` (no schema column). `maxDays`/`minDays`
// are INCLUSIVE days-before-event bounds. The arc runs 18 months out → the day
// of & beyond (negative offsets = post-wedding tasks).

export type ChecklistPhase = {
  id: string;
  label: string;
  blurb: string;
  /** Inclusive upper bound, in days before the event. */
  maxDays: number;
  /** Inclusive lower bound, in days before the event (may be negative). */
  minDays: number;
};

export const CHECKLIST_PHASES: ReadonlyArray<ChecklistPhase> = [
  { id: 'p1', label: '18–12 months before', blurb: 'Foundations & the big bookings', maxDays: 100000, minDays: 366 },
  { id: 'p2', label: '12–9 months before', blurb: 'Lock your look & key vendors', maxDays: 365, minDays: 271 },
  { id: 'p3', label: '9–6 months before', blurb: 'The details take shape', maxDays: 270, minDays: 181 },
  { id: 'p4', label: '6–4 months before', blurb: 'Invitations, fittings & flow', maxDays: 180, minDays: 121 },
  { id: 'p5', label: '4–2 months before', blurb: 'Legal crunch time', maxDays: 120, minDays: 61 },
  { id: 'p6', label: '2–1 months before', blurb: 'Tighten every detail', maxDays: 60, minDays: 31 },
  { id: 'p7', label: '1 month – 2 weeks before', blurb: 'Final confirmations', maxDays: 30, minDays: 15 },
  { id: 'p8', label: 'The final 2 weeks', blurb: 'Hand off the wheel', maxDays: 14, minDays: 1 },
  { id: 'p9', label: 'Wedding day & after', blurb: 'Be present — then wrap up', maxDays: 0, minDays: -100000 },
];

/** The phase a days-before-event offset belongs to, or null for undated items. */
export function phaseForOffset(dueOffsetDays: number | null): ChecklistPhase | null {
  if (dueOffsetDays == null) return null;
  return (
    CHECKLIST_PHASES.find((p) => dueOffsetDays <= p.maxDays && dueOffsetDays >= p.minDays) ?? null
  );
}

export type ChecklistItemRow = {
  item_id: string;
  public_id: string;
  event_id: string;
  /** Template key when seeded, null for a host-added custom item. */
  template_key: string | null;
  title: string;
  category: ChecklistCategory;
  /** Days before the event this is due; null = no countdown (manual item). */
  due_offset_days: number | null;
  status: ChecklistStatus;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
};

/** A row enriched with computed due-date + urgency, for ranking + display. */
export type ChecklistItemView = ChecklistItemRow & {
  /** ISO yyyy-mm-dd this item is due by, or null when no offset / no event date. */
  dueDate: string | null;
  /** Whole days from `now` until due. Negative = overdue. Null = no due date. */
  daysUntilDue: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-midnight epoch for a YYYY-MM-DD (or full ISO) date string. Mirrors the
 *  tz-safe parse in lib/day-of-mode so countdowns align to the couple's clock. */
function dateToLocalEpoch(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0).getTime();
  }
  return new Date(date).getTime();
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
}

/**
 * Whole days from `now` until the event. Negative once the date has passed,
 * null when no date is set. Pure (clock passed in for deterministic tests).
 */
export function daysUntilEvent(
  eventDate: string | null,
  now: Date = new Date(),
): number | null {
  if (!eventDate) return null;
  const eventMs = dateToLocalEpoch(eventDate);
  if (!Number.isFinite(eventMs)) return null;
  return Math.round((eventMs - startOfDay(now)) / DAY_MS);
}

/** The ISO yyyy-mm-dd an item is due by = event_date − offset days. */
export function dueDateForItem(
  eventDate: string | null,
  dueOffsetDays: number | null,
): string | null {
  if (!eventDate || dueOffsetDays == null) return null;
  const eventMs = dateToLocalEpoch(eventDate);
  if (!Number.isFinite(eventMs)) return null;
  const due = new Date(eventMs - dueOffsetDays * DAY_MS);
  const y = due.getFullYear();
  const mo = String(due.getMonth() + 1).padStart(2, '0');
  const d = String(due.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/** Enrich a row with its computed due date + days-until-due. */
export function toChecklistView(
  row: ChecklistItemRow,
  eventDate: string | null,
  now: Date = new Date(),
): ChecklistItemView {
  const dueDate = dueDateForItem(eventDate, row.due_offset_days);
  const daysUntilDue =
    dueDate != null
      ? Math.round((dateToLocalEpoch(dueDate) - startOfDay(now)) / DAY_MS)
      : null;
  return { ...row, dueDate, daysUntilDue };
}

export type RankOptions = {
  /** How many items to surface. The brief asks for the top 3. */
  limit?: number;
  /** Clock, injectable for deterministic tests. */
  now?: Date;
};

/**
 * THE FEATURE: given the days remaining until the event, surface only the most
 * time-urgent OPEN checklist items for that window.
 *
 * Deterministic. Open (pending) items only; done items never resurface. Items
 * are ranked by due date — most overdue first, then soonest-due — so the list
 * naturally tracks the countdown: a couple 9 months out sees venue/caterer
 * tasks; a couple 2 weeks out sees headcount/payments. Items with no due date
 * (custom host items) sort last, after every dated item. Ties broken by
 * sort_order for stability.
 *
 * @example
 * // 60 days out → surfaces seating, RSVP follow-up, final headcount
 * rankUrgentChecklistItems(items, '2026-08-12', { limit: 3 });
 */
export function rankUrgentChecklistItems(
  rows: ReadonlyArray<ChecklistItemRow>,
  eventDate: string | null,
  opts: RankOptions = {},
): ChecklistItemView[] {
  const limit = opts.limit ?? 3;
  const now = opts.now ?? new Date();

  const open = rows
    .filter((r) => r.status === 'pending')
    .map((r) => toChecklistView(r, eventDate, now));

  open.sort((a, b) => {
    // Dated items always rank above undated ones.
    if (a.daysUntilDue == null && b.daysUntilDue == null) {
      return a.sort_order - b.sort_order;
    }
    if (a.daysUntilDue == null) return 1;
    if (b.daysUntilDue == null) return -1;
    // Soonest / most-overdue first.
    if (a.daysUntilDue !== b.daysUntilDue) return a.daysUntilDue - b.daysUntilDue;
    return a.sort_order - b.sort_order;
  });

  return open.slice(0, Math.max(0, limit));
}

const FIELDS =
  'item_id,public_id,event_id,template_key,title,category,due_offset_days,status,sort_order,completed_at,created_at';

/**
 * Fetch all checklist rows for an event. Graceful-degrade to [] on any error
 * (mirrors lib/guests) so the home-page render never crashes if the migration
 * hasn't reached this environment yet — the checklist card just won't show.
 */
export async function fetchChecklistItems(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ChecklistItemRow[]> {
  const { data, error } = await supabase
    .from('event_checklist_items')
    .select(FIELDS)
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });

  if (error) {
    logQueryError(
      'fetchChecklistItems',
      error,
      { event_id: eventId, missing_relation_match: isMissingRelationError(error) },
      'graceful_degrade',
    );
    return [];
  }
  return (data ?? []) as unknown as ChecklistItemRow[];
}

export type ChecklistSeedRow = Pick<
  ChecklistItemRow,
  'event_id' | 'template_key' | 'title' | 'category' | 'due_offset_days' | 'status' | 'sort_order'
>;

/**
 * Build the seed payload (one row per applicable template item) for an event.
 * `sort_order` follows the full template index (the template is ordered by
 * countdown) so the list reads chronologically and the value is STABLE — a row
 * keeps the same sort_order whether it's seeded at creation or topped-up later.
 *
 * `ceremonyType` drives the free deterministic tailoring: church-only steps are
 * dropped for a non-church ceremony. Omitting it (or passing null) keeps every
 * item — so existing callers and the no-arg unit test are unaffected.
 */
export function buildChecklistSeed(
  eventId: string,
  ceremonyType: string | null = null,
): ChecklistSeedRow[] {
  const rows: ChecklistSeedRow[] = [];
  CHECKLIST_TEMPLATE.forEach((t, idx) => {
    if (t.appliesTo && !t.appliesTo(ceremonyType)) return;
    rows.push({
      event_id: eventId,
      template_key: t.key,
      title: t.title,
      category: t.category,
      due_offset_days: t.dueOffsetDays,
      status: 'pending' as ChecklistStatus,
      sort_order: (idx + 1) * 10,
    });
  });
  return rows;
}

export type ChecklistPhaseGroup = {
  phase: ChecklistPhase | null;
  items: ChecklistItemView[];
};

/**
 * Group all rows under their countdown phase for the browsable checklist page,
 * in phase order. Within a phase: still-open items first (earliest planning
 * window first), then done items — per the "completion-sink" rule, done tasks
 * stay visible but settle to the bottom. Undated custom items collect in a
 * trailing null-phase group. Empty phases are dropped.
 */
export function groupChecklistByPhase(
  rows: ReadonlyArray<ChecklistItemRow>,
  eventDate: string | null,
  now: Date = new Date(),
): ChecklistPhaseGroup[] {
  const views = rows.map((r) => toChecklistView(r, eventDate, now));
  const order = new Map(CHECKLIST_PHASES.map((p, i) => [p.id, i]));

  const buckets = new Map<string, ChecklistItemView[]>();
  const undated: ChecklistItemView[] = [];
  for (const v of views) {
    const phase = phaseForOffset(v.due_offset_days);
    if (!phase) {
      undated.push(v);
      continue;
    }
    const list = buckets.get(phase.id);
    if (list) list.push(v);
    else buckets.set(phase.id, [v]);
  }

  const sortWithin = (a: ChecklistItemView, b: ChecklistItemView): number => {
    // Open before done (completion-sink).
    if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
    // Earliest planning window first (larger days-before = earlier).
    const ao = a.due_offset_days ?? -Infinity;
    const bo = b.due_offset_days ?? -Infinity;
    if (ao !== bo) return bo - ao;
    return a.sort_order - b.sort_order;
  };

  const groups: ChecklistPhaseGroup[] = CHECKLIST_PHASES.filter((p) => buckets.has(p.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((phase) => ({ phase, items: buckets.get(phase.id)!.sort(sortWithin) }));

  if (undated.length > 0) {
    groups.push({ phase: null, items: undated.sort(sortWithin) });
  }
  return groups;
}

/**
 * Deep-link a template task to the surface where it actually gets done, when
 * there's an obvious one. Returns null for tasks with no single destination
 * (the row then renders without a jump arrow). Shared by the home card and the
 * full checklist page so the routing lives in one place.
 */
export function checklistItemHref(eventId: string, key: string | null): string | null {
  if (!key) return null;
  const base = `/dashboard/${eventId}`;

  // Booking tasks jump STRAIGHT to that category in the vendor Shortlist
  // (`?tab=shortlist&open=<tile>` opens the Find tab with the right folder/tile
  // expanded) instead of the generic collapsed list. Tiles mirror PLAN_GROUPS
  // catalogTile. Other vendor tasks (tastings, follow-ups) fall through to the
  // plain vendors surface below.
  const VENDOR_TILE: Record<string, string> = {
    shortlist_venues: 'reception',
    book_venue: 'reception',
    book_caterer: 'catering',
    book_photo: 'photo_video',
    book_hmua: 'hmua',
    book_coordinator: 'coordinator',
    book_florist: 'florist',
    book_host: 'host_mc',
    book_reception_music: 'live_band',
    book_photobooth: 'photo_booth',
    book_lights_sound: 'lights_sound',
    book_bridal_car: 'bridal_car',
    order_cake: 'cake',
  };
  if (VENDOR_TILE[key]) return `${base}/vendors?tab=shortlist&open=${VENDOR_TILE[key]}`;

  const map: Record<string, string> = {
    // Budget & money
    set_budget: `${base}/budget`,
    who_pays: `${base}/budget`,
    final_payments: `${base}/budget`,
    settle_after: `${base}/budget`,
    party_gifts: `${base}/budget`,
    cash_envelopes: `${base}/budget`,
    // Vendors
    shortlist_venues: `${base}/vendors`,
    book_venue: `${base}/vendors`,
    book_caterer: `${base}/vendors`,
    book_photo: `${base}/vendors`,
    book_hmua: `${base}/vendors`,
    book_coordinator: `${base}/vendors`,
    book_host: `${base}/vendors`,
    book_ceremony_music: `${base}/vendors`,
    book_reception_music: `${base}/vendors`,
    book_florist: `${base}/vendors`,
    book_photobooth: `${base}/vendors`,
    book_lights_sound: `${base}/vendors`,
    book_bridal_car: `${base}/vendors`,
    prenup_shoot: `${base}/vendors`,
    order_cake: `${base}/vendors`,
    menu_tasting: `${base}/vendors`,
    final_vendor_meetings: `${base}/vendors`,
    shot_list: `${base}/vendors`,
    reconfirm_vendors: `${base}/vendors`,
    rate_vendors: `${base}/vendors`,
    // Guests
    draft_guest_list: `${base}/guests`,
    guest_estimate: `${base}/guests`,
    collect_contacts: `${base}/guests`,
    guest_list: `${base}/guests`,
    sponsors: `${base}/guests`,
    invite_sponsors: `${base}/guests`,
    choose_secondary_sponsors: `${base}/guests`,
    rsvp_followup: `${base}/guests`,
    final_headcount: `${base}/guests`,
    thank_you_notes: `${base}/guests`,
    // Invitations
    save_the_dates: `${base}/invitation`,
    order_invitations: `${base}/invitation`,
    invitations: `${base}/invitation`,
    // Design
    lock_theme: `${base}/add-ons/mood-board`,
    mood_board: `${base}/add-ons/mood-board`,
    choose_favours: `${base}/design`,
    monogram: `${base}/monogram`,
    // Schedule
    schedule: `${base}/schedule`,
    reception_flow: `${base}/schedule`,
    distribute_calltimes: `${base}/schedule`,
    master_timeline: `${base}/schedule`,
    emcee_script: `${base}/schedule`,
    rehearsal: `${base}/schedule`,
    // Seating
    seating: `${base}/seating`,
    // Paperwork
    psa_cenomar: `${base}/paperwork`,
    marriage_license: `${base}/paperwork`,
    pre_cana: `${base}/paperwork`,
    ask_parish: `${base}/paperwork`,
    submit_church_reqs: `${base}/paperwork`,
    confirm_banns: `${base}/paperwork`,
    church_fee: `${base}/paperwork`,
    canonical_interview: `${base}/paperwork`,
    confirm_officiant: `${base}/paperwork`,
    sign_contract: `${base}/paperwork`,
    claim_marriage_cert: `${base}/paperwork`,
    name_change: `${base}/paperwork`,
  };
  return map[key] ?? null;
}
