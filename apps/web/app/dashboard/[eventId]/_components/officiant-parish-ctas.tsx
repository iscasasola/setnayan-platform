'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Check,
  Church,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { addCustomVendor } from '../vendors/actions';

/**
 * Officiant card — parish-aware CTAs.
 *
 * Owner directive 2026-05-22 (verbatim):
 *   "officiant will be listed by the locked ceremony venue then add a
 *    button to search outside of the official ceremony venue to show
 *    other officiants or they can add manually."
 *
 * Filipino weddings typically pull their officiant from the parish (or
 * pastor / minister / imam / judge) where the ceremony happens — so when
 * the host has locked their ceremony venue, the Officiant card surfaces
 * the venue name + a fast "add officiant from parish" affordance + an
 * "outside this parish" search link. When no ceremony venue is locked
 * yet, the card shows a polite "lock venue first" hint with three escape
 * paths so the host can still move forward if they want to book an
 * officiant first.
 *
 * Two states:
 *   • State A (ceremonyVenueName !== null): parish-aware UI
 *   • State B (ceremonyVenueName === null): "lock venue first" UI
 *
 * Per ADAPT-COPY > HIDE-CARD principle (CLAUDE.md 2026-05-22 row § PR
 * #314), the card stays visible across both states; only the affordances
 * change. The host always retains agency to add manually OR search the
 * full marketplace regardless of which state they're in.
 *
 * The inline add-form reuses the same `addCustomVendor` server action +
 * idle/adding/added state machine as PlanCardCTAs — we deliberately
 * don't share the component because the two surfaces want different
 * button placements + State A's "Add from parish" button pre-fills a
 * helper placeholder that the generic Add affordance doesn't.
 */

type Props = {
  eventId: string;
  /** Category tagged on the inline-added vendor. For the Officiant card
   *  this is always 'officiant' but we accept it from the parent for
   *  consistency with PlanCardCTAs's signature. */
  defaultCategory: string;
  /** Marketplace URL — `/vendors?folder=ceremony#officiant`. */
  searchHref: string;
  /**
   * Display name of the host's LOCKED ceremony venue. When set, the
   * card renders State A (parish-aware UI). When null, the card flips
   * to State B ("lock venue first" hint + three escape paths). The
   * presence/absence of the name is the load-bearing signal; the
   * parent computes it from CONFIRMED_VENDOR_STATUSES.
   */
  ceremonyVenueName: string | null;
};

type Mode = 'idle' | 'adding' | 'added';

