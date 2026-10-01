'use client';

import { useState, useTransition } from 'react';
import type { DateClash } from '@/lib/date-fits-booked';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { hubDraftAction } from '../../website/hub-draft-actions';

/**
 * 🗓 A PICK A BOOKED SUPPLIER CANNOT DO — said plainly ("Your photographer is
 * booked elsewhere that day."), the date left as it is, and the one way to act:
 * "Ask them to move or unlock?".
 *
 * THE ONE CONFIRM (owner 2026-10-01, "THE CLASHING-DATE FLOW — APPROVED WITH
 * THE CONTROLLER'S THREE SAFEGUARDS"): it can cost a supplier their booking, so
 * it is asked once, in words, before anything is sent. Yes → ONE request to the
 * conflicting suppliers (`hubDraftAction` intent `date_change`, action `ask`;
 * the SERVER names who clashes, never this list). Each answers Move or Unlock
 * within 3 days; the couple follows it on Home. The event keeps its date and
 * guests see nothing meanwhile.
 *
 * Each supplier's own conversation stays one tap away (`DateClash.href`) for a
 * couple who would rather ask in words first.
 */
export function DateClashNote({
  eventId,
  clash,
}: {
  eventId: string;
  clash: { reason: string; list: readonly DateClash[]; pick: { date: string; precision: string } };
}) {
  const [confirming, setConfirming] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const who =
    clash.list.length === 1
      ? clash.list[0]!.name
      : `${clash.list.slice(0, -1).map((c) => c.name).join(', ')} and ${clash.list[clash.list.length - 1]!.name}`;

  const ask = () => {
    setSaid(null);
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'date_change');
      fd.set('action', 'ask');
      fd.set('date', clash.pick.date);
      fd.set('precision', clash.pick.precision);
      try {
        const r = await makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh);
        setSaid(r.ok ? { ok: true, text: r.message ?? 'Asked.' } : { ok: false, text: r.error });
        if (r.ok) setConfirming(false);
      } catch {
        setSaid({ ok: false, text: 'That did not go through. Nothing was sent — please try again.' });
      }
    });
  };

  return (
    <div role="alert" data-date-clash="" className="flex flex-col gap-1.5 rounded-md bg-terracotta/10 px-3 py-2.5">
      <p className="text-[13px] text-ink">{clash.reason} Your date stays as it is.</p>
      {said?.ok ? (
        <p className="text-[13px] font-semibold text-ink" data-date-change-asked="">
          {said.text}
        </p>
      ) : confirming ? (
        <div className="flex flex-col gap-2" data-date-change-confirm="">
          <p className="text-[13px] text-ink/80">
            We&rsquo;ll ask {who} to move to the new date or unlock their service. They have 3 days to answer. Your
            date stays as it is meanwhile, and guests see nothing.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={ask}
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-[13px] font-semibold text-cream disabled:opacity-60"
            >
              {pending ? 'Asking…' : 'Yes, ask them'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-[13px] font-semibold text-ink"
            >
              Not now
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          data-date-clash-ask=""
          className="inline-flex min-h-11 w-fit items-center text-[13px] font-semibold text-terracotta-700 underline underline-offset-2"
        >
          Ask them to move or unlock?
        </button>
      )}
      {said && !said.ok ? (
        <p className="text-[12.5px] text-terracotta-700" role="status">
          {said.text}
        </p>
      ) : null}
      {clash.list.map((c) => (
        <a
          key={c.vendorId}
          href={c.href}
          data-date-clash-thread={c.vendorId}
          className="inline-flex min-h-11 w-fit items-center text-[12.5px] text-ink/65 underline underline-offset-2"
        >
          Message {c.name}
        </a>
      ))}
    </div>
  );
}
