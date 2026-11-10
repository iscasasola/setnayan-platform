'use client';

/**
 * The lab's open seats for the shared lock and Door 1 (`/dev/supplier-plan-lab?s=lock|limit`) — the REAL parts, mounted
 * already risen so a screenshot shows them. ✕ / Keep put them away and a button brings them back. DEV-ONLY.
 */
import { useState, type ReactNode } from 'react';
import { LockExplainer, type LockNeed } from '@/app/_components/lock/locked-feature';
import { LimitSheet } from '@/app/_components/lock/limit-sheet';
import type { LockKey } from '@/lib/locks';
import type { LimitAsk } from '@/lib/plan-sheet';

function Reopen({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="sn-press rounded-full border border-ink/15 px-4 py-2 text-[14px]" onClick={onOpen}>
      Open again
    </button>
  );
}

export function LabLock({ lock, need, preview }: { lock: LockKey; need: LockNeed; preview?: ReactNode }) {
  const [open, setOpen] = useState(true);
  return open ? <LockExplainer lock={lock} need={need} preview={preview} onClose={() => setOpen(false)} /> : <Reopen onOpen={() => setOpen(true)} />;
}

export function LabLimit({ ask, verified, price }: { ask: LimitAsk; verified: boolean; price: string | null }) {
  const [open, setOpen] = useState(true);
  return open ? (
    <LimitSheet ask={ask} verified={verified} price={price} onKeep={() => setOpen(false)} onClose={() => setOpen(false)} />
  ) : (
    <Reopen onOpen={() => setOpen(true)} />
  );
}
