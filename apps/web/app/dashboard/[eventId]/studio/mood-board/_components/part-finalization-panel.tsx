'use client';

/**
 * MB12 · "Agreed with your supplier" — the couple's half of the per-part
 * finalization handshake, rendered inside section 02 (Palette) and section 03
 * (Your reception design).
 *
 * ── ONE PANEL, TWO SECTIONS, BECAUSE IT IS ONE MECHANISM ──────────────────
 * People parts (the attire roles) belong under 02; room parts (the zones)
 * belong under 03. Two panels drawn from two components would be two places to
 * change a sentence, and this repo has shipped the disagreement that follows
 * more than once. The panel takes the parts it should list; the sections decide
 * which ones those are.
 *
 * ── NEVER A DEAD BUTTON ───────────────────────────────────────────────────
 * 🔑 THE BRIEF'S OWN REQUIREMENT, AND THE REASON `finalizeBlocker` RETURNS A
 * SENTENCE RATHER THAN A BOOLEAN. Every part that cannot be finalized says why
 * in the row where the control would have been:
 *
 *   · no trade supplies it        → "No supplier trade covers this part yet…"
 *   · no booked supplier in trade → "Book a Florist first — only a supplier you
 *                                    have booked can agree to this part."
 *
 * A disabled control with no explanation is the shape that leaves a couple
 * pressing something that never responds, with nothing anywhere telling them
 * what would make it work.
 *
 * ── WHAT THE STATES MEAN ──────────────────────────────────────────────────
 * The vocabulary is `lib/lock-request-state.ts`'s, read through
 * `partFinalizationStateOf` — the same five values the booking handshake uses,
 * and the same `lockRequestFuseLabel` for the countdown, reading the
 * MATERIALIZED deadline so the number shown is the number enforced.
 *
 * 🛑 AND `locked` HERE MEANS "THE SUPPLIER SAID YES", NEVER "THE SUPPLIER IS
 * BOOKED". `partFinalizationStateOf` takes no status and cannot be told about a
 * booking — the owner's 2026-09-04 ruling, enforced by a signature rather than
 * by this comment.
 */

import { useState, useTransition } from 'react';
import { Check, Lock, Undo2, X } from 'lucide-react';
import {
  lockRequestFuseLabel,
  partFinalizationStateOf,
  partReopenStateOf,
} from '@/lib/lock-request-state';
import {
  eligibleSuppliersForPart,
  finalizeBlocker,
  liveByPart,
  partFreezesNothing,
  type BookedSupplier,
  type PartFinalizationRecord,
} from '@/lib/moodboard-finalization';

export type FinalizationPanelPart = { id: string; label: string };

type ActionResult = { status: string };

