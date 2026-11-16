'use client';

/**
 * People › Show & sort — the filter icon right of the Ask bar (admin reorg v10, owner 17 Nov 2026: *"just add the show
 * and sort filter icon on the right of the search bar so i can pick, to verify, documents, people, supplers, events,
 * coordinators"*).
 *
 * Reposition only: the face is the Guests' shipped filter face, the sheet is the shipped `ShowSortSheet` with one
 * `ChosenRow` (one PickMenu dropdown) per set of choices, opening UPWARD on the phone (v10). A pick is a client
 * navigation (`router.push`) to `?show=` — the bar and the rail never remount.
 *
 * ⚖ ONLY CHOICES THAT DO SOMETHING. Each Show choice mounts a shipped list that already answers it. "Coordinators" and
 * the A–Z / Needs-action-first sorts have no shipped read yet, so they are NOT offered (a choice that changes nothing
 * is a fake door) — the PR's STATUS asks the owner.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ChosenRow } from '@/app/_components/form-row';
import { ShowSortSheet, ShowSortTopic } from '@/app/_components/show-sort-sheet';
import { FilterFace } from '@/app/dashboard/[eventId]/guests/_components/guests-filter-menu';
import { PEOPLE_SHOW } from './people-show';


export function PeopleShowSort({ show }: { show: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const go = (key: string) => {
    setOpen(false);
    router.push(key === 'everyone' ? '/admin/directory?show=everyone' : `/admin/directory?show=${key}`);
  };
  return (
    <>
      <button
        type="button"
        aria-label="Show and sort"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink"
        data-people-filter=""
      >
        <FilterFace on={show !== 'everyone'} />
      </button>
      {open ? (
        <ShowSortSheet
          onClose={() => setOpen(false)}
          titleId="people-show-sort-title"
          applied={show === 'everyone' ? 0 : 1}
          rows="people-filter"
          onClearAll={() => go('everyone')}
          showLabel="Show"
        >
          <ShowSortTopic name="Show" first />
          <ChosenRow
            data="people-show"
            name="Show"
            line="Who the list holds"
            value={show}
            options={PEOPLE_SHOW.map((o) => ({ key: o.key, label: o.label }))}
            onPick={go}
            dataAttr="data-people-show"
            opensUp
          />
        </ShowSortSheet>
      ) : null}
    </>
  );
}
