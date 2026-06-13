/**
 * /admin/demo-vendors/inquiries
 *
 * Admin responder inbox: every inquiry thread a couple has started with a DEMO
 * vendor. Demo vendors are unclaimed (no owning user), so these threads have
 * nowhere else to land — here the team reads them and replies as the vendor.
 * Service-role read (no admin RLS policy on chat tables); scoped to is_demo=TRUE.
 */

import Link from 'next/link';
import { MessageSquare, ChevronLeft } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Demo inquiries · Admin' };
export const dynamic = 'force-dynamic';

type ThreadRow = {
  thread_id: string;
  event_id: string;
  inquiry_status: 'pending' | 'accepted' | 'declined';
  updated_at: string;
  vendor: { business_name: string | null } | null;
};

const STATUS_STYLE: Record<ThreadRow['inquiry_status'], string> = {
  pending: 'bg-terracotta/10 text-terracotta-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-ink/10 text-ink/60',
};

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
  const admin = createAdminClient();

  // Threads whose vendor is a demo vendor. `!inner` + the embedded filter keep
  // this to demo vendors only. Pending first, then most-recently-updated.
  const { data: threadsRaw } = await admin
    .from('chat_threads')
    .select(
      'thread_id, event_id, inquiry_status, updated_at, vendor:vendor_profiles!inner(business_name, is_demo)',
    )
    .eq('vendor.is_demo', true)
    .order('inquiry_status', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(300);
  const threads = (threadsRaw ?? []) as unknown as ThreadRow[];

  // Event labels — display_name + date only (no couple PII).
  const eventIds = Array.from(new Set(threads.map((t) => t.event_id)));
  const eventLabel = new Map<string, string>();
  if (eventIds.length > 0) {
    const { data: events } = await admin
      .from('events')
      .select('event_id, display_name, event_date')
      .in('event_id', eventIds);
    for (const e of (events ?? []) as Array<{
      event_id: string;
      display_name: string | null;
      event_date: string | null;
    }>) {
      eventLabel.set(
        e.event_id,
        [e.display_name ?? 'Couple', e.event_date ?? null].filter(Boolean).join(' · '),
      );
    }
  }

  const pendingCount = threads.filter((t) => t.inquiry_status === 'pending').length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <Link
          href="/admin/demo-vendors"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Demo vendors
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <MessageSquare className="h-6 w-6 text-ink/70" />
          Demo inquiries
        </h1>
        <p className="text-sm text-ink/60">
          Inquiries couples have sent to demo vendors. Open one to reply{' '}
          <strong>as the vendor</strong> — demo vendors are unclaimed, so the team
          role-plays their responses here. {pendingCount} pending.
        </p>
      </header>

      {threads.length === 0 ? (
        <p className="rounded-md border border-dashed border-ink/15 px-4 py-8 text-center text-sm text-ink/60">
          No demo inquiries yet. Re-seed demo vendors (they now get unique contact
          emails), then — as a couple with an event — open a demo vendor at{' '}
          <code className="rounded bg-ink/5 px-1 text-[12px]">/explore?demo=1</code>,
          Follow, and Message. The inquiry will appear here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10 bg-cream">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-ink/5 text-left text-[11px] uppercase tracking-wider text-ink/55">
                <th className="px-4 py-2 font-medium">Demo vendor</th>
                <th className="px-4 py-2 font-medium">Couple / event</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {threads.map((t) => (
                <tr key={t.thread_id} className="border-b border-ink/5 last:border-b-0 hover:bg-ink/[0.02]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/demo-vendors/inquiries/${t.thread_id}`}
                      className="font-medium text-ink hover:text-terracotta"
                    >
                      {t.vendor?.business_name ?? 'Demo vendor'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink/70">{eventLabel.get(t.event_id) ?? 'Couple'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[t.inquiry_status]}`}>
                      {t.inquiry_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink/55">{fmt(t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
