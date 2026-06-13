// Real Weddings showcase — public editorial surface (iteration 0046, first
// slice). Mirrors lib/blog.ts: content is an in-code typed constant (no DB, no
// CMS), so /realstories + /realstories/[slug] pre-render with generateStaticParams +
// dynamicParams=false.
//
// IMPORTANT — sample vs real. The canonical 0046/0002 model is that a real
// wedding's showcase is DB-driven: it publishes from the couple's own `events`
// row at T+30d post-wedding WITH explicit RA 10173 consent (first real one =
// the founder's Dec 2026 wedding → editorials land ~Jan 2027). Until then the
// page would be empty. The entries here are explicitly-labelled SAMPLES
// (`isSample: true`) — curated, fictional, marketing-only showcases that
// demonstrate the format. They carry NO real person's data, so no consent
// gate applies. When real consent-gated editorials ship, they merge in
// alongside (or replace) these samples and the sitemap query flips to the DB.
//
// Honesty: every sample renders a visible "Sample showcase" label + a line
// stating real couples' editorials begin December 2026. We never present a
// fictional couple as a real client, and we never fabricate vendor business
// names — the "team" section links to vendor *categories* on /vendors rather
// than naming invented businesses.

export type RealWeddingBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] };

// A team credit. On a real showcase each becomes a named vendor linking to
// /v/[slug]; on a sample it links to the vendor *category* browse so the
// internal-link value is real without naming an invented business.
export type WeddingTeamCredit = { role: string; href: string };

export type RealWedding = {
  slug: string;
  coupleNames: string;
  /** True = curated illustrative sample (not a real client). */
  isSample: boolean;
  publishedAt: string; // ISO 'YYYY-MM-DD' — honest sitemap lastmod
  updatedAt?: string;
  /** Human display, e.g. 'February 2026'. */
  eventDateLabel: string;
  city: string;
  ceremonyType: string; // Catholic · Civil · INC · Christian · Muslim · Cultural · Mixed
  venueSetting: string; // Garden · Beach · Banquet hall · …
  venueName: string;
  theme: string;
  palette: string[]; // hex swatches for the visual strip
  guestCount: string; // band, e.g. '120 guests'
  excerpt: string;
  heroQuote: string;
  story: RealWeddingBlock[];
  team: WeddingTeamCredit[];
  setnayanNote: string;
  featured?: boolean;
};

export const REAL_WEDDINGS: ReadonlyArray<RealWedding> = [
  {
    slug: 'maria-and-juan-tagaytay-garden-wedding',
    coupleNames: 'Maria & Juan',
    isSample: true,
    publishedAt: '2026-06-13',
    eventDateLabel: 'February 2026',
    city: 'Tagaytay',
    ceremonyType: 'Catholic',
    venueSetting: 'Garden',
    venueName: 'A hillside garden estate overlooking Taal',
    theme: 'Classic champagne & sage',
    palette: ['#E9DDC7', '#9CAF88', '#6B4E3D', '#F6F1E7'],
    guestCount: '120 guests',
    excerpt:
      'A classic champagne-and-sage garden wedding in Tagaytay — an afternoon Catholic ceremony, golden-hour portraits, and a long-table reception under the trees.',
    heroQuote:
      'We planned the whole thing on Setnayan — and on the day, everything was just set.',
    story: [
      {
        type: 'p',
        text: 'Maria and Juan wanted a wedding that felt unmistakably theirs: a quiet Catholic ceremony, the people they love closest in, and a garden that did most of the decorating itself. They found Tagaytay early — cool air, big sky, and a view of Taal that needed no styling — and built the rest of the day around it.',
      },
      {
        type: 'h2',
        text: 'The look',
      },
      {
        type: 'p',
        text: 'They kept the palette soft and natural: champagne, sage, and warm wood, with white florals that let the greenery lead. The same colours carried from the invitations through the aisle to the long-table reception, so the whole day read as one unbroken idea.',
      },
      {
        type: 'h2',
        text: 'The day',
      },
      {
        type: 'p',
        text: 'An afternoon ceremony slid straight into golden hour for portraits, then into a long-table dinner under the trees as the lights came on. The program stayed short and warm — a few toasts, a first dance, and the kind of money dance that ends with everyone on their feet.',
      },
      {
        type: 'ul',
        items: [
          'Ceremony: afternoon Catholic rite with full entourage — principal sponsors, candle, veil, and cord.',
          'Portraits: golden hour across the estate lawns, Taal in the background.',
          'Reception: long-table dinner for 120, acoustic set, then a live band for the dancing.',
        ],
      },
    ],
    team: [
      { role: 'Venue', href: '/venues' },
      { role: 'Catering', href: '/vendors' },
      { role: 'Photography & Video', href: '/vendors' },
      { role: 'Coordination', href: '/vendors' },
      { role: 'Florals & Styling', href: '/vendors' },
      { role: 'Hair & Makeup', href: '/vendors' },
      { role: 'Host', href: '/vendors' },
    ],
    setnayanNote:
      'Maria and Juan ran their guest list, budget, schedule, seating, and vendor shortlist from one Setnayan workspace — and the day-of timeline kept every supplier on the same call times.',
    featured: true,
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Helpers — parallel to lib/blog.ts.
// ───────────────────────────────────────────────────────────────────────────

export const REAL_WEDDINGS_LASTMOD = '2026-06-13';

export const ALL_REAL_WEDDINGS: ReadonlyArray<RealWedding> = [...REAL_WEDDINGS].sort(
  (a, b) => (a.publishedAt < b.publishedAt ? 1 : -1),
);

export function findRealWedding(slug: string): RealWedding | undefined {
  return REAL_WEDDINGS.find((w) => w.slug === slug);
}

export function relatedRealWeddings(slug: string, limit = 3): RealWedding[] {
  return ALL_REAL_WEDDINGS.filter((w) => w.slug !== slug).slice(0, limit);
}

/** Distinct ceremony types present — for facet chips (only render in-use). */
export function weddingCeremonyTypesInUse(): string[] {
  return Array.from(new Set(ALL_REAL_WEDDINGS.map((w) => w.ceremonyType)));
}

/** Distinct cities present — for facet chips. */
export function weddingCitiesInUse(): string[] {
  return Array.from(new Set(ALL_REAL_WEDDINGS.map((w) => w.city)));
}

export function weddingPlainText(w: RealWedding): string {
  const body = w.story
    .map((b) => (b.type === 'ul' ? b.items.join(' ') : b.text))
    .join(' ');
  return `${w.excerpt} ${body} ${w.setnayanNote}`.replace(/\s+/g, ' ').trim();
}

export function weddingMetaDescription(w: RealWedding, max = 155): string {
  const source = w.excerpt || weddingPlainText(w);
  if (source.length <= max) return source;
  const slice = source.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}

/** Headline used for <title>, OG, and the showcase H1. */
export function weddingTitle(w: RealWedding): string {
  return `${w.coupleNames}: a ${w.ceremonyType.toLowerCase()} ${w.venueSetting.toLowerCase()} wedding in ${w.city}`;
}
