import { Suspense } from 'react';
import VendorOnTheDayPage from '@/app/vendor-dashboard/on-the-day/page';
import type { PickedPageProps } from './context';
import { EventFilesSection } from './event-files';

/**
 * HUB — the picked client's page (THE ONE BUILD, v111 "Hub leaves the bar, stays reachable per client"; v113 "leading
 * with Open Hub + Launch Hub, then every on-the-day feature"; spec plans/supplier_one_build_2026-11-08 B2 §2.5).
 * Mounted by the client shell (`PickedClientShell`, lane L2).
 *
 * ONE body, two doors: this renders the shipped Hub page itself (`on-the-day/page.tsx`) for THIS event with the
 * internal `__embed=hub` view — the two doors (Open Hub → `/vendor-dashboard/on-the-day?event=…`, Launch Hub →
 * `/vendor-dashboard/on-the-day/live/…`), then the event's Set up (tools for what they booked, from the shipped
 * per-booking configurator), Crew and The event's pages, with the shipped gates (a locked event shows its lock; an
 * event not in the Hub says so — never another couple's Hub). Not built (spec): the "Session" scan mode (INVENTED), the
 * per-part "Included / Not included" sheet (RULED-NOT-BUILT — Hub setup stays on Hub), the Tool maker (later).
 */
export function HubPage({ ctx }: PickedPageProps) {
  const { eventId } = ctx;
  return (
    <>
    {/* 📁 Piece 3b: Event photos · by service — the filed service groups only (unfiled chat photos never reach it). */}
    <section className="mb-6" data-hub-event-photos="">
      <Suspense fallback={null}>
        <EventFilesSection ctx={ctx} mode="hub" />
      </Suspense>
    </section>
    <Suspense
      fallback={
        <p className="px-4 py-6 text-sm text-ink/70" role="status" data-picked-client-page="hub">
          Loading this event&rsquo;s Hub…
        </p>
      }
    >
      <VendorOnTheDayPage searchParams={Promise.resolve({ event: eventId, __embed: 'hub' })} />
    </Suspense>
    </>
  );
}

export default HubPage;
