/**
 * Government + parish paperwork pipeline — types, ceremony-type seed maps,
 * deadline math, brand-voice labels.
 *
 * Per CLAUDE.md 2026-05-22 owner directive: PSA + CENOMAR + Marriage License
 * + Pre-Cana paperwork is the highest-anxiety pre-wedding workflow in PH.
 * This module is the single source of truth for what documents apply to
 * each ceremony_type, when they need to be requested + completed, and
 * what polite brand-voice copy the host sees on each card.
 *
 * Schema: see migration 20260604050000_event_paperwork_pipeline.sql.
 * Server actions: see app/dashboard/[eventId]/paperwork/actions.ts.
 * Surface: see app/dashboard/[eventId]/paperwork/page.tsx.
 *
 * Cross-references:
 *   • events.ceremony_type CHECK = catholic / civil / inc / christian /
 *     muslim / cultural / mixed (migration 20260521000000_iteration_0043).
 *   • events.event_date drives every "request by" deadline.
 *   • Document scans store in setnayan-vendor-contracts R2 bucket under
 *     the paperwork/{event_id}/{document_type}/ prefix per lib/uploads.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// --- Canonical document type union --------------------------------------

/**
 * Every document_type value mirrors the CHECK constraint on
 * event_paperwork.document_type. Keep in lock-step with the migration
 * — TypeScript union here, Postgres CHECK there.
 */
export type PaperworkDocumentType =
  // PSA — every ceremony type
  | 'psa_birth_cert_partner_1'
  | 'psa_birth_cert_partner_2'
  | 'cenomar_partner_1'
  | 'cenomar_partner_2'
  // LGU — every ceremony type
  | 'marriage_license'
  // Catholic-specific
  | 'pre_cana_certificate'
  | 'baptismal_cert_partner_1'
  | 'baptismal_cert_partner_2'
  | 'confirmation_cert_partner_1'
  | 'confirmation_cert_partner_2'
  | 'banns_posted'
  | 'canonical_interview_complete'
  // INC-specific
  | 'inc_counseling_complete'
  // Muslim-specific
  | 'sharia_counseling_complete'
  // Civil + OFW
  | 'cfo_counseling_complete';

export type PaperworkStatus =
  | 'not_started'
  | 'requested'
  | 'in_processing'
  | 'received'
  | 'expired';

/**
 * Ceremony types from events.ceremony_type. Matches the CHECK constraint
 * in migration 20260521000000_iteration_0043_wedding_type_picker.sql.
 */
export type CeremonyType =
  | 'catholic'
  | 'civil'
  | 'inc'
  | 'christian'
  | 'muslim'
  | 'cultural'
  | 'aglipayan'
  | 'lds'
  | 'sda'
  | 'jw'
  | 'hindu'
  | 'sikh'
  | 'buddhist'
  | 'orthodox'
  | 'mixed';

