'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { papicBuySizes } from '../actions';
import { PapicBuyForm } from './papic-buy-form';
import type { PoolRung } from '@/lib/papic-pool-rungs';

/**
 * 📍 "BUY MORE", IN PLACE (owner "Yes", 2026-10-13 — DECISION_LOG 📍): Home's
 * Papic row opens the SHIPPED credit stepper right under itself and goes on to
 * /pay — no new checkout, no trip to another page first.
 *
 * 🔌 THE LADDER IS READ ON THE TAP, NOT ON THE VIEW. Home is the most-opened
 * screen and production is on the free database plan, so the two catalog reads
 * the stepper needs happen only when somebody asks to buy (`papicBuySizes`).
 *
 * 🔘 A press shows pressed and says its one step ("Loading sizes…"), and a
 * second tap while it loads does nothing.
 */
export function PapicBuyInPlace({ eventId, label = 'Buy more' }: { eventId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [rungs, setRungs] = useState<PoolRung[] | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const press = () => {
    if (pending) return;
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (rungs) return;
    setRefusal(null);
    start(async () => {
      try {
        const r = await papicBuySizes(eventId);
        if (r.ok) setRungs(r.rungs);
        else
          setRefusal(
            r.reason === 'not_couple'
              ? 'Only the couple can add credits.'
              : r.reason === 'over'
                ? 'Your day is over — credits can no longer be added.'
                : 'Credits are not on sale right now.',
          );
      } catch {
        setRefusal('We couldn’t load the sizes. Try again.');
      }
    });
  };

  return (
    <>
      <ActionButton
        tone="ok"
        icon={<Plus aria-hidden="true" strokeWidth={1.9} />}
        label={pending ? 'Loading sizes…' : label}
        onClick={press}
        aria-expanded={open}
        data-testid="papic-buy-more"
      />
      {open ? (
        <div data-papic-buy-panel="" className="basis-full pt-2">
          {pending ? (
            <p className="text-[12.5px] text-ink/60" aria-live="polite">Loading sizes…</p>
          ) : refusal ? (
            <p className="text-[12.5px] text-red-700" role="alert">{refusal}</p>
          ) : rungs ? (
            <PapicBuyForm eventId={eventId} rungs={rungs} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
