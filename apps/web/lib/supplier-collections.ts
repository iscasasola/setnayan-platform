/**
 * YOUR COLLECTIONS — every photo and video a supplier owns, one list (simpler supplier dashboard, step 5 · prototype
 * moment 8, `SCREENS.collections`: count · who sees it · a "show on my page" switch · one filter dropdown).
 *
 * 🔑 EVERY ROW IS A SHIPPED STORE, READ WHERE IT ALREADY LIVES — no new table:
 *   page       the page gallery          `vendor_profiles.portfolio_r2_keys` + `gallery_video_links` (+ Instagram posts,
 *                                          which the public page draws in the SAME gallery)
 *   cards      service card photos       `vendor_services.primary_photo_r2_key` · `showcase_photo_r2_keys` · `showcase_video_r2_key`
 *   albums     albums by event           `vendor_papic_portfolio_photos` — the PRIVATE album (its migration: "the supplier
 *                                          reads their own album; admin reads all. No one else")
 *   own        your own shots at events  `vendor_papic_captures` — `lib/vendor-own-captures.ts`'s rules (screened, not taken down)
 *   delivered  delivered to couples      `booking_handovers`
 *   instagram  Instagram                 `vendor_ig_media` (`show_on_profile` per post)
 *   moodboard  mood board library        `moodboard_library_assets` (only for a shop that may supply looks)
 *
 * 🔑 THE SWITCH EXISTS ONLY WHERE A SHIPPED COLUMN SAYS "SHOWN". The page gallery has one — the page's Portfolio
 * section (`microsite_sections.portfolio`), which is a Your-page draft change like any other. The private album stays
 * private as an album, but ONE photo at a time can be put on the page — "Put on my page" on the photo (owner
 * 2026-10-15, "SIX OWNER ANSWERS" (3); `putAlbumPhotoOnMyPage` copies it into the page gallery). Your own shots have
 * no such path: they sit in the COUPLE'S gallery, which the couple can take down, and a copy on the supplier's page
 * would not follow a take-down. So the album row offers the tap's place; neither row offers a switch.
 *
 * 🔑 A COUNT THAT COULD NOT BE READ IS "NOT READ", NEVER 0 — "nothing yet" is a claim about the supplier.
 *
 * Pure: the screen, the lab and the guard share it.
 */

import type { BadgeTone } from '@/app/_components/badge';

export type CollectionKey = 'page' | 'cards' | 'albums' | 'own' | 'delivered' | 'instagram' | 'moodboard';

/** Who sees it — the three answers the prototype's filter offers. */
export type CollectionWho = 'page' | 'private' | 'couple';

export type CollectionsFilter = 'all' | CollectionWho;

export const COLLECTION_FILTERS: readonly { key: CollectionsFilter; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'page', label: 'On my page' },
  { key: 'private', label: 'Private' },
  { key: 'couple', label: 'Shared with a couple' },
];

export const WHO_BADGE: Readonly<Record<CollectionWho, { tone: BadgeTone; word: string }>> = {
  page: { tone: 'ok', word: 'On my page' },
  private: { tone: 'quiet', word: 'Private' },
  couple: { tone: 'wait', word: 'Shared with a couple' },
};

export type CollectionsInput = {
  /** The page gallery — read off the profile row the page already holds, so it is always measured. */
  page: { photos: number; videos: number; shown: boolean };
  cards: { cards: number; photos: number; videos: number } | null;
  albums: { photos: number; events: number } | null;
  own: { items: number } | null;
  delivered: { couples: number; items: number } | null;
  /** null = the read failed. `configured: false` = Instagram is not switched on for the product → no row. */
  instagram: { configured: boolean; connected: boolean; posts: number; shown: number; postsAtLeast?: boolean } | null;
  /** null = the read failed. `allowed: false` = this shop does not supply looks → no row. */
  moodboard: { allowed: boolean; looks: number; declined: number } | null;
};

export type CollectionRow = {
  key: CollectionKey;
  title: string;
  /** One quiet line: the count, or why there is nothing. */
  line: string;
  who: CollectionWho;
  /** The "show on my page" switch — present only where a shipped column holds it. */
  pageSwitch: boolean;
  /** Where the row goes. A fragment on Your collections opens the Add photos fold. */
  href: string;
  /** The count could not be read. */
  unread: boolean;
  /** How many photos/clips the row holds (for the total), when measured. */
  items: number | null;
};

const n = (x: number, one: string, many: string) => `${x.toLocaleString('en-PH')} ${x === 1 ? one : many}`;

