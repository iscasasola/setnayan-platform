/**
 * apps/web/lib/venue-check.ts — CAN THIS VENUE CARRY THE LIVE STREAM?
 *
 * Live Watch setup told couples to "run a venue connectivity check a week ahead" and there was no such
 * tool (owner, 5 Nov 2026, on building it: *"it should"* — DECISION_LOG "THE 15 'ACT FIRST' ITEMS").
 * The spec's ask is iteration 0011's offline note, mitigation #1: a check the couple or coordinator runs
 * AT the venue that returns green / yellow / red.
 *
 * PURE — no I/O, no clock, no `server-only`. The phone runs the test upload and hands its measurements
 * here; the server action runs the SAME function again on what it was sent, so the saved verdict is
 * never one the browser typed.
 *
 * ── NO INVENTED NUMBER ─────────────────────────────────────────────────────
 * Every threshold below is the Live Studio encoder's own:
 *   · the full stream is `VIDEO_BITRATE` + `AUDIO_BITRATE` (lib/encoder/video-encode.ts — the
 *     `VideoEncoder` / `AudioEncoder` configs the encoder worker actually runs, CBR);
 *   · the lowest the stream can go is the bottom rung of `BITRATE_LADDER`
 *     (lib/live-studio-encoder-bitrate.ts) plus the same audio;
 *   · "would it have stepped down?" is answered by `stepBitrateRung` itself — the encoder's own
 *     hysteresis (1.5 s backed up for 2 s before a step), fed what this venue measured, every 500 ms
 *     (the Rust occupancy sampler's cadence, src-tauri/crates/encoder/src/occupancy.rs).
 * So GREEN means the encoder would never have left full quality during the test; YELLOW means it would
 * have stepped down and kept going; RED means the upload, on average, could not carry even the lowest
 * rung.
 *
 * ── WHAT IS NOT MEASURED, SAID PLAINLY ─────────────────────────────────────
 * The spec also lists "cellular signal strength". A phone browser cannot read signal bars (no web API
 * exposes them), so this checks what the signal DELIVERS — upload speed and how steady it is. The delay
 * figure is shown, never judged: no number in this codebase says how much delay a stream tolerates.
 *
 * ── THE TEST UPLOAD ────────────────────────────────────────────────────────
 * One second of the full stream (`PROBE_CHUNK_BYTES`) is PUT to our own storage once a second for
 * `PROBE_RUN_MS`, through a presigned URL — paced like the stream itself, so a fast venue is not asked
 * to upload hundreds of MB to prove it can carry 2.6 Mbps. Each PUT's time is measured from send to
 * storage's answer, which includes the round trip; that biases the figure DOWN, never up.
 */
import { AUDIO_BITRATE, VIDEO_BITRATE } from './encoder/video-encode';
import { formatCount } from './format-number';
import {
  BITRATE_LADDER,
  INITIAL_RUNG_STATE,
  MAX_RUNG,
  stepBitrateRung,
  type BitrateRung,
} from './live-studio-encoder-bitrate';

/** The full-quality stream, video + audio, bits per second. */
export const STREAM_FULL_BPS = VIDEO_BITRATE + AUDIO_BITRATE;

/** The lowest the encoder can step to (bottom ladder rung) + the same audio. Below this, no stream. */
export const STREAM_LOWEST_BPS = BITRATE_LADDER[MAX_RUNG].bitrateBps + AUDIO_BITRATE;

/** One test PUT carries one second of the full stream. */
export const PROBE_SLOT_MS = 1_000;
export const PROBE_CHUNK_BYTES = Math.round((STREAM_FULL_BPS / 8) * (PROBE_SLOT_MS / 1_000));

/** How long the upload test runs — the owner's brief: "about 20–30 seconds". */
export const PROBE_RUN_MS = 25_000;

/** The most a run can upload — shown to the person before they start, since it is their data. */
export const PROBE_MAX_BYTES = PROBE_CHUNK_BYTES * Math.ceil(PROBE_RUN_MS / PROBE_SLOT_MS);

/** The encoder's occupancy sampler cadence (occupancy.rs: "every ~500ms"). */
export const SIM_STEP_MS = 500;

/** How many quick round trips the delay figure is the middle of. */
export const DELAY_PINGS = 5;

/**
 * The presigned PUT must outlive the whole run (the delay pings, then `PROBE_RUN_MS`), with room for a
 * slow start. Seconds, because that is what the signer takes.
 */
export const PROBE_URL_TTL_SECONDS = 120;

/**
 * A test upload still in storage this long after it was written belongs to a check that never finished
 * (the tab was closed mid-run). The sweep removes it. Well past the URL's life, so a run still going is
 * never swept from under itself.
 */
export const PROBE_SWEEP_AFTER_MS = 15 * 60 * 1_000;

/** Where every test upload lives — one folder, so the sweep can find all of them. */
export const PROBE_PREFIX = 'venue-check/';

export function probeKey(eventId: string, checkId: string): string {
  return `${PROBE_PREFIX}${eventId}/${checkId}.bin`;
}

/** A place name is optional and short. */
export const PLACE_NAME_MAX = 80;

export function cleanPlaceName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\s+/g, ' ').trim().slice(0, PLACE_NAME_MAX);
  return t.length > 0 ? t : null;
}

/** One test PUT: how many bytes storage confirmed (or the browser saw leave, if cut off) and how long it took. */
export type ProbeSample = { bytes: number; ms: number };

export type VenueVerdict = 'full' | 'reduced' | 'not_enough';

