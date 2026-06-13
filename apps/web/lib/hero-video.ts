import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Homepage hero video — the admin-uploaded scroll-scrub.
 *
 * The owner uploads a short video in /admin/hero-video; the admin's browser
 * extracts it into an ordered list of JPEG frames (Vercel can't run ffmpeg),
 * uploads them to R2, and stores the public frame URLs in the single
 * `homepage_hero_config` row. The public homepage reads the published row and
 * renders <HeroVideoScrub> (a frame-by-frame scroll-scrub) in place of the
 * default hero — see app/_components/marketing/_sections.tsx Hero().
 *
 * Read uses the service-role client (no cookies → safe inside the force-static
 * homepage; the row is a public marketing asset, not a secret). Returns null
 * whenever nothing is published, so the caller falls back to the default hero.
 */

export type HeroVideoConfig = {
  videoUrl: string | null;
  frameUrls: string[];
  frameCount: number;
  frameWidth: number | null;
  frameHeight: number | null;
  ctaText: string;
  ctaHref: string;
  isPublished: boolean;
};

type HeroConfigRow = {
  video_url: string | null;
  video_r2_key: string | null;
  video_mime_type: string | null;
  frame_urls: unknown;
  frame_count: number | null;
  frame_width: number | null;
  frame_height: number | null;
  cta_text: string | null;
  cta_href: string | null;
  is_published: boolean | null;
  updated_at: string | null;
};

function toFrameUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

/**
 * Returns the published hero video config, or null when nothing is published
 * (or the published row has no frames yet). Never throws — a read failure
 * degrades to the default hero.
 */
export async function fetchPublishedHeroVideo(): Promise<HeroVideoConfig | null> {
  let row: HeroConfigRow | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('homepage_hero_config')
      .select(
        'video_url, video_r2_key, video_mime_type, frame_urls, frame_count, frame_width, frame_height, cta_text, cta_href, is_published, updated_at',
      )
      .eq('id', 1)
      .maybeSingle();
    row = (data as HeroConfigRow | null) ?? null;
  } catch {
    // Missing env / table not migrated yet → fall back to the default hero.
    return null;
  }

  if (!row || !row.is_published) return null;
  const frameUrls = toFrameUrls(row.frame_urls);
  if (frameUrls.length === 0) return null;

  return {
    videoUrl: row.video_url,
    frameUrls,
    frameCount: row.frame_count ?? frameUrls.length,
    frameWidth: row.frame_width,
    frameHeight: row.frame_height,
    ctaText: row.cta_text?.trim() || 'Start your wedding planning here — free',
    ctaHref: row.cta_href?.trim() || '/onboarding/wedding',
    isPublished: true,
  };
}

/** Full config (incl. drafts) for the admin editor. */
export async function fetchHeroVideoConfigForAdmin(): Promise<HeroVideoConfig & { videoR2Key: string | null }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('homepage_hero_config')
    .select(
      'video_url, video_r2_key, video_mime_type, frame_urls, frame_count, frame_width, frame_height, cta_text, cta_href, is_published, updated_at',
    )
    .eq('id', 1)
    .maybeSingle();
  const row = (data as HeroConfigRow | null) ?? null;
  const frameUrls = toFrameUrls(row?.frame_urls);
  return {
    videoUrl: row?.video_url ?? null,
    videoR2Key: row?.video_r2_key ?? null,
    frameUrls,
    frameCount: row?.frame_count ?? frameUrls.length,
    frameWidth: row?.frame_width ?? null,
    frameHeight: row?.frame_height ?? null,
    ctaText: row?.cta_text?.trim() || 'Start your wedding planning here — free',
    ctaHref: row?.cta_href?.trim() || '/onboarding/wedding',
    isPublished: Boolean(row?.is_published),
  };
}
