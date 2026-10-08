/**
 * WHAT IS ACTUALLY INSIDE AN AUDIO FILE — read from its bytes, never its name.
 *
 * WHY (measured 2026-10-08, the owner's first batch of Event Hub tracks): the
 * generator's files are named `.m4a` and browsers call them `audio/x-m4a`, but
 * the sound inside is **Opus**, not AAC. An .m4a is only a wrapper (ISO-BMFF);
 * AAC-in-MP4 plays on every phone, Opus-in-MP4 does not play on every iPhone —
 * and guests open an Event Hub on their phones. Nothing about the name, the
 * extension or the content type tells the two apart. The sample entry inside
 * the file does.
 *
 * PURE: bytes in, facts out. No `server-only`, no SDK — the server action that
 * guards the upload calls it, and the tests build files by hand to prove it.
 *
 * It reads three shapes, the three the Event Hub music upload accepts:
 *   · MP4 / M4A  — the codec from `stsd`'s first sample entry, the length from
 *                  `mvhd` (else `mdhd`);
 *   · MP3        — the length from the Xing/Info/VBRI frame count, else from
 *                  the first frame's bitrate over the audio bytes;
 *   · AAC (ADTS) — the length by walking the frames.
 * Ogg, WAV and WebM are NAMED (so the refusal can say what the file is) and
 * nothing else about them is read.
 */

export type AudioCodec = 'aac' | 'mp3' | 'opus' | 'alac' | 'flac' | 'vorbis' | 'pcm' | 'other';
export type AudioContainer = 'mp4' | 'mp3' | 'adts' | 'ogg' | 'wav' | 'webm';

export type AudioSniff =
  | {
      ok: true;
      container: AudioContainer;
      codec: AudioCodec;
      /** The sample entry's four letters for an MP4 (`mp4a`, `Opus`, …), else null. */
      fourcc: string | null;
      /** Whole seconds, at least 1 — or null when the file does not say. */
      durationSeconds: number | null;
    }
  | { ok: false; reason: 'empty' | 'unrecognised' | 'no-audio-track' };

const ascii = (b: Uint8Array, at: number, len: number): string => {
  let s = '';
  for (let i = at; i < at + len && i < b.length; i++) s += String.fromCharCode(b[i]!);
  return s;
};
const u32 = (b: Uint8Array, at: number): number =>
  at + 4 <= b.length
    ? ((b[at]! << 24) >>> 0) + (b[at + 1]! << 16) + (b[at + 2]! << 8) + b[at + 3]!
    : 0;
const u64 = (b: Uint8Array, at: number): number => u32(b, at) * 2 ** 32 + u32(b, at + 4);

function wholeSeconds(seconds: number): number | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.max(1, Math.round(seconds));
}

// ── MP4 ─────────────────────────────────────────────────────────────────────

type Box = { type: string; start: number; end: number };

/** The boxes directly inside [from, to). Stops, rather than guessing, at a malformed size. */
function boxes(b: Uint8Array, from: number, to: number): Box[] {
  const out: Box[] = [];
  let at = from;
  while (at + 8 <= to) {
    let size = u32(b, at);
    const type = ascii(b, at + 4, 4);
    let header = 8;
    if (size === 1) {
      if (at + 16 > to) break;
      size = u64(b, at + 8);
      header = 16;
    } else if (size === 0) {
      size = to - at; // "to the end of the file"
    }
    if (size < header || at + size > to) break;
    out.push({ type, start: at + header, end: at + size });
    at += size;
  }
  return out;
}

const child = (b: Uint8Array, parent: Box, type: string): Box | undefined =>
  boxes(b, parent.start, parent.end).find((x) => x.type === type);

/** `mvhd` / `mdhd`: version, then (v0) 32-bit or (v1) 64-bit times, timescale, duration. */
function headerSeconds(b: Uint8Array, box: Box): number | null {
  const version = b[box.start] ?? 0;
  const at = box.start + 4;
  const timescale = version === 1 ? u32(b, at + 16) : u32(b, at + 8);
  const duration = version === 1 ? u64(b, at + 20) : u32(b, at + 12);
  // 0xFFFFFFFF / all-ones means "unknown" (a fragmented or still-recording file).
  if (!timescale || !duration || duration === 0xffffffff) return null;
  return duration / timescale;
}

