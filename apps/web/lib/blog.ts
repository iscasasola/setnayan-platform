// Setnayan Journal — the public editorial/blog surface (iteration 0038, first
// slice). Mirrors lib/help.ts exactly: content is an in-code typed constant
// (no DB, no CMS vendor, no markdown-renderer dependency), so the /blog routes
// pre-render every slug with generateStaticParams + dynamicParams=false and
// 404 anything else at the routing layer — same soft-404-proof shape as
// /help/[slug] (SEO/GEO, 2026-06-13).
//
// Why structured blocks instead of a markdown string: the repo ships no
// markdown renderer (help-center bodies are plain prose in a <p>), and
// long-form articles need headings + lists + internal-link CTAs. A small typed
// block union keeps it dependency-free, server-rendered, and lets us flatten to
// plain text for the JSON-LD `articleBody` + meta description.
//
// Editorial scope (0038 § 1): pre-purchase research traffic — "how much",
// "what to do", "civil vs church", Filipino-custom explainers. Benefits only,
// never implementation detail (public-surface hygiene). No quoted Setnayan SKU
// prices inside article bodies (they drift); the only Setnayan money facts used
// are the durable ones — free planning workspace, 0% commission.

export type BlogCategoryKey =
  | 'planning'
  | 'vendors'
  | 'culture'
  | 'real-weddings'
  | 'news';

export type BlogCategory = { key: BlogCategoryKey; label: string };

// Fixed roster (0038 § 2.1). The index only renders chips for categories that
// actually have ≥1 published article, so empty categories never show a dead
// filter — see blogCategoriesInUse().
export const BLOG_CATEGORIES: ReadonlyArray<BlogCategory> = [
  { key: 'planning', label: 'Planning' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'culture', label: 'Culture' },
  { key: 'real-weddings', label: 'Real Weddings' },
  { key: 'news', label: 'Setnayan News' },
];

export type BlogBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }
  // Internal-link call-out — hub-and-spoke linking to the rest of the site
  // (SEO playbook §13: no orphan pages). Always an internal href.
  | { type: 'cta'; text: string; href: string; label: string };

export type BlogArticle = {
  slug: string;
  title: string;
  /** ~120-char card summary + meta-description seed. */
  excerpt: string;
  category: BlogCategoryKey;
  /** Byline. 'Setnayan Editorial' unless a named author is set. */
  author: string;
  /** ISO date 'YYYY-MM-DD'. Real per-row date → honest sitemap lastmod. */
  publishedAt: string;
  /** ISO date — set when a body materially changes. */
  updatedAt?: string;
  /** At most one true at a time — pins the index hero. */
  featured?: boolean;
  blocks: BlogBlock[];
};

