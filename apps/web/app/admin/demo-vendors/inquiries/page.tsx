/**
 * /admin/demo-vendors/inquiries
 *
 * Admin responder inbox: every inquiry thread a couple has started with a DEMO
 * vendor. Demo vendors are unclaimed (no owning user), so these threads have
 * nowhere else to land — here the team reads them and replies as the vendor.
 * Service-role read (no admin RLS policy on chat tables); scoped to is_demo=TRUE.
 *
 * ⚠ THE READ ERROR WAS NEVER EVEN CAPTURED. The query destructured `data` only,
 * then `(threadsRaw ?? [])` turned a refused read into an empty array and the
 * page printed "No demo inquiries yet." with instructions for seeding demo
 * vendors — i.e. it told the reader to go fix data that may well already exist.
 * `error` is now bound, kept null all the way to the render, and reported.
 * Corrected 2026-08-17 (lane D of the admin console-table conversion).
 */

import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isInquiryRevealed,
  inquiryPlaceholderLabel,
  inquiryCityLabel,
  inquiryHostNounsByType,
} from '@/lib/inquiry-mask.server';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ConsoleTable } from '@/app/admin/_components/console-table';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Demo inquiries · Admin' };
export const dynamic = 'force-dynamic';

type ThreadRow = {
  thread_id: string;
  event_id: string;
  inquiry_status: 'pending' | 'accepted' | 'declined';
  accepted_at: string | null;
  updated_at: string;
  vendor: { business_name: string | null } | null;
};

const STATUS_STYLE: Record<ThreadRow['inquiry_status'], string> = {
  pending: 'bg-terracotta/10 text-terracotta-700',
  accepted: 'bg-success-50 text-success-700',
  declined: 'bg-ink/10 text-ink/60',
};

/** Passed to ConsoleTable as `cap` so a full page says so rather than implying it is the whole inbox. */
const ROW_LIMIT = 300;

function fmt(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-PH', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default async function DemoInquiriesPage() {
  await requireAdmin();
  const admin = createAdminClient();

  // Threads whose vendor is a demo vendor. `!inner` + the embedded filter keep
  // this to demo vendors only. Pending first, then most-recently-updated.
  const { data: threadsRaw, error } = await admin
    .from('chat_threads')
    .select(
      'thread_id, event_id, inquiry_status, accepted_at, updated_at, vendor:vendor_profiles!inner(business_name, is_demo)',
    )
    .eq('vendor.is_demo', true)
    .order('inquiry_status', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(ROW_LIMIT);
  // NULL, not []: a refused read must stay distinguishable from a real zero all
  // the way to the render.
  const threads = threadsRaw as unknown as ThreadRow[] | null;
  const listed = threads ?? [];

  // Anonymization-until-accept (Glass PR-6b): demo surfaces mask the SAME as
  // production so demos look real. PRE-accept (unrevealed) rows show the neutral
  // placeholder (event_type + city-level region only); post-accept rows show the
  // couple's event display_name + date. The team still "accepts" as the vendor
  // before the identity reveals — exactly the production flow.
  const eventIds = Array.from(new Set(listed.map((t) => t.event_id)));
  const eventLabel = new Map<string, string>();
  // "Couple" is the fallback when a label is missing, and it looks exactly like
  // a deliberate anonymised label — so a failed lookup is indistinguishable from
  // the masking this page does on purpose unless it is said out loud.
  let labelsUnresolved = false;
  if (eventIds.length > 0) {
    const { data: events, error: eventsError } = await admin
      .from('events')
      .select('event_id, display_name, event_date, event_type, region')
      .in('event_id', eventIds);
    const eventById = new Map(
      ((events ?? []) as Array<{
        event_id: string;
        display_name: string | null;
        event_date: string | null;
        event_type: string | null;
        region: string | null;
      }>).map((e) => [e.event_id, e]),
    );
    labelsUnresolved = Boolean(eventsError) || events === null;
    // One batched resolve for the whole page — the organiser noun follows each
    // event's type, so a wake in this list reads "A family" and not "A couple".
    const hostNounByType = await inquiryHostNounsByType(
      listed.map((t) => eventById.get(t.event_id)?.event_type ?? null),
    );
    for (const t of listed) {
      const e = eventById.get(t.event_id);
      if (!e) continue;
      eventLabel.set(
        t.event_id,
        isInquiryRevealed(t)
          ? [e.display_name ?? 'Couple', e.event_date ?? null].filter(Boolean).join(' · ')
          : inquiryPlaceholderLabel({
              eventType: e.event_type,
              city: inquiryCityLabel(e.region),
              hostNoun: e.event_type ? (hostNounByType.get(e.event_type) ?? null) : null,
            }),
      );
    }
  }

  // `null` when nothing was counted — "0 pending" over a refused read is the
  // same lie in a smaller box.
  const pendingCount = threads
    ? threads.filter((t) => t.inquiry_status === 'pending').length
    : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageMasthead
        title="Demo inquiries"
      />

      {labelsUnresolved ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-warn-200/60 bg-warn-50/60 px-3 py-2 text-xs text-warn-900"
        >
          The events behind these inquiries could not be looked up, so every row
          below reads &ldquo;Couple&rdquo;. That is a failed lookup, not the
          before-you-accept masking this page does on purpose.
        </p>
      ) : null}

      <ConsoleTable
        rows={threads}
        readPermitted
        readError={error}
        reads="the demo inquiry inbox"
        cap={ROW_LIMIT}
        label="Demo inquiries"
        minWidth="44rem"
        rowKey={(t) => t.thread_id}
        empty={{
          Icon: MessageSquare,
          title: 'No demo inquiries yet',
          blurb:
            'Re-seed demo vendors (they get unique contact emails), then — as a couple with an event — open a demo vendor from Explore with the demo flag on, Follow, and Message. The inquiry appears here.',
        }}
        columns={[
          {
            header: 'Demo vendor',
            cell: (t) => (
              <Link
                href={`/admin/demo-vendors/inquiries/${t.thread_id}`}
                className="font-medium text-ink hover:text-mulberry"
              >
                {t.vendor?.business_name ?? 'Demo vendor'}
              </Link>
            ),
          },
          {
            header: 'Couple / event',
            cell: (t) => (
              <span className="text-ink/70">{eventLabel.get(t.event_id) ?? 'Couple'}</span>
            ),
          },
          {
            header: 'Status',
            cell: (t) => (
              <span
                className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[t.inquiry_status]}`}
              >
                {t.inquiry_status}
              </span>
            ),
          },
          {
            header: 'Updated',
            hideBelow: 'md',
            mono: true,
            cell: (t) => <span className="whitespace-nowrap text-ink/70">{fmt(t.updated_at)}</span>,
          },
        ]}
      />
    </div>
  );
}
