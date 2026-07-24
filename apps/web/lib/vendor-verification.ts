import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vendor Verification flow — shared types + helpers.
 *
 * Anchors the data model from migration
 * `20260516050000_iteration_0006_vendor_verification_flow.sql`:
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

/**
 * Short human name per application type, with NO price baked in. The price is
 * resolved separately from `service_catalog` at runtime (see
 * `resolveApplicationFeeCentavos` / `applicationTypeLabel`) so a repricing —
 * e.g. the 20260702 migration that made verification FREE — can never leave a
 * stale ₱ amount stranded in code.
 */
export const APPLICATION_TYPE_NAME: Record<ApplicationType, string> = {
  initial: 'Initial',
  annual_renewal: 'Annual renewal',
  post_demotion: 'Post-demotion',
};

/**
 * Canonical `service_catalog.sku_code` per application type. Locked to the SKUs
 * seeded in `20260516000000_v1_sku_lock_service_catalog.sql` + the alias rows
 * in `20260516050000_iteration_0006_vendor_verification_flow.sql`:
 *
 *   initial        → vendor_verification_initial   (active · price_centavos 0)
 *   annual_renewal → verification_annual_renewal   (retired inactive by 20260702)
 *   post_demotion  → verification_reverification    (retired inactive by 20260702)
 *
 * The keys are CHECK-bound to `application_type` in the DB, so this map stays in
 * code (lock-step key space). Only the *fee* is DB-resolved — never the keys.
 */
export const APPLICATION_TYPE_SKU: Record<ApplicationType, string> = {
  initial: 'vendor_verification_initial',
  annual_renewal: 'verification_annual_renewal',
  post_demotion: 'verification_reverification',
};

/**
 * Renders a verification fee for display: ₱0 → "Free", anything else → the
 * peso string. Pure — the single place the "0 means Free" rule lives, so every
 * fee label reads the same. Negative inputs are clamped to Free (a fee can
 * never be negative — the catalog CHECK enforces `price_centavos >= 0`).
 */
export function feeLabelForCentavos(centavos: number): string {
  if (!Number.isFinite(centavos) || centavos <= 0) return 'Free';
  return formatPhpCentavos(centavos);
}

/**
 * Builds the "<name> — <fee>" label for an application type from a resolved
 * fee (in centavos). Pure. Callers pass the fee they resolved from
 * `service_catalog` (via `resolveApplicationFeeCentavos`); this never invents a
 * price. Example: `applicationTypeLabel('annual_renewal', 0)` →
 * `'Annual renewal — Free'`.
 */
export function applicationTypeLabel(
  type: ApplicationType,
  feeCentavos: number,
): string {
  return `${APPLICATION_TYPE_NAME[type]} — ${feeLabelForCentavos(feeCentavos)}`;
}

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
  /**
   * Optional Help Center article slug (`/help/{guideSlug}`) explaining how to
   * obtain / prepare this document. Set on the legal + financial slots that
   * vendors often don't know how to source (DTI/SEC, BIR 2303, Mayor's Permit,
   * bank proof); the card renders a "How to get this →" link when present.
   */
  guideSlug?: string;
};

