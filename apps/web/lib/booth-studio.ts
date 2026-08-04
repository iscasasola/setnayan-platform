/**
 * Booth Studio — the STRUCTURED, palette-harmonized booth poster.
 *
 * WHY THIS EXISTS (the aesthetic guard, in code): a raw free-upload poster can
 * still read as a loud ad dropped into someone's wedding — "an ad breaking the
 * fourth wall." Booth Studio instead composes the poster from a fixed template
 * (headline / offer / price / logo / accent) and renders it AT RUNTIME in the
 * COUPLE'S Mood Board palette (the `Lab3DPalette` the 3D scene already threads
 * to every booth). The couple's palette always wins the frame, so a vendor's
 * poster harmonizes with the venue by construction — it can never inject a neon
 * house-ad look.
 *
 * This module is PURE and client-safe (no server-only / R2 / aws-sdk imports),
 * so the client BoothMesh renderer AND the server scene resolvers can both use
 * it, and every rule here is unit-testable under `tsx --test`:
 *   • sanitizeBoothStudioContent — coerce/trim/cap the stored JSONB.
 *   • composeBoothStudioLayout   — deterministic layout in the couple's palette.
 *   • harmonizeAccent            — clamp a vendor accent toward the palette.
 *   • pickReadableInk            — always-legible text over any palette bg.
 *   • publicPosterAssetUrl       — resolve a stored ref to a PUBLIC R2 URL,
 *                                  NEVER a presigned one (presigned URLs expire
 *                                  inside cached scene payloads).
 */

/** The couple's scene palette this composes against (subset of Lab3DPalette). */
export type BoothStudioPalette = {
  accent: string;
  table: string;
  wall: string;
};

/** Field length caps — a booth poster is a glance, not a brochure. */
export const BOOTH_STUDIO_LIMITS = {
  headline: 40,
  offer: 60,
  price: 24,
} as const;

/** The vendor-authored structured content, as stored in
 *  `event_vendor_booth_posters.poster_content` (JSONB). Every field optional —
 *  a poster with only a headline is valid. `accent` is an OPTIONAL hex the
 *  vendor may nudge toward; it is clamped by {@link harmonizeAccent} so it can
 *  never fight the couple's palette. */
export type BoothStudioContent = {
  headline?: string | null;
  offer?: string | null;
  price?: string | null;
  accent?: string | null;
};

/** Content after server resolution — carries the vendor logo as a PUBLIC R2 URL
 *  (never presigned) for the optional logo lockup. */
export type BoothStudioContentResolved = BoothStudioContent & {
  logoPublicUrl?: string | null;
};

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

function coerceField(value: unknown, cap: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.length > cap ? trimmed.slice(0, cap).trim() : trimmed;
}

function coerceHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!HEX_RE.test(t)) return null;
  return t.startsWith('#') ? t.toLowerCase() : `#${t.toLowerCase()}`;
}

/**
 * Coerce arbitrary stored JSON into clean {@link BoothStudioContent}, or null
 * when NOTHING usable is present. Fail-safe: a missing/garbage poster_content
 * yields null → the renderer mounts no structured poster (falls back to the raw
 * poster path or a bare booth), it never throws into the scene.
 */
export function sanitizeBoothStudioContent(raw: unknown): BoothStudioContent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const headline = coerceField(r.headline, BOOTH_STUDIO_LIMITS.headline);
  const offer = coerceField(r.offer, BOOTH_STUDIO_LIMITS.offer);
  const price = coerceField(r.price, BOOTH_STUDIO_LIMITS.price);
  const accent = coerceHex(r.accent);
  if (!headline && !offer && !price) return null; // at least one text line
  return {
    ...(headline ? { headline } : {}),
    ...(offer ? { offer } : {}),
    ...(price ? { price } : {}),
    ...(accent ? { accent } : {}),
  };
}

// --- colour helpers (pure) ---------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!HEX_RE.test(hex)) return null;
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Relative luminance (0..1), sRGB-weighted. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  if (s === 0) return rgbToHex(l * 255, l * 255, l * 255);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return rgbToHex(hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255);
}

/** Near-black or near-white ink so text stays legible over any board colour. */
export function pickReadableInk(bgHex: string): string {
  return relativeLuminance(bgHex) > 0.5 ? '#1c1917' : '#f7f3ec';
}

/**
 * THE aesthetic guard for colour. A vendor MAY nudge an accent, but it is
 * clamped so it can never fight the couple's palette: saturation is capped and
 * lightness is pulled into a mid band. An absent / invalid / over-garish accent
 * falls back to the couple's own palette accent — the venue always wins.
 */
export function harmonizeAccent(requested: string | null | undefined, palette: BoothStudioPalette): string {
  const rgb = requested ? hexToRgb(requested) : null;
  if (!rgb) return palette.accent;
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  // Reject anything neon/garish outright — fall back to the couple's accent.
  if (s > 0.85) return palette.accent;
  const clampedS = Math.min(s, 0.6);
  const clampedL = Math.max(0.35, Math.min(0.72, l));
  return hslToHex(h, clampedS, clampedL);
}

// --- deterministic layout ----------------------------------------------------

/** Portrait 2:3 board — matches the pull-up-banner format PH vendors design for
 *  and the raw poster's aspect (lib/booth-poster POSTER_ASPECT). Small enough to
 *  stay cheap as a CanvasTexture on a phone. */
export const BOOTH_STUDIO_CANVAS = { w: 512, h: 768 } as const;

export type BoothStudioLine = {
  kind: 'headline' | 'offer' | 'price';
  text: string;
  y: number;
  size: number;
  weight: number;
  color: string;
};

