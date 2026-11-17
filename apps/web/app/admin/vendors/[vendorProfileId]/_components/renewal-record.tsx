import { FileText, Mail } from 'lucide-react';

import { RecordFacts } from '@/app/admin/_components/record-kit';
import { ActionButton } from '@/components/action-button';
import { formatCount } from '@/lib/format-number';
import { manilaDateKey } from '@/lib/verified-badge';
import { paperDay, reminderSentLine, renewalDayWords, type RenewalStage } from '@/lib/papers-renewal';
import type { RenewalRecord } from '@/lib/papers-renewal-admin.server';

const COULD_NOT_LOAD = "Couldn't load";

/**
 * 📄 The shop's renewal, as §5 of the approved "Papers renewal" design draws it: why, the verified window, what
 * carries on, what is paused, the papers on file and every reminder that went out. No button lets a shop through
 * by hand here — verification decides that, from the papers. The drawn two doors are the shipped ones: "Open the
 * papers" is the verification queue where papers are reviewed, "Message the shop" its contact email (drawn only when
 * one is on file).
 */
export function RenewalRecordFacts({
  stage,
  dueAt,
  lastVerifiedAt,
  record,
}: {
  stage: RenewalStage;
  dueAt: string | null;
  lastVerifiedAt: string | null;
  record: RenewalRecord;
}) {
  const day = dueAt ? `${renewalDayWords(dueAt)} ${manilaDateKey(new Date(dueAt)).slice(0, 4)}` : '—';
  const lapsed = stage === 'lapsed';
  const bookings = record.bookings === null ? COULD_NOT_LOAD : `${formatCount(record.bookings)} carry on`;
  const asks =
    record.asksBefore === null
      ? lapsed
        ? COULD_NOT_LOAD
        : null
      : record.asksBefore === 0
        ? 'None waiting'
        : `${formatCount(record.asksBefore)} waiting on the shop`;
  return (
    <>
      <RecordFacts
        items={[
          ['Why', lapsed ? `Papers not renewed by ${day}` : `Papers due by ${day}`],
          ['Verified', `${lastVerifiedAt ? paperDay(manilaDateKey(new Date(lastVerifiedAt))) : '—'} – ${day}`],
          ['Bookings', bookings],
          ...(asks ? [['Asks from before', asks] as const] : []),
          ['New couples', lapsed ? 'Out of Find and Discover' : 'Can find and book the shop'],
          ['Plan', lapsed ? 'Free until verified again' : 'Unchanged'],
        ]}
      />
      <RecordFacts
        label="Papers"
        items={
          record.papers === null
            ? [['Papers', COULD_NOT_LOAD]]
            : record.papers.map((p, i) => [['DTI or SEC', 'BIR 2303', 'Business Permit'][i]!, `${p.tag} · ${p.text}`] as const)
        }
      />
      <RecordFacts
        label="Reminders sent"
        items={
          record.reminders === null
            ? [['Reminders sent', COULD_NOT_LOAD]]
            : record.reminders.length === 0
              ? [['Reminders sent', 'None yet']]
              : record.reminders.map((r, i) => [`Sent ${formatCount(i + 1)}`, reminderSentLine(r.at, r.stage)] as const)
        }
      />
      <div className="flex flex-wrap gap-2" data-renewal-doors="">
        <ActionButton tone="brand" icon={<FileText aria-hidden strokeWidth={1.9} />} label="Open the papers" href="/admin/verify" />
        {record.contactEmail ? (
          <ActionButton tone="neutral" icon={<Mail aria-hidden strokeWidth={1.9} />} label="Message the shop" href={`mailto:${record.contactEmail}`} />
        ) : null}
      </div>
    </>
  );
}
