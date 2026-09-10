/**
 * The image provider for Mood Board "Make it real" (MB8).
 *
 * Gemini img2img — the owner's decision row names it "Nano Banana / Gemini 2.5
 * Flash Image" and prices the render pack against it (~₱2.2/render, ~89%
 * margin at ₱1,000/50). This module is the ONLY place in the app that talks to
 * an image model.
 *
 * ── THIS FILE HAS ONE JOB BEYOND MAKING THE CALL ───────────────────────────
 * 🔑 **IT MUST NEVER RETURN SOMETHING A CALLER CAN MISTAKE FOR AN IMAGE.**
 *
 * This repo's recurring, expensive defect is a failure that renders
 * identically to success or to emptiness: an upload that stopped and fired no
 * event at all, so the chip sat at 0% forever and "still working" looked
 * exactly like "dead"; a refused guest read that returned `[]`, so a couple
 * with 180 names was told "No guests yet". Both were correct code paths that
 * produced an indistinguishable surface.
 *
 * So the contract here is deliberately not "returns bytes or throws", and not
 * "returns bytes or null":
 *
 *   · The return type is a DISCRIMINATED UNION. A caller cannot read
 *     `.bytes` without first narrowing on `ok`, so "I forgot to check" is a
 *     compile error rather than a blank image.
 *   · `ok: true` is unreachable with zero bytes — the success branch is
 *     constructed in exactly one place, after a length check.
 *   · EVERY failure carries a `code` the UI can turn into words on the box,
 *     and `detail` for the log. There is no silent path, no bare `catch {}`,
 *     and no default that resolves to "empty".
 *   · A RESPONSE WE DO NOT UNDERSTAND IS A FAILURE (`bad_shape`), never an
 *     empty success. This matters more than it looks: the Interactions API is
 *     versioned by an `Api-Revision` date header, so the response shape CAN
 *     move under us. If a field rename made `extractImage` return nothing and
 *     that read as "no image, carry on", every couple would be charged for a
 *     blank tile and the only symptom would be sadness.
 *
 * ── THE ENDPOINT, AND WHY IT IS NOT THE ONE THE DECISION ROW IMPLIES ───────
 * The 2026-06/09 rows were written against `generateContent`. The live Gemini
 * image API is the **Interactions API** — `POST /v1beta/interactions`, keyed
 * by an `x-goog-api-key` header and pinned by `Api-Revision`. Verified against
 * ai.google.dev/gemini-api/docs/interactions/image-generation on 2026-09-03.
 * The request is `{model, input:[{type:'text'…},{type:'image',mime_type,data}]}`
 * and the image comes back base64 at `output_image.data`.
 *
 * ⚠ `API_REVISION` IS PINNED, NOT LATEST-BY-DEFAULT. An unpinned revision
 * means the response shape can change on Google's release schedule rather than
 * on ours — and the failure would land on a couple mid-purchase. Bump it
 * deliberately, with `extractImage`'s tests in front of you.
 *
 * ── THE MODEL IS THE ONE THAT WAS PRICED ───────────────────────────────────
 * 🛑 `gemini-2.5-flash-image` is the default because it is the model the
 * owner's margin was computed on. `gemini-3.1-flash-image` is now Google's
 * recommended image model and is very likely better — but its per-image cost
 * is NOT the ₱2.2 this pack was priced against, and nobody has measured what
 * it would do to an ~89% margin. Repo rule: a number that governs money is not
 * a guess to annotate and ship. Switching is an OWNER call, and it is one env
 * var (`MOODBOARD_RENDER_MODEL`) when they make it — not a code change.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/** Pinned deliberately — see the docblock. */
const API_REVISION = '2026-05-20';

/** The model the render pack's margin was computed against. Owner-overridable. */
const DEFAULT_MODEL = 'gemini-2.5-flash-image';

/**
 * Why a render did not happen. Every one of these becomes words on the tile —
 * see `renderFailureMessage` in `lib/moodboard-render-failure.ts`, which is
 * exhaustive over this union by type, so a new code cannot be added without
 * someone writing the sentence a couple will read.
 */
export type RenderFailureCode =
  /** No `GEMINI_API_KEY` in this environment. NOT a couple-facing fault. */
  | 'not_configured'
  /** The model declined (safety, policy). The couple can change the brief. */
  | 'refused'
  /** HTTP 4xx/5xx from the provider. */
  | 'http_error'
  /** The call exceeded our own deadline. */
  | 'timeout'
  /** DNS / socket / fetch threw. */
  | 'network'
  /** 200 OK, understood shape, but no image in it. */
  | 'no_image'
  /** 200 OK and we could not parse it. The API moved, or we did. */
  | 'bad_shape';

