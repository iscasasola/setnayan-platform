/**
 * 📰 THE JOURNAL MOVES INTO DISCOVER'S ARTICLES (owner 2026-11-17, DECISION_LOG "THE JOURNAL MOVES INTO
 * DISCOVER'S ARTICLES — ONE SOURCE"; drawing v15 "Journal moved in"; Build 2 of 3).
 *
 * The code-based Journal (`lib/blog.ts` + `lib/blog-batches/*`, 91 posts) becomes seed rows of the article
 * store. This module is the ONE translation between the two, so the import, the `/blog/{slug}` forward and
 * the onboarding "Not sure yet" links all read the same answer:
 *
 *   • `journalArticleSlug(old)`   — the address a Journal post lives at as an article. Three slugs carried a
 *     retired word ("vendor", "website") and were renamed in the source on 2026-11-17
 *     (`JOURNAL_CONTENT_AUDIT_2026-11-17.md`); their OLD slugs still forward to the new ones.
 *   • `journalBodyFromBlocks()`   — the post's blocks as a plain-text article body: TEXT AND LINKS ONLY
 *     (DECISION_LOG "DISCOVER ARTICLES ARE OUR REDDIT"). Cover photos and inline images are dropped (Q7
 *     ruled); a link is written out as a link, so a setnayan.com one gets its card and anything else stays
 *     plain text.
 *   • `journalTags()`             — the tags an imported post carries (≤ 3), so onboarding can link by tag.
 *
 * Pure: no I/O, no clock. It never imports `lib/blog.ts` itself — the middleware must not carry 91 articles
 * of prose to answer one redirect, so the slug list it needs is `JOURNAL_SLUGS` below, held equal to the
 * source by `lib/journal-move.test.ts`.
 */

/** The byline every imported Journal post carries in the feed ("Setnayan Journal · 17 Nov" in the drawing). */
export const JOURNAL_BYLINE = 'Setnayan Journal';

/** Most tags one post may carry ("Tags · up to 3" on the Write sheet). */
export const ARTICLE_TAGS_MAX = 3;

/**
 * Old Journal slug → its new slug. Only the renamed ones; every other post keeps its slug, so a saved or
 * indexed `/blog/{slug}` lands on `/articles/{slug}` unchanged.
 */
export const JOURNAL_SLUG_RENAMES: Readonly<Record<string, string>> = {
  'free-wedding-website-how-it-helps': 'free-event-hub-how-it-helps',
  'holiday-season-vendor-booking-crunch': 'holiday-season-supplier-booking-crunch',
  'questions-to-ask-every-wedding-vendor': 'questions-to-ask-every-wedding-supplier',
  'typhoon-season-wedding-vendor-questions': 'typhoon-season-wedding-supplier-questions',
};

/**
 * Every Journal slug as it stands in the source AFTER the 2026-11-17 fixes. Held equal to
 * `ALL_BLOG_ARTICLES.map(a => a.slug)` by `lib/journal-move.test.ts` — add a post there and this list must
 * follow, or the test names the missing slug.
 */
