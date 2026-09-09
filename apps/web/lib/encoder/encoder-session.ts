/**
 * S18 · THE SESSION — where the page finally calls Rust.
 *
 * ── WHAT WAS MISSING ────────────────────────────────────────────────────────
 * Every stage of this pipeline shipped and was tested, and no production code
 * called any of them. `grep -rn "invoke('encoder_start'" apps/web` returned
 * nothing; `lib/encoder/*` had zero non-test importers; the worker's encoded
 * H.264 went into a ring whose `drain()` had callers only in tests, and its AAC
 * was dropped on the floor. This module is the join: it takes what
 * `program-canvas.ts` now emits and turns it into `encoder_config` /
 * `encoder_push` calls against the commands `src-tauri` has had registered and
 * ACL-granted since S5.
 *
 * ── THE ONE RULE THAT IS NOT NEGOTIABLE ─────────────────────────────────────
 * MEDIA MUST NEVER PRECEDE THE CONFIG. Rust's FLV muxer cannot decode a
 * keyframe without the `avcC`, and its tagger counts every violation
 * (`Tagger::media_before_config`) precisely because it is a real failure mode,
 * not a theoretical one. The two halves of the config arrive separately — the
 * `avcC` on the first video chunk, the `asc` on the first audio chunk — and
 * `EncodedChunk`'s Config kind carries BOTH in one payload. So this module
 * holds media in a bounded buffer until both halves exist, sends one Config
 * chunk, and only then starts pushing. `sessionIsSending` is the flag, and
 * `bufferMedia` is the pure function that decides.
 *
 * Dropping the OLDEST held frame on overflow is correct and deliberate: Rust's
 * `WireGate` refuses everything until a keyframe anyway, so the useful frames
 * are always the newest ones. Dropping the newest would hold a stale GOP and
 * delay going to air.
 *
 * ── WHY EVERY BROWSER TOUCH-POINT IS INJECTED ───────────────────────────────
 * Same reason as every other file in this folder: the whole contract runs in
 * Node against a recording fake, with no Tauri, no worker and no WebCodecs.
 */

import {
  ChunkKind,
  encodeDecoderConfigPayload,
  type EncodedChunk,
} from './ipc-contract';
import { chunkToBase64 } from './ipc-envelope';
import type { MediaChunkWire, ProgramConfig, ProgramMedia } from './program-canvas';

/**
 * How many chunks may wait for the decoder config before the oldest is dropped.
 * 300 is ten seconds of video or six of audio — far longer than the handful of
 * ticks it actually takes for both configs to land, and bounded so a stream
 * where audio never starts costs memory that stops growing.
 */
export const CONFIG_WAIT_CAPACITY = 300;

export type EncoderInvoke = (command: string, args: Record<string, unknown>) => Promise<unknown>;

export type EncoderSessionDeps = {
  /** `invoke` from `@tauri-apps/api/core`, injected so tests need no shell. */
  invoke: EncoderInvoke;
  /** POSTs `/api/live-studio/encoder/token` and returns the minted token. */
  mintToken: (eventId: string) => Promise<string>;
};

/** What the caller learns when a session ends. */
export type EncoderSessionOutcome = {
  chunksPushed: number;
  chunksDroppedAwaitingConfig: number;
  pushErrors: number;
  bytesReceived: number;
  chunksReceived: number;
};

export type HeldConfig = {
  avcC: Uint8Array | null;
  asc: Uint8Array | null;
};

/**
 * Both halves present? Pure, and the single place the question is asked — a
 * second copy of this test that disagreed with the first is exactly how media
 * gets released before its config.
 */
export function configComplete(held: HeldConfig): held is { avcC: Uint8Array; asc: Uint8Array } {
  return held.avcC !== null && held.asc !== null;
}

/**
 * The Config chunk, carrying both decoder configurations in one payload, the
 * way `contract.rs`'s `DecoderConfig::encode_payload` reads it back.
 *
 * `tsUs` is 0n rather than the current media time ON PURPOSE: the config is not
 * a moment in the programme, it is a property of it, and stamping it with a
 * real timestamp makes it look like a frame that arrived before the frames it
 * describes.
 */
export function buildConfigChunk(held: { avcC: Uint8Array; asc: Uint8Array }): EncodedChunk {
  return {
    header: { kind: ChunkKind.Config, keyframe: false, seq: 0, tsUs: 0n },
    payload: encodeDecoderConfigPayload({ avcC: held.avcC, asc: held.asc }),
  };
}

/** One drained wire chunk in the shape the IPC contract encodes. */
export function toEncodedChunk(wire: MediaChunkWire, kind: 'video' | 'audio'): EncodedChunk {
  return {
    header: {
      kind: kind === 'video' ? ChunkKind.Video : ChunkKind.Audio,
      // The contract refuses `keyframe` on a non-video chunk
      // (`ContractError.keyframe_on_non_video`), so audio is always false here
      // regardless of what the worker marked it — AAC's per-frame independence
      // is not the same claim as an H.264 IDR and the wire format says so.
      keyframe: kind === 'video' ? wire.keyframe : false,
      seq: wire.seq,
      tsUs: BigInt(Math.round(wire.timestampMicros)),
    },
    payload: new Uint8Array(wire.data),
  };
}

