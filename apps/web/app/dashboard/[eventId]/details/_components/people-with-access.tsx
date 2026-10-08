'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserMinus } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SubmitButton } from '@/app/_components/submit-button';
import { AREA_LEVEL_WORD, DELEGATE_AREA_DOES, type AreaChoice } from '@/lib/delegate-areas';
import { ACCESS_LEVEL_LABEL, accessWordFor, type GuestAccessLevel } from '@/lib/guest-access';
import {
  ACCESS_GROUPS,
  AREA_TOGGLE_ORDER,
  COORDINATOR_SWITCH_LABEL,
  COORDINATOR_SWITCH_WHY,
  FIXED_AREA_WHY,
  SUPPLIERS_BY_CATEGORY,
  accessGroupOf,
  coordinatorHasHostAccess,
  coordinatorSwitchWrites,
  type AreaCell,
  type PersonRow,
} from '@/lib/people-with-access';
import { setDelegateArea, removeHost } from '@/app/dashboard/[eventId]/hosts/actions';
import { setGuestAccess } from '@/app/dashboard/[eventId]/guests/[guestId]/access-actions';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';

/**
 * people-with-access.tsx — Event Details › PEOPLE WITH ACCESS (owner
 * 2026-10-03): one row per person who can open this event — co-hosts, the
 * coordinator, the helpers, each booked supplier. (2026-10-07: a helper's
 * areas are now a three-way toggle and the coordinator one switch — below.)
 *
 * 🔑 THE ONE HOME FOR SETTING ACCESS. The guest list's Access column, the guest
 * card, the planner's supplier workspace and Access requests now SHOW access
 * and link here; none of them sets it. Every write goes through the actions
 * that already enforced it — `setGuestAccess` (who is a co-host / helper) and
 * `setDelegateArea` (one area of one seat) — and every level is read back by
 * the readers that enforce it (`moderator_area_level`), so this section can
 * never promise a door the database leaves open.
 *
 * A pick shows at once and saves behind (≤100 ms per tap); a refusal puts the
 * old word back and says why, where the person tapped.
 *
 * 📁 ITS OWN FOLD, IN FOUR GROUPS (owner 2026-10-07, on his phone: *"the
 * Event Access is not here: Host: Helper: Vendors: and toggles on what they
 * can access?"* · *"Coordinator Access? Booked Vendor Access?"*). Event
 * Details › EVENT ACCESS — after Guests & money, before Put this away — with
 * plain headings Hosts · Coordinator · Helpers · Booked suppliers
 * (`ACCESS_GROUPS`). Plain rows and dividers like every other fold: no box of
 * its own (the fold is the tile).
 *   · HELPER — per area: name + ⓘ, then ONE three-way toggle Edit · Off · View.
 *   · COORDINATOR — ONE switch, "Same access as you", ON by default.
 *   · BOOKED SUPPLIER — name and category; what they see is set by their
 *     category (`SUPPLIERS_BY_CATEGORY`); nothing to switch.
 */

const REASONS: PickOption[] = [
  { key: 'no_longer_availing', label: 'No longer availing their services' },
  { key: 'abuse_misuse', label: 'Abuse / misuse' },
  { key: 'new_coordinator', label: 'We have a new coordinator' },
  { key: 'other', label: 'Other' },
];

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * 🎚 ONE AREA'S THREE-WAY TOGGLE (owner 2026-10-07: *"no edit. Guestlist (i)
 * toggle. so it is easy to control"* → *"3 way toggle Edit - OFF - View"*) —
 * Edit · Off · View, Off in the middle, one segmented switch. This OVERRIDES
 * the standing "any set of choices is a dropdown" rule for this control only.
 * A position the area cannot take (Budget / Photos never Edit) is drawn and
 * disabled; a fixed area (Event Hub, Mood Board) is drawn at its value,
 * disabled, with an ⓘ saying why.
 */
