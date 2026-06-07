import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { TelemetryEventType } from '@/lib/telemetry/track-error';

/**
 * Connection Logs · server-side write helpers for app_telemetry_logs.
 *
 * WHY THIS IS SERVER-ONLY
 * -----------------------
 * Every function here uses the service-role admin client (bypasses RLS), so the
 * module is marked `server-only` to make an accidental client import a build
 * error. The browser path is lib/telemetry/track-error.ts (`trackFailure`),
 * which POSTs to the ingest endpoint that calls insertFaultLog().
 *
 * Cross-references:
 *   • Table:    supabase/migrations/20260902000000_app_telemetry_logs.sql
 *   • Ingest:   apps/web/app/api/telemetry/client-fault/route.ts
 *   • Auto-clear: apps/web/app/api/telemetry/auto-resolve/route.ts
 */

const KNOWN_EVENT_TYPES: readonly TelemetryEventType[] = [
  'BUTTON_FAIL',
  'SUPABASE_SAVE_ERROR',
  'BLANK_FALLBACK',
  'OTHER',
];

/** Coerce any incoming string to a valid event_type, defaulting to 'OTHER'. */
export function coerceEventType(value: unknown): TelemetryEventType {
  return typeof value === 'string' && (KNOWN_EVENT_TYPES as string[]).includes(value)
    ? (value as TelemetryEventType)
    : 'OTHER';
}

export interface InsertFaultInput {
  event_type: TelemetryEventType;
  element_name?: string | null;
  file_path?: string | null;
  error_message?: string | null;
  payload_snapshot?: Record<string, unknown>;
}

/**
 * Insert a fault row. Caller is responsible for validation/size-capping — this
 * applies defensive truncation as a backstop. Returns the new row id, or null
 * on failure (never throws: a telemetry write must not break its caller).
 */
export async function insertFaultLog(input: InsertFaultInput): Promise<string | null> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return null; // env misconfiguration — fail closed, swallow.
  }

  const payload =
    input.payload_snapshot &&
    typeof input.payload_snapshot === 'object' &&
    !Array.isArray(input.payload_snapshot)
      ? input.payload_snapshot
      : {};

  const { data, error } = await supabase
    .from('app_telemetry_logs')
    .insert({
      event_type: input.event_type,
      element_name: input.element_name ? input.element_name.slice(0, 256) : null,
      file_path: input.file_path ? input.file_path.slice(0, 512) : null,
      error_message: input.error_message ? input.error_message.slice(0, 4000) : null,
      payload_snapshot: payload,
    })
    .select('id')
    .single();

  if (error || !data) return null;
  return data.id as string;
}

/**
 * Code-level auto-clear: flip every ACTIVE fault matching `filePath` to
 * 'resolved' with resolved_at = now(). Returns the number of rows swept.
 *
 * Used by /api/telemetry/auto-resolve so that when a bug is fixed locally the
 * matching faults can be cleared in one call.
 */
export async function resolveFaultsByFilePath(filePath: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('app_telemetry_logs')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('file_path', filePath)
    .eq('status', 'active')
    .select('id');

  if (error || !data) return 0;
  return data.length;
}
