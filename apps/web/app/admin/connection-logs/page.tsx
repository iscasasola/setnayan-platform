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

import { ConnectionLogsClient, type FaultLogRow } from './connection-logs-client';

export const metadata = { title: 'Connection Logs · Admin' };
export const dynamic = 'force-dynamic';

const ROW_LIMIT = 200;
const SELECT_COLS =
  'id,created_at,event_type,element_name,file_path,error_message,payload_snapshot,status,resolved_at';

export default async function AdminConnectionLogsPage() {
  const admin = createAdminClient();

  const [{ data: activeData }, { data: resolvedData }] = await Promise.all([
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

  return (
    <ConnectionLogsClient
      initialActive={(activeData ?? []) as FaultLogRow[]}
      initialResolved={(resolvedData ?? []) as FaultLogRow[]}
      rowLimit={ROW_LIMIT}
    />
  );
}
