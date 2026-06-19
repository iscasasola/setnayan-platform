/**
 * add-ons-detail.ts — App Store-style detail content for every couple-side
 * in-app service.
 *
 * The Studio hub (/dashboard/[eventId]/add-ons) lists each feature as an App
 * Store row; tapping a row opens its detail page (./[addon]/about) which is the
 * iOS App Store-style info surface — hero, preview rail, About, What's
 * included, Plans (priced live from the admin catalog), and an honest privacy
 * block. This module is the single source of that copy.
 *
 * SEPARATION OF CONCERNS:
 *   • add-ons-catalog.ts  → structure (which section, status, serviceKey, icon)
 *   • add-ons-detail.ts   → narrative content for the App Store detail page
 *
 * HONESTY RULES (owner: "UX is the north star", public-surface hygiene):
 *   • No invented prices — pricing renders live from platform_retail_catalog_v2
 *     by the entry's serviceKey. Nothing here is a price source.
 *   • No fabricated social proof — review/usage stats come from add-on-stats;
 *     the `specs` here are factual feature specs only (durations, formats,
 *     caps), never made-up ratings or counts.
 *   • Preview frames describe what the couple will see, not faked screenshots.
 *
 * Panood is intentionally ABSENT: it ships its own bespoke App Store detail at
 * /add-ons/panood (the 2026-05-17 pilot). The hub links Panood straight there.
 */

export type DetailPreview = {
  /** Small eyebrow over the frame — "Mobile", "Your page", "Print". */
  context?: string;
  /** A large glyph centered in the frame (decorative, aria-hidden). */
  glyph: string;
  /** One-line caption under the frame. */
  caption: string;
  /** Tiny secondary line inside the frame, under the glyph. */
  sub?: string;
  /** Frame shape — defaults to 16/10. */
  aspect?: '16/10' | '9/16' | '1/1';
};

export type DetailSpec = {
  eyebrow: string;
  value: string;
  caption: string;
};

export type DetailPrivacy = {
  category: string;
  items: string[];
  purpose?: string;
};

export type AddOnDetail = {
  /** Mono eyebrow over the hero title — "Papic · candid capture". */
  eyebrow: string;
  /** Benefit-led hero title (not the bare feature name). */
  heroTitle: string;
  /** One–two line promise under the title. */
  tagline: string;
  /** About-this-feature paragraphs. */
  paragraphs: string[];
  /** "What's included" benefit bullets. */
  highlights: string[];
  /** Preview rail frames. */
  preview: DetailPreview[];
  /** Factual feature-spec stat tiles (NOT social proof). */
  specs?: DetailSpec[];
  /** Honest event-privacy block. */
  privacy?: DetailPrivacy[];
  /** What this feature does / doesn't link to the couple's event. */
  dataLinked?: { linked: string[]; notLinked: string[] };
  /** Honest "not included" guardrails. */
  notIncluded?: string[];
};

