import Link from 'next/link';
import { List, Network, type LucideIcon } from 'lucide-react';

/**
 * Guests view switcher (redesign Phase 1) — URL-driven (`?gview=list|map`) so it
 * fits the existing search-param architecture: SSR, shareable, no client island.
 * List is the default; Mind map is a placeholder until Phase 2 builds the editor;
 * Carries the active filter params across the switch so the chosen view inherits
 * the couple's current filtering.
 */
type ViewKey = 'list' | 'map';

/** One segment's look — shared with the roster's other doors (roster-tabs.tsx), so the control reads as one. */
export const SEG_ITEM = 'sn-seg-item inline-flex flex-auto items-center justify-center gap-1.5 whitespace-nowrap px-3 text-sm';

const FILTER_KEYS = ['q', 'rsvp', 'view', 'group', 'team', 'tag', 'sort'] as const;

export function GuestsViewSwitcher({
  eventId,
  active,
  search,
  bare = false,
}: {
  eventId: string;
  /** Inside another `.sn-seg` (the roster's one segmented control): the items only, no pill of its own. */
  bare?: boolean;
  /** The page's view. `share` is its own tab and lights neither List nor Mind
   *  map — it is not a way of looking at the roster. (The Wedding March left
   *  the Guest list for the Maker's Details, owner 2026-09-29.) */
  active: ViewKey | 'share';
  search: Record<string, string | undefined>;
}) {
  const hrefFor = (gview: ViewKey) => {
    const p = new URLSearchParams();
    for (const k of FILTER_KEYS) {
      const v = search[k];
      if (v) p.set(k, v);
    }
    if (gview !== 'list') p.set('gview', gview);
    const qs = p.toString();
    return `/dashboard/${eventId}/guests${qs ? `?${qs}` : ''}`;
  };

  const tabs: { key: ViewKey; label: string; Icon: LucideIcon }[] = [
    { key: 'list', label: 'List', Icon: List },
    { key: 'map', label: 'Mind map', Icon: Network },
    /*
      ⚖ NO WEDDING MARCH HERE (owner 2026-09-21: "wedding march is repeated?").
      It was added here on 2026-09-20 because it had no entry point; the next
      day the masthead's doors became one row of tabs (lib/roster-doors.ts) and
      Wedding March became one of them — gated on the event having a
      processional, which this copy never was (the page never passed
      `showWalk`, so birthdays saw it too). This switcher is only ever ways of
      LOOKING at the roster: List · Mind map.
    */
  ];

  const items = tabs.map(({ key, label, Icon }) => {
    const on = key === active;
    return (
      <Link
        key={key}
        href={hrefFor(key)}
        // Inside the roster's <nav> (bare) these are links with a current page;
        // on its own the switch is a tablist of tabs.
        {...(bare ? { 'aria-current': on ? ('page' as const) : undefined } : { role: 'tab', 'aria-selected': on })}
        className={SEG_ITEM}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        {label}
      </Link>
    );
  });
  if (bare) return <>{items}</>;
  return (
    <div role="tablist" aria-label="Guest list view" className="sn-seg inline-flex">
      {items}
    </div>
  );
}
