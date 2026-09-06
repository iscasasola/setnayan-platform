/**
 * S5 · the wire contract's TypeScript mirror, checked for byte-equality against
 * `src-tauri/crates/encoder/src/contract.rs`'s identical fixture.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ChunkKind,
  ENCODED_FIXTURE,
  ENCODED_FIXTURE_HEX,
  Envelope,
  FLAG_KEYFRAME,
  HEADER_LEN,
  chunkKindFromWire,
  decodeDecoderConfigPayload,
  encodeChunk,
  encodeDecoderConfigPayload,
  encodeHeader,
  isZeroCopy,
  parseChunk,
  parseHeader,
  ContractParseError,
} from './ipc-contract';

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

test('THE CROSS-LANGUAGE CONTRACT TEST — encodes to the hex contract.rs is pinned to', () => {
  // Independently hard-coded on both sides. If this file's encodeChunk drifts from
  // contract.rs's EncodedChunk::encode, ONE of the two language tests goes red — this
  // does not derive the expected value from the function under test.
  assert.equal(toHex(encodeChunk(ENCODED_FIXTURE)), ENCODED_FIXTURE_HEX);
});

test('header round-trips through bytes', () => {
  const header = { kind: ChunkKind.Video, keyframe: true, seq: 0xdeadbeef, tsUs: 16_777_216_000n };
  assert.deepEqual(parseHeader(encodeHeader(header)), header);
});

test('header is little-endian at the documented offsets', () => {
  const bytes = encodeHeader({
    kind: ChunkKind.Audio,
    keyframe: false,
    seq: 0x01020304,
    tsUs: 0x0807060504030201n,
  });
  assert.equal(bytes[0], 1, 'kind byte');
  assert.deepEqual([...bytes.slice(2, 4)], [0, 0], 'reserved');
  assert.deepEqual([...bytes.slice(4, 8)], [0x04, 0x03, 0x02, 0x01], 'seq LE');
  assert.equal(bytes[8], 0x01, 'ts_us LE low byte');
  assert.equal(bytes[15], 0x08, 'ts_us LE high byte');
});

test('a short or skewed header is named, not guessed', () => {
  assert.throws(
    () => parseHeader(new Uint8Array(15)),
    (err: unknown) =>
      err instanceof ContractParseError && err.detail.kind === 'short_header' && err.detail.len === 15,
  );

  const unknownKind = new Uint8Array(HEADER_LEN);
  unknownKind[0] = 9;
  assert.throws(
    () => parseHeader(unknownKind),
    (err: unknown) => err instanceof ContractParseError && err.detail.kind === 'unknown_kind',
  );

  const reservedSet = new Uint8Array(HEADER_LEN);
  reservedSet[2] = 1;
  assert.throws(
    () => parseHeader(reservedSet),
    (err: unknown) =>
      err instanceof ContractParseError && err.detail.kind === 'reserved_not_zero' && err.detail.value === 1,
  );

  const keyframeOnAudio = new Uint8Array(HEADER_LEN);
  keyframeOnAudio[0] = ChunkKind.Audio;
  keyframeOnAudio[1] = FLAG_KEYFRAME;
  assert.throws(
    () => parseHeader(keyframeOnAudio),
    (err: unknown) => err instanceof ContractParseError && err.detail.kind === 'keyframe_on_non_video',
  );
});

test('chunkKindFromWire refuses an unknown byte rather than coercing it', () => {
  assert.equal(chunkKindFromWire(0), ChunkKind.Video);
  assert.equal(chunkKindFromWire(9), undefined);
});

test('decoder config round-trips and refuses a payload that does not add up', () => {
  const config = {
    avcC: new Uint8Array([1, 0x64, 0, 0x1f, 0xff, 0xe1]),
    asc: new Uint8Array([0x11, 0x90]),
  };
  const chunk = {
    header: { kind: ChunkKind.Config, keyframe: false, seq: 0, tsUs: 0n },
    payload: encodeDecoderConfigPayload(config),
  };
  assert.deepEqual(decodeDecoderConfigPayload(chunk), config);

  const truncated = { ...chunk, payload: chunk.payload.slice(0, -1) };
  assert.throws(
    () => decodeDecoderConfigPayload(truncated),
    (err: unknown) => err instanceof ContractParseError && err.detail.kind === 'bad_config_payload',
  );
});

test('only the raw envelope claims zero copy', () => {
  assert.equal(isZeroCopy(Envelope.Raw), true);
  assert.equal(isZeroCopy(Envelope.JsonArray), false);
  assert.equal(isZeroCopy(Envelope.Base64), false);
  assert.equal(isZeroCopy(Envelope.Loopback), false);
});

test('parseChunk is the one decoder — round-trips encodeChunk', () => {
  const chunk = {
    header: { kind: ChunkKind.Video, keyframe: true, seq: 42, tsUs: 123_456n },
    payload: new Uint8Array([9, 8, 7]),
  };
  assert.deepEqual(parseChunk(encodeChunk(chunk)), chunk);
});
