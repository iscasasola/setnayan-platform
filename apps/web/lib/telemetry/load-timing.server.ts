import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { backgroundWritesAllowed } from '@/lib/background-writes';
import { currentBuildSha } from '@/lib/telemetry/fault-log';
import { normalizePath } from '@/lib/telemetry/fault-normalize';
import { makeRouteMatcher, type RouteMatcher } from '@/lib/telemetry/route-pattern';
import {
  RETENTION_DAYS,
  coerceTargets,
  summarizeLoads,
  type LoadRow,
  type LoadTimeSummary,
  type WireLoad,
} from '@/lib/telemetry/load-timing';
import screens from '@/lib/ugat/screens.generated.json';
import { ADMIN_ROUTES } from '@/lib/admin-map/admin-routes.generated';

/**
 * THE LOAD-TIME LOG · the server half — the write the ingest makes, and the
 * read the App Performance cockpit makes. Both through the service role (the
 * table has RLS on, no policy, no grant: migration 20271270180398); the read is
 * only ever called behind `requireAdmin()`.
 */

let matcher: RouteMatcher | null = null;
/** Every route pattern the app is built from — the host/guest/supplier screens and the admin pages. */
export function routePatterns(): string[] {
  return [
    ...(screens as { screens: Array<{ route: string }> }).screens.map((s) => s.route),
    ...ADMIN_ROUTES.map((r) => r.path),
  ];
}
/** A path the browser sent → its route pattern (ids re-blanked first, whatever the browser did). */
export function toRoutePattern(path: string): string | null {
  matcher ??= makeRouteMatcher(routePatterns());
  return matcher(normalizePath(path));
}

/**
 * Who may write. The Problems list's rule (lib/background-writes.ts: only the
 * production deployment — a dev server's .env.local points at the PRODUCTION
 * database) plus ONE exception that cannot reach production: a database on
 * this machine (127.0.0.1 / localhost), which is what the lab runs against.
 */
export function loadWritesAllowed(env: Partial<Record<string, string | undefined>> = process.env): boolean {
  if (backgroundWritesAllowed(env)) return true;
  try {
    const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname;
    return host === '127.0.0.1' || host === 'localhost';
  } catch {
    return false;
  }
}

/** Is there a session cookie on this request? A flag, not an identity — nothing about who. */
export function hasSessionCookie(names: readonly string[]): boolean {
  return names.some((n) => /^sb-.+-auth-token(?:\.\d+)?$/.test(n));
}

/** Write a batch. Returns rows stored. NEVER throws — a recorder must not break what it records. */
export async function recordLoads(rows: readonly WireLoad[], signedIn: boolean): Promise<number> {
  if (rows.length === 0 || !loadWritesAllowed()) return 0;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('record_load_timings', {
      p_rows: rows,
      p_build_sha: currentBuildSha(),
      p_signed_in: signedIn,
    });
    if (error) {
      logQueryError('lib/telemetry/load-timing.server.ts: record_load_timings', error);
      return 0;
    }
    return typeof data === 'number' ? data : 0;
  } catch (err) {
    console.error('[load-timing] record_load_timings threw', err);
    return 0;
  }
}

/** The admin-set targets. A refused read is an empty map (every page on the 1.5 s default) AND an error. */
export async function readLoadTargets(): Promise<{ targets: Record<string, number>; error: string | null }> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from('platform_settings').select('load_time_targets').eq('id', 1).maybeSingle();
    if (error) {
      logQueryError('lib/telemetry/load-timing.server.ts: platform_settings', error);
      return { targets: {}, error: 'page targets unread — showing every page against 1.5 s' };
    }
    return { targets: coerceTargets((data as { load_time_targets?: unknown } | null)?.load_time_targets), error: null };
  } catch {
    return { targets: {}, error: 'page targets unread — showing every page against 1.5 s' };
  }
}

/** The most rows one read takes. Above it the numbers are a floor and the page says so. */
export const LOAD_READ_CAP = 20_000;

const SELECT =
  'created_at,kind,route,total_ms,server_ms,download_ms,render_ms,lcp_ms,inp_ms,outcome,device,connection,signed_in,build_sha,weight';

export type LoadTimeRead = LoadTimeSummary & {
  targets: Record<string, number>;
  errors: string[];
  capped: boolean;
  sinceIso: string;
};

/**
 * The cockpit's read: the last 30 days of rows + the targets → the summary.
 * ⛔ CALL ONLY BEHIND requireAdmin() — it reads through the service role.
 * A refused read says so (errors[]), it never renders as "no slow loads".
 */
export async function fetchLoadTimeStats(minN: number, now: Date = new Date()): Promise<LoadTimeRead> {
  const since = new Date(now.getTime() - RETENTION_DAYS * 86_400_000).toISOString();
  const errors: string[] = [];
  const [{ targets, error: tErr }, rowsRead] = await Promise.all([
    readLoadTargets(),
    (async (): Promise<{ rows: LoadRow[]; error: string | null }> => {
      try {
        const admin = createAdminClient();
        const { data, error } = await admin
          .from('app_load_timings')
          .select(SELECT)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(LOAD_READ_CAP);
        if (error) {
          logQueryError('lib/telemetry/load-timing.server.ts: app_load_timings', error);
          return { rows: [], error: 'load times unread' };
        }
        return { rows: (data ?? []) as LoadRow[], error: null };
      } catch {
        return { rows: [], error: 'load times unread' };
      }
    })(),
  ]);
  if (tErr) errors.push(tErr);
  if (rowsRead.error) errors.push(rowsRead.error);
  return {
    ...summarizeLoads(rowsRead.rows, targets, { minN }),
    targets,
    errors,
    capped: rowsRead.rows.length >= LOAD_READ_CAP,
    sinceIso: since,
  };
}
