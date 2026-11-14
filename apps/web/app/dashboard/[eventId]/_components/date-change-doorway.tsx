import { CalendarClock } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';

import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { readOpenDateChange } from '@/lib/date-change.server';
import { dateChangeAnswerLine, dateChangeHomeLine, dateChangeWhen } from '@/lib/date-change';
import { hubDraftAction } from '../website/hub-draft-actions';
import { updateEventDate } from '../actions';
import { HomeTodayItem, TodaySheetItem } from './home-parts';

/**
 * 🗓 HOME — "Date change: n of N suppliers answered" (owner 2026-10-01, "THE
 * CLASHING-DATE FLOW — APPROVED WITH THE CONTROLLER'S THREE SAFEGUARDS").
 *
 * ☀ A LINE OF HOME'S TODAY LIST, under the cover (owner 2026-10-29: *"The popup for the access and other popups above
 * the header can be presented better"*): the card stacked above the cover; now the line is the Today pill and its
 * press opens the house Sheet holding this SAME body — who answered, keep waiting · drop, withdraw — unchanged.
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
 *   · when every supplier answered: "Use <date>" — the date saves to the event
 *     at once through its one door (`updateEventDate`, owner 2026-11-05: *"it
 *     shouldn't rely on the hub."*), which asks the suppliers' answers again,
 *     closes the request and tells each of them the date moved.
 *
 * A server component: forms post to `hubDraftAction` (intent `date_change`) or
 * `updateEventDate`, each of which re-renders Home — no client JS.
 */
export async function DateChangeDoorway({ eventId }: { eventId: string }) {
  const supabase = await createClient();
  const read = await readOpenDateChange(supabase, eventId);
  if (!read.ok) {
    return (
      <HomeTodayItem
        reload
        tone="warn"
        words="We couldn’t check whether a date change is waiting"
        tail="Reload"
        dataAttr={['data-date-change-unread', '']}
      />
    );
  }
  const view = read.view;
  if (!view) return null;

  const now = Date.now();
  const action = hubDraftAction.bind(null, eventId) as unknown as (formData: FormData) => Promise<void>;
  const useDate = updateEventDate as unknown as (formData: FormData) => Promise<void>;
  const to = dateChangeWhen(view.proposedDate, view.proposedPrecision);
  const from = view.fromDate ? dateChangeWhen(view.fromDate, view.fromPrecision) : 'your current date';

  return (
    <TodaySheetItem
      words={dateChangeHomeLine(view)}
      tail={view.ready ? `Use ${to}` : view.suppliers.some((s) => s.overdue) ? 'Someone hasn’t answered' : `Moving to ${to}`}
      tone={view.ready ? 'calm' : 'ask'}
      title="Date change"
      dataAttr={['data-date-change-home', '']}
    >
      {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 3 · 7 · 13): the explaining line is behind the ⓘ, each supplier is one
          hairline row, the presses are the shared pills (grey Keep waiting · red Drop · the one terracotta Use), no pale ink. */}
      <section className="flex flex-col gap-3" aria-label="Date change">
        <div className="flex items-start gap-3">
          <CalendarClock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <InfoTip label={dateChangeHomeLine(view)} labelAs="p" labelClassName="text-[15px] font-semibold text-ink" align="start">
              Your date stays as it is until every supplier answers — guests see nothing.
            </InfoTip>
            <p className="mt-0.5 text-[13px] text-ink/75">
              Moving from {from} to {to}.
            </p>
          </div>
        </div>

        <ul className="divide-y divide-ink/10">
          {view.suppliers.map((s) => (
            <li key={s.vendorProfileId} className="min-h-14 py-2.5">
              <p className="text-sm text-ink">
                <span className="font-semibold">{s.name}</span>
                <span className="text-ink/75"> · {dateChangeAnswerLine(s, now)}</span>
              </p>
              {s.overdue ? (
                <div className="mt-2 flex flex-wrap gap-2" data-date-change-overdue={s.vendorProfileId}>
                  <form action={action}>
                    <input type="hidden" name="intent" value="date_change" />
                    <input type="hidden" name="action" value="wait" />
                    <input type="hidden" name="event_vendor_id" value={s.eventVendorIds[0]} />
                    <SubmitButton
                      pendingLabel="Saving…"
                      className="ab ab-neutral"
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
                      className="ab ab-danger"
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
          <p className="text-[13px] text-ink/75">
            Dropping a supplier releases their booking; any payment is settled by the cancellation terms on that
            booking, never by Setnayan.
          </p>
        ) : null}

        {view.ready ? (
          <form action={useDate}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="event_date" value={view.proposedDate} />
            <input type="hidden" name="precision" value={view.proposedPrecision} />
            <SubmitButton
              pendingLabel="Saving your date…"
              className="ab ab-brand ab-main w-full"
              data-date-change-ready=""
            >
              Every supplier answered — use {to}
            </SubmitButton>
          </form>
        ) : null}

        <form action={action}>
          <input type="hidden" name="intent" value="date_change" />
          <input type="hidden" name="action" value="withdraw" />
          <SubmitButton
            pendingLabel="Withdrawing…"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-ink/75 underline underline-offset-2"
          >
            {view.suppliers.some((s) => s.overdue) ? 'Cancel the change — keep my date' : 'Withdraw — keep my date'}
          </SubmitButton>
        </form>
      </section>
    </TodaySheetItem>
  );
}
