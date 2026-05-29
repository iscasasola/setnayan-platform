/**
 * /admin/telemetry — V2 Phase E read-only viewer.
 *
 * WHY · Surfaces the most-recent 50 rows from public.telemetry_events so
 *       the owner can watch service signals land during pilot. The
 *       reward-fanout job that turns these rows into wallet credits is
 *       V1.x post-pilot scope per CLAUDE.md third 2026-05-28 row Phase E
 *       lock — this page exists to confirm the substrate works while we
 *       wait for the first real Papic / Panood / Patiktok / Pabati / SDE
 *       / Camera Bridge / Live Wall integrations to come online.
 *
 * Surface contract:
 *   • Filter dropdown — All / one of the 7 service codes (?service=)
 *   • Stats banner — total rows · last 24h · processed count
 *   • Table — service badge · checkpoint · event short ID · vendor short
 *     ID · received_at relative · payload preview
 *   • Empty state · polite brand voice per [[feedback_setnayan_no_dev_text_post_launch]]
 *
 * Read-only V1. No mutations. Reward-fanout admin actions ship V1.x.
 *
 * Cross-references:
 *   • Migration: 20260704010000_v2_phase_e_telemetry_events.sql
 *   • Endpoints: apps/web/app/api/telemetry/<svc>/route.ts (7 routes)
 *   • Stacking calculator: apps/web/lib/v2/token-stacking.ts
 *   • Nav entry: apps/web/app/admin/_components/admin-sidebar.tsx (Operations group)
 *   • Canonical read-only V1 banner pattern: apps/web/app/admin/disputes/page.tsx
 */

import Link from 'next/link';
import { Activity, Clock3, Filter as FilterIcon } from 'lucide-react';

import { createAdminClient } from '@/lib/supabase/admin';
import { STACKING_SERVICE_CODES, type StackingServiceCode } from '@/lib/v2/token-stacking';

export const metadata = { title: 'Telemetry · Admin' };

type Props = {
  searchParams: Promise<{ service?: string }>;
};

type TelemetryRow = {
  event_id: string;
  service_code: StackingServiceCode;
  checkpoint: string;
  related_event_id: string | null;
  related_vendor_profile_id: string | null;
  payload: unknown;
  received_at: string;
  processed_at: string | null;
  token_grant_id: string | null;
};

// Service-code → palette token. Distinct hue per service so the eye can
// scan a heterogeneous list. Uses the v2.1 brand palette plus muted
// supporting tints — no raw color hex outside the burnt-sienna family.
const SERVICE_BADGE_CLASS: Record<StackingServiceCode, string> = {
  papic: 'bg-[#C5A059]/12 text-[#A88340] border-[#C5A059]/30',
  panood: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  patiktok: 'bg-violet-100 text-violet-800 border-violet-200',
  pabati: 'bg-amber-100 text-amber-800 border-amber-200',
  sde: 'bg-sky-100 text-sky-800 border-sky-200',
  camera_bridge: 'bg-rose-100 text-rose-800 border-rose-200',
  live_wall: 'bg-slate-200 text-slate-800 border-slate-300',
};

const SERVICE_LABEL: Record<StackingServiceCode, string> = {
  papic: 'Papic',
  panood: 'Panood',
  patiktok: 'Patiktok',
  pabati: 'Pabati',
  sde: 'SDE',
  camera_bridge: 'Camera Bridge',
  live_wall: 'Live Wall',
};