export type PaperworkRow = {
  id: string;
  event_id: string;
  document_type: PaperworkDocumentType;
  status: PaperworkStatus;
  requested_at: string | null;
  received_at: string | null;
  expected_completion_date: string | null;
  expires_at: string | null;
  tracking_reference: string | null;
  document_r2_key: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// --- Document metadata (label + helper + lead time) ---------------------

export type DocumentMeta = {
  /** Polite host-facing label — no government acronyms when avoidable. */
  label: string;
  /** Short brand-voice helper line shown under the label. */
  helper: string;
  /**
   * How many months before the wedding the host should HAVE COMPLETED this
   * document. Marriage license + Pre-Cana + Banns are anchored by their
   * own statute-driven windows; the other rows are conservative defaults
   * that absorb PSA processing time.
   */
  completeMonthsBefore: number;
  /**
   * Typical processing-time hint shown on the card (e.g., "PSA processing:
   * 2-4 weeks"). One-line.
   */
  processingHint: string;
  /**
   * Where the host actually goes to request the document. Surfaces as
   * helper guidance on the card so the host knows the next physical step.
   */
  whereToGo: string;
};

/**
 * Universal canonical document metadata. Every PaperworkDocumentType
 * appears here exactly once. The seed map (DOCUMENTS_BY_CEREMONY_TYPE
 * below) selects which subset applies per ceremony type.
 */
export const DOCUMENT_META: Record<PaperworkDocumentType, DocumentMeta> = {
  // PSA — every ceremony type
  psa_birth_cert_partner_1: {
    label: 'PSA Birth Certificate (you)',
    helper:
      'The PSA-issued birth certificate every officiant + LGU will ask for. Request now — even a fresh online order takes weeks.',
    completeMonthsBefore: 5,
    processingHint: 'PSA processing: 2-4 weeks',
    whereToGo:
      'Request online via the official PSA website (psa.gov.ph) or visit a PSA Serbilis outlet.',
  },
  psa_birth_cert_partner_2: {
    label: 'PSA Birth Certificate (partner)',
    helper:
      'Same PSA-issued certificate, this time for your partner. Two-name households can request both copies in one online order.',
    completeMonthsBefore: 5,
    processingHint: 'PSA processing: 2-4 weeks',
    whereToGo:
      'Request online via the official PSA website (psa.gov.ph) or visit a PSA Serbilis outlet.',
  },
  cenomar_partner_1: {
    label: 'CENOMAR (you)',
    helper:
      'PSA Certificate of No Marriage Record. Confirms you are free to marry. Some LGUs prefer a copy issued within 6 months of your wedding date.',
    completeMonthsBefore: 4,
    processingHint: 'PSA processing: 2-4 weeks',
    whereToGo:
      'Request alongside your PSA birth certificate at psa.gov.ph or a Serbilis outlet.',
  },
  cenomar_partner_2: {
    label: 'CENOMAR (partner)',
    helper:
      'Your partner needs their own CENOMAR. The LGU will not issue your marriage license without both.',
    completeMonthsBefore: 4,
    processingHint: 'PSA processing: 2-4 weeks',
    whereToGo:
      'Request alongside your PSA birth certificate at psa.gov.ph or a Serbilis outlet.',
  },
  // LGU — every ceremony type
  marriage_license: {
    label: 'Marriage License',
    helper:
      'Issued by your LGU’s Civil Registry. Valid for 120 days from issue. Apply about 4 months before — early enough that paperwork delays do not pinch, late enough that the license stays valid through your wedding day.',
    completeMonthsBefore: 4,
    processingHint: '10-day posting period + ID review at the LGU',
    whereToGo:
      'Visit the Civil Registry of the LGU where you or your partner has lived for at least 6 months. Bring both PSA birth certificates, both CENOMARs, valid IDs, 1x1 photos, and (if under 25) a parental consent or advice form.',
  },
  // Catholic
  pre_cana_certificate: {
    label: 'Pre-Cana Seminar',
    helper:
      'The marriage preparation seminar your ceremony parish requires. Most parishes need 60-90 days notice and run the seminar over one weekend.',
    completeMonthsBefore: 3,
    processingHint: 'Usually one weekend session',
    whereToGo:
      'Contact your ceremony parish directly. Many parishes book Pre-Cana batches months in advance, so reserve a slot early.',
  },
  baptismal_cert_partner_1: {
    label: 'Baptismal Certificate (you)',
    helper:
      'Your parish-issued baptismal certificate, dated within 6 months of your wedding for most archdioceses. Request a fresh copy from your home parish — the original from your childhood may be too old.',
    completeMonthsBefore: 3,
    processingHint: 'Parish processing: usually same-week',
    whereToGo:
      'Visit or call the parish where you were baptized. Most parishes issue a fresh certificate on request for a small donation.',
  },
  baptismal_cert_partner_2: {
    label: 'Baptismal Certificate (partner)',
    helper:
      'Same fresh-issue rule for your partner. Both certificates go to your ceremony parish along with the rest of the canonical bundle.',
    completeMonthsBefore: 3,
    processingHint: 'Parish processing: usually same-week',
    whereToGo:
      'Visit or call your partner’s baptismal parish for a fresh copy.',
  },
  confirmation_cert_partner_1: {
    label: 'Confirmation Certificate (you)',
    helper:
      'Most Filipino dioceses require both partners to be confirmed before a Catholic wedding. Request a fresh copy from the parish where you were confirmed.',
    completeMonthsBefore: 3,
    processingHint: 'Parish processing: usually same-week',
    whereToGo:
      'Visit or call the parish where you received the sacrament of Confirmation.',
  },
  confirmation_cert_partner_2: {
    label: 'Confirmation Certificate (partner)',
    helper:
      'Same fresh-issue rule for your partner. If either of you is not yet confirmed, your parish will guide you through a brief preparation.',
    completeMonthsBefore: 3,
    processingHint: 'Parish processing: usually same-week',
    whereToGo:
      'Visit or call your partner’s Confirmation parish.',
  },
  banns_posted: {
    label: 'Banns Posted',
    helper:
      'The parish posts your marriage banns at the church for three consecutive Sundays — a public notice that any impediment must be raised. Confirm with your parish that the schedule is set.',
    completeMonthsBefore: 1,
    processingHint: 'Posted over three Sundays before your wedding',
    whereToGo:
      'Coordinate with your ceremony parish secretary — they handle the posting once your canonical paperwork is in.',
  },
  canonical_interview_complete: {
    label: 'Canonical Interview',
    helper:
      'A short conversation with your parish priest to confirm you understand the sacrament. Most parishes pair this with your Pre-Cana submission.',
    completeMonthsBefore: 2,
    processingHint: 'A single in-person appointment',
    whereToGo:
      'Schedule directly with your ceremony parish priest or the parish secretary.',
  },
  // INC
  inc_counseling_complete: {
    label: 'INC Counseling Sessions',
    helper:
      'The marriage counseling sessions led by your INC minister. Sessions typically run over several weeks before your wedding date.',
    completeMonthsBefore: 3,
    processingHint: 'Several sessions over a few weeks',
    whereToGo:
      'Coordinate with the minister at your local INC congregation.',
  },
  // Muslim
  sharia_counseling_complete: {
    label: 'Sharia Counseling + Documentation',
    helper:
      'Code of Muslim Personal Laws (PD 1083) paperwork through your local Imam, including the marriage license issued by the Sharia District Court instead of the LGU.',
    completeMonthsBefore: 4,
    processingHint: 'Sharia District Court + Imam-led counseling',
    whereToGo:
      'Coordinate with your community Imam — they walk you through the documentary requirements and the Sharia District Court application.',
  },
  // Civil + OFW
  cfo_counseling_complete: {
    label: 'CFO Pre-Marriage Counseling',
    helper:
      'Required by the Commission on Filipinos Overseas when one or both partners is an OFW or a permanent resident abroad. Skip this row if neither of you is an OFW.',
    completeMonthsBefore: 2,
    processingHint: 'One-day in-person session at a CFO office',
    whereToGo:
      'Register at cfo.gov.ph and attend at a CFO branch nearest you.',
  },
};

// --- Seed by ceremony_type ----------------------------------------------

/**
 * Documents required for each ceremony type. Hosts whose ceremony_type
 * is NULL (haven't picked yet) see the universal base — PSA + CENOMAR +
 * Marriage License — so they have something to start on while they
 * make the ceremony decision.
 */
export const DOCUMENTS_BY_CEREMONY_TYPE: Record<
  CeremonyType | 'unknown',
  ReadonlyArray<PaperworkDocumentType>
> = {
  catholic: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
    'pre_cana_certificate',
    'baptismal_cert_partner_1',
    'baptismal_cert_partner_2',
    'confirmation_cert_partner_1',
    'confirmation_cert_partner_2',
    'banns_posted',
    'canonical_interview_complete',
  ],
  civil: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
    // CFO is conditional on OFW status. Seed it for civil so OFW couples
    // see it; non-OFW couples can leave it untouched (it stays
    // not_started) or delete it from the UI in a future Cowork pass.
    'cfo_counseling_complete',
  ],
  inc: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
    'inc_counseling_complete',
  ],
  muslim: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
    'sharia_counseling_complete',
  ],
  christian: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
  ],
  cultural: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
  ],
  // The 8 worldwide-expansion faiths (migration 20261117000000) start on
  // the universal base — PSA + CENOMAR + Marriage License apply to every
  // PH marriage regardless of rite. Faith-specific counseling/certificate
  // rows land with each faith's content pass when the owner activates it.
  aglipayan: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
  ],
  lds: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
  ],
  sda: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
  ],
  jw: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
  ],
  hindu: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
  ],
  sikh: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
  ],
  buddhist: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
  ],
  orthodox: [
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
  ],
  mixed: [
    // Mixed-faith couples get the Catholic bundle + Marriage License + a
    // counseling row for the partnered tradition. The seed function picks
    // the secondary tradition's counseling row separately when known.
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
    'pre_cana_certificate',
    'baptismal_cert_partner_1',
    'baptismal_cert_partner_2',
    'confirmation_cert_partner_1',
    'confirmation_cert_partner_2',
  ],
  unknown: [
    // Universal base. Host has not yet picked a ceremony_type; they can
    // still get started on PSA + CENOMAR + Marriage License which apply
    // regardless of how the ceremony shakes out.
    'psa_birth_cert_partner_1',
    'psa_birth_cert_partner_2',
    'cenomar_partner_1',
    'cenomar_partner_2',
    'marriage_license',
  ],
};

