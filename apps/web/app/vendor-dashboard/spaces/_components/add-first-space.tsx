'use client';

/**
 * 🏛 "NO SPACES YET · ADD THE FIRST" — the card's Uses row before the shop has a hall (drawing screen 8, specs
 * prototypes/spaces_final_screens_2026-11-19.html; DECISION_LOG 19 Nov "Spaces on the Shop": "the first is added from a
 * card's Uses pick"). It is the way into Spaces for a venue with no hall yet (ship review 21 Nov, finding 1): the Spaces
 * tile shows once one exists.
 *
 *   Uses · Which spaces this card books · None yet ▾
 *     ＋ Add a hall · For your shop
 *     ＋ Add something else · The six kinds
 *
 * The first space is added INSIDE the menu: the shipped Spaces sheet opens in place (never a page) and saves through the
 * one Spaces action. The sheet is loaded only when a choice is picked, so the card's first load does not grow.
 */
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { KIND_MENU, type KindChoice } from '@/lib/spaces';
import { spacesWrite, type SpacesOp } from '../actions';

const SpaceSheet = dynamic(() => import('./space-sheet').then((m) => m.SpaceSheet), { ssr: false });

const NO_TABLES = { groups: [], units: [], doors: [] };

export function AddFirstSpace({
  today,
  proOpen,
  firstHall,
}: {
  /** The shop's calendar day (Asia/Manila), YYYY-MM-DD. */
  today: string;
  proOpen: boolean;
  /** The shop's shipped Room size & capacity — the first hall opens filled from it. */
  firstHall: { widthM: number | null; lengthM: number | null; seated: number | null } | null;
}) {
  const [choice, setChoice] = useState<KindChoice | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const somethingElse = KIND_MENU.find((k) => k.key !== 'hall')!.key;

  const run = async (op: SpacesOp) => {
    const r = await spacesWrite(op, today);
    if (!r.ok) {
      setSaid(r.error);
      return false;
    }
    setSaid(null);
    setChoice(null);
    // No refresh: the action revalidated this card's route, so its answer already carries the new Uses row.
    return true;
  };

  return (
    <div className="flex min-h-14 flex-wrap items-center gap-3 border-t border-[color:var(--m-line)] py-2" data-halls-uses-first="">
      <MapPin aria-hidden className="h-5 w-5 flex-none text-[color:var(--m-slate-2)]" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-ink">Uses</span>
        <span className="block truncate text-sm text-[color:var(--m-slate-2)]">Which spaces this card books</span>
      </span>
      <PickMenu
        label="Add the first space"
        value={null}
        buttonText="None yet"
        options={[
          { key: 'hall', label: '＋ Add a hall', hint: 'For your shop' },
          { key: 'else', label: '＋ Add something else', hint: 'The six kinds' },
        ]}
        onPick={(k) => setChoice(k === 'hall' ? 'hall' : somethingElse)}
        dataAttr="data-halls-uses-add-first"
        className="!min-h-11"
      />
      {said ? (
        <p role="alert" className="w-full text-sm font-medium" style={{ color: 'rgb(var(--color-warn))' }}>
          {said}
        </p>
      ) : null}
      {choice ? (
        <SpaceSheet
          open
          onClose={() => setChoice(null)}
          at={{ mode: 'new', choice, typed: '' }}
          spaces={[]}
          tables={NO_TABLES}
          proOpen={proOpen}
          dayLabel=""
          firstHall={firstHall}
          run={(op) => run(op)}
        />
      ) : null}
    </div>
  );
}
