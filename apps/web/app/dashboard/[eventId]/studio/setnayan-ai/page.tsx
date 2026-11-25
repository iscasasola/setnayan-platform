import { permanentRedirect } from 'next/navigation';
import { routes } from '@/lib/routes';

/**
 * 🗑 RETIRED (final check 25 Nov, lane R · R2; owner ruling Add 19/20; LAUNCH-GATE L6): the stand-alone Setnayan AI buy
 * page. Setnayan AI is no longer sold alone — it comes with Event Pro and Event Ultra — so there is no page to buy it.
 * Every door now opens the event's plans page (Event services, `routes.dashboard.eventServices`), and an old link
 * forwards there permanently. The value copy beside it (`_components/`) stays: onboarding and the home cards read it.
 * Held by `lib/retired-pages-are-gone.test.ts`.
 */
export default async function RetiredSetnayanAiBuyPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  permanentRedirect(routes.dashboard.eventServices(eventId, 'ai'));
}