// --- Status copy + deadline math ----------------------------------------

export const STATUS_LABEL: Record<PaperworkStatus, string> = {
  not_started: 'Not started',
  requested: 'Requested',
  in_processing: 'In processing',
  received: 'Received',
  expired: 'Expired',
};

export const STATUS_TONE: Record<PaperworkStatus, string> = {
  not_started: 'bg-ink/5 text-ink/55',
  requested: 'bg-warn-100 text-warn-900',
  in_processing: 'bg-warn-100 text-warn-900',
  received: 'bg-success-100 text-success-800',
  expired: 'bg-danger-100 text-danger-800',
};

/**
 * Compute the "complete by" deadline for a document given the event date
 * and the document's `completeMonthsBefore`. Returns null if event_date
 * is null. Output is an ISO YYYY-MM-DD string.
 */
export function completeByDate(
  documentType: PaperworkDocumentType,
  eventDate: string | null,
): string | null {
  if (!eventDate) return null;
  const meta = DOCUMENT_META[documentType];
  const d = new Date(eventDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() - meta.completeMonthsBefore);
  return d.toISOString().slice(0, 10);
}

/**
 * Marriage license carries a 120-day validity from issuance. Returns
 * the expiry date given a received_at. Other document types return null.
 */
export function expiresAtFor(
  documentType: PaperworkDocumentType,
  receivedAt: string | Date | null,
): string | null {
  if (documentType !== 'marriage_license' || !receivedAt) return null;
  const base = new Date(receivedAt);
  if (Number.isNaN(base.getTime())) return null;
  const expiry = new Date(base);
  expiry.setDate(expiry.getDate() + 120);
  return expiry.toISOString().slice(0, 10);
}

