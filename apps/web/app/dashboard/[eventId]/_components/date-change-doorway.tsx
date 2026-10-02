import Link from 'next/link';
import { CalendarClock } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { readOpenDateChange } from '@/lib/date-change.server';
import { dateChangeAnswerLine, dateChangeHomeLine, dateChangeWhen } from '@/lib/date-change';
import { hubDraftAction } from '../website/hub-draft-actions';

/**
 * 🗓 HOME — "Date change: n of N suppliers answered" (owner 2026-10-01, "THE
 * CLASHING-DATE FLOW — APPROVED WITH THE CONTROLLER'S THREE SAFEGUARDS").
 *
 * Renders NOTHING when there is no open request (the AccessRequestsDoorway
 * shape). RLS does the scoping: the request tables admit the COUPLE
 * (`current_couple_event_ids()`), never a guest, so a guest or helper loading
 * Home counts nothing and the card never appears for them.
 *
 * What it carries, and nothing else:
 *   · who answered what — Move, Unlock (with the deposit settled by the
 *     booking's own terms when money was logged), or still deciding;
 *   · after 3 days unanswered, the couple's three choices for that supplier:
 *     keep waiting · drop them · cancel the change;
 *   · withdraw, anytime — the event keeps its date;
 *   · when every supplier answered: the new date is in the draft, applied in
 *     the Event Hub (the Maker rule — never here).
 *
 * A server component: forms post to `hubDraftAction` (intent `date_change`),
 * which re-renders Home — no client JS.
 */
export async function DateChangeDoorway({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const read = await readOpenDateChange(supabase, eventId);
  if (!read.ok) {
    return (
      <p className="sn-tile flex items-center gap-3 p-4 text-sm text-ink/70" data-date-change-unread="">
        <CalendarClock aria-hidden className="h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
        We couldn&rsquo;t check whether a date change is waiting. Reload to try again.
      </p>
    );
  }
  const view = read.view;
  if (!view) return null;

  const now = Date.now();
  const action = hubDraftAction.bind(null, eventId) as unknown as (formData: FormData) => Promise<void>;
  const to = dateChangeWhen(view.proposedDate, view.proposedPrecision);
  const from = view.fromDate ? dateChangeWhen(view.fromDate, view.fromPrecision) : 'your current date';

  return (
    <section className="sn-tile flex flex-col gap-3 p-4" data-date-change-home="" aria-label="Date change">
      <div className="flex items-start gap-3">
        <CalendarClock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{dateChangeHomeLine(view)}</p>
          <p className="mt-0.5 text-xs text-ink/60">
            Moving from {from} to {to}. Your date stays as it is until every supplier answers — guests see nothing.
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {view.suppliers.map((s) => (
          <li key={s.vendorProfileId} className="py-1">
            <p className="text-sm text-ink">
              <span className="font-semibold">{s.name}</span>
              <span className="text-ink/60"> · {dateChangeAnswerLine(s, now)}</span>
            </p>
            {s.overdue ? (
              <div className="mt-2 flex flex-wrap gap-2" data-date-change-overdue={s.vendorProfileId}>
                <form action={action}>
                  <input type="hidden" name="intent" value="date_change" />
                  <input type="hidden" name="action" value="wait" />
                  <input type="hidden" name="event_vendor_id" value={s.eventVendorIds[0]} />
                  <SubmitButton
                    pendingLabel="Saving…"
                    className="inline-flex min-h-11 items-center rounded-full border border-ink/20 px-4 text-sm font-semibold text-ink"
                  >
                    Keep waiting
                  </SubmitButton>
                </form>
                <form action={action}>
                  <input type="hidden" name="intent" value="date_change" />
                  <input type="hidden" name="action" value="drop" />
                  <input type="hidden" name="event_vendor_id" value={s.eventVendorIds[0]} />
                  <SubmitButton
                    pendingLabel="Releasing…"
                    className="inline-flex min-h-11 items-center rounded-full border border-terracotta/40 px-4 text-sm font-semibold text-terracotta-700"
                  >
                    Drop {s.name}
                  </SubmitButton>
                </form>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {view.suppliers.some((s) => s.overdue) ? (
        <p className="text-xs text-ink/60">
          Dropping a supplier releases their booking; any payment is settled by the cancellation terms on that
          booking, never by Setnayan.
        </p>
      ) : null}

      {view.ready ? (
        <Link
          href={`/dashboard/${eventId}/launch?tool=details`}
          className="sn-press inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-cream"
          data-date-change-ready=""
        >
          Every supplier answered — Apply {to} in your Event Hub
        </Link>
      ) : null}

      <form action={action}>
        <input type="hidden" name="intent" value="date_change" />
        <input type="hidden" name="action" value="withdraw" />
        <SubmitButton
          pendingLabel="Withdrawing…"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-ink/70 underline underline-offset-2"
        >
          {view.suppliers.some((s) => s.overdue) ? 'Cancel the change — keep my date' : 'Withdraw — keep my date'}
        </SubmitButton>
      </form>
    </section>
  );
}
