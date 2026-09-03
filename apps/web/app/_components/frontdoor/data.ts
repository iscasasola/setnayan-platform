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
import { loadYourPeople } from '@/lib/your-people';
import { loadPublishedShowcases } from '@/lib/showcase-db';
import { editorialsToStories } from '@/lib/front-door-editorials';
// The SAME tokenizer the reading search uses, so one typed query is split one
// way for both halves of the answer. A local split here is how "St. Mary's"
// finds a guide and misses the shop, with nothing reporting it.
import { searchTokens } from '@/lib/site-search-core';

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
  /**
   * WHICH KIND OF STORY THIS IS — the discriminant the ONE shelf runs on.
   *
   * `'chapter'`  — a storyteller's published piece (`lib/storytellers.ts`),
   *                living at `/u/{ownerSlug}/c/{publicId}`.
   * `'editorial'` — a REAL celebration's published editorial, consent-gated by
   *                `lib/showcase-db.ts` and living at the couple's own
   *                `/[slug]`. This is the thing `/realstories` surfaces.
   *
   * 🔑 THE SHELF DOES NOT SPLIT ON THIS — THE CARD DOES. The one-shelf rule
   * (owner 2026-08-12) is that articles and stories share a shelf and the CARD
   * says which kind it is. This field is what lets the card say it without a
   * second shelf appearing the day the first editorial publishes.
   */
  kind: 'chapter' | 'editorial';
  /**
   * The storyteller's handle — what makes the byline a DOOR to their page at
   * `/u/{ownerSlug}` rather than printed text.
   *
   * ⚠ CARRIED, NEVER PARSED OUT OF `href`. `href` happens to be
   * `/u/{ownerSlug}/c/{publicId}` today, so a slice of it would work — until
   * the chapter route moves, at which point the byline would silently point at
   * a fragment of a URL and 404. The loader already has the field
   * (`StorytellerTileItem.ownerSlug`); a card must not re-derive what the
   * loader knows.
   *
   * 🔑 NON-NULL FOR A CHAPTER, and that is what makes the door safe:
   * `fetchPublicOwners` refuses any owner without `public_profile_enabled`,
   * without a slug, or soft-deleted — so a chapter only reaches this shelf when
   * `/u/{ownerSlug}` is a page that renders. The card and its byline pass the
   * same gate, evaluated once, by the same function.
   *
   * 🔴 NULL FOR AN EDITORIAL, AND THAT IS THE WHOLE REASON THIS FIELD IS
   * NULLABLE. A showcase passes a DIFFERENT gate —
   * `users.public_summary_consent_at` (RA 10173 consent to be written up) —
   * which is NOT `public_profile_enabled`. That column is `DEFAULT FALSE` and
   * `/u/{slug}` 404s while it is, so a couple can consent to their editorial
   * being public while having no public profile page at all. Forcing an
   * `ownerSlug` on an editorial would therefore print a byline that links to a
   * 404, and it would do so on the FRONT PAGE, for the first real couple who
   * ever consents. Measured 2026-09-01 in production: 7 accounts, 1 with
   * `public_profile_enabled`, 0 consenters — so this has not bitten yet and
   * would have bitten the first time it could.
   *
   * ⚠ A NULL HERE MEANS "PRINT THE NAME, DO NOT LINK IT" — never "no author".
   * `ownerName` is still required and still rendered.
   */
  ownerSlug: string | null;
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
  /**
   * True when this ALREADY-PUBLIC story was written by somebody the viewer
   * already knows — what the "Your people" chip filters on.
   *
   * 🔑 A DERIVED BOOLEAN, NOT AN IDENTITY. The people set is resolved to
   * public profile slugs server-side (`lib/your-people.ts`) and collapsed to
   * this flag before anything crosses to the page, so no auth UUID and no
   * non-public person's handle travels with the payload.
   *
   * ⚠ FALSE FOR A STRANGER AND FALSE WHEN THE READ FAILED — both must fail
   * CLOSED. This is a claim about who somebody knows; a `true` invented by a
   * broken read would tell a person a stranger is their friend.
   */
  fromYourPeople: boolean;
  /**
   * Real aggregate view count for a CHAPTER; always `null` for an EDITORIAL.
   *
   * 🔴 NOT A NEW METRIC — the loader (`StorytellerTileItem.viewCount`) has
   * always had this; the front door simply never carried it through. Feeds
   * the Trending shelf (`selectTrendingChapters` in
   * `lib/front-door-composition.ts`), which ranks by this number among
   * chapters that are ALREADY admin-featured (that's what makes a chapter
   * reach `stories` at all — see the loader note above) — so Trending needs
   * no new "earned" threshold of its own; view count only decides the order.
   *
   * ⚠ NULL FOR AN EDITORIAL, DELIBERATELY. A couple's own wedding write-up
   * never carries a public view counter — the same privacy line the design
   * brief drew and `front-door-editorials.ts` already encodes for every other
   * editorial-only field.
   */
  viewCount: number | null;
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
  /**
   * `false` when the "your people" read FAILED — never when the viewer simply
   * has nobody yet, and never for a signed-out stranger (who correctly has
   * none, which is not a failure).
   *
   * 🔑 THE CHIP'S EMPTY STATE IS TWO DIFFERENT SENTENCES. "Nobody you know has
   * shared a story yet" is an invitation; "we couldn't check who you know" is
   * an apology. Collapsing them would tell somebody with twenty friends that
   * they have none — the same `null`-is-not-`0` rule every other count on this
   * page already keeps.
   */
  yourPeopleOk: boolean;
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
 * THE ONE GATE THAT DECIDES A SHOP MAY APPEAR ON THE FRONT PAGE —
 * `public_visibility='verified'` AND `verification_state='verified'`. BOTH are
 * required: a shop is live only when it is published and approved, and either
 * one alone has meant a hidden shop on a public shelf before.
 *
 * ⚠ IT IS A FUNCTION BECAUSE THERE ARE NOW TWO READERS. The shelf below and
 * `searchLiveShops` must admit exactly the same shops — a second hand-typed
 * pair of `.eq()`s is how one reader starts publishing what the other hides,
 * silently and in the direction that costs most. Same rule this file already
 * states about `readingMinutes`: two definitions of one rule do not stay equal.
 */
