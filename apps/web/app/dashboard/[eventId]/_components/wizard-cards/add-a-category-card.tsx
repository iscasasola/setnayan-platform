'use client';

/**
 * Card 09 (DIY tier) · Add A Category.
 *
 * Owner directive 2026-05-30: multi-pick from the 192-row canonical
 * service taxonomy organized by 12 wedding folders. Selected picks
 * persist to events.wizard_state.add_a_category.picks (TEXT[] of
 * canonical_service keys per wizard.ts line 1407 and the
 * getBaseSequenceForTier custom-task spawning logic at lines 1665+).
 *
 * Each pick spawns a dynamic `custom_<canonical>` wizard task that
 * surfaces AFTER the 9 baseline DIY cards · the host walks through the
 * Foundation first, then locks vendors for each added category at their
 * own pace.
 *
 * UX shape:
 *   1. Selected chips strip at top (with ✕ to remove each pick)
 *   2. 12 folder accordion sections — each closed by default
 *   3. Inside each open folder · grid of canonical buttons. Already-
 *      picked + already-in-DIY-foundation canonicals render disabled
 *      ("Added" / "Already in your plan").
 *   4. "Done adding categories" CTA at bottom · calls markTaskDone
 *      which advances the wizard past add_a_category.
 *
 * Add A Category sits at order 9 in WIZARD_TASKS_DIY · the last
 * baseline card. Once marked done, the resolver moves on to the
 * dynamically-spawned custom_* tasks (one per pick).
 */

import { useMemo, useState, useTransition } from 'react';
import { ChevronDown, Plus, Sparkles, X } from 'lucide-react';
import {
  TAXONOMY_MAP,
  WEDDING_FOLDER_ORDER,
  WEDDING_FOLDER_SHORT_LABEL,
  type WeddingFolder,
} from '@/lib/taxonomy';
import {
  addToAddACategory,
  markTaskDone,
  removeFromAddACategory,
} from '../../wizard-actions';

type Props = {
  eventId: string;
  /** Canonical service keys the host has already picked. */
  initialPicks: ReadonlyArray<string>;
};

// Canonicals already covered by the 9-card DIY foundation. Hidden / disabled
// in this picker so hosts don't accidentally double-add. Names match the
// wizard task IDs from WIZARD_TASKS_DIY in lib/wizard.ts.
//
// `attire` task surfaces a 6-sub-tab picker covering bridal_gown / bridal_shoes /
// groom_suit / groom_shoes / entourage_attire / parents_attire — those 6
// canonical_service keys are also excluded here so the host doesn't
// double-add gowns / suits / shoes outside the existing attire card.
const EXCLUDED_CANONICALS: ReadonlySet<string> = new Set([
  // Direct DIY foundation tasks
  'reception_venue',
  'religious_venue', // ceremony_venue task maps to the religious_venue canonical
  'catering',
  'wedding_rings',
  // Covered by the existing attire sub-picker
  'bridal_gown',
  'bridal_shoes',
  'groom_suit',
  'groom_shoes',
  'entourage_attire',
  'parents_attire',
]);

/** Group all 192 canonicals by their primary folder, computed once at
 *  module load. Each folder's array stays in TAXONOMY_MAP insertion
 *  order which matches the human-curated grouping inside the file. */
const CANONICALS_BY_FOLDER: Record<WeddingFolder, string[]> = (() => {
  const out = {
    ceremony: [],
    reception: [],
    planning_logistics_travel: [],
    photo_video: [],
    catering: [],
    attire: [],
    hair_makeup: [],
    music_program: [],
    decor_florals_sound: [],
    rings_accessories: [],
    booths_stations: [],
    invitations_keepsakes: [],
  } as Record<WeddingFolder, string[]>;
  for (const [canonical, meta] of Object.entries(TAXONOMY_MAP)) {
    if (EXCLUDED_CANONICALS.has(canonical)) continue;
    out[meta.folder].push(canonical);
  }
  return out;
})();

