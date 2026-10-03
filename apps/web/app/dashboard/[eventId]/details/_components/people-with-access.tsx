'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SubmitButton } from '@/app/_components/submit-button';
import { AREA_LEVEL_WORD, type AreaChoice } from '@/lib/delegate-areas';
import { ACCESS_LEVEL_LABEL, type GuestAccessLevel } from '@/lib/guest-access';
import type { AreaCell, PersonRow } from '@/lib/people-with-access';
import { setDelegateArea, removeHost } from '@/app/dashboard/[eventId]/hosts/actions';
import { setGuestAccess } from '@/app/dashboard/[eventId]/guests/[guestId]/access-actions';

/**
 * people-with-access.tsx — Event Details › PEOPLE WITH ACCESS (owner
 * 2026-10-03): one row per person who can open this event — co-hosts, the
 * coordinator, the helpers, each booked supplier — and, for every delegate,
 * ONE dropdown per area: Edit · View · Off.
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

  const pick = (cell: AreaCell, key: string) => {
    const next = key as AreaChoice;
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
    <div className="space-y-1.5">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4" data-person-areas="">
        {row.areas.map((cell) => {
          const choice = shown[cell.area] ?? cell.choice;
          return (
            <div key={cell.area} className="min-w-0" data-area={cell.area}>
              <dt className="truncate text-[11.5px] text-ink/55">{cell.label}</dt>
              <dd>
                {readOnly || !cell.choices || row.ended ? (
                  <span className="text-sm text-ink/80" data-area-word="">
                    {row.ended ? AREA_LEVEL_WORD.off : AREA_LEVEL_WORD[choice]}
                  </span>
                ) : (
                  <PickMenu
                    label={`${row.name} · ${cell.label}`}
                    value={choice}
                    options={cell.choices.map((c) => ({ key: c, label: AREA_LEVEL_WORD[c] }))}
                    onPick={(key) => pick(cell, key)}
                    dataAttr="data-area-pick"
                    compact
                  />
                )}
              </dd>
            </div>
          );
        })}
      </dl>
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
    return <span className="text-sm text-ink/60">{ACCESS_LEVEL_LABEL[row.access.level]}</span>;
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
  if (!row.moderatorId) return null;
  return (
    <form action={removeHost} className="flex items-center gap-1.5" data-person-remove="">
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
        className="text-[12px] text-terracotta-700 underline hover:text-terracotta-800 disabled:text-ink/35 disabled:no-underline"
      >
        Remove
      </SubmitButton>
    </form>
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

export function PeopleWithAccess({
  eventId,
  title,
  rows,
  addable,
  readOnly,
  failed,
  flash,
}: {
  eventId: string;
  title: string;
  rows: PersonRow[];
  addable: { guestId: string; name: string }[];
  /** A delegate looking at their own access: words, never dropdowns. */
  readOnly: boolean;
  /** The reads failed — say so, never "nobody else has access". */
  failed: boolean;
  flash: string | null;
}) {
  return (
    <div id="people-with-access" className="sn-tile scroll-mt-20 p-4 sm:p-5" data-section="access">
      <h3 className="m-display-tight mb-1 text-base uppercase tracking-[0.02em] text-ink">{title}</h3>
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
        <ul className="divide-y divide-ink/5">
          {rows.map((row) => (
            <li key={row.key} className="space-y-2 py-3" data-person={row.kind}>
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
              {row.areas ? (
                <AreaPicks eventId={eventId} row={{ ...row, areas: row.areas }} readOnly={readOnly || row.isViewer} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {readOnly || failed ? null : <AddPerson eventId={eventId} addable={addable} />}
    </div>
  );
}
