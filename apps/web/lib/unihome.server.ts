/**
 * unihome.server.ts — the reads Unihome v5 adds to Home (owner-approved 23 Nov 2026, DECISION_LOG "UNIHOME v5
 * APPROVED"). Every one of them is a reader the app ALREADY has, asked here instead of on a page you have to visit:
 *
 *   · Shop     — the shop row (`verification_state`, its cover pick), the cards (`readHomeCardCounts`) and the
 *                account's unread shop notices (`readSheetUnreadUrls` → `splitSheetUnread`, the avatar sheet's own
 *                "• N new"). The cover is the shop's own (`shopCoverKey`, the shop dashboard's rule), else its first
 *                Online card's photo, else the wash.
 *   · People   — `waitingRequestCount` ("N asking you") and the roster's connected faces (`getPeopleRoster`), both only
 *                while People is open (`peopleConnectionsEnabled`).
 *   · Memories — the albums (`getPhotosAlbums`, `cache()`d — the Memories page's own read).
 *   · Discover — Discover's own shelves: upcoming from people you follow (`loadDiscover`) and the live shops
 *                (`loadLiveShops`), verified only.
 *
 * The page STARTS every one of these before its first wait and awaits them in its one `Promise.all` (rule D16). Each
 * fails soft to `null` = "couldn't read" — never 0, never an empty list that reads as "you have none".
 */
import 'server-only';

import type { SwitcherData } from '@/app/_components/account-switcher/get-switcher-data';
import { loadLiveShops } from '@/app/_components/frontdoor/data';
import { getPhotosAlbums } from '@/app/dashboard/(account)/library/_data/photos-albums';
import { readSheetUnreadUrls, splitSheetUnread } from '@/lib/avatar-sheet-counts';
import { loadDiscover } from '@/lib/discover-events';
import { readHomeCardCounts } from '@/lib/home-profile.server';
import { MEMORIES_HOME, PEOPLE_HOME } from '@/lib/home-segments';
import { peopleConnectionsEnabled } from '@/lib/people-connections';
import { getPeopleRoster, waitingRequestCount } from '@/lib/people-roster';
import { personPageHref } from '@/lib/person-page-link';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { shopCoverKey } from '@/lib/supplier-hero';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  unihomeInitials,
  type UnihomeDiscover,
  type UnihomeMemories,
  type UnihomePeople,
  type UnihomeShop,
} from '@/lib/unihome';

/** How many faces, memories and suppliers a part draws before its "See all →". */
export const UNIHOME_FACES = 4;
export const UNIHOME_SHELF = 4;

/* ── Shop ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

export async function readUnihomeShop(switcher: SwitcherData | null, userId: string): Promise<UnihomeShop> {
  if (!switcher) return { kind: 'none' };
  const shops = switcher.context.shops ?? [];
  const owned = shops.find((s) => s.owned) ?? null;
  if (!owned) {
    const helping = shops[0] ?? null;
    if (helping) {
      return {
        kind: 'helper',
        name: helping.name,
        initials: unihomeInitials(helping.name),
        logoUrl: helping.logoUrl,
        canOpenShop: switcher.context.canOpenShop,
      };
    }
    return switcher.context.canOpenShop ? { kind: 'create' } : { kind: 'none' };
  }

  const supabase = await createClient();
  const rowRead = (async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('verification_state, portfolio_r2_keys, microsite_hero_photo_key')
        .eq('vendor_profile_id', owned.id)
        .maybeSingle();
      if (error || !data) {
        if (error) logQueryError('Unihome.shopRow', error, {}, 'graceful_degrade');
        return null;
      }
      return data as { verification_state: string | null; portfolio_r2_keys: string[] | null; microsite_hero_photo_key: string | null };
    } catch {
      return null;
    }
  })();
  const [row, cards, unreadUrls] = await Promise.all([
    rowRead,
    readHomeCardCounts(owned.id),
    readSheetUnreadUrls(supabase, userId).catch(() => null),
  ]);
  const coverKey = (row ? shopCoverKey(row.portfolio_r2_keys, row.microsite_hero_photo_key) : null) ?? cards?.topPhotoKey ?? null;
  const coverUrl = coverKey ? await displayUrlForStoredAsset(coverKey).catch(() => null) : null;
  return {
    kind: 'owner',
    id: owned.id,
    name: owned.name,
    initials: unihomeInitials(owned.name),
    logoUrl: owned.logoUrl,
    publicHref: owned.publicHref,
    verified: row ? row.verification_state === 'verified' : null,
    coverUrl,
    newCount: unreadUrls ? splitSheetUnread(unreadUrls, shops.length).shop : null,
    cards: cards ? { cards: cards.cards, online: cards.online } : null,
  };
}

/* ── People ───────────────────────────────────────────────────────────────────────────────────────────────────── */

export async function readUnihomePeople(userId: string): Promise<UnihomePeople> {
  if (!peopleConnectionsEnabled()) return { asking: null, faces: null };
  const [asking, roster] = await Promise.all([
    waitingRequestCount(userId).catch(() => null),
    getPeopleRoster(userId).catch(() => null),
  ]);
  const faces =
    roster && !roster.connectionsUnavailable
      ? roster.people
          .filter((p) => p.state === 'connected' && p.kind === 'connection')
          .slice(0, UNIHOME_FACES)
          .map((p) => ({
            key: p.key,
            name: p.name.split(/\s+/)[0] ?? p.name,
            initials: unihomeInitials(p.name),
            photoUrl: null,
            href: personPageHref({ slug: p.slug, publicId: p.publicId }) ?? PEOPLE_HOME,
          }))
      : null;
  return { asking, faces };
}

/* ── Memories ─────────────────────────────────────────────────────────────────────────────────────────────────── */

const MONTH_YEAR = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', year: 'numeric' });

export async function readUnihomeMemories(userId: string): Promise<UnihomeMemories> {
  try {
    const { albums, albumsMeasured } = await getPhotosAlbums(userId);
    if (!albumsMeasured) return null;
    return [...albums]
      .filter((a) => a.thumbs.some((t) => !t.isClip))
      .sort((a, b) => (b.event.event_date ?? '').localeCompare(a.event.event_date ?? ''))
      .slice(0, UNIHOME_SHELF)
      .map((a) => ({
        key: a.event.event_id,
        title: a.event.display_name,
        sub: a.event.event_date ? MONTH_YEAR.format(new Date(`${a.event.event_date.slice(0, 10)}T12:00:00+08:00`)) : null,
        photoUrl: a.thumbs.find((t) => !t.isClip)!.url,
        href: a.href ?? MEMORIES_HOME,
      }));
  } catch {
    return null;
  }
}

/* ── Discover ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export async function readUnihomeDiscover(): Promise<UnihomeDiscover> {
  const [discover, live] = await Promise.all([
    loadDiscover().catch(() => null),
    loadLiveShops(12).catch(() => ({ shops: [], count: null, realCount: null })),
  ]);
  const upcoming = discover ? discover.people : { status: 'unavailable' as const };
  const suppliers =
    live.count === null && live.shops.length === 0
      ? null
      : live.shops
          .filter((s) => s.verified)
          .slice(0, UNIHOME_SHELF)
          .map((s) => ({
            key: s.href,
            name: s.name,
            sub: [s.folderLabel, s.city].filter(Boolean).join(' · ') || null,
            coverUrl: s.cover.url,
            sample: s.cover.sample,
            href: s.href,
          }));
  return {
    upcoming: upcoming ? (upcoming.status === 'ok' ? { status: 'ok', items: upcoming.items.slice(0, UNIHOME_SHELF) } : upcoming) : null,
    suppliers,
  };
}
