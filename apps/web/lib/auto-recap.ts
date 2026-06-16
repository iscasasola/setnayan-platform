import 'server-only';

/**
 * apps/web/lib/auto-recap.ts — the Auto-Recap "living recap" assembler.
 *
 * The recap is built ON THE FLY from data that already exists; nothing here is
 * stored except the publish flag (`event_recaps`, read via getRecapStatus).
 *
 * THE FRAME is the couple's love story (loadEditorialData + composeCopy — the
 * same assembly the Editorial recap + Kwento Magazine use; no fork). THE PHOTOS
 * are PUBLIC-SAFE ONLY:
 *   1. `our_photos`         — the couple's own curated gallery (already public
 *                             on their site), via editorial.galleryPhotos.
 *   2. wall-safe derivatives — face-blurred, NSFW-screened, fail-closed tiles
 *                             from getWallSnapshot (wall_feed; clean +
 *                             wall_safe_r2_key only). The couple's UNBLURRED
 *                             masters NEVER appear here — those live only in the
 *                             couple-private Kwento Magazine.
 * THE VOICES are the Kwentos the couple one-tap approved to the wall
 * (status='approved' + wall_eligible — the same gate the Live Wall caption uses).
 *
 * Every read is best-effort; the assembler degrades to less content rather than
 * throwing. The route owns the published-gate decision.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { loadEditorialData } from '@/app/[slug]/_components/editorial/data';
import { composeCopy } from '@/app/[slug]/_components/editorial/compose';
import { bucketMoments } from '@/lib/kwento-magazine';
import { getWallSnapshot } from '@/lib/live-wall';

export type RecapStatus = 'draft' | 'published' | 'unpublished';

export type RecapStatusRow = {
  status: RecapStatus;
  publishedAt: string | null;
  unpublishedBy: 'couple' | 'admin' | null;
};

export type RecapVoice = { body: string; author: string };

export type RecapChapter = {
  title: string; // PH bilingual chapter title (Ang Paghahanda…)
  subtitle: string; // English subtitle (Getting ready…)
  whenLabel: string | null; // local start time, e.g. "3:40 PM"
  photoUrls: string[];
};

export type RecapModel = {
  coupleNames: string;
  firstNames: string;
  slug: string | null;
  eventDateIso: string | null;
  eventDateFormatted: string | null;
  venueLabel: string | null;
  monogramText: string;
  monogramColor: string;
  lede: string[];
  pullQuote: string | null;
  milestones: { label: string; detail: string }[];
  /** Couple-curated public gallery (our_photos). Always public-safe. */
  curatedPhotoUrls: string[];
  /** Wall-safe, face-blurred day stream, chaptered by capture time. */
  dayChapters: RecapChapter[];
  /** Wall-approved guest messages. */
  voices: RecapVoice[];
  totals: { photos: number; voices: number; guests: number | null };
  heroUrl: string | null;
};

export type RecapCardData = {
  coupleNames: string;
  dateLabel: string | null;
  monogramInitials: string;
  monogramColor: string;
  stats: { photos: number; voices: number; guests: number | null };
  heroUrl: string | null;
};

/** Couple-dashboard summary — honest counts for BOTH the private keepsake and
 *  what the PUBLIC recap would show, so the couple knows what publishing does. */
export type RecapCoupleSummary = {
  status: RecapStatus;
  publishedAt: string | null;
  /** Photos in the couple's full (private) set — their masters + curated. */
  privatePhotos: number;
  /** Photos the public recap would show (curated + wall-safe). */
  publicPhotos: number;
  /** Guest messages the couple approved (private set). */
  approvedKwentos: number;
  /** Guest messages the public recap would show (wall-approved). */
  publicVoices: number;
  guests: number | null;
  slug: string | null;
};

/** Two-letter monogram initials from a display name ("Maria & Juan" → "MJ"). */
function initialsFrom(displayName: string): string {
  const words = displayName.split(/[^\p{L}]+/u).filter((w) => w.length > 1);
  const letters = words
    .filter((w) => !['and', 'at', 'ni', 'nina'].includes(w.toLowerCase()))
    .map((w) => w[0]?.toUpperCase() ?? '');
  return letters.slice(0, 2).join('') || displayName.slice(0, 1).toUpperCase();
}

