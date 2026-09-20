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
import { createClient } from '@/lib/supabase/server';
import {
  ENTOURAGE_COLUMNS,
  ENTOURAGE_ROLES,
  holdersOfRoleInPrintOrder,
  roleLabel,
  type EntourageGuestRow,
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

export async function EntourageOrderPanel({
  eventId,
  view,
}: {
  eventId: string;
  view: string;
}) {
  const roles = printedRolesForView(view);
  if (roles.length === 0) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('guests')
    .select(ENTOURAGE_COLUMNS)
    .eq('event_id', eventId)
    .is('deleted_at', null);

  /*
    🔑 A REFUSED READ MUST NOT RENDER AS AN EMPTY ENTOURAGE. `data ?? []` on a
    failed query would draw "Nobody in this role yet" to a couple with twelve
    ninongs — the exact class of defect the 2026-08-19 sweep existed to remove.
    Say the read failed, and say nothing about who is in the list.
  */
  if (error) {
    return (
      <section className="mb-4 rounded-xl border border-danger-200 bg-danger-50/60 px-4 py-3 text-sm text-danger-900">
        The walking order could not be loaded just now, so it is not shown. Your
        entourage is unchanged — reload to try again.
      </section>
    );
  }

  const rows = (data ?? []) as EntourageGuestRow[];
  const lists = roles
    .map((role) => ({ role, people: holdersOfRoleInPrintOrder(rows, role) }))
    .filter((l) => l.people.length > 0);

  if (lists.length === 0) return null;

  const anyPlaced = lists.some((l) =>
    l.people.some((p) => typeof p.entourage_order === 'number'),
  );

  return (
    <section className="mb-4 rounded-xl border border-ink/10 bg-white/70 px-4 py-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink/55">
          Walking order
        </h2>
        <p className="text-xs text-ink/55">
          The order your invitation prints them in.{' '}
          {anyPlaced
            ? 'You have arranged these yourself.'
            : 'Arranged by surname until you change it.'}
        </p>
      </header>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {lists.map(({ role, people }) => (
          <div key={role}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-medium text-ink/70">
                {roleLabel(role) ?? ROLE_LABELS[role]}
              </h3>
              {/* Only offered once there is something to undo — a "reset" on an
                  order nobody set is a button that cannot do anything. */}
              {people.some((p) => typeof p.entourage_order === 'number') ? (
                <form action={clearEntourageOrder.bind(null, eventId, role)}>
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

            <ol className="mt-1.5 space-y-1">
              {people.map((person, i) => (
                <li
                  key={person.guest_id ?? `${role}-${i}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-sm odd:bg-ink/[0.02]"
                >
                  <span className="w-5 flex-none font-mono text-[11px] text-ink/40">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {guestFullName(person as never) ?? '—'}
                  </span>
                  <MoveButton
                    eventId={eventId}
                    guestId={person.guest_id}
                    role={role}
                    direction="up"
                    disabled={i === 0}
                  />
                  <MoveButton
                    eventId={eventId}
                    guestId={person.guest_id}
                    role={role}
                    direction="down"
                    disabled={i === people.length - 1}
                  />
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function MoveButton({
  eventId,
  guestId,
  role,
  direction,
  disabled,
}: {
  eventId: string;
  guestId: string | null | undefined;
  role: GuestRole;
  direction: 'up' | 'down';
  disabled: boolean;
}) {
  const Icon = direction === 'up' ? ArrowUp : ArrowDown;
  // The end of the list renders a DISABLED control rather than no control, so
  // the row keeps its shape and the buttons do not shuffle sideways as the
  // order changes — which is the one thing that would make a list of arrows
  // hard to use with a thumb.
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
    <form action={moveInEntourageOrder.bind(null, eventId, guestId, role, direction)}>
      <SubmitButton
        className="inline-flex h-7 w-7 flex-none items-center justify-center rounded text-ink/45 hover:bg-ink/5 hover:text-ink"
        aria-label={`Move ${direction}`}
        // Empty label leaves the spinner with an sr-only "Working…", which is
        // right for a 28px icon button. `overlay={false}` because veiling the
        // whole screen to move one name up one place is a bigger interruption
        // than the thing it is reporting.
        pendingLabel=""
        overlay={false}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </SubmitButton>
    </form>
  );
}