function displayCanonical(canonical: string): string {
  return canonical
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AddACategoryCard({ eventId, initialPicks }: Props) {
  // Local optimistic state · keeps UI snappy while the server action
  // round-trips. On error the state reverts.
  const [picks, setPicks] = useState<ReadonlyArray<string>>(initialPicks);
  const [openFolder, setOpenFolder] = useState<WeddingFolder | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const picksSet = useMemo(() => new Set(picks), [picks]);

  function handleAdd(canonical: string) {
    if (picksSet.has(canonical)) return;
    setErrorMessage(null);
    const prior = picks;
    const next = [...picks, canonical];
    setPicks(next);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('canonical', canonical);
    startTransition(async () => {
      try {
        await addToAddACategory(formData);
      } catch (err) {
        setPicks(prior);
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't add that category. Try again.";
        setErrorMessage(message);
      }
    });
  }

  function handleRemove(canonical: string) {
    if (!picksSet.has(canonical)) return;
    setErrorMessage(null);
    const prior = picks;
    const next = picks.filter((p) => p !== canonical);
    setPicks(next);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('canonical', canonical);
    startTransition(async () => {
      try {
        await removeFromAddACategory(formData);
      } catch (err) {
        setPicks(prior);
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't remove that category. Try again.";
        setErrorMessage(message);
      }
    });
  }

  function handleDone() {
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', 'add_a_category');
    startTransition(async () => {
      try {
        await markTaskDone(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't mark done. Try again.";
        setErrorMessage(message);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Hint block · brand-voice editorial */}
      <div className="rounded-xl border border-terracotta/25 bg-terracotta/5 p-3 text-sm leading-relaxed text-ink/80 sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles
            aria-hidden
            className="h-3.5 w-3.5 text-terracotta"
            strokeWidth={2}
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            Your additions
          </p>
        </div>
        <p>
          Florals · band · DJ · cake · invitations · honeymoon · paprint —
          anything else on your mind. Pick from our catalog and each
          addition spawns its own card you can lock at your own pace.
          You can add more later anytime.
        </p>
      </div>

      {/* Selected chips strip */}
      {picks.length > 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Added · {picks.length}
          </p>
          <div className="flex flex-wrap gap-2">
            {picks.map((canonical) => (
              <span
                key={canonical}
                className="inline-flex items-center gap-1.5 rounded-full border border-mulberry/40 bg-mulberry/10 px-3 py-1 text-xs font-medium text-mulberry"
              >
                {displayCanonical(canonical)}
                <button
                  type="button"
                  onClick={() => handleRemove(canonical)}
                  disabled={isPending}
                  aria-label={`Remove ${displayCanonical(canonical)}`}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-mulberry/70 transition-colors hover:bg-mulberry/15 hover:text-mulberry focus:outline-none focus:ring-2 focus:ring-mulberry/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X aria-hidden className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm italic text-ink/55">
          Nothing added yet — browse the folders below.
        </p>
      )}

      {/* 12 folder accordion */}
      <div className="space-y-2">
        {WEDDING_FOLDER_ORDER.map((folder) => {
          const folderCanonicals = CANONICALS_BY_FOLDER[folder] ?? [];
          if (folderCanonicals.length === 0) return null;
          const isOpen = openFolder === folder;
          const folderAddedCount = folderCanonicals.filter((c) =>
            picksSet.has(c),
          ).length;
          return (
            <div
              key={folder}
              className="overflow-hidden rounded-xl border border-ink/10 bg-white/60"
            >
              <button
                type="button"
                onClick={() => setOpenFolder(isOpen ? null : folder)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-cream/60 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {WEDDING_FOLDER_SHORT_LABEL[folder]}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
                    {folderCanonicals.length}
                  </span>
                  {folderAddedCount > 0 ? (
                    <span className="rounded-full bg-mulberry/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-mulberry">
                      {folderAddedCount} added
                    </span>
                  ) : null}
                </span>
                <ChevronDown
                  aria-hidden
                  className={`h-4 w-4 text-ink/55 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  strokeWidth={2}
                />
              </button>
              {isOpen ? (
                <div className="border-t border-ink/10 bg-cream/30 p-3">
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {folderCanonicals.map((canonical) => {
                      const added = picksSet.has(canonical);
                      return (
                        <button
                          key={canonical}
                          type="button"
                          onClick={() =>
                            added
                              ? handleRemove(canonical)
                              : handleAdd(canonical)
                          }
                          disabled={isPending}
                          className={
                            added
                              ? 'inline-flex items-center justify-between gap-2 rounded-md border border-mulberry/40 bg-mulberry/10 px-3 py-2 text-left text-sm text-mulberry transition-colors hover:bg-mulberry/15 focus:outline-none focus:ring-2 focus:ring-mulberry/30 disabled:cursor-not-allowed disabled:opacity-50'
                              : 'inline-flex items-center justify-between gap-2 rounded-md border border-ink/10 bg-white px-3 py-2 text-left text-sm text-ink/85 transition-colors hover:border-terracotta/40 hover:bg-terracotta/5 focus:outline-none focus:ring-2 focus:ring-terracotta/30 disabled:cursor-not-allowed disabled:opacity-50'
                          }
                        >
                          <span>{displayCanonical(canonical)}</span>
                          {added ? (
                            <span
                              aria-hidden
                              className="font-mono text-[9px] uppercase tracking-[0.15em]"
                            >
                              Added
                            </span>
                          ) : (
                            <Plus
                              aria-hidden
                              className="h-3.5 w-3.5"
                              strokeWidth={2}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink/55">
          {picks.length === 0
            ? 'Done browsing? You can always come back.'
            : `${picks.length} ${
                picks.length === 1 ? 'category' : 'categories'
              } added — each gets its own card after you mark this done.`}
        </p>
        <button
          type="button"
          onClick={handleDone}
          disabled={isPending}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-700 focus:outline-none focus:ring-2 focus:ring-mulberry focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Done adding categories'}
        </button>
      </div>
    </div>
  );
}
