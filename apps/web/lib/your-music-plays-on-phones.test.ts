/**
 * 🎵 "YOUR MUSIC" — a couple's own song is checked the moment it is picked, and
 * one that will not play on every phone is refused IN PLACE.
 *
 * Measured 2026-10-08: the music generator's files are named `.m4a` and hold
 * OPUS, which does not play on every iPhone. Uploaded as an Event Hub's song it
 * plays on the couple's laptop and is silent for some guests, with no error
 * anywhere. Only the file's bytes say so — so the upload widget reads them
 * (`<FileUpload audioGuard>` → `lib/audio-guard-client.ts` → `ownSongProblem`)
 * before a byte is sent, and says what to export instead in its own error line.
 *
 * And the other half, without which that sentence could never be reached:
 * Chrome and Safari call an .m4a `audio/x-m4a`, a name the upload route does not
 * hold, so EVERY .m4a was refused there by its type first (`uploadTypeOf`).
 *
 *   1. the rule: Opus (and any non-AAC/MP3 sound) in an .m4a is refused; AAC,
 *      MP3, WAV, Ogg and a file the reader cannot place all pass;
 *   2. the browser half reads a real File and fails open;
 *   3. a type is put into its canonical name once;
 *   4. the widget runs the guard before the upload and refuses in place;
 *   5. every upload that becomes an Event Hub's song has the guard on.
 *
 * 🛡 Sabotaged, each red then restored (the file backed up and copied back):
 *   • `ownSongProblem` returns null for an .m4a always        → 1 and 2 red;
 *   • `ownSongProblem` refuses whatever the catalogue refuses → 1 red (WAV, Ogg, unknown);
 *   • the browser half throws instead of failing open         → 2 red;
 *   • `audio/x-m4a` dropped from the names                    → 3 red;
 *   • the accepted-types check reads `file.type` again        → 4 red;
 *   • the guard moved after `await uploadOne(file)`           → 4 red;
 *   • a refusal logged instead of shown (`setError` removed)  → 4 red;
 *   • `audioGuard` taken off the Maker's Music panel          → 5 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { ownSongProblem, sniffAudio } from './audio-sniff';
import { validateSongPlaysOnPhones } from './audio-guard-client';
import { uploadTypeOf } from './upload-type-names';
import { hubMusicContentTypeFor } from './hub-music';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

// ── Files, built by hand (the same boxes `audio-sniff.test.ts` builds) ───────
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
const esds = (objectType: number) =>
  box('esds', u32(0), Uint8Array.of(0x03, 0x19), u16(1), Uint8Array.of(0x00), Uint8Array.of(0x04, 0x11, objectType), zeros(16));
const entry = (fourcc: string, ...children: Uint8Array[]) =>
  box(fourcc, zeros(6), u16(1), zeros(8), u16(2), u16(16), zeros(4), u32(48000 << 16), ...children);
function m4a(sampleEntry: Uint8Array, handler = 'soun'): Uint8Array {
  return cat(
    box('ftyp', enc('M4A '), u32(0), enc('isomiso2')),
    box('mdat', zeros(64)),
    box(
      'moov',
      box('mvhd', u32(0), u32(0), u32(0), u32(1000), u32(147_000), zeros(8)),
      box(
        'trak',
        box(
          'mdia',
          box('hdlr', u32(0), u32(0), enc(handler), zeros(12)),
          box('minf', box('stbl', box('stsd', u32(0), u32(1), sampleEntry))),
        ),
      ),
    ),
  );
}
const OPUS = m4a(entry('Opus', box('dOps', zeros(11))));
const AAC = m4a(entry('mp4a', esds(0x40)));
const MP3_IN_MP4 = m4a(entry('mp4a', esds(0x6b)));
const ALAC = m4a(entry('alac'));
const SILENT = m4a(entry('mp4a', esds(0x40)), 'vide');
const MP3 = cat(...Array.from({ length: 40 }, () => cat(Uint8Array.of(0xff, 0xfb, 0x90, 0x00), zeros(413))));
const WAV = cat(enc('RIFF'), u32(0), enc('WAVE'), zeros(40));
const OGG = cat(enc('OggS'), zeros(40));
const UNKNOWN = enc('ID3 is not where this reader expects it, and that is fine.');

const OPUS_SENTENCE =
  'This file is Opus audio in an .m4a wrapper, which does not play on every iPhone. Export it as AAC or MP3.';

test('1 · the rule: an .m4a whose sound is not AAC or MP3 is refused — everything else passes', () => {
  assert.equal(ownSongProblem(sniffAudio(OPUS)), OPUS_SENTENCE);
  assert.equal(
    ownSongProblem(sniffAudio(ALAC)),
    'This file is Apple Lossless audio, which does not play on every phone. Export it as AAC (.m4a) or MP3.',
  );
  assert.match(ownSongProblem(sniffAudio(SILENT)) ?? '', /^This file has no sound in it\./);

  for (const [name, bytes] of [['AAC .m4a', AAC], ['MP3 in an .mp4', MP3_IN_MP4], ['MP3', MP3], ['WAV', WAV], ['Ogg', OGG], ['unplaceable', UNKNOWN], ['empty', new Uint8Array(0)]] as const) {
    assert.equal(ownSongProblem(sniffAudio(bytes)), null, `${name} must pass`);
  }
});

test('2 · the browser half reads the picked File, and fails open', async () => {
  const file = (bytes: Uint8Array, name: string, type: string) => new File([bytes], name, { type });
  assert.equal(await validateSongPlaysOnPhones(file(OPUS, 'Velvet Court.m4a', 'audio/x-m4a')), OPUS_SENTENCE);
  assert.equal(await validateSongPlaysOnPhones(file(AAC, 'Velvet Court.m4a', 'audio/x-m4a')), null);
  assert.equal(await validateSongPlaysOnPhones(file(MP3, 'song.mp3', 'audio/mpeg')), null);
  // A file that cannot be read at all uploads as it always did.
  const unreadable = { arrayBuffer: () => Promise.reject(new Error('gone')) } as unknown as File;
  assert.equal(await validateSongPlaysOnPhones(unreadable), null);
});

test('3 · a type is put into its canonical name once — an .m4a is audio/mp4 in every browser', () => {
  assert.equal(uploadTypeOf('audio/x-m4a'), 'audio/mp4');
  assert.equal(uploadTypeOf('audio/m4a'), 'audio/mp4');
  assert.equal(uploadTypeOf('audio/mp3'), 'audio/mpeg');
  assert.equal(uploadTypeOf('audio/x-aac'), 'audio/aac');
  assert.equal(uploadTypeOf('audio/x-wav'), 'audio/wav');
  // Everything else is returned exactly as it came — no upload that worked changes.
  for (const same of ['audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/ogg', 'audio/wav', 'image/png', 'video/mp4', 'application/pdf', '']) {
    assert.equal(uploadTypeOf(same), same);
  }
  // Every canonical name is one the upload route holds.
  const route = code('app/api/upload/route.ts');
  for (const name of ['audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav']) {
    assert.ok(route.includes(`'${name}',`), `${name} is on the upload route's list`);
  }
  assert.equal(route.includes("'audio/x-m4a'"), false, 'the alias is resolved before the route, not added to it');
  // The admin's Event Hub music page reads the same names (one map, not two).
  assert.equal(hubMusicContentTypeFor('a.m4a', 'audio/x-m4a'), 'audio/mp4');
  assert.equal(hubMusicContentTypeFor('a.wav', 'audio/x-wav'), null);
  assert.doesNotMatch(code('lib/hub-music.ts'), /'audio\/x-m4a'/);
});

test('4 · the widget checks the song before it uploads, and refuses in its own error line', () => {
  const src = code('app/_components/file-upload.tsx');
  assert.match(src, /audioGuard = false,/);
  assert.match(src, /if \(file\.type && !acceptedTypes\.includes\(uploadTypeOf\(file\.type\)\)\) \{/, 'the accepted list is asked the canonical name');
  assert.match(src, /uploadTypeOf\(rawFile\.type\) \|\|/, 'the presign is sent the canonical name');
  assert.match(src, /const contentType = uploadTypeOf\(file\.type\) \|\| initialContentType;/, '…and so is the PUT');

  const guard = src.indexOf("if (!problem && audioGuard) {");
  const read = src.indexOf("await import(\n                  '@/lib/audio-guard-client'\n                )");
  const refuse = src.indexOf('if (problem) {\n              setError(problem);\n              continue;', guard);
  const upload = src.indexOf('await uploadOne(file);');
  assert.ok(guard > 0 && read > guard, 'the reader is loaded only when a song is picked');
  assert.ok(refuse > read, 'a problem becomes the widget’s error line and the file is skipped');
  assert.ok(upload > refuse, 'all of it before the upload starts');
  assert.match(src.slice(src.indexOf('if (validateFile || qrGuard || audioGuard) {'), guard), /setOptimizing\(\{ label: `Checking \$\{file\.name\}…`, pct: 0 \}\);/);
  // The error line is the widget's own, drawn in place.
  assert.match(src, /\{error \? \(\s*<[a-z]+\s+role="alert"/);
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx') && !name.includes('.test.')) out.push(p);
  }
  return out;
}

test('5 · every upload that becomes an Event Hub’s song has the guard on', () => {
  // Found by what they upload INTO — `…/site-music` (a couple's own song) and
  // `…/pakanta-song` (a Music Maker song delivered to the couple) — never from a list.
  const mounts: string[] = [];
  const unguarded: string[] = [];
  for (const file of walk(join(WEB, 'app'))) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/<FileUpload\b[\s\S]*?\/>/g)) {
      if (!/pathPrefix=\{`events\/\$\{eventId\}\/(?:site-music|pakanta-song)`\}/.test(m[0])) continue;
      mounts.push(relative(WEB, file));
      if (!/\n\s*audioGuard\n/.test(m[0])) unguarded.push(relative(WEB, file));
    }
  }
  assert.deepEqual(mounts.sort(), [
    'app/admin/pakanta/pakanta-deliver.tsx',
    'app/dashboard/[eventId]/studio/save-the-date/_components/StdBuilderClient.tsx',
    'app/dashboard/[eventId]/website/editor/_components/media-panels.tsx',
    'app/dashboard/[eventId]/website/site-chrome/page.tsx',
  ]);
  assert.deepEqual(unguarded, [], 'a song upload with no guard accepts an Opus .m4a silently');
});
