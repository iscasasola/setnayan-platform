/**
 * Recraft V3 API client — minimal fetch wrapper for native SVG vector
 * illustration generation.
 *
 * NOTE: Previously imported `server-only` to block client imports; that was
 * removed because the offline tsx generation script needs to import this
 * file. Runtime safety is still enforced by the RECRAFT_API_KEY env-var
 * requirement — the key only exists in server contexts, so accidental
 * client invocation throws a clear error before any network call.
 *
 * Why plain fetch instead of the openai SDK: Recraft is OpenAI-API-compatible
 * (`base_url='https://external.api.recraft.ai/v1'`) so the openai SDK works,
 * but adding that dep just for one call is heavier than 30 lines of fetch.
 * Plain fetch keeps the bundle clean and avoids a transitive-dependency cycle.
 *
 * # API contract (per docs at https://www.recraft.ai/docs/api-reference/endpoints):
 *   - POST https://external.api.recraft.ai/v1/images/generations
 *   - Header: Authorization: Bearer RECRAFT_API_KEY · Content-Type: application/json
 *   - Body: { prompt, model, response_format, style?, substyle?, size? }
 *   - Response: { created, data: [{ b64_json: '...' }] } when response_format='b64_json'
 *     OR { created, data: [{ url: '...' }] } when response_format='url' (default)
 *
 * # Recraft-specific model + style:
 *   - model='recraftv4_1_vector' → native SVG output (the V3-era spec called
 *     this 'recraftv3', V4 series renamed; recraftv4_1_vector is the current
 *     SVG-output-capable model as of 2026-05)
 *   - style='vector_illustration' → flat-illustration aesthetic, vector-friendly
 *   - substyle='flat_2' → most common clipart-style substyle (Recraft offers
 *     ~12 substyles per top-level style)
 *
 * # Pricing (per Recraft docs):
 *   - $0.08 per vector (SVG) image
 *   - $0.04 per raster (PNG) image
 *   - Pre-purchased API units at $1 / 1000 units · vector = 80 units · raster = 40 units
 *   - 50 SVG generations = ~$4 total · acceptable V1 placeholder budget
 *
 * # Graceful fallback (mirrors lib/r2.ts pattern):
 *   - If RECRAFT_API_KEY is unset, generateVectorSvg() throws with a clear
 *     message rather than silently failing. Generation scripts catch this
 *     and surface "set RECRAFT_API_KEY first" to the operator. Production
 *     web code does NOT call this lib directly — generation only fires from
 *     the offline script (`apps/web/scripts/generate-attire-guide-figures.ts`)
 *     run by the Setnayan team / owner with the key in their .env.local. The
 *     resulting SVGs land in R2 as static assets; the runtime web request
 *     just reads them via the moodboard_library_assets storage_path.
 */

const RECRAFT_API_BASE = 'https://external.api.recraft.ai/v1';

export type RecraftStyle =
  | 'realistic_image'
  | 'digital_illustration'
  | 'vector_illustration';

export type GenerateVectorSvgArgs = {
  /** Full prompt text — see Wedding_Attire_Guide_AI_Generation.md for the
   *  canonical template + per-role parameters. */
  prompt: string;
  /** Recraft style preset. `vector_illustration` is the only one that
   *  produces clean vector SVG output suitable for the WAG use case. */
  style?: RecraftStyle;
  /** Optional substyle for finer control. Recraft offers per-style
   *  substyles (e.g., 'flat_2' / 'tablet_sketch' / 'engraving_color' for
   *  vector_illustration). When omitted, Recraft picks a default. */
  substyle?: string;
  /** Image dimensions. Defaults to 1024×1024 (single-figure portrait).
   *  Recraft supports a fixed set of sizes; check docs for the full list. */
  size?: '1024x1024' | '1365x1024' | '1024x1365' | '1707x1024' | '1024x1707';
  /** Model to invoke. Defaults to the V4 vector model. */
  model?: string;
  /** Optional palette steering (Recraft `controls`). `colors` biases the
   *  working palette; `background_color` pins the canvas. Verified live
   *  2026-06-11 against recraftv4_1_vector + b64_json (bespoke monogram
   *  studio). Callers needing graceful degradation should retry WITHOUT
   *  controls on a 400 (API-drift tolerance). */
  controls?: {
    colors?: { rgb: [number, number, number] }[];
    background_color?: { rgb: [number, number, number] };
  };
};

export type GenerateVectorSvgResult = {
  /** Base64-encoded SVG bytes — call atob() / Buffer.from(b64, 'base64')
   *  to recover the raw SVG string suitable for R2 upload. */
  b64Svg: string;
  /** Generation timestamp from Recraft (seconds since epoch). */
  createdAt: number;
};

/**
 * Generate a single SVG via Recraft V3+. Throws on missing API key or
 * non-2xx HTTP response. Caller is responsible for retry / backoff.
 *
 * Returns base64-encoded SVG bytes — caller decodes + uploads to storage.
 */
export async function generateVectorSvg(
  args: GenerateVectorSvgArgs,
): Promise<GenerateVectorSvgResult> {
  const apiKey = process.env.RECRAFT_API_KEY;
  if (!apiKey) {
    throw new Error(
      'RECRAFT_API_KEY is unset. Set it in .env.local or as a Vercel env ' +
        'var before calling Recraft generation. Sign up at https://www.recraft.ai/ ' +
        '+ generate a key under Account → API Tokens.',
    );
  }

  const body = {
    prompt: args.prompt,
    model: args.model ?? 'recraftv4_1_vector',
    style: args.style ?? 'vector_illustration',
    ...(args.substyle ? { substyle: args.substyle } : {}),
    ...(args.controls ? { controls: args.controls } : {}),
    size: args.size ?? '1024x1024',
    response_format: 'b64_json' as const,
    n: 1,
  };

  const res = await fetch(`${RECRAFT_API_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '(unable to read error body)');
    throw new Error(
      `Recraft API error ${res.status} ${res.statusText}: ${errText}`,
    );
  }

  type RecraftResponse = {
    created: number;
    data: Array<{ b64_json?: string; url?: string }>;
  };
  const json = (await res.json()) as RecraftResponse;
  const first = json.data?.[0];
  if (!first?.b64_json) {
    throw new Error(
      'Recraft response missing data[0].b64_json — check that response_format ' +
        'is set to b64_json and that the model returned vector output (the URL ' +
        'response_format path is not supported by this client).',
    );
  }

  return {
    b64Svg: first.b64_json,
    createdAt: json.created,
  };
}

/**
 * Convenience: decode base64 SVG bytes to a raw SVG string. Use when the
 * generation script needs to inspect the SVG content before upload, OR
 * to write the SVG to disk for local review before committing the seed
 * migration.
 */
export function decodeBase64Svg(b64: string): string {
  return Buffer.from(b64, 'base64').toString('utf-8');
}
