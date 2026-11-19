import Link from 'next/link';

import { formatCount } from '@/lib/format-number';
import { RENEWALS_LIST_CAP, readRenewalsList, type RenewalsList } from '@/lib/papers-renewal-admin.server';
import { RENEWAL_BUCKET_LABEL, adminPapersSummary, paperDay, renewalDayWords, type RenewalBucket } from '@/lib/papers-renewal';
import { manilaDateKey } from '@/lib/verified-badge';
import { CalendarClock } from 'lucide-react';
import { ConsoleTable } from '@/app/admin/_components/console-table';

/**
 * 📄 SUPPLIERS · RENEWALS — §5 of the approved "Papers renewal" design: one filter on the shipped suppliers list.
 * Three chips (Free · Unverified · Due in 7 days · Renewed), and one row per shop saying its state, why, and its
 * papers. A clean renewal clears its row by itself two weeks after it lands. Nothing here changes a shop.
 */
const ORDER: RenewalBucket[] = ['lapsed', 'due_week', 'renewed'];

export async function RenewalsList() {
  return <RenewalsTable list={await readRenewalsList()} />;
}

/** The drawn list — exported so the dev lab mounts this, not a copy. `null` = a read was refused. */
export function RenewalsTable({ list }: { list: RenewalsList | null }) {
  const rows = list?.rows ?? null;
  const count = (b: RenewalBucket) => (rows ?? []).filter((r) => r.bucket === b).length;
  // Past the cap the counts are a floor, and say so ("200+"), never a number that looks exact.
  const said = (b: RenewalBucket) => (list?.more ? `${formatCount(count(b))}+` : formatCount(count(b)));
  const ordered = rows === null ? null : ORDER.flatMap((b) => rows.filter((r) => r.bucket === b));
  return (
    <section aria-label="Renewals" data-renewals-list="" className="space-y-3">
      {rows !== null ? (
        <p className="flex flex-wrap gap-2 text-xs">
          {ORDER.map((b) => (
            <span key={b} className="rounded-full bg-ink/5 px-3 py-1 font-medium text-ink">
              {RENEWAL_BUCKET_LABEL[b]} · {said(b)}
            </span>
          ))}
        </p>
      ) : null}
      {list?.more ? (
        <p className="text-xs text-ink/70" data-renewals-more="">
          Showing the first {formatCount(RENEWALS_LIST_CAP)} shops — {formatCount(RENEWALS_LIST_CAP)}+ match.
        </p>
      ) : null}
      <ConsoleTable
        rows={ordered}
        readPermitted
        // The reader logged the refusal itself and answered null; this says so to the table (never an empty list).
        readError={rows === null ? { message: 'the renewals read was refused (logged by readRenewalsList)' } : null}
        reads="the renewals"
        label="Renewals"
        minWidth="32rem"
        note="Read-only. A clean renewal clears its row by itself — verification decides, from the papers."
        rowKey={(r) => r.vendorProfileId}
        empty={{ Icon: CalendarClock, title: 'No renewals right now', blurb: 'No shop is due this week, lapsed, or newly renewed.' }}
        columns={[
          {
            header: 'Shop',
            cell: (r) => (
              <>
                <span className="block font-medium text-ink">{r.name}</span>
                <span className="block text-xs text-ink/60">{r.city ?? '—'}</span>
              </>
            ),
          },
          {
            header: 'State',
            cell: (r) => (
              <>
                <span className="block text-ink">{r.bucket === 'renewed' ? 'Verified automatically' : RENEWAL_BUCKET_LABEL[r.bucket]}</span>
                <span className="block text-xs text-ink/60">{stateLine(r)}</span>
              </>
            ),
          },
          {
            header: 'Papers',
            hideBelow: 'md',
            cell: (r) => (r.papers === null ? 'Couldn’t load' : adminPapersSummary(r.papers)),
          },
          {
            header: '',
            align: 'right',
            cell: (r) => (
              <Link href={`/admin/vendors/${r.vendorProfileId}#renewal`} className="inline-flex min-h-11 items-center font-medium text-ink underline underline-offset-2">
                Open
              </Link>
            ),
          },
        ]}
      />
    </section>
  );
}

function stateLine(r: { bucket: RenewalBucket; dueAt: string | null; lapsedAt: string | null; lastVerifiedAt: string | null }): string {
  if (r.bucket === 'lapsed') return r.lapsedAt ? `since ${paperDay(manilaDateKey(new Date(r.lapsedAt)))}` : 'renewal day passed';
  if (r.bucket === 'due_week') return r.dueAt ? `Due ${renewalDayWords(r.dueAt)}` : 'Due this week';
  const next = r.dueAt ? ` · next due ${renewalDayWords(r.dueAt)} ${manilaDateKey(new Date(r.dueAt)).slice(0, 4)}` : '';
  return `${r.lastVerifiedAt ? `renewed ${paperDay(manilaDateKey(new Date(r.lastVerifiedAt)))}` : 'renewed'}${next}`;
}
