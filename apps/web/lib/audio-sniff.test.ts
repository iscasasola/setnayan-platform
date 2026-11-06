/**
 * WHAT IS INSIDE AN AUDIO FILE IS READ FROM ITS BYTES (lib/audio-sniff.ts).
 *
 * Measured 2026-10-08 on the owner's first batch of Event Hub tracks: twenty
 * files named `.m4a`, every one of them OPUS inside — which is silent on some
 * iPhones. Nothing but the sample entry in the file says so. These files are
 * built by hand, box by box, so the test needs no encoder and says exactly
 * which bytes carry the answer.
 *
 * 🛡 Sabotaged, each red then restored (lib/audio-sniff.ts backed up and copied
 * back):
 *   • the `Opus` sample entry answered as AAC            → "Opus in an .m4a" red;
 *   • the verdict accepts every codec                     → every refusal red;
 *   • version-1 headers read at the version-0 offsets     → "64-bit times" red;
 *   • the track's own `mdhd` never consulted              → "falls back" red;
 *   • the Xing frame count ignored                        → "VBR MP3" red;
 *   • the ADTS sample-rate index read from the wrong bits → "bare AAC" red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hubMusicFileVerdict, sniffAudio } from './audio-sniff';

const enc = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const u16 = (n: number) => Uint8Array.of((n >> 8) & 0xff, n & 0xff);
const u32 = (n: number) => Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
const zeros = (n: number) => new Uint8Array(n);
function cat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
const box = (type: string, ...body: Uint8Array[]) => {
  const payload = cat(...body);
  return cat(u32(payload.length + 8), enc(type), payload);
};

/** mvhd / mdhd, version 0: flags · created · modified · timescale · duration. */
const header = (type: 'mvhd' | 'mdhd', timescale: number, duration: number) =>
  box(type, u32(0), u32(0), u32(0), u32(timescale), u32(duration), zeros(8));
/** …and version 1, whose times are 64-bit. */
const header64 = (type: 'mvhd' | 'mdhd', timescale: number, duration: number) =>
  box(type, u32(0x01000000), zeros(8), zeros(8), u32(timescale), u32(0), u32(duration), zeros(8));

/** esds naming an MPEG-4 object type (0x40 = AAC, 0x6B = MP3). */
const esds = (objectType: number) =>
  box(
    'esds',
    u32(0),
    Uint8Array.of(0x03, 0x80, 0x80, 0x80, 0x19), // ES_Descriptor, long-form length
    u16(1), // ES_ID
    Uint8Array.of(0x00), // flags
    Uint8Array.of(0x04, 0x11, objectType),
    zeros(16),
  );

/** One audio sample entry: 28 fixed bytes, then its own boxes. */
const entry = (fourcc: string, ...children: Uint8Array[]) =>
  box(fourcc, zeros(6), u16(1), zeros(8), u16(2), u16(16), zeros(4), u32(48000 << 16), ...children);

function m4a(opts: {
  entry: Uint8Array;
  mvhd?: Uint8Array;
  handler?: string;
  moovLast?: boolean;
}): Uint8Array {
  const ftyp = box('ftyp', enc('M4A '), u32(0), enc('isomiso2'));
  const trak = box(
    'trak',
    box(
      'mdia',
      header('mdhd', 48000, 48000 * 61),
      box('hdlr', u32(0), u32(0), enc(opts.handler ?? 'soun'), zeros(12)),
      box('minf', box('stbl', box('stsd', u32(0), u32(1), opts.entry))),
    ),
  );
  const moov = box('moov', opts.mvhd ?? header('mvhd', 1000, 147_000), trak);
  const mdat = box('mdat', zeros(64));
  return opts.moovLast ? cat(ftyp, mdat, moov) : cat(ftyp, moov, mdat);
}

