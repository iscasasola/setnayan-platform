/**
 * apps/web/lib/encoder/go-live-guard.ts — THE PROBE, AND WHAT IT IS ALLOWED TO REFUSE.
 *
 * ── WHY THIS FILE HAS THIS EXACT NAME ───────────────────────────────────────
 * `src-tauri/src/encoder_ipc.rs`'s docblock has cited this path since S5, as
 * the caller of `encoder_probe` before `encoder_start`. It had never existed —
 * `find . -name "go-live-guard*"` returned nothing on any branch — so the
 * transport was never probed and the citation was a promise. This is the file
 * it names.
 *
 * ── THE RULE, WHICH WAS ALREADY DECIDED — NOT INVENTED HERE ─────────────────
 * Three places already say what a probe failure may do, and they agree:
 *
 *   · `ipc-envelope.ts`'s docblock — "Refuse go-live only when usability is
 *     false: the probe itself failed to invoke, or the base64 field it got back
 *     does not decode — i.e. the transport is measurably broken, not merely on
 *     the expected path."
 *   · `live-studio-ingest-health.ts` — "Whether the transport is genuinely
 *     UNUSABLE is `probeTransport`'s `usable` field, decided upstream of this
 *     module entirely (the go-live guard refuses to start at all in that case)."
 *   · `S5.md` trap 3 — "refuse go-live only if the transport is unusable … A
 *     degraded-but-working transport is a warning, never a silent pass."
 *
 * S5's ORIGINAL wording said "anything but Raw refuses go-live". S0 measured
 * that Raw never arrives at all on WebKit (1797/1797 chunks JSON, zero Raw), so
 * that rule would refuse EVERY macOS user. `Envelope::is_zero_copy`'s Rust
 * docblock names this trap by name. Hence: this module NEVER reads the envelope
 * to decide. It reads `usable`, and passes the envelope through untouched, as
 * provenance for the health strip.
 *
 * ── AND WHY THERE IS NO LATENCY REFUSAL ─────────────────────────────────────
 * S5 trap 3 also allows refusing on "a measured per-chunk cost above a
 * threshold you set from (1) and justify". THE MEASUREMENT DOES NOT SUPPORT
 * ONE, and saying so is the justification. From `S0-FINDING.md` §§ 3.1 / 3.4,
 * same machine, same origin, same 10 KB payload at 30/s:
 *
 *   | run                          | completed | mean   | p50   | p95   | max   |
 *   |------------------------------|-----------|--------|-------|-------|-------|
 *   | healthy (shipped CSP)        | 1797/1797 | 50.7ms | 19ms  | 151ms | 501ms |
 *   | CSP enforced without `ipc:`  |  300/300  | 155ms  | 141ms | 304ms | 420ms |
 *
 * The distributions OVERLAP: the degraded run's mean (155 ms) sits inside the
 * healthy run's p95 (151 ms), and the healthy run's max (501 ms) is WORSE than
 * the degraded run's max (420 ms). No threshold separates them. Worse, both
 * runs completed 100 % of chunks with zero errors — the "degraded" transport
 * was still working. A latency refusal built on this data would refuse healthy
 * macOS users at their p95, which is the same mistake as the Raw rule wearing a
 * stopwatch.
 *
 * So slowness is reported, never enforced — S5's "a warning, never a silent
 * pass". And note what the probe actually is: ONE invoke, a single sample. Even
 * if the distributions were separable, one draw from them could not be the
 * thing that stops a wedding going to air.
 */

import { probeTransport, type TransportProbeResult } from './ipc-envelope';
import type { EnvelopeValue } from './ipc-contract';

/**
 * Above this, a probe is called slow — for the operator's information only,
 * never as a gate (see the module docblock).
 *
 * 500 ms is S0's healthy `max` over 1797 chunks (501 ms), rounded down: a
 * single probe slower than the worst single chunk of a known-good run is worth
 * a sentence. It is deliberately NOT set near the healthy mean or p95, because
 * a note that fires on ordinary traffic is a note people learn to ignore.
 */
export const PROBE_SLOW_MS = 500;

export type GoLiveRefusal = 'transport_unusable';

export type GoLiveVerdict = {
  /** May the broadcast start? */
  allowed: boolean;
  /** Machine-readable cause, or `null` when allowed. */
  refusal: GoLiveRefusal | null;
  /** What the operator is told. Empty when allowed and nothing is unusual. */
  sentence: string;
  /**
   * Which envelope carried the probe, for `decideIngestHealth`'s
   * `transportEnvelope` input. `null` when the probe never came back — there is
   * no envelope to name in that case, and naming one would be a guess.
   */
  envelope: EnvelopeValue | null;
  /** Working, but slower than S0's healthy ceiling. Never a refusal. */
  slow: boolean;
  probeMs: number;
};

/** Plain operator language, matching `live-studio-ingest-health.ts`'s voice. */
export const TRANSPORT_UNUSABLE_SENTENCE =
  "Setnayan can't send video from this computer right now. Close Setnayan and open it again, then try Go live.";
export const TRANSPORT_SLOW_SENTENCE =
  'Setnayan is sending video more slowly than usual on this computer. Going live is still fine — watch the status here once you start.';

/**
 * Turn one probe into a go/no-go. PURE, and the only place the refusal rule
 * lives — a second copy that disagreed with this one is how a rule that says
 * "never refuse on the envelope" starts refusing on the envelope.
 */
export function decideGoLive(probe: TransportProbeResult): GoLiveVerdict {
  const slow = probe.probeMs > PROBE_SLOW_MS;
  if (!probe.usable) {
    return {
      allowed: false,
      refusal: 'transport_unusable',
      sentence: TRANSPORT_UNUSABLE_SENTENCE,
      envelope: probe.envelope,
      slow,
      probeMs: probe.probeMs,
    };
  }
  return {
    allowed: true,
    refusal: null,
    sentence: slow ? TRANSPORT_SLOW_SENTENCE : '',
    envelope: probe.envelope,
    slow,
    probeMs: probe.probeMs,
  };
}

/**
 * Probe once, then decide. The one call the go-live flow makes before
 * `encoder_start`.
 *
 * `invoke` is injected for the same reason `probeTransport`'s is: this stays
 * testable with a synthetic bridge, and importable from a plain browser bundle
 * with no hard dependency on the Tauri JS package.
 */
export async function guardGoLive(
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<string>,
): Promise<GoLiveVerdict> {
  return decideGoLive(await probeTransport(invoke));
}
