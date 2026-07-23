// ============================================================================
// Editorial recap page — data layer (Increment D)
// ============================================================================
//
// Self-contained data fetch + derivation for the post-wedding "newspaper front
// page" (Wedding_Website_Lifecycle_Spec_2026-06-07 §6.3–6.8). Read directly via
// the admin Supabase client because the public site is anonymous and these
// rows sit behind RLS. Every query is best-effort: a missing table/column or a
// thrown error degrades to a neutral default rather than crashing the page.
//
// Nothing here writes; nothing here throws. `loadEditorialData()` ALWAYS
// resolves to an `EditorialData | null` — `null` only when the event itself
// can't be loaded, which the component turns into a graceful "not available
// yet" card.
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveStillRef, resolvePlayRef, stableMediaPath } from '@/lib/papic-display-ref';
import { eventSkuActive } from '@/lib/entitlements';
import { parseYouTubeVideoId, youTubeEmbedUrl } from '@/lib/panood-watch';
import { guestColumnsEnabled } from '@/lib/guest-columns';
import { tierCaps } from '@/lib/vendor-tier-caps';
import {
  fetchEventRecommendations,
  type EventRecommendation,
} from '@/lib/vendor-recommendations';

// ── Tunable constants (admin-tunable later · §6.8 + §6.4 M3) ────────────────

/**
 * Archetype SCALE threshold. ≤ INTIMATE_MAX guests reads as "Intimate"
 * (the 100-pax pricing floor anchors the "intimate" band), else "Grand".
 */
export const INTIMATE_MAX = 80;

/**
 * Archetype SPEND threshold (PHP per guest). Above this reads as "Luxurious",
 * else "Modest". Only applied when a per-guest spend can be derived cheaply;
 * otherwise spend is left neutral (we never invent a budget).
 */
export const LUX_PER_GUEST = 3000;

/**
 * M3 — "time saved" defensible estimate. Tunable formula:
 *   hoursSaved = vendorsCount * PER_VENDOR_HOURS + BASE_HOURS
 * The per-vendor term stands in for research + shortlisting + coordination
 * a couple would otherwise do by hand for each vendor; the base term covers
 * one-time setup (guest list, schedule, website) saved by the platform.
 * Labeled "estimated" in the UI — never presented as measured.
 */
export const TIME_SAVED_PER_VENDOR_HOURS = 6;
export const TIME_SAVED_BASE_HOURS = 8;

/**
 * How many of the day's Papic captures to pull into the editorial gallery (the
 * most-recent N clean, non-hidden photos). Capped so a heavily-shot wedding
 * (thousands of captures) doesn't presign+ship a giant payload — the gallery is
 * a representative spread, not the full album (the full album lives in the
 * couple's gallery surface). The renderer shows only the first ~9 anyway.
 */
export const EDITORIAL_PAPIC_GALLERY_CAP = 24;

/** How many Papic captures to back the "10 moments" / photo-essay spread. */
export const EDITORIAL_PAPIC_ESSAY_CAP = 10;

/** How many "As the Day Unfolded" chapters to emit (an even time-order split). */
export const EDITORIAL_DAY_CHAPTER_CAP = 10;

/** How many Kwento guest wishes to surface in "What They Whispered". */
export const EDITORIAL_KWENTO_CAP = 8;

/** How many approved Guest Columns to surface in "Letters to the Editor". */
export const EDITORIAL_GUEST_COLUMN_CAP = 6;

/** How many clean Papic 5-second clips to pull into the day timeline. */
export const EDITORIAL_PAPIC_CLIP_CAP = 14;

/**
 * How many clean Papic PHOTOS to sample for the "As the Day Unfolded" timeline.
 * This is a SEPARATE, wider read from the most-recent-24 gallery slice: the
 * gallery is recency-capped (evening-biased on a photo-heavy day), while the
 * timeline needs the whole day's arc — so it reads captured_at ASC across the
 * event. Only a lightweight (photo_id, key, captured_at) row set is fetched here;
 * we bucket FIRST and presign ONLY the ≤3 media each chapter actually uses, so a
 * heavily-shot wedding never presigns all 48.
 */
export const EDITORIAL_TIMELINE_PHOTO_CAP = 48;

/** Display labels for in-app Setnayan service_keys (the "Powered by Setnayan"
 * strip). Unknown keys fall back to prettyServiceKey(). */
const SERVICE_LABELS: Record<string, string> = {
  ANIMATED_MONOGRAM: 'Animated Monogram',
  CAMERA_BRIDGE: 'Camera Bridge',
  COUPLE_WEBSITE_PRO: 'Website PRO',
  CUSTOM_QR_GUEST: 'Custom Guest QR',
  // EDITORIAL_PRO + STD_PREMIUM_OPENINGS are bundle-only (2026-07-22 · via Website
  // PRO). Kept here so existing/bundle owners still get a clean "Powered by" label.
  EDITORIAL_PRO: 'Editorial PRO',
  EVENT_WEBSITE: 'Event Website',
  LIVE_BACKGROUND: 'Live Background',
  STD_PREMIUM_OPENINGS: 'Cinematic Reveal',
  LIVE_WALL: 'Live Photo Wall',
  PABATI: 'Pabati',
  PAKANTA: 'Pakanta',
  PANOOD_SYSTEM: 'Live Studio',
  PAPIC_ADDON_STORIES: 'Guest Stories',
  PAPIC_ADDON_THANK_YOU: 'Thank-You Video',
  PAPIC_GUEST: 'Papic Guest',
  PAPIC_SEATS: 'Papic',
  PATIKTOK_COMPILER: 'Patiktok',
  PRO_RSVP: 'Pro RSVP',
  PRO_WEBSITE: 'Pro Website',
  RSVP_PRO_WEBSITE: 'Pro Website',
  SETNAYAN_AI: 'Setnayan AI',
};

function prettyServiceKey(key: string): string {
  return key
    .toLowerCase()
    .split(/[_:-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Public types ────────────────────────────────────────────────────────────

export type Milestone = { year?: string | null; title?: string | null; note?: string | null };

export type LoveStory = {
  how_we_met?: string | null;
  met_year?: string | null;
  together_since?: string | null;
  proposal?: string | null;
  proposal_setting?: string | null;
  proposal_year?: string | null;
  spark?: string | null;
  spark_why?: string | null;
  obstacle?: string | null;
  obstacle_kept?: string | null;
  proposal_voice?: string | null;
  proposal_feel?: string | null;
  milestones?: Milestone[] | null;
  anchors?: {
    song?: string | null;
    place?: string | null;
    injoke?: string | null;
    food?: string | null;
  } | null;
};

export type ImpactMetrics = {
  servicesSetnayan: number; // M1 numerator
  servicesTotalDenominator: number | null; // M1 denominator ("X of Y") — null = render bare count
  firstPickNum: number; // M2 numerator
  firstPickDen: number; // M2 denominator (total event_vendors)
  hoursSaved: number; // M3 estimate
  guests: number;
  attending: number;
  replied: number; // attending + declined + maybe (non-pending)
  rsvpPct: number | null; // replied / guests when guests > 0
  photos: number | null; // null = omit the photo stat
  clips: number | null; // Papic 5-second clips (living moments); null = omit
  chapters: number | null; // "As the Day Unfolded" chapter count; null = omit
};

// "What They Whispered" — a Kwento guest wish. Owner (2026-07-04): "kwento are
// messages with videos or photos" — every wish is a guest MESSAGE attached to its
// anchor media, so the editorial shows that media beside the words. `body` is the
// approved, screen-cleared message text; `author` is the guest's display name
// (null when the guest opted their name off / has no name). `media` is the wish's
// anchor: a photo (still), or a clip (playable MP4 + optional poster). It is null
// only when the wish has no anchor OR the anchor row is blocked/hidden/ungated
// (fail-closed) — the words are still approved, so the card renders text-only.
export type KwentoQuote = {
  body: string;
  author: string | null;
  role: string | null;
  media: { type: 'photo' | 'clip'; url: string; posterUrl?: string | null } | null;
};

export type ArchetypeKey = 'hand-picked' | 'jewel-box' | 'big-hearted' | 'sweeping';

export type Archetype = {
  key: ArchetypeKey;
  label: string; // "Hand-picked" etc. — the ANGLE, never a literal judgement
  scale: 'intimate' | 'grand';
  spend: 'modest' | 'luxurious' | 'neutral';
};

export type StoryTone = 'warm' | 'playful' | 'formal' | null;

export type VendorCredit = {
  name: string;
  category: string | null;
  isFirstPick: boolean;
  // Tier-aware showcase (Wedding_Website_Lifecycle_Spec §3): a vendor's
  // featured card (logo + profile link) renders on the Editorial only while
  // they are currently Pro/Enterprise. `tier` is the linked vendor_profile's
  // tier_state ('free'|'verified'|'solo'|'pro'|'enterprise') or null when the
  // event vendor isn't linked to a marketplace profile. Free vendors are
  // excluded upstream (hidden from the Editorial entirely, per §3).
  tier: 'free' | 'verified' | 'solo' | 'pro' | 'enterprise' | 'custom' | null;
  logoUrl: string | null;
  slug: string | null;
};

// Which optional blocks the couple chose to show (editorial editor →
// draft_json.sections). The spine — masthead, headline, hero — is always on.
export type EditorialSections = {
  byTheNumbers: boolean;
  gallery: boolean;
  reviews: boolean;
  team: boolean;
  poweredBy: boolean;
  liveWall: boolean;
  videoGuestbook: boolean;
  fromTheCouple: boolean;
  fromVendors: boolean;
  vendorsWeLoved: boolean;
  kwento: boolean;
  guestColumns: boolean;
  watchFilm: boolean;
};

export const EDITORIAL_SECTION_KEYS: ReadonlyArray<keyof EditorialSections> = [
  'byTheNumbers',
  'gallery',
  'reviews',
  'team',
  'poweredBy',
  'liveWall',
  'videoGuestbook',
  'fromTheCouple',
  'fromVendors',
  'vendorsWeLoved',
  'kwento',
  'guestColumns',
  'watchFilm',
];

// ── Section ORDER (Editorial PRO — "the Editor's Desk") ──────────────────────
// The reorderable-section registry + resolver live in the PURE, client-safe
// module editorial-order.ts (data.ts imports `server-only` via lib/uploads, so a
// CLIENT component can't import runtime values from here). Re-exported so existing
// `from './data'` imports keep working; the couple-dashboard editor imports the
// pure module directly. See editorial-order.ts for the locked-close rule.
export {
  EDITORIAL_ORDERABLE_KEYS,
  EDITORIAL_LOCKED_CLOSE_KEYS,
  resolveSectionOrder,
  type EditorialOrderKey,
} from './editorial-order';

// "From your vendors" — day-of media the couple's RECOMMENDED vendor
// (event_vendors.selection_match_rank = 1) submitted for this event. Clips are
// always pre-baked boomerangs (editorial rule), photos render as stills.
// Auto-shows once the media clears the NSFW screen; the couple can hide any
// item. The DB-backed write path (editorial_vendor_media table + vendor submit
// UI + NSFW screen + admin) lands in the next increment; today this is seeded
// on the samples and resolves to [] for real events.
export type VendorMediaItem = {
  vendorName: string;
  category: string | null;
  type: 'photo' | 'clip';
  // Still image (a photo, or the freeze-frame poster of a clip). Always present.
  stillUrl: string;
  // The baked forward+reverse boomerang MP4 (clips only). Plays muted/looping.
  boomerangUrl: string | null;
  caption: string | null;
};

// ── "As the Day Unfolded" living-story chapters ──────────────────────────────
// A single medium (photo or a 5-second Papic clip) inside a chapter. `url` is a
// presigned display URL (a still image for a photo, the playable MP4 for a clip);
// `posterUrl` is the clip's freeze-frame poster (null for photos / clips with no
// baked poster). `id` is the underlying Papic photo_id, carried through so the
// couple-curation layer (chapterOverrides) can target a chapter by its lead.
export type ChapterMedia = {
  type: 'photo' | 'clip';
  url: string;
  posterUrl?: string | null;
  id?: string | null;
};

// One chapter of the day. `time` is a clock-time kicker ("4:12 in the
// afternoon") derived from the lead media's captured_at — the auto floor, NEVER
// a moment name (no "First Kiss"). Factual naming arrives only via couple
// curation: `title` (a moment name the couple typed, e.g. "First Kiss") and
// `writeUp` (a short paragraph) are null until the couple names the moment in the
// editorial editor. `leadId` is the lead medium's Papic photo_id — the stable key
// that chapterOverrides (title/writeUp/hidden/reorder) target. It is null for the
// curated legacy essay_photo_ids path (which carries no timeline identity).
// `media[0]` is the lead (a clip when the bucket has one), followed by ≤2
// supporting photos.
export type DayChapter = {
  time: string | null;
  title: string | null;
  writeUp: string | null;
  leadId: string | null;
  media: ChapterMedia[];
};

// A couple's per-chapter curation, stored in event_editorial.draft_json under
// `chapterOverrides`. Targets an auto-built chapter by its lead's `leadId` and
// carries any of: a moment name (`title`), a short story (`writeUp`), a hide flag,
// and — by its POSITION in the array — the couple's chosen order. Overrides whose
// leadId no longer maps to a live chapter are ignored gracefully.
export type ChapterOverride = {
  leadId: string;
  title?: string | null;
  writeUp?: string | null;
  hidden?: boolean;
};

export type EditorialData = {
  displayName: string;
  firstNames: string; // best-effort "A & B" for headline
  /** Public slug of the couple's site — drives the in-editorial share link +
   *  the OG card route. NULL for the curated sample (no real event row), which
   *  is how the editorial render distinguishes "show share buttons" (real) from
   *  the sample (whose detail page owns its own share bar). */
  slug: string | null;
  eventDate: string | null; // ISO
  eventDateFormatted: string | null; // en-PH long form
  // Masthead dateline: this wedding's number within its AWARDS CYCLE (the Nth
  // Setnayan wedding of the cycle, by date). The edition year runs Nov 18 → Nov
  // 17; Volume (Vol. I = the Nov-18-2026 cycle) is derived from the date at
  // render. Null when it can't be counted → falls back to No. 1.
  editionNo: number | null;
  venueName: string | null;
  venueCity: string | null;
  venueAddress: string | null;
  monogramText: string;
  monogramColor: string;
  loveStory: LoveStory;
  specialMessage: string | null;
  togetherSince: string | null; // ISO date
  tone: StoryTone;
  // Composed copy: prefer event_editorial.draft_json when present.
  draft: {
    headline?: string | null;
    deck?: string | null;
    superKicker?: string | null;
    leadParagraphs?: string[] | null;
    pullQuote?: string | null;
    byline?: string | null;
  };
  // FREE prose fallback for the article body. When the couple wrote no lead
  // paragraphs (`draft.leadParagraphs` empty), the renderer falls back to these
  // — the event's `love_story` prose fields woven into paragraphs — so a
  // no-Papic editorial never has an empty middle. Empty when there's no
  // love_story prose to render.
  loveStoryParagraphs: string[];
  published: boolean;
  heroPhotoUrl: string | null;
  // Crawler-durable hero for OG / social cards — the stable streaming media-route
  // URL (absolute) when the hero resolved from a Papic ref, else null (OG falls
  // back to heroPhotoUrl). Optional so the sample/mock editorials need not set it.
  heroStableUrl?: string | null;
  // The couple's LIVING HERO — a pre-baked forward+reverse boomerang MP4
  // (events.landing_page_hero_video_r2_key). When present, the editorial hero
  // plays it as a muted, looping, GIF-like banner with heroPhotoUrl as the
  // poster/still. Null → the hero is the static photo. Editorial rule: any
  // video on the editorial is ALWAYS a baked boomerang (never a one-shot clip).
  heroVideoUrl: string | null;
  metrics: ImpactMetrics;
  archetype: Archetype;
  vendors: VendorCredit[];
  // Vendors the couple explicitly RECOMMENDED post-wedding (vendor_recommendations,
  // §6.3 referral loop) — distinct from `vendors` (the auto-generated credit list).
  // Each carries the couple's optional one-line endorsement.
  vendorsWeLoved: EventRecommendation[];
  // "What They Said" — guest/vendor/couple reviews. Seeded today via
  // event_editorial.draft_json.reviews; the full event-bound review system
  // (spec §3) lands later and will replace this source.
  reviews: Review[];
  // In-app Setnayan services the couple availed (paid `orders`), as display
  // labels — drives the "Powered by Setnayan" strip.
  servicesAvailed: string[];
  // Shared photos from the day, resolved to display URLs — the editorial photo
  // gallery. UNION of the couple's manual uploads (events.our_photos) and a
  // recent slice of the day's clean Papic captures (papic_photos), so a couple
  // who shot the day with Papic gets a real gallery even with zero manual
  // uploads. Falls back to our_photos exactly as before when Papic is empty.
  galleryPhotos: string[];
  // "The 10 moments" / photo-essay spread. Display URLs auto-filled from the
  // day's clean Papic captures when the curated event_editorial.essay_photo_ids
  // list is empty (the normal case — it has no writer yet). A best-effort spread,
  // not a per-moment mapping. Empty when there are no Papic photos.
  essayPhotos: string[];
  // "As the Day Unfolded" — the living story, in the order it happened. Up to 10
  // chapters built from the Papic timeline (clean photos + 5s clips, captured_at
  // ASC). Each chapter carries a clock-time kicker + a lead medium (a clip when
  // one is in the bucket) + ≤2 supporting photos. Empty when there are no Papic
  // media → the renderer falls back to the legacy `essayPhotos` treatment, so no
  // shipped editorial loses its Moments section.
  dayChapters: DayChapter[];
  // The couple's song for the recap. When the delivered Pakanta song is present
  // (events.pakanta_song_r2_key), `url` is its presigned audio URL and `label`
  // credits it as "their song". Otherwise `url` is null and `label` falls back
  // to the free-text love_story.anchors.song (a typed title, never playable).
  song: { url: string | null; label: string | null };
  // Live Photo Wall (events.photo_wall_photos), resolved to display URLs.
  // Only surfaced when photoWallActive is true (LIVE_WALL SKU activated).
  photoWallPhotos: string[];
  photoWallActive: boolean;
  // Pabati video guestbook (pabati_clips → presigned clip URLs). Only surfaced
  // when pabatiActive is true (PABATI SKU active). Clean, non-hidden clips only.
  pabatiClips: string[];
  pabatiActive: boolean;
  // Day-of media from the couple's recommended vendor (see VendorMediaItem).
  vendorMedia: VendorMediaItem[];
  // "What They Whispered" — approved, screen-cleared Kwento guest wishes
  // (photo_messages). Fail-closed like every other public block: only
  // status='approved' + moderation_state='clean' + not author-hidden. Each
  // carries the author's display name (when set) and its anchor `media` (a photo
  // still or a living 5s clip), resolved from the anchor row under the SAME
  // fail-closed gate that table uses (blocked/hidden/ungated anchor → text-only,
  // the words still approved). [] when the couple has no Kwento or the table is
  // absent (section then hidden).
  kwentoQuotes: KwentoQuote[];
  // "Letters to the Editor" — approved Guest Columns (guest_columns · BUILD ①,
  // GUEST_COLUMNS_ENABLED). Fail-closed exactly like kwentoQuotes: only
  // status='approved' + moderation_state='clean' + author not hidden, bylines
  // from `guests`. OPTIONAL so the samples (and any pre-feature callers) need
  // no change — absent/[] hides the section. Flag off → never loaded.
  guestColumns?: Array<{ title: string; body: string; author: string | null }>;
  // Live Studio replay — "Watch the Film". The youtube-nocookie EMBED URL for
  // the couple's Panood broadcast replay, gated on: a valid events.panood_watch_url
  // (normalize-or-rejected) AND an ACTIVE Panood/Live Studio SKU. Null → the
  // section is hidden (fail-closed on all three).
  watchFilmEmbedUrl: string | null;
  // Section visibility from the editorial editor. Optional → a block shows
  // unless its key is explicitly false (samples omit it = everything on).
  sections?: Partial<EditorialSections>;
  // Couple-chosen ORDER of the reorderable content sections (Editorial PRO). A
  // string[] of EditorialOrderKey values (draft_json.sectionOrder); the renderer
  // resolves it via resolveSectionOrder(). `null`/absent → the canonical default
  // order (older editorials + the samples). The locked-close sections
  // (fromTheCouple + song) are pinned separately and are never in this list.
  sectionOrder?: string[] | null;
};

export type Review = {
  author: string;
  role: string | null; // 'guest' | 'vendor' | 'couple' | free text
  quote: string;
  stars: number | null; // 1-5
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function asString(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  return null;
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Pull a city-ish token out of a free-text venue name/address. */
function deriveCity(venueName: string | null, venueAddress: string | null): string | null {
  const addr = venueAddress?.trim();
  if (addr) {
    // Heuristic: take the segment before the last comma, or the last comma part
    // if it looks like a city (no digits). Comma-delimited PH addresses usually
    // read "<street>, <city>, <region>".
    const parts = addr
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      // Prefer the 2nd-from-last segment (commonly the city/municipality).
      const candidate = parts[parts.length - 2];
      if (candidate && !/^\d+$/.test(candidate)) return candidate;
    }
    const only = parts[0];
    if (parts.length === 1 && only && !/^\d/.test(only)) return only;
  }
  const name = venueName?.trim();
  if (name) {
    // If the venue name itself ends in ", City" use that.
    const parts = name.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 1] ?? null;
  }
  return null;
}

/** Best-effort first-name pair for the headline, e.g. "Maria & Juan". */
function deriveFirstNames(displayName: string): string {
  const cleaned = displayName.replace(/\s*\([^)]*\)\s*/g, '').trim();
  const parts = cleaned
    .split(/\s*(?:&|and|\+|\/)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.split(/\s+/)[0] ?? '';
    const b = parts[1]?.split(/\s+/)[0] ?? '';
    if (a && b) return `${a} & ${b}`;
  }
  return cleaned || displayName;
}

function formatPhDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return null;
  }
}

