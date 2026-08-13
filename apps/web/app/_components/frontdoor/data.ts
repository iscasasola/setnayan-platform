/**
 * data.ts — what the front door actually knows, read from real sources.
 *
 * ─── THE RULE THIS FILE EXISTS TO KEEP ───────────────────────────────────
 * `null` means "couldn't load". `0` means "we looked, there are none". They
 * are different facts and the page says different things about them. Showing
 * "0 photos" to somebody who has 148 is how a person stops trusting a
 * product, so every count here is `number | null` and a read FAILURE never
 * collapses into a zero.
 *
 * ⚠ THE SHARED SHELF LOADERS DO NOT KEEP THAT DISTINCTION, and an earlier
 * version of this file claimed otherwise while delegating straight to them.
 * `loadFeaturedChapters` and `loadPublishedShowcases` both return `[]` for a
 * REJECTED query as well as an empty one — correct for a shelf that renders
 * nothing either way, fatal for anything that puts a NUMBER on screen. So the
 * storyteller read goes through `loadFeaturedChaptersResult`, which reports
 * its own success, and the showcase count is used ONLY for rail SHAPE and is
 * never displayed. What a number here claims, it can back.
 *
 * ⚠ A REJECTED QUERY IS NOT A THROWN ERROR. Supabase resolves with
 * `{ data: null, error }` — a phantom column or a missing grant returns
 * quietly. Every read below checks `error` explicitly; none relies on a
 * `catch` to notice, because there is nothing to catch.
 *
 * ─── LAUNCH DAY IS THE PRIMARY STATE, NOT A VARIANT ──────────────────────
 * Measured against production 2026-08-13:
 *   • 1 published chapter, but `showcase_featured_at IS NULL` ⇒ the public
 *     shelf loader returns nothing. The storyteller rail is ABSENT, and the
 *     threshold below is deliberately keyed on what reaches the PUBLIC shelf
 *     (featured), not on "a chapter exists" — keying it on existence would
 *     render the empty shelf the design forbids.
 *   • 0 consented couples ⇒ 0 publishable real weddings.
 *   • 1 live shop.
 *   • The writing carries the page.
 */
import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { displayLogoUrl } from '@/lib/uploads';
import {
  publishedBlogArticles,
  blogCategoryLabel,
  readingMinutes,
} from '@/lib/blog';
import { loadFeaturedChaptersResult } from '@/lib/storytellers';
import { loadPublishedShowcases } from '@/lib/showcase-db';

/**
 * ─── THE THRESHOLDS LIVE IN ONE MODULE, NOT HERE ─────────────────────────
 * `lib/front-door-composition.ts` owns every rail's shape rule and its
 * numbers. This file's job is to MEASURE the world; that module's job is to
 * decide what the measurements mean. Keeping a second copy of "12" here is
 * how the rail and the heading start disagreeing.
 *
 * 🔑 HOW `null` SURVIVES THE HANDOFF. `composeFrontDoor` takes plain numbers
 * and floors anything non-finite at 0, deliberately, so a failed read can
 * never PROMOTE a rail. That is the right direction for SHAPE. But it would be
 * the wrong answer for DISPLAY — "0 shops" and "we could not count the shops"
 * are different sentences. So a null count is passed to the composer as 0
 * (fail-safe, never promotes) and kept as null on the way to the screen
 * (honest, never says zero). Both properties hold at once.
 */

export type FrontDoorArticle = {
  slug: string;
  title: string;
  category: string;
  publishedAt: string;
  cover: string;
  coverAlt: string;
  /** Real computed reading time — the Journal already knows it. */
  readingMinutes: number;
};

export type FrontDoorStory = {
  href: string;
  title: string;
  ownerName: string;
  kindLabel: string;
  /** A written chapter legitimately has no video. Never a reason to drop it. */
  hasVideo: boolean;
  /**
   * Reading time from the chapter's FULL body — computed at the loader, where
   * the body exists, with the same rule the Journal uses. `null` when the
   * chapter has no readable body yet; the card then shows no minutes rather
   * than a guess.
   */
  readingMinutes: number | null;
  /**
   * The chapter's poster. `null` is COMMON and legitimate, not a failure:
   * a thumbnail is only derivable from YouTube, so an Instagram or TikTok
   * chapter has a real video and no poster, and a chapter told purely in
   * writing has neither.
   *
   * ⚠ NOT THE SAME QUESTION AS `hasVideo` — see that field. Deciding "is there
   * a video" from this is the bug fixed in #4402.
   *
   * ⚠ NEVER A PRESIGNED R2 URL. This shelf is ISR, so a signed poster baked
   * into the HTML starts 403ing hours later with no deploy and nothing to
   * blame. A YouTube thumb URL is stable and unsigned, which is exactly why
   * the loader only derives one from YouTube.
   */
  thumbUrl: string | null;
  /** The opening line — the hero for a chapter told in writing. */
  excerpt: string | null;
};

