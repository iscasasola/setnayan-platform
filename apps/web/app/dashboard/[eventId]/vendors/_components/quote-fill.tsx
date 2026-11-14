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
import { Check, ChevronDown, MapPin, Plus, Search, Sparkles, Star } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
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
    });
  }

  // ── After a run ────────────────────────────────────────────────────────────
  // Reported before the empty check, so the outcome survives the re-render that
  // empties `fillable` (the picks it just made are exactly what disqualifies
  // those categories from being fillable again).
  if (result) {
    return (
      <div className="space-y-2.5 py-1" data-quote-fill="result">
        <p className="text-[15px] font-semibold text-ink">
          {result.filled > 0
            ? `Added ${result.filled} pick${result.filled === 1 ? '' : 's'} to your build.`
            : 'Nothing could be added from your quotes yet.'}
        </p>
        {result.unfilled.length > 0 ? (
          <>
            <p className="text-[13px] text-ink/70">
              {budgetPhp != null
                ? `Couldn’t fit ${result.unfilled.map((u) => u.label).join(', ')} within your ${peso(budgetPhp)} budget:`
                : `Couldn’t fill ${result.unfilled.map((u) => u.label).join(', ')} from your quotes:`}
            </p>
            {result.unfilled.map((u) => (
              <FallbackPanel key={u.groupId} eventId={eventId} group={u} />
            ))}
          </>
        ) : null}
        {err ? <p role="alert" className="text-[13px] font-semibold text-danger-700">{err}</p> : null}
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
    // 📐 The one next thing on the screen — the only block here that may wear a frame (design template rule 2).
    <div className="space-y-1.5 rounded-2xl bg-[var(--m-paper-2)] px-4 py-3" data-quote-fill="next">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 text-[15px] text-ink">
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
        <ActionButton
          tone="brand"
          main
          icon={Plus}
          label={pending ? 'Adding…' : single ? 'Add to your build' : 'Fill your build from your quotes'}
          onClick={run}
          disabled={pending}
        />
      </div>

      {/* Only the multi-category call to action needs explaining — the single
          one already names the vendor, the category and the price. */}
      {!single ? (
        <p className="text-[13px] text-ink/70">
          {budgetPhp != null ? (
            <>
              Adds the best-priced quotes that fit — nothing is booked, and you can swap or remove
              any of them.
            </>
          ) : (
            <>
              No budget set — we’ll suggest the cheapest quote for each.{' '}
              {/* The budget page is the CANONICAL editor. Never re-declare it inline. */}
              <Link
                href={`/dashboard/${eventId}/budget`}
                className="font-medium text-terracotta-700 underline-offset-2 hover:underline"
              >
                Set a budget
              </Link>
            </>
          )}
        </p>
      ) : null}

      {err ? <p role="alert" className="text-[13px] font-semibold text-danger-700">{err}</p> : null}
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
      } else {
        setErr('Could not add that supplier — try another.');
      }
    });
  }

  const canExpand = opened && suggestions.length < total;

  return (
    <div className="border-t border-ink/10 py-2.5" data-quote-fill="fallback">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <span className="truncate text-[15px] font-semibold text-ink">{group.label}</span>
        {!opened ? (
          <ActionButton
            tone="info"
            icon={Search}
            label={pending ? 'Finding…' : 'Find more options'}
            onClick={() => load(10)}
            disabled={pending}
          />
        ) : null}
      </div>

      {opened && suggestions.length === 0 && !pending ? (
        <p className="mt-1 text-[14px] text-ink/70">No other suppliers found for this category right now.</p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="mt-1 divide-y divide-ink/10">
          {suggestions.map((s) => {
            const isAdded = s.alreadyAdded || added.has(s.vendorProfileId);
            return (
              <li key={s.vendorProfileId} className="flex min-h-[56px] items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold text-ink">{s.name}</div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink/70">
                    {s.city ? <span className="truncate">{s.city}</span> : null}
                    {hasCoords && s.distanceKm != null ? (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" strokeWidth={2} aria-hidden />
                        {Math.round(s.distanceKm)} km
                      </span>
                    ) : null}
                    {s.rating != null && s.reviewCount ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="h-3 w-3" strokeWidth={2} aria-hidden />
                        {s.rating.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <ActionButton
                  tone={isAdded ? 'ok' : 'neutral'}
                  icon={isAdded ? Check : Plus}
                  label={addingId === s.vendorProfileId ? 'Adding…' : isAdded ? 'Added' : 'Add'}
                  name={isAdded ? `${s.name} added` : `Add ${s.name}`}
                  onClick={() => add(s.vendorProfileId)}
                  disabled={isAdded || addingId === s.vendorProfileId}
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      {canExpand ? (
        <ActionButton
          tone="neutral"
          quiet
          icon={ChevronDown}
          label={pending ? 'Loading…' : `Show ${FALLBACK_EXPAND_STEP} more`}
          onClick={() => load(limit + FALLBACK_EXPAND_STEP)}
          disabled={pending}
          className="mt-2"
        />
      ) : null}

      {err ? <p role="alert" className="mt-1.5 text-[13px] font-semibold text-danger-700">{err}</p> : null}
    </div>
  );
}
