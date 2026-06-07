/**
 * Connection Logs · client-safe fault-tracking helper.
 *
 * WHY THIS LIVES HERE
 * -------------------
 * `trackFailure()` is the single call sites use to report a front-end fault —
 * a button handler that threw, a Supabase client write that failed, or a
 * surface that fell back to an empty state. It feeds /admin/connection-logs.
 *
 * This module is CLIENT-SAFE: it imports nothing server-only and never touches
 * the database directly. It POSTs to /api/telemetry/client-fault, which inserts
 * with the service-role key. We deliberately do NOT `.insert()` from the
 * browser — that would require an anon-writable table (spam / DoS / injection
 * surface). The endpoint is the gate. Owner-confirmed posture (2026-06-07).
 *
 * trackFailure NEVER throws and NEVER blocks UX — telemetry must not be able to
 * break the very flow it's observing. All failures are swallowed (with a dev
 * console line). Use `void trackFailure({...})` in handlers if you don't await.
 *
 * Cross-references:
 *   • Ingest endpoint: apps/web/app/api/telemetry/client-fault/route.ts
 *   • Auto-clear:      apps/web/app/api/telemetry/auto-resolve/route.ts
 *   • Dashboard:       apps/web/app/admin/connection-logs/page.tsx
 *   • Table:           supabase/migrations/20260902000000_app_telemetry_logs.sql
 *   • Guide:           ADMIN_LOGS_GUIDE.md (repo root)
 */

/** Fault classification. Mirrors the DB CHECK on app_telemetry_logs.event_type. */
export type TelemetryEventType =
  | 'BUTTON_FAIL'
  | 'SUPABASE_SAVE_ERROR'
  | 'BLANK_FALLBACK'
  | 'OTHER';

export interface TrackFailureInput {
  /** What kind of fault this is. */
  eventType: TelemetryEventType;
  /** Human label for the thing that failed, e.g. 'Submit Registration Form'. */
  elementName?: string;
  /** Source location, e.g. 'app/(auth)/register/register-form.tsx'. */
  filePath?: string;
  /** The thrown value (Error, string, or anything) — normalised before send. */
  error?: unknown;
  /** Localized data variables present at the moment of failure. */
  payload?: Record<string, unknown>;
}

/** Wire shape POSTed to the ingest endpoint — snake_case to match DB columns. */
interface FaultWireBody {
  event_type: TelemetryEventType;
  element_name: string | null;
  file_path: string | null;
  error_message: string | null;
  payload_snapshot: Record<string, unknown>;
}

/**
 * Reduce any thrown value to a bounded, storable string.
 * Errors contribute `name: message` plus the first ~6 stack frames.
 */
function normalizeError(error: unknown): string | null {
  if (error == null) return null;
  if (error instanceof Error) {
    const head = `${error.name}: ${error.message}`;
    const stack = error.stack
      ? error.stack.split('\n').slice(1, 7).map((l) => l.trim()).join('\n')
      : '';
    return (stack ? `${head}\n${stack}` : head).slice(0, 4000);
  }
  if (typeof error === 'string') return error.slice(0, 4000);
  try {
    return JSON.stringify(error).slice(0, 4000);
  } catch {
    return String(error).slice(0, 4000);
  }
}

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Record a front-end fault. Fire-and-forget safe — resolves once the report is
 * sent (or silently dropped on failure). Never throws.
 *
 * @example
 * try {
 *   await saveDraft();
 * } catch (error) {
 *   await trackFailure({
 *     eventType: 'SUPABASE_SAVE_ERROR',
 *     elementName: 'Save Draft',
 *     filePath: 'app/dashboard/[eventId]/landing/draft-editor.tsx',
 *     error,
 *     payload: { eventId, draftId },
 *   });
 * }
 */
export async function trackFailure(input: TrackFailureInput): Promise<void> {
  const { eventType, elementName, filePath, error, payload } = input;

  // Distinct, greppable dev signal so a fault is obvious in the console while
  // developing — independent of whether the network report lands.
  if (isDev) {
    // eslint-disable-next-line no-console
    console.error('🛑 [TELEMETRY CAPTURED]:', eventType, elementName ?? '');
  }

  // Server-side (no fetch-able relative URL / no document): skip the network
  // report. Server faults should be captured via Sentry or recordFault() in
  // lib/telemetry/fault-log.ts instead. trackFailure is the browser path.
  if (typeof window === 'undefined') return;

  const body: FaultWireBody = {
    event_type: eventType,
    element_name: elementName ? elementName.slice(0, 256) : null,
    file_path: filePath ? filePath.slice(0, 512) : null,
    error_message: normalizeError(error),
    payload_snapshot:
      payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {},
  };

  try {
    await fetch('/api/telemetry/client-fault', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      // keepalive lets the report survive an unmount / navigation that the
      // failing interaction may have triggered.
      keepalive: true,
    });
  } catch {
    // Network failure reporting a fault must never surface to the user.
    if (isDev) {
      // eslint-disable-next-line no-console
      console.error('🛑 [TELEMETRY DROPPED]: report POST failed', eventType);
    }
  }
}
