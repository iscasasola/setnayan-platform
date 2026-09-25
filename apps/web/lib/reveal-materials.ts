/**
 * lib/reveal-materials.ts — EACH THEME DRESSES ITS OPENING (Maker Phase 6, #4).
 *
 * Owner, 2026-09-24 (DECISION_LOG "EVERY THEME GETS ITS OWN REVEAL", approved
 * *"great :)"*): layer 1 is the five SHIPPED openings dressed in each theme's
 * materials — Classic ivory four-flap + gold seal · Rustic kraft + twine ·
 * Vintage aged envelope + lace + pressed roses · Regency lilac-sealed letter ·
 * Whimsical sheer veil + butterflies — for all ten themes. Layer 2 (the five new
 * signature reveals: velvet curtains, deco gates, midnight sparkle, frosted
 * panel, neon) is Phase 10; until each lands, its theme's `opening` plays here,
 * dressed.
 *
 * ── HOW A MATERIAL REACHES THE PIXELS ────────────────────────────────────────
 * The envelope and the doors already read their colours from the house tokens
 * at mount — `rigid-webgl.tsx` `cssColor(mount, '--color-cream' | '--color-
 * terracotta' | '--color-mulberry')`, and the CSS fallback paints with the same
 * `bg-cream` / `terracotta` utilities. So dressing is a token swap on the
 * overlay's own box (`revealMaterialVars`), not a second renderer: the WebGL and
 * the CSS paths stay one look by construction (#5, "fold shading so CSS and WebGL
 * match"). The seal and the veil take their colour props.
 *
 * Classic (`house`) returns `null` — its opening is the shipped look, exactly as
 * it renders today (ivory paper, gold liner). Any reveal can be used with any
 * theme (owner 09-24); the materials follow the THEME, not the opening.
 *
 * PURE. Type-only imports.
 */
import type { InviteThemeId } from '@/lib/invite-themes';

export type RevealMaterials = {
  /** What the couple sees on the Reveal panel for this theme's dressing. */
  name: string;
  /** The envelope / letter paper — `--color-cream` inside the overlay. */
  paper: string;
  /** The inside of the flaps — `--color-terracotta` inside the overlay. */
  liner: string;
  /** The church-door lining — `--color-mulberry` inside the overlay. */
  door: string;
  /** The wax seal. */
  seal: string;
  /** The sheer veil. */
  veil: string;
  /** The falling petals (veil / doors effect). */
  petals: string;
};

const HEX = /^#[0-9a-f]{6}$/;

/**
 * The ten themes' materials. Colours are the theme's OWN palette values
 * (`lib/invite-themes.ts`, the spec's measured ones) — not re-derived — except
 * where the owner named a material the palette does not carry (kraft, lilac wax,
 * aged paper), which is written here once.
 */
export const REVEAL_MATERIALS: Readonly<Record<InviteThemeId, RevealMaterials | null>> = Object.freeze({
  house: null,
  abaca: {
    name: 'Kraft envelope, twine and a rust seal',
    paper: '#c9a57a',
    liner: '#f0d5b4',
    door: '#8b5333',
    seal: '#8b5333',
    veil: '#fbf0e4',
    petals: '#d9a47e',
  },
  galeriya: {
    name: 'Stone paper and an olive seal',
    paper: '#f5f0eb',
    liner: '#d6cec9',
    door: '#3a4a1c',
    seal: '#3a4a1c',
    veil: '#f5f0eb',
    petals: '#b9c2a4',
  },
  cinderella: {
    name: 'Ice-blue paper and a silver seal',
    paper: '#eef3f8',
    liner: '#d4dfe7',
    door: '#8a9eae',
    seal: '#8a9eae',
    veil: '#eef3f8',
    petals: '#c9d8e6',
  },
  velvet: {
    name: 'Oxblood velvet and a gold seal',
    paper: '#34130c',
    liner: '#e3a86f',
    door: '#34130c',
    seal: '#b8863f',
    veil: '#3a150e',
    petals: '#b0413e',
  },
  vintage: {
    name: 'Aged paper, lace and pressed roses',
    paper: '#eadbc6',
    liner: '#e1cdb9',
    door: '#634b2f',
    seal: '#7a2e2e',
    veil: '#eadbc6',
    petals: '#c98b8b',
  },
  whimsical: {
    name: 'Sheer blush veil and butterflies',
    paper: '#fbf7f0',
    liner: '#c9aab3',
    door: '#5a4a5e',
    seal: '#c9aab3',
    veil: '#f6e8ec',
    petals: '#e7c3cf',
  },
  regency: {
    name: 'Cream letter, lilac wax and wisteria',
    paper: '#f6efe6',
    liner: '#e2b997',
    door: '#33261f',
    seal: '#9b86b8',
    veil: '#f6efe6',
    petals: '#b9a4d6',
  },
  gatsby: {
    name: 'Black lacquer, deco gold and a gold seal',
    paper: '#331610',
    liner: '#ecbf8f',
    door: '#110504',
    seal: '#c99a5b',
    veil: '#1d0b08',
    petals: '#ecbf8f',
  },
  cyber: {
    name: 'Midnight paper and a neon seal',
    paper: '#26222d',
    liner: '#ec8cd6',
    door: '#0b0a12',
    seal: '#ec8cd6',
    veil: '#26222d',
    petals: '#ec8cd6',
  },
});

export function revealMaterialsFor(theme: string | null | undefined): RevealMaterials | null {
  if (!theme) return null;
  return (REVEAL_MATERIALS as Record<string, RevealMaterials | null>)[theme] ?? null;
}

function triple(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/**
 * The overlay's own token overrides — `R G B` triples, the format the house
 * tokens are written in (`globals.css`) and the only one `cssColor()` in the
 * WebGL stage parses. `{}` for Classic and for anything malformed: the opening
 * then renders exactly as it did before themes dressed it.
 */
export function revealMaterialVars(m: RevealMaterials | null): Record<string, string> {
  if (!m || ![m.paper, m.liner, m.door].every((c) => HEX.test(c))) return {};
  return {
    '--color-cream': triple(m.paper),
    '--color-terracotta': triple(m.liner),
    '--color-mulberry': triple(m.door),
  };
}
