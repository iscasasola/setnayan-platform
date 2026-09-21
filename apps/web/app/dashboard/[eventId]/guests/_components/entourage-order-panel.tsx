/**
 * entourage-order-panel.tsx — "who walks first", on the guest list.
 *
 * ⚖ Owner 2026-09-20, asked where this should live: on the guest list, per role
 * view. So it appears ONLY when the host has filtered to a role group, and it
 * shows exactly the people that filter is about, in the order the invitation
 * prints them.
 *
 * ── WHY A PANEL AND NOT TWO MORE BUTTONS IN THE ROW ────────────────────────
 * The roster table's column widths are budgeted down to the percent, with a
 * docblock explaining that six columns had already eaten the name until
 * "Indalecio Casasola" rendered as "Indalecio Casa…". An eighth column for two
 * arrows would take that space back from the one column a couple actually
 * reads. A panel above the table costs the table nothing, and it can show the
 * thing the row never could: the printed POSITION, and the two columns the
 * invitation lays the role out in.
 *
 * ── MOVE ↑ / MOVE ↓, NOT HTML5 DRAG ────────────────────────────────────────
 * The same choice `admin/website/widget-list.tsx` made, for the same reason:
 * HTML5 drag-and-drop does not exist on touch, and arranging an entourage is
 * something a couple does on their phone, on a sofa, the week of the wedding.
 * Buttons work on every input and are reachable by keyboard and screen reader
 * without a single ARIA incantation.
 *
 * Server component: it renders plain forms bound to server actions, so there
 * is no client bundle and no optimistic state to get out of step with the
 * order the public page is printing.
 */

import { ArrowDown, ArrowUp } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { WalkingOrderLines, type MarchSlot } from './walking-order-lines';
import { joinersFor, swapsFor } from '@/lib/march-moves';
import { moveEntourageSection, resetEntourageSections } from '../march-actions';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  ENTOURAGE_COLUMNS,
  ENTOURAGE_GROUP_LIST,
  entourageGroupLabel,
  entourageGroupOfRole,
  entourageLines,
  orderedGroupKeys,
  sectionsAreArranged,
  ENTOURAGE_ROLES,
  roleLabel,
  type EntourageGuestRow,
  type EntourageRow,
} from '@/lib/entourage';
import { guestFullName, ROLE_LABELS, type GuestRole } from '@/lib/guests';
import { roleGroupOf } from '@/lib/role-groups';
import {
  clearEntourageOrder,
  moveInEntourageOrder,
} from '../entourage-order-actions';

/**
 * Which printed roles this dashboard view covers.
 *
 * 🔑 DERIVED, NEVER LISTED. The dashboard groups roles its own way and the
 * invitation groups them another; a hand-written map between the two would be
 * correct on the day it was written and wrong the first time either side
 * gained a role. This asks both: every role the invitation prints, whose
 * dashboard group is the one being viewed.
 */
export function printedRolesForView(view: string): GuestRole[] {
  return (ENTOURAGE_ROLES as readonly GuestRole[]).filter(
    (role) => roleGroupOf(role) === view,
  );
}

/**
 * Which printed groups this dashboard view should offer to arrange.
 *
 * 🔑 "ALL" MEANS THE WHOLE PROCESSIONAL, and that is the fix for a real defect:
 * the panel used to render ONLY under a role filter, so the one place a couple
 * can arrange who walks first was invisible unless they already knew to filter
 * first. Owner, 2026-09-20: *"where is the arranging? why do you not build
 * it?"* — it was built, and it was hidden, which from where he was standing is
 * the same thing.
 */
export function printedGroupsForView(view: string): string[] {
  if (!view || view === 'all') return ENTOURAGE_GROUP_LIST.map((g) => g.key);
  return [
    ...new Set(
      printedRolesForView(view)
        .map((r) => entourageGroupOfRole(r))
        .filter((k): k is string => Boolean(k)),
    ),
  ];
}

