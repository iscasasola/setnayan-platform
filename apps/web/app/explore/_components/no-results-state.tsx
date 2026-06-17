'use client';

/**
 * NoResultsState — PR 9 (no-results negotiation flow).
 *
 * Shown when the Explore vendor grid returns zero results. Presents four
 * recovery actions:
 *
 * 1. Negotiate — sends a pre-drafted outreach message to the top-ranking
 *    vendor in the filtered category, even though they didn't surface in the
 *    current narrow search. Anti-bombarding: if the couple already sent a
 *    message to that vendor within the last 7 days, the action just opens
 *    the thread instead of double-sending.
 *
 * 2. Find cheaper — removes strict filters (matchEvent + verifiedOnly) via
 *    the broadened href, widening the result set.
 *
 * 3. Add from outside + invite — links to the couple's manual-vendor modal
 *    (Add contact) and copies a vendor referral link to the clipboard.
 *
 * 4. Show all X vendors — secondary CTA when broadenedCount > 0 (strict
 *    filter loosened).
 *
 * The "X vendors in [Category] across Setnayan" count line is rendered from
 * server-side data (totalCategoryCount) passed as a prop.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { MessageSquare, Search, UserPlus, ChevronRight, Copy, Check } from 'lucide-react';
import { negotiateWithTopVendor } from '../actions';

export type NoResultsStateProps = {
  /** Filters.matchEvent || filters.verifiedOnly (used to show "Find cheaper"). */
  hasStrictFilter: boolean;
  /** URL to broaden results by dropping strict filters (built server-side). */
  broadenHref: string;
  /** Count of vendors in the broadened scope (null if no strict filter was active). */
  broadenedCount: number | null;
  /** Total vendor count for this category/tile across all filters (incl. no filter). */
  totalCategoryCount: number | null;
  /** Human-readable label for the filtered category (e.g. "Wedding Photographers"). */
  categoryLabel: string | null;
  /** The couple's primary event ID (null for anonymous visitors). */
  coupleEventId: string | null;
  /** Top-ranking vendor to negotiate with (null if no vendors exist at all). */
  topVendor: {
    vendorProfileId: string;
    businessName: string;
  } | null;
  /** Human-readable event type label (e.g. "Wedding"). */
  eventTypeLabel: string | null;
  /** Couple's event date window for the message (e.g. "December 2026"). */
  dateWindow: string | null;
  /** Couple's total budget estimate in PHP (from event budget row, may be null). */
  budgetPhp: number | null;
  /** Whether the current user is authenticated. */
  isAuthenticated: boolean;
  /** focusedMode — when true, "Clear all" links back to /explore?from=plan. */
  focusedMode: boolean;
};

