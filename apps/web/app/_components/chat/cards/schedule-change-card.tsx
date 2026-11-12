'use client';

/**
 * 🗓 THE SCHEDULE CARD — under the line a host's chapter move posts ("Schedule changed · Ceremony · 2:00 PM → 2:30 PM ·
 * 30 min later"), both sides (SCHEDULES HAND-IN-HAND part (b), owner 2026-11-12; prototype
 * `Build_Schedules_2026-11-12/schedules-hand-in-hand.html`).
 *
 *   1 · The supplier's arrive / done STAY when a chapter moves, so the card says what moved against what they planned:
 *       "Ceremony is now 30 min later than you planned".
 *   3 · It PINS in the supplier's chat until they press Seen (the pin is `schedule_change` in `lib/chat-pins.ts`). Seen is
 *       the shipped mark (`supplier_mark_schedule` 'seen'); a change the host applied needs no other answer. The hosts'
 *       copy shows the supplier's answer: "Seen · Nov 12", or nothing yet.
 */
import { useCallback, useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { scheduleChangeHeadline } from '@/lib/schedule-hand-in-hand';
import { markDay } from '@/lib/supplier-schedule-marks';
import { ChatCardShell } from '../chat-step-card';
import { loadScheduleSeen, markScheduleSeenFromChat } from './card-calls';
import { Problem } from './card-bits';

export function ScheduleChangeCard({
  threadId,
  createdAt,
  chapter,
  from,
  to,
  shift,
  viewer,
  supplierName,
  seed,
}: {
  threadId: string;
  /** When the line was posted — Seen after it means this card is answered. */
  createdAt: string;
  chapter: string;
  from: string;
  to: string;
  shift: string;
  viewer: 'vendor' | 'couple';
  /** The shop's name on the hosts' copy ("you" on the supplier's own). */
  supplierName: string;
  /** Labs only: the Seen as read, so no request is made. */
  seed?: { eventId: string; seenAt: string | null };
}) {
  const [seen, setSeen] = useState<{ eventId: string; seenAt: string | null } | null>(seed ?? null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const load = useCallback(() => {
    void loadScheduleSeen(threadId).then((r) => setSeen(r.ok ? { eventId: r.eventId, seenAt: r.seenAt } : null));
  }, [threadId]);
  useEffect(() => {
    if (!seed) load();
  }, [load, seed]);

  const answered = Boolean(seen?.seenAt && Date.parse(seen.seenAt) >= Date.parse(createdAt));
  const press = async () => {
    if (!seen) return;
    setBusy(true);
    setProblem(null);
    const r = await markScheduleSeenFromChat(seen.eventId);
    setBusy(false);
    if (r.ok) setSeen({ ...seen, seenAt: new Date().toISOString() });
    else setProblem(r.message);
  };

  const mine = viewer === 'vendor';
  return (
    <ChatCardShell topic="schedule" kicker="Schedule" title="Schedule changed" tone="auto">
      <div className="grid gap-2" data-schedule-change-card={answered ? 'seen' : 'open'}>
        <p className="text-[15px] font-semibold text-ink">{scheduleChangeHeadline(chapter, shift, mine ? 'you' : supplierName)}</p>
        <p className="text-[14px] tabular-nums text-ink/65">
          {chapter} · {from} → {to}
        </p>
        <p className="text-[14px] text-ink/65">
          {mine
            ? 'Your arrive and done times stay as you set them. Change them on their Schedule if you need to.'
            : `${supplierName}’s arrive and done times stay as they set them.`}
        </p>
        {answered && seen?.seenAt ? (
          <p className="text-[14px] font-medium text-success-700" data-schedule-change-seen="">
            ✓ Seen · {markDay(seen.seenAt)}
          </p>
        ) : mine ? (
          <>
            <ActionButton tone="brand" main icon={Eye} label="Seen" onClick={press} disabled={busy || !seen} data-testid="schedule-change-seen" />
            <Problem text={problem} />
          </>
        ) : null}
      </div>
    </ChatCardShell>
  );
}