export type RenderImageResult =
  | { ok: true; bytes: Uint8Array; mimeType: string; model: string }
  | { ok: false; code: RenderFailureCode; detail: string };

/** One conditioning image handed to the model. */
export type ReferenceImage = { bytes: Uint8Array; mimeType: string };

export type GenerateRenderArgs = {
  /** The stylist brief — `buildRenderPrompt()`. */
  prompt: string;
  /**
   * The structure reference: the stylized scene SVG, rasterisable by the
   * model as-is. Passed FIRST so it reads as the layout to recreate, matching
   * the design lock's "img2img conditioned on the stylized scene SVG
   * (structure) + the couple's uploaded inspirations (aesthetic)".
   */
  sceneSvg?: string | null;
  /** The couple's own inspiration uploads. Aesthetic, not structure. */
  references?: readonly ReferenceImage[];
  timeoutMs?: number;
};

/** Is the provider reachable at all in this environment? FALSE is honest, not broken. */
export function imageProviderConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** The model actually in use, for the stored render row and the logs. */
export function imageProviderModel(): string {
  return process.env.MOODBOARD_RENDER_MODEL || DEFAULT_MODEL;
}

/**
 * How many reference images we will send. A cap, because each one is base64 in
 * a JSON body and the couple can hold several per slot; an unbounded body is a
 * timeout dressed up as a render.
 */
export const MAX_REFERENCE_IMAGES = 4;

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/**
 * The real media type of some bytes, from their magic number.
 *
 * 🪤 WHY THIS IS NOT "just default to image/jpeg". The couple's inspirations
 * are fetched as raw bytes (`safeFetchImageBytes` returns no content-type) and
 * a `mime_type` we DECLARE that disagrees with the bytes we SEND is the kind
 * of mismatch a provider rejects — which would surface as a `refused` or
 * `http_error` on every render for any couple whose uploads happen to be PNG
 * or WebP. That failure would be visible (this file guarantees that much) but
 * it would be visible and WRONG, blaming their brief for our header.
 *
 * Falls back to JPEG only when the bytes match nothing known, which is also
 * the only case where we genuinely have no better information.
 */
export function sniffImageMime(bytes: Uint8Array): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif';
  }
  // RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

type InputPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mime_type: string; data: string };

/**
 * Pull the generated image out of a parsed response body.
 *
 * Exported and PURE so it can be tested against real and mangled payloads
 * without a network — `gemini-image.test.ts` feeds it the documented shape,
 * the alternate `steps[]` shape, and several shapes that must NOT be read as
 * an empty success.
 *
 * 🔑 IT RETURNS A RESULT, NOT `null`. "I did not find an image" and "this is
 * not a response I understand" are different facts and must stay different:
 * the first is a `no_image` a couple can act on, the second is a `bad_shape`
 * that means WE are broken and the owner needs to know. Collapsing them into
 * `null` is how an API change becomes a silent charge for a blank tile.
 */
export function extractImage(
  body: unknown,
): { ok: true; bytes: Uint8Array; mimeType: string } | { ok: false; code: 'no_image' | 'bad_shape' | 'refused'; detail: string } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, code: 'bad_shape', detail: `response was ${typeof body}` };
  }
  const root = body as Record<string, unknown>;

  // A provider-side refusal is reported IN a 200. Catch it before we look for
  // pixels, or a policy decline reads as `no_image` and the couple is told to
  // retry something that will never work.
  const status = typeof root.status === 'string' ? root.status : null;
  if (status && /refus|block|reject|safety/i.test(status)) {
    return { ok: false, code: 'refused', detail: `status=${status}` };
  }

  const candidates: unknown[] = [];
  // The documented shape: `interaction.output_image.data`, where `interaction`
  // IS the response object.
  candidates.push(root.output_image, root.outputImage);
  // Nested under an explicit `interaction` envelope, if one is ever added.
  const nested = root.interaction;
  if (typeof nested === 'object' && nested !== null) {
    const n = nested as Record<string, unknown>;
    candidates.push(n.output_image, n.outputImage);
  }
  // The `steps[]` shape some responses carry.
  //
  // ⚠ THE LAST IMAGE STEP WINS, WHICH IS WHY THIS IS REVERSED. A multi-step
  // response can carry intermediate images — a draft, a partial edit — before
  // the finished one. Taking the first would hand the couple a rough version
  // of the photograph they paid for, and it would look like a success.
  const steps = root.steps;
  if (Array.isArray(steps)) {
    const imageSteps: Record<string, unknown>[] = [];
    for (const step of steps) {
      if (typeof step === 'object' && step !== null) {
        const s = step as Record<string, unknown>;
        if (s.type === 'image' || typeof s.data === 'string') imageSteps.push(s);
      }
    }
    candidates.push(...imageSteps.reverse());
  }

  let sawContainer = false;
  for (const c of candidates) {
    if (typeof c !== 'object' || c === null) continue;
    sawContainer = true;
    const obj = c as Record<string, unknown>;
    const data = obj.data;
    if (typeof data !== 'string' || data.length === 0) continue;
    const mimeType =
      (typeof obj.mime_type === 'string' && obj.mime_type) ||
      (typeof obj.mimeType === 'string' && obj.mimeType) ||
      'image/png';
    let bytes: Buffer;
    try {
      bytes = Buffer.from(data, 'base64');
    } catch {
      return { ok: false, code: 'bad_shape', detail: 'image data was not base64' };
    }
    // Base64 decoding is lenient — garbage in produces a short Buffer rather
    // than a throw. A handful of bytes is not a photograph, and letting one
    // through would put a broken-image icon on a tile the couple paid for.
    if (bytes.byteLength < 256) {
      return {
        ok: false,
        code: 'bad_shape',
        detail: `decoded image was ${bytes.byteLength} bytes`,
      };
    }
    return { ok: true, bytes: new Uint8Array(bytes), mimeType };
  }

  if (sawContainer) {
    // We found where an image lives and it was empty. That is a real,
    // understood "no image" — the model answered without one.
    return { ok: false, code: 'no_image', detail: 'image container held no data' };
  }
  // We recognised nothing. Either the API moved or we are pointed at the wrong
  // thing. Either way this is OUR fault and must not be dressed as the
  // couple's.
  return {
    ok: false,
    code: 'bad_shape',
    detail: `no image field found; keys=${Object.keys(root).slice(0, 8).join(',')}`,
  };
}

