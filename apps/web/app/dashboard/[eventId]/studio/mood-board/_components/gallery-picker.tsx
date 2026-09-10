'use client';

/**
 * SUPPLIER GALLERY PICKER (MB10) — "save a supplier's photo into this slot".
 *
 * Mounted from `inspiration-board.tsx`, one instance per open slot. Its shape
 * is `template-gallery.tsx`'s, deliberately and almost line for line:
 *
 *   · it ASKS FOR NOTHING until the couple opens it. The button lives on the
 *     slot; this component only exists once they tap it, so drawing the
 *     inspiration board costs zero gallery queries;
 *   · ONE PAGE AT A TIME through the `fetchAction` server action, walked by
 *     `offset`, with a quiet "Show more (N left)";
 *   · a failure is SHOWN, with a Try again — an empty grid that means "the
 *     fetch died" must never render identically to "no supplier has uploaded",
 *     which is a real and different answer;
 *   · one primary action per card, no confirm.
 *
 * 🛑 THE CAP IS NOT HERE, AND THAT IS ON PURPOSE. This component never sends a
 * `limit`. `fetchGalleryAssets` clamps every request through
 * `normalizeGalleryQuery` server-side, so a compromised or edited client cannot
 * ask for the whole table — which is precisely what the theme gallery's
 * client-passed limit could not prevent, and what PR #5113 had to undo.
 *
 * ⚠ PAGING WALKS `offset`, NOT `assets.length`. A page may legitimately return
 * fewer showable photos than it holds rows (an unverified shop, an asset with
 * no sampled colours — see GalleryPage.withheld), and counting what arrived
 * would then re-request rows already seen and stall short of the end.
 */

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Check, ImageOff, Sparkles } from 'lucide-react';
import type { GalleryAsset, GalleryPage } from '@/lib/moodboard-gallery';
import { EventLinkedBadge } from './event-linked-badge';

export type GalleryPickerProps = {
  eventId: string;
  slotKey: string;
  /** The slot's couple-facing name ("Flowers"), from the board's own GROUPS. */
  slotLabel: string;
  /** Which of this slot's photo cells are free right now, in order. */
  emptyPositions: readonly number[];
  fetchAction: (input: { slotKey: string; offset?: number }) => Promise<GalleryPage>;
  applyAction: (input: {
    eventId: string;
    slotKey: string;
    slotPosition: number;
    assetId: string;
  }) => Promise<{ status: 'ok' | 'error'; imageUrl?: string; message?: string }>;
  /**
   * Tell the board a cell filled, so its tile paints without a reload — and
   * hand it THE SAME credit string this card just displayed. Not a second
   * derivation: two places computing one credit is how they end up disagreeing.
   */
  onSaved: (slotPosition: number, imageUrl: string, credit: string) => void;
  onClose: () => void;
};

