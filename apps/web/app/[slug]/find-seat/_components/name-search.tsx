'use client';

import { useCallback, useRef, useState } from 'react';
import { WayfindingMap } from '@/app/_components/wayfinding-map';
import { sanitizeSeatLookupQuery } from '@/lib/seat-lookup';
import {
  isSeatDeviceId,
  noTableForThatName,
  SEAT_DEVICE_HEADER,
  SEAT_DEVICE_STORAGE_KEY,
  type OpenSeatMatch,
} from '@/lib/find-your-seat';
import type { EventTableRow } from '@/lib/seating';
import type { EntrancePos } from '@/lib/indoor-blueprint';
import { useDayOfLiveTick } from '@/lib/use-day-of-live-refresh';
import { Postmark, StepUp } from './seat-frame';

/**
 * Section B of the prototype — the OPEN link (the general link, or the venue QR
 * on a sign). A guest who left their invitation at home still needs a table, so
 * the search stays (owner 2026-09-27, "ok to all"), and it is built so a stranger
 * learns nothing from it:
 *
 *   · it answers only an EXACT full name (the RPC's rule since 2026-09-20), so it
 *     fires on the button, never per keystroke — a type-ahead against an exact
 *     match could only ever be wrong until the last letter, and would spend the
 *     quiet rate limit on half-typed names;
 *   · the result is a TABLE and the ROOM. ⛔ No name is rendered — not anyone's,
 *     not even the searcher's own (the response carries none; see
 *     `OpenSeatMatch`);
 *   · "not on the list" and "not seated yet" are ONE message
 *     (`noTableForThatName`): the route cannot tell them apart and this does
 *     not try;
 *   · a failed lookup says "try again", never the not-found message — a seated
 *     guest must not be told their name is on no table because a read failed.
 *
 * Day-of: the last successful lookup re-fires quietly (PR 5), so a guest who
 * looked once sees a reseat without re-typing.
 */
type Outcome =
  | { kind: 'idle' }
  | { kind: 'found'; matches: OpenSeatMatch[] }
  | { kind: 'none' }
  | { kind: 'slow_down' }
  | { kind: 'failed' };

/** The id this browser keeps for the quiet per-device limit. Never a name, never sent anywhere else. */
function deviceId(): string | null {
  try {
    const kept = window.localStorage.getItem(SEAT_DEVICE_STORAGE_KEY);
    if (isSeatDeviceId(kept)) return kept;
    const bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    const minted = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    window.localStorage.setItem(SEAT_DEVICE_STORAGE_KEY, minted);
    return minted;
  } catch {
    // Storage off (a private window, an in-app webview): the route falls back
    // to connection + browser, which is still a per-device answer.
    return null;
  }
}

