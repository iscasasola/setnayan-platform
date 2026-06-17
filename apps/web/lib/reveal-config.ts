/**
 * Reveal Studio config — the admin-managed house defaults for the Save-the-Date
 * opening reveal (bridal-veil / envelope / doors).
 *
 * Setnayan HQ edits this at /admin/reveal-studio; it persists as a single JSONB
 * row (`reveal_studio_config`, id=1, read-all RLS, admin-write via service role —
 * the platform_settings / homepage_hero_config recipe). The public couple site
 * reads the row and merges it over the LOCKED code defaults below (the
 * owner-tuned 2026-06-17 settings, spec `0024_Veil_Reveal_Spec_2026-06-17.md`
 * §6), so a missing or partial row always resolves to the signed-off look.
 *
 * This is the single source of truth for the config SHAPE, shared by the reader
 * (the couple page), the writer (the admin actions), and the renderer
 * (veil-reveal.tsx takes `look`/`features` from here).
 */

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';

export type RevealTemplateId =
  | 'four-flap'
  | 'two-flap-vertical'
  | 'two-flap-horizontal'
  | 'church-doors'
  | 'veil-sheer';

export const REVEAL_TEMPLATE_IDS: readonly RevealTemplateId[] = [
  'four-flap',
  'two-flap-vertical',
  'two-flap-horizontal',
  'church-doors',
  'veil-sheer',
];

/** The veil "look" knobs — the live slider panel. Mirrors the prototype's §6 table. */
export type VeilLook = {
  tilePx: number; // logo gap px (large = plain veil)
  logoSize: number; // mark size as % of the tile
  logoOpacity: number; // mark opacity (subtle white)
  topValance: number; // top-valance % (the visible fold droop)
  reaches: number; // hem reaches ~% from the bottom
  wind: number; // hem-weighted sway
  folds: number; // bloom fold count
  fullness: number; // fold depth at the hem
  weight: number; // gravity
  trail: number; // fold follow softness
  floatUp: number; // keeps the fold high during reveal
  feather: number; // auto-reveal (feather) seconds
  bounce: number; // settle damping
  petalsDensity: number; // petal count %
  liftPk: number; // hold forward peak
  hold: number; // tap-pinch radius
  stretch: number; // soft strain envelope
};

export type RevealFeatures = {
  petals: boolean;
  logo: boolean;
  music: boolean;
};

export type RevealStudioConfig = {
  /** Master on/off for the reveal (replaces the NEXT_PUBLIC_STD_REVEAL env flag). */
  enabled: boolean;
  /** House-default template when a couple hasn't chosen one. */
  defaultTemplate: RevealTemplateId;
  /** Which templates couples may use (for the future per-event chooser). */
  templates: Record<RevealTemplateId, boolean>;
  /** Per-feature toggles. */
  features: RevealFeatures;
  /** House-default veil tulle colour (the couple's Mood Board palette overrides it). */
  veilColorDefault: string;
  /** House-default petal colour. */
  petalsColor: string;
  /** The veil look knobs. */
  veil: VeilLook;
};

/** LOCKED owner-tuned defaults (spec §6, 2026-06-17). Every read merges over these. */
export const DEFAULT_VEIL_LOOK: VeilLook = {
  tilePx: 125,
  logoSize: 9,
  logoOpacity: 22,
  topValance: 30,
  reaches: 10,
  wind: 48,
  folds: 16,
  fullness: 100,
  weight: 26,
  trail: 100,
  floatUp: 100,
  feather: 5.0,
  bounce: 83,
  petalsDensity: 100,
  liftPk: 70,
  hold: 22,
  stretch: 15,
};

export const DEFAULT_REVEAL_CONFIG: RevealStudioConfig = {
  // Off by default — same as the env-flag-off default today; admin flips it on
  // (the ?reveal= URL override still works for previews regardless).
  enabled: false,
  defaultTemplate: 'veil-sheer',
  templates: {
    'four-flap': true,
    'two-flap-vertical': true,
    'two-flap-horizontal': true,
    'church-doors': true,
    'veil-sheer': true,
  },
  features: { petals: true, logo: true, music: false },
  veilColorDefault: '#f3ece1',
  petalsColor: '#e87a93',
  veil: DEFAULT_VEIL_LOOK,
};

// ── helpers ────────────────────────────────────────────────────────────────

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function hex(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : fallback;
}
function isTemplateId(v: unknown): v is RevealTemplateId {
  return typeof v === 'string' && (REVEAL_TEMPLATE_IDS as readonly string[]).includes(v);
}

function mergeLook(raw: unknown): VeilLook {
  const r = (raw ?? {}) as Record<string, unknown>;
  const d = DEFAULT_VEIL_LOOK;
  return {
    tilePx: num(r.tilePx, d.tilePx),
    logoSize: num(r.logoSize, d.logoSize),
    logoOpacity: num(r.logoOpacity, d.logoOpacity),
    topValance: num(r.topValance, d.topValance),
    reaches: num(r.reaches, d.reaches),
    wind: num(r.wind, d.wind),
    folds: num(r.folds, d.folds),
    fullness: num(r.fullness, d.fullness),
    weight: num(r.weight, d.weight),
    trail: num(r.trail, d.trail),
    floatUp: num(r.floatUp, d.floatUp),
    feather: num(r.feather, d.feather),
    bounce: num(r.bounce, d.bounce),
    petalsDensity: num(r.petalsDensity, d.petalsDensity),
    liftPk: num(r.liftPk, d.liftPk),
    hold: num(r.hold, d.hold),
    stretch: num(r.stretch, d.stretch),
  };
}

/** Deep-merge a raw JSONB value over the locked defaults, with type guards. */
export function mergeRevealConfig(raw: unknown): RevealStudioConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const d = DEFAULT_REVEAL_CONFIG;
  const rawTemplates = (r.templates ?? {}) as Record<string, unknown>;
  const templates = { ...d.templates };
  for (const id of REVEAL_TEMPLATE_IDS) templates[id] = bool(rawTemplates[id], d.templates[id]);
  const rawFeatures = (r.features ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(r.enabled, d.enabled),
    defaultTemplate: isTemplateId(r.defaultTemplate) ? r.defaultTemplate : d.defaultTemplate,
    templates,
    features: {
      petals: bool(rawFeatures.petals, d.features.petals),
      logo: bool(rawFeatures.logo, d.features.logo),
      music: bool(rawFeatures.music, d.features.music),
    },
    veilColorDefault: hex(r.veilColorDefault, d.veilColorDefault),
    petalsColor: hex(r.petalsColor, d.petalsColor),
    veil: mergeLook(r.veil),
  };
}

/**
 * Read the single reveal-studio row and resolve the effective config. Public
 * (read-all RLS) — read via the service-role client so it never depends on a
 * visitor session, exactly like the hero-video read path. Always falls back to
 * the locked defaults (never throws on the couple page).
 */
export const fetchRevealConfig = cache(async (): Promise<RevealStudioConfig> => {
  try {
    const db = createAdminClient();
    const { data } = await db.from('reveal_studio_config').select('config').eq('id', 1).maybeSingle();
    return mergeRevealConfig((data as { config?: unknown } | null)?.config);
  } catch {
    return DEFAULT_REVEAL_CONFIG;
  }
});
