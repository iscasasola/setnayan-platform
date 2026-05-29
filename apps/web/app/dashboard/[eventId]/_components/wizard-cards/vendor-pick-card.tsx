'use client';

/**
 * Concierge Active Wizard · reusable VendorPickCard primitive.
 *
 * Phase 2 of iteration 0016. Drives every wizard vendor-pick card (Reception
 * venue · Ceremony venue · Officiant · Photo+Video · Caterer · Stylist ·
 * Lights+Sound · Music · Host · Cake · Florist · Bridal car · Accommodation ·
 * HMUA · Bridal Gown · Groom Suit · etc.). Card 06 Prenup is the only
 * Foundation card that does NOT use this primitive — it's an external_process
 * card with a separate shape.
 *
 * Owner-locked UX per [[feedback_setnayan_concierge_wizard_ux]]:
 *   - Top 5 recommendations shown by default
 *   - [VIEW MORE] expands inline up to 15 total (NO LINKS · no navigation out)
 *   - Each row has a [Lock this vendor] form-button
 *   - Below the recommendation list, an [Add custom vendor] toggle reveals
 *     an inline form for off-platform vendors the host wants to lock
 *
 * Hard constraint (CLAUDE.md 2026-05-23 Sixth row): "each focus card is not
 * a link but an actual card to complete the process." Both [Lock this vendor]
 * and the custom-vendor form submit to server actions that advance
 * wizard_state in-place — no navigation, the WizardHero re-renders with the
 * next task after revalidatePath.
 */

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { Lock, Plus, Star, ChevronDown } from 'lucide-react';
import type { WizardTaskId } from '@/lib/wizard';
import type { WizardVendorRec } from '@/lib/wizard-recommendations';
import {
  completeVendorPickFromMarketplace,
  completeVendorPickFromCustom,
} from '../../wizard-actions';

type Props = {
  eventId: string;
  taskId: WizardTaskId;
  /** Top-N recommendations pre-fetched server-side. Empty array is
   *  acceptable · falls back to the [Add custom vendor] form alone with
   *  a polite empty-state line above it. */
  recommendations: ReadonlyArray<WizardVendorRec>;
  /** How many to show by default before [VIEW MORE]. Defaults to 5. */
  defaultVisible?: number;
  /** Optional copy override for the [Add custom vendor] toggle. Per-card
   *  customization keeps the brand voice card-specific without forcing
   *  the primitive to hardcode every variant. */
  customAddLabel?: string;
  /** Optional polite empty-state copy when recommendations is []. */
  emptyStateCopy?: string;
};

