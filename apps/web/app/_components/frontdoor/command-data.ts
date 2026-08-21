/**
 * command-data.ts — the ONE index the shared top bar's search reads.
 *
 * ─── WHY THIS FILE EXISTS ────────────────────────────────────────────────
 * Until 2026-08-14 the app had TWO searches wearing the same shape:
 *
 *   the front door's box   a GET form to /explore — the SUPPLIER MARKETPLACE
 *   the launcher's ⌘K      a palette over the person's OWN events + spaces
 *
 * They answer different questions, and the launcher's was reachable on
 * exactly one screen out of ~300. One shell means one top bar, and one top
 * bar means one search — so the question had to be settled rather than
 * inherited from whichever was easier to wire.
 *
 * 🔑 THE PALETTE WINS, AND IT CARRIES THE MARKETPLACE AS AN ESCAPE ROW.
 * Every surface this bar mounts on is INSIDE the person's own app: their
 * events board, their Alaala, a wedding, their shop, HQ. Someone typing into
 * a box at the top of their own dashboard is asking "where is my thing" —
 * a guest's name, an event, their photos. The marketplace form cannot answer
 * that at all; the palette CAN answer the marketplace question, because a
 * synthetic last row hands the typed words to /explore (see
 * `marketplaceEscapeItem`). One mechanism, both questions, nothing guessed.
 *
 * The reverse was never possible: a GET form to /explore has no way to reach
 * your own wedding, so choosing it would have DELETED the launcher's palette
 * — an existing door — to make the bar consistent. That is the trade this
 * repo keeps paying for and it is not paid again here.
 *
 * ─── AND IT IS ONE BUILDER, NOT TWO ──────────────────────────────────────
 * The launcher used to build this list inline from data its page had already
 * loaded. That list now lives here and the launcher imports the labels back,
 * because a second builder is a second answer: the palette would have listed
 * different things on `/dashboard` than inside a wedding, with no error.
 *
 * 💸 COST: ZERO EXTRA ROUND TRIPS ON THE LAUNCHER. Every read below is React
 * `cache()`d at its source (`fetchUserEvents`, `fetchUserCommunities`,
 * `fetchUserRoleSummary`), and the launcher page already calls all three, so
 * the request de-dupes. On the other four trees this is 3 small reads that
 * were not made before — named, measured, and the price of the bar carrying
 * a real index instead of a link.
 */
import 'server-only';
import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents, type EventWithRole } from '@/lib/events';
import { fetchUserCommunities } from '@/lib/communities';
import { fetchUserRoleSummary } from '@/lib/roles';
import {
  eventBoardHref,
  eventStance,
  manilaTodayISO,
  mergeBoardMemberships,
  splitEventBoard,
} from '@/lib/event-board';

import type { HomeCommandItem } from '@/app/dashboard/(launcher)/_components/home-command-bar';

/**
 * event_type → short badge. Filipino term where one is well established
 * (kasal · binyag · kaarawan · anibersaryo), else an uppercased English label —
 * matching the owner mockup (KASAL / BINYAG / DEBUT). Extend as verticals grow.
 *
 * ⚠ MOVED HERE FROM `(launcher)/page.tsx` (2026-08-14), which now imports it
 * back. It is not duplicated: the board cards and the palette must badge one
 * event with one word, and two copies is how they stop.
 */
export const EVENT_TYPE_BADGE: Record<string, string> = {
  wedding: 'KASAL',
  christening: 'BINYAG',
  baptism: 'BINYAG',
  debut: 'DEBUT',
  birthday: 'KAARAWAN',
  anniversary: 'ANIBERSARYO',
};

export function eventTypeBadge(type: string): string {
  return (
    EVENT_TYPE_BADGE[type] ??
    type
      .split(/[_\s]+/)
      .filter(Boolean)
      .join(' ')
      .toUpperCase()
  );
}

/**
 * Short "Mon D" date matching the mockup (tz-safe, date-only).
 *
 * 🔑 PARSED FIELD-BY-FIELD, NEVER `new Date(iso)`. `events.event_date` is a
 * DATE; `new Date('2026-12-12')` is midnight UTC, which is the 11th west of
 * Greenwich — the bug that printed a 12 Dec wedding as 11 Dec on 41 screens
 * (`DECISION_LOG.md` 2026-08-04).
 */
export function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Best-effort place for the meta line. venue_name when set, else a leading
 *  segment of the free-text address (there is no venue_city column). */
export function placeLabel(event: EventWithRole): string | null {
  if (event.venue_name?.trim()) return event.venue_name.trim();
  const addr = event.venue_address?.trim();
  if (!addr) return null;
  return addr.split(',')[0]?.trim() || null;
}

/**
 * ⚠ THE MARKETPLACE ESCAPE ROW LIVES IN `command-escape.ts`, NOT HERE. It is
 * built on the CLIENT from the live query, and this module is `server-only` —
 * folding it back in would break the build for a reason the diff cannot show.
 */

/**
 * The person's own things, as the shared top bar's palette lists them.
 *
 * Everything is best-effort: a failed read must degrade to a shorter list,
 * never to a bar with no search in it. The underlying helpers already
 * graceful-degrade to `[]`, so the try/catch here is the outer belt.
 */
