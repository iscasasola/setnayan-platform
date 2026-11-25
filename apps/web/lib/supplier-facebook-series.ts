/**
 * 📣 THE SUPPLIER FACEBOOK SERIES: 21 posts that bring suppliers to Setnayan, KEPT OUT OF THE QUEUE until the
 * Meta app is Live.
 *
 * Owner 2026-11-24, verbatim: "our first goal is to have posts that promotes to suppliers on facebook", then
 * "supplier posts to december appoved" (Batch 1, in the approved image look). Each caption has at most 3 lines of
 * at most 12 words, one link, and no typed price. The images are public/marketing/2026-11-24/facebook/supplier-NN.jpg.
 *
 * WHY NOTHING IS QUEUED YET: Meta's business verification is still in review, so the app is in Development.
 * Controller, 24 Nov: the posts "must NOT post until I confirm the Meta app is Live". So this PR adds NO
 * `social_posts` row. The flush cannot post what is not in its queue.
 *
 * Why not a far-future hold: a row queued with a 2099 `publish_after` gets a 2099 `scheduled_for`. The evergreen
 * floor (`sweepEvergreenFloor`) counts any row with `scheduled_for >= now − 3 days` as recent activity, so a 2099
 * row would silence the evergreen filler for as long as the hold lasted.
 *
 * THE RELEASE, after the controller confirms the app is Live:
 * 1. `pnpm migration:new "the supplier facebook series release"` allocates the file.
 * 2. Fill in `SUPPLIER_SERIES_RELEASE` below with that file, the start day and the gap in days.
 * 3. `(cd apps/web && npx tsx scripts/gen-supplier-facebook-series.ts --write)` writes it.
 *
 * Post N gets `publish_after = start + (N − 1) × gap` at 11:00 Manila. The cadence governor then gives it the next
 * prime slot (Facebook ≤ 3 a day, ≥ 3 h apart). Both switches (`autopublish_enabled`, `facebook_enabled`) still
 * apply.
 *
 * HOW THEY POST:
 * - `source_type = 'announcement'`: the existing queue, governor and switches.
 * - `media_url` is the post's own image, which wins over the generated card, so Facebook makes a photo post.
 * - A photo caption carries no link card, so the link is written into the caption.
 * - `source_ref = 'supplier-series-2026-11:NN'` is stable. With `social_posts_source_unique` and the migration's
 *   NOT EXISTS, a second apply adds nothing.
 *
 * NO DOUBLE POSTS with the Articles → Facebook sweep (#8268). That sweep writes only `journal:{slug}` rows for
 * published articles, and these posts link the /for-suppliers and /open-shop pages, never an article.
 *
 * Held by `lib/supplier-facebook-series.test.ts`.
 */

export type SupplierPost = {
  /** The post's number in the approved series (1–21), also its order. */
  n: number;
  /** The caption, one line each. */
  lines: readonly string[];
  /** The one page the post points to. */
  link: '/for-suppliers' | '/open-shop';
  /** The approved source picture the image was made from (a video post uses its poster frame). */
  from: string;
};

export type SupplierSeriesRelease = {
  /** The migration `pnpm migration:new` allocated for the release. */
  migration: string;
  /** The first post's day, YYYY-MM-DD in Manila. */
  start: string;
  /** Days between posts. */
  everyDays: number;
};

/**
 * ⛔ null = HELD: no migration queues the series. The controller fills this in after confirming the Meta app is
 * Live; the test then requires that migration to equal `supplierSeriesReleaseSql()`.
 */
export const SUPPLIER_SERIES_RELEASE: SupplierSeriesRelease | null = null;

export const SUPPLIER_SERIES_REF_PREFIX = 'supplier-series-2026-11:';
export const SUPPLIER_SERIES_SITE = 'https://www.setnayan.com';
export const SUPPLIER_SERIES_IMAGE_DIR = '/marketing/2026-11-24/facebook';
/** Posts become eligible at 11:00 Manila; the governor picks the prime slot after it. */
export const SUPPLIER_SERIES_HOUR = '11:00:00+08';

