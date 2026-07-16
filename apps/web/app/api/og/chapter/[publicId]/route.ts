import { type NextRequest } from 'next/server';

import { fetchPublishedChapterForShare } from '@/lib/creator-public';
import {
  youtubeThumbFromEmbedUrl,
  CHAPTER_KIND_LABEL,
} from '@/lib/creator-chapters';
import { renderChapterOgJpeg } from '@/lib/social/chapter-card';

/**
 * GET /api/og/chapter/[publicId] — the Open Graph share card for a public
 * Adventure Chapter at /u/[userSlug]/c/[publicId] (share-asset completion
 * 2026-07-17). A 1200×630 card: chapter title + storyteller byline + the
 * Storyteller badge mark over the chapter's YouTube-derived thumbnail (the
 * same derivation the Storytellers shelf uses); IG/TikTok embeds (no derivable
 * thumb) get the branded card. Wired as the chapter page's og:image so each
 * chapter unfurls as ITSELF, not as the owner's generic profile card.
 *
 * SAFETY GATE (mirrors the chapter page's resolve()): the title/name-bearing
 * card renders ONLY when the chapter is PUBLISHED and its owner's profile is
 * public + non-deleted + slugged (fetchPublishedChapterForShare applies the
 * whole gate in one place). A draft/hidden chapter, a private profile, an
 * unknown id, or any render failure ALL 302 to the static brand card — a
 * chapter title or storyteller name is never leaked for a page that isn't
 * actually public.
 *
 * Public (crawlers fetch with no session), Node runtime (native satori/sharp).
 * Short cache — a storyteller can retitle or unpublish, and we want the card
 * to follow within the hour.
 */
export const runtime = 'nodejs';

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com'
).replace(/\/$/, '');
const DEFAULT_OG = `${SITE_URL}/brand/og-card.webp`;

const CARD_HEADERS = {
  'Content-Type': 'image/jpeg',
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
} as const;

function jpegResponse(buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), { headers: CARD_HEADERS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  try {
    const resolved = await fetchPublishedChapterForShare(publicId);
    if (!resolved) return Response.redirect(DEFAULT_OG, 302);

    const { chapter, ownerName } = resolved;
    const kindLabel =
      chapter.kind in CHAPTER_KIND_LABEL
        ? CHAPTER_KIND_LABEL[chapter.kind]
        : 'Setnayan';

    const jpeg = await renderChapterOgJpeg({
      title: chapter.title,
      storytellerName: ownerName,
      kindLabel,
      thumbUrl: youtubeThumbFromEmbedUrl(chapter.embed_url),
    });
    return jpegResponse(jpeg);
  } catch {
    return Response.redirect(DEFAULT_OG, 302);
  }
}
