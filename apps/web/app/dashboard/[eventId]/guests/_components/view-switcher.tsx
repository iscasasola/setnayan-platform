import Link from 'next/link';
import { List, ListOrdered, Network, type LucideIcon } from 'lucide-react';

/**
 * Guests view switcher (redesign Phase 1) — URL-driven (`?gview=list|map|walk`) so it
 * fits the existing search-param architecture: SSR, shareable, no client island.
 * List is the default; Mind map is a placeholder until Phase 2 builds the editor;
 * Walking order is where a pair is one line and the couple sets who walks first.
 * Carries the active filter params across the switch so the chosen view inherits
 * the couple's current filtering.
 */
type ViewKey = 'list' | 'map' | 'walk';

const FILTER_KEYS = ['q', 'rsvp', 'view', 'group', 'team', 'tag', 'sort'] as const;

export function GuestsViewSwitcher({
  eventId,
  active,
  search,
  showWalk = true,
}: {
  eventId: string;
  /** The page's view. `share` (the Share the link tab) lights neither List nor
   *  Mind map — it is not a way of looking at the roster. */
  active: ViewKey | 'share';
  search: Record<string, string | undefined>;
  /** Whether this celebration has a processional at all — a generic event's
   *  roles (guest · host · vip · family · helper) walk down no aisle, so the
   *  tab would open a view with nothing in it. Derived by the caller from the
   *  event's own role set, never from a list of event types. */
  showWalk?: boolean;
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
      ⚖ OWNER 2026-09-20: *"so how to launch it on the guestlist?"* — the
      Walking order panel had NO entry point. It rendered under a role filter
      only, so the one place to arrange who walks first was reachable solely by
      someone who already knew to filter first, and then only for that filter's
      group.

      🔑 A TAB, NOT A PERMANENT PANEL. Putting the whole processional above the
      roster would push the guest list down the page on every visit, for a job a
      couple does a handful of times. It is a VIEW of the same list, so it lives
      where the other views live — URL-driven, SSR, shareable, no client island.
    */
  ];
  if (showWalk) tabs.push({ key: 'walk', label: 'Wedding March', Icon: ListOrdered });

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