export const SUPPLIER_FACEBOOK_SERIES: readonly SupplierPost[] = [
  {
    n: 1,
    lines: ["Run the business you already have.", "Your clients, quotes and dates. One free place."],
    link: '/for-suppliers',
    from: "/marketing/2026-11-20/for-suppliers/hero.webp",
  },
  {
    n: 2,
    lines: ["A couple picks Sat 19 Dec.", "You're booked that day, so your card steps aside.", "Only couples who can book you, message you."],
    link: '/for-suppliers',
    from: "/marketing/2026-11-23/for-suppliers/clip-date-pick.mp4",
  },
  {
    n: 3,
    lines: ["They invite 120 guests.", "Your card shows your price for 120, by itself.", "Bye, \"PM for rates.\""],
    link: '/for-suppliers',
    from: "/marketing/2026-11-23/for-suppliers/clip-guests-cards.mp4",
  },
  {
    n: 4,
    lines: ["Their venue is in Makati.", "Your card shows how far you are from it.", "Couples who message you already know you fit."],
    link: '/for-suppliers',
    from: "/marketing/2026-11-23/for-suppliers/clip-venue-cards.mp4",
  },
  {
    n: 5,
    lines: ["Your page answers before you do.", "Dates, reviews and events, at one address."],
    link: '/for-suppliers',
    from: "/marketing/2026-11-23/for-suppliers/still-shop.webp",
  },
  {
    n: 6,
    lines: ["Free pa po ba kayo sa March 6?", "Your shop calendar answers, even at 2 am."],
    link: '/for-suppliers',
    from: "/marketing/2026-11-23/for-suppliers/still-check-a-date.webp",
  },
  {
    n: 7,
    lines: ["Open your shop in three answers.", "Shop name. Page address. Main service.", "No card needed."],
    link: '/open-shop',
    from: "/marketing/2026-11-23/for-suppliers/still-open-shop.webp",
  },
  {
    n: 8,
    lines: ["The clients you bring stay yours.", "Your client list, chats and payments are yours."],
    link: '/for-suppliers',
    from: "/marketing/2026-11-23/for-suppliers/still-clients.webp",
  },
  {
    n: 9,
    lines: ["Badges you earn. Never bought.", "Completed bookings, five-star reviews, repeat clients."],
    link: '/for-suppliers',
    from: "/badges/v84/calendar-3.webp",
  },
  {
    n: 10,
    lines: ["Reviews come only from completed bookings.", "A shop can't review itself."],
    link: '/for-suppliers',
    from: "/badges/v84/bubble-3.webp",
  },
  {
    n: 11,
    lines: ["A gift you hand your couple.", "In your shop's name. Something you could not offer alone."],
    link: '/for-suppliers',
    from: "/marketing/2026-11-23/for-suppliers/clip-gift-box.mp4",
  },
  {
    n: 12,
    lines: ["Bring the suppliers you always recommend.", "They join as your partners, on your page."],
    link: '/for-suppliers',
    from: "/badges/v84/invite-3.webp",
  },
  {
    n: 13,
    lines: ["Open today, even without permits.", "When your papers come through, couples can find you."],
    link: '/open-shop',
    from: "/marketing/2026-11-23/for-suppliers/still-open-shop.webp",
  },
  {
    n: 14,
    lines: ["Three papers. A person checks them.", "Then your shop shows up when couples search."],
    link: '/for-suppliers',
    from: "/badges/v84/shield-3.webp",
  },
  {
    n: 15,
    lines: ["Quotes, payment plans and dates.", "All inside one chat with your couple.", "The March quote, right where you left it."],
    link: '/for-suppliers',
    from: "/captured/2026-11-24/chat-plus-tray.jpg",
  },
  {
    n: 16,
    lines: ["Your Facebook page stays your storefront.", "Setnayan is where the quote and the booking happen."],
    link: '/for-suppliers',
    from: "/marketing/2026-11-20/for-suppliers/hero.webp",
  },
  {
    n: 17,
    lines: ["Make one service card.", "It shows in Find, on your page, and in Compare.", "Change it once. It changes everywhere."],
    link: '/open-shop',
    from: "/marketing/2026-11-23/for-suppliers/clip-guests-cards-poster.webp",
  },
  {
    n: 18,
    lines: ["Your QR on your calling card, tarp and standee.", "Made from your shop. Nothing to design."],
    link: '/for-suppliers',
    from: "/captured/2026-11-24/promote-qr-prints.jpg",
  },
  {
    n: 19,
    lines: ["Your booth, inside the couple's 3D plan.", "Photo games for their guests.", "Tools made for your trade."],
    link: '/for-suppliers',
    from: "/marketing/2026-11-23/for-suppliers/tool-3d.webp",
  },
  {
    n: 20,
    lines: ["No booking fee on clients you bring.", "Hosts pay 0% commission."],
    link: '/for-suppliers',
    from: "/marketing/2026-11-23/for-suppliers/still-clients.webp",
  },
  {
    n: 21,
    lines: ["Try it. Open free, no card.", "Leave anytime from your Profile."],
    link: '/open-shop',
    from: "/marketing/2026-11-23/for-suppliers/still-open-shop.webp",
  },
];