export function NoResultsState({
  hasStrictFilter,
  broadenHref,
  broadenedCount,
  totalCategoryCount,
  categoryLabel,
  coupleEventId,
  topVendor,
  eventTypeLabel,
  dateWindow,
  budgetPhp,
  isAuthenticated,
  focusedMode,
}: NoResultsStateProps) {
  const [negotiating, startNegotiate] = useTransition();
  const [negotiateResult, setNegotiateResult] = useState<
    | { ok: true; threadId: string; alreadySent: boolean }
    | { ok: false; message: string }
    | null
  >(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const canNegotiate =
    isAuthenticated && coupleEventId && topVendor;

  const referralLink = coupleEventId
    ? `https://setnayan.com/for-vendors?ref=${coupleEventId}`
    : 'https://setnayan.com/for-vendors';

  const showBroadenCount =
    hasStrictFilter && broadenedCount !== null && broadenedCount > 0;

  function handleNegotiate() {
    if (!canNegotiate || !coupleEventId || !topVendor) return;
    startNegotiate(async () => {
      const fd = new FormData();
      fd.set('vendor_profile_id', topVendor.vendorProfileId);
      fd.set('event_id', coupleEventId);
      fd.set('category_label', categoryLabel ?? '');
      fd.set('event_type_label', eventTypeLabel ?? '');
      fd.set('date_window', dateWindow ?? '');
      fd.set('budget_php', budgetPhp != null ? String(budgetPhp) : '');
      const result = await negotiateWithTopVendor(fd);
      if (result.status === 'ok') {
        setNegotiateResult({
          ok: true,
          threadId: result.threadId,
          alreadySent: result.alreadySent,
        });
      } else if (result.status === 'not_signed_in') {
        setNegotiateResult({ ok: false, message: 'Sign in to send a message.' });
      } else if (result.status === 'no_primary_event') {
        setNegotiateResult({ ok: false, message: 'Create an event first to reach out to vendors.' });
      } else if (result.status === 'vendor_not_found') {
        setNegotiateResult({ ok: false, message: 'Vendor no longer available.' });
      } else {
        setNegotiateResult({ ok: false, message: result.message });
      }
    });
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }

  // ── Post-negotiate success state ──────────────────────────────────────────
  if (negotiateResult?.ok) {
    const dashboardBase = coupleEventId
      ? `/dashboard/${coupleEventId}/messages/${negotiateResult.threadId}`
      : `/dashboard`;
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-mulberry/30 bg-mulberry/[0.04] p-10 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-mulberry">
          {negotiateResult.alreadySent ? 'Already reached out' : 'Message sent'}
        </p>
        <p className="mt-3 text-base font-medium text-ink">
          {negotiateResult.alreadySent
            ? `You've already messaged ${topVendor?.businessName} recently.`
            : `Your message to ${topVendor?.businessName} is on its way.`}
        </p>
        <p className="mx-auto mt-2 max-w-prose text-sm text-ink/65">
          {negotiateResult.alreadySent
            ? 'Check your thread to follow up or wait for their reply.'
            : 'They\'ll get a notification and can respond in the app.'}
        </p>
        <Link
          href={dashboardBase}
          className="button-primary mt-5 inline-flex h-10 items-center gap-2 px-5"
        >
          View thread
          <ChevronRight size={14} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {/* Count banner — "X vendors in [Category] across Setnayan" */}
      {totalCategoryCount !== null && totalCategoryCount > 0 && categoryLabel ? (
        <div className="rounded-xl border border-ink/10 bg-cream px-5 py-3 text-sm text-ink/70">
          <span className="font-medium text-ink">{totalCategoryCount}</span>{' '}
          {totalCategoryCount === 1 ? 'vendor' : 'vendors'} in{' '}
          <span className="font-medium text-ink">{categoryLabel}</span> across
          Setnayan —{' '}
          {showBroadenCount ? (
            <Link href={broadenHref} className="text-mulberry underline underline-offset-2">
              adjust filters
            </Link>
          ) : (
            <Link
              href={focusedMode ? '/explore?from=plan' : '/explore'}
              className="text-mulberry underline underline-offset-2"
            >
              clear filters
            </Link>
          )}{' '}
          to see them.
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-ink/15 bg-cream p-10 text-center">
          <p className="text-base font-medium text-ink/75">No vendors match exactly.</p>
          <p className="mt-1 text-sm text-ink/55">
            {showBroadenCount
              ? `We have ${broadenedCount} vendor${broadenedCount === 1 ? '' : 's'} in this category — try widening your search.`
              : 'Try clearing one filter at a time.'}
          </p>
        </div>
      )}

      {/* Action cards grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* 1. Negotiate */}
        {canNegotiate && topVendor ? (
          <button
            type="button"
            onClick={handleNegotiate}
            disabled={negotiating}
            className="flex flex-col items-start gap-2 rounded-2xl border border-mulberry/25 bg-mulberry/[0.04] p-5 text-left transition-colors hover:bg-mulberry/[0.08] disabled:opacity-60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mulberry/10">
              <MessageSquare size={16} className="text-mulberry" />
            </span>
            <span className="text-sm font-semibold text-ink">
              {negotiating ? 'Sending…' : 'Negotiate'}
            </span>
            <span className="text-xs text-ink/60 leading-relaxed">
              Send a budget-aware intro to{' '}
              <span className="font-medium text-ink">{topVendor.businessName}</span> — the
              top vendor in this category — and see if they can work with you.
            </span>
            {negotiateResult?.ok === false ? (
              <span className="mt-1 rounded-md bg-terracotta/10 px-2 py-1 text-xs text-terracotta">
                {negotiateResult.message}
              </span>
            ) : null}
          </button>
        ) : !isAuthenticated ? (
          <Link
            href="/login?next=/explore"
            className="flex flex-col items-start gap-2 rounded-2xl border border-mulberry/25 bg-mulberry/[0.04] p-5 transition-colors hover:bg-mulberry/[0.08]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mulberry/10">
              <MessageSquare size={16} className="text-mulberry" />
            </span>
            <span className="text-sm font-semibold text-ink">Negotiate</span>
            <span className="text-xs text-ink/60 leading-relaxed">
              Sign in to send a budget-aware outreach message to the top vendor in this
              category.
            </span>
          </Link>
        ) : null}

        {/* 2. Find cheaper — remove strict filters */}
        {showBroadenCount ? (
          <Link
            href={broadenHref}
            className="flex flex-col items-start gap-2 rounded-2xl border border-ink/15 bg-cream p-5 transition-colors hover:bg-ink/[0.03]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/8">
              <Search size={16} className="text-ink/70" />
            </span>
            <span className="text-sm font-semibold text-ink">Find cheaper</span>
            <span className="text-xs text-ink/60 leading-relaxed">
              Remove your strict filters to see{' '}
              <span className="font-medium text-ink">{broadenedCount}</span> more{' '}
              {broadenedCount === 1 ? 'vendor' : 'vendors'} — including unverified and
              coming-soon listings that may fit your budget.
            </span>
          </Link>
        ) : (
          <Link
            href={focusedMode ? '/explore?from=plan' : '/explore'}
            className="flex flex-col items-start gap-2 rounded-2xl border border-ink/15 bg-cream p-5 transition-colors hover:bg-ink/[0.03]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/8">
              <Search size={16} className="text-ink/70" />
            </span>
            <span className="text-sm font-semibold text-ink">Browse all vendors</span>
            <span className="text-xs text-ink/60 leading-relaxed">
              Clear your current filters and browse all verified vendors on Setnayan.
            </span>
          </Link>
        )}

        {/* 3. Add from outside + invite */}
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-ink/15 bg-cream p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/8">
            <UserPlus size={16} className="text-ink/70" />
          </span>
          <span className="text-sm font-semibold text-ink">Add from outside</span>
          <span className="text-xs text-ink/60 leading-relaxed">
            Already found someone elsewhere? Add them to your plan manually — then invite
            them to claim their free Setnayan profile.
          </span>
          <div className="mt-1 flex flex-wrap gap-2">
            {coupleEventId ? (
              <Link
                href={`/dashboard/${coupleEventId}/vendors/add-contact`}
                className="inline-flex h-7 items-center rounded-full border border-ink/20 bg-white px-3 text-xs font-medium text-ink transition-colors hover:bg-ink/[0.04]"
              >
                Add contact
              </Link>
            ) : (
              <Link
                href="/login?next=/explore"
                className="inline-flex h-7 items-center rounded-full border border-ink/20 bg-white px-3 text-xs font-medium text-ink transition-colors hover:bg-ink/[0.04]"
              >
                Sign in to add
              </Link>
            )}
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-ink/20 bg-white px-3 text-xs font-medium text-ink transition-colors hover:bg-ink/[0.04]"
            >
              {copiedLink ? (
                <>
                  <Check size={11} className="text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={11} />
                  Invite to Setnayan
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Fallback clear-all link */}
      <p className="text-center text-xs text-ink/45">
        <Link
          href={focusedMode ? '/explore?from=plan' : '/explore'}
          className="underline underline-offset-2 hover:text-ink/70"
        >
          Clear all filters
        </Link>
      </p>
    </div>
  );
}
