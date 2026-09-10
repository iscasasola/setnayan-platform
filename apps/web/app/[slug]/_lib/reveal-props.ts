/**
 * app/[slug]/_lib/reveal-props.ts — the reveal's per-couple props, composed ONCE.
 *
 * The cinematic reveal opens in two places: the Event Hub (site-body.tsx) and,
 * since 2026-09-10, the first door of the invite link for a Pro invite theme
 * (owner: "our cinematic reveal is also integrated as one whole concept
 * design"). These six helpers lived as private functions in site-body.tsx; they
 * are moved here VERBATIM — only `export` added, and the two that took the
 * site's whole EventRow now name the columns they actually read — so the two
 * doors can never open with different seals, colours or templates. A second
 * hand-written copy of one rule is how this codebase's surfaces drift apart.
 */
import { sanitizeRolePalette } from '@/lib/mood-board';
import { sealColorFromPalette, veilColorFromPalette } from '@/lib/site-palette';
import { sanitizeWaxSealConfig, type WaxSealConfig } from '@/lib/wax-seal/types';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';
import { REVEAL_TEMPLATE_IDS, type RevealTemplateId } from '@/lib/reveal-config';

/** Derive a short couple monogram for the reveal seal, e.g. "A & J". */
export function revealMonogram(name: string): string {
  const parts = name
    .split(/\s*&\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  const a = parts[0] ?? '';
  const b = parts[1] ?? '';
  if (a && b) return `${a.charAt(0)} & ${b.charAt(0)}`.toUpperCase();
  return (name.trim().charAt(0) || '✦').toUpperCase();
}

/** Wax-seal colour for the reveal — the moodboard deep accent (§4). */
export function revealWaxColor(palette: unknown): string {
  return sealColorFromPalette(sanitizeRolePalette(palette));
}

/** Veil tulle colour for the reveal — a sheer moodboard tint (§4). */
export function revealVeilColor(palette: unknown): string {
  return veilColorFromPalette(sanitizeRolePalette(palette));
}

/**
 * The couple's monogram mark for the wax seal — their own upload outranks the
 * AI/Cipher mark (owner rule 2026-06-15); null → lettered seal fallback.
 */
export function revealMarkSvg(event: {
  monogram_uploaded_svg?: string | null;
  monogram_custom_svg?: string | null;
}): string | null {
  // SEC-3: gated on read — events.monogram_* are host-writable via PostgREST.
  return resolveEventMonogramSvg(event);
}

/** The couple's minted wax-seal recipe for the reveal (null → default levers). */
export function revealSealConfig(event: { wax_seal_config?: unknown }): WaxSealConfig | null {
  return sanitizeWaxSealConfig(event.wax_seal_config);
}

/** The couple's chosen opening (events.std_reveal_template) validated to a known
 *  id, 'none' (No Reveal — the free, no-opening choice), or null → the admin
 *  house default. Validated server-side because the client RevealOverlay can't
 *  import reveal-config (it pulls the admin client). */
export function coerceRevealTemplate(v: unknown): RevealTemplateId | 'none' | null {
  if (v === 'none') return 'none'; // NO_REVEAL — honoured even with the premium unlock
  return typeof v === 'string' &&
    (REVEAL_TEMPLATE_IDS as readonly string[]).includes(v)
    ? (v as RevealTemplateId)
    : null;
}
