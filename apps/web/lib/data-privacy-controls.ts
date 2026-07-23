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
 * The catalog below mirrors the migration seed (base migration 20270814219429 +
 * the coordinator / vendor-AI / overhaul follow-ups). A control missing from the
 * DB (e.g. pre-migration) reads as INACTIVE — fail-closed, so nothing privacy-
 * sensitive silently activates. Each def also carries a `group` (its board
 * section) and every gate reads `status === 'active'`, so 'inactive', 'blocked',
 * and 'retired' all fail-closed.
 */

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

// 'retired' = the control's feature was removed or never built — parked for
// audit lineage, sunk to its own board section, and (like 'inactive'/'blocked')
// fail-closed everywhere the gate reads `=== 'active'`.
export type PrivacyControlStatus = 'inactive' | 'active' | 'blocked' | 'retired';

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
  | 'coordinator_day_of_broadcast'
  | 'vendor_ai_autoreply'
  | 'vendor_deep_search'
  | 'antifraud_trust_signals'
  | 'device_fingerprint'
  | 'guest_columns'
  | 'papic_pool_gallery';

/**
 * Risk-grouped sections for the board. `group` is the KIND of data a control
 * governs; it drives the section a control renders under (a retired control is
 * pulled into its own "Retired" section regardless of group). Ordered most- to
 * least-sensitive.
 */
export type PrivacyControlGroup =
  | 'biometric_sensitive'
  | 'vendor_mediated'
  | 'guest_content'
  | 'automated_ai'
  | 'coordinator'
  | 'profile_onboarding'
  | 'activation_switch';

export const PRIVACY_CONTROL_GROUP_ORDER: readonly PrivacyControlGroup[] = [
  'biometric_sensitive',
  'vendor_mediated',
  'guest_content',
  'automated_ai',
  'coordinator',
  'profile_onboarding',
  'activation_switch',
];

export const PRIVACY_CONTROL_GROUP_LABEL: Record<PrivacyControlGroup, string> = {
  biometric_sensitive: 'Biometric & sensitive PI',
  vendor_mediated: 'Vendor-mediated guest data',
  guest_content: 'Guest content & publication',
  automated_ai: 'Automated processing & AI',
  coordinator: 'Coordinator access',
  profile_onboarding: 'Profile & onboarding',
  activation_switch: 'Activation switches (not privacy-sensitive)',
};

export type PrivacyControlDef = {
  key: PrivacyControlKey;
  title: string;
  description: string;
  category: string;
  riskNote: string;
  group: PrivacyControlGroup;
};