/**
 * Ask the model for one image.
 *
 * Never throws. Every outcome is a value the caller must narrow, because the
 * caller's job is to put a failure ON THE BOX and hand the credit back — and
 * it cannot do that for an exception it did not expect.
 */
export async function generateRenderImage(args: GenerateRenderArgs): Promise<RenderImageResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // 🔑 THE `RESEND_API_KEY` SHAPE, REFUSED. An unset key must be a LOUD,
    // couple-visible, credit-returning failure — not a call that quietly goes
    // nowhere. That exact omission left the owner un-notified of real customer
    // payments for months, because nothing rendered differently.
    //
    // Note this fires in Vercel PREVIEW as things stand: GEMINI_API_KEY is set
    // for Production only (measured 2026-09-03, `vercel env ls`). A preview
    // deploy will therefore show this message rather than an image, which is
    // the correct behaviour and is why it says what it says.
    return {
      ok: false,
      code: 'not_configured',
      detail: 'GEMINI_API_KEY is not set in this environment',
    };
  }

  const model = imageProviderModel();
  const input: InputPart[] = [{ type: 'text', text: args.prompt }];

  // Structure first, aesthetic after — see `sceneSvg` above.
  if (args.sceneSvg && args.sceneSvg.trim()) {
    input.push({
      type: 'image',
      mime_type: 'image/svg+xml',
      data: Buffer.from(args.sceneSvg, 'utf8').toString('base64'),
    });
  }
  for (const ref of (args.references ?? []).slice(0, MAX_REFERENCE_IMAGES)) {
    if (ref.bytes.byteLength === 0) continue;
    input.push({ type: 'image', mime_type: ref.mimeType, data: base64(ref.bytes) });
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-goog-api-key': key,
        'Content-Type': 'application/json',
        'Api-Revision': API_REVISION,
      },
      body: JSON.stringify({ model, input }),
      // An image generation is slow; the ceiling exists so a hung socket
      // becomes a REPORTED timeout rather than a tile stuck at "working" until
      // the platform kills the function and tells nobody.
      signal: AbortSignal.timeout(args.timeoutMs ?? 120_000),
      cache: 'no-store',
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') {
      return { ok: false, code: 'timeout', detail: `no response within the deadline (${name})` };
    }
    return {
      ok: false,
      code: 'network',
      detail: err instanceof Error ? `${err.name}: ${err.message}` : 'fetch failed',
    };
  }

  if (!res.ok) {
    // Read the body for the log — a bare status tells an operator nothing, and
    // this is the message that explains a bad key or an exhausted quota.
    let detail = `HTTP ${res.status}`;
    try {
      detail = `HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`;
    } catch {
      // The status alone is still worth reporting; it is never swallowed.
    }
    return { ok: false, code: 'http_error', detail };
  }

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    return { ok: false, code: 'bad_shape', detail: '200 OK with a body that was not JSON' };
  }

  const image = extractImage(parsed);
  if (!image.ok) return image;
  return { ok: true, bytes: image.bytes, mimeType: image.mimeType, model };
}
