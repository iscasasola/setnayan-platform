'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { AlertCircle, BookmarkCheck, Check, Sparkles } from 'lucide-react';
import { addRecommendedVendorToCategory } from '../vendors/actions';

/**
 * RecommendedVendorRow — cross-category vendor recommendation row on each
 * unlocked planning card (CLAUDE.md 2026-05-22 owner directive).
 *
 * Renders ONE recommendation: the vendor's logo or initials + canonical
 * name + "also doing your {source}" sub-line + two CTAs (Consider · Lock
 * too). Both CTAs route through addRecommendedVendorToCategory; Consider
 * adds as 'considering', Lock too cascades into finalizeVendor with the
 * auto-cleanup. Pending / success / error states render inline without
 * blocking the rest of the card.
 *
 * Brand voice: amber accent (different from picks=terracotta, locked=
 * emerald). Polite copy, no scolding, no dev jargon. Per
 * [[feedback_setnayan_no_dev_text_post_launch]] + the wedding planner
 * voice locked in CLAUDE.md 2026-05-19 0015 lock.
 *
 * Tap targets: 44px minimum on the two CTAs per the dashboard mobile
 * usability lock.
 *
 * Sub-component of planning-groups.tsx GroupCard — sits between the
 * picks list and the PlanCardCTAs ("+ Add" button). Hidden on locked
 * cards (host already committed in this category).
 */

type Mode = 'idle' | 'pending' | 'added' | 'locked' | 'error';

type Props = {
  eventId: string;
  marketplaceVendorId: string;
  serviceId: string;
  targetCategory: string;
  vendorName: string;
  vendorLogoUrl: string | null;
  sourceGroupLabel: string;
  sourceStatus: 'picked' | 'locked';
};

export function RecommendedVendorRow({
  eventId,
  marketplaceVendorId,
  serviceId,
  targetCategory,
  vendorName,
  vendorLogoUrl,
  sourceGroupLabel,
  sourceStatus,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function submit(desiredStatus: 'considering' | 'contracted') {
    if (pending) return;
    setErrorMsg(null);
    const form = new FormData();
    form.set('event_id', eventId);
    form.set('marketplace_vendor_id', marketplaceVendorId);
    form.set('service_id', serviceId);
    form.set('category', targetCategory);
    form.set('desired_status', desiredStatus);
    startTransition(async () => {
      setMode('pending');
      try {
        const result = await addRecommendedVendorToCategory(form);
        if (result.status === 'ok') {
          setMode(result.locked ? 'locked' : 'added');
        } else if (result.status === 'already_picked') {
          // Idempotent — surface as added so the host sees the same
          // success affordance regardless of whether they double-clicked.
          setMode('added');
        } else if (result.status === 'not_signed_in') {
          setMode('error');
          setErrorMsg('Sign in again to keep planning.');
        } else if (result.status === 'invalid_category') {
          setMode('error');
          setErrorMsg('That category isn’t available right now.');
        } else if (
          result.status === 'service_not_found' ||
          result.status === 'source_vendor_not_found'
        ) {
          setMode('error');
          setErrorMsg('This recommendation is no longer available.');
        } else {
          setMode('error');
          setErrorMsg(result.message ?? 'Something went wrong.');
        }
      } catch {
        setMode('error');
        setErrorMsg('Couldn’t reach our servers. Try again.');
      }
    });
  }

  const initials =
    vendorName
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase())
      .filter((c) => c.length > 0)
      .slice(0, 2)
      .join('') || '?';

  const isOptimizableUrl = (url: string | null): url is string =>
    !!url &&
    (url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('/'));

  // Sub-line copy. "Also doing your catering" for considering picks
  // and "Locked for your catering" for locked source picks — the
  // stronger commitment signal warrants the more confident phrasing.
  const sourceSubLine =
    sourceStatus === 'locked'
      ? `Locked for your ${sourceGroupLabel}`
      : `Also doing your ${sourceGroupLabel}`;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-warn-200/70 bg-warn-50/50 px-3 py-2.5">
      {/* Avatar — vendor logo if available, else initials on amber */}
      {isOptimizableUrl(vendorLogoUrl) ? (
        <span className="inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-md border border-warn-200/50 bg-cream">
          <Image
            src={vendorLogoUrl}
            alt=""
            width={36}
            height={36}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </span>
      ) : (
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-warn-100 font-mono text-xs font-semibold text-warn-900"
        >
          {initials}
        </span>
      )}

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium text-ink">{vendorName}</p>
        <p className="flex items-center gap-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-warn-800/80">
          <Sparkles aria-hidden className="h-2.5 w-2.5" strokeWidth={2} />
          <span className="truncate">{sourceSubLine}</span>
        </p>
        {mode === 'idle' || mode === 'pending' ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => submit('considering')}
              disabled={pending}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-warn-300/60 bg-cream px-2.5 py-1 text-[11px] font-medium text-warn-900 transition-colors hover:bg-warn-100 disabled:opacity-60"
            >
              Consider
            </button>
            <button
              type="button"
              onClick={() => submit('contracted')}
              disabled={pending}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-md border border-success-300/60 bg-cream px-2.5 py-1 text-[11px] font-medium text-success-800 transition-colors hover:bg-success-100 disabled:opacity-60"
            >
              <BookmarkCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
              Lock too
            </button>
          </div>
        ) : mode === 'added' ? (
          <p className="flex items-center gap-1 pt-0.5 text-[11px] text-success-800">
            <Check aria-hidden className="h-3 w-3" strokeWidth={2} />
            Added — find them in this card.
          </p>
        ) : mode === 'locked' ? (
          <p className="flex items-center gap-1 pt-0.5 text-[11px] text-success-800">
            <BookmarkCheck aria-hidden className="h-3 w-3" strokeWidth={2} />
            Locked.
          </p>
        ) : (
          <p className="flex items-center gap-1 pt-0.5 text-[11px] text-danger-800">
            <AlertCircle aria-hidden className="h-3 w-3" strokeWidth={2} />
            {errorMsg ?? 'Something went wrong.'}
          </p>
        )}
      </div>
    </div>
  );
}
