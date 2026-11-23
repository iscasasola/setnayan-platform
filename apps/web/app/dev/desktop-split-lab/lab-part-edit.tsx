'use client';

/**
 * DEV-ONLY: frames 3–5 of the desktop split view drawing with the REAL bar, kept-change card and draft card
 * (`app/_components/part-edit/part-edit-bar.tsx`) and the REAL words / merge (`lib/part-editor-lock.ts`), on a fixture
 * guest list (lab sample data, nobody real). The live lock itself needs the database — proven in
 * `tests/db/one-editor-per-part.db.test.ts`. Only ever imported by `/dev/*` pages, which 404 in production.
 */
import { useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { DraftOnLatestCard, KeptChange, NotSavedYet, PartEditBar, partEditStyles } from '@/app/_components/part-edit/part-edit-bar';
import { draftOnLatest, editingWords, freeWords, takenOverWords, type DraftItem, type DraftPick } from '@/lib/part-editor-lock';

type Guest = { initials: string; name: string; line: string; coming: boolean };

const BEFORE: Guest[] = [
  { initials: 'AR', name: 'Ana Reyes', line: 'Table 4 · no pork', coming: true },
  { initials: 'BT', name: 'Ben Tan', line: 'Table 4', coming: true },
  { initials: 'CL', name: 'Carla Lim', line: 'Table 7 · vegetarian', coming: false },
  { initials: 'DS', name: 'Dino Santos', line: 'Table 2', coming: true },
];
const AFTER: Guest[] = BEFORE.map((g) => (g.initials === 'AR' ? { ...g, line: 'Table 6 · no pork' } : g.initials === 'BT' ? { ...g, line: 'Table 6' } : g));

const KEPT: DraftItem[] = [
  { key: 'ana', label: 'Ana Reyes', from: 'Table 4', to: 'Table 6' },
  { key: 'ben', label: 'Ben Tan', from: 'Table 4', to: 'Table 6' },
];

function Head({ title, end }: { title: string; end?: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-2 pr-4 shadow-sn-hair">
      <span className="grid h-11 w-11 place-items-center text-ink">
        <ArrowLeft aria-hidden className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sn-lg font-bold text-ink">{title}</span>
      {end}
    </div>
  );
}

function GuestRows({ guests, readOnly }: { guests: Guest[]; readOnly?: boolean }) {
  return (
    <ul className={`sn-frame overflow-hidden ${readOnly ? partEditStyles.readOnly : ''}`}>
      {guests.map((g) => (
        <li key={g.initials} className="flex min-h-12 items-center gap-3 border-t border-ink/10 px-4 py-2 first:border-t-0">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-ink/5 text-sn-sm font-bold text-ink/70">{g.initials}</span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sn-base text-ink">{g.name}</b>
            <span className="block truncate text-sn-sm text-ink/60">{g.line}</span>
          </span>
          <span className="text-sn-xs font-bold text-ink/70">{g.coming ? 'Coming' : 'No reply'}</span>
        </li>
      ))}
    </ul>
  );
}

export function LabPartEdit({ frame }: { frame: '3' | '3b' | '4' | '5' }) {
  const [picks, setPicks] = useState<Record<string, DraftPick>>({});
  const [said, setSaid] = useState<string | null>(null);
  if (frame === '3') {
    return (
      <div data-lab-frame="3">
        <Head title="Guests" />
        <div className="px-3">
          <PartEditBar tone="held" words={editingWords('Ria', 'guests')} />
          <GuestRows guests={BEFORE} readOnly />
        </div>
      </div>
    );
  }
  if (frame === '3b') {
    return (
      <div data-lab-frame="3b">
        <Head title="Guests" end={<ActionButton tone="brand" icon={Plus} label="Add" onClick={() => setSaid('(lab) Add opens the guest form.')} />} />
        <div className="px-3">
          <PartEditBar tone="free" words={freeWords('guests', 'Ria')} />
          {said ? <p className="mb-2 text-sn-sm text-ink/60">{said}</p> : null}
          <GuestRows guests={AFTER} />
        </div>
      </div>
    );
  }
  if (frame === '4') {
    return (
      <div data-lab-frame="4">
        <Head title="Guests" />
        <div className="px-3">
          <PartEditBar tone="bumped" words={takenOverWords('Claire', 'guests', true)} />
          <KeptChange part="guests" items={KEPT} free={false} onPutBack={() => undefined} onDiscard={() => setSaid('(lab) Discarded.')} />
          {said ? <p className="mb-2 text-sn-sm text-ink/60">{said}</p> : null}
          <GuestRows guests={BEFORE} readOnly />
        </div>
      </div>
    );
  }
  // Claire moved Ana to Table 5 and left Ben alone.
  const rows = draftOnLatest(KEPT, { ana: 'Table 5', ben: 'Table 4' });
  return (
    <div data-lab-frame="5">
      <Head title="Guests · your draft" end={<NotSavedYet />} />
      <div className="px-3">
        <DraftOnLatestCard
          host="Claire"
          rows={rows}
          picks={picks}
          onPick={(k, p) => setPicks((v) => ({ ...v, [k]: p }))}
          onConfirm={() => setSaid('(lab) Confirm writes the picks into the part’s own fields and saves them.')}
          onDiscard={() => setSaid('(lab) Draft discarded.')}
        />
        {said ? <p className="mt-2 text-sn-sm text-ink/60">{said}</p> : null}
      </div>
    </div>
  );
}
