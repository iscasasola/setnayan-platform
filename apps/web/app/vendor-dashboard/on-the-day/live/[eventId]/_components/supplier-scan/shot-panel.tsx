'use client';

import { useEffect, useState, useTransition } from 'react';
import { Camera, Check, Minus, Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { clampPrints, scanNumberLabel } from '@/lib/supplier-scan';
import { formatCount } from '@/lib/format-number';
import { supplierScan } from '@/app/_actions/supplier-scan-actions';

/**
 * 📸 ONE SHOT, ONE NUMBER — the Group session's panel (DECISION_LOG 2026-09-25 "GROUP SESSIONS… print count = guests
 * scanned, adjustable"; prototype frame C: "#0042 · 3 guests … Done").
 *
 *   · no shot open → New shot (the number is allocated by the database when it opens, so two phones share it);
 *   · a shot open → its number and how many guests are in it, Prints −/+ (one per guest until the operator changes it),
 *     and Done. Done with nobody scanned cancels the shot and gives the number back.
 *
 * After Done the shot waits on "Your numbers" for Ready — Ready tells each of its guests on their Event Hub.
 * A save never resets the screen: the number stays on screen until the database says the shot is closed.
 */
export function ShotPanel({
  eventId,
  coverageId,
  open,
  onOpened,
  onClosed,
}: {
  eventId: string;
  coverageId: number;
  /** The open shot (from the count, and moved by each scan), or null. */
  open: { number: number; guests: number } | null;
  onOpened: (number: number, guests: number) => void;
  onClosed: (outcome: 'done' | 'cancelled' | 'none_open') => void;
}) {
  const [prints, setPrints] = useState<number | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const guests = open?.guests ?? 0;
  const shown = prints ?? Math.max(1, guests);

  // Until the operator touches −/+, prints follow the guests scanned.
  useEffect(() => {
    if (!open) setPrints(null);
  }, [open]);

  const newShot = () => {
    setLine(null);
    start(async () => {
      try {
        const reply = await supplierScan({ op: 'session_open', eventId, coverageId });
        if (reply.op === 'session_open' && reply.result.ok) onOpened(reply.result.number, reply.result.guests);
        else setLine(reply.op === 'session_open' && !reply.result.ok ? reply.result.error : 'Couldn’t open a shot. Try again.');
      } catch {
        setLine('No signal — no shot was opened. Try again when the signal is back.');
      }
    });
  };

  const done = () => {
    setLine(null);
    start(async () => {
      try {
        const reply = await supplierScan({ op: 'session_done', eventId, coverageId, prints: guests > 0 ? (prints ?? null) : null });
        if (reply.op !== 'session_done' || !reply.result.ok) {
          setLine(reply.op === 'session_done' && !reply.result.ok ? reply.result.error : 'Couldn’t close the shot. Try again.');
          return;
        }
        const r = reply.result;
        if (r.outcome === 'done') {
          setLine(`${scanNumberLabel(r.number)} · ${formatCount(r.guests)} ${r.guests === 1 ? 'guest' : 'guests'} · ${formatCount(r.prints)} ${r.prints === 1 ? 'print' : 'prints'}. Tap Ready on it under Your numbers when it’s printed.`);
        } else if (r.outcome === 'cancelled') {
          setLine(`${scanNumberLabel(r.number)} had nobody in it — cancelled.`);
        }
        onClosed(r.outcome);
      } catch {
        setLine('No signal — the shot is still open. Tap Done again when the signal is back.');
      }
    });
  };

  return (
    <div className="space-y-3 border-y border-ink/10 py-3" data-shot-panel={open ? 'open' : 'closed'}>
      {open ? (
        <>
          <p className="flex items-baseline justify-between gap-3">
            <span className="font-pahina text-3xl font-light tabular-nums text-ink">{scanNumberLabel(open.number)}</span>
            <span className="text-[14px] text-ink/70" data-shot-guests={guests}>
              {formatCount(guests)} {guests === 1 ? 'guest' : 'guests'} in this shot
            </span>
          </p>
          {guests > 0 ? (
            <div className="flex items-center gap-3" data-shot-prints={shown}>
              <span className="min-w-0 flex-1 text-[14px] text-ink">Prints</span>
              <button
                type="button"
                aria-label="One print fewer"
                disabled={pending || shown <= 1}
                onClick={() => setPrints(clampPrints(shown - 1))}
                className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/20 text-ink disabled:opacity-40"
              >
                <Minus aria-hidden className="h-4 w-4" strokeWidth={2} />
              </button>
              <span className="w-8 text-center text-[17px] font-semibold tabular-nums text-ink" aria-live="polite">
                {formatCount(shown)}
              </span>
              <button
                type="button"
                aria-label="One print more"
                disabled={pending || shown >= 99}
                onClick={() => setPrints(clampPrints(shown + 1))}
                className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink/20 text-ink disabled:opacity-40"
              >
                <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <p className="text-[13.5px] text-ink/60">Scan everyone in the photo — they share this number.</p>
          )}
          <ActionButton tone="brand" main icon={Check} label={guests > 0 ? 'Done' : 'Cancel this shot'} disabled={pending} onClick={done} />
        </>
      ) : (
        <ActionButton tone="brand" main icon={Camera} label="New shot" disabled={pending} onClick={newShot} />
      )}
      {line ? (
        <p role="status" className="text-[13.5px] text-ink/70">
          {line}
        </p>
      ) : null}
    </div>
  );
}
