/**
 * Hard-coded V1 catalogue of Save-the-Date templates.
 *
 * Each template is rendered as a CSS-painted preview card (a 4-stripe
 * palette + a styled name in the template's font) on the gallery page.
 * Real video stills land once Remotion renders ship.
 *
 * Spec calls for a 30-template library; V1 ships 12 with room to grow.
 * Adding a template is a single object below — no schema change, no
 * migration. Owner edits via Cowork once a real spec lands.
 */

export type SaveTheDateTemplate = {
  slug: string;
  name: string;
  vibe: string;
  /** 4 hex colors — left to right on the preview swatch row. */
  palette: [string, string, string, string];
  /** CSS class fragment for the name treatment ("font-serif italic", etc.). */
  fontClass: string;
  /** Lift hint shown under the title. */
  bestFor: string;
};

export const STD_PRICE_PHP = 99;

export const SAVE_THE_DATE_TEMPLATES: ReadonlyArray<SaveTheDateTemplate> = [
  {
    slug: 'cebu-sunrise',
    name: 'Cebu Sunrise',
    vibe: 'Warm cream + terracotta — daytime garden ceremony.',
    palette: ['#FAF7F2', '#C97B4B', '#D8A076', '#824A2A'],
    fontClass: 'font-serif',
    bestFor: 'Tropical · daytime · pastel',
  },
  {
    slug: 'manila-old-world',
    name: 'Manila Old World',
    vibe: 'Deep maroon + ivory — heritage church + Intramuros vibe.',
    palette: ['#F5EBD9', '#8B1E3F', '#5C0A20', '#C9A14B'],
    fontClass: 'font-serif italic',
    bestFor: 'Heritage · evening · formal',
  },
  {
    slug: 'mountain-lodge',
    name: 'Mountain Lodge',
    vibe: 'Forest green + cream — Tagaytay, Baguio, mountain venues.',
    palette: ['#F4F0E6', '#2F4A3A', '#7C8C72', '#5C341D'],
    fontClass: 'font-serif',
    bestFor: 'Outdoor · cool-weather · rustic',
  },
  {
    slug: 'beachside-modern',
    name: 'Beachside Modern',
    vibe: 'Ocean blue + sand — Boracay, Palawan, beach receptions.',
    palette: ['#F4F0E6', '#7BA3C7', '#34577A', '#D6BC8E'],
    fontClass: 'font-sans tracking-wide',
    bestFor: 'Beach · daytime · breezy',
  },
  {
    slug: 'vintage-rose',
    name: 'Vintage Rose',
    vibe: 'Dusty pink + ivory — garden-romantic with soft accents.',
    palette: ['#F7EDE4', '#D8A4A2', '#A86C6E', '#8AA88A'],
    fontClass: 'font-serif italic',
    bestFor: 'Garden · romantic · soft',
  },
  {
    slug: 'classic-black-tie',
    name: 'Classic Black-tie',
    vibe: 'Black + gold — evening reception, formal sit-down dinner.',
    palette: ['#0F0F0F', '#C9A14B', '#FAF7F2', '#3A2A1C'],
    fontClass: 'font-serif uppercase tracking-[0.3em] text-sm',
    bestFor: 'Evening · formal · ballroom',
  },
  {
    slug: 'tropical-paradise',
    name: 'Tropical Paradise',
    vibe: 'Palm green + coral — beach resort or island venue.',
    palette: ['#F4F0E6', '#2F8A6E', '#E26D5C', '#C9A14B'],
    fontClass: 'font-sans tracking-tight',
    bestFor: 'Tropical · vibrant · resort',
  },
  {
    slug: 'garden-pastoral',
    name: 'Garden Pastoral',
    vibe: 'Sage + cream — afternoon garden tea-party feel.',
    palette: ['#F7F0E2', '#A8B89A', '#D8A4A2', '#5C6A52'],
    fontClass: 'font-serif',
    bestFor: 'Garden · afternoon · soft palette',
  },
  {
    slug: 'modern-minimalist',
    name: 'Modern Minimalist',
    vibe: 'Black + white + taupe — clean lines, lots of negative space.',
    palette: ['#FFFFFF', '#0F0F0F', '#D6CFC4', '#7A736C'],
    fontClass: 'font-sans tracking-tight',
    bestFor: 'City · modern · understated',
  },
  {
    slug: 'filipiniana-heritage',
    name: 'Filipiniana Heritage',
    vibe: 'Gold + maroon + terracotta — barong tagalog and saya energy.',
    palette: ['#F5EBD9', '#C9A14B', '#8B1E3F', '#C97B4B'],
    fontClass: 'font-serif italic',
    bestFor: 'Filipiniana · cultural · warm',
  },
  {
    slug: 'sunset-boho',
    name: 'Sunset Boho',
    vibe: 'Orange + dusty rose — open-air, golden-hour ceremony.',
    palette: ['#F7E8D8', '#E26D5C', '#D8A4A2', '#C9A14B'],
    fontClass: 'font-serif',
    bestFor: 'Outdoor · golden hour · earthy',
  },
  {
    slug: 'forest-dream',
    name: 'Forest Dream',
    vibe: 'Deep green + gold + cream — woodland venue or estate gardens.',
    palette: ['#F4F0E6', '#1F3D2C', '#C9A14B', '#5C341D'],
    fontClass: 'font-serif',
    bestFor: 'Woodland · evening · regal',
  },
];

export function findTemplate(slug: string): SaveTheDateTemplate | null {
  return SAVE_THE_DATE_TEMPLATES.find((t) => t.slug === slug) ?? null;
}
