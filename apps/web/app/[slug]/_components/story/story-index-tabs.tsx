'use client';

/**
 * story-index-tabs.tsx — the client chrome of "the whole story, at once".
 *
 * `01_The_Story.md` §3.6 · prototype `story.html` `#tabs`. Two small pieces:
 * the tab strip, and the captures panel's hour filter.
 *
 * 🔑 IT HOLDS NO CONTENT. Every panel arrives as an already-rendered server
 * node; this file decides which one is on screen and nothing else. The counts
 * on the chips were resolved by `buildStoryIndex` under the layer gate, so a
 * number that is not this reader's to have never reaches the browser — there is
 * no branch here that could print one.
 *
 * ⚠ A HIDDEN PANEL IS STILL IN THE DOCUMENT, AND THAT IS CORRECT. `hidden` is
 * the difference between "not on screen right now" and "not yours to read". The
 * second one is decided by `redactStoryLayers` before any of this renders, so
 * the search is right to read a hidden panel: it is this reader's, they simply
 * have another tab open.
 *
 * ⚠ WITH JAVASCRIPT OFF THE FIRST TAB IS THE ONE YOU GET — the prototype's
 * behaviour, and nothing is lost by it: every item in every panel points at a
 * minute that is already written out in full further up the page, and the
 * shipped sections under the clock still render in the host's own order.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { StoryIndexTabKey } from '@/lib/story-index';

/** Asked by the search when a hit lives inside one of the eleven. */
export const STORY_OPEN_TAB_EVENT = 'story:open-tab';

/** The hour chip that means "everything". */
export const HOUR_ALL = 'all';

export type TabChip = {
  key: StoryIndexTabKey;
  title: string;
  /** NULL = this reader has no number for it. The chip then shows no number. */
  count: number | null;
};

export function StoryIndexTabs({
  tabs,
  panels,
}: {
  tabs: TabChip[];
  /** One already-rendered server panel per tab, in the same order. */
  panels: Array<{ key: StoryIndexTabKey; node: ReactNode }>;
}) {
  const [active, setActive] = useState<StoryIndexTabKey | null>(tabs[0]?.key ?? null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const baseId = useId();

  const open = useCallback(
    (key: StoryIndexTabKey) => {
      if (!tabs.some((t) => t.key === key)) return;
      setActive(key);
    },
    [tabs],
  );

  /* The search asks; the index answers. One owner for which tab is open, for
     the same reason the dial owns its sheet. */
  useEffect(() => {
    const onAsk = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: string }>).detail?.tab;
      if (typeof tab === 'string') open(tab as StoryIndexTabKey);
    };
    window.addEventListener(STORY_OPEN_TAB_EVENT, onAsk);
    return () => window.removeEventListener(STORY_OPEN_TAB_EVENT, onAsk);
  }, [open]);

  /* Arrow keys walk the strip — the WAI-ARIA tabs pattern, and the reason the
     chips carry a roving tabindex instead of all being reachable by Tab. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') {
      return;
    }
    e.preventDefault();
    const i = tabs.findIndex((t) => t.key === active);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? tabs.length - 1
          : Math.max(0, Math.min(tabs.length - 1, (i < 0 ? 0 : i) + (e.key === 'ArrowRight' ? 1 : -1)));
    const key = tabs[next]?.key;
    if (!key) return;
    setActive(key);
    stripRef.current
      ?.querySelector<HTMLButtonElement>(`[data-tab-key="${key}"]`)
      ?.focus();
  };

  if (tabs.length === 0) return null;

  return (
    <>
      <div
        ref={stripRef}
        role="tablist"
        aria-label="The whole story, at once"
        onKeyDown={onKeyDown}
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.key}`}
              data-tab-key={t.key}
              aria-selected={on}
              aria-controls={`${baseId}-panel-${t.key}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(t.key)}
              className={`min-h-[44px] flex-none rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors ${
                on
                  ? 'border-ink bg-ink text-cream'
                  : 'border-ink/25 text-ink hover:border-ink/50'
              }`}
            >
              {t.title}
              {/*
                🔒 NO NUMBER WHEN THERE IS NO NUMBER. `count` is null for a
                reader the layer is withheld from — and a chip reading
                "Captures · 0" is a claim about somebody's celebration, not a
                blank. Owner gate Q1, ruled 2026-09-09.
              */}
              {t.count != null ? (
                <span className="ml-1.5 tabular-nums opacity-70">{t.count.toLocaleString('en-PH')}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {panels.map((p) => (
        <div
          key={p.key}
          role="tabpanel"
          id={`${baseId}-panel-${p.key}`}
          aria-labelledby={`${baseId}-tab-${p.key}`}
          data-story-panel={p.key}
          hidden={p.key !== active}
          tabIndex={0}
          className="pt-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-700"
        >
          {p.node}
        </div>
      ))}
    </>
  );
}

/**
 * The captures panel's hour chips — ALL · BEFORE THE DAY · 11 AM · … · FROM THE
 * SHOPS.
 *
 * ⚠ THE HOURS ARE DERIVED FROM THE TILES, NEVER LISTED. The prototype hard-codes
 * seven; a real celebration has whatever hours it has, and the one published
 * story in production has NONE on its own day — all fourteen of its captures
 * fall before it (measured 2026-09-09). A hard-coded strip would offer that
 * reader six chips that each filter to nothing.
 */
export function CapturesByHour({
  tiles,
  beforeLabel,
}: {
  tiles: Array<{ key: string; hour: string; node: ReactNode }>;
  /** "Before the day" — worded by the caller, which owns the event's words. */
  beforeLabel: string;
}) {
  const [hour, setHour] = useState<string>(HOUR_ALL);

  const present = useMemo(() => {
    const seen: string[] = [];
    for (const t of tiles) if (!seen.includes(t.hour)) seen.push(t.hour);
    return seen.sort((a, b) => {
      if (a === 'pre') return -1;
      if (b === 'pre') return 1;
      return Number(a) - Number(b);
    });
  }, [tiles]);

  useEffect(() => {
    const onAsk = (e: Event) => {
      const h = (e as CustomEvent<{ hour?: string | null }>).detail?.hour;
      if (typeof h === 'string' && (h === HOUR_ALL || present.includes(h))) setHour(h);
    };
    window.addEventListener(STORY_OPEN_TAB_EVENT, onAsk);
    return () => window.removeEventListener(STORY_OPEN_TAB_EVENT, onAsk);
  }, [present]);

  const chips = [HOUR_ALL, ...present];
  const shown = hour === HOUR_ALL ? tiles : tiles.filter((t) => t.hour === hour);

  return (
    <>
      {chips.length > 2 ? (
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {chips.map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={h === hour}
              onClick={() => setHour(h)}
              className={`min-h-[44px] flex-none rounded-full border px-3 font-mono text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${
                h === hour ? 'border-ink bg-ink text-cream' : 'border-ink/25 text-ink/75'
              }`}
            >
              {h === HOUR_ALL ? 'All' : h === 'pre' ? beforeLabel : hourChip(Number(h))}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((t) => (
          <div key={t.key}>{t.node}</div>
        ))}
      </div>
    </>
  );
}

function hourChip(h: number): string {
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${h < 12 ? 'AM' : 'PM'}`;
}