test('AAC in an .m4a is read as AAC, with its length', () => {
  const s = sniffAudio(m4a({ entry: entry('mp4a', esds(0x40)) }));
  assert.deepEqual(s, { ok: true, container: 'mp4', codec: 'aac', fourcc: 'mp4a', durationSeconds: 147 });
  assert.deepEqual(hubMusicFileVerdict(s), { ok: true, durationSeconds: 147 });
});

test('Opus in an .m4a is read as Opus — and refused, saying why and what to upload', () => {
  const s = sniffAudio(m4a({ entry: entry('Opus', box('dOps', zeros(11))) }));
  assert.equal(s.ok && s.codec, 'opus');
  assert.equal(s.ok && s.fourcc, 'Opus');
  assert.equal(s.ok && s.durationSeconds, 147, 'the length is still read');
  assert.deepEqual(hubMusicFileVerdict(s), {
    ok: false,
    error:
      'This file is Opus audio in an .m4a wrapper, which does not play on every iPhone. Export it as AAC or MP3.',
  });
});

test('the same answer when the index sits at the END of the file (not "fast start")', () => {
  const s = sniffAudio(m4a({ entry: entry('Opus'), moovLast: true }));
  assert.equal(s.ok && s.codec, 'opus');
  const a = sniffAudio(m4a({ entry: entry('mp4a', esds(0x40)), moovLast: true }));
  assert.equal(a.ok && a.codec, 'aac');
});

test('`mp4a` is read through to what it carries: MP3 is MP3, an unknown object type is not AAC', () => {
  const mp3 = sniffAudio(m4a({ entry: entry('mp4a', esds(0x6b)) }));
  assert.equal(mp3.ok && mp3.codec, 'mp3');
  assert.equal(hubMusicFileVerdict(mp3).ok, true);
  const odd = sniffAudio(m4a({ entry: entry('mp4a', esds(0xe1)) }));
  assert.equal(odd.ok && odd.codec, 'other');
  assert.equal(hubMusicFileVerdict(odd).ok, false);
  const bare = sniffAudio(m4a({ entry: entry('mp4a') }));
  assert.equal(bare.ok && bare.codec, 'aac', 'no esds to read — mp4a is taken at its word');
});

test('64-bit times (version 1 headers) give the same length', () => {
  const s = sniffAudio(m4a({ entry: entry('mp4a', esds(0x40)), mvhd: header64('mvhd', 48000, 48000 * 208) }));
  assert.equal(s.ok && s.durationSeconds, 208);
});

test('a length the file does not state is null — and falls back to the track’s own header first', () => {
  const s = sniffAudio(m4a({ entry: entry('mp4a', esds(0x40)), mvhd: header('mvhd', 1000, 0) }));
  assert.equal(s.ok && s.durationSeconds, 61, 'mdhd answers when mvhd says 0');
});

test('lossless and other codecs in an .m4a are named and refused', () => {
  const cases: Array<[string, string]> = [
    ['alac', 'This file is Apple Lossless audio, which does not play on every phone. Export it as AAC (.m4a) or MP3.'],
    ['fLaC', 'This file is FLAC audio, which does not play on every phone. Export it as AAC (.m4a) or MP3.'],
    ['ac-3', 'This file’s audio is in a format that does not play on every phone. Export it as AAC (.m4a) or MP3.'],
  ];
  for (const [fourcc, sentence] of cases) {
    assert.deepEqual(hubMusicFileVerdict(sniffAudio(m4a({ entry: entry(fourcc) }))), { ok: false, error: sentence });
  }
});

test('an .mp4 with no sound track is refused as having no sound', () => {
  const s = sniffAudio(m4a({ entry: entry('mp4a', esds(0x40)), handler: 'vide' }));
  assert.deepEqual(s, { ok: false, reason: 'no-audio-track' });
  assert.match((hubMusicFileVerdict(s) as { error: string }).error, /^This file has no sound in it\./);
});

// ── MP3 ─────────────────────────────────────────────────────────────────────

