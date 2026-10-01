// Insights Studio surface — the body of the former /admin/connection-logs page,
// re-homed here (2026-07-10) so the App Performance menu is ONE tabbed
// studio. Its actions/_components stay under /admin/connection-logs; the legacy
// route is now a redirect into /admin/app-performance?tab={tab}.
/**
 * /admin/connection-logs — Connection Logs dashboard (real-time fault tracker).
 *
 * WHY · Operator-facing view of front-end faults captured by trackFailure():
 *       broken buttons, failed Supabase saves, and blank fallbacks. Distinct
 *       from Sentry (engineer-facing, iteration 0035) and /admin/telemetry
 *       (backend service checkpoints, V2 Phase E). Owner-confirmed standalone
 *       surface (2026-06-07).
 *
 * This server component does the privileged initial read via the service-role
 * client (the page is already behind app/admin/layout.tsx) and hands the rows
 * to the client island, which owns tabs, filters, the Realtime stream, the
 * inspection modal, and the resolve/bulk-archive controls.
 *
 * Cross-references:
 *   • Migration: supabase/migrations/20260902000000_app_telemetry_logs.sql
 *   • Ingest:    apps/web/app/api/telemetry/client-fault/route.ts
 *   • Auto-clear: apps/web/app/api/telemetry/auto-resolve/route.ts
 *   • Helper:    apps/web/lib/telemetry/track-error.ts (trackFailure)
 *   • Nav:       apps/web/app/admin/_components/admin-sidebar.tsx (Insights group)
 *   • Guide:     ADMIN_LOGS_GUIDE.md (repo root)
 */

import { createAdminClient } from '@/lib/supabase/admin';

import { ConnectionLogsClient, type FaultLogRow } from '@/app/admin/connection-logs/connection-logs-client';

import { requireAdmin } from '@/lib/admin/require-admin';

const ROW_LIMIT = 200;
const SELECT_COLS =
  'id,created_at,event_type,element_name,file_path,error_message,payload_snapshot,status,resolved_at';

export async function ConnectionLogsSurface() {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: activeData, error: activeError }, { data: resolvedData, error: resolvedError }] =
    await Promise.all([
    admin
      .from('app_telemetry_logs')
      .select(SELECT_COLS)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(ROW_LIMIT),
    admin
      .from('app_telemetry_logs')
      .select(SELECT_COLS)
      .in('status', ['resolved', 'ignored'])
      .order('resolved_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(ROW_LIMIT),
  ]);

  /* 🚨 A REFUSED READ SAID "All clear — No active faults right now." (admin
     audit 2026-09-30, row 9). Both errors were dropped, `?? []` handed the
     island two empty lists, and a fault tracker that could not read its faults
     announced there were none. The island is not mounted on a refusal — an
     empty island IS the all-clear — so the notice is the whole surface. */
  if (activeError || resolvedError) {
    return (
      <div
        role="alert"
        className="rounded-card bg-[var(--sn-warning-soft)] p-6 text-center text-sm text-ink"
      >
        Couldn&rsquo;t load this — refresh to try again. This is not an all-clear.
      </div>
    );
  }

  return (
    <ConnectionLogsClient
      initialActive={(activeData ?? []) as FaultLogRow[]}
      initialResolved={(resolvedData ?? []) as FaultLogRow[]}
      rowLimit={ROW_LIMIT}
    />
  );
}
