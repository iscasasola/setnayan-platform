// Auto-Recap FFmpeg command builder (Group B prototype · Oracle Always-Free).
//
// PURE argv builder — no fs, no spawn, no Node-only APIs — so it unit-tests
// without the render box. The Oracle worker spawns `ffmpeg` with the returned
// argv (array form, never a shell string → no injection from R2 paths).
//
// Scope (owner 2026-06-28): Auto-Recap is a ≤30-second, 1080×1920 H.264 montage
// of an event's best Papic stills/clips with one optional music bed. FFmpeg-only
// (no Remotion/Chromium) keeps the free ARM box light. Richer motion (Ken-Burns
// zoompan, xfade transitions, Lottie/LUT overlays) is a deliberate follow-up;
// v1 is a robust, deterministic scale→crop→concat montage.

/** Hard 30-second cap on every render output (owner 2026-06-28). Not configurable. */
export const RECAP_MAX_DURATION_MS = 30_000;
/** Vertical 9:16 delivery — matches Personal Reels / Stories. */
export const RECAP_WIDTH = 1080;
export const RECAP_HEIGHT = 1920;
export const RECAP_FPS = 30;

export interface RecapSlot {
  /** Local path on the worker box (already pulled from R2). */
  inputPath: string;
  type: 'photo' | 'clip';
  /** On-screen duration; a clip is trimmed to this, a still is held for it. */
  durationMs: number;
}

export interface RecapRenderSpec {
  slots: RecapSlot[];
  /** Music bed local path. Omitted/null → a silent render (end-to-end test path). */
  audioPath?: string | null;
  /** Output MP4 path on the worker box. */
  outputPath: string;
  width?: number;
  height?: number;
  fps?: number;
}

/** Format milliseconds as seconds with ≤3 decimals, no trailing zeroes. */
function secs(ms: number): string {
  return String(Math.round((ms / 1000) * 1000) / 1000);
}

/**
 * Build the FFmpeg argv for a ≤30s vertical Auto-Recap montage.
 *
 * Throws on an empty slot list, a non-positive slot duration, or a total that
 * exceeds the 30-second cap (the selection stage must respect the cap — the cap
 * is enforced here too so a bad spec can never produce an over-length render).
 */
export function buildAutoRecapFfmpegArgs(spec: RecapRenderSpec): string[] {
  const width = spec.width ?? RECAP_WIDTH;
  const height = spec.height ?? RECAP_HEIGHT;
  const fps = spec.fps ?? RECAP_FPS;

  if (spec.slots.length === 0) throw new Error('recap_no_slots');
  for (const s of spec.slots) {
    if (!(s.durationMs > 0)) throw new Error('recap_bad_slot_duration');
  }
  const totalMs = spec.slots.reduce((n, s) => n + s.durationMs, 0);
  if (totalMs > RECAP_MAX_DURATION_MS) throw new Error('recap_exceeds_30s_cap');

  const args: string[] = ['-y'];

  // Inputs — one per slot, in order. A still is looped + time-bounded; a clip is
  // time-bounded (trimmed) by the input-side -t.
  for (const slot of spec.slots) {
    if (slot.type === 'photo') {
      args.push('-loop', '1', '-t', secs(slot.durationMs), '-i', slot.inputPath);
    } else {
      args.push('-t', secs(slot.durationMs), '-i', slot.inputPath);
    }
  }
  const hasAudio = !!spec.audioPath;
  if (hasAudio) args.push('-i', spec.audioPath as string);

  // Filter graph: normalize every slot to WxH@fps (cover-crop, square pixels,
  // yuv420p) then concat into one stream. Deterministic + transition-free in v1.
  const norm = spec.slots
    .map(
      (_, i) =>
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
        `crop=${width}:${height},fps=${fps},format=yuv420p,setsar=1[v${i}]`,
    )
    .join(';');
  const concatInputs = spec.slots.map((_, i) => `[v${i}]`).join('');
  const filter = `${norm};${concatInputs}concat=n=${spec.slots.length}:v=1:a=0[vout]`;
  args.push('-filter_complex', filter, '-map', '[vout]');

  if (hasAudio) {
    const audioIdx = spec.slots.length; // music is the last input
    const fadeStart = Math.max(0, totalMs - 1000) / 1000; // 1s fade-out tail
    args.push(
      '-map',
      `${audioIdx}:a`,
      '-af',
      `afade=t=out:st=${secs(fadeStart * 1000)}:d=1`,
      '-c:a',
      'aac',
      '-b:a',
      '128k',
    );
  }

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(fps),
    '-t',
    secs(totalMs), // belt-and-braces: never exceed the assembled length
    spec.outputPath,
  );

  return args;
}