export type FrontDoorShop = {
  href: string;
  name: string;
  folderLabel: string;
  city: string | null;
  verified: boolean;
  /**
   * The shop's resolved logo, or null → the card falls back to initials.
   *
   * ⚠ `vendor_profiles.logo_url` holds an `r2://` tag, NOT a URL — putting the
   * raw value in an <img> fails silently. `displayLogoUrl` resolves it (and
   * passes a legacy https value straight through).
   */
  logoUrl: string | null;
};

export type FrontDoorData = {
  articles: FrontDoorArticle[];
  /** How many articles are published in total — NOT how many this page shows. */
  articleTotal: number;
  stories: FrontDoorStory[];
  /**
   * Storytellers' published pieces. `null` = the read FAILED.
   *
   * ⚠ THIS IS NOT `stories.length`, AND THE DIFFERENCE IS THE WHOLE POINT.
   * The shared shelf loader returns `[]` for both "none yet" and "rejected",
   * so a count taken from the array would print "0 theirs" to a visitor on a
   * day when eight are published, with nothing anywhere saying so.
   */
  storyCount: number | null;
  shops: FrontDoorShop[];
  /** null = the read failed. Never coerced to 0. */
  liveShopCount: number | null;
  /**
   * Real, consented, non-sample published weddings.
   * ⚠ Only ever feeds the SHAPE composer, never the screen — the shared
   * showcase loader also collapses a failed read to `[]`, so this cannot be
   * trusted as a displayed number and is deliberately not displayed.
   */
  realWeddingCount: number;
};

/*
 * ⚠ THERE IS NO LOCAL `readingMinutes` HERE, AND THAT IS THE POINT.
 *
 * The first cut of this file wrote one — and it divided by 220 while the
 * shipped `readingMinutes` in `lib/blog.ts` divides by 200 and walks the blocks
 * through `blogPlainText`. So the SAME article would have advertised one
 * reading time on the front page and a different one on the article itself.
 * Two definitions of one rule do not stay equal; these two were never equal to
 * begin with. Caught by `lint:dup-rule`, which is exactly what it is for.
 */

/**
 * Live shops — `public_visibility='verified'` AND `verification_state='verified'`.
 * BOTH are required: a shop is live only when it is published and approved,
 * and either one alone has meant a hidden shop on a public shelf before.
 *
 * Returns `null` on a failed read so the caller can say "couldn't load"
 * instead of quietly claiming the marketplace is empty.
 */
async function loadLiveShops(
  limit: number,
): Promise<{ shops: FrontDoorShop[]; count: number | null }> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { shops: [], count: null };
  }

  const { WEDDING_FOLDER_LABEL } = await import('@/lib/taxonomy');

  // The COUNT is its own exact read — the shelf is capped at `limit`, so
  // counting the returned rows would silently under-report the moment a
  // thirteenth shop opens, which is precisely when the threshold matters.
  const counted = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id', { count: 'exact', head: true })
    .eq('public_visibility', 'verified')
    .eq('verification_state', 'verified');

  const { data, error } = await admin
    .from('vendor_profiles')
    .select(
      'business_name, business_slug, location_city, services, verification_state, logo_url',
    )
    .eq('public_visibility', 'verified')
    .eq('verification_state', 'verified')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { shops: [], count: counted.error ? null : (counted.count ?? null) };

  const shops: FrontDoorShop[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const slug = typeof row.business_slug === 'string' ? row.business_slug : '';
    const name = typeof row.business_name === 'string' ? row.business_name : '';
    if (!slug || !name) continue; // no address ⇒ nothing to link to
    // The shop's own folder, resolved through the taxonomy so the card says
    // the same word the rail and the search say.
    const services = Array.isArray(row.services) ? (row.services as unknown[]) : [];
    const first = services.find((s) => typeof s === 'string') as string | undefined;
    const folder = first ? await folderOfService(first) : null;
    shops.push({
      // The bare-root address is canonical; /v/[slug] is legacy.
      href: `/${slug}`,
      logoUrl: await displayLogoUrl({
        logo_url: typeof row.logo_url === 'string' ? row.logo_url : null,
      }).catch(() => null),
      name,
      folderLabel: folder ? WEDDING_FOLDER_LABEL[folder] : 'Setnayan supplier',
      city: typeof row.location_city === 'string' ? row.location_city : null,
      verified: row.verification_state === 'verified',
    });
  }
  return { shops, count: counted.error ? null : (counted.count ?? null) };
}

