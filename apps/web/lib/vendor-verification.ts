import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vendor Verification flow — shared types + helpers.
 *
 * Anchors the data model from migration
 * `20260516040000_iteration_0006_vendor_verification_flow.sql`:
 *
 *   • vendor_profiles.verification_state ENUM('unverified','pending_review',
 *     'verified','demoted','rejected')
 *   • vendor_verification_applications — per-intake row tracking the 12-doc
 *     checklist, SLA, decision, reviewer
 *   • vendor_tier_history — state-transition audit timeline
 *
 * See spec corpus 0006 § "Vendor Verification flow" (locked 2026-05-16) +
 * 0023 § 3.2a (verification queue refinement).
 */

// ---------------------------------------------------------------------------
// Verification state
// ---------------------------------------------------------------------------

export const VERIFICATION_STATES = [
  'unverified',
  'pending_review',
  'verified',
  'demoted',
  'rejected',
] as const;

export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const VERIFICATION_STATE_LABEL: Record<VerificationState, string> = {
  unverified: 'Unverified',
  pending_review: 'Pending review',
  verified: 'Verified',
  demoted: 'Demoted',
  rejected: 'Rejected',
};

export function parseVerificationState(raw: unknown): VerificationState {
  return typeof raw === 'string' &&
    (VERIFICATION_STATES as readonly string[]).includes(raw)
    ? (raw as VerificationState)
    : 'unverified';
}

// ---------------------------------------------------------------------------
// Application type + status
// ---------------------------------------------------------------------------

export const APPLICATION_TYPES = [
  'initial',
  'annual_renewal',
  'post_demotion',
] as const;
export type ApplicationType = (typeof APPLICATION_TYPES)[number];

export const APPLICATION_TYPE_LABEL: Record<ApplicationType, string> = {
  initial: 'Initial — FREE',
  annual_renewal: 'Annual renewal — ₱1,500',
  post_demotion: 'Post-demotion — ₱2,500',
};

/**
 * Fee in PHP centavos per application type. Mirrors the SKU prices seeded in
 * 20260516000000_v1_sku_lock_service_catalog.sql + the alias rows in
 * 20260516040000_iteration_0006_vendor_verification_flow.sql.
 */
export const APPLICATION_FEE_CENTAVOS: Record<ApplicationType, number> = {
  initial: 0,
  annual_renewal: 150000,
  post_demotion: 250000,
};