/** Read the publish row for an event (service-role; never throws). */
export async function getRecapStatus(eventId: string): Promise<RecapStatusRow | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('event_recaps')
      .select('status, published_at, unpublished_by')
      .eq('event_id', eventId)
      .maybeSingle();
    if (!data) return null;
    return {
      status: (data.status as RecapStatus) ?? 'draft',
      publishedAt: (data.published_at as string) ?? null,
      unpublishedBy: (data.unpublished_by as 'couple' | 'admin' | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** True only when the couple has the public recap turned on. */
export async function isRecapPublished(eventId: string): Promise<boolean> {
  const row = await getRecapStatus(eventId);
  return row?.status === 'published';
}

/** Wall-approved Kwento voices for the public surface (same gate as the Live
 *  Wall caption: approved + wall_eligible + not hidden + author not hidden). */
async function loadPublicVoices(eventId: string): Promise<RecapVoice[]> {
  try {
    const admin = createAdminClient();
    const { data: msgs } = await admin
      .from('photo_messages')
      .select('body_text, guest_id, updated_at')
      .eq('event_id', eventId)
      .eq('status', 'approved')
      .eq('wall_eligible', true)
      .eq('hide_from_wall', false)
      .eq('author_publicly_hidden', false)
      .order('updated_at', { ascending: true })
      .limit(60);
    const rows = msgs ?? [];
    if (rows.length === 0) return [];
    const guestIds = [...new Set(rows.map((m) => m.guest_id as string))];
    const { data: authors } = await admin
      .from('guests')
      .select('guest_id, first_name, display_name')
      .in('guest_id', guestIds);
    const nameOf = new Map(
      (authors ?? []).map((g) => [
        g.guest_id as string,
        (g.display_name as string) || (g.first_name as string) || 'A guest',
      ]),
    );
    return rows.map((m) => ({
      body: m.body_text as string,
      author: nameOf.get(m.guest_id as string) ?? 'A guest',
    }));
  } catch {
    return [];
  }
}

/**
 * Build the full PUBLIC recap model. `null` only when the event itself can't be
 * loaded (which the page turns into a graceful "not available" state).
 */
export async function assembleRecapModel(eventId: string): Promise<RecapModel | null> {
  const editorial = await loadEditorialData(eventId);
  if (!editorial) return null;
  const copy = composeCopy(editorial);

  // Wall-safe, face-blurred day stream → chaptered by capture time. Best-effort:
  // an event without the Live Photo Wall simply has no day chapters (the recap
  // still leads with the love story + curated gallery + voices).
  let dayChapters: RecapChapter[] = [];
  let wallCount = 0;
  try {
    const snap = await getWallSnapshot(eventId, null);
    wallCount = snap.count;
    const urlByFeed = new Map(snap.tiles.map((t) => [t.feedId, t.url]));
    const caps = snap.tiles.map((t) => ({
      sourceTable: 'wall_feed',
      sourceId: t.feedId,
      capturedAtMs: Date.parse(t.sortAt) || 0,
    }));
    dayChapters = bucketMoments(caps)
      .map((ch) => ({
        title: ch.title,
        subtitle: ch.subtitle,
        whenLabel: ch.startMs
          ? new Date(ch.startMs).toLocaleTimeString('en-PH', {
              hour: 'numeric',
              minute: '2-digit',
            })
          : null,
        photoUrls: ch.captures
          .map((c) => urlByFeed.get(c.sourceId))
          .filter((u): u is string => Boolean(u)),
      }))
      .filter((ch) => ch.photoUrls.length > 0);
  } catch {
    dayChapters = [];
  }

  const voices = await loadPublicVoices(eventId);

  const curatedPhotoUrls = editorial.galleryPhotos ?? [];
  const heroUrl =
    dayChapters[0]?.photoUrls[0] ?? curatedPhotoUrls[0] ?? editorial.heroPhotoUrl ?? null;

  const milestones = (editorial.loveStory?.milestones ?? [])
    .map((m) => ({
      label: [m.year, m.title].filter(Boolean).join(' · '),
      detail: m.note ?? '',
    }))
    .filter((m) => m.label || m.detail);

  return {
    coupleNames: editorial.displayName,
    firstNames: editorial.firstNames,
    slug: editorial.slug,
    eventDateIso: editorial.eventDate,
    eventDateFormatted: editorial.eventDateFormatted,
    venueLabel: editorial.venueName || editorial.venueCity,
    monogramText: editorial.monogramText,
    monogramColor: editorial.monogramColor,
    lede: copy.leadParagraphs,
    pullQuote: copy.pullQuote,
    milestones,
    curatedPhotoUrls,
    dayChapters,
    voices,
    totals: {
      photos: curatedPhotoUrls.length + wallCount,
      voices: voices.length,
      guests: editorial.metrics.guests || null,
    },
    heroUrl,
  };
}

/** Light data for the OG/share card (no per-photo presigning of the full set). */
export async function loadRecapCardData(eventId: string): Promise<RecapCardData | null> {
  const editorial = await loadEditorialData(eventId);
  if (!editorial) return null;

  let wallCount = 0;
  let voices = 0;
  try {
    const admin = createAdminClient();
    const [{ count: wc }, { count: vc }] = await Promise.all([
      admin
        .from('wall_feed')
        .select('feed_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .is('wall_hidden_at', null),
      admin
        .from('photo_messages')
        .select('message_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'approved')
        .eq('wall_eligible', true)
        .eq('hide_from_wall', false)
        .eq('author_publicly_hidden', false),
    ]);
    wallCount = wc ?? 0;
    voices = vc ?? 0;
  } catch {
    wallCount = 0;
    voices = 0;
  }

  const curated = editorial.galleryPhotos?.length ?? 0;
  return {
    coupleNames: editorial.displayName,
    dateLabel: editorial.eventDateFormatted,
    monogramInitials: initialsFrom(editorial.displayName),
    monogramColor: editorial.monogramColor,
    stats: { photos: curated + wallCount, voices, guests: editorial.metrics.guests || null },
    heroUrl: editorial.heroPhotoUrl ?? editorial.galleryPhotos?.[0] ?? null,
  };
}

/** Couple-dashboard summary — counts for both the private keepsake and what
 *  the public recap would show. Best-effort; degrades to zeros, never throws. */
export async function loadRecapCoupleSummary(eventId: string): Promise<RecapCoupleSummary> {
  const admin = createAdminClient();
  const status = await getRecapStatus(eventId);

  const zero: RecapCoupleSummary = {
    status: status?.status ?? 'draft',
    publishedAt: status?.publishedAt ?? null,
    privatePhotos: 0,
    publicPhotos: 0,
    approvedKwentos: 0,
    publicVoices: 0,
    guests: null,
    slug: null,
  };

  try {
    const [
      { count: seat },
      { count: guestCaps },
      { count: approvedKwentos },
      { count: wallSafe },
      { count: publicVoices },
      { count: guests },
      { data: ev },
    ] = await Promise.all([
      admin
        .from('papic_photos')
        .select('photo_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('photo_type', 'photo')
        .is('hidden_at', null),
      admin
        .from('papic_guest_captures')
        .select('capture_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .is('hidden_at', null),
      admin
        .from('photo_messages')
        .select('message_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'approved'),
      admin
        .from('wall_feed')
        .select('feed_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .is('wall_hidden_at', null),
      admin
        .from('photo_messages')
        .select('message_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'approved')
        .eq('wall_eligible', true)
        .eq('hide_from_wall', false)
        .eq('author_publicly_hidden', false),
      admin
        .from('guests')
        .select('guest_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .is('deleted_at', null),
      admin.from('events').select('slug, our_photos').eq('event_id', eventId).maybeSingle(),
    ]);

    const curated = Array.isArray((ev as { our_photos?: unknown } | null)?.our_photos)
      ? ((ev as { our_photos: unknown[] }).our_photos.filter(
          (r) => typeof r === 'string' && (r as string).trim().length > 0,
        ).length as number)
      : 0;

    return {
      status: status?.status ?? 'draft',
      publishedAt: status?.publishedAt ?? null,
      privatePhotos: (seat ?? 0) + (guestCaps ?? 0) + curated,
      publicPhotos: curated + (wallSafe ?? 0),
      approvedKwentos: approvedKwentos ?? 0,
      publicVoices: publicVoices ?? 0,
      guests: guests ?? null,
      slug: (ev as { slug?: string } | null)?.slug ?? null,
    };
  } catch {
    return zero;
  }
}
