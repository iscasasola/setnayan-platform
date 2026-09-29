'use client';

/**
 * account-rail-context.tsx — the menu the rail shows INSIDE Memories and People.
 *
 * Owner, 2026-09-21: *"When we enter an Event sidebar will collapse focusing on
 * just everything needed for that event and an icon to return to Events"* —
 * then *"same concept when on memories, people, shop, and admin."* Events, the
 * shop and HQ already pushed their own menus (`EventRailContext`,
 * `VendorRailContext`, `AdminRailContext`). Memories and People had none: their
 * sections lived only on the page. This is theirs, and nothing here is a new
 * destination — every row opens a view or a section the page already has.
 *
 *   Memories → Recent · Owned · Attended · People · With me,
 *              then "Also kept": Albums by event · Editorials · Saved vendors
 *              (owner: "move the chips into it" — the page's own chips, read
 *              from the SAME `_data/library-views.ts` the page renders from)
 *   People   → Requests (while any wait) · People · Following · Followers ·
 *              Alaga · Samahan — each a `?view=` link that LIGHTS (owner
 *              2026-09-28, the People redesign: the rail is the same list as
 *              the page's picker, resolved by the same `lib/people-views.ts`)
 *
 * ⚠ PEOPLE IS NOT "Family · Godparents · Friends". Those are GROUPS INSIDE the
 * roster (`people-roster-view.tsx` SECTIONS) that render only when someone is
 * in them, so a row jumping to one would land on nothing for most people. The
 * rows here are the page's sections that always render when their feature is
 * on: the roster itself, the tree (connections flag), the alaga cards
 * (dependents flag + privacy control) and Samahan, which is its own page.
 *
 * WHICH ROW IS LIT. This group resolves its own rows, like the shop's and HQ's
 * do — in focus mode the shell's account rows are not drawn, so nothing else
 * can light beside it. Memories lights by `resolveLibraryView`, the page's own
 * rule, so the lit row and the open view cannot disagree (a legacy
 * `?tab=photos` lights Recent because the page opens Recent). People lights by
 * `resolvePeopleView` the same way.
 *
 * 🔴 THE OLD PEOPLE ROWS WERE HASH ANCHORS THAT NEVER LIT — and one pointed at
 * nothing: `/dashboard/people#alaga` targeted an `id="alaga"` that existed
 * nowhere on the page. Both are gone; a view is a URL, not a place on a page.
 *
 * Every other `/dashboard/*` account page (profile, notifications, your story,
 * the year, …) renders NOTHING here and keeps the full rail.
 */

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  AtSign,
  CalendarCheck,
  Camera,
  Clock,
  HandHeart,
  Handshake,
  Inbox,
  UserCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import {
  PEOPLE_VIEW_LABEL,
  availablePeopleViews,
  peopleViewHref,
  resolvePeopleView,
  type PeopleView,
} from '@/lib/people-views';
import {
  KEPT,
  LENSES,
  resolveLibraryView,
  type LensKey,
} from '../library/_data/library-views';

const LENS_ICON: Record<LensKey, LucideIcon> = {
  recent: Clock,
  owned: Camera,
  attended: CalendarCheck,
  people: Users,
  with_me: AtSign,
};

type Row = {
  key: string;
  href: string;
  label: string;
  Icon: LucideIcon;
  on: boolean;
  /** A number beside the label (Requests only) — never a guessed 0. */
  count?: number | null;
};

const PEOPLE_ICON: Record<PeopleView, LucideIcon> = {
  requests: Inbox,
  connected: UsersRound,
  following: UserCheck,
  followers: Users,
  alaga: HandHeart,
  samahan: Handshake,
};

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

export function AccountRailContext({
  showConnections,
  showDependents,
  requestsWaiting,
}: {
  /** `peopleConnectionsEnabled()` — Requests and Connected live on it. */
  showConnections: boolean;
  /** The dependents flag AND the privacy control, exactly as the page gates
   *  `DependentsSection`. Either off → no Alaga view → no row. */
  showDependents: boolean;
  /** How many wait on my answer. 0 → no Requests row; null (could not be
   *  read) → the row stays, without a number: a refusal must not hide a request. */
  requestsWaiting: number | null;
}) {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();

  if (under(pathname, '/dashboard/library')) {
    const active = resolveLibraryView(searchParams?.get('tab'));
    const lenses: Row[] = LENSES.map(({ key, label }) => ({
      key,
      // Recent is the page's default view, so its row is the bare URL.
      href: key === 'recent' ? '/dashboard/library' : `/dashboard/library?tab=${key}`,
      label,
      Icon: LENS_ICON[key],
      on: active === key,
    }));
    const kept: Row[] = KEPT.map(({ key, label, Icon }) => ({
      key,
      href: `/dashboard/library?tab=${key}`,
      label,
      Icon,
      on: active === key,
    }));
    return (
      <>
        <div className="fd-rdiv" />
        <div className="fd-rctx">Memories</div>
        {lenses.map((r) => (
          <RailRow key={r.key} row={r} />
        ))}
        <div className="fd-rlabel fd-rsub">Also kept</div>
        {kept.map((r) => (
          <RailRow key={r.key} row={r} />
        ))}
      </>
    );
  }

  if (under(pathname, '/dashboard/people') || under(pathname, '/dashboard/samahan')) {
    const gates = { showConnections, showDependents };
    const onPeoplePage = pathname === '/dashboard/people';
    const active: PeopleView | null = under(pathname, '/dashboard/samahan')
      ? 'samahan'
      : onPeoplePage
        ? resolvePeopleView(searchParams?.get('view'), gates)
        : // An alaga's own page (/dashboard/people/<id>) belongs to Alaga.
          'alaga';
    const rows: Row[] = availablePeopleViews(gates)
      .filter((v) => v !== 'requests' || requestsWaiting !== 0)
      .map((v) => ({
        key: v,
        href: peopleViewHref(v, gates),
        // The rail's heading already says "People", and so does this row: it
        // is the page's default view (the picker calls it Connected).
        label: v === 'connected' ? 'People' : PEOPLE_VIEW_LABEL[v],
        Icon: PEOPLE_ICON[v],
        on: active === v,
        count: v === 'requests' ? requestsWaiting : undefined,
      }));
    return (
      <>
        <div className="fd-rdiv" />
        <div className="fd-rctx">People</div>
        {rows.map((r) => (
          <RailRow key={r.key} row={r} />
        ))}
      </>
    );
  }

  return null;
}

function RailRow({ row }: { row: Row }) {
  const { href, label, Icon, on, count } = row;
  return (
    <Link
      href={href}
      className="fd-row"
      data-on={on ? 'true' : 'false'}
      aria-current={on ? 'page' : undefined}
    >
      <span className="fd-gi" aria-hidden="true">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="fd-label-text">
        {label}
        {typeof count === 'number' && count > 0 ? (
          <span className="ml-1.5 inline-flex items-center gap-1 tabular-nums text-terracotta-700">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-terracotta" />
            {formatCount(count)}
          </span>
        ) : null}
      </span>
      <span className="fd-icon-caption">{label}</span>
    </Link>
  );
}
