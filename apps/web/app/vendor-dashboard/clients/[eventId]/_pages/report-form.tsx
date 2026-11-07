'use client';

import { useActionState, useId } from 'react';
import { CalendarDays, Flag, Home, Store } from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { TypedRow } from '@/app/_components/form-row';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { REPORT_BODY_MAX, REPORT_SUBJECT_MAX, reportOriginWords } from '@/lib/supplier-report';
import { submitSupplierReport, type ReportState } from '../report-actions';

const CHIP = 'inline-flex min-h-8 items-center gap-1.5 rounded-full bg-gild/15 px-3 text-[13px] text-ink/80';

/**
 * 🚩 The Report form (v113 `page=report`): Subject · Note · the origin chips (read-only — nobody types where a report
 * came from) · thumb "Submit report". A sent report keeps the screen and says so; the fields clear for the next one.
 */
export function ReportForm({
  eventId,
  shopName,
  eventName,
  eventDate,
}: {
  eventId: string;
  shopName: string;
  eventName: string;
  eventDate: string | null;
}) {
  const formId = useId();
  const [state, action, pending] = useActionState<ReportState, FormData>(submitSupplierReport, { status: 'idle' });
  // A sent report clears the two rows for the next one (remount on the new reference); the screen stays.
  const lastSent = state.status === 'sent' ? state.publicId : null;
  const day = eventDate ? formatDay(eventDate) : null;

  return (
    <section className="space-y-4" aria-labelledby={`${formId}-h`} data-report-page>
      <h2 id={`${formId}-h`} className="text-[17px] font-semibold text-ink">
        Report to Setnayan
      </h2>
      <p className="text-[14px] text-ink/70">Subject, a note, and where it came from — filled in for you.</p>
      <form id={formId} action={action} className="space-y-3">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="page" value="report" />
        <div key={lastSent ?? 'first'} className="space-y-1">
          <TypedRow
            name="Subject"
            value=""
            empty="Subject · one line"
            placeholder="Subject · one line"
            maxLength={REPORT_SUBJECT_MAX}
            fieldName="subject"
            onKeep={() => undefined}
            data="report-subject"
          />
          <TypedRow
            name="Note"
            value=""
            empty="Note"
            placeholder="What happened, in your words"
            long
            boxed
            maxLength={REPORT_BODY_MAX}
            fieldName="note"
            onKeep={() => undefined}
            data="report-note"
          />
        </div>
      </form>
      <div className="space-y-2">
        <h3 className="text-[15px] font-semibold text-ink">Where it came from · filled in automatically</h3>
        <ul className="flex flex-col items-start gap-2" data-report-origin>
          <li className={CHIP}>
            <Store className="h-3.5 w-3.5" aria-hidden /> {shopName}
          </li>
          <li className={CHIP}>
            <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {eventName}
            {day ? ` · ${day}` : ''}
          </li>
          <li className={CHIP}>
            <Home className="h-3.5 w-3.5" aria-hidden /> {reportOriginWords('clients.report')}
          </li>
        </ul>
      </div>
      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-danger-700">
          {state.message}
        </p>
      ) : state.status === 'sent' ? (
        <p role="status" className="text-sm text-success-700" data-testid="report-sent">
          Sent to Setnayan · {state.publicId}
        </p>
      ) : null}
      <SupplierThumbRow
        name="client-report"
        label="Report tools"
        row={
          <ThumbRow
            name="client-report"
            action={{
              icon: Flag,
              label: 'Submit report',
              onClick: () => (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit(),
              waiting: pending,
              testId: 'report-submit',
            }}
          />
        }
      />
    </section>
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00+08:00` : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
}
