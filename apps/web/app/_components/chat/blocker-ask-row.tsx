'use client';

/**
 * 🚦 THE BOOKING ASK'S TWO ANSWERS, AS ONE ROW — **Turn down | Agree and book**, equal widths (prototype v8.3's blocker;
 * FINAL RULINGS 2026-11-09 house rule: "Equal-weight choices sit in one row at equal widths").
 *
 * The SAME two shipped actions the panel posts (`vendorDeclineLock` / `vendorAgreeToLock`, the same hidden fields), so
 * nothing about what a yes or a no does changes. A no is still never one tap: Turn down opens its own step — the
 * shipped Why ▾ + note (`DeclineReasonFields`) and **Not now | Turn it down** — because the couple is told at once and
 * there is no Undo.
 */
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Check, X } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { AskSubmit } from '@/app/_components/ask-submit';

const DeclineReasonFields = dynamic(() => import('@/app/_components/decline-reason-fields').then((m) => m.DeclineReasonFields));

const ico = { 'aria-hidden': true, strokeWidth: 1.9 } as const;

export function BlockerAskRow({
  eventVendorId,
  returnTo,
  agreeLock,
  declineLock,
}: {
  eventVendorId: string;
  returnTo: string;
  agreeLock: (formData: FormData) => void | Promise<void>;
  declineLock: (formData: FormData) => void | Promise<void>;
}) {
  const [declining, setDeclining] = useState(false);
  if (declining) {
    return (
      <form action={declineLock} className="mt-3" data-blocker-ask-row="declining">
        <input type="hidden" name="vendor_id" value={eventVendorId} />
        <input type="hidden" name="return_to" value={returnTo} />
        <DeclineReasonFields />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ActionButton tone="neutral" quiet icon={<X {...ico} />} label="Not now" onClick={() => setDeclining(false)} className="!h-11 !min-h-11 w-full" />
          <AskSubmit tone="danger" main icon={<X {...ico} />} label="Turn it down" pendingLabel="Sending…" className="w-full" />
        </div>
      </form>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-2 gap-2" data-blocker-ask-row="">
      <ActionButton tone="danger" icon={<X {...ico} />} label="Turn down" onClick={() => setDeclining(true)} className="!h-11 !min-h-11 w-full" />
      <form action={agreeLock} className="contents">
        <input type="hidden" name="vendor_id" value={eventVendorId} />
        <input type="hidden" name="return_to" value={returnTo} />
        <AskSubmit tone="ok" main icon={<Check {...ico} />} label="Agree and book" pendingLabel="Agreeing…" className="w-full" />
      </form>
    </div>
  );
}