export const APPLICATION_STATUSES = [
  'draft',
  'pending_review',
  'in_review',
  'approved',
  'rejected',
  'withdrawn',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  in_review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function parseApplicationStatus(raw: unknown): ApplicationStatus {
  return typeof raw === 'string' &&
    (APPLICATION_STATUSES as readonly string[]).includes(raw)
    ? (raw as ApplicationStatus)
    : 'draft';
}

// ---------------------------------------------------------------------------
// 12-document checklist
//
// One-to-one with 0006 § "Required documents (all 12 — no exceptions)".
// Each slot has a `key` (stable JSON key in doc_uploads), a `label`, and a
// hint that surfaces under the upload widget. Three slot kinds:
//
//   • upload   — vendor uploads a file (DTI, BIR 2303, Mayor's Permit, …)
//   • external — third-party check (Persona ID liveness, AMLC sanctions)
//   • manual   — admin-side step (Google Meet, reference call)
// ---------------------------------------------------------------------------

export type DocSlotKind = 'upload' | 'external' | 'manual';

export type DocSlot = {
  key: string;
  number: number;
  label: string;
  kind: DocSlotKind;
  hint: string;
};

export const DOC_SLOTS: readonly DocSlot[] = [
  {
    key: 'dti_certificate',
    number: 1,
    label: 'DTI Business Name Certificate',
    kind: 'upload',
    hint: 'PDF / JPG / PNG up to 15 MB. Auto-validated via DTI lookup once owner integration ships.',
  },
  {
    key: 'bir_2303',
    number: 2,
    label: 'BIR Form 2303 (Certificate of Registration)',
    kind: 'upload',
    hint: 'PDF / JPG / PNG up to 15 MB.',
  },
  {
    key: 'mayors_permit',
    number: 3,
    label: "Mayor's Permit (current year)",
    kind: 'upload',
    hint: 'PDF / JPG / PNG up to 15 MB.',
  },
  {
    key: 'government_id',
    number: 4,
    label: 'Valid government ID (owner)',
    kind: 'external',
    hint: 'Verified via Persona / Veriff / Onfido. Owner-side signup pending — upload a JPG/PNG for now and Setnayan staff will queue the ID-liveness check.',
  },
  {
    key: 'bank_account_proof',
    number: 5,
    label: 'Bank account proof',
    kind: 'upload',
    hint: 'Screenshot or PDF of Maya / GCash / bank statement. Micro-deposit verification happens once Setnayan Pay integration is live.',
  },
  {
    key: 'portfolio_samples',
    number: 6,
    label: '5–10 portfolio samples',
    kind: 'upload',
    hint: 'JPG / PNG / WEBP. We run a reverse image search to flag stolen portfolios.',
  },
  {
    key: 'client_references',
    number: 7,
    label: '3–5 past client references',
    kind: 'upload',
    hint: "Upload a single PDF or image with each reference's name, phone, and event date. Setnayan will randomly call 1–2.",
  },
  {
    key: 'live_selfie',
    number: 8,
    label: 'Live selfie + ID liveness check',
    kind: 'upload',
    hint: 'Single live selfie photo for the admin to cross-reference with the government ID. Liveness/biometric step runs via Persona once integration ships.',
  },
  {
    key: 'google_meet',
    number: 9,
    label: '15-min Google Meet with admin',
    kind: 'manual',
    hint: "We'll email you a scheduling link once the document checklist is complete.",
  },
  {
    key: 'phone_email_otp',
    number: 10,
    label: 'Phone SMS OTP + email confirmation',
    kind: 'manual',
    hint: 'Phone OTP triggers from the vendor onboarding tour — admin marks complete once both confirmations land.',
  },
  {
    key: 'social_media',
    number: 11,
    label: 'Social media presence',
    kind: 'upload',
    hint: 'Paste a public Instagram or Facebook business page URL into the notes field, then attach a screenshot for the admin.',
  },
  {
    key: 'amlc_screening',
    number: 12,
    label: 'Sanctions / PEP screening',
    kind: 'external',
    hint: 'AMLC sanctions/PEP watchlist screening. Auto-run once AMLC API access is live; manual lookup until then.',
  },
] as const;

// ---------------------------------------------------------------------------
// Application row + helpers
// ---------------------------------------------------------------------------

export type DocUpload =
  | { r2_key?: string; uploaded_at?: string; notes?: string }
  | Array<{ r2_key: string; uploaded_at?: string }>
  | { scheduled_at?: string; meet_url?: string }
  | { url?: string }
  | { result?: 'clear' | 'flag' | 'pending'; screened_at?: string }
  | { phone_verified?: boolean; email_verified?: boolean }
  | null
  | undefined;

export type DocUploadMap = Record<string, DocUpload>;

export type VendorVerificationApplicationRow = {
  application_id: string;
  public_id: string;
  vendor_profile_id: string;
  application_type: ApplicationType;
  fee_php_centavos: number;
  status: ApplicationStatus;
  doc_uploads: DocUploadMap;
  docs_complete: boolean;
  submitted_at: string | null;
  sla_due_at: string | null;
  admin_user_id: string | null;
  decision: 'approved' | 'rejected' | null;
  decision_reason: string | null;
  decided_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Returns the count of completed slots in a doc_uploads map.
 * A slot is considered complete when it has either an `r2_key` (or non-empty
 * array for portfolio_samples) OR a confirmation boolean (`phone_verified`,
 * `email_verified`) OR a `scheduled_at` (Google Meet) OR a `url` (social).
 *
 * Strict V1 behavior: the four non-upload slots (`google_meet`, `phone_email_otp`,
 * `amlc_screening`, `government_id` Persona side) require an admin-side flip
 * before they count, so until external integrations ship the vendor's
 * "completeness" is everything-except-those-four.
 */
export function countCompleteSlots(uploads: DocUploadMap): number {
  let count = 0;
  for (const slot of DOC_SLOTS) {
    const v = uploads?.[slot.key];
    if (isSlotComplete(slot.key, v)) count++;
  }
  return count;
}

export function isSlotComplete(slotKey: string, v: DocUpload): boolean {
  if (v == null) return false;
  if (Array.isArray(v)) {
    return v.length >= 1 && v.every((it) => typeof it?.r2_key === 'string');
  }
  if (typeof v !== 'object') return false;
  if (slotKey === 'google_meet') {
    return typeof (v as { scheduled_at?: string }).scheduled_at === 'string';
  }
  if (slotKey === 'phone_email_otp') {
    const t = v as { phone_verified?: boolean; email_verified?: boolean };
    return !!t.phone_verified && !!t.email_verified;
  }
  if (slotKey === 'social_media') {
    const t = v as { url?: string };
    return typeof t.url === 'string' && t.url.length > 0;
  }
  if (slotKey === 'amlc_screening') {
    return (v as { result?: string }).result === 'clear';
  }
  return typeof (v as { r2_key?: string }).r2_key === 'string';
}

// The slots the VENDOR fills themselves vs the four the Setnayan team runs
// (ID liveness, the video call, phone/email confirmation, AMLC screening).
// The vendor's progress + submit gate count against VENDOR_DOC_SLOTS only — the
// admin-run four flip on our side after submit. Counting the vendor against all
// 12 made a finished application read as "8 of 12 · 67%" (the deceptively-stuck
// denominator the usability audit flagged).
export const VENDOR_DOC_SLOTS: readonly DocSlot[] = DOC_SLOTS.filter(
  (s) => s.kind === 'upload',
);
export const ADMIN_DOC_SLOTS: readonly DocSlot[] = DOC_SLOTS.filter(
  (s) => s.kind !== 'upload',
);

/** How many of the vendor's own items (VENDOR_DOC_SLOTS) are complete. */
export function countCompleteVendorSlots(uploads: DocUploadMap): number {
  let count = 0;
  for (const slot of VENDOR_DOC_SLOTS) {
    if (isSlotComplete(slot.key, uploads?.[slot.key])) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// SLA helpers
//
// SLA = 5 business days from submitted_at per 0006 § "Setnayan SLA: 3-5 BD".
// 3 BD = warning (orange) · 5 BD = red. The migration stores sla_due_at as
// the 5-BD endpoint; the UI computes a "3 BD threshold" by subtracting 2 BD
// from sla_due_at. We use calendar days as a V1 approximation (BD = MON–FRI
// with no PH holiday calendar — close enough for the badge and a TODO in
// the PR body covers the upgrade).
// ---------------------------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Adds `n` business days (MON–FRI) to a Date. SAT/SUN don't count. Uses UTC
 * day-of-week so server timezone drift doesn't shift the SLA by a day.
 */
export function addBusinessDays(start: Date, n: number): Date {
  const d = new Date(start.getTime());
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay(); // 0 = Sun … 6 = Sat
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

export type SlaTone = 'on_track' | 'warning' | 'overdue' | 'closed';

export function computeSlaTone(
  submittedAt: string | null,
  decidedAt: string | null,
  now: Date = new Date(),
): SlaTone {
  if (decidedAt) return 'closed';
  if (!submittedAt) return 'on_track';
  const submitted = new Date(submittedAt);
  if (Number.isNaN(submitted.getTime())) return 'on_track';
  const threeBd = addBusinessDays(submitted, 3);
  const fiveBd = addBusinessDays(submitted, 5);
  if (now.getTime() >= fiveBd.getTime()) return 'overdue';
  if (now.getTime() >= threeBd.getTime()) return 'warning';
  return 'on_track';
}

export function formatSlaCountdown(
  submittedAt: string | null,
  decidedAt: string | null,
  now: Date = new Date(),
): string {
  if (decidedAt) return 'Decided';
  if (!submittedAt) return 'Not submitted';
  const submitted = new Date(submittedAt);
  if (Number.isNaN(submitted.getTime())) return 'Not submitted';
  const sla = addBusinessDays(submitted, 5);
  const remainingMs = sla.getTime() - now.getTime();
  const remainingDays = Math.ceil(remainingMs / ONE_DAY_MS);
  if (remainingDays < 0) return `${Math.abs(remainingDays)}d overdue`;
  if (remainingDays === 0) return 'Due today';
  return `${remainingDays}d remaining`;
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

/**
 * Returns the most recent application row for a vendor (in any status).
 * Used by the vendor-dashboard surface to resume a draft or show status.
 */
export async function fetchLatestApplication(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorVerificationApplicationRow | null> {
  const { data, error } = await supabase
    .from('vendor_verification_applications')
    .select(
      'application_id,public_id,vendor_profile_id,application_type,fee_php_centavos,status,doc_uploads,docs_complete,submitted_at,sla_due_at,admin_user_id,decision,decision_reason,decided_at,notes,created_at,updated_at',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`fetchLatestApplication: ${error.message}`);
  if (!data) return null;
  return data as VendorVerificationApplicationRow;
}

/**
 * Returns the full per-vendor tier-history timeline (newest first).
 */
export async function fetchTierHistory(
  supabase: SupabaseClient,
  vendorProfileId: string,
  limit = 50,
): Promise<
  Array<{
    tier_history_id: string;
    from_state: VerificationState | null;
    to_state: VerificationState;
    application_id: string | null;
    admin_user_id: string | null;
    reason: string | null;
    created_at: string;
  }>
> {
  const { data, error } = await supabase
    .from('vendor_tier_history')
    .select(
      'tier_history_id,from_state,to_state,application_id,admin_user_id,reason,created_at',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`fetchTierHistory: ${error.message}`);
  return (data ?? []) as Array<{
    tier_history_id: string;
    from_state: VerificationState | null;
    to_state: VerificationState;
    application_id: string | null;
    admin_user_id: string | null;
    reason: string | null;
    created_at: string;
  }>;
}

/**
 * Recommends the application type for a vendor's NEXT submission based on
 * their current state + last verification date.
 *
 * Logic:
 *   • unverified / rejected      → 'initial' (FREE)
 *   • demoted                    → 'post_demotion' (₱2,500)
 *   • verified, ≥ 11 months ago  → 'annual_renewal' (₱1,500) — renewal window
 *   • verified, < 11 months ago  → 'annual_renewal' (renewal still allowed
 *                                 early; vendor may prepay to extend)
 *   • pending_review              → null (already in flight)
 */
export function recommendedApplicationType(
  verificationState: VerificationState,
  lastVerifiedAt: string | null,
): ApplicationType | null {
  if (verificationState === 'pending_review') return null;
  if (verificationState === 'demoted') return 'post_demotion';
  if (verificationState === 'verified' || lastVerifiedAt) {
    return 'annual_renewal';
  }
  return 'initial';
}

export function formatPhpCentavos(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