export function PartFinalizationPanel({
  parts,
  records,
  booked,
  requestAction,
  cancelAction,
  reopenAction,
  cancelReopenAction,
  emptyHint,
}: {
  parts: readonly FinalizationPanelPart[];
  records: readonly PartFinalizationRecord[];
  booked: readonly BookedSupplier[];
  requestAction: (partId: string, vendorId: string) => Promise<ActionResult>;
  cancelAction: (finalizationId: string) => Promise<ActionResult>;
  reopenAction: (finalizationId: string) => Promise<ActionResult>;
  cancelReopenAction: (finalizationId: string) => Promise<ActionResult>;
  /** Shown when this group has no parts at all — never an empty box. */
  emptyHint: string;
}) {
  const live = liveByPart(records);
  const [pendingPart, setPendingPart] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(partKey: string, fn: () => Promise<ActionResult>) {
    setPendingPart(partKey);
    setMessage(null);
    startTransition(async () => {
      try {
        const r = await fn();
        // A refusal is REPORTED, never swallowed. `not_in_category` and
        // `not_booked` are the two the database and the action can still return
        // after the UI believed otherwise — a stale page, or a booking that
        // changed in another tab — and a silent no-op there is the failure that
        // renders identically to success.
        if (r.status !== 'ok') setMessage(refusalText(r.status));
      } catch (e) {
        setMessage(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setPendingPart(null);
      }
    });
  }

  if (parts.length === 0) {
    return <p className="text-xs text-ink/55">{emptyHint}</p>;
  }

  return (
    <div className="space-y-2">
      {message ? (
        <p
          role="status"
          className="rounded-lg border border-warn-400/40 bg-warn-50 px-3 py-2 text-xs text-warn-900"
        >
          {message}
        </p>
      ) : null}

      <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white">
        {parts.map((part) => {
          const row = live.get(part.id) ?? null;
          const state = partFinalizationStateOf(row);
          const reopen = partReopenStateOf(row);
          const blocker = finalizeBlocker(part.id, booked);
          const eligible = eligibleSuppliersForPart(part.id, booked);
          const busy = pendingPart === part.id;

          return (
            <li key={part.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
              <span className="min-w-[8rem] flex-1 text-sm font-medium text-ink">{part.label}</span>

              {state === 'locked' ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-[11px] font-medium text-success-900">
                    <Lock className="h-3 w-3" aria-hidden />
                    Agreed — settled
                  </span>
                  {/* 🔑 THE HONEST FOOTNOTE. Some parts freeze nothing — their
                      colour is the couple's five majors read directly, and the
                      majors are section 00's own, never touchable by an
                      agreement. Saying "settled" without saying so would
                      promise a stop that does not exist. Which parts those are
                      is derived (`partFreezesNothing`) and pinned by
                      `lib/moodboard-finalization.test.ts`, never counted here.
                      */}
                  {partFreezesNothing(part.id) ? (
                    <span className="text-[11px] text-ink/50">
                      recorded, but its colours still follow your main colours
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink/50">stops following your main colours</span>
                  )}
                  {reopen === 'requested' ? (
                    <>
                      <span className="text-[11px] text-warn-900">
                        Re-open asked ·{' '}
                        {lockRequestFuseLabel(row?.reopen_expires_at ?? null) ?? 'waiting'}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(part.id, () => cancelReopenAction(row!.finalization_id))}
                        className="rounded-full border border-ink/15 px-2.5 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-50"
                      >
                        Never mind
                      </button>
                    </>
                  ) : (
                    <>
                      {reopen === 'declined' ? (
                        <span className="text-[11px] text-ink/55">
                          They would rather keep it
                          {row?.reopen_decline_reason ? ` — “${row.reopen_decline_reason}”` : ''}
                        </span>
                      ) : null}
                      {reopen === 'expired' ? (
                        <span className="text-[11px] text-ink/55">
                          No answer to your last re-open — it stays as agreed
                        </span>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(part.id, () => reopenAction(row!.finalization_id))}
                        className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-50"
                      >
                        <Undo2 className="h-3 w-3" aria-hidden />
                        Ask to change it
                      </button>
                    </>
                  )}
                </>
              ) : state === 'requested' ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-warn-100 px-2 py-0.5 text-[11px] font-medium text-warn-900">
                    Waiting on your supplier
                  </span>
                  <span className="text-[11px] text-ink/55">
                    {lockRequestFuseLabel(row?.expires_at ?? null) ?? 'no deadline recorded'}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(part.id, () => cancelAction(row!.finalization_id))}
                    className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 text-[11px] font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" aria-hidden />
                    Withdraw
                  </button>
                </>
              ) : blocker ? (
                <span className="text-[11px] text-ink/55">{blocker.message}</span>
              ) : (
                <>
                  <ClosedRoundNote records={records} partId={part.id} />
                  {eligible.map((s) => (
                    <button
                      key={s.vendorId}
                      type="button"
                      disabled={busy}
                      onClick={() => run(part.id, () => requestAction(part.id, s.vendorId))}
                      className="inline-flex items-center gap-1 rounded-full bg-terracotta-700 px-2.5 py-1 text-[11px] font-medium text-cream hover:bg-terracotta-800 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" aria-hidden />
                      Ask {s.name}
                    </button>
                  ))}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The last CLOSED round on this part, if there was one.
 *
 * 🔑 A ROW THAT SIMPLY GOES BACK TO "ASK SOMEBODY" READS AS ONE NOBODY EVER
 * ANSWERED. A supplier who turned the design down, in their own words, is the
 * single most useful thing on this row — and a request that lapsed unanswered
 * has to say so, or the couple re-asks the same shop forever.
 */
function ClosedRoundNote({
  records,
  partId,
}: {
  records: readonly PartFinalizationRecord[];
  partId: string;
}) {
  const closed = records.filter(
    (r) => r.part_id === partId && (r.state === 'declined' || r.state === 'expired'),
  );
  const last = closed[closed.length - 1];
  if (!last) return null;
  if (last.state === 'expired') {
    return <span className="text-[11px] text-ink/55">Nobody answered last time</span>;
  }
  return (
    <span className="text-[11px] text-ink/55">
      Turned down{last.decline_reason ? ` — “${last.decline_reason}”` : ''}
    </span>
  );
}

function refusalText(status: string): string {
  switch (status) {
    case 'not_booked':
      return 'That supplier is not booked on this celebration, so they cannot agree to a part of it.';
    case 'not_in_category':
      return 'That supplier does not work in this part’s trade.';
    case 'not_finalizable_part':
      return 'That part cannot be signed off on its own.';
    case 'already':
      return 'Somebody already answered this — reload to see where it stands.';
    default:
      return 'That did not go through. Please try again.';
  }
}
