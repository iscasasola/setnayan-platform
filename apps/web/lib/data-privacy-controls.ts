/**
 * Data Privacy control board — the code catalog + the DB-backed gate.
 *
 * Every privacy-sensitive capability is a CONTROL the owner approves for
 * activation at /admin/data-privacy. The approval is recorded (approved_by/at)
 * in `data_privacy_controls` (migration 20270814219429) as the RA 10173 audit
 * trail. Feature gates read `status='active'` from that table via
 * `isDataPrivacyControlActive` — so the owner controls activation in-app, no
 * env flag, no redeploy.
 *
 * The catalog below mirrors the migration seed. A control missing from the DB
 * (e.g. pre-migration) reads as INACTIVE — fail-closed, so nothing privacy-
 * sensitive silently activates.
 */

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export type PrivacyControlStatus = 'inactive' | 'active' | 'blocked';

export type PrivacyControlKey =
  | 'vendor_papic_capture'
  | 'vendor_guest_delivery'
  | 'face_enrollment'
  | 'papic_geo_metadata'
  | 'cross_event_vendor_recall'
  | 'faith_religion_graph'
  | 'dependent_minor_profiles'
  | 'home_activity_signals'
  | 'coordinator_consent_money'
  | 'coordinator_prep_release'
  | 'coordinator_run_of_show'
  | 'coordinator_day_of_broadcast';

export type PrivacyControlDef = {
  key: PrivacyControlKey;
  title: string;
  description: string;
  category: string;
  riskNote: string;
};

/** Catalog — mirror of the migration seed (kept in sync by hand). */
export const DATA_PRIVACY_CONTROLS: readonly PrivacyControlDef[] = [
  {
    key: 'vendor_papic_capture',
    title: 'Vendor Papic capture',
    description:
      'Lets a booked vendor collect photos and 5s clips of the event they are working (10 free + Ltd/Unli). Media is the vendor’s, scoped to their booked event.',
    category: 'Guest media via vendor',
    riskNote:
      'The vendor becomes a third-party controller of guest images — a consent basis for guest capture is required. NSFW filter on, geo stripped on share.',
  },
  {
    key: 'vendor_guest_delivery',
    title: 'Per-guest vendor delivery tracker',
    description:
      'Lets a pax-serving vendor mark which guests have received their product (meal, souvenir) — unchecked = not yet received.',
    category: 'Guest data via vendor',
    riskNote:
      'Creates a vendor↔guest link to the couple’s guest list. Needs a consent/limitation basis for a vendor to see per-guest status.',
  },
  {
    key: 'face_enrollment',
    title: 'Face detection & auto-tag',
    description:
      'Per-event face enrollment + auto-tagging of Papic photos (≥0.85 auto, 0.65–0.85 suggested). Vectors are per-event-scoped, never reused across events.',
    category: 'Biometric (sensitive PI)',
    riskNote:
      'Biometric data is sensitive PI under RA 10173. The live /privacy notice must disclose it and offer face-data revocation.',
  },
  {
    key: 'papic_geo_metadata',
    title: 'Capture geolocation metadata',
    description:
      'Stamps captured_at + geo on photos/clips when a device fix is available. Geo is stripped on outbound shares; the original on R2 retains it.',
    category: 'Location data',
    riskNote:
      'Location is PI. Retention + the share-time strip must be disclosed; the stored original still carries geo.',
  },
  {
    key: 'cross_event_vendor_recall',
    title: 'Cross-event vendor recall',
    description:
      'Surfaces a guest’s previously-saved / previously-booked vendors across their events (guest_saved_vendors, prior-event names).',
    category: 'Cross-event linkage',
    riskNote:
      'Links a person’s data across separate events without an explicit consent gate today. Needs a purpose + opt-out.',
  },
  {
    key: 'faith_religion_graph',
    title: 'Faith / religion person graph',
    description:
      'Optional religion on a person unlocks faith-rite events (Binyag → Communion → Confirmation → Wedding) and sponsor/godparent edges.',
    category: 'Sensitive PI (religion)',
    riskNote:
      'Religious belief is sensitive PI. Must be strictly optional, unlocks-not-gates, with an explicit basis.',
  },
  {
    key: 'dependent_minor_profiles',
    title: 'Dependent & minor profiles',
    description:
      'Lets a guardian account hold profiles for dependents, including minors (under 18) and elders, with transfer at age of majority.',
    category: 'Minors’ data',
    riskNote:
      'Processing minors’ data needs guardian consent + the ownership/transfer model; counsel-gated in the corpus.',
  },
  {
    key: 'home_activity_signals',
    title: 'Home & onboarding signal capture',
    description:
      'Captures the SPI/PI signals the updated Home + onboarding collect (event brief, love-story, experience quiz) to drive the free deterministic engines.',
    category: 'Profile & onboarding PI',
    riskNote:
      'Some signals are SPI. The live /privacy notice must list what is collected and the purpose.',
  },
  {
    key: 'coordinator_consent_money',
    title: 'Coordinator consent + money scopes',
    description:
      'The RA 10173 consent modal at the coordinator invite (guest list, seating, schedule, vendor chats) AND the couple’s optional "Can lock vendors" / "Can handle payments" scopes that let a coordinator finalize vendors and handle checkout on the couple’s behalf.',
    category: 'Guest PII + money via coordinator',
    riskNote:
      'Widens a coordinator’s access over guest PII and, if the couple grants it, money-adjacent actions. Consent is captured at invite; face/biometric data stays excluded. Confirm the DPO ruling before activating.',
  },
  {
    key: 'coordinator_prep_release',
    title: 'Coordinator prep-then-release',
    description:
      'Lets a coordinator stage schedule (run-of-show) blocks privately and release them to the couple. Staged blocks are hidden from the couple, guests, and booked vendors until released.',
    category: 'Coordinator private working set',
    riskNote:
      'Widens the coordinator’s private working surface over the couple’s planning data (schedule). Same consent basis as the coordinator consent gate.',
  },
  {
    key: 'coordinator_run_of_show',
    title: 'Coordinator filtered run-of-show (P2)',
    description:
      'Coordinator schedule chrome: per-vendor / per-couple / per-guest filtered views over the one master run-of-show, responsible-party tags, reusable templates, and bulk retime.',
    category: 'Coordinator activation — not privacy-sensitive',
    riskNote:
      'No RA 10173 exposure — an activation switch, not a privacy control. Filters the already-guest-visible schedule; adds no new data collection or sharing.',
  },
  {
    key: 'coordinator_day_of_broadcast',
    title: 'Coordinator day-of broadcast + call-times (P3)',
    description:
      'The day-of broadcast card (announcements to event members) and the optional per-vendor email call-times derived from the run-of-show.',
    category: 'Coordinator activation — not privacy-sensitive',
    riskNote:
      'No RA 10173 exposure — an activation switch. Emails go to booked vendors’ existing contact addresses; no new PII collection.',
  },
];

