'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPen } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { setGuestTitleGender } from '../title-gender-actions';
import { TitlePicker } from './title-picker';

export type TitleWaitingPerson = {
  guestId: string;
  name: string;
  /** Their role word ("Parent of the Groom"'s role — "Parents of the Groom"). */
  roleWord: string;
  /** Their stored title ("Atty."), or null when they have none. */
  title: string | null;
  /** The pending pick's key and words ("Atty.|" · "Atty. — Woman or Man?"). */
  key: string;
  text: string;
};

/**
 * 🪪 "N PEOPLE NEED WOMAN OR MAN FOR THEIR TITLE" — ONE prompt on the Guests page (owner 2026-10-17), shown only while
 * somebody's printed word ("Mother of the Groom") waits on it, gone when none are left. It opens a sheet listing them,
 * each with the SAME Title dropdown, already narrowed to their own title's two entries ("Atty. (Woman)" · "Atty. (Man)")
 * — no separate Woman · Man buttons. Each pick saves as it is tapped (`setGuestTitleGender`). No email, no notification.
 * Who is listed is `needsWomanOrMan` (lib/guest-title.ts), the same rule as the card's pending pick.
 */
export function TitlesWaiting({
  eventId,
  people,
  classes,
}: {
  eventId: string;
  people: TitleWaitingPerson[];
  /** The List's own strip classes (the requests-to-join row's), so this reads as one more row of the list. */
  classes: { row: string; t: string; s: string; acts: string };
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<Record<string, true>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [, start] = useTransition();
  const router = useRouter();
  const headingId = useId();
  const left = people.filter((p) => !saved[p.guestId]).length;
  if (people.length === 0) return null;

  const close = () => {
    setOpen(false);
    router.refresh();
  };
  const save = (guestId: string, key: string) =>
    start(async () => {
      const res = await setGuestTitleGender(eventId, guestId, key);
      if (res.ok) {
        setSaved((s) => ({ ...s, [guestId]: true }));
        setFailed(({ [guestId]: _gone, ...rest }) => rest);
      } else setFailed((f) => ({ ...f, [guestId]: res.error }));
    });

  const count = (n: number) => `${n} ${n === 1 ? 'person needs' : 'people need'} Woman or Man for their title`;

  return (
    <>
      <div className={classes.row} data-titles-waiting="">
        <div>
          <div className={classes.t}>{count(people.length)}</div>
          <div className={classes.s}>So the invitation says Mother or Father — pick their title again.</div>
        </div>
        <span className={classes.acts} data-fit-acts="">
          <ActionButton tone="brand" main icon={UserPen} label="Pick" onClick={() => setOpen(true)} />
        </span>
      </div>
      <Sheet open={open} onClose={close} labelledById={headingId} rise>
        <div className="flex min-h-0 flex-col" data-titles-waiting-sheet="">
          <div className="px-5 pb-2 pt-5 pr-14">
            <h2 id={headingId} className="font-display text-xl text-ink">
              Woman or Man?
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              {left === 0 ? 'All done — every title says it now.' : `Pick each title again with Woman or Man. ${count(left)}.`}
            </p>
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-ink/10 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {people.map((p) => (
              <li key={p.guestId} className="flex items-center gap-3 py-3" data-titles-waiting-row={p.guestId}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                  <span className="block truncate text-xs text-ink/55">
                    {failed[p.guestId] ? <span className="text-danger-700">{failed[p.guestId]}</span> : saved[p.guestId] ? '✓ Saved' : p.roleWord}
                  </span>
                </span>
                <span className="w-[10.5rem] shrink-0">
                  <TitlePicker
                    name={`title_${p.guestId}`}
                    value={p.key}
                    current={p.title}
                    narrowTo={p.title}
                    unlisted={{ key: p.key, text: p.text }}
                    onPicked={(key) => save(p.guestId, key)}
                    className="w-full justify-between border border-ink/15 !bg-white/80 font-medium"
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>
    </>
  );
}
