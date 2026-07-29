'use client';

/**
 * QuoteFillRow — "act first, adjust after"
 * (`Explore_Integration_BUILD_SPEC_2026-07-29.md` §4).
 *
 * REPLACES `build-3state-control.tsx` (deleted). That surface asked the couple to
 * learn a vocabulary — Lock / Auto / Hidden, three glyphs per row, on rows whose
 * top half ("YOUR ANCHORS") was wired to nothing (spec §1). This is ONE
 * context-aware row inside "Your team": no card, no title, no state names. It
 * speaks in vendors and pesos, which the couple already understands.
 *
 * Four states, and NOTHING ELSE renders:
 *   0 fillable → `null`. Today's worst screen — "No quoted services yet" sitting
 *     under a Lock/Auto/Hidden legend — simply stops existing. The road to quotes
 *     is the bench's Inquire, already signposted by "Still needs your decision"
 *     right below.
 *   1 fillable → names the quote and offers "＋ Add to your build".
 *   2+        → "Fill your build from your quotes".
 *   after a run → what was added, plus the relocated `FallbackPanel` for anything
 *     that didn't fit the budget.
 *
 * ADJUST-AFTER NEEDS ZERO NEW UI, which is why there is no Lock control here:
 * keep = the per-row Lock ✓ above (`AccordionLockButton`) · remove = the ✕
 * (`removeBuildPick`) · swap = the "Still needs your decision" doorway onto the
 * bench · bulk undo = "Clear candidates". Nothing this row does is a lock, and
 * nothing it does is irreversible.
 *
 * `FallbackPanel` + the `TaxonomyRow` / `QuotedOption` types are RELOCATED
 * VERBATIM from `build-3state-control.tsx` (spec §7) — same marketplace widen,
 * same tap-to-add, same hidden compat ordering.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronDown,
  Loader2,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import { proposeBuildFromQuotes } from '../build-3state-actions';
import {
  findBuildFallbackSuggestions,
  type BuildFallbackSuggestion,
} from '../build-3state-fallback-actions';
import { attachMarketplaceVendorToCategory } from '../actions';
import { useSaveLoader } from '@/components/sd-loader';

/** The "show 5 more" page step for the marketplace fallback list. */
const FALLBACK_EXPAND_STEP = 5;

/** One quoted vendor option for a category. Relocated from the deleted grid. */
export type QuotedOption = { vendorId: string; name: string; pricePhp: number | null };

// (`TaxonomyRow` — the grid's per-row shape, carrying `state` + `pinnedVendorId`
// — is NOT carried over despite spec §7 listing it beside `QuotedOption`. Its
// two fields only existed to drive the tri-state control, and `FillableCategory`
// below is the shape this surface actually needs. Nothing imported it.)

const peso = (php: number | null) =>
  php == null ? '—' : `₱${Math.round(php).toLocaleString('en-PH')}`;

/**
 * A category this row can fill — resolved on the SERVER (`page.tsx`) against the
 * same five conditions `proposeBuildFromQuotes` re-checks before it writes, so
 * the sentence the couple reads and the build they get can't disagree.
 */
export type FillableCategory = {
  groupId: string;
  label: string;
  options: QuotedOption[];
};

