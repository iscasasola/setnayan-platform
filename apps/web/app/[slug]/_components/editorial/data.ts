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

/** Display labels for in-app Setnayan service_keys (the "Powered by Setnayan"
 * strip). Unknown keys fall back to prettyServiceKey(). */
const SERVICE_LABELS: Record<string, string> = {
  ANIMATED_MONOGRAM: 'Animated Monogram',
  CAMERA_BRIDGE: 'Camera Bridge',
  CUSTOM_QR_GUEST: 'Custom Guest QR',
  EVENT_WEBSITE: 'Event Website',
  LIVE_BACKGROUND: 'Live Background',
  LIVE_WALL: 'Live Photo Wall',
  PABATI: 'Pabati',
  PAKANTA: 'Pakanta',
  PANOOD_SYSTEM: 'Panood Livestream',
  PAPIC_ADDON_STORIES: 'Guest Stories',
  PAPIC_ADDON_THANK_YOU: 'Thank-You Video',
  PAPIC_GUEST: 'Papic Guest',
  PAPIC_SEATS: 'Papic',
  PATIKTOK_COMPILER: 'Patiktok',
  PRO_RSVP: 'Pro RSVP',
  PRO_WEBSITE: 'Pro Website',
  RSVP_PRO_WEBSITE: 'Pro Website',
  SDE: 'Same-Day Edit',
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
  // tier_state ('free'|'verified'|'pro'|'enterprise') or null when the event
  // vendor isn't linked to a marketplace profile. Free vendors are excluded
  // upstream (hidden from the Editorial entirely, per §3).
  tier: 'free' | 'verified' | 'pro' | 'enterprise' | null;
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
  fromTheCouple: boolean;
  vendorsWeLoved: boolean;
};

export const EDITORIAL_SECTION_KEYS: ReadonlyArray<keyof EditorialSections> = [
  'byTheNumbers',
  'gallery',
  'reviews',
  'team',
  'poweredBy',
  'liveWall',
  'fromTheCouple',
  'vendorsWeLoved',
];

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
  published: boolean;
  heroPhotoUrl: string | null;
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
  // Shared photos from the day (events.our_photos), resolved to display URLs —
  // the editorial photo gallery.
  galleryPhotos: string[];
  // Live Photo Wall (events.photo_wall_photos), resolved to display URLs.
  // Only surfaced when photoWallActive is true (LIVE_WALL SKU activated).
  photoWallPhotos: string[];
  photoWallActive: boolean;
  // Section visibility from the editorial editor. Optional → a block shows
  // unless its key is explicitly false (samples omit it = everything on).
  sections?: Partial<EditorialSections>;
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
        'event_id, slug, display_name, event_date, venue_name, venue_address, monogram_text, monogram_color, love_story, special_message, together_since, story_tone, story_language, landing_page_hero_image_url, our_photos, photo_wall_photos',
      )
      .eq('event_id', eventId)
      .maybeSingle();
    if (!error && data) event = data as Record<string, unknown>;
  } catch {
    event = null;
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
            const tier = (['free', 'verified', 'pro', 'enterprise'] as const).find(
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
        // §3 + tier matrix (Phase C #4): Free vendors are hidden from the
        // Editorial entirely. Editorial *tagging* — the showcase treatment
        // (logo + tier badge + profile link) — is PRO/ENTERPRISE only (matrix
        // "Editorial" row: free ✗ / verified ✗ / pro Tagged / ent Tagged).
        // Verified vendors stay credited (the couple used them) but as a plain
        // text credit: suppress logo + slug so they get no card/link/badge.
        if (tier === 'free') continue;
        const tagged = tier === 'pro' || tier === 'enterprise';
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

  // 6. Hero photo (OPTIONAL). Resolve event_editorial.hero_photo_id → R2 key →
  // presigned URL. Skips silently on any error.
  let heroPhotoUrl: string | null = null;
  const heroPhotoId = asString(editorial?.hero_photo_id);
  if (heroPhotoId) {
    try {
      // PUBLIC surface → a moderation-withheld capture never renders as the
      // hero, even if the couple picked it before the screen finished. The
      // couple can restore it via the moderation page's "Approve" override
      // (sets 'clean'), after which it resolves again.
      const { data: photoRow } = await admin
        .from('papic_photos')
        .select('r2_object_key, photo_type')
        .eq('photo_id', heroPhotoId)
        .eq('event_id', eventId)
        .not(
          'moderation_state',
          'in',
          '("nsfw_blocked","consent_withheld","faceblock_withheld")',
        )
        .maybeSingle();
      const key = asString((photoRow as Record<string, unknown> | null)?.r2_object_key);
      const ptype = asString((photoRow as Record<string, unknown> | null)?.photo_type);
      if (key && ptype !== 'clip') {
        heroPhotoUrl = await displayUrlForStoredAsset(key);
      }
    } catch {
      heroPhotoUrl = null;
    }
  }
  // Fallback: if no curated editorial hero photo, reuse the couple's website
  // hero image so the editorial still leads with a photo. displayUrlForStoredAsset
  // passes plain/relative URLs through unchanged.
  if (!heroPhotoUrl) {
    heroPhotoUrl = await displayUrlForStoredAsset(
      asString((event as Record<string, unknown>).landing_page_hero_image_url),
    );
  }

  // 6b. Shared photo gallery (events.our_photos → display URLs). Each ref goes
  // through displayUrlForStoredAsset (presigns r2://, passes plain/relative
  // URLs through). Best-effort.
  const galleryRefs = Array.isArray((event as Record<string, unknown>).our_photos)
    ? ((event as Record<string, unknown>).our_photos as unknown[]).filter(
        (r): r is string => typeof r === 'string' && r.trim().length > 0,
      )
    : [];
  const galleryPhotos = (
    await Promise.all(galleryRefs.map((ref) => displayUrlForStoredAsset(ref)))
  ).filter((u): u is string => Boolean(u));

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
      const { data: act } = await admin
        .from('event_software_activations_v2')
        .select('service_code')
        .eq('event_id', eventId)
        .eq('service_code', 'LIVE_WALL')
        .maybeSingle();
      photoWallActive = Boolean(act);
    } catch {
      photoWallActive = false;
    }
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
    published,
    heroPhotoUrl,
    metrics,
    archetype,
    vendors,
    vendorsWeLoved,
    reviews,
    servicesAvailed,
    galleryPhotos,
    photoWallPhotos,
    photoWallActive,
    sections: readSections(draftJson),
  };
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

function numOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function normalizeTone(v: unknown): StoryTone {
  const s = asString(v);
  return s === 'warm' || s === 'playful' || s === 'formal' ? s : null;
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
};

// /realstories wedding slug → sample sentinel id. Drives the detail page.
export const SAMPLE_EDITORIAL_IDS: Record<string, string> = {
  'maria-and-juan-tagaytay-garden-wedding': 'sample-maria-and-juan',
  'jack-and-jill-cebu-beach-wedding': 'sample-jack-and-jill',
  'john-and-jane-manila-rooftop-wedding': 'sample-john-and-jane',
  'peter-and-mary-tagaytay-estate-wedding': 'sample-peter-and-mary',
  'jack-and-rose-baguio-forest-wedding': 'sample-jack-and-rose',
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
    draft: {},
    published: true,
    heroPhotoUrl: '/realstories/maria-juan-tagaytay.jpg',
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
      photos: null,
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
    servicesAvailed: ['Setnayan AI', 'Event Website', 'Papic', 'Panood Livestream', 'Pakanta'],
    galleryPhotos: [],
    photoWallPhotos: [],
    photoWallActive: false,
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
    draft: {},
    published: true,
    heroPhotoUrl: '/realstories/jack-jill-cebu.jpg',
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
    galleryPhotos: [],
    photoWallPhotos: [],
    photoWallActive: false,
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
    draft: {},
    published: true,
    heroPhotoUrl: '/realstories/john-jane-manila.jpg',
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
    galleryPhotos: [],
    photoWallPhotos: [],
    photoWallActive: false,
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
    draft: {},
    published: true,
    heroPhotoUrl: '/realstories/peter-mary-tagaytay.jpg',
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
    servicesAvailed: ['Setnayan AI', 'Event Website', 'Papic', 'Panood Livestream'],
    galleryPhotos: [],
    photoWallPhotos: [],
    photoWallActive: false,
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
    draft: {},
    published: true,
    heroPhotoUrl: '/realstories/jack-rose-baguio.jpg',
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
    galleryPhotos: [],
    photoWallPhotos: [],
    photoWallActive: false,
  };
}
