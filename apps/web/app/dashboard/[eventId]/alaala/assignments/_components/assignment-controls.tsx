'use client';

import { useState, useTransition } from 'react';
import { createAssignment, removeAssignment, nudgeAssignee } from '../actions';
import type { KwentoMomentKey } from '@/lib/kwento-moments';

type Guest = { guestId: string; name: string };
type Assignment = { assignmentId: string; guestId: string; guestName: string; nudgeCount: number };

// ---------------------------------------------------------------------------
// GuestPicker — drop-down + assign button for an unassigned moment slot
// ---------------------------------------------------------------------------

export function GuestPicker({
  eventId,
  momentKey,
  guests,
}: {
  eventId: string;
  momentKey: KwentoMomentKey;
  guests: Guest[];
}) {
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const assign = () => {
    if (!selectedGuestId) return;
    setError(null);
    startTransition(async () => {
      const result = await createAssignment(eventId, momentKey, selectedGuestId);
      if (!result.ok) setError(result.error);
      else setSelectedGuestId('');
    });
  };

  if (guests.length === 0) {
    return <p className="text-[12px]" style={{ color: 'var(--m-slate-2)' }}>No guests to assign</p>;
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedGuestId}
        onChange={(e) => setSelectedGuestId(e.target.value)}
        disabled={pending}
        className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-[13px]"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)', color: 'var(--m-ink)' }}
      >
        <option value="">Pick a guest…</option>
        {guests.map((g) => (
          <option key={g.guestId} value={g.guestId}>
            {g.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={assign}
        disabled={!selectedGuestId || pending}
        className="shrink-0 rounded-md px-3 py-1.5 text-[13px] font-medium transition disabled:opacity-40"
        style={{ background: 'var(--m-mulberry)', color: '#fff' }}
      >
        {pending ? 'Assigning…' : 'Assign'}
      </button>
      {error ? <p className="text-[11px] text-danger-600">{error}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssignmentRow — shows one assignment with Nudge + Remove controls
// ---------------------------------------------------------------------------

export function AssignmentRow({
  eventId,
  momentKey,
  assignment,
}: {
  eventId: string;
  momentKey: KwentoMomentKey;
  assignment: Assignment;
}) {
  const [nudgePending, startNudge] = useTransition();
  const [removePending, startRemove] = useTransition();
  const [nudgeError, setNudgeError] = useState<string | null>(null);
  const [nudgeOk, setNudgeOk] = useState(false);

  const nudge = () => {
    setNudgeError(null);
    setNudgeOk(false);
    startNudge(async () => {
      const result = await nudgeAssignee(assignment.assignmentId);
      if (!result.ok) setNudgeError(result.error);
      else setNudgeOk(true);
    });
  };

  const remove = () => {
    startRemove(async () => {
      await removeAssignment(eventId, momentKey, assignment.guestId);
    });
  };

  const nudgesLeft = Math.max(0, 3 - assignment.nudgeCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium" style={{ color: 'var(--m-ink)' }}>
          {assignment.guestName}
        </span>
        {assignment.nudgeCount > 0 ? (
          <span
            className="rounded-full px-1.5 py-0.5 font-mono text-[10px]"
            style={{ background: 'var(--m-paper)', color: 'var(--m-slate-2)', border: '1px solid var(--m-line)' }}
          >
            {assignment.nudgeCount} nudge{assignment.nudgeCount !== 1 ? 's' : ''} sent
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {nudgeOk ? (
          <span className="text-[12px]" style={{ color: 'var(--m-orange-2)' }}>Nudged ✓</span>
        ) : (
          <button
            type="button"
            onClick={nudge}
            disabled={nudgePending || nudgesLeft === 0}
            title={nudgesLeft === 0 ? 'Nudge limit reached' : `${nudgesLeft} nudge${nudgesLeft !== 1 ? 's' : ''} remaining`}
            className="rounded-md border px-2 py-1 text-[12px] transition disabled:opacity-40"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
          >
            {nudgePending ? 'Nudging…' : nudgesLeft === 0 ? 'No nudges left' : 'Nudge'}
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={removePending}
          className="rounded-md border px-2 py-1 text-[12px] transition disabled:opacity-40 hover:border-danger-200 hover:text-danger-600"
          style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate-2)' }}
        >
          {removePending ? '…' : 'Remove'}
        </button>
        {nudgeError ? <p className="text-[11px] text-danger-600">{nudgeError}</p> : null}
      </div>
    </div>
  );
}