export const JOURNAL_SLUGS: ReadonlySet<string> = new Set([
  'aglipayan-wedding-overview',
  'average-wedding-cost-philippines-2026',
  'avp-save-the-date-video-guide',
  'ber-months-wedding-season-book-early',
  'best-months-to-get-married-philippines',
  'born-again-christian-wedding-philippines',
  'bridal-car-and-motorcade-wedding',
  'brownout-power-contingency-wedding',
  'buffet-vs-plated-vs-family-style-wedding',
  'catholic-wedding-requirements-philippines',
  'chinese-filipino-wedding-tea-ceremony',
  'choosing-your-ceremony-by-faith-philippines',
  'christmas-themed-wedding-ideas-philippines',
  'civil-vs-church-wedding-philippines',
  'cord-veil-coins-wedding-meaning',
  'december-wedding-philippines-guide',
  'despedida-de-soltera-explained',
  'destination-wedding-philippines-guide',
  'digital-invitations-online-rsvp-wedding',
  'drone-coverage-wedding-philippines',
  'engaged-over-christmas-first-steps',
  'filipino-wedding-entourage-guide-ninong-ninang-sponsors',
  'filipino-wedding-gift-etiquette-cash',
  'filipino-wedding-superstitions-pamahiin',
  'filipino-wedding-traditions-explained',
  'food-carts-late-night-snacks-wedding',
  'free-event-hub-how-it-helps',
  'free-printable-wedding-checklist-philippines',
  'garden-vs-ballroom-vs-beach-wedding',
  'hidden-wedding-costs-couples-forget',
  'holiday-proposal-ideas-philippines',
  'holiday-season-supplier-booking-crunch',
  'how-much-do-wedding-suppliers-cost-philippines',
  'how-to-ask-someone-to-be-ninong-ninang',
  'how-to-budget-a-philippine-wedding-step-by-step',
  'how-to-choose-a-wedding-caterer-philippines',
  'how-to-choose-a-wedding-host-emcee',
  'how-to-choose-a-wedding-photographer-philippines',
  'how-to-choose-a-wedding-venue-philippines',
  'how-to-handle-wedding-rsvps',
  'how-to-make-a-wedding-guest-list-philippines',
  'how-to-save-money-on-your-wedding-philippines',
  'how-to-set-a-wedding-budget-philippines',
  'how-to-trim-your-wedding-guest-list',
  'iglesia-ni-cristo-wedding-overview',
  'ilocano-wedding-traditions',
  'intimate-wedding-vs-big-wedding-cost',
  'marriage-license-requirements-philippines',
  'mixed-faith-wedding-philippines',
  'mobile-bar-wedding-philippines',
  'money-dance-filipino-wedding',
  'muslim-moro-wedding-philippines',
  'name-change-after-marriage-philippines',
  'new-year-wedding-planning-kickoff',
  'new-years-eve-wedding-philippines',
  'off-peak-weekday-wedding-pros-cons',
  'pamamanhikan-explained',
  'plus-ones-and-kids-at-weddings-philippines',
  'prenup-engagement-shoot-guide-philippines',
  'psa-marriage-certificate-how-to-get',
  'questions-to-ask-every-wedding-supplier',
  'questions-to-ask-your-wedding-photographer',
  'rainy-season-wedding-philippines',
  'release-of-doves-filipino-wedding',
  'save-the-dates-when-and-how-philippines',
  'simbang-gabi-and-december-weddings',
  'typhoon-season-wedding-supplier-questions',
  'unity-candle-ceremony-wedding',
  'visayan-cebuano-wedding-traditions',
  'wedding-budget-breakdown-philippines',
  'wedding-cake-guide-philippines',
  'wedding-contingency-fund-philippines',
  'wedding-coordinator-on-the-day-vs-full',
  'wedding-entourage-roles-and-gifts',
  'wedding-florist-styling-guide-philippines',
  'wedding-food-tasting-what-to-ask',
  'wedding-invitation-wording-etiquette-philippines',
  'wedding-lights-and-sounds-guide',
  'wedding-payment-schedule-deposits-explained',
  'wedding-photo-deliverables-explained',
  'wedding-photo-video-contract-red-flags',
  'wedding-photographer-vs-videographer-philippines',
  'wedding-program-flow-philippines',
  'wedding-seating-plan-guide-philippines',
  'wedding-videography-styles-philippines',
  'wedding-wet-weather-contingency-plan',
  'what-is-a-same-day-edit-sde-wedding',
  'what-to-do-12-months-before-your-philippine-wedding',
  'what-zero-commission-means-for-couples',
  'who-pays-for-what-filipino-wedding',
  'why-wedding-planning-should-be-free',
]);

/**
 * Where an old `/blog/{slug}` goes now. A known Journal slug (or a renamed one) → its article; anything
 * else (a typo, a slug that never existed) → `null`, and the caller sends it to the articles list rather
 * than to a page that would 404.
 */
export function journalArticleSlug(oldSlug: string): string | null {
  const renamed = JOURNAL_SLUG_RENAMES[oldSlug];
  if (renamed) return renamed;
  return JOURNAL_SLUGS.has(oldSlug) ? oldSlug : null;
}

/** The public address of an article. One builder, so nothing hand-writes `/articles/` + a slug. */
export function articleHref(slug: string): string {
  return "/articles/" + slug;
}

// ─── Body ────────────────────────────────────────────────────────────────────────────────────────────