export const resolveCommandItems = cache(
  async (): Promise<HomeCommandItem[]> => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const [organiser, invited, communities, roles, chapters] =
        await Promise.all([
          fetchUserEvents(supabase, user.id, 'couple'),
          fetchUserEvents(supabase, user.id, 'guest'),
          fetchUserCommunities(supabase, user.id),
          fetchUserRoleSummary(supabase, user.id),
          supabase
            .from('creator_chapters')
            .select('chapter_id', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ]);

      const { comingUp, finished } = splitEventBoard(
        mergeBoardMemberships(organiser, invited),
        manilaTodayISO(),
      );
      // ⚠ A REJECTED QUERY IS NOT A THROWN ERROR. `error` is checked, not
      // caught — a phantom column would otherwise print "0 chapters" as if
      // it were measured.
      const chapterCount = chapters.error ? null : (chapters.count ?? 0);

      const items: HomeCommandItem[] = [
        /*
          ⚠ THE JUMP TARGET IS `eventBoardHref`, NOT `/dashboard/${event_id}`.
          The couple dashboard admits ORGANISERS ONLY, so hardcoding that path
          puts a 404 behind a search result offered to the very person who was
          told they belong. An invited event whose host has opened no public
          page has nowhere to jump, so it is DROPPED rather than listed with a
          dead href. See `lib/event-board.ts` — never re-derive this.
        */
        ...[...comingUp, ...finished]
          .map((e) => ({ e, href: eventBoardHref(e) }))
          .filter((x): x is { e: EventWithRole; href: string } => x.href !== null)
          .map(({ e, href }): HomeCommandItem => {
            const dateLabel = shortDate(e.event_date);
            const place = placeLabel(e);
            const stance = eventStance(e.member_type);
            return {
              id: `event-${e.event_id}`,
              label: e.display_name,
              sublabel: [
                eventTypeBadge(e.event_type),
                dateLabel ?? 'Date to be set',
                place,
                stance === 'invited' ? 'You’re invited' : null,
              ]
                .filter(Boolean)
                .join(' · '),
              href,
              kind: 'event',
              icon: 'calendar',
            };
          }),
      ];

      /*
        WHAT YOU RUN — the same membership rule the rail uses, from the same
        resolver. `hasVendorAccess` covers a hired TEAM MEMBER who owns no
        shop row; gating on ownership instead would offer the console to
        nobody who was hired into it.
      */
      if (roles.hasVendorAccess) {
        items.push({
          id: 'space-shop',
          label: roles.vendorProfiles[0]?.business_name ?? 'Your shop',
          sublabel: 'Your business on Setnayan',
          href: '/vendor-dashboard',
          kind: 'space',
          icon: 'store',
        });
      }
      if (roles.hasAdminAccess) {
        items.push({
          id: 'space-hq',
          label: 'Setnayan HQ',
          sublabel: 'The internal console',
          href: '/admin',
          kind: 'space',
          icon: 'shield',
        });
      }

      // Samahan jump items — one per community, findable by name.
      // RA 10173: only display name + role + count reach the DOM.
      items.push(
        ...communities.map(
          (c): HomeCommandItem => ({
            id: `samahan-${c.community_id}`,
            label: c.name,
            sublabel:
              c.role === 'organizer'
                ? `Organizer · ${c.member_count} ${c.member_count === 1 ? 'member' : 'members'}`
                : 'Member',
            href: `/dashboard/samahan/${c.community_id}`,
            kind: 'space',
            icon: 'users',
          }),
        ),
      );

      items.push(
        {
          id: 'action-new-event',
          label: 'New event',
          sublabel: 'Start planning a new celebration',
          href: '/dashboard/create-event',
          kind: 'action',
          icon: 'plus',
        },
        {
          id: 'action-new-samahan',
          label: 'Create a Samahan',
          sublabel: 'A shared space for your barkada, parish, or clan',
          href: '/dashboard/samahan/new',
          kind: 'action',
          icon: 'users',
        },
        {
          // The destination page is titled Alaala (owner 2026-07-31), so the
          // palette says Alaala — not the retired "Memories Hub".
          id: 'action-library',
          label: 'Alaala',
          sublabel: 'Photos · videos · editorials',
          href: '/dashboard/library',
          kind: 'action',
          icon: 'sparkles',
        },
        {
          id: 'action-saved-vendors',
          label: 'Saved vendors',
          sublabel: 'Your shortlist',
          href: '/dashboard/library?tab=vendors',
          kind: 'action',
          icon: 'heart',
        },
        {
          id: 'action-people',
          label: 'People',
          sublabel: 'Everyone across your events',
          href: '/dashboard/people',
          kind: 'action',
          icon: 'users',
        },
        // 'Your year' IS RETIRED (owner 2026-08-21: *"remove the your year…
        // we already have the your year inside my events"*). Its contents are
        // the "Worth planning" shelf on My Events, holidays included, and
        // /dashboard/year now redirects there — a palette row pointing at a
        // redirect is a door that lies about where it goes.
        // 'Your Story' IS RETIRED (owner 2026-08-21: *"remove … your story.
        // we already have your story on untold"*). My Events carries both
        // doors now — "Write the story of <name>" on Untold, and "read them in
        // Your Story" on Told. The ROUTE is untouched.
        {
          id: 'action-profile',
          label: 'Profile & account',
          sublabel: 'Personal info · security · privacy',
          href: '/dashboard/profile',
          kind: 'action',
          icon: 'user',
        },
        // 🔒 NO ACCOUNT-LEVEL "Setnayan AI" ROW (removed 2026-08-01). Setnayan
        // AI is PER EVENT (owner: "it is per event"), so an account-level
        // doorway is a door to nothing. It is reached from inside an event.
        {
          id: 'action-notifications',
          label: 'Notifications',
          sublabel: 'Everything waiting for you',
          href: '/dashboard/notifications',
          kind: 'action',
          icon: 'bell',
        },
      );

      return items;
    } catch {
      return [];
    }
  },
);