export async function EntourageOrderPanel({
  eventId,
  view,
}: {
  eventId: string;
  view: string;
}) {
  // The early return was the bug: under "All" this asked for ROLES, got none,
  // and rendered nothing — hiding the only way to arrange the processional.
  const groupKeys = printedGroupsForView(view);
  if (groupKeys.length === 0) return null;

  const supabase = await createClient();
  /*
    ⚖ Owner 2026-09-21: the couple arranges the SECTIONS too. Read on its own:
    an unreadable arrangement prints the built-in order and hides the section
    arrows (moving from an order we could not read would overwrite the one the
    couple actually has) — it never hides the entourage.
  */
  const sectionRead = await supabase
    .from('events')
    .select('entourage_section_order')
    .eq('event_id', eventId)
    .maybeSingle();
  if (sectionRead.error) {
    logQueryError('EntourageOrderPanel (section order)', sectionRead.error, { eventId });
  }
  const savedSections = sectionRead.error
    ? null
    : ((sectionRead.data as { entourage_section_order: string[] | null } | null)
        ?.entourage_section_order ?? null);
  const canArrangeSections = !sectionRead.error && (!view || view === 'all');

  const { data, error } = await supabase
    .from('guests')
    // The only reader of `ceremonyOnly`, so the only read that asks for the
    // column it needs — never by widening the shared list (see its note).
    .select(`${ENTOURAGE_COLUMNS}, invited_to_blocks`)
    .eq('event_id', eventId)
    .is('deleted_at', null);

  /*
    🔑 A REFUSED READ MUST NOT RENDER AS AN EMPTY ENTOURAGE. `data ?? []` on a
    failed query would draw "Nobody in this role yet" to a couple with twelve
    ninongs — the exact class of defect the 2026-08-19 sweep existed to remove.
    Say the read failed, and say nothing about who is in the list.
  */
  if (error) {
    logQueryError('EntourageOrderPanel (guests)', error, { eventId, view });
    return (
      <section className="mb-4 rounded-xl border border-danger-200 bg-danger-50/60 px-4 py-3 text-sm text-danger-900">
        The walking order could not be loaded just now, so it is not shown. Your
        entourage is unchanged — reload to try again.
      </section>
    );
  }

  const rows = (data ?? []) as EntourageGuestRow[];

  /*
    ⚖ OWNER 2026-09-20: "the pair collapses to ONE line only in the walking-order
    panel and the printed processional." So this panel lists LINES, not people —
    `entourageLines` is the same function the invitation prints from and the
    same one Move ↑ acts on, which is the only way "move this pair up" can mean
    the same thing on all three.
  */
  const lists = orderedGroupKeys(savedSections)
    .filter((key) => groupKeys.includes(key))
    .map((key) => ({ key, lines: entourageLines(rows, key) }))
    .filter((l) => l.lines.length > 0);

  if (lists.length === 0) return null;

  const anyPlaced = lists.some((l) =>
    l.lines.some((ln) => ln.some((half) => typeof half?.order === 'number')),
  );

  return (
    <section className="mb-4 rounded-xl border border-ink/10 bg-white/70 px-4 py-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink/55">
          Wedding March
        </h2>
        <p className="text-xs text-ink/55">
          The order your invitation prints them in. A pair is one line.{' '}
          {anyPlaced
            ? 'You have arranged these yourself.'
            : 'Arranged by surname until you change it.'}
        </p>
      </header>

      {canArrangeSections && sectionsAreArranged(savedSections) ? (
        <form action={resetEntourageSections.bind(null, eventId)} className="mt-2">
          <SubmitButton
            className="text-[11px] text-ink/45 underline-offset-2 hover:text-ink/70 hover:underline"
            pendingLabel="Resetting…"
            overlay={false}
          >
            Put the sections back in the usual order
          </SubmitButton>
        </form>
      ) : null}

      <div className="mt-3 space-y-4">
        {lists.map(({ key, lines }, sectionIndex) => (
          <div key={key}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-center gap-1">
                {canArrangeSections && lists.length > 1 ? (
                  <span className="inline-flex">
                    <SectionMoveButton
                      eventId={eventId}
                      groupKey={key}
                      label={entourageGroupLabel(key) ?? key}
                      direction="up"
                      disabled={sectionIndex === 0}
                    />
                    <SectionMoveButton
                      eventId={eventId}
                      groupKey={key}
                      label={entourageGroupLabel(key) ?? key}
                      direction="down"
                      disabled={sectionIndex === lists.length - 1}
                    />
                  </span>
                ) : null}
                <h3 className="text-xs font-medium text-ink/70">
                  {entourageGroupLabel(key) ?? key}
                </h3>
              </div>
              {lines.some((ln) => ln.some((h) => typeof h?.order === 'number')) ? (
                <form action={clearEntourageOrder.bind(null, eventId, key)}>
                  <SubmitButton
                    className="text-[11px] text-ink/45 underline-offset-2 hover:text-ink/70 hover:underline"
                    pendingLabel="Resetting…"
                    overlay={false}
                  >
                    Reset
                  </SubmitButton>
                </form>
              ) : null}
            </div>

            <WalkingOrderLines
              eventId={eventId}
              groupKey={key}
              groupLabel={entourageGroupLabel(key) ?? key}
              lines={lines.map((line, i) => ({
                leadId: line[0]?.id ?? line[1]?.id ?? `${key}-${i}`,
                cells: [<LineCell key="l" half={line[0]} />, <LineCell key="r" half={line[1]} />],
                label: [line[0]?.name, line[1]?.name].filter(Boolean).join(' and ') || 'Blank line',
                slots: [slotFor(lines, key, line, 0), slotFor(lines, key, line, 1)],
              }))}
            >
              {lines.map((line, i) => (
                /* The always-available path — plain forms, no JavaScript
                   required. The drag layer above never replaces these. */
                <span key={line[0]?.id ?? line[1]?.id ?? i} className="inline-flex">
                  <MoveButton
                    eventId={eventId}
                    guestId={line[0]?.id ?? line[1]?.id ?? null}
                    groupKey={key}
                    direction="up"
                    disabled={i === 0}
                  />
                  <MoveButton
                    eventId={eventId}
                    guestId={line[0]?.id ?? line[1]?.id ?? null}
                    groupKey={key}
                    direction="down"
                    disabled={i === lines.length - 1}
                  />
                </span>
              ))}
            </WalkingOrderLines>
          </div>
        ))}
      </div>

      <p className="mt-3 border-t border-ink/5 pt-2 text-[11px] text-ink/45">
        Order is the line&rsquo;s; a chair is the person&rsquo;s — the seat plan is untouched.
      </p>
    </section>
  );
}

