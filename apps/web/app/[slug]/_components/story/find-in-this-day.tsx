'use client';

/**
 * find-in-this-day.tsx — one search over every layer THIS reader may see.
 *
 * `01_The_Story.md` §8 · `08` step 2.4 · prototype `story.html` `#findQ`.
 *
 * ── THE SAFETY ARGUMENT IS THE ARCHITECTURE, NOT A CHECK ───────────────────
 * 🔴 THE INDEX IS REBUILT FROM THE LIVE PAGE, ON EVERY KEYSTROKE. There is no
 * payload prop, no fetch, no route and no second copy of the day for this
 * component to consult — its ONLY source is `document`. Everything a reader may
 * not read was taken out of the payload by `redactStoryLayers` before a single
 * element was rendered, so it is not in the document, so it cannot be a hit.
 *
 * That is deliberately stronger than "the search filters by audience". A filter
 * is a second opinion about a question already answered upstream, and the whole
 * failure this page has logged three times is two answers to one question. Here
 * there is nothing to filter: **a stranger cannot search what a stranger cannot
 * read, because it was never written down.**
 *
 * ⚠ WHICH IS ALSO WHY IT TAKES NO DATA PROPS AND MUST NEVER GAIN ONE. Its props
 * are two words of copy. `the-index-cannot-outrun-the-payload.test.ts` fails if
 * this file imports the story's data modules.
 *
 * ── ONE DEPARTURE FROM THE PROTOTYPE, DELIBERATE ───────────────────────────
 * The prototype has a full-width input row above the dial and a full-width
 * results panel below it — two flat siblings, which is what its flat HTML made
 * easy. Here the button, the input and the results are ONE anchored popover, so
 * the sticky bar does not change height when the search opens and the dial does
 * not jump under the reader's thumb mid-scroll. Every behaviour is the port's:
 * the same groups, the same cap, the same time parsing, the same dimming.
 *
 * ⛔ IT DOES NOT CLAIM `aria-modal`. It is a disclosure over a page the reader
 * is still reading — the page behind it is NOT inert, and saying so to a screen
 * reader would be a promise we are choosing not to keep. Escape closes it and
 * hands focus back to the button, which is the contract a disclosure owes.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  FIND_GROUPS,
  FIND_MIN_LEN,
  findSnippet,
  formatFoundTime,
  groupHits,
  markSegments,
  matchFindables,
  parseStoryTime,
  type Findable,
  type FindGroup,
} from '@/lib/story-find';
import { STORY_OPEN_MINUTE_EVENT } from './story-clock';
import { STORY_OPEN_TAB_EVENT } from './story-index-tabs';

/** Marks an entry the current query did not hit. Styled in `globals.css`. */
const DIM_ATTR = 'data-story-dim';

function textOf(el: Element | null | undefined): string {
  return el ? (el.textContent ?? '').replace(/\s+/g, ' ').trim() : '';
}

/**
 * EVERYTHING ON THE PAGE THAT CAN BE FOUND — read out of the DOM.
 *
 * Two sources, and they do not overlap:
 *
 *   · `[data-story-entry]` → the MINUTES and the road's dated facts. The whole
 *     entry's text comes with them, so a search for a line somebody said also
 *     finds the minute it was said in.
 *   · `[data-find]` → every other group, from the eleven index tabs. The index
 *     is the complete list of each layer; the minutes show a subset. Reading
 *     both for the same group would print each voice twice.
 *
 * Exported so its shape is a stated contract rather than a private habit, and
 * so the guard can prove it is only ever called with `document`.
 */
