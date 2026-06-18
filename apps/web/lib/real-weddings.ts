// Real Stories showcase — public editorial surface (iteration 0046).
// Covers ALL Filipino life milestones (weddings, debuts, anniversaries,
// graduations, reunions, birthdays, …), not just weddings.
//
// IMPORTANT — sample vs real. The canonical 0046/0002 model is that a real
// editorial is DB-driven: it publishes from the person's own `events` row at
// T+30d post-event WITH explicit RA 10173 consent (first real one = the
// founder's Dec 2026 wedding → editorials land ~Jan 2027). Until then the
// page would be empty. The entries here are explicitly-labelled SAMPLES
// (`isSample: true`) — curated, fictional, marketing-only showcases. They
// carry NO real person's data, so no consent gate applies.
//
// The "newspaper front-page" design: each editorial renders as a named
// Chronicle ("The Maria & Juan Chronicle", "The Sofia Reyes Chronicle", etc.)
// with Vol. I · No. X edition numbering, a witness pull-quote, and service
// badges showing which Setnayan services the day used. Honesty: every sample
// renders a visible "Sample" label + a line stating real editorials begin
// December 2026.

export type RealWeddingBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] };

export type WeddingTeamCredit = { role: string; href: string };

export type RealWedding = {
  slug: string;
  /** For non-couple events (debut, graduation, etc.) this is the person's name. */
  coupleNames: string;
  /** True = curated illustrative sample (not a real client). */
  isSample: boolean;
  publishedAt: string; // ISO 'YYYY-MM-DD'
  updatedAt?: string;
  /** Human display, e.g. 'February 2026'. */
  eventDateLabel: string;
  city: string;
  /** Milestone type — 'Wedding' | 'Debut' | 'Anniversary' | 'Graduation' | 'Reunion' | … */
  eventType: string;
  ceremonyType: string; // Catholic · Civil · INC · Christian · Muslim · Cultural · Mixed
  venueSetting: string; // Garden · Beach · Banquet hall · …
  venueName: string;
  theme: string;
  palette: string[];
  guestCount: string;
  excerpt: string;
  heroQuote: string;
  /**
   * A quote from a WITNESS (best man, ninang, parent, friend) — not the
   * subject's own words. This is the "multi-perspective journalism" pull-quote
   * shown on the card's newspaper nameplate.
   */
  witnessQuote?: string;
  /** Attribution for the witness pull-quote, e.g. "Kuya Marco, Best Man". */
  witnessAttribution?: string;
  /** Setnayan services used at this event (shown as badges on the card). */
  services?: string[];
  /**
   * Edition number for the "Vol. I, No. X" nameplate. Sequential across all
   * published editorials on the platform.
   */
  editionNumber?: number;
  story: RealWeddingBlock[];
  team: WeddingTeamCredit[];
  setnayanNote: string;
  featured?: boolean;
  /**
   * Editor rank for the /realstories cascade.
   * 1 = the Cover (single hero slot); 2, 3 = "Most loved" editors' picks.
   * Undefined = not editor-picked → falls to "Just published" / "Archive".
   */
  featureRank?: number;
  heroImageUrl?: string;
  heroVideoUrl?: string;
};