export type PrivacyControlRow = {
  control_key: string;
  title: string;
  description: string;
  category: string;
  risk_note: string | null;
  status: PrivacyControlStatus;
  approved_by: string | null;
  approved_at: string | null;
  note: string | null;
  sort_order: number;
  updated_at: string | null;
};

/**
 * Read every control row (admin surface). Merges the DB rows over the code
 * catalog so a not-yet-seeded control still renders (as inactive). Defensive:
 * a pre-migration DB returns the full catalog, all inactive.
 */
export async function fetchDataPrivacyControls(
  supabase: SupabaseClient,
): Promise<PrivacyControlRow[]> {
  const byKey = new Map<string, Partial<PrivacyControlRow>>();
  const { data } = await supabase
    .from('data_privacy_controls')
    .select('control_key,status,approved_by,approved_at,note,sort_order,updated_at');
  for (const r of (data ?? []) as Partial<PrivacyControlRow>[]) {
    if (r.control_key) byKey.set(r.control_key, r);
  }
  return DATA_PRIVACY_CONTROLS.map((c, i) => {
    const row = byKey.get(c.key);
    return {
      control_key: c.key,
      title: c.title,
      description: c.description,
      category: c.category,
      risk_note: c.riskNote,
      status: (row?.status as PrivacyControlStatus) ?? 'inactive',
      approved_by: row?.approved_by ?? null,
      approved_at: row?.approved_at ?? null,
      note: row?.note ?? null,
      sort_order: row?.sort_order ?? (i + 1) * 10,
      updated_at: row?.updated_at ?? null,
    };
  }).sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * The gate every privacy-sensitive feature reads. TRUE only when the control is
 * explicitly `active` in the DB. Fail-closed: any error / missing row → false.
 * Request-cached so many call sites in one render share a single read.
 */
export const isDataPrivacyControlActive = cache(
  async (key: PrivacyControlKey): Promise<boolean> => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('data_privacy_controls')
        .select('status')
        .eq('control_key', key)
        .maybeSingle();
      if (error || !data) return false;
      return (data as { status: string }).status === 'active';
    } catch {
      return false;
    }
  },
);
