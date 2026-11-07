'use client';

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { BellRing, ChevronDown, ChevronRight, ListOrdered, Loader2 } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { formatWallClock } from '@/lib/schedule-datetime-local';
import { formatCount } from '@/lib/format-number';
import { numberState, numberStateWords, scanNumberLabel, type ScanNumberRow } from '@/lib/supplier-scan';
import { supplierScan } from '@/app/_actions/supplier-scan-actions';

/**
 * 🎟 YOUR NUMBERS — the supplier's own list, newest first (approved prototype `supplier_scan_2026-10-03_fable.html`,
 * frames D and F): "#0042 · 1 guest · 7:41 PM · Ordered". Counts only — no guest id or name crosses.
 *
 * Tap a number and it opens IN PLACE (house rule: a row is opened by a tap, never carries buttons of its own); open,
 * an ordered number offers Ready — "the supplier taps Ready on the item → the linked guest is announced" (DECISION_LOG
 * 2026-09-25), through the ONE announcement channel, on that guest's Event Hub only. A Ready never resets the list:
 * the row says "Ready · waiting" at once and the count above moves with it.
 */
export function YourNumbers({
  eventId,
  coverageId,
  onReady,
  labRows = null,
}: {
  /** The dev lab's list, drawn open (its frames only — `/dev/supplier-lab?s=event-hub&view=scanner&numbers=1`). */
  labRows?: ScanNumberRow[] | null;
  eventId: string;
  coverageId: number;
  /** Tells the scanner's count that `told` guests moved from Ordered to Ready. */
  onReady: (told: number) => void;
}) {
  const [shown, setShown] = useState(labRows !== null);
  const [rows, setRows] = useState<ScanNumberRow[] | null | 'loading'>(labRows ?? 'loading');
  const [open, setOpen] = useState<number | null>(labRows?.find((r) => r.ordered > 0 && !r.open)?.number ?? null);
  const [line, setLine] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Opening the list glides its head up when it runs past the bottom — the app-wide reveal-on-open (owner 2026-11-04).
  const listHead = useRef<HTMLButtonElement>(null);
  const intendList = useRevealOnOpen(shown, () => ({ head: listHead.current }));

  const load = useCallback(async () => {
    setRows('loading');
    try {
      const reply = await supplierScan({ op: 'numbers', eventId, coverageId });
      setRows(reply.op === 'numbers' ? reply.result : null);
    } catch {
      setRows(null);
    }
  }, [eventId, coverageId]);

  useEffect(() => {
    if (shown && labRows === null) void load();
  }, [shown, load, labRows]);

  const ready = (r: ScanNumberRow) => {
    setLine(null);
    start(async () => {
      try {
        const reply = await supplierScan({ op: 'ready', eventId, coverageId, number: r.number });
        if (reply.op !== 'ready' || !reply.result.ok) {
          setLine(reply.op === 'ready' && !reply.result.ok ? reply.result.error : 'Couldn’t mark it ready. Try again.');
          return;
        }
        const told = reply.result.told;
        setRows((rs) =>
          Array.isArray(rs)
            ? rs.map((x) => (x.number === r.number ? { ...x, ready: x.ready + x.ordered, ordered: 0, readyAt: new Date().toISOString() } : x))
            : rs,
        );
        onReady(told);
        setLine(told > 0 ? `${scanNumberLabel(r.number)} is ready — ${told === 1 ? 'the guest was' : `${formatCount(told)} guests were`} told on the guests’ page.` : 'Nothing was waiting on that number.');
      } catch {
        setLine('No signal — Ready was not sent. Try again when the signal is back.');
      }
    });
  };

  return (
    <section aria-label="Your numbers" data-your-numbers={shown ? 'open' : 'closed'}>
      <button
        ref={listHead}
        type="button"
        onClick={() => {
          intendList();
          setShown((v) => !v);
        }}
        aria-expanded={shown}
        className="sn-press flex min-h-12 w-full items-center gap-3 border-b border-ink/10 py-2 text-left"
      >
        <ListOrdered aria-hidden className="h-5 w-5 flex-none text-ink/55" strokeWidth={1.8} />
        <span className="min-w-0 flex-1 text-[15px] font-medium text-ink">Your numbers</span>
        {shown ? (
          <ChevronDown aria-hidden className="h-4 w-4 flex-none text-sn-accent" strokeWidth={2} />
        ) : (
          <ChevronRight aria-hidden className="h-4 w-4 flex-none text-sn-accent" strokeWidth={2} />
        )}
      </button>
      {shown ? (
        rows === 'loading' ? (
          <p className="flex items-center gap-2 py-3 text-[14px] text-ink/60">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.8} /> Loading…
          </p>
        ) : rows === null ? (
          <p role="alert" className="py-3 text-[14px] text-ink/70">
            <strong className="text-ink">We couldn&rsquo;t load your numbers just now.</strong> Your scans are safe — only this list is missing.
          </p>
        ) : rows.length === 0 ? (
          <p className="py-3 text-[14px] text-ink/60">No numbers yet — your first scan makes #0001.</p>
        ) : (
          <ul className="divide-y divide-ink/10" data-your-numbers-list="">
            {rows.map((r) => {
              const isOpen = open === r.number;
              const st = numberState(r);
              return (
                <NumberRow
                  key={r.number}
                  number={r.number}
                  state={st}
                  isOpen={isOpen}
                  onToggle={() => setOpen(isOpen ? null : r.number)}
                  head={
                    <>
                    <span className="w-16 flex-none font-pahina text-xl tabular-nums text-ink">{scanNumberLabel(r.number)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-ink">
                        {formatCount(r.guests)} {r.guests === 1 ? 'guest' : 'guests'}
                        {r.prints != null ? ` · ${formatCount(r.prints)} ${r.prints === 1 ? 'print' : 'prints'}` : ''} · {formatWallClock(r.firstAt)}
                      </span>
                      <span className={`block truncate text-[12.5px] ${st === 'ready' ? 'font-medium text-ink' : 'text-ink/60'}`}>{numberStateWords(r)}</span>
                    </span>
                    <ChevronRight aria-hidden className={`h-4 w-4 flex-none text-sn-accent transition-transform ${isOpen ? 'rotate-90' : ''}`} strokeWidth={2} />
                    </>
                  }
                >
                    <div className="space-y-2 pb-3 pl-16" data-your-number-open={r.number}>
                      <p className="text-[13px] text-ink/65">
                        {[`Ordered ${formatWallClock(r.firstAt)}`, r.readyAt ? `Ready ${formatWallClock(r.readyAt)}` : null, r.receivedAt ? `Received ${formatWallClock(r.receivedAt)}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {r.ordered > 0 && !r.open ? (
                        <ActionButton tone="brand" main icon={BellRing} label="Ready" name={`${scanNumberLabel(r.number)} is ready`} disabled={pending} onClick={() => ready(r)} />
                      ) : null}
                    </div>
                </NumberRow>
              );
            })}
          </ul>
        )
      ) : null}
      {line ? (
        <p role="status" className="pt-2 text-[13.5px] text-ink/70">
          {line}
        </p>
      ) : null}
    </section>
  );
}

/** One number: a tap opens it in place, and its head glides up when the opening runs past the bottom (app-wide). */
function NumberRow({
  number,
  state,
  isOpen,
  onToggle,
  head,
  children,
}: {
  number: number;
  state: string;
  isOpen: boolean;
  onToggle: () => void;
  head: ReactNode;
  children: ReactNode;
}) {
  const row = useRef<HTMLLIElement>(null);
  const intend = useRevealOnOpen(isOpen, () => ({ head: row.current }));
  return (
    <li ref={row} data-your-number-row={number} data-state={state}>
      <button
        type="button"
        onClick={() => {
          intend();
          onToggle();
        }}
        aria-expanded={isOpen}
        className="sn-press flex min-h-[56px] w-full items-center gap-3 py-2 text-left"
      >
        {head}
      </button>
      {isOpen ? children : null}
    </li>
  );
}
