/**
 * /dev/empty-looks-lab — THE EMPTY LOOK (Build 5 Lane H) on fixture data: no sign-in, no database. DEV-ONLY: the
 * `/dev` layout 404s every lab in production, and so does this page.
 *
 * It draws each empty part of the dashboards with its REAL empty-state markup and its REAL Example component
 * (`ExamplePreview` + the part's own card on `lib/empty-look-samples.ts`), so a side-by-side against the approved
 * prototype (`prototypes/empty_looks_user_event_2026-11-10/`) compares what the app draws.
 *
 *   ?board=user        the user dashboard's shelves, empty: Planning · Now happening · Worth planning · Ended · Told
 *   ?board=event       the event parts with no lab of their own: Hub (the real `HubStage`, no address) · Schedule
 *                      (the empty rail's panel) · Memories (the gallery's empty line)
 *   &example=0         …as shipped on origin/main before Lane H (the "Now" frame; the Hub keeps its Example — it lives in HubStage)
 *
 * The other event parts are drawn by their own labs: `/dev/home-lab?empty=1` (Today) · `/dev/guests-lab?empty=1` ·
 * `/dev/suppliers-lab?…&empty=1` (Booked) · `/dev/budget-lab?state=empty`.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CollectionEmptyState } from '@/app/_components/collection-card';
import { PlanningExample, ShelfExample } from '@/app/dashboard/(launcher)/_components/board-examples';
import { EmptyYear } from '@/app/dashboard/(launcher)/_components/year-moments-strip';
import { HubStage } from '@/app/dashboard/[eventId]/launch/_components/hub-stage';
import { ChaptersExample } from '@/app/dashboard/[eventId]/schedule/_components/day-rail';
import { MemoriesExample } from '@/app/_components/memories/event-memories-gallery';
import { resolveHubFacts, resolveHubStageSelection, resolveHubStanding } from '@/lib/event-hub-control';
import { PUBLIC_SITE_PAGES } from '@/lib/public-site-pages';

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

/** A new event, every read answered: the Hub with no address, the empty rail, the empty gallery. */
function EventBoard({ example }: { example: boolean }) {
  const read = { measured: true, eventDate: null, eventEndDate: null, clearedAt: null, timezone: 'Asia/Manila', slug: null };
  const standing = resolveHubStanding(read);
  const facts = resolveHubFacts(read, { shared: true, measured: true, invited: 0, replied: 0 });
  return (
    <>
      <Shelf title="Event Hub" sub="no address yet">
        <HubStage
          slug={null}
          standing={standing}
          facts={facts}
          livePhase={standing.stage}
          initialPhase={resolveHubStageSelection({ param: undefined, live: standing.stage })}
          stages={PUBLIC_SITE_PAGES.map((p) => ({ phase: p.phaseParam, blurb: p.blurb }))}
          editHref="/dev/empty-looks-lab"
          rolesByPhase={{}}
          armedRole={null}
        />
      </Shelf>
      <Shelf title="Schedule" sub="event day">
        {/* The empty rail's panel as `EmptyRail` draws it for an editor with no templates. */}
        <div className="max-w-[520px] rounded-2xl bg-white/90 px-5 pb-4 pt-5 shadow-[0_28px_54px_-30px_rgba(30,26,18,0.5)]">
          <p className="text-[13.5px] text-ink/65">Nothing on the rail yet — tap a time to add the first moment.</p>
          {example ? <ChaptersExample /> : null}
        </div>
      </Shelf>
      <Shelf title="Memories" sub="all">
        <div className="-mx-4" style={{ ['--mem-cols' as string]: '3' }}>
          <p className="px-4 py-10 text-center text-[14px] text-ink/60">Your photos land here as your guests and suppliers shoot.</p>
          {example ? <MemoriesExample gridClass="grid gap-[1.5px] [grid-template-columns:repeat(var(--mem-cols),minmax(0,1fr))]" /> : null}
        </div>
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
      {sp.board === 'event' ? <EventBoard example={example} /> : <UserBoard example={example} />}
    </main>
  );
}
