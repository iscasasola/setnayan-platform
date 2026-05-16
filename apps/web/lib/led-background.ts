/**
 * Iteration 0005 — LED Background Maker (scaffold-level launch).
 *
 * V1 ships a couple-facing template gallery + render-queue mock so the
 * surface is real, navigable, and shippable while the production render
 * pipeline (FFmpeg + Lottie at 8K) is built out behind the scenes.
 *
 * Pricing is intentionally NOT exposed on the gallery — V1 SKUs are locked
 * and order/checkout happens out-of-band via Setnayan team handoff for now
 * (mirrors the Save-the-Date pattern). Render cost stubs live with the
 * worker once we wire it.
 *
 * Master loop durations match the 2026-05-08 decision-log row:
 *   5 / 10 (default) / 30 / 90-minute (90 gated as the ₱899 Custom tier).
 */

export type LedTemplate = {
  slug: string;
  name: string;
  vibe: string;
  /** One-liner that describes the motion layering for the template card. */
  motif: string;
  /** Background + 2 accent colors for the placeholder thumbnail gradient. */
  palette: [string, string, string];
};

export type LedLoopOption = {
  /** Seconds of master loop. */
  durationSeconds: number;
  label: string;
  /** Estimated MP4 file size at 8K H.264 — for the picker copy. */
  approxSize: string;
  /** Repeat count across a 5-hour reception. */
  repeatsOver5h: string;
  /** Locked behind ₱899 Custom tier when true (shown disabled with a hint). */
  customTier?: boolean;
};

export const LED_LOOP_OPTIONS: ReadonlyArray<LedLoopOption> = [
  {
    durationSeconds: 300,
    label: '5 min',
    approxSize: '~2.8 GB',
    repeatsOver5h: 'plays 60× over your reception',
  },
  {
    durationSeconds: 600,
    label: '10 min',
    approxSize: '~5.6 GB',
    repeatsOver5h: 'plays 30× over your reception',
  },
  {
    durationSeconds: 1800,
    label: '30 min',
    approxSize: '~17 GB',
    repeatsOver5h: 'plays 10× — near-zero perceptible repetition',
  },
  {
    durationSeconds: 5400,
    label: '90 min',
    approxSize: '~50 GB',
    repeatsOver5h: 'Custom tier — for couples who want one continuous arc',
    customTier: true,
  },
];

export const LED_DEFAULT_LOOP_SECONDS = 600;

/**
 * V1 ships all 10 spec-locked templates as placeholder cards. Production
 * thumbnails (looping `thumb.mp4`) will land alongside the FFmpeg + Lottie
 * pipeline; until then we render solid-gradient placeholders with the
 * template's motif as overlay text.
 *
 * Order + names match the iteration 0005 spec's § "The 10 templates" table.
 */
export const LED_TEMPLATES: ReadonlyArray<LedTemplate> = [
  {
    slug: 'filigree_bloom',
    name: 'Filigree Bloom',
    vibe: 'Romantic',
    motif: 'Color wash + ornament rings + light bloom + film grain',
    palette: ['#2B1F12', '#C9A14B', '#F5EBD9'],
  },
  {
    slug: 'capiz_shimmer',
    name: 'Capiz Shimmer',
    vibe: 'Filipino Heritage',
    motif: 'Layered capiz-shell radial gradients shimmering at offset cycles',
    palette: ['#F4EBD9', '#E3CDA0', '#A6815C'],
  },
  {
    slug: 'sampaguita_drift',
    name: 'Sampaguita Drift',
    vibe: 'Heritage',
    motif: 'Floating sampaguita petal sprites + soft dawn gradient',
    palette: ['#F7EFE0', '#E8D5B0', '#C9A14B'],
  },
  {
    slug: 'gold_particles',
    name: 'Gold Particles',
    vibe: 'Glamour',
    motif: 'High-density gold particle bokeh drifting across canvas',
    palette: ['#0F0F0F', '#C9A14B', '#3A2A1C'],
  },
  {
    slug: 'ethereal_mist',
    name: 'Ethereal Mist',
    vibe: 'Soft / dreamy',
    motif: 'Cloud-like billowing volumes with subtle light leaks',
    palette: ['#E6EEF3', '#B6CEDD', '#F5EBD9'],
  },
  {
    slug: 'bokeh_lights',
    name: 'Bokeh Lights',
    vibe: 'Cinematic',
    motif: 'Defocused light circles at varying depths, slow drift',
    palette: ['#1A1410', '#8B5E2B', '#C9A14B'],
  },
  {
    slug: 'watercolor_wash',
    name: 'Watercolor Wash',
    vibe: 'Artistic',
    motif: 'Slow color shift between three watercolor blooms',
    palette: ['#F4F0E6', '#D8A4A2', '#A8B89A'],
  },
  {
    slug: 'slow_pulse',
    name: 'Slow Pulse',
    vibe: 'Minimal',
    motif: 'Single concentric circle pulsing slowly, monogram emphasis',
    palette: ['#0F0F0F', '#FAF7F2', '#C9A14B'],
  },
  {
    slug: 'constellation',
    name: 'Constellation',
    vibe: 'Magical',
    motif: 'Stars connecting + drifting, rotating around the monogram',
    palette: ['#0B1530', '#3E5278', '#E3CDA0'],
  },
  {
    slug: 'velvet_sweep',
    name: 'Velvet Sweep',
    vibe: 'Bold',
    motif: 'Rich gradient sweep with slow ribbon-like motion',
    palette: ['#3A1226', '#8B1E3F', '#C9A14B'],
  },
];

export function findLedTemplate(slug: string): LedTemplate | null {
  return LED_TEMPLATES.find((t) => t.slug === slug) ?? null;
}
