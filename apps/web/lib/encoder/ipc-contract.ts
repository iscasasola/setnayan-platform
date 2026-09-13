/**
 * apps/web/lib/encoder/ipc-contract.ts
 *
 * THE WIRE CONTRACT'S TYPESCRIPT MIRROR — S6 already shipped the Rust half at
 * `src-tauri/crates/encoder/src/contract.rs`; this file is the SAME shape, not a
 * second definition. Read that file's docblock first. Every constant, field order and
 * byte offset below must match it exactly — `ipc-contract.test.ts`'s
 * `ENCODED_FIXTURE_HEX` test is what actually enforces that, not this comment.
 *
 * LAYOUT — 16-byte little-endian header, then payload:
 *
 *   0  u8   kind      0 video · 1 audio · 2 config
 *   1  u8   flags     bit0 keyframe (video only; 0 elsewhere)
 *   2  u16  reserved  MUST be 0 — a non-zero value is a version skew, not padding
 *   4  u32  seq       monotonic per stream, from 0, one sequence for all kinds
 *   8  u64  ts_us     microseconds on the S3 master clock (AudioContext.currentTime)
 *  16  ..   payload
 *
 * `ts_us` is a `bigint` here (not `number`) for the same reason it is `u64` in Rust:
 * `Number.MAX_SAFE_INTEGER` is ~9.007e15, comfortably wide, but a wedding's wall clock
 * in microseconds is not a value worth risking float rounding on — `DataView` gives us
 * a real 64-bit write for free, so we take it.
 *
 * 🔒 OWNER DECISION 2026-09-06 — THE TRANSPORT IS THE JSON ENVELOPE (see `ipc-envelope.ts`
 * for the encode/decode of that envelope). This file owns only the 16-byte header and the
 * `Config` payload SHAPE, which is identical in every envelope — the envelope wraps these
 * bytes, it does not change them. That is the whole point of keeping the two files apart.
 */

export const HEADER_LEN = 16;

/** `flags` bit 0 — this video chunk is a keyframe (an IDR access unit). */
export const FLAG_KEYFRAME = 0b0000_0001;

export const ChunkKind = {
  Video: 0,
  Audio: 1,
  Config: 2,
} as const;
export type ChunkKindValue = (typeof ChunkKind)[keyof typeof ChunkKind];

const CHUNK_KIND_VALUES: ReadonlySet<number> = new Set(Object.values(ChunkKind));

export function chunkKindFromWire(value: number): ChunkKindValue | undefined {
  return CHUNK_KIND_VALUES.has(value) ? (value as ChunkKindValue) : undefined;
}

/** Which envelope delivered these bytes. Provenance only — mirrors Rust's `Envelope`. */
export const Envelope = {
  /** `InvokeBody::Raw` — unreachable from `https://` origins per S0 § 3.1/§ 3.3. */
  Raw: 'raw',
  /** Number-array JSON body — what `invoke(cmd, uint8array)` produces if never re-encoded. */
  JsonArray: 'json_array',
  /** The base64-string envelope this module actually uses (owner decision 2026-09-06). */
  Base64: 'base64',
  /** A localhost HTTP/WebSocket body (S0 § 7 option B), if ever chosen. */
  Loopback: 'loopback',
} as const;
export type EnvelopeValue = (typeof Envelope)[keyof typeof Envelope];

/** Mirrors Rust's `Envelope::is_zero_copy` — true for exactly one variant, on purpose. */
export function isZeroCopy(envelope: EnvelopeValue): boolean {
  return envelope === Envelope.Raw;
}

export type ChunkHeader = {
  kind: ChunkKindValue;
  keyframe: boolean;
  seq: number;
  tsUs: bigint;
};

export type EncodedChunk = {
  header: ChunkHeader;
  payload: Uint8Array;
};

export type DecoderConfig = {
  avcC: Uint8Array;
  asc: Uint8Array;
};

export type ContractError =
  | { kind: 'short_header'; len: number }
  | { kind: 'unknown_kind'; value: number }
  | { kind: 'reserved_not_zero'; value: number }
  | { kind: 'keyframe_on_non_video' }
  | { kind: 'bad_config_payload'; reason: string };

export class ContractParseError extends Error {
  constructor(public readonly detail: ContractError) {
    super(contractErrorMessage(detail));
    this.name = 'ContractParseError';
  }
}

function contractErrorMessage(e: ContractError): string {
  switch (e.kind) {
    case 'short_header':
      return `encoder chunk truncated: ${e.len} bytes, need at least ${HEADER_LEN}`;
    case 'unknown_kind':
      return `unknown chunk kind ${e.value}`;
    case 'reserved_not_zero':
      return `reserved header field was ${e.value}, expected 0 (producer/consumer version skew)`;
    case 'keyframe_on_non_video':
      return 'keyframe flag set on a chunk that is not video';
    case 'bad_config_payload':
      return `config payload malformed: ${e.reason}`;
  }
}

/** Serialise the 16-byte header. Mirrors `ChunkHeader::encode` in contract.rs exactly. */
export function encodeHeader(header: ChunkHeader): Uint8Array {
  const out = new Uint8Array(HEADER_LEN);
  const view = new DataView(out.buffer);
  view.setUint8(0, header.kind);
  view.setUint8(1, header.keyframe ? FLAG_KEYFRAME : 0);
  view.setUint16(2, 0, true); // reserved
  view.setUint32(4, header.seq >>> 0, true);
  view.setBigUint64(8, header.tsUs, true);
  return out;
}

