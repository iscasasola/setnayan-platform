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
 *   · `unreadable` — the read was refused → "Couldn't load your suppliers", Try again.
 *   · rows empty   — a real, measured empty team → "No suppliers yet."
 *   · rows         — booked first, one next step each.
 */
import { BellRing, CalendarCheck, CreditCard, RotateCcw, Star, type LucideIcon } from 'lucide-react';
import { ActionButton, type ActionTone } from '@/components/action-button';
import { AccordionLockButton } from './accordion-lock';
import { GoToFind } from './go-to-find';
import { teamCountsLine, type TeamRow, type TeamRowAction, type TeamRowTone } from '@/lib/your-team-rows';
import { formatCount } from '@/lib/format-number';
import type { PlanGroupId } from '@/lib/wedding-plan-groups';

/** The status pill — flipping tokens only. The old `bg-success-50` /
 *  `text-success-700`-style washes are fixed hexes with no dark value, so they
 *  glared on the dark page (2026-10-12 look sweep, brief rule 3). */
const PILL_TONE: Record<TeamRowTone, string> = {
  ok: 'bg-[rgb(var(--color-ok)_/_0.12)] text-[rgb(var(--color-ok))]',
  warn: 'bg-[rgb(var(--color-warn)_/_0.12)] text-[rgb(var(--color-warn))]',
  soft: 'bg-ink/5 text-ink/70',
  no: 'bg-[rgb(var(--color-danger)_/_0.12)] text-[rgb(var(--color-danger))]',
};

/**
 * The row's one action — an ActionButton (2026-10-12 look sweep: was a
 * hand-drawn mulberry "Label ›" word). Tone and icon per verb, from the card's
 * own table (`lib/supplier-card-verbs.ts`: book/pay → ok, nudge → warn); it is
 * the row's filled main verb only when the row is waiting on the couple.
 */
const ACTION_LOOK: Record<Exclude<TeamRowAction['kind'], 'lock'>, { tone: ActionTone; icon: LucideIcon }> = {
  pay: { tone: 'ok', icon: CreditCard },
  nudge: { tone: 'warn', icon: BellRing },
  review: { tone: 'brand', icon: Star },
  check: { tone: 'ok', icon: CreditCard },
};

/** "Book" — the lock button wears the same look. Written out, not
 *  `actionButtonClass('ok', { main })`: this is a SERVER component and that
 *  helper lives in a 'use client' module, so calling it here would throw. */
// Every MAIN button is terracotta (owner 2026-10-12, look call 1); a secondary keeps the ok tone.
const lockClass = (main: boolean) => (main ? 'ab ab-brand ab-main' : 'ab ab-ok');

export type TeamRowsState =
  | { kind: 'unreadable'; retryHref: string }
  | { kind: 'rows'; rows: readonly TeamRow[] };

export function TeamRows({ eventId, state }: { eventId: string; state: TeamRowsState }) {
  if (state.kind === 'unreadable') {
    return (
      <div data-team-rows="unreadable" role="alert" className="py-2">
        <p className="text-sm font-semibold text-ink">Couldn’t load your suppliers</p>
        <p className="mt-1 text-[12.5px] text-ink/60">
          This is a loading problem — not an empty list.
        </p>
        <ActionButton
          href={state.retryHref}
          tone="neutral"
          icon={<RotateCcw aria-hidden strokeWidth={1.9} />}
          label="Try again"
          className="mt-3"
        />
      </div>
    );
  }

  const { rows } = state;
  if (rows.length === 0) {
    return (
      <div data-team-rows="empty">
        <p className="text-[12.5px] text-ink/60">No suppliers yet.</p>
        {/* The empty state gives the first action (2026-10-12 look sweep). */}
        <GoToFind className="mt-3" />
      </div>
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
            <span className="font-semibold text-sn-accent">{formatCount(counts.needYou)} need you</span>
          </>
        ) : null}
      </p>
      <ul className="mt-2">
        {rows.map((r) => (
          <li
            key={r.vendorId}
            data-team-row={r.group}
            data-team-action={r.action?.kind ?? 'none'}
            // Read, not pressed: no tile — each supplier ends in a divider; only
            // its action is a button (2026-10-12 look sweep).
            className="border-b border-ink/15 py-3"
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
            <div className="mt-2.5 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-xs text-ink/70">
                Next: <span className={r.needsYou ? 'font-semibold text-sn-accent' : ''}>{r.next}</span>
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
        label="Book"
        pendingLabel="Booking…"
        icon={<CalendarCheck aria-hidden strokeWidth={1.9} />}
        className={lockClass(row.needsYou)}
        // A column flex, not a block: a block wrapper adds a line-box strut that
        // made the Lock row taller than its Pay/Nudge siblings, and the button's
        // own "Verifying" / error lines still stack beneath it.
        wrapperClassName="flex shrink-0 flex-col items-end"
        isVerified={row.isVerified}
        source="your_team_row"
      />
    );
  }
  const look = ACTION_LOOK[a.kind];
  const Icon = look.icon;
  return (
    <ActionButton
      href={a.href}
      prefetch={false}
      // Every MAIN button is terracotta (owner 2026-10-12, look call 1).
      tone={row.needsYou ? 'brand' : look.tone}
      main={row.needsYou}
      icon={<Icon aria-hidden strokeWidth={1.9} />}
      label={a.label}
      name={`${a.label} — ${row.name}`}
      className="shrink-0"
    />
  );
}
