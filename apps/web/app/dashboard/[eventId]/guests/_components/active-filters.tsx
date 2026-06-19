import Link from 'next/link';
import { X } from 'lucide-react';
import {
  RSVP_LABELS,
  TEAM_SIDE_LABELS,
  type GuestGroupWithCount,
  type RsvpStatus,
} from '@/lib/guests';
import { ROLE_GROUP_LABELS, type RoleGroup } from '@/lib/role-groups';

// -----------------------------------------------------------------------
// ActiveFilters · the single, always-visible home for "what am I looking
// at" (redesign 2026-06-13). Every filter dimension — search · side ·
// RSVP · role-view · custom group · tag — surfaces here as a removable
// chip, with one "Clear all". Replaces the old split-brain state where a
// filter you'd set from the team segment / stat cards / sidebar left no
// shared trace and could only be cleared from the control that set it.
//
// Server-rendered Links (no client island): each chip drops exactly one
// URL param and preserves the rest, so removal works with no JS and the
// state survives refresh + share. Used in BOTH surfaces — inline in the
// desktop chrome block, and as a sticky strip above the mobile list.
//
// The param contract is unchanged (team / rsvp / view / group / tag / q /
// sort / gview); this component only *reads* it. `view` is the role-group
// key and `group` the custom-group id — separate params (2026-06-13
// combinable-filters change) so "Wedding Party + Cousins" can both show.
// -----------------------------------------------------------------------

const PRESERVE_ON_CLEAR = ['sort', 'gview'] as const;

type Search = {
  q?: string;
  rsvp?: string;
  view?: string;
  group?: string;
  team?: string;
  tag?: string;
  sort?: string;
  gview?: string;
};

export function ActiveFilters({
  eventId,
  search,
  groups,
  className = '',
}: {
  eventId: string;
  search: Search;
  groups: GuestGroupWithCount[];
  className?: string;
}) {
  const base = `/dashboard/${eventId}/guests`;
  const hrefWithout = (key: keyof Search) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(search)) {
      if (k === key || !v) continue;
      p.set(k, v);
    }
    const qs = p.toString();
    return `${base}${qs ? `?${qs}` : ''}`;
  };
  const clearAllHref = () => {
    const p = new URLSearchParams();
    for (const k of PRESERVE_ON_CLEAR) {
      const v = search[k];
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return `${base}${qs ? `?${qs}` : ''}`;
  };

  const team = search.team === 'bride' || search.team === 'groom' ? search.team : null;
  const rsvp = (search.rsvp ?? '') as RsvpStatus | '';
  const view = (search.view ?? '') as RoleGroup | '';
  const groupId = search.group ?? '';
  const tag = (search.tag ?? '').trim();
  const q = (search.q ?? '').trim();
  const groupLabel = groupId
    ? groups.find((g) => g.group_id === groupId)?.label ?? 'Group'
    : null;

  const chips: { key: keyof Search; label: string; dot?: string }[] = [];
  if (q) chips.push({ key: 'q', label: `“${q}”` });
  if (team)
    chips.push({
      key: 'team',
      label: TEAM_SIDE_LABELS[team],
      dot: team === 'bride' ? 'bg-danger-500' : 'bg-sky-600',
    });
  if (rsvp && RSVP_LABELS[rsvp]) chips.push({ key: 'rsvp', label: RSVP_LABELS[rsvp] });
  if (view && view !== ('all' as RoleGroup) && ROLE_GROUP_LABELS[view])
    chips.push({ key: 'view', label: ROLE_GROUP_LABELS[view] });
  if (groupLabel) chips.push({ key: 'group', label: groupLabel });
  if (tag) chips.push({ key: 'tag', label: tag });

  if (chips.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        Filters
      </span>
      {chips.map((c) => (
        <Link
          key={c.key}
          href={hrefWithout(c.key)}
          className="inline-flex items-center gap-1.5 rounded-full bg-terracotta/10 px-2.5 py-1 text-xs font-medium text-terracotta-700 transition-colors hover:bg-terracotta/20"
        >
          {c.dot ? <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} /> : null}
          <span className="max-w-[14rem] truncate">{c.label}</span>
          <X aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.25} />
        </Link>
      ))}
      {chips.length > 1 ? (
        <Link
          href={clearAllHref()}
          className="text-xs text-ink/55 underline decoration-dotted underline-offset-2 hover:text-ink"
        >
          Clear all
        </Link>
      ) : null}
    </div>
  );
}
