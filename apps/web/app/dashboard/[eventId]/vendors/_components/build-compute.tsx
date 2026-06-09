'use client';

/**
 * BuildCompute — the Build tab's "Compute" action (owner 2026-06-09).
 *
 * COMPUTE auto-fills every FLAGGED category with ONE shortlisted service that
 * fits the pinned budget — "auto generate 1 possible combination … following
 * the rules of what are pinned". It assembles the build FROM THE SHORTLIST (the
 * build references the shortlist), so it never searches the marketplace here.
 *
 * When a flagged category has no shortlisted option that fits, it comes back in
 * `noCompatible` and we surface the owner's prompt: "There is no compatible X —
 * add more to your shortlist?" with:
 *   • [Find Compatible] → opens the in-place category search (the marketplace
 *     escape hatch, scoped to that one group — within the pinned budget/date/
 *     location, AI-ranked when Setnayan AI is on).
 *   • [Remove Flag]     → unflag the category (drop it from compute).
 *
 * Client component. The 3-row cost strip, Reset, and Lock all live in
 * BuildPicksList — this is purely the Compute trigger + its no-match resolution.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Wand2, SearchX } from 'lucide-react';
import { computeBuildFromShortlist } from '../build-flags-actions';
import { unflagCategory } from '../build-flags-actions';
import { CategorySearchOverlay } from './category-search-overlay';

export function BuildCompute({
  eventId,
  flaggedCount,
}: {
  eventId: string;
  /** How many categories are currently flagged (drives the button enable). */
  flaggedCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filledMsg, setFilledMsg] = useState<string | null>(null);
  const [noCompatible, setNoCompatible] = useState<{ groupId: string; label: string }[]>([]);
  const [search, setSearch] = useState<{ groupId: string; label: string } | null>(null);

  function compute() {
    setFilledMsg(null);
    startTransition(async () => {
      const res = await computeBuildFromShortlist({ eventId });
      if (!res.ok) {
        setFilledMsg(res.error);
        return;
      }
      setNoCompatible(res.noCompatible);
      setFilledMsg(
        res.filled > 0
          ? `Filled ${res.filled} categor${res.filled === 1 ? 'y' : 'ies'} from your shortlist.`
          : res.noCompatible.length > 0
            ? null
            : 'Nothing to compute — flag the categories you want filled first.',
      );
      router.refresh();
    });
  }

  function removeFlag(groupId: string) {
    startTransition(async () => {
      await unflagCategory({ eventId, planGroupId: groupId });
      setNoCompatible((cur) => cur.filter((c) => c.groupId !== groupId));
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="space-y-1">
        <h2 className="font-display text-xl italic text-ink/85">Compute your build</h2>
        <p className="text-sm text-ink/60">
          Auto-fill every flagged category with one shortlisted service that fits your pinned
          budget. Your locked and pinned picks stay put.
        </p>
      </div>

      <button
        type="button"
        onClick={compute}
        disabled={pending || flaggedCount === 0}
        className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Wand2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        )}
        {flaggedCount > 0 ? `Compute ${flaggedCount} flagged` : 'Flag a category first'}
      </button>

      {filledMsg ? <p className="text-xs text-ink/60">{filledMsg}</p> : null}

      {noCompatible.length > 0 ? (
        <ul className="space-y-2">
          {noCompatible.map((c) => (
            <li
              key={c.groupId}
              className="rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3"
            >
              <p className="flex items-start gap-2 text-sm text-ink/80">
                <SearchX className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={1.75} aria-hidden />
                <span>
                  No compatible <b className="text-ink">{c.label}</b> in your shortlist fits your
                  budget. Add more to your shortlist?
                </span>
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSearch({ groupId: c.groupId, label: c.label })}
                  className="rounded-lg bg-terracotta px-3 py-1.5 text-xs font-semibold text-cream hover:bg-terracotta-600"
                >
                  Find compatible
                </button>
                <button
                  type="button"
                  onClick={() => removeFlag(c.groupId)}
                  disabled={pending}
                  className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/65 hover:bg-ink/5 disabled:opacity-50"
                >
                  Remove flag
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {search ? (
        <CategorySearchOverlay
          eventId={eventId}
          groupId={search.groupId}
          label={search.label}
          onClose={() => {
            setSearch(null);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}
