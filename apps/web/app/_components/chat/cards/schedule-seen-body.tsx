'use client';

/**
 * 🗓 Seen, under the supplier's schedule pin (rule 3, 2026-11-12) — the same shipped mark as the card in the chat and
 * their Schedule view (`supplier_mark_schedule` 'seen'). Once pressed the pin goes on the next read; this says so now.
 */
import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { loadScheduleSeen, markScheduleSeenFromChat } from './card-calls';
import { Problem } from './card-bits';

export function ScheduleSeenBody({ threadId, postedAtMs }: { threadId: string; postedAtMs: number }) {
  const [eventId, setEventId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    void loadScheduleSeen(threadId).then((r) => {
      if (!r.ok) return setProblem('Couldn’t load this. Try again in a moment.');
      setEventId(r.eventId);
      if (r.seenAt && Date.parse(r.seenAt) >= postedAtMs) setDone(true);
    });
  }, [threadId, postedAtMs]);
  if (done) return <p className="text-[14px] font-medium text-success-700">✓ Seen</p>;
  return (
    <div className="grid gap-2" data-schedule-pin-seen="">
      <p className="text-[14px] text-ink/65">Your arrive and done times stay as you set them. Press Seen so the hosts know you read it.</p>
      <ActionButton
        tone="brand"
        main
        icon={Eye}
        label="Seen"
        disabled={busy || !eventId}
        onClick={async () => {
          if (!eventId) return;
          setBusy(true);
          setProblem(null);
          const r = await markScheduleSeenFromChat(eventId);
          setBusy(false);
          if (r.ok) setDone(true);
          else setProblem(r.message);
        }}
      />
      <Problem text={problem} />
    </div>
  );
}