export function VendorPickCard({
  eventId,
  taskId,
  recommendations,
  defaultVisible = 5,
  customAddLabel = 'Have someone else in mind?',
  emptyStateCopy = "We haven't curated picks for your area yet — add your vendor below and we'll lock them into your plan.",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingVendorId, setPendingVendorId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = expanded
    ? recommendations.slice(0, 15)
    : recommendations.slice(0, defaultVisible);
  const moreAvailable =
    !expanded && recommendations.length > defaultVisible;

  function handleLockMarketplace(rec: WizardVendorRec) {
    setErrorMessage(null);
    setPendingVendorId(rec.vendor_profile_id);

    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', taskId);
    formData.set('marketplace_vendor_id', rec.vendor_profile_id);
    formData.set('vendor_name', rec.business_name);

    startTransition(async () => {
      try {
        await completeVendorPickFromMarketplace(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't lock this vendor. Try again or add them manually below.";
        setErrorMessage(message);
        setPendingVendorId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Recommendation list · top-5 default · [VIEW MORE] expands to 15. */}
      {recommendations.length > 0 ? (
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10 bg-white/60">
          {visible.map((rec) => (
            <VendorRecRow
              key={rec.vendor_profile_id}
              rec={rec}
              isPending={pendingVendorId === rec.vendor_profile_id}
              onLock={() => handleLockMarketplace(rec)}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-ink/15 bg-white/40 px-4 py-5 text-sm leading-relaxed text-ink/70">
          {emptyStateCopy}
        </p>
      )}

      {/* [VIEW MORE] · expands inline · no navigation out. */}
      {moreAvailable ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta transition-colors hover:text-terracotta-700"
        >
          <ChevronDown aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          View more · {recommendations.length - defaultVisible} more in your area
        </button>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      {/* [Add custom vendor] · toggle reveals inline form. */}
      <div className="border-t border-ink/10 pt-4">
        {!showCustom ? (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-ink/70 transition-colors hover:text-ink"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            {customAddLabel}
          </button>
        ) : (
          <CustomVendorForm
            eventId={eventId}
            taskId={taskId}
            onCancel={() => setShowCustom(false)}
            onError={(msg) => setErrorMessage(msg)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Single recommendation row · logo + name + tagline + city + rating + count
 * + ad badge (for Setnayan-Pay-enabled vendors). [Lock this vendor] button
 * on the right.
 */
function VendorRecRow({
  rec,
  isPending,
  onLock,
}: {
  rec: WizardVendorRec;
  isPending: boolean;
  onLock: () => void;
}) {
  const ratingDisplay =
    rec.avg_rating_overall && rec.avg_rating_overall > 0
      ? rec.avg_rating_overall.toFixed(1)
      : null;
  const reviewCount = rec.review_count ?? 0;
  const isSetnayanPay = rec.ad_rank !== null && rec.ad_rank > 0;

  return (
    <li className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-cream/40 sm:px-5 sm:py-4">
      {/* Logo · 48px square · falls back to a tinted monogram when missing. */}
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-terracotta/10">
        {rec.logo_url ? (
          <Image
            src={rec.logo_url}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-display text-base italic text-terracotta/70">
            {rec.business_name.charAt(0)}
          </span>
        )}
      </div>

      {/* Name + meta · grows to fill. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-ink sm:text-base">
            {rec.business_name}
          </p>
          {isSetnayanPay ? (
            <span
              title="Setnayan-Pay enabled"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-emerald-800"
            >
              Verified
            </span>
          ) : null}
        </div>
        {rec.tagline ? (
          <p className="mt-0.5 truncate text-xs text-ink/65 sm:text-sm">
            {rec.tagline}
          </p>
        ) : null}
        <div className="mt-1 flex items-center gap-3 text-[11px] text-ink/55">
          {rec.location_city ? <span>{rec.location_city}</span> : null}
          {ratingDisplay ? (
            <span className="inline-flex items-center gap-0.5">
              <Star
                aria-hidden
                className="h-3 w-3 fill-current text-amber-500"
                strokeWidth={1.5}
              />
              {ratingDisplay}
              {reviewCount > 0 ? (
                <span className="ml-0.5 text-ink/45">({reviewCount})</span>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>

      {/* [Lock this vendor] — primary CTA per row. */}
      <button
        type="button"
        onClick={onLock}
        disabled={isPending}
        className="inline-flex min-h-[44px] flex-shrink-0 items-center justify-center gap-1.5 rounded-lg border border-mulberry bg-mulberry px-3 py-2 text-xs font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
      >
        {isPending ? (
          'Locking…'
        ) : (
          <>
            <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Lock
          </>
        )}
      </button>
    </li>
  );
}

/**
 * Inline custom vendor form · captures vendor_name + optional phone/email.
 * Submits to completeVendorPickFromCustom. Cancel reverts the disclosure.
 */
function CustomVendorForm({
  eventId,
  taskId,
  onCancel,
  onError,
}: {
  eventId: string;
  taskId: WizardTaskId;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [vendorName, setVendorName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (vendorName.trim().length === 0) {
      onError('Vendor name is required.');
      return;
    }
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', taskId);
    formData.set('vendor_name', vendorName);
    if (contactPhone.trim()) formData.set('contact_phone', contactPhone);
    if (contactEmail.trim()) formData.set('contact_email', contactEmail);

    startTransition(async () => {
      try {
        await completeVendorPickFromCustom(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't save your vendor. Try again.";
        onError(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-cream/60 p-4">
      <div>
        <label
          htmlFor="custom-vendor-name"
          className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
        >
          Vendor name <span className="text-rose-700">*</span>
        </label>
        <input
          id="custom-vendor-name"
          type="text"
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          required
          maxLength={128}
          placeholder="e.g. Tita Cora's Lechon"
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="custom-vendor-phone"
            className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
          >
            Phone (optional)
          </label>
          <input
            id="custom-vendor-phone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="0917…"
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
        </div>
        <div>
          <label
            htmlFor="custom-vendor-email"
            className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
          >
            Email (optional)
          </label>
          <input
            id="custom-vendor-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="hello@…"
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-mulberry px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {isPending ? 'Locking…' : 'Lock this vendor'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="text-sm text-ink/55 transition-colors hover:text-ink disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
