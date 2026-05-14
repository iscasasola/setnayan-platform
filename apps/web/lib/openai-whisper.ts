import 'server-only';
import OpenAI from 'openai';

/**
 * OpenAI Whisper client for the AI Catalog Generator's voice-input flow.
 *
 * Vendors record themselves describing their services in Tagalog/English/
 * Taglish. The audio file lands in R2 (`thread-files` bucket, under
 * `vendors/{id}/voice-input/`), then this module fetches it via the same
 * presigned-GET URL the upload route hands back and forwards the bytes to
 * Whisper.
 *
 * Two modes, same as the Claude catalog generator (`lib/anthropic-catalog.ts`):
 *
 *   • STUB (default — no `OPENAI_API_KEY`): returns a hardcoded Filipino /
 *     Taglish transcript so the end-to-end flow works in dev + CI without
 *     burning API credit or shipping a real key. The stub demonstrates the
 *     code-switching behavior Whisper exhibits in production so the rest of
 *     the pipeline (Claude catalog extraction) has realistic input.
 *
 *   • LIVE: calls `whisper-1` with `language: 'tl'` as a hint. Whisper still
 *     handles English / mixed Taglish even with the Tagalog hint — the
 *     language code biases token probabilities, it doesn't reject other
 *     languages. We request `response_format: 'text'` so we just get the raw
 *     transcript string back; richer formats (verbose_json with timestamps)
 *     aren't needed for the catalog extraction pipeline.
 *
 * Flip stub → live by setting `OPENAI_API_KEY` in the environment.
 */

const STUB_MODE = !process.env.OPENAI_API_KEY;

/**
 * Stub transcript — a representative Tagalog/Taglish description that
 * exercises the downstream Claude flow:
 *   • Mentions the vendor category (caterer / catering)
 *   • Three packages with named tiers (bronze/silver/gold)
 *   • Guest counts (100/150/200 pax)
 *   • Prices with the colloquial "thousand pesos" / "thousand" mix
 *   • Inclusions (4 mains, 4 sides, dessert table)
 *
 * Mirrors the EXAMPLE_DESCRIPTION used by the text-input flow so a vendor
 * playing in demo mode sees a coherent path through both UIs.
 */
const STUB_TRANSCRIPT =
  'Ako po ay caterer sa Tagaytay. Tatlong packages ang inaalok ko: bronze para sa 100 pax ay 150 thousand pesos, silver para sa 150 pax ay 220 thousand, gold para sa 200 pax ay 300 thousand. Bawat package ay may 4 mains, 4 sides, at dessert table.';

/**
 * Transcribe an audio recording at `audioUrl` (presigned R2 GET URL).
 *
 * Whisper accepts the upload as a `File` — we materialize one from the
 * fetched ArrayBuffer rather than streaming because (a) the recordings are
 * ≤ 5MB by the upload route's per-bucket cap and (b) the OpenAI SDK's
 * `file` parameter doesn't accept Node `Readable` streams in browsers /
 * edge runtimes uniformly. Server-side fetch + Blob is the simplest portable
 * path.
 *
 * Errors bubble up to the server action which surfaces a vendor-friendly
 * message; the action also wraps this in a try/catch.
 */
export async function transcribeWithWhisper(audioUrl: string): Promise<string> {
  if (STUB_MODE) {
    // Small artificial delay so the UI's "Transcribing…" state is visible
    // and the flow feels real. 350ms is enough for the spinner to render
    // without being annoying.
    await new Promise((resolve) => setTimeout(resolve, 350));
    return STUB_TRANSCRIPT;
  }

  if (typeof audioUrl !== 'string' || audioUrl.length === 0) {
    throw new Error('audioUrl is required.');
  }

  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(
      `Could not download audio for transcription (status ${audioResponse.status}).`,
    );
  }
  const audioBuffer = await audioResponse.arrayBuffer();
  if (audioBuffer.byteLength === 0) {
    throw new Error('Audio file was empty.');
  }

  // Whisper sniffs format from the filename extension when present, so we
  // pin .webm — that's what MediaRecorder emits on Chromium/Firefox and
  // what Safari/iOS rewraps to (the upload route accepts both webm and mp4
  // but we name the temporary File `.webm` because Whisper's `audio/webm`
  // path is the most reliable across versions).
  const audioFile = new File([audioBuffer], 'recording.webm', {
    type: 'audio/webm',
  });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const transcription = await client.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    // 'tl' = Tagalog. Whisper handles code-switching automatically — a
    // Taglish recording with English numbers still transcribes correctly
    // because the hint biases (rather than gates) language detection.
    language: 'tl',
    response_format: 'text',
  });

  // `response_format: 'text'` makes the SDK return a bare string. We still
  // guard against an unexpected object shape so a future SDK change doesn't
  // crash the server action with a vague stringify error.
  if (typeof transcription === 'string') {
    return transcription.trim();
  }
  if (
    transcription &&
    typeof transcription === 'object' &&
    'text' in transcription &&
    typeof (transcription as { text: unknown }).text === 'string'
  ) {
    return (transcription as { text: string }).text.trim();
  }
  throw new Error('Whisper returned an unexpected response shape.');
}

/**
 * Exposed for the page.tsx server component so it can render a "Demo mode"
 * vs. "Live AI" badge for voice transcription separately from Claude. The
 * stub flag is computed at module load time which matches the catalog
 * generator's behavior — flipping the key requires a server restart.
 */
export const WHISPER_STUB_MODE = STUB_MODE;
