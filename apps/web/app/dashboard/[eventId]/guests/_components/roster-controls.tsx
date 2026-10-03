'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { Sheet } from '@/app/_components/sheet';
import { RSVP_ROW_WORDS } from '@/lib/guests';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

/**
 * roster-controls.tsx — the Guest list's Sort ▾ and its four filter dropdowns,
 * RSVP · Side · Role · Group (owner 2026-09-30, the approved Fable design
 * `prototypes/guest_list_rows_2026-09-30_fable.html`, frames A · E · F).
 *
 * Each opens ONE list — the shipped `PickMenu`, never a row of pills — and
 * writes the SAME URL params the old filter popover and header ticks wrote
 * (`rsvp` · `team` · `view` · `group` · `tag` · `sort`), so every bookmarked
 * link still lands where it did and the server still does the filtering.
 * A dropdown in use says its value in gild ("RSVP: No reply") — that is the
 * only place an active filter shows; there is no separate chip strip.
 *
 * 🔑 Sort ▾ is the one place for order: the table header's group-by ticks and
 * sort arrows are gone. "Importance" keeps today's role sections, with the
 * bride and groom always first.
 */

type Opt = { key: string; label: string };

const RSVP_OPTIONS: Opt[] = [
  { key: '', label: 'Everyone' },
  { key: 'attending', label: RSVP_ROW_WORDS.attending },
  { key: 'pending', label: RSVP_ROW_WORDS.pending },
  { key: 'declined', label: RSVP_ROW_WORDS.declined },
  { key: 'maybe', label: RSVP_ROW_WORDS.maybe },
];

const SIDE_OPTIONS: Opt[] = [
  { key: '', label: 'Both sides' },
  { key: 'bride', label: "Bride's side" },
  { key: 'groom', label: "Groom's side" },
];

const MANAGE = '__manage_groups__';

const ACTIVE = '!bg-[var(--sn-gold-100)] ring-1 ring-[var(--sn-gold-300,#d8c79a)]';

function useParamWriter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const write = (overrides: Record<string, string | null>) => {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    // A filter change closes nothing else; the open card (`inspect`) stays.
    const qs = p.toString();
    startTransition(() => router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false }));
  };
  return { searchParams, write };
}

/** Sort ▾ — one list; `by` is cleared so the sections follow the sort again. */
export function RosterSort({ sorts, current }: { sorts: Opt[]; current: string }) {
  const { write } = useParamWriter();
  return (
    <PickMenu
      label="Sort"
      value={current}
      options={sorts}
      buttonText="Sort"
      onPick={(key) => write({ sort: key === 'importance' ? null : key, by: null })}
      dataAttr="data-roster-sort"
      className="border border-ink/15"
    />
  );
}

/** RSVP ▾ · Side ▾ · Role ▾ · Group ▾ — each one list, each its own URL param. */
export function RosterFilters({
  hasSides,
  views,
  groups,
  tags,
  maybeCount,
  manageGroups,
}: {
  /** A birthday has no sides — no Side dropdown. */
  hasSides: boolean;
  /** Role views (`view`), first one "All guests". */
  views: Opt[];
  /** The couple's groups, with the side each belongs to. */
  groups: { group_id: string; label: string; team_side: 'bride' | 'groom' | 'both' }[];
  /** Tags any guest carries — listed at the bottom of Group. */
  tags: string[];
  /** Maybe is only listed while somebody still holds that answer. */
  maybeCount: number;
  /**
   * Make · rename · delete groups — the group manager the old filter popover
   * held (`GroupsSidebar`), MOVED here: the last line of Group ▾ opens it.
   * Omitted → no such line.
   */
  manageGroups?: ReactNode;
}) {
  const { searchParams, write } = useParamWriter();
  const [managing, setManaging] = useState(false);
  const rsvp = searchParams.get('rsvp') ?? '';
  const team = searchParams.get('team') ?? '';
  const view = searchParams.get('view') ?? 'all';
  const group = searchParams.get('group') ?? '';
  const tag = searchParams.get('tag') ?? '';

  const rsvpOptions = RSVP_OPTIONS.filter((o) => o.key !== 'maybe' || maybeCount > 0 || rsvp === 'maybe');
  // Groups for the side you stand in; a both-sided group belongs to either,
  // and the ACTIVE one always stays so its filter is never invisible.
  const groupsHere = groups.filter(
    (g) => !team || g.team_side === team || g.team_side === 'both' || g.group_id === group,
  );
  const groupOptions: PickOption[] = [
    { key: '', label: 'All groups' },
    ...groupsHere.map((g) => ({ key: `g:${g.group_id}`, label: g.label })),
    ...tags.map((t) => ({ key: `t:${t}`, label: t, group: 'Tags' })),
    ...(manageGroups ? [{ key: MANAGE, label: 'Make or rename groups…', group: 'Your groups' }] : []),
  ];
  const groupValue = group ? `g:${group}` : tag ? `t:${tag}` : '';
  const groupWord = group
    ? groups.find((g) => g.group_id === group)?.label ?? 'Group'
    : tag || null;

  const said = (base: string, word: string | null) => (word ? `${base}: ${word}` : base);

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-roster-filters="">
      <PickMenu
        label="RSVP"
        value={rsvp}
        options={rsvpOptions}
        buttonText={said('RSVP', rsvp ? (RSVP_OPTIONS.find((o) => o.key === rsvp)?.label ?? null) : null)}
        onPick={(key) => write({ rsvp: key })}
        dataAttr="data-roster-filter-rsvp"
        className={`border border-ink/15 ${rsvp ? ACTIVE : ''}`}
      />
      {hasSides ? (
        <PickMenu
          label="Side"
          value={team}
          options={SIDE_OPTIONS}
          buttonText={said('Side', team ? (team === 'bride' ? 'Bride' : 'Groom') : null)}
          onPick={(key) => write({ team: key })}
          dataAttr="data-roster-filter-side"
          className={`border border-ink/15 ${team ? ACTIVE : ''}`}
        />
      ) : null}
      <PickMenu
        label="Role"
        value={view}
        options={views}
        buttonText={said('Role', view !== 'all' ? (views.find((v) => v.key === view)?.label ?? null) : null)}
        onPick={(key) => write({ view: key === 'all' ? null : key })}
        dataAttr="data-roster-filter-role"
        className={`border border-ink/15 ${view !== 'all' ? ACTIVE : ''}`}
      />
      <PickMenu
        label="Group"
        value={groupValue}
        options={groupOptions}
        buttonText={said('Group', groupWord)}
        onPick={(key) =>
          key === MANAGE
            ? setManaging(true)
            : write(
            key.startsWith('g:')
              ? { group: key.slice(2), tag: null }
              : key.startsWith('t:')
                ? { tag: key.slice(2), group: null }
                : { group: null, tag: null },
          )
        }
        dataAttr="data-roster-filter-group"
        className={`border border-ink/15 ${groupValue ? ACTIVE : ''}`}
      />
      {manageGroups ? (
        <Sheet open={managing} onClose={() => setManaging(false)} labelledById="roster-groups-title" title="Your groups" rise>
          <div className="space-y-3 p-5">
            <h2 id="roster-groups-title" className="sr-only">
              Your groups
            </h2>
            <div className="flex flex-wrap items-center gap-2">{manageGroups}</div>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
