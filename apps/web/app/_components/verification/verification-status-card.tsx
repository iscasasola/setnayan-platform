/**
 * Shared vendor-verification status presentation primitives.
 *
 * Extracted 2026-06-14 for the dashboard-consolidation dedup (Track A6).
 * The vendor submit surface (`app/vendor-dashboard/verify/page.tsx`) and the
 * admin review surface (`app/admin/verify/page.tsx`) both render a vendor's
 * `verification_state` keyed off the same `VERIFICATION_STATE_LABEL` map, with
 * a state→tone map and (vendor side) a state→icon map. That presentation logic
 * was forked across the two pages. This module owns it: the two surfaces keep
 * their own role-scoped, RLS-bound fetch + actions (vendor SUBMITs; admin
 * REVIEWs / approves / rejects) and only differ in how big the state badge is —
 * the vendor shows a full hero card, the admin shows a compact pill. Both
 * variants live here so the tone/icon/label knowledge has one home.
 *
 * No DOM change: each export reproduces its page's existing markup byte-for-byte
 * (the two surfaces' tone palettes intentionally differ slightly — both are
 * preserved exactly). Mirrors the role-parameterized pattern of
 * `app/_components/chat-message-stream.tsx`.
 */

import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react';
import {
  VERIFICATION_STATE_LABEL,
  type VerificationState,
} from '@/lib/vendor-verification';

// ---------------------------------------------------------------------------
// Vendor (SUBMIT side) — full hero status card.
// ---------------------------------------------------------------------------

/**
 * State → card tone classes for the vendor-side hero card. (Slightly different
 * palette from the admin pill below — the vendor card carries a border + body
 * text tone; preserved verbatim from the original page.)
 */
const VENDOR_STATUS_CARD_TONE: Record<VerificationState, string> = {
  unverified: 'bg-ink/5 text-ink/75 border-ink/15',
  pending_review: 'bg-warn-50 text-warn-900 border-warn-300',
  verified: 'bg-success-50 text-success-900 border-success-300',
  demoted: 'bg-terracotta/10 text-terracotta-700 border-terracotta/30',
  rejected: 'bg-terracotta/10 text-terracotta-700 border-terracotta/30',
};

const VENDOR_STATUS_CARD_ICON: Record<VerificationState, ReactNode> = {
  unverified: <Clock aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  pending_review: (
    <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
  ),
  verified: <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  demoted: <AlertTriangle aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
  rejected: <XCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />,
};

/**
 * The vendor-side verification-status hero card. The "latest application"
 * footer line is role-specific copy and is passed in as `meta` (the vendor
 * page builds it from `APPLICATION_TYPE_LABEL` + the application public id).
 */
export function VerificationStatusCard({
  verificationState,
  meta,
}: {
  verificationState: VerificationState;
  /** Optional footer line (e.g. "Latest application: …"). */
  meta?: ReactNode;
}) {
  return (
    <article
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 ${VENDOR_STATUS_CARD_TONE[verificationState]}`}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cream/60">
          {VENDOR_STATUS_CARD_ICON[verificationState]}
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">
            Current state
          </p>
          <p className="text-base font-semibold">
            {VERIFICATION_STATE_LABEL[verificationState]}
          </p>
        </div>
      </div>
      {meta ?? null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Admin (REVIEW side) — compact "Tier · …" pill.
// ---------------------------------------------------------------------------

/**
 * State → pill tone classes for the admin-side compact badge. (Lighter palette
 * than the vendor hero card; preserved verbatim from the original page.)
 */
const ADMIN_STATE_PILL_TONE: Record<VerificationState, string> = {
  unverified: 'bg-ink/5 text-ink/65',
  pending_review: 'bg-warn-50 text-warn-900',
  verified: 'bg-success-100 text-success-800',
  demoted: 'bg-warn-100 text-warn-900',
  rejected: 'bg-terracotta/10 text-terracotta-700',
};

/** Compact "Tier · {label}" pill used in the admin queue card header. */
export function VerificationStateBadge({ state }: { state: VerificationState }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${ADMIN_STATE_PILL_TONE[state]}`}
      title={`Vendor verification_state = ${state}`}
    >
      Tier · {VERIFICATION_STATE_LABEL[state]}
    </span>
  );
}
