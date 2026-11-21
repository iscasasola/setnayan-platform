'use client';

import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { formatPhp } from '@/lib/php';
import { REMIND_THE_HOSTS, REMINDED, dueWord, remindRefusalWords } from '@/lib/remind-the-hosts';

export type DueRow = { vendorId: string; name: string; amountPhp: number; dueDate: string };

/**
 * 💸 PAYMENTS DUE — what the booked coordinator sees of the money (owner 2026-11-21; drawing
 * `their_event_door_2026-11-21` frame "3 · Budget · View": *"The coordinator can read the plan and see what is due.
 * They can remind. They cannot log or pay."*). One row per supplier, one button: Remind the hosts. Never a Log, never a
 * Pay. `null` rows = the read was refused — said, never "nothing is due".
 */
export function PaymentsDue({ eventId, rows }: { eventId: string; rows: DueRow[] | null }) {
  return (
    <section className="py-2" data-payments-due="" aria-labelledby="payments-due-title">
      <h2 id="payments-due-title" className="text-xs font-semibold uppercase tracking-wide text-ink/55">
        Payments due
      </h2>
      {rows === null ? (
        <p className="mt-2 text-sm text-terracotta-700" data-payments-due-refused="">
          We couldn’t load what is due. Reload to try again.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink/70" data-payments-due-none="">
          Nothing is due right now.
        </p>
      ) : (
        <ul className="mt-1">
          {rows.map((r) => (
            <DueLine key={r.vendorId} eventId={eventId} row={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DueLine({ eventId, row }: { eventId: string; row: DueRow }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [said, setSaid] = useState<string | null>(null);
  const remind = async () => {
    if (state !== 'idle') return;
    setState('sending');
    setSaid(null);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const { data, error } = await createClient().rpc('remind_the_hosts_of_a_payment', {
        p_event_id: eventId,
        p_vendor_id: row.vendorId,
      });
      if (error) {
        console.error('[supabase-error] remind_the_hosts_of_a_payment', error);
        setSaid(remindRefusalWords(null));
        setState('idle');
        return;
      }
      const status = (data as { status?: string } | null)?.status ?? null;
      if (status === 'ok') {
        setState('sent');
        return;
      }
      setSaid(remindRefusalWords(status));
      setState(status === 'already_reminded' ? 'sent' : 'idle');
    } catch (e) {
      console.error('[payments-due] could not send:', e instanceof Error ? e.message : e);
      setSaid(remindRefusalWords(null));
      setState('idle');
    }
  };
  return (
    <li className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-t border-ink/10 py-2 first:border-t-0" data-due-row={row.vendorId}>
      <span className="min-w-0">
        <span className="block truncate text-[15px] text-ink">
          {row.name} · <span className="tabular-nums">{formatPhp(row.amountPhp)}</span>
        </span>
        <span className="block text-[13px] text-ink/60">{dueWord(row.dueDate)}</span>
        {said ? (
          <span role="status" className="block text-[12px] text-terracotta-700">
            {said}
          </span>
        ) : null}
      </span>
      <ActionButton
        tone="warn"
        icon={BellRing}
        label={state === 'sent' ? REMINDED : REMIND_THE_HOSTS}
        disabled={state !== 'idle'}
        onClick={remind}
        data-remind-the-hosts=""
      />
    </li>
  );
}
