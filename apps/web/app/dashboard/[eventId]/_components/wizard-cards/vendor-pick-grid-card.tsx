'use client';

/**
 * Concierge Active Wizard · VISUAL grid vendor-pick primitive.
 *
 * Iteration 0016 · 2026-05-24 owner directive: Card 02 Reception Venue
 * needs to be more visual — venue photos, Setnayan Statement if certified,
 * city, star rating, review count, search bar (hits the full vendor DB
 * on submit), and PAGINATION (3 cols × 5 rows = 15 per page) so the card
 * doesn't extend to 200+ entries.
 *
 * Co-exists with the legacy list-style VendorPickCard. Card 02 swaps to
 * this primitive first; other vendor-pick cards (03/04/05/07/08/10/12/13/
 * 18/19/22/23/24) stay on VendorPickCard until owner asks to migrate.
 *
 * UX shape:
 *   ┌──────────────────────────────────────┐
 *   │ [🔍 Search venues by name or city…]  │  ← submit hits server action
 *   ├──────────────────────────────────────┤
 *   │ ┌──────┐ ┌──────┐ ┌──────┐           │
 *   │ │photo │ │photo │ │photo │           │
 *   │ │ ✓ Setn.   ✓ Setn.    ✓ Setn.       │
 *   │ │ Name  │ │ Name  │ │ Name  │        │
 *   │ │ City  │ │ City  │ │ City  │        │
 *   │ │ ★4.8 (124)                          │
 *   │ │ [Lock]│ │ [Lock]│ │ [Lock]│        │
 *   │ └──────┘ └──────┘ └──────┘           │
 *   │  ...4 more rows (15/page)             │
 *   ├──────────────────────────────────────┤
 *   │ [← Prev]  Page 2 of 8  [Next →]      │
 *   ├──────────────────────────────────────┤
 *   │ [+ Booked elsewhere? Add custom]     │
 *   └──────────────────────────────────────┘
 *
 * Hard constraints per [[feedback_setnayan_concierge_wizard_ux]]:
 *   - NO LINKS inside the wizard card · all completion stays inline
 *   - Each [Lock] button submits to completeVendorPickFromMarketplace
 *     · server action calls revalidatePath which transitions the card
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] · all copy is
 * curated brand voice · empty / loading / no-search-results states all
 * read as polite editorial copy.
 */

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  MapPin,
  Plus,
  Search,
  Star,
  X,
} from 'lucide-react';
import type { WizardTaskId } from '@/lib/wizard';
import type { WizardVendorRec } from '@/lib/wizard-recommendations';
import {
  completeVendorPickFromMarketplace,
  completeVendorPickFromCustom,
  searchVendorRecommendations,
} from '../../wizard-actions';

const PAGE_SIZE = 15;

type Props = {
  eventId: string;
  taskId: WizardTaskId;
  /** Top-N recommendations pre-fetched server-side. The grid renders
   *  these immediately; submitting the search bar replaces them via
   *  searchVendorRecommendations. */
  initialRecommendations: ReadonlyArray<WizardVendorRec>;
  /** Server-action args passed back when the host hits Search · we
   *  need the same compatibility filters so search results stay scoped
   *  to the event's ceremony_type + venue_setting + already-locked
   *  exclusions. */
  searchContext: {
    canonicalServices: ReadonlyArray<string>;
    ceremonyType: string | null;
    venueSetting: string | null;
    excludeVendorIds: ReadonlyArray<string>;
  };
  /** Per-card customization — drives search placeholder + custom-add
   *  toggle copy + empty-state line. Reception venue passes
   *  category='venue' which renders "venues" in copy; other cards can
   *  reuse this primitive with category='photographer' etc. */
  copy: {
    /** Plural noun for the entity being picked · 'venues' / 'caterers'. */
    pluralNoun: string;
    /** Toggle label for the custom-vendor disclosure. */
    customAddLabel: string;
    /** Hint shown when no recommendations exist for the event's filters. */
    emptyStateCopy: string;
  };
};

