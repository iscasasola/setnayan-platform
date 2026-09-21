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

const FILTER_KEYS = ['q', 'rsvp', 'view', 'group', 'team', 'tag', 'sort'] as const;

export function GuestsViewSwitcher({
  eventId,
  active,
  search,
}: {
  eventId: string;
  /** The page's view. `walk` and `share` are their own tabs and light neither
   *  List nor Mind map — they are not ways of looking at the roster. */
  active: ViewKey | 'walk' | 'share';
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

  return (
    <div role="tablist" aria-label="Guest list view" className="sn-seg inline-flex">
      {tabs.map(({ key, label, Icon }) => {
        const on = key === active;
        return (
          <Link
            key={key}
            href={hrefFor(key)}
            role="tab"
            aria-selected={on}
            className="sn-seg-item inline-flex items-center justify-center gap-1.5 px-3 text-sm"
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
