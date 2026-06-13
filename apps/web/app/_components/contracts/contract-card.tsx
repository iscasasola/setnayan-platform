/**
 * Shared contract-list presentation primitives.
 *
 * Extracted 2026-06-14 for the dashboard-consolidation dedup (Track A3).
 * The couple list (`app/dashboard/[eventId]/contracts/page.tsx`) and the
 * vendor list (`app/vendor-dashboard/contracts/page.tsx`) had byte-identical
 * card markup, status badge, `STATUS_TONE` map, and empty-state shell — each
 * forked. This module owns the presentation; both pages keep their own
 * role-scoped, RLS-bound fetch (`fetchEventContracts` vs `fetchVendorContracts`)
 * and only the per-role wording / link target differs (passed via props).
 *
 * Mirrors the role-parameterized pattern of `app/_components/chat-message-stream.tsx`.
 */

import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';
import { statusLabel, type ContractStatus } from '@/lib/contracts';

/**
 * Status → badge tone classes. Repurposed under the upload-only scope
 * (2026-05-18) — see `lib/contracts.ts`. Single source of truth shared by
 * both contract lists; previously duplicated in each page.
 */
export const STATUS_TONE: Record<ContractStatus, string> = {
  draft: 'bg-ink/10 text-ink/70',
  // Repurposed under upload-only scope (2026-05-18) — see lib/contracts.ts.
  sent_for_signature: 'bg-emerald-100 text-emerald-800',
  fully_signed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
};

/** Pill badge rendering a contract's human status + tone. */
export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${STATUS_TONE[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

type ContractCardProps = {
  /** Contract title shown as the card heading. */
  title: string;
  /** Current UI status — drives the badge label + tone. */
  status: ContractStatus;
  /** ISO date string; rendered as the en-PH localized created date. */
  createdAt: string;
  /** Destination for the card link (role-scoped detail route). */
  href: string;
  /**
   * Leading word of the subtitle line. Couple side shows "From" (the vendor),
   * vendor side shows "For" (the event). Mirrors the per-role wording.
   */
  subtitlePrefix: string;
  /**
   * The name displayed after the prefix — the vendor business name (couple
   * side) or the event display name (vendor side).
   */
  subtitleName: string;
};

/**
 * A single contract row card. Identical markup on both surfaces; the link
 * target and subtitle ("From {vendor}" vs "For {event}") are the only
 * per-role differences.
 */
export function ContractCard({
  title,
  status,
  createdAt,
  href,
  subtitlePrefix,
  subtitleName,
}: ContractCardProps) {
  return (
    <li className="rounded-2xl border border-ink/10 bg-cream">
      <Link
        href={href}
        className="flex flex-col gap-2 p-5 transition-colors hover:bg-terracotta/[0.03] sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-ink">
              {title}
            </h2>
            <ContractStatusBadge status={status} />
          </div>
          <p className="text-xs text-ink/55">
            {subtitlePrefix} {subtitleName} ·{' '}
            {new Date(createdAt).toLocaleDateString('en-PH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <ArrowRight
          aria-hidden
          className="h-4 w-4 shrink-0 text-ink/40"
          strokeWidth={1.75}
        />
      </Link>
    </li>
  );
}

/**
 * Empty-state shell for a contract list — shared icon + wrapper; the copy is
 * role-specific and passed in by the page.
 */
export function ContractsEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-cream p-10 text-center">
      <FileText aria-hidden className="mx-auto h-8 w-8 text-ink/40" strokeWidth={1.5} />
      <p className="mt-3 text-sm text-ink/65">{message}</p>
    </div>
  );
}
