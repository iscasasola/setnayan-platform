/**
 * lib/planning-twins.ts — WHICH AUTOFILL ROW IS THE SAME WORK AS WHICH TO-DO TASK (owner 2026-11-01, "Checklist
 * merges into Planning Stage": *"A Checklist task that duplicates an autofill row shows once."*).
 *
 * Planning Stage gathers rows from the app's own facts (a supplier payment due, a paperwork deadline, a confirmed
 * meeting, a statutory window) and, since the merge, the template tasks of the old Checklist. Some of those are one
 * piece of work told twice: "Request PSA / CENOMAR documents" (task) and "PSA + CENOMAR window opens" (milestone);
 * "Do your menu tasting" (task) and the confirmed Food tasting (meeting); "Book your caterer" (task) and that caterer's
 * first payment line. This module names those pairs — a pure lookup, nothing read here.
 *
 * 🔑 THE RULE (applied in `lib/preparation.ts` · `foldTwins`):
 *   · An OPEN task absorbs its twins: the twin row disappears, the task stays the ONE row (it carries the tick and the
 *     date the host can move), and it shows the twin's fact and links to where that fact is acted on.
 *   · A DONE task absorbs only its MILESTONE twins (a window opening says nothing once the task is done). A payment,
 *     paperwork or meeting twin of a done task is still outstanding on its own, so it shows on its own.
 *   · The task keeps its OWN date. A fold never moves a task and never adds or removes one — so the "To do" filter, and
 *     every count read off it (Home, the events board), comes out the same whether or not the autofill was read.
 *
 * Every pair is explicit. A row with no entry here is never folded; a wrong guess would hide real work.
 */

import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';

/** What an autofill row says about itself, for the twin lookup. Set where the row is built (`lib/preparation.ts`). */
export type PlanningTwinSignal =
  | { kind: 'milestone'; key: string }
  | { kind: 'paperwork'; documentType: string }
  | { kind: 'meeting'; appointmentType: string }
  /** `firstLine` — the supplier's earliest still-owed line (its deposit), the only one a booking task stands for. */
  | { kind: 'payment'; category: string | null; firstLine: boolean };

/** Statutory window → the task that acts on it. */
const MILESTONE_TWINS: Readonly<Record<string, string>> = {
  psa_cenomar_window: 'psa_cenomar',
  marriage_license_window: 'marriage_license',
  pre_cana_cutoff: 'pre_cana',
};

/** Paperwork document → the task that gets it. Several documents may share one task (four PSA papers, one request). */
function paperworkTwin(documentType: string): string | null {
  if (documentType.startsWith('psa_birth_cert') || documentType.startsWith('cenomar')) return 'psa_cenomar';
  if (documentType === 'marriage_license') return 'marriage_license';
  if (documentType === 'pre_cana_certificate') return 'pre_cana';
  if (documentType === 'banns_posted') return 'confirm_banns';
  if (documentType === 'canonical_interview_complete') return 'canonical_interview';
  if (documentType.startsWith('baptismal_cert') || documentType.startsWith('confirmation_cert')) return 'submit_church_reqs';
  return null;
}

/** A confirmed appointment's catalogue type (`appointment_type_catalog.type`) → the task it fulfils. */
const MEETING_TWINS: Readonly<Record<string, string>> = {
  food_tasting: 'menu_tasting',
  fitting_1: 'first_fitting',
  fitting_2: 'second_fitting',
  fitting_final: 'final_fittings',
  makeup_trial: 'hmua_trial',
  shot_list_review: 'shot_list',
  final_headcount: 'final_headcount',
  engagement_shoot: 'prenup_shoot',
  rehearsal: 'rehearsal',
};

/**
 * Plan group → the task that books (and first pays) a supplier of that group. Reception and ceremony venues are two
 * tasks, so they are two groups here. Reception music is band/DJ only (string quartets and choirs are the ceremony's).
 */
const BOOKING_TASK_BY_GROUP: Readonly<Record<string, string>> = {
  reception_venue: 'book_reception_venue',
  ceremony_venue: 'book_venue',
  catering: 'book_caterer',
  photography: 'book_photo',
  hair_makeup: 'book_hmua',
  coordinator: 'book_coordinator',
  florals_decor: 'book_florist',
  host_mc: 'book_host',
  lights_sound: 'book_lights_sound',
  photobooth: 'book_photobooth',
  bridal_car: 'book_bridal_car',
  cake: 'order_cake',
  attire: 'attire',
  rings: 'rings',
  accommodation: 'hotel_block',
  travel_honeymoon: 'honeymoon_plan',
  invitations_stationery: 'order_invitations',
};
const BOOKING_TASK_BY_CATEGORY_OVERRIDE: Readonly<Record<string, string>> = { band_dj: 'book_reception_music' };

const BOOKING_TASK_BY_CATEGORY: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const g of PLAN_GROUPS) {
    const task = BOOKING_TASK_BY_GROUP[g.id];
    if (!task) continue;
    for (const c of g.categories) if (!m.has(c)) m.set(c, task);
  }
  for (const [c, task] of Object.entries(BOOKING_TASK_BY_CATEGORY_OVERRIDE)) m.set(c, task);
  return m;
})();

/** The template key of the task this autofill row is the same work as — or null (it stands on its own). */
export function twinTaskKey(signal: PlanningTwinSignal | undefined): string | null {
  if (!signal) return null;
  switch (signal.kind) {
    case 'milestone':
      return MILESTONE_TWINS[signal.key] ?? null;
    case 'paperwork':
      return paperworkTwin(signal.documentType);
    case 'meeting':
      return MEETING_TWINS[signal.appointmentType] ?? null;
    case 'payment':
      if (!signal.firstLine || !signal.category) return null;
      return BOOKING_TASK_BY_CATEGORY.get(signal.category) ?? null;
  }
}

/** Whether a twin of this kind still folds into a task that is already DONE (only a milestone does — see the rule). */
export function foldsIntoDoneTask(signal: PlanningTwinSignal): boolean {
  return signal.kind === 'milestone';
}