export type BoothStudioLayout = {
  width: number;
  height: number;
  /** Board background — the couple's `table` colour, deepened slightly for depth. */
  bg: string;
  /** Accent bar / price chip colour — harmonized from the couple's palette. */
  accent: string;
  /** Ink over the accent chip (legible over `accent`). */
  accentInk: string;
  ink: string;
  subInk: string;
  /** Where the optional logo lockup draws (top of the board). */
  logoBox: { x: number; y: number; w: number; h: number };
  lines: BoothStudioLine[];
};

/** Deepen a hex toward its darker self for the board (keeps hue, drops lightness). */
function deepen(hex: string, by = 0.12): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return hslToHex(h, s, Math.max(0, l - by));
}

/**
 * Compose the deterministic poster layout in the COUPLE'S palette. Pure — no
 * DOM — so it is fully unit-testable; the DOM paint (drawBoothStudioPoster)
 * consumes this. Only the lines whose content is present appear, so a
 * headline-only poster is balanced rather than sparse.
 */
export function composeBoothStudioLayout(
  content: BoothStudioContent,
  palette: BoothStudioPalette,
): BoothStudioLayout {
  const { w, h } = BOOTH_STUDIO_CANVAS;
  const bg = deepen(palette.table);
  const accent = harmonizeAccent(content.accent, palette);
  const ink = pickReadableInk(bg);
  const accentInk = pickReadableInk(accent);
  const subInk = relativeLuminance(bg) > 0.5 ? '#57534e' : '#d6ccbf';

  const lines: BoothStudioLine[] = [];
  // Vertical rhythm: logo band on top, then headline, offer, price chip.
  if (content.headline) {
    lines.push({ kind: 'headline', text: content.headline, y: h * 0.5, size: 52, weight: 700, color: ink });
  }
  if (content.offer) {
    lines.push({ kind: 'offer', text: content.offer, y: h * 0.66, size: 30, weight: 400, color: subInk });
  }
  if (content.price) {
    lines.push({ kind: 'price', text: content.price, y: h * 0.82, size: 34, weight: 700, color: accentInk });
  }

  return {
    width: w,
    height: h,
    bg,
    accent,
    accentInk,
    ink,
    subInk,
    logoBox: { x: w * 0.5, y: h * 0.24, w: w * 0.6, h: h * 0.22 },
    lines,
  };
}

// --- public (never-presigned) asset resolution ------------------------------

const R2_SCHEME = 'r2://';
/** The single publicly-served R2 bucket (mirrors R2_BUCKETS.media in lib/r2). */
export const PUBLIC_MEDIA_BUCKET = 'setnayan-media';

/**
 * Resolve a stored asset ref to a URL safe to embed in a CACHED scene payload:
 * a PUBLIC R2 URL, or a passthrough https URL, but NEVER a presigned one.
 *
 * WHY (the corpus warning, enforced in code): the scene payload is cached, and a
 * presigned URL (what `displayUrlForStoredAsset` returns) carries a ~24h
 * signature that EXPIRES inside the cache, breaking the image later. Booth
 * Studio art must therefore come from the public media host, which needs no
 * signature and never expires.
 *
 *   • r2://setnayan-media/<key>  → `${publicBase}/<key>` (public host, no sig).
 *   • r2://<other-bucket>/<key>  → null (private buckets are NOT public-served).
 *   • https://… (legacy)         → passthrough, UNLESS it looks presigned
 *                                  (X-Amz-Signature), in which case null.
 *   • anything else / no base    → null.
 *
 * PURE (base passed in) so it is testable without R2 env; the server resolver
 * passes process.env.R2_PUBLIC_URL.
 */
export function publicPosterAssetUrl(
  rawRef: string | null | undefined,
  publicBase: string | undefined,
  mediaBucket: string = PUBLIC_MEDIA_BUCKET,
): string | null {
  if (typeof rawRef !== 'string') return null;
  const trimmed = rawRef.trim();
  if (!trimmed) return null;

  if (!trimmed.startsWith(R2_SCHEME)) {
    // Legacy absolute URL. Public IF plain https and NOT already presigned.
    if (!/^https:\/\//i.test(trimmed)) return null;
    if (/[?&]X-Amz-Signature=/i.test(trimmed)) return null;
    return trimmed;
  }

  const rest = trimmed.slice(R2_SCHEME.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null;
  const bucket = rest.slice(0, slash);
  const key = rest.slice(slash + 1);
  if (bucket !== mediaBucket) return null; // only the public bucket is served publicly
  if (!publicBase) return null;
  return `${publicBase.replace(/\/+$/, '')}/${key}`;
}

/**
 * Server-side resolution of one booth's structured content: sanitize the stored
 * JSONB and attach the vendor logo as a PUBLIC (never presigned) URL. Bound to
 * ONE booth's own vendor refs by the caller — the per-(event,vendor) isolation
 * the RPC's UNIQUE(event_id, vendor_profile_id) join already guarantees is
 * preserved here (each booth passes only its OWN content + logo ref).
 */
export function resolveBoothStudioContent(
  rawContent: unknown,
  rawLogoRef: string | null | undefined,
  publicBase: string | undefined,
): BoothStudioContentResolved | null {
  const content = sanitizeBoothStudioContent(rawContent);
  if (!content) return null;
  const logoPublicUrl = publicPosterAssetUrl(rawLogoRef, publicBase);
  return { ...content, ...(logoPublicUrl ? { logoPublicUrl } : {}) };
}
