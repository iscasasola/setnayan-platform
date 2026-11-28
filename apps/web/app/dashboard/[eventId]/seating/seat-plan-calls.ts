/**
 * 🪑 THE SEAT SCREENS' THREE CALLS (the controller's contract of 28 Nov; seat plan § 4.4 / § 4.6). Thin helpers over
 * the ONE `autoArrange` server action (its intents — the server-action budget is full, so nothing new is exported as
 * an action here). L10's screens call these; the engine behind them is lib/seat-plan-dry-run.ts,
 * lib/seat-plan-preview.ts and the `apply_seat_plan` transaction; the shapes are lib/seat-plan-api.ts.
 *
 *   dryRun(eventId)                                        → DryRunView      (nothing written)
 *   previewArrange(eventId, { scope, lockedTableIds, … })  → ArrangeView     (nothing written; throws on no plan)
 *   acceptArrange(eventId, planId, { lockId })              → AutoArrangeResult (one transaction; its fields feed Undo)
 */
import { autoArrange, type AutoArrangeResult } from './actions';
import type { ArrangeView, DryRunView } from '@/lib/seat-plan-api';

export async function dryRun(eventId: string): Promise<DryRunView> {
  const fd = new FormData();
  fd.set('event_id', eventId);
  fd.set('intent', 'dry-run');
  const res = await autoArrange(fd);
  return res.dryRun ?? { status: 'failed', line: 'Couldn’t check seats · Try again' };
}

export async function previewArrange(
  eventId: string,
  opts: {
    scope: 'unseated' | 'everyone';
    lockedTableIds?: ReadonlyArray<string>;
    /** Where the editor laid the tables out (table_id or a new table's key → percent), as auto arrange sends them. */
    positions?: Readonly<Record<string, { x: number; y: number }>>;
  },
): Promise<ArrangeView> {
  const fd = new FormData();
  fd.set('event_id', eventId);
  fd.set('intent', 'preview');
  fd.set('scope', opts.scope === 'everyone' ? 'all' : 'unseated');
  fd.set('keep', JSON.stringify(opts.lockedTableIds ?? []));
  fd.set('positions', JSON.stringify(opts.positions ?? {}));
  const res = await autoArrange(fd);
  if (!res.arrange) throw new Error("Couldn't make a plan. Nothing changed.");
  return res.arrange;
}

export async function acceptArrange(eventId: string, planId: string, opts: { lockId?: string | null } = {}): Promise<AutoArrangeResult> {
  const fd = new FormData();
  fd.set('event_id', eventId);
  fd.set('intent', 'accept');
  fd.set('plan_id', planId);
  if (opts.lockId) fd.set('lock_id', opts.lockId);
  return autoArrange(fd);
}
