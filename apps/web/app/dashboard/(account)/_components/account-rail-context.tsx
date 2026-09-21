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
 *   People   → People · Connection tree · Alaga · Samahan
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
 * `?tab=photos` lights Recent because the page opens Recent). A People anchor
 * row never lights: a hash is a place on the page, not a page.
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
  GitFork,
  HandHeart,
  Handshake,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
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

type Row = { key: string; href: string; label: string; Icon: LucideIcon; on: boolean };

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + '/');
}

export function AccountRailContext({
  showConnections,
  showDependents,
}: {
  /** `peopleConnectionsEnabled()` — the tree only renders when it is on. */
  showConnections: boolean;
  /** The dependents flag AND the privacy control, exactly as the page gates
   *  `DependentsSection`. Either off → no Alaga section → no row. */
  showDependents: boolean;
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
    const rows: Row[] = [
      {
        key: 'people',
        href: '/dashboard/people',
        label: 'People',
        Icon: UsersRound,
        on: under(pathname, '/dashboard/people'),
      },
      ...(showConnections
        ? [
            {
              key: 'tree',
              href: '/dashboard/people#connection-tree',
              label: 'Connection tree',
              Icon: GitFork,
              on: false,
            },
          ]
        : []),
      ...(showDependents
        ? [
            {
              key: 'alaga',
              href: '/dashboard/people#alaga',
              label: 'Alaga',
              Icon: HandHeart,
              on: false,
            },
          ]
        : []),
      {
        key: 'samahan',
        href: '/dashboard/samahan',
        label: 'Samahan',
        Icon: Handshake,
        on: under(pathname, '/dashboard/samahan'),
      },
    ];
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
  const { href, label, Icon, on } = row;
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
      <span className="fd-label-text">{label}</span>
      <span className="fd-icon-caption">{label}</span>
    </Link>
  );
}
