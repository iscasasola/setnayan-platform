import Anthropic from '@anthropic-ai/sdk';
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@/lib/vendors';

// Cap on number of menu photos accepted in a single OCR run. Each image is
// served via a fresh presigned URL and counted as image-token input, so we
// keep this conservative — most caterers' printed menus fit in 1-3 pages.
export const MAX_OCR_IMAGES = 6;

/**
 * Output shape of the AI catalog generator.
 *
 * `name` is a vendor-review hint — the existing `vendor_services` table has no
 * `name` column (categories double as the "service name" today via
 * `displayServiceLabel(category)`). Storing names is part of iteration 0040's
 * modifier-groups schema, which is out of scope here. For V1 the name surfaces
 * in the AI preview UI so the vendor can edit/sanity-check before publish, but
 * it is not persisted — only `category` + `starting_price_php` + `is_active`
 * are written to `vendor_services` by the publish action.
 */
export type GeneratedCatalogEntry = {
  name: string;
  category: VendorCategory;
  /** Centavos (PHP × 100), matching the rest of the codebase. */
  starting_price_php: number;
  is_active: boolean;
};

const STUB_MODE = !process.env.ANTHROPIC_API_KEY;

const CATEGORY_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

/**
 * Generate a structured vendor catalog from a free-form description.
 *
 * Two paths:
 *   • STUB (default — no `ANTHROPIC_API_KEY`): returns a small hardcoded
 *     example so the end-to-end UI flow works in development and CI without
 *     burning tokens or requiring an API key.
 *   • LIVE: calls Claude Sonnet 4.6 (good cost/quality balance for this
 *     extract-and-structure task) and validates every entry against the
 *     `vendor_category` enum. Invalid categories fall back to `misc`.
 *
 * The user can flip stub → live by simply setting `ANTHROPIC_API_KEY` in the
 * environment — no code changes required.
 */
export async function generateCatalogWithClaude(
  description: string,
): Promise<GeneratedCatalogEntry[]> {
  if (STUB_MODE) {
    // STUB: returns a hardcoded example so the UI flow can be demoed without
    // an API key. The shape matches what the LIVE path produces below.
    return [
      {
        name: 'Bronze Package (100 pax)',
        category: 'catering',
        starting_price_php: 15_000_000,
        is_active: true,
      },
      {
        name: 'Silver Package (150 pax)',
        category: 'catering',
        starting_price_php: 22_000_000,
        is_active: true,
      },
      {
        name: 'Gold Package (200 pax)',
        category: 'catering',
        starting_price_php: 30_000_000,
        is_active: true,
      },
    ];
  }

  // LIVE: actual Claude API call.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: buildPrompt(description),
      },
    ],
  });

  const firstBlock = response.content[0];
  if (!firstBlock || firstBlock.type !== 'text') {
    throw new Error('Claude returned no text content.');
  }

  return parseAndValidate(firstBlock.text);
}

function buildPrompt(description: string): string {
  const categoryList = VENDOR_CATEGORIES.map(
    (c) => `- ${c}: ${VENDOR_CATEGORY_LABEL[c]}`,
  ).join('\n');

  return `You are helping a Filipino wedding/event vendor add their services to Setnayan. Given the vendor's plain-English description below, generate a structured catalog as JSON.

Vendor description:
${description}

Available categories (use the slug, exactly as written):
${categoryList}

Generate a JSON array. Each entry must have:
- name (string, vendor's service name, e.g. "Bronze Package (100 pax)")
- category (string, MUST match one of the slugs above exactly)
- starting_price_php (integer, price in CENTAVOS so multiply pesos by 100)
- is_active (boolean, default true)

Only output the JSON array, no other text.`;
}

/**
 * Photo-OCR equivalent of `generateCatalogWithClaude` — given presigned GET
 * URLs for one or more menu/pricelist images, ask Claude to extract structured
 * catalog entries via vision.
 *
 * Same two paths as text mode:
 *   • STUB (no `ANTHROPIC_API_KEY`): hardcoded example reflecting a typical
 *     Filipino caterer's tiered packages so the UI flow is demoable in dev/CI
 *     without burning vision tokens.
 *   • LIVE: claude-sonnet-4-6 with image content blocks. Each photo gets a
 *     `{type: "image", source: {type: "url", url}}` block followed by a
 *     text prompt that grounds Filipino-menu conventions (₱ / P / PHP, "pax"
 *     counts, package-vs-item disambiguation, handwritten edits).
 *
 * The `vendorProfileId` parameter is plumbed through for future per-vendor
 * prompting (e.g. "this vendor is a caterer, focus on catering categories"
 * to bias category selection) but is currently unused — kept in the signature
 * so the action layer doesn't churn when we add that.
 */
