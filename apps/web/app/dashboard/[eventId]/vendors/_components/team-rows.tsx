/**
 * TeamRows — the top of Your Team on a phone: who is booked, and the ONE thing
 * each of them needs next (owner-APPROVED 2026-10-01, prototype frame 4
 * "Your Team"; DECISION_LOG "THE SIMPLE PHONE APP — APPROVED").
 *
 * A SERVER component on purpose: the shared client bundle is at its limit, so
 * the rows are plain HTML and links. The only client island is the shipped
 * `AccordionLockButton` — the one lock path (conflict gate, date-lock modal,
 * handshake) — which this route already ships for the Picks list. Never write a
 * second lock path.
 *
 * Every word a row says comes from `lib/your-team-rows.ts`; this file only
 * draws it. Three states, never confused for each other:
 *   · `unreadable` — the read was refused → "Couldn't load your team", Try again.
 *   · rows empty   — a real, measured empty team → "No one on your team yet."
 *   · rows         — booked first, one next step each.
 */
import Link from 'next/link';
import { AccordionLockButton } from './accordion-lock';
import { teamCountsLine, type TeamRow, type TeamRowTone } from '@/lib/your-team-rows';
import { formatCount } from '@/lib/format-number';
import type { PlanGroupId } from '@/lib/wedding-plan-groups';

const PILL_TONE: Record<TeamRowTone, string> = {
  ok: 'bg-success-50 text-success-700',
  warn: 'bg-warn-50 text-warn-800',
  soft: 'bg-ink/5 text-ink/70',
  no: 'bg-danger-50 text-danger-700',
};

/** The row's one action — a quiet mulberry word with a chevron, as drawn. */
const GO_CLASS =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-1.5 py-1 text-[12.5px] font-semibold text-mulberry transition hover:bg-mulberry/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry';

export type TeamRowsState =
  | { kind: 'unreadable'; retryHref: string }
  | { kind: 'rows'; rows: readonly TeamRow[] };

export function TeamRows({ eventId, state }: { eventId: string; state: TeamRowsState }) {
  if (state.kind === 'unreadable') {
    return (
      <div data-team-rows="unreadable" role="alert" className="py-2">
        <p className="text-sm font-semibold text-ink">Couldn’t load your team</p>
        <p className="mt-1 text-[12.5px] text-ink/60">
          This is a loading problem, not an empty team.
        </p>
        <Link href={state.retryHref} className={`${GO_CLASS} mt-2 -ml-1.5`}>
          Try again ›
        </Link>
      </div>
    );
  }

  const { rows } = state;
  if (rows.length === 0) {
    return (
      <p data-team-rows="empty" className="text-[12.5px] text-ink/60">
        No one on your team yet.
      </p>
    );
  }

  const counts = teamCountsLine(rows);
  return (
    <div data-team-rows="rows">
      <p className="text-[12.5px] text-ink/60">
        {formatCount(counts.booked)} booked
        {counts.needYou > 0 ? (
          <>
            {' · '}
            <span className="font-semibold text-mulberry">{formatCount(counts.needYou)} need you</span>
          </>
        ) : null}
      </p>
      <ul className="mt-2 space-y-2">
        {rows.map((r) => (
          <li
            key={r.vendorId}
            data-team-row={r.group}
            data-team-action={r.action?.kind ?? 'none'}
            className="sn-tile px-3 pb-2 pt-3"
          >
            <div className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-px flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-cream text-[11px] font-semibold tracking-[0.02em] text-ink/70 ring-1 ring-ink/10"
              >
                {r.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  r.initials
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-lg leading-tight text-ink">{r.name}</span>
                {r.service ? (
                  <span className="mt-0.5 block truncate text-xs text-ink/55">{r.service}</span>
                ) : null}
              </span>
              <span
                className={`mt-0.5 shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium leading-none ${PILL_TONE[r.pill.tone]}`}
              >
                {r.pill.text}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-2 border-t border-dashed border-ink/15 pt-1.5">
              <span className="min-w-0 flex-1 truncate text-xs text-ink/70">
                Next: <span className={r.needsYou ? 'font-semibold text-mulberry' : ''}>{r.next}</span>
              </span>
              <RowAction eventId={eventId} row={r} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RowAction({ eventId, row }: { eventId: string; row: TeamRow }) {
  const a = row.action;
  if (!a) return null;
  if (a.kind === 'lock') {
    return (
      <AccordionLockButton
        eventId={eventId}
        groupId={a.groupId as PlanGroupId}
        groupLabel={row.service ?? row.name}
        vendorId={row.vendorId}
        vendorName={row.name}
        label="Lock ›"
        pendingLabel="Locking…"
        className={GO_CLASS}
        wrapperClassName="shrink-0 text-right"
        isVerified={row.isVerified}
        source="your_team_row"
      />
    );
  }
  return (
    <Link href={a.href} className={GO_CLASS} prefetch={false}>
      {a.label} ›
    </Link>
  );
}
