/**
 * apps/web/lib/bespoke-monogram-engine.ts
 *
 * PURE half of the Setnayan AI Bespoke Monogram engine: prompt engineering +
 * SVG sanitation. No env access, no network, no server-only pin — fully
 * unit-testable (lib/bespoke-monogram.test.ts). The IO layer (the vector
 * API call) lives in lib/bespoke-monogram.ts (server-only); the client-safe
 * registry lives in lib/bespoke-monogram-shared.ts.
 *
 * SECURITY (load-bearing): generated SVGs come from a third-party API and
 * render on couple + guest pages. sanitizeBespokeSvg() REJECTS (not repairs)
 * any markup containing scripts, event handlers, hrefs, foreignObject,
 * embedded rasters, or external references. Marks additionally render via
 * data-URI <img> (inert — no script execution context) as defense-in-depth.
 */

import type { BespokeStyleKey } from '@/lib/bespoke-monogram-shared';

/* ──────────────────────────────────────────────────────────────────────────
 * Prompt engineering
 *
 * Tested live 2026-06-11: the crest direction produced designer-tier marks
 * on the first attempt. Color obedience via prose is weak, so the palette
 * also rides the API's `controls.colors` (see PALETTE_RGB + the IO layer);
 * "plain white background" is asked for so the full-canvas background path
 * the model bakes in can be stripped deterministically.
 * ────────────────────────────────────────────────────────────────────────── */

const STYLE_PROMPTS: Record<BespokeStyleKey, (i: string, motif: string) => string> = {
  interlocked: (i, motif) =>
    `Luxury wedding monogram, interlocking serif letters ${i} elegantly intertwined as one unified mark, refined negative space between the letterforms, quiet-luxury minimal aesthetic${motif}, deep mulberry ink with champagne gold accents on plain white background, flat vector emblem, no text other than the letters ${i}`,
  botanical: (i, motif) =>
    `Wedding monogram, serif letters ${i} at center of a fine-line botanical wreath of leaves and small blossoms${motif}, elegant thin strokes, deep mulberry and champagne gold on plain white background, refined heirloom stationery style, flat vector emblem, no text other than the letters ${i}`,
  crest: (i, motif) =>
    `Bespoke wedding crest monogram, letters ${i} interlocked at center of an ornate shield, circular frame of fine-line botanical leaves and tiny blossoms${motif}, royal champagne gold and deep obsidian on plain white background, heirloom engraved stationery style, symmetrical, flat vector emblem, elegant thin strokes, no text other than the letters ${i}`,
  geometric: (i, motif) =>
    `Modern geometric wedding monogram, sans-serif letters ${i} with wide spacing inside a thin gold geometric frame${motif}, art-deco calm, generous negative space, deep obsidian and champagne gold on plain white background, fashion-house minimal, flat vector emblem, no text other than the letters ${i}`,
};

// Clean Editorial palette (project_setnayan_palette) → the API's
// controls.colors. The model treats these as the working palette; the prose
// in STYLE_PROMPTS carries the same intent.
export const PALETTE_RGB: [number, number, number][] = [
  [92, 37, 66], // Rich Mulberry #5C2542
  [197, 160, 89], // Royal Champagne Gold #C5A059
  [30, 34, 41], // Deep Obsidian #1E2229
];

export function buildBespokePrompt(opts: {
  initialsA: string;
  initialsB: string;
  styleKey: BespokeStyleKey;
  motif?: string;
  feedback?: string;
}): string {
  const i = opts.initialsB
    ? `${opts.initialsA} and ${opts.initialsB}`
    : opts.initialsA;
  // The motif weaves into the scene; feedback appends as a refinement clause.
  const motifClean = (opts.motif ?? '').trim().slice(0, 120);
  const motif = motifClean ? `, incorporating a subtle ${motifClean} motif` : '';
  let prompt = STYLE_PROMPTS[opts.styleKey](i, motif);
  const feedback = (opts.feedback ?? '').trim().slice(0, 200);
  if (feedback) prompt = `${prompt}. Refinement: ${feedback}`;
  // The vector API hard-caps prompts at 1000 chars.
  return prompt.slice(0, 1000);
}

/* ──────────────────────────────────────────────────────────────────────────
 * SVG sanitation — strict allowlist; REJECT, don't repair.
 * ────────────────────────────────────────────────────────────────────────── */

const MAX_SVG_BYTES = 400_000;

// Any of these anywhere → reject. The vector model emits plain path stacks;
// anything fancier is unexpected and untrusted.
const FORBIDDEN = [
  /<script/i,
  /<foreignobject/i,
  /<iframe/i,
  /<embed/i,
  /<object/i,
  /<image/i,
  /<use/i,
  /<style/i,
  /<animate/i,
  /<set[\s>]/i,
  /\son[a-z]+\s*=/i, // event handlers
  /javascript:/i,
  /href\s*=/i, // no hrefs of any kind (xlink included)
  // url(...) only as a same-document fragment reference — the model fills
  // shapes with internal gradients (fill="url(#Gradient2)" → a local
  // <linearGradient>), which is inert. Anything else (http, //, data, blob)
  // is an external reference → reject. The data-URI <img> render context
  // blocks external loads anyway (secure static mode) — defense-in-depth.
  /url\s*\(\s*(?!#)/i,
  /data:/i, // no nested data URIs
];

/**
 * Validate + normalize a generated SVG. Returns the cleaned markup, or null
 * if the input fails the allowlist (caller skips that candidate).
 *
 * Normalizations: strip the XML prolog, strip fixed width/height (viewBox
 * stays → scales to its container), strip the model's baked-in full-canvas
 * background path so the mark sits transparent on our cream surfaces.
 */
export function sanitizeBespokeSvg(raw: string): string | null {
  if (!raw || raw.length > MAX_SVG_BYTES) return null;
  let svg = raw.replace(/^\s*<\?xml[^>]*\?>\s*/i, '').trim();
  if (!svg.toLowerCase().startsWith('<svg')) return null;
  if (!svg.toLowerCase().endsWith('</svg>')) return null;
  for (const re of FORBIDDEN) {
    if (re.test(svg)) return null;
  }

  // viewBox is required for responsive scaling.
  const vb = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  if (!vb) return null;

  // Drop fixed pixel dimensions from the root tag; CSS owns display size.
  svg = svg.replace(/^<svg([^>]*)>/i, (_m, attrs: string) => {
    const cleaned = attrs
      .replace(/\s(?:width|height)="[^"]*"/gi, '')
      .replace(/\sstyle="[^"]*"/gi, '');
    return `<svg${cleaned}>`;
  });

  svg = stripCanvasBackground(svg, parseFloat(vb[1] ?? '0'), parseFloat(vb[2] ?? '0'));
  return svg;
}

/**
 * Remove path elements that paint the entire canvas (the model bakes the
 * requested white background in as a full-viewBox path — the mark itself
 * never legitimately paints edge-to-edge as one path).
 */
export function stripCanvasBackground(svg: string, w: number, h: number): string {
  if (!w || !h) return svg;
  return svg.replace(/<path\b[^>]*\/?>(?:\s*<\/path>)?/gi, (tag) => {
    const d = tag.match(/\sd="([^"]*)"/i)?.[1] ?? '';
    // Full-canvas rect signature: starts at 0 0 and walks the four corners.
    const corner = new RegExp(
      `^M\\s*0[\\s,]+0\\s+L\\s*${w}[\\s,]+0\\s+L\\s*${w}[\\s,]+${h}\\s+L\\s*0[\\s,]+${h}`,
      'i',
    );
    return corner.test(d.trim()) ? '' : tag;
  });
}