/**
 * A chapter's clock-time kicker — e.g. "4:12 in the afternoon" / "8:03 in the
 * evening" — formatted in the Philippine local sense (Asia/Manila). This carries
 * NO factual claim about what the moment was (no "First Kiss"); it's a clock time
 * only. Returns null when there's no timestamp. Best-effort: any error → null.
 */
function formatClockKicker(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    // Read the 24-hour clock in Manila local time, then render a warm "h:mm in
    // the <part of day>" phrase. Intl handles the timezone shift for us.
    const parts = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const hour24 = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN);
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    if (!Number.isFinite(hour24)) return null;
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    let partOfDay: string;
    if (hour24 < 5) partOfDay = 'in the small hours';
    else if (hour24 < 12) partOfDay = 'in the morning';
    else if (hour24 < 17) partOfDay = 'in the afternoon';
    else if (hour24 < 21) partOfDay = 'in the evening';
    else partOfDay = 'at night';
    return `${hour12}:${minute} ${partOfDay}`;
  } catch {
    return null;
  }
}

/** Years between `together_since` (or love_story year) and the wedding. */
export function yearsTogether(togetherSince: string | null, eventDate: string | null): number | null {
  if (!togetherSince) return null;
  try {
    const start = new Date(togetherSince);
    const end = eventDate ? new Date(eventDate) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const yrs = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (yrs < 0.5) return null;
    return Math.round(yrs);
  } catch {
    return null;
  }
}

function computeArchetype(guests: number, perGuestSpend: number | null): Archetype {
  const scale: 'intimate' | 'grand' = guests > 0 && guests <= INTIMATE_MAX ? 'intimate' : 'grand';
  const spend: 'modest' | 'luxurious' | 'neutral' =
    perGuestSpend == null ? 'neutral' : perGuestSpend >= LUX_PER_GUEST ? 'luxurious' : 'modest';

  // 2×2 angle map. Modest/intimate is ALWAYS framed as intentional / hand-picked
  // / what-mattered — never "small" or "cheap". Neutral spend folds into the
  // warmer of the two (modest framing) so nothing reads as a judgement.
  const effectiveSpend = spend === 'neutral' ? 'modest' : spend;
  let key: ArchetypeKey;
  let label: string;
  if (scale === 'intimate' && effectiveSpend === 'modest') {
    key = 'hand-picked';
    label = 'Hand-picked';
  } else if (scale === 'intimate') {
    key = 'jewel-box';
    label = 'Jewel-box';
  } else if (effectiveSpend === 'modest') {
    key = 'big-hearted';
    label = 'Big-hearted';
  } else {
    key = 'sweeping';
    label = 'Sweeping';
  }
  return { key, label, scale, spend };
}

// ── Main loader ──────────────────────────────────────────────────────────────

