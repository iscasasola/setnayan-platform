import { notFound } from 'next/navigation';
import { PLAN_NAME } from '@/lib/plan-buy-doors';
import { DayPosterSlide } from '@/app/dashboard/[eventId]/launch/_components/day-poster-builder';
import { PageMasthead } from '@/app/_components/page-masthead';
import { LAB_BASE, LAB_EVENT } from './fixture';

/**
 * /dev/day-poster-lab — 🖼 THE OUR DAY POSTER BUILDER on the drawing's sample event (Maria & Jose), DEV-ONLY. The SHIPPED
 * row and builder (`DayPosterSlide` → `DayPosterBuilder`), pointed at the lab's stand-in route (`./api/route.lab.ts`),
 * which draws with the real layout, gate and file writers. `?pro=1` an Event Pro event · `?after=1` past the
 * full-quality date (the drawing's four prototype views). What it cannot show: the phone upload (no storage here).
 */
export default async function DayPosterLab({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const pro = sp.pro === '1';
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col gap-4 bg-cream px-4 py-6">
      <PageMasthead title="Prints" />
      <section className="sn-frame flex flex-col gap-3 p-4" data-day-poster-lab="">
        <p className="text-sn-xs font-semibold uppercase tracking-[0.14em] text-ink/55">Our Day poster · Photo print</p>
        <DayPosterSlide
          studio={false}
          boot={{ eventId: LAB_EVENT, slug: 'maria-and-jose', saved: null, ownsPro: pro, storeShell: false, previewVersion: null, planName: PLAN_NAME.pro, base: LAB_BASE }}
        />
      </section>
    </main>
  );
}
