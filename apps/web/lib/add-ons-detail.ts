/**
 * add-ons-detail.ts — App Store-style detail content for every couple-side
 * in-app service.
 *
 * The Studio hub (/dashboard/[eventId]/studio) lists each feature as an App
 * Store row; tapping a row opens its detail page (./[addon]/about) — the
 * iOS App Store-style info surface. This module is the single source of that
 * copy.
 *
 * VOICE (owner 2026-06-19 · "we are selling stories and results, not how we do
 * it or our program" · register = punchy & confident):
 *   • Sell the RESULT and the STORY — why this is worth it for *your* wedding.
 *   • NEVER explain the mechanism / our program — no "signals", "pipeline",
 *     "face-matching", "QR fan-out", "render engine", etc. (matches the locked
 *     public-surface-hygiene rule: benefits, never implementation).
 *   • Short, declarative lines. Outcomes, not features.
 *   • No invented prices — pricing renders live from platform_retail_catalog_v2
 *     by serviceKey. Nothing here is a price source.
 *   • Preview frames describe what the couple SEES/FEELS — never faked screens.
 *
 * Panood is intentionally ABSENT: it ships its own bespoke App Store detail at
 * /studio/panood (the 2026-05-17 pilot). The hub links Panood straight there.
 */

import type { DemoFrame } from '@/app/_components/app-store/studio-card-demo';

export type DetailPreview = {
  /** Small eyebrow over the frame — "The reveal", "By morning". */
  context?: string;
  /** A large glyph centered in the frame (decorative, aria-hidden). */
  glyph: string;
  /** One-line, result-framed caption under the frame. */
  caption: string;
  /** Tiny secondary line inside the frame, under the glyph. */
  sub?: string;
  /** Frame shape — defaults to 16/10. */
  aspect?: '16/10' | '9/16' | '1/1';
};

export type AddOnDetail = {
  /** Short, clean eyebrow over the hero title — the feature name. */
  eyebrow: string;
  /** Punchy, result-led hero title. */
  heroTitle: string;
  /** One promise she'd repeat to a friend. */
  tagline: string;
  /** Story + result — short, confident lines. No mechanics. */
  paragraphs: string[];
  /** "What you'll have" — outcome bullets, never feature-mechanics. */
  highlights: string[];
  /** Preview rail frames — captioned as the result the couple sees. */
  preview: DetailPreview[];
  /** Auto-playing on-card demo (StudioCardDemo). When present, the card plays
   *  this — what it does + how to operate it — instead of the static glyph rail.
   *  Frames take a real app screenshot (`image`) or a styled fallback tint. */
  demo?: DemoFrame[];
};