/** Catalog — mirror of the migration seed (kept in sync by hand). */
export const DATA_PRIVACY_CONTROLS: readonly PrivacyControlDef[] = [
  {
    key: 'vendor_papic_capture',
    group: 'vendor_mediated',
    title: 'Vendor Papic capture',
    description:
      'Lets a booked vendor collect photos and 10s clips of the event they are working (10 free + Ltd/Unli). Media is the vendor’s, scoped to their booked event.',
    category: 'Guest media via vendor',
    riskNote:
      'The vendor becomes a third-party controller of guest images — a consent basis for guest capture is required. NSFW filter on, geo stripped on share.',
  },
  {
    key: 'vendor_guest_delivery',
    group: 'vendor_mediated',
    title: 'Per-guest vendor delivery tracker',
    description:
      'Lets a pax-serving vendor mark which guests have received their product (meal, souvenir) — unchecked = not yet received.',
    category: 'Guest data via vendor',
    riskNote:
      'Creates a vendor↔guest link to the couple’s guest list. Needs a consent/limitation basis for a vendor to see per-guest status.',
  },
  {
    key: 'face_enrollment',
    group: 'biometric_sensitive',
    title: 'Face detection & auto-tag',
    description:
      'Per-event face enrollment + auto-tagging of Papic photos (≥0.85 auto, 0.65–0.85 suggested). Vectors are per-event-scoped, never reused across events.',
    category: 'Biometric (sensitive PI)',
    riskNote:
      'Biometric data is sensitive PI under RA 10173. The live /privacy notice must disclose it and offer face-data revocation.',
  },
  {
    key: 'papic_geo_metadata',
    group: 'vendor_mediated',
    title: 'Capture geolocation metadata',
    description:
      'Stamps a coarse location fix (lat/lon + accuracy, or a geo_unavailable flag) onto Papic photos/clips at capture, when the paparazzo grants location. Geo is written server-side only while this control is active; it is never returned in any share/gallery/download, and full-res originals are EXIF-stripped on the way out.',
    category: 'Location data',
    riskNote:
      'Location is PI. Ships OFF (fail-closed) — this is a NEW location-data collection; activate only after confirming the public /privacy "Photos and videos — location data" disclosure and the DPO ruling. The stored original on R2 retains geo; outbound shares never expose it.',
  },
  {
    key: 'cross_event_vendor_recall',
    group: 'vendor_mediated',
    title: 'Cross-event vendor recall',
    description:
      'Surfaces a guest’s previously-saved / previously-booked vendors across their events (guest_saved_vendors, prior-event names).',
    category: 'Cross-event linkage',
    riskNote:
      'Links a person’s data across separate events without an explicit consent gate today. Needs a purpose + opt-out.',
  },
  {
    key: 'faith_religion_graph',
    group: 'biometric_sensitive',
    title: 'Faith / religion person graph',
    description:
      'Optional religion on a person unlocks faith-rite events (Binyag → Communion → Confirmation → Wedding) and sponsor/godparent edges.',
    category: 'Sensitive PI (religion)',
    riskNote:
      'Religious belief is sensitive PI. Must be strictly optional, unlocks-not-gates, with an explicit basis.',
  },
  {
    key: 'dependent_minor_profiles',
    group: 'biometric_sensitive',
    title: 'Dependent & minor profiles',
    description:
      'Lets a guardian account hold profiles for dependents, including minors (under 18) and elders, with transfer at age of majority.',
    category: 'Minors’ data',
    riskNote:
      'Processing minors’ data needs guardian consent + the ownership/transfer model; counsel-gated in the corpus.',
  },
  {
    key: 'home_activity_signals',
    group: 'profile_onboarding',
    title: 'Home & onboarding signal capture',
    description:
      'Captures the SPI/PI signals the updated Home + onboarding collect (event brief, love-story, experience quiz) to drive the free deterministic engines.',
    category: 'Profile & onboarding PI',
    riskNote:
      'Some signals are SPI. The live /privacy notice must list what is collected and the purpose.',
  },
  {
    key: 'coordinator_consent_money',
    group: 'coordinator',
    title: 'Coordinator consent + money scopes',
    description:
      'The RA 10173 consent modal at the coordinator invite (guest list, seating, schedule, vendor chats) AND the couple’s optional "Can lock vendors" / "Can handle payments" scopes that let a coordinator finalize vendors and handle checkout on the couple’s behalf.',
    category: 'Guest PII + money via coordinator',
    riskNote:
      'Widens a coordinator’s access over guest PII and, if the couple grants it, money-adjacent actions. Consent is captured at invite; face/biometric data stays excluded. Confirm the DPO ruling before activating.',
  },
  {
    key: 'coordinator_prep_release',
    group: 'coordinator',
    title: 'Coordinator prep-then-release',
    description:
      'Lets a coordinator stage schedule (run-of-show) blocks privately and release them to the couple. Staged blocks are hidden from the couple, guests, and booked vendors until released.',
    category: 'Coordinator private working set',
    riskNote:
      'Widens the coordinator’s private working surface over the couple’s planning data (schedule). Same consent basis as the coordinator consent gate.',
  },
  {
    key: 'coordinator_run_of_show',
    group: 'activation_switch',
    title: 'Coordinator filtered run-of-show (P2)',
    description:
      'Coordinator schedule chrome: per-vendor / per-couple / per-guest filtered views over the one master run-of-show, responsible-party tags, reusable templates, and bulk retime.',
    category: 'Coordinator activation — not privacy-sensitive',
    riskNote:
      'No RA 10173 exposure — an activation switch, not a privacy control. Filters the already-guest-visible schedule; adds no new data collection or sharing.',
  },
  {
    key: 'coordinator_day_of_broadcast',
    group: 'activation_switch',
    title: 'Coordinator day-of broadcast + call-times (P3)',
    description:
      'The day-of broadcast card (announcements to event members) and the optional per-vendor email call-times derived from the run-of-show.',
    category: 'Coordinator activation — not privacy-sensitive',
    riskNote:
      'No RA 10173 exposure — an activation switch. Emails go to booked vendors’ existing contact addresses; no new PII collection.',
  },
  {
    key: 'vendor_ai_autoreply',
    group: 'automated_ai',
    title: 'Vendor AI (auto-reply)',
    description:
      'The paid Vendor AI add-on reads a couple’s inbox messages + Event Brief (dates, pax, budget-per-head, venue) and auto-answers — and can auto-accept — on the vendor’s behalf. Deterministic (no LLM); the couple sees it labelled "⚡ AI auto-reply".',
    category: 'Automated processing of couple messages',
    riskNote:
      'Automated processing of couple chat + event data on the vendor’s behalf. The live /privacy notice needs a Vendor-AI section (purpose + legal basis) before this activates; couple-faith consumption must stay unwired. DPO sign-off required.',
  },
  {
    key: 'vendor_deep_search',
    group: 'automated_ai',
    title: 'Vendor Deep Search',
    description:
      'The paid Deep Search add-on runs AI web-research (Anthropic web_search) over the vendor’s OWN business across public sources incl. review sites, and stores a structured dossier (vendor_web_dossiers) to auto-fill the vendor profile.',
    category: 'AI web-research + dossier storage',
    riskNote:
      'AI web-research via the Anthropic web_search subprocessor; may read third-party PII (reviewers, named clients) from the open web; a dossier is stored. The /privacy notice needs a Deep-Search section + a retention limit; DPO review of third-party-source storage required.',
  },
  {
    key: 'antifraud_trust_signals',
    group: 'automated_ai',
    title: 'Anti-fraud automated vendor suspension',
    description:
      'Identity-clustering + five-signal vendor fraud scoring, and the ONE automated decision it can take: a reversible auto-suspend (hides the vendor + freezes badges) when the aggregate open-signal score crosses the bar. Detection/scoring into the admin review queue is unaffected — only the automated suspension is gated.',
    category: 'Automated decision (vendor)',
    riskNote:
      'An automated decision that significantly affects a vendor under RA 10173 — it needs a published disclosure, a legitimate-interest assessment, and a documented contest/appeal path (NPC task t1-4). Fail-closed = no automated suspension; humans still act from the queue.',
  },
  {
    key: 'device_fingerprint',
    group: 'automated_ai',
    title: 'Device-fingerprint fraud data',
    description:
      'Records a coarse, first-party per-browser device id (hashed server-side, never the raw id) into user_devices, lighting up identity-cluster + shared-device detection. Deliberately coarse — no canvas/behavioral fingerprint, no external SDK.',
    category: 'Fraud prevention / device data',
    riskNote:
      'A NEW pseudonymous data-collection practice. A DPO review is on file (12_Device_Fingerprint_DPO_Review) and a documented LIA is still owed (NPC task t2-10). Kept OFF until DPO sign-off; the capture path AND-gates this control with the NEXT_PUBLIC_DEVICE_FINGERPRINT_ENABLED env flag.',
  },
  {
    key: 'guest_columns',
    group: 'guest_content',
    title: 'Guest Columns (guest-authored paper)',
    description:
      'Every guest may write ONE short column (title + body, size-capped) for the couple’s paper. The couple approves before publish; approved columns render on the PUBLIC guest site and the post-event editorial with the guest’s byline. Tier-1 moderation screens every submit; the guest can withdraw at any time (RA 10173 self-serve takedown).',
    category: 'Guest-authored public content',
    riskNote:
      'Publishes guest-authored text + byline (guest PII) to the open web after couple approval. Consent is captured on every submit, but the live /privacy notice and the ROPA do not declare this publication flow yet — activate only after they cover it and the DPO ruling is on file. Every surface AND-gates this control with the GUEST_COLUMNS_ENABLED env flag.',
  },
  {
    key: 'papic_pool_gallery',
    group: 'guest_content',
    title: 'Papic Shared Pool Gallery',
    description:
      'Lets every session guest browse the WHOLE event capture pool (clean-screened photos + clips, web copies only) and self-link ("I’m in this") into photos — a manual_pick tag that joins their personal gallery, ZIP download, and Story reel. The couple’s per-event toggle (events.pool_gallery_open, default OFF) still applies on top of this control, and closing it is retroactive.',
    category: 'Event-wide guest media exposure',
    riskNote:
      'Widens photo/clip visibility from per-guest tagged delivery to EVERY guest in the event — guests see other guests’ images. The pool read bakes the FaceBlock blur rule, the photo_consent veto, and web-copy-only keys (never the geo-bearing original); still a new exposure surface the /privacy notice and ROPA must declare before this activates. DPO ruling required. Every surface AND-gates this control with the NEXT_PUBLIC_PAPIC_POOL_GALLERY env flag.',
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
  /** From the code catalog (not the DB) — the board's section grouping. */
  group: PrivacyControlGroup;
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
      group: c.group,
    };
  }).sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * The gate, reading through a caller-provided admin client. Hook code that
 * already holds an admin client (e.g. the vendor auto-reply inbox hook) calls
 * THIS so the read rides the same single-tenant client — and stays unit-testable
 * with an injected stub. Fail-closed: any error / missing row → false.
 */
export async function isDataPrivacyControlActiveWith(
  admin: SupabaseClient,
  key: PrivacyControlKey,
): Promise<boolean> {
  try {
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
}

/**
 * The gate every privacy-sensitive feature reads. TRUE only when the control is
 * explicitly `active` in the DB. Fail-closed: any error / missing row → false.
 * Request-cached so many call sites in one render share a single read.
 */
export const isDataPrivacyControlActive = cache(
  async (key: PrivacyControlKey): Promise<boolean> => {
    try {
      return await isDataPrivacyControlActiveWith(createAdminClient(), key);
    } catch {
      return false;
    }
  },
);
