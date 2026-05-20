'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Search, Plus, Check, X, AlertCircle } from 'lucide-react';
import { addCustomVendor } from '../vendors/actions';

type Props = {
  eventId: string;
  /** Category we tag the inline-added vendor with. The planner card picks
   *  the first entry from the group (the most representative). */
  defaultCategory: string;
  /** Marketplace URL for the Search button. */
  searchHref: string;
  /** Lowercased group label, used in the input placeholder ("Vendor for catering"). */
  groupLabel: string;
};

type Mode = 'idle' | 'adding' | 'added';

export function PlanCardCTAs({
  eventId,
  defaultCategory,
  searchHref,
  groupLabel,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Soft auto-collapse the "Added" terminal state back to idle so the
  // couple can keep stacking custom vendors into the same group without
  // a hard reset. Long enough to register the success, short enough to
  // not block the next click.
  useEffect(() => {
    if (mode !== 'added') return;
    const t = setTimeout(() => setMode('idle'), 1600);
    return () => clearTimeout(t);
  }, [mode]);

  if (mode === 'added') {
    return (
      <div className="mt-auto">
        <span
          role="status"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-300/60 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900"
        >
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Added to plan
        </span>
      </div>
    );
  }

  if (mode === 'adding') {
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
        <input
          name="vendor_name"
          required
          maxLength={128}
          autoFocus
          disabled={pending}
          placeholder={`Vendor name for ${groupLabel.toLowerCase()}`}
          className="rounded-md border border-ink/15 bg-cream px-2.5 py-1.5 text-xs text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60"
        />
        <div className="flex gap-1.5">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-terracotta/40 bg-terracotta/10 px-3 py-1.5 text-xs font-medium text-terracotta transition-colors hover:bg-terracotta/15 disabled:cursor-default disabled:opacity-60"
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
            className="inline-flex items-center justify-center rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-xs font-medium text-ink/65 transition-colors hover:text-ink disabled:opacity-60"
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

  return (
    <div className="mt-auto flex items-stretch gap-2">
      <Link
        href={searchHref}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta"
      >
        <Search aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Search
      </Link>
      <button
        type="button"
        onClick={() => setMode('adding')}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/80 transition-colors hover:border-terracotta/50 hover:text-terracotta"
      >
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Add
      </button>
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
      <path
        d="M21 12a9 9 0 0 1-9 9"
        strokeLinecap="round"
      />
    </svg>
  );
}