const LIVE_SHOP_GATE = {
  public_visibility: 'verified',
  verification_state: 'verified',
} as const;

/*
 * ⚠ APPLIED WITH `.match()`, NOT A GENERIC HELPER. The obvious shape — a
 * `<T extends Builder>(q: T) => T` wrapper — makes `tsc` give up with
 * "Type instantiation is excessively deep and possibly infinite" on
 * postgrest-js's builder types. `.match()` takes the same object both readers
 * share, so the rule is still written once.
 */

/** The columns both readers need, named once. */
const SHOP_COLUMNS =
  'business_name, business_slug, location_city, services, verification_state, logo_url';

/**
 * One row → one card. Shared for the same reason the gate is: the logo here is
 * an `r2://` tag that must be resolved (a raw value in an <img> fails in
 * silence), and a second copy of that resolution is a second place to forget.
 *
 * Returns null when the row has no address or no name — there would be nothing
 * to link to.
 */
async function toFrontDoorShop(
  row: Record<string, unknown>,
): Promise<FrontDoorShop | null> {
  const { WEDDING_FOLDER_LABEL } = await import('@/lib/taxonomy');
  const slug = typeof row.business_slug === 'string' ? row.business_slug : '';
  const name = typeof row.business_name === 'string' ? row.business_name : '';
  if (!slug || !name) return null;
  const services = Array.isArray(row.services) ? (row.services as unknown[]) : [];
  const first = services.find((s) => typeof s === 'string') as string | undefined;
  const folder = first ? await folderOfService(first) : null;
  return {
    // The bare-root address is canonical; /v/[slug] is legacy.
    href: `/${slug}`,
    logoUrl: await displayLogoUrl({
      logo_url: typeof row.logo_url === 'string' ? row.logo_url : null,
    }).catch(() => null),
    name,
    folderLabel: folder ? WEDDING_FOLDER_LABEL[folder] : 'Setnayan supplier',
    city: typeof row.location_city === 'string' ? row.location_city : null,
    verified: row.verification_state === 'verified',
  };
}