const pad = (n: number) => String(n).padStart(2, '0');

export const supplierPostRef = (p: SupplierPost) => `${SUPPLIER_SERIES_REF_PREFIX}${pad(p.n)}`;
export const supplierPostImage = (p: SupplierPost) => `${SUPPLIER_SERIES_IMAGE_DIR}/supplier-${pad(p.n)}.jpg`;
export const supplierPostLink = (p: SupplierPost) => `${SUPPLIER_SERIES_SITE}${p.link}`;
/** The Facebook caption: the lines, then the link on its own line (a photo post carries no link card). */
export const supplierPostBody = (p: SupplierPost) => `${p.lines.join('\n')}\n\n${supplierPostLink(p)}`;

/** Post N's day: start + (N − 1) × everyDays, as YYYY-MM-DD. */
export function supplierPostDay(p: SupplierPost, release: Pick<SupplierSeriesRelease, 'start' | 'everyDays'>): string {
  const [y = 0, m = 1, d = 1] = release.start.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d + (p.n - 1) * release.everyDays));
  return day.toISOString().slice(0, 10);
}

/** Dollar-quote a value with a tag the value cannot contain. */
function dollar(value: string, n: number): string {
  let tag = `s${n}`;
  while (value.includes(`$${tag}$`)) tag += 'x';
  return `$${tag}$${value}$${tag}$`;
}

/** The release migration, generated. The test compares the committed file with this, byte for byte. */
export function supplierSeriesReleaseSql(
  release: Pick<SupplierSeriesRelease, 'start' | 'everyDays'>,
  posts: readonly SupplierPost[] = SUPPLIER_FACEBOOK_SERIES,
): string {
  const rows = posts.map(
    (p, i) =>
      `    ('${supplierPostRef(p)}', ${dollar(`Supplier series · ${pad(p.n)}`, i * 2)},\n` +
      `     ${dollar(supplierPostBody(p), i * 2 + 1)},\n` +
      `     '${SUPPLIER_SERIES_SITE}${supplierPostImage(p)}', '${supplierPostLink(p)}',\n` +
      `     '${supplierPostDay(p, release)} ${SUPPLIER_SERIES_HOUR}')`,
  );
  return `-- ============================================================================
-- 📣 THE SUPPLIER FACEBOOK SERIES: the release of ${posts.length} posts, from ${release.start}, one every ${release.everyDays} day(s)
-- ============================================================================
-- ⛔ GENERATED: do not hand-edit. Source: apps/web/lib/supplier-facebook-series.ts. Regenerate with
-- (cd apps/web && npx tsx scripts/gen-supplier-facebook-series.ts --write). lib/supplier-facebook-series.test.ts
-- fails when this file and the source differ.
--
-- Owner 2026-11-24: "our first goal is to have posts that promotes to suppliers on facebook" and "supplier posts
-- to december appoved". The series was kept out of the queue until the controller confirmed the Meta app is Live.
-- This file queues it. Post N may go out from its day at ${SUPPLIER_SERIES_HOUR} Manila; the cadence governor then gives
-- it the next prime slot (Facebook at most 3 a day, at least 3 h apart). Both switches still apply.
--
-- The rows use source_type 'announcement', with the post's own image as media_url (a Facebook photo post) and the
-- link written inside the caption. Re-runnable: a row is added only when no live row has the same
-- (source_type, source_ref), matching social_posts_source_unique.
-- ============================================================================

BEGIN;

INSERT INTO public.social_posts (source_type, source_ref, title, body, media_url, link_url, publish_after, status)
SELECT 'announcement', r.source_ref, r.title, r.body, r.media_url, r.link_url, r.publish_after::timestamptz, 'scheduled'
  FROM (VALUES
${rows.join(',\n')}
  ) AS r(source_ref, title, body, media_url, link_url, publish_after)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.social_posts s
    WHERE s.source_type = 'announcement' AND s.source_ref = r.source_ref AND s.status <> 'pulled'
 );

COMMIT;
`;
}