export const ADD_ON_DETAILS: Record<string, AddOnDetail> = {
  'setnayan-ai': {
    eyebrow: 'Setnayan AI',
    heroTitle: 'Your shortlist. Already made.',
    tagline:
      'The vendors that fit your budget, your date, and your style — at the top, every time.',
    paragraphs: [
      'Stop hunting. Start choosing.',
      'The right team makes the day. Setnayan puts yours in front of you — so planning feels like deciding, not digging.',
    ],
    highlights: [
      'The right names, first',
      'In budget. Free on your date.',
      'Made for your style and your ceremony',
      'Hours of searching, gone',
    ],
    preview: [
      { context: 'Your shortlist', glyph: '☑', caption: 'The names worth your time, right at the top.' },
      { context: 'Made for you', glyph: '◎', caption: 'Every pick fits your budget, date, and style.' },
      { context: 'Less hunting', glyph: '✦', caption: 'Spend your time choosing, not searching.' },
    ],
  },

  playlist: {
    eyebrow: 'Playlist',
    heroTitle: 'Every moment, the right song.',
    tagline:
      'Processional, first dance, dinner, open floor — and the songs you never want to hear. Set once, handed to your DJ.',
    paragraphs: [
      'Your day has a soundtrack. Build it, moment by moment.',
      'Book your DJ or band through Setnayan and the whole lineup lands in their hands — nothing lost in translation.',
    ],
    highlights: [
      'A song for every part of the day',
      "A do-not-play list your DJ actually sees",
      'Handed straight to your booked DJ or band',
      'Yours to reshape any time',
    ],
    preview: [
      { context: 'By moment', glyph: '♫', caption: 'Each part of the day gets its own list.' },
      { context: 'Do-not-play', glyph: '⃠', caption: 'The songs you never want to hear, flagged.' },
      { context: 'Handed off', glyph: '⇄', caption: 'Your DJ gets the whole plan, exactly.' },
    ],
  },

  'save-the-date': {
    eyebrow: 'Save the Date',
    heroTitle: 'The first time they feel your wedding.',
    tagline:
      'A reveal lifts, your invitation appears, and it plays itself — in your colors, ending on “add to calendar.”',
    paragraphs: [
      'Before the day, there’s the moment they open your save-the-date. Make it one they screenshot.',
      'A cinematic reveal, a film of your story, your colors throughout — then their calendar’s marked in a tap.',
    ],
    highlights: [
      'A reveal they’ll want to watch twice',
      'Plays itself, fullscreen, on any phone',
      'In your colors, start to finish',
      'Ends on one-tap save-the-date',
    ],
    preview: [
      { context: 'The reveal', glyph: '✦', caption: 'It lifts to reveal your invitation.', aspect: '9/16' },
      { context: 'Your film', glyph: '▷', caption: 'Your story, in your colors.', aspect: '9/16' },
      { context: 'Saved', glyph: '❖', caption: 'Their calendar, marked in a tap.' },
    ],
  },

  'landing-page': {
    eyebrow: 'Your Website',
    heroTitle: 'The page that says it all.',
    tagline:
      'One beautiful page for your names, your story, and every detail — behind every QR you share.',
    paragraphs: [
      'Scan your QR or tap your link, and this is where guests land.',
      'Your story, your details, your colors — and it grows with the day, holding your RSVP, your stream, your gallery.',
    ],
    highlights: [
      'Your names and story, beautifully',
      'In your colors',
      'The home behind every QR and link',
      'Grows into your RSVP, stream, and gallery',
    ],
    preview: [
      { context: 'Your page', glyph: '◷', caption: 'The first thing guests see.', aspect: '9/16' },
      { context: 'On scan', glyph: '⌗', caption: 'Where every QR and link lands.' },
      { context: 'Over time', glyph: '◔', caption: 'Holds your RSVP, stream, and gallery.' },
    ],
  },

  'music-creator': {
    eyebrow: 'Music',
    heroTitle: 'A soundtrack you can actually use.',
    tagline:
      'Hand-picked tracks — or your own — cleared for every wedding video you make. No fees, ever.',
    paragraphs: [
      'Every reel and highlight needs music you won’t get flagged for.',
      'Pick from the library or make your own — cleared for every video at your wedding, forever.',
    ],
    highlights: [
      'Tracks for every mood',
      'Make your own in a tap',
      'No licences, no per-video fees',
      'Backs every Setnayan video at your day',
    ],
    preview: [
      { context: 'Library', glyph: '♬', caption: 'Browse by mood and feel.' },
      { context: 'Your own', glyph: '✶', caption: 'Make a custom track.' },
      { context: 'Cleared', glyph: '✓', caption: 'Use it on every video, free.' },
    ],
  },

  pakanta: {
    eyebrow: 'Pakanta',
    heroTitle: 'A song that’s only yours.',
    tagline:
      'An original wedding song, written from your love story — and the music behind your videos.',
    paragraphs: [
      'Your story becomes a song — written from what you already told us. No blank page, no awkward interview.',
      'Yours to keep. And it scores the videos from your day, so the whole wedding sounds like you.',
    ],
    highlights: [
      'An original song, written for the two of you',
      'From the love story you already shared',
      'Yours to keep, forever',
      'Becomes the music behind your wedding videos',
    ],
    preview: [
      { context: 'Your story', glyph: '✍', caption: 'Your love story becomes the lyric.' },
      { context: 'Your song', glyph: '♪', caption: 'A finished, original track.' },
      { context: 'Everywhere', glyph: '◎', caption: 'Scores the videos from your day.' },
    ],
  },

  'animated-monogram': {
    eyebrow: 'Monogram',
    heroTitle: 'Your mark on everything.',
    tagline:
      'A monogram from your initials that draws itself on — and signs your QR, your hero, your signage.',
    paragraphs: [
      'Every great wedding has a signature. Design yours, then watch it come to life.',
      'And it shows up everywhere it should — your invites, your page, your screens, your signage — all in your colors.',
    ],
    highlights: [
      'A custom mark from your initials',
      'An animated trace that draws itself on',
      'On your QR, hero, save-the-date, and signage',
      'In your colors',
    ],
    preview: [
      { context: 'Design', glyph: '✥', caption: 'Built from your initials.' },
      { context: 'It moves', glyph: '✦', caption: 'Draws itself on, beautifully.' },
      { context: 'Everywhere', glyph: '⌗', caption: 'Signs every corner of your day.' },
    ],
  },

  'custom-qr-guest': {
    eyebrow: 'Custom QR',
    heroTitle: 'A QR worthy of the invitation.',
    tagline:
      'A personal, branded code for every guest — in your monogram and colors, print-ready.',
    paragraphs: [
      'A plain black-and-white square doesn’t belong on your stationery.',
      'Give every guest their own code, wrapped in your monogram and colors — and ready for the printer.',
    ],
    highlights: [
      'A unique code for each guest',
      'Wrapped in your monogram and colors',
      'Takes each guest to their own page',
      'Print-ready for invites and place cards',
    ],
    preview: [
      { context: 'Per guest', glyph: '⌗', caption: 'Everyone gets their own code.' },
      { context: 'On brand', glyph: '✥', caption: 'Your monogram, your colors.' },
      { context: 'Print', glyph: '▤', caption: 'Ready for your stationer.' },
    ],
  },

  papic: {
    eyebrow: 'Papic',
    heroTitle: 'The moments you’ll miss, caught.',
    tagline:
      'Your guests become the photographers — every candid shot and clip, in your gallery by morning.',
    paragraphs: [
      'You’ll be too busy living your day to see half of it. Papic catches the rest.',
      'A few friends shoot freely all night, and every guest goes home with the photos they’re in.',
    ],
    highlights: [
      'The candids no hired lens catches',
      'Every photo reaches you — tagged or not',
      'Each guest gets their own shots',
      'Try it free before you commit',
    ],
    preview: [
      { context: 'They shoot', glyph: '◉', caption: 'Friends capture the night, freely.', aspect: '9/16' },
      { context: 'Tagged', glyph: '⌗', caption: 'The right people are found in a second.', aspect: '9/16' },
      { context: 'By morning', glyph: '▦', caption: 'It’s all waiting in your gallery.' },
    ],
    demo: [
      {
        caption: 'A friend’s phone becomes a candid camera.',
        hint: 'Tap to shoot — no app to install.',
        accent: '#2a2118',
      },
      {
        caption: 'Every shot lands in your gallery, instantly.',
        hint: 'You never lift a finger — it just fills up.',
        accent: '#1f2622',
      },
      {
        caption: 'The right people are found automatically.',
        hint: 'Or scan a guest’s QR to tag — no typing.',
        accent: '#241f2a',
      },
      {
        caption: 'Each guest finds the photos they’re in.',
        hint: '“Photos of you” fills through the day — theirs to keep.',
        accent: '#2a1f24',
      },
    ],
  },

  'photo-delivery': {
    eyebrow: 'Photo Delivery',
    heroTitle: 'Every photo, in your hands.',
    tagline:
      'Your photographer’s full-resolution gallery, delivered to your Drive — and shared with the guests who were there.',
    paragraphs: [
      'After the day, you want everything — not compressed previews.',
      'Connect your Drive, your photographer hands off the originals, and your guests get the photos they’re in. No chasing.',
    ],
    highlights: [
      'Full-resolution, not previews',
      'Lands in your own Google Drive',
      'Share albums with your guests',
      'You hold the keys',
    ],
    preview: [
      { context: 'Connect', glyph: '⛁', caption: 'Link your Drive in a tap.' },
      { context: 'Delivered', glyph: '⇩', caption: 'The originals, handed to you.' },
      { context: 'Shared', glyph: '▦', caption: 'Guests get their photos.' },
    ],
  },

  patiktok: {
    eyebrow: 'Patiktok',
    heroTitle: 'Your wedding, ready to post.',
    tagline:
      'Polished vertical reels from your photos and clips — made for phones and stories.',
    paragraphs: [
      'Your wedding deserves to live where your friends actually watch.',
      'Pick a style, and out comes a clean vertical reel — no editing app, no timeline, ready to share.',
    ],
    highlights: [
      'Vertical reels, made for stories',
      'A gallery of styles to choose from',
      'Ready to post in minutes',
      'Set to music you’re cleared to use',
    ],
    preview: [
      { context: 'Styles', glyph: '▤', caption: 'Pick a vertical look.', aspect: '9/16' },
      { context: 'Made', glyph: '▷', caption: 'Out comes a clean reel.', aspect: '9/16' },
      { context: 'Posted', glyph: '↗', caption: 'Straight to your stories.', aspect: '9/16' },
    ],
  },

  led: {
    eyebrow: 'LED Background',
    heroTitle: 'Your name, twenty feet tall.',
    tagline:
      'A stunning backdrop for the stage — your photos, your monogram — ready for the venue to play.',
    paragraphs: [
      'The wall behind you sets the whole room.',
      'We build it from your photos and monogram, then hand the venue a file that’s ready to play.',
    ],
    highlights: [
      'A showpiece backdrop for your stage',
      'Your photos and monogram, woven in',
      'Crisp on the biggest screens',
      'Delivered ready for the venue',
    ],
    preview: [
      { context: 'Choose', glyph: '▣', caption: 'Pick a look for the wall.' },
      { context: 'Yours', glyph: '✶', caption: 'Your photos and monogram, together.' },
      { context: 'Ready', glyph: '⇩', caption: 'Handed to the venue to play.' },
    ],
  },

  'indoor-blueprint': {
    eyebrow: 'Indoor Blueprint',
    heroTitle: 'No one wanders to their seat.',
    tagline:
      'Your seating chart becomes a path — every guest walks straight from the door to their table.',
    paragraphs: [
      'A gorgeous seating chart still leaves guests lost at the door.',
      'Turn the chart you already built into a personal route for each guest — calm arrivals, no crowd at the board.',
    ],
    highlights: [
      'A personal path for every guest',
      'Straight from the entrance to their table',
      'No bottleneck at the seating board',
      'On the phone they already have',
    ],
    preview: [
      { context: 'Your plan', glyph: '▦', caption: 'Built from your seating chart.' },
      { context: 'Their route', glyph: '➤', caption: 'Door to table, guest by guest.', aspect: '9/16' },
      { context: 'Arrived', glyph: '✓', caption: 'Everyone seats themselves, calmly.' },
    ],
  },

  'mood-board': {
    eyebrow: 'Mood Board',
    heroTitle: 'Your colors, everywhere.',
    tagline:
      'Build the palette for your day — and watch it flow into your invites, your page, and your monogram.',
    paragraphs: [
      'Every wedding starts with a feeling. Find yours here.',
      'Start from a curated theme or build your own — then your save-the-date, page, monogram, and QRs all dress to match.',
    ],
    highlights: [
      'Curated palettes to start from',
      'Colors for the party and the venue',
      'Flows into every Setnayan piece',
      'Free — part of planning',
    ],
    preview: [
      { context: 'Themes', glyph: '◳', caption: 'Start from a palette or build your own.' },
      { context: 'Stories', glyph: '◍', caption: 'Colors for the day and the venue.' },
      { context: 'Everywhere', glyph: '✦', caption: 'Your palette dresses every piece.' },
    ],
  },
};

/** Detail content for an add-on key, or null when it has none. */
export function addOnDetail(key: string): AddOnDetail | null {
  return ADD_ON_DETAILS[key] ?? null;
}
