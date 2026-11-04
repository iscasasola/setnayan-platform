/**
 * /dev/swipe-rows-lab/suppliers — the supplier rows that delete by their swipe (owner 2026-11-03, "SWIPE LEFT TO
 * DELETE ON EVERY LIST ROW"), on fixtures, for the screenshots. Dev only — 404s in production (first statement).
 *
 *   ?part=team     the REAL `BuildLocked` ("Your team") on a model built by the REAL `buildPlanBudgetModel` from two
 *                  fixture candidates in the build (`./fixtures`, unpriced) — each "ready to lock" row is
 *                  `TeamCandidateSwipe`. Needs
 *                  NEXT_PUBLIC_EXPLORE_REPLAN_ENABLED=1 (the flag the page itself reads).
 *   ?part=package  a booked package's Included lines in the REAL `PackageItemSwipe`; the line body mirrors the
 *                  package page's markup (that page draws it inline and reads the database).
 *   ?part=notes    the working folder's own notes in the REAL `WorkingNoteSwipe`; the note body mirrors
 *                  `working-folder-notes.tsx` (a server component that reads the database itself).
 *
 * Every swipe would call the shipped action, which refuses with no session; nothing is written.
 */
import { notFound } from 'next/navigation';
import { BookmarkCheck } from 'lucide-react';
import { buildPlanBudgetModel } from '@/lib/vendors-plan-budget';
import { BuildLocked } from '@/app/dashboard/[eventId]/vendors/_components/build-locked';
import { PackageItemSwipe } from '@/app/dashboard/[eventId]/vendors/packages/[bookingId]/_components/package-item-swipe';
import { WorkingNoteSwipe } from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/working-note-swipe';
import { LAB_TEAM_ROWS } from './fixtures';

const EVENT = 'S89E-LABSUPPLIER';

/* The shipped rows' own grounds, copied so the lab draws what the pages draw — they are counted where they ship. */
const PACKAGE_ROW = 'flex items-start gap-3 rounded-lg border border-success-200/50 bg-success-50/30 p-3'; // no-card-ok: mirrors the package page's Included line (counted there), lab only
const NOTE_ROW = 'rounded-lg border border-ink/10 bg-cream/80 px-3 py-2.5'; // no-card-ok: mirrors working-folder-notes' shared note (counted there), lab only

const ITEMS = [
  { id: 'lab-i1', label: 'Flowers', text: 'Bridal bouquet' },
  { id: 'lab-i2', label: 'Flowers', text: 'Ten table centrepieces' },
  { id: 'lab-i3', label: 'Lights', text: 'Fairy-light ceiling' },
];

const NOTES = [
  { id: 'lab-n1', who: 'You · 3 Nov', body: 'Ask about the rain plan for the garden.' },
  { id: 'lab-n2', who: 'You · 2 Nov', body: 'They can do the tasting on a Saturday.' },
];

export default async function SwipeRowsSuppliersLab({ searchParams }: { searchParams: Promise<{ part?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { part = 'team' } = await searchParams;
  let body: React.ReactNode = null;
  if (part === 'team') {
    const model = buildPlanBudgetModel({
      vendorRows: LAB_TEAM_ROWS as never,
      estimatedBudgetCentavos: null,
      daysUntilWedding: 120,
      ceremonyType: null,
      venueSetting: null,
      buildPicksByGroup: new Map([
        ['catering', ['v-cater']],
        ['photography', ['v-photo']],
      ]),
    });
    body = <BuildLocked model={model} eventId={EVENT} />;
  } else if (part === 'package') {
    body = (
      <section>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">Included in this booking ({ITEMS.length})</h2>
        <ul className="mt-3 space-y-2">
          {ITEMS.map((item) => (
            <PackageItemSwipe
              key={item.id}
              eventId={EVENT}
              bookingId="lab-booking"
              itemId={item.id}
              name={item.text}
              className={PACKAGE_ROW}
            >
              <BookmarkCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success-700" strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">{item.label}</p>
                <p className="mt-0.5 text-sm text-ink/85">{item.text}</p>
              </div>
            </PackageItemSwipe>
          ))}
        </ul>
      </section>
    );
  } else if (part === 'notes') {
    body = (
      <ul className="space-y-2">
        {NOTES.map((n) => (
          <WorkingNoteSwipe key={n.id} eventId={EVENT} vendorId="v-cater" noteId={n.id} className={NOTE_ROW}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">{n.who}</p>
                <p className="whitespace-pre-line text-sm text-ink/85">{n.body}</p>
              </div>
            </div>
          </WorkingNoteSwipe>
        ))}
      </ul>
    );
  }
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl bg-cream px-4 pb-32 pt-6 text-ink" data-lab-suppliers={part}>
      {body}
    </main>
  );
}