export function NameSearch({
  slug,
  names,
  eventDate,
  tables,
  entrance,
  postmark = null,
}: {
  slug: string;
  /** The couple's names ("Indalecio & Claire") — whose list this is. */
  names: string;
  eventDate?: string | null;
  /** The PUBLISHED plan's tables (the room a found table is lit in). */
  tables: EventTableRow[];
  entrance: EntrancePos;
  /** The Vintage postmark, drawn only while the head is up (B1). */
  postmark?: string | null;
}) {
  const [q, setQ] = useState('');
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // The last query that FOUND a table — what the day-of tick re-fires.
  const lastFoundRef = useRef<string | null>(null);

  const runSearch = useCallback(
    async (clean: string, { quiet = false }: { quiet?: boolean } = {}) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (!quiet) setLoading(true);
      try {
        const headers: Record<string, string> = {};
        const id = deviceId();
        if (id) headers[SEAT_DEVICE_HEADER] = id;
        const res = await fetch(
          `/api/seat-lookup/${encodeURIComponent(slug)}?q=${encodeURIComponent(clean)}`,
          { signal: ctrl.signal, headers },
        );
        if (res.status === 429) {
          if (!quiet) setOutcome({ kind: 'slow_down' });
          return;
        }
        if (!res.ok) {
          if (!quiet) setOutcome({ kind: 'failed' });
          return;
        }
        const json = (await res.json()) as { matches?: OpenSeatMatch[] };
        const matches = Array.isArray(json.matches) ? json.matches : [];
        if (matches.length > 0) {
          lastFoundRef.current = clean;
          setOutcome({ kind: 'found', matches });
        } else if (!quiet) {
          setOutcome({ kind: 'none' });
        }
      } catch (err) {
        // A quiet day-of refresh that fails leaves the shown table alone.
        if ((err as Error).name !== 'AbortError' && !quiet) setOutcome({ kind: 'failed' });
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [slug],
  );

  useDayOfLiveTick(eventDate, () => {
    const clean = lastFoundRef.current;
    if (clean) void runSearch(clean, { quiet: true });
  });

  const clean = sanitizeSeatLookupQuery(q);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clean || loading) return;
    void runSearch(clean);
  }

  /** B3's one button: keep what they typed, hand the field back to them to fix. */
  function tryAgain() {
    setOutcome({ kind: 'idle' });
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  function clear() {
    setQ('');
    setOutcome({ kind: 'idle' });
    lastFoundRef.current = null;
    inputRef.current?.focus();
  }

  const answered = outcome.kind === 'found' || outcome.kind === 'none';
  const found = outcome.kind === 'found' ? outcome.matches : null;
  const lit = found ? tables.find((t) => t.table_label.trim() === found[0]!.table_label) ?? null : null;
  const none = noTableForThatName(names);

  return (
    <div>
      {/* In the content box, 52px below the frame's own top — the same spot the frame draws it. */}
      {postmark && !answered ? <Postmark date={postmark} top="top-3" /> : null}
      <section className="px-6 pt-3 text-center">
        <p className="m-0 text-[0.72rem] uppercase tracking-[0.22em] text-terracotta-700">Find your seat</p>
        {answered ? null : (
          <>
            <p className="m-0 mt-1 font-serif text-[2.4rem] italic leading-none text-terracotta-700">which table?</p>
            <h1 className="m-0 mt-0.5 font-serif text-[2rem] font-medium leading-[1.12] text-ink">Type your full name</h1>
            <p className="mt-2.5 text-[0.84rem] leading-relaxed text-ink/75">
              First and last name, the way {names} would have written it.
            </p>
          </>
        )}
      </section>

      <form onSubmit={submit} className="contents" noValidate>
        <div className="mx-6 mt-[18px] text-left">
          <label htmlFor="find-seat-name" className="mb-1.5 block text-[0.6875rem] uppercase tracking-[0.18em] text-terracotta-700">
            Your name
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="find-seat-name"
              type="text"
              inputMode="text"
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (outcome.kind !== 'idle') setOutcome({ kind: 'idle' });
              }}
              placeholder="First and last name"
              className="min-h-[58px] w-full rounded-[var(--hub-radius,0.75rem)] border border-ink/50 bg-cream/75 py-3 pl-4 pr-12 font-serif text-[1.35rem] text-ink shadow-[inset_0_2px_0_rgba(255,255,255,0.5)] outline-none placeholder:text-lg placeholder:italic placeholder:text-ink/45 focus:border-ink"
            />
            {q ? (
              <button
                type="button"
                onClick={clear}
                aria-label="Not you? Clear and try another name"
                className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-xl text-ink/70"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        {found ? (
          <FoundCard matches={found} tables={tables} entrance={entrance} litId={lit?.table_id ?? null} />
        ) : null}

        {outcome.kind === 'none' ? (
          <div className="mx-6 mt-4 rounded-[var(--hub-radius,1rem)] border border-ink/25 bg-cream/60 px-4 pb-4 pt-3.5 text-center" aria-live="polite" data-no-table>
            <p className="m-0 font-serif text-[2.2rem] italic leading-none text-terracotta-700">hmm</p>
            <p className="m-0 mt-1 font-serif text-[1.6rem] font-medium leading-tight text-ink [text-wrap:balance]">{none.title}</p>
            {none.lines.map((line) => (
              <p key={line} className="m-0 mt-2 text-left text-[0.84rem] leading-normal text-ink/75">
                {line}
              </p>
            ))}
          </div>
        ) : null}

        {outcome.kind === 'slow_down' || outcome.kind === 'failed' ? (
          <p className="mx-6 mt-4 rounded-[var(--hub-radius,0.75rem)] border border-dashed border-ink/45 px-4 py-3 text-center text-sm text-ink/80" aria-live="polite">
            {outcome.kind === 'slow_down'
              ? 'That’s a lot of tries in a row — give it a minute, then try again.'
              : 'We couldn’t check just now. Your seat is fine — try again in a moment.'}
          </p>
        ) : null}

        {/* ONE BUTTON: "Find my table", or "Try again" after a miss. A found table needs none. */}
        {found ? null : outcome.kind === 'none' ? (
          <div className="mx-6 mt-[18px]">
            <button type="button" onClick={tryAgain} className={BUTTON}>
              <SearchGlyph />
              Try again
            </button>
          </div>
        ) : (
          <div className="mx-6 mt-[18px]">
            <button type="submit" disabled={!clean || loading} aria-busy={loading} className={`${BUTTON} disabled:opacity-60`}>
              <SearchGlyph />
              {loading ? 'Looking…' : 'Find my table'}
            </button>
          </div>
        )}
      </form>

      <StepUp slug={slug}>
        {found
          ? 'Open your invitation to see who’s at your table and your door pass.'
          : outcome.kind === 'none'
            ? 'Have your invitation? Open it and your seat is already there.'
            : 'Have your invitation? Open it and your seat is already there — no typing.'}
      </StepUp>
    </div>
  );
}

