import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clapperboard,
  Clock3,
  Loader2,
  XCircle,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { findPatiktokTemplate } from '@/lib/patiktok';

// Iteration 0017 PR4 — Patiktok render-job monitor (admin).
//
// Read-only ops view over the client-side render queue: recent jobs across all
// events, their status, which render path ran, output size, delivery state, and
// any failure reason — so the team can spot reels that didn't render (e.g. a
// device without WebCodecs, or R2 CORS not yet set). Admin layout gates access
// (app/admin/layout.tsx).

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Patiktok renders · Admin' };

type JobRow = {
  job_id: string;
  event_id: string;
  template_slug: string;
  duration_sec: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  render_mode: string | null;
  output_bytes: number | null;
  failure_reason: string | null;
  enqueued_at: string;
  completed_at: string | null;
  delivered_at: string | null;
};

function fmtMb(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StatusPill({ status }: { status: JobRow['status'] }) {
  const map: Record<JobRow['status'], { Icon: typeof Clock3; cls: string; label: string }> = {
    queued: { Icon: Clock3, cls: 'bg-ink/5 text-ink/70', label: 'Queued' },
    processing: { Icon: Loader2, cls: 'bg-warn-100 text-warn-900', label: 'Rendering' },
    completed: { Icon: CheckCircle2, cls: 'bg-success-100 text-success-900', label: 'Completed' },
    failed: { Icon: XCircle, cls: 'bg-danger-100 text-danger-900', label: 'Failed' },
    cancelled: { Icon: XCircle, cls: 'bg-ink/5 text-ink/55', label: 'Cancelled' },
  };
  const { Icon, cls, label } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${cls}`}
    >
      <Icon
        aria-hidden
        className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`}
        strokeWidth={1.75}
      />
      {label}
    </span>
  );
}

export default async function AdminPatiktokPage() {
  const admin = createAdminClient();

  const { data: jobsRaw } = await admin
    .from('patiktok_render_jobs')
    .select(
      'job_id, event_id, template_slug, duration_sec, status, render_mode, output_bytes, failure_reason, enqueued_at, completed_at, delivered_at',
    )
    .order('enqueued_at', { ascending: false })
    .limit(60);
  const jobs = (jobsRaw ?? []) as JobRow[];

  const eventIds = Array.from(new Set(jobs.map((j) => j.event_id)));
  const { data: eventRows } = eventIds.length
    ? await admin.from('events').select('event_id, display_name').in('event_id', eventIds)
    : { data: [] as Array<{ event_id: string; display_name: string | null }> };
  const eventName = new Map<string, string>();
  for (const e of eventRows ?? []) {
    eventName.set(
      e.event_id as string,
      ((e.display_name as string | null) ?? '').trim() || 'Untitled wedding',
    );
  }

  const counts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="space-y-6">
      <Link
        href="/admin/addons"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--m-orange-2)]"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Back to add-ons
      </Link>

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Clapperboard aria-hidden className="h-6 w-6" strokeWidth={1.75} /> Patiktok renders
        </h1>
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          Client-side render queue across all events — latest {jobs.length}. Reels
          encode in the couple&rsquo;s browser; this surfaces any that failed
          (e.g. a device without WebCodecs, or R2 CORS not yet set).
        </p>
      </header>

      <div className="flex flex-wrap gap-2 text-xs">
        {(['queued', 'processing', 'completed', 'failed', 'cancelled'] as const).map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-cream px-3 py-1 font-mono uppercase tracking-[0.15em] text-ink/70"
          >
            {s} · {counts[s] ?? 0}
          </span>
        ))}
      </div>

      {jobs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/55">
          No Patiktok render jobs yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-cream">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-[11px] uppercase tracking-[0.15em] text-ink/55">
                <th className="px-4 py-2.5 font-medium">Event</th>
                <th className="px-4 py-2.5 font-medium">Template</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Dur</th>
                <th className="px-4 py-2.5 font-medium">Mode</th>
                <th className="px-4 py-2.5 font-medium">Size</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Queued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {jobs.map((j) => {
                const templateName =
                  findPatiktokTemplate(j.template_slug)?.name ?? j.template_slug;
                return (
                  <tr key={j.job_id} className="align-top">
                    <td className="px-4 py-3 font-medium text-ink">
                      {eventName.get(j.event_id) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-ink/70">{templateName}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={j.status} />
                      {j.status === 'failed' && j.failure_reason ? (
                        <p className="mt-1 inline-flex items-start gap-1 text-[11px] text-danger-700">
                          <AlertTriangle
                            aria-hidden
                            className="mt-0.5 h-3 w-3 shrink-0"
                            strokeWidth={1.75}
                          />
                          {j.failure_reason}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink/65">
                      {j.duration_sec}s
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink/65">
                      {j.render_mode ? j.render_mode.replace('client_', '') : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink/65">
                      {fmtMb(j.output_bytes)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink/65">
                      {j.delivered_at ? '✓ sent' : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink/55">
                      {new Date(j.enqueued_at).toLocaleString('en-PH', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