export function QuoteFillRow({
  eventId,
  fillable,
  budgetPhp,
}: {
  eventId: string;
  fillable: ReadonlyArray<FillableCategory>;
  /** The couple's budget target, whole PHP. Null = none set. */
  budgetPhp: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    filled: number;
    unfilled: { groupId: string; label: string }[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = useSaveLoader();

  function run() {
    setErr(null);
    startTransition(async () => {
      const res = await save.run(() => proposeBuildFromQuotes({ eventId }), { hint: 'Saving' });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setResult({ filled: res.filled, unfilled: res.unfilled });
      router.refresh();
    });
  }

  // ── After a run ────────────────────────────────────────────────────────────
  // Reported before the empty check, so the outcome survives the re-render that
  // empties `fillable` (the picks it just made are exactly what disqualifies
  // those categories from being fillable again).
  if (result) {
    return (
      <div className="space-y-2.5 rounded-xl border border-ink/10 bg-cream px-4 py-3">
        <p className="text-sm text-ink/80">
          {result.filled > 0
            ? `Added ${result.filled} pick${result.filled === 1 ? '' : 's'} to your build.`
            : 'Nothing could be added from your quotes yet.'}
        </p>
        {result.unfilled.length > 0 ? (
          <>
            <p className="text-xs text-ink/55">
              {budgetPhp != null
                ? `Couldn’t fit ${result.unfilled.map((u) => u.label).join(', ')} within your ${peso(budgetPhp)} budget:`
                : `Couldn’t fill ${result.unfilled.map((u) => u.label).join(', ')} from your quotes:`}
            </p>
            {result.unfilled.map((u) => (
              <FallbackPanel key={u.groupId} eventId={eventId} group={u} />
            ))}
          </>
        ) : null}
        {err ? <p className="text-xs text-danger-700">{err}</p> : null}
      </div>
    );
  }

  // ── 0 fillable → NOTHING. Not an empty state, not a legend: nothing. ───────
  if (fillable.length === 0) return null;

  const single = fillable.length === 1 ? fillable[0]! : null;
  // The quote this row would actually add: the best-priced one (an unpriced
  // quote sorts last so it's never presented as "the" price).
  const bestQuote = single
    ? [...single.options].sort(
        (a, b) =>
          (a.pricePhp ?? Number.POSITIVE_INFINITY) - (b.pricePhp ?? Number.POSITIVE_INFINITY),
      )[0]
    : null;

  return (
    <div className="space-y-1.5 rounded-xl border border-terracotta/25 bg-terracotta/[0.04] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 text-sm text-ink/80">
          <Sparkles
            className="mr-1.5 inline h-3.5 w-3.5 shrink-0 text-terracotta"
            strokeWidth={1.9}
            aria-hidden
          />
          {single && bestQuote ? (
            <>
              {/* The spec's sentence, with the count kept HONEST when the one
                  fillable category happens to hold more than one quote. */}
              {single.options.length} quote{single.options.length === 1 ? ' is' : 's are'} in —{' '}
              <span className="font-medium text-ink">{bestQuote.name}</span> for {single.label}
              {bestQuote.pricePhp != null ? `, ${peso(bestQuote.pricePhp)}` : ''}.
            </>
          ) : (
            <>Quotes are in for {fillable.length} categories.</>
          )}
        </p>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {single ? '＋ Add to your build' : 'Fill your build from your quotes'}
        </button>
      </div>

      {/* Only the multi-category call to action needs explaining — the single
          one already names the vendor, the category and the price. */}
      {!single ? (
        <p className="text-xs text-ink/55">
          {budgetPhp != null ? (
            <>
              Adds the best-priced quotes that fit — nothing is locked, and you can swap or remove
              any of them.
            </>
          ) : (
            <>
              No budget set — we’ll suggest the cheapest quote for each.{' '}
              {/* The budget page is the CANONICAL editor. Never re-declare it inline. */}
              <Link
                href={`/dashboard/${eventId}/budget`}
                className="font-medium text-terracotta underline-offset-2 hover:underline"
              >
                Set a budget
              </Link>
            </>
          )}
        </p>
      ) : null}

      {err ? <p className="text-xs text-danger-700">{err}</p> : null}
    </div>
  );
}

/**
 * Marketplace fallback for ONE unfilled category — the couple taps "Find more
 * options" to widen past their own quotes into the marketplace. Suggestions are
 * ordered by a HIDDEN compatibility % (never shown) and are TAP-TO-ADD: nothing
 * is auto-added or auto-charged.
 *
 * RELOCATED VERBATIM 2026-07-29 from `build-3state-control.tsx` (spec §7) — the
 * grid died, this did not.
 */
function FallbackPanel({
  eventId,
  group,
}: {
  eventId: string;
  group: { groupId: string; label: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [opened, setOpened] = useState(false);
  const [suggestions, setSuggestions] = useState<BuildFallbackSuggestion[]>([]);
  const [total, setTotal] = useState(0);
  const [hasCoords, setHasCoords] = useState(false);
  const [limit, setLimit] = useState(10);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = useSaveLoader();

  function load(nextLimit: number) {
    setErr(null);
    startTransition(async () => {
      const res = await findBuildFallbackSuggestions({
        eventId,
        groupId: group.groupId,
        limit: nextLimit,
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setOpened(true);
      setSuggestions(res.suggestions);
      setTotal(res.total);
      setHasCoords(res.hasReceptionCoords);
      setLimit(nextLimit);
    });
  }

  function add(vendorProfileId: string) {
    if (added.has(vendorProfileId) || addingId) return;
    setAddingId(vendorProfileId);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('event_id', eventId);
      fd.set('marketplace_vendor_id', vendorProfileId);
      // The group id doubles as the category — attachMarketplaceVendorToCategory
      // validates it (rejects a non-leaf) so we can never mis-categorize.
      fd.set('category', group.groupId);
      const res = await save.run(() => attachMarketplaceVendorToCategory(fd), { hint: 'Saving' });
      setAddingId(null);
      if (res.status === 'ok' || res.status === 'already_attached') {
        setAdded((prev) => new Set(prev).add(vendorProfileId));
        router.refresh();
      } else {
        setErr('Could not add that vendor — try another.');
      }
    });
  }

  const canExpand = opened && suggestions.length < total;

  return (
    <div className="rounded-xl border border-ink/10 bg-paper px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-ink/75">{group.label}</span>
        {!opened ? (
          <button
            type="button"
            onClick={() => load(10)}
            disabled={pending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/[0.03] disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Search className="h-3 w-3" strokeWidth={2} aria-hidden />
            )}
            Find more options
          </button>
        ) : null}
      </div>

      {opened && suggestions.length === 0 && !pending ? (
        <p className="mt-2 text-[11px] italic text-ink/50">
          No other vendors found for this category right now.
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="mt-2.5 space-y-1 border-t border-ink/8 pt-2.5">
          {suggestions.map((s) => {
            const isAdded = s.alreadyAdded || added.has(s.vendorProfileId);
            return (
              <li key={s.vendorProfileId}>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/12 bg-cream px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">{s.name}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink/55">
                      {s.city ? <span className="truncate">{s.city}</span> : null}
                      {hasCoords && s.distanceKm != null ? (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
                          {Math.round(s.distanceKm)} km
                        </span>
                      ) : null}
                      {s.rating != null && s.reviewCount ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />
                          {s.rating.toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => add(s.vendorProfileId)}
                    disabled={isAdded || addingId === s.vendorProfileId}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                      isAdded
                        ? 'border-mulberry/40 bg-mulberry/10 text-mulberry'
                        : 'border-ink/15 text-ink/70 hover:bg-ink/[0.03]'
                    }`}
                  >
                    {addingId === s.vendorProfileId ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : isAdded ? (
                      <Check className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    ) : (
                      <Plus className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                    )}
                    {isAdded ? 'Added' : 'Add'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {canExpand ? (
        <button
          type="button"
          onClick={() => load(limit + FALLBACK_EXPAND_STEP)}
          disabled={pending}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink/60 hover:text-ink/80 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <ChevronDown className="h-3 w-3" strokeWidth={2} aria-hidden />
          )}
          Show {FALLBACK_EXPAND_STEP} more
        </button>
      ) : null}

      {err ? <p className="mt-1.5 text-[11px] text-terracotta">{err}</p> : null}
    </div>
  );
}