const BUTTON =
  'flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-[var(--hub-radius,0.75rem)] bg-ink px-6 text-[0.8125rem] uppercase tracking-[0.18em] text-cream shadow-[0_14px_26px_-16px_rgb(var(--color-ink)/0.75)]';

/**
 * B2 · the table and the room — and NOTHING that names anyone. A same-name pair
 * seated apart is the one case with two answers; both tables are said, and a
 * host at the door settles it.
 */
export function FoundCard({
  matches,
  tables,
  entrance,
  litId,
}: {
  matches: OpenSeatMatch[];
  tables: EventTableRow[];
  entrance: EntrancePos;
  litId: string | null;
}) {
  const [walkOpen, setWalkOpen] = useState(false);
  const first = matches[0]!;
  const video = first.walk_video_url ?? null;
  return (
    <div className="mx-6 mt-4 rounded-[var(--hub-radius,1rem)] border border-ink/25 bg-cream/60 px-4 pb-4 pt-3.5 text-center" aria-live="polite" data-found-table>
      <p className="m-0 font-serif text-[2.2rem] italic leading-none text-terracotta-700">you&rsquo;re at</p>
      <p className="m-0 mt-0.5 font-serif text-[3.25rem] font-medium leading-[1.02] text-ink">
        {matches.length > 1 ? matches.map((m) => m.table_label).join(' or ') : first.table_label}
      </p>
      {tables.length > 0 ? (
        <div className="-mx-1 mt-2.5">
          <WayfindingMap look="theme" tables={tables} entrance={entrance} targetTableId={litId} />
        </div>
      ) : null}
      <p className="m-0 mt-2 text-[0.84rem] leading-normal text-ink/75">
        {matches.length > 1
          ? 'Two guests share that name. A host at the door can tell you which table is yours.'
          : 'Walk in from the entrance and follow the dotted path.'}
      </p>
      {video ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setWalkOpen((v) => !v)}
            aria-expanded={walkOpen}
            className="text-sm text-terracotta-700 underline underline-offset-[3px]"
          >
            {walkOpen ? 'Hide the walk' : 'Watch the walk to your table'}
          </button>
          {walkOpen ? (
            <video
              controls
              playsInline
              preload="metadata"
              src={video}
              className="mx-auto mt-3 aspect-[9/16] w-2/3 rounded-[var(--hub-radius,0.5rem)] border border-ink/15 bg-black object-contain"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </svg>
  );
}
