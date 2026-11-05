/**
 * ONE AUDIO FILE, SEVERAL NAMES.
 *
 * A browser reports a picked file's type in its own words: Chrome and Safari
 * call an .m4a `audio/x-m4a`, Firefox `audio/mp4`. `/api/upload` holds only the
 * canonical names, and every caller's `acceptedTypes` lists only those — so an
 * .m4a picked in Chrome or Safari was refused as "audio/x-m4a", on fields whose
 * own help text offers M4A.
 *
 * `uploadTypeOf` puts a type into its canonical name ONCE; that name is what
 * `<FileUpload>`'s accepted-types check, its presign and its PUT all see, and
 * what the admin's Event Hub music page uploads as (`lib/hub-music.ts`). Only
 * names the upload route refuses outright are listed, so no upload that worked
 * before changes.
 *
 * Pure and tiny — it rides wherever `<FileUpload>` does.
 */
const AUDIO_TYPE_NAMES: Readonly<Record<string, string>> = {
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/mp4a-latm': 'audio/mp4',
  'audio/mp3': 'audio/mpeg',
  'audio/x-aac': 'audio/aac',
  'audio/aacp': 'audio/aac',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
};

/** A picked file's type as the upload route knows it. Anything else is returned as it came. */
export function uploadTypeOf(browserType: string): string {
  return AUDIO_TYPE_NAMES[browserType] ?? browserType;
}
