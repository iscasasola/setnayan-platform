/**
 * `Content-Disposition` header construction.
 *
 * Deliberately its OWN module rather than living in `lib/r2.ts`: that file
 * imports `server-only`, which cannot resolve under the unit-test runner, so a
 * helper parked there is untestable. This one is pure string work and gets
 * covered directly.
 */

/**
 * Builds a `Content-Disposition: attachment` value that survives real filenames.
 *
 * WHY IT MATTERS: a presigned GET without this header renders INLINE — R2 serves
 * the object with its real media type, so clicking "Download" on an `.mp4` or
 * `.jpg` plays it in a tab and nothing reaches the disk. On
 * /admin/website-media that download is the step that makes deleting safe, so a
 * silently-inline link would hollow out the safety story while looking fine.
 *
 * Two forms, per RFC 6266: a quoted ASCII `filename` every browser understands,
 * and a percent-encoded `filename*` for anything non-ASCII. Quotes, backslashes
 * and control characters are replaced in the ASCII form — unescaped, they
 * terminate the header value early and the browser falls back to the URL path,
 * which for a presigned URL is a signature-laden mess.
 */
export function contentDispositionAttachment(filename: string): string {
  const fallback =
    filename
      // Printable ASCII only; everything else (accents, control chars) becomes `_`.
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\]/g, '_')
      .trim() || 'download';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
