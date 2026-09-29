'use client';

import { use, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import type { MatrixDate, ScheduleMatrix } from '@/lib/schedule-matrix';
import { formatCount } from '@/lib/format-number';
import {
  CategoryLine,
  comboSummary,
  coverageHeadline,
  rankWithPin,
} from '../../find-date/_components/find-your-date';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { useDetailsPiece } from './details-go';

/**
 * FIND YOUR DATE, IN THE MAKER'S THREE PARTS (owner 2026-09-29, DECISION_LOG
 * "THE DATE FINDER LIVES IN STEP 2 …" + "A TOOL MOVED INTO THE MAKER IS
 * REBUILT INTO THE THREE PARTS"): the shipped finder's ranking, words and
 * matrix — `find-your-date.tsx`'s own helpers — laid out as
 *
 *   MIDDLE  the candidate days, ranked (the top three first) — tap to pick one;
 *   RIGHT   the picked day: who works together on it, "Use <day>", the
 *           must-have supplier, and a month to compare instead.
 *
 * The picked day and the must-have are one shared value for both parts
 * (`useDetailsPiece`). Nothing here writes: "Use <day>" hands the day to the
 * date's own governed save (`DateEditor`), a month goes through the same
 * `updateEventDate`.
 */

const TOP = 3;

/**
 * THE DATE ITEM'S ONE PIECE (part 3's mechanism, `details-go.tsx`, under
 * 'date'): "I have a date" or "Help me choose" — and, while helping, the picked
 * day and the must-have supplier — so the middle and the right read one value.
 * Stored as `have` or `help|<day>|<supplier>`; nothing picked yet means
 * "I have a date" (or "Help me choose" when the page opened there).
 */
export type DateState = { mode: 'have' | 'help'; pick: string | null; pin: string | null };

export function parseDateState(piece: string | null, helpFirst = false): DateState {
  if (!piece) return { mode: helpFirst ? 'help' : 'have', pick: null, pin: null };
  const [mode, pick, pin] = piece.split('|');
  return { mode: mode === 'help' ? 'help' : 'have', pick: pick || null, pin: pin || null };
}

export function formatDateState(s: DateState): string {
  return s.mode === 'have' ? 'have' : `help|${s.pick ?? ''}|${s.pin ?? ''}`;
}

export function useDateState(helpFirst = false): [DateState, (patch: Partial<DateState>) => void] {
  const [piece, setPiece] = useDetailsPiece('date');
  const state = parseDateState(piece, helpFirst);
  return [state, (patch) => setPiece(formatDateState({ ...state, ...patch }))];
}

function useRanked(m: ScheduleMatrix) {
  const [{ pin: pinned }] = useDateState(true);
  return useMemo(() => (m.exactDate ? m.dates : rankWithPin(m.dates, pinned)), [m.dates, m.exactDate, pinned]);
}

/** MIDDLE — the candidate days, best first. */
export function FindDateCandidates({ matrix }: { matrix: Promise<ScheduleMatrix | null> }) {
  const m = use(matrix);
  const [{ pick: picked }, setDate] = useDateState(true);
  const setPicked = (dateKey: string) => setDate({ mode: 'help', pick: dateKey });
  const [all, setAll] = useState(false);
  const ranked = useRanked(m ?? { hasDate: false, hasShortlist: false, exactDate: false, offPlatformCount: 0, dates: [] });
  if (!m) return <Unread />;
  if (!m.hasDate) {
    return <p className="text-sm text-ink/65">Choose a month on the right — its Saturdays appear here, ranked by how many of your suppliers are free.</p>;
  }
  const shown = all ? ranked : ranked.slice(0, TOP);
  const current = picked ?? ranked[0]?.dateKey ?? null;
  return (
    <section className="flex w-full max-w-xl flex-col gap-2" data-find-date-candidates="">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
        {m.exactDate ? 'Your date' : `The days you're considering — ranked by your suppliers`}
      </p>
      {!m.hasShortlist ? (
        <p className="text-xs text-ink/55">You haven&apos;t picked any suppliers yet, so every day below is open.</p>
      ) : null}
      <ol className="flex flex-col gap-2">
        {shown.map((d, i) => (
          <li key={d.dateKey}>
            <button
              type="button"
              aria-pressed={d.dateKey === current}
              onClick={() => setPicked(d.dateKey)}
              data-find-date-candidate={d.dateKey}
              className={`sn-press flex min-h-14 w-full items-center gap-3 rounded-xl bg-white/85 px-4 py-3 text-left shadow-[0_1px_2px_rgba(40,34,24,.06)] ${
                d.dateKey === current ? 'ring-2 ring-ink' : ''
              }`}
            >
              <span className="w-5 shrink-0 font-mono text-[11px] text-ink/45">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold tracking-tight text-ink">{d.label}</span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">{d.dow}</span>
                  {d.isBest ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2 py-0.5 text-[11px] font-medium text-terracotta-700">
                      <Star aria-hidden className="h-3 w-3" strokeWidth={2.25} />
                      Best match
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-sm text-ink/60">{coverageHeadline(d)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      {ranked.length > TOP ? (
        <button type="button" onClick={() => setAll((a) => !a)} className="min-h-11 self-start text-sm font-medium text-ink/70 underline underline-offset-2">
          {all ? 'Show the top three' : `Show all ${formatCount(ranked.length)} days`}
        </button>
      ) : null}
    </section>
  );
}

/** RIGHT — the picked day, and what to do with it. */
export function FindDatePicked({
  matrix,
  onUse,
  onMonth,
  monthError,
  pending,
}: {
  matrix: Promise<ScheduleMatrix | null>;
  onUse: (dateKey: string) => void;
  onMonth: (month: string) => void;
  monthError: string | null;
  pending: boolean;
}) {
  const m = use(matrix);
  const [{ pick: picked, pin: pinned }, setDate] = useDateState(true);
  const setPinned = (pin: string | null) => setDate({ mode: 'help', pin });
  const ranked = useRanked(m ?? { hasDate: false, hasShortlist: false, exactDate: false, offPlatformCount: 0, dates: [] });
  const pins = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; label: string }[] = [];
    for (const cat of m?.dates[0]?.categories ?? []) {
      for (const v of cat.vendors) {
        if (v.state === 'unknown' || seen.has(v.key)) continue;
        seen.add(v.key);
        out.push({ key: v.key, label: `${v.name} · ${cat.label}` });
      }
    }
    return out;
  }, [m]);
  if (!m) return <Unread />;
  const date: MatrixDate | null = ranked.find((d) => d.dateKey === picked) ?? ranked[0] ?? null;
  return (
    <section className="flex flex-col gap-3" data-find-date-picked={date?.dateKey ?? ''}>
      {date ? (
        <>
          <div>
            <p className="font-serif text-lg text-ink">
              {date.label} <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">{date.dow}</span>
            </p>
            <p className="text-sm text-ink/60">{coverageHeadline(date)}</p>
          </div>
          {date.categories.length ? (
            <div>
              <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">Who works together</p>
              <ul className="divide-y divide-ink/[0.06]">
                {date.categories.map((cat) => (
                  <CategoryLine key={cat.category} cat={cat} />
                ))}
              </ul>
              <p className="mt-2 text-sm font-medium text-ink/75">{comboSummary(date)}</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => onUse(date.dateKey)}
            data-find-date-use={date.dateKey}
            className="inline-flex min-h-11 w-fit items-center rounded-xl bg-mulberry px-4 text-sm font-medium text-white"
          >
            Use {date.label}
          </button>
        </>
      ) : null}
      {!m.exactDate && pins.length > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink">Must-have supplier</span>
          <PickMenu
            label="Must-have supplier"
            value={pinned ?? 'none'}
            dataAttr="data-find-date-pin"
            options={[{ key: 'none', label: 'None' }, ...pins]}
            onPick={(k) => setPinned(k === 'none' ? null : k)}
          />
        </div>
      ) : null}
      {m.offPlatformCount > 0 ? (
        <p className="text-xs text-ink/55">
          {formatCount(m.offPlatformCount)} of your suppliers {m.offPlatformCount === 1 ? 'is' : 'are'} not on Setnayan — we can&apos;t see
          their calendar, so they show as &ldquo;confirm directly.&rdquo;
        </p>
      ) : null}
      <MonthPick
        onMonth={onMonth}
        error={monthError}
        pending={pending}
        prompt={
          !m.hasDate
            ? "Which month are you considering? We'll compare its Saturdays."
            : m.exactDate
              ? 'Considering other days? Choose a month to compare its Saturdays — your date becomes that month until you pick a day.'
              : 'Compare another month instead.'
        }
      />
    </section>
  );
}

function Unread() {
  // A read that failed is said, never drawn as "no dates".
  return (
    <p role="alert" className="text-sm text-danger-800">
      Your suppliers’ calendars could not be read just now. Your date is unchanged — please try again.
    </p>
  );
}

/** A month, saved through the same date writer — the in-place stand-in for the old "Pick your date" link. */
function MonthPick({ onMonth, prompt, error, pending }: { onMonth: (month: string) => void; prompt: string; error: string | null; pending: boolean }) {
  const [month, setMonth] = useState('');
  const min = new Date().toISOString().slice(0, 7);
  return (
    <div className="flex flex-col gap-2 pt-1" data-find-date-month="">
      <p className="text-sm text-ink/70">{prompt}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" min={min} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="The month you are considering" className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink" />
        <button
          type="button"
          disabled={!month || pending}
          onClick={() => onMonth(month)}
          className="inline-flex min-h-11 items-center rounded-xl bg-mulberry px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Compare its Saturdays'}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