// PRUNED 2026-07-03 (owner: "we do not need this … what we have, that is it"):
// government_id, live_selfie, phone_email_otp, and amlc_screening are RETIRED.
// Identity confirmation is the 15-min Google Meet; the OTP slot is superseded by
// the VALIDATE contact-confirmation (the vendor emails + texts Setnayan the
// token "VALIDATE <shop name>" from their own email/number — stamped on
// vendor_verification_applications.contact_*_confirmed_at). Any value already
// stored under a retired key in doc_uploads JSONB is simply ignored (extra keys
// never count toward completion), so in-flight applications keep working.
export const DOC_SLOTS: readonly DocSlot[] = [
  {
    key: 'dti_certificate',
    number: 1,
    label: 'DTI or SEC Registration',
    kind: 'upload',
    hint: 'DTI Business Name Certificate (sole proprietor) or SEC Registration (corporation / partnership). PDF / JPG / PNG up to 15 MB.',
    guideSlug: 'how-to-get-dti-sec-registration',
  },
  {
    key: 'bir_2303',
    number: 2,
    label: 'BIR Form 2303 (Certificate of Registration)',
    kind: 'upload',
    hint: 'PDF / JPG / PNG up to 15 MB.',
    guideSlug: 'how-to-get-bir-2303',
  },
  {
    key: 'mayors_permit',
    number: 3,
    label: "Mayor's Permit (current year)",
    kind: 'upload',
    hint: 'PDF / JPG / PNG up to 15 MB.',
    guideSlug: 'how-to-get-mayors-permit',
  },
  {
    key: 'bank_account_proof',
    number: 4,
    label: 'Bank account proof',
    kind: 'upload',
    hint: 'Screenshot or PDF of Maya / GCash / bank statement showing the account name, provider, and number — the name should match your DTI/SEC business name (or your own name if sole proprietor). You can blur the balance. Micro-deposit verification happens once Setnayan Pay integration is live.',
    guideSlug: 'how-to-prepare-bank-account-proof',
  },
  {
    key: 'portfolio_samples',
    number: 5,
    label: '5–10 portfolio samples',
    kind: 'upload',
    hint: 'Add 5–10 photos of your work — a new slot opens as you add each one, up to 10. JPG / PNG / WEBP. We run a reverse image search to flag stolen portfolios.',
  },
  {
    key: 'client_references',
    number: 6,
    label: '3–5 past client references',
    kind: 'upload',
    hint: 'Add 3–5 past clients — each with a name, contact number, event, and date. A new blank reference appears as you fill each one, up to 5. Setnayan will randomly call 1–2.',
  },
  {
    key: 'social_media',
    number: 7,
    label: 'Social media presence',
    kind: 'upload',
    hint: 'Add any of your public links — website, Facebook, Instagram, TikTok, X, YouTube, Vimeo, Snapchat, WhatsApp, Telegram. All optional; even one helps.',
    guideSlug: 'build-your-online-presence',
  },
  {
    key: 'google_meet',
    number: 8,
    label: '15-min Google Meet with admin',
    kind: 'manual',
    hint: "We'll email you a scheduling link once your documents are in — that's where we confirm your identity.",
  },
] as const;

/**
 * The documents a vendor MUST upload before submitting for review (owner
 * 2026-07-03). The remaining vendor uploads (portfolio, references, social)
 * strengthen the application but don't block submission.
 */
export const REQUIRED_DOC_SLOT_KEYS: ReadonlySet<string> = new Set([
  'dti_certificate',
  'bir_2303',
  'mayors_permit',
  'bank_account_proof',
]);

// ---------------------------------------------------------------------------
// Structured slot shapes (owner 2026-07-03 field redesign)
//
// Three vendor slots outgrew the "one file / one URL" model:
//   • portfolio_samples  → an ARRAY of R2 refs (add photos one at a time up to
//     10). The old inline flow only persisted the first ref — this makes the
//     whole set the source of truth.
//   • client_references  → an ARRAY of structured entries (name · contact
//     number · event · date), not a single uploaded PDF. Add up to 5.
//   • social_media       → a MAP of platform → link, not a single URL. Legacy
//     `{ url }` values still read (mapped onto their detected platform).
//
// All three ride in the existing `doc_uploads` JSONB — no migration. Extra /
// legacy keys are ignored, so in-flight applications keep working.
// ---------------------------------------------------------------------------

export const PORTFOLIO_MIN = 5;
export const PORTFOLIO_MAX = 10;
export const CLIENT_REFERENCES_MIN = 3;
export const CLIENT_REFERENCES_MAX = 5;

/** One past-client reference the vendor fills in (Setnayan may spot-call). */
export type ClientReference = {
  name: string;
  contact_number: string;
  event: string;
  /** Event date as an ISO `yyyy-mm-dd` string (empty when not provided). */
  date: string;
};

export function emptyClientReference(): ClientReference {
  return { name: '', contact_number: '', event: '', date: '' };
}

/** A reference "counts" once it carries at least a name and a contact number. */
export function isFilledReference(r: ClientReference | null | undefined): boolean {
  return Boolean(r && r.name.trim() && r.contact_number.trim());
}

export type SocialPlatform = {
  /** Stored key inside the `social_media` object. */
  key: string;
  label: string;
  placeholder: string;
  /** Input affordance — `url` renders a url field, others a text field. */
  kind: 'url' | 'handle' | 'phone';
};

/**
 * The public links a vendor can list, in display order. `website` leads; the
 * rest are socials + messaging handles. Owner list 2026-07-03 (the duplicate
 * "Website" in the brief is deduped here). All optional.
 */