/**
 * Shops matching typed words — the front door's own `suppliers` answer.
 *
 * ─── WHAT THIS IS AND IS NOT ─────────────────────────────────────────────
 * It matches the shop's NAME and CITY, over exactly the shops the front page
 * already publishes. It is NOT the marketplace query: there is no word-bridge
 * (typing "photographer" does not resolve the Photo & video folder), no
 * category, faith, event-type, distance or off-peak filter, and no demo or
 * fraud-frozen exclusion beyond the shared gate above.
 *
 * 🔑 THAT LIMIT IS WHY THE RESULTS PAGE ALWAYS CARRIES THE MARKETPLACE ROW.
 * Re-implementing /explore's pipeline here would be a second definition of who
 * may be shown and which words reach them — the two would drift, and the
 * direction that costs is a hidden shop rendered on the front page. The
 * marketplace stays the one place that knows.
 *
 * AND across tokens, matching how the marketplace reads two typed words: a
 * person typing "manila florist" means both.
 */
export async function searchLiveShops(
  query: string,
  limit = 12,
): Promise<FrontDoorShop[]> {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  let q = admin.from('vendor_profiles').select(SHOP_COLUMNS).match(LIVE_SHOP_GATE);
  for (const token of tokens) {
    // The same `%token%` shape the marketplace uses, on the two columns this
    // reader can honestly claim. `escaped` keeps a typed comma or parenthesis
    // out of PostgREST's `or()` grammar, where it would silently change the
    // filter rather than fail.
    const escaped = token.replace(/[(),*]/g, '');
    if (!escaped) continue;
    q = q.or(`business_name.ilike.%${escaped}%,location_city.ilike.%${escaped}%`);
  }

  // ⚠ A REJECTED QUERY IS NOT A THROWN ERROR. Checked explicitly, per this
  // file's own rule — an unchecked `data ?? []` here would report "no shops
  // match" on a failed read, which is a different fact.
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit);
  if (error) return [];

  const out: FrontDoorShop[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const shop = await toFrontDoorShop(row);
    if (shop) out.push(shop);
  }
  return out;
}