/**
 * What one cell of a line can do — asked of `lib/march-moves.ts`, the rule the
 * server action asks again before it writes. Computed HERE, on the server, so
 * the client island is handed answers and never re-derives a rule.
 */
function slotFor(
  lines: readonly EntourageRow[],
  groupKey: string,
  line: EntourageRow,
  col: 0 | 1,
): MarchSlot {
  const half = line[col];
  if (half?.id) {
    return { kind: 'name', id: half.id, name: half.name, swapWith: swapsFor(lines, groupKey, half.id) };
  }
  // An empty place always sits beside somebody: a line with nobody on it is
  // never built.
  const anchor = line[col === 0 ? 1 : 0];
  return {
    kind: 'empty',
    anchorId: anchor?.id ?? '',
    anchorName: anchor?.name ?? '',
    joiners: anchor?.id ? joinersFor(lines, groupKey, anchor.id) : [],
  };
}

/**
 * One half of a printed line.
 *
 * ⚖ A BLANK STAYS BLANK (owner 2026-09-14): an unpartnered name keeps its line
 * and leaves the other side empty, rather than being tidied up against somebody
 * it does not walk with.
 */
function LineCell({ half }: { half: EntourageRow[number] }) {
  if (!half) {
    return <span aria-label="left blank" className="min-w-0 truncate text-ink/25">—</span>;
  }
  return (
    <span className="min-w-0 truncate">
      <span className="text-ink">{half.name}</span>{' '}
      <span className="text-[11px] text-ink/45">
        {roleLabel(half.role) ?? half.role}
        {half.ceremonyOnly ? ' · ceremony only' : ''}
      </span>
    </span>
  );
}

/**
 * Move a whole SECTION (Parents, Immediate Family, …) up or down.
 *
 * ⚖ Owner 2026-09-21. A plain form, like the line arrows: works on a phone,
 * with JavaScript off, and by keyboard. The first/last section keeps a
 * disabled arrow so the heading does not shift sideways.
 */
function SectionMoveButton({
  eventId,
  groupKey,
  label,
  direction,
  disabled,
}: {
  eventId: string;
  groupKey: string;
  label: string;
  direction: 'up' | 'down';
  disabled: boolean;
}) {
  const Icon = direction === 'up' ? ArrowUp : ArrowDown;
  if (disabled) {
    return (
      <span aria-hidden className="inline-flex h-6 w-6 items-center justify-center text-ink/15">
        <Icon className="h-3 w-3" strokeWidth={2} />
      </span>
    );
  }
  return (
    <form action={moveEntourageSection.bind(null, eventId, groupKey, direction)}>
      <SubmitButton
        className="inline-flex h-6 w-6 items-center justify-center rounded text-ink/45 hover:bg-ink/5 hover:text-ink"
        aria-label={`Move the ${label} section ${direction}`}
        pendingLabel=""
        overlay={false}
      >
        <Icon className="h-3 w-3" strokeWidth={2} />
      </SubmitButton>
    </form>
  );
}

function MoveButton({
  eventId,
  guestId,
  groupKey,
  direction,
  disabled,
}: {
  eventId: string;
  guestId: string | null;
  groupKey: string;
  direction: 'up' | 'down';
  disabled: boolean;
}) {
  const Icon = direction === 'up' ? ArrowUp : ArrowDown;
  // The end of the list keeps a disabled control rather than none, so the
  // buttons do not shuffle sideways as the order changes — the one thing that
  // would make a column of arrows hard to use with a thumb.
  if (!guestId || disabled) {
    return (
      <span
        aria-hidden
        className="inline-flex h-7 w-7 flex-none items-center justify-center rounded text-ink/15"
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    );
  }
  return (
    <form action={moveInEntourageOrder.bind(null, eventId, guestId, groupKey, direction)}>
      <SubmitButton
        className="inline-flex h-7 w-7 flex-none items-center justify-center rounded text-ink/45 hover:bg-ink/5 hover:text-ink"
        aria-label={`Move this line ${direction}`}
        pendingLabel=""
        overlay={false}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </SubmitButton>
    </form>
  );
}