/**
 * `mp4a` is MPEG-4 audio — AAC nearly always, but the same four letters also
 * carry MP3 and others, named by the `esds` box's object type. Read it; when
 * there is no `esds` to read, `mp4a` is taken at its word as AAC.
 */
function mp4aCodec(b: Uint8Array, entry: Box): AudioCodec {
  // An audio sample entry is 28 bytes of fixed fields, then its child boxes.
  // QuickTime's later sound descriptions (version 1, 2) carry extra fields first.
  const soundVersion = ((b[entry.start + 8] ?? 0) << 8) | (b[entry.start + 9] ?? 0);
  const fixed = 28 + (soundVersion === 1 ? 16 : soundVersion === 2 ? 36 : 0);
  let inner = boxes(b, entry.start + fixed, entry.end);
  const wave = inner.find((x) => x.type === 'wave'); // QuickTime nests esds here
  if (wave) inner = boxes(b, wave.start, wave.end);
  const esds = inner.find((x) => x.type === 'esds');
  if (!esds) return 'aac';

  let at = esds.start + 4; // version + flags
  const readLength = (): number => {
    let len = 0;
    for (let i = 0; i < 4 && at < esds.end; i++) {
      const byte = b[at++]!;
      len = (len << 7) | (byte & 0x7f);
      if (!(byte & 0x80)) break;
    }
    return len;
  };
  if (b[at++] !== 0x03) return 'aac'; // ES_Descriptor
  readLength();
  at += 2; // ES_ID
  const flags = b[at++] ?? 0;
  if (flags & 0x80) at += 2; // dependsOn_ES_ID
  if (flags & 0x40) at += 1 + (b[at] ?? 0); // URL
  if (flags & 0x20) at += 2; // OCR_ES_ID
  if (b[at++] !== 0x04) return 'aac'; // DecoderConfigDescriptor
  readLength();
  const objectType = b[at] ?? 0;
  if (objectType === 0x40 || (objectType >= 0x66 && objectType <= 0x68)) return 'aac';
  if (objectType === 0x69 || objectType === 0x6b) return 'mp3';
  if (objectType === 0xdd) return 'vorbis';
  if (objectType === 0xad) return 'opus';
  return 'other';
}

function codecForFourcc(b: Uint8Array, entry: Box): AudioCodec {
  switch (entry.type) {
    case 'mp4a':
      return mp4aCodec(b, entry);
    case 'Opus':
      return 'opus';
    case 'alac':
      return 'alac';
    case 'fLaC':
      return 'flac';
    case '.mp3':
      return 'mp3';
    case 'lpcm':
    case 'sowt':
    case 'twos':
    case 'ipcm':
    case 'fpcm':
      return 'pcm';
    default:
      return 'other';
  }
}

function sniffMp4(b: Uint8Array): AudioSniff {
  const top = boxes(b, 0, b.length);
  const moov = top.find((x) => x.type === 'moov');
  if (!moov) return { ok: false, reason: 'unrecognised' };

  const mvhd = child(b, moov, 'mvhd');
  let seconds = mvhd ? headerSeconds(b, mvhd) : null;

  for (const trak of boxes(b, moov.start, moov.end).filter((x) => x.type === 'trak')) {
    const mdia = child(b, trak, 'mdia');
    if (!mdia) continue;
    const hdlr = child(b, mdia, 'hdlr');
    // hdlr: version/flags (4) · pre_defined (4) · handler_type (4)
    if (!hdlr || ascii(b, hdlr.start + 8, 4) !== 'soun') continue;
    const minf = child(b, mdia, 'minf');
    const stbl = minf ? child(b, minf, 'stbl') : undefined;
    const stsd = stbl ? child(b, stbl, 'stsd') : undefined;
    if (!stsd) continue;
    // stsd: version/flags (4) · entry_count (4) · entries
    const entry = boxes(b, stsd.start + 8, stsd.end)[0];
    if (!entry) continue;
    if (seconds === null) {
      const mdhd = child(b, mdia, 'mdhd');
      seconds = mdhd ? headerSeconds(b, mdhd) : null;
    }
    return {
      ok: true,
      container: 'mp4',
      codec: codecForFourcc(b, entry),
      fourcc: entry.type,
      durationSeconds: seconds === null ? null : wholeSeconds(seconds),
    };
  }
  return { ok: false, reason: 'no-audio-track' };
}