export async function generateCatalogFromImagesWithClaude(
  imageSignedUrls: string[],
  vendorProfileId: string,
): Promise<GeneratedCatalogEntry[]> {
  // _vendorProfileId reserved for future per-vendor prompt biasing.
  void vendorProfileId;

  if (!Array.isArray(imageSignedUrls) || imageSignedUrls.length === 0) {
    throw new Error('At least one photo is required to extract a catalog.');
  }
  if (imageSignedUrls.length > MAX_OCR_IMAGES) {
    throw new Error(
      `Too many photos (got ${imageSignedUrls.length}, max ${MAX_OCR_IMAGES}). Try with fewer images.`,
    );
  }

  if (STUB_MODE) {
    // STUB: returns a hardcoded example that approximates what a real
    // Filipino caterer's menu photo would yield. The shape matches LIVE.
    // The "(extracted from menu photo)" suffix on the first entry makes it
    // obvious in the UI that this is the stub path during development.
    return [
      {
        name: 'Bronze Wedding Package (extracted from menu photo)',
        category: 'catering',
        starting_price_php: 15_000_000,
        is_active: true,
      },
      {
        name: 'Silver Wedding Package (extracted)',
        category: 'catering',
        starting_price_php: 22_000_000,
        is_active: true,
      },
      {
        name: 'Gold Wedding Package (extracted)',
        category: 'catering',
        starting_price_php: 30_000_000,
        is_active: true,
      },
      {
        name: 'Lechon Service (extracted)',
        category: 'catering',
        starting_price_php: 1_800_000,
        is_active: true,
      },
    ];
  }

  // LIVE: actual Claude vision call.
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // One image content block per photo, then the OCR prompt as the final text
  // block — matches the recommended ordering for Claude vision (visual
  // context first, instruction last).
  const imageBlocks = imageSignedUrls.map((url) => ({
    type: 'image' as const,
    source: { type: 'url' as const, url },
  }));

  const response = await client.messages.create({
    // Sonnet 4.6 gives a good cost/quality balance for menu OCR. If we hit
    // accuracy problems on hard-to-read printed menus we can swap to
    // claude-opus-4-7 here without touching call sites.
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          ...imageBlocks,
          { type: 'text' as const, text: buildPhotoOcrPrompt() },
        ],
      },
    ],
  });

  const firstBlock = response.content[0];
  if (!firstBlock || firstBlock.type !== 'text') {
    throw new Error('Claude returned no text content for photo OCR.');
  }

  return parseAndValidate(firstBlock.text);
}

/**
 * Prompt for the photo-OCR path. Mirrors `buildPrompt` (text mode) for shape
 * but adds Filipino menu conventions Claude needs to read prices correctly:
 *   - ₱ / P / PHP / 15K all mean PHP 15,000
 *   - "pax" = guest count (e.g. "100 pax" → "for 100 guests")
 *   - Packages with included items map to ONE catalog entry per package,
 *     not one per item — vendor_services has UNIQUE (vendor, category).
 *   - Handwritten edits / asterisks usually mean surcharges.
 *
 * Kept as a function rather than inlined so we can A/B test prompt
 * variations without touching the API call site.
 */
function buildPhotoOcrPrompt(): string {
  const categoryList = VENDOR_CATEGORIES.map(
    (c) => `- ${c}: ${VENDOR_CATEGORY_LABEL[c]}`,
  ).join('\n');

  return `You are looking at photo(s) of a Filipino wedding/event vendor's menu, pricelist, or service brochure. Extract every service/package + price into a structured catalog as JSON.

Available categories (use the slug exactly):
${categoryList}

For each service/item visible in the images, generate a JSON entry with:
- name (string, vendor's package or item name as it appears in the image)
- category (string, MUST match a slug above; pick the closest match; if truly unknown, use "misc")
- starting_price_php (integer in CENTAVOS — multiply peso amount by 100; if you see "₱15,000" that's 1500000)
- is_active (boolean, always true)

Important Filipino context:
- Filipino menus often list "packages" with pax counts (e.g. "Bronze Package - 100 pax")
- Prices may be written as ₱15,000 or P15,000 or PHP 15,000 or 15K — all mean PHP 15,000
- Watch for handwritten edits / asterisks meaning surcharges
- If a menu lists items WITHIN a package (e.g. "Includes: 4 mains, 4 sides"), generate ONE catalog entry per package (not per item)
- If you can't read a price clearly, omit that entry rather than guess

Only output the JSON array — no other text, no markdown fences.`;
}

/**
 * Best-effort JSON parser + per-entry validator.
 *
 * Claude is asked to return a bare JSON array, but in practice it sometimes
 * wraps the output in a fenced code block or adds a leading sentence. We
 * extract the first `[ ... ]` block and parse that. Per entry we coerce types
 * and drop anything that can't be validated, rather than failing the whole
 * batch — vendor-side UX is "review and edit", so a partial result is more
 * useful than an error.
 */
function parseAndValidate(raw: string): GeneratedCatalogEntry[] {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('Claude response did not contain a JSON array.');
  }
  const json = raw.slice(start, end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error(
      `Claude response was not valid JSON: ${(e as Error).message}`,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Claude response was not a JSON array.');
  }

  const out: GeneratedCatalogEntry[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;

    const name = typeof obj.name === 'string' ? obj.name.trim() : '';
    if (name.length === 0) continue;

    const categoryRaw =
      typeof obj.category === 'string' ? obj.category.trim() : '';
    const category: VendorCategory = CATEGORY_SET.has(categoryRaw)
      ? (categoryRaw as VendorCategory)
      : 'misc';

    const priceRaw = obj.starting_price_php;
    let starting_price_php = 0;
    if (typeof priceRaw === 'number' && Number.isFinite(priceRaw)) {
      starting_price_php = Math.max(0, Math.round(priceRaw));
    } else if (typeof priceRaw === 'string') {
      const n = Number(priceRaw);
      if (Number.isFinite(n)) starting_price_php = Math.max(0, Math.round(n));
    }

    const is_active = obj.is_active === false ? false : true;

    out.push({ name, category, starting_price_php, is_active });
  }

  return out;
}