async function folderOfService(key: string) {
  const { TAXONOMY_MAP } = await import('@/lib/taxonomy');
  return TAXONOMY_MAP[key]?.folder ?? null;
}

/**
 * Everything the front door renders, loaded in parallel.
 *
 * Each rail degrades on its own: a broken storyteller read must never blank
 * the writing that is carrying the page.
 */
export async function loadFrontDoorData(): Promise<FrontDoorData> {
  const [articlesRaw, storiesRaw, shopsRaw, showcasesRaw] = await Promise.all([
    Promise.resolve(publishedBlogArticles()).catch(() => null),
    loadFeaturedChaptersResult(24).catch(() => ({ items: [], ok: false })),
    loadLiveShops(8).catch(() => ({ shops: [], count: null })),
    loadPublishedShowcases(24).catch(() => null),
  ]);

  const articles: FrontDoorArticle[] = (articlesRaw ?? [])
    .slice()
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 12)
    .map((a) => ({
      slug: a.slug,
      title: a.title,
      category: blogCategoryLabel(a.category),
      publishedAt: a.publishedAt,
      cover: a.cover,
      coverAlt: a.coverAlt,
      // The Journal's own reading time, imported — so a card cannot promise
      // 5 minutes here and 6 on the article itself.
      readingMinutes: readingMinutes(a.blocks),
    }));

  const stories: FrontDoorStory[] = storiesRaw.items.map((s) => ({
    href: s.href,
    title: s.title,
    ownerName: s.ownerName,
    kindLabel: s.kindLabel,
    /*
      ⚠ THE LOADER'S OWN `hasVideo`, NEVER `Boolean(thumbUrl)`.

      `thumbUrl` is a YOUTUBE-DERIVED poster, and only YouTube yields a
      derivable thumbnail — so an Instagram or TikTok chapter has a video and
      no thumb. Deriving "has video" from the picture therefore answers NO for
      a chapter that is entirely video, which drops it out of the "With video"
      chip and strips the ▶ from its card.

      `StorytellerTileItem` says this in the type itself, and records that the
      same substitution was already made once ("Deciding the Watch/Read label
      from the thumbnail labelled those 'Read'"). The first cut of this file
      made it again. The loader already computes the honest answer from
      `embed_url`; carry it.
    */
    hasVideo: s.hasVideo,
    // Real now: computed at the loader from the FULL body, not guessed from
    // the lede. Still null-able — a chapter with no body shows no minutes.
    // (#4400 closed the debt this file used to name here.)
    readingMinutes: s.readingMinutes,
    // The two the card leads with. The loader has always had both; the front
    // door simply never carried them, so its card printed the WORDS "THEIR
    // STORY" where the picture goes — the same placeholder the shop card was
    // corrected for in #4400, on the card beside it.
    thumbUrl: s.thumbUrl,
    excerpt: s.excerpt,
  }));

  // ⚠ SAMPLES ARE NOT REAL WEDDINGS. `loadPublishedShowcases` deliberately
  // falls back to a curated sample card so /realstories is never blank — but
  // the front door's threshold is a claim about how many real couples have
  // shared their day, and counting a sample toward it would make the page
  // lie about the one thing it promises ("nothing is staged").
  const realWeddingCount = (showcasesRaw ?? []).filter((s) => !s.isSample).length;

  return {
    articles,
    // ⚠ THE TOTAL, NOT THE SLICE. `articles` is capped for the grid; the
    // sentence "There are N pieces" is a claim about the ARCHIVE. Taking N
    // from the truncated array told a visitor the archive held 12 when 33 are
    // published — a number that shrinks as the page gets busier.
    articleTotal: (articlesRaw ?? []).length,
    stories,
    // null ⇒ the read failed ⇒ the heading says "couldn't load", never "0".
    storyCount: storiesRaw.ok ? storiesRaw.items.length : null,
    shops: shopsRaw.shops,
    liveShopCount: shopsRaw.count,
    realWeddingCount,
  };
}