export function GalleryPicker({
  eventId,
  slotKey,
  slotLabel,
  emptyPositions,
  fetchAction,
  applyAction,
  onSaved,
  onClose,
}: GalleryPickerProps) {
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [withheld, setWithheld] = useState(0);
  /** How far into the result set we have asked — the paging cursor. */
  const [loadedThrough, setLoadedThrough] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loadPage = useCallback(
    async (offset: number) => {
      setLoading(true);
      setLoadError(false);
      try {
        const page = await fetchAction({ slotKey, offset });
        setTotal(page.total);
        setWithheld((prior) => (offset === 0 ? page.withheld : prior + page.withheld));
        setAssets((prior) => (offset === 0 ? page.assets : [...prior, ...page.assets]));
        setLoadedThrough(page.offset + page.limit);
        setHasMore(page.hasMore);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [fetchAction, slotKey],
  );

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  const free = emptyPositions.length > 0 ? emptyPositions[0]! : null;

  function save(asset: GalleryAsset) {
    if (pending || free === null) return;
    setSavingId(asset.assetId);
    setSaveError(null);
    startTransition(async () => {
      try {
        const res = await applyAction({
          eventId,
          slotKey,
          slotPosition: free,
          assetId: asset.assetId,
        });
        if (res.status === 'ok' && res.imageUrl) {
          setSavedIds((prior) => new Set(prior).add(asset.assetId));
          onSaved(free, res.imageUrl, asset.credit);
        } else {
          setSaveError(res.message ?? 'Could not save that photo — try again.');
        }
      } catch {
        setSaveError('Could not save that photo — try again.');
      } finally {
        setSavingId(null);
      }
    });
  }

  return (
    <section
      aria-label={`Supplier photos for ${slotLabel}`}
      className="space-y-3 rounded-2xl border border-ink/12 bg-white/70 p-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-lg font-semibold text-ink">
            {slotLabel} — suppliers&rsquo; own photos
          </h3>
          {/* 🔑 THREE DIFFERENT EMPTIES, THREE DIFFERENT SENTENCES. A dead
              fetch, a slot no supplier has stocked, and a slot whose photos we
              hold but may not credit are three separate facts, and rendering
              them as one grey grid is the failure this whole build arc is
              about. `withheld` is measured per fetch, so the third sentence
              corrects itself the day those shops get verified. */}
          <p className="text-sm text-ink/65">
            {loading && assets.length === 0
              ? 'Finding photos…'
              : loadError
                ? 'We couldn’t load supplier photos just now.'
                : assets.length > 0
                  ? `${total} ${total === 1 ? 'photo' : 'photos'} from suppliers — every one credited to the shop that made it.`
                  : withheld > 0
                    ? `${withheld} ${withheld === 1 ? 'photo is' : 'photos are'} here but not ready to show — their shop isn’t verified yet, or the photo carries no sampled colours.`
                    : 'No supplier has added photos for this yet. Nothing is wrong — the shelf is new.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="sn-press text-[12px] font-bold text-ink/60 underline underline-offset-2 hover:text-ink"
        >
          Close
        </button>
      </header>

      {loadError ? (
        <button
          type="button"
          onClick={() => void loadPage(0)}
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/5"
        >
          Try again
        </button>
      ) : null}

      {saveError ? (
        <p role="alert" className="text-xs text-terracotta-700">
          {saveError}
        </p>
      ) : null}

      {free === null && assets.length > 0 ? (
        <p className="text-xs text-ink/60">
          This slot already holds its three photos — remove one to save another.
        </p>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {assets.map((asset) => {
          const isSaving = savingId === asset.assetId && pending;
          const saved = savedIds.has(asset.assetId);
          return (
            <li key={asset.assetId} className="sn-tile space-y-2 p-2">
              <div className="aspect-square overflow-hidden rounded-lg border border-ink/12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.imageUrl}
                  alt={asset.label || `Supplier photo — ${asset.credit}`}
                  className="h-full w-full object-cover"
                />
              </div>
              {/* MB22 — driven per-row by asset.isEventLinked, never hard-coded
                  (see event-linked-badge.tsx for why that distinction is the
                  whole point). */}
              <EventLinkedBadge show={asset.isEventLinked} />
              {/* THE CREDIT. Never conditional, never abbreviated: a gallery
                  photo whose shop is not named is a stock photo, and the
                  server withholds those rather than sending them here. */}
              <p className="px-0.5 text-[11px] font-semibold leading-tight text-ink">
                {asset.credit}
              </p>
              {asset.label ? (
                <p className="line-clamp-2 px-0.5 text-[10px] text-ink/60">{asset.label}</p>
              ) : null}
              <div className="flex flex-wrap gap-1 px-0.5">
                {asset.swatches.slice(0, 6).map((hex, i) => (
                  <span
                    key={`${asset.assetId}-${i}`}
                    className="h-3 w-3 rounded-full border border-ink/10"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => save(asset)}
                disabled={isSaving || free === null || saved}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-terracotta/40 px-3 py-1.5 text-[11px] font-medium text-terracotta-700 transition hover:bg-terracotta/10 disabled:opacity-50"
              >
                {saved ? (
                  <>
                    <Check className="h-3 w-3" aria-hidden />
                    Saved
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" aria-hidden />
                    {isSaving ? 'Saving…' : 'Save to this slot'}
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Rows we fetched and did not show, alongside ones we did — the couple
          is told the shelf is partly hidden rather than left to assume the
          gallery is small. */}
      {assets.length > 0 && withheld > 0 ? (
        <p className="flex items-center gap-1.5 text-[11px] text-ink/55">
          <ImageOff className="h-3 w-3" aria-hidden />
          {withheld} more {withheld === 1 ? 'photo' : 'photos'} here {withheld === 1 ? 'is' : 'are'}{' '}
          waiting on its shop&rsquo;s verification or its colours.
        </p>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadPage(loadedThrough)}
          className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/5 disabled:opacity-50"
        >
          {loading ? 'Loading…' : `Show more (${Math.max(0, total - loadedThrough)} left)`}
        </button>
      ) : null}
    </section>
  );
}