function AreaToggle({
  label,
  choice,
  choices,
  disabled,
  onPick,
}: {
  label: string;
  choice: AreaChoice;
  choices: readonly AreaChoice[] | null;
  disabled: boolean;
  onPick: (next: AreaChoice) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-10 shrink-0 rounded-full bg-ink/[0.06] p-0.5" data-area-toggle="">
      {AREA_TOGGLE_ORDER.map((pos) => {
        const on = pos === choice;
        const can = !disabled && (choices?.includes(pos) ?? false);
        return (
          <button
            key={pos}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={!can && !on}
            aria-disabled={!can}
            onClick={() => (can && !on ? onPick(pos) : undefined)}
            className={`h-full min-h-0 min-w-[3.25rem] rounded-full px-2.5 text-[12.5px] transition-colors ${
              on ? 'bg-ink font-semibold text-cream' : can ? 'text-ink/70 hover:text-ink' : 'text-ink/30'
            } ${on && !can ? 'opacity-60' : ''}`}
            data-area-pos={pos}
          >
            {AREA_LEVEL_WORD[pos]}
          </button>
        );
      })}
    </div>
  );
}

function AreaPicks({
  eventId,
  row,
  readOnly,
}: {
  eventId: string;
  row: PersonRow & { areas: AreaCell[] };
  readOnly: boolean;
}) {
  const [shown, setShown] = useState<Record<string, AreaChoice>>(() =>
    Object.fromEntries(row.areas.map((c) => [c.area, c.choice])),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const pick = (cell: AreaCell, next: AreaChoice) => {
    const before = shown[cell.area];
    if (next === before || !row.moderatorId) return;
    setShown((s) => ({ ...s, [cell.area]: next }));
    setError(null);
    const moderatorId = row.moderatorId;
    startTransition(async () => {
      const res = await setDelegateArea(eventId, moderatorId, cell.area, next);
      if (!res.ok) {
        setShown((s) => ({ ...s, [cell.area]: before as AreaChoice }));
        setError(res.error);
      }
    });
  };

  return (
    <div className="space-y-1">
      <ul className="divide-y divide-ink/5" data-person-areas="">
        {row.areas.map((cell) => {
          const choice = row.ended ? 'off' : (shown[cell.area] ?? cell.choice);
          const fixed = !cell.choices;
          return (
            <li key={cell.area} className="flex min-h-11 items-center justify-between gap-3 py-1" data-area={cell.area}>
              <InfoTip
                label={cell.label}
                ariaLabel={`What ${cell.label} lets them do`}
                labelClassName="text-[13px] text-ink/75"
                align="start"
                className="inline-flex min-w-0 items-center gap-1"
              >
                {fixed ? `${DELEGATE_AREA_DOES[cell.area]} ${FIXED_AREA_WHY}` : DELEGATE_AREA_DOES[cell.area]}
              </InfoTip>
              <AreaToggle
                label={`${row.name} · ${cell.label}`}
                choice={choice}
                choices={cell.choices}
                disabled={readOnly || fixed || row.ended}
                onPick={(next) => pick(cell, next)}
              />
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-xs text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * 🔀 THE COORDINATOR'S ONE SWITCH — "Same access as you" (owner 2026-10-07).
 * ON (the default every coordinator seat is created with) = Guest list · Seat
 * plan · The Day · Suppliers at Edit; OFF = every settable area Off — what
 * they received as a booked supplier stays. Each flip is the per-area writes
 * `coordinatorSwitchWrites` names, through the SAME `setDelegateArea`; a
 * refusal puts the switch back, says why, and re-reads what actually landed.
 */
function CoordinatorSwitch({ eventId, row, readOnly }: { eventId: string; row: PersonRow; readOnly: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(() => coordinatorHasHostAccess(row.areas));
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  if (!row.areas || !row.moderatorId) return null;
  const cells = row.areas;
  const moderatorId = row.moderatorId;
  const flip = () => {
    const next = !on;
    setOn(next);
    setError(null);
    startTransition(async () => {
      for (const w of coordinatorSwitchWrites(cells, next)) {
        const res = await setDelegateArea(eventId, moderatorId, w.area, w.choice);
        if (!res.ok) {
          setOn(!next);
          setError(res.error);
          router.refresh();
          return;
        }
      }
      router.refresh();
    });
  };
  const locked = readOnly || row.ended || busy;
  return (
    <div className="space-y-1" data-coordinator-switch="">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <InfoTip
          label={COORDINATOR_SWITCH_LABEL}
          ariaLabel={`What ${COORDINATOR_SWITCH_LABEL} means`}
          labelClassName="text-[13px] text-ink/75"
          align="start"
          className="inline-flex min-w-0 items-center gap-1"
        >
          {COORDINATOR_SWITCH_WHY}
        </InfoTip>
        <span className="flex shrink-0 items-center gap-2 text-[12.5px] text-ink/60">
          {row.ended ? 'Off' : on ? 'On' : 'Off'}
          <button
            type="button"
            role="switch"
            aria-checked={on && !row.ended}
            aria-label={`${COORDINATOR_SWITCH_LABEL} — ${row.name}`}
            disabled={locked}
            onClick={flip}
            className={SWITCH_BUTTON}
          >
            <SwitchTrack on={on && !row.ended} />
          </button>
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AccessPick({ eventId, row }: { eventId: string; row: PersonRow }) {
  const router = useRouter();
  const [level, setLevel] = useState<GuestAccessLevel>(row.access?.level ?? 'none');
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  if (!row.access || !row.guestId) return null;
  const guestId = row.guestId;
  if (row.access.lock || row.isViewer) {
    return <span className="text-sm text-ink/60">{accessWordFor(row.access)}</span>;
  }
  const pick = (key: string) => {
    const next = key as GuestAccessLevel;
    if (next === level) return;
    const before = level;
    setLevel(next);
    setError(null);
    startTransition(async () => {
      const res = await setGuestAccess(eventId, guestId, next);
      if (res.ok) router.refresh();
      else {
        setLevel(before);
        setError(res.error);
      }
    });
  };
  return (
    <span className="flex flex-col items-end gap-0.5">
      <PickMenu
        label={`${row.name}'s access to this event`}
        value={level}
        options={(['co_host', 'limited_helper', 'none'] as const).map((k) => ({ key: k, label: ACCESS_LEVEL_LABEL[k] }))}
        onPick={pick}
        dataAttr="data-person-access-pick"
        compact
      />
      {error ? (
        <span role="alert" className="max-w-[16rem] text-right text-[11px] text-terracotta-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}

function RemoveCoordinator({ eventId, row }: { eventId: string; row: PersonRow }) {
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState(false);
  if (!row.moderatorId) return null;
  /* One "Remove…" on the row; the reason and the Remove that acts on it open
     on their own line under it, so the row never carries two cramped controls. */
  return (
    <>
      <button
        type="button"
        aria-expanded={asking}
        onClick={() => setAsking((v) => !v)}
        className="sn-press inline-flex min-h-11 shrink-0 items-center gap-1 text-[12.5px] text-ink/60 hover:text-terracotta-700"
        data-person-remove-open=""
      >
        <UserMinus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Remove…
      </button>
      {asking ? (
        <form action={removeHost} className="flex basis-full flex-wrap items-center gap-2" data-person-remove="">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="moderator_id" value={row.moderatorId} />
          <input type="hidden" name="return_to" value="details" />
          <input type="hidden" name="reason" value={reason} />
          <PickMenu
            label={`Why ${row.name} is leaving`}
            value={reason}
            options={REASONS}
            onPick={setReason}
            buttonText={reason ? undefined : 'Reason…'}
            dataAttr="data-person-remove-reason"
            compact
          />
          <SubmitButton
            pendingLabel="Removing…"
            disabled={!reason}
            overlay={false}
            className="text-[12.5px] text-terracotta-700 underline hover:text-terracotta-800 disabled:text-ink/35 disabled:no-underline"
          >
            Remove {row.name}
          </SubmitButton>
        </form>
      ) : null}
    </>
  );
}

function AddPerson({ eventId, addable }: { eventId: string; addable: { guestId: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [adding, startTransition] = useTransition();
  if (addable.length === 0) return null;
  const pick = (guestId: string) => {
    setError(null);
    startTransition(async () => {
      // A new person starts as a limited helper — View on every area — and the
      // host raises what they need, area by area, on the row that appears.
      const res = await setGuestAccess(eventId, guestId, 'limited_helper');
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  };
  return (
    <div className="flex flex-col items-start gap-1 pt-1" data-person-add="">
      <PickMenu
        label="Add a person from your guest list"
        value=""
        options={addable.map((g) => ({ key: g.guestId, label: g.name }))}
        onPick={pick}
        buttonText={adding ? 'Adding…' : 'Add a person'}
        dataAttr="data-person-add-pick"
      />
      {error ? (
        <p role="alert" className="text-xs text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PersonItem({ eventId, row, readOnly }: { eventId: string; row: PersonRow; readOnly: boolean }) {
  return (
    <li className="space-y-2 py-3" data-person={row.kind}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {row.name}
            {row.isViewer ? <span className="font-normal text-ink/50"> · you</span> : null}
          </p>
          <p className="text-[12px] text-ink/55">
            {row.roleWord}
            {row.kind === 'co_host' ? ' · every part, Edit' : ''}
            {!row.live ? ' · waiting to join' : ''}
            {row.ended ? ' · access ended' : row.lastDay ? ` · until ${dayLabel(row.lastDay)}` : ''}
          </p>
        </div>
        {readOnly ? null : row.kind === 'coordinator' && !row.isViewer ? (
          <RemoveCoordinator eventId={eventId} row={row} />
        ) : row.kind === 'supplier' && row.canInviteAsCoordinator && row.vendorId ? (
          <Link
            href={`/dashboard/${eventId}/vendors/${row.vendorId}/workspace?tab=details#promote-coordinator`}
            className="shrink-0 text-[12.5px] font-medium text-terracotta underline-offset-2 hover:underline"
          >
            Invite as coordinator
          </Link>
        ) : (
          <AccessPick eventId={eventId} row={row} />
        )}
      </div>
      {row.kind === 'coordinator' && !row.isViewer ? (
        <CoordinatorSwitch eventId={eventId} row={row} readOnly={readOnly} />
      ) : row.areas ? (
        <AreaPicks eventId={eventId} row={{ ...row, areas: row.areas }} readOnly={readOnly || row.isViewer} />
      ) : null}
    </li>
  );
}

export function PeopleWithAccess({
  eventId,
  rows,
  addable,
  readOnly,
  failed,
  flash,
}: {
  eventId: string;
  rows: PersonRow[];
  addable: { guestId: string; name: string }[];
  /** A delegate looking at their own access: words, never dropdowns. */
  readOnly: boolean;
  /** The reads failed — say so, never "nobody else has access". */
  failed: boolean;
  flash: string | null;
}) {
  return (
    <div id="people-with-access" className="scroll-mt-20" data-section="access">
      <p className="pb-1 text-[12.5px] text-ink/60">Who can open this event, and what each person can change.</p>
      {flash ? (
        <p role="status" className="mb-2 text-xs text-ink/70">
          {flash}
        </p>
      ) : null}
      {failed ? (
        <p className="py-2.5 text-sm text-terracotta-700" data-person-refused="">
          We could not load who has access just now. Reload to try again.
        </p>
      ) : (
        <div className="pt-1">
          {ACCESS_GROUPS.map((g) => {
            const inGroup = rows.filter((r) => accessGroupOf(r.kind) === g.key);
            // A delegate sees only their own row — draw only the group it is in.
            if (readOnly && inGroup.length === 0) return null;
            return (
              <div key={g.key} className="border-t border-ink/10 pt-3 first:border-t-0 first:pt-0" data-access-group={g.key}>
                <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink/60">{g.title}</h3>
                {g.key === 'suppliers' && inGroup.length > 0 ? (
                  <p className="pt-1 text-[12px] text-ink/55">{SUPPLIERS_BY_CATEGORY}</p>
                ) : null}
                {inGroup.length === 0 ? (
                  <p className="py-2.5 text-sm text-ink/55">{g.empty}</p>
                ) : (
                  <ul className="divide-y divide-ink/5">
                    {inGroup.map((row) => (
                      <PersonItem key={row.key} eventId={eventId} row={row} readOnly={readOnly} />
                    ))}
                  </ul>
                )}
                {g.key === 'helpers' && !readOnly ? <AddPerson eventId={eventId} addable={addable} /> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
