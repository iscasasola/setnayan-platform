'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { SwitchRow } from '@/app/_components/form-row';
import { formatCount } from '@/lib/format-number';
import { PINNED_FACE_LABEL, peopleViewHref, type PeopleView, type PeopleViewGates, type PinnedFace } from '@/lib/people-views';
import { updateDiscoverableByName } from '../../profile/actions';
import ps from './people-screen.module.css';

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
 * The row is the same box at rest and pinned (the Suppliers row's rule — the row IS the pinned row), so nothing under
 * it jumps; once the page runs under it a hairline fades in (`data-stuck`, opacity only, none under reduced motion).
 * 🔒 people/the-people-pinned-row.test.ts
 */

export type PinDoor = {
  key: string;
  n: number;
  word: string;
  /** The brand colour — the count that waits on you. */
  hot?: boolean;
  on: boolean;
  onTap: () => void;
};

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
}: {
  face: PinnedFace;
  /** The view the picker shows as picked. */
  view: PeopleView;
  /** `pinnedViewOptions(…)` — People · Groups · Following · Followers · Loved ones. */
  options: readonly PickOption[];
  gates: PeopleViewGates;
  doors: readonly PinDoor[];
  /** Said in the doors' place when there is nothing to count ("Nobody yet", a refusal). */
  note?: string | null;
  action: PinAction;
  settings: PeopleSettings;
}) {
  const router = useRouter();
  const rowRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Stuck = the sticky block sits at its pinned top (the shell bar's bottom). One passive listener, read per frame.
  useEffect(() => {
    const row = rowRef.current;
    const block = row?.closest<HTMLElement>('[data-people-head]');
    if (!row || !block) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const top = parseFloat(getComputedStyle(block).top) || 0;
      setStuck(window.scrollY > 0 && block.getBoundingClientRect().top <= top + 0.5);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={rowRef} className={ps.pin} data-people-pin={face} data-first-row="" data-stuck={stuck ? '' : undefined}>
      <span data-pick="" className={ps.pinPick} data-people-pin-pick="">
        <PickMenu
          label="People — show"
          value={view}
          buttonText={PINNED_FACE_LABEL[face]}
          options={options}
          compact
          dataAttr="data-people-pin-picker"
          onPick={(k) => router.push(peopleViewHref(k as PeopleView, gates))}
        />
      </span>
      <span className={ps.pinDoors} data-people-pin-doors="" data-tour={face === 'people' ? 'people-counts' : undefined}>
        {note ? (
          <span className={ps.pinNote} role="status" data-people-pin-note="">
            {note}
          </span>
        ) : (
          doors.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={d.onTap}
              aria-pressed={d.on}
              className={`${ps.pinDoor} ${d.hot ? ps.hot : ''}`}
              data-people-pin-door={d.key}
              data-people-count={d.word}
            >
              <b>{formatCount(d.n)}</b>
              {d.word}
            </button>
          ))
        )}
      </span>
      <span className={ps.pinSpace} aria-hidden />
      {action.kind === 'invite' ? (
        <button type="button" className={ps.pinAct} onClick={action.onTap} data-people-pin-action="invite" aria-haspopup="dialog">
          Invite
        </button>
      ) : (
        <Link href="/dashboard/samahan/new" className={ps.pinAct} data-people-pin-action="new-group" aria-label="New group">
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2.4} />
          New
        </Link>
      )}
      <MenuSettingsButton menu="people" open={settingsOpen} onOpenChange={setSettingsOpen}>
        <PeopleSettingsRows settings={settings} />
      </MenuSettingsButton>
    </div>
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
