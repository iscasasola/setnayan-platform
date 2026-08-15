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
    services: ['Papic', 'Live Studio', 'Monogram', 'Setnayan AI'],
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
      { type: 'h2', text: 'The morning' },
      {
        type: 'p',
        text: 'The suite smelled of coffee and hairspray by seven. Maria dressed with her mother and two sisters in a hillside casita while Juan and his groomsmen played one last round of pusoy dos on the terrace — the calm kind of morning you only get when the checklist is already done.',
      },
      { type: 'h2', text: 'The first look' },
      {
        type: 'p',
        text: 'Juan waited at the end of the garden path with his back turned. When he heard her step on the gravel and turned, the photographers caught the exact second his composure gave up. Nobody coached it; nobody needed to.',
      },
      { type: 'h2', text: 'The ceremony' },
      {
        type: 'p',
        text: 'A three-o’clock Mass under an arch of sampaguita and sage, Taal flat and silver behind the priest. The veil and cord were placed by the same ninang who introduced their parents thirty years ago — a detail nobody in the family let go unmentioned.',
      },
      { type: 'h2', text: 'Golden hour' },
      {
        type: 'p',
        text: 'At half past five the garden turned amber, and the couple slipped out for twenty minutes of portraits along the ridge. The guests didn’t mind — the bar had opened, and the acoustic trio had found their groove.',
      },
      { type: 'h2', text: 'The reception' },
      {
        type: 'p',
        text: 'One long table under the trees, string lights overhead, and a first dance to a song their guests swear was written for them. The speeches ran long in the best way — Juan’s father needed two tries to finish his.',
      },
      { type: 'h2', text: 'What the guests said' },
      {
        type: 'ul',
        items: [
          '“When Maria walked in, the whole garden went quiet. Even the birds.” — Ate Celine, Maid of Honor',
          '“The longest I have ever seen Juan sit still. He didn’t look away once.” — Marco, Best Man',
          '“I’ve been to forty weddings. This is the first one that felt like a family dinner that happened to be beautiful.” — Tito Ramon',
          '“The lechon was gone in forty minutes. That is the real review.” — Kuya Dan, cousin of the groom',
        ],
      },
      { type: 'h2', text: 'The last song' },
      {
        type: 'p',
        text: 'They closed the night the way they opened it — just the two of them on the floor, everyone else holding up their phones with the flash on, a hundred small stars over a Tagaytay garden.',
      },
    ],
    team: [
      { role: 'Venue', href: '/explore' },
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
    services: ['Papic', 'Live Studio'],
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
      { role: 'Venue', href: '/explore' },
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
      { role: 'Venue', href: '/explore' },
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
    services: ['Papic', 'Live Studio', 'Monogram', 'Setnayan AI'],
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
      { role: 'Venue', href: '/explore' },
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
      { role: 'Venue', href: '/explore' },
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
      { type: 'h2', text: 'The entrance' },
      {
        type: 'p',
        text: 'The ballroom doors opened on the first chord, and Sofia came down the staircase in a rose-gold gown her lola had quietly helped choose. Two hundred people stood without being asked to.',
      },
      { type: 'h2', text: 'Eighteen roses' },
      {
        type: 'p',
        text: 'Her father first, then grandfathers, uncles, cousins, and the family friends who taught her to bike, to swim, to drive. Each rose came with a dance and a sentence or two — some rehearsed, the best ones not.',
      },
      { type: 'h2', text: 'Eighteen candles' },
      {
        type: 'p',
        text: 'The women who raised her — mother, lola, titas, teachers, her best friend since grade two — each lit a candle and left her a wish. By the twelfth, half the ballroom had given up pretending they weren’t crying.',
      },
      { type: 'h2', text: 'The cotillion' },
      {
        type: 'p',
        text: 'Eight couples, three months of Sunday rehearsals, one waltz that broke into a track nobody in the older generation recognized and everybody under twenty knew by heart. It brought the house down.',
      },
      { type: 'h2', text: 'What the guests said' },
      {
        type: 'ul',
        items: [
          '“I’ve watched her grow up. This night, I watched her arrive.” — Ninong Ernesto, fourth rose',
          '“She danced with her father the way she used to stand on his shoes at five years old. I couldn’t breathe.” — Tita Marielle',
          '“Best cotillion I’ve seen, and I say that as someone who choreographed her mother’s.” — Teacher Fe',
          '“The dessert bar had her baby pictures on it. Genius. Devastating. Genius.” — Bea, best friend, eighteenth candle',
        ],
      },
      { type: 'h2', text: 'Past midnight' },
      {
        type: 'p',
        text: 'The formal program ended at eleven; nobody left. The last photo on the wall that night is Sofia, barefoot, crown slightly crooked, dancing with her lola to a song older than both of them put together.',
      },
    ],
    team: [
      { role: 'Venue', href: '/explore' },
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
    services: ['Live Studio', 'Setnayan AI'],
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
      { role: 'Venue', href: '/explore' },
      { role: 'Catering', href: '/explore' },
      { role: 'Photography & Video', href: '/explore' },
      { role: 'Coordination', href: '/explore' },
      { role: 'Florals & Styling', href: '/explore' },
      { role: 'Host', href: '/explore' },
    ],
    setnayanNote:
      'The Cruz family coordinated a cross-generational 250-guest celebration — from the parish mass to the banquet floor — with shared call sheets on Setnayan for all five siblings.',
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
      { role: 'Venue', href: '/explore' },
      { role: 'Catering', href: '/explore' },
      { role: 'Photography & Video', href: '/explore' },
      { role: 'Programme Coordination', href: '/explore' },
    ],
    setnayanNote:
      'The Dela Cruz family coordinated arrivals, room assignments, a shared programme, and vendor payments for a four-generation beach reunion from one Setnayan workspace.',
  },

  // ── Christening ──────────────────────────────────────────────────────────────
  {
    slug: 'noah-santos-antipolo-christening',
    coupleNames: 'Noah Santos',
    isSample: true,
    publishedAt: '2026-06-20',
    eventDateLabel: 'April 2026',
    city: 'Antipolo',
    eventType: 'Christening',
    ceremonyType: 'Catholic',
    venueSetting: 'Parish church',
    venueName: 'A hillside parish overlooking the valley',
    theme: 'White & sage',
    palette: ['#F7F5EF', '#9CAF88', '#D8CFC0', '#2E3B2F'],
    guestCount: '80 guests',
    excerpt:
      'Noah slept through his own christening, woke for the lechon, and was passed between forty pairs of arms before the rice was served — a morning in Antipolo that turned two families into one guest list.',
    heroQuote: 'We counted the ninongs twice because we kept losing track.',
    witnessQuote: 'He cried at the water and laughed at the lechon. Correct priorities.',
    witnessAttribution: 'Ninang Cecil, godmother',
    services: ['Papic', 'Setnayan AI'],
    editionNumber: 10,
    story: [
      {
        type: 'p',
        text: 'Ten in the morning, a hillside parish, and a baby in a gown his mother wore at the same age — let out at the sleeves by a tita who insisted on doing it by hand.',
      },
      { type: 'h2', text: 'The counting problem' },
      {
        type: 'p',
        text: 'Fourteen ninongs and ninangs were invited. Nineteen arrived. Nobody was turned away, and the priest, who has seen this before, simply widened the semicircle and carried on.',
      },
      { type: 'h2', text: 'The water' },
      {
        type: 'p',
        text: 'Noah objected loudly and briefly. His lolo, who had not held a baby in eleven years, took him afterward and did not give him back for the rest of the ceremony.',
      },
      { type: 'h2', text: 'Lunch at the house' },
      {
        type: 'p',
        text: 'The reception was a twenty-minute drive down the hill: long tables in a garage, lechon at one end, pancit at the other, and a plastic tub of San Miguel that nobody admitted to refilling.',
      },
      { type: 'h2', text: 'What the guests said' },
      {
        type: 'ul',
        items: [
          '“He cried at the water and laughed at the lechon. Correct priorities.” — Ninang Cecil',
          '“I have not seen my cousins in four years. We are booking the next one already.” — Tito Ramil',
          '“The gown is older than three of the ninongs.” — Lola Pacing',
          '“I got sent forty photos before I even got home.” — Ate Jhoy',
        ],
      },
      { type: 'h2', text: 'What stayed' },
      {
        type: 'p',
        text: 'The last picture of the day is not the ceremony. It is Noah asleep on a folded tablecloth in the middle of the long table, ringed by paper plates, while the karaoke started up behind him.',
      },
    ],
    team: [
      { role: 'Church coordination', href: '/explore' },
      { role: 'Catering', href: '/explore' },
      { role: 'Photography', href: '/explore' },
      { role: 'Cake & desserts', href: '/explore' },
    ],
    setnayanNote:
      'Noah’s parents ran the guest list, the ninong-and-ninang roster, and the lunch headcount from one Setnayan page — and every relative who came home with a phone full of photos had already been sent theirs.',
  },

  // ── Birthday ─────────────────────────────────────────────────────────────────
  {
    slug: 'lolo-tony-laguna-80th-birthday',
    coupleNames: 'Lolo Tony',
    isSample: true,
    publishedAt: '2026-06-24',
    eventDateLabel: 'May 2026',
    city: 'Laguna',
    eventType: 'Birthday',
    ceremonyType: 'Family celebration',
    venueSetting: 'Backyard',
    venueName: 'The family house he built in 1979',
    theme: 'Barong & banig',
    palette: ['#C9A227', '#7A5230', '#EFE3C8', '#2B2B2B'],
    guestCount: '120 guests',
    excerpt:
      'Eighty years, four generations, one backyard, and a karaoke machine that was never once switched off — Lolo Tony’s birthday in Laguna, held in the house he built himself.',
    heroQuote: 'I built this house for a family I did not have yet. Look at it now.',
    witnessQuote: 'He sang first. He always sings first. That is the whole point of him.',
    witnessAttribution: 'Tita Belen, eldest daughter',
    services: ['Papic', 'Live Studio'],
    editionNumber: 11,
    story: [
      {
        type: 'p',
        text: 'Lolo Tony asked for no program. He got one anyway, written by nine grandchildren on the back of a calendar page, and he pretended to be annoyed about it for exactly four minutes.',
      },
      { type: 'h2', text: 'The house' },
      {
        type: 'p',
        text: 'He laid the first blocks in 1979 with money from three years abroad. Every child, grandchild and great-grandchild present that day had slept under that roof at least once.',
      },
      { type: 'h2', text: 'The ones who could not come' },
      {
        type: 'p',
        text: 'Two of his children work overseas. A laptop on a monobloc chair at the head table carried them through the whole afternoon — including, at one point, a duet across nine time zones that nobody in the yard was ready for.',
      },
      { type: 'h2', text: 'Four generations' },
      {
        type: 'p',
        text: 'The photo everyone wanted took eleven minutes to arrange: Lolo Tony seated, his four children standing, eleven grandchildren kneeling, and three great-grandchildren refusing, on principle, to face the camera.',
      },
      { type: 'h2', text: 'What the guests said' },
      {
        type: 'ul',
        items: [
          '“He sang first. He always sings first. That is the whole point of him.” — Tita Belen',
          '“My father taught me to drive in this yard. I hit that post.” — Tito Danny',
          '“Eighty and he still carried the ice himself.” — Kuya Jun, neighbour',
          '“I watched from Dubai and cried into my keyboard.” — Ate Mimi, second daughter',
        ],
      },
      { type: 'h2', text: 'The last song' },
      {
        type: 'p',
        text: 'Half past nine, most of the plastic chairs stacked, and the man himself doing an unhurried Matud Nila to a yard of people who had all heard him sing it before and wanted to hear it again.',
      },
    ],
    team: [
      { role: 'Catering', href: '/explore' },
      { role: 'Lechon', href: '/explore' },
      { role: 'Sound & lights', href: '/explore' },
      { role: 'Photography', href: '/explore' },
    ],
    setnayanNote:
      'The grandchildren ran the whole day from one Setnayan page — the program, the food count, and a live link so the two children working abroad were at the table, not just on the phone.',
  },

  // ── Gender Reveal ────────────────────────────────────────────────────────────
  {
    slug: 'the-lims-quezon-city-gender-reveal',
    coupleNames: 'The Lim Family',
    isSample: true,
    publishedAt: '2026-06-27',
    eventDateLabel: 'May 2026',
    city: 'Quezon City',
    eventType: 'Gender Reveal',
    ceremonyType: 'Family celebration',
    venueSetting: 'Rooftop deck',
    venueName: 'A neighbour’s rooftop, borrowed for an afternoon',
    theme: 'Confetti & citrus',
    palette: ['#F2B5A0', '#8FBFD6', '#FBF3E4', '#33404A'],
    guestCount: '45 guests',
    excerpt:
      'Two families, one sealed envelope carried by a lola who did not peek, and forty-five people on a borrowed Quezon City rooftop finding out at the same second.',
    heroQuote: 'Only my mother knew. For nine days. She has never been prouder.',
    witnessQuote: 'I held that envelope for nine days and I did not look. Not once. Ask anyone.',
    witnessAttribution: 'Lola Remy, keeper of the envelope',
    services: ['Papic', 'Patiktok'],
    editionNumber: 12,
    story: [
      {
        type: 'p',
        text: 'The clinic sealed the result in an envelope. The envelope went to Lola Remy, who guarded it for nine days and told every single person that she was guarding it.',
      },
      { type: 'h2', text: 'The rooftop' },
      {
        type: 'p',
        text: 'A neighbour offered her roof deck for the afternoon on the condition that she be invited. She was invited. She brought bibingka.',
      },
      { type: 'h2', text: 'The moment' },
      {
        type: 'p',
        text: 'Both grandmothers pulled the cord together, because neither would agree to let the other do it alone. Blue, everywhere, and a five-year-old cousin who screamed before the smoke had cleared because she had wanted a girl.',
      },
      { type: 'h2', text: 'What the guests said' },
      {
        type: 'ul',
        items: [
          '“I held that envelope for nine days and I did not look. Not once. Ask anyone.” — Lola Remy',
          '“We have a name picked for a boy. We have had it since 2019.” — Marco, father',
          '“I wanted a girl. I am okay now. Mostly.” — Cousin Adie, age five',
          '“Best rooftop I have lent anyone.” — Mrs. Villanueva, neighbour',
        ],
      },
      { type: 'h2', text: 'Afterwards' },
      {
        type: 'p',
        text: 'The blue smoke hung over the street for a good minute. Two floors down, somebody who had no idea what was happening leaned out and shouted congratulations anyway.',
      },
    ],
    team: [
      { role: 'Styling & balloons', href: '/explore' },
      { role: 'Catering', href: '/explore' },
      { role: 'Photography', href: '/explore' },
    ],
    setnayanNote:
      'Everyone on that roof had their own photos before they got down the stairs — and the short clip of the two lolas pulling together was cut on a phone that evening.',
  },

  // ── Celebration ──────────────────────────────────────────────────────────────
  {
    slug: 'aling-nena-marikina-tenth-year',
    coupleNames: 'Aling Nena’s Store',
    isSample: true,
    publishedAt: '2026-07-01',
    eventDateLabel: 'June 2026',
    city: 'Marikina',
    eventType: 'Celebration',
    ceremonyType: 'Community celebration',
    venueSetting: 'Street corner',
    venueName: 'The corner she has swept every morning for ten years',
    theme: 'Sari-sari bright',
    palette: ['#E4572E', '#F2C14E', '#F6F1E5', '#2F2F2F'],
    guestCount: '60 neighbours',
    excerpt:
      'Ten years of utang na loob written in a notebook, one street closed for an afternoon, and a whole barangay turning up to thank a woman who never once asked them to.',
    heroQuote: 'Ten years. I know what every child on this street likes to buy.',
    witnessQuote: 'She fed this street through the pandemic on credit and never chased one peso.',
    witnessAttribution: 'Kap Boy, barangay councillor',
    services: ['Papic'],
    editionNumber: 13,
    story: [
      {
        type: 'p',
        text: 'It began as a small thank-you and turned into a street party, because word travels quickly on a road where everyone owes the same person a small kindness.',
      },
      { type: 'h2', text: 'The notebook' },
      {
        type: 'p',
        text: 'Ten years of lista, kept in spiral notebooks stacked under the counter. Aling Nena refused to display them. Someone displayed them anyway, closed, as a stack — the point being their height, not their contents.',
      },
      { type: 'h2', text: 'The street' },
      {
        type: 'p',
        text: 'The barangay lent two tables and a tarpaulin. A tricycle driver lent his speaker. The neighbour with the good grill did what the neighbour with the good grill always does.',
      },
      { type: 'h2', text: 'What the neighbours said' },
      {
        type: 'ul',
        items: [
          '“She fed this street through the pandemic on credit and never chased one peso.” — Kap Boy',
          '“My first job was counting her bottles. I am an accountant now.” — Marvin, age 26',
          '“She knows my order before I open my mouth.” — Ate Susan',
          '“Ten years and the store has never once been closed on a Sunday.” — Mang Ely',
        ],
      },
      { type: 'h2', text: 'What she said' },
      {
        type: 'p',
        text: 'Asked to give a speech, she gave four sentences, thanked her late husband, and went back behind the counter because two children were waiting to buy ice candy.',
      },
    ],
    team: [
      { role: 'Catering', href: '/explore' },
      { role: 'Sound & lights', href: '/explore' },
      { role: 'Photography', href: '/explore' },
    ],
    setnayanNote:
      'A neighbour set the whole thing up on Setnayan in an evening — who was bringing what, and one link so every family on the street could pull their own photos afterwards.',
  },

  // ── Travel ───────────────────────────────────────────────────────────────────
  {
    slug: 'the-ramos-family-el-nido-trip',
    coupleNames: 'The Ramos Family',
    isSample: true,
    publishedAt: '2026-07-05',
    eventDateLabel: 'June 2026',
    city: 'El Nido',
    eventType: 'Travel',
    ceremonyType: 'Family trip',
    venueSetting: 'Island',
    venueName: 'Four islands, one bangka, five days',
    theme: 'Salt & sun',
    palette: ['#2E8B8B', '#F4E4C1', '#E8A87C', '#1F3A44'],
    guestCount: '9 travellers',
    excerpt:
      'Three siblings, their children, and one grandmother who had never seen Palawan — five days in El Nido that took two years and one shared spreadsheet to arrange.',
    heroQuote: 'Mama said she would only come if we all came. So we all came.',
    witnessQuote: 'Seventy-three years old and she went in the water first.',
    witnessAttribution: 'Tito Erwin, middle child',
    services: ['Papic', 'Patiktok'],
    editionNumber: 14,
    story: [
      {
        type: 'p',
        text: 'The trip was proposed in a group chat in 2024 and nearly died there four times. What saved it was a single date everyone agreed to before anyone booked anything.',
      },
      { type: 'h2', text: 'The condition' },
      {
        type: 'p',
        text: 'Lola Rosing, who had never been further south than Batangas, said she would come only if all three of her children came. Two of them had not taken leave in the same month since 2019.',
      },
      { type: 'h2', text: 'Day three' },
      {
        type: 'p',
        text: 'The lagoon, early, before the other boats. Nine people, one bangka, and a seventy-three-year-old woman who got into the water before any of her grandchildren had finished putting on their vests.',
      },
      { type: 'h2', text: 'What they said' },
      {
        type: 'ul',
        items: [
          '“Seventy-three years old and she went in the water first.” — Tito Erwin',
          '“I have four hundred photos and I am in eleven of them. Worth it.” — Ate Cha, the family photographer',
          '“We are doing this every two years now. It is decided.” — Tita Let',
          '“I did not know the sea could be that colour.” — Lola Rosing',
        ],
      },
      { type: 'h2', text: 'The last night' },
      {
        type: 'p',
        text: 'Grilled fish on a plastic table, nine people sunburnt in nine different patterns, and a plan for 2028 that three of them are already treating as binding.',
      },
    ],
    team: [
      { role: 'Island tours', href: '/explore' },
      { role: 'Accommodation', href: '/explore' },
      { role: 'Transfers', href: '/explore' },
    ],
    setnayanNote:
      'Flights, boat days and who was sharing which room lived on one Setnayan page — and the four hundred photos landed in one place instead of five phones and a dead group chat.',
  },

  // ── Corporate ────────────────────────────────────────────────────────────────
  {
    slug: 'bayanihan-tech-makati-year-end',
    coupleNames: 'Bayanihan Tech',
    isSample: true,
    publishedAt: '2026-07-09',
    eventDateLabel: 'December 2025',
    city: 'Makati',
    eventType: 'Corporate',
    ceremonyType: 'Company event',
    venueSetting: 'Function hall',
    venueName: 'A function hall two floors above the office',
    theme: 'Barong casual',
    palette: ['#1F4E5F', '#C89B3C', '#F0EDE6', '#22262A'],
    guestCount: '180 employees',
    excerpt:
      'A year-end party for a company that had been fully remote for three years — where forty people met colleagues face to face for the first time and the awards ran ninety minutes long.',
    heroQuote: 'Half this room had never been in the same room.',
    witnessQuote: 'I have managed her for two years. I met her at 6:40 this evening.',
    witnessAttribution: 'Paolo, engineering lead',
    services: ['Papic', 'Live Studio', 'Monogram'],
    editionNumber: 15,
    story: [
      {
        type: 'p',
        text: 'Bayanihan Tech hired remotely for three years and, by the end of it, had a headcount of 180 people, forty of whom had never physically met a single colleague.',
      },
      { type: 'h2', text: 'The name tags' },
      {
        type: 'p',
        text: 'Somebody had the sense to print the handles people actually use at work under the legal names. It cut the awkwardness of the first hour roughly in half.',
      },
      { type: 'h2', text: 'The ones who could not fly in' },
      {
        type: 'p',
        text: 'Twenty-two staff across Visayas and Mindanao joined on a stream that ran the whole evening, including the awards, including the part where the CEO forgot a name and was helped by the chat.',
      },
      { type: 'h2', text: 'The awards' },
      {
        type: 'p',
        text: 'Budgeted at forty minutes. Ran ninety. Nobody complained, because the categories had been written by the teams themselves and several of them were extremely personal.',
      },
      { type: 'h2', text: 'What people said' },
      {
        type: 'ul',
        items: [
          '“I have managed her for two years. I met her at 6:40 this evening.” — Paolo, engineering lead',
          '“He is much taller than his video call.” — Rhea, support',
          '“I flew from Davao and I would do it again.” — Kenneth, QA',
          '“The chat carried the CEO. That is culture.” — Anon, submitted award nomination',
        ],
      },
      { type: 'h2', text: 'After' },
      {
        type: 'p',
        text: 'The formal night ended at ten. A group of about thirty relocated downstairs and stayed until the security guard began, politely, to hover.',
      },
    ],
    team: [
      { role: 'Venue', href: '/explore' },
      { role: 'Catering', href: '/explore' },
      { role: 'Sound & lights', href: '/explore' },
      { role: 'Photo & video', href: '/explore' },
      { role: 'Hosting', href: '/explore' },
    ],
    setnayanNote:
      'RSVPs, dietary needs, the awards run-sheet and the stream for the twenty-two who could not fly in were all run from one Setnayan page by an admin team of two.',
  },

  // ── Tournament ───────────────────────────────────────────────────────────────
  {
    slug: 'barangay-liga-cebu-finals',
    coupleNames: 'Barangay Liga Finals',
    isSample: true,
    publishedAt: '2026-07-13',
    eventDateLabel: 'April 2026',
    city: 'Cebu',
    eventType: 'Tournament',
    ceremonyType: 'Community league',
    venueSetting: 'Covered court',
    venueName: 'The covered court, packed to the rafters',
    theme: 'Jersey & chalk',
    palette: ['#C0392B', '#2C3E50', '#F4F1EA', '#1B1B1B'],
    guestCount: '400 spectators',
    excerpt:
      'Six weeks, eight teams, one covered court, and a final decided by a free throw taken by a nineteen-year-old whose entire street had stopped breathing.',
    heroQuote: 'The whole barangay was in that court. I could hear my mother.',
    witnessQuote: 'I have called games here for eleven years. That was the loudest it has ever been.',
    witnessAttribution: 'Kuya Dodong, courtside announcer',
    services: ['Live Studio', 'Papic'],
    editionNumber: 16,
    story: [
      {
        type: 'p',
        text: 'The liga runs every summer. This year eight teams entered, six weeks of Sunday games, and a final that went to a single free throw with four seconds left.',
      },
      { type: 'h2', text: 'The bracket' },
      {
        type: 'p',
        text: 'Kept on a whiteboard by the sari-sari store, photographed daily and posted, because half the barangay works shifts and could not come to read it in person.',
      },
      { type: 'h2', text: 'The final' },
      {
        type: 'p',
        text: 'Four seconds, one point down, and a nineteen-year-old at the line who had missed the same shot in last year’s semi-final and had been reminded of it, kindly and unkindly, for twelve months.',
      },
      { type: 'h2', text: 'He made it' },
      {
        type: 'p',
        text: 'Both of them. The court emptied onto the floor before the second ball came down, which the referee allowed because there was nothing else he could reasonably have done.',
      },
      { type: 'h2', text: 'What they said' },
      {
        type: 'ul',
        items: [
          '“I have called games here for eleven years. That was the loudest it has ever been.” — Kuya Dodong',
          '“I watched from Qatar on my break. I shouted in a break room alone.” — Tatay Rene, father of the player',
          '“We are buying him his own ball.” — Team captain',
          '“Next year we enter ten teams.” — Kap Junjun',
        ],
      },
      { type: 'h2', text: 'The trophy' },
      {
        type: 'p',
        text: 'It is not big. It sits in the barangay hall, and the name of every winning team since 2011 is engraved on a plate underneath it, some of them by hand.',
      },
    ],
    team: [
      { role: 'Sound & lights', href: '/explore' },
      { role: 'Photo & video', href: '/explore' },
      { role: 'Catering', href: '/explore' },
    ],
    setnayanNote:
      'The bracket, the game schedule and the stream for the families working abroad all ran from one Setnayan page — and every player got their own photos without asking anyone.',
  },

  // ── Gala Night ───────────────────────────────────────────────────────────────
  {
    slug: 'tahanan-foundation-pasig-gala',
    coupleNames: 'Tahanan Foundation',
    isSample: true,
    publishedAt: '2026-07-17',
    eventDateLabel: 'February 2026',
    city: 'Pasig',
    eventType: 'Gala Night',
    ceremonyType: 'Charity gala',
    venueSetting: 'Hotel ballroom',
    venueName: 'A ballroom lent at cost by a board member',
    theme: 'Black tie, Filipino',
    palette: ['#12213A', '#C9A227', '#F3EFE7', '#0B0B0B'],
    guestCount: '260 guests',
    excerpt:
      'A scholarship fund’s annual gala where the loudest applause of the night went not to a donor but to a scholar who stood up and read four paragraphs she had written that morning.',
    heroQuote: 'We do not auction the students. We let them speak.',
    witnessQuote: 'I have been to thirty of these. I have never seen a room go that quiet.',
    witnessAttribution: 'Mrs. Alvarez, donor since 2014',
    services: ['Live Studio', 'Papic', 'Monogram'],
    editionNumber: 17,
    story: [
      {
        type: 'p',
        text: 'Tahanan has put 400 students through college since 2009. The gala is how it raises the following year’s intake, and it is the one night the scholars and the donors are in the same room.',
      },
      { type: 'h2', text: 'The rule' },
      {
        type: 'p',
        text: 'No scholar is ever named on stage without agreeing to it first, and no photograph of a scholar goes out without their say-so. It is written into the programme and it is enforced.',
      },
      { type: 'h2', text: 'The speech' },
      {
        type: 'p',
        text: 'Four paragraphs, handwritten that morning, read by a second-year engineering student who had not told her family she was speaking. Two of them found out watching the stream at home.',
      },
      { type: 'h2', text: 'The board' },
      {
        type: 'p',
        text: 'The ballroom was lent at cost. The wine was donated. The printing was donated. The foundation is loud about this, because every peso that does not go to overheads is roughly one week of somebody’s tuition.',
      },
      { type: 'h2', text: 'What was said' },
      {
        type: 'ul',
        items: [
          '“I have been to thirty of these. I have never seen a room go that quiet.” — Mrs. Alvarez',
          '“I did not tell my mother. She watched at home and called me eleven times.” — Angela, second year',
          '“We raised next year in ninety minutes.” — Foundation treasurer',
          '“The students run the programme now. That is the whole plan working.” — Board chair',
        ],
      },
      { type: 'h2', text: 'The total' },
      {
        type: 'p',
        text: 'Announced at the end, to the peso, on a screen — which is the foundation’s habit and the reason a lot of people in that room keep coming back.',
      },
    ],
    team: [
      { role: 'Venue', href: '/explore' },
      { role: 'Catering', href: '/explore' },
      { role: 'Photo & video', href: '/explore' },
      { role: 'Hosting', href: '/explore' },
      { role: 'Florals & styling', href: '/explore' },
    ],
    setnayanNote:
      'Seating, donor tables, the run-sheet and the consent record for every scholar photographed that night were held in one Setnayan page — and the stream reached the families who could not travel.',
  },

  // ── Simple Event ─────────────────────────────────────────────────────────────
  {
    slug: 'ramos-house-blessing-cavite',
    coupleNames: 'The Ramos Household',
    isSample: true,
    publishedAt: '2026-07-21',
    eventDateLabel: 'June 2026',
    city: 'Cavite',
    eventType: 'Simple Event',
    ceremonyType: 'House blessing',
    venueSetting: 'New home',
    venueName: 'A two-bedroom house, eleven years saved for',
    theme: 'Bare walls, full table',
    palette: ['#D9C4A9', '#7C8C77', '#F6F2EA', '#33302C'],
    guestCount: '30 guests',
    excerpt:
      'Eleven years of saving, one priest, a bowl of holy water carried room to room, and thirty people eating off a table that was the only furniture in the house.',
    heroQuote: 'We have no sofa yet. We have a house.',
    witnessQuote: 'They fed thirty people in a house with one table and no curtains. That is a home already.',
    witnessAttribution: 'Tita Baby, aunt',
    services: ['Papic'],
    editionNumber: 18,
    story: [
      {
        type: 'p',
        text: 'The keys came in April. The blessing waited until June, because the whole point was to do it with everybody there, and everybody has shifts.',
      },
      { type: 'h2', text: 'Room to room' },
      {
        type: 'p',
        text: 'The priest went through every room including the bathroom and the small back area that is, for now, a bedroom and a storage room at the same time.',
      },
      { type: 'h2', text: 'The table' },
      {
        type: 'p',
        text: 'One table, borrowed chairs, and food that arrived in the hands of almost everyone who came, because that is how it works and nobody needed to be asked.',
      },
      { type: 'h2', text: 'What they said' },
      {
        type: 'ul',
        items: [
          '“They fed thirty people in a house with one table and no curtains. That is a home already.” — Tita Baby',
          '“Eleven years. I remember when they started saving.” — Nanay Cora',
          '“I claimed the back room. They said no.” — Cousin Jek',
          '“Next year, a sofa.” — Rina Ramos',
        ],
      },
    ],
    team: [{ role: 'Catering', href: '/explore' }],
    setnayanNote:
      'A small day, run the same way as a big one — who was coming, who was bringing what, and one link so everybody went home with the photos of a house that had been eleven years coming.',
  },

  // ── Date ─────────────────────────────────────────────────────────────────────
  {
    slug: 'nica-and-paul-intramuros-date',
    coupleNames: 'Nica & Paul',
    isSample: true,
    publishedAt: '2026-07-25',
    eventDateLabel: 'July 2026',
    city: 'Manila',
    eventType: 'Date',
    ceremonyType: 'Just the two of them',
    venueSetting: 'Old city',
    venueName: 'Intramuros, on foot, on a Wednesday',
    theme: 'Walking shoes',
    palette: ['#8C6A4A', '#B9A38C', '#F4EFE6', '#2A2622'],
    guestCount: '2',
    excerpt:
      'A Wednesday off, no plan past the first stop, and two people who have been together nine years walking the old city until their feet gave out.',
    heroQuote: 'Nine years and we still cannot pick a restaurant.',
    services: ['Papic'],
    editionNumber: 19,
    story: [
      {
        type: 'p',
        text: 'They both had the Wednesday off for the first time in seven months. The plan was Intramuros and nothing after that, deliberately.',
      },
      { type: 'h2', text: 'The walk' },
      {
        type: 'p',
        text: 'San Agustin first, then the walls, then a long detour caused entirely by an argument about which gate they had come in through.',
      },
      { type: 'h2', text: 'The photo' },
      {
        type: 'p',
        text: 'A stranger offered. It is slightly crooked and both of them are laughing at something off-frame that neither can now remember. It is the one they printed.',
      },
    ],
    team: [],
    setnayanNote:
      'Not every day needs a guest list. This one is here because a day worth keeping is a day worth keeping — two people, one link, and the crooked photo that outlasted the plan.',
  },

  // ── Hangout ──────────────────────────────────────────────────────────────────
  {
    slug: 'barkada-movie-night-quezon-city',
    coupleNames: 'The Thursday Barkada',
    isSample: true,
    publishedAt: '2026-07-29',
    eventDateLabel: 'July 2026',
    city: 'Quezon City',
    eventType: 'Hangout',
    ceremonyType: 'Monthly, non-negotiable',
    venueSetting: 'Living room',
    venueName: 'Whoever’s living room it is that month',
    theme: 'Projector & floor cushions',
    palette: ['#4A5568', '#E2B04A', '#F5F2EC', '#1E1E22'],
    guestCount: '7 friends',
    excerpt:
      'Seven friends, one projector, a rotating living room, and a rule agreed in 2019 that has survived three moves, two breakups and one migration.',
    heroQuote: 'We have missed weddings. We have not missed a Thursday.',
    witnessQuote: 'It is the only thing in my calendar I have never moved.',
    witnessAttribution: 'Denise, founding member',
    services: ['Papic'],
    editionNumber: 20,
    story: [
      {
        type: 'p',
        text: 'It started in 2019 as a way to finish a series. It is now a standing monthly appointment that has outlasted two of the original jobs and one of the original apartments.',
      },
      { type: 'h2', text: 'The rules' },
      {
        type: 'p',
        text: 'Host picks the film. Everyone else brings something. Nobody checks their phone during. The third rule is the one that gets broken.',
      },
      { type: 'h2', text: 'The one abroad' },
      {
        type: 'p',
        text: 'One of them moved to Singapore in 2023 and still joins on a laptop propped against the snacks, on a delay of about two seconds, which everyone has stopped noticing.',
      },
      { type: 'h2', text: 'What they said' },
      {
        type: 'ul',
        items: [
          '“It is the only thing in my calendar I have never moved.” — Denise',
          '“I have watched forty films on a two-second delay and I regret nothing.” — Migs, from Singapore',
          '“The rule about phones is aspirational.” — Kim',
          '“We are on our seventh living room.” — Chris',
        ],
      },
    ],
    team: [],
    setnayanNote:
      'Small, repeating and easy to lose track of — which is exactly why it is on Setnayan: whose turn it is, who is coming, and every photo from seven years of Thursdays in one place.',
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