/** The block shapes the Journal uses — structurally the same as `BlogBlock`, restated so this stays pure. */
export type JournalBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: readonly string[] }
  | { type: 'quote'; text: string }
  | { type: 'image'; src: string; alt: string; caption?: string }
  | { type: 'cta'; text: string; href: string; label: string }
  | { type: 'download'; text: string; href: string; label: string }
  | { type: 'shop'; text: string; href: string; label: string; merchant: string }
  | { type: 'chapter'; publicId: string; note?: string };

/** The host an internal Journal link is written out with, so a reader's copy-paste works anywhere. */
export const SETNAYAN_LINK_HOST = 'setnayan.com';

/**
 * An internal Journal href written as a plain-text link. `/blog/{slug}` hrefs are rewritten to the
 * article they became, so the moved Journal never links to its own retired address.
 */
export function journalLinkText(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  const m = /^\/blog\/([^/?#.]+)$/.exec(href);
  const path = m ? articleHref(journalArticleSlug(m[1]!) ?? m[1]!) : href;
  // Joined, not templated: this is link TEXT for a post body, not a door the screens map should follow.
  return SETNAYAN_LINK_HOST + (path.startsWith('/') ? '' : '/') + path;
}

/**
 * The blocks as an article body: paragraphs separated by one blank line (`splitChapterParagraphs` reads
 * them back), list items one per line, links on their own line. Images are dropped — text and links only —
 * but a caption, being words, is kept.
 */
export function journalBodyFromBlocks(blocks: readonly JournalBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'p':
      case 'h2':
        parts.push(b.text.trim());
        break;
      case 'quote':
        parts.push(`“${b.text.trim()}”`);
        break;
      case 'ul':
        parts.push(b.items.map((i) => `• ${i.trim()}`).join('\n'));
        break;
      case 'image':
        if (b.caption?.trim()) parts.push(b.caption.trim());
        break;
      case 'cta':
      case 'download':
        parts.push(`${b.text.trim()}\n${journalLinkText(b.href)}`);
        break;
      case 'shop':
        // An outside merchant link stays plain text (ruled 2026-11-17); the merchant is named so the
        // reader still knows where it leads.
        parts.push(`${b.text.trim()}\n${b.merchant}: ${b.href}`);
        break;
      case 'chapter':
        if (b.note?.trim()) parts.push(b.note.trim());
        break;
    }
  }
  return parts.filter((p) => p.length > 0).join('\n\n');
}

// ─── Tags ────────────────────────────────────────────────────────────────────────────────────────────

/** The Journal's four categories, as the tag each one becomes. */
export const JOURNAL_CATEGORY_TAG: Readonly<Record<'planning' | 'vendors' | 'culture' | 'news', string>> = {
  planning: 'planning',
  vendors: 'suppliers',
  culture: 'culture',
  news: 'setnayan news',
};

/**
 * 🧭 THE ARTICLES ONBOARDING'S "NOT SURE YET" LINKS (drawing v15, Q2 ruled: "each 'Not sure yet' pulls its
 * existing article"). Build 1 links by TAG; the slug is the post the drawing names, so the link is never a
 * search that could come back empty. No new writing — all three already exist in the Journal.
 */
export const ONBOARDING_ARTICLE_TAGS = {
  when: { tag: 'when to marry', slug: 'best-months-to-get-married-philippines' },
  where: { tag: 'venues', slug: 'how-to-choose-a-wedding-venue-philippines' },
  guests: { tag: 'guest list', slug: 'how-to-make-a-wedding-guest-list-philippines' },
} as const;

const TOPIC_TAG_BY_SLUG: Readonly<Record<string, string>> = Object.fromEntries(
  Object.values(ONBOARDING_ARTICLE_TAGS).map((t) => [t.slug, t.tag]),
);

/** The tags an imported Journal post carries: its topic tag (when it has one), then its category. ≤ 3. */
export function journalTags(article: {
  slug: string;
  category: keyof typeof JOURNAL_CATEGORY_TAG;
}): string[] {
  const tags = [TOPIC_TAG_BY_SLUG[article.slug], JOURNAL_CATEGORY_TAG[article.category]].filter(
    (t): t is string => typeof t === 'string' && t.length > 0,
  );
  return [...new Set(tags)].slice(0, ARTICLE_TAGS_MAX);
}
