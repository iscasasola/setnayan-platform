/**
 * "WILL THIS SONG PLAY ON EVERY PHONE?" — asked of a file the moment it is
 * picked, in the browser (import lazily, via `<FileUpload audioGuard>`).
 *
 * WHY (measured 2026-10-08): the music generator's files are named `.m4a` and
 * hold OPUS, which does not play on every iPhone. A couple who uploaded one as
 * their Event Hub's song heard it fine on their own laptop — and some of their
 * guests heard nothing, with no error anywhere. The file's name, extension and
 * content type all say "m4a"; only its bytes say Opus. So the bytes are read
 * here, before the upload starts, and a file that will not play is refused in
 * place with the sentence that says what to export instead.
 *
 * The rule itself is `ownSongProblem` (lib/audio-sniff.ts) — pure, and executed
 * by its tests. This file only hands it the bytes.
 *
 * FAIL-OPEN, like every `<FileUpload>` validator: a file that cannot be read
 * here uploads as it always did. This is fast feedback on a known-bad format,
 * not a gate a song has to earn its way through.
 */
import { ownSongProblem, sniffAudio } from '@/lib/audio-sniff';

export async function validateSongPlaysOnPhones(file: File): Promise<string | null> {
  try {
    return ownSongProblem(sniffAudio(new Uint8Array(await file.arrayBuffer())));
  } catch {
    return null;
  }
}