export async function loadEditorialData(eventId: string): Promise<EditorialData | null> {
  // Sample editorial (iteration 0046 Real Weddings) — the curated Maria & Juan
  // fixture renders through THIS exact component (via the /realstories sample page),
  // so the sample always tracks the live editorial format. Returns without
  // touching the DB; real event ids fall straight through to the loader below.
  const sampleFixture = SAMPLE_EDITORIALS[eventId];
  if (sampleFixture) return sampleFixture();

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  // 1. The event (required). Without it there's no page.
  let event: Record<string, unknown> | null = null;
  try {
    const { data, error } = await admin
      .from('events')
      .select(
        'event_id, slug, display_name, event_date, venue_name, venue_address, monogram_text, monogram_color, love_story, special_message, together_since, story_tone, story_language, landing_page_hero_image_url, landing_page_hero_video_r2_key, our_photos, photo_wall_photos, pakanta_song_r2_key',
      )
      .eq('event_id', eventId)
      .maybeSingle();
    if (!error && data) event = data as Record<string, unknown>;
  } catch {
    event = null;
  }
  // `pakanta_song_r2_key` is a recently-applied column whose writer PR may still
  // be merging. If the select above failed only because the column is missing
  // (PostgREST 42703 / column-does-not-exist), retry WITHOUT it so the whole
  // editorial still loads — the song block degrades to the typed anchor.
  if (!event) {
    try {
      const { data } = await admin
        .from('events')
        .select(
          'event_id, slug, display_name, event_date, venue_name, venue_address, monogram_text, monogram_color, love_story, special_message, together_since, story_tone, story_language, landing_page_hero_image_url, landing_page_hero_video_r2_key, our_photos, photo_wall_photos',
        )
        .eq('event_id', eventId)
        .maybeSingle();
      if (data) event = data as Record<string, unknown>;
    } catch {
      event = null;
    }
  }
  if (!event) return null;

  const displayName = asString(event.display_name) ?? 'The Wedding';
  const eventDate = asString(event.event_date);

  // Edition No. — this wedding's number within its AWARDS CYCLE. The edition
  // year runs Nov 18 → Nov 17 (Vol. I = Nov 18 2026 → Nov 17 2027), so the count
  // window starts on the cycle's Nov-18 (not Jan 1). Counts the Setnayan
  // weddings in this cycle up to and including this date.
  // Best-effort: a missing date / failed count → null → masthead shows No. 1.
  let editionNo: number | null = null;
  if (eventDate) {
    try {
      const [y, m, d] = eventDate.split('-').map(Number);
      if (y && m && d) {
        const onOrAfterCutoff = m > 11 || (m === 11 && d >= 18); // Nov 18+
        const cycleStartYear = onOrAfterCutoff ? y : y - 1;
        const { count } = await admin
          .from('events')
          .select('event_id', { count: 'exact', head: true })
          .eq('event_type', 'wedding')
          .gte('event_date', `${cycleStartYear}-11-18`)
          .lte('event_date', eventDate);
        if (typeof count === 'number' && count > 0) editionNo = count;
      }
    } catch {
      editionNo = null;
    }
  }

  const venueName = asString(event.venue_name);
  const venueAddress = asString(event.venue_address);
  const venueCity = deriveCity(venueName, venueAddress);
  const monogramText = (asString(event.monogram_text) ?? deriveMonogramFallback(displayName)).slice(0, 12);
  const monogramColor = asString(event.monogram_color) ?? '#C5A059';
  const loveStory = asObject(event.love_story) as LoveStory;
  const specialMessage = asString(event.special_message);
  const togetherSince = asString(event.together_since) ?? asString(loveStory.together_since);
  const tone = normalizeTone(event.story_tone);

  // 2. The editorial snapshot (optional). Frozen impact metrics + composed copy.
  let editorial: Record<string, unknown> | null = null;
  try {
    const { data } = await admin
      .from('event_editorial')
      .select(
        'status, draft_json, impact_metrics, editorial_tone, hero_photo_id, essay_photo_ids, generated_at, published_at',
      )
      .eq('event_id', eventId)
      .maybeSingle();
    if (data) editorial = data as Record<string, unknown>;
  } catch {
    editorial = null;
  }

  const draftJson = asObject(editorial?.draft_json);
  const frozen = asObject(editorial?.impact_metrics);
  const published = asString(editorial?.status) === 'published';

  // 3. Guest counts (best-effort).
  let guests = 0;
  let attending = 0;
  let replied = 0;
  try {
    const { count: total } = await admin
      .from('guests')
      .select('guest_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('deleted_at', null);
    guests = total ?? 0;
  } catch {
    guests = 0;
  }
  try {
    const { count: att } = await admin
      .from('guests')
      .select('guest_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .eq('rsvp_status', 'attending');
    attending = att ?? 0;
  } catch {
    attending = 0;
  }
  try {
    const { count: rep } = await admin
      .from('guests')
      .select('guest_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .neq('rsvp_status', 'pending');
    replied = rep ?? 0;
  } catch {
    replied = 0;
  }

  // 4. Vendors + first-pick rate (best-effort). The first-pick + services
  // metrics count ALL event_vendors (the couple planned them all with
  // Setnayan, regardless of vendor tier). The DISPLAYED team list, however,
  // hides Free vendors and gives Pro/Enterprise a richer card — §3.
  const vendors: VendorCredit[] = [];
  let firstPickNum = 0;
  let firstPickDen = 0;
  try {
    const { data: rows } = await admin
      .from('event_vendors')
      .select('vendor_name, category, selection_match_rank, linked_vendor_profile_id')
      .eq('event_id', eventId);
    if (Array.isArray(rows)) {
      firstPickDen = rows.length;

      // Resolve linked marketplace profiles (tier + logo + slug) in one query.
      const profileIds = Array.from(
        new Set(
          rows
            .map((r) => asString((r as Record<string, unknown>).linked_vendor_profile_id))
            .filter((v): v is string => Boolean(v)),
        ),
      );
      const profiles = new Map<
        string,
        { tier: VendorCredit['tier']; logoUrl: string | null; slug: string | null }
      >();
      if (profileIds.length > 0) {
        try {
          const { data: profRows } = await admin
            .from('vendor_profiles')
            .select('vendor_profile_id, tier_state, logo_url, business_slug')
            .in('vendor_profile_id', profileIds);
          for (const p of (profRows ?? []) as Array<Record<string, unknown>>) {
            const id = asString(p.vendor_profile_id);
            if (!id) continue;
            const tierRaw = asString(p.tier_state);
            const tier = (['free', 'verified', 'solo', 'pro', 'enterprise', 'custom'] as const).find(
              (t) => t === tierRaw,
            ) ?? null;
            profiles.set(id, {
              tier,
              logoUrl: await displayUrlForStoredAsset(asString(p.logo_url)),
              slug: asString(p.business_slug),
            });
          }
        } catch {
          // no profiles → vendors render as plain credits
        }
      }

      for (const r of rows as Array<Record<string, unknown>>) {
        const isFirstPick = Number(r.selection_match_rank) === 1;
        if (isFirstPick) firstPickNum += 1;
        const name = asString(r.vendor_name);
        if (!name) continue;
        const prof = profiles.get(asString(r.linked_vendor_profile_id) ?? '');
        const tier = prof?.tier ?? null;
        // Simplicity Canon rule 2 (owner-ratified 2026-07-16): "Being credited
        // in a story is always free — editorial or chapter, any tier. You
        // never pay to be named in a story." This RETIRES the former Phase C
        // #4 treatment (Free hidden entirely; Verified/Solo plain-text-only) —
        // every credited vendor now gets the full tagged treatment. Still
        // reads the SSOT editorialTagged cap (now true across the matrix) so
        // any future owner reversal is one matrix edit, not a code hunt. The
        // name shown is the COUPLE's own vendor_name entry (their page, their
        // speech), unchanged from before.
        const tagged = tierCaps(tier).editorialTagged;
        vendors.push({
          name,
          category: asString(r.category),
          isFirstPick,
          tier,
          logoUrl: tagged ? prof?.logoUrl ?? null : null,
          slug: tagged ? prof?.slug ?? null : null,
        });
      }
    }
  } catch {
    // leave vendors empty
  }
  const servicesSetnayan = firstPickDen; // count of event_vendors = services planned with Setnayan

  // 5. Photos delivered (best-effort; omit if the count can't be had cheaply).
  // PUBLIC surface → exclude moderation-withheld captures (NSFW screen +
  // consent/faceblock verdicts). 'unscreened' still counts (fail-open).
  let photos: number | null = null;
  try {
    const { count, error } = await admin
      .from('papic_photos')
      .select('photo_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('hidden_at', null)
      .not(
        'moderation_state',
        'in',
        '("nsfw_blocked","consent_withheld","faceblock_withheld")',
      );
    if (!error && typeof count === 'number') photos = count;
  } catch {
    photos = null;
  }

  // 5-bis. Living-moments (Papic 5-second CLIPS) count — the count companion to
  // the photo count above, same fail-closed moderation filter. Feeds "By the
  // Numbers" (photos & moments sum + a living-moments cell). Best-effort → null
  // omits the clip stat, exactly like the photo stat.
  let clips: number | null = null;
  try {
    const { count, error } = await admin
      .from('papic_photos')
      .select('photo_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('photo_type', 'clip')
      .is('hidden_at', null)
      .not(
        'moderation_state',
        'in',
        '("nsfw_blocked","consent_withheld","faceblock_withheld")',
      );
    if (!error && typeof count === 'number') clips = count;
  } catch {
    clips = null;
  }

  // 5b. The day's Papic captures (best-effort, shared by hero + gallery +
  // essay). Clean, non-hidden, type 'photo' only (never a clip), most-recent
  // first. PUBLIC surface → moderation-withheld captures are excluded (same
  // verdict set as the photo COUNT above). A missing table/column (pre-Papic
  // event, 42P01/42703) degrades to an empty list → every consumer falls back
  // to its prior source exactly as before.
  type PapicRow = { photoId: string; key: string; capturedAt: string | null };
  let papicRows: PapicRow[] = [];
  try {
    const { data: rows, error } = await admin
      .from('papic_photos')
      // Derivative columns + full_res_dropped_at so the gallery still resolves to
      // the drop-durable web copy — the raw original 404s after the 90-day sweep
      // (a bug already LIVE on this public page).
      .select('photo_id, r2_object_key, display_r2_key, thumb_r2_key, full_res_dropped_at, captured_at')
      .eq('event_id', eventId)
      .eq('photo_type', 'photo')
      .is('hidden_at', null)
      .not(
        'moderation_state',
        'in',
        '("nsfw_blocked","consent_withheld","faceblock_withheld")',
      )
      .order('captured_at', { ascending: false })
      .limit(EDITORIAL_PAPIC_GALLERY_CAP);
    if (!error && Array.isArray(rows)) {
      papicRows = (rows as Array<Record<string, unknown>>)
        .map((r) => ({
          photoId: asString(r.photo_id),
          key: resolveStillRef({
            photo_type: 'photo',
            r2_object_key: asString(r.r2_object_key),
            display_r2_key: asString(r.display_r2_key),
            thumb_r2_key: asString(r.thumb_r2_key),
            full_res_dropped_at: asString(r.full_res_dropped_at),
          }),
          capturedAt: asString(r.captured_at) ?? null,
        }))
        .filter((r): r is PapicRow => Boolean(r.photoId && r.key));
    }
  } catch {
    papicRows = [];
  }

  // 5b-bis. The day's Papic 5-second CLIPS (photo_type='clip'). Same fail-closed
  // moderation filter as the photos above, ordered oldest-first so they slot into
  // the "As the Day Unfolded" timeline in the order they happened. The playable
  // ref resolves through resolvePlayRef (clip_web_r2_key ?? raw), so playback
  // prefers the small ~0.5 MB web copy and correctly drops a raw that PR-2 later
  // makes droppable; poster_r2_key is the freeze-frame (still, resolved
  // separately). A missing table/column (pre-Papic event) degrades to an empty list.
  type PapicClipRow = {
    photoId: string;
    key: string;
    posterKey: string | null;
    capturedAt: string | null;
  };
  let papicClipRows: PapicClipRow[] = [];
  try {
    const { data: rows, error } = await admin
      .from('papic_photos')
      .select('photo_id, r2_object_key, clip_web_r2_key, full_res_dropped_at, poster_r2_key, captured_at')
      .eq('event_id', eventId)
      .eq('photo_type', 'clip')
      .is('hidden_at', null)
      .not(
        'moderation_state',
        'in',
        '("nsfw_blocked","consent_withheld","faceblock_withheld")',
      )
      .order('captured_at', { ascending: true })
      .limit(EDITORIAL_PAPIC_CLIP_CAP);
    if (!error && Array.isArray(rows)) {
      papicClipRows = (rows as Array<Record<string, unknown>>)
        .map((r) => ({
          photoId: asString(r.photo_id),
          // Play ref (web copy preferred, drop-safe) — never the raw key directly.
          key: resolvePlayRef({
            photo_type: 'clip',
            r2_object_key: asString(r.r2_object_key),
            clip_web_r2_key: asString(r.clip_web_r2_key),
            full_res_dropped_at: asString(r.full_res_dropped_at),
          }),
          posterKey: asString(r.poster_r2_key) ?? null,
          capturedAt: asString(r.captured_at) ?? null,
        }))
        .filter((r): r is PapicClipRow => Boolean(r.photoId && r.key));
    }
  } catch {
    papicClipRows = [];
  }

  // 5b-ter. The day's Papic PHOTOS for the "As the Day Unfolded" timeline — a
  // SEPARATE, wider read from the recency-capped gallery slice above. The gallery
  // query is `captured_at DESC` limit 24 (evening-biased on a photo-heavy day),
  // but a story timeline needs the whole day's arc, so this reads `captured_at
  // ASC` across the event (cap 48) with the SAME fail-closed moderation filter.
  // Lightweight rows only (photo_id, key, captured_at) — buckets are built from
  // these FIRST, and only the ≤3 media each chapter uses get presigned later.
  type TimelinePhotoRow = { photoId: string; key: string; capturedAt: string | null };
  let timelinePhotoRows: TimelinePhotoRow[] = [];
  try {
    const { data: rows, error } = await admin
      .from('papic_photos')
      .select('photo_id, r2_object_key, captured_at')
      .eq('event_id', eventId)
      .eq('photo_type', 'photo')
      .is('hidden_at', null)
      .not(
        'moderation_state',
        'in',
        '("nsfw_blocked","consent_withheld","faceblock_withheld")',
      )
      .order('captured_at', { ascending: true })
      .limit(EDITORIAL_TIMELINE_PHOTO_CAP);
    if (!error && Array.isArray(rows)) {
      timelinePhotoRows = (rows as Array<Record<string, unknown>>)
        .map((r) => ({
          photoId: asString(r.photo_id),
          key: asString(r.r2_object_key),
          capturedAt: asString(r.captured_at) ?? null,
        }))
        .filter((r): r is TimelinePhotoRow => Boolean(r.photoId && r.key));
    }
  } catch {
    timelinePhotoRows = [];
  }

  // 5b-quater. Papic GUEST captures (papic_guest_captures — the disposable-camera
  // SKU) join the day. PUBLIC surface → these fail closed on the SAME double gate
  // the Alaala public showcase enforces (lib/alaala-orb.ts): a guest photo surfaces
  // ONLY when the GUEST opted in (consent_to_public) AND the couple picked it
  // (couple_approved_for_showcase) AND it isn't hidden. This table carries NO NSFW
  // moderation_state — the two approval/consent gates ARE its public gate, so we
  // never include a raw/unapproved guest shot. Photos only (media_type='photo';
  // guest clips stay to the Alaala orb path). A missing table/column (pre-SKU
  // event, 42P01/42703) degrades to [] → the day is exactly Papic-only as before.
  // These are UNIONED into both the recency gallery slice and the captured_at-ASC
  // timeline below; deduped by r2 key against papic_photos just in case.
  type GuestCaptureRow = { captureId: string; key: string; capturedAt: string | null };
  let guestGalleryRows: GuestCaptureRow[] = [];
  let guestTimelineRows: GuestCaptureRow[] = [];
  try {
    // Recency slice (gallery) — captured_at DESC, same cap as the seat photos.
    // Guest photos are dropped by the same 90-day sweep, so resolve to the
    // drop-durable still (this block merges into papicRows, presigned below).
    const { data: rows, error } = await admin
      .from('papic_guest_captures')
      .select('capture_id, r2_object_key, display_r2_key, thumb_r2_key, full_res_dropped_at, captured_at')
      .eq('event_id', eventId)
      .eq('media_type', 'photo')
      .eq('consent_to_public', true)
      .eq('couple_approved_for_showcase', true)
      .is('hidden_at', null)
      .order('captured_at', { ascending: false })
      .limit(EDITORIAL_PAPIC_GALLERY_CAP);
    if (!error && Array.isArray(rows)) {
      guestGalleryRows = (rows as Array<Record<string, unknown>>)
        .map((r) => ({
          captureId: asString(r.capture_id),
          key: resolveStillRef({
            media_type: 'photo',
            r2_object_key: asString(r.r2_object_key),
            display_r2_key: asString(r.display_r2_key),
            thumb_r2_key: asString(r.thumb_r2_key),
            full_res_dropped_at: asString(r.full_res_dropped_at),
          }),
          capturedAt: asString(r.captured_at) ?? null,
        }))
        .filter((r): r is GuestCaptureRow => Boolean(r.captureId && r.key));
    }
  } catch {
    guestGalleryRows = [];
  }
  try {
    // Timeline sweep — captured_at ASC across the day, same cap as seat timeline.
    const { data: rows, error } = await admin
      .from('papic_guest_captures')
      .select('capture_id, r2_object_key, captured_at')
      .eq('event_id', eventId)
      .eq('media_type', 'photo')
      .eq('consent_to_public', true)
      .eq('couple_approved_for_showcase', true)
      .is('hidden_at', null)
      .order('captured_at', { ascending: true })
      .limit(EDITORIAL_TIMELINE_PHOTO_CAP);
    if (!error && Array.isArray(rows)) {
      guestTimelineRows = (rows as Array<Record<string, unknown>>)
        .map((r) => ({
          captureId: asString(r.capture_id),
          key: asString(r.r2_object_key),
          capturedAt: asString(r.captured_at) ?? null,
        }))
        .filter((r): r is GuestCaptureRow => Boolean(r.captureId && r.key));
    }
  } catch {
    guestTimelineRows = [];
  }

  // Merge guest captures into the seat-photo lists, deduped by r2 key (a guest
  // shot should never collide with a seat shot, but guard anyway), then re-cap.
  // GALLERY: union then re-sort by captured_at DESC, cap at the gallery cap.
  if (guestGalleryRows.length > 0) {
    const seenKeys = new Set(papicRows.map((r) => r.key));
    const merged = [
      ...papicRows,
      ...guestGalleryRows
        .filter((g) => !seenKeys.has(g.key))
        .map((g) => ({ photoId: g.captureId, key: g.key, capturedAt: g.capturedAt })),
    ];
    merged.sort((a, b) => {
      const at = a.capturedAt ? new Date(a.capturedAt).getTime() : Number.NaN;
      const bt = b.capturedAt ? new Date(b.capturedAt).getTime() : Number.NaN;
      const aN = Number.isNaN(at);
      const bN = Number.isNaN(bt);
      if (aN && bN) return 0;
      if (aN) return 1;
      if (bN) return -1;
      return bt - at; // DESC (most-recent first, like the seat gallery)
    });
    papicRows = merged.slice(0, EDITORIAL_PAPIC_GALLERY_CAP);
  }
  // TIMELINE: union guest photos into the seat timeline rows, dedupe by key, cap
  // at 48 total across both tables (final sort happens in the timeline builder).
  if (guestTimelineRows.length > 0) {
    const seenKeys = new Set(timelinePhotoRows.map((r) => r.key));
    const mergedTimeline = [
      ...timelinePhotoRows,
      ...guestTimelineRows
        .filter((g) => !seenKeys.has(g.key))
        .map((g) => ({ photoId: g.captureId, key: g.key, capturedAt: g.capturedAt })),
    ];
    // Cap by captured_at ASC (untimed sink last) so the 48-cap keeps the day's arc.
    mergedTimeline.sort((a, b) => {
      const at = a.capturedAt ? new Date(a.capturedAt).getTime() : Number.NaN;
      const bt = b.capturedAt ? new Date(b.capturedAt).getTime() : Number.NaN;
      const aN = Number.isNaN(at);
      const bN = Number.isNaN(bt);
      if (aN && bN) return 0;
      if (aN) return 1;
      if (bN) return -1;
      return at - bt;
    });
    timelinePhotoRows = mergedTimeline.slice(0, EDITORIAL_TIMELINE_PHOTO_CAP);
  }

  // Presign the Papic captures once; reused by gallery + essay (and the hero
  // auto-pick reads from the same ordered list).
  const papicUrlByPhotoId = new Map<string, string>();
  // Still ref (derivative) per photo id — reused by the OG hero to build a
  // crawler-durable stable media URL (heroStableUrl below).
  const papicStillRefByPhotoId = new Map<string, string>();
  if (papicRows.length > 0) {
    const urls = await Promise.all(papicRows.map((r) => displayUrlForStoredAsset(r.key)));
    papicRows.forEach((r, i) => {
      const u = urls[i];
      if (u) papicUrlByPhotoId.set(r.photoId, u);
      papicStillRefByPhotoId.set(r.photoId, r.key);
    });
  }
  // Ordered list of presigned Papic photo URLs (most-recent first), de-duped.
  const papicGalleryUrls = papicRows
    .map((r) => papicUrlByPhotoId.get(r.photoId))
    .filter((u): u is string => Boolean(u));

  // 6. Hero photo (OPTIONAL). Resolve event_editorial.hero_photo_id → R2 key →
  // presigned URL. Skips silently on any error.
  let heroPhotoUrl: string | null = null;
  // The stored ref the hero resolved from — Papic paths only. Powers a stable,
  // crawler-durable OG media URL (heroStableUrl below). Couple-upload / website
  // heroes aren't touched by the 90-day full-res drop, so they leave this null
  // and OG falls back to the presigned heroPhotoUrl (unchanged behaviour).
  let heroRef: string | null = null;

  // 6-pre. Couple-uploaded hero cover (FREE · draft_json.heroUpload). An EXPLICIT
  // couple pick WINS over the Papic auto-pick + the website-hero fallback (the
  // couple chose this cover deliberately), and — crucially — renders even with
  // zero Papic, giving a no-Papic editorial a real cover. Resolved first; when it
  // resolves, the Papic/website hero paths below are skipped (they only fill a
  // still-null heroPhotoUrl). Best-effort: a bad/absent ref just falls through.
  const heroUploadRef = asString(draftJson.heroUpload);
  if (heroUploadRef) {
    try {
      heroPhotoUrl = await displayUrlForStoredAsset(heroUploadRef);
    } catch {
      heroPhotoUrl = null;
    }
  }

  const heroPhotoId = asString(editorial?.hero_photo_id);
  if (!heroPhotoUrl && heroPhotoId) {
    try {
      // PUBLIC surface → a moderation-withheld capture never renders as the
      // hero, even if the couple picked it before the screen finished. The
      // couple can restore it via the moderation page's "Approve" override
      // (sets 'clean'), after which it resolves again.
      const { data: photoRow } = await admin
        .from('papic_photos')
        .select('r2_object_key, display_r2_key, thumb_r2_key, full_res_dropped_at, photo_type')
        .eq('photo_id', heroPhotoId)
        .eq('event_id', eventId)
        .not(
          'moderation_state',
          'in',
          '("nsfw_blocked","consent_withheld","faceblock_withheld")',
        )
        .maybeSingle();
      const pr = photoRow as Record<string, unknown> | null;
      const ptype = asString(pr?.photo_type);
      if (ptype !== 'clip') {
        // Drop-durable still — the raw original 404s for this OG hero after the
        // 90-day sweep; the derivative survives.
        const stillRef = resolveStillRef({
          photo_type: 'photo',
          r2_object_key: asString(pr?.r2_object_key),
          display_r2_key: asString(pr?.display_r2_key),
          thumb_r2_key: asString(pr?.thumb_r2_key),
          full_res_dropped_at: asString(pr?.full_res_dropped_at),
        });
        if (stillRef) {
          heroPhotoUrl = await displayUrlForStoredAsset(stillRef);
          heroRef = stillRef;
        }
      }
    } catch {
      heroPhotoUrl = null;
    }
  }
  // Fallback A — AUTO-PICK from the day. When the couple never curated an
  // editorial hero (the normal case — hero_photo_id has no writer yet), lead
  // the recap with a REPRESENTATIVE Papic capture rather than only the website
  // hero. Deterministic pick: the most-tagged clean photo (the one with the
  // most people in it reads as the cover), tie-broken by recency (papicRows is
  // already most-recent-first). Read-time only — no writer, no migration. A
  // missing tags table (42P01) → fall through to the first/most-recent capture.
  if (!heroPhotoUrl && papicRows.length > 0) {
    let heroKey: string | null = papicRows[0]?.photoId ?? null; // default: most recent
    try {
      const photoIds = papicRows.map((r) => r.photoId);
      const { data: tagRows, error } = await admin
        .from('photo_tags')
        .select('source_id')
        .eq('event_id', eventId)
        .eq('source_table', 'papic_photos')
        .in('source_id', photoIds);
      if (!error && Array.isArray(tagRows) && tagRows.length > 0) {
        const counts = new Map<string, number>();
        for (const t of tagRows as Array<Record<string, unknown>>) {
          const id = asString(t.source_id);
          if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
        }
        // Pick the max-tagged photo, scanning papicRows in recency order so
        // ties resolve to the most recent — a stable, deterministic choice.
        let best = heroKey;
        let bestCount = best ? counts.get(best) ?? 0 : -1;
        for (const r of papicRows) {
          const c = counts.get(r.photoId) ?? 0;
          if (c > bestCount) {
            bestCount = c;
            best = r.photoId;
          }
        }
        heroKey = best;
      }
    } catch {
      // tags unavailable → keep the most-recent default
    }
    if (heroKey) {
      heroPhotoUrl = papicUrlByPhotoId.get(heroKey) ?? null;
      heroRef = papicStillRefByPhotoId.get(heroKey) ?? null;
    }
  }
  // Fallback B: still no hero → reuse the couple's website hero image so the
  // editorial still leads with a photo. displayUrlForStoredAsset passes
  // plain/relative URLs through unchanged.
  if (!heroPhotoUrl) {
    heroPhotoUrl = await displayUrlForStoredAsset(
      asString((event as Record<string, unknown>).landing_page_hero_image_url),
    );
  }

  // OG / crawler durability: when the hero resolved from a Papic ref, point the
  // share-card render at the STABLE streaming media route (app/papic/media) — an
  // absolute, signature-less URL that streams bytes and survives a presign
  // expiry — instead of a 24h presign. Null for legacy / website heroes (OG then
  // uses the presigned heroPhotoUrl, unchanged).
  const heroStablePath = stableMediaPath(heroRef);
  const heroStableUrl =
    heroStablePath && heroStablePath.startsWith('/papic/media/')
      ? `${(process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(/\/$/, '')}${heroStablePath}`
      : null;

  // 6a-bis. Living-hero boomerang (events.landing_page_hero_video_r2_key). The
  // Living Hero Studio already bakes the couple's pick into a forward+reverse
  // ping-pong MP4; reuse it as the editorial's GIF-like moving hero, posterized
  // by heroPhotoUrl. Additive: null → the editorial hero stays the still photo.
  const heroVideoUrl = await displayUrlForStoredAsset(
    asString((event as Record<string, unknown>).landing_page_hero_video_r2_key),
  );

  // 6b. Shared photo gallery (events.our_photos → display URLs). Each ref goes
  // through displayUrlForStoredAsset (presigns r2://, passes plain/relative
  // URLs through). Best-effort.
  const galleryRefs = Array.isArray((event as Record<string, unknown>).our_photos)
    ? ((event as Record<string, unknown>).our_photos as unknown[]).filter(
        (r): r is string => typeof r === 'string' && r.trim().length > 0,
      )
    : [];
  const manualGalleryPhotos = (
    await Promise.all(galleryRefs.map((ref) => displayUrlForStoredAsset(ref)))
  ).filter((u): u is string => Boolean(u));
  // Couple-uploaded editorial gallery photos (FREE · draft_json.galleryUploads).
  // These feed ONLY this gallery grid — never the essayPhotos / dayChapters
  // photo-essay spread (which stays Papic-only and drops to null without Papic).
  // Kept FIRST (the couple curated them), HARD-capped at 30 (the writer also caps
  // server-side; this is the read-side backstop). Best-effort resolution.
  const GALLERY_UPLOADS_MAX = 30;
  const galleryUploadRefs = Array.isArray(draftJson.galleryUploads)
    ? (draftJson.galleryUploads as unknown[])
        .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
        .slice(0, GALLERY_UPLOADS_MAX)
    : [];
  const coupleGalleryPhotos = (
    await Promise.all(galleryUploadRefs.map((ref) => displayUrlForStoredAsset(ref)))
  ).filter((u): u is string => Boolean(u));

  // UNION the couple's editorial uploads (lead, kept first), then their manual
  // website uploads, then a recent slice of the day's clean Papic captures. A
  // couple who shot the day with Papic gets a real gallery even with zero manual
  // uploads; one who uploaded manually keeps those first and gains the day's
  // candids after. De-dup by URL. When both couple sources are empty and Papic
  // is empty this collapses to [] — exactly today's behaviour.
  const galleryPhotos = Array.from(
    new Set([...coupleGalleryPhotos, ...manualGalleryPhotos, ...papicGalleryUrls]),
  );

  // 6c. Live Photo Wall (events.photo_wall_photos → display URLs), surfaced
  // only when the couple availed the LIVE_WALL SKU. Same resolver as the
  // gallery. Best-effort: a missing activation table just hides the section.
  const wallRefs = Array.isArray((event as Record<string, unknown>).photo_wall_photos)
    ? ((event as Record<string, unknown>).photo_wall_photos as unknown[]).filter(
        (r): r is string => typeof r === 'string' && r.trim().length > 0,
      )
    : [];
  const photoWallPhotos = (
    await Promise.all(wallRefs.map((ref) => displayUrlForStoredAsset(ref)))
  ).filter((u): u is string => Boolean(u));
  let photoWallActive = false;
  if (photoWallPhotos.length > 0) {
    try {
      // Ownership reads off orders.status via eventOwnsSku() (PR4 dead-unlock
      // repair, 2026-06-15) — bundle-aware, so a Media Pack buyer's editorial
      // photo-wall section surfaces too. The old event_software_activations_v2
      // read had no payment-path writer.
      photoWallActive = await eventSkuActive(admin, eventId, 'LIVE_WALL');
    } catch {
      photoWallActive = false;
    }
  }

  // 6c-bis. Pabati video guestbook (pabati_clips → presigned clip URLs),
  // surfaced only when the couple availed the PABATI SKU. Mirrors the photo-wall
  // gate: fetch FIRST (so an unowned event pays nothing on the gate read when
  // there are no clips), then bundle-aware eventSkuActive('PABATI'). FAILS
  // CLOSED — only moderation_state='clean' + non-hidden clips show (never
  // 'unscreened' or '*_blocked'), so a posterless/unscreened greeting never
  // projects on the public recap. Best-effort: a missing table yields [].
  let pabatiClips: string[] = [];
  let pabatiActive = false;
  try {
    const { data: clipRows } = await admin
      .from('pabati_clips')
      .select('r2_object_key, captured_at')
      .eq('event_id', eventId)
      .eq('moderation_state', 'clean')
      .is('hidden_at', null)
      .order('captured_at', { ascending: true });
    const refs = ((clipRows ?? []) as Array<{ r2_object_key: string | null }>)
      .map((r) => r.r2_object_key)
      .filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
    if (refs.length > 0) {
      pabatiClips = (
        await Promise.all(refs.map((ref) => displayUrlForStoredAsset(ref)))
      ).filter((u): u is string => Boolean(u));
      if (pabatiClips.length > 0) {
        pabatiActive = await eventSkuActive(admin, eventId, 'PABATI');
      }
    }
  } catch {
    pabatiClips = [];
    pabatiActive = false;
  }

  // 6d. "From Your Vendors" — day-of media the couple's RECOMMENDED vendor
  // submitted (editorial_vendor_media). Public surface, so it FAILS CLOSED:
  // only moderation_state='clean' shows (never 'unscreened' — third-party
  // content is held until the NSFW screen settles), never couple-hidden, and
  // the recommended-pick gate is RE-CHECKED LIVE (the row's event_vendor still
  // has selection_match_rank = 1) so swapping the vendor drops their media.
  // Best-effort: a missing table (pre-migration) yields [].
  const vendorMedia: VendorMediaItem[] = [];
  try {
    const { data: rows } = await admin
      .from('editorial_vendor_media')
      .select(
        'media_id, event_vendor_id, media_type, boomerang_r2_key, still_r2_key, caption, sort_order',
      )
      .eq('event_id', eventId)
      .eq('moderation_state', 'clean')
      .eq('hidden_by_couple', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    const mediaRows = (rows ?? []) as Array<Record<string, unknown>>;
    if (mediaRows.length > 0) {
      // Live recommended-pick re-check: keep only rows whose event_vendor is
      // still selection_match_rank = 1. Resolve names/categories in one read.
      const evIds = Array.from(
        new Set(mediaRows.map((r) => asString(r.event_vendor_id)).filter((v): v is string => !!v)),
      );
      const recommended = new Map<string, { name: string | null; category: string | null }>();
      if (evIds.length > 0) {
        try {
          const { data: evRows } = await admin
            .from('event_vendors')
            .select('vendor_id, selection_match_rank, vendor_name, category')
            .in('vendor_id', evIds)
            .eq('selection_match_rank', 1);
          for (const ev of (evRows ?? []) as Array<Record<string, unknown>>) {
            const id = asString(ev.vendor_id);
            if (id) recommended.set(id, { name: asString(ev.vendor_name), category: asString(ev.category) });
          }
        } catch {
          // no event_vendors read → nothing is provably recommended → show none
        }
      }
      for (const r of mediaRows) {
        const evId = asString(r.event_vendor_id);
        const rec = evId ? recommended.get(evId) : undefined;
        if (!rec) continue; // not (or no longer) the recommended pick → hide
        const type = asString(r.media_type) === 'clip' ? 'clip' : 'photo';
        const still = await displayUrlForStoredAsset(asString(r.still_r2_key));
        if (!still) continue; // no still → can't render (and it's the NSFW proxy)
        const boomerang =
          type === 'clip' ? await displayUrlForStoredAsset(asString(r.boomerang_r2_key)) : null;
        if (type === 'clip' && !boomerang) continue; // clip with no baked boomerang → skip
        vendorMedia.push({
          vendorName: rec.name ?? 'Your vendor',
          category: rec.category,
          type,
          stillUrl: still,
          boomerangUrl: boomerang,
          caption: asString(r.caption),
        });
      }
    }
  } catch {
    // table absent (pre-migration) or any error → no vendor strip
  }

  // 7. Reviews (best-effort). Seeded via event_editorial.draft_json.reviews
  // until the §3 event-bound review system ships.
  const reviews: Review[] = [];
  const rawReviews = (draftJson as Record<string, unknown>).reviews;
  if (Array.isArray(rawReviews)) {
    for (const r of rawReviews as Array<Record<string, unknown>>) {
      const quote = asString(r.quote);
      const author = asString(r.author);
      if (!quote || !author) continue;
      const starsRaw = Number(r.stars);
      reviews.push({
        author,
        role: asString(r.role),
        quote,
        stars: Number.isFinite(starsRaw) && starsRaw > 0 ? Math.round(starsRaw) : null,
      });
    }
  }

  // 8. In-app Setnayan services availed (paid orders → display labels).
  const servicesAvailed: string[] = [];
  try {
    const { data: orderRows } = await admin
      .from('orders')
      .select('service_key, status')
      .eq('event_id', eventId)
      .not('status', 'in', '("draft","cancelled","refunded","lapsed")');
    const seen = new Set<string>();
    for (const o of (orderRows ?? []) as Array<Record<string, unknown>>) {
      const key = asString(o.service_key);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      servicesAvailed.push(SERVICE_LABELS[key] ?? prettyServiceKey(key));
    }
    servicesAvailed.sort((a, b) => a.localeCompare(b));
  } catch {
    // leave empty
  }

  // ── Impact metrics: prefer frozen values, else compute live ────────────────
  const rsvpPct = guests > 0 ? Math.round((replied / guests) * 100) : null;
  const hoursSaved =
    typeof frozen.time_saved_hrs === 'number'
      ? (frozen.time_saved_hrs as number)
      : servicesSetnayan * TIME_SAVED_PER_VENDOR_HOURS + TIME_SAVED_BASE_HOURS;

  const metrics: ImpactMetrics = {
    servicesSetnayan: numOr(frozen.services_setnayan, servicesSetnayan),
    servicesTotalDenominator: typeof frozen.services_total === 'number' ? (frozen.services_total as number) : null,
    firstPickNum: numOr(frozen.firstpick_num, firstPickNum),
    firstPickDen: numOr(frozen.firstpick_den, firstPickDen),
    hoursSaved,
    guests: numOr(frozen.guests, guests),
    attending,
    replied,
    rsvpPct: typeof frozen.rsvp_pct === 'number' ? (frozen.rsvp_pct as number) : rsvpPct,
    photos: typeof frozen.photos === 'number' ? (frozen.photos as number) : photos,
    clips: typeof frozen.clips === 'number' ? (frozen.clips as number) : clips,
    // `chapters` is finalized after the timeline is built (dayChapters.length);
    // prefer a frozen value when present, else fill from the live count below.
    chapters: typeof frozen.chapters === 'number' ? (frozen.chapters as number) : null,
  };

  // Per-guest spend is not cheaply available (vendor money is off-platform by
  // design). Leave it null → archetype spend axis stays neutral. Hook point if
  // a defensible per-guest figure ever lands in impact_metrics.
  const perGuestSpend = typeof frozen.per_guest_spend === 'number' ? (frozen.per_guest_spend as number) : null;
  const archetype = computeArchetype(metrics.guests, perGuestSpend);

  // Vendors the couple explicitly recommended (vendor_recommendations · §6.3).
  // Best-effort like every other block — a missing/legacy table degrades to [].
  let vendorsWeLoved: EventRecommendation[] = [];
  try {
    vendorsWeLoved = await fetchEventRecommendations(admin, eventId);
  } catch {
    vendorsWeLoved = [];
  }

  // ── The 10 moments / photo-essay spread ─────────────────────────────────────
  // Prefer the curated event_editorial.essay_photo_ids when present (resolve
  // each id → Papic key → presigned URL). It has no writer yet, so the normal
  // case is empty → best-effort auto-fill from the day's Papic captures (a
  // reasonable spread, capped). Read-time only — no per-moment mapping.
  let essayPhotos: string[] = [];
  const essayIdsRaw = (editorial as Record<string, unknown> | null)?.essay_photo_ids;
  const essayIds = Array.isArray(essayIdsRaw)
    ? (essayIdsRaw as unknown[])
        .map((v) => asString(v))
        .filter((v): v is string => Boolean(v))
    : [];
  if (essayIds.length > 0) {
    // Resolve curated picks in their chosen order. Reuse the already-presigned
    // gallery map where it overlaps; presign any ids outside the gallery slice.
    const missing = essayIds.filter((id) => !papicUrlByPhotoId.has(id));
    if (missing.length > 0) {
      try {
        const { data: rows } = await admin
          .from('papic_photos')
          .select('photo_id, r2_object_key')
          .eq('event_id', eventId)
          .in('photo_id', missing)
          .not(
            'moderation_state',
            'in',
            '("nsfw_blocked","consent_withheld","faceblock_withheld")',
          )
          .is('hidden_at', null);
        for (const r of (rows ?? []) as Array<Record<string, unknown>>) {
          const id = asString(r.photo_id);
          const key = asString(r.r2_object_key);
          if (!id || !key) continue;
          const u = await displayUrlForStoredAsset(key);
          if (u) papicUrlByPhotoId.set(id, u);
        }
      } catch {
        // leave unresolved ids out
      }
    }
    essayPhotos = essayIds
      .map((id) => papicUrlByPhotoId.get(id))
      .filter((u): u is string => Boolean(u));
  }
  if (essayPhotos.length === 0) {
    // Auto-fill: a spread of the day's captures. Spaced across the recency-
    // ordered set when there are more captures than slots, so the essay isn't
    // just the same first few photos the gallery leads with.
    if (papicGalleryUrls.length <= EDITORIAL_PAPIC_ESSAY_CAP) {
      essayPhotos = papicGalleryUrls.slice(0, EDITORIAL_PAPIC_ESSAY_CAP);
    } else {
      const step = papicGalleryUrls.length / EDITORIAL_PAPIC_ESSAY_CAP;
      const spread: string[] = [];
      for (let i = 0; i < EDITORIAL_PAPIC_ESSAY_CAP; i += 1) {
        const u = papicGalleryUrls[Math.floor(i * step)];
        if (u && !spread.includes(u)) spread.push(u);
      }
      essayPhotos = spread;
    }
  }

  // ── "As the Day Unfolded" living-story chapters ──────────────────────────────
  // Weave the day's clean photos (the WIDE captured_at-ASC timeline read, not the
  // recency-capped gallery slice) + 5-second clips into ONE captured_at-ASC
  // timeline, then bucket into up to 10 chapters by an even time-order split. Each
  // chapter leads with a clip when its bucket has one (else the most-tagged photo,
  // mirroring the hero auto-pick), plus ≤2 supporting photos. We bucket from RAW
  // rows first, then presign ONLY the media each chapter actually uses (≤3/chapter
  // → ≤30 total), so a heavily-shot wedding never presigns all 48 timeline photos.
  // On top of the auto floor, the couple's `chapterOverrides` (draft_json) rename,
  // reorder, hide, or add a write-up to any chapter — targeted by the lead's
  // photo_id. Read-time only — no writer, no migration. Empty → renderer keeps the
  // legacy essay.
  let dayChapters: DayChapter[] = [];

  // Best-effort tag counts for the TIMELINE photos → prefer the most-tagged photo
  // as a chapter's lead (the frame with the most people reads as the key image),
  // exactly like the hero auto-pick. A missing tags table (42P01) → all zero, and
  // buckets fall back to first-in-bucket order.
  const photoTagCount = new Map<string, number>();
  if (timelinePhotoRows.length > 0) {
    try {
      const { data: tagRows, error } = await admin
        .from('photo_tags')
        .select('source_id')
        .eq('event_id', eventId)
        .eq('source_table', 'papic_photos')
        .in(
          'source_id',
          timelinePhotoRows.map((r) => r.photoId),
        );
      if (!error && Array.isArray(tagRows)) {
        for (const t of tagRows as Array<Record<string, unknown>>) {
          const id = asString(t.source_id);
          if (id) photoTagCount.set(id, (photoTagCount.get(id) ?? 0) + 1);
        }
      }
    } catch {
      // untagged fallback → first-in-bucket ordering
    }
  }

  // A RAW timeline item — NO presigned URL yet (that happens after bucketing, for
  // the chosen media only). Photos carry an id + tag count; clips carry the R2
  // keys they'll presign to. `ts` is captured_at ms (NaN when absent → sorts last
  // so timestamped media leads the timeline).
  type RawTimelineItem = {
    kind: 'photo' | 'clip';
    photoId: string;
    key: string;
    posterKey: string | null;
    ts: number;
    tsRaw: string | null;
    tagCount: number;
  };
  const tsMs = (raw: string | null): number => {
    if (!raw) return Number.NaN;
    const n = new Date(raw).getTime();
    return Number.isFinite(n) ? n : Number.NaN;
  };
  const rawTimeline: RawTimelineItem[] = [];
  for (const r of timelinePhotoRows) {
    rawTimeline.push({
      kind: 'photo',
      photoId: r.photoId,
      key: r.key,
      posterKey: null,
      ts: tsMs(r.capturedAt),
      tsRaw: r.capturedAt,
      tagCount: photoTagCount.get(r.photoId) ?? 0,
    });
  }
  for (const r of papicClipRows) {
    rawTimeline.push({
      kind: 'clip',
      photoId: r.photoId,
      key: r.key,
      posterKey: r.posterKey,
      ts: tsMs(r.capturedAt),
      tsRaw: r.capturedAt,
      tagCount: 0,
    });
  }
  // captured_at ASC; rows without a timestamp (NaN) sink to the end.
  rawTimeline.sort((a, b) => {
    const aN = Number.isNaN(a.ts);
    const bN = Number.isNaN(b.ts);
    if (aN && bN) return 0;
    if (aN) return 1;
    if (bN) return -1;
    return a.ts - b.ts;
  });

  // A "chapter plan" — the chosen lead + supporting items for a bucket, still by
  // reference to raw items (no presign yet). We collect all plans first, gather the
  // exact media to presign, then resolve URLs in one batch.
  type ChapterPlan = { lead: RawTimelineItem; supporting: RawTimelineItem[] };
  const planChapter = (bucket: RawTimelineItem[]): ChapterPlan | null => {
    const first = bucket[0];
    if (!first) return null;
    const firstClip = bucket.find((b) => b.kind === 'clip');
    // Lead = the earliest clip in the bucket (bucket is captured_at ASC), else the
    // most-tagged photo (tie → earliest, since reduce keeps the incumbent).
    const lead: RawTimelineItem = firstClip
      ? firstClip
      : bucket.reduce((best, cur) => (cur.tagCount > best.tagCount ? cur : best), first);
    const supporting = bucket.filter((b) => b !== lead && b.kind === 'photo').slice(0, 2);
    return { lead, supporting };
  };

  const plans: ChapterPlan[] = [];
  if (rawTimeline.length > 0) {
    if (rawTimeline.length < 4) {
      // Too few media to bucket meaningfully → one chapter per item.
      for (const it of rawTimeline) {
        const p = planChapter([it]);
        if (p) plans.push(p);
      }
    } else {
      // Even time-order split into ≤10 buckets (same decile approach as the essay
      // sampler). Only emit non-empty buckets → never an empty frame.
      const n = rawTimeline.length;
      const chapterCount = Math.min(EDITORIAL_DAY_CHAPTER_CAP, n);
      for (let i = 0; i < chapterCount; i += 1) {
        const start = Math.floor((i * n) / chapterCount);
        const end = Math.floor(((i + 1) * n) / chapterCount);
        if (end > start) {
          const p = planChapter(rawTimeline.slice(start, end));
          if (p) plans.push(p);
        }
      }
    }
  }

  // Presign ONLY the media the plans actually chose (≤3/chapter). One R2 key can
  // appear once; de-dup the resolve set. Reuse the already-presigned gallery URLs
  // where a timeline photo overlaps the recent slice, to save a presign.
  if (plans.length > 0) {
    const resolveKey = new Map<string, string | null>(); // key → presigned url
    const posterByKey = new Map<string, string | null>(); // clip key → poster url
    const keysToResolve = new Set<string>();
    for (const p of plans) {
      for (const it of [p.lead, ...p.supporting]) {
        const cached = it.kind === 'photo' ? papicUrlByPhotoId.get(it.photoId) : undefined;
        if (cached) resolveKey.set(it.key, cached);
        else keysToResolve.add(it.key);
      }
    }
    const uniqueKeys = Array.from(keysToResolve);
    const resolved = await Promise.all(uniqueKeys.map((k) => displayUrlForStoredAsset(k)));
    uniqueKeys.forEach((k, i) => resolveKey.set(k, resolved[i] ?? null));
    // Clip posters (only for lead clips — supporting are always photos).
    const posterKeys = Array.from(
      new Set(
        plans
          .map((p) => (p.lead.kind === 'clip' ? p.lead.posterKey : null))
          .filter((k): k is string => Boolean(k)),
      ),
    );
    const posters = await Promise.all(posterKeys.map((k) => displayUrlForStoredAsset(k)));
    posterKeys.forEach((k, i) => posterByKey.set(k, posters[i] ?? null));

    const toMedia = (it: RawTimelineItem): ChapterMedia | null => {
      const url = resolveKey.get(it.key);
      if (!url) return null;
      return {
        type: it.kind,
        url,
        posterUrl:
          it.kind === 'clip' && it.posterKey ? posterByKey.get(it.posterKey) ?? null : null,
        id: it.photoId,
      };
    };

    const autoChapters: DayChapter[] = [];
    for (const p of plans) {
      const leadMedia = toMedia(p.lead);
      if (!leadMedia) continue; // lead couldn't presign → drop the chapter
      const supporting = p.supporting
        .map(toMedia)
        .filter((m): m is ChapterMedia => Boolean(m));
      autoChapters.push({
        time: formatClockKicker(p.lead.tsRaw),
        title: null,
        writeUp: null,
        leadId: p.lead.photoId,
        media: [leadMedia, ...supporting],
      });
    }

    // Apply the couple's per-chapter curation (draft_json.chapterOverrides). When
    // any override exists it WINS (title/writeUp/hidden/reorder); the legacy
    // essay_photo_ids path below is skipped. Overrides referencing a leadId that
    // no longer maps to a live chapter are ignored gracefully.
    const overrides = readChapterOverrides(draftJson);
    if (overrides.length > 0) {
      const byLead = new Map(autoChapters.map((c) => [c.leadId, c] as const));
      const taken = new Set<string>();
      const ordered: DayChapter[] = [];
      // 1. Overridden chapters, in override-array order.
      for (const ov of overrides) {
        const chapter = byLead.get(ov.leadId);
        if (!chapter || taken.has(ov.leadId)) continue; // stale/dup → ignore
        taken.add(ov.leadId);
        if (ov.hidden === true) continue; // hidden → drop from the public render
        ordered.push({
          ...chapter,
          title: asString(ov.title) ?? chapter.title,
          writeUp: asString(ov.writeUp) ?? chapter.writeUp,
        });
      }
      // 2. Auto chapters NOT in the override array, in timeline order.
      for (const chapter of autoChapters) {
        if (chapter.leadId && taken.has(chapter.leadId)) continue;
        ordered.push(chapter);
      }
      dayChapters = ordered;
    } else if (essayIds.length > 0 && essayPhotos.length > 0) {
      // No overrides → the legacy curated essay path still wins over the auto
      // timeline: one chapter per curated essay photo, in order, no clips injected.
      // `time`/`leadId` are null (curated URLs carry no timeline identity here).
      dayChapters = essayPhotos.map((url) => ({
        time: null,
        title: null,
        writeUp: null,
        leadId: null,
        media: [{ type: 'photo', url, posterUrl: null, id: null }],
      }));
    } else {
      dayChapters = autoChapters;
    }
  } else if (essayIds.length > 0 && essayPhotos.length > 0) {
    // Zero Papic timeline media but a curated essay exists → render the curated
    // essay as chapters (matches prior behaviour).
    dayChapters = essayPhotos.map((url) => ({
      time: null,
      title: null,
      writeUp: null,
      leadId: null,
      media: [{ type: 'photo', url, posterUrl: null, id: null }],
    }));
  }
  // Fallback: zero Papic media AND curation empty → dayChapters stays [], and the
  // renderer keeps the legacy essay (built from manual `our_photos` above).

  // Backfill the "By the Numbers" chapters cell with the live count now that the
  // timeline is built (a frozen impact_metrics.chapters, when present, already
  // won). Only when there actually are chapters — else leave null → cell omitted.
  if (metrics.chapters == null && dayChapters.length > 0) {
    metrics.chapters = dayChapters.length;
  }

  // ── "What They Whispered" — Kwento guest wishes ──────────────────────────────
  // Approved, screen-cleared guest wishes (photo_messages). PUBLIC surface → FAILS
  // CLOSED exactly like every other editorial block: status='approved' +
  // moderation_state='clean' + author not publicly hidden. Ordered by submission
  // time, capped. Owner (2026-07-04): "kwento are messages with videos or photos"
  // — every wish anchors to a Papic capture (a photo OR a 5s clip), and the
  // editorial SHOWS that media beside the words. We resolve each anchor from its
  // source table under the SAME fail-closed gate that table uses on the public
  // surface, then presign only the resolved anchors:
  //   • source_table='papic_photos' → look up by source_id, moderation-withheld
  //     verdicts excluded (nsfw/consent/faceblock) + not hidden. photo_type tells
  //     photo vs clip; a clip carries a playable MP4 (r2_object_key) + poster.
  //   • source_table='papic_guest_captures' → look up by source_id under the
  //     disposable-camera public gate (consent_to_public AND
  //     couple_approved_for_showcase AND hidden_at IS NULL), consistent with the
  //     chapter timeline. media_type tells photo vs clip; display_r2_key is the
  //     playable/still, poster_r2_key the freeze-frame.
  // A blocked/hidden/ungated anchor (or a missing anchor row) → media=null → the
  // card renders text-only; the WORDS are still approved. Batched: ONE lookup per
  // table with `.in(...)`. The author's display name comes from the linked guest
  // row (photo_messages has no name column). A missing table/column (pre-Kwento
  // event, 42P01/42703) degrades to [] → section hidden.
  const kwentoQuotes: KwentoQuote[] = [];
  try {
    const { data: rows, error } = await admin
      .from('photo_messages')
      .select('body_text, guest_id, source_table, source_id, submitted_at')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .eq('moderation_state', 'clean')
      .eq('author_publicly_hidden', false)
      .order('submitted_at', { ascending: true })
      .limit(EDITORIAL_KWENTO_CAP);
    const msgRows = !error && Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
    if (msgRows.length > 0) {
      // Resolve author display names in one read (guests.display_name, else the
      // first+last name). Best-effort: no names → quotes render unattributed.
      const guestIds = Array.from(
        new Set(msgRows.map((r) => asString(r.guest_id)).filter((v): v is string => Boolean(v))),
      );
      const nameByGuest = new Map<string, string>();
      if (guestIds.length > 0) {
        try {
          const { data: gRows } = await admin
            .from('guests')
            .select('guest_id, display_name, first_name, last_name')
            .in('guest_id', guestIds);
          for (const g of (gRows ?? []) as Array<Record<string, unknown>>) {
            const id = asString(g.guest_id);
            if (!id) continue;
            const name =
              asString(g.display_name) ??
              [asString(g.first_name), asString(g.last_name)].filter(Boolean).join(' ').trim();
            if (name) nameByGuest.set(id, name);
          }
        } catch {
          // no guest names → quotes render unattributed
        }
      }

      // Collect anchor ids per source table (deduped) so each table is read once.
      const photoAnchorIds = new Set<string>();
      const captureAnchorIds = new Set<string>();
      for (const r of msgRows) {
        const table = asString(r.source_table);
        const id = asString(r.source_id);
        if (!id) continue;
        if (table === 'papic_photos') photoAnchorIds.add(id);
        else if (table === 'papic_guest_captures') captureAnchorIds.add(id);
      }

      // A resolved anchor's raw media (r2 keys + type), keyed by anchor id. Only
      // rows that PASS the public gate for their table land here.
      type AnchorMedia = { type: 'photo' | 'clip'; key: string; posterKey: string | null };
      const photoAnchors = new Map<string, AnchorMedia>();
      const captureAnchors = new Map<string, AnchorMedia>();

      // papic_photos anchors — SAME fail-closed moderation filter as everywhere
      // else on this surface (withheld verdicts + hidden excluded).
      if (photoAnchorIds.size > 0) {
        try {
          const { data: pRows } = await admin
            .from('papic_photos')
            .select('photo_id, r2_object_key, clip_web_r2_key, full_res_dropped_at, poster_r2_key, photo_type')
            .eq('event_id', eventId)
            .in('photo_id', Array.from(photoAnchorIds))
            .is('hidden_at', null)
            .not(
              'moderation_state',
              'in',
              '("nsfw_blocked","consent_withheld","faceblock_withheld")',
            );
          for (const p of (pRows ?? []) as Array<Record<string, unknown>>) {
            const id = asString(p.photo_id);
            const type = asString(p.photo_type) === 'clip' ? 'clip' : 'photo';
            // A CLIP plays a VIDEO → resolvePlayRef (web copy preferred, drop-safe);
            // a PHOTO keeps its original key (a still, presigned below).
            const key =
              type === 'clip'
                ? resolvePlayRef({
                    photo_type: 'clip',
                    r2_object_key: asString(p.r2_object_key),
                    clip_web_r2_key: asString(p.clip_web_r2_key),
                    full_res_dropped_at: asString(p.full_res_dropped_at),
                  })
                : asString(p.r2_object_key);
            if (!id || !key) continue;
            photoAnchors.set(id, { type, key, posterKey: asString(p.poster_r2_key) });
          }
        } catch {
          // table/column absent → these anchors resolve to text-only
        }
      }

      // papic_guest_captures anchors — the disposable-camera SKU. Public gate is
      // the consent + couple-approval double gate (no NSFW column on this table),
      // consistent with the "As the Day Unfolded" timeline read above.
      if (captureAnchorIds.size > 0) {
        try {
          const { data: cRows } = await admin
            .from('papic_guest_captures')
            .select('capture_id, r2_object_key, clip_web_r2_key, full_res_dropped_at, display_r2_key, poster_r2_key, media_type')
            .eq('event_id', eventId)
            .in('capture_id', Array.from(captureAnchorIds))
            .eq('consent_to_public', true)
            .eq('couple_approved_for_showcase', true)
            .is('hidden_at', null);
          for (const c of (cRows ?? []) as Array<Record<string, unknown>>) {
            const id = asString(c.capture_id);
            const type = asString(c.media_type) === 'clip' ? 'clip' : 'photo';
            // A CLIP must render a VIDEO → resolvePlayRef (web copy preferred,
            // drop-safe); the display_r2_key derivative is a still (lightbox image),
            // never a video. A PHOTO prefers the display derivative, falling back to
            // the original when derivatives haven't been generated (mirrors
            // lib/papic-gallery).
            const key =
              type === 'clip'
                ? resolvePlayRef({
                    media_type: 'clip',
                    r2_object_key: asString(c.r2_object_key),
                    clip_web_r2_key: asString(c.clip_web_r2_key),
                    full_res_dropped_at: asString(c.full_res_dropped_at),
                  })
                : asString(c.display_r2_key) ?? asString(c.r2_object_key);
            if (!id || !key) continue;
            captureAnchors.set(id, { type, key, posterKey: asString(c.poster_r2_key) });
          }
        } catch {
          // table/column absent → these anchors resolve to text-only
        }
      }

      // Presign every resolved anchor (main key + poster) ONCE, keyed by r2 key so
      // a repeated key isn't signed twice. Reuse the gallery's presigned set as a
      // cache when the key was already signed there.
      const keysToSign = new Set<string>();
      for (const a of [...photoAnchors.values(), ...captureAnchors.values()]) {
        keysToSign.add(a.key);
        if (a.posterKey) keysToSign.add(a.posterKey);
      }
      // Seed the presign cache from the gallery (photoId→url isn't keyed by r2
      // key, so we re-sign; but skip work when the anchor id already sits in the
      // gallery-presigned map — that URL is directly reusable for photo anchors).
      const urlByKey = new Map<string, string>();
      if (keysToSign.size > 0) {
        const keys = Array.from(keysToSign);
        const signed = await Promise.all(keys.map((k) => displayUrlForStoredAsset(k)));
        keys.forEach((k, i) => {
          const u = signed[i];
          if (u) urlByKey.set(k, u);
        });
      }

      const resolveAnchor = (
        table: string | null,
        id: string | null,
      ): KwentoQuote['media'] => {
        if (!id) return null;
        let a: AnchorMedia | undefined;
        if (table === 'papic_photos') a = photoAnchors.get(id);
        else if (table === 'papic_guest_captures') a = captureAnchors.get(id);
        if (!a) return null;
        // Reuse the gallery-presigned URL for a papic_photos PHOTO anchor when the
        // id is already in that map (avoids depending on it, but caches it).
        const url =
          (table === 'papic_photos' && a.type === 'photo'
            ? papicUrlByPhotoId.get(id)
            : undefined) ?? urlByKey.get(a.key);
        if (!url) return null;
        const posterUrl = a.posterKey ? urlByKey.get(a.posterKey) ?? null : null;
        return { type: a.type, url, posterUrl };
      };

      for (const r of msgRows) {
        const body = asString(r.body_text);
        if (!body) continue;
        const guestId = asString(r.guest_id);
        kwentoQuotes.push({
          body,
          author: guestId ? nameByGuest.get(guestId) ?? null : null,
          role: null,
          media: resolveAnchor(asString(r.source_table), asString(r.source_id)),
        });
      }
    }
  } catch {
    // table absent (pre-Kwento) or any error → no whispers section
  }

  // ── "Letters to the Editor" — approved Guest Columns ─────────────────────────
  // guest_columns (BUILD ① · migration 20270917200000), behind the
  // GUEST_COLUMNS_ENABLED flag (default OFF → never even queried). PUBLIC
  // surface → FAILS CLOSED exactly like the kwento block above: only
  // status='approved' + moderation_state='clean' + author not publicly hidden.
  // Bylines resolve from `guests` (same one-read pattern). A missing table
  // (pre-migration, 42P01) degrades to [] → section hidden.
  const guestColumns: Array<{ title: string; body: string; author: string | null }> = [];
  if (guestColumnsEnabled()) {
    try {
      const { data: colRows, error } = await admin
        .from('guest_columns')
        .select('title, body_text, guest_id')
        .eq('event_id', eventId)
        .eq('status', 'approved')
        .eq('moderation_state', 'clean')
        .eq('author_publicly_hidden', false)
        .order('submitted_at', { ascending: true })
        .limit(EDITORIAL_GUEST_COLUMN_CAP);
      const rows = !error && Array.isArray(colRows) ? (colRows as Array<Record<string, unknown>>) : [];
      if (rows.length > 0) {
        const colGuestIds = Array.from(
          new Set(rows.map((r) => asString(r.guest_id)).filter((v): v is string => Boolean(v))),
        );
        const colNameByGuest = new Map<string, string>();
        if (colGuestIds.length > 0) {
          try {
            const { data: gRows } = await admin
              .from('guests')
              .select('guest_id, display_name, first_name, last_name')
              .in('guest_id', colGuestIds);
            for (const g of (gRows ?? []) as Array<Record<string, unknown>>) {
              const id = asString(g.guest_id);
              if (!id) continue;
              const name =
                asString(g.display_name) ??
                [asString(g.first_name), asString(g.last_name)].filter(Boolean).join(' ').trim();
              if (name) colNameByGuest.set(id, name);
            }
          } catch {
            // no names → columns render unattributed
          }
        }
        for (const r of rows) {
          const title = asString(r.title);
          const body = asString(r.body_text);
          if (!title || !body) continue;
          const gid = asString(r.guest_id);
          guestColumns.push({ title, body, author: gid ? colNameByGuest.get(gid) ?? null : null });
        }
      }
    } catch {
      // pre-migration DB / transient failure → [] → section hidden
    }
  }

  // ── "Watch the Film" — Live Studio (Panood) replay ───────────────────────────
  // The couple's broadcast replay, embedded via youtube-nocookie. Gated on ALL
  // THREE, fail-closed: (1) events.panood_watch_url present + (2) it normalizes to
  // a real YouTube video id via the panood-watch injection barrier + (3) the couple
  // holds an ACTIVE Panood/Live Studio SKU (eventSkuActive('PANOOD_SYSTEM')). Any
  // gate failing → null → section hidden. Mirrors the recap's panood replay
  // (lib/auto-recap.ts) — never embeds a raw URL. Best-effort: 42703/parse error →
  // null, never throws.
  let watchFilmEmbedUrl: string | null = null;
  try {
    if (await eventSkuActive(admin, eventId, 'PANOOD_SYSTEM')) {
      const { data, error } = await admin
        .from('events')
        .select('panood_watch_url')
        .eq('event_id', eventId)
        .maybeSingle();
      if (!error && data) {
        const watchUrl = asString((data as Record<string, unknown>).panood_watch_url);
        const videoId = watchUrl ? parseYouTubeVideoId(watchUrl) : null;
        if (videoId) watchFilmEmbedUrl = youTubeEmbedUrl(videoId);
      }
    }
  } catch {
    watchFilmEmbedUrl = null;
  }

  // ── Their song ──────────────────────────────────────────────────────────────
  // Prefer the DELIVERED Pakanta song (events.pakanta_song_r2_key) — presign it
  // so the recap plays/credits the couple's actual song. The column is read by
  // name above (with a column-missing retry on the event select); if it's
  // absent the value is simply undefined here. Fall back to the typed
  // love_story.anchors.song title (never playable) when no delivered song.
  const pakantaKey = asString((event as Record<string, unknown>).pakanta_song_r2_key);
  let songUrl: string | null = null;
  if (pakantaKey) {
    try {
      songUrl = await displayUrlForStoredAsset(pakantaKey);
    } catch {
      songUrl = null;
    }
  }
  const songLabel = songUrl
    ? asString(loveStory.anchors?.song) ?? 'Their wedding song'
    : asString(loveStory.anchors?.song);
  const song = { url: songUrl, label: songLabel };

  return {
    displayName,
    firstNames: deriveFirstNames(displayName),
    slug: asString(event.slug),
    eventDate,
    eventDateFormatted: formatPhDate(eventDate),
    editionNo,
    venueName,
    venueCity,
    venueAddress,
    monogramText,
    monogramColor,
    loveStory,
    specialMessage,
    togetherSince,
    tone,
    draft: {
      headline: asString(draftJson.headline),
      deck: asString(draftJson.deck),
      superKicker: asString(draftJson.super) ?? asString(draftJson.kicker),
      leadParagraphs: extractParagraphs(draftJson),
      pullQuote: asString(draftJson.pull_quote) ?? asString(draftJson.pullQuote),
      byline: asString(draftJson.byline),
    },
    loveStoryParagraphs: loveStoryFallbackParagraphs(loveStory),
    published,
    heroPhotoUrl,
    heroStableUrl,
    heroVideoUrl,
    metrics,
    archetype,
    vendors,
    vendorsWeLoved,
    reviews,
    servicesAvailed,
    galleryPhotos,
    essayPhotos,
    dayChapters,
    song,
    photoWallPhotos,
    photoWallActive,
    pabatiClips,
    pabatiActive,
    vendorMedia,
    kwentoQuotes,
    guestColumns,
    watchFilmEmbedUrl,
    sections: readSections(draftJson),
    sectionOrder: readSectionOrder(draftJson),
  };
}

// ── Editor-facing chapter cards ───────────────────────────────────────────────
// The couple-dashboard curation editor needs the RAW auto-built chapters — ALL of
// them, unfiltered (hidden ones included, so the couple can un-hide), in timeline
// order — plus the current overrides. This is deliberately separate from
// loadEditorialData's `dayChapters` (which has overrides applied + hidden removed
// for the public render). One thumbnail per chapter (the lead's still — a photo
// URL, or a clip's poster; null when a clip has no baked poster → the editor shows
// a film glyph), the clock-time kicker, and the stable leadId the override targets.
export type ChapterCard = {
  leadId: string;
  time: string | null;
  /** Lead thumbnail: a presigned still (photo) or clip poster. Null → film glyph. */
  thumbUrl: string | null;
  isClip: boolean;
};

export type EditorialChaptersForEditor = {
  cards: ChapterCard[];
  overrides: ChapterOverride[];
};

/**
 * Build the auto chapters (unfiltered, timeline order) + read current overrides,
 * for the couple curation editor. Mirrors loadEditorialData's timeline read but
 * only resolves the ≤10 lead thumbnails (never the supporting media). Every query
 * graceful-degrades; a non-Papic / no-clips event returns `{ cards: [], … }`.
 */
export async function loadEditorialChaptersForEditor(
  eventId: string,
): Promise<EditorialChaptersForEditor> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { cards: [], overrides: [] };
  }

  // Current overrides (from draft_json). Read even when there are no cards, so the
  // editor can drop stale ones on the next save.
  let overrides: ChapterOverride[] = [];
  try {
    const { data } = await admin
      .from('event_editorial')
      .select('draft_json')
      .eq('event_id', eventId)
      .maybeSingle();
    overrides = readChapterOverrides(asObject(data?.draft_json));
  } catch {
    overrides = [];
  }

  // Timeline photos (wide, captured_at ASC) — lightweight rows.
  type Row = { photoId: string; key: string; posterKey: string | null; capturedAt: string | null; kind: 'photo' | 'clip' };
  const rows: Row[] = [];
  try {
    const { data, error } = await admin
      .from('papic_photos')
      .select('photo_id, r2_object_key, captured_at')
      .eq('event_id', eventId)
      .eq('photo_type', 'photo')
      .is('hidden_at', null)
      .not('moderation_state', 'in', '("nsfw_blocked","consent_withheld","faceblock_withheld")')
      .order('captured_at', { ascending: true })
      .limit(EDITORIAL_TIMELINE_PHOTO_CAP);
    if (!error && Array.isArray(data)) {
      for (const r of data as Array<Record<string, unknown>>) {
        const photoId = asString(r.photo_id);
        const key = asString(r.r2_object_key);
        if (photoId && key) rows.push({ photoId, key, posterKey: null, capturedAt: asString(r.captured_at), kind: 'photo' });
      }
    }
  } catch {
    // no photos
  }
  try {
    const { data, error } = await admin
      .from('papic_photos')
      .select('photo_id, r2_object_key, poster_r2_key, captured_at')
      .eq('event_id', eventId)
      .eq('photo_type', 'clip')
      .is('hidden_at', null)
      .not('moderation_state', 'in', '("nsfw_blocked","consent_withheld","faceblock_withheld")')
      .order('captured_at', { ascending: true })
      .limit(EDITORIAL_PAPIC_CLIP_CAP);
    if (!error && Array.isArray(data)) {
      for (const r of data as Array<Record<string, unknown>>) {
        const photoId = asString(r.photo_id);
        const key = asString(r.r2_object_key);
        if (photoId && key) rows.push({ photoId, key, posterKey: asString(r.poster_r2_key), capturedAt: asString(r.captured_at), kind: 'clip' });
      }
    }
  } catch {
    // no clips
  }
  if (rows.length === 0) return { cards: [], overrides };

  // Tag counts for the lead pick (mirror the public read).
  const tagCount = new Map<string, number>();
  try {
    const photoIds = rows.filter((r) => r.kind === 'photo').map((r) => r.photoId);
    if (photoIds.length > 0) {
      const { data } = await admin
        .from('photo_tags')
        .select('source_id')
        .eq('event_id', eventId)
        .eq('source_table', 'papic_photos')
        .in('source_id', photoIds);
      for (const t of (data ?? []) as Array<Record<string, unknown>>) {
        const id = asString(t.source_id);
        if (id) tagCount.set(id, (tagCount.get(id) ?? 0) + 1);
      }
    }
  } catch {
    // untagged fallback
  }

  const tsMs = (raw: string | null): number => {
    if (!raw) return Number.NaN;
    const n = new Date(raw).getTime();
    return Number.isFinite(n) ? n : Number.NaN;
  };
  rows.sort((a, b) => {
    const aN = Number.isNaN(tsMs(a.capturedAt));
    const bN = Number.isNaN(tsMs(b.capturedAt));
    if (aN && bN) return 0;
    if (aN) return 1;
    if (bN) return -1;
    return tsMs(a.capturedAt) - tsMs(b.capturedAt);
  });

  // Same bucketing + lead pick as the public builder (so leadIds line up exactly).
  const pickLead = (bucket: Row[]): Row | null => {
    const first = bucket[0];
    if (!first) return null;
    const firstClip = bucket.find((b) => b.kind === 'clip');
    if (firstClip) return firstClip;
    return bucket.reduce(
      (best, cur) => ((tagCount.get(cur.photoId) ?? 0) > (tagCount.get(best.photoId) ?? 0) ? cur : best),
      first,
    );
  };
  const leads: Row[] = [];
  if (rows.length < 4) {
    for (const r of rows) leads.push(r);
  } else {
    const n = rows.length;
    const chapterCount = Math.min(EDITORIAL_DAY_CHAPTER_CAP, n);
    for (let i = 0; i < chapterCount; i += 1) {
      const start = Math.floor((i * n) / chapterCount);
      const end = Math.floor(((i + 1) * n) / chapterCount);
      if (end > start) {
        const lead = pickLead(rows.slice(start, end));
        if (lead) leads.push(lead);
      }
    }
  }

  // Resolve ONLY the lead thumbnails (photo still or clip poster).
  const cards: ChapterCard[] = [];
  await Promise.all(
    leads.map(async (lead) => {
      const thumbKey = lead.kind === 'clip' ? lead.posterKey : lead.key;
      const thumbUrl = thumbKey ? await displayUrlForStoredAsset(thumbKey) : null;
      cards.push({
        leadId: lead.photoId,
        time: formatClockKicker(lead.capturedAt),
        thumbUrl: thumbUrl ?? null,
        isClip: lead.kind === 'clip',
      });
    }),
  );
  // Promise.all resolves out of order → restore timeline order by lead position.
  const order = new Map(leads.map((l, i) => [l.photoId, i] as const));
  cards.sort((a, b) => (order.get(a.leadId) ?? 0) - (order.get(b.leadId) ?? 0));

  return { cards, overrides };
}

// ── small utilities ───────────────────────────────────────────────────────────

// draft_json.sections → a partial visibility map. Only explicit `false` hides a
// block; anything else (missing / true) shows it, so older editorials and the
// samples render everything by default.
function readSections(draftJson: Record<string, unknown>): Partial<EditorialSections> {
  const raw = asObject(draftJson.sections);
  const out: Partial<EditorialSections> = {};
  for (const key of EDITORIAL_SECTION_KEYS) {
    if (raw[key] === false) out[key] = false;
  }
  return out;
}

// draft_json.sectionOrder → a validated string[] of orderable section keys (or
// null when absent). Only strings kept; the renderer's resolveSectionOrder()
// strips unknown/locked-close keys and dedupes, so this is a light pass-through.
// `null` (the normal case + the samples) → the canonical default order.
function readSectionOrder(draftJson: Record<string, unknown>): string[] | null {
  const raw = (draftJson as Record<string, unknown>).sectionOrder;
  if (!Array.isArray(raw)) return null;
  const out = raw.filter((v): v is string => typeof v === 'string');
  return out.length ? out : null;
}

// draft_json.chapterOverrides → an ordered, validated list of ChapterOverride.
// Each entry needs a non-empty string leadId to target a chapter; malformed
// entries are dropped. The ARRAY ORDER is load-bearing — it drives the couple's
// chosen chapter order in loadEditorialData. Anything non-array → [].
function readChapterOverrides(draftJson: Record<string, unknown>): ChapterOverride[] {
  const raw = (draftJson as Record<string, unknown>).chapterOverrides;
  if (!Array.isArray(raw)) return [];
  const out: ChapterOverride[] = [];
  const seen = new Set<string>();
  for (const entry of raw as unknown[]) {
    const obj = asObject(entry);
    const leadId = asString(obj.leadId);
    if (!leadId || seen.has(leadId)) continue; // need a target; first wins on dup
    seen.add(leadId);
    out.push({
      leadId,
      title: asString(obj.title),
      writeUp: asString(obj.writeUp),
      hidden: obj.hidden === true,
    });
  }
  return out;
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function normalizeTone(v: unknown): StoryTone {
  const s = asString(v);
  return s === 'warm' || s === 'playful' || s === 'formal' ? s : null;
}

/**
 * FREE prose fallback: weave the event's `love_story` into article paragraphs
 * for a couple who wrote no lead paragraphs of their own. Gathers the free-text
 * prose fields in narrative order (how they met → the proposal → the spark →
 * what they overcame), splitting each on blank lines / newlines into paragraphs
 * per the requirement. Returns [] when there's no prose to render → the article
 * simply omits, never errors. Never fabricates: only real typed fields appear.
 */
function loveStoryFallbackParagraphs(story: LoveStory | null | undefined): string[] {
  if (!story || typeof story !== 'object') return [];
  const out: string[] = [];
  // Free-text narrative fields the couple types during onboarding, in the order
  // they read as a story. Structured/short fields (years, settings, anchors) are
  // deliberately excluded — this is a prose fallback, not a data dump.
  const proseFields: Array<string | null | undefined> = [
    story.how_we_met,
    story.proposal,
    story.spark,
    story.spark_why,
    story.obstacle,
    story.obstacle_kept,
  ];
  for (const field of proseFields) {
    const text = asString(field);
    if (!text) continue;
    for (const para of text.split(/\n{2,}|\r?\n/)) {
      const p = para.trim();
      if (p) out.push(p);
    }
  }
  return out;
}

function extractParagraphs(draftJson: Record<string, unknown>): string[] | null {
  const candidate = draftJson.lead_paragraphs ?? draftJson.leadParagraphs ?? draftJson.article;
  if (Array.isArray(candidate)) {
    const out = candidate.map((p) => asString(p)).filter((p): p is string => !!p);
    return out.length ? out : null;
  }
  const single = asString(candidate) ?? asString(draftJson.lead) ?? asString(draftJson.body);
  if (single) {
    return single
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return null;
}

/** Local monogram fallback (mirrors lib/monogram deriveMonogram, kept inline so
 *  this module stays self-contained and never imports outside _components). */
function deriveMonogramFallback(displayName: string): string {
  const cleaned = displayName.replace(/\s*\([^)]*\)\s*/g, '').trim();
  const parts = cleaned
    .split(/\s*(?:&|and|\+|\/|-)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.charAt(0)?.toUpperCase() ?? 'S';
    const b = parts[1]?.charAt(0)?.toUpperCase() ?? 'S';
    return `${a} & ${b}`;
  }
  return (parts[0]?.charAt(0) ?? 'S').toUpperCase();
}

// ============================================================================
// Real Weddings SAMPLE editorial (iteration 0046)
// ============================================================================
// The curated Maria & Juan SAMPLE shown on the /realstories showcase detail page.
// It flows through the SAME EditorialContent component as real weddings (via the
// loadEditorialData sentinel above), so the sample AUTOMATICALLY follows any
// future change to the editorial format — there is no parallel layout to drift.
// Fictional + clearly labelled "Sample showcase" on the page; carries no real
// PII. When real consent-gated editorials ship (0002/0046 Phase 4, Dec 2026),
// they render through the identical path from live `events` data.
// Sentinel id → curated fixture. Each /realstories/[slug] sample detail maps to
// one of these (via SAMPLE_EDITORIAL_IDS) and renders through the real
// EditorialContent engine, so a sample looks EXACTLY like a real couple's
// website editorial — including their own hero photo.
const SAMPLE_EDITORIALS: Record<string, () => EditorialData> = {
  'sample-maria-and-juan': mariaAndJuan,
  'sample-jack-and-jill': jackAndJill,
  'sample-john-and-jane': johnAndJane,
  'sample-peter-and-mary': peterAndMary,
  'sample-jack-and-rose': jackAndRose,
  'sample-sofia-reyes': sofiaReyes,
};

// /realstories wedding slug → sample sentinel id. Drives the detail page.
export const SAMPLE_EDITORIAL_IDS: Record<string, string> = {
  'maria-and-juan-tagaytay-garden-wedding': 'sample-maria-and-juan',
  'jack-and-jill-cebu-beach-wedding': 'sample-jack-and-jill',
  'john-and-jane-manila-rooftop-wedding': 'sample-john-and-jane',
  'peter-and-mary-tagaytay-estate-wedding': 'sample-peter-and-mary',
  'jack-and-rose-baguio-forest-wedding': 'sample-jack-and-rose',
  'sofia-reyes-makati-debut': 'sample-sofia-reyes',
};

// Back-compat: original single-sample export still points at Maria & Juan.
export const SAMPLE_EDITORIAL_EVENT_ID = 'sample-maria-and-juan';

function mariaAndJuan(): EditorialData {
  const guests = 120;
  return {
    displayName: 'Maria & Juan',
    firstNames: 'Maria & Juan',
    slug: null, // sample has no real event row → editorial render skips the share bar (the /realstories/[slug] detail page owns it)
    eventDate: '2026-02-14',
    eventDateFormatted: formatPhDate('2026-02-14'),
    editionNo: 1,
    venueName: 'a garden estate overlooking Taal',
    venueCity: 'Tagaytay',
    venueAddress: 'Tagaytay, Cavite',
    monogramText: 'M & J',
    monogramColor: '#6B4E3D',
    loveStory: {
      how_we_met:
        'they ended up seatmates at a friend’s despedida in Quezon City and spent the whole night arguing about the best lugaw in the metro',
      met_year: '2019',
      together_since: '2019',
      proposal:
        'Juan asked the question over halo-halo, at the same little turo-turo where they had their first real talk',
      proposal_setting: 'a quiet Tagaytay overlook',
      proposal_year: '2024',
      spark: 'the way they could turn any ordinary errand into an adventure',
      spark_why: 'neither of them ever quite wanted the day to end',
      milestones: [
        { year: '2019', title: 'First met', note: 'A despedida in Quezon City' },
        { year: '2021', title: 'Moved in together', note: 'A tiny apartment in Makati' },
        { year: '2024', title: 'The proposal', note: 'Tagaytay, over halo-halo' },
        { year: '2026', title: 'The wedding', note: 'A garden overlooking Taal' },
      ],
      anchors: {
        song: 'their kundiman',
        place: 'Tagaytay',
        injoke: 'set na ’yan',
        food: 'halo-halo',
      },
    },
    specialMessage:
      'Thank you for being here with us today. Set na ’yan — and we could never have set it without every one of you.',
    togetherSince: '2019-08-01',
    tone: 'warm',
    draft: {
      leadParagraphs: [
        'Under a sky that cleared just in time, Maria and Juan were married on a garden lawn high above Taal, the lake holding the afternoon light like a held breath. One hundred and twenty guests rose as she came down a path lined with white blooms; by the time she reached him, neither was bothering to hide the tears.',
        'The ceremony was short and unhurried — vows traded in a near-whisper, a kiss the front rows swore they could hear. At the reception that followed, long tables ran the length of the lawn beneath strings of warm light, and the kitchen sent out course after course while the toasts ran long and the laughter ran longer.',
        'They danced their first dance to the kundiman that has followed them since a despedida in Quezon City, and closed the night the way they began — side by side, in no hurry for the day to end.',
      ],
    },
    loveStoryParagraphs: [],
    published: true,
    heroPhotoUrl: '/realstories/maria-juan-tagaytay.jpg',
    heroVideoUrl: '/realstories/maria-juan-tagaytay.mp4',
    metrics: {
      servicesSetnayan: 5,
      servicesTotalDenominator: null,
      firstPickNum: 4,
      firstPickDen: 6,
      hoursSaved: TIME_SAVED_PER_VENDOR_HOURS * 6 + TIME_SAVED_BASE_HOURS,
      guests,
      attending: 108,
      replied: 116,
      rsvpPct: 97,
      photos: 342,
      clips: 48,
      chapters: 5,
    },
    archetype: computeArchetype(guests, null),
    vendors: [
      { name: 'Goldenhour Photo + Film', category: 'Photography & Video', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'The Long Table', category: 'Catering', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Bloom & Vine', category: 'Florals & Styling', isFirstPick: false, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Day-of by Dana', category: 'Coordination', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
    ],
    vendorsWeLoved: [
      { vendorProfileId: 'sample-1', businessName: 'Goldenhour Photo + Film', endorsement: 'They saw moments we missed and gave them back to us forever.', logoUrl: null, href: null },
      { vendorProfileId: 'sample-2', businessName: 'The Long Table', endorsement: 'Every guest is still talking about the food. Book them.', logoUrl: null, href: null },
    ],
    reviews: [
      { author: 'Maria & Juan', role: 'couple', quote: 'We planned the whole thing on Setnayan — and on the day, everything was just set.', stars: 5 },
      { author: 'Tita Bing', role: 'guest', quote: 'The most organized wedding I have been to — everyone knew where to go and when.', stars: 5 },
    ],
    servicesAvailed: ['Setnayan AI', 'Event Website', 'Papic', 'Live Studio', 'Pakanta'],
    galleryPhotos: [
      '/realstories/maria-juan-g1.jpg',
      '/realstories/maria-juan-g2.jpg',
      '/realstories/maria-juan-g3.jpg',
    ],
    essayPhotos: [
      '/realstories/maria-juan-g1.jpg',
      '/realstories/maria-juan-g2.jpg',
      '/realstories/maria-juan-g3.jpg',
    ],
    dayChapters: [
      {
        time: '11:20 in the morning',
        title: 'The Getting Ready',
        writeUp:
          'The suite smelled of gardenias and hairspray. Maria sat still while her ninang pinned the last sprig into place, and for one quiet minute nobody said anything at all — the calm before a very loud, very happy afternoon.',
        leadId: 'sample-mj-ch1',
        media: [
          { type: 'photo', url: '/realstories/maria-juan-v2.jpg', posterUrl: null, id: 'sample-mj-ch1' },
          { type: 'photo', url: '/realstories/maria-juan-v1.jpg', posterUrl: null, id: 'sample-mj-ch1b' },
        ],
      },
      {
        time: '2:38 in the afternoon',
        title: 'The Garden March',
        writeUp:
          'The path was lined white with blooms and the whole lawn rose at once. She walked it slowly, on her father’s arm, past every face that had ever mattered — and by the time she reached Juan, neither of them was hiding the tears.',
        leadId: 'sample-mj-ch2',
        media: [
          { type: 'clip', url: '/realstories/clips/mj-garden-march.mp4', posterUrl: '/realstories/maria-juan-tagaytay.jpg', id: 'sample-mj-ch2' },
        ],
      },
      {
        time: '3:04 in the afternoon',
        title: 'The Vows',
        writeUp:
          'They traded promises in a near-whisper, foreheads almost touching. The front rows swore they could hear the kiss. Taal held the light behind them like a held breath, and then everyone was on their feet.',
        leadId: 'sample-mj-ch3',
        media: [
          { type: 'clip', url: '/realstories/clips/mj-the-vows.mp4', posterUrl: '/realstories/maria-juan-g1.jpg', id: 'sample-mj-ch3' },
          { type: 'photo', url: '/realstories/maria-juan-g1.jpg', posterUrl: null, id: 'sample-mj-ch3b' },
        ],
      },
      {
        time: '7:12 in the evening',
        title: 'The First Dance',
        writeUp:
          'Under strings of warm light they danced to the kundiman that has followed them since a despedida in Quezon City. Slow, unhurried, foreheads together again — the same two people, a lifetime further in.',
        leadId: 'sample-mj-ch4',
        media: [
          { type: 'clip', url: '/realstories/clips/mj-first-dance.mp4', posterUrl: '/realstories/maria-juan-g2.jpg', id: 'sample-mj-ch4' },
        ],
      },
      {
        time: '9:47 in the evening',
        title: 'The Money Dance',
        writeUp:
          'Titos and titas pinned bills to the couple while the band played faster and faster. Somebody’s lolo out-danced everyone half his age. The lawn was pure noise and light, and nobody was in any hurry for the day to end.',
        leadId: 'sample-mj-ch5',
        media: [
          { type: 'clip', url: '/realstories/clips/mj-money-dance.mp4', posterUrl: '/realstories/maria-juan-g3.jpg', id: 'sample-mj-ch5' },
          { type: 'photo', url: '/realstories/maria-juan-g3.jpg', posterUrl: null, id: 'sample-mj-ch5b' },
        ],
      },
    ],
    song: { url: null, label: 'their kundiman' },
    photoWallPhotos: [],
    photoWallActive: false,
    pabatiClips: [],
    pabatiActive: false,
    vendorMedia: [
      { vendorName: 'Goldenhour Photo + Film', category: 'Photography & Video', type: 'clip', stillUrl: '/realstories/maria-juan-v1.jpg', boomerangUrl: '/realstories/maria-juan-vclip.mp4', caption: 'The rings, in close' },
      { vendorName: 'Goldenhour Photo + Film', category: 'Photography & Video', type: 'photo', stillUrl: '/realstories/maria-juan-v2.jpg', boomerangUrl: null, caption: 'Caught laughing in the garden' },
    ],
    kwentoQuotes: [
      { body: 'Nakita ko kung paano ka tumingin sa kanya sa altar. Iyon ang tingin na hinihintay ng bawat magulang. Ingatan niyo iyon.', author: 'Tita Bing', role: null, media: { type: 'photo', url: '/realstories/maria-juan-g1.jpg' } },
      { body: 'From the despedida na pinagtalunan niyo ang pinakamasarap na lugaw, to this garden — sobrang saya kong nandito. Set na ’yan!', author: 'Kuya Marco', role: null, media: null },
      { body: 'I have known Maria since college and I have never seen her this calm and this sure. Juan, you did that. Salamat.', author: 'Andrea', role: null, media: { type: 'photo', url: '/realstories/maria-juan-g2.jpg' } },
    ],
    watchFilmEmbedUrl: null,
  };
}

function jackAndJill(): EditorialData {
  const guests = 80;
  return {
    displayName: 'Jack & Jill',
    firstNames: 'Jack & Jill',
    slug: null,
    eventDate: '2026-04-18',
    eventDateFormatted: formatPhDate('2026-04-18'),
    editionNo: 3,
    venueName: 'a west-facing cove on the Cebu coast',
    venueCity: 'Cebu',
    venueAddress: 'Cebu',
    monogramText: 'J & J',
    monogramColor: '#D85A30',
    loveStory: {
      how_we_met:
        'they met on a sunrise hike that turned into a dare to swim before breakfast — Jill won',
      met_year: '2020',
      together_since: '2020',
      proposal:
        'Jack proposed waist-deep at low tide, hiding the ring in a sealed shell so he would not drop it',
      proposal_setting: 'a quiet Cebu cove at sunset',
      proposal_year: '2025',
      spark: 'they never said no to a body of water',
      spark_why: 'every plan they ever made somehow ended at the sea',
      milestones: [
        { year: '2020', title: 'First met', note: 'A sunrise hike in Cebu' },
        { year: '2022', title: 'First dive trip', note: 'Moalboal, the sardine run' },
        { year: '2025', title: 'The proposal', note: 'A cove at sunset' },
        { year: '2026', title: 'The wedding', note: 'Barefoot on the sand' },
      ],
      anchors: { song: 'their road-trip anthem', place: 'the sea', injoke: 'race you', food: 'fresh kinilaw' },
    },
    specialMessage:
      'Salamat for trekking all the way out here with us. The tide waited; so did we — thank you for being here.',
    togetherSince: '2020-01-01',
    tone: 'playful',
    draft: {
      leadParagraphs: [
        'Barefoot on warm sand, Jack and Jill were married as the tide pulled back to make room for the aisle. Eighty guests kicked off their shoes at the tree line and walked down to the water, and the cove obliged with the kind of sunset that looks staged.',
        'There were no chairs to speak of and no one minded. The couple traded vows ankle-deep in the shallows — a callback to the proposal Jack swears he pulled off without dropping the ring — then waded back up to a reception of long communal tables, fresh kinilaw, and a playlist that opened with their road-trip anthem and never quite stopped.',
        'By the time the bonfire was lit, half the party was back in the water. The other half was already plotting next year’s boat ride out.',
      ],
    },
    loveStoryParagraphs: [],
    published: true,
    heroPhotoUrl: '/realstories/jack-jill-cebu.jpg',
    heroVideoUrl: '/realstories/jack-jill-cebu.mp4',
    metrics: {
      servicesSetnayan: 4,
      servicesTotalDenominator: null,
      firstPickNum: 3,
      firstPickDen: 5,
      hoursSaved: TIME_SAVED_PER_VENDOR_HOURS * 5 + TIME_SAVED_BASE_HOURS,
      guests,
      attending: 74,
      replied: 78,
      rsvpPct: 98,
      photos: null,
      clips: null,
      chapters: null,
    },
    archetype: computeArchetype(guests, null),
    vendors: [
      { name: 'Saltwater Stories', category: 'Photography & Video', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Coast Kitchen', category: 'Catering', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Driftwood & Bloom', category: 'Florals & Styling', isFirstPick: false, tier: 'verified', logoUrl: null, slug: null },
    ],
    vendorsWeLoved: [],
    reviews: [
      { author: 'Jack & Jill', role: 'couple', quote: 'We planned a whole beach wedding from two phones. By sunset, everything was just set.', stars: 5 },
      { author: 'Kuya Ramon', role: 'guest', quote: 'Worth the boat ride. The timeline ran like clockwork even on the sand.', stars: 5 },
    ],
    servicesAvailed: ['Setnayan AI', 'Event Website', 'Papic'],
    galleryPhotos: [
      '/realstories/jack-jill-g1.jpg',
      '/realstories/jack-jill-g2.jpg',
      '/realstories/jack-jill-g3.jpg',
    ],
    essayPhotos: [
      '/realstories/jack-jill-g1.jpg',
      '/realstories/jack-jill-g2.jpg',
      '/realstories/jack-jill-g3.jpg',
    ],
    dayChapters: [],
    song: { url: null, label: 'their road-trip anthem' },
    photoWallPhotos: [],
    photoWallActive: false,
    pabatiClips: [],
    pabatiActive: false,
    vendorMedia: [
      { vendorName: 'Saltwater Stories', category: 'Photography & Video', type: 'clip', stillUrl: '/realstories/jack-jill-v1.jpg', boomerangUrl: '/realstories/jack-jill-vclip.mp4', caption: 'Toes in the sand' },
      { vendorName: 'Saltwater Stories', category: 'Photography & Video', type: 'photo', stillUrl: '/realstories/jack-jill-v2.jpg', boomerangUrl: null, caption: 'Down the shoreline at sunset' },
    ],
    kwentoQuotes: [],
    watchFilmEmbedUrl: null,
  };
}

function johnAndJane(): EditorialData {
  const guests = 60;
  return {
    displayName: 'John & Jane',
    firstNames: 'John & Jane',
    slug: null,
    eventDate: '2026-03-07',
    eventDateFormatted: formatPhDate('2026-03-07'),
    editionNo: 2,
    venueName: 'a rooftop terrace above the Manila skyline',
    venueCity: 'Manila',
    venueAddress: 'Makati, Metro Manila',
    monogramText: 'J & J',
    monogramColor: '#1E2A44',
    loveStory: {
      how_we_met:
        'they were put on the same project their first week at work and spent it disagreeing politely in meetings',
      met_year: '2018',
      together_since: '2019',
      proposal:
        'John proposed on the office rooftop after hours, with the city lights doing the staging',
      proposal_setting: 'a rooftop over Makati at blue hour',
      proposal_year: '2025',
      spark: 'the way a quick coffee always turned into a two-hour conversation',
      spark_why: 'they were better at everything together',
      milestones: [
        { year: '2018', title: 'First met', note: 'Same project, first week' },
        { year: '2019', title: 'First date', note: 'A long coffee that ran late' },
        { year: '2025', title: 'The proposal', note: 'A rooftop over the city' },
        { year: '2026', title: 'The wedding', note: 'Sixty guests, one skyline' },
      ],
      anchors: { song: 'their slow song', place: 'the rooftop', injoke: 'one more slide', food: 'late-night ramen' },
    },
    specialMessage:
      'Thank you for choosing a weeknight rooftop over a long weekend away to be with us. It meant everything.',
    togetherSince: '2019-02-01',
    tone: 'formal',
    draft: {
      leadParagraphs: [
        'On a clear weeknight evening, John and Jane were married on a Makati rooftop with the whole city laid out behind them. Sixty guests took their seats as the skyline switched on, tower by tower, and the ceremony began precisely on the hour.',
        'It was, by every account, a study in restraint and good timing — short readings, a steady exchange of vows, and a dinner that moved at exactly the pace it was meant to. The supper club plated each course as the light over the bay deepened from gold to a settled blue.',
        'There were three toasts, one slow dance, and a final round of coffee taken at the rail — the couple and their guests looking out over a city that, for one night, seemed arranged entirely for them.',
      ],
    },
    loveStoryParagraphs: [],
    published: true,
    heroPhotoUrl: '/realstories/john-jane-manila.jpg',
    heroVideoUrl: '/realstories/john-jane-manila.mp4',
    metrics: {
      servicesSetnayan: 3,
      servicesTotalDenominator: null,
      firstPickNum: 3,
      firstPickDen: 4,
      hoursSaved: TIME_SAVED_PER_VENDOR_HOURS * 4 + TIME_SAVED_BASE_HOURS,
      guests,
      attending: 56,
      replied: 59,
      rsvpPct: 98,
      photos: null,
      clips: null,
      chapters: null,
    },
    archetype: computeArchetype(guests, null),
    vendors: [
      { name: 'Skyline & Co.', category: 'Photography & Video', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'The Supper Club', category: 'Catering', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Brass & Ember Events', category: 'Coordination', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
    ],
    vendorsWeLoved: [],
    reviews: [
      { author: 'John & Jane', role: 'couple', quote: 'Small wedding, zero chaos. Everyone knew the plan because the plan lived in one place.', stars: 5 },
      { author: 'Atty. Cruz', role: 'guest', quote: 'The most precisely run sixty-person dinner I have attended.', stars: 5 },
    ],
    servicesAvailed: ['Setnayan AI', 'Event Website'],
    galleryPhotos: [
      '/realstories/john-jane-g1.jpg',
      '/realstories/john-jane-g2.jpg',
      '/realstories/john-jane-g3.jpg',
    ],
    essayPhotos: [
      '/realstories/john-jane-g1.jpg',
      '/realstories/john-jane-g2.jpg',
      '/realstories/john-jane-g3.jpg',
    ],
    dayChapters: [],
    song: { url: null, label: 'their slow song' },
    photoWallPhotos: [],
    photoWallActive: false,
    pabatiClips: [],
    pabatiActive: false,
    vendorMedia: [
      { vendorName: 'Skyline & Co.', category: 'Photography & Video', type: 'clip', stillUrl: '/realstories/john-jane-v1.jpg', boomerangUrl: '/realstories/john-jane-vclip.mp4', caption: 'A toast at blue hour' },
      { vendorName: 'Skyline & Co.', category: 'Photography & Video', type: 'photo', stillUrl: '/realstories/john-jane-v2.jpg', boomerangUrl: null, caption: 'Their first dance, up high' },
    ],
    kwentoQuotes: [],
    watchFilmEmbedUrl: null,
  };
}

function peterAndMary(): EditorialData {
  const guests = 150;
  return {
    displayName: 'Peter & Mary',
    firstNames: 'Peter & Mary',
    slug: null,
    eventDate: '2026-05-23',
    eventDateFormatted: formatPhDate('2026-05-23'),
    editionNo: 5,
    venueName: 'a ridge-top estate garden in Tagaytay',
    venueCity: 'Tagaytay',
    venueAddress: 'Tagaytay, Cavite',
    monogramText: 'P & M',
    monogramColor: '#B89B72',
    loveStory: {
      how_we_met:
        'they met at a friend’s baptism and realised they had been at the same fiestas for years without ever meeting',
      met_year: '2017',
      together_since: '2018',
      proposal:
        'Peter asked over Sunday lunch with both families already (secretly) in on it',
      proposal_setting: 'the family table after Mass',
      proposal_year: '2024',
      spark: 'how easily their families became one big noisy table',
      spark_why: 'they wanted that table for the rest of their lives',
      milestones: [
        { year: '2017', title: 'First met', note: 'A baptism in Cavite' },
        { year: '2018', title: 'Made it official', note: 'After one long fiesta season' },
        { year: '2024', title: 'The proposal', note: 'Sunday lunch, both families in' },
        { year: '2026', title: 'The wedding', note: 'A ridge-top estate in bloom' },
      ],
      anchors: { song: 'their parents’ favourite', place: 'Tagaytay', injoke: 'isang kanta pa', food: 'lechon, of course' },
    },
    specialMessage:
      'To all 150 of you who filled this garden — salamat. A full table was the whole point, and you made it overflow.',
    togetherSince: '2018-06-01',
    tone: 'warm',
    draft: {
      leadParagraphs: [
        'It took a ridge-top garden to hold them all. One hundred and fifty guests filled an estate lawn in Tagaytay as Peter and Mary were married beneath an arch of petals and lanterns, two large families finally folded into one very long table.',
        'The day was, fittingly, a feast. Lechon held court at the center of a reception that spilled across the garden, and the toasts came from every direction — parents, ninongs, cousins who had known one or the other since childhood. No one was a stranger by dessert.',
        'Late in the evening both sets of parents were coaxed onto the dance floor to their old favorite, and for a few minutes the whole garden simply watched. A full table was always the point; on this day, it overflowed.',
      ],
    },
    loveStoryParagraphs: [],
    published: true,
    heroPhotoUrl: '/realstories/peter-mary-tagaytay.jpg',
    heroVideoUrl: '/realstories/peter-mary-tagaytay.mp4',
    metrics: {
      servicesSetnayan: 6,
      servicesTotalDenominator: null,
      firstPickNum: 5,
      firstPickDen: 8,
      hoursSaved: TIME_SAVED_PER_VENDOR_HOURS * 8 + TIME_SAVED_BASE_HOURS,
      guests,
      attending: 138,
      replied: 146,
      rsvpPct: 97,
      photos: null,
      clips: null,
      chapters: null,
    },
    archetype: computeArchetype(guests, null),
    vendors: [
      { name: 'Heirloom Photo + Film', category: 'Photography & Video', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Grand Table Catering', category: 'Catering', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Petal & Lantern', category: 'Florals & Styling', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Ridge Coordination', category: 'Coordination', isFirstPick: false, tier: 'verified', logoUrl: null, slug: null },
    ],
    vendorsWeLoved: [],
    reviews: [
      { author: 'Peter & Mary', role: 'couple', quote: 'A 150-guest wedding sounds impossible until every vendor is reading the same timeline.', stars: 5 },
      { author: 'Lola Pacing', role: 'guest', quote: 'Big wedding, but it felt warm and personal. Nobody was lost, everyone was fed.', stars: 5 },
    ],
    servicesAvailed: ['Setnayan AI', 'Event Website', 'Papic', 'Live Studio'],
    galleryPhotos: [
      '/realstories/peter-mary-g1.jpg',
      '/realstories/peter-mary-g2.jpg',
      '/realstories/peter-mary-g3.jpg',
    ],
    essayPhotos: [
      '/realstories/peter-mary-g1.jpg',
      '/realstories/peter-mary-g2.jpg',
      '/realstories/peter-mary-g3.jpg',
    ],
    dayChapters: [],
    song: { url: null, label: 'their parents’ favourite' },
    photoWallPhotos: [],
    photoWallActive: false,
    pabatiClips: [],
    pabatiActive: false,
    vendorMedia: [
      { vendorName: 'Heirloom Photo + Film', category: 'Photography & Video', type: 'clip', stillUrl: '/realstories/peter-mary-v1.jpg', boomerangUrl: '/realstories/peter-mary-vclip.mp4', caption: 'The tables in bloom' },
      { vendorName: 'Heirloom Photo + Film', category: 'Photography & Video', type: 'photo', stillUrl: '/realstories/peter-mary-v2.jpg', boomerangUrl: null, caption: 'The whole table, raised' },
    ],
    kwentoQuotes: [],
    watchFilmEmbedUrl: null,
  };
}

function jackAndRose(): EditorialData {
  const guests = 100;
  return {
    displayName: 'Jack & Rose',
    firstNames: 'Jack & Rose',
    slug: null,
    eventDate: '2026-05-09',
    eventDateFormatted: formatPhDate('2026-05-09'),
    editionNo: 4,
    venueName: 'a pine-forest clearing in the Cordilleras',
    venueCity: 'Baguio',
    venueAddress: 'Baguio, Benguet',
    monogramText: 'J & R',
    monogramColor: '#2F4538',
    loveStory: {
      how_we_met:
        'they shared an umbrella running from the same sudden Baguio downpour and never quite gave it back',
      met_year: '2019',
      together_since: '2019',
      proposal:
        'Jack proposed on a foggy morning walk, the question almost lost to the mist until Rose said yes first',
      proposal_setting: 'a pine trail at dawn',
      proposal_year: '2025',
      spark: 'how the cold made everything feel like a secret only they were in on',
      spark_why: 'they always felt like the only two people on the mountain',
      milestones: [
        { year: '2019', title: 'First met', note: 'One umbrella, one downpour' },
        { year: '2021', title: 'Moved up north', note: 'A cabin with a wood stove' },
        { year: '2025', title: 'The proposal', note: 'A foggy pine trail at dawn' },
        { year: '2026', title: 'The wedding', note: 'A clearing in the pines' },
      ],
      anchors: { song: 'their rainy-day record', place: 'the pines', injoke: 'never gave it back', food: 'strawberry taho' },
    },
    specialMessage:
      'Thank you for climbing all the way up into the fog with us. The mountain kept our secret; now it is yours too.',
    togetherSince: '2019-07-01',
    tone: 'warm',
    draft: {
      leadParagraphs: [
        'Fog moved through the pines like a fourth guest of honor as Jack and Rose were married in a forest clearing above Baguio. One hundred guests climbed into the cool and the mist, and the mountain answered with a hush you could almost hear.',
        'The ceremony was small and close — vows exchanged under the trees, breath visible in the cold, the only music the wind in the branches until the strings came in. Afterward, guests warmed their hands around hot food and strawberry taho while the clearing glowed against the grey.',
        'As the afternoon dimmed the fog rolled back in and seemed to close the clearing off from the rest of the world, leaving just the hundred of them, the pines, and a secret the mountain had agreed to keep.',
      ],
    },
    loveStoryParagraphs: [],
    published: true,
    heroPhotoUrl: '/realstories/jack-rose-baguio.jpg',
    heroVideoUrl: '/realstories/jack-rose-baguio.mp4',
    metrics: {
      servicesSetnayan: 5,
      servicesTotalDenominator: null,
      firstPickNum: 4,
      firstPickDen: 6,
      hoursSaved: TIME_SAVED_PER_VENDOR_HOURS * 6 + TIME_SAVED_BASE_HOURS,
      guests,
      attending: 92,
      replied: 97,
      rsvpPct: 97,
      photos: null,
      clips: null,
      chapters: null,
    },
    archetype: computeArchetype(guests, null),
    vendors: [
      { name: 'Highland Frames', category: 'Photography & Video', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Pinecrest Catering', category: 'Catering', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Fern & Fog Styling', category: 'Florals & Styling', isFirstPick: false, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Summit Day-of', category: 'Coordination', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
    ],
    vendorsWeLoved: [],
    reviews: [
      { author: 'Jack & Rose', role: 'couple', quote: 'Planning an out-of-town wedding from the lowlands was the easy part. One workspace held it all.', stars: 5 },
      { author: 'Ate Glenda', role: 'guest', quote: 'Even with the fog and the drive, everything started on time. Magical and organized.', stars: 5 },
    ],
    servicesAvailed: ['Setnayan AI', 'Event Website', 'Papic', 'Pakanta'],
    galleryPhotos: [
      '/realstories/jack-rose-g1.jpg',
      '/realstories/jack-rose-g2.jpg',
      '/realstories/jack-rose-g3.jpg',
    ],
    essayPhotos: [
      '/realstories/jack-rose-g1.jpg',
      '/realstories/jack-rose-g2.jpg',
      '/realstories/jack-rose-g3.jpg',
    ],
    dayChapters: [],
    song: { url: null, label: 'their rainy-day record' },
    photoWallPhotos: [],
    photoWallActive: false,
    pabatiClips: [],
    pabatiActive: false,
    vendorMedia: [
      { vendorName: 'Highland Frames', category: 'Photography & Video', type: 'clip', stillUrl: '/realstories/jack-rose-v1.jpg', boomerangUrl: '/realstories/jack-rose-vclip.mp4', caption: 'Greens in the mist' },
      { vendorName: 'Highland Frames', category: 'Photography & Video', type: 'photo', stillUrl: '/realstories/jack-rose-v2.jpg', boomerangUrl: null, caption: 'Just the two of them, in the fog' },
    ],
    kwentoQuotes: [],
    watchFilmEmbedUrl: null,
  };
}

// Sofia Reyes — an 18th-birthday DEBUT (not a wedding). Rendered through the
// exact same EditorialData shape so it flows through the real EditorialContent
// engine like every other sample. Debut-true throughout: eighteen roses, a
// cotillion, eighteen candles — never vows, never a bridal march. Content mined
// from lib/real-weddings.ts (sofia-reyes-makati-debut). Only ONE source still
// exists for this sample (sofia-reyes-makati.jpg); the edition varies it via
// two generated Ken Burns clips + three distinct crops (sofia-reyes-c1/c2/c3)
// so no two adjacent surfaces show the same frame.
function sofiaReyes(): EditorialData {
  const guests = 200;
  return {
    displayName: 'Sofia Reyes',
    firstNames: 'Sofia Reyes',
    slug: null, // sample has no real event row → editorial render skips the share bar
    eventDate: '2026-03-14',
    eventDateFormatted: formatPhDate('2026-03-14'),
    editionNo: 6,
    venueName: 'a grand ballroom in the heart of Makati',
    venueCity: 'Makati',
    venueAddress: 'Makati, Metro Manila',
    monogramText: 'SR',
    monogramColor: '#C8697A',
    // A debut has no couple love-story; we repurpose the narrative fields to
    // carry Sofia's coming-of-age story truthfully — first person, family voice.
    loveStory: {
      how_we_met:
        'Sofia wanted the night to feel like a homecoming — every person who shaped her early life in the same room, dressed in their best',
      met_year: '2008',
      spark: 'the way one girl’s eighteenth birthday could gather a whole life into one room',
      spark_why: 'every rose and every candle carried someone who helped raise her',
      milestones: [
        { year: '2008', title: 'A girl on her father’s shoes', note: 'Learning to dance at five' },
        { year: '2020', title: 'Grade-two best friends, still', note: 'Bea, later the eighteenth candle' },
        { year: '2025', title: 'The cotillion begins', note: 'Three months of Sunday rehearsals' },
        { year: '2026', title: 'The debut', note: 'Eighteen roses, eighteen candles, Makati' },
      ],
      anchors: {
        song: 'the waltz that broke into a track only the under-twenties knew',
        place: 'Makati',
        injoke: 'crown slightly crooked',
        food: 'a dessert bar of her baby pictures',
      },
    },
    specialMessage:
      'To everyone who carried a rose or lit a candle for me tonight — you have been doing that my whole life. Thank you for being in the room the night I arrived.',
    togetherSince: null,
    tone: 'warm',
    draft: {
      superKicker: 'A Debut',
      headline: 'Sofia Turns Eighteen',
      deck:
        'Chandeliers, eighteen roses, and eighteen candles — a Makati debut that turned one family’s love into a room of ceremony.',
      byline: 'Setnayan Editorial',
      pullQuote: 'I wanted the people who shaped me in the same room on the same night.',
      leadParagraphs: [
        'The ballroom doors opened on the first chord and Sofia came down the staircase in a rose-gold gown her lola had quietly helped choose. Two hundred people stood without being asked to. It was, by design, a homecoming: every person who had a hand in raising her, gathered under one set of chandeliers to watch her step into adulthood.',
        'What followed moved with the grace of a program rehearsed for months and the warmth of a family that needed no rehearsal at all. Her father took the first rose, then grandfathers, uncles, cousins, and the friends who had taught her to bike, to swim, to drive — each rose paired with a dance and a sentence or two, the best of them unrehearsed.',
        'Then the eighteen candles: the women who raised her, each leaving a wish, until half the ballroom had given up pretending not to cry. A cotillion of eight couples brought the house down, the formal program ended at eleven, and nobody left. The last picture of the night is Sofia, barefoot and crown askew, dancing with her lola to a song older than both of them put together.',
      ],
    },
    loveStoryParagraphs: [],
    published: true,
    heroPhotoUrl: '/realstories/sofia-reyes-makati.jpg',
    heroVideoUrl: null, // no baked boomerang for this sample → still hero
    metrics: {
      servicesSetnayan: 3,
      servicesTotalDenominator: null,
      firstPickNum: 4,
      firstPickDen: 7,
      hoursSaved: TIME_SAVED_PER_VENDOR_HOURS * 7 + TIME_SAVED_BASE_HOURS,
      guests,
      attending: 188,
      replied: 196,
      rsvpPct: 98,
      photos: 511,
      clips: 62,
      chapters: 5,
    },
    archetype: computeArchetype(guests, null),
    vendors: [
      { name: 'BGC Grand Ballroom', category: 'Venue', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Marquesa Catering', category: 'Catering', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Rose & Gold Studios', category: 'Photography & Video', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Step & Sway Cotillion', category: 'Cotillion Choreography', isFirstPick: false, tier: 'verified', logoUrl: null, slug: null },
      { name: 'Debut by Dana', category: 'Coordination', isFirstPick: true, tier: 'verified', logoUrl: null, slug: null },
    ],
    vendorsWeLoved: [
      { vendorProfileId: 'sample-sofia-1', businessName: 'Step & Sway Cotillion', endorsement: 'They turned eight nervous couples into the moment everyone still talks about.', logoUrl: null, href: null },
      { vendorProfileId: 'sample-sofia-2', businessName: 'Rose & Gold Studios', endorsement: 'They caught every candle and every crooked crown. We have the whole night forever.', logoUrl: null, href: null },
    ],
    reviews: [
      { author: 'Ninong Ernesto', role: 'fourth rose', quote: 'I’ve watched her grow up. This night, I watched her arrive.', stars: 5 },
      { author: 'Lola Remedios', role: 'eighteenth candle', quote: 'She danced with me last, barefoot, past midnight. I will keep that dance my whole life.', stars: 5 },
      { author: 'Bea', role: 'best friend, eighteenth candle', quote: 'The dessert bar had her baby pictures on it. Genius. Devastating. Genius.', stars: 5 },
    ],
    servicesAvailed: ['Animated Monogram', 'Papic', 'Setnayan AI'],
    // Three distinct crops cut from the single ballroom still (different regions
    // AND zoom levels — c1 chandelier + upper landing · c2 left sweep + dance
    // floor · c3 tight right curl + candle table) so adjacent surfaces never
    // repeat the same frame. The uncropped original stays the hero + clip poster.
    galleryPhotos: [
      '/realstories/sofia-reyes-c2.jpg',
      '/realstories/sofia-reyes-c3.jpg',
      '/realstories/sofia-reyes-c1.jpg',
    ],
    essayPhotos: [
      '/realstories/sofia-reyes-c1.jpg',
      '/realstories/sofia-reyes-c2.jpg',
      '/realstories/sofia-reyes-c3.jpg',
    ],
    dayChapters: [
      {
        time: '6:40 in the evening',
        title: 'The Staircase Entrance',
        writeUp:
          'The doors opened on the first chord and Sofia came down the staircase in the rose-gold gown her lola helped choose. Two hundred people rose without being asked to — the night’s first, unplanned standing ovation.',
        leadId: 'sample-sofia-ch1',
        media: [
          { type: 'clip', url: '/realstories/clips/sofia-staircase.mp4', posterUrl: '/realstories/sofia-reyes-makati.jpg', id: 'sample-sofia-ch1' },
        ],
      },
      {
        time: '7:25 in the evening',
        title: 'The Eighteen Roses',
        writeUp:
          'Her father first, then grandfathers, uncles, cousins, and the family friends who taught her to bike, to swim, to drive. Each rose came with a dance and a sentence or two — some rehearsed, the best ones not.',
        leadId: 'sample-sofia-ch2',
        media: [
          { type: 'photo', url: '/realstories/sofia-reyes-c1.jpg', posterUrl: null, id: 'sample-sofia-ch2' },
        ],
      },
      {
        time: '8:10 in the evening',
        title: 'The Cotillion',
        writeUp:
          'Eight couples, three months of Sunday rehearsals, one waltz that broke into a track nobody over forty recognized and everybody under twenty knew by heart. It brought the entire ballroom to its feet.',
        leadId: 'sample-sofia-ch3',
        media: [
          { type: 'photo', url: '/realstories/sofia-reyes-c2.jpg', posterUrl: null, id: 'sample-sofia-ch3' },
        ],
      },
      {
        time: '9:05 in the evening',
        title: 'The Eighteen Candles',
        writeUp:
          'The women who raised her — mother, lola, titas, teachers, her best friend since grade two — each lit a candle and left a wish. By the twelfth, half the ballroom had given up pretending they weren’t crying.',
        leadId: 'sample-sofia-ch4',
        media: [
          { type: 'photo', url: '/realstories/sofia-reyes-c3.jpg', posterUrl: null, id: 'sample-sofia-ch4' },
        ],
      },
      {
        time: '12:20 past midnight',
        title: 'The Last Dance',
        writeUp:
          'The formal program ended at eleven; nobody left. The last picture of the night is Sofia — barefoot, crown slightly crooked — dancing with her lola to a song older than both of them put together.',
        leadId: 'sample-sofia-ch5',
        media: [
          { type: 'clip', url: '/realstories/clips/sofia-last-dance.mp4', posterUrl: '/realstories/sofia-reyes-makati.jpg', id: 'sample-sofia-ch5' },
        ],
      },
    ],
    song: { url: null, label: 'the waltz that broke into a track only the under-twenties knew' },
    photoWallPhotos: [],
    photoWallActive: false,
    pabatiClips: [],
    pabatiActive: false,
    vendorMedia: [
      { vendorName: 'Rose & Gold Studios', category: 'Photography & Video', type: 'clip', stillUrl: '/realstories/sofia-reyes-makati.jpg', boomerangUrl: '/realstories/clips/sofia-staircase.mp4', caption: 'Down the staircase, on the first chord' },
    ],
    kwentoQuotes: [
      { body: 'I held her when she was one hour old. Tonight she came down that staircase and I forgot how to breathe. My apo, all grown up.', author: 'Lola Remedios', role: null, media: { type: 'clip', url: '/realstories/clips/sofia-staircase.mp4', posterUrl: '/realstories/sofia-reyes-c1.jpg' } },
      { body: 'Three months of Sunday rehearsals for one cotillion and it was worth every single one. We did it, Sofia! Best night ever.', author: 'Bea', role: null, media: null },
      { body: 'Maligayang kaarawan, anak. Eighteen roses tonight, but you have had a whole family holding you up since day one. We love you.', author: 'Mama & Papa', role: null, media: { type: 'photo', url: '/realstories/sofia-reyes-c3.jpg' } },
    ],
    watchFilmEmbedUrl: null,
  };
}