/**
 * Append to the pre-config buffer, dropping the oldest past capacity.
 * Returns how many were dropped by THIS call, so the caller can count them
 * rather than discovering a silent loss later.
 */
export function bufferMedia(
  buffer: EncodedChunk[],
  incoming: readonly EncodedChunk[],
  capacity: number = CONFIG_WAIT_CAPACITY,
): number {
  buffer.push(...incoming);
  if (buffer.length <= capacity) return 0;
  const dropped = buffer.length - capacity;
  buffer.splice(0, dropped);
  return dropped;
}

export type EncoderSession = {
  /** Mints a token and calls `encoder_start`. Throws with the Rust error name. */
  start(eventId: string): Promise<void>;
  /** Feed one config half as it arrives from the worker. */
  acceptConfig(config: ProgramConfig): void;
  /** Feed one tick's drained media. Never throws; push failures are counted. */
  acceptMedia(media: ProgramMedia): void;
  /** Calls `encoder_stop` and returns the tallies from both sides. */
  stop(): Promise<EncoderSessionOutcome>;
  /** True once the Config chunk has gone and media is flowing. */
  isSending(): boolean;
};

export function createEncoderSession(deps: EncoderSessionDeps): EncoderSession {
  const held: HeldConfig = { avcC: null, asc: null };
  const waiting: EncodedChunk[] = [];
  let started = false;
  let sending = false;
  let chunksPushed = 0;
  let chunksDroppedAwaitingConfig = 0;
  let pushErrors = 0;

  /**
   * Fire-and-count. `encoder_push` is `try_send` on the Rust side and returns
   * `channel_full_or_closed` rather than blocking, so a failure here means the
   * supervisor is behind or gone — it is counted and the stream continues,
   * because dropping one frame is not a reason to end a wedding. A dead session
   * surfaces through the health channel, which is the surface built for it.
   *
   * ⚠ DO NOT "FIX" THIS BY AWAITING IN A LOOP. Ordering is already guaranteed
   * and awaiting would cost throughput for nothing: `invoke` posts its IPC
   * message SYNCHRONOUSLY before returning its promise, and `encoder_push` is a
   * synchronous Tauri command that `try_send`s into the channel on the same
   * thread — so the channel receives chunks in exactly the order this loop
   * called them, which is the order RTMP needs. Awaiting each round trip would
   * serialise 77 invokes a second behind their own responses and starve the
   * encoder while adding no ordering that is not already there.
   */
  function push(command: string, chunk: EncodedChunk): void {
    void deps
      .invoke(command, { chunk: chunkToBase64(chunk) })
      .then(() => {
        chunksPushed += 1;
      })
      .catch(() => {
        pushErrors += 1;
      });
  }

  function releaseIfReady(): void {
    if (sending || !started || !configComplete(held)) return;
    sending = true;
    push('encoder_config', buildConfigChunk(held));
    for (const chunk of waiting) push('encoder_push', chunk);
    waiting.length = 0;
  }

  return {
    async start(eventId) {
      const token = await deps.mintToken(eventId);
      await deps.invoke('encoder_start', { token });
      started = true;
      // A config may have arrived while the token round-trip was in flight.
      releaseIfReady();
    },

    acceptConfig(config) {
      if (config.kind === 'video') held.avcC = new Uint8Array(config.description);
      else held.asc = new Uint8Array(config.description);
      releaseIfReady();
    },

    acceptMedia(media) {
      const chunks = [
        ...media.video.map((wire) => toEncodedChunk(wire, 'video')),
        ...media.audio.map((wire) => toEncodedChunk(wire, 'audio')),
      ];
      if (sending) {
        for (const chunk of chunks) push('encoder_push', chunk);
        return;
      }
      chunksDroppedAwaitingConfig += bufferMedia(waiting, chunks);
    },

    async stop() {
      sending = false;
      started = false;
      waiting.length = 0;
      let bytesReceived = 0;
      let chunksReceived = 0;
      try {
        const result = (await deps.invoke('encoder_stop', {})) as {
          bytesReceived?: number;
          chunksReceived?: number;
        } | null;
        bytesReceived = result?.bytesReceived ?? 0;
        chunksReceived = result?.chunksReceived ?? 0;
      } catch {
        // A stop that fails because the session was never authorized is not an
        // error worth throwing at a couple who just pressed "end broadcast".
      }
      return {
        chunksPushed,
        chunksDroppedAwaitingConfig,
        pushErrors,
        bytesReceived,
        chunksReceived,
      };
    },

    isSending: () => sending,
  };
}
