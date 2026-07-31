import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimPeriodicJob } from '@/lib/periodic-jobs';
import { PROBES, type Probe } from './probes';
import { isFault, type ProbeResult } from './verdict';

/**
 * The probe runner — cron-free, like every other periodic job here.
 *
 * `claimPeriodicJob` is a DB compare-and-swap: exactly one visitor's request
 * per gap window does the work and everyone else bails instantly. Fired from
 * `after()` on public traffic, so there is no scheduler to provision, nothing
 * to pay for while idle, and nothing that stops running when a cron entry is
 * forgotten during a migration.
 *
 * ⚠ THE HONEST LIMITATION OF THAT CHOICE, stated because it is load-bearing
 * for how you should read the admin page: no traffic means no ticks. On a
 * pre-launch app the probes run when someone visits, not on a clock. A page
 * showing "last run: 3 days ago" is therefore reporting on the SITE's traffic,
 * not on the joints — which is why the surface prints the timestamp as loudly
 * as it prints the verdict, and why an empty ledger must never be read as
 * green.
 */

/** ~4× a day. Cheap reads, but no point running them on every request. */
export const PROBE_GAP_MS = 6 * 60 * 60 * 1000;

/**
 * Run one probe, converting a throw into a recorded `error` verdict.
 *
 * A probe that crashes must leave a row behind. If it failed silently, the
 * admin page would show its last GOOD verdict forever and a dead probe would be
 * indistinguishable from a healthy joint — the same class of lie this whole
 * system exists to detect, committed by the detector.
 */
async function runOne(probe: Probe): Promise<ProbeResult> {
  try {
    return await probe.run();
  } catch (e) {
    return {
      probeKey: probe.key,
      jointId: probe.jointId,
      permitted: false,
      subjectCount: 0,
      truthCount: 0,
      verdict: 'error',
      // Message only — never the stack, which can carry row values.
      detail: `Probe threw: ${e instanceof Error ? e.message : 'unknown error'}`.slice(0, 500),
    };
  }
}

/**
 * Run every probe and write one ledger row each.
 *
 * Sequential, not parallel: two probes today, both cheap, and they share
 * `fetchBookedPairs` — running them in parallel would double a read to save
 * milliseconds on a job that fires four times a day.
 */
export async function runInterconnectionProbes(): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  for (const probe of PROBES) {
    results.push(await runOne(probe));
  }

  const rows = results.map((r) => ({
    probe_key: r.probeKey,
    joint_id: r.jointId ?? null,
    verdict: r.verdict,
    subject_count: r.subjectCount,
    truth_count: r.truthCount,
    detail: r.detail?.slice(0, 500) ?? null,
  }));

  const { error } = await createAdminClient()
    .from('interconnection_probe_runs')
    .insert(rows as never);
  // A failed insert is not worth throwing over — the caller is a fire-and-forget
  // `after()` hook and the next tick rewrites the same verdicts. But it must not
  // be invisible either, so it surfaces as a log the connection-log reader picks
  // up rather than as a swallowed catch.
  if (error) console.error('[interconnect] ledger insert failed:', error.message);

  return results;
}

/**
 * The `after()` entry point — claim-gated, best-effort, never throws.
 *
 * Mirrors `runDailyEmailJobs`: the caller is a public page render, and a health
 * check that can break a page render is worse than no health check.
 */
export async function maybeRunInterconnectionProbes(): Promise<void> {
  try {
    if (await claimPeriodicJob('interconnection-probes', PROBE_GAP_MS)) {
      const results = await runInterconnectionProbes();
      const faults = results.filter((r) => isFault(r.verdict));
      if (faults.length > 0) {
        // Deliberately console, not email: the owner chose the admin console as
        // the place to find out. This line exists so the fault is also greppable
        // in Vercel logs when someone is already looking at them.
        console.warn(
          `[interconnect] ${faults.length} fault(s): ${faults
            .map((f) => `${f.probeKey}=${f.verdict}`)
            .join(', ')}`,
        );
      }
    }
  } catch {
    /* best-effort — a later request retries */
  }
}