export const ADD_ON_DETAILS: Record<string, AddOnDetail> = {
  'setnayan-ai': {
    eyebrow: 'Setnayan AI · assisted planning',
    heroTitle: 'A shortlist made for your wedding',
    tagline:
      'Vendors ranked by your date, budget, location, guest count, and faith — not an endless directory you have to dig through.',
    paragraphs: [
      'Setnayan AI reads the details you already gave us — your date, your budget, where you are getting married, how many guests, and your ceremony — and ranks every vendor against them. You see the ones that genuinely fit at the top, with a plain-English reason for each match.',
      'It is a matching layer, not a chatbot. Decisions are explainable: change your budget or guest count and the shortlist re-ranks instantly. You never land on an empty page — if nothing fits perfectly, it shows the closest options and tells you what is stretching the fit.',
    ],
    highlights: [
      'Ranked matches across six signals: date, budget, location, guest count, faith, and style',
      'A clear "why this fits" line on every match — no black-box scoring',
      'Re-ranks live as you adjust budget, guests, or date',
      'Respects hard limits — never recommends a vendor who is booked on your date',
      'Always shows the closest options, even when nothing is a perfect fit',
    ],
    preview: [
      { context: 'Shortlist', glyph: '☑', caption: 'Your ranked matches, best-fit first, with a reason on each card.', sub: 'Tap to compare side by side' },
      { context: 'Why it fits', glyph: '◎', caption: 'Plain-English fit reasons — budget, date, location, guests.' },
      { context: 'Refine', glyph: '⚙', caption: 'Nudge budget or guest count and watch the list re-rank.' },
    ],
    specs: [
      { eyebrow: 'Signals', value: '6', caption: 'date · budget · location · guests · faith · style' },
      { eyebrow: 'Results', value: 'Never empty', caption: 'always shows closest fits' },
    ],
    privacy: [
      {
        category: 'Planning inputs',
        items: ['Event date', 'Budget range', 'Venue location', 'Guest count', 'Ceremony / faith'],
        purpose: 'Used only to rank vendors for you — never sold or shared.',
      },
    ],
    dataLinked: {
      linked: ['Your planning inputs — used to score matches for this event'],
      notLinked: ['Aggregate match patterns (no event linkage)', 'Vendor-side data — vendors never see your budget'],
    },
  },

  playlist: {
    eyebrow: 'Playlist · your music plan',
    heroTitle: 'The right song for every moment',
    tagline:
      'Pick songs by slot — processional, first dance, dinner, open floor — and a do-not-play list. It syncs to your DJ or band the moment you book them.',
    paragraphs: [
      'Your wedding has a soundtrack, slot by slot. Build the processional, the first dance, the dinner set, the open floor, and the songs you never want to hear. Everything lives in one place instead of scattered across chats and notes.',
      'When you book a DJ or band through Setnayan, your playlist syncs to them automatically — no re-sending, no misheard titles. Until then it is yours to shape and re-order as the day takes shape.',
    ],
    highlights: [
      'Organize by moment: processional, first dance, dinner, open floor, send-off',
      'A do-not-play list your DJ actually sees',
      'Syncs to your booked DJ or band automatically',
      'Re-order any slot as your timeline firms up',
      'Free — part of planning, no purchase',
    ],
    preview: [
      { context: 'By moment', glyph: '♫', caption: 'Each part of the day gets its own song list.' },
      { context: 'Do-not-play', glyph: '⃠', caption: 'The songs you never want to hear, flagged clearly.' },
      { context: 'Sync', glyph: '⇄', caption: 'Hands the whole plan to your DJ or band on booking.' },
    ],
    specs: [{ eyebrow: 'Price', value: 'Free', caption: 'part of planning' }],
  },

  'save-the-date': {
    eyebrow: 'Save the Date · the opening',
    heroTitle: 'The reveal that opens your invitation',
    tagline:
      'A veil or envelope that lifts to reveal your invitation — auto-plays fullscreen, recolours to your Mood Board, and ends on add-to-calendar.',
    paragraphs: [
      'Your Save the Date is the first thing guests experience. A cinematic opening — a sheer veil, four-flap, side-flap, top-flap, or church doors — lifts to reveal a self-playing content film of your day, recoloured to your palette. When it ends, guests add your wedding to their calendar in one tap.',
      'The content film is free and ships with every event. The cinematic openings are a premium unlock — one purchase covers your event and every guest who opens the link.',
    ],
    highlights: [
      'A self-playing, scrubbable content film — free with every event',
      'Five cinematic reveal openings (premium): veil, four-flap, side-flap, top-flap, church doors',
      'Recolours automatically to your Mood Board palette',
      'Ends on add-to-calendar for the wedding and the invitation launch',
      'Plays fullscreen on any phone — nothing to install',
    ],
    preview: [
      { context: 'Reveal', glyph: '✦', caption: 'The opening lifts to reveal your invitation.', sub: 'Veil · flaps · church doors', aspect: '9/16' },
      { context: 'Content film', glyph: '▷', caption: 'A self-playing film of your day, in your palette.', aspect: '9/16' },
      { context: 'Calendar', glyph: '📅', caption: 'Ends on one-tap add-to-calendar.' },
    ],
    specs: [
      { eyebrow: 'Content film', value: 'Free', caption: 'with every event' },
      { eyebrow: 'Openings', value: '5', caption: 'premium cinematic reveals' },
    ],
    notIncluded: [
      'The cinematic openings are a premium unlock — the content film itself is always free.',
    ],
  },

  'landing-page': {
    eyebrow: 'Landing Page · your public page',
    heroTitle: 'The page guests land on',
    tagline:
      'Customize the public page guests see when they scan your QR or open your link — your names, your story, your palette.',
    paragraphs: [
      'Every event gets a public landing page — the destination behind your QR codes and shared links. Set your names, your story, the cover, and the details guests need, all recoloured to your Mood Board.',
      'It is the home your other Setnayan pieces plug into: Save the Date, RSVP, the live broadcast, and your gallery all surface here over the life of the event.',
    ],
    highlights: [
      'Your names, story, and cover — guest-facing',
      'Recolours to your Mood Board palette',
      'The destination for your QR codes and shared links',
      'Hosts your Save the Date, RSVP, and gallery as they go live',
      'Free with every event',
    ],
    preview: [
      { context: 'Your page', glyph: '◷', caption: 'Names, story, and details guests see first.', aspect: '9/16' },
      { context: 'On scan', glyph: '⌗', caption: 'Where every QR code and shared link lands.' },
      { context: 'Lifecycle', glyph: '◔', caption: 'Surfaces RSVP, broadcast, and gallery in time.' },
    ],
    specs: [{ eyebrow: 'Price', value: 'Free', caption: 'with every event' }],
  },

  'music-creator': {
    eyebrow: 'Music Creator · soundtrack',
    heroTitle: 'Music for your event reels',
    tagline:
      'Pick from the Setnayan-owned music library or generate a custom track — cleared for every video your wedding renders.',
    paragraphs: [
      'Every reel, highlight, and Save the Date that Setnayan renders needs a soundtrack you can actually use. Music Creator gives you a library of Setnayan-owned tracks across moods, plus the option to generate a custom one.',
      'Because the catalogue is owned and AI-generated, there are no label licences and no per-render fees — the music is cleared for every video at your wedding, forever.',
    ],
    highlights: [
      'A library of Setnayan-owned tracks across moods',
      'Generate a custom track when you want something unique',
      'No label licences, no per-render music fees',
      'Backs every Setnayan-rendered video at your event',
      'Free to browse and pick',
    ],
    preview: [
      { context: 'Library', glyph: '♬', caption: 'Browse owned tracks by mood and feel.' },
      { context: 'Generate', glyph: '✶', caption: 'Spin up a custom track for your reels.' },
      { context: 'Cleared', glyph: '✓', caption: 'Used freely across every rendered video.' },
    ],
    specs: [{ eyebrow: 'Licensing', value: '₱0/render', caption: 'owned catalogue' }],
  },

  pakanta: {
    eyebrow: 'Pakanta · your wedding song',
    heroTitle: 'A song written for the two of you',
    tagline:
      'A custom song composed from the love story you already told us — yours to keep, and the backing track for your wedding videos.',
    paragraphs: [
      'Pakanta turns your love story into an original song. We compose it from the story you shared during onboarding — no new interview, no blank page. You get a finished track that is unmistakably about you.',
      'Save it to your library and it becomes the backing music for the videos Setnayan renders at your wedding, so your day sounds like your story.',
    ],
    highlights: [
      'Composed from your onboarding love story — no re-interview',
      'An original song that is yours to keep',
      'Becomes the backing track for your wedding videos',
      'Studio-produced, delivered ready to play',
    ],
    preview: [
      { context: 'From your story', glyph: '✍', caption: 'Your love story becomes the lyric.' },
      { context: 'The song', glyph: '♪', caption: 'A finished, original track delivered to you.' },
      { context: 'Everywhere', glyph: '◎', caption: 'Backs the videos rendered at your wedding.' },
    ],
    privacy: [
      {
        category: 'Your story',
        items: ['The love story you wrote at onboarding'],
        purpose: 'Used to write your song. Never reused for another couple.',
      },
    ],
  },

  'animated-monogram': {
    eyebrow: 'Monogram Creator · your mark',
    heroTitle: 'Your wedding mark, designed and animated',
    tagline:
      'Design a monogram from your initials, then watch it draw itself on — used across your QR, hero, Save the Date, and signage.',
    paragraphs: [
      'Your monogram is the signature of your wedding. Design one from your initials with a guided studio, refine it until it feels right, and get a crisp vector mark plus an animated trace that draws itself on screen.',
      'Once set, it becomes your event-wide identity — centred in your guest QR codes, on your landing hero, your Save the Date, your LED background, and your signage.',
    ],
    highlights: [
      'A guided studio that designs from your initials',
      'A clean vector mark plus a self-drawing animated trace',
      'Applied event-wide: QR centre, hero, Save the Date, signage',
      'Recolours with your palette',
    ],
    preview: [
      { context: 'Design', glyph: '✥', caption: 'Build your mark from your initials in the studio.' },
      { context: 'Animate', glyph: '✦', caption: 'It draws itself on — your animated trace.' },
      { context: 'Everywhere', glyph: '⌗', caption: 'Centres your guest QR codes and signage.' },
    ],
    privacy: [
      {
        category: 'Design brief',
        items: ['Your initials', 'Style preferences', 'Any reference images you upload'],
        purpose: 'Used to generate and refine your monogram for this event.',
      },
    ],
  },

  'custom-qr-guest': {
    eyebrow: 'Custom QR · per guest',
    heroTitle: 'A branded QR for every guest',
    tagline:
      'One personalised QR per guest, carrying your monogram and palette colours — print-ready for invitations and place cards.',
    paragraphs: [
      'Instead of one generic code, every guest gets their own branded QR — wrapped in your monogram and palette so it looks like part of the invitation, not a sticker stuck on after.',
      'Each code carries the guest straight to their personalised landing experience, and the whole set exports print-ready for your stationer.',
    ],
    highlights: [
      'A unique QR for each guest',
      'Wrapped in your monogram and palette colours',
      'Routes each guest to their personalised page',
      'Print-ready export for invitations and place cards',
    ],
    preview: [
      { context: 'Per guest', glyph: '⌗', caption: 'Every guest gets their own branded code.' },
      { context: 'On brand', glyph: '✥', caption: 'Carries your monogram and palette.' },
      { context: 'Print', glyph: '🖶', caption: 'Exports print-ready for your stationer.' },
    ],
    specs: [{ eyebrow: 'Coverage', value: 'Up to 250', caption: 'guests per event' }],
  },

  papic: {
    eyebrow: 'Papic · candid capture',
    heroTitle: 'Your guests are your photographers',
    tagline:
      'Hand a few guests the role of paparazzi — they shoot candid photos and 5-second clips, tag people by QR, and everything lands in your shared gallery.',
    paragraphs: [
      'The moments you will be too busy to see — Papic catches them. Designated friends or family shoot unlimited photos and short clips on their phones, tag guests with a quick QR scan, and every shot flows into your gallery in real time.',
      'Each guest gets their tagged photos automatically and can render a personal souvenir reel. Every photo reaches you whether it was tagged or not — nothing gets lost.',
    ],
    highlights: [
      'A handful of guest "paparazzi" shooting unlimited photos and clips',
      'Tag people in a second with a QR scan',
      'Every photo reaches your gallery — tagged or not',
      'Guests get their own photos and a personal reel',
      'A 5-second cap keeps clips candid, not films',
      'Try it free before you commit a single seat',
    ],
    preview: [
      { context: 'Shoot', glyph: '◉', caption: 'Guests capture candid photos and 5-second clips.', aspect: '9/16' },
      { context: 'Tag', glyph: '⌗', caption: 'Scan a guest or table QR to tag in a second.', aspect: '9/16' },
      { context: 'Gallery', glyph: '▦', caption: 'Everything lands in your shared gallery, live.' },
    ],
    specs: [
      { eyebrow: 'Clip cap', value: '5 sec', caption: 'keeps it candid' },
      { eyebrow: 'Try it', value: 'Free', caption: 'sampler before you buy' },
    ],
    privacy: [
      {
        category: 'Guests & faces',
        items: ['Guest names and tables (for tagging)', 'Photos and clips your paparazzi capture', 'Optional face matching, scoped to your event only'],
        purpose: 'Used to route each photo to the right guest. Face data is never reused across weddings.',
      },
    ],
    dataLinked: {
      linked: ['Photos and clips — stored for your event', 'Tags linking photos to guests'],
      notLinked: ['Face vectors are per-event and never shared', 'Aggregate capture counts (no event linkage)'],
    },
    notIncluded: [
      'No staff photographers — your paparazzi are guests you choose.',
      'Clips are capped at 5 seconds and cannot be extended.',
    ],
  },

  'photo-delivery': {
    eyebrow: 'Photo Delivery · the handoff',
    heroTitle: 'Your photographer’s photos, delivered',
    tagline:
      'Connect Google Drive so your photographer can hand off full-resolution photos after the event — and share albums with guests.',
    paragraphs: [
      'After the wedding, your photographer needs a clean way to give you everything. Photo Delivery connects your Google Drive so the full-resolution handoff lands where you keep it, on your terms.',
      'From there you can share albums with guests — the people who were there get the photos they are in, without you playing courier.',
    ],
    highlights: [
      'Connect your own Google Drive for the handoff',
      'Full-resolution photos, not compressed previews',
      'Share albums with guests directly',
      'Your photographer uploads once; you control access',
    ],
    preview: [
      { context: 'Connect', glyph: '⛁', caption: 'Link your Google Drive in a tap.' },
      { context: 'Handoff', glyph: '⇩', caption: 'Photographer delivers full-resolution photos.' },
      { context: 'Share', glyph: '▦', caption: 'Open albums to the guests who were there.' },
    ],
    privacy: [
      {
        category: 'Google Drive access',
        items: ['A scoped Drive connection you grant', 'Album and file metadata'],
        purpose: 'Used only to receive and share your event photos. Revocable any time.',
      },
    ],
  },

  patiktok: {
    eyebrow: 'Patiktok · vertical reels',
    heroTitle: 'Vertical reels from your day',
    tagline:
      'A gallery of 9:16 reel templates that render on demand into shareable 1080p clips — made for phones and stories.',
    paragraphs: [
      'Your wedding deserves to live where your friends actually watch — vertical, on their phones. Patiktok turns your photos and clips into polished 9:16 reels from a template gallery, rendered on demand.',
      'Pick a template, and the render pipeline produces a clean 1080×1920 MP4 ready to post — no editing app, no timeline, no fuss.',
    ],
    highlights: [
      'A gallery of vertical 9:16 reel templates',
      'Renders to shareable 1080p MP4 on demand',
      'Backed by your owned Setnayan music — cleared to post',
      'No editing app or timeline to learn',
    ],
    preview: [
      { context: 'Templates', glyph: '▤', caption: 'Pick from a gallery of vertical styles.', aspect: '9/16' },
      { context: 'Render', glyph: '▷', caption: 'Produces a clean 1080×1920 clip.', aspect: '9/16' },
      { context: 'Share', glyph: '↗', caption: 'Post straight to stories and reels.', aspect: '9/16' },
    ],
    specs: [
      { eyebrow: 'Format', value: '9:16', caption: '1080×1920 MP4' },
    ],
  },

  led: {
    eyebrow: 'LED Background · the wall',
    heroTitle: 'Your monogram on the big screen',
    tagline:
      'An 8K LED-wall background built from a template and your photos — delivered ready for the venue to play.',
    paragraphs: [
      'The wall behind your stage sets the whole room. LED Background designs an 8K backdrop from a template, blends in your photo pool and monogram, and delivers a file your venue can play directly.',
      'It is built for the screens venues actually use — high-resolution, the right aspect, and yours to hand over on a USB drive.',
    ],
    highlights: [
      '8K template-driven LED-wall render',
      'Blends your photo pool and monogram',
      'Delivered ready for venue playback',
      'Matched to your palette',
    ],
    preview: [
      { context: 'Template', glyph: '▣', caption: 'Choose a backdrop style for the wall.' },
      { context: 'Blend', glyph: '✶', caption: 'Your photos and monogram, composited in 8K.' },
      { context: 'Deliver', glyph: '⇩', caption: 'A file your venue can play directly.' },
    ],
    specs: [{ eyebrow: 'Resolution', value: '8K', caption: 'venue-ready render' }],
  },

  'indoor-blueprint': {
    eyebrow: 'Indoor Blueprint · wayfinding',
    heroTitle: 'Every guest finds their table',
    tagline:
      'Turns your seating chart into guided wayfinding — each guest gets a path from the entrance straight to their seat.',
    paragraphs: [
      'A beautiful seating chart still leaves guests wandering. Indoor Blueprint turns the chart you already built into wayfinding — from the entrance to the exact table, guest by guest.',
      'No more crowding the seating board or asking the coordinator. Each guest sees their own route the moment they arrive.',
    ],
    highlights: [
      'Built directly from your seating chart',
      'A personal path from entrance to table for each guest',
      'Clears the bottleneck at the seating board',
      'Works on the phone guests already have',
    ],
    preview: [
      { context: 'From your plan', glyph: '▦', caption: 'Reuses the seating chart you built.' },
      { context: 'Route', glyph: '➤', caption: 'Entrance-to-table path for each guest.', aspect: '9/16' },
      { context: 'Arrive', glyph: '✓', caption: 'Guests seat themselves, calmly.' },
    ],
  },

  'mood-board': {
    eyebrow: 'Mood Board · your palette',
    heroTitle: 'The colour story for your day',
    tagline:
      'Build your event palette with curated themes and per-role colour stories — and it recolours your whole Setnayan experience.',
    paragraphs: [
      'Your Mood Board is where your wedding’s look begins. Start from a curated theme or build your own palette, with colour stories for each role and your venue, guided so the result actually holds together.',
      'It is the source colour for everything else — your Save the Date, landing page, monogram, and QR codes all recolour to match. Pick once, and the rest follows.',
    ],
    highlights: [
      'Curated theme templates to start from',
      'Per-role and venue colour stories',
      'A guide that checks your palette holds together',
      'Recolours your Save the Date, page, monogram, and QRs',
      'Free — part of planning',
    ],
    preview: [
      { context: 'Themes', glyph: '◳', caption: 'Start from a curated palette or build your own.' },
      { context: 'Stories', glyph: '◍', caption: 'Colour roles for the party and the venue.' },
      { context: 'Everywhere', glyph: '✦', caption: 'Your palette flows into every Setnayan piece.' },
    ],
    specs: [{ eyebrow: 'Price', value: 'Free', caption: 'part of planning' }],
  },
};

/** Detail content for an add-on key, or null when it has none. */
export function addOnDetail(key: string): AddOnDetail | null {
  return ADD_ON_DETAILS[key] ?? null;
}
