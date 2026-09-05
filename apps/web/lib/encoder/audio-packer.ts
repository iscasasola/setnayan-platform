/**
 * S3 · quanta → AAC-sized packets — pure.
 *
 * The tap posts one 128-frame render quantum at a time; `AudioEncoder` with `mp4a.40.2` wants
 * 1024-frame access units. 1024 / 128 = 8, EXACTLY, so a packet is always eight whole quanta
 * and no quantum is ever split across two packets — which is why this file has no partial-copy
 * arithmetic and no leftover buffer.
 *
 * TIMESTAMPS COME FROM THE PACKET INDEX, NOT FROM ADDITION. Packet n starts at audio frame
 * `n × 1024` and is stamped `round(n × 1024 × 1e6 / 48000)`. Adding 21333 µs per packet — the
 * obvious implementation — loses a third of a microsecond every packet, and a six-hour wedding
 * is 1,012,500 packets, so it ends 337.5 ms behind: silent, cumulative, a third of a second of
 * lip-sync, and exactly the failure the master clock exists to prevent. Deltas therefore alternate 21333 / 21334 / 21333 µs and the
 * ABSOLUTE position stays exact. (The S3 prompt asks for deltas "=== 1024/48000 s"; 1024/48000
 * is 21333.33̄ µs and WebCodecs timestamps are integer microseconds, so exact equality is
 * unrepresentable. The guard asserts the true invariant instead: every delta within 1 µs of
 * nominal AND every absolute timestamp on the exact formula. See audio-packer.test.ts.)
 *
 * The buffer is FRESH per packet on purpose: the packet is handed to an `AudioData`, which
 * copies at construction on some engines and defers on others, and a reused buffer that the
 * next quantum overwrites is a class of bug that shows up only as noise in the stream.
 */

import { AAC_FRAME_SAMPLES, AUDIO_QUANTUM_FRAMES, framesToMicros } from './audio-clock';

export type AudioPacket = {
  /** Absolute audio frame index of this packet's first sample — `packetIndex × 1024`. */
  frameIndex: number;
  /** `AudioData.timestamp`, integer microseconds on the master clock. */
  timestampMicros: number;
  numberOfFrames: number;
  numberOfChannels: number;
  /**
   * `f32-planar` layout: all of channel 0, then all of channel 1. Pinned to a non-shared
   * `ArrayBuffer` because `AudioDataInit.data` is a `BufferSource`, which a
   * `Float32Array<ArrayBufferLike>` does not satisfy — a SharedArrayBuffer could never reach
   * here (nothing allocates one) but the type has to say so.
   */
  data: Float32Array<ArrayBuffer>;
};

export type AudioPacker = {
  /**
   * Append one render quantum, planar (`[L…, R…]`), `channels × framesPerQuantum` long.
   * A quantum of the wrong length is DROPPED rather than mis-copied — a silently shifted
   * channel is worse than a missing one, and the count is on `stats()`.
   */
  push(planar: Float32Array): void;
  stats(): { packets: number; quanta: number; dropped: number };
};

export function createAudioPacker(
  onPacket: (packet: AudioPacket) => void,
  options: { channels?: number; framesPerQuantum?: number; framesPerPacket?: number } = {},
): AudioPacker {
  const channels = options.channels ?? 2;
  const framesPerQuantum = options.framesPerQuantum ?? AUDIO_QUANTUM_FRAMES;
  const framesPerPacket = options.framesPerPacket ?? AAC_FRAME_SAMPLES;
  const quantaPerPacket = framesPerPacket / framesPerQuantum;
  if (!Number.isInteger(quantaPerPacket) || quantaPerPacket < 1) {
    throw new Error(`audio-packer: ${framesPerPacket} frames is not a whole number of ${framesPerQuantum}-frame quanta`);
  }
  const expected = channels * framesPerQuantum;

  let buffer = new Float32Array(channels * framesPerPacket);
  let filled = 0;
  let packetIndex = 0;
  let quanta = 0;
  let dropped = 0;

  return {
    push(planar: Float32Array): void {
      if (planar.length !== expected) {
        dropped += 1;
        return;
      }
      quanta += 1;
      for (let ch = 0; ch < channels; ch += 1) {
        buffer.set(
          planar.subarray(ch * framesPerQuantum, (ch + 1) * framesPerQuantum),
          ch * framesPerPacket + filled,
        );
      }
      filled += framesPerQuantum;
      if (filled < framesPerPacket) return;

      const frameIndex = packetIndex * framesPerPacket;
      const packet: AudioPacket = {
        frameIndex,
        timestampMicros: framesToMicros(frameIndex),
        numberOfFrames: framesPerPacket,
        numberOfChannels: channels,
        data: buffer,
      };
      packetIndex += 1;
      filled = 0;
      buffer = new Float32Array(channels * framesPerPacket);
      onPacket(packet);
    },
    stats: () => ({ packets: packetIndex, quanta, dropped }),
  };
}
