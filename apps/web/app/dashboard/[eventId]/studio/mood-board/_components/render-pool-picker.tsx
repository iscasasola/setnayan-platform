'use client';

/**
 * THE INSPIRATION POOL PICKER (MB9) — "save another couple's render into this
 * slot".
 *
 * Section 01's THIRD source, beside the couple's own uploads and MB10's
 * supplier gallery. Its shape is `gallery-picker.tsx`'s, deliberately and
 * almost line for line — a second picker with its own paging bugs helps
 * nobody:
 *
 *   · it ASKS FOR NOTHING until the couple opens it;
 *   · ONE PAGE AT A TIME through the `fetchAction` server action, walked by
 *     `offset`, with a quiet "Show more (N left)";
 *   · a failure is SHOWN, with a Try again — an empty grid that means "the
 *     fetch died" must never look like "nobody has shared a render";
 *   · one primary action per card, no confirm.
 *
 * 🛑 THE CAP IS NOT HERE, ON PURPOSE. This component never sends a `limit`.
 * `fetchRenderPool` clamps every request through `normalizeRenderPoolQuery`
 * server-side AND the SQL function clamps again, so a compromised client cannot
 * ask for the whole pool.
 *
 * ⛔ AND THERE IS NO PRICE ANYWHERE IN THIS FILE. Saving one of these costs
 * nothing because it produces nothing — it is a reference selection, the same
 * act as saving a florist's photo. The original MB9 was a cache that served a
 * prior render as a FREE OUTPUT; the owner cancelled that on 2026-09-03
 * ("always charge for renders"), so there is no "free" badge, no credit
 * counter and no Generate button in this component. Section 04 is where a
 * render is bought, at full price, every time.
 */

import { useCallback, useEffect, useState, useTransition } from 'react';
import { Check, ImageOff, Sparkles } from 'lucide-react';
import type { RenderPoolPage } from '@/lib/moodboard-render-pool';

export type RenderPoolPickerProps = {
  eventId: string;
  slotKey: string;
  /** The slot's couple-facing name ("Ceiling"), from the board's own GROUPS. */
  slotLabel: string;
  /** Which of this slot's photo cells are free right now, in order. */
  emptyPositions: readonly number[];
  fetchAction: (input: {
    eventId: string;
    slotKey: string;
    offset?: number;
  }) => Promise<RenderPoolPage>;
  applyAction: (input: {
    eventId: string;
    slotKey: string;
    slotPosition: number;
    renderId: string;
  }) => Promise<{ status: 'ok' | 'error'; imageUrl?: string; message?: string }>;
  /** Tell the board a cell filled, so its tile paints without a reload. */
  onSaved: (slotPosition: number, imageUrl: string) => void;
  onClose: () => void;
};

export function RenderPoolPicker({
  eventId,
  slotKey,
  slotLabel,
  emptyPositions,
  fetchAction,
  applyAction,
  onSaved,
  onClose,
}: RenderPoolPickerProps) {
  const [renders, setRenders] = useState<RenderPoolPage['renders']>([]);
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
        const page = await fetchAction({ eventId, slotKey, offset });
        setTotal(page.total);
        setWithheld((prior) => (offset === 0 ? page.withheld : prior + page.withheld));
        setRenders((prior) => (offset === 0 ? page.renders : [...prior, ...page.renders]));
        // Walks `offset`, NOT `renders.length`: a page may legitimately return
        // fewer showable renders than it holds rows (see RenderPoolPage.withheld),
        // and counting what arrived would re-request rows already seen.
        setLoadedThrough(page.offset + page.limit);
        setHasMore(page.hasMore);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [eventId, fetchAction, slotKey],
  );

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  const free = emptyPositions.length > 0 ? emptyPositions[0]! : null;

  function save(renderId: string) {
    if (pending || free === null) return;
    setSavingId(renderId);
    setSaveError(null);
    startTransition(async () => {
      try {
        const res = await applyAction({
          eventId,
          slotKey,
          slotPosition: free,
          renderId,
        });
        if (res.status === 'ok' && res.imageUrl) {
          setSavedIds((prior) => new Set(prior).add(renderId));
          onSaved(free, res.imageUrl);
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
      aria-label={`Shared renders for ${slotLabel}`}
      className="space-y-3 rounded-2xl border border-ink/12 bg-white/70 p-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="space-y-0.5">
          <h3 className="text-lg font-semibold text-ink">
            {slotLabel} — renders other couples shared
          </h3>
          {/* 🔑 THREE DIFFERENT EMPTIES, THREE DIFFERENT SENTENCES — the same
              refusal MB10's picker makes. A dead fetch, a pool nobody has
              contributed to yet, and renders we hold but cannot sample colours
              from are three separate facts. */}
          <p className="text-sm text-ink/65">
            {loading && renders.length === 0
              ? 'Looking through shared renders…'
              : loadError
                ? 'We couldn’t load shared renders just now.'
                : renders.length > 0
                  ? `${total} ${total === 1 ? 'render' : 'renders'} couples chose to share. Saving one is free — it’s a reference photo, not a render.`
                  : withheld > 0
                    ? `${withheld} shared ${withheld === 1 ? 'render is' : 'renders are'} here but not ready to show — ${withheld === 1 ? 'it carries' : 'they carry'} no sampled colours.`
                    : 'No couple has shared a render for this yet. Nothing is wrong — the pool is new.'}
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

      {free === null && renders.length > 0 ? (
        <p className="text-xs text-ink/60">
          This slot already holds its three photos — remove one to save another.
        </p>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {renders.map((render) => {
          const isSaving = savingId === render.renderId && pending;
          const saved = savedIds.has(render.renderId);
          return (
            <li key={render.renderId} className="sn-tile space-y-2 p-2">
              <div className="aspect-square overflow-hidden rounded-lg border border-ink/12">
                {/* The image IS the watermarked copy — the server never mints a
                    URL for the couple's own unmarked original, so there is no
                    unmarked render this tag could point at. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={render.imageUrl}
                  alt={`A shared Setnayan render — ${render.partLabel}`}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="px-0.5 text-[11px] font-semibold leading-tight text-ink">
                {render.partLabel}
              </p>
              <div className="flex flex-wrap gap-1 px-0.5">
                {render.swatches.slice(0, 6).map((hex, i) => (
                  <span
                    key={`${render.renderId}-${i}`}
                    className="h-3 w-3 rounded-full border border-ink/10"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => save(render.renderId)}
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

      {renders.length > 0 && withheld > 0 ? (
        <p className="flex items-center gap-1.5 text-[11px] text-ink/55">
          <ImageOff className="h-3 w-3" aria-hidden />
          {withheld} more shared {withheld === 1 ? 'render is' : 'renders are'} here but
          {withheld === 1 ? ' carries' : ' carry'} no sampled colours to save.
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
