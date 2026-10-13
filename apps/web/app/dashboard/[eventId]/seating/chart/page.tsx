import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchGuestsByEvent } from '@/lib/guests';
import { fetchAssignments, fetchTables } from '@/lib/seating';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { printFileName } from '@/lib/print-pieces';
import {
  DEFAULT_ENTRANCE_CHART_SIZE,
  ENTRANCE_CHART_LAYOUTS,
  ENTRANCE_CHART_LAYOUT_LABELS,
  ENTRANCE_CHART_SIZES,
  azEntries,
  chartFileStem,
  chartUnits,
  entranceChartFits,
  entranceChartTooBigWords,
  seatingUnits,
  unseatedCount,
  type EntranceChartLayout,
  type EntranceChartSize,
} from '@/lib/print-entrance-chart';
import { PageMasthead } from '@/app/_components/page-masthead';
import { NotSharedWithYou } from '../../_components/not-shared-with-you';
import { EntranceChart, type ChartVerdicts } from './_components/entrance-chart';

export const metadata = { title: 'Entrance seating chart' };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

/**
 * THE ENTRANCE SEATING CHART — the couple's page for the one large sheet at
 * the door (owner 2026-10-13: *"printouts. one seating chart for the
 * entrance"*), beside the seating pack. The page measures, before any press,
 * whether every seated name fits each paper size in each layout — so a sheet
 * too full is said here, with the size that holds everyone, and the Save
 * button never makes a chart that loses someone. The file itself is drawn by
 * the seating pack's own route (`seating/print?chart=…`).
 */
export default async function EntranceChartPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // The seat rooms' own gate: an event type with no seat plan has no chart.
  if (!surfaceEnabled(await resolveProfileByEvent(eventId), 'seating')) redirect(`/dashboard/${eventId}`);

  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('event_id, slug').eq('event_id', eventId).maybeSingle();
  if (!event) notFound();

  // A helper without the guest list or the seat plan reads zero rows — say
  // what is true rather than draw an empty chart (the seat plan page's rule).
  const viewer = await fetchEventViewer(supabase, eventId, user.id);
  if (isDelegateWithoutArea(viewer, 'guest_list')) return <NotSharedWithYou title="Entrance seating chart" thing="guest list" />;
  if (isDelegateWithoutArea(viewer, 'seat_plan')) return <NotSharedWithYou title="Entrance seating chart" thing="seat plan" />;

  const [tables, assignments, guests] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
  ]);
  const units = seatingUnits(tables, assignments, guests);
  const shared = { coupleName: '', dateLabel: null, units: chartUnits(units), entries: azEntries(units, guests) };
  const seated = shared.entries.length;

  const verdicts = {} as ChartVerdicts;
  for (const layout of ENTRANCE_CHART_LAYOUTS) {
    const fits = entranceChartFits({ ...shared, layout });
    verdicts[layout] = {} as ChartVerdicts[EntranceChartLayout];
    for (const s of ENTRANCE_CHART_SIZES) {
      const f = fits[s.key];
      verdicts[layout][s.key] = f.ok ? null : { words: entranceChartTooBigWords(seated, s.key, f.suggest), suggest: f.suggest };
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-5 px-1 py-2">
      <Link href={`/dashboard/${eventId}/seating`} className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-ink/60 hover:text-ink">
        <ArrowLeft className="h-4 w-4 text-sn-accent" /> Seat plan
      </Link>
      <PageMasthead title={metadata.title} />
      <EntranceChart
        eventId={eventId}
        layouts={ENTRANCE_CHART_LAYOUTS.map((key) => ({ key, label: ENTRANCE_CHART_LAYOUT_LABELS[key] }))}
        sizes={ENTRANCE_CHART_SIZES.map((s) => ({ key: s.key, label: `${s.label} · ${s.mm}`, short: s.label }))}
        defaultSize={DEFAULT_ENTRANCE_CHART_SIZE satisfies EntranceChartSize}
        files={{
          table: printFileName(event.slug as string | null, chartFileStem('table')),
          az: printFileName(event.slug as string | null, chartFileStem('az')),
        }}
        verdicts={verdicts}
        seated={seated}
        unseated={unseatedCount(tables, assignments, guests)}
      />
    </section>
  );
}