/**
 * Format a YYYY-MM-DD date as "March 2, 2026" for display. Returns "—"
 * for null. Locale forced to en-PH so dates read naturally for the host.
 */
export function formatLongDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Tone for the deadline pill: 'overdue' if the complete-by date has
 * passed, 'soon' if within 30 days, 'fine' otherwise, 'none' if no event
 * date is set. Used for both the deadline copy color + the card border.
 */
export type DeadlineTone = 'overdue' | 'soon' | 'fine' | 'none';

export function deadlineTone(
  completeBy: string | null,
  status: PaperworkStatus,
): DeadlineTone {
  // Documents already received never glow amber/red — they're done.
  if (status === 'received') return 'fine';
  if (!completeBy) return 'none';
  const d = new Date(completeBy);
  if (Number.isNaN(d.getTime())) return 'none';
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 30) return 'soon';
  return 'fine';
}

/**
 * Tone for a marriage-license expiry pill. The license becomes 'soon'
 * 30 days before lapsing, 'overdue' once past expiry. NULL expires_at
 * (e.g., not yet received) returns 'none'.
 */
export function expiryTone(expiresAt: string | null): DeadlineTone {
  if (!expiresAt) return 'none';
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return 'none';
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 30) return 'soon';
  return 'fine';
}

// --- Data fetch ---------------------------------------------------------