export type VenueJudgement = {
  /** null = nothing moved at all, so there is nothing to judge (the run is not saved). */
  verdict: VenueVerdict | null;
  /** Bytes moved ÷ time spent moving them. */
  averageBps: number;
  /** The slowest single test upload. */
  slowestBps: number;
  /** The lowest-quality rung the encoder would have reached (0 = never stepped down). */
  worstRung: BitrateRung;
  bytesSent: number;
  /** Wall time the samples cover, ms. */
  measuredMs: number;
};

/** More samples than a run can make is not a run. */
export const MAX_SAMPLES = Math.ceil(PROBE_RUN_MS / PROBE_SLOT_MS) + 5;

/** Anything not a finite, sane sample is dropped; bytes never exceed one chunk. */
export function cleanSamples(raw: unknown): ProbeSample[] {
  if (!Array.isArray(raw)) return [];
  const out: ProbeSample[] = [];
  for (const r of raw.slice(0, MAX_SAMPLES)) {
    if (!r || typeof r !== 'object') continue;
    const bytes = Number((r as { bytes?: unknown }).bytes);
    const ms = Number((r as { ms?: unknown }).ms);
    if (!Number.isFinite(bytes) || !Number.isFinite(ms) || ms <= 0 || bytes < 0) continue;
    out.push({ bytes: Math.min(Math.round(bytes), PROBE_CHUNK_BYTES), ms: Math.min(Math.round(ms), PROBE_RUN_MS * 2) });
  }
  return out;
}

function rateBps(s: ProbeSample): number {
  return (s.bytes * 8 * 1_000) / s.ms;
}

/**
 * Replays the venue through the encoder's ladder. Each sample stands for its own slot of wall time: a
 * PUT that finished early stands for the whole second it was paced into (the link's speed in that
 * second); one that overran stands for the time it actually took.
 */
export function worstRungFor(samples: readonly ProbeSample[]): BitrateRung {
  let state = INITIAL_RUNG_STATE;
  let unsent = 0;
  let worst: BitrateRung = 0;
  for (const s of samples) {
    const drainBps = rateBps(s);
    const wall = Math.max(s.ms, PROBE_SLOT_MS);
    for (let t = 0; t < wall; t += SIM_STEP_MS) {
      const step = Math.min(SIM_STEP_MS, wall - t);
      const produceBps = BITRATE_LADDER[state.rung].bitrateBps + AUDIO_BITRATE;
      unsent = Math.max(0, unsent + ((produceBps - drainBps) * step) / 8 / 1_000);
      state = stepBitrateRung(state, { unsentBytes: unsent, elapsedMs: step });
      if (state.rung > worst) worst = state.rung;
    }
  }
  return worst;
}

export function judgeVenue(raw: readonly ProbeSample[]): VenueJudgement {
  const samples = cleanSamples(raw);
  const bytesSent = samples.reduce((n, s) => n + s.bytes, 0);
  const busyMs = samples.reduce((n, s) => n + s.ms, 0);
  const measuredMs = samples.reduce((n, s) => n + Math.max(s.ms, PROBE_SLOT_MS), 0);
  if (bytesSent === 0 || busyMs === 0) {
    return { verdict: null, averageBps: 0, slowestBps: 0, worstRung: 0, bytesSent, measuredMs };
  }
  const averageBps = (bytesSent * 8 * 1_000) / busyMs;
  const slowestBps = Math.min(...samples.map(rateBps));
  const worstRung = worstRungFor(samples);
  const verdict: VenueVerdict =
    averageBps < STREAM_LOWEST_BPS ? 'not_enough' : worstRung === 0 ? 'full' : 'reduced';
  return { verdict, averageBps, slowestBps, worstRung, bytesSent, measuredMs };
}

/** "2.6 Mbps" — one decimal, the unit people see on speed-test apps. */
export function formatMbps(bps: number): string {
  return `${(bps / 1_000_000).toFixed(1)} Mbps`;
}

/** "8 MB" — what the run can cost in data. */
export function formatMegabytes(bytes: number): string {
  return `${formatCount(Math.ceil(bytes / 1_000_000), 0)} MB`;
}

/** The plain words for each verdict — the setup page and the check page say the same thing. */
export const VERDICT_WORDS: Record<VenueVerdict, { short: string; tone: 'good' | 'warn' | 'bad' }> = {
  full: { short: 'OK', tone: 'good' },
  reduced: { short: 'OK at lower quality', tone: 'warn' },
  not_enough: { short: 'Not enough', tone: 'bad' },
};

export function verdictHeadline(v: VenueVerdict): string {
  if (v === 'full') return 'Good to stream';
  if (v === 'reduced') return 'Streams, at lower quality';
  return 'Not enough for a live stream';
}

export function verdictLine(j: Pick<VenueJudgement, 'verdict' | 'worstRung'>): string {
  if (j.verdict === 'full') return 'This spot kept up with the full-quality stream the whole time.';
  if (j.verdict === 'reduced') {
    return `The connection dipped, so the stream would drop to ${BITRATE_LADDER[j.worstRung].label} to keep going. Bring a portable hotspot as a backup.`;
  }
  if (j.verdict === 'not_enough') {
    return `Upload averaged under ${formatMbps(STREAM_LOWEST_BPS)}, the least a stream needs. Plan a portable hotspot or a wired line, then check again.`;
  }
  return 'Nothing reached Setnayan, so there is nothing to judge.';
}

/** "4 Nov 2026" in Philippine time — the day the check ran where it ran, whatever server rendered it. */
export function formatCheckedOn(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

/** "Checked on 4 Nov 2026 · Main hall: OK" — the one sentence the setup page and the check page share. */
export function checkedOnLine(c: { finishedAt: string; placeName: string | null; verdict: VenueVerdict }): string {
  const where = c.placeName ? ` · ${c.placeName}` : '';
  return `Checked on ${formatCheckedOn(c.finishedAt)}${where}: ${VERDICT_WORDS[c.verdict].short}`;
}