// ── MP3 and AAC (ADTS) ──────────────────────────────────────────────────────

/** Bytes an ID3v2 tag occupies at `at`, or 0. Its size is four 7-bit bytes. */
function id3v2Length(b: Uint8Array, at: number): number {
  if (ascii(b, at, 3) !== 'ID3' || at + 10 > b.length) return 0;
  const size =
    ((b[at + 6]! & 0x7f) << 21) | ((b[at + 7]! & 0x7f) << 14) | ((b[at + 8]! & 0x7f) << 7) | (b[at + 9]! & 0x7f);
  const footer = b[at + 5]! & 0x10 ? 10 : 0;
  return 10 + size + footer;
}

// kbps by [version column][layer III index]; MPEG-1 then MPEG-2/2.5.
const MP3_KBPS_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MP3_KBPS_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const MP3_RATE: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};

type Mp3Frame = { sampleRate: number; kbps: number; samples: number; sideInfo: number };

/** A Layer III frame header at `at`, or null. Strict: every reserved value refuses. */
function mp3FrameAt(b: Uint8Array, at: number): Mp3Frame | null {
  if (at + 4 > b.length || b[at] !== 0xff || (b[at + 1]! & 0xe0) !== 0xe0) return null;
  const version = (b[at + 1]! >> 3) & 3; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5, 1 = reserved
  const layer = (b[at + 1]! >> 1) & 3; // 1 = Layer III
  if (version === 1 || layer !== 1) return null;
  const kbps = (version === 3 ? MP3_KBPS_V1 : MP3_KBPS_V2)[(b[at + 2]! >> 4) & 0xf]!;
  const sampleRate = MP3_RATE[version]?.[(b[at + 2]! >> 2) & 3];
  if (!kbps || !sampleRate) return null;
  const mono = ((b[at + 3]! >> 6) & 3) === 3;
  return {
    sampleRate,
    kbps,
    samples: version === 3 ? 1152 : 576,
    sideInfo: version === 3 ? (mono ? 17 : 32) : mono ? 9 : 17,
  };
}

function sniffMp3(b: Uint8Array, audioStart: number): AudioSniff | null {
  // Padding sometimes sits between a tag and the first frame; look a little way in.
  let at = audioStart;
  let frame: Mp3Frame | null = null;
  for (const limit = Math.min(b.length - 4, audioStart + 4096); at <= limit; at++) {
    frame = mp3FrameAt(b, at);
    if (frame) break;
  }
  if (!frame) return null;

  let seconds: number | null = null;
  const xingAt = at + 4 + frame.sideInfo;
  const tag = ascii(b, xingAt, 4);
  if ((tag === 'Xing' || tag === 'Info') && u32(b, xingAt + 4) & 1) {
    const frames = u32(b, xingAt + 8);
    if (frames) seconds = (frames * frame.samples) / frame.sampleRate;
  } else if (ascii(b, at + 36, 4) === 'VBRI') {
    const frames = u32(b, at + 36 + 14);
    if (frames) seconds = (frames * frame.samples) / frame.sampleRate;
  }
  if (seconds === null) {
    // No frame count written: a constant-bitrate file, timed by its own size.
    const tail = b.length >= 128 && ascii(b, b.length - 128, 3) === 'TAG' ? 128 : 0;
    const audioBytes = b.length - at - tail;
    if (audioBytes > 0) seconds = (audioBytes * 8) / (frame.kbps * 1000);
  }
  return {
    ok: true,
    container: 'mp3',
    codec: 'mp3',
    fourcc: null,
    durationSeconds: seconds === null ? null : wholeSeconds(seconds),
  };
}

const ADTS_RATE = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