/**
 * Fetch every paperwork row for an event, sorted by document_type so the
 * UI can display in a stable order (the same order
 * DOCUMENTS_BY_CEREMONY_TYPE lists for the matched ceremony type).
 */
export async function fetchEventPaperwork(
  supabase: SupabaseClient,
  eventId: string,
): Promise<PaperworkRow[]> {
  const { data, error } = await supabase
    .from('event_paperwork')
    .select(
      'id, event_id, document_type, status, requested_at, received_at, expected_completion_date, expires_at, tracking_reference, document_r2_key, notes, created_at, updated_at',
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[paperwork] fetchEventPaperwork:', error.message);
    return [];
  }
  return (data ?? []) as PaperworkRow[];
}

/**
 * Coerce events.ceremony_type into our canonical union, falling back to
 * 'unknown' for null / unrecognized values. Centralizes the type guard
 * so the page + actions both read from the same gate.
 */
export function resolveCeremonyType(
  raw: string | null | undefined,
): CeremonyType | 'unknown' {
  if (raw == null) return 'unknown';
  if (
    raw === 'catholic' ||
    raw === 'civil' ||
    raw === 'inc' ||
    raw === 'christian' ||
    raw === 'muslim' ||
    raw === 'cultural' ||
    raw === 'aglipayan' ||
    raw === 'lds' ||
    raw === 'sda' ||
    raw === 'jw' ||
    raw === 'hindu' ||
    raw === 'sikh' ||
    raw === 'buddhist' ||
    raw === 'orthodox' ||
    raw === 'mixed'
  ) {
    return raw;
  }
  return 'unknown';
}

/**
 * Aggregate progress summary used by the sub-link on the Ceremony plan
 * card. Returns counts of received vs total + whether anything is
 * overdue, so the home-page sub-link can render a compact status pill.
 */
export type PaperworkSummary = {
  total: number;
  received: number;
  inProgress: number;
  overdueCount: number;
  hasMarriageLicenseExpiring: boolean;
};

export function summarize(
  rows: ReadonlyArray<PaperworkRow>,
  eventDate: string | null,
): PaperworkSummary {
  let received = 0;
  let inProgress = 0;
  let overdueCount = 0;
  let hasMarriageLicenseExpiring = false;
  for (const r of rows) {
    if (r.status === 'received') received += 1;
    else if (r.status === 'requested' || r.status === 'in_processing')
      inProgress += 1;
    const deadline = completeByDate(r.document_type, eventDate);
    if (deadlineTone(deadline, r.status) === 'overdue') overdueCount += 1;
    if (r.document_type === 'marriage_license' && r.status === 'received') {
      const expiryStatus = expiryTone(r.expires_at);
      if (expiryStatus === 'soon' || expiryStatus === 'overdue') {
        hasMarriageLicenseExpiring = true;
      }
    }
  }
  return {
    total: rows.length,
    received,
    inProgress,
    overdueCount,
    hasMarriageLicenseExpiring,
  };
}