export const REAL_WEDDINGS: ReadonlyArray<RealWedding> = [
  // ── Weddings ────────────────────────────────────────────────────────────────
  {
    slug: 'maria-and-juan-tagaytay-garden-wedding',
    coupleNames: 'Maria & Juan',
    isSample: true,
    publishedAt: '2026-06-13',
    eventDateLabel: 'February 2026',
    city: 'Tagaytay',
    eventType: 'Wedding',
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
    witnessQuote:
      'When Maria walked in, the whole garden went quiet. Even the birds.',
    witnessAttribution: 'Ate Celine, Maid of Honor',
    services: ['Papic', 'Panood', 'Monogram', 'Setnayan AI'],
    editionNumber: 1,
    story: [
      {
        type: 'p',
        text: 'Maria and Juan wanted a wedding that felt unmistakably theirs: a quiet Catholic ceremony, the people they love closest in, and a garden that did most of the decorating itself.',
      },
      {
        type: 'p',
        text: 'They kept the palette soft and natural — champagne, sage, and warm wood — and carried it from the invitations through the aisle to the long-table reception, so the whole day read as one unbroken idea.',
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
      'Maria and Juan ran their guest list, budget, schedule, seating, and vendor shortlist from one Setnayan workspace — and the day-of timeline kept every supplier on the same call times.',
    featured: true,
    featureRank: 1,
    heroImageUrl: '/realstories/maria-juan-tagaytay.jpg',
    heroVideoUrl: '/realstories/maria-juan-tagaytay.mp4',
  },
  {
    slug: 'jack-and-jill-cebu-beach-wedding',
    coupleNames: 'Jack & Jill',
    isSample: true,
    publishedAt: '2026-06-08',
    eventDateLabel: 'April 2026',
    city: 'Cebu',
    eventType: 'Wedding',
    ceremonyType: 'Beach',
    venueSetting: 'Shoreline',
    venueName: 'A west-facing cove on the Cebu coast',
    theme: 'Coral sunset',
    palette: ['#F4C4A8', '#D85A30', '#7A9CA8', '#FBF1E8'],
    guestCount: '80 guests',
    excerpt:
      'A barefoot beach wedding in Cebu timed to the sunset — a draped shoreline arch, a coral-and-sand palette, and vows said as the light went gold.',
    heroQuote: 'We picked the date for the tide and the time for the light. Everything else, Setnayan held.',
    witnessQuote:
      'They said their vows just as the last sun hit the water. We all just stopped.',
    witnessAttribution: 'Kuya Marco, Best Man',
    services: ['Papic', 'Panood'],
    editionNumber: 2,
    story: [
      {
        type: 'p',
        text: 'Jack and Jill wanted the sea to be the venue, not the backdrop. They found a west-facing cove, worked the timeline backward from sunset, and kept the styling barely-there so the water could lead.',
      },
      {
        type: 'p',
        text: 'Sheer drapes on a simple arch, petals on pale sand, and a coral-to-amber palette that the sky finished for them — then a long-table dinner on the sand as the lanterns came on.',
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
      'Jack and Jill ran a tide-and-sunset timeline from one Setnayan workspace, so every supplier worked the same call times backward from golden hour.',
    featureRank: 2,
    heroImageUrl: '/realstories/jack-jill-cebu.jpg',
    heroVideoUrl: '/realstories/jack-jill-cebu.mp4',
  },
  {
    slug: 'john-and-jane-manila-rooftop-wedding',
    coupleNames: 'John & Jane',
    isSample: true,
    publishedAt: '2026-06-10',
    eventDateLabel: 'March 2026',
    city: 'Manila',
    eventType: 'Wedding',
    ceremonyType: 'Civil',
    venueSetting: 'Rooftop',
    venueName: 'A rooftop terrace above the Manila skyline',
    theme: 'Midnight & gold',
    palette: ['#1E2A44', '#C8A24B', '#6B7280', '#F3EFE6'],
    guestCount: '60 guests',
    excerpt:
      'An intimate rooftop civil wedding in Manila — a blue-hour ceremony, midnight-and-gold styling, and the city as the only decor that mattered.',
    heroQuote: 'Sixty people, one skyline, no fuss. We wanted small and we got unforgettable.',
    witnessQuote:
      'Sixty people and a whole skyline. It felt like we had the entire city to ourselves.',
    witnessAttribution: 'Rica, Maid of Honor',
    services: ['Papic', 'Monogram'],
    editionNumber: 3,
    story: [
      {
        type: 'p',
        text: 'John and Jane skipped the big production for something closer: a civil ceremony at blue hour, sixty of their favourite people, and a terrace high enough to see the whole city catch the light.',
      },
      {
        type: 'p',
        text: 'Deep midnight tones warmed with brass and candlelight — long tapers, a single statement bloom per table, and gold that read as glow rather than glitter.',
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
      'John and Jane kept a tight 60-guest list, budget, and run-of-show in one Setnayan workspace — small by design, coordinated to the minute.',
    featureRank: 3,
    heroImageUrl: '/realstories/john-jane-manila.jpg',
    heroVideoUrl: '/realstories/john-jane-manila.mp4',
  },
  {
    slug: 'peter-and-mary-tagaytay-estate-wedding',
    coupleNames: 'Peter & Mary',
    isSample: true,
    publishedAt: '2026-06-14',
    eventDateLabel: 'May 2026',
    city: 'Tagaytay',
    eventType: 'Wedding',
    ceremonyType: 'Catholic',
    venueSetting: 'Estate',
    venueName: 'A ridge-top estate garden in Tagaytay',
    theme: 'Blush & ivory',
    palette: ['#EFD9D6', '#E7B7A8', '#B89B72', '#FBF6F1'],
    guestCount: '150 guests',
    excerpt:
      'A blush-and-ivory estate wedding in Tagaytay — a flower-framed garden ceremony at blue hour, lanterns down the aisle, and a grand reception under the open sky.',
    heroQuote: 'We wanted it to feel like a garden in full bloom. Setnayan kept the bloom on schedule.',
    witnessQuote:
      "Mary floated down that aisle like the florals were holding her up.",
    witnessAttribution: 'Father Romano, presiding priest',
    services: ['Papic', 'Panood', 'Monogram', 'Setnayan AI'],
    editionNumber: 4,
    story: [
      {
        type: 'p',
        text: 'Peter and Mary leaned into romance: a ridge-top estate, an aisle framed in white and blush florals, and an archway that opened straight onto the Tagaytay sky.',
      },
      {
        type: 'p',
        text: 'Abundant blooms, ivory drapes, and warm lantern light — lush but never heavy, with blush carried from the invites to the last centrepiece, then a 150-guest reception under the open sky.',
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
      'Peter and Mary managed a 150-guest list, seating, and a multi-vendor floral build from one Setnayan workspace, with every call time on a shared timeline.',
    heroImageUrl: '/realstories/peter-mary-tagaytay.jpg',
    heroVideoUrl: '/realstories/peter-mary-tagaytay.mp4',
  },
  {
    slug: 'jack-and-rose-baguio-forest-wedding',
    coupleNames: 'Jack & Rose',
    isSample: true,
    publishedAt: '2026-06-11',
    eventDateLabel: 'May 2026',
    city: 'Baguio',
    eventType: 'Wedding',
    ceremonyType: 'Christian',
    venueSetting: 'Pine forest',
    venueName: 'A pine-forest clearing in the Cordilleras',
    theme: 'Evergreen mist',
    palette: ['#2F4538', '#8FA68E', '#D8C7A1', '#F1F0EA'],
    guestCount: '100 guests',
    excerpt:
      'A misty pine-forest wedding in Baguio — an evergreen-and-white aisle between the trees, cool mountain air, and a Christian ceremony wrapped in fog.',
    heroQuote: 'The fog rolled in right on cue. We could not have planned the magic — but we planned everything else.',
    witnessQuote: 'The fog came in during the vows. It felt planned. It was not.',
    witnessAttribution: 'Diwa, wedding photographer',
    services: ['Papic', 'Setnayan AI'],
    editionNumber: 5,
    story: [
      {
        type: 'p',
        text: 'Jack and Rose wanted cool air, tall trees, and quiet. Baguio gave them all three: an aisle of evergreen and white florals laid between the pines, with mist that arrived like it was invited.',
      },
      {
        type: 'p',
        text: 'Deep greens, soft creams, and natural wood — styling that disappeared into the forest instead of fighting it — then a warm indoor reception once the mountain chill set in.',
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
      'Jack and Rose coordinated an out-of-town wedding — vendors, logistics, and a weather-aware timeline — from one Setnayan workspace.',
    heroImageUrl: '/realstories/jack-rose-baguio.jpg',
    heroVideoUrl: '/realstories/jack-rose-baguio.mp4',
  },

  // ── Debut ────────────────────────────────────────────────────────────────────
  {
    slug: 'sofia-reyes-makati-debut',
    coupleNames: 'Sofia Reyes',
    isSample: true,
    publishedAt: '2026-06-12',
    eventDateLabel: 'March 2026',
    city: 'Makati',
    eventType: 'Debut',
    ceremonyType: 'Catholic',
    venueSetting: 'Hotel ballroom',
    venueName: 'A grand ballroom in the heart of BGC',
    theme: 'Rose & gold',
    palette: ['#C8697A', '#D4A847', '#F5E6E8', '#1A1A2E'],
    guestCount: '200 guests',
    excerpt:
      "Sofia's 18th birthday was a night of chandeliers, eighteen roses, and eighteen candles — a Catholic debut in Makati that turned one family's love into a room of ceremony.",
    heroQuote: 'I wanted the people who shaped me in the same room on the same night.',
    witnessQuote:
      "I've watched her grow up. This night, I watched her arrive.",
    witnessAttribution: 'Ninong Ernesto, fourth rose',
    services: ['Monogram', 'Papic', 'Setnayan AI'],
    editionNumber: 6,
    story: [
      {
        type: 'p',
        text: 'Sofia wanted the night to feel like a homecoming — every person who shaped her early life in the same room, dressed in their best, watching her step into adulthood with the eighteen roses they each carried.',
      },
      {
        type: 'p',
        text: 'A rose-and-gold palette, a grand cotillion, and a program that moved from the formal rose ceremony through the candle lighting to a reception that went long past midnight.',
      },
    ],
    team: [
      { role: 'Venue', href: '/venues' },
      { role: 'Catering', href: '/explore' },
      { role: 'Photography & Video', href: '/explore' },
      { role: 'Coordination', href: '/explore' },
      { role: 'Florals & Styling', href: '/explore' },
      { role: 'Cotillion Choreography', href: '/explore' },
      { role: 'Hair & Makeup', href: '/explore' },
    ],
    setnayanNote:
      'Sofia and her family coordinated a 200-guest debut — cotillion call times, eighteen roses, catering breakdown, and vendor payout milestones — from a single Setnayan workspace.',
    heroImageUrl: '/realstories/sofia-reyes-makati.jpg',
  },

  // ── Anniversary ──────────────────────────────────────────────────────────────
  {
    slug: 'romy-and-beth-pasig-golden-anniversary',
    coupleNames: 'Romy & Beth Cruz',
    isSample: true,
    publishedAt: '2026-06-09',
    eventDateLabel: 'April 2026',
    city: 'Pasig',
    eventType: 'Anniversary',
    ceremonyType: 'Catholic Thanksgiving Mass',
    venueSetting: 'Banquet hall',
    venueName: 'A family-owned banquet hall in Pasig',
    theme: 'Gold & ivory',
    palette: ['#C8A24B', '#F3EFE6', '#5C3D2E', '#F9F5EC'],
    guestCount: '250 guests',
    excerpt:
      'Romy and Beth Cruz marked fifty years with the same priest who married them, their five children all present, and a ballroom full of people who watched them build a life together.',
    heroQuote: 'Fifty years later, we would do it all again — but we would plan it on Setnayan.',
    witnessQuote:
      "They never stopped holding hands in the car. That's what fifty years looks like.",
    witnessAttribution: 'Carmela, eldest daughter',
    services: ['Panood', 'Setnayan AI'],
    editionNumber: 7,
    story: [
      {
        type: 'p',
        text: 'Romy and Beth Cruz marked their golden anniversary the way they have lived: surrounded by family, anchored in faith, and unwilling to do anything small.',
      },
      {
        type: 'p',
        text: 'The same priest who married them in 1976 presided over the thanksgiving mass. Their five children renewed the family vows they made when they were born. Two hundred and fifty guests stood for the couple who built this whole gathering from nothing.',
      },
    ],
    team: [
      { role: 'Venue', href: '/venues' },
      { role: 'Catering', href: '/explore' },
      { role: 'Photography & Video', href: '/explore' },
      { role: 'Coordination', href: '/explore' },
      { role: 'Florals & Styling', href: '/explore' },
      { role: 'Host', href: '/explore' },
    ],
    setnayanNote:
      'The Cruz family coordinated a cross-generational 250-guest celebration — from the parish mass to the banquet floor — with shared call sheets on Setnayan for all five siblings.',
    heroImageUrl: '/realstories/romy-beth-pasig.jpg',
  },

  // ── Graduation ───────────────────────────────────────────────────────────────
  {
    slug: 'bea-aquino-quezon-city-graduation',
    coupleNames: 'Bea Aquino',
    isSample: true,
    publishedAt: '2026-06-07',
    eventDateLabel: 'May 2026',
    city: 'Quezon City',
    eventType: 'Graduation',
    ceremonyType: 'Garden party',
    venueSetting: 'Garden',
    venueName: 'A family garden in New Manila',
    theme: 'Sage & champagne',
    palette: ['#8FA68E', '#E9DDC7', '#4A4A4A', '#F7F4EE'],
    guestCount: '80 guests',
    excerpt:
      'Four years of medical school, finished. Bea Aquino came home to a garden party in New Manila — one long table, her batchmates, and the people who funded every all-nighter.',
    heroQuote: "Four years. One garden. Everyone I needed.",
    witnessQuote:
      'She studied while everyone else slept. We knew before she did that she would make it.',
    witnessAttribution: 'Mama Luz, first to cry',
    services: ['Papic', 'Monogram'],
    editionNumber: 8,
    story: [
      {
        type: 'p',
        text: "Bea's family skipped the formal banquet for something more like her: a garden, a long table, no assigned seating, and an afternoon that ran until the fireflies came out.",
      },
      {
        type: 'p',
        text: 'Sage and champagne — understated, natural, warm — with one long communal table that kept everyone talking, and a cake that arrived before the speech because that is who Bea is.',
      },
    ],
    team: [
      { role: 'Catering', href: '/explore' },
      { role: 'Photography', href: '/explore' },
      { role: 'Florals & Styling', href: '/explore' },
      { role: 'Hair & Makeup', href: '/explore' },
    ],
    setnayanNote:
      'Bea and her family planned the garden party — catering, florals, and a run-of-programme — in one Setnayan workspace, with a shared checklist the whole family could update.',
    heroImageUrl: '/realstories/bea-aquino-quezon.jpg',
  },

  // ── Reunion ──────────────────────────────────────────────────────────────────
  {
    slug: 'dela-cruz-family-cebu-reunion',
    coupleNames: 'Dela Cruz Family',
    isSample: true,
    publishedAt: '2026-06-06',
    eventDateLabel: 'June 2026',
    city: 'Cebu',
    eventType: 'Reunion',
    ceremonyType: 'Beach resort gathering',
    venueSetting: 'Beach resort',
    venueName: 'A private beach resort in Mactan, Cebu',
    theme: 'Sand & sea',
    palette: ['#7A9CA8', '#D4A88C', '#E8F0F5', '#3D5A6B'],
    guestCount: '62 guests',
    excerpt:
      'Sixty-two Dela Cruzes, four generations, one beach resort in Mactan — the first reunion since 2019, and the first time in five years the whole family was in the same place.',
    heroQuote: 'We did not realise how much we had missed until everyone was there.',
    witnessQuote:
      'Lola could not stop counting heads. She counted sixty-two. She counted again. Still sixty-two.',
    witnessAttribution: 'Tito Bong, family photographer',
    services: ['Papic', 'Setnayan AI'],
    editionNumber: 9,
    story: [
      {
        type: 'p',
        text: 'The Dela Cruz reunion had been planned and cancelled twice since 2019. When it finally happened — sixty-two family members, four generations, a beach resort in Mactan — everyone arrived like they were making up for lost time.',
      },
      {
        type: 'p',
        text: 'Sand, sea, and a programme that went from morning orienteering to a late-night beach bonfire, with a family video show that had Lola reaching for her handkerchief before the second slide.',
      },
    ],
    team: [
      { role: 'Venue', href: '/venues' },
      { role: 'Catering', href: '/explore' },
      { role: 'Photography & Video', href: '/explore' },
      { role: 'Programme Coordination', href: '/explore' },
    ],
    setnayanNote:
      'The Dela Cruz family coordinated arrivals, room assignments, a shared programme, and vendor payments for a four-generation beach reunion from one Setnayan workspace.',
    heroImageUrl: '/realstories/dela-cruz-cebu.jpg',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

export const REAL_WEDDINGS_LASTMOD = '2026-06-18';

export const ALL_REAL_WEDDINGS: ReadonlyArray<RealWedding> = [...REAL_WEDDINGS].sort(
  (a, b) => (a.publishedAt < b.publishedAt ? 1 : -1),
);

export function findRealWedding(slug: string): RealWedding | undefined {
  return REAL_WEDDINGS.find((w) => w.slug === slug);
}

export function relatedRealWeddings(slug: string, limit = 3): RealWedding[] {
  const current = findRealWedding(slug);
  const sorted = ALL_REAL_WEDDINGS.filter((w) => w.slug !== slug);
  if (!current) return sorted.slice(0, limit);
  // Prefer same event type, then fall back to date order.
  const sameType = sorted.filter((w) => w.eventType === current.eventType);
  const rest = sorted.filter((w) => w.eventType !== current.eventType);
  return [...sameType, ...rest].slice(0, limit);
}

/** Distinct event types present — for facet chips (only render in-use). */
export function eventTypesInUse(): string[] {
  return Array.from(new Set(ALL_REAL_WEDDINGS.map((w) => w.eventType)));
}

/** Distinct ceremony types present — kept for detail-page use. */
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
  if (w.eventType !== 'Wedding') {
    return `${w.coupleNames}: a ${w.venueSetting.toLowerCase()} ${w.eventType.toLowerCase()} in ${w.city}`;
  }
  return `${w.coupleNames}: a ${w.ceremonyType.toLowerCase()} ${w.venueSetting.toLowerCase()} wedding in ${w.city}`;
}