/** Parse the fixed 16 bytes. Mirrors `ChunkHeader::parse` — rejects everything it can name. */
export function parseHeader(bytes: Uint8Array): ChunkHeader {
  if (bytes.length < HEADER_LEN) {
    throw new ContractParseError({ kind: 'short_header', len: bytes.length });
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kindByte = view.getUint8(0);
  const kind = chunkKindFromWire(kindByte);
  if (kind === undefined) {
    throw new ContractParseError({ kind: 'unknown_kind', value: kindByte });
  }
  const flags = view.getUint8(1);
  const reserved = view.getUint16(2, true);
  if (reserved !== 0) {
    throw new ContractParseError({ kind: 'reserved_not_zero', value: reserved });
  }
  const keyframe = (flags & FLAG_KEYFRAME) !== 0;
  if (keyframe && kind !== ChunkKind.Video) {
    throw new ContractParseError({ kind: 'keyframe_on_non_video' });
  }
  const seq = view.getUint32(4, true);
  const tsUs = view.getBigUint64(8, true);
  return { kind, keyframe, seq, tsUs };
}

/** THE ONE DECODER on the TypeScript side too — every envelope funnels here after unwrapping. */
export function parseChunk(bytes: Uint8Array): EncodedChunk {
  const header = parseHeader(bytes);
  return { header, payload: bytes.slice(HEADER_LEN) };
}

export function encodeChunk(chunk: EncodedChunk): Uint8Array {
  const out = new Uint8Array(HEADER_LEN + chunk.payload.length);
  out.set(encodeHeader(chunk.header), 0);
  out.set(chunk.payload, HEADER_LEN);
  return out;
}

/**
 * Build the `Config` payload — `u32 LE json_len | json | avcC | asc`. Mirrors
 * `DecoderConfig::encode_payload` byte for byte.
 */
export function encodeDecoderConfigPayload(config: DecoderConfig): Uint8Array {
  const json = JSON.stringify({ avcC_len: config.avcC.length, asc_len: config.asc.length });
  const jsonBytes = new TextEncoder().encode(json);
  const out = new Uint8Array(4 + jsonBytes.length + config.avcC.length + config.asc.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, jsonBytes.length, true);
  out.set(jsonBytes, 4);
  out.set(config.avcC, 4 + jsonBytes.length);
  out.set(config.asc, 4 + jsonBytes.length + config.avcC.length);
  return out;
}

/** Read a `Config` chunk's payload. Mirrors `EncodedChunk::decoder_config`. */
export function decodeDecoderConfigPayload(chunk: EncodedChunk): DecoderConfig {
  if (chunk.header.kind !== ChunkKind.Config) {
    throw new ContractParseError({
      kind: 'bad_config_payload',
      reason: 'chunk is not a config chunk',
    });
  }
  const payload = chunk.payload;
  if (payload.length < 4) {
    throw new ContractParseError({ kind: 'bad_config_payload', reason: 'no length prefix' });
  }
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const jsonLen = view.getUint32(0, true);
  const jsonEnd = 4 + jsonLen;
  if (jsonEnd > payload.length) {
    throw new ContractParseError({
      kind: 'bad_config_payload',
      reason: 'json prefix past end',
    });
  }
  let parsed: { avcC_len?: number; asc_len?: number };
  try {
    parsed = JSON.parse(new TextDecoder().decode(payload.slice(4, jsonEnd)));
  } catch {
    throw new ContractParseError({
      kind: 'bad_config_payload',
      reason: 'json prefix did not parse',
    });
  }
  const avcLen = parsed.avcC_len;
  const ascLen = parsed.asc_len;
  if (typeof avcLen !== 'number' || typeof ascLen !== 'number') {
    throw new ContractParseError({
      kind: 'bad_config_payload',
      reason: 'avcC_len/asc_len missing',
    });
  }
  const avcEnd = jsonEnd + avcLen;
  const ascEnd = avcEnd + ascLen;
  if (ascEnd !== payload.length) {
    throw new ContractParseError({
      kind: 'bad_config_payload',
      reason: 'declared lengths do not account for the whole payload',
    });
  }
  return { avcC: payload.slice(jsonEnd, avcEnd), asc: payload.slice(avcEnd, ascEnd) };
}

/* ── health-channel event shapes (S6/S9 emit; S5 only defines the wire type) ──────────── */

/**
 * `tauri::ipc::Channel<HealthEvent>` payloads, mirrored so the web side can type the
 * channel's `onmessage`. S5 defines the shape and the `envelope`/`backpressure_drop`
 * variants (its own concerns); S6/S9 emit the others as their own work lands.
 */
export type HealthEvent =
  | { type: 'envelope'; envelope: EnvelopeValue; probeMs: number }
  | {
      type: 'backpressure_drop';
      droppedNonKeyframe: number;
      droppedGop: number;
      totalDropped: number;
    }
  | { type: 'sender'; state: string; detail?: string };

export type SendBufferOccupancy = {
  size: number;
  capacity: number;
};

/* ── the cross-language fixture ─────────────────────────────────────────────────────────
 * IDENTICAL to `contract.rs`'s `fixture_chunk()`. Both languages encode this same
 * logical chunk and must produce the same bytes — `ipc-contract.test.ts` asserts the
 * TypeScript side against `ENCODED_FIXTURE_HEX`; `contract.rs`'s own test asserts the
 * Rust side against the identical literal. Keep the two constants in lockstep by hand;
 * the equality is what the tests hold, not this comment. */
export const ENCODED_FIXTURE: EncodedChunk = {
  header: { kind: ChunkKind.Video, keyframe: true, seq: 7, tsUs: 33_366n },
  payload: new Uint8Array([0, 0, 0, 5, 0x65, 1, 2, 3, 4]),
};

export const ENCODED_FIXTURE_HEX =
  '00010000070000005682000000000000000000056501020304';
