'use client';

import { AlertTriangle, Check, ChevronRight, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { formatCount } from '@/lib/format-number';
import {
  SEAT_CHECK_GOOD,
  SEAT_PROBLEM_TITLES,
  seatCheckLine,
  seatChecksAllGood,
  suggestionSeatWords,
  type DryRun,
  type SeatCheckState,
  type SeatProblem,
  type SeatSuggestion,
} from '@/lib/seat-check';

/**
 * ✦ SEAT PLAN S · THE SMART LAYER (owner 28 Nov 2026; `SEAT-PLAN-COMPLETE-2026-11-27.md` § 4.4; drawing
 * `prototypes/seating_later_2026-11-27/` S). No new page — three small pieces Seats › List draws:
 *   · `CardSuggestion` — the strip under a card with empty seats: ✦ the suggested names, the reason, "Seat N", and ONE
 *     press that seats them (a +1 / household as one unit) — the editor's own seat write, with its Undo line;
 *   · `SeatCheckLine` — ONE line under the counts: "⚠ N to look at ›" only when N > 0; a failed check says
 *     "Couldn't check seats · Try again" — never a false "All good";
 *   · `SeatCheckSheet` — each problem with its plain reason and ONE Fix (or Review), then "All good", then ONE main
 *     "Fix all".
 * The words are `lib/seat-check.ts`'s; the answers are the engine's dry run (L11). 🔒 lib/the-seat-check-is-honest.test.ts
 */

export function CardSuggestion({
  suggestion,
  names,
  seats,
  onTake,
}: {
  suggestion: SeatSuggestion;
  /** The suggested guests' short names, as the card names them. */
  names: readonly string[];
  /** The free chairs they would take, in order. */
  seats: readonly number[];
  onTake: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-ink/10 px-1 pb-2" data-seat-suggest={suggestion.tableId}>
      <Sparkles aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sn-md font-medium text-ink" data-seat-suggest-names="">
          {names.join(', ')}
        </span>
        <span className="block text-sn-sm text-ink/70 [overflow-wrap:anywhere]" data-seat-suggest-why="">
          {suggestion.reason}
          {seats.length ? ` · ${suggestionSeatWords(seats, formatCount)}` : ''}
        </span>
      </span>
      <ActionButton tone="brand" icon={Check} label="Seat" name={`Seat ${names.join(', ')}`} onClick={onTake} data-testid="seat-suggest-take" />
    </div>
  );
}

export function SeatCheckLine({ state, onOpen, onRetry }: { state: SeatCheckState; onOpen: () => void; onRetry: () => void }) {
  const line = seatCheckLine(state);
  if (!line) return null;
  if (line.failed) {
    return (
      <span className="flex min-w-0 items-center gap-2 text-sn-sm text-ink/70" data-seat-check-line="failed" role="status">
        <span className="min-w-0 flex-1">Couldn’t check seats</span>
        <ActionButton tone="neutral" quiet icon={RotateCcw} label="Try again" onClick={onRetry} data-testid="seat-check-retry" />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 w-full min-w-0 items-center gap-2 text-left text-sn-md font-medium text-ink"
      data-seat-check-line="problems"
    >
      <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-warn-700" strokeWidth={2} />
      <span className="min-w-0 flex-1">{line.words}</span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/60" strokeWidth={2} />
    </button>
  );
}

export function SeatCheckSheet({
  run,
  open,
  onClose,
  tableLabel,
  onFix,
  onFixAll,
}: {
  run: DryRun;
  open: boolean;
  onClose: () => void;
  tableLabel: (tableId: string | null) => string;
  onFix: (problem: SeatProblem) => void;
  onFixAll: () => void;
}) {
  const good = seatChecksAllGood(run);
  const fixable = run.problems.filter((p) => p.fix.kind === 'seat').length;
  return (
    <Sheet open={open} onClose={onClose} labelledById="seat-check-title" rise>
      <div className="flex min-w-0 flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4" data-seat-check-sheet="">
        <h2 id="seat-check-title" className="pr-10 text-sn-xl font-semibold text-ink">
          {formatCount(run.problems.length)} to look at
        </h2>
        <ul className="flex flex-col">
          {run.problems.map((p, i) => (
            <li key={`${p.kind}-${i}`} className="flex min-w-0 items-center gap-3 border-t border-ink/10 py-2" data-seat-problem={p.kind}>
              <span className="min-w-0 flex-1">
                <span className="block text-sn-md font-medium text-ink">{SEAT_PROBLEM_TITLES[p.kind]}</span>
                <span className="block text-sn-sm text-ink/70 [overflow-wrap:anywhere]">
                  {p.reason}
                  {p.tableId ? ` · ${tableLabel(p.tableId)}` : ''}
                </span>
              </span>
              <ActionButton
                tone="neutral"
                icon={p.fix.kind === 'seat' ? Wand2 : ChevronRight}
                label={p.fix.kind === 'seat' ? 'Fix' : 'Review'}
                name={`${p.fix.kind === 'seat' ? 'Fix' : 'Review'}: ${SEAT_PROBLEM_TITLES[p.kind]}`}
                onClick={() => onFix(p)}
                data-testid="seat-problem-fix"
              />
            </li>
          ))}
        </ul>
        {good.length ? (
          <div data-seat-check-good="">
            <p className="text-sn-xs font-bold uppercase tracking-[0.1em] text-ink/60">All good</p>
            <ul className="flex flex-col">
              {good.map((k) => (
                <li key={k} className="flex min-h-11 items-center gap-2 border-t border-ink/10 text-sn-md text-ink/80">
                  <Check aria-hidden className="h-4 w-4 shrink-0 text-success-600" strokeWidth={2.2} />
                  {SEAT_CHECK_GOOD[k]}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {fixable > 0 ? (
          <ActionButton tone="brand" main icon={Wand2} label="Fix all" onClick={onFixAll} className="w-full justify-center" data-testid="seat-check-fix-all" />
        ) : null}
      </div>
    </Sheet>
  );
}
