/**
 * apps/web/lib/venue-probe-run.ts — THE VENUE CHECK'S TEST UPLOAD, RUN ON THE PHONE. IT ALWAYS ENDS.
 *
 * What it does, in order:
 *   1. DELAY — `DELAY_PINGS` tiny round trips to our own `/api/health` (HEAD, no-store); the middle one
 *      is the delay figure. Shown, never judged (lib/venue-check.ts says why).
 *   2. UPLOAD — once a second for `PROBE_RUN_MS`, PUT one second of the full stream
 *      (`PROBE_CHUNK_BYTES` of random bytes, so nothing on the way can shrink it) to the ONE presigned
 *      URL the start action signed. A PUT that overruns its second delays the next one, exactly as a
 *      live stream backs up.
 *
 * 🔑 EVERY RUN ENDS, AND THE CLOCK IS WHAT ENDS IT — never an event. An upload that stops fires no
 * `error`, no `abort`, no `load` (the Papic 0%-forever defect; lib/upload-send.ts). So each PUT is cut
 * at the run's deadline, and what it had moved by then is what it is measured as. A dead connection
 * therefore MEASURES as slow — which is the truth about that venue — instead of hanging the screen.
 *
 * The browser's `fetch`, `XMLHttpRequest`, clock and timers are handed in, so the test drives the real
 * control flow (lib/venue-probe-run.test.ts) — including a PUT that never answers.
 */
import {
  DELAY_PINGS,
  PROBE_CHUNK_BYTES,
  PROBE_RUN_MS,
  PROBE_SLOT_MS,
  type ProbeSample,
} from './venue-check';

export type ProbeRunEnv = {
  fetch?: typeof fetch;
  XMLHttpRequest?: typeof XMLHttpRequest;
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (id: unknown) => void;
  /** The bytes each PUT carries. Production fills one random buffer once. */
  makeBody?: () => Blob | Uint8Array;
};

export type ProbeRunHooks = {
  /** 0–1 of the run's time, for the progress bar. */
  onProgress?: (fraction: number) => void;
  /** Each finished test upload, with its speed — the live figure on screen. */
  onSample?: (sample: ProbeSample, bps: number) => void;
};

export type ProbeRunOutcome =
  | { kind: 'measured'; samples: ProbeSample[]; delayMs: number | null }
  /** Storage answered, and the answer was no (the URL expired, the signature was refused). Not the venue's fault. */
  | { kind: 'refused'; status: number }
  | { kind: 'cancelled' };

export type ProbeRun = { done: Promise<ProbeRunOutcome>; cancel: () => void };

/** One ping may take this long before it is counted as no answer. */
const PING_TIMEOUT_MS = 3_000;

function randomBody(): Blob {
  const bytes = new Uint8Array(PROBE_CHUNK_BYTES);
  // getRandomValues fills at most 65,536 bytes per call.
  for (let i = 0; i < bytes.length; i += 65_536) {
    globalThis.crypto.getRandomValues(bytes.subarray(i, Math.min(i + 65_536, bytes.length)));
  }
  return new Blob([bytes]);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

export function runVenueProbe(
  target: { uploadUrl: string; contentType: string },
  hooks: ProbeRunHooks = {},
  env: ProbeRunEnv = {},
): ProbeRun {
  const doFetch = env.fetch ?? globalThis.fetch.bind(globalThis);
  const Xhr = env.XMLHttpRequest ?? globalThis.XMLHttpRequest;
  const now = env.now ?? (() => performance.now());
  const later = env.setTimeout ?? ((fn: () => void, ms: number) => globalThis.setTimeout(fn, ms));
  const clear = env.clearTimeout ?? ((id: unknown) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>));

  let cancelled = false;
  let stopCurrent: () => void = () => {};
  const sleep = (ms: number) => new Promise<void>((resolve) => later(resolve, Math.max(0, ms)));

  async function ping(): Promise<number | null> {
    const abort = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = later(() => abort?.abort(), PING_TIMEOUT_MS);
    const t = now();
    try {
      const res = await doFetch('/api/health', { method: 'HEAD', cache: 'no-store', signal: abort?.signal });
      return res.ok ? now() - t : null;
    } catch {
      return null;
    } finally {
      clear(timer);
    }
  }

  /** One PUT, cut at `deadline`. Resolves with what moved, or with storage's refusal. */
  function put(body: Blob | Uint8Array, deadline: number): Promise<ProbeSample | { refused: number }> {
    return new Promise((resolve) => {
      const xhr = new Xhr();
      const started = now();
      let loaded = 0;
      let ended = false;
      const end = (out: ProbeSample | { refused: number }) => {
        if (ended) return;
        ended = true;
        clear(cutoff);
        stopCurrent = () => {};
        resolve(out);
      };
      const measured = (bytes: number) => end({ bytes, ms: Math.max(1, now() - started) });
      const cutoff = later(() => {
        // The deadline, not an event, ends a PUT that has gone quiet: what moved by now is the measurement.
        measured(loaded);
        try {
          xhr.abort();
        } catch {
          /* already finished */
        }
      }, Math.max(0, deadline - started));
      stopCurrent = () => {
        measured(loaded);
        try {
          xhr.abort();
        } catch {
          /* already finished */
        }
      };
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) loaded = e.loaded;
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) measured(PROBE_CHUNK_BYTES);
        else end({ refused: xhr.status });
      });
      // A broken connection is a measurement of this venue, not a refusal: it moved what it moved.
      xhr.addEventListener('error', () => measured(loaded));
      xhr.addEventListener('abort', () => measured(loaded));
      try {
        xhr.open('PUT', target.uploadUrl, true);
        xhr.setRequestHeader('Content-Type', target.contentType);
        xhr.send(body as XMLHttpRequestBodyInit);
      } catch {
        measured(0);
      }
    });
  }

  const done = (async (): Promise<ProbeRunOutcome> => {
    const delays: number[] = [];
    for (let i = 0; i < DELAY_PINGS && !cancelled; i++) {
      const d = await ping();
      if (d !== null) delays.push(d);
    }
    if (cancelled) return { kind: 'cancelled' };

    const body = env.makeBody ? env.makeBody() : randomBody();
    const samples: ProbeSample[] = [];
    const t0 = now();
    const deadline = t0 + PROBE_RUN_MS;
    for (let i = 0; ; i++) {
      if (cancelled) return { kind: 'cancelled' };
      const slotStart = t0 + i * PROBE_SLOT_MS;
      if (now() < slotStart) await sleep(slotStart - now());
      if (cancelled) return { kind: 'cancelled' };
      // A PUT is only started with a full second left — the time it would need at full quality.
      if (now() + PROBE_SLOT_MS > deadline) break;
      const out = await put(body, deadline);
      if (cancelled) return { kind: 'cancelled' };
      if ('refused' in out) return { kind: 'refused', status: out.refused };
      samples.push(out);
      hooks.onSample?.(out, (out.bytes * 8 * 1_000) / out.ms);
      hooks.onProgress?.(Math.min(1, (now() - t0) / PROBE_RUN_MS));
    }
    hooks.onProgress?.(1);
    return { kind: 'measured', samples, delayMs: median(delays) };
  })();

  return {
    done,
    cancel: () => {
      cancelled = true;
      stopCurrent();
    },
  };
}
