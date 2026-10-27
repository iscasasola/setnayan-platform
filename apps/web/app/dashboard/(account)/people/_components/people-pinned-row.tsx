'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, UserPlus } from 'lucide-react';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { PinnedRow, type PinnedDoor } from '@/app/_components/pinned-row/pinned-row';
import { SwitchRow } from '@/app/_components/form-row';
import { PINNED_FACE_LABEL, peopleViewHref, type PeopleView, type PeopleViewGates, type PinnedFace } from '@/lib/people-views';
import { updateDiscoverableByName } from '../../profile/actions';

/**
 * people-pinned-row.tsx — 📌 THE PEOPLE PAGE'S ONE PINNED ROW (owner 2026-10-28, DECISION_LOG "USER DASHBOARD PART 1 —
 * PEOPLE & GROUPS — APPROVED", *"People and Groups approved. Send it to the build screen"*; the 27 Oct template
 * "THE PINNED ROW IS THE APP-WIDE TEMPLATE"; prototype `prototypes/user_dash_2026-10-28/` frames B–D).
 *
 * ONE 44-px row, sticky, left → right:
 *   · the EXISTING view picker (`lib/people-views.ts`, the shared `PickMenu`) shown as "People ▾" / "Groups ▾";
 *   · the page's live counts as FILTER DOORS — People: connected · asking you; Groups: groups · with stories;
 *   · ONE action — Invite on People (the shipped invite sheet), ＋ New on Groups (the page that already creates one);
 *   · ⚙ People settings at the right end — the shipped `MenuSettingsButton`, mounted HERE ONLY, so both faces share
 *     one door (`every-menu-has-one-settings-button.test.ts` counts one site).
 *
 * The row itself is the app's SHARED `PinnedRow` (`app/_components/pinned-row/pinned-row.tsx`) — this file only says
 * what People puts in it. Same box at rest and pinned, so nothing under it jumps.
 * 🔒 people/the-people-pinned-row.test.ts
 */

export type PinDoor = PinnedDoor;

export type PinAction = { kind: 'invite'; onTap: () => void } | { kind: 'new-group' };

/** People settings' one row, read on the server. null = the read was refused — said, never drawn as "off". */
export type PeopleSettings = { findable: boolean | null };

export function PeoplePinnedRow({
  face,
  view,
  options,
  gates,
  doors,
  note = null,
  action,
  settings,
  tour,
}: {
  face: PinnedFace;
  /** 🔦 The spotlight anchor on the doors (`people-counts` on the People face). */
  tour?: string;
  /** The view the picker shows as picked. */
  view: PeopleView;
  /** `pinnedViewOptions(…)` — People · Groups · Following · Followers · Loved ones. */
  options: readonly PickOption[];
  gates: PeopleViewGates;
  doors: readonly PinnedDoor[];
  /** Said in the doors' place when there is nothing to count ("Nobody yet", a refusal). */
  note?: string | null;
  action: PinAction;
  settings: PeopleSettings;
}) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <PinnedRow
      data={{ 'data-people-pin': face }}
      picker={{
        label: 'People — show',
        value: view,
        buttonText: PINNED_FACE_LABEL[face],
        options,
        onPick: (k) => router.push(peopleViewHref(k as PeopleView, gates)),
      }}
      doors={doors}
      note={note}
      doorsTour={tour}
      action={
        action.kind === 'invite'
          ? { label: 'Invite', icon: UserPlus, mark: 'invite', onTap: action.onTap, dialog: true }
          : { label: 'New', icon: Plus, ariaLabel: 'New group', mark: 'new-group', href: '/dashboard/samahan/new' }
      }
      gear={
        <MenuSettingsButton menu="people" open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PeopleSettingsRows settings={settings} />
        </MenuSettingsButton>
      }
    />
  );
}

/**
 * People settings — "Can people find you by name?", the People search's own switch (`users.discoverable_by_name`),
 * the same writer the profile's Privacy section posts to. It saves in place (`stay=people`): the sheet stays open.
 */
function PeopleSettingsRows({ settings }: { settings: PeopleSettings }) {
  const [on, setOn] = useState(settings.findable);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => setOn(settings.findable), [settings.findable]);
  if (on === null) {
    return (
      <p role="status" className="px-4 py-4 text-sm text-ink/65" data-people-settings="refused">
        We couldn’t read your People settings just now. Nothing is changed — refresh in a moment.
      </p>
    );
  }
  return (
    <div className="px-4 pb-4" data-people-settings="">
      <SwitchRow
        name="Can people find you by name?"
        about={{ words: 'They see your name and photo — never your email, phone or events — and nothing connects until you confirm. Off: only someone with your email can add you.' }}
        on={on}
        disabled={pending}
        data="people-findable"
        onChange={(next) => {
          setOn(next);
          setError(null);
          const fd = new FormData();
          fd.set('discoverable_by_name', next ? 'true' : 'false');
          fd.set('stay', 'people');
          start(async () => {
            try {
              await updateDiscoverableByName(fd);
            } catch {
              setOn(!next);
              setError('That didn’t save — try again in a moment.');
            }
          });
        }}
      />
      {error ? (
        <p role="alert" className="pt-2 text-[13px] text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