export function VendorPickGridCard({
  eventId,
  taskId,
  initialRecommendations,
  searchContext,
  copy,
}: Props) {
  /* ─────────────────────────────  state  ───────────────────────────── */

  // Live recommendation set · starts with the server-rendered top-N,
  // gets replaced by search-action results when the host submits a
  // query. The search bar updates this in place without a full RSC
  // re-render so the grid stays responsive on every keystroke (only
  // submit triggers a DB hit · pure UX-cost discipline).
  const [results, setResults] = useState<ReadonlyArray<WizardVendorRec>>(
    initialRecommendations,
  );
  // Search input current value · controlled. Active query (when set)
  // displays a chip + Clear button so the host can reset to the
  // recommendations without retyping.
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [isSearching, startSearchTransition] = useTransition();
  const [searchError, setSearchError] = useState<string | null>(null);

  // Pagination · client-side · resets to page 0 whenever results change.
  const [pageIndex, setPageIndex] = useState(0);

  // Lock-vendor + custom-add state · same pattern as VendorPickCard so
  // host behavior is consistent across both primitives.
  const [showCustom, setShowCustom] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingVendorId, setPendingVendorId] = useState<string | null>(null);
  const [, startLockTransition] = useTransition();

  /* ───────────────────  pagination derivation  ────────────────────── */

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pageStart = safePageIndex * PAGE_SIZE;
  const visible = useMemo(
    () => results.slice(pageStart, pageStart + PAGE_SIZE),
    [results, pageStart],
  );

  /* ───────────────────  search submit handler  ────────────────────── */

  function handleSearchSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const trimmed = searchInput.trim();
    setSearchError(null);
    startSearchTransition(async () => {
      try {
        const rows = await searchVendorRecommendations({
          eventId,
          canonicalServices: searchContext.canonicalServices,
          ceremonyType: searchContext.ceremonyType,
          venueSetting: searchContext.venueSetting,
          excludeVendorIds: searchContext.excludeVendorIds,
          query: trimmed,
          limit: 100,
        });
        setResults(rows);
        setActiveQuery(trimmed.length > 0 ? trimmed : null);
        setPageIndex(0);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Search didn't come back — try again.";
        setSearchError(message);
      }
    });
  }

  function clearSearch() {
    setSearchInput('');
    setActiveQuery(null);
    setResults(initialRecommendations);
    setPageIndex(0);
    setSearchError(null);
  }

  /* ──────────────────────  lock handlers  ─────────────────────────── */

  function handleLockMarketplace(rec: WizardVendorRec) {
    setErrorMessage(null);
    setPendingVendorId(rec.vendor_profile_id);

    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', taskId);
    formData.set('marketplace_vendor_id', rec.vendor_profile_id);
    formData.set('vendor_name', rec.business_name);

    startLockTransition(async () => {
      try {
        await completeVendorPickFromMarketplace(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't lock this pick. Try again or add manually below.";
        setErrorMessage(message);
        setPendingVendorId(null);
      }
    });
  }

  /* ─────────────────────────  render  ──────────────────────────────── */

  return (
    <div className="space-y-5">
      {/* Search bar — submit on Enter or click · hits the full DB via
          searchVendorRecommendations(). Active-query chip shows when a
          search is in effect so the host can clear back to recs. */}
      <form
        onSubmit={handleSearchSubmit}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45"
            strokeWidth={2}
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={`Search ${copy.pluralNoun} by name or city…`}
            maxLength={64}
            className="w-full rounded-lg border border-ink/15 bg-white py-2.5 pl-9 pr-3 text-sm placeholder-ink/40 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching}
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* Active-search chip · shows the query + a Clear button to reset
          to recommendations. Cleaner than hiding the search box. */}
      {activeQuery ? (
        <div className="flex items-center gap-2 rounded-lg bg-cream/60 px-3 py-2 text-xs text-ink/70">
          <span>
            Showing matches for <strong className="font-medium text-ink">{activeQuery}</strong>
            {' · '}
            {results.length} {results.length === 1 ? 'match' : 'matches'}
          </span>
          <button
            type="button"
            onClick={clearSearch}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-terracotta transition-colors hover:text-terracotta-700"
          >
            <X aria-hidden className="h-3 w-3" strokeWidth={2.5} />
            Clear
          </button>
        </div>
      ) : null}

      {searchError ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {searchError}
        </p>
      ) : null}

      {/* Grid · 1 col mobile · 2 col sm · 3 col lg. Cards have constant
          aspect ratio on the photo so each row stays even-height. */}
      {visible.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((rec) => (
            <VendorGridCardRow
              key={rec.vendor_profile_id}
              rec={rec}
              isPending={pendingVendorId === rec.vendor_profile_id}
              onLock={() => handleLockMarketplace(rec)}
            />
          ))}
        </ul>
      ) : activeQuery ? (
        <p className="rounded-xl border border-dashed border-ink/15 bg-white/40 px-4 py-6 text-center text-sm leading-relaxed text-ink/70">
          No {copy.pluralNoun} matched <strong className="font-medium text-ink">{activeQuery}</strong>.
          Try a different name or area — or add yours below.
        </p>
      ) : (
        <p className="rounded-xl border border-dashed border-ink/15 bg-white/40 px-4 py-6 text-sm leading-relaxed text-ink/70">
          {copy.emptyStateCopy}
        </p>
      )}

      {/* Pagination · only when more than 1 page. Page 1 of N display.
          Buttons stay 44px tap targets for thumb-zone reach. */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-cream/40 px-3 py-2">
          <button
            type="button"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={safePageIndex === 0}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Prev
          </button>
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
            Page {safePageIndex + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePageIndex >= totalPages - 1}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      {/* Custom-vendor disclosure — same pattern + same server action
          as VendorPickCard so manual entry stays consistent. */}
      <div className="border-t border-ink/10 pt-4">
        {!showCustom ? (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-ink/70 transition-colors hover:text-ink"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            {copy.customAddLabel}
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

/* ───────────────────────────────────────────────────────────────────────
 * Single grid card · photo + Setnayan Statement (if verified) + name +
 * city + star/reviews + Lock button.
 *
 * Photo source ladder:
 *   1. primary_photo_url (vendor_services.primary_photo_r2_key resolved)
 *   2. logo_url (vendor_profiles.logo_url)
 *   3. monogram initial on tinted background
 * ──────────────────────────────────────────────────────────────────── */

function VendorGridCardRow({
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
  const isCertified = rec.verification_state === 'verified';
  const photoUrl = rec.primary_photo_url ?? rec.logo_url ?? null;

  return (
    <li className="group flex flex-col overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Photo · 4:3 aspect so each row stays even-height. Verified
          badge overlays top-right when applicable. */}
      <div className="relative aspect-[4/3] w-full bg-terracotta/8">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-display text-5xl italic text-terracotta/40">
            {rec.business_name.charAt(0).toUpperCase()}
          </span>
        )}
        {isCertified ? (
          <span
            title="Documents reviewed and approved by Setnayan."
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-700/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-cream shadow-sm backdrop-blur-sm"
          >
            <svg
              aria-hidden
              viewBox="0 0 12 12"
              className="h-3 w-3 fill-current"
            >
              <path d="M10.28 3.22a.75.75 0 010 1.06L5.06 9.5a.75.75 0 01-1.06 0L1.72 7.22a.75.75 0 011.06-1.06l1.75 1.75 4.69-4.69a.75.75 0 011.06 0z" />
            </svg>
            Setnayan Verified
          </span>
        ) : null}
      </div>

      {/* Body · name + city + rating + Lock CTA. */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-1 text-sm font-semibold leading-tight text-ink sm:text-base">
          {rec.business_name}
        </p>

        {/* Setnayan Statement · only when verified · short brand-voice
            line that explains what the verification means. */}
        {isCertified ? (
          <p className="text-[11px] leading-snug text-emerald-800/85">
            Documents reviewed by Setnayan.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/60">
          {rec.location_city ? (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden className="h-3 w-3" strokeWidth={2} />
              {rec.location_city}
            </span>
          ) : null}
          {ratingDisplay ? (
            <span className="inline-flex items-center gap-1">
              <Star
                aria-hidden
                className="h-3 w-3 fill-current text-amber-500"
                strokeWidth={1.5}
              />
              <strong className="font-medium text-ink/85">{ratingDisplay}</strong>
              <span className="text-ink/45">
                ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
              </span>
            </span>
          ) : (
            <span className="text-ink/40">No reviews yet</span>
          )}
        </div>

        <button
          type="button"
          onClick={onLock}
          disabled={isPending}
          className="mt-auto inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-terracotta px-3 py-2 text-xs font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
        >
          {isPending ? (
            'Locking…'
          ) : (
            <>
              <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Lock this pick
            </>
          )}
        </button>
      </div>
    </li>
  );
}

/* ───────────────────────────────────────────────────────────────────────
 * Inline custom vendor form · copy-equivalent to the one in
 * vendor-pick-card.tsx. Kept here (vs imported) so the grid primitive
 * is self-contained and easy to evolve independently.
 * ──────────────────────────────────────────────────────────────────── */

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
          htmlFor="grid-custom-vendor-name"
          className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
        >
          Vendor name <span className="text-rose-700">*</span>
        </label>
        <input
          id="grid-custom-vendor-name"
          type="text"
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          required
          maxLength={128}
          placeholder="e.g. Casa Manila Garden Pavilion"
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="grid-custom-vendor-phone"
            className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
          >
            Phone (optional)
          </label>
          <input
            id="grid-custom-vendor-phone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="0917…"
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
        </div>
        <div>
          <label
            htmlFor="grid-custom-vendor-email"
            className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
          >
            Email (optional)
          </label>
          <input
            id="grid-custom-vendor-email"
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
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
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
