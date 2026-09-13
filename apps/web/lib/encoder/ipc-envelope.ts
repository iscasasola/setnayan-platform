/**
 * apps/web/lib/encoder/ipc-envelope.ts
 *
 * THE ENVELOPE — how an `EncodedChunk` (ipc-contract.ts, the SHAPE) actually
 * crosses the Tauri IPC boundary, and the go-live guard that probes it before
 * `encoder_start` (build-sessions/encoder/S5.md § traps 1–2).
 *
 * 🔒 OWNER DECISION 2026-09-06 (see `ipc-contract.ts`'s own header, and
 * `src-tauri/crates/encoder/src/contract.rs`'s docblock): raw-binary IPC
 * (`InvokeBody::Raw`) is unreachable from `https://` origins on WebKit — S0
 * measured 1797/1797 chunks arriving as JSON, zero as Raw. Rather than serve
 * the app from a Tauri custom scheme or patch wry for a private WebKit API,
 * the transport IS the JSON envelope: `invoke(cmd, { chunk: <base64> })`, ONE
 * string field holding the standard-alphabet, padded base64 of
 * `encodeChunk(...)`'s bytes. `chunkToBase64`/`chunkFromBase64` below are the
 * ONLY place this repo builds or reads that field — `encoder_ipc.rs`'s Rust
 * commands decode it the identical way via `EncodedChunk::from_base64`.
 *
 * ── THE GO-LIVE GUARD, AND THE MISTAKE IT MUST NOT REPEAT ───────────────────
 * S5's own original wording said the guard should refuse go-live on "anything
 * but Raw". S0 measured that this would refuse EVERY macOS user, since Raw
 * never arrives at all — `Envelope::is_zero_copy`'s Rust docblock names this
 * exact trap. So `probeTransport` below reports WHICH envelope carried the
 * probe (provenance, for the health surface) and WHETHER it is usable at
 * all — usability means "the chosen base64-JSON path round-trips a real
 * chunk", not "it happened to be `Raw`". Refuse go-live only when usability
 * is false: the probe itself failed to invoke, or the base64 field it got
 * back does not decode — i.e. the transport is measurably broken, not merely
 * on the expected path.
 */

import {
  ChunkKind,
  encodeChunk,
  parseChunk,
  Envelope,
  type EncodedChunk,
  type EnvelopeValue,
} from './ipc-contract';

/** Browser- and Node-safe (both ship `btoa`/`atob`); no `Buffer` dependency. */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export function decodeBase64(field: string): Uint8Array {
  const binary = atob(field);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** THE ONE ENCODER on the sending side — mirrors `EncodedChunk::to_base64`. */
export function chunkToBase64(chunk: EncodedChunk): string {
  return encodeBase64(encodeChunk(chunk));
}

/** THE ONE DECODER on the receiving side — mirrors `EncodedChunk::from_base64`. */
export function chunkFromBase64(field: string): EncodedChunk {
  return parseChunk(decodeBase64(field));
}

/**
 * A minimal, cheap chunk used ONLY to measure the transport — never real
 * media. Kept tiny (well under the 90-chunk/3s backpressure ring's concern)
 * so the probe cannot itself contend with a live stream's bandwidth.
 */
export function buildProbeChunk(): EncodedChunk {
  return {
    header: { kind: ChunkKind.Video, keyframe: false, seq: 0, tsUs: 0n },
    payload: new Uint8Array([0x50, 0x52, 0x4f, 0x42, 0x45]), // "PROBE"
  };
}

export type TransportProbeResult = {
  /** Which envelope actually carried this call, or `null` if the call itself
   * never returned (network/CSP-level failure — the "measurably unusable"
   * case). */
  envelope: EnvelopeValue | null;
  /** Round-trip latency of the probe invoke, milliseconds. */
  probeMs: number;
  /**
   * Is the transport usable AT ALL — i.e. did SOME envelope deliver a chunk
   * Rust could decode? `false` for exactly two reasons: the invoke rejected/
   * threw, or Rust reported the base64 field did not decode. Never `false`
   * merely because the envelope is `json_array`/`base64` rather than `raw` —
   * see the module docblock.
   */
  usable: boolean;
};

/**
 * The one function the go-live flow calls, once, before `encoder_start`.
 * `invoke` is passed in (rather than imported from `@tauri-apps/api/core`)
 * so this stays testable with a synthetic Tauri bridge and importable from a
 * plain browser bundle without a hard dependency on the Tauri JS package.
 */
export async function probeTransport(
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<string>,
): Promise<TransportProbeResult> {
  const probe = chunkToBase64(buildProbeChunk());
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let raw: string;
  try {
    raw = await invoke('encoder_probe', { chunk: probe });
  } catch {
    const probeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
    return { envelope: null, probeMs, usable: false };
  }
  const probeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
  return { ...parseProbeResponse(raw), probeMs };
}

/**
 * Parse `encoder_probe`'s Rust-side response string. Exported so the
 * mutation-tested "usable" boundary can be tested directly, without a fake
 * Tauri bridge in every case.
 *
 *   "raw:<len>"          — InvokeBody::Raw arrived. Zero-copy. Usable.
 *   "json:base64_ok"     — the base64-JSON envelope arrived AND decoded. Usable.
 *   "json:base64_bad"    — JSON arrived but the base64 field did not decode.
 *                           NOT usable — the chosen transport is genuinely broken.
 *   "json:unrecognized"  — JSON arrived without a `chunk` string field at all.
 *                           NOT usable — same failure class as base64_bad.
 */
export function parseProbeResponse(raw: string): { envelope: EnvelopeValue; usable: boolean } {
  if (raw.startsWith('raw:')) {
    return { envelope: Envelope.Raw, usable: true };
  }
  if (raw === 'json:base64_ok') {
    return { envelope: Envelope.Base64, usable: true };
  }
  // Both remaining response shapes are the chosen (JSON/base64) transport
  // measurably failing to deliver a decodable chunk — not merely "not raw".
  return { envelope: Envelope.Base64, usable: false };
}