export function OfficiantParishCTAs({
  eventId,
  defaultCategory,
  searchHref,
  ceremonyVenueName,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Soft auto-collapse the "Added" terminal state — matches
  // PlanCardCTAs's UX exactly so muscle memory carries across cards.
  useEffect(() => {
    if (mode !== 'added') return;
    const t = setTimeout(() => setMode('idle'), 1600);
    return () => clearTimeout(t);
  }, [mode]);

  if (mode === 'added') {
    return (
      <div className="mt-auto">
        {/* HEIGHT · `h-11` (44px) matches every other CTA slot in this
         *  component + the PlanCardCTAs Search/Add row + the
         *  MarketplaceTeaseStrip pills · CLAUDE.md 2026-05-30 owner
         *  directive button-height parity. */}
        <span
          role="status"
          className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 text-xs font-medium text-emerald-900"
        >
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Added to plan
        </span>
      </div>
    );
  }

  if (mode === 'adding') {
    // State A's placeholder is parish-aware so the host can just hit
    // Save without typing — the canonical "Clergy from {parish}" hint
    // is right in the input. They can still edit before saving.
    const placeholder =
      ceremonyVenueName !== null
        ? `Clergy from ${ceremonyVenueName}`
        : 'Officiant name';
    return (
      <form
        className="mt-auto flex flex-col gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const fd = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await addCustomVendor(fd);
            if (result.status === 'ok') {
              setErrorMsg(null);
              setMode('added');
              return;
            }
            if (result.status === 'not_signed_in') {
              const next = encodeURIComponent(
                window.location.pathname + window.location.search,
              );
              window.location.href = `/login?next=${next}`;
              return;
            }
            setErrorMsg(result.message ?? 'Could not add.');
          });
        }}
      >
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="category" value={defaultCategory} />
        {/* INPUT + ACTION ROW · all three controls share `h-11` (44px)
         *  for visual rhyme across the Save/Cancel row. The text input
         *  + Save submit + Cancel X all align on the same baseline.
         *  CLAUDE.md 2026-05-30 button-height parity. */}
        <input
          name="vendor_name"
          required
          maxLength={128}
          autoFocus
          disabled={pending}
          defaultValue={ceremonyVenueName ? `Clergy from ${ceremonyVenueName}` : ''}
          placeholder={placeholder}
          className="h-11 rounded-md border border-ink/15 bg-cream px-2.5 text-xs text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60"
        />
        <div className="flex gap-1.5">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-terracotta/40 bg-terracotta/10 px-3 text-xs font-medium text-terracotta transition-colors hover:bg-terracotta/15 disabled:cursor-default disabled:opacity-60"
          >
            {pending ? (
              <>
                <Spinner />
                Adding…
              </>
            ) : (
              <>
                <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Save
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('idle');
              setErrorMsg(null);
            }}
            disabled={pending}
            aria-label="Cancel"
            className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-cream px-2 text-xs font-medium text-ink/65 transition-colors hover:text-ink disabled:opacity-60"
          >
            <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
        {errorMsg ? (
          <p className="flex items-center gap-1 font-mono text-[10px] text-rose-700">
            <AlertCircle aria-hidden className="h-3 w-3" strokeWidth={2} />
            {errorMsg}
          </p>
        ) : null}
      </form>
    );
  }

  // ── State A — ceremony venue locked ─────────────────────────────
  if (ceremonyVenueName !== null) {
    return (
      <div className="mt-auto space-y-2.5">
        <div className="flex items-start gap-2 rounded-md border border-emerald-300/40 bg-emerald-50/50 px-2.5 py-2">
          <Church
            aria-hidden
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700"
            strokeWidth={1.75}
          />
          <p className="text-[11px] leading-snug text-emerald-900">
            Your officiant typically comes from{' '}
            <strong className="font-semibold">{ceremonyVenueName}</strong>. Ask
            the parish secretary for clergy availability + contact.
          </p>
        </div>
        {/* CTA ROW · both buttons at `h-11` (44px) per CLAUDE.md
         *  2026-05-30 owner button-height parity. Matches the
         *  PlanCardCTAs Search/Add row that this entire component
         *  REPLACES on the Catholic+parish auto-resolve variant. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <button
            type="button"
            onClick={() => setMode('adding')}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/8 px-3 text-xs font-medium text-terracotta transition-colors hover:bg-terracotta/12"
          >
            <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Add officiant from parish
          </button>
          <Link
            href={searchHref}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta"
          >
            <Search aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Search outside this parish
          </Link>
        </div>
      </div>
    );
  }

  // ── State B — ceremony venue NOT locked ─────────────────────────
  return (
    <div className="mt-auto space-y-2.5">
      <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50/60 px-2.5 py-2">
        <AlertCircle
          aria-hidden
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700"
          strokeWidth={2}
        />
        <p className="text-[11px] leading-snug text-amber-900">
          Lock your ceremony venue first — most Filipino couples get their
          officiant from the parish where they&rsquo;re getting married. Once
          locked, we&rsquo;ll suggest officiants from there.
        </p>
      </div>
      {/* THREE-CTA ROW · all three buttons at `h-11` (44px) per
       *  CLAUDE.md 2026-05-30 owner button-height parity. State B
       *  replaces the standard Search/Add row when ceremony venue
       *  isn't locked yet — the three buttons need to look like one
       *  uniform row, not three different sizes. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <Link
          href="#ceremony-venue-card"
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/8 px-3 text-xs font-medium text-terracotta transition-colors hover:bg-terracotta/12"
        >
          <Church aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Lock ceremony venue first
        </Link>
        <Link
          href={searchHref}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta"
        >
          <Search aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Search anyway
        </Link>
        <button
          type="button"
          onClick={() => setMode('adding')}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Add manually
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 1-9 9" strokeLinecap="round" />
    </svg>
  );
}
