import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { PROBES } from './probes';
import type { ProbeVerdict } from './verdict';

/**
 * The map's live-telemetry read — each mapped joint's CURRENT verdict.
 *
 * `/admin/ugat/map` has always coloured its edges from the FROZEN 2026-07-05
 * findings registry; its own header calls live telemetry "slice 2". This is
 * slice 2, scoped to what the probe ledger actually knows.
 *
 * ── THE HONESTY CONSTRAINT ─────────────────────────────────────────────────
 * Two probes exist. There are 83 joints. So **81 joints have no verdict**, and
 * the single most important property of this read is that an unprobed joint
 * must come back ABSENT — never `ok`, never a default, never a cheerful
 * fallback. A map that paints unchecked edges as healthy is worse than a map
 * with no telemetry at all, because it converts silence into a claim.
 *
 * The console therefore only lights an edge green when a verdict SAYS so, and
 * leaves every unprobed edge in its ordinary unlit state.
 */

export type JointVerdict = {
  verdict: ProbeVerdict;
  probeKey: string;
  detail: string | null;
  ranAt: string;
};

/**
 * Latest verdict per JOINT id, for joints a probe actually watches.
 *
 * Returns `{}` on any error — the map must still render. That is safe here
 * precisely because absent means "not checked" rather than "fine": a failed
 * read degrades the map to its pre-telemetry appearance instead of painting
 * false health.
 */
export async function latestVerdictByJoint(): Promise<Record<string, JointVerdict>> {
  // Only probes that declare a joint can colour one. A probe without a jointId
  // is not a gap in this function — it is a subsystem the MAP has not covered
  // yet, which is the `map-backlog` debt the coverage baseline already tracks.
  const jointByProbe = new Map<string, string>();
  for (const p of PROBES) if (p.jointId) jointByProbe.set(p.key, p.jointId);
  if (jointByProbe.size === 0) return {};

  try {
    const { data, error } = await createAdminClient()
      .from('interconnection_probe_runs')
      .select('probe_key, verdict, detail, ran_at')
      .in('probe_key', [...jointByProbe.keys()])
      .order('ran_at', { ascending: false })
      .limit(200);
    if (error || !data) return {};

    const out: Record<string, JointVerdict> = {};
    for (const row of data as {
      probe_key: string;
      verdict: ProbeVerdict;
      detail: string | null;
      ran_at: string;
    }[]) {
      const jointId = jointByProbe.get(row.probe_key);
      // Rows arrive newest-first, so the FIRST one seen for a joint is current.
      if (!jointId || out[jointId]) continue;
      out[jointId] = {
        verdict: row.verdict,
        probeKey: row.probe_key,
        detail: row.detail,
        ranAt: row.ran_at,
      };
    }
    return out;
  } catch {
    return {};
  }
}