/** ADTS: sync 0xFFF with the layer bits 00 — which is what tells it from MP3. */
const isAdtsAt = (b: Uint8Array, at: number): boolean =>
  at + 7 <= b.length && b[at] === 0xff && (b[at + 1]! & 0xf6) === 0xf0;

function sniffAdts(b: Uint8Array, audioStart: number): AudioSniff | null {
  if (!isAdtsAt(b, audioStart)) return null;
  const sampleRate = ADTS_RATE[(b[audioStart + 2]! >> 2) & 0xf];
  if (!sampleRate) return null;
  let at = audioStart;
  let blocks = 0;
  while (isAdtsAt(b, at)) {
    const length = ((b[at + 3]! & 3) << 11) | (b[at + 4]! << 3) | (b[at + 5]! >> 5);
    if (length < 7) break;
    blocks += (b[at + 6]! & 3) + 1;
    at += length;
  }
  return {
    ok: true,
    container: 'adts',
    codec: 'aac',
    fourcc: null,
    durationSeconds: blocks ? wholeSeconds((blocks * 1024) / sampleRate) : null,
  };
}

// ── The one door ────────────────────────────────────────────────────────────

/** Reads what an audio file is from its bytes. Never throws. */
export function sniffAudio(bytes: Uint8Array): AudioSniff {
  try {
    if (!bytes || bytes.length < 12) return { ok: false, reason: 'empty' };

    if (ascii(bytes, 4, 4) === 'ftyp') return sniffMp4(bytes);
    if (ascii(bytes, 0, 4) === 'OggS') {
      return { ok: true, container: 'ogg', codec: 'other', fourcc: null, durationSeconds: null };
    }
    if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') {
      return { ok: true, container: 'wav', codec: 'pcm', fourcc: null, durationSeconds: null };
    }
    if (u32(bytes, 0) === 0x1a45dfa3) {
      return { ok: true, container: 'webm', codec: 'other', fourcc: null, durationSeconds: null };
    }

    const audioStart = id3v2Length(bytes, 0);
    return (
      sniffAdts(bytes, audioStart) ??
      sniffMp3(bytes, audioStart) ?? { ok: false, reason: 'unrecognised' }
    );
  } catch {
    return { ok: false, reason: 'unrecognised' };
  }
}

/**
 * May this file be offered as Event Hub music — and if not, the sentence that
 * says why and what to upload instead.
 *
 * Accepted: AAC (in an .m4a, or bare ADTS) and MP3 — the two every phone a
 * guest carries can play. Everything else is REFUSED rather than accepted
 * quietly: a track that is silent on some iPhones is worse than no track,
 * because nobody who uploaded it will ever hear the silence.
 */
export function hubMusicFileVerdict(
  sniff: AudioSniff,
): { ok: true; durationSeconds: number | null } | { ok: false; error: string } {
  const instead = 'Export it as AAC (.m4a) or MP3.';
  if (!sniff.ok) {
    return {
      ok: false,
      error:
        sniff.reason === 'no-audio-track'
          ? `This file has no sound in it. ${instead}`
          : `We could not read this file as audio. ${instead}`,
    };
  }
  if (sniff.codec === 'aac' || sniff.codec === 'mp3') {
    return { ok: true, durationSeconds: sniff.durationSeconds };
  }
  if (sniff.codec === 'opus' && sniff.container === 'mp4') {
    return {
      ok: false,
      error:
        'This file is Opus audio in an .m4a wrapper, which does not play on every iPhone. Export it as AAC or MP3.',
    };
  }
  const NAMES: Partial<Record<AudioCodec, string>> = {
    opus: 'Opus',
    alac: 'Apple Lossless',
    flac: 'FLAC',
    vorbis: 'Vorbis',
    pcm: 'uncompressed',
  };
  const name =
    NAMES[sniff.codec] ??
    (sniff.container === 'ogg' ? 'Ogg' : sniff.container === 'webm' ? 'WebM' : null);
  return {
    ok: false,
    error: name
      ? `This file is ${name} audio, which does not play on every phone. ${instead}`
      : `This file’s audio is in a format that does not play on every phone. ${instead}`,
  };
}
