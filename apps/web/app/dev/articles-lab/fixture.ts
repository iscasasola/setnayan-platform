/**
 * The articles lab's sample content — the approved drawing's own rows (drawing v15 "Articles" · "An article"),
 * shaped exactly as `lib/articles.server.ts` returns them. No database, nothing written.
 */
import type { Article, ArticleCard, WriterState } from '@/lib/articles.server';
import { ALL_BLOG_ARTICLES } from '@/lib/blog';
import { journalBodyFromBlocks, journalTags, JOURNAL_BYLINE } from '@/lib/journal-move';
import { chapterExcerpt } from '@/lib/creator-chapters';

const H = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const months = ALL_BLOG_ARTICLES.find((a) => a.slug === 'best-months-to-get-married-philippines')!;
const guests = ALL_BLOG_ARTICLES.find((a) => a.slug === 'how-to-make-a-wedding-guest-list-philippines')!;

function journalCard(a: typeof months, replies: number): ArticleCard {
  const body = journalBodyFromBlocks(a.blocks);
  return {
    slug: a.slug,
    publicId: `S89C-LAB${a.slug.length}`,
    title: a.title,
    excerpt: chapterExcerpt(body),
    tags: journalTags(a),
    byline: { kind: 'journal', name: JOURNAL_BYLINE },
    replyCount: replies,
    publishedAt: '2026-11-17T00:00:00Z',
    updatedAt: '2026-11-17T00:00:00Z',
  };
}

export const LAB_FEED: ArticleCard[] = [
  {
    slug: 'garden-or-church-in-tagaytay-for-150-guests',
    publicId: 'S89C-LAB0000001',
    title: 'Garden or church in Tagaytay for 150 guests?',
    excerpt: 'We’re torn between two and the dates are close. What did you pick, and why?',
    tags: ['venues', 'tagaytay'],
    byline: { kind: 'person', name: 'tagaytaybride' },
    replyCount: 12,
    publishedAt: ago(2 * H),
    updatedAt: ago(2 * H),
  },
  journalCard(months, 4),
  {
    slug: 'our-caterers-tasting-checklist',
    publicId: 'S89C-LAB0000002',
    title: 'Our caterer’s tasting checklist',
    excerpt: 'Ask to see the real serving size, not the tasting plate. Here is everything we asked.',
    tags: ['catering', 'budget'],
    byline: { kind: 'person', name: 'pia.plans' },
    replyCount: 31,
    publishedAt: ago(26 * H),
    updatedAt: ago(26 * H),
  },
  journalCard(guests, 9),
  {
    slug: 'is-a-weekday-wedding-worth-it',
    publicId: 'S89C-LAB0000003',
    title: 'Is a weekday wedding worth it?',
    excerpt: 'Our venue has weekday dates open. Did anyone do a Thursday?',
    tags: ['when to marry', 'budget'],
    byline: { kind: 'person', name: 'jose_and_maria' },
    replyCount: 7,
    publishedAt: ago(72 * H),
    updatedAt: ago(72 * H),
  },
];

export const LAB_TAGS = [...new Set(LAB_FEED.flatMap((a) => a.tags))].sort();

export const LAB_ARTICLE: Article = {
  ...journalCard(months, 4),
  chapterId: '00000000-0000-0000-0000-000000000001',
  // The drawing's article: two paragraphs, a setnayan.com link (a card) and an outside link (plain text).
  body:
    'December and January are the peak: the most weddings, the busiest suppliers and the highest prices. June starts the rainy season, so rates ease and dates open up.\n\n' +
    'Looking at a cool, dry February in Tagaytay? setnayan.com/taal-vista-hotel\n\n' +
    'The weather service’s season guide: pagasa.dost.gov.ph/climate/climate-of-the-philippines',
  isJournal: true,
  viewerIsAuthor: false,
  linkCards: [
    { path: '/taal-vista-hotel', kind: 'shop', title: 'Taal Vista Hotel', line: 'Tagaytay · Verified', imageUrl: null },
  ],
  replies: {
    ok: true,
    data: [
      { replyId: 'r1', body: 'We picked April for the beach and it was perfect. Book the venue first.', byline: { kind: 'person', name: 'tagaytaybride' }, createdAt: ago(1 * H), mine: false },
      { replyId: 'r2', body: 'Same — April, and the photographer still had our date.', byline: { kind: 'person', name: 'jose_and_maria' }, createdAt: ago(0.66 * H), mine: false },
      { replyId: 'r3', body: 'April weekends go first here — we open next year’s calendar every June.', byline: { kind: 'shop', name: 'Taal Vista Hotel' }, createdAt: ago(0.5 * H), mine: false },
      { replyId: 'r4', body: 'December was lovely but every supplier was booked a year out.', byline: { kind: 'person', name: 'pia.plans' }, createdAt: ago(0.33 * H), mine: false },
    ],
  },
};

export const LAB_WRITER_FIRST: WriterState = { signedIn: true, userId: 'u-lab', shopName: null, postingName: null, readFailed: false };
export const LAB_WRITER_SHOP: WriterState = { signedIn: true, userId: 'u-shop', shopName: 'Taal Vista Hotel', postingName: null, readFailed: false };
export const LAB_SIGNED_OUT: WriterState = { signedIn: false };