export const BLOG_ARTICLES: ReadonlyArray<BlogArticle> = [
  {
    slug: 'what-to-do-12-months-before-your-philippine-wedding',
    title: 'What to do 12 months before your Philippine wedding',
    excerpt:
      'A month-by-month countdown for Filipino couples — from booking your date and church to the final headcount.',
    category: 'planning',
    author: 'Setnayan Editorial',
    publishedAt: '2026-05-20',
    featured: true,
    blocks: [
      {
        type: 'p',
        text: 'A year out is the sweet spot to start planning a Filipino wedding. It is long enough to secure the venues, suppliers, and church dates that book out fastest, and short enough that your budget and guest list stay realistic. Here is a calm, month-by-month way to get from "engaged" to "set na" without the last-minute scramble.',
      },
      {
        type: 'h2',
        text: '12–10 months out: lock the non-negotiables',
      },
      {
        type: 'p',
        text: 'Three things drive every other decision: your date, your ceremony venue, and your reception venue. In the Philippines, popular churches and in-demand reception venues are often booked 9–12 months ahead — sometimes longer for December and the cool, dry months from January to May. Settle these first and the rest of your plan organizes itself around them.',
      },
      {
        type: 'ul',
        items: [
          'Agree on a guest-count range and a total budget before you fall in love with a venue you cannot fill or afford.',
          'Reserve your ceremony date with the church or officiant, and ask about pre-marriage requirements early (Catholic parishes usually require a Pre-Cana seminar and a recent baptismal and confirmation certificate).',
          'Book the reception venue and, with it, your caterer if the venue is not all-in.',
          'Lock the suppliers who only take one event a day and book out first: photo-and-video team, coordinator, and host.',
        ],
      },
      {
        type: 'cta',
        text: 'Compare verified Filipino wedding vendors by city, category, and the styles they specialize in.',
        href: '/vendors',
        label: 'Browse the vendor marketplace',
      },
      {
        type: 'h2',
        text: '9–7 months out: build the look and the team',
      },
      {
        type: 'p',
        text: 'With the big rocks in place, move to the suppliers that shape how the day looks and feels. This is also the moment to settle your motif and palette, because almost every other vendor — florist, stylist, stationery, cake, attire — will ask for it.',
      },
      {
        type: 'ul',
        items: [
          'Decide your colour palette and overall feel, then brief your stylist and florist against it.',
          'Order the bride\'s gown and entourage attire — custom gowns commonly need 4–6 months.',
          'Book hair and makeup, the cake, and the mobile bar or food carts you want.',
          'Start the guest list in earnest, including principal sponsors (ninong and ninang), so you can size invitations and seating.',
        ],
      },
      {
        type: 'h2',
        text: '6–4 months out: paper, music, and the legal file',
      },
      {
        type: 'p',
        text: 'Now the details. Send save-the-dates, finalize invitations, and choose your ceremony and reception music. Begin the marriage-licence process with your local civil registrar — a Philippine marriage licence is valid for 120 days from issue, so time it so it is still valid on your wedding day, not expired and not issued too late.',
      },
      {
        type: 'ul',
        items: [
          'Apply for your marriage licence (allow for the 10-day posting period before it is released).',
          'Finalize and send invitations with a clear RSVP deadline.',
          'Confirm the program flow with your host and coordinator.',
          'Schedule your gown fittings and a hair-and-makeup trial.',
        ],
      },
      {
        type: 'h2',
        text: '3–1 months out: confirm, count, and rehearse',
      },
      {
        type: 'p',
        text: 'The final stretch is about confirmation, not new decisions. Chase RSVPs, lock the final headcount for your caterer, finalize the seating plan, and walk the day-of timeline with every supplier so call times line up. Then breathe — the planning is done, and the celebration is the easy part.',
      },
      {
        type: 'cta',
        text: 'Keep your guest list, budget, schedule, and seating in one place — free with every Setnayan account.',
        href: '/signup',
        label: 'Start planning free',
      },
    ],
  },
  {
    slug: 'how-much-do-wedding-suppliers-cost-philippines',
    title: 'How much do wedding suppliers cost in the Philippines?',
    excerpt:
      'Typical 2026 price ranges for the most-booked wedding suppliers — and how to budget for them without surprises.',
    category: 'vendors',
    author: 'Setnayan Editorial',
    publishedAt: '2026-05-27',
    blocks: [
      {
        type: 'p',
        text: 'There is no single answer to "how much does a wedding supplier cost" in the Philippines — rates swing widely by city, season, experience, and how much of the work is included. The ranges below are realistic 2026 starting points to help you build a first budget. Treat them as a compass, not a quote: always ask each supplier for an inclusions list in writing, because the same headline price can mean very different things.',
      },
      {
        type: 'h2',
        text: 'What drives the price',
      },
      {
        type: 'ul',
        items: [
          'Location — Metro Manila, Cebu, and destination spots like Tagaytay and Boracay sit at the higher end; provincial rates are often gentler.',
          'Season and day — December and the January-to-May dry season are peak; weekday and off-peak dates can cost noticeably less.',
          'Inclusions — hours of coverage, number of staff, deliverables, and travel can move a price more than the supplier\'s name.',
          'Experience and demand — sought-after teams book a year ahead and price accordingly.',
        ],
      },
      {
        type: 'h2',
        text: 'Typical starting ranges (2026)',
      },
      {
        type: 'p',
        text: 'These are common ranges Filipino couples encounter for full-wedding coverage. Premium and celebrity-tier suppliers can run well above the top of each band.',
      },
      {
        type: 'ul',
        items: [
          'Photo and video team: roughly ₱45,000–₱180,000 depending on hours, crew size, and deliverables.',
          'Catering: often ₱900–₱2,500 per head, so the total scales directly with your guest count.',
          'Coordination: on-the-day coordination from about ₱25,000; full planning runs higher.',
          'Hair and makeup: around ₱15,000–₱60,000 for the bride plus entourage add-ons.',
          'Florals and styling: from about ₱40,000 for simple setups into the hundreds of thousands for full venue transformations.',
          'Host or emcee: roughly ₱15,000–₱50,000.',
          'Live music (acoustic to full band): about ₱20,000–₱120,000.',
        ],
      },
      {
        type: 'p',
        text: 'A useful rule of thumb: catering and venue together usually take the largest share of a Filipino wedding budget, often more than half. Build those first, then fit the rest around what is left.',
      },
      {
        type: 'h2',
        text: 'How to budget without surprises',
      },
      {
        type: 'ul',
        items: [
          'Get every quote as an itemized inclusions list, not just a package price.',
          'Set aside a 10–15% buffer for the small things that always appear — extra hours, corkage, transport, and overtime.',
          'Confirm the payment schedule and what each milestone covers before you pay a deposit.',
          'Compare at least three suppliers per category so you know where the market actually sits.',
        ],
      },
      {
        type: 'cta',
        text: 'Track every supplier, deposit, and payment milestone in one budget — free with your Setnayan workspace.',
        href: '/signup',
        label: 'Start your budget free',
      },
      {
        type: 'p',
        text: 'When you are ready to shortlist, browsing verified suppliers side by side — with the styles and cities they actually serve — makes the ranges above concrete for your specific date and place.',
      },
      {
        type: 'cta',
        text: 'See verified Filipino wedding vendors filtered by your city and category.',
        href: '/vendors',
        label: 'Browse vendors',
      },
    ],
  },
  {
    slug: 'civil-vs-church-wedding-philippines',
    title: 'Civil vs. church wedding in the Philippines: which is right for you?',
    excerpt:
      'Requirements, timeline, and cost differences between a civil and a church wedding — and how to choose.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-06-03',
    blocks: [
      {
        type: 'p',
        text: 'Every Filipino couple faces this early question: civil or church? Both result in a legally married couple — the difference is in the ceremony, the requirements, the timeline, and the feel of the day. Here is a clear comparison to help you decide, whether you want a quiet signing or a full liturgical celebration.',
      },
      {
        type: 'h2',
        text: 'What they share',
      },
      {
        type: 'p',
        text: 'Both a civil and a church wedding require a marriage licence from the local civil registrar where either of you resides. The licence has a 10-day posting period before release and is valid for 120 days from issue, anywhere in the Philippines. Both also need valid government IDs, the licence, and — if either of you is 18 to 25 — a parental consent or advice document.',
      },
      {
        type: 'h2',
        text: 'The civil wedding',
      },
      {
        type: 'p',
        text: 'A civil ceremony is officiated by a judge, mayor, or other authorized officer. It is simpler, faster, and far less expensive — often the practical choice for couples who want to be married now and celebrate later, or who prefer a small, private moment.',
      },
      {
        type: 'ul',
        items: [
          'Officiant: judge, mayor, or other authorized solemnizing officer.',
          'Setting: city or municipal hall, or a venue the officer agrees to.',
          'Timeline: can be arranged within weeks once the licence is ready.',
          'Cost: minimal beyond the licence and modest officiant fees.',
        ],
      },
      {
        type: 'h2',
        text: 'The church wedding',
      },
      {
        type: 'p',
        text: 'A church wedding adds the religious sacrament and, for many Filipino families, the emotional heart of the day. It also adds requirements and lead time. A Catholic wedding, for example, typically asks for recent baptismal and confirmation certificates with a "for marriage" annotation, a Pre-Cana or pre-marriage seminar, canonical interviews, and marriage banns posted in your parishes.',
      },
      {
        type: 'ul',
        items: [
          'Officiant: priest, pastor, imam, or minister of your faith.',
          'Setting: your parish or chosen place of worship.',
          'Timeline: start 6–12 months ahead — seminars, certificates, and church calendars take time.',
          'Cost: church and sacristy fees plus the requirements above, on top of the licence.',
        ],
      },
      {
        type: 'h2',
        text: 'How to choose',
      },
      {
        type: 'p',
        text: 'Choose civil if you value simplicity, speed, and lower cost, or if a religious ceremony is not part of your story. Choose church if the sacrament and the tradition matter to you and your families. Many couples do both — a civil wedding for the legal date and a church celebration later — which is perfectly common and entirely up to you.',
      },
      {
        type: 'cta',
        text: 'Setnayan adapts your plan to your ceremony type — Catholic, civil, INC, Christian, Muslim, cultural, or mixed.',
        href: '/how-it-works',
        label: 'See how planning adapts',
      },
    ],
  },
  {
    slug: 'filipino-wedding-entourage-guide-ninong-ninang-sponsors',
    title: 'The Filipino wedding entourage, explained: ninong, ninang, and sponsors',
    excerpt:
      'Who stands where and does what — principal sponsors, secondary sponsors, and the bearers in a Filipino wedding.',
    category: 'culture',
    author: 'Setnayan Editorial',
    publishedAt: '2026-06-09',
    blocks: [
      {
        type: 'p',
        text: 'The Filipino wedding entourage is bigger and more meaningful than in many other traditions. Beyond the couple and their immediate party, it includes principal sponsors who serve as witnesses and lifelong guides, secondary sponsors who perform the candle, veil, and cord rites, and a charming cast of bearers. Here is who is who, and what each role does.',
      },
      {
        type: 'h2',
        text: 'Principal sponsors — ninong and ninang',
      },
      {
        type: 'p',
        text: 'Principal sponsors are the couple\'s most honoured guests: respected married couples — godparents, mentors, or close family friends — chosen to witness the marriage and to guide the newlyweds for life. They sign as official witnesses and are usually seated in places of honour. Couples often invite several pairs, balancing the bride\'s and groom\'s sides.',
      },
      {
        type: 'h2',
        text: 'Secondary sponsors — the three rites',
      },
      {
        type: 'p',
        text: 'Secondary sponsors are typically younger friends or relatives who perform the three symbolic rites during a Catholic or Christian ceremony.',
      },
      {
        type: 'ul',
        items: [
          'Candle sponsors light two candles, symbolizing the light of God\'s presence in the marriage.',
          'Veil sponsors drape a veil over the couple, symbolizing being clothed as one.',
          'Cord sponsors place a figure-eight cord (the yugal) over the couple, symbolizing everlasting union.',
        ],
      },
      {
        type: 'h2',
        text: 'The bearers and the rest of the party',
      },
      {
        type: 'p',
        text: 'The bearers are often the crowd favourites — usually children who walk ahead of the bride.',
      },
      {
        type: 'ul',
        items: [
          'Ring bearer carries the wedding rings.',
          'Coin bearer carries the arrhae — 13 coins blessed and given by the groom as a pledge of provision.',
          'Bible bearer carries the Bible and rosary.',
          'Flower girls scatter petals along the aisle.',
          'Maid or matron of honour and the best man stand closest to the couple, with bridesmaids and groomsmen completing the party.',
        ],
      },
      {
        type: 'h2',
        text: 'Building your list',
      },
      {
        type: 'p',
        text: 'There is no fixed number — your entourage should reflect the people who matter most, balanced against the size of your ceremony space. Decide your principal sponsors early, since they are often the hardest schedules to align, then fill in the secondary sponsors and bearers as your guest list takes shape.',
      },
      {
        type: 'cta',
        text: 'Setnayan\'s guest list includes 20 Filipino role tiers — sponsors, bearers, ninong, ninang, and more — so everyone is placed and counted.',
        href: '/signup',
        label: 'Build your guest list free',
      },
    ],
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Helpers — parallel to lib/help.ts so the routes read the same way.
//
// Unlike the help corpus, blog posts carry real per-article dates, so the
// sitemap stamps each URL with its own updatedAt ?? publishedAt (honest
// per-row lastmod) rather than one shared BLOG_LASTMOD. BLOG_LASTMOD is kept
// only as the index-level "newest content" hint.
// ───────────────────────────────────────────────────────────────────────────

export const BLOG_LASTMOD = '2026-06-13';

export const ALL_BLOG_ARTICLES: ReadonlyArray<BlogArticle> = [...BLOG_ARTICLES].sort(
  (a, b) => (a.publishedAt < b.publishedAt ? 1 : -1),
);

export function findBlogArticle(slug: string): BlogArticle | undefined {
  return BLOG_ARTICLES.find((a) => a.slug === slug);
}

export function blogCategoryLabel(key: BlogCategoryKey): string {
  return BLOG_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** Categories with at least one published article — the index renders only
 *  these as filter chips so an empty category never shows a dead filter. */
export function blogCategoriesInUse(): BlogCategory[] {
  return BLOG_CATEGORIES.filter((c) =>
    BLOG_ARTICLES.some((a) => a.category === c.key),
  );
}

/** Same category first, then most-recent others — used for "Keep reading". */
export function relatedBlogArticles(slug: string, limit = 3): BlogArticle[] {
  const current = findBlogArticle(slug);
  if (!current) return [];
  const sameCategory = ALL_BLOG_ARTICLES.filter(
    (a) => a.slug !== slug && a.category === current.category,
  );
  const others = ALL_BLOG_ARTICLES.filter(
    (a) => a.slug !== slug && a.category !== current.category,
  );
  return [...sameCategory, ...others].slice(0, limit);
}

/** Flatten blocks to plain text for JSON-LD articleBody + meta description. */
export function blogPlainText(blocks: ReadonlyArray<BlogBlock>): string {
  return blocks
    .map((b) => {
      if (b.type === 'ul') return b.items.join(' ');
      return b.text;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Estimated reading time in minutes (~200 wpm, floor of 1). */
export function readingMinutes(blocks: ReadonlyArray<BlogBlock>): number {
  const words = blogPlainText(blocks).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Meta description — prefers the curated excerpt, trims at a word boundary. */
export function blogMetaDescription(article: BlogArticle, max = 155): string {
  const source = article.excerpt || blogPlainText(article.blocks);
  if (source.length <= max) return source;
  const slice = source.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}