export function collectionRows(input: CollectionsInput): CollectionRow[] {
  const rows: CollectionRow[] = [];
  const NOT_READ = 'Could not be read just now';

  {
    const { photos, videos, shown } = input.page;
    const parts = [photos ? n(photos, 'photo', 'photos') : '', videos ? n(videos, 'video', 'videos') : ''].filter(Boolean);
    rows.push({
      key: 'page',
      title: 'Photos and videos on my page',
      line: parts.length ? parts.join(' · ') : 'Nothing yet · Add photos',
      who: shown ? 'page' : 'private',
      pageSwitch: true,
      href: '#gallery-media',
      unread: false,
      items: photos + videos,
    });
  }

  {
    const c = input.cards;
    rows.push({
      key: 'cards',
      title: 'Service card photos',
      line: !c
        ? NOT_READ
        : c.cards === 0
          ? 'No service yet'
          : [n(c.cards, 'card', 'cards'), n(c.photos, 'photo', 'photos'), c.videos ? n(c.videos, 'clip', 'clips') : '']
              .filter(Boolean)
              .join(' · '),
      who: 'page',
      pageSwitch: false,
      href: '/vendor-dashboard/shop',
      unread: !c,
      items: c ? c.photos + c.videos : null,
    });
  }

  {
    const a = input.albums;
    rows.push({
      key: 'albums',
      title: 'Albums by event · their work',
      line: !a
        ? NOT_READ
        : a.photos === 0
          ? 'Nothing yet · fills when a couple shares their Papic photos with you'
          : `${n(a.events, 'event', 'events')} · ${n(a.photos, 'photo', 'photos')} · only you · put one on your page from the photo`,
      who: 'private',
      pageSwitch: false,
      href: '/vendor-dashboard/on-the-day',
      unread: !a,
      items: a ? a.photos : null,
    });
  }

  {
    const o = input.own;
    rows.push({
      key: 'own',
      title: 'Your own shots at events',
      line: !o
        ? NOT_READ
        : o.items === 0
          ? 'Nothing yet · what you shoot with Papic at an event lands here'
          : `${n(o.items, 'photo or clip', 'photos and clips')} · only you`,
      who: 'private',
      pageSwitch: false,
      href: '/vendor-dashboard/on-the-day',
      unread: !o,
      items: o ? o.items : null,
    });
  }

  {
    const d = input.delivered;
    rows.push({
      key: 'delivered',
      title: 'Delivered to couples',
      line: !d
        ? NOT_READ
        : d.items === 0
          ? 'Nothing yet'
          : `${n(d.couples, 'couple', 'couples')} · ${n(d.items, 'thing handed over', 'things handed over')}`,
      who: 'couple',
      pageSwitch: false,
      href: '/vendor-dashboard/customers',
      unread: !d,
      items: null,
    });
  }

  {
    const ig = input.instagram;
    if (ig === null || ig.configured) {
      rows.push({
        key: 'instagram',
        title: 'Instagram',
        line: !ig
          ? NOT_READ
          : !ig.connected
            ? 'Not connected'
            : `Connected · ${ig.postsAtLeast ? `${ig.posts.toLocaleString('en-PH')}+ posts` : n(ig.posts, 'post', 'posts')} · ${ig.shown.toLocaleString('en-PH')} shown`,
        who: ig && ig.connected && ig.shown > 0 && input.page.shown ? 'page' : 'private',
        pageSwitch: false,
        href: '#gallery-media',
        unread: !ig,
        items: ig ? ig.posts : null,
      });
    }
  }

  {
    const m = input.moodboard;
    if (m === null || m.allowed) {
      rows.push({
        key: 'moodboard',
        title: 'Mood board library',
        line: !m
          ? NOT_READ
          : m.looks === 0
            ? 'Nothing yet · looks couples can pick for their mood board'
            : [n(m.looks, 'look', 'looks'), 'couples pick from them', m.declined ? `${m.declined} declined` : '']
                .filter(Boolean)
                .join(' · '),
        who: 'couple',
        pageSwitch: false,
        href: '/vendor-dashboard/moodboard-library',
        unread: !m,
        items: m ? m.looks : null,
      });
    }
  }

  return rows;
}

export function filterRows(rows: readonly CollectionRow[], f: CollectionsFilter): CollectionRow[] {
  return f === 'all' ? [...rows] : rows.filter((r) => r.who === f);
}

/** "7 collections · about 312 photos · one place" — the total only when every count was read. */
export function collectionsLine(rows: readonly CollectionRow[]): string {
  const head = n(rows.length, 'collection', 'collections');
  if (rows.some((r) => r.unread)) return `${head} · one place`;
  const total = rows.reduce((a, r) => a + (r.items ?? 0), 0);
  return total > 0 ? `${head} · about ${total.toLocaleString('en-PH')} photos and videos · one place` : `${head} · one place`;
}
