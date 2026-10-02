import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { TelemetryEventType } from '@/lib/telemetry/track-error';
import { redactPayload } from '@/lib/telemetry/redact';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  FAULT_KINDS,
  normalizeLabel,
  normalizeMessage,
  scrubText,
  type FaultKind,
} from '@/lib/telemetry/fault-normalize';

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
 * EVERY WRITE IS AN ISSUE (2026-10-02, "every action that fails is recorded,
 * traced and listed"): rows are no longer inserted directly. `recordFault`
 * calls `record_app_fault`, which groups identical failures into ONE
 * `app_fault_issues` row (count + first/last seen + build) and samples a trace
 * row into `app_telemetry_logs`. Messages are scrubbed of personal data
 * (`fault-normalize.ts` scrubText) and payloads redacted (`redact.ts`) here,
 * the single chokepoint.
 *
 * Cross-references:
 *   • Tables:   supabase/migrations/20260902000000_app_telemetry_logs.sql
 *               supabase/migrations/20271260713505_every_failure_is_recorded.sql
 *   • Ingest:   apps/web/app/api/telemetry/client-fault/route.ts
 *   • Auto-clear: apps/web/app/api/telemetry/auto-resolve/route.ts
 */

/** Coerce any incoming string to a valid event_type, defaulting to 'OTHER'. */
export function coerceEventType(value: unknown): FaultKind {
  return typeof value === 'string' && (FAULT_KINDS as readonly string[]).includes(value)
    ? (value as FaultKind)
    : 'OTHER';
}

export interface InsertFaultInput {
  event_type: TelemetryEventType | FaultKind;
  element_name?: string | null;
  file_path?: string | null;
  error_message?: string | null;
  payload_snapshot?: Record<string, unknown>;
}

/** The live build, so an issue can close itself once a newer one ships. */
export function currentBuildSha(): string | null {
  return process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || null;
}

/** One failure, as every recorder hands it over. */
export interface RecordFaultInput {
  kind: FaultKind;
  /** What failed: an action (`app/x/actions.ts#save`), a route, a DB target. Groups the issue. */
  action: string;
  /** The raw message — scrubbed + normalised here, never stored as given. */
  message?: string | null;
  /** What a person pressed, if known ("Send my reply"). Scrubbed here. */
  element?: string | null;
  filePath?: string | null;
  /** Where/which step: page, from, digest, status… Redacted here. */
  trace?: Record<string, unknown>;
}

/** The call record_app_fault receives — exported so the db test drives the real shaping. */
export function shapeFaultArgs(input: RecordFaultInput, buildSha: string | null) {
  const raw = input.message ?? '';
  return {
    p_kind: coerceEventType(input.kind),
    p_action: scrubText(input.action, 300) || '(unknown)',
    p_message: normalizeMessage(raw),
    p_detail: scrubText(raw, 4000),
    p_element: input.element ? normalizeLabel(input.element) : null,
    p_file_path: input.filePath ? input.filePath.slice(0, 512) : null,
    p_build_sha: buildSha,
    p_trace: redactPayload(input.trace ?? null),
  };
}

export type FaultRpc = (
  fn: 'record_app_fault',
  args: ReturnType<typeof shapeFaultArgs>,
) => Promise<{ data: unknown; error: unknown }>;

/**
 * Record one failure through `record_app_fault` (issue upsert + sampled trace
 * row + today's failure count). Returns the trace row id, else the issue id,
 * else null. NEVER throws — a recorder must not break what it records.
 */
export async function recordFault(input: RecordFaultInput, rpc?: FaultRpc): Promise<string | null> {
  let call = rpc;
  if (!call) {
    try {
      const admin = createAdminClient();
      call = (fn, args) => admin.rpc(fn, args) as unknown as Promise<{ data: unknown; error: unknown }>;
    } catch {
      return null; // env misconfiguration — fail closed, swallow.
    }
  }
  try {
    const { data, error } = await call('record_app_fault', shapeFaultArgs(input, currentBuildSha()));
    if (error) {
      // This IS the audit trail for a caller's failure — a discarded error here
      // is doubly silent. logQueryError never records a `lib/telemetry/` call
      // site back into this function, so this cannot recurse.
      logQueryError('lib/telemetry/fault-log.ts: record_app_fault', error);
      return null;
    }
    const row = (Array.isArray(data) ? data[0] : data) as { issue_id?: string; log_id?: string } | null;
    return row?.log_id ?? row?.issue_id ?? null;
  } catch (err) {
    console.error('[telemetry] record_app_fault threw', err);
    return null;
  }
}

/**
 * Legacy entry point (16 call sites + the ingest route). Every row it writes
 * now goes through `recordFault`, so the explicit failures those actions
 * already report group into issues with no change at the call site.
 */
export async function insertFaultLog(input: InsertFaultInput): Promise<string | null> {
  const payload = input.payload_snapshot ?? {};
  return recordFault({
    kind: coerceEventType(input.event_type),
    action:
      (typeof payload.action === 'string' && payload.action) ||
      input.element_name ||
      input.file_path ||
      '(unknown)',
    message: input.error_message ?? null,
    element: input.element_name ?? null,
    filePath: input.file_path ?? null,
    trace: payload,
  });
}

/** Batched success / step counts: [{ a, ok, fail }]. Never a row per success. */
export async function bumpActionCounts(
  counts: ReadonlyArray<{ a: string; ok?: number; fail?: number }>,
): Promise<number> {
  if (counts.length === 0) return 0;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('bump_app_action_counts', {
      p_counts: counts.slice(0, 200).map((c) => ({
        a: scrubText(c.a, 300),
        ok: Math.max(0, Math.min(10000, Math.floor(Number(c.ok) || 0))),
        fail: Math.max(0, Math.min(10000, Math.floor(Number(c.fail) || 0))),
      })),
    });
    if (error) {
      console.error('[telemetry] bump_app_action_counts failed', error.message);
      return 0;
    }
    return typeof data === 'number' ? data : 0;
  } catch {
    return 0;
  }
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

  if (error) {
    logQueryError('lib/telemetry/fault-log.ts: app_telemetry_logs update', error, {
      file_path: filePath,
    });
    return 0;
  }
  if (!data) return 0;
  return data.length;
}