/**
 * Live shops for the shelf.
 *
 * Returns `null` as the COUNT on a failed read so the caller can say
 * "couldn't load" instead of quietly claiming the marketplace is empty.
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

  // The COUNT is its own exact read — the shelf is capped at `limit`, so
  // counting the returned rows would silently under-report the moment a
  // thirteenth shop opens, which is precisely when the threshold matters.
  const counted = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id', { count: 'exact', head: true })
    .match(LIVE_SHOP_GATE);

  const { data, error } = await admin
    .from('vendor_profiles')
    .select(SHOP_COLUMNS)
    .match(LIVE_SHOP_GATE)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { shops: [], count: counted.error ? null : (counted.count ?? null) };

  const shops: FrontDoorShop[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    // The shop's own folder is resolved inside the shared mapper, through the
    // taxonomy, so the card says the same word the rail and the search say.
    const shop = await toFrontDoorShop(row);
    if (shop) shops.push(shop);
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
  const [articlesRaw, storiesRaw, shopsRaw, showcasesRaw, yourPeople] =
    await Promise.all([
      Promise.resolve(publishedBlogArticles()).catch(() => null),
      loadFeaturedChaptersResult(24).catch(() => ({ items: [], ok: false })),
      loadLiveShops(8).catch(() => ({ shops: [], count: null })),
      loadPublishedShowcases(24).catch(() => null),
      /*
        💸 NAMED COST, AND ONLY FOR SOMEBODY SIGNED IN. `loadYourPeople`
        returns on its first line without a session — which is every visitor to
        `/` in production today — for the auth check this page already makes.
        Signed in it is at most four small reads, all scoped by ids the viewer
        already owns, and it degrades on its own like every other rail here.
      */
      loadYourPeople().catch(() => ({ slugs: new Set<string>(), ok: false })),
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

  const chapters: FrontDoorStory[] = storiesRaw.items.map((s) => ({
    href: s.href,
    title: s.title,
    ownerName: s.ownerName,
    kind: 'chapter' as const,
    // The handle, carried so the byline can be a door. See the field's note on
    // the type: never sliced back out of `href`.
    ownerSlug: s.ownerSlug,
    /*
      MATCHED ON THE PUBLIC SLUG, WHICH IS WHY NO UUID HAS TO TRAVEL. Both
      sides of this comparison are values the shelf already publishes:
      `ownerSlug` is non-null by construction (`fetchPublicOwners` refuses an
      owner without a public page), and the set holds only slugs of people with
      `public_profile_enabled`. A failed people read yields an EMPTY set, so
      every story reads `false` — the chip then shows its written invitation
      instead of quietly claiming a stranger is a friend.
    */
    fromYourPeople: yourPeople.slugs.has(s.ownerSlug),
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
    // The loader's own real count — see the field's note on the type.
    viewCount: s.viewCount,
  }));

  // ⚠ SAMPLES ARE NOT REAL WEDDINGS. `loadPublishedShowcases` deliberately
  // falls back to a curated sample card so /realstories is never blank — but
  // the front door's threshold is a claim about how many real couples have
  // shared their day, and counting a sample toward it would make the page
  // lie about the one thing it promises ("nothing is staged").
  const realShowcases = (showcasesRaw ?? []).filter((s) => !s.isSample);
  const realWeddingCount = realShowcases.length;

  /*
    ─── THE EDITORIALS REACH THE SHELF ──────────────────────────────────────
    THE DEFECT THIS CLOSES: `loadPublishedShowcases(24)` has been called on
    this page since the front door shipped, and every row it returned was
    thrown away — reduced to `realWeddingCount`, a number the type above marks
    "Only ever feeds the SHAPE composer, never the screen". So the home page
    LOADED the published editorials and rendered none of them. A published
    editorial reached `/realstories` and nowhere else, while the front page's
    "Stories" chip showed only storyteller CHAPTERS, a different object.

    🔑 THIS IS A MAPPING, NOT A SECOND SOURCE. No new query, no new gate, no
    new table. The consent gate (RA 10173: eligible kind + public slug + T+30d
    grace + `public_summary_consent_at`) is `showcase-db.ts`'s and stays there;
    this only stops discarding what it already returned. `selectShelf` and
    `splitShelfRows` are untouched — they are generic over `hasVideo` /
    `fromYourPeople`, so a correctly-shaped editorial flows through the
    existing machinery with no change to either.

    ⚠ THE SHAPE RULES LIVE IN `lib/front-door-editorials.ts`, NOT HERE — it is
    pure and has no I/O, so the sample exclusion, the null byline and the
    fail-closed `fromYourPeople` are held by real assertions instead of a regex
    over this file. This module is `server-only` and DB-bound; nothing in it
    can be called from a test, which is exactly why the decision does not live
    in it. The assignment below is what proves the shapes still match.
  */
  const editorials: FrontDoorStory[] = editorialsToStories(realShowcases);

  /*
    EDITORIALS FIRST, THEN CHAPTERS. `loadPublishedShowcases` already returns
    featured-first (an editor pinned it), and a real celebration is what this
    page is for; the lead grid takes `stories.slice(0, 4)`, so this line decides
    what a visitor sees before scrolling.

    ⚠ NOT RE-SORTED ACROSS THE TWO. Both sources keep their own internal order,
    because their dates mean different things — an event date versus a publish
    date — and one comparator over both would silently rank them by a fact they
    do not share.

    🔑 An owner-movable ordering decision, not a law. It is one line, and it is
    this one.
  */
  const stories: FrontDoorStory[] = [...editorials, ...chapters];

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
    yourPeopleOk: yourPeople.ok,
  };
}
