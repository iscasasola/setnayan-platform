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
  /**
   * Editor rank for the /realstories cascade (mirrors `events.showcase_feature_rank`).
   * 1 = the Cover (single hero slot); 2,3,… = "Most loved" editors' picks, in order.
   * Undefined = not editor-picked → falls to "Just published" / "Archive" by date.
   * Used as the manual stand-in for true most-viewed until view tracking ships.
   */
  featureRank?: number;
  /**
   * Hero still — the editorial's "front page" photo (also the poster for a
   * video hero). Public path under /realstories/…; resolved as-is.
   */
  heroImageUrl?: string;
  /**
   * Optional 5-second hero CLIP. When present the /realstories card plays it
   * live on a seamless forward→reverse (ping-pong) loop, with heroImageUrl as
   * the poster + reduced-motion fallback. Maps to the locked Daily-Prophet rule.
   */
  heroVideoUrl?: string;
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
      { role: 'Catering', href: '/explore' },
      { role: 'Photography & Video', href: '/explore' },
      { role: 'Coordination', href: '/explore' },
      { role: 'Florals & Styling', href: '/explore' },
      { role: 'Hair & Makeup', href: '/explore' },
      { role: 'Host', href: '/explore' },
    ],
    setnayanNote:
      'Maria and Juan ran their guest list, budget, schedule, seating, and vendor shortlist from one Setnayan workspace — and the day-of timeline kept every supplier on the same call times.',
    featured: true,
    featureRank: 1,
    heroImageUrl: '/realstories/maria-juan-tagaytay.jpg',
    heroVideoUrl: '/realstories/maria-juan-tagaytay.mp4',
  },
  {
    slug: 'bea-and-niko-cebu-beach-wedding',
    coupleNames: 'Bea & Niko',
    isSample: true,
    publishedAt: '2026-06-08',
    eventDateLabel: 'April 2026',
    city: 'Cebu',
    ceremonyType: 'Beach',
    venueSetting: 'Shoreline',
    venueName: 'A west-facing cove on the Cebu coast',
    theme: 'Coral sunset',
    palette: ['#F4C4A8', '#D85A30', '#7A9CA8', '#FBF1E8'],
    guestCount: '80 guests',
    excerpt:
      'A barefoot beach wedding in Cebu timed to the sunset — a draped shoreline arch, a coral-and-sand palette, and vows said as the light went gold.',
    heroQuote: 'We picked the date for the tide and the time for the light. Everything else, Setnayan held.',
    story: [
      {
        type: 'p',
        text: 'Bea and Niko wanted the sea to be the venue, not the backdrop. They found a west-facing cove, worked the whole timeline backward from sunset, and kept the styling barely-there so the water could lead.',
      },
      { type: 'h2', text: 'The look' },
      {
        type: 'p',
        text: 'Sheer drapes on a simple arch, petals on pale sand, and a coral-to-amber palette that the sky finished for them. Nothing competed with the horizon.',
      },
      { type: 'h2', text: 'The day' },
      {
        type: 'p',
        text: 'A barefoot processional, a short ceremony at golden hour, then a long-table dinner on the sand as the lanterns came on and the tide came in.',
      },
      {
        type: 'ul',
        items: [
          'Ceremony: sunset shoreline vows under a draped arch.',
          'Portraits: golden hour along the waterline, then blue-hour by lantern.',
          'Reception: 80-guest long table on the sand, acoustic set into a DJ.',
        ],
      },
    ],
    team: [
      { role: 'Venue', href: '/venues' },
      { role: 'Catering', href: '/explore' },
      { role: 'Photography & Video', href: '/explore' },
      { role: 'Coordination', href: '/explore' },
      { role: 'Florals & Styling', href: '/explore' },
      { role: 'Hair & Makeup', href: '/explore' },
    ],
    setnayanNote:
      'Bea and Niko ran a tide-and-sunset timeline from one Setnayan workspace, so every supplier worked the same call times backward from golden hour.',
    featureRank: 2,
    heroImageUrl: '/realstories/bea-niko-cebu.jpg',
    heroVideoUrl: '/realstories/bea-niko-cebu.mp4',
  },
  {
    slug: 'andrea-and-paolo-manila-rooftop-wedding',
    coupleNames: 'Andrea & Paolo',
    isSample: true,
    publishedAt: '2026-05-28',
    eventDateLabel: 'March 2026',
    city: 'Manila',
    ceremonyType: 'Civil',
    venueSetting: 'Rooftop',
    venueName: 'A rooftop terrace above the Manila skyline',
    theme: 'Midnight & gold',
    palette: ['#1E2A44', '#C8A24B', '#6B7280', '#F3EFE6'],
    guestCount: '60 guests',
    excerpt:
      'An intimate rooftop civil wedding in Manila — a blue-hour ceremony, midnight-and-gold styling, and the city as the only decor that mattered.',
    heroQuote: 'Sixty people, one skyline, no fuss. We wanted small and we got unforgettable.',
    story: [
      {
        type: 'p',
        text: 'Andrea and Paolo skipped the big production for something closer: a civil ceremony at blue hour, sixty of their favourite people, and a terrace high enough to see the whole city catch the light.',
      },
      { type: 'h2', text: 'The look' },
      {
        type: 'p',
        text: 'Deep midnight tones warmed with brass and candlelight. Long tapers, a single statement bloom per table, and gold that read as glow rather than glitter.',
      },
      { type: 'h2', text: 'The day' },
      {
        type: 'p',
        text: 'A short, warm ceremony as the sky turned, then a seated dinner that ran late on toasts and a skyline that did the rest.',
      },
      {
        type: 'ul',
        items: [
          'Ceremony: blue-hour civil rite on the terrace.',
          'Portraits: city lights at golden-to-blue transition.',
          'Reception: 60-guest seated dinner, candlelit, live duo.',
        ],
      },
    ],
    team: [
      { role: 'Venue', href: '/venues' },
      { role: 'Catering', href: '/explore' },
      { role: 'Photography & Video', href: '/explore' },
      { role: 'Coordination', href: '/explore' },
      { role: 'Florals & Styling', href: '/explore' },
    ],
    setnayanNote:
      'Andrea and Paolo kept a tight 60-guest list, budget, and run-of-show in one Setnayan workspace — small by design, coordinated to the minute.',
    featureRank: 3,
    heroImageUrl: '/realstories/andrea-paolo-manila.jpg',
  },
  {
    slug: 'sofia-and-liam-baguio-forest-wedding',
    coupleNames: 'Sofia & Liam',
    isSample: true,
    publishedAt: '2026-06-10',
    eventDateLabel: 'May 2026',
    city: 'Baguio',
    ceremonyType: 'Christian',
    venueSetting: 'Pine forest',
    venueName: 'A pine-forest clearing in the Cordilleras',
    theme: 'Evergreen mist',
    palette: ['#2F4538', '#8FA68E', '#D8C7A1', '#F1F0EA'],
    guestCount: '100 guests',
    excerpt:
      'A misty pine-forest wedding in Baguio — an evergreen-and-white aisle between the trees, cool mountain air, and a Christian ceremony wrapped in fog.',
    heroQuote: 'The fog rolled in right on cue. We could not have planned the magic — but we planned everything else.',
    story: [
      {
        type: 'p',
        text: 'Sofia and Liam wanted cool air, tall trees, and quiet. Baguio gave them all three: an aisle of evergreen and white florals laid between the pines, with mist that arrived like it was invited.',
      },
      { type: 'h2', text: 'The look' },
      {
        type: 'p',
        text: 'Deep greens, soft creams, and natural wood — styling that disappeared into the forest instead of fighting it. Lanterns lit the path as the fog thickened.',
      },
      { type: 'h2', text: 'The day' },
      {
        type: 'p',
        text: 'A morning Christian ceremony in the clearing, hot drinks passed at cocktails, and a warm indoor reception once the mountain chill set in.',
      },
      {
        type: 'ul',
        items: [
          'Ceremony: morning Christian rite in a pine clearing.',
          'Portraits: fog between the trees, lantern-lit path.',
          'Reception: 100-guest warm indoor dinner, acoustic trio.',
        ],
      },
    ],
    team: [
      { role: 'Venue', href: '/venues' },
      { role: 'Catering', href: '/explore' },
      { role: 'Photography & Video', href: '/explore' },
      { role: 'Coordination', href: '/explore' },
      { role: 'Florals & Styling', href: '/explore' },
      { role: 'Hair & Makeup', href: '/explore' },
    ],
    setnayanNote:
      'Sofia and Liam coordinated an out-of-town wedding — vendors, logistics, and a weather-aware timeline — from one Setnayan workspace.',
    heroImageUrl: '/realstories/sofia-liam-baguio.jpg',
  },
  {
    slug: 'camille-and-rey-tagaytay-estate-wedding',
    coupleNames: 'Camille & Rey',
    isSample: true,
    publishedAt: '2026-06-14',
    eventDateLabel: 'May 2026',
    city: 'Tagaytay',
    ceremonyType: 'Catholic',
    venueSetting: 'Estate',
    venueName: 'A ridge-top estate garden in Tagaytay',
    theme: 'Blush & ivory',
    palette: ['#EFD9D6', '#E7B7A8', '#B89B72', '#FBF6F1'],
    guestCount: '150 guests',
    excerpt:
      'A blush-and-ivory estate wedding in Tagaytay — a flower-framed garden ceremony at blue hour, lanterns down the aisle, and a grand reception under the open sky.',
    heroQuote: 'We wanted it to feel like a garden in full bloom. Setnayan kept the bloom on schedule.',
    story: [
      {
        type: 'p',
        text: 'Camille and Rey leaned into romance: a ridge-top estate, an aisle framed in white and blush florals, and an archway that opened straight onto the Tagaytay sky.',
      },
      { type: 'h2', text: 'The look' },
      {
        type: 'p',
        text: 'Abundant blooms, ivory drapes, and warm lantern light — lush but never heavy, with blush carried from the invites to the last centrepiece.',
      },
      { type: 'h2', text: 'The day' },
      {
        type: 'p',
        text: 'A blue-hour ceremony under the floral arch, golden-hour portraits across the lawns, then a 150-guest reception that ran on toasts, a live band, and a long last dance.',
      },
      {
        type: 'ul',
        items: [
          'Ceremony: blue-hour Catholic rite beneath a floral archway.',
          'Portraits: golden hour across the estate gardens.',
          'Reception: 150-guest open-air dinner, live band.',
        ],
      },
    ],
    team: [
      { role: 'Venue', href: '/venues' },
      { role: 'Catering', href: '/explore' },
      { role: 'Photography & Video', href: '/explore' },
      { role: 'Coordination', href: '/explore' },
      { role: 'Florals & Styling', href: '/explore' },
      { role: 'Hair & Makeup', href: '/explore' },
      { role: 'Host', href: '/explore' },
    ],
    setnayanNote:
      'Camille and Rey managed a 150-guest list, seating, and a multi-vendor floral build from one Setnayan workspace, with every call time on a shared timeline.',
    heroImageUrl: '/realstories/camille-rey-tagaytay.jpg',
  },
  {
    slug: 'mira-and-caleb-laguna-lakeside-wedding',
    coupleNames: 'Mira & Caleb',
    isSample: true,
    publishedAt: '2026-05-20',
    eventDateLabel: 'April 2026',
    city: 'Laguna',
    ceremonyType: 'Garden',
    venueSetting: 'Lakeside',
    venueName: 'A lakeside lawn in Laguna',
    theme: 'Sage linen',
    palette: ['#A7B5A0', '#C9C2A8', '#7C8B7B', '#F4F2E9'],
    guestCount: '70 guests',
    excerpt:
      'A pared-back lakeside garden wedding in Laguna — a sage-linen long table at the water’s edge, eucalyptus runners, and an unhurried afternoon by the lake.',
    heroQuote: 'No frills, just the people and the water. It felt like the calmest day of our lives.',
    story: [
      {
        type: 'p',
        text: 'Mira and Caleb wanted calm: a small list, a lake, and a single long table set right at the water’s edge. The styling stayed quiet so the afternoon could stretch.',
      },
      { type: 'h2', text: 'The look' },
      {
        type: 'p',
        text: 'Sage linen, eucalyptus runners, simple ceramics, and natural wood — understated by design, soft against the overcast light off the water.',
      },
      { type: 'h2', text: 'The day' },
      {
        type: 'p',
        text: 'A short garden ceremony, a slow lakeside lunch for seventy, and an afternoon that never once felt rushed.',
      },
      {
        type: 'ul',
        items: [
          'Ceremony: afternoon garden vows by the lake.',
          'Portraits: soft overcast light along the waterline.',
          'Reception: 70-guest lakeside long-table lunch.',
        ],
      },
    ],
    team: [
      { role: 'Venue', href: '/venues' },
      { role: 'Catering', href: '/explore' },
      { role: 'Photography & Video', href: '/explore' },
      { role: 'Coordination', href: '/explore' },
      { role: 'Florals & Styling', href: '/explore' },
    ],
    setnayanNote:
      'Mira and Caleb kept an intentionally small, calm wedding organised — guest list, budget, and timeline — from one Setnayan workspace.',
    heroImageUrl: '/realstories/mira-caleb-laguna.jpg',
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