function isStackingServiceCode(value: unknown): value is StackingServiceCode {
  return (
    typeof value === 'string' &&
    (STACKING_SERVICE_CODES as readonly string[]).includes(value)
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  // For older rows, just show the date — pilot won't have anything
  // older than a few weeks but the view should never lie about age.
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function shortId(value: string | null, prefix: string): string {
  if (!value) return '—';
  // UUIDs are 36 chars · short form takes the first 8 of the
  // last-segment + prepends the type-letter prefix for at-a-glance
  // recognition (S89E for events, S89V for vendor_profiles · matches
  // the canonical ID format from CLAUDE.md 2026-05-12 row).
  const tail = value.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${prefix}-${tail}`;
}

function payloadPreview(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '—';
  const keys = Object.keys(payload as Record<string, unknown>);
  if (keys.length === 0) return '—';
  return keys.slice(0, 3).join(' · ') + (keys.length > 3 ? ` · +${keys.length - 3}` : '');
}

export default async function AdminTelemetryPage({ searchParams }: Props) {
  const search = await searchParams;
  const serviceFilter = isStackingServiceCode(search.service) ? search.service : null;

  const admin = createAdminClient();

  let listQuery = admin
    .from('telemetry_events')
    .select(
      'event_id,service_code,checkpoint,related_event_id,related_vendor_profile_id,payload,received_at,processed_at,token_grant_id',
    )
    .order('received_at', { ascending: false })
    .limit(50);

  if (serviceFilter) {
    listQuery = listQuery.eq('service_code', serviceFilter);
  }

  const { data: listData } = await listQuery;
  const rows = (listData ?? []) as TelemetryRow[];

  // Lightweight stats — total · last 24h · processed. Three head counts
  // are cheap and give the operator a one-glance health read.
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: totalCount }, { count: last24hCount }, { count: processedCount }] =
    await Promise.all([
      admin.from('telemetry_events').select('*', { count: 'exact', head: true }),
      admin
        .from('telemetry_events')
        .select('*', { count: 'exact', head: true })
        .gte('received_at', oneDayAgo),
      admin
        .from('telemetry_events')
        .select('*', { count: 'exact', head: true })
        .not('processed_at', 'is', null),
    ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="m-eyebrow text-[#A88340]">V2 Phase E · read-only</p>
        <h1 className="m-display-tight text-3xl text-[#1E2229]">Telemetry</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[#5B5B5B]">
          Service signals from Papic · Panood · Patiktok · Pabati · SDE · Camera
          Bridge · and Live Wall land here as the corresponding workers post
          checkpoints. The 14-token stacking reward grant job is a V1.x
          follow-up — for now this surface confirms the substrate is wired.
        </p>
      </header>

      {/* Stats banner */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total signals" value={String(totalCount ?? 0)} />
        <StatCard label="Last 24h" value={String(last24hCount ?? 0)} />
        <StatCard
          label="Processed for rewards"
          value={`${processedCount ?? 0}`}
          hint={
            processedCount && processedCount > 0
              ? 'Reward-fanout has touched this many.'
              : 'Reward-fanout fires V1.x post-pilot.'
          }
        />
      </div>

      {/* Filter strip */}
      <nav
        aria-label="Filter by service"
        className="m-card flex flex-wrap items-center gap-2 px-4 py-3"
      >
        <span className="flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-[#A88340]">
          <FilterIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Service
        </span>
        <FilterPill href="/admin/telemetry" label="All" active={!serviceFilter} />
        {STACKING_SERVICE_CODES.map((code) => (
          <FilterPill
            key={code}
            href={`/admin/telemetry?service=${code}`}
            label={SERVICE_LABEL[code]}
            active={serviceFilter === code}
          />
        ))}
      </nav>

      {/* Results */}
      {rows.length === 0 ? (
        <div className="m-card flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <Activity className="h-8 w-8 text-[#C5A059]" aria-hidden="true" />
          <p className="max-w-md text-sm leading-relaxed text-[#5B5B5B]">
            Telemetry signals appear here as Papic · Panood · Patiktok · Pabati ·
            SDE · Camera Bridge · and Live Wall services come online during the
            pilot.
          </p>
        </div>
      ) : (
        <div className="m-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[#FBFBFA] text-[#A88340]">
                <tr className="border-b border-[#C5A059]/20">
                  <Th>Service</Th>
                  <Th>Checkpoint</Th>
                  <Th>Event</Th>
                  <Th>Vendor</Th>
                  <Th>Payload</Th>
                  <Th>Received</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#C5A059]/10">
                {rows.map((row) => (
                  <tr key={row.event_id} className="text-[#1E2229]">
                    <td className="px-3 py-2 align-top">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${SERVICE_BADGE_CLASS[row.service_code]}`}
                      >
                        {SERVICE_LABEL[row.service_code]}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="m-mono break-all text-xs text-[#1E2229]">
                        {row.checkpoint}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="m-mono text-xs text-[#5B5B5B]">
                        {shortId(row.related_event_id, 'S89E')}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="m-mono text-xs text-[#5B5B5B]">
                        {shortId(row.related_vendor_profile_id, 'S89V')}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="text-xs text-[#5B5B5B]">
                        {payloadPreview(row.payload)}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="inline-flex items-center gap-1 text-xs text-[#5B5B5B]">
                        <Clock3 className="h-3 w-3" aria-hidden="true" />
                        {formatRelativeTime(row.received_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-[#C5A059]/15 bg-[#FBFBFA]/70 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-[#A88340]">
            Latest 50 · ordered newest first
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="m-card px-4 py-3">
      <p className="m-label-mono text-[10px] uppercase tracking-[0.18em] text-[#A88340]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-[#1E2229]">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[#5B5B5B]">{hint}</p> : null}
    </div>
  );
}

function FilterPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs transition ${
        active
          ? 'border-[#C5A059] bg-[#C5A059] text-white'
          : 'border-[#C5A059]/30 bg-white text-[#1E2229] hover:bg-[#FBFBFA]'
      }`}
    >
      {label}
    </Link>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.16em]">
      {children}
    </th>
  );
}
