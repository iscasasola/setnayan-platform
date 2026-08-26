import { Upload } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { setPapicUploadsOpen } from '../actions';

/**
 * WHO MAY ADD PHOTOS BY HAND — one quiet row, two states.
 *
 * Owner 2026-08-26: *"a toggle will set if they will allow people to upload
 * photos manually as well"* and *"uploading can depend on the toggle for photo
 * upload."*
 *
 * ⚖ IT IS TWO EXPLICIT BUTTONS, NOT A FLIP. A control that toggles "whatever it
 * last read" lands on the opposite of what somebody pressed if the page was
 * stale or they double-tapped — and this one decides whether a wedding's
 * gallery can be added to. The form posts the value it WANTS.
 *
 * ⚠ THE COPY SAYS WHAT IT COSTS, because "allow uploads" reads like a free
 * door. Every upload spends a credit exactly as a camera shot does, and a
 * couple deciding this should be deciding it knowing that.
 */
export function UploadsOpenChoice({
  eventId,
  open,
}: {
  eventId: string;
  open: boolean;
}) {
  return (
    <section className="space-y-3 sn-tile p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Upload aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Adding photos by hand
        </h2>
        <p className="max-w-prose text-sm text-ink/60">
          {open
            ? 'Photos and clips can be added from a phone or laptop — older memories included. Each one uses a credit, the same as a camera shot.'
            : 'Only what your cameras capture goes into this gallery. Nothing can be added from a phone or laptop.'}
        </p>
      </div>

      <form action={setPapicUploadsOpen} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="open" value={open ? '0' : '1'} />
        <SubmitButton className={open ? 'sn-btn-secondary' : 'sn-btn-primary'}>
          {open ? 'Turn this off' : 'Turn this on'}
        </SubmitButton>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/50">
          {open ? 'On' : 'Off'}
        </span>
      </form>
    </section>
  );
}
