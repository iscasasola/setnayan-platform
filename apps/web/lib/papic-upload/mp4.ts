// lib/papic-upload/mp4.ts — read a clip's length from its own bytes (pure).
//
// Used by the record call to decide whether a clip's web copy is a REAL,
// playable video before the phone may forget the raw (review 2026-10-23,
// major 5 · Guard A: never lose the only playable copy).

/** Pure: the duration in an `mvhd` box somewhere in these bytes. */
export function mvhdDurationMs(bytes: Uint8Array): number | null {
  for (let i = 4; i + 32 <= bytes.length; i++) {
    if (bytes[i] !== 0x6d || bytes[i + 1] !== 0x76 || bytes[i + 2] !== 0x68 || bytes[i + 3] !== 0x64) continue;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const version = bytes[i + 4];
    const p = i + 8; // after 'mvhd' + version/flags
    if (version === 1) {
      if (p + 28 > bytes.length) return null;
      const timescale = dv.getUint32(p + 16);
      const duration = Number(dv.getBigUint64(p + 20));
      return timescale > 0 ? Math.round((duration / timescale) * 1000) : null;
    }
    const timescale = dv.getUint32(p + 8);
    const duration = dv.getUint32(p + 12);
    return timescale > 0 ? Math.round((duration / timescale) * 1000) : null;
  }
  return null;
}

/** A web copy is playable when it is a real MP4 of a sensible length. */
export function webCopyPlayable(durationMs: number | null): boolean {
  return durationMs !== null && durationMs >= 300 && durationMs <= 12_000;
}
