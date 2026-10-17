/**
 * lib/stream-file.ts — A FILE SENT AS A STREAM (live fault 2026-10-17, measured on PR #6597).
 *
 * A Vercel Function's BUFFERED response body stops at 4.5 MB — "The maximum payload size for the request body or the response body of
 * a Vercel Function is 4.5 MB … it will return an error 413: FUNCTION_PAYLOAD_TOO_LARGE" (Vercel docs, Functions › Limits). A STREAMED
 * body does not — "we recommend using streaming functions, which don't have this limit" (Vercel KB, "How do I bypass the 4.5MB body
 * size limit"). Measured with the routes' own drawing code (Classic): every guest's pass is 5.15 MB at 109 guests — production's
 * largest event — and 11.35 MB at 240; the place-card pack passes 4.5 MB at about 280 guests, the QR sheet at about 470.
 *
 * So every print file leaves as a stream, the shipped way for a big file (`/api/guest/pass-card/all`, `papic/me/[token]/download`):
 * the SAME bytes, in parts of `STREAM_PART_BYTES`, with no Content-Length (the server then sends it chunked). Only the transport
 * changes — never a byte of the file. `print-downloads-stream.test.ts` holds every print route to it.
 */

/** One part of a streamed file — 1 MB. */
export const STREAM_PART_BYTES = 1 << 20;

/** The bytes as a stream of parts, in order — read whole, exactly the bytes handed in. */
export function bytesStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  let at = 0;
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (at >= bytes.length) {
        c.close();
        return;
      }
      c.enqueue(bytes.subarray(at, at + STREAM_PART_BYTES));
      at += STREAM_PART_BYTES;
    },
  });
}