/** MPEG-1 Layer III, 128 kbps, 44.1 kHz, stereo: 417 bytes a frame, 1152 samples. */
const MP3_HEADER = Uint8Array.of(0xff, 0xfb, 0x90, 0x00);
const mp3Frame = () => cat(MP3_HEADER, zeros(413));
const id3 = (payload: number) => cat(enc('ID3'), Uint8Array.of(4, 0, 0, 0, 0, (payload >> 7) & 0x7f, payload & 0x7f), zeros(payload));

test('a constant-bitrate MP3 is timed by its size, after its tag', () => {
  const frames = 383; // ≈ 10.0 s at 38.28 frames a second
  const file = cat(id3(300), ...Array.from({ length: frames }, mp3Frame));
  const s = sniffAudio(file);
  assert.deepEqual(s, { ok: true, container: 'mp3', codec: 'mp3', fourcc: null, durationSeconds: 10 });
  assert.deepEqual(hubMusicFileVerdict(s), { ok: true, durationSeconds: 10 });
});

test('a VBR MP3 is timed by the frame count its first frame states, not by its size', () => {
  // Xing sits after the 32 bytes of side info; flags bit 0 = "frame count follows".
  const first = cat(MP3_HEADER, zeros(32), enc('Xing'), u32(1), u32(7656), zeros(417 - 4 - 32 - 12));
  const file = cat(first, mp3Frame(), mp3Frame());
  const s = sniffAudio(file);
  assert.equal(s.ok && s.durationSeconds, 200, '7656 frames × 1152 samples ÷ 44100');
});

// ── AAC (ADTS) ──────────────────────────────────────────────────────────────

/** One ADTS frame: 7-byte header (AAC-LC, 48 kHz = index 3, stereo), then payload. */
function adtsFrame(length = 200): Uint8Array {
  const h = Uint8Array.of(
    0xff,
    0xf1,
    (1 << 6) | (3 << 2),
    (2 << 6) | ((length >> 11) & 3),
    (length >> 3) & 0xff,
    ((length & 7) << 5) | 0x1f,
    0xfc,
  );
  return cat(h, zeros(length - 7));
}

test('bare AAC (ADTS) is read as AAC and timed by walking its frames', () => {
  const file = cat(...Array.from({ length: 469 }, () => adtsFrame())); // 469 × 1024 ÷ 48000 ≈ 10.0 s
  const s = sniffAudio(file);
  assert.deepEqual(s, { ok: true, container: 'adts', codec: 'aac', fourcc: null, durationSeconds: 10 });
});

// ── Everything else ─────────────────────────────────────────────────────────

test('Ogg, WAV and WebM are named in their refusal', () => {
  const ogg = hubMusicFileVerdict(sniffAudio(cat(enc('OggS'), zeros(40))));
  const wav = hubMusicFileVerdict(sniffAudio(cat(enc('RIFF'), u32(0), enc('WAVE'), zeros(40))));
  const webm = hubMusicFileVerdict(sniffAudio(cat(u32(0x1a45dfa3), zeros(40))));
  assert.match((ogg as { error: string }).error, /^This file is Ogg audio,/);
  assert.match((wav as { error: string }).error, /^This file is uncompressed audio,/);
  assert.match((webm as { error: string }).error, /^This file is WebM audio,/);
});

test('a file that is not audio, an empty one and a torn one are refused — never thrown, never accepted', () => {
  for (const bytes of [
    new Uint8Array(0),
    enc('hello'),
    enc('<!doctype html><html><body>not a song</body></html>'),
    cat(u32(24), enc('ftyp'), enc('M4A '), zeros(12)), // an .m4a with no index at all
    m4a({ entry: entry('mp4a', esds(0x40)) }).slice(0, 60), // cut off mid-box
  ]) {
    const s = sniffAudio(bytes);
    assert.equal(s.ok, false);
    const v = hubMusicFileVerdict(s);
    assert.equal(v.ok, false);
    assert.match((v as { error: string }).error, /Export it as AAC \(\.m4a\) or MP3\.$/);
  }
});