export function collectFindables(root: ParentNode): Findable[] {
  const out: Findable[] = [];

  root.querySelectorAll<HTMLElement>('[data-story-entry]').forEach((el, i) => {
    const stamp = el.dataset.storyStamp ?? '';
    const suffix = el.dataset.storySuffix ?? '';
    out.push({
      id: `entry-${i}`,
      group: 'Minutes',
      stamp: suffix ? `${stamp} ${suffix}` : stamp,
      label: el.dataset.storyLabel ?? stamp,
      text: textOf(el),
      targetId: el.id || null,
      panel: null,
      hour: null,
    });
  });

  root.querySelectorAll<HTMLElement>('[data-find]').forEach((el, i) => {
    const group = el.dataset.findGroup as FindGroup | undefined;
    if (!group || !(FIND_GROUPS as readonly string[]).includes(group)) return;
    out.push({
      id: `find-${i}`,
      group,
      stamp: el.dataset.findStamp ?? '',
      label: el.dataset.findLabel ?? '',
      text: `${el.dataset.findNote ?? ''} ${textOf(el)}`,
      targetId: el.dataset.findTarget || null,
      panel: el.dataset.findPanel || null,
      hour: el.dataset.findHour || null,
    });
  });

  return out;
}

export function FindInThisDay({
  /** "wedding", "celebration" — the event's own word, for the empty sentence. */
  occasion,
}: {
  occasion: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Findable[]>([]);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  const hits = useMemo(
    () => (query.trim().length >= FIND_MIN_LEN ? matchFindables(items, query) : []),
    [items, query],
  );
  const jumpMinute = useMemo(() => parseStoryTime(query), [query]);
  /*
    "Jump to that minute" is only offered when there IS a minute to jump to —
    the clock refuses a day it never measured, so offering the button on a story
    whose day is empty would be a control that does nothing.
  */
  const canJump =
    jumpMinute != null &&
    typeof document !== 'undefined' &&
    document.querySelector('[data-story-entry][data-story-minute]') != null;

  /* Rebuild from the page whenever it opens, and on every keystroke after. The
     page changes under us — a tab opens, an hour filter narrows a grid — and a
     cached index would answer for a page that is no longer there. */
  const rescan = useCallback(() => setItems(collectFindables(document)), []);

  useEffect(() => {
    if (!open) return;
    rescan();
  }, [open, rescan]);

  /* ── NON-MATCHING MINUTES DIM (`01` §8) ──────────────────────────────────
     A presentational marker written onto the server-rendered entries. It is NOT
     a gate and could never be one: everything it dims is already in the served
     HTML, which is exactly why the LAYERS are withheld from the payload and not
     with a stylesheet. Cleared on close, and on unmount, so a reader never
     leaves a query behind and finds half their story greyed out. */
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-story-entry]'));
    const active = open && hits.length > 0 && query.trim().length >= FIND_MIN_LEN;
    const lit = new Set(hits.map((h) => h.targetId).filter(Boolean) as string[]);
    for (const el of nodes) {
      if (active && el.id && !lit.has(el.id)) el.setAttribute(DIM_ATTR, 'true');
      else el.removeAttribute(DIM_ATTR);
    }
    return () => {
      for (const el of nodes) el.removeAttribute(DIM_ATTR);
    };
  }, [open, hits, query]);

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      setQuery('');
      if (returnFocus) triggerRef.current?.focus();
    },
    [],
  );

  /* Escape closes from anywhere inside, and a click outside dismisses — the
     contract a disclosure owes, without claiming the page behind it is inert. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const goTo = (hit: Findable) => {
    if (hit.panel) {
      window.dispatchEvent(
        new CustomEvent(STORY_OPEN_TAB_EVENT, {
          detail: { tab: hit.panel, hour: hit.hour ?? null },
        }),
      );
    }
    const target = hit.targetId ? document.getElementById(hit.targetId) : null;
    close(true);
    if (!target) return;
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'start',
    });
  };

  const jump = () => {
    if (jumpMinute == null) return;
    close(true);
    window.dispatchEvent(
      new CustomEvent(STORY_OPEN_MINUTE_EVENT, { detail: { minuteOfDay: jumpMinute } }),
    );
  };

  const showing = query.trim().length >= FIND_MIN_LEN;

  return (
    <div className="relative flex-none">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close(true) : setOpen(true))}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/25 px-3.5 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink/75 transition-colors hover:border-ink/50 hover:text-ink"
      >
        <Search aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Find
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-[min(88vw,26rem)] rounded-xl border-2 border-ink bg-cream shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)]"
        >
          <div className="flex items-center gap-2 border-b border-ink/15 p-2">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                rescan();
              }}
              /*
                🔒 THE ONLY INPUT ON THIS PAGE, AND IT IS NOT A NAME BOX. The
                placeholder names a MINUTE, a shop and a word — never a person —
                because a field that invites a first name is the exact thing the
                owner ruled out on 2026-09-07: type any first name, learn who
                came and where they sat. `no-name-field-on-the-story.test.ts`
                holds the line.
              */
              placeholder="A minute (7:12), a shop, a word…"
              aria-label="Find in this day"
              autoComplete="off"
              className="min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-ink/20 bg-white/60 px-3 text-[15px] text-ink outline-none placeholder:text-ink/45 focus-visible:border-terracotta-700"
            />
            <button
              type="button"
              onClick={() => close(true)}
              aria-label="Close the search"
              className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg text-ink/60 hover:bg-ink/5 hover:text-ink"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <div className="max-h-[55vh] overflow-y-auto overscroll-contain px-3 pb-3" role="status">
            {!showing ? (
              <p className="py-4 font-serif text-[15px] italic leading-snug text-ink/60">
                Everything on this page, and nothing that is not. Type a time, a word from
                something somebody said, or the name of a shop.
              </p>
            ) : null}

            {showing && canJump && jumpMinute != null ? (
              <>
                <p className="pb-1 pt-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-ink/55">
                  Jump to
                </p>
                <button
                  type="button"
                  onClick={jump}
                  className="grid min-h-[44px] w-full grid-cols-[3.5rem_1fr] items-start gap-2.5 border-t border-ink/10 py-2.5 text-left hover:bg-ink/5"
                >
                  <b className="pt-0.5 font-condensed text-sm font-extrabold tabular-nums tracking-wide">
                    {formatFoundTime(jumpMinute).t}
                  </b>
                  <span className="text-[13.5px] leading-snug">
                    Open that minute — {formatFoundTime(jumpMinute).t}{' '}
                    {formatFoundTime(jumpMinute).ap}
                  </span>
                </button>
              </>
            ) : null}

            {showing
              ? FIND_GROUPS.map((g) => {
                  const { shown, more } = groupHits(hits, g);
                  if (shown.length === 0) return null;
                  return (
                    <div key={g}>
                      <p className="pb-1 pt-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-ink/55">
                        {g} · {shown.length + more}
                      </p>
                      {shown.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => goTo(h)}
                          className="grid min-h-[44px] w-full grid-cols-[3.5rem_1fr] items-start gap-2.5 border-t border-ink/10 py-2.5 text-left hover:bg-ink/5"
                        >
                          <b className="pt-0.5 font-condensed text-sm font-extrabold tabular-nums tracking-wide">
                            {h.stamp}
                          </b>
                          <span className="min-w-0">
                            <span className="block text-[13.5px] leading-snug">
                              <Marked text={h.label} query={query} />
                            </span>
                            {h.text.trim() ? (
                              <small className="mt-0.5 block text-xs leading-snug text-ink/60">
                                <Marked text={findSnippet(h.text, query)} query={query} />
                              </small>
                            ) : null}
                          </span>
                        </button>
                      ))}
                      {more > 0 ? (
                        <p className="py-2 font-serif text-[13px] italic text-ink/55">
                          +{more} more in {g.toLowerCase()} — add a word to narrow it
                        </p>
                      ) : null}
                    </div>
                  );
                })
              : null}

            {showing && hits.length === 0 && !canJump ? (
              <p className="py-4 font-serif text-[15px] italic leading-snug text-ink/60">
                Nothing on this page says “{query.trim()}”. Try a time, a word from this{' '}
                {occasion}, or the name of a shop.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The matched words, marked.
 *
 * 🔴 SEGMENTS AND NOT `innerHTML`. The prototype builds `<mark>` into an HTML
 * string; that is safe for hard-coded demo copy and unsafe the moment the text
 * is a guest's own message. React renders these as text nodes, so nothing
 * anybody wrote on this page can be injected back into it.
 */
function Marked({ text, query }: { text: string; query: string }) {
  return (
    <>
      {markSegments(text, query).map((seg, i) =>
        seg.hit ? (
          <mark key={i} className="rounded-[2px] bg-gold/45 px-0.5 text-ink">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}
