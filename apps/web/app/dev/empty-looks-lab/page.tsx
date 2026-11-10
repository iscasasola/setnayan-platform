/**
 * /dev/empty-looks-lab — THE EMPTY LOOK (Build 5 Lane H) on fixture data: no sign-in, no database. DEV-ONLY: the
 * `/dev` layout 404s every lab in production, and so does this page.
 *
 * It draws each empty part of the dashboards with its REAL empty-state markup and its REAL Example component
 * (`ExamplePreview` + the part's own card on `lib/empty-look-samples.ts`), so a side-by-side against the approved
 * prototype (`prototypes/empty_looks_user_event_2026-11-10/`) compares what the app draws.
 *
 *   ?board=user        the user dashboard's shelves, empty: Planning · Now happening · Worth planning · Ended · Told
 *   &example=0         …as shipped on origin/main before Lane H (the "Now" frame)
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CollectionEmptyState } from '@/app/_components/collection-card';
import { PlanningExample, ShelfExample } from '@/app/dashboard/(launcher)/_components/board-examples';
import { EmptyYear } from '@/app/dashboard/(launcher)/_components/year-moments-strip';

export const dynamic = 'force-dynamic';

/** The board's shelf heading, as `SectionLabel` draws it at phone width. */
function Shelf({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center gap-2.5">
        <h2 className="flex flex-1 items-center gap-2.5 whitespace-nowrap text-sm font-extrabold tracking-tight text-ink after:h-px after:flex-1 after:bg-ink/10">
          {title}
          <span className="text-xs font-medium lowercase text-[color:var(--sn-ink-400)]">{sub}</span>
        </h2>
      </div>
      {children}
    </section>
  );
}

/** The board's dashed shelf line, byte for byte. */
function DashedLine({ children }: { children: string }) {
  return (
    <p
      className="rounded-2xl border border-dashed border-ink/15 bg-white/[0.35] px-4 py-5 text-[13px] text-[color:var(--sn-ink-500)]" // no-card-ok: lab copy of the board's shipped shelf line
    >
      {children}
    </p>
  );
}

function UserBoard({ example }: { example: boolean }) {
  return (
    <>
      <Shelf title="Now happening" sub="today">
        <DashedLine>On the day itself, your event moves up here — and moves on by itself the morning after.</DashedLine>
        {example ? <ShelfExample shelf="now" /> : null}
      </Shelf>
      <Shelf title="Planning" sub="yours to run">
        <CollectionEmptyState
          title="Start an event"
          body="Guests, suppliers, the day itself — everything you plan gathers here, soonest first."
          action={
            <Link href="/dev/empty-looks-lab" className="sn-press inline-block rounded-full bg-ink px-[18px] py-[9px] text-[13px] font-semibold text-white dark:bg-black">
              Create an event
            </Link>
          }
        />
        {example ? <PlanningExample /> : null}
      </Shelf>
      <Shelf title="Worth planning" sub="not events yet">
        {example ? (
          <EmptyYear heading={null} />
        ) : (
          /* As shipped: the same tile without the Example (`EmptyYear` before Lane H). */
          <div className="sn-tile-glass sn-lift-3 rounded-2xl p-4">
            <p className="text-sm text-ink/70">Nothing in the year ahead yet.</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink/50">
              Your birthday, an anniversary, anything you mark as a yearly thing — it lands here and returns every year.
            </p>
            <p className="mt-3 text-xs font-semibold text-[color:var(--sn-gold-700)]">Add your birthday</p>
          </div>
        )}
      </Shelf>
      <Shelf title="Untold" sub="no story written yet">
        <DashedLine>
          Events move here on their own once the day has passed — this is where you pick the ones to tell. Nothing you keep is ever taken away.
        </DashedLine>
        {example ? <ShelfExample shelf="ended" /> : null}
      </Shelf>
      <Shelf title="Told" sub="in your story">
        <DashedLine>The events you write up land here, as chapters of your story.</DashedLine>
        {example ? <ShelfExample shelf="told" /> : null}
      </Shelf>
    </>
  );
}

export default async function EmptyLooksLab({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const example = sp.example !== '0';
  return (
    <main className="min-h-dvh bg-cream px-4 pb-16 pt-5 text-ink" data-empty-looks-lab={sp.board ?? 'user'}>
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
        Empty looks lab · {example ? 'Proposed' : 'Now'}
      </p>
      <UserBoard example={example} />
    </main>
  );
}