export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  { key: 'website', label: 'Website', placeholder: 'https://your-brand.com', kind: 'url' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/your-brand', kind: 'url' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/your-brand', kind: 'url' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@your-brand', kind: 'url' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/your-brand', kind: 'url' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@your-brand', kind: 'url' },
  { key: 'vimeo', label: 'Vimeo', placeholder: 'https://vimeo.com/your-channel', kind: 'url' },
  { key: 'snapchat', label: 'Snapchat', placeholder: 'https://snapchat.com/add/your-brand', kind: 'url' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '+63 9XX XXX XXXX or wa.me/…', kind: 'phone' },
  { key: 'telegram', label: 'Telegram', placeholder: '@your-brand or t.me/…', kind: 'handle' },
] as const;

export const SOCIAL_PLATFORM_KEYS: ReadonlySet<string> = new Set(
  SOCIAL_PLATFORMS.map((p) => p.key),
);

export const SOCIAL_PLATFORM_LABEL: Record<string, string> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.key, p.label]),
);

/** Best-effort platform detection from a link's host — used to place legacy
 * single-URL social values (and open-shop's seeded link) onto a labeled field. */
export function detectSocialPlatform(rawUrl: string): string | null {
  let host: string;
  try {
    const u = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`);
    host = u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
  if (host.includes('facebook.') || host === 'fb.com' || host.includes('fb.me')) return 'facebook';
  if (host.includes('instagram.')) return 'instagram';
  if (host.includes('tiktok.')) return 'tiktok';
  if (host === 'x.com' || host.includes('twitter.')) return 'x';
  if (host.includes('youtube.') || host === 'youtu.be') return 'youtube';
  if (host.includes('vimeo.')) return 'vimeo';
  if (host.includes('snapchat.')) return 'snapchat';
  if (host.includes('whatsapp.') || host === 'wa.me') return 'whatsapp';
  if (host.includes('telegram.') || host === 't.me') return 'telegram';
  return null;
}

/** Extract the ordered list of R2 refs for a file/portfolio slot value. */
export function parsePortfolioRefs(entry: DocUpload | null | undefined): string[] {
  if (!entry) return [];
  if (Array.isArray(entry)) {
    return entry
      .map((e) => (e as { r2_key?: unknown })?.r2_key)
      .filter((k): k is string => typeof k === 'string' && k.length > 0);
  }
  if (typeof entry === 'object' && 'r2_key' in entry && typeof entry.r2_key === 'string') {
    return entry.r2_key ? [entry.r2_key] : [];
  }
  return [];
}

/** Parse the `client_references` value into structured entries. Legacy file
 * uploads (`{ r2_key }` / arrays of them) return `[]` here — they still count
 * as complete via {@link isSlotComplete}, but carry no structured fields. */
export function parseClientReferences(
  entry: DocUpload | null | undefined,
): ClientReference[] {
  if (!Array.isArray(entry)) return [];
  const out: ClientReference[] = [];
  for (const raw of entry) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    // A structured reference has name/contact fields; skip legacy file rows.
    if (!('name' in r) && !('contact_number' in r)) continue;
    out.push({
      name: typeof r.name === 'string' ? r.name : '',
      contact_number: typeof r.contact_number === 'string' ? r.contact_number : '',
      event: typeof r.event === 'string' ? r.event : '',
      date: typeof r.date === 'string' ? r.date : '',
    });
  }
  return out;
}

/** Parse the `social_media` value into a platform→link map. Merges the modern
 * per-platform keys with a legacy single `url` (placed on its detected
 * platform, else Website) so both shapes render in the editor. */
export function parseSocialLinks(
  entry: DocUpload | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return out;
  const obj = entry as Record<string, unknown>;
  for (const platform of SOCIAL_PLATFORMS) {
    const v = obj[platform.key];
    if (typeof v === 'string' && v.trim()) out[platform.key] = v.trim();
  }
  const legacy = obj.url;
  if (typeof legacy === 'string' && legacy.trim()) {
    const target = detectSocialPlatform(legacy) ?? 'website';
    if (!out[target]) out[target] = legacy.trim();
  }
  return out;
}

// ---------------------------------------------------------------------------
// Application row + helpers
// ---------------------------------------------------------------------------

export type DocUpload =
  | { r2_key?: string; uploaded_at?: string; notes?: string }
  | Array<{ r2_key: string; uploaded_at?: string }>
  // client_references — structured entries (name · contact · event · date).
  | ClientReference[]
  | { scheduled_at?: string; meet_url?: string }
  // social_media — legacy single `url` OR the modern platform→link map
  // (index signature keeps `website`, `instagram`, … typed without listing all).
  | { url?: string; updated_at?: string; [platform: string]: string | undefined }
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
  // ── Contact confirmation (migration 20270503417266) ──────────────────────
  // Stamped by an admin when the vendor's "VALIDATE <shop name>" email/text
  // lands. Selected via a separate soft probe in fetchLatestApplication so a
  // pre-migration database degrades to null instead of crashing the read.
  contact_email_confirmed_at: string | null;
  contact_email_confirmed_by: string | null;
  contact_phone_confirmed_at: string | null;
  contact_phone_confirmed_by: string | null;
};

/** The four contact-confirmation stamp columns (migration 20270503417266). */
export type ContactConfirmation = Pick<
  VendorVerificationApplicationRow,
  | 'contact_email_confirmed_at'
  | 'contact_email_confirmed_by'
  | 'contact_phone_confirmed_at'
  | 'contact_phone_confirmed_by'
>;

export const EMPTY_CONTACT_CONFIRMATION: ContactConfirmation = {
  contact_email_confirmed_at: null,
  contact_email_confirmed_by: null,
  contact_phone_confirmed_at: null,
  contact_phone_confirmed_by: null,
};

/** The literal token the vendor must send by email AND text to Setnayan. */
export function expectedValidateToken(businessName: string | null): string {
  return `VALIDATE ${businessName?.trim() || 'your shop name'}`;
}

/**
 * Soft probe for the contact-confirmation stamps of a set of applications.
 * Returns a map keyed by application_id; on ANY error (e.g. 42703 on a
 * pre-migration database) returns an empty map so callers render the
 * unconfirmed state instead of crashing.
 */
export async function fetchContactConfirmations(
  supabase: SupabaseClient,
  applicationIds: string[],
): Promise<Record<string, ContactConfirmation>> {
  if (applicationIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('vendor_verification_applications')
      .select(
        'application_id,contact_email_confirmed_at,contact_email_confirmed_by,contact_phone_confirmed_at,contact_phone_confirmed_by',
      )
      .in('application_id', applicationIds);
    if (error || !data) return {};
    const out: Record<string, ContactConfirmation> = {};
    for (const row of data as Array<
      { application_id: string } & Partial<ContactConfirmation>
    >) {
      out[row.application_id] = {
        contact_email_confirmed_at: row.contact_email_confirmed_at ?? null,
        contact_email_confirmed_by: row.contact_email_confirmed_by ?? null,
        contact_phone_confirmed_at: row.contact_phone_confirmed_at ?? null,
        contact_phone_confirmed_by: row.contact_phone_confirmed_by ?? null,
      };
    }
    return out;
  } catch {
    return {};
  }
}

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
  // Structured slots are checked BEFORE the generic array branch: a
  // client_references array holds name/contact objects (no r2_key), so the
  // r2_key `.every()` test below would wrongly reject it.
  if (slotKey === 'client_references') {
    // Structured entries (≥1 with name + contact) OR a legacy uploaded file.
    if (parseClientReferences(v).some(isFilledReference)) return true;
    return parsePortfolioRefs(v).length > 0;
  }
  if (slotKey === 'social_media') {
    return Object.keys(parseSocialLinks(v)).length > 0;
  }
  if (Array.isArray(v)) {
    return (
      v.length >= 1 &&
      v.every((it) => typeof (it as { r2_key?: unknown })?.r2_key === 'string')
    );
  }
  if (typeof v !== 'object') return false;
  if (slotKey === 'google_meet') {
    return typeof (v as { scheduled_at?: string }).scheduled_at === 'string';
  }
  if (slotKey === 'phone_email_otp') {
    const t = v as { phone_verified?: boolean; email_verified?: boolean };
    return !!t.phone_verified && !!t.email_verified;
  }
  if (slotKey === 'amlc_screening') {
    return (v as { result?: string }).result === 'clear';
  }
  return typeof (v as { r2_key?: string }).r2_key === 'string';
}

// The slots the VENDOR fills themselves vs the one the Setnayan team runs
// (the 15-min Google Meet — post-prune the sole non-upload slot; it renders as
// Step 3 of the Get-verified stepper, never as a document card). The vendor's
// progress + submit gate count against VENDOR_DOC_SLOTS only.
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

/** Whether every REQUIRED upload (REQUIRED_DOC_SLOT_KEYS) is in. */
export function requiredDocsComplete(uploads: DocUploadMap): boolean {
  for (const key of REQUIRED_DOC_SLOT_KEYS) {
    if (!isSlotComplete(key, uploads?.[key])) return false;
  }
  return true;
}

/**
 * The ONE submit gate for verification (owner flow 2026-07-03: complete the
 * profile → the documents appear → upload → submit → "we contact you for final
 * confirmation"). Submitting requires a complete profile + the 4 required
 * documents. The VALIDATE contact confirmations and the Google Meet are part
 * of the POST-submit review (Setnayan contacts the vendor), so submit never
 * waits on admin stamping latency. Shared by the Get-verified section (renders
 * the reasons) and `submitInlineForReview` (enforces them) so client copy and
 * server validation can never drift. Empty = ready to submit.
 */
export function verificationSubmitMissing(input: {
  profileComplete: boolean;
  uploads: DocUploadMap;
  /**
   * Whether the vendor has submitted a government registration number
   * (`vendor_profiles.registration_number_raw IS NOT NULL`). This is the
   * anti-farm identity key — required to submit so a shop can't get verified
   * (and start its perk window) under no comparable identity at all. Optional
   * for backward-compatibility: only enforced when explicitly `false`. A
   * COLLIDED number still counts as "on file" (it routes to admin review, not a
   * hard block), so a vendor whose number duplicated another's can still submit.
   */
  registrationNumberOnFile?: boolean;
}): string[] {
  const missing: string[] = [];
  if (!input.profileComplete) missing.push('Finish your business profile');
  if (!requiredDocsComplete(input.uploads)) {
    missing.push('Upload your DTI/SEC, BIR 2303, Business Permit, and bank proof');
  }
  if (input.registrationNumberOnFile === false) {
    missing.push('Add your government registration number');
  }
  return missing;
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
  // The contact-confirmation columns are newer (20270503417266) than this
  // table's original select — merged via a soft probe so a pre-migration
  // database still serves the row (stamps degrade to null).
  const base = data as Omit<
    VendorVerificationApplicationRow,
    keyof ContactConfirmation
  >;
  const confirmations = await fetchContactConfirmations(supabase, [
    base.application_id,
  ]);
  return {
    ...base,
    ...(confirmations[base.application_id] ?? EMPTY_CONTACT_CONFIRMATION),
  };
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
 * This only picks the TYPE. The fee is resolved separately from
 * `service_catalog` (see `resolveApplicationFeeCentavos`); post-20260702 every
 * type resolves to ₱0, so no peso amount is annotated here anymore.
 *
 * Logic:
 *   • unverified / rejected      → 'initial'
 *   • demoted                    → 'post_demotion'
 *   • verified, ≥ 11 months ago  → 'annual_renewal' — renewal window
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

/**
 * Resolves the fee (PHP centavos) an application of the given type should be
 * STAMPED with at draft-insert time, reading the live `service_catalog` row.
 *
 * The rule (Entity Map & Hardcode Audit 2026-07-04, Violation #1): the fee is
 * whatever the catalog says — and an inactive OR missing SKU row resolves to
 * ₱0. Verification went free via the 20260702 migration, which set the
 * renewal / re-verification SKU rows `is_active = FALSE` while keeping
 * `vendor_verification_initial` active at `price_centavos = 0`. Both shapes of
 * "free" (inactive row · active-at-zero · row absent) therefore resolve to 0
 * here, so no draft is ever born with a retired ₱1,500 / ₱2,500 fee again.
 *
 * NB: this makes `annual_renewal` and `post_demotion` drafts stamp ₱0 while
 * their SKUs stay retired — an intentional, owner-flagged behaviour change from
 * the old hardcoded fees.
 *
 * Fail-open to 0 on any read error: the catalog is public-read, but a transient
 * failure must not birth a draft carrying a stale fee. 0 is the safe default
 * post-retirement.
 */
export async function resolveApplicationFeeCentavos(
  supabase: SupabaseClient,
  type: ApplicationType,
): Promise<number> {
  const skuCode = APPLICATION_TYPE_SKU[type];
  try {
    const { data, error } = await supabase
      .from('service_catalog')
      .select('price_centavos, is_active')
      .eq('sku_code', skuCode)
      .maybeSingle();
    // Missing row (null data) or read error → free.
    if (error || !data) return 0;
    const row = data as { price_centavos?: number | null; is_active?: boolean | null };
    // Inactive (retired) row → free, regardless of the stored price_centavos.
    if (row.is_active !== true) return 0;
    const price = typeof row.price_centavos === 'number' ? row.price_centavos : 0;
    return price > 0 ? price : 0;
  } catch {
    return 0;
  }
}
